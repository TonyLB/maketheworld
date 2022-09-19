import { EphemeraUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

export const ephemeraUpdate = async ({ payloads }: { payloads: EphemeraUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    await apiClient.send({
        ConnectionId,
        Data: JSON.stringify({
            messageType: 'Ephemera',
            RequestId,
            updates: payloads.reduce((previous, payload) => ([ ...previous, ...payload.updates]), [] as EphemeraUpdateMessage["updates"])
        })
    })
}

export default ephemeraUpdate
