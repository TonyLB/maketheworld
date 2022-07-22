import {
    MessageBus,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadURLMessage,
    isUploadResponseMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"
import fetchAssetMessage from "../fetch"
import { uploadResponseMessage } from "../upload/uploadResponse"
import { uploadURLMessage } from "../upload"

export const messageBus = new MessageBus()

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
    tag: 'UploadResponse',
    priority: 8,
    filter: isUploadResponseMessage,
    callback: uploadResponseMessage
})

export default messageBus