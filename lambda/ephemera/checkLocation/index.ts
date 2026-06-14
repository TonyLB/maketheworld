import {
    MessageBus,
    CheckLocationMessage,
    isCheckLocationPlayer,
    isCheckLocationRoom,
    CheckLocationPlayerMessage,
    isCheckLocationAsset,
} from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import internalCache from "../internalCache"
import { RoomKey } from "@tonylb/mtw-utilities/ts/types"
import type { RoomStackItem } from "../dataSource/positions/membership/types"
import {
    normalizeRoomStack,
    trimRoomStackToAccessibleAssets,
} from "../dataSource/positions/membership/trimEvictionLadder"
import { isEphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { checkLocationCoalescer } from "./coalescer"

//
// checkLocation message handler tests whether the RoomStack (and RoomId) currently assigned to the character still
// matches against the canon and personal assets that they have access to.  Any items in the RoomStack that are
// no longer accessible are filtered out. If the top of the RoomStack is no longer the same room as the RoomId
// then a moveCharacter action is queued in order to relocate the character somewhere legal
//

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

const repairCharacterLocation = async (
    payload: CheckLocationPlayerMessage,
    messageBus: MessageBus
): Promise<void> => {
    if (!checkLocationCoalescer.tryClaim(payload.characterId)) {
        return
    }

    const [characterMeta, canonAssets = []] = await Promise.all([
        internalCache.CharacterMeta.get(payload.characterId),
        internalCache.Global.get('assets')
    ])

    const accessibleAssets = [...canonAssets, ...characterMeta.assets]
    if (!payload.forceMove && characterMeta.RoomStack.every(({ asset }) => (accessibleAssets.includes(asset)))) {
        return
    }

    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: characterMeta.EphemeraId,
            DataCategory: 'Meta::Character'
        },
        updateKeys: ['RoomId', 'RoomStack'],
        updateReducer: (draft) => {
            draft.RoomStack = trimRoomStackToAccessibleAssets(
                normalizeRoomStack(draft.RoomStack as RoomStackItem[] | undefined),
                accessibleAssets
            )
        },
        successCallback: ({ RoomStack, RoomId }) => {
            const { forceMove, forceRender, arriveMessage, leaveMessage, suppressArrival, suppressDeparture } = payload
            internalCache.CharacterMeta.set({ ...characterMeta, RoomStack })
            const stackRoomId = (RoomStack as RoomStackItem[]).slice(-1)[0]?.RoomId

            if (forceMove || (stackRoomId && (RoomKey(stackRoomId) !== RoomId))) {
                messageBus.publish({
                    type: 'MoveCharacter',
                    characterId: payload.characterId,
                    roomId: RoomKey(stackRoomId),
                    suppressArrival,
                    arriveMessage,
                    suppressDeparture,
                    leaveMessage,
                    suppressSelfMessage: true
                })
            }
            else if (forceRender) {
                messageBus.publish({
                    type: 'Perception',
                    characterId: characterMeta.EphemeraId,
                    ephemeraId: RoomKey(stackRoomId)
                })
            }
        },
        succeedAll: payload.forceMove
    })
}

export const checkLocation = async ({ payloads, messageBus }: { payloads: CheckLocationMessage[], messageBus: MessageBus }): Promise<void> => {
    const playerPayloads = (await Promise.all(payloads.map(expandCheckLocationPayload))).flat()
    await Promise.all(playerPayloads.map((payload) => repairCharacterLocation(payload, messageBus)))
}

export default checkLocation
