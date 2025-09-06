import { snsClient } from "../clients"
import { CollaborationStatusMessage, MessageBus } from "../messageBus/baseClasses"
import { PublishCommand } from "@aws-sdk/client-sns"
import { ConnectionKey } from "@tonylb/mtw-utilities/ts/types"
import internalCache from '../internalCache'

const { FEEDBACK_TOPIC } = process.env

/**
 * Message handler for collaboration status requests.
 * Returns a stub implementation with Bootstrap phase status.
 */
export const collaborationStatusMessage = async ({ 
    payloads, 
    messageBus 
}: { 
    payloads: CollaborationStatusMessage[], 
    messageBus: MessageBus 
}): Promise<void> => {
    const ConnectionId = await internalCache.Connection.get('connectionId')
    const RequestId = await internalCache.Connection.get('RequestId')

    if (ConnectionId) {
        // For now, return a simple Bootstrap status
        const status = {
            phase: 'Bootstrap' as const
        }

        await Promise.all(payloads.map((payload) => (
            snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({
                    messageType: 'CollaborationStatus',
                    status
                }),
                MessageAttributes: {
                    RequestId: { DataType: 'String', StringValue: RequestId || '' },
                    Targets: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionKey(ConnectionId)]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        )))
    }
}

export default collaborationStatusMessage
