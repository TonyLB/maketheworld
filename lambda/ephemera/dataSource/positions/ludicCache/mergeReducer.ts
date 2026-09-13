/**
 * Tier: Prototype, not locked. Built because building it is the only affordable way to get
 * the evidence PR-8 (see taskPlanning/lambda/ephemera/dataSource/positions/AGENT.presence.planning.md)
 * needs.
 *
 * Dependency tag --- the rollback set is exactly:
 *   - positions/ludicGraph/presenceSubGraph.ts (+ test)
 *   - positions/ludicCache/mergeReducer.ts (+ test)
 *   - their fixtures
 * No change to EphemeraLudicGraph, to ephemeraMeta.ts, or to any write path. If a slice finds
 * it needs one, that is a scope change to raise, not to take.
 *
 * Rollback trigger, named in advance: a bucket cannot be stated from the child's own graph
 * plus its ports --- i.e. if deciding which nodes are in a binding turns out to require the
 * parent's graph, then presence is not port-indexed and the reducer's premise fails.
 *
 * Not triggers: fixture verbosity, reducer size, or the number of cases the straddle rule
 * needs. Those are measurements this Prototype exists to take.
 *
 * Built under a since-deleted implementation plan (AGENT.ludicCacheReducer.planning.md);
 * its findings live on in PR-8 and PR-12 above.
 */
