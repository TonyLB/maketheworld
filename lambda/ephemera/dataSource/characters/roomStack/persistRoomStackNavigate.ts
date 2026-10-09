import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { mergeRoomStack } from './mergeRoomStack'
import { buildProposedRoomStackForNavigate } from './membershipRoomStack'
import { normalizeRoomStack } from './trimEvictionLadder'
import type { RoomStackItem } from './types'

export type PersistRoomStackNavigateArgs = {
    characterId: EphemeraCharacterId;
    targetRoomId: EphemeraRoomId;
    beatAnchorTime: number;
    characterAssets: string[];
    roomAssets: string[];
    canonAssets: string[];
}

export type PersistRoomStackNavigateDependencies = {
    optimisticUpdate?: typeof ephemeraDB.optimisticUpdate;
}

/**
 * Navigate follow-up: persist eviction ladder with timestamp merge so parallel
 * navigates cannot regress newer frames. Must not throw (RS-3).
 */
export const persistRoomStackNavigate = async (
    args: PersistRoomStackNavigateArgs,
    deps?: PersistRoomStackNavigateDependencies
): Promise<void> => {
    const optimisticUpdate = deps?.optimisticUpdate
        ?? ephemeraDB.optimisticUpdate.bind(ephemeraDB)

    try {
        await optimisticUpdate({
            Key: {
                EphemeraId: args.characterId,
                DataCategory: 'Meta::Character',
            },
            updateKeys: ['RoomStack'],
            updateReducer: (draft) => {
                const current = normalizeRoomStack(draft.RoomStack as RoomStackItem[] | undefined)
                const proposed = buildProposedRoomStackForNavigate({
                    targetRoomId: args.targetRoomId,
                    currentRoomStack: current,
                    characterAssets: args.characterAssets,
                    roomAssets: args.roomAssets,
                    canonAssets: args.canonAssets,
                })
                draft.RoomStack = mergeRoomStack(current, proposed, args.beatAnchorTime)
            },
            // `optimisticUpdate`'s prior holds only the update keys, so caching it would leave a partial
            // entry (no Name/assets); drop the entry and let the next read hydrate it whole.
            successCallback: () => {
                internalCache.CharacterMeta.invalidate(args.characterId)
            },
            succeedAll: true,
        })
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[mtw.ephemera.characters] persistRoomStackNavigate failed: ${message}`)
    }
}
