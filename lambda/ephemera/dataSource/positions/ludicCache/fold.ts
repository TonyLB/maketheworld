/**
 * Slice 3 (3a/3b/3e) of `AGENT.ludicCacheRebuild.planning.md`: the fold. Composes Slice 2's
 * `enumerateLudicCacheShards` (the cross-host walk, unmodified) with two mechanisms that already
 * shipped separately and don't yet talk to each other in code:
 *
 * - `foldSameHostBuckets` (Slice 0/2) resolves a single host's own same-host presence-bucket
 *   straddles against its own raw graph.
 * - `collapseCrossingPorts` (pre-existing) resolves the membership boundary between a parent
 *   host and a child that carries its own graph.
 *
 * **These run against the same unmodified per-shard graphs `enumerateLudicCacheShards` already
 * fetched, not sequentially on one another's output.** A crossing port is authored on a child's
 * raw graph regardless of which presence bucket a cut would place it in (Slice 7a: presence
 * carries no port record any more), so same-host resolution and parent/child collapse are two
 * independent contributions to the final edge set, not a pipeline.
 *
 * `hostId` is recorded as `seedHostId`, never derived --- the same convention
 * `EphemeraLudicGraph` uses for its `rootId`: the caller-known identity, written straight in. `EphemeraLudicCacheData`
 * has no separate `rootId` field (CC0b) --- `hostId` already is that record.
 *
 * **3b (findings 5/6, terminal-triggered composition and recovery as one operation) is satisfied
 * for the cold-rebuild case by this walk alone**, not by new mechanism: every terminal
 * `enumerateLudicCacheShards` visits is resolved here in one pass, so nothing is ever
 * "recovered" because nothing was ever dropped. The warm/incremental case --- a single new
 * binding arriving against an *already-persisted* cache --- is Slice 6/D4's, not this file's.
 *
 * **3e (idempotence and confluence, LC2/LC3):** grouping by `collapsedEdgeIdentityKey`
 * (`mergeReducer.ts`) at cache-assembly grain, not only within each `collapseCrossingPorts`/
 * `foldSameHostBuckets` call, is what makes a retried rebuild against the same graphs produce a
 * byte-identical `edges` array --- see `fold.test.ts`'s "run twice" case.
 *
 * Tier: Prototype, inheriting `mergeReducer.ts`'s dependency tag and rollback trigger (this file
 * is now part of that rollback set --- see the plan's Tier section).
 *
 * **Return shape widened, Slice 5 (PC-3's instrument).** `buildLudicCache` now returns
 * `{ cache, stats }` rather than a bare `EphemeraLudicCacheData`. `stats` (`shardFetchCount`,
 * `maxDepth`) is threaded straight from `enumerateLudicCacheShards`, which already computed it and
 * previously had it discarded here. It does NOT become a field on `EphemeraLudicCacheData` itself
 * --- that type is the exact shape Slice 6 persists, has its own type guard, and already carries
 * one documented lesson (`homeShards`, removed 2026-09-10) against denormalizing a derived fact
 * onto it. `stats` stays a sibling of `cache`, not a member of it.
 *
 * **Two-pass loop (Slice 5b, 2026-09-19).** The former single `for` loop interleaved
 * `componentCacheNode`'s awaited I/O (`resolveComponentCacheFields`) with two purely synchronous
 * computations (`foldSameHostBuckets`, `collapseCrossingPorts`), serializing all three across
 * every host for no reason the synchronous pair needed. `componentCacheNode` calls for every
 * `hostId` now run concurrently via `Promise.all`; the synchronous fold/collapse pass runs after,
 * still iterated in `hostIds` order so 3e's byte-identical-rebuild property is preserved by
 * construction rather than by an accident of fetch order.
 */
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { stripTypedKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../../internalCache'
import { EphemeraLudicGraph, nodeFromId } from '../ludicGraph'
import { resolveComponentCacheFields } from '../../objects/objectShortName'
import { enumerateLudicCacheShards, type EnumerateLudicCacheShardsDeps } from './enumerateShards'
import { collapseCrossingPorts, collapsedEdgeIdentityKey, foldSameHostBuckets } from './mergeReducer'
import type { EphemeraLudicCacheData, EphemeraLudicCacheEdge, EphemeraLudicCacheNode, EphemeraLudicCachePresenceNode } from './types'

const presenceUuidFromKey = stripTypedKey('PRESENCE')

export type BuildLudicCacheDeps = EnumerateLudicCacheShardsDeps & {
    getComponentAggregate?: ComponentAggregateMergedCache['get']
}

const defaultDeps = (): Required<BuildLudicCacheDeps> => ({
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
})

const addEdges = (byIdentity: Map<string, EphemeraLudicCacheEdge>, edges: EphemeraLudicCacheEdge[]): void => {
    edges.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, supportedBy: [...existing.supportedBy, ...edge.supportedBy] } : edge)
    })
}

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

    // Pass 2: the purely synchronous fold/collapse computation, iterated in hostIds order.
    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    const bindingsByOwner = new Map<EphemeraMembershipHostId, EphemeraLudicCachePresenceNode[]>()

    for (const hostId of hostIds) {
        const graph = graphs.get(hostId) as EphemeraLudicGraph

        // Mechanism 1: this host's own same-host presence-bucket straddles, resolved against its
        // own raw graph. `presenceUuids` is the FULL set of this host's own bindings (never a
        // proper subset), satisfying `foldSameHostBuckets`'s clause-3 zero-or-all assertion for
        // an exhaustive rebuild.
        const presenceUuids = graph.presenceNodes.map((presenceNode) => presenceUuidFromKey(presenceNode.universalKey))
        // Each covered member's own bindings into this host, read from the member's graph; none
        // when the member was placed without a move and never had a binding minted.
        const memberBindings = (member: string) => (graphs.get(member as EphemeraMembershipHostId)?.presenceNodes ?? [])
            .filter((presenceNode) => presenceNode.fromHostId === hostId)
            .map((presenceNode) => presenceNode.universalKey)
        const { presenceNodes, edges: sameHostEdges } = foldSameHostBuckets(graph, presenceUuids, memberBindings)
        bindingsByOwner.set(hostId, presenceNodes)
        addEdges(byIdentity, sameHostEdges)

        // Mechanism 2: the parent/child crossing-port boundary between this host and every
        // member walked as its own shard. A member with no crossing ports contributes nothing
        // (collapseCrossingPorts's own "incomplete data, not an error" stance), so it costs
        // nothing to attempt this uniformly rather than pre-filtering "true" members.
        for (const nodeId of graph.nodeIds) {
            if (nodeId === hostId || !isEphemeraMembershipHostId(nodeId)) {
                continue
            }
            const childGraph = graphs.get(nodeId)
            if (!childGraph) {
                continue
            }
            const binding = childGraph.presenceNodes.find((presenceNode) => presenceNode.fromHostId === hostId)
            if (!binding) {
                continue
            }
            addEdges(byIdentity, collapseCrossingPorts(graph, childGraph, presenceUuidFromKey(binding.universalKey)))
        }
    }

    // Each host's own bindings nest on its component node. Pass 1 built one node per hostId, so
    // an owner without one is a bug in this function, not a data shape.
    const ownerIds = new Set<string>(nodes.map((node) => node.universalKey))
    const unowned = [...bindingsByOwner.keys()].filter((hostId) => !ownerIds.has(hostId))
    if (unowned.length) {
        throw new Error(`buildLudicCache: no component node for binding owner(s) ${unowned.join(', ')}`)
    }
    const nestedNodes = nodes.map((node) => ({ ...node, presenceNodes: bindingsByOwner.get(node.universalKey as EphemeraMembershipHostId) ?? [] }))

    return {
        cache: { hostId: seedHostId, nodes: nestedNodes, edges: [...byIdentity.values()] },
        stats: { shardFetchCount, maxDepth },
    }
}
