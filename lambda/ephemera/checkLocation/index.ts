import { MoveCharacterMessage, MessageBus, CheckLocationMessage, isCheckLocationPlayer } from "../messageBus/baseClasses"
import { ephemeraDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"
import internalCache from "../internalCache"
import { RoomKey, splitType } from "@tonylb/mtw-utilities/dist/types"
import { RoomStackItem } from "../moveCharacter"

//
// checkLocation message handler tests whether the RoomStack (and RoomId) currently assigned to the character still
// matches against the canon and personal assets that they have access to.  Any items in the RoomStack that are
// no longer accessible are filtered out. If the top of the RoomStack is no longer the same room as the RoomId
// then a moveCharacter action is queued in order to relocate the character somewhere legal
//
export const checkLocation = async ({ payloads, messageBus }: { payloads: CheckLocationMessage[], messageBus: MessageBus }): Promise<void> => {
        //
        // TODO: Refactor checkLocation to scan payloads for roomId types and expand them out into characterId types using
        // the current active characters in the room
        //
        await Promise.all(payloads.filter(isCheckLocationPlayer).map(async (payload) => {

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
