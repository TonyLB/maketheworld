import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type {
    EphemeraLudicGraphComponentNode,
    EphemeraLudicGraphStructureNode,
    EphemeraLudicRelationalEdgeData,
    EphemeraPresenceCover,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    isEphemeraLudicGraphComponentNode,
    isEphemeraLudicGraphStructureNode,
    isEphemeraLudicRelationalEdgeData,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

//
// EphemeraLudicCacheData --- the ludicCache prototype's type contract (CC0b).
//
// Fulfils the naming reservation held by internalCache/AGENT.md for AB-35's
// cross-host denormalized read structure (P6, AGENT.abstractionLayers.planning.md).
// Stays out of mtw-interfaces on maturity grounds (one consumer, live rollback
// trigger) --- see CC0b for the reasoning. If it graduates, it is the same type
// moving packages, not a rename.
//
// EphemeraMembershipHostId (mtw-interfaces/ephemeraPositionAdjacency.ts) is
// EphemeraRoomId | EphemeraCharacterId | EphemeraObjectId | EphemeraFeatureId
// | EphemeraAreaId, so `chains`/`hostId` already admit OBJECT#/FEATURE# ---
// no cache-local alias is needed for CC1a's recursion on that account. CC1a
// still has open findings unrelated to this type, tracked in
// AGENT.abstractionLayers.planning.md.
//

/**
 * Cache node: an EphemeraLudicGraphNode superset.
 *
 * **`homeShards` removed 2026-09-10** (the bucket-membership fact it carried is already on the
 * graph's own presence ports; see `AGENT.presence.planning.md`'s PR-8). It used to
 * carry "which shard(s) is this node home to," but that fact is already denormalized onto the
 * graph's own presence ports (`EphemeraPresencePort.fromHostId`), which `subGraphFromNodes`
 * carries through regardless of bucket --- a node-level field duplicated a fact the graph already
 * states. No producer or consumer of this type existed at removal time.
 */
export type EphemeraLudicCacheNode =
    | (EphemeraLudicGraphComponentNode & {
        shortName: string;
        /** Iteration 1: attached by a separate attachEmbeddings pass, not by the rebuild (CC1c). */
        embedding?: SemanticEmbedding;
        /** Stored, never derived --- see CC0's box-can-be-empty argument against deriving this.
         * Deletion tracked by PN-7 (presenceNodes Slice 4); not this type's structure arm's concern. */
        interiorConsolidated: boolean;
    })
    /**
     * A presence node's cache extras (presenceNodes Slice 3, PN-19 decided (b)): `cover` is
     * narrowed to the `'Enumerated'` arm only --- `'Full'` ("every node of the host") has no
     * referent in a multi-host merge (loss (A)), so this makes it unrepresentable in the cache
     * *by construction* rather than by a runtime guard someone could forget. `consolidated`
     * stays a separate boolean beside `cover` (PN-15) rather than folding into it --- two facts,
     * not three. **Not yet populated with real data**: Slice 4 (PN-7) is what mints a presence
     * node into a cache and writes `consolidated`/an enumerated `cover` for the first time; this
     * slice only types the shape.
     */
    | (Omit<EphemeraLudicGraphStructureNode, 'cover'> & {
        cover: Extract<EphemeraPresenceCover, { tag: 'Enumerated' }>;
        consolidated: boolean;
    })

/**
 * Cache edge: the ludicGraph edge plus `chains`. Required and possibly empty, never optional ---
 * see CC0.
 *
 * `chains: EphemeraMembershipHostId[][]` --- one array per independently-consolidated route to
 * this edge identity (`AGENT.presence.planning.md`'s PR-8), each an ordered list of the
 * hosts entered, one per consolidated boundary hop. **Superseded 2026-09-10:** this field used to
 * carry `EphemeraLudicCacheCrossing[][]`, `EphemeraLudicCacheCrossing` being `{ edgeText: string;
 * into: EphemeraMembershipHostId }`. `edgeText` traced to a 2026-08-06 premise --- "edge kinds
 * across a crossing port need not match" --- whose only supporting case (a power cord threading
 * into a flashlight, described differently inside and out) is itself flagged stale
 * (`positions/AGENT.concepts.md`, AB-57). This initiative's own LR-1 instead re-derives the
 * port-qualified-terminal case from a same-kind example (`cup -[TiedTo]-> string`, both legs
 * sharing `kind`), so a hop has no per-leg description left to carry --- only the host entered.
 * `EphemeraLudicCacheCrossing` and `isEphemeraLudicCacheCrossing` are removed accordingly.
 */
export type EphemeraLudicCacheEdge = EphemeraLudicRelationalEdgeData & {
    chains: EphemeraMembershipHostId[][];
}

export type EphemeraLudicCacheData = {
    hostId: EphemeraMembershipHostId;
    nodes: EphemeraLudicCacheNode[];
    edges: EphemeraLudicCacheEdge[];
}

export const isEphemeraLudicCacheNode = (value: unknown): value is EphemeraLudicCacheNode => {
    if (isEphemeraLudicGraphStructureNode(value)) {
        // Delegates the shared shape (tag/universalKey/fromHostId/cover) to the graph guard,
        // then narrows: 'Full' cover is illegal in the cache (PN-19), and `consolidated` is a
        // cache-only field the graph-side guard knows nothing about.
        if (value.cover.tag !== 'Enumerated') {
            return false
        }
        return typeof (value as unknown as { consolidated: unknown }).consolidated === 'boolean'
    }
    if (!isEphemeraLudicGraphComponentNode(value)) {
        return false
    }
    const node = value as EphemeraLudicCacheNode & EphemeraLudicGraphComponentNode
    if (typeof node.shortName !== 'string') {
        return false
    }
    if (node.embedding !== undefined && !(node.embedding instanceof SemanticEmbedding)) {
        return false
    }
    if (typeof node.interiorConsolidated !== 'boolean') {
        return false
    }
    return true
}

export const isEphemeraLudicCacheEdge = (value: unknown): value is EphemeraLudicCacheEdge => {
    if (!isEphemeraLudicRelationalEdgeData(value)) {
        return false
    }
    const edge = value as EphemeraLudicCacheEdge
    if (
        !Array.isArray(edge.chains)
        || !edge.chains.every((chain) => (
            Array.isArray(chain)
            && chain.every((hop) => typeof hop === 'string' && isEphemeraMembershipHostId(hop))
        ))
    ) {
        return false
    }
    return true
}

export const isEphemeraLudicCacheData = (value: unknown): value is EphemeraLudicCacheData => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const cache = value as EphemeraLudicCacheData
    if (typeof cache.hostId !== 'string' || !isEphemeraMembershipHostId(cache.hostId)) {
        return false
    }
    if (!Array.isArray(cache.nodes) || !cache.nodes.every((entry) => isEphemeraLudicCacheNode(entry))) {
        return false
    }
    if (!Array.isArray(cache.edges) || !cache.edges.every((entry) => isEphemeraLudicCacheEdge(entry))) {
        return false
    }
    return true
}
