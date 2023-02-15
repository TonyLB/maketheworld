import {
    MessageBus,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadURLMessage,
    isMoveAssetMessage,
    isMoveByAssetIdMessage,
    isLibrarySubscribeMessage,
    isParseWMLMessage,
    isPlayerLibraryUpdateMessage,
    isLibraryUpdateMessage,
    isFormatImageMessage,
    isFetchImportsAPIMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"
import fetchAssetMessage from "../fetch"
import { uploadURLMessage, parseWMLMessage } from "../upload"
import { moveAssetByIdMessage, moveAssetMessage } from "../moveAsset"
import { librarySubscribeMessage } from "../subscribe"
import playerLibraryUpdateMessage from "../playerLibraryUpdate"
import libraryUpdateMessage from "../libraryUpdate"
import formatImageMessage from "../formatImage"
import { fetchImportsMessage } from "../fetchImportDefaults"

export const messageBus = new MessageBus()

messageBus.subscribe({
    tag: 'MoveByAssetId',
    priority: 3,
    filter: isMoveByAssetIdMessage,
    callback: moveAssetByIdMessage
})
messageBus.subscribe({
    tag: 'FetchLibrary',
    priority: 5,
    filter: isFetchLibraryAPIMessage,
    callback: fetchLibraryMessage
})
messageBus.subscribe({
    tag: 'FetchImports',
    priority: 5,
    filter: isFetchImportsAPIMessage,
    callback: fetchImportsMessage
})
messageBus.subscribe({
    tag: 'FetchAsset',
    priority: 5,
    filter: isFetchAssetAPIMessage,
    callback: fetchAssetMessage
})
messageBus.subscribe({
    tag: 'UploadURL',
    priority: 5,
    filter: isUploadURLMessage,
    callback: uploadURLMessage
})
messageBus.subscribe({
    tag: 'FormatImage',
    priority: 10,
    filter: isFormatImageMessage,
    callback: formatImageMessage
})
messageBus.subscribe({
    tag: 'ParseWML',
    priority: 5,
    filter: isParseWMLMessage,
    callback: parseWMLMessage
})
messageBus.subscribe({
    tag: 'MoveAsset',
    priority: 5,
    filter: isMoveAssetMessage,
    callback: moveAssetMessage
})
messageBus.subscribe({
    tag: 'LibrarySubscribe',
    priority: 5,
    filter: isLibrarySubscribeMessage,
    callback: librarySubscribeMessage
})
messageBus.subscribe({
    tag: 'PlayerLibraryUpdate',
    priority: 6,
    filter: isPlayerLibraryUpdateMessage,
    callback: playerLibraryUpdateMessage
})
messageBus.subscribe({
    tag: 'LibraryUpdate',
    priority: 6,
    filter: isLibraryUpdateMessage,
    callback: libraryUpdateMessage
})


export default messageBus