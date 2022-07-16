export type FetchLibraryAPIMessage = {
    message: 'fetchLibrary';
}

export type FetchAssetAPIMessage = {
    message: 'fetch';
    AssetId: string;
    fileName: string;
}

export type UploadAssetLinkAPIMessage = {
    message: 'upload';
    uploadRequestId: string;
    tag: 'Asset' | 'Character';
    fileName: string;
}

export type UploadImageLinkAPIMessage = {
    message: 'uploadImage';
    uploadRequestId: string;
    tag: 'Image';
    fileExtension: string;
}

export type AssetAPIMessage = { RequestId?: string } & (
    FetchLibraryAPIMessage |
    FetchAssetAPIMessage |
    UploadAssetLinkAPIMessage |
    UploadImageLinkAPIMessage
)

export const isFetchLibraryAPIMessage = (message: AssetAPIMessage): message is FetchLibraryAPIMessage => (message.message === 'fetchLibrary')
export const isFetchAssetAPIMessage = (message: AssetAPIMessage): message is FetchAssetAPIMessage => (message.message === 'fetch')
export const isUploadAssetLinkAPIMessage = (message: AssetAPIMessage): message is UploadAssetLinkAPIMessage => (message.message === 'upload')
export const isUploadImageLinkAPIMessage = (message: AssetAPIMessage): message is UploadImageLinkAPIMessage => (message.message === 'uploadImage')
