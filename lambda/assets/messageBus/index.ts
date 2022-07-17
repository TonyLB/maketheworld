import {
    MessageBus,
    isFetchLibraryAPIMessage
} from "./baseClasses"
import fetchLibraryMessage from "../fetchLibrary"

export const messageBus = new MessageBus()

messageBus.subscribe({
    tag: 'FetchLibrary',
    priority: 5,
    filter: isFetchLibraryAPIMessage,
    callback: fetchLibraryMessage
})

export default messageBus