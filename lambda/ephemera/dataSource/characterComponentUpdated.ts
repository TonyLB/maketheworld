import { EphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../internalCache'
import messageBus from '../messageBus'
import type { MessageBus } from '../messageBus/baseClasses'
import { parentHostsOf } from './positions/ludicGraph/presenceParent'
import { invalidateRoomMemos } from './positions/manipulation/kernel/invalidateRoomMemos'

export type CharacterComponentUpdatedDeps = {
    messageBus?: Pick<MessageBus, 'publish'>
    invalidateCharacterMeta?: (characterId: EphemeraCharacterId) => void
    getRoomIds?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>
    invalidateRoomMemos?: (roomId: EphemeraRoomId) => void
}

/** The Rooms a character stands in, from its own graph's presence nodes (the bystander derivation of `membershipChangesOf`). */
const roomIdsOf = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> => {
    const graph = await internalCache.Positions.getLudicGraph(characterId)
    return [...new Set(graph.presenceNodes.flatMap((node) => (
        parentHostsOf(node).filter((hostId): hostId is EphemeraRoomId => isEphemeraRoomId(hostId))
    )))]
}

/**
 * The asset side edited a character (its name, say). The cache holds no character data, so nothing is
 * marked stale: the character's rooms refresh their rosters on `RoomUpdate`, the signal an arrival uses.
 * Never reads or writes the name itself, so it holds whichever source `CharacterMeta` reads it from.
 * `CharacterMeta` is invalidated first, so the refresh's compose does not re-read a warm entry.
 */
export const onCharacterComponentUpdated = async (characterId: EphemeraCharacterId, deps: CharacterComponentUpdatedDeps = {}): Promise<void> => {
    (deps.invalidateCharacterMeta ?? ((id) => internalCache.CharacterMeta.invalidate(id)))(characterId)
    const roomIds = await (deps.getRoomIds ?? roomIdsOf)(characterId)
    for (const roomId of roomIds) {
        (deps.invalidateRoomMemos ?? invalidateRoomMemos)(roomId)
    }
    for (const roomId of roomIds) {
        (deps.messageBus ?? messageBus).publish({ type: 'RoomUpdate', roomId })
    }
}
