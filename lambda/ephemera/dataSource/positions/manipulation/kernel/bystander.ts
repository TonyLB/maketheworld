import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

/**
 * Whether `moverId`'s membership in `hostId` is that of a **bystander**: a present character not
 * entangled with the room. A bystander is indexed by the room's `LudicCache::Characters` row, never by
 * the room's graph, so a bystander's arrival or departure writes the mover's own graph only.
 *
 * Every character is a bystander today. The participant feature (a character holding something tied to
 * the room) is the one place this changes: it will return a participant to the room graph, so it
 * amends this predicate and nothing else.
 */
export const isBystanderMove = (moverId: EphemeraMembershipHostId, hostId: EphemeraMembershipHostId): boolean => (
    isEphemeraCharacterId(moverId) && isEphemeraRoomId(hostId)
)
