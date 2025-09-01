import { snsClient } from "../clients"
import { LibraryUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { PublishCommand } from "@aws-sdk/client-sns"
import { SessionKey } from '@tonylb/mtw-utilities/ts/types'

const { FEEDBACK_TOPIC } = process.env

export const libraryUpdateMessage = async ({ payloads, messageBus }: { payloads: LibraryUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    internalCache.Library.clear()
    const [Characters, Assets, sessionIds] = await Promise.all([
        internalCache.Library.get('Characters'),
        internalCache.Library.get('Assets'),
        internalCache.Connection.get('librarySubscriptions')
    ])
    
    if (sessionIds && sessionIds.length > 0) {
        // Send single SNS message with SESSION targets - let feedback lambda handle fan-out
        await snsClient.send(new PublishCommand({
            TopicArn: FEEDBACK_TOPIC,
            Message: JSON.stringify({
                messageType: 'Library',
                Characters: Object.values(Characters),
                Assets: Object.values(Assets)
            }),
            MessageAttributes: {
                Targets: { DataType: 'String.Array', StringValue: JSON.stringify(sessionIds.map(SessionKey)) },
                Type: { DataType: 'String', StringValue: 'Success' }
            }
        }))
    }
}

export default libraryUpdateMessage
