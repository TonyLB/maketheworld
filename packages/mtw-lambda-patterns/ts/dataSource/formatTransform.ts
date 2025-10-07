/**
 * Format transformation utilities for DataSource multi-context serialization
 * 
 * This module provides functions to transform between CoreExternalFormat and
 * various transmission contexts (EventBridge, DynamoDB, WebSocket).
 */

export interface CoreExternalFormat {
    dataSourceKey: string;
    streamKey: string;
    RequestId?: string;
    update: { type: string; [key: string]: unknown };
}

export interface EventBridgeFormat {
    Source: string;
    DetailType: string;
    Detail: {
        streamKey: string;
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
        RequestId?: string;
        update: { type: string; [key: string]: unknown };
    };
}

export interface SNSFeedbackFormat {
    messageType: 'StreamEvent';
    dataSourceKey: string;
    streamKey: string;
    update: { type: string; [key: string]: unknown };
}

/**
 * Transform CoreExternalFormat to EventBridge event structure
 */
export function toEventBridgeFormat(coreFormat: CoreExternalFormat): EventBridgeFormat {
    const { dataSourceKey, streamKey, RequestId, update } = coreFormat;
    
    // Extract the type and update data from the update object
    const { type, update: updateData, ...rest } = update;
    
    return {
        Source: dataSourceKey,
        DetailType: type,
        Detail: {
            streamKey,
            RequestId,
            ...rest,
            update: updateData
        }
    };
}

/**
 * Transform EventBridge event structure back to CoreExternalFormat
 */
export function fromEventBridgeFormat(eventBridgeEvent: EventBridgeFormat): CoreExternalFormat {
    const { Source: dataSourceKey, DetailType: type, Detail } = eventBridgeEvent;
    const { streamKey, RequestId, ...rest } = Detail;
    
    return {
        dataSourceKey,
        streamKey,
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
    const { dataSourceKey, streamKey, update } = coreFormat;
    
    return {
        [primaryKeyName]: `STREAM#${dataSourceKey}::${streamKey}`,
        DataCategory: `EVENT#${eventId}`,
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
    const { update } = dynamoRecord;
    
    // Extract streamKey from the primary key
    const primaryKeyValue = Object.values(dynamoRecord).find(value => 
        typeof value === 'string' && value.startsWith('STREAM#')
    ) as string;
    const streamKey = primaryKeyValue?.split('::')[1] || '';
    
    return {
        dataSourceKey,
        streamKey,
        update
    };
}

/**
 * Transform CoreExternalFormat to WebSocket message structure
 */
export function toWebSocketFormat(coreFormat: CoreExternalFormat): WebSocketFormat {
    const { dataSourceKey, streamKey, RequestId, update } = coreFormat;
    
    return {
        messageType: 'StreamEvent',
        message: {
            dataSourceKey,
            streamKey,
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
    const { dataSourceKey, streamKey, RequestId, update } = message;
    
    return {
        dataSourceKey,
        streamKey,
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
 *   Input: { dataSourceKey: 'mtw.assets', streamKey: 'global', update: { type: 'Snapshot Generated', assets: [...] } }
 *   Output: { messageType: 'StreamEvent', dataSourceKey: 'mtw.assets', streamKey: 'global', update: { type: 'Snapshot Generated', assets: [...] } }
 */
export function toSNSFeedbackFormat(coreFormat: CoreExternalFormat): SNSFeedbackFormat {
    const { dataSourceKey, streamKey, update } = coreFormat;
    
    return {
        messageType: 'StreamEvent',
        dataSourceKey,
        streamKey,
        update
    };
}

/**
 * Transform SNS Feedback format back to CoreExternalFormat
 */
export function fromSNSFeedbackFormat(snsFormat: SNSFeedbackFormat): CoreExternalFormat {
    const { dataSourceKey, streamKey, update } = snsFormat;
    
    return {
        dataSourceKey,
        streamKey,
        update
    };
}

