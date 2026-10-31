/**
 * Tier: Prototype, not locked. Built because building it is the only affordable way to get
 * the evidence PR-8 (see taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md)
 * needs.
 *
 * Dependency tag --- the rollback set is exactly:
 *   - positions/ludicGraph/presenceSubGraph.ts (+ test)
 *   - positions/ludicCache/mergeReducer.ts (+ test)
 *   - positions/ludicCache/cacheFromHostGraph.ts (tested in mergeReducer.test.ts), which mints cache legs from one host's graph
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
import { ephemeraLudicTerminalKey, ephemeraLudicTerminalsEqual, isEphemeraLudicCrossingPortAddress } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { HostRelationalEdge } from '../ludicGraph'
import { EphemeraLudicGraph, toStoredRelationalEdge } from '../ludicGraph'
import type { EphemeraLudicCacheEdge } from './types'

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
export const joinCrossingLegs = <T extends EphemeraLudicTerminalId, L extends HostRelationalEdge<T> = HostRelationalEdge<T>>(
    legs: L[],
    onJoin?: (joined: L, first: L, second: L, address: EphemeraLudicCrossingPortAddress) => L
): { edges: L[]; joinedPorts: EphemeraLudicCrossingPortAddress[] } => {
    const legKey = (leg: L): string => JSON.stringify(toStoredRelationalEdge(leg))
    const distinctLegs = legs.filter((leg, index) => legs.findIndex((other) => legKey(other) === legKey(leg)) === index)
    const addresses = distinctLegs
        .flatMap((leg): EphemeraLudicTerminalId[] => [leg.from, leg.to])
        .filter((terminal): terminal is EphemeraLudicCrossingPortAddress => isEphemeraLudicCrossingPortAddress(terminal))
        .filter((address, index, all) => all.findIndex((other) => ephemeraLudicTerminalsEqual(other, address)) === index)

    type Slot = { leg: L; joined: boolean }
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
            const rewritten = { ...first.leg, from: rewrite(first.leg.from), to: rewrite(first.leg.to) } as L
            const joinedLeg = onJoin ? onJoin(rewritten, first.leg, second.leg, address) : rewritten
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
 * (`cacheFromHostGraph.ts`), so by the time an edge reaches this function
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
