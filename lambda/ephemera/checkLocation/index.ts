import {
    MessageBus,
    CheckLocationMessage,
    isCheckLocationPlayer,
    isCheckLocationRoom,
    CheckLocationPlayerMessage,
    isCheckLocationAsset,
} from '../messageBus/baseClasses'
import internalCache from '../internalCache'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { PositionsPublishedPayload } from '../dataSource/positions/publishedEvents'
import { repairCharacterLegalPlacement } from '../dataSource/positions/membership/repairCharacterLegalPlacement'
import { checkLocationCoalescer } from './coalescer'

const getPositionsStreamEvent = (): StreamEventFunction<PositionsPublishedPayload> => {
    const { default: ephemeraPositionsDataSource } = require('../dataSource/positions') as {
        default: { streamEvent: StreamEventFunction<PositionsPublishedPayload> };
    }
    return ephemeraPositionsDataSource.streamEvent.bind(ephemeraPositionsDataSource)
}

const expandCheckLocationPayload = async (payload: CheckLocationMessage): Promise<CheckLocationPlayerMessage[]> => {
    if (isCheckLocationPlayer(payload)) {
        return [payload]
    }

    if (isCheckLocationRoom(payload)) {
        const { roomId, ...rest } = payload
        const characterList = await internalCache.RoomCharacterList.get(roomId)
        return characterList.map(({ EphemeraId }) => ({
            ...rest,
            characterId: EphemeraId
        }))
    }

    if (isCheckLocationAsset(payload)) {
        const { assetId, ...rest } = payload
        const assetDescendantGraph = await internalCache.Graph.get([assetId], 'forward')
        const roomDescendantGraph = assetDescendantGraph.restrict({
            fromRoots: [assetId],
            edgeCondition: ({ context }) => (context === assetId.split('#')[1])
        })
        const roomIds = Object.keys(roomDescendantGraph.nodes).filter(isEphemeraRoomId)
        const playerPayloads = await Promise.all(
            roomIds.map(async (roomId) => {
                const characterList = await internalCache.RoomCharacterList.get(roomId)
                return characterList.map(({ EphemeraId }) => ({
                    ...rest,
                    characterId: EphemeraId
                }))
            })
        )
        return playerPayloads.flat()
    }

    return []
}

const repairPlayerLocation = async (
    payload: CheckLocationPlayerMessage,
    messageBus: MessageBus
): Promise<void> => {
    if (!checkLocationCoalescer.tryClaim(payload.characterId)) {
        return
    }

    await repairCharacterLegalPlacement({
        characterId: payload.characterId,
        forceMove: payload.forceMove,
        forceRender: payload.forceRender,
        messageBus,
        streamEvent: getPositionsStreamEvent(),
    })
}

export const checkLocation = async ({ payloads, messageBus }: { payloads: CheckLocationMessage[], messageBus: MessageBus }): Promise<void> => {
    const playerPayloads = (await Promise.all(payloads.map(expandCheckLocationPayload))).flat()
    await Promise.all(playerPayloads.map((payload) => repairPlayerLocation(payload, messageBus)))
}

export default checkLocation
