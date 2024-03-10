import { snsClient } from "../clients"
import { PlayerInfoMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env

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
                    snsClient.send(new PublishCommand({
                        TopicArn: FEEDBACK_TOPIC,
                        Message: JSON.stringify({
                            messageType: 'Player',
                            Characters: Object.values(Characters),
                            Assets: Object.values(Assets),
                            Settings: settings,
                            PlayerName: derivedPlayer
                        }),
                        MessageAttributes: {
                            RequestId: { DataType: 'String', StringValue: RequestId },
                            ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                            Type: { DataType: 'String', StringValue: 'Success' }
                        }
                    }))
                )))
            }
        }
    }))
}

export default playerInfoMessage
