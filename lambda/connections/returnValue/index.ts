import { MessageBus, isErrorMessage, isReturnValueMessage } from "../messageBus/baseClasses"

export const extractReturnValue = (messageBus: MessageBus) => {
    const errorMessages = messageBus._stream
        .map(({ payload }) => (payload))
        .filter(isErrorMessage)

    if (errorMessages.length > 0) {
        const error = errorMessages[0]
        return {
            statusCode: error.body.statusCode || 400,
            body: JSON.stringify({
                error: error.body.error
            })
        }
    }

    const returnValueMessages = messageBus._stream
        .map(({ payload }) => (payload))
        .filter(isReturnValueMessage)

    if (returnValueMessages.length === 0) {
        return
    }

    return returnValueMessages.reduce((previous, { body }) => ({
        ...previous,
        ...body
    }), {} as Record<string, any>)
}
