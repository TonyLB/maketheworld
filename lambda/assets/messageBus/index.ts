import {
    MessageBus,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadURLMessage,
    isUploadImageURLMessage,
    isMoveAssetMessage,
    isMoveByAssetIdMessage,
    isLibrarySubscribeMessage,
    isParseWMLMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"
import fetchAssetMessage from "../fetch"
import { uploadURLMessage, uploadImageURLMessage, parseWMLMessage } from "../upload"
import { moveAssetByIdMessage, moveAssetMessage } from "../moveAsset"
import { librarySubscribeMessage } from "../subscribe"

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
    tag: 'UploadImageURL',
    priority: 5,
    filter: isUploadImageURLMessage,
    callback: uploadImageURLMessage
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

export default messageBus