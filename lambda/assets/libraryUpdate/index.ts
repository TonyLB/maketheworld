import { snsClient } from "../clients"
import { LibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env

export const libraryUpdateMessage = async ({ payloads, messageBus }: { payloads: LibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.Library.clear()
    const [Characters, Assets, ConnectionIds] = await Promise.all([
        internalCache.Library.get('Characters'),
        internalCache.Library.get('Assets'),
        internalCache.Connection.get('librarySubscriptions').then((sessionIds = []) => (internalCache.SessionConnections.get(sessionIds)))
    ])
    await Promise.all((ConnectionIds || []).map((ConnectionId) => (
        snsClient.send(new PublishCommand({
            TopicArn: FEEDBACK_TOPIC,
            Message: JSON.stringify({
                messageType: 'Library',
                Characters: Object.values(Characters),
                Assets: Object.values(Assets)
            }),
            MessageAttributes: {
                ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                Type: { DataType: 'String', StringValue: 'Success' }
            }
        }))
    )))
}

export default libraryUpdateMessage
