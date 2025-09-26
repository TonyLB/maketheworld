import { ReturnValueMessage, ErrorMessage, isReturnValueMessage, isErrorMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const returnValueMessage = async ({ payloads }: { payloads: ReturnValueMessage[], messageBus?: MessageBus }): Promise<void> => {
    // ReturnValue messages are handled by the messageBus infrastructure
    // No additional processing needed for WML lambda
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

    if (returnValueMessages.length === 0) {
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: 'Success', RequestId })
        }
    }

    const body = returnValueMessages.reduce((previous, { body }) => ({
        ...previous,
        ...body
    }), { RequestId } as Record<string, any>)

    return {
        statusCode: 200,
        body: JSON.stringify(body)
    }
}

