import { singleFlightFactory, SingleFlightConfig } from '../singleFlight'
import { getCurrentTimestamp } from '../internalUtils/dateUtil'
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
import { v4 as uuidv4 } from 'uuid'
import { PublishCommand } from '@aws-sdk/client-sns'
import { StreamingEventPayloadContract, StreamingEventHeader, StreamEventHeaderFragment, StreamingEventEnvelope, DataSourceEventSerializer, EventPayload } from './baseClasses'
import { CoreExternalFormat, fromDynamoDBFormat, DynamoDBFormat } from './formatTransform'
import { DataSourceAggregator } from './aggregation'
import { publishStreamEvent, StreamEventPublisherSerializer, wireFormatsFromCoreFormat } from './streamEventPublisher'

export type SerializableObject = Record<string, unknown>

export type SnapshotMetadata = {
    createdAt: number;
    // Temporary compatibility: legacy snapshots may omit replayAt.
    // Replay cursor resolution MUST be replayAt first, then createdAt fallback.
    replayAt?: number;
    expiresAt: number;
}

export type SnapshotType<SnapshotPayload extends SerializableObject> = SnapshotPayload & SnapshotMetadata

export const resolveReplayCursorTimestamp = (snapshot: Pick<SnapshotMetadata, 'createdAt' | 'replayAt'>): number =>
    snapshot.replayAt ?? snapshot.createdAt

const withSnapshotReplayMetadata = <SnapshotPayload extends SerializableObject>(
    snapshot: SnapshotType<SnapshotPayload>,
    createdAt: number
): SnapshotType<SnapshotPayload> => ({
    ...snapshot,
    createdAt,
    replayAt: resolveReplayCursorTimestamp(snapshot),
})

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
    /** When set to a non-empty string, sends on that message bus lane. Empty string forces default lane. When omitted, inherits inbound flush lane inside `receiveEvents`. */
    laneId?: string
}

export type StreamEventFunction<UpdatePayload = any, Header extends StreamingEventHeader = StreamingEventHeader> =
    (params: StreamEventParams<UpdatePayload, Header>) => Promise<void>

export type StreamEnvelopeFunction =
    (envelope: StreamingEventEnvelope<unknown, StreamingEventHeader, unknown>) => Promise<void>

export type DataSourcePublisherStrategy = 'eventBridge+bus' | 'busOnly'

