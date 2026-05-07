import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'

export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    timestamp: number;
    getContent: (format?: 'internal' | 'external') => Promise<unknown>;
}

export type MessageType = StreamingEventMessage

export class MessageBus extends InternalMessageBus<MessageType> {}
