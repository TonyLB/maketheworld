import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { RoomStackItem } from './types'
import {
    trimPersistCharacterRoomStack,
    type TrimPersistCharacterRoomStackDependencies,
} from './trimPersistCharacterRoomStack'

export type ResolveConnectTargetRoomDependencies = TrimPersistCharacterRoomStackDependencies

export type ResolveConnectTargetRoomResult = {
    targetRoomId: EphemeraRoomId;
    characterMeta: CharacterMetaItem;
    trimmedRoomStack: RoomStackItem[];
}

/**
 * Trim the eviction ladder to accessible assets, persist trim-only when the stack
 * shape changes, and resolve legal in-play placement (top surviving frame) for connect.
 */
export const resolveConnectTargetRoom = async (
    characterId: EphemeraCharacterId,
    deps?: ResolveConnectTargetRoomDependencies
): Promise<ResolveConnectTargetRoomResult> => {
    const {
        targetRoomId,
        trimmedRoomStack,
        characterMeta,
    } = await trimPersistCharacterRoomStack(characterId, deps)

    return {
        targetRoomId,
        characterMeta,
        trimmedRoomStack,
    }
}
