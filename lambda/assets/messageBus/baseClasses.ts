import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type FetchLibraryMessage = {
    type: 'FetchLibrary';
}

export type FetchImportDefaultsMessage = {
    type: 'FetchImportDefaults';
    assetId: `ASSET#${string}`;
    keys: string[];
}

export type FetchAssetMessage = {
    type: 'FetchAsset';
    AssetId?: string;
    fileName?: string;
}

export type UploadURLMessage = {
    type: 'UploadURL';
}

export type ParseWMLMessage = {
    type: 'ParseWML';
    uploadName: string;
} & AssetWorkspaceAddress

export type UploadImageURLMessage = {
    type: 'UploadImageURL';
    fileExtension: string;
    tag: 'Character' | 'Map';
    uploadRequestId: string;
}

export type FormatImageMessage = {
    type: 'FormatImage';
    fileName: string;
    width: number;
    height: number;
    AssetId: string;
    imageKey: string;
}

export type MoveAssetMessage = {
    type: 'MoveAsset';
    from: AssetWorkspaceAddress;
    to: AssetWorkspaceAddress;
}

export type MoveByAssetIdMessage = {
    type: 'MoveByAssetId',
    AssetId: string;
    toZone: 'Canon' | 'Library' | 'Personal';
    player?: string;
}

export type LibrarySubscribeMessage = {
    type: 'LibrarySubscribe';
}

export type PlayerLibraryUpdateMessage = {
    type: 'PlayerLibraryUpdate';
    player?: string;
}

export type LibraryUpdateMessage = {
    type: 'LibraryUpdate';
}

export type MessageType = ReturnValueMessage |
    FetchLibraryMessage |
    FetchImportDefaultsMessage |
    FetchAssetMessage |
    UploadURLMessage |
    UploadImageURLMessage |
    FormatImageMessage |
    ParseWMLMessage |
    MoveAssetMessage |
    MoveByAssetIdMessage |
    LibrarySubscribeMessage |
    PlayerLibraryUpdateMessage |
    LibraryUpdateMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isFetchLibraryAPIMessage = (prop: MessageType): prop is FetchLibraryMessage => (prop.type === 'FetchLibrary')
export const isFetchAssetAPIMessage = (prop: MessageType): prop is FetchAssetMessage => (prop.type === 'FetchAsset')
export const isUploadURLMessage = (prop: MessageType): prop is UploadURLMessage => (prop.type === 'UploadURL')
export const isUploadImageURLMessage = (prop: MessageType): prop is UploadImageURLMessage => (prop.type === 'UploadImageURL')
export const isFormatImageMessage = (prop: MessageType): prop is FormatImageMessage => (prop.type === 'FormatImage')
export const isParseWMLMessage = (prop: MessageType): prop is ParseWMLMessage => (prop.type === 'ParseWML')
export const isMoveAssetMessage = (prop: MessageType): prop is MoveAssetMessage => (prop.type === 'MoveAsset')
export const isMoveByAssetIdMessage = (prop: MessageType): prop is MoveByAssetIdMessage => (prop.type === 'MoveByAssetId')
export const isLibrarySubscribeMessage = (prop: MessageType): prop is LibrarySubscribeMessage => (prop.type === 'LibrarySubscribe')
export const isPlayerLibraryUpdateMessage = (prop: MessageType): prop is PlayerLibraryUpdateMessage => (prop.type === 'PlayerLibraryUpdate')
export const isLibraryUpdateMessage = (prop: MessageType): prop is LibraryUpdateMessage => (prop.type === 'LibraryUpdate')

export class MessageBus extends InternalMessageBus<MessageType> {}
