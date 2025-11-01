/**
 * Format transformation utilities for DataSource multi-context serialization
 * 
 * This module provides functions to transform between CoreExternalFormat and
 * various transmission contexts (EventBridge, DynamoDB, WebSocket).
 */

export interface CoreExternalFormat {
    dataSourceKey: string;
    streamKey: string;
    timestamp: number;  // Event timestamp (epoch milliseconds)
    RequestId?: string;
    update: { type: string; [key: string]: unknown };
}

export interface EventBridgeFormat {
    Source: string;
    DetailType: string;
    Detail: {
        streamKey: string;
        timestamp: number;
        RequestId?: string;
        [key: string]: any;
    };
}

export type DynamoDBFormat<PrimaryKey extends string = string> = {
    DataCategory: string;
    update: { type: string; [key: string]: unknown };
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
    update: { type: string; [key: string]: unknown };
}

/**
 * Transform CoreExternalFormat to EventBridge event structure
 */
export function toEventBridgeFormat(coreFormat: CoreExternalFormat): EventBridgeFormat {
    const { dataSourceKey, streamKey, timestamp, RequestId, update } = coreFormat;
    
    // Extract the type and update data from the update object
    // Exclude 'timestamp' from rest - we only use the system-assigned epoch timestamp, never EventBridge/client timestamps
    const { type, update: updateData, timestamp: _, ...rest } = update;
    
    return {
        Source: dataSourceKey,
        DetailType: type,
        Detail: {
            streamKey,
            timestamp, // Always use epoch milliseconds from CoreExternalFormat (system-assigned, authoritative)
            RequestId,
            ...rest,
            update: updateData
        }
    };
}

/**
 * Transform EventBridge event structure back to CoreExternalFormat
 * 
 * Handles both:
 * - Actual EventBridge delivery format (lowercase: source, detail-type, detail) - what AWS delivers to Lambda
 * - Serialized EventBridgeFormat (capitalized: Source, DetailType, Detail) - for internal use
 */
export function fromEventBridgeFormat(eventBridgeEvent: EventBridgeFormat | any): CoreExternalFormat {
    // Normalize event format - handle both lowercase (actual EventBridge) and capitalized (serialized) formats
    const dataSourceKey = eventBridgeEvent.Source || eventBridgeEvent.source;
    const type = eventBridgeEvent.DetailType || eventBridgeEvent['detail-type'];
    const Detail = eventBridgeEvent.Detail || eventBridgeEvent.detail;
    
    // Extract required fields from Detail
    const { streamKey, timestamp, RequestId, ...rest } = Detail;
    
    return {
        dataSourceKey,
        streamKey,
        timestamp,
        RequestId,
        update: {
            type,
            ...rest
        }
    };
}

/**
 * Transform CoreExternalFormat to DynamoDB record structure
 */
export function toDynamoDBFormat<PrimaryKey extends string>(
    coreFormat: CoreExternalFormat, 
    primaryKeyName: PrimaryKey,
    eventId: string
): DynamoDBFormat<PrimaryKey> {
    const { dataSourceKey, streamKey, timestamp, update } = coreFormat;
    
    // DataCategory includes timestamp for extraction by fromDynamoDBFormat
    // Format: EVENT#${timestamp}::${uuid}
    return {
        [primaryKeyName]: `STREAM#${dataSourceKey}::${streamKey}`,
        DataCategory: `EVENT#${timestamp}::${eventId}`,
        update
    } as DynamoDBFormat<PrimaryKey>;
}

/**
 * Transform DynamoDB record structure back to CoreExternalFormat
 */
export function fromDynamoDBFormat(
    dynamoRecord: DynamoDBFormat,
    dataSourceKey: string
): CoreExternalFormat {
    const { update, DataCategory } = dynamoRecord;
    
    // Extract streamKey from the primary key
    const primaryKeyValue = Object.values(dynamoRecord).find(value => 
        typeof value === 'string' && value.startsWith('STREAM#')
    ) as string;
    const streamKey = primaryKeyValue?.split('::')[1] || '';
    
    // Extract timestamp from DataCategory (format: EVENT#${timestamp}::${uuid})
    const timestampMatch = DataCategory.match(/^EVENT#(\d+)::/);
    const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : 0;
    
    return {
        dataSourceKey,
        streamKey,
        timestamp,
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
 *   Input: { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 1234567890, update: { type: 'Snapshot Generated', assets: [...] } }
 *   Output: { messageType: 'StreamEvent', dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'global', timestamp: 1234567890, update: { type: 'Snapshot Generated', assets: [...] } }
 */
export function toSNSFeedbackFormat(coreFormat: CoreExternalFormat): SNSFeedbackFormat {
    const { dataSourceKey, streamKey, timestamp, update } = coreFormat;
    
    return {
        messageType: 'StreamEvent',
        dataSourceKey,
        streamKey,
        timestamp,
        update
    };
}

/**
 * Transform SNS Feedback format back to CoreExternalFormat
 */
export function fromSNSFeedbackFormat(snsFormat: SNSFeedbackFormat): CoreExternalFormat {
    const { dataSourceKey, streamKey, timestamp, update } = snsFormat;
    
    return {
        dataSourceKey,
        streamKey,
        timestamp,
        update
    };
}

