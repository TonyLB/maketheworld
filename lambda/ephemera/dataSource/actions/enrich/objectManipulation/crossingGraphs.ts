/**
 * The graphs an open leg needs (ISS8314). Planning reads relations from the actor's cache, and a joined
 * edge answers both Expansion and the dry run without a graph: the dry run needs only a verdict, since commit rebuilds every
 * chain against the live graphs. What the cache cannot answer is an **open leg** (a crossing whose other half no walk in this
 * cache reached): its far end is named by following its own legs through the graphs (`nameFarEnd`, and `expandSameHost`'s
 * cache path). So only candidate relations with an open leg seed this fetch, which follows them port by port. A candidate with
 * no open leg reads no relational graph at all. Bounded by the chain, not a search: it never digs for a relation the cache did not show.
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraLudicPortAddress } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { ActorBoundaryRelations } from '../../../positions/ludicCache/actorCache'
import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'

/** The hosts holding every candidate relation's open legs: the only relations the cache cannot answer for alone. */
export const crossingSeedHosts = (
    objectIds: readonly EphemeraObjectId[],
    cache: ActorBoundaryRelations | undefined
): EphemeraMembershipHostId[] => [...new Set(
    objectIds.flatMap((objectId) => (cache?.boundaryRelationsOf(objectId) ?? [])
        .filter(({ far }) => far.kind === 'open')
        .map(({ moverHost }) => moverHost))
)]

/**
 * Every graph a crossing chain from `seeds` can touch: from each graph, the owner of every port-address terminal and the host
 * of every port is a further graph to visit. `known` graphs are used as they are (and still followed), so only unseen hosts are read.
 */
export const fetchChainGraphs = async (
    seeds: readonly EphemeraMembershipHostId[],
    known: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph | undefined>,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>,
    depthCap: number = 5
): Promise<Map<EphemeraMembershipHostId, EphemeraLudicGraph>> => {
    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
    const visited = new Set<EphemeraMembershipHostId>()
    let frontier = [...seeds]
    for (let depth = 0; frontier.length > 0 && depth < depthCap; depth += 1) {
        const next = new Set<EphemeraMembershipHostId>()
        await Promise.all(frontier.map(async (hostId) => {
            if (visited.has(hostId)) {
                return
            }
            visited.add(hostId)
            const graph = known.get(hostId) ?? await getGraph(hostId)
            graphs.set(hostId, graph)
            for (const port of graph.ports) {
                if (isEphemeraMembershipHostId(port.fromHostId) && !visited.has(port.fromHostId)) {
                    next.add(port.fromHostId)
                }
            }
            for (const edge of graph.relationalEdges) {
                for (const terminal of [edge.from, edge.to]) {
                    if (isEphemeraLudicPortAddress(terminal) && !visited.has(terminal.owner)) {
                        next.add(terminal.owner)
                    }
                }
            }
        }))
        frontier = [...next]
    }
    return graphs
}
