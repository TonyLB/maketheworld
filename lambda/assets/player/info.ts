import { apiClient } from "../clients"
import { PlayerInfoMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

//
// TODO: Add storage layer for onboarding settings: ISS2387
//
//   - Lookup info from SettingsByPlayer here, and include it in the PlayerInfoMessage
//   - Create playerUpdateMessage message that accepts incoming changes (so far, add or remove completed onboarding tags)
//   - Create message handler to update player in Assets table and trigger PlayerInfoMessage broadcast
//

export const playerInfoMessage = async ({ payloads, messageBus }: { payloads: PlayerInfoMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.ConnectionsByPlayer.clear()
    await Promise.all(payloads.map(async ({ player, RequestId }) => {
        const derivedPlayer = player || await internalCache.Connection.get("player")
        if (derivedPlayer) {
            const [connections, settings, { Characters, Assets }] = await Promise.all([
                internalCache.ConnectionsByPlayer.get(derivedPlayer),
                internalCache.PlayerSettings.get(derivedPlayer),
                internalCache.PlayerLibrary.get(derivedPlayer)
            ])
            if (connections.length > 0) {
                await Promise.all(connections.map((ConnectionId) => (
                    apiClient.send({
                        ConnectionId,
                        Data: JSON.stringify({
                            messageType: 'Player',
                            Characters: Object.values(Characters),
                            Assets: Object.values(Assets),
                            Settings: settings,
                            PlayerName: derivedPlayer,
                            RequestId
                        })
                    })
                )))
            }
        }
    }))
}

export default playerInfoMessage