import type { EphemeraCrossingPort, EphemeraLudicGraphPort, EphemeraLudicPortAddress, EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { HostRelationalEdge } from '../ludicGraph'
import { EphemeraLudicGraph, nodeFromId, toStoredRelationalEdge } from '../ludicGraph'
import { nodesFromPresencePort, subGraphFromNodes } from '../ludicGraph/presenceSubGraph'
import type { EphemeraLudicCacheEdge } from './types'

const isCrossingPort = (port: EphemeraLudicGraphPort): port is EphemeraCrossingPort => port.kind !== 'Present'

const hasPortTerminal = (portTerminal: EphemeraLudicPortAddress) => (edge: HostRelationalEdge): boolean =>
    ephemeraLudicTerminalsEqual(edge.from, portTerminal) || ephemeraLudicTerminalsEqual(edge.to, portTerminal)

/**
 * Whether two legs of what is claimed to be one edge actually agree on the fields that make
 * them one edge --- `kind`, `relationLabel` on `Custom`, and `chainId`. Mirrors `edgesMatch`
 * (`ludicGraph/baseClasses.ts`), but that helper also compares endpoints, which two legs of a
 * crossing edge deliberately do not share (one side is port-qualified, the other is the far
 * graph's real node) --- so this is a narrower, local check, not a call to that helper.
 */
const legsAgree = (a: HostRelationalEdge, b: HostRelationalEdge): boolean => {
    if (a.kind !== b.kind) {
        return false
    }
    if (a.chainId !== b.chainId) {
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
const outerTerminal = (
    edge: HostRelationalEdge,
    portTerminal: EphemeraLudicPortAddress
): EphemeraLudicTerminalId =>
    ephemeraLudicTerminalsEqual(edge.from, portTerminal) ? edge.to : edge.from

/**
 * A pure, local re-encoding of a *collapsed* edge's identity --- the same field list
 * `edgesMatch` (`baseClasses.ts`) treats as an edge's identity, but read off the collapsed
 * edge's final, resolved endpoints rather than off stored data. Deliberately duplicated rather
 * than imported, matching `presenceSubGraph.ts`'s own `edgeIdentityKey` (LR-1's dependency
 * tag) --- this is a different call site (post-collapse, not pre-mint) and owes no more to that
 * one than the shared source field list already implies.
 */
const collapsedEdgeIdentityKey = (edge: EphemeraLudicCacheEdge): string => {
    const terminalKey = (terminal: EphemeraLudicTerminalId): string =>
        typeof terminal === 'string' ? terminal : `${terminal.owner}#${terminal.port}`
    return JSON.stringify([
        terminalKey(edge.from),
        terminalKey(edge.to),
        edge.kind,
        edge.kind === 'Custom' ? edge.relationLabel : '',
        edge.chainId ?? '',
    ])
}

/**
 * Collapse of crossing relation ports.
 *
 * A port that binds a child (the contained side) to its parent is minted and owned only by the
 * child's own graph (`AGENT.concepts.md`'s "Wholes, parts, and ports", clause 2 --- the interior
 * mints the binding, mirroring how a presence port is added to the *contained* thing's own
 * graph). A single relational edge spanning that boundary is therefore split into two **legs**,
 * sharing `kind` (and `relationLabel`/`chainId` where present) on both --- the reduction
 * convention recorded in `AGENT.presence.planning.md`'s PR-8 --- per the
 * `cup -[TiedTo]-> string` case:
 *
 * - **The parent's leg**, in `parentGraph.relationalEdges`: one terminal is an ordinary
 *   parent-side node, the other is `{ owner: childGraph.hostId, port }` --- already
 *   port-qualified, referencing a port it does not own.
 * - **The child's leg**, in `childGraph.relationalEdges`: one terminal is that same address
 *   (the child's own port, referenced from within its own graph), the other is the real
 *   interior node.
 *
 * For each crossing-kind port (`kind !== 'Present'`) on `childGraph`, this finds the two legs
 * that share its terminal, asserts they agree on identity fields (a mismatch is a data-integrity
 * break under this uniform-kind model, not a case to paper over --- see `legsAgree`), and
 * produces one collapsed edge: the parent leg with its port terminal rewritten to the child
 * leg's real interior node, carrying a one-hop `chains` entry (`[childGraph.hostId]`). Collapsed
 * edges are then grouped by `collapsedEdgeIdentityKey` --- **two crossing ports can independently
 * collapse to the same final `(from, to, kind)` triple**, and LR-8 requires that land on one
 * record with two `chains` entries side by side, never merged or tie-broken.
 *
 * **A port with no matching leg on one or both sides is incomplete data, not an error.** A
 * merge reducer cannot invent a missing leg (data may legitimately be mid-write), so that port
 * is skipped rather than throwing.
 *
 * Presence ports are excluded --- they are bucket-membership metadata (`presenceSubGraph.ts`'s
 * own LR-6 note), never a relational crossing.
 */
export const collapseCrossingPorts = (
    parentGraph: EphemeraLudicGraph,
    childGraph: EphemeraLudicGraph
): EphemeraLudicCacheEdge[] => {
    const crossingPorts = childGraph.ports.filter(isCrossingPort)

    const collapsedLegs = crossingPorts.reduce<EphemeraLudicCacheEdge[]>((acc, port) => {
        const portTerminal: EphemeraLudicPortAddress = { owner: childGraph.hostId, port: port.portId }
        const parentLeg = parentGraph.relationalEdges.find(hasPortTerminal(portTerminal))
        const childLeg = childGraph.relationalEdges.find(hasPortTerminal(portTerminal))

        if (!parentLeg || !childLeg) {
            return acc
        }

        if (!legsAgree(parentLeg, childLeg)) {
            throw new Error(
                `Crossing port ${port.portId} on ${childGraph.hostId} joins legs that disagree on kind/relationLabel/chainId`
            )
        }

        const childOuter = outerTerminal(childLeg, portTerminal)
        const rewrite = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalId =>
            ephemeraLudicTerminalsEqual(terminal, portTerminal) ? childOuter : terminal

        const collapsed: HostRelationalEdge = {
            ...parentLeg,
            from: rewrite(parentLeg.from),
            to: rewrite(parentLeg.to),
        }

        return [...acc, { ...toStoredRelationalEdge(collapsed), chains: [[childGraph.hostId]] }]
    }, [])

    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    collapsedLegs.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, chains: [...existing.chains, ...edge.chains] } : edge)
    })
    return [...byIdentity.values()]
}

