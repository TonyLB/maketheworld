import { PlayerLibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const playerLibraryUpdateMessage = async ({ payloads, messageBus }: { payloads: PlayerLibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ player }) => {
        const derivedPlayer = player || await internalCache.Connection.get("player")
        if (derivedPlayer) {
            const { Characters, Assets } = await internalCache.PlayerLibrary.get(derivedPlayer)
            //
            // TODO: Replace ReturnValue (which depends upon the update going to the calling connection)
            // with publishing to the (possibly many) connections for the player
            //
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'PlayerLibrary',
                    Characters,
                    Assets
                }
            })
        }
    }))
}

export default playerLibraryUpdateMessage
