import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'
import { parentBindingsOf } from './presenceParent'

/**
 * Is `ancestorId` equal to `startId`, or reachable upward from it through presence bindings?
 *
 * Upward edges are read from the graphs themselves, not from the adjacency index, through
 * `parentBindingsOf`: every presence node on a host's own graph names a parent that host is present
 * at (`resolvePresenceMoves.ts` plans the steps that write the binding onto the MOVER's graph). Membership is a
 * DAG, so one host can have several parents and the walk branches; the visited set fetches each
 * ancestor once however many paths reach it, and also terminates on a cycle already in storage.
 * No depth cap --- a capped walk would answer "no" for an ancestor just past the cap.
 *
 * Cost is the size of `startId`'s ancestor set, fetched level by level in parallel. The walk does not stop at
 * a room: a room's bindings into its areas are followed like any other, so the ancestor set
 * includes areas, and a walk ends only at hosts with no binding of their own. (Stopping at rooms,
 * as `roomsForHost` does, would save reads and give the same answer for its one caller, which asks
 * about an Object ancestor; kept as is to stay behavior-preserving.)
 *
 * **Depends on every membership having a presence binding on the member.** A host whose binding
 * is missing looks parentless here, so the walk answers "no" past it --- a false negative, never a
 * false positive.
 */
export const hasPresenceAncestor = async (
    startId: EphemeraMembershipHostId,
    ancestorId: EphemeraMembershipHostId,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<boolean> => {
    if (startId === ancestorId) {
        return true
    }
    const visited = new Set<EphemeraMembershipHostId>([startId])
    let frontier: EphemeraMembershipHostId[] = [startId]
    while (frontier.length > 0) {
        const owned = await Promise.all(frontier.map((hostId) => parentBindingsOf(hostId, getGraph)))
        const next: EphemeraMembershipHostId[] = []
        for (const bindings of owned) {
            for (const { parent: { host } } of bindings) {
                if (host === ancestorId) {
                    return true
                }
                if (!visited.has(host)) {
                    visited.add(host)
                    next.push(host)
                }
            }
        }
        frontier = next
    }
    return false
}
