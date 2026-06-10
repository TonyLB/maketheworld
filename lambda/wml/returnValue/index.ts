import { ReturnValueMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { getCollectedError, getCollectedReturnValueBody } from './collector'

export const returnValueMessage = async ({ payloads }: { payloads: ReturnValueMessage[], messageBus?: MessageBus }): Promise<void> => {
    // ReturnValue messages are handled by the messageBus infrastructure
    // No additional processing needed for WML lambda
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
