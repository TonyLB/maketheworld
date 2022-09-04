import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'

export type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}

export type FetchLibraryMessage = {
    type: 'FetchLibrary';
}

export type FetchAssetMessage = {
    type: 'FetchAsset';
    AssetId?: string;
    fileName?: string;
}

export type UploadURLMessage = {
    type: 'UploadURL';
    fileName: string;
    tag: 'Character' | 'Asset';
    uploadRequestId: string;
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

export type UploadResponseMessage = {
    type: 'UploadResponse';
    uploadId: string;
    messageType: 'Success' | 'Error';
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

type CacheAssetOptions = {
    check?: boolean;
    recursive?: boolean;
    forceCache?: boolean;
}

export type CacheAssetMessage = {
    type: 'CacheAsset';
    address: AssetWorkspaceAddress;
    options: CacheAssetOptions;
}

export type MessageType = ReturnValueMessage |
    FetchLibraryMessage |
    FetchAssetMessage |
    UploadURLMessage |
    UploadImageURLMessage |
    ParseWMLMessage |
    UploadResponseMessage |
    MoveAssetMessage |
    MoveByAssetIdMessage |
    LibrarySubscribeMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isFetchLibraryAPIMessage = (prop: MessageType): prop is FetchLibraryMessage => (prop.type === 'FetchLibrary')
export const isFetchAssetAPIMessage = (prop: MessageType): prop is FetchAssetMessage => (prop.type === 'FetchAsset')
export const isUploadURLMessage = (prop: MessageType): prop is UploadURLMessage => (prop.type === 'UploadURL')
export const isUploadImageURLMessage = (prop: MessageType): prop is UploadImageURLMessage => (prop.type === 'UploadImageURL')
export const isParseWMLMessage = (prop: MessageType): prop is ParseWMLMessage => (prop.type === 'ParseWML')
export const isUploadResponseMessage = (prop: MessageType): prop is UploadResponseMessage => (prop.type === 'UploadResponse')
export const isMoveAssetMessage = (prop: MessageType): prop is MoveAssetMessage => (prop.type === 'MoveAsset')
export const isMoveByAssetIdMessage = (prop: MessageType): prop is MoveByAssetIdMessage => (prop.type === 'MoveByAssetId')
export const isLibrarySubscribeMessage = (prop: MessageType): prop is LibrarySubscribeMessage => (prop.type === 'LibrarySubscribe')

export class MessageBus extends InternalMessageBus<MessageType> {}
