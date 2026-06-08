import { MessageBus, isErrorMessage, isReturnValueMessage } from "../messageBus/baseClasses"

const isRestApiGatewayResponse = (body: Record<string, any>): boolean => (
    typeof body.statusCode === 'number' && typeof body.body === 'string'
)

/** WebSocket service routes (e.g. `connections`) require `{ statusCode, body }` for route-response integration. */
const isWebSocketServiceRoute = (event: any): boolean => {
    const { routeKey, resourcePath } = event?.requestContext || {}
    return (
        typeof routeKey === 'string' &&
        routeKey !== '$disconnect' &&
        typeof resourcePath !== 'string'
    )
}

export const extractReturnValue = (messageBus: MessageBus, event?: any) => {
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

    const body = returnValueMessages.reduce((previous, { body: messageBody }) => ({
        ...previous,
        ...messageBody
    }), {} as Record<string, any>)

    if (isRestApiGatewayResponse(body)) {
        return body
    }

    if (isWebSocketServiceRoute(event)) {
        return {
            statusCode: 200,
            body: JSON.stringify(body)
        }
    }

    return body
}
