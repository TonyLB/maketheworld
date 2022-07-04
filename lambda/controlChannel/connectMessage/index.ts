import { ConnectMessage, MessageBus } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'

export const connectMessage = async ({ payloads, messageBus }: { payloads: ConnectMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.get({ category: 'Global', key: 'ConnectionId' })

    if (connectionId) {
        const aggregatePromises = payloads.reduce((previous, payload) => ([
            ...previous,
            ephemeraDB.putItem({
                EphemeraId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                player: payload.userName
            }),
            ephemeraDB.update({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                UpdateExpression: 'SET connections.#connection = :player',
                ExpressionAttributeValues: {
                    ':player': payload.userName
                },
                ExpressionAttributeNames: {
                    '#connection': connectionId
                },
                //
                // TODO: Activate when selfHeal is in the utility layer
                //
                // catchException: healGlobalValues
            })
        ]), [] as Promise<any>[])
    
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
