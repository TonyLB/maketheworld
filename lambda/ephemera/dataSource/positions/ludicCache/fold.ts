/**
 * The fold. Composes the node enumeration's `enumerateLudicCacheShards` (the cross-host walk) with
 * `cacheFromHostGraph` and the union (`unionCaches.ts`), as one rule:
 *
 * - **Each host's cache contribution is derived from its own raw graph alone**: its node, its bindings, and its
 *   same-host fold, including the legs still open at its authored crossing ports.
 * - **The contributions are reduced through the union**, which joins the two legs of a crossing port (the parent's
 *   and the child's) into one edge and leaves an unmatched leg open. There is no parent/child pairing here: the
 *   room's stored row and the actor's fold combine through the same function (`actorCache.ts`).
 *
 * `hostId` is recorded as `seedHostId`, never derived --- the same convention
 * `EphemeraLudicGraph` uses for its `rootId`: the caller-known identity, written straight in. `EphemeraLudicCacheData`
 * has no separate `rootId` field (CC0b) --- `hostId` already is that record.
 *
 * **3b (findings 5/6, terminal-triggered composition and recovery as one operation) is satisfied
 * for the cold-rebuild case by this walk alone**, not by new mechanism: every terminal
 * `enumerateLudicCacheShards` visits is resolved here in one pass, so nothing is ever
 * "recovered" because nothing was ever dropped. The warm/incremental case --- a single new
 * binding arriving against an *already-persisted* cache --- is not this file's: a stale persisted cache is rebuilt whole (see `positions/AGENT.contract.md`, Ludic cache staleness and rebuild).
 *
 * **3e (idempotence and confluence, LC2/LC3):** grouping by `collapsedEdgeIdentityKey`
 * (`mergeReducer.ts`) at cache-assembly grain, not only within each `cacheFromHostGraph` call, is what makes a retried rebuild against the same graphs produce a
 * byte-identical `edges` array --- see `fold.test.ts`'s "run twice" case.
 *
 * Tier: Prototype, inheriting `mergeReducer.ts`'s dependency tag and rollback trigger (this file
 * is now part of that rollback set --- see the plan's Tier section).
 *
 * **Return shape widened, Slice 5 (PC-3's instrument).** `buildLudicCache` now returns
 * `{ cache, stats }` rather than a bare `EphemeraLudicCacheData`. `stats` (`shardFetchCount`,
 * `maxDepth`) is threaded straight from `enumerateLudicCacheShards`, which already computed it and
 * previously had it discarded here. It does NOT become a field on `EphemeraLudicCacheData` itself
 * --- that type is the exact shape persistence stores, has its own type guard, and already carries
 * one documented lesson (`homeShards`, removed 2026-09-10) against denormalizing a derived fact
 * onto it. `stats` stays a sibling of `cache`, not a member of it.
 *
 * **Two-pass loop (Slice 5b, 2026-09-19).** `componentCacheNode` calls (awaited I/O,
 * `resolveComponentCacheFields`) for every `hostId` run concurrently via `Promise.all`; the synchronous
 * derivation runs after, iterated in `hostIds` order so 3e's byte-identical-rebuild property is preserved by
 * construction rather than by an accident of fetch order.
 */
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { stripTypedKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../../internalCache'
import { EphemeraLudicGraph, nodeFromId } from '../ludicGraph'
import { resolveComponentCacheFields } from '../../objects/objectShortName'
import { enumerateLudicCacheShards, type EnumerateLudicCacheShardsDeps } from './enumerateShards'
import { cacheFromHostGraph } from './cacheFromHostGraph'
import { unionAllLudicCaches } from './unionCaches'
import type { EphemeraLudicCacheData, EphemeraLudicCacheNode } from './types'

const presenceUuidFromKey = stripTypedKey('PRESENCE')

export type BuildLudicCacheDeps = EnumerateLudicCacheShardsDeps & {
    getComponentAggregate?: ComponentAggregateMergedCache['get']
}

const defaultDeps = (): Required<BuildLudicCacheDeps> => ({
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
})

const componentCacheNode = async (
    hostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: Required<BuildLudicCacheDeps>
): Promise<EphemeraLudicCacheNode> => {
    const node = nodeFromId(hostId)
    const { shortName, gloss } = await resolveComponentCacheFields(hostId, assetStack, deps)
    return { ...node, shortName, gloss, presenceNodes: [] } as EphemeraLudicCacheNode
}

export type BuildLudicCacheStats = {
    shardFetchCount: number
    maxDepth: number
}

export const buildLudicCache = async (
    seedHostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: BuildLudicCacheDeps = {}
): Promise<{ cache: EphemeraLudicCacheData; stats: BuildLudicCacheStats }> => {
    const resolvedDeps = { ...defaultDeps(), ...deps }
    const { hostIds, graphs, shardFetchCount, maxDepth } = await enumerateLudicCacheShards(seedHostId, resolvedDeps)

    // Pass 1: the only I/O in this loop (resolveComponentCacheFields, via componentCacheNode), run
    // concurrently across every host --- no data dependency between them.
    const nodes: EphemeraLudicCacheNode[] = await Promise.all(
        hostIds.map((hostId) => componentCacheNode(hostId, assetStack, resolvedDeps))
    )

    // Pass 2: the purely synchronous derivation, one cache contribution per host in hostIds order.
    // Each is read from that host's own raw graph alone: its node with its own bindings nested, and its
    // same-host fold (open crossing legs included). `presenceUuids` is the FULL set of this host's own
    // bindings (never a proper subset), satisfying `cacheFromHostGraph`'s clause-3 zero-or-all assertion
    // for an exhaustive rebuild. A node without a graph here is a bug in this function, not a data shape.
    const contributions = hostIds.map((hostId, index): EphemeraLudicCacheData => {
        const graph = graphs.get(hostId) as EphemeraLudicGraph
        const presenceUuids = graph.presenceNodes.map((presenceNode) => presenceUuidFromKey(presenceNode.universalKey))
        const { presenceNodes, edges } = cacheFromHostGraph(graph, presenceUuids)
        return { hostId, nodes: [{ ...nodes[index], presenceNodes }], edges }
    })

    // The one composition rule: a union, which also joins the two legs of each crossing port.
    const { nodes: nestedNodes, edges } = unionAllLudicCaches(seedHostId, contributions)

    return {
        cache: { hostId: seedHostId, nodes: nestedNodes, edges },
        stats: { shardFetchCount, maxDepth },
    }
}
