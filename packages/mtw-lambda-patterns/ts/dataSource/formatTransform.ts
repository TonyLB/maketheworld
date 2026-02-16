/**
 * Format transformation utilities for DataSource multi-context serialization
 *
 * This module provides functions to transform between CoreExternalFormat and
 * various transmission contexts (EventBridge, DynamoDB, WebSocket).
 *
 * CoreExternalFormat is header-authoritative: it has two fields only, `header` (required)
 * and `update`. All envelope metadata (dataSourceKey, streamKey, timestamp, type, RequestId,
 * and any extended fields) lives on header; there are no duplicated top-level fields.
 * On the wire: every context (EventBridge, DynamoDB, SNS, WebSocket) uses the same rule:
 * extended = header minus base four (dataSourceKey, streamKey, timestamp, type). It is
 * a separate field `extendedHeader` where the format supports it, or merged at top level
 * (e.g. WebSocket); merged into header when deserializing, split from header when serializing.
 */

import type { HeaderGuard } from './baseClasses'


/**
 * Returns the extended part of the header (header minus base four). Used by all to* format transforms.
 * @internal
 */
function getExtendedFromHeader(header: CoreExternalFormat['header']): Record<string, unknown> | undefined {
    if (!header || typeof header !== 'object') return undefined;
    const { dataSourceKey, streamKey, timestamp, type, ...extended } = header;
    return Object.keys(extended).length > 0 ? extended : undefined;
}

/** In-memory format: header (required) is the single source of truth for all envelope metadata; update is the payload. */
export interface CoreExternalFormat {
    header: { dataSourceKey: string; streamKey: string; timestamp: number; type: string; [key: string]: unknown };
    update: { type: string; [key: string]: unknown };
}

export interface EventBridgeFormat {
    Source: string;
    DetailType: string;
    Detail: {
        streamKey: string;
        timestamp: number;
        RequestId?: string;
        /** Extended part of the header on the wire; merged into coreFormat.header when deserializing. */
        extendedHeader?: unknown;
        [key: string]: any;
    };
}

export type DynamoDBFormat<PrimaryKey extends string = string> = {
    DataCategory: string;
    update: { type: string; [key: string]: unknown };
    /** Extended part of header on the wire; merged into coreFormat.header when deserializing. */
    extendedHeader?: unknown;
} & {
    [K in PrimaryKey]: string;
}

/**
 * Flat WebSocket stream-event message (canonical base type; domain union lives in mtw-interfaces).
 * Extended header fields (e.g. RequestId, RequestIds) are merged at top level by toWebSocketFormat;
 * other extended header fields may appear at top level as well.
 */
export interface WebSocketFormat {
    messageType: 'StreamEvent';
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    update: { type: string; [key: string]: unknown };
    RequestId?: string;
    RequestIds?: string[];
}

export interface SNSFeedbackFormat {
    messageType: 'StreamEvent';
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;
    extendedHeader?: unknown;
    update: { type: string; [key: string]: unknown };
}

/** Header type that CoreExternalFormat may carry; used to constrain makeCoreExternalFormatGuardFromHeaderGuard. */
export type CoreExternalFormatHeader = NonNullable<CoreExternalFormat['header']>

/**
 * Build a type guard for CoreExternalFormat from a HeaderGuard so the same header predicates
 * used by DataSource subscribedEvents can be reused for the external/core regime (e.g. subscription lambda matchEvent).
 */
export function makeCoreExternalFormatGuardFromHeaderGuard<H extends CoreExternalFormatHeader>(
    headerGuard: HeaderGuard<H>
): (coreFormat: CoreExternalFormat) => coreFormat is CoreExternalFormat & { header: H } {
    return (coreFormat: CoreExternalFormat): coreFormat is CoreExternalFormat & { header: H } =>
        coreFormat.header != null && headerGuard(coreFormat.header)
}

/**
 * Transform CoreExternalFormat to EventBridge event structure.
 * Splits coreFormat.header into base four + extended part; writes extended part as Detail.extendedHeader.
 */
export function toEventBridgeFormat(coreFormat: CoreExternalFormat): EventBridgeFormat {
    const { header, update } = coreFormat;
    const { dataSourceKey, streamKey, timestamp, type: effectiveType } = header;

    const { type: _, update: updateData, timestamp: __, ...rest } = update;

    const extendedHeader = getExtendedFromHeader(header);

    return {
        Source: dataSourceKey,
        DetailType: effectiveType,
        Detail: {
            streamKey,
            timestamp,
            ...(extendedHeader !== undefined ? { extendedHeader } : {}),
            ...rest,
            update: updateData
        }
    };
}

/**
 * Transform EventBridge event structure back to CoreExternalFormat.
 * Merges Detail.extendedHeader with base four into coreFormat.header; does not set coreFormat.extendedHeader.
 * Legacy: if Detail.extendedHeader is absent but Detail.RequestIds is present, treat RequestIds as the extended part.
 */
export function fromEventBridgeFormat(eventBridgeEvent: EventBridgeFormat | any): CoreExternalFormat {
    // Normalize event format - handle both lowercase (actual EventBridge) and capitalized (serialized) formats
    const dataSourceKey = eventBridgeEvent.Source || eventBridgeEvent.source;
    const type = eventBridgeEvent.DetailType || eventBridgeEvent['detail-type'];
    const Detail = eventBridgeEvent.Detail || eventBridgeEvent.detail;

    const { streamKey, timestamp, RequestId, extendedHeader, RequestIds, ...contentRest } = Detail;

    // Build full header: base four + extended part (from extendedHeader or legacy RequestIds); merge Detail.RequestId into header
    const extendedPart =
        extendedHeader != null && typeof extendedHeader === 'object'
            ? { ...extendedHeader }
            : RequestIds !== undefined
                ? { RequestIds }
                : {};
    const fullHeader: CoreExternalFormat['header'] = {
        dataSourceKey,
        streamKey,
        timestamp,
        type,
        ...extendedPart,
        ...(RequestId != null ? { RequestId } : {})
    };

    return {
        header: fullHeader,
        update: {
            type,
            ...contentRest
        }
    };
}

