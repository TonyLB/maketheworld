import { EphemeraUpdateMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '../apiClient'

export const ephemeraUpdate = async ({ payloads }: { payloads: EphemeraUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    const nonGlobalSends = (payloads.find(({ global }) => (!global))) ? [
        apiClient.send(
            ConnectionId,
            {
                messageType: 'Ephemera',
                RequestId,
                updates: payloads.filter(({ global }) => (!global)).reduce((previous, payload) => ([ ...previous, ...payload.updates]), [] as EphemeraUpdateMessage["updates"])
            }
        )
    ] : []
    let globalSends = [] as Promise<any>[]
    if (payloads.find(({ global }) => (global))) {
        const connections = (await internalCache.Global.get('connections')) || []
        const updates = payloads.filter(({ global }) => (global)).reduce((previous, payload) => ([ ...previous, ...payload.updates]), [] as EphemeraUpdateMessage["updates"])
        globalSends = connections.map((connectionId) => (
                apiClient.send(
                    connectionId,
                    {
                        messageType: 'Ephemera',
                        RequestId,
                        updates
                    }
                )
            ))
    }
    await Promise.all([
        ...nonGlobalSends,
        ...globalSends
    ])
}

export default ephemeraUpdate
