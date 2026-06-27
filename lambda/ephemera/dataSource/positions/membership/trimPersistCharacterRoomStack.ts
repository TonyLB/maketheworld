import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { RoomStackItem } from './types'
import {
    normalizeRoomStack,
    roomStacksEqual,
    trimRoomStackToAccessibleAssets,
} from './trimEvictionLadder'
import { resolveLegalRoomIdFromRoomStack } from './resolveCharacterRoomId'

export type TrimPersistCharacterRoomStackDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    optimisticUpdate?: typeof ephemeraDB.optimisticUpdate;
}

export type TrimPersistCharacterRoomStackResult = {
    targetRoomId: EphemeraRoomId;
    trimmedRoomStack: RoomStackItem[];
    ladderChanged: boolean;
    characterMeta: CharacterMetaItem;
}

/**
 * Trim the eviction ladder to accessible assets, persist trim-only when the stack
 * shape changes, and resolve the legal room from the surviving top frame.
 *
 * RS-4: filter-only persist --- no mergeRoomStack, no stack-level write time.
 * Surviving frames keep their per-frame timeWritten; the reducer filters draft.RoomStack
 * at write time (same pattern as persistRoomStackNavigate reading current draft).
 */
export const trimPersistCharacterRoomStack = async (
    characterId: EphemeraCharacterId,
    deps?: TrimPersistCharacterRoomStackDependencies
): Promise<TrimPersistCharacterRoomStackResult> => {
    const getCharacterMeta = deps?.getCharacterMeta
        ?? ((id) => internalCache.CharacterMeta.get(id))
    const getCanonAssets = deps?.getCanonAssets
        ?? (() => internalCache.Global.get('assets'))
    const optimisticUpdate = deps?.optimisticUpdate
        ?? ephemeraDB.optimisticUpdate.bind(ephemeraDB)

    const [characterMeta, canonAssets = []] = await Promise.all([
        getCharacterMeta(characterId),
        getCanonAssets(),
    ])
    const accessibleAssets = [...canonAssets, ...characterMeta.assets]
    const priorStack = normalizeRoomStack(characterMeta.RoomStack)
    const trimmedRoomStack = trimRoomStackToAccessibleAssets(priorStack, accessibleAssets)
    const ladderChanged = !roomStacksEqual(priorStack, trimmedRoomStack)

    let resolvedMeta = characterMeta
    if (ladderChanged) {
        await optimisticUpdate({
            Key: {
                EphemeraId: characterMeta.EphemeraId,
                DataCategory: 'Meta::Character',
            },
            updateKeys: ['RoomStack'],
            updateReducer: (draft) => {
                const current = normalizeRoomStack(draft.RoomStack as RoomStackItem[] | undefined)
                draft.RoomStack = trimRoomStackToAccessibleAssets(current, accessibleAssets)
            },
            successCallback: ({ RoomStack }) => {
                resolvedMeta = { ...characterMeta, RoomStack: RoomStack as RoomStackItem[] }
                internalCache.CharacterMeta.set(resolvedMeta)
            },
            succeedAll: true,
        })
    }

    const targetRoomId = resolveLegalRoomIdFromRoomStack(trimmedRoomStack, accessibleAssets)
    return {
        targetRoomId,
        trimmedRoomStack,
        ladderChanged,
        characterMeta: resolvedMeta,
    }
}
