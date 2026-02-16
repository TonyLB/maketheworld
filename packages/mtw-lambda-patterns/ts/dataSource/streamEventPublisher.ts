/**
 * Publisher abstraction: builds CoreExternalFormat from (header, content) and optional
 * serializer, then produces all wire formats (EventBridge, DynamoDB, SNS, WebSocket).
 * Callers perform actual send/store. Used by DataSource.streamEvent (4b) and initialize lambda (4c).
 */
import { StreamingEventHeader } from './baseClasses'
import {
    CoreExternalFormat,
    EventBridgeFormat,
    DynamoDBFormat,
    WebSocketFormat,
    SNSFeedbackFormat,
    toEventBridgeFormat,
    toDynamoDBFormat,
    toWebSocketFormat,
    toSNSFeedbackFormat,
} from './formatTransform'

/** Minimal serializer interface: serialize internal content + header to external update. */
export interface StreamEventPublisherSerializer<Header extends StreamingEventHeader = StreamingEventHeader> {
    serialize(params: { content: unknown; header: Header }): { type: string; [key: string]: unknown };
}

export type StreamEventPublisherOptions<PrimaryKey extends string = string, Header extends StreamingEventHeader = StreamingEventHeader> = {
    header: Header;
    content: unknown;
    serializer?: StreamEventPublisherSerializer<Header>;
    primaryKeyName?: PrimaryKey;
    eventId?: string;
};

export type StreamEventPublisherResult<PrimaryKey extends string = string> = {
    coreFormat: CoreExternalFormat;
    eventBridgeEvent: EventBridgeFormat;
    dynamoRecord?: DynamoDBFormat<PrimaryKey>;
    snsFeedbackFormat: SNSFeedbackFormat;
    webSocketFormat: WebSocketFormat;
};

/**
 * Build CoreExternalFormat from header and internal content, then produce EventBridge
 * and (optionally) DynamoDB wire formats. Caller is responsible for timestamp/uuid
 * generation and for sending (EventBridge, DynamoDB, messageBus).
 */
export function publishStreamEvent<PrimaryKey extends string = string, Header extends StreamingEventHeader = StreamingEventHeader>(
    options: StreamEventPublisherOptions<PrimaryKey, Header>
): StreamEventPublisherResult<PrimaryKey> {
    const { header, content, serializer, primaryKeyName, eventId } = options;
    const { dataSourceKey, streamKey, timestamp } = header;

    const update = serializer
        ? serializer.serialize({ content, header }) as { type: string; [key: string]: unknown }
        : (content as { type: string; [key: string]: unknown });

    const coreFormat: CoreExternalFormat = {
        dataSourceKey,
        streamKey,
        timestamp,
        header,
        update,
    };

    const eventBridgeEvent = toEventBridgeFormat(coreFormat);
    const snsFeedbackFormat = toSNSFeedbackFormat(coreFormat);
    const webSocketFormat = toWebSocketFormat(coreFormat);

    let dynamoRecord: DynamoDBFormat<PrimaryKey> | undefined;
    if (primaryKeyName != null && eventId != null) {
        dynamoRecord = toDynamoDBFormat(coreFormat, primaryKeyName, eventId) as DynamoDBFormat<PrimaryKey>;
    }

    return { coreFormat, eventBridgeEvent, dynamoRecord, snsFeedbackFormat, webSocketFormat };
}

export type WireFormatsFromCoreFormatOptions<PrimaryKey extends string = string> = {
    primaryKeyName?: PrimaryKey;
    eventId?: string;
};

export type WireFormatsFromCoreFormatResult<PrimaryKey extends string = string> = {
    eventBridgeEvent: EventBridgeFormat;
    dynamoRecord?: DynamoDBFormat<PrimaryKey>;
    snsFeedbackFormat: SNSFeedbackFormat;
    webSocketFormat: WebSocketFormat;
};

/**
 * Produce all wire formats from an existing CoreExternalFormat. Use when the caller
 * already has a coreFormat (e.g. deliverReplayData for snapshot or replay events).
 */
export function wireFormatsFromCoreFormat<PrimaryKey extends string = string>(
    coreFormat: CoreExternalFormat,
    options?: WireFormatsFromCoreFormatOptions<PrimaryKey>
): WireFormatsFromCoreFormatResult<PrimaryKey> {
    const { primaryKeyName, eventId } = options ?? {};
    const eventBridgeEvent = toEventBridgeFormat(coreFormat);
    const snsFeedbackFormat = toSNSFeedbackFormat(coreFormat);
    const webSocketFormat = toWebSocketFormat(coreFormat);

    let dynamoRecord: DynamoDBFormat<PrimaryKey> | undefined;
    if (primaryKeyName != null && eventId != null) {
        dynamoRecord = toDynamoDBFormat(coreFormat, primaryKeyName, eventId) as DynamoDBFormat<PrimaryKey>;
    }

    return { eventBridgeEvent, dynamoRecord, snsFeedbackFormat, webSocketFormat };
}
