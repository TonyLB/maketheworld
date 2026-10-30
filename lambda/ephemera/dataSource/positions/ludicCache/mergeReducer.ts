/**
 * Tier: Prototype, not locked. Built because building it is the only affordable way to get
 * the evidence PR-8 (see taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md)
 * needs.
 *
 * Dependency tag --- the rollback set is exactly:
 *   - positions/ludicGraph/presenceSubGraph.ts (+ test)
 *   - positions/ludicCache/mergeReducer.ts (+ test)
 *   - positions/ludicCache/unionCaches.ts (+ test), which composes what this file's legs produce
 *   - their fixtures
 * No change to EphemeraLudicGraph, to ephemeraMeta.ts, or to any write path. If a slice finds
 * it needs one, that is a scope change to raise, not to take.
 *
 * Rollback trigger, named in advance: a bucket cannot be stated from the child's own graph
 * plus its bindings --- i.e. if deciding which nodes are in a binding turns out to require the
 * parent's graph, then presence is not binding-indexed and the reducer's premise fails.
 *
 * Not triggers: fixture verbosity, reducer size, or the number of cases the straddle rule
 * needs. Those are measurements this Prototype exists to take.
 *
 * Built under a since-deleted implementation plan (AGENT.ludicCacheReducer.planning.md);
 * its findings live on in PR-8 and PR-12 above.
 */
