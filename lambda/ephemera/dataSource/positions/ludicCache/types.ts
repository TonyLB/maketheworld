import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type {
    EphemeraLudicGraphComponentNode,
    EphemeraLudicGraphStructureNode,
    EphemeraLudicRelationalEdgeData,
    EphemeraPresenceCoverEntry,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    isEphemeraLudicGraphComponentNode,
    isEphemeraLudicRelationalEdgeData,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
 * Cache node: a component node of one walked host, carrying that host's own bindings.
 *
 * `presenceNodes` mirrors `EphemeraLudicGraph.presenceNodes`: in a graph the container names the
 * owner, and here the node does, so a binding without an owner is unrepresentable. Required, `[]`
 * when the host has none: every cache node is a walked host whose graph was read, so `[]` is a
 * true "none", not "unread".
 *
 * **`homeShards` removed 2026-09-10** (the bucket-membership fact it carried is already on the
 * graph's own presence ports; see `AGENT.presence.planning.md`'s PR-8). It used to
 * carry "which shard(s) is this node home to," but that fact is already denormalized onto the
 * graph's own presence ports (`EphemeraPresencePort.fromHostId`), which `subGraphFromNodes`
 * carries through regardless of bucket --- a node-level field duplicated a fact the graph already
 * states. No producer or consumer of this type existed at removal time.
 */
export type EphemeraLudicCacheNode = EphemeraLudicGraphComponentNode & {
    /** `undefined` means unresolved --- no equality-with-id inference (see `catalogHandles.ts`). */
    shortName?: string;
    /** `undefined` means unresolved or absent --- `Gloss` is optional on every kind, so no sentinel is needed. */
    gloss?: string;
    /** Iteration 1: attached by a separate attachEmbeddings pass, not by the rebuild (CC1c). */
    embedding?: SemanticEmbedding;
    presenceNodes: EphemeraLudicCachePresenceNode[];
}

/**
 * One of a host's own bindings, nested on that host's `EphemeraLudicCacheNode`
 * (presenceNodes Slice 3, PN-19 decided (b)): `cover` is
 * narrowed to the `'Enumerated'` arm only --- `'Full'` ("every node of the host") has no
 * referent in a multi-host merge (loss (A)), so this makes it unrepresentable in the cache
 * *by construction* rather than by a runtime guard someone could forget. `consolidated`
 * stays a separate boolean beside `cover` (PN-15) rather than folding into it --- two facts,
 * not three. Minted by `mergeReducer.ts`'s `foldSameHostBuckets` (via its
 * `presenceCacheNodesFromFold` helper), one per binding folded, `consolidated: true`. Each cover
 * entry names the member's own binding into this binding's host (`EphemeraLudicCacheCoverEntry`).
 */
export type EphemeraLudicCachePresenceNode = Omit<EphemeraLudicGraphStructureNode, 'cover'> & {
    cover: { tag: 'Enumerated'; members: EphemeraLudicCacheCoverEntry[] };
    consolidated: boolean;
}

/**
 * A cache cover entry: `host` is covered, and `presence` names which of `host`'s own bindings
 * (into the covering binding's host) is meant. The graph-side `EphemeraPresenceCoverEntry`
 * requires `presence`; here it is optional because the cache expands a graph-side `'Full'` cover,
 * which has no entries, into an `'Enumerated'` list, and must look each member's binding up in
 * the member's own graph. That lookup can come back empty --- e.g. a thing placed without a move,
 * which never had a binding minted --- and the member is still covered, so the entry stays
 * with `presence` absent. Entries copied from a graph-side `'Enumerated'` cover always carry it.
 */
export type EphemeraLudicCacheCoverEntry = Omit<EphemeraPresenceCoverEntry, 'presence'> & {
    presence?: EphemeraPresenceNodeId;
}

/**
 * One hop of one route through `supportedBy` --- the crossing port this hop travels through
 * (`port`, "the hop's key for consolidation"), and the set of presence bindings that could
 * independently justify having traveled it (`presenceBucketIds`, OR within the hop: any one of
 * them is enough). Identified by their own `PRESENCE#` id rather than by the host they bind,
 * since a host may carry more than one binding (PN-22's *one or more* quantifier) and the hop's
 * justification is binding-grained, not host-grained.
 */
export type EphemeraLudicCacheSupportHop = {
    presenceBucketIds: EphemeraPresenceNodeId[];
    port: string;
}

/**
 * One independently-consolidated route to an edge identity: an ORDERED list of hops, AND across
 * the route --- every hop must hold for the route itself to hold.
 */
export type EphemeraLudicCacheSupport = EphemeraLudicCacheSupportHop[]

/**
 * Cache edge: the ludicGraph edge plus `supportedBy`. Required and possibly empty, never
 * optional --- see CC0.
 *
 * `supportedBy: EphemeraLudicCacheSupport[]` --- OR over routes (the outer array), AND across
 * one route's hops, OR within one hop's `presenceBucketIds` (D8, amended 2026-09-16 by PN-2).
 * `[]` means exactly *depends on no binding* and nothing else --- the two-meanings defect the
 * flat predecessor field risked is closed by this element type, not by convention.
 *
 * **Renamed from `chains: EphemeraMembershipHostId[][]` (presenceNodes Slice 4, PN-2/D8).** The
 * old field named one HOST entered per hop; a flat sum-of-products over hosts is a DNF encoding
 * of what is really a product-of-sums over bindings --- *h* hops with *k* alternatives each
 * expand to k^h entries carrying k·h facts under the flat form, tractable only under the nested
 * one. `collapseSameHostStubs`/`foldSameHostBuckets`'s same-host routes still resolve to `[]`
 * (D11: a same-host edge's dependence is a **membership** fact, now carried on the node record,
 * not a traversal fact --- the traversal register is honestly empty for it). **Superseded
 * 2026-09-10:** this field used to carry `EphemeraLudicCacheCrossing[][]`, `EphemeraLudicCacheCrossing`
 * being `{ edgeText: string; into: EphemeraMembershipHostId }`. `edgeText` traced to a 2026-08-06
 * premise --- "edge kinds across a crossing port need not match" --- whose only supporting case (a
 * power cord threading into a flashlight, described differently inside and out) is itself flagged
 * stale (`positions/AGENT.concepts.md`, AB-57). This initiative's own LR-1 instead re-derives the
 * port-qualified-terminal case from a same-kind example (`cup -[TiedTo]-> string`, both legs
 * sharing `kind`), so a hop has no per-leg description left to carry --- only what justifies it.
 * `EphemeraLudicCacheCrossing` and `isEphemeraLudicCacheCrossing` are removed accordingly.
 */
export type EphemeraLudicCacheEdge = EphemeraLudicRelationalEdgeData & {
    supportedBy: EphemeraLudicCacheSupport[];
}

export type EphemeraLudicCacheData = {
    hostId: EphemeraMembershipHostId;
    nodes: EphemeraLudicCacheNode[];
    edges: EphemeraLudicCacheEdge[];
}

const isEphemeraLudicCacheCoverEntry = (value: unknown): value is EphemeraLudicCacheCoverEntry => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as { host?: unknown; presence?: unknown }
    return typeof entry.host === 'string' && isEphemeraMembershipHostId(entry.host)
        && (entry.presence === undefined || (typeof entry.presence === 'string' && isEphemeraPresenceNodeId(entry.presence)))
}

