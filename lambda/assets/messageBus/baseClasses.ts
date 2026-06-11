import {
    InternalMessageBus,
    type ReturnValueMessage,
    type ErrorMessage,
    isReturnValueMessage,
    isErrorMessage,
} from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { AssetPlayerSettingsAPIMessage } from '@tonylb/mtw-interfaces/ts/asset';
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema';

export type { ReturnValueMessage, ErrorMessage }

type ImportFromAssetArgument = {
    assetId: `ASSET#${string}`;
    keys: ComponentUUID[];
}

export type FetchImportsMessage = {
    type: 'FetchImports';
    importsFromAsset: ImportFromAssetArgument[];
}

export type FetchAssetMessage = {
    type: 'FetchAsset';
    AssetId?: string;
    fileName?: string;
}

type UploadURLMessageImage = {
    key: string;
    contentType: string;
}

export type UploadURLMessage = {
    type: 'UploadURL';
    assetType: 'Character' | 'Asset';
    images: UploadURLMessageImage[];
}

// Legacy PlayerInfoMessage removed - player data now flows through mtw.assets.players data source

export type PlayerSettingsMessage = {
    type: 'PlayerSettings';
    player?: string;
    RequestId?: string;
} & Omit<AssetPlayerSettingsAPIMessage, 'message'>

export type CollaborationStatusMessage = {
    type: 'CollaborationStatus';
    RequestId?: string;
}

export type StreamingEventMessage = {
    type: 'StreamingEvent';
    dataSourceKey: string;
    streamKey: string;
    header: StreamingEventHeader;
    timestamp: number;
    getContent: (format?: 'internal' | 'external') => Promise<unknown>;
}

export type MessageType = ReturnValueMessage |
    ErrorMessage |
    StreamingEventMessage |
    FetchImportsMessage |
    FetchAssetMessage |
    UploadURLMessage |
    PlayerSettingsMessage |
    CollaborationStatusMessage

export { isReturnValueMessage, isErrorMessage }
export const isStreamingEventMessage = (prop: MessageType): prop is StreamingEventMessage => (prop.type === 'StreamingEvent')
export const isFetchAssetAPIMessage = (prop: MessageType): prop is FetchAssetMessage => (prop.type === 'FetchAsset')
export const isFetchImportsAPIMessage = (prop: MessageType): prop is FetchImportsMessage => (prop.type === 'FetchImports')
export const isUploadURLMessage = (prop: MessageType): prop is UploadURLMessage => (prop.type === 'UploadURL')
// Legacy isPlayerInfoMessage removed - player data now flows through mtw.assets.players data source
export const isPlayerSettingMessage = (prop: MessageType): prop is PlayerSettingsMessage => (prop.type === 'PlayerSettings')
export const isCollaborationStatusMessage = (prop: MessageType): prop is CollaborationStatusMessage => (prop.type === 'CollaborationStatus')

export class MessageBus extends InternalMessageBus<MessageType> {}
