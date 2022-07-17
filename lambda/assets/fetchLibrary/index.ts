import { FetchLibraryMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const fetchLibraryMessage = async ({ payloads, messageBus }: { payloads: FetchLibraryMessage[], messageBus: MessageBus }): Promise<void> => {
    const Characters = await internalCache.Library.get('Characters')
    const Assets = await internalCache.Library.get('Assets')
    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: 'Library',
            Characters,
            Assets
        }
    })
}

export default fetchLibraryMessage
