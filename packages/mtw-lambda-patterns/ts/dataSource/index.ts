import { singleFlightFactory, SingleFlightConfig } from '../singleFlight'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { v4 as uuidv4 } from 'uuid'
import { PublishCommand } from '@aws-sdk/client-sns'
import { StreamingEventPayloadContract, StreamingEventHeader, StreamEventHeaderFragment, StreamingEventEnvelope, DataSourceEventSerializer, EventPayload } from './baseClasses'
import { CoreExternalFormat } from './formatTransform'
import { DataSourceAggregator } from './aggregation'
import { publishStreamEvent, StreamEventPublisherSerializer, wireFormatsFromCoreFormat } from './streamEventPublisher'

export type SerializableObject = Record<string, unknown>

export type SnapshotType<SnapshotPayload extends SerializableObject> = SnapshotPayload & {
    createdAt: number;
    expiresAt: number;
}

/**
 * Descriptor returned by snapshotSidecarUrlGenerator for subscription init.
 * The client receives a Snapshot event with sidecarUrl and fetches the body from that URL.
 */
export type SidecarSnapshotDescriptor = {
    sidecarUrl: string;
    createdAt: number;
    expiresAt?: number;
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

/** Params for streamEvent; header is required fragment (type + extended fields). DataSource supplies dataSourceKey, streamKey, timestamp. */
export type StreamEventParams<UpdatePayload = any, Header extends StreamingEventHeader = StreamingEventHeader> = {
    update: UpdatePayload
    streamKey: string
    header: StreamEventHeaderFragment<Header>
}

export type StreamEventFunction<UpdatePayload = any, Header extends StreamingEventHeader = StreamingEventHeader> =
    (params: StreamEventParams<UpdatePayload, Header>) => Promise<void>

/**
 * SubscribedContent = payload type of events this DataSource subscribes *to* (incoming).
 * UpdatePayload = payload type this DataSource publishes (streamEvent, serializer).
 * They often differ (e.g. mtw.wml subscribes to coordination/diagnostics, publishes WMLEventUpdate).
 */
export class DataSource<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    SubscribedContent extends EventPayload,
    ExternalUpdatePayload extends EventPayload = EventPayload,
    KeyType extends string = string,
    ExternalSnapshotPayload extends SerializableObject = SnapshotPayload,
    Header extends StreamingEventHeader = StreamingEventHeader
> {
    readonly dynamo: DynamoUtils<KeyType>
    readonly sns: SnsUtils
    readonly messageBus: { 
        send: (payload: any) => void;
        subscribe: (subscription: any) => void;
    }
    readonly primaryKeyName: KeyType
    readonly dataSourceKey: string
    readonly snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>
    /** When set, subscription init delivers a Snapshot with sidecarUrl instead of inline payload. Use either this or snapshotContentGenerator, not both. */
    readonly snapshotSidecarUrlGenerator?: (streamKey: string) => Promise<SidecarSnapshotDescriptor>
    readonly singleFlight?: ReturnType<typeof singleFlightFactory<SnapshotType<ExternalSnapshotPayload>>>
    readonly feedbackTopicArn: string
    readonly replayable: boolean
    readonly subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>
    readonly receiveEvents?: (params: { 
        events: Array<StreamingEventEnvelope<SubscribedContent>>,
        streamEvent: StreamEventFunction<UpdatePayload, Header>
    }) => Promise<void>
    readonly eventSerializer?: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload, Header>
    readonly aggregator?: DataSourceAggregator<SnapshotPayload, UpdatePayload>
    readonly buildHeader?: (params: { update: UpdatePayload; streamKey: string; timestamp: number }) => Header
    _snapshots: Record<string, SnapshotType<SnapshotPayload>> = {}

    constructor({ 
        dynamo,
        sns,
        messageBus,
        primaryKeyName,
        dataSourceKey,
        snapshotContentGenerator,
        snapshotSidecarUrlGenerator,
        feedbackTopicArn,
        replayable = true,
        snapshotTimeoutMs = 5000,
        subscribedEventTypeGuard,
        receiveEvents,
        eventSerializer,
        aggregator,
        buildHeader
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
        snapshotSidecarUrlGenerator?: (streamKey: string) => Promise<SidecarSnapshotDescriptor>,
        feedbackTopicArn: string,
        replayable?: boolean,
        snapshotTimeoutMs?: number,
        subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>,
        receiveEvents?: (params: { 
            events: Array<StreamingEventEnvelope<SubscribedContent>>,
            streamEvent: StreamEventFunction<UpdatePayload, Header>
        }) => Promise<void>,
        eventSerializer?: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload, Header>,
        aggregator?: DataSourceAggregator<SnapshotPayload, UpdatePayload>,
        buildHeader?: (params: { update: UpdatePayload; streamKey: string; timestamp: number }) => Header
    }) {
        this.dynamo = dynamo
        this.sns = sns
        this.messageBus = messageBus
        this.primaryKeyName = primaryKeyName
        this.dataSourceKey = dataSourceKey
        this.snapshotContentGenerator = snapshotContentGenerator
        this.snapshotSidecarUrlGenerator = snapshotSidecarUrlGenerator
        this.feedbackTopicArn = feedbackTopicArn
        this.replayable = replayable
        this.subscribedEventTypeGuard = subscribedEventTypeGuard
        this.receiveEvents = receiveEvents
        this.eventSerializer = eventSerializer
        this.aggregator = aggregator
        this.buildHeader = buildHeader

        // Initialize singleFlight for snapshot generation coordination only if replayable
        // Note: singleFlight coordinates using external format to avoid serialization round-trips
        if (this.replayable) {
            const singleFlightConfig: SingleFlightConfig = {
                // Bind methods to preserve 'this' context when extracted
                optimisticUpdateFunction: dynamo.optimisticUpdate.bind(dynamo),
                getItemFunction: dynamo.getItem.bind(dynamo),
                primaryKey: primaryKeyName,
                timeoutMs: snapshotTimeoutMs
            }
            this.singleFlight = singleFlightFactory<SnapshotType<ExternalSnapshotPayload>>(singleFlightConfig)
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

    /**
     * Get snapshot in Core External format (ready for storage/transmission)
     * This is the primary method used for replay delivery to clients
     */
    async getSnapshotExternal(streamKey: string): Promise<SnapshotType<ExternalSnapshotPayload>> {
        // For non-replayable data sources, throw an error since snapshots are not supported
        if (!this.replayable) {
            throw new Error(`DataSource '${this.dataSourceKey}' is not replayable and does not support snapshots`)
        }

        const now = getCurrentTimestamp()

        // Check in-memory cache first (internal format)
        const cached = this._snapshots[streamKey]
        if (cached && now <= cached.expiresAt) {
            const internalSnapshot = cached
            // Serialize to external format for storage
            const externalPayload = this.eventSerializer?.serializeSnapshot
                ? this.eventSerializer.serializeSnapshot(internalSnapshot)
                : internalSnapshot as unknown as ExternalSnapshotPayload
            
            const externalSnapshot: SnapshotType<ExternalSnapshotPayload> = {
                ...externalPayload,
                type: 'Snapshot',
                createdAt: internalSnapshot.createdAt,
                expiresAt: internalSnapshot.expiresAt
            }
            return externalSnapshot
        }
        
        // Try to load from store (already in external format)
        const loaded = await this.loadSnapshotFromStore(streamKey).catch(() => undefined)
        if (loaded && now <= loaded.expiresAt) {
            // Deserialize and cache the internal format for future calls
            if (this.eventSerializer?.deserializeSnapshot) {
                const { createdAt, expiresAt, ...externalPayload } = loaded
                const internalPayload = this.eventSerializer.deserializeSnapshot(externalPayload as unknown as ExternalSnapshotPayload)
                if (internalPayload) {
                    const internalSnapshot: SnapshotType<SnapshotPayload> = {
                        ...internalPayload,
                        createdAt,
                        expiresAt
                    }
                    this._snapshots[streamKey] = internalSnapshot
                }
            } else {
                // No serializer - assume internal and external are the same
                this._snapshots[streamKey] = loaded as unknown as SnapshotType<SnapshotPayload>
            }
            
            return loaded
        }

        // Use singleFlight to coordinate snapshot generation
        const generated = await this.singleFlight!({
            category: `snapshot-generation-${this.dataSourceKey}`,
            argumentHash: streamKey,
            computation: async () => {
                // Generate snapshot in internal format
                const internalSnapshot = await this.generateSnapshot(streamKey)
                
                // Serialize to external format for storage
                const externalPayload = this.eventSerializer?.serializeSnapshot
                    ? this.eventSerializer.serializeSnapshot(internalSnapshot)
                    : internalSnapshot as unknown as ExternalSnapshotPayload
                
                const externalSnapshot: SnapshotType<ExternalSnapshotPayload> = {
                    ...externalPayload,
                    type: 'Snapshot',
                    createdAt: internalSnapshot.createdAt,
                    expiresAt: internalSnapshot.expiresAt
                }
                
                // Store the external format
                await this.storeSnapshotToStore({ streamKey, snapshot: internalSnapshot }).catch(() => undefined)
                
                return externalSnapshot
            },
            retrieval: async () => {
                // Retrieve the snapshot that was just stored (in external format)
                const stored = await this.loadSnapshotFromStore(streamKey)
                if (!stored) {
                    throw new Error('Snapshot not found after computation completed')
                }
                return stored
            }
        })
        
        // Deserialize and cache the internal format for future calls
        if (this.eventSerializer?.deserializeSnapshot) {
            const { createdAt, expiresAt, ...externalPayload } = generated
            const internalPayload = this.eventSerializer.deserializeSnapshot(externalPayload as unknown as ExternalSnapshotPayload)
            if (internalPayload) {
                const internalSnapshot: SnapshotType<SnapshotPayload> = {
                    ...internalPayload,
                    createdAt,
                    expiresAt
                }
                this._snapshots[streamKey] = internalSnapshot
            }
        } else {
            // No serializer - assume internal and external are the same
            this._snapshots[streamKey] = generated as unknown as SnapshotType<SnapshotPayload>
        }

        return generated
    }

    /**
     * Get snapshot in Internal format (for business logic manipulation)
     * Deserializes the external snapshot from storage
     */
    async getSnapshot(streamKey: string): Promise<SnapshotType<SnapshotPayload>> {
        // For non-replayable data sources, throw an error since snapshots are not supported
        if (!this.replayable) {
            throw new Error(`DataSource '${this.dataSourceKey}' is not replayable and does not support snapshots`)
        }

        // Check in-memory cache first (internal format)
        if (this._snapshots[streamKey] && getCurrentTimestamp() <= this._snapshots[streamKey].expiresAt) {
            return this._snapshots[streamKey]
        }

        // Get external snapshot
        const externalSnapshot = await this.getSnapshotExternal(streamKey)
        
        // Deserialize to internal format
        if (this.eventSerializer?.deserializeSnapshot) {
            const { createdAt, expiresAt, ...externalPayload } = externalSnapshot
            const internalPayload = this.eventSerializer.deserializeSnapshot(externalPayload as unknown as ExternalSnapshotPayload)
            if (internalPayload) {
                const internalSnapshot: SnapshotType<SnapshotPayload> = {
                    ...internalPayload,
                    createdAt,
                    expiresAt
                }
                // Cache the internal snapshot
                this._snapshots[streamKey] = internalSnapshot
                return internalSnapshot
            }
        }
        
        // No serializer - assume internal and external are the same
        const internalSnapshot = externalSnapshot as unknown as SnapshotType<SnapshotPayload>
        this._snapshots[streamKey] = internalSnapshot
        return internalSnapshot
    }

    async streamEvent(params: StreamEventParams<UpdatePayload, Header>): Promise<void> {
        const { update, streamKey, header: headerFragment } = params
        const now = getCurrentTimestamp()
        const uuid = uuidv4()  // Just the UUID part (timestamp is in coreFormat)

        const header: Header = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: now, ...headerFragment } as Header

        const primaryKeyName = this.primaryKeyName
        const eventId = uuid
        const { eventBridgeEvent, dynamoRecord } = publishStreamEvent({
            header,
            content: update,
            serializer: this.eventSerializer as StreamEventPublisherSerializer<Header> | undefined,
            primaryKeyName,
            eventId,
        })
        // Create the internal messageBus event (reuse header built above)
        const messageBusEvent = {
            type: 'StreamingEvent' as const,
            dataSourceKey: this.dataSourceKey,
            streamKey,
            timestamp: now,
            header,
            getContentInternal: () => Promise.resolve(update)
        }

        // Execute all operations in parallel
        await Promise.all([
            // Store event to DynamoDB for replay
            (this.replayable && dynamoRecord ? this.dynamo.putItem(dynamoRecord) : Promise.resolve()).then(() => {
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
    getSerializer(): DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload, Header> | undefined {
        return this.eventSerializer
    }

    /**
     * Get the aggregator for this DataSource (if available)
     * Useful for clients to access aggregation logic
     */
    getAggregator(): DataSourceAggregator<SnapshotPayload, UpdatePayload> | undefined {
        return this.aggregator
    }

    async initializeSubscription({ sessionId, streamKey }: { sessionId: `SESSION#${string}`, streamKey: string }): Promise<void> {
        // Throw error for non-replayable data sources
        if (!this.replayable) {
            throw new Error(`DataSource '${this.dataSourceKey}' is not replayable and does not support subscription initialization`)
        }

        // Sidecar path: deliver Snapshot with sidecarUrl instead of inline payload
        if (this.snapshotSidecarUrlGenerator) {
            const descriptor = await this.snapshotSidecarUrlGenerator(streamKey)
            const snapshot = {
                type: 'Snapshot' as const,
                sidecarUrl: descriptor.sidecarUrl,
                createdAt: descriptor.createdAt,
                expiresAt: descriptor.expiresAt ?? descriptor.createdAt + 300000
            }
            const recentEvents = await this.getRecentEvents(streamKey, descriptor.createdAt)
            await this.deliverReplayData({ sessionId, streamKey, snapshot: snapshot as unknown as SnapshotType<ExternalSnapshotPayload>, events: recentEvents })
            return
        }

        // Inline path: get full snapshot and deliver
        const externalSnapshot = await this.getSnapshotExternal(streamKey)
        const recentEvents = await this.getRecentEvents(streamKey, externalSnapshot.createdAt)
        await this.deliverReplayData({ sessionId, streamKey, snapshot: externalSnapshot, events: recentEvents })
    }

    protected async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string, type: string, extendedHeader?: unknown }>> {
        // For non-replayable data sources, return empty array since no events are stored
        if (!this.replayable) {
            return []
        }

        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`

        const events = await this.dynamo.query<Record<KeyType, string> & {
            DataCategory: string;
            type: string;
            update: ExternalUpdatePayload;
            extendedHeader?: unknown;
        }>({
            Key: { [this.primaryKeyName]: primaryKey },
            KeyConditionExpression: 'DataCategory BETWEEN :timestampPrefix AND :timestampEndRange',
            ExpressionAttributeValues: {
                ':timestampPrefix': `EVENT#${sinceTimestamp}`,
                ':timestampEndRange': 'EVENT#99999999'
            },
            allFields: true
        })

        return events ? events
            .map(event => ({
                type: event.type,
                update: event.update,
                streamKey,
                timestamp: event.DataCategory ? parseInt(event.DataCategory.split('::')[0].replace('EVENT#', '')) : 0,
                ...(event.extendedHeader !== undefined ? { extendedHeader: event.extendedHeader } : {})
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
        snapshot: SnapshotType<ExternalSnapshotPayload>;
        events: Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string, type: string, extendedHeader?: unknown }>
    }): Promise<void> {
        const { createdAt, expiresAt, ...externalSnapshotPayload } = snapshot

        const snapshotCoreFormat: CoreExternalFormat = {
            dataSourceKey: this.dataSourceKey,
            streamKey,
            timestamp: snapshot.createdAt,
            update: externalSnapshotPayload as any
        }

        const { snsFeedbackFormat: snapshotSNSFormat } = wireFormatsFromCoreFormat(snapshotCoreFormat)

        const snapshotCommand = new PublishCommand({
            TopicArn: this.feedbackTopicArn,
            Message: JSON.stringify(snapshotSNSFormat),
            MessageAttributes: {
                Targets: {
                    DataType: 'String.Array',
                    StringValue: JSON.stringify([sessionId])
                },
                Type: {
                    DataType: 'String',
                    StringValue: 'StreamEvent'
                }
            }
        })
        await this.sns.send(snapshotCommand)

        if (events.length > 0) {
            await Promise.all(events.map(({ update, timestamp, streamKey, type, extendedHeader }) => {
                let extendedPart: Record<string, unknown> = {};
                if (extendedHeader != null && typeof extendedHeader === 'object') {
                    extendedPart = { ...extendedHeader } as Record<string, unknown>;
                } else if (update && typeof update === 'object' && 'RequestIds' in update && (update as Record<string, unknown>).RequestIds !== undefined) {
                    extendedPart = { RequestIds: (update as Record<string, unknown>).RequestIds };
                }
                const fullHeader: CoreExternalFormat['header'] = {
                    dataSourceKey: this.dataSourceKey,
                    streamKey,
                    timestamp,
                    type,
                    ...extendedPart
                };
                const coreFormat: CoreExternalFormat = {
                    dataSourceKey: this.dataSourceKey,
                    streamKey,
                    timestamp,
                    header: fullHeader,
                    update: update as any
                };

                const { snsFeedbackFormat } = wireFormatsFromCoreFormat(coreFormat)
                
                const eventCommand = new PublishCommand({
                    TopicArn: this.feedbackTopicArn,
                    Message: JSON.stringify(snsFeedbackFormat),
                    MessageAttributes: {
                        Targets: { 
                            DataType: 'String.Array', 
                            StringValue: JSON.stringify([sessionId]) 
                        },
                        Type: { 
                            DataType: 'String', 
                            StringValue: 'StreamEvent' 
                        }
                    }
                })
                return this.sns.send(eventCommand)
            }))
        }
    }

    protected async loadSnapshotFromStore(streamKey: string): Promise<SnapshotType<ExternalSnapshotPayload> | undefined> {
        // For non-replayable data sources, return undefined since no snapshots are stored
        if (!this.replayable) {
            return undefined
        }

        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`
        
        // Load the snapshot from storage - it's already in Core External format
        const result = await this.dynamo.getItem<Record<KeyType, string> & { DataCategory: string; snapshot: SnapshotType<ExternalSnapshotPayload> }>({
            Key: { [this.primaryKeyName]: primaryKey, DataCategory: 'Meta::Snapshot' },
            ProjectionFields: ['snapshot']
        })
        
        // Return the Core External format directly (no deserialization needed)
        return result?.snapshot ? {
            ...result!.snapshot,
            type: 'Snapshot'
        } : undefined
    }

    protected async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        // For non-replayable data sources, do nothing since no snapshots are stored
        if (!this.replayable) {
            return
        }
        
        // Serialize snapshot to Core External format
        const externalSnapshot = this.eventSerializer?.serializeSnapshot
            ? this.eventSerializer.serializeSnapshot(snapshot)
            : snapshot as unknown as ExternalSnapshotPayload
        
        // Create the snapshot record with metadata
        const externalSnapshotWithMetadata: SnapshotType<ExternalSnapshotPayload> = {
            ...externalSnapshot,
            createdAt: snapshot.createdAt,
            expiresAt: snapshot.expiresAt
        }
        
        // Store as a simple DynamoDB record (no format transform needed for snapshot storage)
        await this.dynamo.putItem({
            [this.primaryKeyName]: `STREAM#${this.dataSourceKey}::${streamKey}`,
            DataCategory: 'Meta::Snapshot',
            snapshot: externalSnapshotWithMetadata
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

        // Structure guard: accept any message that looks like a streaming event envelope (payload-agnostic).
        const streamingEventStructureGuard = (message: any): message is StreamingEventPayloadContract => {
            if (message.type !== 'StreamingEvent') {
                return false
            }
            if (!message.header || typeof message.header.type !== 'string') {
                return false
            }
            return typeof message.getContentInternal === 'function'
        }

        // Subscribe to messageBus with structure guard; callback builds envelopes as unknown, filters with envelope guard, passes narrowed to receiveEvents.
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}`,
            priority: 5, // Default priority for data source processing
            filter: streamingEventStructureGuard,
            callback: async ({ payloads }) => {
                const header = (p: any): StreamingEventHeader => ({
                    dataSourceKey: p.header?.dataSourceKey ?? p.dataSourceKey,
                    streamKey: p.header?.streamKey ?? p.streamKey,
                    timestamp: p.header?.timestamp ?? p.timestamp,
                    type: p.header?.type
                })
                const envelopes: Array<StreamingEventEnvelope<unknown>> = payloads.map((p) => ({
                    header: header(p),
                    getContentInternal: p.getContentInternal
                }))
                const narrowed = envelopes.filter((e): e is StreamingEventEnvelope<SubscribedContent> => this.subscribedEventTypeGuard!(e))
                await this.receiveEvents!({
                    events: narrowed,
                    streamEvent: (params) => this.streamEvent(params)
                })
            }
        })
    }

    private subscribeToInitializeEvents(): void {
        // Type guard for Initialize Subscription events in internal StreamingEvent format (getContentInternal only)
        const initializeEventTypeGuard = (message: any): message is {
            type: 'StreamingEvent';
            dataSourceKey: 'mtw.subscriptions';
            streamKey: string;
            header: StreamingEventHeader;
            getContentInternal: () => Promise<{ sessionId: string; requestId: string }>;
            timestamp: number;
        } => {
            return message.type === 'StreamingEvent' &&
                   message.dataSourceKey === 'mtw.subscriptions' &&
                   message.header?.type === `Initialize Subscription - ${this.dataSourceKey}` &&
                   typeof message.streamKey === 'string' &&
                   typeof message.getContentInternal === 'function'
        }

        // Subscribe to Initialize Subscription events with higher priority
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}-initialize`,
            priority: 1, // Higher priority than regular events
            filter: initializeEventTypeGuard,
            callback: async ({ payloads }) => {
                // Process each Initialize Subscription event
                for (const payload of payloads) {
                    const { streamKey } = payload
                    const content = await payload.getContentInternal()
                    if (typeof content?.sessionId !== 'string') {
                        console.error(`Invalid Initialize Subscription payload for streamKey: ${streamKey}: missing sessionId`)
                        continue
                    }
                    const { sessionId } = content

                    try {
                        // Use the existing initializeSubscription method
                        await this.initializeSubscription({ sessionId, streamKey })
                    } catch (error) {
                        console.error(`Failed to process Initialize Subscription for streamKey: ${streamKey}`, error)
                    }
                }
            }
        })
    }
}

// Re-export stream event publisher (build CoreExternalFormat + wire formats for callers to send/store)
export {
    publishStreamEvent,
    StreamEventPublisherSerializer,
    StreamEventPublisherOptions,
    StreamEventPublisherResult,
} from './streamEventPublisher'

// Re-export aggregation types for convenience
export { DataSourceAggregator, AggregationResult, ResolvedStreamingEnvelope } from './aggregation'
