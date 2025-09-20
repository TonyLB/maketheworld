// MessageBus integration types for DataSource subscriptions

export type SerializableObject = Record<string, unknown>

export type StreamingEvent = {
    messageType: 'StreamingEvent';
    dataSourceKey: string;
    detailType: string;
    event: {
        streamKey: string;
        update: unknown;
    };
    timestamp: number;
}

export type StreamingEventPayload = Omit<StreamingEvent, 'messageType'>

// EventBridge serialization interface for DataSource integration
export interface DataSourceEventSerializer<UpdatePayload = any, ExternalUpdatePayload extends string | SerializableObject = string | SerializableObject> {
    /**
     * Convert internal update payload to external format for EventBridge Detail
     */
    serialize(params: {
        dataSourceKey: string;
        detailType: string;
        streamKey: string;
        update: UpdatePayload;
    }): ExternalUpdatePayload;
    
    /**
     * Convert external update payload back to internal format
     * Returns null if the event cannot be deserialized
     */
    deserialize(params: {
        dataSourceKey: string;
        detailType: string;
        streamKey: string;
        externalUpdate: ExternalUpdatePayload;
    }): UpdatePayload | null;
}