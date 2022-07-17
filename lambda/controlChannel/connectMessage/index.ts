import { ConnectMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'

export const connectMessage = async ({ payloads, messageBus }: { payloads: ConnectMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.get({ category: 'Global', key: 'ConnectionId' })

    if (connectionId) {
        const aggregatePromises = payloads.reduce((previous, payload) => ([
            ...previous,
            connectionDB.putItem({
                ConnectionId: connectionId,
                DataCategory: 'Meta::Connection',
                player: payload.userName
            }),
        ]), [
            connectionDB.optimisticUpdate({
                key: {
                    ConnectionId: 'Global',
                    DataCategory: 'Connections'    
                },
                updateKeys: ['connections'],
                updateReducer: (draft: { connections?: Record<string, string> }) => {
                    payloads.forEach((payload) => {
                        if (draft.connections === undefined) {
                            draft.connections = {}
                        }
                        if (payload.userName) {
                            draft.connections[connectionId] = payload.userName
                        }
                    })
                },
            })
        ] as Promise<any>[])
    
        await Promise.all(aggregatePromises)

        messageBus.send({
            type: 'ReturnValue',
            body: { statusCode: 200 }
        })

    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: {
                statusCode: 500,
                message: 'Internal Server Error'
            }
        })
    }

}

export default connectMessage
