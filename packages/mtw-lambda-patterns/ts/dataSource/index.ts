import { singleFlightFactory, SingleFlightConfig } from '../singleFlight'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { v4 as uuidv4 } from 'uuid'
import { PublishCommand } from '@aws-sdk/client-sns'

export type SerializableObject = Record<string, unknown>

export type SnapshotType<SnapshotPayload extends SerializableObject> = SnapshotPayload & {
    createdAt: number;
    expiresAt: number;
}

export type DynamoGetItemArgs = {
    Key: Record<string, string>
    ProjectionFields?: string[]
    getAllFields?: boolean
    ExpressionAttributeNames?: Record<string, string>
    ConsistentRead?: boolean
}

export type DynamoQueryArgs = {
    Key: Record<string, string>
    IndexName?: '' | 'DataCategoryIndex' | 'ScopedIdIndex' | 'PlayerIndex' | 'ZoneIndex' | 'ConnectionIndex'
    ProjectionFields?: string[]
    KeyConditionExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    FilterExpression?: string
    allFields?: boolean
}

export type DynamoUtils = {
    putItem: (item: Record<string, any>) => Promise<unknown>
    getItem: <Get>(args: DynamoGetItemArgs) => Promise<Get | undefined>
    query: <Q>(args: DynamoQueryArgs) => Promise<Q[]>
    optimisticUpdate: (params: any) => Promise<any>
}

export type SnsUtils = {
    send: (command: PublishCommand) => Promise<unknown>
}

export class DataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject> {
    readonly internalCache: unknown
    readonly dynamo: DynamoUtils
    readonly sns: SnsUtils
    readonly primaryKeyName: string
    readonly dataSourceKey: string
    readonly snapshotContentGenerator: (streamKey: string) => Promise<SnapshotPayload>
    readonly singleFlight: ReturnType<typeof singleFlightFactory<SnapshotType<SnapshotPayload>>>
    readonly feedbackTopicArn: string
    _snapshot: SnapshotType<SnapshotPayload> | undefined

    constructor({ 
        internalCache, 
        dynamo,
        sns,
        primaryKeyName,
        dataSourceKey,
        snapshotContentGenerator,
        feedbackTopicArn,
        snapshotTimeoutMs = 5000
    }: { 
        internalCache: unknown, 
        dynamo: DynamoUtils,
        sns: SnsUtils,
        primaryKeyName: string,
        dataSourceKey: string,
        snapshotContentGenerator: (streamKey: string) => Promise<SnapshotPayload>,
        feedbackTopicArn: string,
        snapshotTimeoutMs?: number
    }) {
        this.internalCache = internalCache
        this.dynamo = dynamo
        this.sns = sns
        this.primaryKeyName = primaryKeyName
        this.dataSourceKey = dataSourceKey
        this.snapshotContentGenerator = snapshotContentGenerator
        this.feedbackTopicArn = feedbackTopicArn
        this._snapshot = undefined

        // Initialize singleFlight for snapshot generation coordination
        const singleFlightConfig: SingleFlightConfig = {
            optimisticUpdateFunction: dynamo.optimisticUpdate,
            getItemFunction: dynamo.getItem,
            primaryKey: primaryKeyName,
            timeoutMs: snapshotTimeoutMs
        }
        this.singleFlight = singleFlightFactory<SnapshotType<SnapshotPayload>>(singleFlightConfig)
    }

    async generateSnapshot(streamKey: string): Promise<SnapshotType<SnapshotPayload>> {
        const now = getCurrentTimestamp()
        const content = await this.snapshotContentGenerator(streamKey)
        return {
            ...content,
            createdAt: now,
            expiresAt: now + 300000 // 5 minutes default expiration
        }
    }

    async getSnapshot(streamKey: string): Promise<SnapshotPayload> {
        // Check in-memory cache first
        if (this._snapshot && getCurrentTimestamp() <= this._snapshot.expiresAt) {
            return this._snapshot
        }

        // Try to load from store
        const loaded = await this.loadSnapshotFromStore(streamKey).catch(() => undefined)
        if (loaded && getCurrentTimestamp() <= loaded.expiresAt) {
            this._snapshot = loaded
            return loaded
        }

        // Use singleFlight to coordinate snapshot generation
        const generated = await this.singleFlight({
            category: `snapshot-generation-${this.dataSourceKey}`,
            argumentHash: streamKey, // Use streamKey as the argument hash
            computation: async () => {
                // Perform the actual snapshot generation and storage
                const snapshot = await this.generateSnapshot(streamKey)
                await this.storeSnapshotToStore({ streamKey, snapshot }).catch(() => undefined)
                return snapshot
            },
            retrieval: async () => {
                // Retrieve the snapshot that was just stored by the computation
                const stored = await this.loadSnapshotFromStore(streamKey)
                if (!stored) {
                    throw new Error('Snapshot not found after computation completed')
                }
                return stored
            }
        })

        this._snapshot = generated
        return generated
    }

