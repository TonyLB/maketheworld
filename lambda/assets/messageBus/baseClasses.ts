import { InternalMessageBus } from '@tonylb/mtw-lambda-patterns/ts/messageBus'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { AssetPlayerSettingsAPIMessage } from '@tonylb/mtw-interfaces/ts/asset';
import { ComponentUUID } from '@tonylb/mtw-base/ts/schema';

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type FetchLibraryMessage = {
    type: 'FetchLibrary';
}

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

export type MoveAssetMessage = {
    type: 'MoveAsset';
    AssetId: string;
    from: AssetWorkspaceAddress;
    to: AssetWorkspaceAddress;
}

export type MoveByAssetIdMessage = {
    type: 'MoveByAssetId',
    AssetId: string;
    toZone: 'Canon' | 'Library' | 'Personal' | 'Archive';
    player?: string;
    backupId?: `BACKUP#${string}`;
}

export type LibrarySubscribeMessage = {
    type: 'LibrarySubscribe';
}

export type LibraryUnsubscribeMessage = {
    type: 'LibraryUnsubscribe';
}

export type PlayerInfoMessage = {
    type: 'PlayerInfo';
    player?: string;
    sessionId?: string;
    RequestId?: string;
}

export type PlayerSettingsMessage = {
    type: 'PlayerSettings';
    player?: string;
    RequestId?: string;
} & Omit<AssetPlayerSettingsAPIMessage, 'message'>

export type LibraryUpdateMessage = {
    type: 'LibraryUpdate';
}

export type RemoveAssetMessage = {
    type: 'RemoveAsset';
    assetId: string;
}

export type CacheAssetMessage = {
    type: 'CacheAsset';
    assetId: string;
}

export type DecacheAssetMessage = {
    type: 'DecacheAsset';
    assetId: string;
}

export type CollaborationStatusMessage = {
    type: 'CollaborationStatus';
    RequestId?: string;
}

export type MessageType = ReturnValueMessage |
    FetchLibraryMessage |
    FetchImportsMessage |
    FetchAssetMessage |
    UploadURLMessage |
    MoveAssetMessage |
    MoveByAssetIdMessage |
    LibrarySubscribeMessage |
    LibraryUnsubscribeMessage |
    PlayerInfoMessage |
    PlayerSettingsMessage |
    LibraryUpdateMessage |
    RemoveAssetMessage |
    CacheAssetMessage |
    DecacheAssetMessage |
    CollaborationStatusMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isFetchLibraryAPIMessage = (prop: MessageType): prop is FetchLibraryMessage => (prop.type === 'FetchLibrary')
export const isFetchAssetAPIMessage = (prop: MessageType): prop is FetchAssetMessage => (prop.type === 'FetchAsset')
export const isFetchImportsAPIMessage = (prop: MessageType): prop is FetchImportsMessage => (prop.type === 'FetchImports')
export const isUploadURLMessage = (prop: MessageType): prop is UploadURLMessage => (prop.type === 'UploadURL')
export const isMoveAssetMessage = (prop: MessageType): prop is MoveAssetMessage => (prop.type === 'MoveAsset')
export const isMoveByAssetIdMessage = (prop: MessageType): prop is MoveByAssetIdMessage => (prop.type === 'MoveByAssetId')
export const isLibrarySubscribeMessage = (prop: MessageType): prop is LibrarySubscribeMessage => (prop.type === 'LibrarySubscribe')
export const isLibraryUnsubscribeMessage = (prop: MessageType): prop is LibraryUnsubscribeMessage => (prop.type === 'LibraryUnsubscribe')
export const isPlayerInfoMessage = (prop: MessageType): prop is PlayerInfoMessage => (prop.type === 'PlayerInfo')
export const isPlayerSettingMessage = (prop: MessageType): prop is PlayerSettingsMessage => (prop.type === 'PlayerSettings')
export const isLibraryUpdateMessage = (prop: MessageType): prop is LibraryUpdateMessage => (prop.type === 'LibraryUpdate')
export const isRemoveAssetMessage = (prop: MessageType): prop is RemoveAssetMessage => (prop.type === 'RemoveAsset')
export const isCacheAssetMessage = (prop: MessageType): prop is CacheAssetMessage => (prop.type === 'CacheAsset')
export const isDecacheAssetMessage = (prop: MessageType): prop is DecacheAssetMessage => (prop.type === 'DecacheAsset')
export const isCollaborationStatusMessage = (prop: MessageType): prop is CollaborationStatusMessage => (prop.type === 'CollaborationStatus')

export class MessageBus extends InternalMessageBus<MessageType> {}
