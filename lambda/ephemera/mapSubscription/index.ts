import { MapSubscriptionMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache, { MapSubscriptionConnection } from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraCharacterId } from "../cacheAsset/baseClasses"

export const mapSubscriptionMessage = async ({ payloads, messageBus }: { payloads: MapSubscriptionMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    if (connectionId) {

        await connectionDB.optimisticUpdate({
            key: {
                ConnectionId: 'Map',
                DataCategory: 'Subscriptions'
            },
            updateKeys: ['connections'],
            updateReducer: (draft: { connections?: MapSubscriptionConnection[] }) => {
                payloads.forEach((payload) => {
                    if (typeof draft.connections === 'undefined') {
                        draft.connections = []
                    }
                    if (payload.characterId) {
                        const findConnection = draft.connections.find(({ connectionId: check }) => (check === connectionId))
                        if (findConnection) {
                            findConnection.characterIds = unique(findConnection.characterIds, [payload.characterId]) as EphemeraCharacterId[]
                        }
                        else {
                            draft.connections = [{ connectionId, characterIds: [payload.characterId] }]
                        }
                    }
                })
            }
        })

        messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'SubscribeToMaps',
                RequestId
            }
        })

    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                message: 'Internal Server Error',
                RequestId
            }
        })
    }

}

export default mapSubscriptionMessage
