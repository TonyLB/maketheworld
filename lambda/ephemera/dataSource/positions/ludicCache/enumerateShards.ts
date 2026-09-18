/**
 * Slice 2 of `AGENT.ludicCacheRebuild.planning.md`: node enumeration (CC1a), "a read, not a
 * traversal." Read the seed host's own `ludicGraph`; for every member that itself carries a
 * graph, fetch that shard and read its nodes; recurse. No edge is ever followed to discover a
 * node --- only `EphemeraLudicGraph.nodeIds` is consulted here, never `relationalEdges`/`ports`.
 *
 * This does not build `EphemeraLudicCacheNode`/`EphemeraLudicCacheData` (no `shortName`, no
 * `cover`, no edges) --- that is Slice 3's fold. This hands the fold the per-shard graphs it
 * needs, in walk order, already deduplicated.
 */
import internalCache from '../../../internalCache'
import { isEphemeraMembershipHostId, type EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../ludicGraph'

export type EnumerateLudicCacheShardsDeps = {
    getLudicGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type EnumerateLudicCacheShardsResult = {
    /** Walk order, seed host first. Each id appears exactly once. */
    hostIds: EphemeraMembershipHostId[]
    graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph>
    /** One increment per host actually fetched --- a returned statistic, not a log line. */
    shardFetchCount: number
}

const defaultDeps = (): Required<EnumerateLudicCacheShardsDeps> => ({
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
})

/**
 * Membership is a DAG, not a tree (H3 clause 6) --- a node reachable by two paths, or even a
 * true back-reference, is the normal case. The guard is the visited/queued set itself: a host
 * is fetched at most once regardless of how many members name it.
 */
export async function enumerateLudicCacheShards(
    seedHostId: EphemeraMembershipHostId,
    deps: EnumerateLudicCacheShardsDeps = {}
): Promise<EnumerateLudicCacheShardsResult> {
    const { getLudicGraph } = { ...defaultDeps(), ...deps }

    const hostIds: EphemeraMembershipHostId[] = []
    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
    const queued = new Set<EphemeraMembershipHostId>([seedHostId])
    const queue: EphemeraMembershipHostId[] = [seedHostId]

    let shardFetchCount = 0
    while (queue.length > 0) {
        const currentHostId = queue.shift() as EphemeraMembershipHostId
        const graph = await getLudicGraph(currentHostId)
        shardFetchCount += 1
        hostIds.push(currentHostId)
        graphs.set(currentHostId, graph)

        for (const nodeId of graph.nodeIds) {
            if (!isEphemeraMembershipHostId(nodeId)) {
                continue
            }
            if (queued.has(nodeId)) {
                continue
            }
            queued.add(nodeId)
            queue.push(nodeId)
        }
    }

    return { hostIds, graphs, shardFetchCount }
}
