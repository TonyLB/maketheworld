import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'
import type { GroundedPresence } from '../../actions/enrich/objectManipulation/plan/planStep'
import { parentBinding, parentBindingsOf } from './presenceParent'

/**
 * Every room reachable upward from `startId` through presence bindings: a narration unit's audience
 * resolution.
 *
 * Generalizes `hasPresenceAncestor`'s BFS from a yes/no reachability test to a terminal-collecting
 * walk: a parent that is itself a Room is a terminal (a room is a perspective root: it has
 * bindings into its areas, which the walk deliberately does not follow --- that stop is this
 * walker's policy, not the accessor's); any other parent advances through its own bindings
 * (`parentBindingsOf`), fanning out over every one at host grain rather than checking that a
 * parent's `cover` admits the specific binding it arrived from (an audience reaching an extra room
 * is harmless: overlapping audiences already each deliver).
 *
 * A host with no presence binding and no Room id is a dead end, not a room: it contributes nothing,
 * the same false-negative-never-false-positive acceptance `hasPresenceAncestor` documents for a
 * missing binding.
 */
export const roomsForHost = async (
    startId: EphemeraMembershipHostId,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<Set<EphemeraRoomId>> => {
    if (isEphemeraRoomId(startId)) {
        return new Set([startId])
    }
    const rooms = new Set<EphemeraRoomId>()
    const visited = new Set<EphemeraMembershipHostId>([startId])
    let frontier: EphemeraMembershipHostId[] = [startId]
    while (frontier.length > 0) {
        const owned = await Promise.all(frontier.map((hostId) => parentBindingsOf(hostId, getGraph)))
        const next: EphemeraMembershipHostId[] = []
        for (const bindings of owned) {
            for (const { parent: { host } } of bindings) {
                if (isEphemeraRoomId(host)) {
                    rooms.add(host)
                    continue
                }
                if (!visited.has(host)) {
                    visited.add(host)
                    next.push(host)
                }
            }
        }
        frontier = next
    }
    return rooms
}

/**
 * Locates one presence binding on its owner's own graph (a binding is minted onto the mover's own
 * graph, per `presenceBindingStepsForMove.ts`), then continues the walk from that binding's
 * parent host. The owner is the bucket's own `host`, not the referent: a thing is usually seen
 * through a binding of the host whose graph holds it.
 */
export const roomsForPresenceNode = async (
    ownerHostId: EphemeraMembershipHostId,
    presenceId: EphemeraPresenceNodeId,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<Set<EphemeraRoomId>> => {
    const parent = await parentBinding(ownerHostId, presenceId, getGraph)
    return roomsForHost(parent.host, getGraph)
}

/**
 * Resolves one referent's audience rooms: a room-valued `groundedPresence` entry is its own answer;
 * an absent or empty `groundedPresence` falls through to every room `groundedId` currently reaches
 * (a referent's audience is every room it is seen in, as for a non-present whole); otherwise each
 * entry is resolved and the results deduplicated into one room set.
 */
export const roomsForReferent = async (
    groundedId: EphemeraMembershipHostId,
    groundedPresence: GroundedPresence[] | undefined,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<Set<EphemeraRoomId>> => {
    const entries = groundedPresence ?? []
    if (entries.length === 0) {
        return roomsForHost(groundedId, getGraph)
    }
    const perEntry = await Promise.all(entries.map((entry) => (
        typeof entry === 'string'
            ? Promise.resolve(new Set([entry]))
            : roomsForPresenceNode(entry.host, entry.presence, getGraph)
    )))
    const rooms = new Set<EphemeraRoomId>()
    for (const set of perEntry) {
        for (const room of set) {
            rooms.add(room)
        }
    }
    return rooms
}
