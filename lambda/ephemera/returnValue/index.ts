import { ReturnValueMessage, isReturnValueMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

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

export const extractReturnValue = (messageBus: MessageBus) => {
    const returnValueMessages = messageBus._stream
        .map(({ payload }) => (payload))
        .filter(isReturnValueMessage)

    const body = returnValueMessages.reduce((previous, { body }) => ({
        ...previous,
        ...body
    }), {} as Record<string, any>)

    return {
        statusCode: 200,
        body: JSON.stringify(body)
    }
}
