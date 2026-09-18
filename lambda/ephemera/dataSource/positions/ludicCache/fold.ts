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
 * `computeCarryClosure` (`ludicGraph/expandValidate/interactionUnderTransfer.ts`) already uses
 * for a graph's `rootId`: the caller-known identity, written straight in. `EphemeraLudicCacheData`
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
 */
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID, isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { stripTypedKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../../internalCache'
import { EphemeraLudicGraph, nodeFromId } from '../ludicGraph'
import { resolveObjectShortName } from '../../objects/objectShortName'
import { enumerateLudicCacheShards, type EnumerateLudicCacheShardsDeps } from './enumerateShards'
import { collapseCrossingPorts, collapsedEdgeIdentityKey, foldSameHostBuckets } from './mergeReducer'
import type { EphemeraLudicCacheData, EphemeraLudicCacheEdge, EphemeraLudicCacheNode } from './types'

const presenceUuidFromKey = stripTypedKey('PRESENCE')

export type BuildLudicCacheDeps = EnumerateLudicCacheShardsDeps & {
    getComponentAggregate?: ComponentAggregateMergedCache['get']
    getImprovisationObject?: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent } | undefined>
}

const defaultDeps = (): Required<BuildLudicCacheDeps> => ({
    getLudicGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
    // Mirrors roomObjectCatalogForCharacter.ts's defaultDeps --- the same two accessors
    // resolveObjectShortName needs, wired to the same internalCache singletons.
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
    getImprovisationObject: (objectId) => internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
})

const addEdges = (byIdentity: Map<string, EphemeraLudicCacheEdge>, edges: EphemeraLudicCacheEdge[]): void => {
    edges.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, supportedBy: [...existing.supportedBy, ...edge.supportedBy] } : edge)
    })
}

/**
 * **`shortName` is object-only today.** `objects/objectShortName.ts`'s merged-aggregate
 * resolution has no equivalent for Room/Character/Feature/Area --- this session's own scoping
 * decision (2026-09-18) is to resolve it inline for objects, via the same `assetStack`-keyed
 * lookup `roomObjectCatalogForCharacter.ts` already uses, and fall back to the host's own id as
 * a placeholder for every other component kind. **This is a recorded gap, not a design
 * decision:** whoever builds a Room/Character/Feature/Area shortName resolver replaces the
 * placeholder branch below, not the object branch.
 */
const componentCacheNode = async (
    hostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: Required<BuildLudicCacheDeps>
): Promise<EphemeraLudicCacheNode> => {
    const node = nodeFromId(hostId)
    const shortName = isEphemeraObjectId(hostId)
        ? (await resolveObjectShortName(hostId, assetStack, deps)) ?? hostId
        : hostId
    return { ...node, shortName } as EphemeraLudicCacheNode
}

export const buildLudicCache = async (
    seedHostId: EphemeraMembershipHostId,
    assetStack: readonly string[],
    deps: BuildLudicCacheDeps = {}
): Promise<EphemeraLudicCacheData> => {
    const resolvedDeps = { ...defaultDeps(), ...deps }
    const { hostIds, graphs } = await enumerateLudicCacheShards(seedHostId, resolvedDeps)

    const nodes: EphemeraLudicCacheNode[] = []
    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()

    for (const hostId of hostIds) {
        const graph = graphs.get(hostId) as EphemeraLudicGraph

        nodes.push(await componentCacheNode(hostId, assetStack, resolvedDeps))

        // Mechanism 1: this host's own same-host presence-bucket straddles, resolved against its
        // own raw graph. `presenceUuids` is the FULL set of this host's own bindings (never a
        // proper subset), satisfying `foldSameHostBuckets`'s clause-3 zero-or-all assertion for
        // an exhaustive rebuild.
        const presenceUuids = graph.presenceNodes.map((presenceNode) => presenceUuidFromKey(presenceNode.universalKey))
        const { nodes: presenceNodes, edges: sameHostEdges } = foldSameHostBuckets(graph, presenceUuids)
        nodes.push(...presenceNodes)
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

    return { hostId: seedHostId, nodes, edges: [...byIdentity.values()] }
}