    async streamEvent({ update, streamKey, detailType }: { update: UpdatePayload, streamKey: string, detailType: string }): Promise<void> {
        const now = getCurrentTimestamp()
        const eventId = `${now}::${uuidv4()}`
        
        // Create the event record for DynamoDB storage
        const eventRecord = {
            [this.primaryKeyName]: `STREAM#${this.dataSourceKey}::${streamKey}`,
            DataCategory: `EVENT#${eventId}`,
            update,
            timestamp: now,
            streamKey
        }

        // Create the EventBridge event
        const eventBridgeEvent = {
            Source: this.dataSourceKey,
            DetailType: detailType,
            Detail: {
                streamKey,
                update,
                timestamp: now
            }
        }

        // Execute both operations in parallel
        await Promise.all([
            // Store event to DynamoDB for replay
            this.dynamo.putItem(eventRecord),
            // Publish to EventBridge for real-time subscribers
            eventBridgeClient.send([eventBridgeEvent])
        ])
    }

    async initializeSubscription({ sessionId, streamKey }: { sessionId: `SESSION#${string}`, streamKey: string }): Promise<void> {
        // Get the current snapshot for the stream
        const snapshot = await this.getSnapshot(streamKey) as SnapshotType<SnapshotPayload>
        
        // Query for recent events since the snapshot was created
        const recentEvents = await this.getRecentEvents(streamKey, snapshot.createdAt)
        
        // Deliver both snapshot and events via SNS Feedback
        await this.deliverReplayData({ sessionId, streamKey, snapshot, events: recentEvents })
    }

    protected async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: UpdatePayload, timestamp: number, eventId: string }>> {
        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        // Query for events with DataCategory starting with 'EVENT#' and timestamp >= sinceTimestamp
        const events = await this.dynamo.query<{
            DataCategory: string;
            update: UpdatePayload;
            timestamp: number;
            eventId: string;
        }>({
            Key: { [this.primaryKeyName]: primaryKey },
            KeyConditionExpression: 'begins_with(DataCategory, :eventPrefix)',
            FilterExpression: 'timestamp >= :sinceTimestamp',
            ExpressionAttributeValues: {
                ':eventPrefix': 'EVENT#',
                ':sinceTimestamp': sinceTimestamp
            },
            allFields: true
        })
        
        // Sort by timestamp to ensure chronological order
        return events ? events.sort((a, b) => a.timestamp - b.timestamp) : []
    }

    protected async deliverReplayData({ 
        sessionId, 
        streamKey, 
        snapshot, 
        events 
    }: { 
        sessionId: `SESSION#${string}`; 
        streamKey: string; 
        snapshot: SnapshotType<SnapshotPayload>; 
        events: Array<{ update: UpdatePayload, timestamp: number, eventId: string }> 
    }): Promise<void> {
        // Send snapshot first
        const snapshotCommand = new PublishCommand({
            TopicArn: this.feedbackTopicArn,
            Message: JSON.stringify({
                messageType: 'DataSourceSnapshot',
                dataSourceKey: this.dataSourceKey,
                streamKey,
                snapshot: {
                    ...snapshot,
                    // Remove internal fields that shouldn't be sent to client
                    createdAt: undefined,
                    expiresAt: undefined
                }
            }),
            MessageAttributes: {
                Targets: { 
                    DataType: 'String.Array', 
                    StringValue: JSON.stringify([sessionId]) 
                },
                Type: { 
                    DataType: 'String', 
                    StringValue: 'Success' 
                }
            }
        })
        await this.sns.send(snapshotCommand)

        // Send events if any
        if (events.length > 0) {
            const eventsCommand = new PublishCommand({
                TopicArn: this.feedbackTopicArn,
                Message: JSON.stringify({
                    messageType: 'DataSourceEvents',
                    dataSourceKey: this.dataSourceKey,
                    streamKey,
                    events: events.map(({ update, timestamp }) => ({
                        update,
                        timestamp
                    }))
                }),
                MessageAttributes: {
                    Targets: { 
                        DataType: 'String.Array', 
                        StringValue: JSON.stringify([sessionId]) 
                    },
                    Type: { 
                        DataType: 'String', 
                        StringValue: 'Success' 
                    }
                }
            })
            await this.sns.send(eventsCommand)
        }
    }

    protected async loadSnapshotFromStore(streamKey: string): Promise<SnapshotType<SnapshotPayload> | undefined> {
        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        const result = await this.dynamo.getItem<SnapshotType<SnapshotPayload>>({
            Key: { [this.primaryKeyName]: primaryKey, DataCategory: 'Meta::Snapshot' }
        })
        
        return result
    }

    protected async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        await this.dynamo.putItem({
            [this.primaryKeyName]: primaryKey,
            DataCategory: 'Meta::Snapshot',
            ...snapshot
        })
    }
}


