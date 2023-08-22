import { MessageBus, CheckLocationMessage, isCheckLocationPlayer, isCheckLocationRoom, CheckLocationPlayerMessage, isCheckLocationAsset, CheckLocationRoomMessage } from "../messageBus/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import internalCache from "../internalCache"
import { RoomKey } from "@tonylb/mtw-utilities/dist/types"
import { RoomStackItem } from "../moveCharacter"

//
// checkLocation message handler tests whether the RoomStack (and RoomId) currently assigned to the character still
// matches against the canon and personal assets that they have access to.  Any items in the RoomStack that are
// no longer accessible are filtered out. If the top of the RoomStack is no longer the same room as the RoomId
// then a moveCharacter action is queued in order to relocate the character somewhere legal
//
export const checkLocation = async ({ payloads, messageBus }: { payloads: CheckLocationMessage[], messageBus: MessageBus }): Promise<void> => {
    //
    // Scan payloads for assetId types and expand them out into roomId types using
    // the descendants of the assetId
    //
    const assetPayloads = payloads.filter(isCheckLocationAsset)
    const assetDescendantGraph = await internalCache.Graph.get(assetPayloads.map(({ assetId }) => (assetId)), 'forward')
    const secondPayloads = assetPayloads.reduce<(CheckLocationPlayerMessage | CheckLocationRoomMessage)[]>((previous, payload) => {
        const { assetId, ...rest } = payload
        //
        // TODO: Find room descendants that can be reached from the node by using only edges that
        // have context equal to the asset Key.
        //

        //
        // TODO: Add roomId payloads if they do not already exist in the previous listing
        //
        return previous
    }, payloads.filter((payload): payload is (CheckLocationPlayerMessage | CheckLocationRoomMessage) => (!isCheckLocationAsset(payload))))

    //
    // Scan payloads for roomId types and expand them out into characterId types using
    // the characterList items of each room
    //
    const roomPayloads = payloads.filter(isCheckLocationRoom)
    const roomLookupPayloads: CheckLocationPlayerMessage[] = (await Promise.all(
        roomPayloads.map(async (payload) => {
            const { roomId, ...rest } = payload
            const characterList = await internalCache.RoomCharacterList.get(roomId)
            return characterList.map(({ EphemeraId }) => ({
                ...rest,
                characterId: EphemeraId
            }))
        })
    )).flat()
    const finalPayloads = roomLookupPayloads.reduce<CheckLocationPlayerMessage[]>((previous, payload) => {
        if (previous.find(({ characterId }) => (payload.characterId === characterId))) {
            return previous
        }
        return [...previous, payload]
    }, payloads.filter(isCheckLocationPlayer))

    await Promise.all(finalPayloads.map(async (payload) => {

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
                if (!draft.RoomStack) {
                    draft.RoomStack = [{ asset: 'primitives', RoomId: 'VORTEX' }]
                }
                else {
                    draft.RoomStack = (draft.RoomStack as RoomStackItem[]).filter(({ asset }) => (accessibleAssets.includes(asset)))
                }
            },
            successCallback: ({ RoomStack, RoomId }) => {
                const { forceMove, arriveMessage, leaveMessage } = payload
                internalCache.CharacterMeta.set({ ...characterMeta, RoomStack })
                const stackRoomId = (RoomStack as RoomStackItem[]).slice(-1)[0]?.RoomId

                if (forceMove || (stackRoomId && (RoomKey(stackRoomId) !== RoomId))) {
                    messageBus.send({
                        type: 'MoveCharacter',
                        characterId: payload.characterId,
                        roomId: RoomKey(stackRoomId),
                        arriveMessage,
                        leaveMessage,
                        suppressSelfMessage: true
                        //
                        // TODO: Figure out UI for departure and arrival messages to differentiate from normal travel
                        //
                    })
                }
            },
            succeedAll: payload.forceMove
        })
    }))
}

export default checkLocation
