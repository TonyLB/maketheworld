import { ReturnValueMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { getCollectedError, getCollectedReturnValueBody } from './collector'
import { PublishCommand } from "@aws-sdk/client-sns"
import { snsClient } from "../clients"
import { ConnectionKey } from '@tonylb/mtw-utilities/ts/types'

const { FEEDBACK_TOPIC } = process.env

export const returnValueMessage = async ({ payloads }: { payloads: ReturnValueMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Connection.get('connectionId')
    const RequestId = await internalCache.Connection.get('RequestId')

    if (ConnectionId) {
        await Promise.all(payloads.map((payload) => (
            snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify(payload.body),
                MessageAttributes: {
                    RequestId: { DataType: 'String', StringValue: RequestId || '' },
                    Targets: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionKey(ConnectionId)]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        )))
    }
}

export default returnValueMessage

export const extractReturnValue = async (_messageBus?: MessageBus) => {
    const RequestId = await internalCache.Connection.get('RequestId')

    const collectedError = getCollectedError()
    if (collectedError !== undefined) {
        const statusCode = collectedError.statusCode || 400
        return {
            statusCode,
            body: JSON.stringify({
                error: collectedError.error,
                RequestId,
            }),
        }
    }

    const collectedBody = getCollectedReturnValueBody()
    if (Object.keys(collectedBody).length === 0) {
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: 'Success', RequestId }),
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ ...collectedBody, RequestId }),
    }
}
