import { snsClient } from "../clients"
import { PlayerInfoMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env

export const playerInfoMessage = async ({ payloads, messageBus }: { payloads: PlayerInfoMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.PlayerSessions.clear()
    await Promise.all(payloads.map(async ({ player, sessionId, RequestId }) => {
        const derivedPlayer = player || await internalCache.Connection.get("player")
        const derivedSessionId = sessionId || await internalCache.Connection.get("sessionId")
        if (derivedPlayer && derivedSessionId) {
            const [connections = [], settings, { Characters, Assets, draftURL }] = await Promise.all([
                internalCache.PlayerSessions.get(derivedPlayer).then((sessions) => (internalCache.SessionConnections.get(sessions ?? []))),
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
                            draftURL,
                            Settings: settings,
                            PlayerName: derivedPlayer,
                            SessionId: derivedSessionId
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
