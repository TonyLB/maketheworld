/**
 * Node enumeration (CC1a), "a read, not a
 * traversal." Read the seed host's own `ludicGraph`; for every member that itself carries a
 * graph, fetch that shard and read its nodes; recurse. No edge is ever followed to discover a
 * node --- only `EphemeraLudicGraph.nodeIds` is consulted here, never `relationalEdges`/`ports`.
 *
 * This does not build `EphemeraLudicCacheNode`/`EphemeraLudicCacheData` (no `shortName`, no
 * `cover`, no edges) --- that is Slice 3's fold. This hands the fold the per-shard graphs it
 * needs, in walk order, already deduplicated.
 *
 * **A room's graph holds no character.** A bystander (a present character) is indexed by the room's
 * `LudicCache::Characters` row, never by the room's graph, so this walk never meets one except as the
 * seed. That is what keeps a room's cache from re-absorbing an object a character has just picked up
 * (`catalogHandles.ts`): the walk cannot pass through a character into its inventory. A character-seeded
 * walk (e.g. a held-inventory cache) still sees its own contents, because the seed is queued
 * unconditionally before the loop below runs. (Rule: `positions/AGENT.contract.md`, "A bystander is not in
 * its room's graph or cache".)
 *
 * **`maxDepth` (Slice 5, PC-3's instrument).** The highest BFS level actually visited --- the
 * seed is depth 0. A returned statistic, same convention as `shardFetchCount`: PC-3 needs reads
 * and wall time tagged by object count and nesting depth, and re-deriving depth later from
 * `hostIds`/`graphs` alone is not possible (walk order does not recover level), so it is tracked
 * during the walk instead.
 *
 * **Level-parallel BFS (Slice 5b, 2026-09-19).** Breadth is parallelizable; depth is not, and
 * the walk is now shaped around that asymmetry rather than around a single FIFO queue. Every
 * host at the current level is fetched concurrently (`Promise.all`), since a level's hosts were
 * all discovered from graphs already in hand and have no data dependency on each other. The next
 * level cannot start until the current one resolves, because a child's shard is only
 * *discoverable* by reading its parent's graph --- a chain of depth *d* remains *d* irreducible
 * sequential round trips. Dedup (`queued`) is still checked/updated entirely synchronously,
 * after `Promise.all` resolves and before the next round of fetches fires, so two siblings at
 * the same level naming the same not-yet-visited child still enqueue it exactly once.
 *
 * **Batching experiment tried and reverted (Slice 5c, 2026-09-19).** An optional
 * `getLudicGraphsBatch` dep briefly let a caller swap this per-level fetch for one
 * `BatchGetItem`, to test whether a single request scales more favourably than several
 * concurrent ones under an On-Demand table's burst capacity. Live numbers came back slower on
 * average than the concurrent-`getItem` path above, not faster, refuting the hypothesis; removed
 * rather than left disabled-in-place (live runs averaged about 386ms against about 316ms for the concurrent path).
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
    /** Hosts fetched but not expanded: a present character other than the seed. Their members are not in `hostIds`. */
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

    let shardFetchCount = 0
    let maxDepth = 0
    let frontier: EphemeraMembershipHostId[] = [seedHostId]
    let depth = 0
    while (frontier.length > 0) {
        maxDepth = Math.max(maxDepth, depth)
        const fetchedGraphs = await Promise.all(frontier.map((hostId) => getLudicGraph(hostId)))

        const nextFrontier: EphemeraMembershipHostId[] = []
        frontier.forEach((currentHostId, index) => {
            const graph = fetchedGraphs[index]
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
                nextFrontier.push(nodeId)
            }
        })

        frontier = nextFrontier
        depth += 1
    }

    return { hostIds, graphs, shardFetchCount, maxDepth }
}
