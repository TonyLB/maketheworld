import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type {
    EphemeraLudicGraphComponentNode,
    EphemeraLudicGraphStructureNode,
    EphemeraLudicRelationalEdgeData,
    EphemeraLudicTerminalId,
    EphemeraPresenceCoverEntry,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    isEphemeraLudicGraphComponentNode,
    isEphemeraLudicRelationalEdgeData,
    isPresenceTaggedPortId,
    isEphemeraPresenceParentPointerOrAbsent,
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
 * entries only --- the graph's `Remainder` sentinel ("every unclaimed node of the host") has no
 * referent in a multi-host merge (loss (A)), so this makes it unrepresentable in the cache
 * *by construction* rather than by a runtime guard someone could forget. Minted by
 * `mergeReducer.ts`'s `foldSameHostBuckets` (via its
 * `presenceCacheNodesFromFold` helper), one per binding folded. Each cover
 * entry names the member's own binding into this binding's host (`EphemeraLudicCacheCoverEntry`).
 */
export type EphemeraLudicCachePresenceNode = Omit<EphemeraLudicGraphStructureNode, 'cover'> & {
    cover: { members: EphemeraLudicCacheCoverEntry[] };
}

/**
 * A cache cover entry: `host` is covered, and `presence` names which of `host`'s own bindings
 * (into the covering binding's host) is meant. The graph-side `EphemeraPresenceCoverEntry`
 * requires `presence`; here it is optional because the cache expands a graph-side `Remainder`,
 * which has no entries, into an entry list, and must look each member's binding up in
 * the member's own graph. That lookup can come back empty --- e.g. a thing placed without a move,
 * which never had a binding minted --- and the member is still covered, so the entry stays
 * with `presence` absent. Entries copied from a graph-side explicit entry always carry it.
 */
export type EphemeraLudicCacheCoverEntry = Omit<EphemeraPresenceCoverEntry, 'presence'> & {
    presence?: EphemeraPresenceNodeId;
}

/**
 * Cache edge: a plain relational edge. The cache keeps no maintenance state (which routes
 * justify a composed edge, which buckets were pulled): a stale cache is rebuilt whole. The
 * shelved design for incremental maintenance lives in `AGENT.implementation.md`, "Shelved:
 * incremental `ludicCache` maintenance".
 */
export type EphemeraLudicCacheEdge = EphemeraLudicRelationalEdgeData

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
// `presence` on every entry (see `EphemeraLudicCacheCoverEntry`). A `Remainder` entry or a legacy `tag` is illegal in the
// cache (PN-19).
export const isEphemeraLudicCachePresenceNode = (value: unknown): value is EphemeraLudicCachePresenceNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const node = value as { tag?: unknown; universalKey?: unknown; fromHostPresence?: unknown; cover?: { tag?: unknown; members?: unknown } }
    return node.tag === 'Presence'
        && typeof node.universalKey === 'string' && isEphemeraPresenceNodeId(node.universalKey)
        && isEphemeraPresenceParentPointerOrAbsent(node.fromHostPresence)
        && !('fromHostId' in node)
        && !!node.cover && node.cover.tag === undefined
        && Array.isArray(node.cover.members)
        && node.cover.members.every((entry: unknown) => isEphemeraLudicCacheCoverEntry(entry))
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

// A bare presence-tagged terminal is illegal on a cache edge (PNR-2(a), Slice 3): nesting made a
// binding's lookup in the cache a path --- the owner's node, then that binding on it --- so every
// reference to a binding must carry the owner alongside the port id. `foldSameHostBuckets` and
// `collapseCrossingPorts` lift every such terminal at mint time; a bare one reaching this guard is
// corruption, not an unpulled-binding case (that case is an owner-qualified terminal whose binding
// is simply absent from `nodes`, which the referential-integrity pass below already permits).
const isNotBarePresenceTerminal = (terminal: EphemeraLudicTerminalId): boolean =>
    !(typeof terminal === 'string' && isPresenceTaggedPortId(terminal))

export const isEphemeraLudicCacheEdge = (value: unknown): value is EphemeraLudicCacheEdge => {
    if (!isEphemeraLudicRelationalEdgeData(value)) {
        return false
    }
    return isNotBarePresenceTerminal(value.from) && isNotBarePresenceTerminal(value.to)
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
