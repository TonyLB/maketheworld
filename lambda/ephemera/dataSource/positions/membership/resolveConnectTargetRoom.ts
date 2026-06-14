import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { RoomStackItem } from './types'
import {
    normalizeRoomStack,
    roomStackTopRoomShortId,
    roomStacksEqual,
    trimRoomStackToAccessibleAssets,
} from './trimEvictionLadder'

export type ResolveConnectTargetRoomDependencies = {
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getCanonAssets?: () => Promise<string[] | undefined>;
    optimisticUpdate?: typeof ephemeraDB.optimisticUpdate;
}

export type ResolveConnectTargetRoomResult = {
    targetRoomId: EphemeraRoomId;
    characterMeta: CharacterMetaItem;
    trimmedRoomStack: RoomStackItem[];
}

/**
 * Trim the eviction ladder to accessible assets, persist trim-only when the stack
 * shape changes, and resolve the in-play room from the surviving top frame.
 */
export const resolveConnectTargetRoom = async (
    characterId: EphemeraCharacterId,
    deps?: ResolveConnectTargetRoomDependencies
): Promise<ResolveConnectTargetRoomResult> => {
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

    let resolvedMeta = characterMeta
    if (!roomStacksEqual(priorStack, trimmedRoomStack)) {
        await optimisticUpdate({
            Key: {
                EphemeraId: characterMeta.EphemeraId,
                DataCategory: 'Meta::Character',
            },
            updateKeys: ['RoomStack'],
            updateReducer: (draft) => {
                draft.RoomStack = trimmedRoomStack
            },
            successCallback: ({ RoomStack }) => {
                resolvedMeta = { ...characterMeta, RoomStack: RoomStack as RoomStackItem[] }
                internalCache.CharacterMeta.set(resolvedMeta)
            },
            succeedAll: true,
        })
    }

    const stackRoomShortId = roomStackTopRoomShortId(trimmedRoomStack) ?? 'VORTEX'
    return {
        targetRoomId: RoomKey(stackRoomShortId),
        characterMeta: resolvedMeta,
        trimmedRoomStack,
    }
}
