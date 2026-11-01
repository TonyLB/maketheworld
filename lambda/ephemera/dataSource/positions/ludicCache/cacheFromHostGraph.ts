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
import { stripTypedKey } from '@tonylb/mtw-utilities/ts/types'
import { EphemeraLudicGraph, toStoredRelationalEdge } from '../ludicGraph'
import { nodesFromPresenceBinding, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import { dedupeEdgesByIdentity, mergeSameHostBucket } from './mergeReducer'
import type { EphemeraLudicCacheEdge, EphemeraLudicCachePresenceNode, EphemeraLudicCacheTerminalId } from './types'

const presenceUuidFromKey = stripTypedKey('PRESENCE')

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
 * The `EphemeraLudicCachePresenceNode` for each of the host's own bindings (presenceNodes Slice 4, item 3).
 *
 * `cover` entries name each covered member's OWN binding into this host, never the covering
 * binding (`EphemeraLudicCacheCoverEntry`). A graph-side explicit entry already says so,
 * and is copied (root filtered out; the parent side is authoritative, so no
 * cross-check against the member's graph).
 *
 * **Clause 3 (zero-or-all) holds by construction:** every binding in `graph.presenceNodes`, this host's
 * complete binding set, is minted; no caller chooses a subset.
 */
const presenceCacheNodesFromFold = (graph: EphemeraLudicGraph): EphemeraLudicCachePresenceNode[] => {
    const root = ephemeraLudicTerminalOwner(graph.rootId)
    return graph.presenceNodes.map((presenceNode) => {
        // A room's binding into an Area is stored as a carve-out with no members (the room rule,
        // PR-21(f)), so it expands to nothing here and a member's bucket is the room's own remainder.
        const members = presenceNode.cover.members
            .filter((entry) => entry.host !== root)
            .map((entry) => {
                const hostingKind = graph.hostingKindOf(entry.host)
                return hostingKind === undefined ? entry : { ...entry, hostingKind }
            })
        return {
            tag: 'Presence' as const,
            universalKey: presenceNode.universalKey,
            fromHostPresences: presenceNode.fromHostPresences,
            cover: { members },
        }
    })
}

/**
 * Fold-walk probe (ISS8149 D1, second measurement): a single accumulating pass over the host's
 * bindings, cutting each bucket and folding its stubs into the running graph in the same step --- not a
 * pass that cuts every bucket first and a second pass that matches stubs across the fully-cut
 * set. The order of `graph.presenceNodes` does not affect the result: a still-open stub lives in the
 * accumulator's own state until something matches it, not in a side channel compared only to the
 * immediately preceding bucket.
 *
 * The final read-off is the accumulated graph's own edges, open legs included: a leg touching a
 * remaining authored crossing port is a boundary of this host that no same-host merge can resolve,
 * and is kept for the union to join or leave open (contract: "Cache edges keep unmatched crossing legs").
 *
 * `presenceNodes` (presenceNodes Slice 4, item 3): the cache binding for every binding of the host,
 * via `presenceCacheNodesFromFold` above. All are `graph.hostId`'s own bindings, so the caller
 * nests them on that host's cache node. Computed in a separate pass rather than as a
 * side-effect of the accumulator, since a binding's own cover is a fact about `graph` alone and
 * needs no merge state to compute.
 */
export const cacheFromHostGraph = (
    graph: EphemeraLudicGraph
): { presenceNodes: EphemeraLudicCachePresenceNode[]; edges: EphemeraLudicCacheEdge[] } => {
    const seed = EphemeraLudicGraph.fromFieldPayload(graph.hostId, { rootId: graph.rootId, nodes: [], edges: [], ports: [] })

    const folded = graph.presenceNodes.reduce<EphemeraLudicGraph>((accumulated, presenceNode) => {
        const bucket = subGraphFromNodes(graph, nodesFromPresenceBinding(graph, presenceUuidFromKey(presenceNode.universalKey)))
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
    return { presenceNodes: presenceCacheNodesFromFold(graph), edges: deduped }
}
