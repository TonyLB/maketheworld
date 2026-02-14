// MessageBus integration types for DataSource subscriptions

export type SerializableObject = Record<string, unknown>

export type EventPayload = {
    type: string;
} & Record<string, unknown>

// Header for routing and discrimination (always inline, never sidecarred)
export type StreamingEventHeader = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    type: string;
    // Optional small domain flags like zone can be added per DataSource
}

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
    getContentInternal: () => Promise<unknown>;
};

// Internal DataSource format for StreamingEvent messages on the messageBus.
// Canonical shape is header + getContentInternal.
export type StreamingEventPayload = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    header: StreamingEventHeader;
    getContentInternal: () => Promise<EventPayload>;
}

// In-process envelope passed to receiveEvents. Handlers obtain internal content via getContentInternal().
export type StreamingEventEnvelope<Content = EventPayload, Header extends StreamingEventHeader = StreamingEventHeader> = {
    header: Header;
    getContentInternal: () => Promise<Content>;
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
     * Implementations should use header.type for discriminating event variant; update carries payload only.
     */
    serialize(params: {
        update: UpdatePayload;
        header: Header;
    }): ExternalUpdatePayload;

    /**
     * Convert external update payload back to internal format
     * Returns null if the event cannot be deserialized
     */
    deserialize(params: {
        externalUpdate: ExternalUpdatePayload;
        header: Header;
    }): UpdatePayload | null;
    
    /**
     * Convert internal snapshot payload to external format for storage/transmission
     * Returns the Core External format suitable for DynamoDB storage and SNS delivery
     * 
     * Optional: Only required for replayable data sources that support snapshots
     */
    serializeSnapshot?(snapshot: SnapshotPayload): ExternalSnapshotPayload;
    
    /**
     * Convert external snapshot payload back to internal format
     * Returns null if the snapshot cannot be deserialized
     * 
     * Optional: Only required for replayable data sources that support snapshots
     */
    deserializeSnapshot?(externalSnapshot: ExternalSnapshotPayload): SnapshotPayload | null;
}