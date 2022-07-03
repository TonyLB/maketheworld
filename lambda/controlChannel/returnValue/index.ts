import { ReturnValueMessage } from "../messageBus/baseClasses"
import { MessageBus } from "../messageBus"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

export const returnValueMessage = async ({ payloads }: { payloads: ReturnValueMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.get({ category: 'Global', key: 'ConnectionId' })

    await Promise.all(payloads.map(async (payload) => (
        apiClient.send({
            ConnectionId,
            Data: JSON.stringify(payload.body)
        })
    )))
}

export default returnValueMessage
