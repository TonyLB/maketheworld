import { singleFlightFactory, SingleFlightConfig } from '../singleFlight'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { v4 as uuidv4 } from 'uuid'
import { PublishCommand } from '@aws-sdk/client-sns'
import { StreamingEvent, StreamingEventPayload } from './baseClasses'

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

// Utility type for streamEvent function signature
export type StreamEventFunction<UpdatePayload extends string | SerializableObject> = 
    (params: { update: UpdatePayload, streamKey: string, detailType: string }) => Promise<void>

export class DataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject, SubscribedEvent extends StreamingEventPayload | never = never> {
    readonly dynamo: DynamoUtils
    readonly sns: SnsUtils
    readonly messageBus: { 
        send: (payload: any) => void;
        subscribe: (subscription: any) => void;
    }
    readonly primaryKeyName: string
    readonly dataSourceKey: string
    readonly snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>
    readonly singleFlight?: ReturnType<typeof singleFlightFactory<SnapshotType<SnapshotPayload>>>
    readonly feedbackTopicArn: string
    readonly replayable: boolean
    readonly subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent
    readonly receiveEvents?: (params: { 
        event: SubscribedEvent, 
        streamEvent: StreamEventFunction<UpdatePayload>
    }) => Promise<void>
    _snapshots: Record<string, SnapshotType<SnapshotPayload>> = {}

    constructor({ 
        dynamo,
        sns,
        messageBus,
        primaryKeyName,
        dataSourceKey,
        snapshotContentGenerator,
        feedbackTopicArn,
        replayable = true,
        snapshotTimeoutMs = 5000,
        subscribedEventTypeGuard,
        receiveEvents
    }: { 
        dynamo: DynamoUtils,
        sns: SnsUtils,
        messageBus: { 
            send: (payload: any) => void;
            subscribe: (subscription: any) => void;
        },
        primaryKeyName: string,
        dataSourceKey: string,
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>,
        feedbackTopicArn: string,
        replayable?: boolean,
        snapshotTimeoutMs?: number,
        subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent,
        receiveEvents?: (params: { 
            event: SubscribedEvent, 
            streamEvent: StreamEventFunction<UpdatePayload>
        }) => Promise<void>
    }) {
        this.dynamo = dynamo
        this.sns = sns
        this.messageBus = messageBus
        this.primaryKeyName = primaryKeyName
        this.dataSourceKey = dataSourceKey
        this.snapshotContentGenerator = snapshotContentGenerator
        this.feedbackTopicArn = feedbackTopicArn
        this.replayable = replayable
        this.subscribedEventTypeGuard = subscribedEventTypeGuard
        this.receiveEvents = receiveEvents

        // Initialize singleFlight for snapshot generation coordination only if replayable
        if (this.replayable) {
            const singleFlightConfig: SingleFlightConfig = {
                optimisticUpdateFunction: dynamo.optimisticUpdate,
                getItemFunction: dynamo.getItem,
                primaryKey: primaryKeyName,
                timeoutMs: snapshotTimeoutMs
            }
            this.singleFlight = singleFlightFactory<SnapshotType<SnapshotPayload>>(singleFlightConfig)
        }
    }

    async generateSnapshot(streamKey: string): Promise<SnapshotType<SnapshotPayload>> {
        const now = getCurrentTimestamp()
        
        // For non-replayable data sources or when no generator is provided, use minimal content
        if (!this.replayable || !this.snapshotContentGenerator) {
            return {
                streamKey,
                timestamp: now,
                createdAt: now,
                expiresAt: now + 300000 // 5 minutes default expiration
            } as unknown as SnapshotType<SnapshotPayload>
        }
        
        const content = await this.snapshotContentGenerator(streamKey)
        return {
            ...content,
            createdAt: now,
            expiresAt: now + 300000 // 5 minutes default expiration
        }
    }

