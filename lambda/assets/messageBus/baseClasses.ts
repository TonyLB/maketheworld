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

export type UploadResponseMessage = {
    type: 'UploadResponse';
    uploadId: string;
    messageType: 'Success' | 'Error';
}

export type MessageType = ReturnValueMessage |
    FetchLibraryMessage |
    FetchAssetMessage |
    UploadResponseMessage

export const isReturnValueMessage = (prop: MessageType): prop is ReturnValueMessage => (prop.type === 'ReturnValue')
export const isFetchLibraryAPIMessage = (prop: MessageType): prop is FetchLibraryMessage => (prop.type === 'FetchLibrary')
export const isFetchAssetAPIMessage = (prop: MessageType): prop is FetchAssetMessage => (prop.type === 'FetchAsset')
export const isUploadResponseMessage = (prop: MessageType): prop is UploadResponseMessage => (prop.type === 'UploadResponse')

export class MessageBus extends InternalMessageBus<MessageType> {}