import type { EphemeraLudicCrossingPortAddress, EphemeraLudicPortAddress, EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalKey, ephemeraLudicTerminalOwner, ephemeraLudicTerminalsEqual, isEphemeraLudicCrossingPortAddress, isEphemeraLudicNodeTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'
import type { HostRelationalEdge } from '../ludicGraph'
import { EphemeraLudicGraph, toStoredRelationalEdge } from '../ludicGraph'
import { nodesFromPresenceBinding, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import type { EphemeraLudicCacheCoverEntry, EphemeraLudicCacheEdge, EphemeraLudicCachePresenceNode, EphemeraLudicCacheTerminalId } from './types'

const hasPortTerminal = (portTerminal: EphemeraLudicPortAddress) => (edge: HostRelationalEdge<EphemeraLudicTerminalId>): boolean =>
    ephemeraLudicTerminalsEqual(edge.from, portTerminal) || ephemeraLudicTerminalsEqual(edge.to, portTerminal)

/**
 * Whether two legs of what is claimed to be one edge actually agree on the fields that make
 * them one edge --- `kind`, `relationLabel` on `Custom`, `chainId`, and `edgeId`. Mirrors
 * `edgesMatch` (`ludicGraph/baseClasses.ts`), but that helper also compares endpoints, which two
 * legs of a crossing edge deliberately do not share (one side is port-qualified, the other is the
 * far graph's real node) --- so this is a narrower, local check, not a call to that helper.
 *
 * **`edgeId` (Slice 3f, ISS8149):** found missing 2026-09-11 while checking D9 --- every other
 * identity field here is asserted, and a mismatched `edgeId` used to collapse silently, discarding
 * the child leg's label. Nothing mints an `edgeId` yet, so this is untested by any shipped writer;
 * the test fixture is hand-authored, per the plan's own instruction not to defer on that account.
 */
const legsAgree = (a: HostRelationalEdge<EphemeraLudicTerminalId>, b: HostRelationalEdge<EphemeraLudicTerminalId>): boolean => {
    if (a.kind !== b.kind) {
        return false
    }
    if (a.chainId !== b.chainId) {
        return false
    }
    if (a.edgeId !== b.edgeId) {
        return false
    }
    // Both sides are tested even though the kind equality above already implies the second:
    // narrowing `a` does not narrow `b`, and the compiler needs the pair to reach either label.
    if (a.kind === 'Custom' && b.kind === 'Custom') {
        return a.relationLabel === b.relationLabel
    }
    return true
}

/** The non-port terminal of a leg known to touch `portTerminal` on one side. */
const outerTerminal = <T extends EphemeraLudicTerminalId>(
    edge: HostRelationalEdge<T>,
    portTerminal: EphemeraLudicPortAddress
): T =>
    ephemeraLudicTerminalsEqual(edge.from, portTerminal) ? edge.to : edge.from

/**
 * The one leg-matching rule (shared by the same-host merge and the union): **dedupe exact copies, then join two *distinct*
 * legs that name the same crossing-port address.** Generic over the terminal type, so graph edges
 * and cache edges share it.
 *
 * Dedupe comes first because an authored port's leg can legitimately arrive twice (LC10's
 * port-to-port transit leg is carried into every bucket whose edges reference it). Matched before
 * deduping, that leg would be spliced to its own copy, silently, since `legsAgree` cannot object
 * to two identical legs. Deduped first, an authored port with one leg in the host has one leg and
 * stays open --- the partner lives in another host. This replaces an earlier stub-only guard,
 * which got the same result by refusing to match authored ports at all.
 *
 * Only crossing-port addresses are matched (by type): a binding address is an endpoint many
 * distinct edges end at, and two of those must never be joined. A port named by any number of
 * legs other than two is left open; a pair that disagrees on identity fields throws (a
 * data-integrity break, not a case to paper over --- see `legsAgree`).
 *
 * The joined edge is the first leg with its port terminal rewritten to the second's outer
 * terminal. Joined edges come first in the output, then untouched legs, each in input order, so a
 * retried rebuild is byte-identical (3e). A joined edge is not re-matched.
 */
export const joinCrossingLegs = <T extends EphemeraLudicTerminalId>(
    legs: HostRelationalEdge<T>[]
): { edges: HostRelationalEdge<T>[]; joinedPorts: EphemeraLudicCrossingPortAddress[] } => {
    const legKey = (leg: HostRelationalEdge<T>): string => JSON.stringify(toStoredRelationalEdge(leg))
    const distinctLegs = legs.filter((leg, index) => legs.findIndex((other) => legKey(other) === legKey(leg)) === index)
    const addresses = distinctLegs
        .flatMap((leg): EphemeraLudicTerminalId[] => [leg.from, leg.to])
        .filter((terminal): terminal is EphemeraLudicCrossingPortAddress => isEphemeraLudicCrossingPortAddress(terminal))
        .filter((address, index, all) => all.findIndex((other) => ephemeraLudicTerminalsEqual(other, address)) === index)

    type Slot = { leg: HostRelationalEdge<T>; joined: boolean }
    const { slots, joinedPorts } = addresses.reduce<{ slots: Slot[]; joinedPorts: EphemeraLudicCrossingPortAddress[] }>(
        (state, address) => {
            const matching = state.slots.filter(({ leg, joined }) => !joined && hasPortTerminal(address)(leg))
            if (matching.length !== 2) {
                return state
            }
            const [first, second] = matching
            if (!legsAgree(first.leg, second.leg)) {
                throw new Error(
                    `Crossing port ${address.port} on ${address.owner} joins legs that disagree on kind/relationLabel/chainId`
                )
            }
            const outer = outerTerminal(second.leg, address)
            const rewrite = (terminal: T): T => ephemeraLudicTerminalsEqual(terminal, address) ? outer : terminal
            const joinedLeg: HostRelationalEdge<T> = { ...first.leg, from: rewrite(first.leg.from), to: rewrite(first.leg.to) }
            return {
                slots: [...state.slots.filter((slot) => !matching.includes(slot)), { leg: joinedLeg, joined: true }],
                joinedPorts: [...state.joinedPorts, address],
            }
        },
        { slots: distinctLegs.map((leg) => ({ leg, joined: false })), joinedPorts: [] }
    )
    return {
        edges: [...slots.filter(({ joined }) => joined), ...slots.filter(({ joined }) => !joined)].map(({ leg }) => leg),
        joinedPorts,
    }
}

/**
 * A pure, local re-encoding of a *collapsed* edge's identity --- the same field list
 * `edgesMatch` (`baseClasses.ts`) treats as an edge's identity, but read off the collapsed
 * edge's final, resolved endpoints rather than off stored data. Deliberately duplicated rather
 * than imported, matching `presenceSubGraph.ts`'s own `stubPortIdFromEdge` (LR-1's dependency
 * tag) --- this is a different call site (post-collapse, not pre-mint) and owes no more to that
 * one than the shared source field list already implies.
 *
 * **One presence binding has two addresses, and they must hash alike (presenceNodes Slice 5 item 3,
 * closed by PN-24, reversed by PNR-2/Slice 3).** An edge may terminate at the binding's bare
 * `PRESENCE#{uuid}` node id, or at its exterior address `{ owner, port: 'PRESENCE#{uuid}' }`; two
 * cache entries can therefore hold the same edge in two forms, and a merge that does not equate
 * them duplicates it. **Normalize UP, to the exterior form**, as of Slice 3: `liftPresenceTerminal`
 * rewrites every bare presence terminal to `{ owner, port }` at the point each cache edge is minted
 * (`foldSameHostBuckets`), so by the time an edge reaches this function
 * both addresses have already collapsed to one shape, and there is no second, bare form left for
 * this key function to re-normalize --- every port-address terminal, presence or crossing alike,
 * keys as `owner#port`. (PN-24's reasoning still explains why the two forms must hash alike; it no
 * longer explains which form survives. PNR-2's reason: once a binding's lookup in the cache is a
 * *path* --- the owner's node, then that binding on it --- the bare id alone cannot resolve it, so
 * `owner` stopped being redundant information.)
 */
export const collapsedEdgeIdentityKey = (edge: EphemeraLudicCacheEdge): string => {
    // `ConnectedTo` is symmetric: sort the endpoint keys so either order hashes alike.
    const endpointKeys = [ephemeraLudicTerminalKey(edge.from), ephemeraLudicTerminalKey(edge.to)]
    if (edge.kind === 'ConnectedTo') {
        endpointKeys.sort()
    }
    return JSON.stringify([
        ...endpointKeys,
        edge.kind,
        edge.kind === 'Custom' ? edge.relationLabel : '',
        edge.chainId ?? '',
        edge.edgeId ?? '',
    ])
}

/**
 * Keeps the first edge of each `collapsedEdgeIdentityKey`, in input order. Order is part of the
 * contract: a retried rebuild must produce a byte-identical `edges` array (3e). Quadratic in the
 * edge count, which is small next to the rebuild's I/O; it buys a pure function.
 */
export const dedupeEdgesByIdentity = (edges: EphemeraLudicCacheEdge[]): EphemeraLudicCacheEdge[] => {
    const keys = edges.map(collapsedEdgeIdentityKey)
    return edges.filter((_, index) => keys.indexOf(keys[index]) === index)
}

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
 * Fold-walk probe (ISS8149 D1, second measurement): the running state a walk needs between
 * steps is an ordinary `EphemeraLudicGraph`, not a bespoke bookkeeping type --- its own `ports`
 * (crossing stubs not yet matched) and the subset of its `relationalEdges` that still terminate
 * on one of them already *are* "what remains unresolved." A resolved edge is nothing more than
 * an ordinary edge already sitting in that same list, real terminal to real terminal.
 *
 * Matches ports by the one leg-matching rule (`joinCrossingLegs`): a port named by two distinct
 * legs is joined. An authored boundary can legitimately appear in two buckets, but its leg then
 * dedupes to one, so it is not spliced. This folds one more cut into a running graph, carrying forward
 * whatever it can't yet resolve. A port that
 * matches is consumed (it no longer bounds anything); one that doesn't is carried
 * forward on both the port list and the edge list exactly as it arrived, since its match may not
 * have appeared yet --- the case a straddling edge between non-adjacent buckets needs. **An
 * authored crossing port has one leg in this host (its partner lives in another), so it stays
 * open**: it is a boundary of the whole, not a cut, and nothing at this level can resolve it.
 */
export const mergeSameHostBucket = (
    accumulated: EphemeraLudicGraph,
    bucket: EphemeraLudicGraph
): EphemeraLudicGraph => {
    // Every leg from both sides goes through the one matching rule (`joinCrossingLegs`): exact
    // copies are deduped first (an authored boundary's transit leg arrives from both sides), then a
    // port named by two distinct legs is joined and consumed. Everything else is carried forward.
    const { edges: joinedAndCarried, joinedPorts } = joinCrossingLegs([...accumulated.relationalEdges, ...bucket.relationalEdges])
    const joinedPortIds = new Set<string>(joinedPorts.filter((address) => address.owner === accumulated.hostId).map((address) => address.port))

    // Presence nodes aren't reconstructible from `nodeIds` alone (`fromHostPresences`/`cover` have no
    // derivation from the id), and both sides carry the same ones anyway -- every presence node
    // is present in every cut of its own host (PN-6), so `accumulated` and `bucket` are unioning
    // identical copies here, not merging distinct facts. Component nodes are taken as records, not
    // rebuilt with `nodeFromId`, so each keeps its `hostingKind` (the two sides agree on it: both
    // are cuts of one host's graph).
    const componentNodes = [...accumulated.componentNodes, ...bucket.componentNodes]
        .filter((node, index, all) => all.findIndex((other) => other.universalKey === node.universalKey) === index)
    const presenceNodesById = new Map(
        [...accumulated.presenceNodes, ...bucket.presenceNodes].map((node) => [node.universalKey, node])
    )
    const nodes = [...componentNodes, ...presenceNodesById.values()]
    const ports = [...accumulated.ports, ...bucket.ports].filter(
        (port, index, all) => !joinedPortIds.has(port.portId) && all.findIndex((p) => p.portId === port.portId) === index
    )

    return EphemeraLudicGraph.fromFieldPayload(accumulated.hostId, {
        rootId: accumulated.rootId,
        nodes,
        edges: joinedAndCarried.map(toStoredRelationalEdge),
        ports,
    })
}

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
export const foldSameHostBuckets = (
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
    const legs = folded.relationalEdges
        .map((edge) => toStoredRelationalEdge<EphemeraLudicCacheTerminalId>({
            ...edge,
            from: liftPresenceTerminal(edge.from, graph.hostId),
            to: liftPresenceTerminal(edge.to, graph.hostId),
        }))

    const deduped = dedupeEdgesByIdentity(legs)
    return { presenceNodes: presenceCacheNodesFromFold(graph, presenceUuids), edges: deduped }
}
