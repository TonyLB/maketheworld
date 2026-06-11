import { ReturnValueMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'
import { getCollectedError, getCollectedReturnValueBody } from './collector'

export const returnValueMessage = async ({ payloads }: { payloads: ReturnValueMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Global.get('ConnectionId')

    await Promise.all(payloads.map(async (payload) => (
        apiClient.send({
            ConnectionId,
            Data: JSON.stringify(payload.body)
        })
    )))
}

export default returnValueMessage

export const extractReturnValue = async (_messageBus?: MessageBus) => {
    const collectedError = getCollectedError()
    if (collectedError !== undefined) {
        const RequestId = await internalCache.Global.get('RequestId')
        return {
            statusCode: collectedError.statusCode || 400,
            body: JSON.stringify({
                error: collectedError.error,
                ...(RequestId ? { RequestId } : {}),
            }),
        }
    }

    const body = getCollectedReturnValueBody()

    return {
        statusCode: 200,
        body: JSON.stringify(body)
    }
}
