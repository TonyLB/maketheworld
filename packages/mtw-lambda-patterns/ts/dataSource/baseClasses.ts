// MessageBus integration types for DataSource subscriptions

export type SerializableObject = Record<string, unknown>

/** Payload for stream events. Internal payloads omit type (discrimination by header.type); external include type for wire. */
export type EventPayload = {
    type?: string;
} & Record<string, unknown>

// Header for routing and discrimination (always inline, never sidecarred)
export type StreamingEventHeader = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    type: string;
    // Optional small domain flags like zone can be added per DataSource
}

/** Subset of Header that streamEvent callers may supply; DataSource fills dataSourceKey, streamKey, timestamp. */
export type StreamEventHeaderFragment<Header extends StreamingEventHeader = StreamingEventHeader> =
    Omit<Header, 'dataSourceKey' | 'streamKey' | 'timestamp'>

// External EventBridge format (still uses detailEnvelope on the wire)
export type StreamingEvent = {
    messageType: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    detailEnvelope: EventPayload;
}

// Contract for streaming event messages as seen on the bus (payload-agnostic).
// Lambdas can align their StreamingEventMessage with this without importing DataSource payload types.
export type StreamingEventPayloadContract = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    header: StreamingEventHeader;
    getContent: () => Promise<unknown>;
};

// Internal DataSource format for StreamingEvent messages on the messageBus.
// Canonical shape is header + getContent.
export type StreamingEventPayload = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    header: StreamingEventHeader;
    getContent: () => Promise<EventPayload>;
}

// In-process envelope passed to receiveEvents. Handlers obtain internal content via getContent().
export type StreamingEventEnvelope<Content = EventPayload, Header extends StreamingEventHeader = StreamingEventHeader> = {
    header: Header;
    getContent: () => Promise<Content>;
}

/**
 * Resolved streaming envelope: header + content (no lazy getter).
 * Same shape as StreamingEventEnvelope but with content in hand instead of getContent().
 * Used by: DataSourceAggregator.applyUpdate; client recentEvents; and conceptually by
 * serialize(params) / deserialize(params) which take { header, update } or { header, externalUpdate }.
 */
export type ResolvedStreamingEnvelope<Content, Header extends StreamingEventHeader = StreamingEventHeader> = {
    header: Header;
    content: Content;
}

// Header-level predicates and helpers for deriving envelope guards across regimes

export type HeaderGuard<H extends StreamingEventHeader> = (header: StreamingEventHeader) => header is H

export function makeStreamingEnvelopeGuardFromHeaderGuard<
    Content,
    H extends StreamingEventHeader
>(headerGuard: HeaderGuard<H>) {
    return (
        envelope: StreamingEventEnvelope<unknown>
    ): envelope is StreamingEventEnvelope<Content, H> => (
        headerGuard(envelope.header)
    )
}

export function makeResolvedEnvelopeGuardFromHeaderGuard<
    Content,
    H extends StreamingEventHeader
>(headerGuard: HeaderGuard<H>) {
    return (
        envelope: ResolvedStreamingEnvelope<unknown, StreamingEventHeader>
    ): envelope is ResolvedStreamingEnvelope<Content, H> => (
        headerGuard(envelope.header)
    )
}

// EventBridge serialization interface for DataSource integration
export interface DataSourceEventSerializer<
    UpdatePayload extends EventPayload,
    ExternalUpdatePayload extends EventPayload,
    SnapshotPayload extends SerializableObject = SerializableObject,
    ExternalSnapshotPayload extends SerializableObject = SerializableObject,
    Header extends StreamingEventHeader = StreamingEventHeader
> {
    /**
     * Convert internal update payload to external format for EventBridge Detail.
     * Params use the same shape as ResolvedStreamingEnvelope: content is the payload (internal here); routing uses header.type only.
     * Handles both streaming events and snapshots (when header.type === 'Snapshot').
     */
    serialize(params: {
        content: UpdatePayload | SnapshotPayload;
        header: Header;
    }): ExternalUpdatePayload | ExternalSnapshotPayload;

    /**
     * Convert external update payload back to internal format.
     * Params use the same shape as ResolvedStreamingEnvelope: content is the payload (external here); routing uses header.type only.
     * Returns null if the event cannot be deserialized.
     * Handles both streaming events and snapshots (when header.type === 'Snapshot').
     */
    deserialize(params: {
        content: ExternalUpdatePayload | ExternalSnapshotPayload;
        header: Header;
    }): Promise<UpdatePayload | SnapshotPayload | null>;
}