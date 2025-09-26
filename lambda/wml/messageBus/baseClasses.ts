import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'

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

// MoveAsset request type for internal API calls
export type MoveAssetRequest = {
    type: 'moveAsset';
    assetId: string;
    fromZone: string;
    toZone: string;
    player?: string;
    subFolder?: string;
}

// Internal message type for direct API calls (never serialized/deserialized)
export type WMLInternalMessage = MoveAssetRequest

// Type guard for MoveAssetRequest
export const isMoveAssetRequest = (message: any): message is MoveAssetRequest => {
    return message && 
           typeof message === 'object' && 
           typeof message.assetId === 'string' &&
           typeof message.fromZone === 'string' &&
           typeof message.toZone === 'string'
           typeof message.type === 'string' &&
           message.type === 'moveAsset'
}

// Type guard for internal WML messages
export const isWMLInternalMessage = (message: any): message is WMLInternalMessage => {
    return message && 
           typeof message === 'object' && 
           isMoveAssetRequest(message)
}

// Constrained to only the internal events that WML dataSource actually subscribes to
export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: 'internal';
    event: {
        streamKey: string;
        update: WMLInternalMessage;
    };
    timestamp: number;
}

export type MessageType = ReturnValueMessage |
    ErrorMessage |
    StreamingEventMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isErrorMessage = (prop: MessageType): prop is ErrorMessage => (prop.type === 'Error')
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')

export class MessageBus extends InternalMessageBus<MessageType> {}
