import { EphemeraUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

export const ephemeraUpdate = async ({ payloads }: { payloads: EphemeraUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    const nonGlobalSends = (payloads.find(({ global }) => (!global))) ? [
        apiClient.send({
            ConnectionId,
            Data: JSON.stringify({
                messageType: 'Ephemera',
                RequestId,
                updates: payloads.filter(({ global }) => (!global)).reduce((previous, payload) => ([ ...previous, ...payload.updates]), [] as EphemeraUpdateMessage["updates"])
            })
        })
    ] : []
    let globalSends = [] as Promise<any>[]
    if (payloads.find(({ global }) => (global))) {
        const connections = (await internalCache.Global.get('connections')) || []
        const updates = payloads.filter(({ global }) => (global)).reduce((previous, payload) => ([ ...previous, ...payload.updates]), [] as EphemeraUpdateMessage["updates"])
        console.log(`Connections: ${JSON.stringify(connections, null, 4)}`)
        globalSends = connections.map((connectionId) => (
                apiClient.send({
                    ConnectionId: connectionId,
                    Data: JSON.stringify({
                        messageType: 'Ephemera',
                        RequestId,
                        updates
                    })
                })
            ))
    }
    await Promise.all([
        ...nonGlobalSends,
        ...globalSends
    ])
}

export default ephemeraUpdate