// Checked here rather than through the graph-side structure guard, whose cover check requires
// `presence` on every entry (see `EphemeraLudicCacheCoverEntry`). 'Full' cover is illegal in the
// cache (PN-19), and `consolidated` is cache-only.
export const isEphemeraLudicCachePresenceNode = (value: unknown): value is EphemeraLudicCachePresenceNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const node = value as { tag?: unknown; universalKey?: unknown; fromHostId?: unknown; cover?: { tag?: unknown; members?: unknown }; consolidated?: unknown }
    return node.tag === 'Presence'
        && typeof node.universalKey === 'string' && isEphemeraPresenceNodeId(node.universalKey)
        && typeof node.fromHostId === 'string' && isEphemeraMembershipHostId(node.fromHostId)
        && !!node.cover && node.cover.tag === 'Enumerated'
        && Array.isArray(node.cover.members)
        && node.cover.members.every((entry: unknown) => isEphemeraLudicCacheCoverEntry(entry))
        && typeof node.consolidated === 'boolean'
}

export const isEphemeraLudicCacheNode = (value: unknown): value is EphemeraLudicCacheNode => {
    if (!isEphemeraLudicGraphComponentNode(value)) {
        return false
    }
    const node = value as EphemeraLudicCacheNode
    if (!Array.isArray(node.presenceNodes) || !node.presenceNodes.every((binding) => isEphemeraLudicCachePresenceNode(binding))) {
        return false
    }
    if (node.shortName !== undefined && typeof node.shortName !== 'string') {
        return false
    }
    if (node.gloss !== undefined && typeof node.gloss !== 'string') {
        return false
    }
    if (node.embedding !== undefined && !(node.embedding instanceof SemanticEmbedding)) {
        return false
    }
    return true
}

const isEphemeraLudicCacheSupportHop = (value: unknown): value is EphemeraLudicCacheSupportHop => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const hop = value as EphemeraLudicCacheSupportHop
    return typeof hop.port === 'string'
        && Array.isArray(hop.presenceBucketIds)
        && hop.presenceBucketIds.every((id) => typeof id === 'string' && isEphemeraPresenceNodeId(id))
}

const isEphemeraLudicCacheSupport = (value: unknown): value is EphemeraLudicCacheSupport =>
    Array.isArray(value) && value.every((hop) => isEphemeraLudicCacheSupportHop(hop))

export const isEphemeraLudicCacheEdge = (value: unknown): value is EphemeraLudicCacheEdge => {
    if (!isEphemeraLudicRelationalEdgeData(value)) {
        return false
    }
    const edge = value as EphemeraLudicCacheEdge
    if (!Array.isArray(edge.supportedBy) || !edge.supportedBy.every(isEphemeraLudicCacheSupport)) {
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
    // Referential integrity (rebuild 3d, presenceNodes Slice 6/PN-12): a cover entry resolves by
    // path --- the host's node, then that binding on it --- and an entry whose host has no node,
    // or whose named binding is not on that node, is internal inconsistency and FAILS. A cover
    // member is never a character (a character's membership host is a Room only, AGENT.contract.md),
    // and the walk reaches every other member, so an absent host cannot be a legitimate omission.
    // An entry with `presence` absent (the fold could not find that binding) checks the host step
    // only. An edge terminating at an absent presence node is a different, legal shape (the
    // binding exists and was not pulled into this cache, PR-15) and is deliberately NOT checked
    // here --- see PN-12's decomposition.
    const bindingsByOwner = new Map(cache.nodes.map((node) => [
        node.universalKey as string,
        new Set<string>(node.presenceNodes.map((binding) => binding.universalKey)),
    ]))
    for (const node of cache.nodes) {
        for (const binding of node.presenceNodes) {
            for (const member of binding.cover.members) {
                const memberBindings = bindingsByOwner.get(member.host)
                if (!memberBindings || (member.presence !== undefined && !memberBindings.has(member.presence))) {
                    return false
                }
            }
        }
    }
    return true
}
