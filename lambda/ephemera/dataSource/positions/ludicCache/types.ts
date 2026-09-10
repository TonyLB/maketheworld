import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type {
    EphemeraLudicGraphNode,
    EphemeraLudicRelationalEdgeData,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicGraphNode, isEphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
// KNOWN NARROWNESS, deliberate and load-bearing for the next step (CC1a):
// `homeShards` and `crossings.into` are EphemeraMembershipHostId, which is
// ROOM# | CHARACTER# and EXCLUDES OBJECT#. The cache's own premise is nested
// *object* shards, so CC1a's recursion cannot be written against these types as
// they stand. Left narrow rather than widened here on CC0's `Area` discipline
// --- the widening rides in on the change that makes objects hosts, which is
// CC1a. Prefer a cache-local alias there (EphemeraMembershipHostId |
// EphemeraObjectId) over re-typing shipped adjacency rows in mtw-interfaces.
//

/** Cache node: an EphemeraLudicGraphNode superset. */
export type EphemeraLudicCacheNode = EphemeraLudicGraphNode & {
    shortName: string;
    /**
     * Shards this node is present in --- the shards to traverse from (universalKey
     * alone does not say which). Required and possibly singleton, never scalar: a
     * whole is multi-hosted whenever its ports bind into more than one host (a
     * string lying across a table, through a room, into a box), and a scalar would
     * silently drop that extent. Same uniformity as `crossings` --- the common
     * single-hosted case is a one-element list, and nothing branches on cardinality.
     *
     * Non-emptiness is a rebuild invariant (CC1a enumerates each node out of a
     * shard), not a structural one, so the guard below admits `[]`.
     */
    homeShards: EphemeraMembershipHostId[];
    /** Iteration 1: attached by a separate attachEmbeddings pass, not by the rebuild (CC1c). */
    embedding?: SemanticEmbedding;
    /** Stored, never derived --- see CC0's box-can-be-empty argument against deriving this. */
    interiorConsolidated: boolean;
}

/**
 * Cache edge: the ludicGraph edge plus `chains`. Required and possibly empty, never optional ---
 * see CC0.
 *
 * `chains: EphemeraMembershipHostId[][]` --- one array per independently-consolidated route to
 * this edge identity (LR-8, `AGENT.ludicCacheReducer.planning.md`), each an ordered list of the
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
    if (!isEphemeraLudicGraphNode(value)) {
        return false
    }
    const node = value as EphemeraLudicCacheNode
    if (typeof node.shortName !== 'string') {
        return false
    }
    if (
        !Array.isArray(node.homeShards)
        || !node.homeShards.every((entry) => typeof entry === 'string' && isEphemeraMembershipHostId(entry))
    ) {
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
