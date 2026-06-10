import { MessageBus } from "../messageBus/baseClasses"
import { getCollectedError, getCollectedReturnValueBody } from "./collector"

export const extractReturnValue = (_messageBus: MessageBus) => {
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

    return collectedBody as Record<string, any>
}
