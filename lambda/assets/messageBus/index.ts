import {
    MessageBus,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadURLMessage,
    isMoveAssetMessage,
    isMoveByAssetIdMessage,
    isLibrarySubscribeMessage,
    isParseWMLMessage,
    isPlayerInfoMessage,
    isLibraryUpdateMessage,
    isFormatImageMessage,
    isFetchImportsAPIMessage,
    isLibraryUnsubscribeMessage,
    isPlayerSettingMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"
import fetchAssetMessage from "../fetch"
import { uploadURLMessage, parseWMLMessage } from "../upload"
import { moveAssetByIdMessage, moveAssetMessage } from "../moveAsset"
import { librarySubscribeMessage, libraryUnsubscribeMessage } from "../subscribe"
import playerInfoMessage from "../player/info"
import libraryUpdateMessage from "../libraryUpdate"
import formatImageMessage from "../formatImage"
import { fetchImportsMessage } from "../fetchImportDefaults"
import playerSettingMessage from "../player/update"

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
    tag: 'LibraryUnubscribe',
    priority: 5,
    filter: isLibraryUnsubscribeMessage,
    callback: libraryUnsubscribeMessage
})
messageBus.subscribe({
    tag: 'PlayerInfo',
    priority: 6,
    filter: isPlayerInfoMessage,
    callback: playerInfoMessage
})
messageBus.subscribe({
    tag: 'PlayerSettings',
    priority: 5,
    filter: isPlayerSettingMessage,
    callback: playerSettingMessage
})
messageBus.subscribe({
    tag: 'LibraryUpdate',
    priority: 6,
    filter: isLibraryUpdateMessage,
    callback: libraryUpdateMessage
})

export default messageBus