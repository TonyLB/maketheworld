import {
    InternalMessageBus,
    type ReturnValueMessage,
    type ErrorMessage,
    isReturnValueMessage,
    isErrorMessage,
} from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

export type { ReturnValueMessage, ErrorMessage }

// WML messageBus streaming messages use a header-like shape (dataSourceKey, streamKey, timestamp, type)
// plus content (or getContent). DataSource.subscribe() builds envelopes and filters with
// subscribedEvents envelope guards. Payload types stay in dataSource/subscribedEvents; baseClasses is payload-agnostic.

export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    timestamp: number;
    getContent: (format?: 'internal' | 'external') => Promise<unknown>;
}

export type { StreamingEventHeader }

export type MessageType = ReturnValueMessage |
    ErrorMessage |
    StreamingEventMessage

export { isReturnValueMessage, isErrorMessage }
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')

export class MessageBus extends InternalMessageBus<MessageType> {}
