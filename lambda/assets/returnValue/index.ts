import { ReturnValueMessage, ErrorMessage, isReturnValueMessage, isErrorMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
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

export const extractReturnValue = async (messageBus: MessageBus) => {
    const RequestId = await internalCache.Connection.get('RequestId')
    
    // Check for error messages first
    const errorMessages = messageBus._stream
        .map(({ payload }) => (payload))
        .filter(isErrorMessage)

    if (errorMessages.length > 0) {
        // Return the first error with appropriate status code
        const error = errorMessages[0]
        const statusCode = error.body.statusCode || 400 // Default to 400 Bad Request
        return {
            statusCode,
            body: JSON.stringify({ 
                error: error.body.error,
                RequestId 
            })
        }
    }

    // If no errors, process return value messages
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
