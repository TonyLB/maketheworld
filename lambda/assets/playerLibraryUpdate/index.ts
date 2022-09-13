import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'
import { PlayerLibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const playerLibraryUpdateMessage = async ({ payloads, messageBus }: { payloads: PlayerLibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.ConnectionsByPlayer.clear()
    await Promise.all(payloads.map(async ({ player }) => {
        const derivedPlayer = player || await internalCache.Connection.get("player")
        if (derivedPlayer) {
            const connections = await internalCache.ConnectionsByPlayer.get(derivedPlayer)
            if (connections.length > 0) {
                const { Characters, Assets } = await internalCache.PlayerLibrary.get(derivedPlayer)
                await Promise.all(connections.map((ConnectionId) => (
                    apiClient.send({
                        ConnectionId,
                        Data: JSON.stringify({
                            messageType: 'Player',
                            Characters: Object.values(Characters),
                            Assets: Object.values(Assets),
                            PlayerName: derivedPlayer
                        })
                    })
                )))
            }
        }
    }))
}

export default playerLibraryUpdateMessage
