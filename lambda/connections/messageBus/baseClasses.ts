import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    InternalMessageBus,
    type ReturnValueMessage,
    type ErrorMessage,
    isReturnValueMessage,
    isErrorMessage,
} from '@tonylb/mtw-lambda-patterns/ts/messageBus'

export type { ReturnValueMessage, ErrorMessage }

export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    timestamp: number;
    getContent: (format?: 'internal' | 'external') => Promise<unknown>;
}

export type MessageType = ReturnValueMessage | ErrorMessage | StreamingEventMessage

export { isReturnValueMessage, isErrorMessage }

export class MessageBus extends InternalMessageBus<MessageType> {}
