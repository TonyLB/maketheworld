import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../../internalCache'
import type { CharacterMetaItem } from '../../../../internalCache/characterMeta'
import { resolveLegalRoomIdFromRoomStack } from '../../../characters/roomStack/trimEvictionLadder'

export type ResolveCharacterRoomIdDependencies = {
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    getCanonAssets?: () => Promise<string[] | undefined>;
}

/**
 * Character room for presentation and delivery:
 * 1. Play membership (`ludicGraph` adjacency) when in play.
 * 2. Trimmed `RoomStack` top frame when out of play (disconnect, orientation before connect).
 *
 * Does not read legacy `Meta::Character.RoomId`. For connect with trim-only persist, use
 * {@link resolveConnectTargetRoom}.
 */
export const resolveCharacterRoomId = async (
    characterId: EphemeraCharacterId,
    deps?: ResolveCharacterRoomIdDependencies
): Promise<EphemeraRoomId> => {
    const getMembershipContainers = deps?.getMembershipContainers
        ?? (async (id: EphemeraCharacterId) => {
            const containers = await internalCache.Positions.getMembershipContainers(id)
            return containers.filter((hostId): hostId is EphemeraRoomId => isEphemeraRoomId(hostId))
        })
    const getCharacterMeta = deps?.getCharacterMeta
        ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const getCanonAssets = deps?.getCanonAssets
        ?? (() => internalCache.Global.get('assets'))

    const containers = await getMembershipContainers(characterId)
    const fromPlay = containers[0]
    if (fromPlay && isEphemeraRoomId(fromPlay)) {
        return fromPlay
    }

    const [characterMeta, canonAssets = []] = await Promise.all([
        getCharacterMeta(characterId),
        getCanonAssets(),
    ])
    const accessibleAssets = [...canonAssets, ...characterMeta.assets]
    return resolveLegalRoomIdFromRoomStack(characterMeta.RoomStack, accessibleAssets)
}