/**
 * Transform CoreExternalFormat to DynamoDB record structure.
 * Derives extendedHeader from coreFormat.header (header minus base four).
 */
export function toDynamoDBFormat<PrimaryKey extends string>(
    coreFormat: CoreExternalFormat,
    primaryKeyName: PrimaryKey,
    eventId: string
): DynamoDBFormat<PrimaryKey> {
    const { header, update } = coreFormat;
    const { dataSourceKey, streamKey, timestamp } = header;

    const extendedHeader = getExtendedFromHeader(header);

    const record: DynamoDBFormat<PrimaryKey> = {
        [primaryKeyName]: `STREAM#${dataSourceKey}::${streamKey}`,
        DataCategory: `EVENT#${timestamp}::${eventId}`,
        update
    } as DynamoDBFormat<PrimaryKey>;
    if (extendedHeader !== undefined) {
        record.extendedHeader = extendedHeader;
    }
    return record;
}

/**
 * Transform DynamoDB record structure back to CoreExternalFormat.
 * Merges record.extendedHeader with base four into coreFormat.header.
 * Legacy: if record has no extendedHeader but update has RequestIds, optionally use as extended part.
 */
export function fromDynamoDBFormat(
    dynamoRecord: DynamoDBFormat,
    dataSourceKey: string
): CoreExternalFormat {
    const { update, DataCategory, extendedHeader } = dynamoRecord;

    const primaryKeyValue = Object.values(dynamoRecord).find(
        (value) => typeof value === 'string' && value.startsWith('STREAM#')
    ) as string;
    const streamKey = primaryKeyValue?.split('::')[1] || '';

    const timestampMatch = DataCategory.match(/^EVENT#(\d+)::/);
    const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : 0;

    const type = update?.type ?? '';
    const extendedPart =
        extendedHeader != null && typeof extendedHeader === 'object'
            ? { ...extendedHeader }
            : update && typeof update === 'object' && 'RequestIds' in update && update.RequestIds !== undefined
                ? { RequestIds: update.RequestIds }
                : {};
    const fullHeader: CoreExternalFormat['header'] = {
        dataSourceKey,
        streamKey,
        timestamp,
        type,
        ...extendedPart
    };

    return {
        header: fullHeader,
        update
    };
}

/**
 * Transform CoreExternalFormat to flat WebSocket message structure.
 * Merges extended part of header (header minus base four) onto the message.
 */
export function toWebSocketFormat(coreFormat: CoreExternalFormat): WebSocketFormat {
    const { header, update } = coreFormat;
    const { dataSourceKey, streamKey, timestamp } = header;
    const extended = getExtendedFromHeader(header) ?? {};
    return {
        messageType: 'StreamEvent',
        dataSourceKey,
        streamKey,
        timestamp,
        update,
        ...extended
    };
}

/**
 * Transform flat WebSocket message structure back to CoreExternalFormat.
 * Reconstructs header from base four plus all other top-level message fields (extended part).
 */
export function fromWebSocketFormat(webSocketMessage: WebSocketFormat): CoreExternalFormat {
    const { messageType, dataSourceKey, streamKey, timestamp, update, ...rest } = webSocketMessage;
    const fullHeader: CoreExternalFormat['header'] = {
        dataSourceKey,
        streamKey,
        timestamp,
        type: update?.type ?? '',
        ...rest
    };
    return {
        header: fullHeader,
        update
    };
}

/**
 * Transform CoreExternalFormat to SNS Feedback format
 * 
 * This format is used for messages sent to the feedback SNS topic.
 * The feedback lambda will spread this message and add RequestId before
 * sending to WebSocket connections.
 * 
 * Note: This is a FLAT structure that gets sent as the SNS Message body.
 * The feedback lambda does: { ...JSON.parse(Sns.Message), RequestId }
 * 
 * Example:
 *   Input: { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 1234567890, update: { type: 'Snapshot', assets: [...] } }
 *   Output: { messageType: 'StreamEvent', dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 1234567890, update: { type: 'Snapshot', assets: [...] } }
 */
/**
 * Derives extendedHeader from coreFormat.header when present.
 */
export function toSNSFeedbackFormat(coreFormat: CoreExternalFormat): SNSFeedbackFormat {
    const { header, update } = coreFormat;
    const { dataSourceKey, streamKey, timestamp } = header;

    const extendedHeader = getExtendedFromHeader(header);

    const result: SNSFeedbackFormat = {
        messageType: 'StreamEvent',
        dataSourceKey,
        streamKey,
        timestamp,
        update
    };
    if (extendedHeader !== undefined) {
        result.extendedHeader = extendedHeader;
    }
    return result;
}

/**
 * Merges extendedHeader with base four into coreFormat.header.
 */
export function fromSNSFeedbackFormat(snsFormat: SNSFeedbackFormat): CoreExternalFormat {
    const { dataSourceKey, streamKey, timestamp, extendedHeader, update } = snsFormat;

    const type = update?.type ?? '';
    const extendedPart =
        extendedHeader != null && typeof extendedHeader === 'object'
            ? { ...extendedHeader }
            : {};
    const fullHeader: CoreExternalFormat['header'] = {
        dataSourceKey,
        streamKey,
        timestamp,
        type,
        ...extendedPart
    };

    return {
        header: fullHeader,
        update
    };
}

