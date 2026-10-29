import { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import type {
    EphemeraHostingKind,
    EphemeraLudicGraphComponentNodeBase,
    EphemeraLudicGraphStructureNode,
    EphemeraLudicNodeTerminal,
    EphemeraLudicPortAddress,
    EphemeraLudicRelationalEdgeData,
    EphemeraPresenceCoverEntry,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    isEphemeraHostingKind,
    isEphemeraLudicGraphComponentNode,
    isEphemeraLudicRelationalEdgeData,
    isEphemeraLudicTerminalId,
    isEphemeraLudicNodeTerminal,
    isEphemeraPresenceParentPointerList,
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
/**
 * Built from the node arms that never had `hostingKind`, not `Omit<..., 'hostingKind'>`: `Omit` over a
 * union is not distributive and would collapse the discriminated tag. A member's kind is
 * per-host, so on a node that combines several hosts the field would be ambiguous (in
 * which host?); the cache carries it on the cover entry instead (`EphemeraLudicCacheCoverEntry.hostingKind`).
 */
export type EphemeraLudicCacheNode = EphemeraLudicGraphComponentNodeBase & {
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
 * entries only, as the graph-side cover is, so a complement ("every unclaimed node of the host", which
 * has no referent in a multi-host merge, loss (A)) is unrepresentable *by construction* rather
 * than by a runtime guard someone could forget. Minted by
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
 * requires `presence`; here it is optional because the fold once looked each member's binding up in
 * the member's own graph for a graph-side complement, and that lookup could come back empty --- e.g. a thing placed without a move,
 * which never had a binding minted --- and the member was still covered, so the entry stays
 * with `presence` absent. Entries copied from a graph-side explicit entry always carry it.
 *
 * `hostingKind` is the covered member's kind in the cover's owning host (per member node,
 * so every entry for one member in one host agrees). The cache combines several hosts, so the
 * kind cannot sit on the cache node (in which host?); the entry already names both the host
 * (through its binding's owner) and the member. Optional only because a hand-built entry may
 * omit it; the fold always sets it.
 */
export type EphemeraLudicCacheCoverEntry = Omit<EphemeraPresenceCoverEntry, 'presence'> & {
    presence?: EphemeraPresenceNodeId;
    hostingKind?: EphemeraHostingKind;
}

/**
 * A terminal on a cache edge: every kind of terminal except the own binding (a bare
 * `PRESENCE#...`). Nesting makes a binding's lookup in the cache a path --- the owner's node, then
 * that binding on it --- so a cache edge ending at a binding names it through its binding address,
 * which carries the owner. `liftPresenceTerminal` (`mergeReducer.ts`) rewrites an own binding to that
 * form at the point each cache edge is minted.
 */
export type EphemeraLudicCacheTerminalId =
    | Exclude<EphemeraLudicNodeTerminal, EphemeraPresenceNodeId>
    | EphemeraLudicPortAddress

export const isEphemeraLudicCacheTerminalId = (value: unknown): value is EphemeraLudicCacheTerminalId =>
    isEphemeraLudicTerminalId(value) && !(isEphemeraLudicNodeTerminal(value) && isEphemeraPresenceNodeId(value))

/**
 * Cache edge: a plain relational edge, on cache terminals. The cache keeps no maintenance state (which routes
 * justify a composed edge, which buckets were pulled): a stale cache is rebuilt whole. The
 * shelved design for incremental maintenance lives in `AGENT.implementation.md`, "Shelved:
 * incremental `ludicCache` maintenance".
 */
export type EphemeraLudicCacheEdge = EphemeraLudicRelationalEdgeData<EphemeraLudicCacheTerminalId>

export type EphemeraLudicCacheData = {
    hostId: EphemeraMembershipHostId;
    nodes: EphemeraLudicCacheNode[];
    edges: EphemeraLudicCacheEdge[];
}

const isEphemeraLudicCacheCoverEntry = (value: unknown): value is EphemeraLudicCacheCoverEntry => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const entry = value as { host?: unknown; presence?: unknown; hostingKind?: unknown }
    return typeof entry.host === 'string' && isEphemeraMembershipHostId(entry.host)
        && (entry.hostingKind === undefined || isEphemeraHostingKind(entry.hostingKind))
        && (entry.presence === undefined || (typeof entry.presence === 'string' && isEphemeraPresenceNodeId(entry.presence)))
}

// Checked here rather than through the graph-side structure guard, whose cover check requires
// `presence` on every entry (see `EphemeraLudicCacheCoverEntry`). A complement sentinel or a legacy `tag` is illegal in the
// cache (PN-19).
export const isEphemeraLudicCachePresenceNode = (value: unknown): value is EphemeraLudicCachePresenceNode => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const node = value as { tag?: unknown; universalKey?: unknown; fromHostPresences?: unknown; cover?: { tag?: unknown; members?: unknown } }
    return node.tag === 'Presence'
        && typeof node.universalKey === 'string' && isEphemeraPresenceNodeId(node.universalKey)
        && isEphemeraPresenceParentPointerList(node.fromHostPresences)
        && !('fromHostId' in node)
        && !('fromHostPresence' in node)
        && !!node.cover && node.cover.tag === undefined
        && Array.isArray(node.cover.members)
        && node.cover.members.every((entry: unknown) => isEphemeraLudicCacheCoverEntry(entry))
        }

export const isEphemeraLudicCacheNode = (value: unknown): value is EphemeraLudicCacheNode => {
    if (!isEphemeraLudicGraphComponentNode(value)) {
        return false
    }
    const node = value as EphemeraLudicCacheNode
    if ('hostingKind' in node) {
        return false
    }
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

// A bare presence-tagged terminal is illegal on a cache edge (PNR-2(a), Slice 3): the type
// (`EphemeraLudicCacheTerminalId`) refuses it at compile time, and this guard refuses it in stored
// rows. `foldSameHostBuckets` and `collapseCrossingPorts` lift every such terminal at mint time; a
// bare one reaching this guard is corruption, not an unpulled-binding case (that case is an
// owner-qualified terminal whose binding is simply absent from `nodes`, which the
// referential-integrity pass below already permits).
export const isEphemeraLudicCacheEdge = (value: unknown): value is EphemeraLudicCacheEdge => {
    if (!isEphemeraLudicRelationalEdgeData(value)) {
        return false
    }
    return isEphemeraLudicCacheTerminalId(value.from) && isEphemeraLudicCacheTerminalId(value.to)
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
    // or whose named binding is not on that node, is internal inconsistency and FAILS. The walk
    // reaches every member of the graphs it enumerates, so an absent host cannot be a legitimate
    // omission. A room-seeded walk meets no bystander (the characters row indexes it, and the room's
    // graph holds no node for it); a character-seeded walk expands its own seed.
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