    async getSnapshot(streamKey: string): Promise<SnapshotPayload> {
        // For non-replayable data sources, return a minimal snapshot without generation
        if (!this.replayable) {
            return { streamKey, timestamp: getCurrentTimestamp() } as unknown as SnapshotPayload
        }

        // Check in-memory cache first
        if (this._snapshots[streamKey] && getCurrentTimestamp() <= this._snapshots[streamKey].expiresAt) {
            return this._snapshots[streamKey]
        }

        // Try to load from store
        const loaded = await this.loadSnapshotFromStore(streamKey).catch(() => undefined)
        if (loaded && getCurrentTimestamp() <= loaded.expiresAt) {
            this._snapshots[streamKey] = loaded
            return loaded
        }

        // Use singleFlight to coordinate snapshot generation
        const generated = await this.singleFlight!({
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

        this._snapshots[streamKey] = generated
        return generated
    }

    async streamEvent(params: Parameters<StreamEventFunction<UpdatePayload>>[0]): Promise<void> {
        const { update, streamKey, detailType } = params
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

        // Create the internal messageBus event
        const messageBusEvent = {
            messageType: 'StreamingEvent' as const,
            dataSourceKey: this.dataSourceKey,
            detailType,
            event: {
                streamKey,
                update,
                timestamp: now
            },
            timestamp: now
        }

        // Execute all operations in parallel
        await Promise.all([
            // Store event to DynamoDB for replay
            (this.replayable ? this.dynamo.putItem(eventRecord) : Promise.resolve()).then(() => {
                // Publish to internal messageBus for other DataSources
                this.messageBus.send(messageBusEvent)
            }),
            // Publish to EventBridge for real-time subscribers
            eventBridgeClient.send([eventBridgeEvent])
        ])
        
    }

    async initializeSubscription({ sessionId, streamKey }: { sessionId: `SESSION#${string}`, streamKey: string }): Promise<void> {
        // Throw error for non-replayable data sources
        if (!this.replayable) {
            throw new Error(`DataSource '${this.dataSourceKey}' is not replayable and does not support subscription initialization`)
        }

        // Get the current snapshot for the stream
        const snapshot = await this.getSnapshot(streamKey) as SnapshotType<SnapshotPayload>
        
        // Query for recent events since the snapshot was created
        const recentEvents = await this.getRecentEvents(streamKey, snapshot.createdAt)
        
        // Deliver both snapshot and events via SNS Feedback
        await this.deliverReplayData({ sessionId, streamKey, snapshot, events: recentEvents })
    }

    protected async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: UpdatePayload, timestamp: number, eventId: string }>> {
        // For non-replayable data sources, return empty array since no events are stored
        if (!this.replayable) {
            return []
        }

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
        // For non-replayable data sources, return undefined since no snapshots are stored
        if (!this.replayable) {
            return undefined
        }

        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        const result = await this.dynamo.getItem<SnapshotType<SnapshotPayload>>({
            Key: { [this.primaryKeyName]: primaryKey, DataCategory: 'Meta::Snapshot' }
        })
        
        return result
    }

    protected async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        // For non-replayable data sources, do nothing since no snapshots are stored
        if (!this.replayable) {
            return
        }

        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        await this.dynamo.putItem({
            [this.primaryKeyName]: primaryKey,
            DataCategory: 'Meta::Snapshot',
            ...snapshot
        })
    }


    //
    // Subscribe this data source to a messageBus for processing incoming events.
    // Only subscribes if subscribedEventTypeGuard is configured.
    //
    subscribe(): void {
        if (!this.subscribedEventTypeGuard || !this.receiveEvents) {
            return // No event processing configured
        }

        // Create a derived type guard that works with the full StreamingEvent structure
        const streamingEventTypeGuard = (message: any): message is StreamingEvent => {
            if (!this.subscribedEventTypeGuard) {
                return false
            }
            if (message.messageType !== 'StreamingEvent') {
                return false
            }
            const { messageType, ...rest } = message
            return this.subscribedEventTypeGuard(rest)
        }

        // Subscribe to messageBus with the derived type guard and receiveEvents callback
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}`,
            priority: 5, // Default priority for data source processing
            filter: streamingEventTypeGuard,
            callback: async ({ payloads }) => {
                await Promise.all(
                    payloads.map((streamingEvent) => 
                        this.receiveEvents!({
                            event: streamingEvent,
                            streamEvent: (params) => this.streamEvent(params)
                        })
                    )
                )
            }
        })
    }
}


