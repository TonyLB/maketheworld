import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../internalCache'
import messageBus from '../../../messageBus'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraLudicGraph } from '../ludicGraph'
import { sendLudicCacheInvalidatedPublish } from '../publishedEvents'
import { roomsInvalidatedByHosts } from './roomsInvalidatedByHosts'
import { markLudicCacheStale } from './store'

export type MarkStaleDeps = {
    messageBus?: Pick<MessageBus, 'publish'>
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    /** For a change to the hosts' own names, not their graphs: see `roomsInvalidatedByHosts`. */
    includeCharacterStarts?: boolean
}

/**
 * Marks rooms' stored `ludicCache` stale outside a kernel transaction, then publishes
 * `Ludic Cache Invalidated`. For the writers that cannot ride `commitStepSequence`'s transaction
 * (asset-side name changes, the diagnostics heals, the Coyote clear): each marks right after its own
 * write, so a short window is accepted (LCP-4). The mark is written before the fact is published, so
 * a consumer woken by the fact never reads the old marker. Returns the rooms marked.
 */
export const markRoomsStale = async (
    roomIds: readonly EphemeraRoomId[],
    deps: MarkStaleDeps = {}
): Promise<EphemeraRoomId[]> => {
    const rooms = [...new Set(roomIds)]
    if (rooms.length === 0) {
        return []
    }
    await markLudicCacheStale(rooms)
    sendLudicCacheInvalidatedPublish(deps.messageBus ?? messageBus, rooms[0], { type: 'Ludic Cache Invalidated', roomIds: rooms })
    return rooms
}

/** `markRoomsStale` for the rooms a write to these hosts can change (see `roomsInvalidatedByHosts`). */
export const markHostsStale = async (
    hostIds: Iterable<EphemeraMembershipHostId>,
    deps: MarkStaleDeps = {}
): Promise<EphemeraRoomId[]> => markRoomsStale(
    await roomsInvalidatedByHosts(
        hostIds,
        deps.getGraph ?? ((hostId) => internalCache.Positions.getLudicGraph(hostId as Parameters<typeof internalCache.Positions.getLudicGraph>[0])),
        { includeCharacterStarts: deps.includeCharacterStarts }
    ),
    deps
)
