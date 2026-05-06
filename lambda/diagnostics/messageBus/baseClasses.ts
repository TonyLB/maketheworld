import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'

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
    getContent: (format?: 'internal' | 'external') => Promise<unknown>;
}

export type MessageType = ReturnValueMessage | ErrorMessage | StreamingEventMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isErrorMessage = (prop: MessageType): prop is ErrorMessage => (prop.type === 'Error')

export class MessageBus extends InternalMessageBus<MessageType> {}
