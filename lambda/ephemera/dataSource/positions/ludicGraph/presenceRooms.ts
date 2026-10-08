import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'
import type { GroundedPresence } from '../../actions/enrich/objectManipulation/plan/planStep'

/**
 * Every room reachable upward from `startId` through presence bindings: a narration unit's audience
 * resolution.
 *
 * Generalizes `hasPresenceAncestor`'s BFS from a yes/no reachability test to a terminal-collecting
 * walk: a frontier host that is itself a Room is a terminal (rooms carry no presence bindings of
 * their own); any other frontier host advances through its own `graph.presenceNodes[].fromHostId`,
 * exactly as `hasPresenceAncestor` does, fanning out blindly over every presence node rather than
 * checking that a parent's `cover` admits the specific binding it arrived from (no code does
 * cover-matching today, and an audience reaching an extra room is harmless: overlapping audiences
 * already each deliver).
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
        const graphs = await Promise.all(frontier.map((hostId) => getGraph(hostId)))
        const next: EphemeraMembershipHostId[] = []
        for (const graph of graphs) {
            for (const { fromHostId } of graph.presenceNodes) {
                if (isEphemeraRoomId(fromHostId)) {
                    rooms.add(fromHostId)
                    continue
                }
                if (!visited.has(fromHostId)) {
                    visited.add(fromHostId)
                    next.push(fromHostId)
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
 * `fromHostId`. The owner is the bucket's own `host`, not the referent: a thing is usually seen
 * through a binding of the host whose graph holds it.
 */
export const roomsForPresenceNode = async (
    ownerHostId: EphemeraMembershipHostId,
    presenceId: EphemeraPresenceNodeId,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<Set<EphemeraRoomId>> => {
    const graph = await getGraph(ownerHostId)
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === presenceId)
    if (!node) {
        throw new Error(`roomsForPresenceNode: ${presenceId} not found on ${ownerHostId}'s own graph`)
    }
    return roomsForHost(node.fromHostId, getGraph)
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
