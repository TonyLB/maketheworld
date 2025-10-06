import { singleFlightFactory, SingleFlightConfig } from '../singleFlight'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { v4 as uuidv4 } from 'uuid'
import { PublishCommand } from '@aws-sdk/client-sns'
import { StreamingEvent, StreamingEventPayload, DataSourceEventSerializer, EventPayload } from './baseClasses'
import { 
    CoreExternalFormat, 
    toEventBridgeFormat, 
    toDynamoDBFormat 
} from './formatTransform'

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

export type DynamoUtils<KeyType extends string = string> = {
    putItem: (item: any) => Promise<unknown>
    getItem: <Get extends Partial<Record<string, any> & { [K in KeyType]: string } & { DataCategory: string }>>(args: any) => Promise<Get | undefined>
    query: <Query extends Record<string, any> & { [K in KeyType]: string } & { DataCategory: string }>(args: any) => Promise<Query[]>
    optimisticUpdate: (params: any) => Promise<any>
}

export type SnsUtils = {
    send: (command: PublishCommand) => Promise<unknown>
}

// Utility type for streamEvent function signature
export type StreamEventFunction<UpdatePayload = any> = 
    (params: { update: UpdatePayload, streamKey: string }) => Promise<void>

export class DataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends EventPayload, SubscribedEvent extends StreamingEventPayload | never = never, ExternalUpdatePayload extends EventPayload = EventPayload, KeyType extends string = string> {
    readonly dynamo: DynamoUtils<KeyType>
    readonly sns: SnsUtils
    readonly messageBus: { 
        send: (payload: any) => void;
        subscribe: (subscription: any) => void;
    }
    readonly primaryKeyName: KeyType
    readonly dataSourceKey: string
    readonly snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>
    readonly singleFlight?: ReturnType<typeof singleFlightFactory<SnapshotType<SnapshotPayload>>>
    readonly feedbackTopicArn: string
    readonly replayable: boolean
    readonly subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent
    readonly receiveEvents?: (params: { 
        events: SubscribedEvent[], 
        streamEvent: StreamEventFunction<UpdatePayload>
    }) => Promise<void>
    readonly eventSerializer?: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload>
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
        receiveEvents,
        eventSerializer
    }: { 
        dynamo: DynamoUtils<KeyType>,
        sns: SnsUtils,
        messageBus: { 
            send: (payload: any) => void;
            subscribe: (subscription: any) => void;
        },
        primaryKeyName: KeyType,
        dataSourceKey: string,
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>,
        feedbackTopicArn: string,
        replayable?: boolean,
        snapshotTimeoutMs?: number,
        subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent,
        receiveEvents?: (params: { 
            events: SubscribedEvent[], 
            streamEvent: StreamEventFunction<UpdatePayload>
        }) => Promise<void>,
        eventSerializer?: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload>
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
        this.eventSerializer = eventSerializer

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
        // For non-replayable data sources, throw an error since snapshots are not supported
        if (!this.replayable) {
            throw new Error(`DataSource '${this.dataSourceKey}' is not replayable and does not support snapshots`)
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
        const { update, streamKey } = params
        const now = getCurrentTimestamp()
        const eventId = `${now}::${uuidv4()}`
        
        // Create CoreExternalFormat - use serializer if available, otherwise use update directly
        const coreFormat: CoreExternalFormat = this.eventSerializer 
            ? {
                dataSourceKey: this.dataSourceKey,
                streamKey,
                update: this.eventSerializer.serialize({
                    dataSourceKey: this.dataSourceKey,
                    streamKey,
                    update
                })
            }
            : {
                dataSourceKey: this.dataSourceKey,
                streamKey,
                update
            }

        // Transform to context-specific formats
        const eventRecord = toDynamoDBFormat(coreFormat, this.primaryKeyName, eventId)
        const eventBridgeEvent = toEventBridgeFormat(coreFormat)

        // Create the internal messageBus event
        const messageBusEvent = {
            type: 'StreamingEvent' as const,
            dataSourceKey: this.dataSourceKey,
            event: {
                streamKey,
                update
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
            eventBridgeClient.send([eventBridgeEvent as any])
        ])
        
    }

    /**
     * Get the event serializer for this DataSource (if available)
     * Useful for external EventBridge event deserialization
     */
    getSerializer(): DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload> | undefined {
        return this.eventSerializer
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

    protected async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string, type: string }>> {
        // For non-replayable data sources, return empty array since no events are stored
        if (!this.replayable) {
            return []
        }

        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        // Query for events with DataCategory starting with 'EVENT#' and timestamp >= sinceTimestamp
        // Note: This relies on lexicographic sorting of timestamp strings, which works for epoch timestamps
        // until year 2286 (when timestamps reach 10 digits). While lexicographic sorting doesn't guarantee
        // numeric sorting in general (e.g., "100" < "99"), epoch timestamps will be the same length for
        // centuries, so fixing the problem would be premature overengineering.
        //
        // That said, we might need to pay attention around the year 2038, when timestamps will exceed the
        // storage space of 32-bit integers.
        const events = await this.dynamo.query<Record<KeyType, string> & {
            DataCategory: string;
            type: string;
            update: ExternalUpdatePayload;
        }>({
            Key: { [this.primaryKeyName]: primaryKey },
            KeyConditionExpression: 'DataCategory BETWEEN :timestampPrefix AND :timestampEndRange',
            ExpressionAttributeValues: {
                ':timestampPrefix': `EVENT#${sinceTimestamp}`,
                ':timestampEndRange': 'EVENT#99999999'
            },
            allFields: true
        })
        
        // Extract timestamp from DataCategory and sort by timestamp to ensure chronological order
        return events ? events
            .map(event => ({
                type: event.type,
                update: event.update,
                streamKey,
                timestamp: event.DataCategory ? parseInt(event.DataCategory.split('::')[0].replace('EVENT#', '')) : 0
            }))
            .sort((a, b) => a.timestamp - b.timestamp) : []
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
        events: Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string }> 
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
                        update, // Already serialized as ExternalUpdatePayload
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
        
        const result = await this.dynamo.getItem<Record<KeyType, string> & { DataCategory: string; snapshot: SnapshotType<SnapshotPayload> }>({
            Key: { [this.primaryKeyName]: primaryKey, DataCategory: 'Meta::Snapshot' },
            ProjectionFields: ['snapshot']
        })
        
        return result?.snapshot
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
            snapshot
        })
    }


    //
    // Subscribe this data source to a messageBus for processing incoming events.
    // Only subscribes if subscribedEventTypeGuard is configured.
    //
    subscribe(): void {
        // For replayable DataSources, first subscribe to Initialize Subscription events
        if (this.replayable) {
            this.subscribeToInitializeEvents()
        }

        // Then subscribe to regular streaming events if configured
        if (!this.subscribedEventTypeGuard || !this.receiveEvents) {
            return // No event processing configured
        }

        // Create a derived type guard that works with the internal StreamingEventMessage structure
        const streamingEventTypeGuard = (message: any): message is StreamingEventPayload => {
            if (!this.subscribedEventTypeGuard) {
                return false
            }
            if (message.type !== 'StreamingEvent') {
                return false
            }
            // Strip the type field to get StreamingEventPayload format
            const { type, ...streamingEventPayload } = message
            return this.subscribedEventTypeGuard(streamingEventPayload)
        }

        // Subscribe to messageBus with the derived type guard and receiveEvents callback
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}`,
            priority: 5, // Default priority for data source processing
            filter: streamingEventTypeGuard,
            callback: async ({ payloads }) => {
                // Extract all StreamingEventPayload events from the batch
                const events = payloads.map((streamingEvent) => {
                    // Strip the type field to get StreamingEventPayload format
                    const { type, ...streamingEventPayload } = streamingEvent
                    return streamingEventPayload
                })
                
                // Pass all events as a batch to receiveEvents
                await this.receiveEvents!({
                    events,
                    streamEvent: (params) => this.streamEvent(params)
                })
            }
        })
    }

    private subscribeToInitializeEvents(): void {
        // Type guard for Initialize Subscription events in internal StreamingEvent format
        const initializeEventTypeGuard = (message: any): message is { 
            type: 'StreamingEvent', 
            dataSourceKey: 'mtw.subscriptions',
            streamKey: string,
            event: {
                type: string,
                update: {
                    streamKey: string,
                    sessionId: string,
                    requestId: string
                }
            },
            timestamp: number
        } => {
            return message.type === 'StreamingEvent' &&
                   message.dataSourceKey === 'mtw.subscriptions' &&
                   message.event?.type === `Initialize Subscription - ${this.dataSourceKey}` &&
                   typeof message.event?.update?.streamKey === 'string' &&
                   typeof message.event?.update?.sessionId === 'string' &&
                   typeof message.event?.update?.requestId === 'string'
        }

        // Subscribe to Initialize Subscription events with higher priority
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}-initialize`,
            priority: 1, // Higher priority than regular events
            filter: initializeEventTypeGuard,
            callback: async ({ payloads }) => {
                // Process each Initialize Subscription event
                for (const payload of payloads) {
                    const { streamKey, sessionId } = payload.event.update
                    
                    try {
                        // Use the existing initializeSubscription method
                        await this.initializeSubscription({ sessionId, streamKey })
                        console.log(`Initialized subscription for streamKey: ${streamKey} to session: ${sessionId}`)
                    } catch (error) {
                        console.error(`Failed to process Initialize Subscription for streamKey: ${streamKey}`, error)
                    }
                }
            }
        })
    }
}


