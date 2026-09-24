import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'

/**
 * Is `ancestorId` equal to `startId`, or reachable upward from it through presence bindings?
 *
 * Upward edges are read from the graphs themselves, not from the adjacency index: every presence
 * node on a host's own graph names, in `fromHostId`, a parent that host is present at
 * (`presenceBindingStepsForMove.ts` mints the binding onto the MOVER's graph). Membership is a
 * DAG, so one host can have several parents and the walk branches; the visited set fetches each
 * ancestor once however many paths reach it, and also terminates on a cycle already in storage.
 * No depth cap --- a capped walk would answer "no" for an ancestor just past the cap.
 *
 * Cost is the size of `startId`'s ancestor set, fetched level by level in parallel. Rooms carry no
 * presence bindings of their own, so every walk ends at the rooms above it.
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
        const graphs = await Promise.all(frontier.map((hostId) => getGraph(hostId)))
        const next: EphemeraMembershipHostId[] = []
        for (const graph of graphs) {
            for (const { fromHostId } of graph.presenceNodes) {
                if (fromHostId === ancestorId) {
                    return true
                }
                if (!visited.has(fromHostId)) {
                    visited.add(fromHostId)
                    next.push(fromHostId)
                }
            }
        }
        frontier = next
    }
    return false
}
