/**
 * Format transformation utilities for DataSource multi-context serialization
 *
 * This module provides functions to transform between CoreExternalFormat and
 * various transmission contexts (EventBridge, DynamoDB, WebSocket).
 *
 * In-memory: CoreExternalFormat has a single merged `header` (base four + extended properties).
 * On the wire: the extended part is a separate field `extendedHeader`; it is merged into
 * `header` when deserializing and split from `header` when serializing.
 */

import type { HeaderGuard } from './baseClasses'

/** Base four header fields that are always present; extended props (e.g. RequestIds) live in header in memory and as extendedHeader on the wire. */
const BASE_HEADER_KEYS = ['dataSourceKey', 'streamKey', 'timestamp', 'type'] as const;

export interface CoreExternalFormat {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;  // Event timestamp (epoch milliseconds)
    RequestId?: string;
    /** Full header (base four + extended properties merged). On the wire, extended part is written as Detail.extendedHeader.
     *  header.type is authoritative for routing when present; update.type is preserved for wire compatibility and deserialization only.
     */
    header?: { dataSourceKey: string; streamKey: string; timestamp: number; type: string; [key: string]: unknown };
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

export interface WebSocketFormat {
    messageType: 'StreamEvent';
    message: {
        dataSourceKey: string;
        streamKey: string;
        timestamp: number;
        RequestId?: string;
        update: { type: string; [key: string]: unknown };
    };
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
    const { dataSourceKey, streamKey, timestamp, RequestId, header, update } = coreFormat;

    // Extract the type and update data from the update object
    // Exclude 'timestamp' from rest - we only use the system-assigned epoch timestamp, never EventBridge/client timestamps
    const { type, update: updateData, timestamp: _, ...rest } = update;
    const effectiveType = header?.type ?? type;

    // Extended part of header (everything except base four) goes to Detail.extendedHeader on the wire
    let extendedHeader: unknown = undefined;
    if (header && typeof header === 'object') {
        const extended = { ...header };
        for (const k of BASE_HEADER_KEYS) {
            delete extended[k];
        }
        if (Object.keys(extended).length > 0) {
            extendedHeader = extended;
        }
    }

    return {
        Source: dataSourceKey,
        DetailType: effectiveType,
        Detail: {
            streamKey,
            timestamp, // Always use epoch milliseconds from CoreExternalFormat (system-assigned, authoritative)
            RequestId,
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

    // Build full header: base four + extended part (from extendedHeader or legacy RequestIds)
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
        ...extendedPart
    };

    return {
        dataSourceKey,
        streamKey,
        timestamp,
        RequestId,
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
    const { dataSourceKey, streamKey, timestamp, header, update } = coreFormat;

    let extendedHeader: unknown = undefined;
    if (header && typeof header === 'object') {
        const extended = { ...header };
        for (const k of BASE_HEADER_KEYS) {
            delete extended[k];
        }
        if (Object.keys(extended).length > 0) {
            extendedHeader = extended;
        }
    }

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
        dataSourceKey,
        streamKey,
        timestamp,
        header: fullHeader,
        update
    };
}

/**
 * Transform CoreExternalFormat to WebSocket message structure
 */
export function toWebSocketFormat(coreFormat: CoreExternalFormat): WebSocketFormat {
    const { dataSourceKey, streamKey, timestamp, RequestId, update } = coreFormat;
    
    return {
        messageType: 'StreamEvent',
        message: {
            dataSourceKey,
            streamKey,
            timestamp,
            RequestId,
            update
        }
    };
}

/**
 * Transform WebSocket message structure back to CoreExternalFormat
 */
export function fromWebSocketFormat(webSocketMessage: WebSocketFormat): CoreExternalFormat {
    const { message } = webSocketMessage;
    const { dataSourceKey, streamKey, timestamp, RequestId, update } = message;
    
    return {
        dataSourceKey,
        streamKey,
        timestamp,
        RequestId,
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
    const { dataSourceKey, streamKey, timestamp, header, update } = coreFormat;

    let extendedHeader: unknown = undefined;
    if (header && typeof header === 'object') {
        const extended = { ...header };
        for (const k of BASE_HEADER_KEYS) {
            delete extended[k];
        }
        if (Object.keys(extended).length > 0) {
            extendedHeader = extended;
        }
    }

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
        dataSourceKey,
        streamKey,
        timestamp,
        header: fullHeader,
        update
    };
}

