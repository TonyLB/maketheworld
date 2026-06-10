import { MessageBus } from "../messageBus/baseClasses"
import { getCollectedError, getCollectedReturnValueBody } from "./collector"

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

export const extractReturnValue = (_messageBus: MessageBus, event?: any) => {
    const collectedError = getCollectedError()
    if (collectedError !== undefined) {
        return {
            statusCode: collectedError.statusCode || 400,
            body: JSON.stringify({
                error: collectedError.error
            })
        }
    }

    const collectedBody = getCollectedReturnValueBody()
    if (Object.keys(collectedBody).length === 0) {
        return
    }

    const body = collectedBody as Record<string, any>

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
