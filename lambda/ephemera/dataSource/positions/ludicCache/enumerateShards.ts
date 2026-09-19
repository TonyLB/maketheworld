/**
 * Slice 2 of `AGENT.ludicCacheRebuild.planning.md`: node enumeration (CC1a), "a read, not a
 * traversal." Read the seed host's own `ludicGraph`; for every member that itself carries a
 * graph, fetch that shard and read its nodes; recurse. No edge is ever followed to discover a
 * node --- only `EphemeraLudicGraph.nodeIds` is consulted here, never `relationalEdges`/`ports`.
 *
 * This does not build `EphemeraLudicCacheNode`/`EphemeraLudicCacheData` (no `shortName`, no
 * `cover`, no edges) --- that is Slice 3's fold. This hands the fold the per-shard graphs it
 * needs, in walk order, already deduplicated.
 *
 * **A character member is never recursed into (Slice 4 bugfix, 2026-09-18).** `EphemeraCharacterId`
 * is itself an `EphemeraMembershipHostId`, so a naive walk over `graph.nodeIds` would fetch every
 * present character's own shard and pull their held inventory in as nodes of the *seed's* cache
 * --- observed as a real regression via `catalogHandles.ts`: a room's cache re-absorbed an object
 * a character had just picked up, since the walk passed straight through the character who now
 * held it. `collectNestedObjectIds` (the mechanism this cache replaces) never had this problem
 * because it only ever recursed through `EphemeraObjectId`s. The seed itself is exempt from this
 * guard --- it is queued unconditionally before the loop below runs --- so a future
 * character-seeded walk (e.g. a held-inventory cache) still sees its own contents.
 *
 * **`maxDepth` (Slice 5, PC-3's instrument).** The highest BFS level actually dequeued --- the
 * seed is depth 0. A returned statistic, same convention as `shardFetchCount`: PC-3 needs reads
 * and wall time tagged by object count and nesting depth, and re-deriving depth later from
 * `hostIds`/`graphs` alone is not possible (walk order does not recover level), so it is tracked
 * during the walk instead.
 */
import internalCache from '../../../internalCache'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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
    /** The highest BFS level dequeued, seed at 0 --- a returned statistic, not a log line. */
    maxDepth: number
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
    const queue: { hostId: EphemeraMembershipHostId; depth: number }[] = [{ hostId: seedHostId, depth: 0 }]

    let shardFetchCount = 0
    let maxDepth = 0
    while (queue.length > 0) {
        const { hostId: currentHostId, depth } = queue.shift() as { hostId: EphemeraMembershipHostId; depth: number }
        maxDepth = Math.max(maxDepth, depth)
        const graph = await getLudicGraph(currentHostId)
        shardFetchCount += 1
        hostIds.push(currentHostId)
        graphs.set(currentHostId, graph)

        for (const nodeId of graph.nodeIds) {
            if (!isEphemeraMembershipHostId(nodeId)) {
                continue
            }
            if (isEphemeraCharacterId(nodeId)) {
                continue
            }
            if (queued.has(nodeId)) {
                continue
            }
            queued.add(nodeId)
            queue.push({ hostId: nodeId, depth: depth + 1 })
        }
    }

    return { hostIds, graphs, shardFetchCount, maxDepth }
}
