import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { CoordinationEventUpdate } from '../dataSource/coordinationSerializer'

// WML messageBus streaming messages use a header-like shape (dataSourceKey, streamKey, timestamp, type)
// plus a content payload (detailEnvelope or event). DataSource.subscribe() maps these into
// StreamingEventEnvelope<Content> with header: StreamingEventHeader and content. Step 4 (gates)
// will have gates build { header, content } explicitly when sending to the bus.

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type ErrorMessage = {
    type: 'Error';
    body: {
        error: string;
        statusCode?: number;
    };
}


// Constrained to only the internal events that WML dataSource actually subscribes to.
// Header part: type, dataSourceKey, streamKey, timestamp.
// Content part: CoordinationEventUpdate. getContentInternal supports lazy evaluation (aligns with ExternalStreamingEventMessage).
export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: 'internal';
    streamKey: string;
    header: StreamingEventHeader;
    content: CoordinationEventUpdate;
    getContentInternal?: () => Promise<CoordinationEventUpdate>;
    timestamp: number;
}

// Initialize Subscription events from mtw.subscriptions (e.g. "Initialize Subscription - mtw.wml")
export type InitializeSubscriptionEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: 'mtw.subscriptions';
    streamKey: string;
    header: StreamingEventHeader;
    content: {
        sessionId: string;
        requestId: string;
    };
    timestamp: number;
}

// EventBridge deserialized events (mtw.coordination, mtw.diagnostics) published to messageBus.
// Header part: type, dataSourceKey, streamKey, timestamp. Content part: content (internal event).
export type ExternalStreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    content: unknown;
    getContentInternal?: () => Promise<unknown>;
    timestamp: number;
}

// Re-export for use when building envelope-shaped messages (Step 4).
export type { StreamingEventHeader }

export type MessageType = ReturnValueMessage |
    ErrorMessage |
    StreamingEventMessage |
    InitializeSubscriptionEventMessage |
    ExternalStreamingEventMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isErrorMessage = (prop: MessageType): prop is ErrorMessage => (prop.type === 'Error')
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')

export class MessageBus extends InternalMessageBus<MessageType> {}
