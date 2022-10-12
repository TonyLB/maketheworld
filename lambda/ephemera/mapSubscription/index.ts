import { MapSubscriptionMessage, MessageBus } from "../messageBus/baseClasses"
import { connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache, { MapSubscriptionConnection } from '../internalCache'
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/ephemera"

export const mapSubscriptionMessage = async ({ payloads, messageBus }: { payloads: MapSubscriptionMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    if (connectionId) {

        const [possibleMaps] = await Promise.all([
            Promise.all(
                payloads.map((payload) => (internalCache.CharacterPossibleMaps.get(payload.characterId)))
            ),
            connectionDB.optimisticUpdate({
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
        ])

        await Promise.all(
            possibleMaps.map(({ EphemeraId, mapsPossible }) => (
                Promise.all(
                    mapsPossible.map(async (MapId) => {
                        const { RoomId } = await internalCache.CharacterMeta.get(splitType(EphemeraId)[1])
                        console.log(`Render: ${MapId} if it includes ${RoomId}`)
                        messageBus.send({
                            type: 'Perception',
                            characterId: EphemeraId,
                            ephemeraId: MapId,
                            mustIncludeRoomId: `ROOM#${RoomId}`
                        })
                    })
                )
            ))
        )
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
