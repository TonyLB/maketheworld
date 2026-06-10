import { ReturnValueMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'
import { getCollectedReturnValueBody } from './collector'

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

export const extractReturnValue = (_messageBus?: MessageBus) => {
    const body = getCollectedReturnValueBody()

    return {
        statusCode: 200,
        body: JSON.stringify(body)
    }
}
