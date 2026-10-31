/**
 * One host's cache material, read from that host's own graph alone: its edges (legs lifted to cache
 * terminals, open crossing legs kept, `endHosts` stamped) and the cache bindings it nests on its node.
 * The graph-to-cache step `buildLudicCache` (`fold.ts`) runs once per walked host before the union
 * (`unionCaches.ts`); the leg-matching rule both sides share is `mergeReducer.ts`'s.
 *
 * Tier: Prototype, in `mergeReducer.ts`'s rollback set (moved out of that file, unchanged).
 */
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalOwner, isEphemeraLudicNodeTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import { EphemeraLudicGraph, toStoredRelationalEdge } from '../ludicGraph'
import { nodesFromPresenceBinding, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import { dedupeEdgesByIdentity, mergeSameHostBucket } from './mergeReducer'
import type { EphemeraLudicCacheEdge, EphemeraLudicCachePresenceNode, EphemeraLudicCacheTerminalId } from './types'

/**
 * Rewrites a bare presence-tagged terminal (`PRESENCE#{uuid}`, legal within the owning graph's own
 * interior storage) to the cache's exterior form `{ owner, port }` --- PNR-2(a), presenceNodes
 * Slice 3. Nesting made a binding's lookup in the cache a path (the owner's node, then that binding
 * on it), so a cache edge ending at a binding must name the owner alongside the port id; a bare
 * terminal has nowhere to carry it. Any other terminal (an ordinary component id, or an
 * already-qualified port address) passes through unchanged --- this only ever widens a bare
 * presence id, never a crossing-port address, whose `owner` is already load-bearing and distinct
 * per host.
 */
const liftPresenceTerminal = (terminal: EphemeraLudicTerminalId, owner: EphemeraMembershipHostId): EphemeraLudicCacheTerminalId =>
    isEphemeraLudicNodeTerminal(terminal) && isEphemeraPresenceNodeId(terminal) ? { owner, port: terminal } : terminal
/**
 * The `EphemeraLudicCachePresenceNode` for each binding folded, one per `presenceUuid`
 * (presenceNodes Slice 4, item 3). A binding only reaches this function by being named in
 * `presenceUuids` --- the set of buckets being pulled --- so every node this produces is by
 * construction one that WAS pulled; `EphemeraLudicCacheData` simply never gets an entry for one
 * that wasn't.
 *
 * `cover` entries name each covered member's OWN binding into this host, never the covering
 * binding (`EphemeraLudicCacheCoverEntry`). A graph-side explicit entry already says so,
 * and is copied (root filtered out; the parent side is authoritative, so no
 * cross-check against the member's graph). A binding named in
 * `presenceUuids` with no matching graph node (the same degenerate case
 * `nodesFromPresenceBinding` falls back on) mints nothing --- there is no real node to consolidate.
 *
 * **Clause 3's zero-or-all invariant, enforced here and only here:** *"if a host consolidates any
 * presence bucket, it adds all of its presence nodes."* `graph.presenceNodes` is this host's
 * TRUE, complete binding set --- the one place in this module with enough information to check
 * it, unlike a read-time guard over an already-assembled `EphemeraLudicCacheData`, which sees only
 * whichever subset a producer already chose to write and cannot tell a genuine partial pull from
 * a host with no other bindings to omit. `presenceUuids` naming a proper, non-empty subset of
 * `graph.presenceNodes` is exactly the violation clause 3 forbids; `[]` (unexamined) and the full
 * set (this host's own bucket fully consolidated) are the only two legal shapes.
 */
const assertZeroOrAllPresenceBindings = (graph: EphemeraLudicGraph, presenceUuids: string[]): void => {
    const allIds = new Set<string>(graph.presenceNodes.map((node) => node.universalKey))
    const requestedIds = new Set(presenceUuids.map((uuid) => PresenceKey(uuid)))
    const requestedKnownCount = [...requestedIds].filter((id) => allIds.has(id)).length
    if (requestedKnownCount > 0 && requestedKnownCount < allIds.size) {
        throw new Error(
            `${graph.hostId} consolidates ${requestedKnownCount} of its ${allIds.size} presence bindings --- clause 3 requires zero or all`
        )
    }
}

const presenceCacheNodesFromFold = (
    graph: EphemeraLudicGraph,
    presenceUuids: string[]
): EphemeraLudicCachePresenceNode[] => {
    assertZeroOrAllPresenceBindings(graph, presenceUuids)
    const root = ephemeraLudicTerminalOwner(graph.rootId)
    return presenceUuids.reduce<EphemeraLudicCachePresenceNode[]>((acc, presenceUuid) => {
        const universalKey = PresenceKey(presenceUuid)
        const presenceNode = graph.presenceNodes.find((node) => node.universalKey === universalKey)
        if (!presenceNode) {
            return acc
        }
        // A room's binding into an Area is stored as a carve-out with no members (the room rule,
        // PR-21(f)), so it expands to nothing here and a member's bucket is the room's own remainder.
        const members = presenceNode.cover.members
            .filter((entry) => entry.host !== root)
            .map((entry) => {
                const hostingKind = graph.hostingKindOf(entry.host)
                return hostingKind === undefined ? entry : { ...entry, hostingKind }
            })
        return [...acc, {
            tag: 'Presence' as const,
            universalKey,
            fromHostPresences: presenceNode.fromHostPresences,
            cover: { members },
        }]
    }, [])
}

/**
 * Fold-walk probe (ISS8149 D1, second measurement): a single accumulating pass over `portIds`,
 * cutting each bucket and folding its stubs into the running graph in the same step --- not a
 * pass that cuts every bucket first and a second pass that matches stubs across the fully-cut
 * set. Order of `presenceUuids` does not affect the result: a still-open stub lives in the
 * accumulator's own state until something matches it, not in a side channel compared only to the
 * immediately preceding bucket.
 *
 * The final read-off is the accumulated graph's own edges, open legs included: a leg touching a
 * remaining authored crossing port is a boundary of this host that no same-host merge can resolve,
 * and is kept for the union to join or leave open (contract: "Cache edges keep unmatched crossing legs").
 *
 * `presenceNodes` (presenceNodes Slice 4, item 3): the cache binding for every binding folded,
 * via `presenceCacheNodesFromFold` above. All are `graph.hostId`'s own bindings, so the caller
 * nests them on that host's cache node. Computed in a separate pass over `presenceUuids` rather than as a
 * side-effect of the accumulator, since a binding's own cover is a fact about `graph` alone and
 * needs no merge state to compute.
 */
export const cacheFromHostGraph = (
    graph: EphemeraLudicGraph,
    presenceUuids: string[]
): { presenceNodes: EphemeraLudicCachePresenceNode[]; edges: EphemeraLudicCacheEdge[] } => {
    const seed = EphemeraLudicGraph.fromFieldPayload(graph.hostId, { rootId: graph.rootId, nodes: [], edges: [], ports: [] })

    const folded = presenceUuids.reduce<EphemeraLudicGraph>((accumulated, presenceUuid) => {
        const bucket = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, presenceUuid))
        return mergeSameHostBucket(accumulated, bucket)
    }, seed)

    // Every leg is emitted, including one that still touches an authored crossing port of this host: its
    // partner lives in another host, and the union (`unionCaches.ts`) joins the two or keeps the leg open
    // (an unmatched leg is kept). Every port in `folded.ports` is a crossing port (Slice 7a: presence carries no port record).
    // A resolved leg landing bare on one of `graph`'s own presence nodes is legal within `graph`'s
    // own interior storage (the graph names the owner implicitly), but this is the cache-bound
    // emission point --- lift it to the exterior form, owner `graph.hostId` (PNR-2(a)).
    // Each leg is held by this host's graph alone, so both of its ends sit here (`endHosts`); the union
    // replaces the port end's host when it joins the leg to its partner.
    const legs = folded.relationalEdges
        .map((edge): EphemeraLudicCacheEdge => ({
            ...toStoredRelationalEdge<EphemeraLudicCacheTerminalId>({
                ...edge,
                from: liftPresenceTerminal(edge.from, graph.hostId),
                to: liftPresenceTerminal(edge.to, graph.hostId),
            }),
            endHosts: { from: graph.hostId, to: graph.hostId },
        }))

    const deduped = dedupeEdgesByIdentity(legs)
    return { presenceNodes: presenceCacheNodesFromFold(graph, presenceUuids), edges: deduped }
}
