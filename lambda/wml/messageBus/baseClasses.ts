import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { CoordinationEventUpdate } from '../dataSource/coordinationSerializer'

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


// Constrained to only the internal events that WML dataSource actually subscribes to
export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: 'internal';
    streamKey: string;
    detailEnvelope: CoordinationEventUpdate;
    timestamp: number;
}

// Initialize Subscription events from mtw.subscriptions (e.g. "Initialize Subscription - mtw.wml")
export type InitializeSubscriptionEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: 'mtw.subscriptions';
    streamKey: string;
    detailEnvelope: {
        type: string;
        update: {
            sessionId: string;
            requestId: string;
        };
    };
    timestamp: number;
}

// EventBridge deserialized events (mtw.coordination, mtw.diagnostics) published to messageBus
export type ExternalStreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    event: unknown;
    timestamp: number;
}

export type MessageType = ReturnValueMessage |
    ErrorMessage |
    StreamingEventMessage |
    InitializeSubscriptionEventMessage |
    ExternalStreamingEventMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isErrorMessage = (prop: MessageType): prop is ErrorMessage => (prop.type === 'Error')
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')

export class MessageBus extends InternalMessageBus<MessageType> {}
