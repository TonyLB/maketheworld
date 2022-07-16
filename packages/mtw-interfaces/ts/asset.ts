export type FetchLibraryAPIMessage = {
    message: 'fetchLibrary';
}

export type AssetAPIMessage = { RequestId?: string } & (
    FetchLibraryAPIMessage
)

export const isFetchLibraryAPIMessage = (message: AssetAPIMessage): message is FetchLibraryAPIMessage => (message.message === 'fetchLibrary')
