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
        type: string;
        RequestId?: string;
        update: unknown;
    };
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
    const { type } = update;
    
    return {
        messageType: 'StreamEvent',
        message: {
            dataSourceKey,
            streamKey,
            type,
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
    const { dataSourceKey, streamKey, type, RequestId, update } = message;
    
    return {
        dataSourceKey,
        streamKey,
        RequestId,
        update: {
            type,
            ...(update as Record<string, unknown>)
        }
    };
}

