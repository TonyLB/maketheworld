import { BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { parentsOf } from '../../ludicGraph/presenceParent'
import { dropEmptyUnplaced, releaseChildren } from './endOfRunRules'
import { collisionsUnder, joinCollisions } from './joinPresenceBindings'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

/**
 * F-R1 at the run's end, for the bindings this run's reparents and splits may have left parentless
 * (`candidates`, named by the steps; a parentless binding written some other way is the coverage
 * guard's business). A candidate that is still there, is neither Base nor Unplaced, and has no parent
 * is removed; each child binding drops it and falls to Unplaced if no other parent on the host covers
 * it (`releaseChildren`). Children that collide under Unplaced are joined by the kernel, into the
 * binding already there, and again one level down (the F-R1 exception to F-R3). Then F-R2: Unplaced
 * is removed when it covers nothing. A child host outside the footprint is `stale`.
 */
export const settleParentless = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    candidates: readonly ParentBinding[]
): { graphs: Graphs } | { reasonCode: string } => {
    let result: Graphs = new Map(graphs)
    const hosts = new Set<EphemeraMembershipHostId>()
    for (const { host, presence } of candidates) {
        const graph = result.get(host)
        const node = graph?.presenceNodes.find(({ universalKey }) => universalKey === presence)
        if (!graph || !node || presence === BASE_PRESENCE_ID || presence === UNPLACED_PRESENCE_ID || parentsOf(node).length) {
            continue
        }
        result = new Map(result).set(host, graph.removePresenceNode(presence))
        const released = releaseChildren(result, host, presence, node.cover.members)
        if ('reasonCode' in released) {
            return released
        }
        const joined = joinCollisions(released.graphs, collisionsUnder(released.graphs, { host, presence: UNPLACED_PRESENCE_ID }, released.collisions))
        if ('reasonCode' in joined) {
            return joined
        }
        result = joined.graphs
        hosts.add(host)
    }
    hosts.forEach((host) => {
        result = dropEmptyUnplaced(result, host)
    })
    return { graphs: result }
}
