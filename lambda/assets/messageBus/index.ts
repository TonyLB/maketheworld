import {
    MessageBus,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadURLMessage,
    isLibrarySubscribeMessage,
    isPlayerInfoMessage,
    isLibraryUpdateMessage,
    isFetchImportsAPIMessage,
    isLibraryUnsubscribeMessage,
    isPlayerSettingMessage,
    isReturnValueMessage,
    isCollaborationStatusMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"
import fetchAssetMessage from "../fetch"
import { uploadURLMessage } from "../upload"
import { librarySubscribeMessage, libraryUnsubscribeMessage } from "../subscribe"
import playerInfoMessage from "../player/info"
import libraryUpdateMessage from "../libraryUpdate"
import { fetchImportsMessage } from "../fetchImportDefaults"
import playerSettingMessage from "../player/update"
import returnValueMessage from "../returnValue"
import collaborationStatusMessage from "../collaborationStatus"

export const messageBus = new MessageBus()

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
    tag: 'LibrarySubscribe',
    priority: 5,
    filter: isLibrarySubscribeMessage,
    callback: librarySubscribeMessage
})
messageBus.subscribe({
    tag: 'LibraryUnsubscribe',
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
messageBus.subscribe({
    tag: 'ReturnValue',
    priority: 9,
    filter: isReturnValueMessage,
    callback: returnValueMessage
})
messageBus.subscribe({
    tag: 'CollaborationStatus',
    priority: 5,
    filter: isCollaborationStatusMessage,
    callback: collaborationStatusMessage
})

export default messageBus