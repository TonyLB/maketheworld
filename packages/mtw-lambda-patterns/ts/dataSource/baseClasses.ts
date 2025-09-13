// MessageBus integration types for DataSource subscriptions

export type StreamingEvent = {
    messageType: 'StreamingEvent';
    dataSourceKey: string;
    event: unknown;
    timestamp: number;
}

export type StreamingEventPayload = Omit<StreamingEvent, 'messageType'>
