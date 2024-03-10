import { ReturnValueMessage, isReturnValueMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { PublishCommand } from "@aws-sdk/client-sns"
import { snsClient } from "../clients"

const { FEEDBACK_TOPIC } = process.env

export const returnValueMessage = async ({ payloads }: { payloads: ReturnValueMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Connection.get('connectionId')
    const RequestId = await internalCache.Connection.get('RequestId')

    await Promise.all(payloads.map((payload) => (
        snsClient.send(new PublishCommand({
            TopicArn: FEEDBACK_TOPIC,
            Message: JSON.stringify(payload.body),
            MessageAttributes: {
                RequestId: { DataType: 'String', StringValue: RequestId },
                ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                Type: { DataType: 'String', StringValue: 'Success' }
            }
        }))
    )))
}

export default returnValueMessage

export const extractReturnValue = async (messageBus: MessageBus) => {
    const RequestId = await internalCache.Connection.get('RequestId')
    const returnValueMessages = messageBus._stream
        .map(({ payload }) => (payload))
        .filter(isReturnValueMessage)

    const body = returnValueMessages.reduce((previous, { body }) => ({
        ...previous,
        ...body
    }), { RequestId } as Record<string, any>)

    return {
        statusCode: 200,
        body: JSON.stringify(body)
    }
}
