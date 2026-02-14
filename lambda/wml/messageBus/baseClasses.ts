import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// WML messageBus streaming messages use a header-like shape (dataSourceKey, streamKey, timestamp, type)
// plus content (or getContentInternal). DataSource.subscribe() builds envelopes and filters with
// subscribedEvents envelope guards. Payload types stay in dataSource/subscribedEvents; baseClasses is payload-agnostic.

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

export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    timestamp: number;
    getContentInternal: () => Promise<unknown>;
}

export type { StreamingEventHeader }

export type MessageType = ReturnValueMessage |
    ErrorMessage |
    StreamingEventMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isErrorMessage = (prop: MessageType): prop is ErrorMessage => (prop.type === 'Error')
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')

export class MessageBus extends InternalMessageBus<MessageType> {}
