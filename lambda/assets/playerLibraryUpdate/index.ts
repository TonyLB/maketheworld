import { apiClient } from "../clients"
import { PlayerLibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

//
// TODO: Add storage layer for onboarding settings: ISS2387
//
//   - Rename playerLibraryUpdate to "PlayerInfoMessage"
//   - Create playerUpdateMessage message that accepts incoming changes (so far, add or remove completed onboarding tags)
//   - Create message handler to update player in Assets table and trigger PlayerInfoMessage broadcast
//   - SettingsByPlayer to internalCache
//   - Lookup info from SettingsByPlayer here, and include it in the PlayerInfoMessage
//
export const playerLibraryUpdateMessage = async ({ payloads, messageBus }: { payloads: PlayerLibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.ConnectionsByPlayer.clear()
    await Promise.all(payloads.map(async ({ player, RequestId }) => {
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
                            PlayerName: derivedPlayer,
                            RequestId
                        })
                    })
                )))
            }
        }
    }))
}

export default playerLibraryUpdateMessage
