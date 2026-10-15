import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { roomsForHost } from '../ludicGraph/presenceRooms'

/**
 * Every room whose stored `ludicCache` a write to these hosts can change: the rooms reachable
 * upward from each host, deduplicated.
 *
 * A character-hosted shard is skipped as a starting point, because a room's cache holds a present
 * character only as a leaf (its node and bindings, none of its inventory), so a commit that touches only
 * a character's inventory changes no room cache. A character
 * that moves still marks its rooms: the hosts it leaves and arrives at are written hosts of their
 * own, and are passed in alongside it. For the same reason the walk stops at a character-hosted
 * parent: an object handed from one character to another changes no room's cache.
 */
export const roomsInvalidatedByHosts = async (
    hostIds: Iterable<EphemeraMembershipHostId>,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<EphemeraRoomId[]> => {
    const starts = [...new Set(hostIds)].filter((hostId) => !isEphemeraCharacterId(hostId))
    const perHost = await Promise.all(starts.map((hostId) => roomsForHost(hostId, getGraph, isEphemeraCharacterId)))
    return [...new Set(perHost.flatMap((rooms) => [...rooms]))]
}