/**
 * Fold-path probe (ISS8149 D1): reconstruction of a same-host interior edge that a fold would
 * cut into two independent halves rather than see whole, per `nodesFromPresencePorts`'s own doc
 * comment in `presenceSubGraph.ts` --- cutting bucket A alone and bucket B alone, instead of
 * unioning their node sets before a single cut, leaves the straddling edge "independently
 * stub-ported on each side" with no rejoin step. `edgeIdentityKey` mints that stub id
 * deterministically from the edge's own fields (`from`/`to`/`kind`/`relationLabel`/`chainId`),
 * so both cuts land on the same portId for the same original edge --- the two bucket graphs
 * being joined here are two cuts of the *same* `EphemeraLudicGraph` (`hostId` in common), not a
 * parent and a child the way `collapseCrossingPorts` joins.
 *
 * Matches stub ports by shared `portId` (present, non-`Present`-kind, on both bucket graphs),
 * finds each side's leg touching that port terminal, asserts they agree exactly as
 * `collapseCrossingPorts` does, and rewrites bucket A's leg with bucket B's outer terminal to
 * recover the original edge. `chains` is always `[]` --- this never crosses a membership
 * boundary, so there is no hop to record.
 */
export const collapseSameHostStubs = (
    bucketA: EphemeraLudicGraph,
    bucketB: EphemeraLudicGraph
): EphemeraLudicCacheEdge[] => {
    const stubIdsA = bucketA.ports.filter(isCrossingPort).map((port) => port.portId)
    const stubIdsB = new Set(bucketB.ports.filter(isCrossingPort).map((port) => port.portId))
    const sharedPortIds = stubIdsA.filter((portId) => stubIdsB.has(portId))

    const collapsedLegs = sharedPortIds.reduce<EphemeraLudicCacheEdge[]>((acc, portId) => {
        const portTerminal: EphemeraLudicPortAddress = { owner: bucketA.hostId, port: portId }
        const legA = bucketA.relationalEdges.find(hasPortTerminal(portTerminal))
        const legB = bucketB.relationalEdges.find(hasPortTerminal(portTerminal))

        if (!legA || !legB) {
            return acc
        }

        if (!legsAgree(legA, legB)) {
            throw new Error(
                `Stub port ${portId} on ${bucketA.hostId} joins legs that disagree on kind/relationLabel/chainId`
            )
        }

        const outerB = outerTerminal(legB, portTerminal)
        const rewrite = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalId =>
            ephemeraLudicTerminalsEqual(terminal, portTerminal) ? outerB : terminal

        const collapsed: HostRelationalEdge = {
            ...legA,
            from: rewrite(legA.from),
            to: rewrite(legA.to),
        }

        return [...acc, { ...toStoredRelationalEdge(collapsed), chains: [] }]
    }, [])

    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    collapsedLegs.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, chains: [...existing.chains, ...edge.chains] } : edge)
    })
    return [...byIdentity.values()]
}

/**
 * Fold-walk probe (ISS8149 D1, second measurement): the running state a walk needs between
 * steps is an ordinary `EphemeraLudicGraph`, not a bespoke bookkeeping type --- its own `ports`
 * (crossing stubs not yet matched) and the subset of its `relationalEdges` that still terminate
 * on one of them already *are* "what remains unresolved." A resolved edge is nothing more than
 * an ordinary edge already sitting in that same list, real terminal to real terminal.
 *
 * Generalizes `collapseSameHostStubs`'s matching --- same shared-`portId` rule, same
 * `legsAgree`/`outerTerminal`/rewrite --- from "join two static cuts once" to "fold one more cut
 * into a running graph, carrying forward whatever it can't yet resolve." A crossing port that
 * matches on both sides is consumed (it no longer bounds anything); one that doesn't is carried
 * forward on both the port list and the edge list exactly as it arrived, since its match may not
 * have appeared yet --- the case a straddling edge between non-adjacent buckets needs.
 */
