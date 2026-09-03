import type { EphemeraObjectId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraLudicTerminalOwner, isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import internalCache from '../../../../internalCache'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import {
    findRelationalChainFromLeg,
    type RelationalChainStep,
} from '../../../actions/enrich/objectManipulation/synthesize/findRelationalChain'

/**
 * PV1-3c: depth-capped async BFS that fetches every graph a relational chain touching any of
 * `entityIds` might reach, mirroring `walkAncestryContainers`'s own precedent
 * (`synthesize/findShardBoundary.ts`) but following relational edges/ports instead of
 * containment ancestry. `depthCap` (default 5) matches this codebase's existing convention
 * (PV1-1's referent-search cap, `walkAncestryContainers`'s own default) --- chains today never
 * exceed one hop per side (PV1-3's own scope cut), so this is generous headroom, not a tight
 * bound being relied on.
 *
 * Each entity seeds two starting points, since a removal-set member can be either side of a
 * crossing: its own *current* container graph(s) (where it sits as a plain member) and its own
 * *owned* graph (`getGraph(entityId)` directly --- always safe even for a non-hosting object,
 * since a missing graph just defaults empty, PV1-2's own precedent). From each fetched graph,
 * every port's `fromHostId` and every port-address terminal's `owner` names a further host to
 * visit --- both directions a crossing can be discovered from.
 */
export const fetchRelationalReachability = async (
    entityIds: ReadonlySet<EphemeraObjectId>,
    getMembershipContainers: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>,
    depthCap: number = 5
): Promise<Map<EphemeraMembershipHostId, EphemeraLudicGraph>> => {
    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
    const visited = new Set<EphemeraMembershipHostId>()
    const seedHosts = new Set<EphemeraMembershipHostId>(entityIds)

    await Promise.all([...entityIds].map(async (entityId) => {
        const containers = await getMembershipContainers(entityId)
        for (const hostId of containers) {
            seedHosts.add(hostId)
        }
    }))

    let frontier = [...seedHosts]
    let currentDepth = 0

    while (frontier.length > 0 && currentDepth < depthCap) {
        const next = new Set<EphemeraMembershipHostId>()
        await Promise.all(frontier.map(async (hostId) => {
            if (visited.has(hostId)) {
                return
            }
            visited.add(hostId)
            const graph = await getGraph(hostId)
            graphs.set(hostId, graph)
            for (const port of graph.ports) {
                if (!visited.has(port.fromHostId)) {
                    next.add(port.fromHostId)
                }
            }
            for (const edge of graph.relationalEdges) {
                for (const terminal of [edge.from, edge.to]) {
                    if (!isEphemeraLudicTerminalPrimitive(terminal) && !visited.has(terminal.owner)) {
                        next.add(terminal.owner)
                    }
                }
            }
        }))
        frontier = [...next]
        currentDepth += 1
    }

    return graphs
}

/**
 * Every distinct chain touching any of `entityIds` --- any relation kind/label, unlike
 * `findRelationalChain`'s own single-named-relation search, since removal must catch every
 * relationship a departing object carries, not one named one. No ambiguity concept applies here
 * either (contrast `findRelationalChain`'s `ambiguous` decline): every matching leg seeds its own
 * `findRelationalChainFromLeg` call, and every resolvable chain is collected, deduped by its own
 * ordered `steps` (the same chain can be reached from either of its two ends, or from two
 * different removal-set members at once). A `declined` leg (malformed graph) is skipped, not
 * surfaced --- this walk only ever reads already-committed state and prefers to under-report a
 * dangling reference over throwing.
 */
export const findRelationalChainsTouching = (
    entityIds: ReadonlySet<EphemeraObjectId>,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): RelationalChainStep[][] => {
    const getGraph = (hostId: EphemeraMembershipHostId): EphemeraLudicGraph | undefined => graphs.get(hostId)
    const seenChainKeys = new Set<string>()
    const chains: RelationalChainStep[][] = []

    const chainKey = (steps: readonly RelationalChainStep[]): string =>
        JSON.stringify(steps.map((step) => (step.type === 'edge' ? { t: 'e', h: step.hostId, e: step.edge } : { t: 'p', h: step.hostId, p: step.port.portId })))

    for (const [hostId, graph] of graphs) {
        for (const edge of graph.relationalEdges) {
            // A port-address terminal owned by a removal-set member counts as touching it too ---
            // not just a literal primitive match. The port belongs to its owner's own structure
            // (`bothObjectsOnGraph`/`removeObject`'s own `assertNoRelationalEdgesReferencing`
            // already treat "owner" as "refers to" the same way), so an edge naming that owner's
            // port must be dissolved when the owner itself is removed, even though the edge's own
            // endpoint value is the port address, not the owner id directly.
            const touchesRemovalSet = [edge.from, edge.to].some(
                (terminal) => entityIds.has(ephemeraLudicTerminalOwner(terminal) as EphemeraObjectId)
            )
            if (!touchesRemovalSet) {
                continue
            }
            const result = findRelationalChainFromLeg({ hostId, edge }, { getGraph })
            if (result.verdict !== 'found') {
                continue
            }
            const key = chainKey(result.steps)
            if (seenChainKeys.has(key)) {
                continue
            }
            seenChainKeys.add(key)
            chains.push(result.steps)
        }
    }

    return chains
}

export const defaultGetGraph = (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> =>
    internalCache.Positions.getLudicGraph(hostId)
