import { PlayerLibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const playerLibraryUpdateMessage = async ({ payloads, messageBus }: { payloads: PlayerLibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    // const Characters = await internalCache.Library.get('Characters')
    // const Assets = await internalCache.Library.get('Assets')
    // messageBus.send({
    //     type: 'ReturnValue',
    //     body: {
    //         messageType: 'Library',
    //         Characters,
    //         Assets
    //     }
    // })
}

export default playerLibraryUpdateMessage
