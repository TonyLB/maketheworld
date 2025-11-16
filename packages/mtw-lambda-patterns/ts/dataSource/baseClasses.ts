// MessageBus integration types for DataSource subscriptions

export type SerializableObject = Record<string, unknown>

export type EventPayload = {
    type: string;
} & Record<string, unknown>

// External EventBridge format
export type StreamingEvent = {
    messageType: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    detailEnvelope: EventPayload;
}

// Internal DataSource format (clean, no external baggage)
export type StreamingEventPayload = {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    detailEnvelope: EventPayload;
}

// EventBridge serialization interface for DataSource integration
export interface DataSourceEventSerializer<
    UpdatePayload extends EventPayload, 
    ExternalUpdatePayload extends EventPayload,
    SnapshotPayload extends SerializableObject = SerializableObject,
    ExternalSnapshotPayload extends SerializableObject = SerializableObject
> {
    /**
     * Convert internal update payload to external format for EventBridge Detail
     */
    serialize(params: {
        dataSourceKey: string;
        streamKey: string;
        update: UpdatePayload;
    }): ExternalUpdatePayload;
    
    /**
     * Convert external update payload back to internal format
     * Returns null if the event cannot be deserialized
     */
    deserialize(params: {
        dataSourceKey: string;
        streamKey: string;
        externalUpdate: ExternalUpdatePayload;
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