import { InternalMessageBus } from '@tonylb/mtw-internal-bus/dist'

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
    fromPath: string;
    fileName: string;
    toPath: string;
}

export type MoveByAssetIdMessage = {
    type: 'MoveByAssetId',
    AssetId: string;
    toPath: string;
}

export type MessageType = ReturnValueMessage |
    FetchLibraryMessage |
    FetchAssetMessage |
    UploadURLMessage |
    UploadImageURLMessage |
    UploadResponseMessage |
    MoveAssetMessage |
    MoveByAssetIdMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isFetchLibraryAPIMessage = (prop: MessageType): prop is FetchLibraryMessage => (prop.type === 'FetchLibrary')
export const isFetchAssetAPIMessage = (prop: MessageType): prop is FetchAssetMessage => (prop.type === 'FetchAsset')
export const isUploadURLMessage = (prop: MessageType): prop is UploadURLMessage => (prop.type === 'UploadURL')
export const isUploadImageURLMessage = (prop: MessageType): prop is UploadImageURLMessage => (prop.type === 'UploadImageURL')
export const isUploadResponseMessage = (prop: MessageType): prop is UploadResponseMessage => (prop.type === 'UploadResponse')
export const isMoveAssetMessage = (prop: MessageType): prop is MoveAssetMessage => (prop.type === 'MoveAsset')
export const isMoveByAssetIdMessage = (prop: MessageType): prop is MoveByAssetIdMessage => (prop.type === 'MoveByAssetId')

export class MessageBus extends InternalMessageBus<MessageType> {}