export const mergeSameHostBucket = (
    accumulated: EphemeraLudicGraph,
    bucket: EphemeraLudicGraph
): EphemeraLudicGraph => {
    const accumulatedStubIds = new Set(accumulated.ports.filter(isCrossingPort).map((port) => port.portId))
    const bucketStubIds = bucket.ports.filter(isCrossingPort).map((port) => port.portId)
    const matchedPortIds = new Set(bucketStubIds.filter((portId) => accumulatedStubIds.has(portId)))

    const resolved = [...matchedPortIds].reduce<HostRelationalEdge[]>((acc, portId) => {
        const portTerminal: EphemeraLudicPortAddress = { owner: accumulated.hostId, port: portId }
        const legA = accumulated.relationalEdges.find(hasPortTerminal(portTerminal))
        const legB = bucket.relationalEdges.find(hasPortTerminal(portTerminal))

        if (!legA || !legB) {
            return acc
        }
        if (!legsAgree(legA, legB)) {
            throw new Error(
                `Stub port ${portId} on ${accumulated.hostId} joins legs that disagree on kind/relationLabel/chainId`
            )
        }

        const outerB = outerTerminal(legB, portTerminal)
        const rewrite = (terminal: EphemeraLudicTerminalId): EphemeraLudicTerminalId =>
            ephemeraLudicTerminalsEqual(terminal, portTerminal) ? outerB : terminal

        return [...acc, { ...legA, from: rewrite(legA.from), to: rewrite(legA.to) }]
    }, [])

    const touchesMatchedPort = (edge: HostRelationalEdge): boolean =>
        [...matchedPortIds].some((portId) => hasPortTerminal({ owner: accumulated.hostId, port: portId })(edge))

    const carriedForward = [...accumulated.relationalEdges, ...bucket.relationalEdges].filter(
        (edge) => !touchesMatchedPort(edge)
    )

    const nodes = [...new Set([...accumulated.nodeIds, ...bucket.nodeIds])].map(nodeFromId)
    const ports = [...accumulated.ports, ...bucket.ports].filter(
        (port, index, all) => !matchedPortIds.has(port.portId) && all.findIndex((p) => p.portId === port.portId) === index
    )

    return EphemeraLudicGraph.fromFieldPayload(accumulated.hostId, {
        rootId: accumulated.rootId,
        nodes,
        edges: [...resolved, ...carriedForward].map(toStoredRelationalEdge),
        ports,
    })
}

/**
 * Fold-walk probe (ISS8149 D1, second measurement): a single accumulating pass over `portIds`,
 * cutting each bucket and folding its stubs into the running graph in the same step --- not a
 * pass that cuts every bucket first and a second pass that matches stubs across the fully-cut
 * set. Order of `portIds` does not affect the result: a still-open stub lives in the
 * accumulator's own state until something matches it, not in a side channel compared only to the
 * immediately preceding bucket.
 *
 * The final read-off is the accumulated graph's own edges that no longer touch any of its own
 * remaining `ports` --- those are the resolved interior edges. Anything still touching a
 * remaining port is a genuine unresolved boundary (this host is not fully covered by `portIds`)
 * and is correctly not emitted, the same "incomplete data, not an error" stance
 * `collapseCrossingPorts` already takes.
 */
export const foldSameHostBuckets = (
    graph: EphemeraLudicGraph,
    portIds: string[]
): EphemeraLudicCacheEdge[] => {
    const seed = EphemeraLudicGraph.fromFieldPayload(graph.hostId, { rootId: graph.rootId, nodes: [], edges: [], ports: [] })

    const folded = portIds.reduce<EphemeraLudicGraph>((accumulated, portId) => {
        const bucket = subGraphFromNodes(graph, nodesFromPresencePort(graph, portId))
        return mergeSameHostBucket(accumulated, bucket)
    }, seed)

    const remainingStubIds = folded.ports.filter(isCrossingPort).map((port) => port.portId)
    const touchesRemainingStub = (edge: HostRelationalEdge): boolean =>
        remainingStubIds.some((portId) => hasPortTerminal({ owner: folded.hostId, port: portId })(edge))

    const resolvedLegs = folded.relationalEdges
        .filter((edge) => !touchesRemainingStub(edge))
        .map((edge) => ({ ...toStoredRelationalEdge(edge), chains: [] as EphemeraLudicCacheEdge['chains'] }))

    const byIdentity = new Map<string, EphemeraLudicCacheEdge>()
    resolvedLegs.forEach((edge) => {
        const key = collapsedEdgeIdentityKey(edge)
        const existing = byIdentity.get(key)
        byIdentity.set(key, existing ? { ...existing, chains: [...existing.chains, ...edge.chains] } : edge)
    })
    return [...byIdentity.values()]
}