/** Minimal message bus surface for DataSource (lane-aware send). */
export type DataSourceMessageBusPort = {
    send(payload: unknown, laneId?: string): void
    subscribe(subscription: unknown): void
}

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
    readonly messageBus: DataSourceMessageBusPort
    readonly primaryKeyName: KeyType
    readonly dataSourceKey: string
    readonly snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>
    readonly singleFlight?: ReturnType<typeof singleFlightFactory<SnapshotType<ExternalSnapshotPayload>>>
    readonly feedbackTopicArn: string
    readonly replayable: boolean
    readonly publisherStrategy: DataSourcePublisherStrategy
    readonly subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>
    readonly receiveEvents?: (params: { 
        events: Array<StreamingEventEnvelope<SubscribedContent>>,
        streamEvent: StreamEventFunction<UpdatePayload, Header>,
        streamEnvelope: StreamEnvelopeFunction
    }) => Promise<void>
    readonly eventSerializer?: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload, Header>
    readonly aggregator?: DataSourceAggregator<SnapshotPayload, UpdatePayload>
    readonly buildHeader?: (params: { update: UpdatePayload; streamKey: string; timestamp: number }) => Header
    _snapshots: Record<string, SnapshotType<SnapshotPayload>> = {}
    private readonly _inboundFlushLaneStack: (string | undefined)[] = []

    constructor({ 
        dynamo,
        sns,
        messageBus,
        primaryKeyName,
        dataSourceKey,
        snapshotContentGenerator,
        feedbackTopicArn,
        replayable = true,
        publisherStrategy = 'eventBridge+bus',
        snapshotTimeoutMs = 5000,
        subscribedEventTypeGuard,
        receiveEvents,
        eventSerializer,
        aggregator,
        buildHeader
    }: { 
        dynamo: DynamoUtils<KeyType>,
        sns: SnsUtils,
        messageBus: DataSourceMessageBusPort,
        primaryKeyName: KeyType,
        dataSourceKey: string,
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>,
        feedbackTopicArn: string,
        replayable?: boolean,
        publisherStrategy?: DataSourcePublisherStrategy,
        snapshotTimeoutMs?: number,
        subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>,
        receiveEvents?: (params: { 
            events: Array<StreamingEventEnvelope<SubscribedContent>>,
            streamEvent: StreamEventFunction<UpdatePayload, Header>,
            streamEnvelope: StreamEnvelopeFunction
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
        this.feedbackTopicArn = feedbackTopicArn
        this.replayable = replayable
        this.publisherStrategy = publisherStrategy
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

    private peekInboundFlushLane(): string | undefined {
        if (this._inboundFlushLaneStack.length === 0) {
            return undefined
        }
        return this._inboundFlushLaneStack[this._inboundFlushLaneStack.length - 1]
    }

    /**
     * Non-empty explicit `laneId` wins. Empty string forces default lane (no second arg to `send`).
     * `undefined` uses current inbound flush lane (stack top) when inside `subscribe` callbacks.
     */
    private resolveOutboundLaneId(explicit?: string): string | undefined {
        if (explicit !== undefined) {
            if (explicit === '') {
                return undefined
            }
            return explicit
        }
        return this.peekInboundFlushLane()
    }

    private sendStreamingEventOnBus(payload: StreamingEventPayloadContract, laneId?: string): void {
        if (laneId !== undefined && laneId !== '') {
            this.messageBus.send(payload, laneId)
        } else {
            this.messageBus.send(payload)
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
                replayAt: now,
                expiresAt: now + 300000 // 5 minutes default expiration
            } as unknown as SnapshotType<SnapshotPayload>
        }
        
        const content = await this.snapshotContentGenerator(streamKey)
        return {
            ...content,
            createdAt: now,
            replayAt: now,
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
            const internalSnapshot = withSnapshotReplayMetadata(cached, cached.createdAt)
            // Serialize to external format for storage
            const snapshotHeader = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: internalSnapshot.createdAt, type: 'Snapshot' as const }
            const externalPayload = this.eventSerializer
                ? this.eventSerializer.serialize({ content: internalSnapshot as any, header: snapshotHeader as Header })
                : internalSnapshot as unknown as ExternalSnapshotPayload

            const externalSnapshot = {
                ...externalPayload,
                type: 'Snapshot',
                createdAt: internalSnapshot.createdAt,
                replayAt: internalSnapshot.replayAt,
                expiresAt: internalSnapshot.expiresAt
            } as SnapshotType<ExternalSnapshotPayload>
            return externalSnapshot
        }
        
        // Try to load from store (already in external format)
        const loaded = await this.loadSnapshotFromStore(streamKey).catch(() => undefined)
        if (loaded && now <= loaded.expiresAt) {
            // Deserialize and cache the internal format for future calls
            if (this.eventSerializer) {
                const { createdAt, replayAt, expiresAt, ...externalPayload } = loaded
                const snapshotHeader = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: loaded.createdAt, type: 'Snapshot' as const }
                const internalPayload = await this.eventSerializer.deserialize({ content: externalPayload as any, header: snapshotHeader as Header })
                if (internalPayload) {
                    const internalSnapshot = withSnapshotReplayMetadata({
                        ...internalPayload,
                        createdAt,
                        replayAt,
                        expiresAt
                    } as unknown as SnapshotType<SnapshotPayload>, createdAt)
                    this._snapshots[streamKey] = internalSnapshot
                }
            } else {
                // No serializer - assume internal and external are the same
                this._snapshots[streamKey] = withSnapshotReplayMetadata(loaded as unknown as SnapshotType<SnapshotPayload>, loaded.createdAt)
            }
            
            return loaded
        }

        // Use singleFlight to coordinate snapshot generation
        const generated = await this.singleFlight!({
            category: `snapshot-generation-${this.dataSourceKey}`,
            argumentHash: streamKey,
            computation: async () => {
                // Generate snapshot in internal format
                const generatedInternalSnapshot = await this.generateSnapshot(streamKey)
                const internalSnapshot = withSnapshotReplayMetadata(generatedInternalSnapshot, generatedInternalSnapshot.createdAt)

                // Serialize to external format for storage
                const snapshotHeader = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: internalSnapshot.createdAt, type: 'Snapshot' as const }
                const externalPayload = this.eventSerializer
                    ? this.eventSerializer.serialize({ content: internalSnapshot as any, header: snapshotHeader as Header })
                    : internalSnapshot as unknown as ExternalSnapshotPayload

                const externalSnapshot = {
                    ...externalPayload,
                    type: 'Snapshot',
                    createdAt: internalSnapshot.createdAt,
                    replayAt: internalSnapshot.replayAt,
                    expiresAt: internalSnapshot.expiresAt
                } as SnapshotType<ExternalSnapshotPayload>

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
        if (this.eventSerializer) {
            const { createdAt, replayAt, expiresAt, ...externalPayload } = generated
            const snapshotHeader = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: generated.createdAt, type: 'Snapshot' as const }
            const internalPayload = await this.eventSerializer.deserialize({ content: externalPayload as any, header: snapshotHeader as Header })
            if (internalPayload) {
                const internalSnapshot = withSnapshotReplayMetadata({
                    ...internalPayload,
                    createdAt,
                    replayAt,
                    expiresAt
                } as unknown as SnapshotType<SnapshotPayload>, createdAt)
                this._snapshots[streamKey] = internalSnapshot
            }
        } else {
            // No serializer - assume internal and external are the same
            this._snapshots[streamKey] = withSnapshotReplayMetadata(generated as unknown as SnapshotType<SnapshotPayload>, generated.createdAt)
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
        if (this.eventSerializer) {
            const { createdAt, replayAt, expiresAt, ...externalPayload } = externalSnapshot
            const snapshotHeader = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: externalSnapshot.createdAt, type: 'Snapshot' as const }
            const internalPayload = await this.eventSerializer.deserialize({ content: externalPayload as any, header: snapshotHeader as Header })
            if (internalPayload) {
                const internalSnapshot = withSnapshotReplayMetadata({
                    ...internalPayload,
                    createdAt,
                    replayAt,
                    expiresAt
                } as unknown as SnapshotType<SnapshotPayload>, createdAt)
                // Cache the internal snapshot
                this._snapshots[streamKey] = internalSnapshot
                return internalSnapshot
            }
        }

        // No serializer - assume internal and external are the same
        const internalSnapshot = withSnapshotReplayMetadata(externalSnapshot as unknown as SnapshotType<SnapshotPayload>, externalSnapshot.createdAt)
        this._snapshots[streamKey] = internalSnapshot
        return internalSnapshot
    }

    async streamEvent(params: StreamEventParams<UpdatePayload, Header>): Promise<void> {
        const { update, streamKey, header: headerFragment, laneId: laneIdParam } = params
        const outboundLane = this.resolveOutboundLaneId(laneIdParam)
        const now = getCurrentTimestamp()
        const uuid = uuidv4()  // Just the UUID part (timestamp is in coreFormat)

        const header: Header = { dataSourceKey: this.dataSourceKey, streamKey, timestamp: now, ...headerFragment } as Header

        const primaryKeyName = this.primaryKeyName
        const eventId = uuid
        const { coreFormat, eventBridgeEvent, dynamoRecord } = publishStreamEvent({
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
            getContent: (format?: 'internal' | 'external') =>
                format === 'external'
                    ? Promise.resolve(coreFormat.update)
                    : Promise.resolve(update)
        }

        // Execute all operations in parallel
        await Promise.all([
            // Store event to DynamoDB for replay
            (this.replayable && dynamoRecord ? this.dynamo.putItem(dynamoRecord) : Promise.resolve()).then(() => {
                this.sendStreamingEventOnBus(messageBusEvent, outboundLane)
            }),
            // Publish to EventBridge for real-time subscribers
            (this.publisherStrategy === 'eventBridge+bus'
                ? eventBridgeClient.send([eventBridgeEvent as any])
                : Promise.resolve())
        ])
        
    }

    /**
     * Stream an envelope-shaped event. Use when forwarding or storing external-origin events,
     * publishing envelope-shaped results (e.g. S3 snapshotting), or doing partial preservation
     * plus partial transform. Uses getContent('external') for DynamoDB and EventBridge; passes
     * envelope to messageBus.
     */
    async streamEnvelope(
        envelope: StreamingEventEnvelope<unknown, StreamingEventHeader, unknown>,
        laneIdOverride?: string
    ): Promise<void> {
        const outboundLane = this.resolveOutboundLaneId(laneIdOverride)
        const coreFormat: CoreExternalFormat = {
            header: envelope.header,
            update: await envelope.getContent('external') as CoreExternalFormat['update'],
        }
        const eventId = uuidv4()
        const { eventBridgeEvent, dynamoRecord } = wireFormatsFromCoreFormat(coreFormat, {
            primaryKeyName: this.primaryKeyName,
            eventId,
        })
        const messageBusPayload: StreamingEventPayloadContract = {
            type: 'StreamingEvent',
            dataSourceKey: envelope.header.dataSourceKey,
            streamKey: envelope.header.streamKey,
            timestamp: envelope.header.timestamp,
            header: envelope.header,
            getContent: envelope.getContent,
        }

        await Promise.all([
            (this.replayable && dynamoRecord ? this.dynamo.putItem(dynamoRecord) : Promise.resolve()).then(() => {
                this.sendStreamingEventOnBus(messageBusPayload, outboundLane)
            }),
            (this.publisherStrategy === 'eventBridge+bus'
                ? eventBridgeClient.send([eventBridgeEvent as any])
                : Promise.resolve())
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

        const externalSnapshot = await this.getSnapshotExternal(streamKey)
        const recentEvents = await this.getRecentEvents(streamKey, resolveReplayCursorTimestamp(externalSnapshot))
        await this.deliverReplayData({ sessionId, streamKey, snapshot: externalSnapshot, events: recentEvents })
    }

    protected async getRecentEvents(streamKey: string, sinceTimestamp: number): Promise<Array<{ update: ExternalUpdatePayload, timestamp: number, streamKey: string, type: string, extendedHeader?: unknown }>> {
        // For non-replayable data sources, return empty array since no events are stored
        if (!this.replayable) {
            return []
        }

        const primaryKey = `STREAM#${this.dataSourceKey}::${streamKey}`

        const events = await this.dynamo.query<DynamoDBFormat<KeyType>>({
            Key: { [this.primaryKeyName]: primaryKey },
            KeyConditionExpression: 'DataCategory BETWEEN :timestampPrefix AND :timestampEndRange',
            ExpressionAttributeValues: {
                ':timestampPrefix': `EVENT#${sinceTimestamp}`,
                ':timestampEndRange': 'EVENT#99999999'
            },
            allFields: true
        })

        return events ? events
            .map(record => {
                // Use canonical transformer to reconstruct CoreExternalFormat (header + update)
                const core = fromDynamoDBFormat(record, this.dataSourceKey)
                return {
                    type: core.header.type,
                    update: core.update as ExternalUpdatePayload,
                    // We already know the streamKey we queried for; prefer the function argument
                    // to avoid depending on primary-key encoding in tests or alternate stores.
                    streamKey,
                    timestamp: core.header.timestamp,
                    ...(record.extendedHeader !== undefined ? { extendedHeader: record.extendedHeader } : {})
                }
            })
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
            header: {
                dataSourceKey: this.dataSourceKey,
                streamKey,
                timestamp: snapshot.createdAt,
                type: (externalSnapshotPayload as { type?: string }).type ?? 'Snapshot'
            },
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
        
        // Load the snapshot from storage. Support both the new CoreExternalFormat-based shape
        // (snapshotHeader + snapshotUpdate) and the legacy shape (snapshot blob) for migration.
        const result = await this.dynamo.getItem<Record<KeyType, string> & {
            DataCategory: string;
            snapshotHeader?: CoreExternalFormat['header'] & { replayAt?: unknown };
            snapshotUpdate?: ExternalSnapshotPayload;
            snapshot?: SnapshotType<ExternalSnapshotPayload>;
        }>({
            Key: { [this.primaryKeyName]: primaryKey, DataCategory: 'Meta::Snapshot' },
            ProjectionFields: ['snapshotHeader', 'snapshotUpdate', 'snapshot']
        })

        if (!result) {
            return undefined
        }

        // New envelope-based shape: snapshotHeader + snapshotUpdate
        if (result.snapshotHeader && result.snapshotUpdate) {
            const header = result.snapshotHeader
            const update = result.snapshotUpdate
            const createdAt = header.timestamp
            const replayAt = (typeof header.replayAt === 'number') ? header.replayAt : createdAt
            const expiresAt = createdAt + 300000 // 5 minutes default expiration

            const externalSnapshot: SnapshotType<ExternalSnapshotPayload> = {
                ...(update as unknown as ExternalSnapshotPayload),
                type: header.type ?? 'Snapshot',
                createdAt,
                replayAt,
                expiresAt
            }
            return externalSnapshot
        }

        // Legacy shape: snapshot blob stored directly
        if (result.snapshot) {
            const legacySnapshot = result.snapshot as SnapshotType<ExternalSnapshotPayload> & { type?: string }
            return {
                ...legacySnapshot,
                replayAt: resolveReplayCursorTimestamp(legacySnapshot),
                type: legacySnapshot.type ?? 'Snapshot'
            }
        }

        return undefined
    }

    protected async storeSnapshotToStore({ streamKey, snapshot }: { streamKey: string, snapshot: SnapshotType<SnapshotPayload> }): Promise<void> {
        // For non-replayable data sources, do nothing since no snapshots are stored
        if (!this.replayable) {
            return
        }
        
        // Serialize snapshot to external format for storage (external snapshot payload)
        const snapshotWithReplayMetadata = withSnapshotReplayMetadata(snapshot, snapshot.createdAt)
        const snapshotHeader = {
            dataSourceKey: this.dataSourceKey,
            streamKey,
            timestamp: snapshotWithReplayMetadata.createdAt,
            type: 'Snapshot' as const,
            replayAt: snapshotWithReplayMetadata.replayAt
        }
        const baseExternalSnapshot = this.eventSerializer
            ? this.eventSerializer.serialize({ content: snapshotWithReplayMetadata as any, header: snapshotHeader as unknown as Header })
            : (() => {
                const { createdAt, replayAt, expiresAt, ...rest } = snapshotWithReplayMetadata as SnapshotType<SnapshotPayload> & { type?: string }
                return rest as unknown as ExternalSnapshotPayload
            })()

        // Build CoreExternalFormat for the snapshot: header.timestamp is the creation time
        const coreFormat: CoreExternalFormat = {
            header: snapshotHeader,
            update: baseExternalSnapshot as unknown as CoreExternalFormat['update']
        }

        // Store as a CoreExternalFormat-shaped record under Meta::Snapshot
        await this.dynamo.putItem({
            [this.primaryKeyName]: `STREAM#${this.dataSourceKey}::${streamKey}`,
            DataCategory: 'Meta::Snapshot',
            snapshotHeader: coreFormat.header,
            snapshotUpdate: coreFormat.update
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
            return typeof message.getContent === 'function'
        }

        // Subscribe to messageBus with structure guard; callback builds envelopes as unknown, filters with envelope guard, passes narrowed to receiveEvents.
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}`,
            priority: 5, // Default priority for data source processing
            filter: streamingEventStructureGuard,
            callback: async ({ payloads, activeFlushLane }) => {
                this._inboundFlushLaneStack.push(activeFlushLane)
                try {
                    const header = (p: any): StreamingEventHeader => ({
                        dataSourceKey: p.header?.dataSourceKey ?? p.dataSourceKey,
                        streamKey: p.header?.streamKey ?? p.streamKey,
                        timestamp: p.header?.timestamp ?? p.timestamp,
                        type: p.header?.type
                    })
                    const envelopes: Array<StreamingEventEnvelope<unknown>> = payloads.map((p) => ({
                        header: header(p),
                        getContent: p.getContent
                    }))
                    const narrowed = envelopes.filter((e): e is StreamingEventEnvelope<SubscribedContent> => this.subscribedEventTypeGuard!(e))
                    await this.receiveEvents!({
                        events: narrowed,
                        streamEvent: (params) => this.streamEvent({
                            ...params,
                            laneId: params.laneId === undefined ? this.peekInboundFlushLane() : params.laneId
                        }),
                        streamEnvelope: (envelope) => this.streamEnvelope(envelope)
                    })
                } finally {
                    this._inboundFlushLaneStack.pop()
                }
            }
        })
    }

    private subscribeToInitializeEvents(): void {
        // Type guard for Initialize Subscription events in internal StreamingEvent format (getContent only)
        const initializeEventTypeGuard = (message: any): message is {
            type: 'StreamingEvent';
            dataSourceKey: 'mtw.subscriptions';
            streamKey: string;
            header: StreamingEventHeader;
            getContent: (format?: 'internal' | 'external') => Promise<{ sessionId: string; requestId: string }>;
            timestamp: number;
        } => {
            return message.type === 'StreamingEvent' &&
                   message.dataSourceKey === 'mtw.subscriptions' &&
                   message.header?.type === `Initialize Subscription - ${this.dataSourceKey}` &&
                   typeof message.streamKey === 'string' &&
                   typeof message.getContent === 'function'
        }

        // Subscribe to Initialize Subscription events with higher priority
        this.messageBus.subscribe({
            tag: `dataSource-${this.dataSourceKey}-initialize`,
            priority: 1, // Higher priority than regular events
            filter: initializeEventTypeGuard,
            callback: async ({ payloads, activeFlushLane }) => {
                this._inboundFlushLaneStack.push(activeFlushLane)
                try {
                    for (const payload of payloads) {
                        const { streamKey } = payload
                        const content = await payload.getContent()
                        if (typeof content?.sessionId !== 'string') {
                            console.error(`Invalid Initialize Subscription payload for streamKey: ${streamKey}: missing sessionId`)
                            continue
                        }
                        const { sessionId } = content

                        try {
                            await this.initializeSubscription({ sessionId, streamKey })
                        } catch (error) {
                            console.error(`Failed to process Initialize Subscription for streamKey: ${streamKey}`, error)
                        }
                    }
                } finally {
                    this._inboundFlushLaneStack.pop()
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
    wireFormatsFromCoreFormat,
    createSnapshotCoreFormat,
    coreFormatToResolvedSnapshotEnvelope,
    coreFormatToStreamingEnvelope,
    createInternalOriginEnvelope,
    SNAPSHOT_HEADER_TYPE,
} from './streamEventPublisher'

// Re-export aggregation types for convenience
export { DataSourceAggregator, AggregationResult, ResolvedStreamingEnvelope } from './aggregation'

// Re-export CoreExternalFormat guard helper for subscription lambda and other consumers
export { makeCoreExternalFormatGuardFromHeaderGuard } from './formatTransform'

// Re-export sidecar resolution helper for serializer use
export { maybeFetchSidecarString } from './sidecarResolve'

// Node/lambda DataSourceEnvironment for backend serializers (Step 2 env-agnostic refactor)
export { createNodeDataSourceEnvironment } from './nodeEnvironment'
