import {
    MessageBus,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"
import fetchAssetMessage from "../fetch"

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

export default messageBus