import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraLudicTerminalId, EphemeraLudicTerminalPrimitive, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalOwner, ephemeraLudicTerminalsEqual, isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { HostRelationalEdge } from '../../../../positions/ludicGraph'
import type { ExpansionEnvironment } from './executorTypes'

/**
 * PV1-3b-12's dissolve-side discovery primitive -- `findShardBoundary`'s mirror image, and the
 * counterpart `buildCrossingLegs` never needed on the establish side. `findShardBoundary` answers
 * "these two don't share a host -- where do I mint a fresh chain?" by walking *containment*
 * ancestry, a question with no dependency on whether a relation already exists. This function
 * answers the opposite question -- "these two are already linked by some relation -- what chain
 * already connects them, so a dissolve can remove it?" -- which containment ancestry cannot answer
 * (a crossing's port carries a `uuidv4()` `portId` unrecoverable from where the objects currently
 * live), so it walks **existing relational edges and ports** instead.
 *
 * Wired into `expandSameHost.ts`'s `dissolveRelation` branch at PV1-3b-14.
 *
 * PV1-3c added `findRelationalChainFromLeg`, a leg-seeded (rather than endpoint-seeded) sibling
 * needed for chain-aware object removal, where the caller has an edge already in hand and no
 * pre-known far endpoint to search for. `findRelationalChain` is now built on top of it (below).
 */
export type RelationalChainStep =
    | { type: 'edge'; hostId: EphemeraMembershipHostId; edge: HostRelationalEdge }
    | { type: 'port'; hostId: EphemeraMembershipHostId; port: EphemeraCrossingPort }

/**
 * `steps` is ordered outward from `subjectId` toward `targetId`, one `edge` per hop and one
 * `port` between a hop's own edge and the next -- the order this walk discovers them in, not
 * necessarily the order a removal pass will want to apply them (PV1-3b-13's own concern, not
 * fixed here). `ambiguous` carries a count, not the candidate chains themselves -- per PV1-3b-11's
 * decision, an ambiguous result declines outright rather than offering a pick, so there is nothing
 * for a caller to do with the individual chains.
 */
export type FindRelationalChainResult =
    | { verdict: 'found'; steps: RelationalChainStep[] }
    | { verdict: 'notFound' }
    | { verdict: 'ambiguous'; chainCount: number }

const edgeMatchesRelation = (
    edge: HostRelationalEdge,
    relationKind: HostRelationalEdgeKind,
    relationLabel: string | undefined
): boolean => edge.kind === relationKind && (edge.kind !== 'Custom' || edge.relationLabel === relationLabel)

/**
 * `findRelationalChainFromLeg`'s per-side result: `endpoint` is the true primitive this side of
 * the seed edge resolves to, `steps` is ordered outward from the seed edge toward it (empty when
 * the seed edge's own terminal on this side was already primitive).
 */
type ResolveEndpointResult =
    | { declined: false; endpoint: EphemeraLudicTerminalPrimitive; steps: RelationalChainStep[] }
    | { declined: true; reason: string }

/**
 * Walks outward from one terminal of an already-known edge until a primitive endpoint is
 * reached. `arrivedFromHostId` is the graph the edge we just traversed lives in -- needed to
 * decide, on hitting a port terminal, which of the port's two candidate graphs (its own owner,
 * or its `fromHostId`) holds the *other* edge that continues the chain: whichever one is **not**
 * the graph we just came from. This directional rule is PV1-3c's fix for a real bug in the
 * pre-existing (single-direction) walk below, which always continued into the port's own owner
 * graph unconditionally -- correct only walking exterior-to-interior (the only direction ever
 * exercised until now), silently wrong walking interior-to-exterior.
 *
 * Past the first hop, a well-formed chain has exactly one continuing edge at each port (every
 * `portId` is minted once, referenced by exactly two edges, PV1-3) -- `matchingEdges.length !== 1`
 * declines rather than picking, the same "decline outright rather than offer a pick" posture
 * PV1-3b-11 already chose for the endpoint-seeded ambiguous verdict.
 */
const resolveEndpoint = (
    terminal: EphemeraLudicTerminalId,
    arrivedFromHostId: EphemeraMembershipHostId,
    relationKind: HostRelationalEdgeKind,
    relationLabel: string | undefined,
    getGraph: ExpansionEnvironment['getGraph'],
    visitedPortIds: ReadonlySet<string>
): ResolveEndpointResult => {
    if (isEphemeraLudicTerminalPrimitive(terminal)) {
        return { declined: false, endpoint: terminal, steps: [] }
    }

    const portId = terminal.port
    if (visitedPortIds.has(portId)) {
        return { declined: true, reason: `port ${portId} revisited (cyclic or malformed graph)` }
    }
    const portOwnerHostId = ephemeraLudicTerminalOwner(terminal)
    const portOwnerGraph = getGraph(portOwnerHostId)
    const port = portOwnerGraph?.ports.find((candidate) => candidate.portId === portId)
    // A port address with no backing port record is a dangling reference, and a `Present` port
    // is a presence port (PR-15: never a crossing) -- either way, a dead end to decline, not a
    // throw; this walk only ever reads already-committed state.
    if (!port || port.kind === 'Present') {
        return { declined: true, reason: `port ${portId} has no backing crossing-port record` }
    }
    const portStep: RelationalChainStep = { type: 'port', hostId: portOwnerHostId, port }

    const searchHostId = portOwnerHostId === arrivedFromHostId ? port.fromHostId : portOwnerHostId
    const graph = getGraph(searchHostId)
    if (!graph) {
        return { declined: true, reason: `host ${searchHostId} has no graph to continue the chain into` }
    }
    const matchingEdges = graph.relationalEdges.filter(
        (edge) =>
            edgeMatchesRelation(edge, relationKind, relationLabel)
            && (ephemeraLudicTerminalsEqual(edge.from, terminal) || ephemeraLudicTerminalsEqual(edge.to, terminal))
    )
    if (matchingEdges.length !== 1) {
        return {
            declined: true,
            reason: `port ${portId} continues via ${matchingEdges.length} matching edges in ${searchHostId}, expected exactly one`,
        }
    }
    const edge = matchingEdges[0]
    const nextTerminal = ephemeraLudicTerminalsEqual(edge.from, terminal) ? edge.to : edge.from
    const edgeStep: RelationalChainStep = { type: 'edge', hostId: searchHostId, edge }

    const rest = resolveEndpoint(
        nextTerminal,
        searchHostId,
        relationKind,
        relationLabel,
        getGraph,
        new Set([...visitedPortIds, portId])
    )
    if (rest.declined) {
        return rest
    }
    return { declined: false, endpoint: rest.endpoint, steps: [portStep, edgeStep, ...rest.steps] }
}

/**
 * `endpoints[0]`/`endpoints[1]` are the true primitive endpoints reached walking outward from
 * `seed.edge.from`/`seed.edge.to` respectively; `steps` is ordered `endpoints[0] -> endpoints[1]`
 * (the seed edge itself in the middle). Order is a display/debugging convenience only --
 * `buildCrossingDissolveLegs` maps each step independently, with no ordering dependency between
 * them.
 */
export type FindRelationalChainFromLegResult =
    | {
        verdict: 'found'
        endpoints: readonly [EphemeraLudicTerminalPrimitive, EphemeraLudicTerminalPrimitive]
        steps: RelationalChainStep[]
    }
    | { verdict: 'declined'; reason: string }

/**
 * the leg-seeded counterpart to `findRelationalChain` below, needed wherever a caller has
 * a specific edge already in hand (from a graph scan) rather than a named subject/target pair to
 * search for -- chain-aware object removal's own use case, where the caller only knows "this
 * object is leaving" and must discover whatever it's connected to, by what, without knowing
 * either the relation kind/label or the far endpoint in advance.
 */
export const findRelationalChainFromLeg = (
    seed: { hostId: EphemeraMembershipHostId; edge: HostRelationalEdge },
    env: Pick<ExpansionEnvironment, 'getGraph'>
): FindRelationalChainFromLegResult => {
    const { hostId, edge } = seed
    const { getGraph } = env
    const relationKind = edge.kind
    const relationLabel = edge.kind === 'Custom' ? edge.relationLabel : undefined

    const fromSide = resolveEndpoint(edge.from, hostId, relationKind, relationLabel, getGraph, new Set())
    if (fromSide.declined) {
        return { verdict: 'declined', reason: fromSide.reason }
    }
    const toSide = resolveEndpoint(edge.to, hostId, relationKind, relationLabel, getGraph, new Set())
    if (toSide.declined) {
        return { verdict: 'declined', reason: toSide.reason }
    }

    const seedStep: RelationalChainStep = { type: 'edge', hostId, edge }
    return {
        verdict: 'found',
        endpoints: [fromSide.endpoint, toSide.endpoint],
        steps: [...[...fromSide.steps].reverse(), seedStep, ...toSide.steps],
    }
}

/**
 * rewritten on top of `findRelationalChainFromLeg` -- finds the candidate first edges
 * directly touching `subjectId` (matching `relationKind`/`relationLabel`), resolves each one's
 * full chain via the leg-seeded walker, and keeps only those whose far endpoint is `targetId`.
 * Preserves the original contract exactly (same input/output shape); `expandSameHost.ts` needs no
 * changes. This also fixes a real, previously-latent directional bug for any candidate that
 * happens to require walking from the interior side of a crossing first (see
 * `resolveEndpoint`'s own doc comment) -- not exercised by any existing caller, which has only
 * ever supplied an exterior-first `subjectId`, but a genuine correctness improvement regardless.
 */
export const findRelationalChain = (
    input: {
        subjectId: EphemeraObjectId
        targetId: EphemeraObjectId
        relationKind: HostRelationalEdgeKind
        /** `relationKind: 'Custom'` only, matching `expandSameHost`'s own pairing. */
        relationLabel?: string
    },
    env: Pick<ExpansionEnvironment, 'getGraph' | 'getCurrentHost'>
): FindRelationalChainResult => {
    const { subjectId, targetId, relationKind, relationLabel } = input
    const { getGraph, getCurrentHost } = env

    const startHostId = getCurrentHost(subjectId)
    if (startHostId === undefined) {
        return { verdict: 'notFound' }
    }
    const graph = getGraph(startHostId)
    if (!graph) {
        return { verdict: 'notFound' }
    }

    const candidateEdges = graph.relationalEdges.filter(
        (edge) =>
            edgeMatchesRelation(edge, relationKind, relationLabel)
            && (ephemeraLudicTerminalsEqual(edge.from, subjectId) || ephemeraLudicTerminalsEqual(edge.to, subjectId))
    )

    const found: RelationalChainStep[][] = []
    for (const edge of candidateEdges) {
        const result = findRelationalChainFromLeg({ hostId: startHostId, edge }, { getGraph })
        if (result.verdict !== 'found') {
            continue
        }
        const subjectIsFromSide = result.endpoints[0] === subjectId
        const farEndpoint = subjectIsFromSide ? result.endpoints[1] : result.endpoints[0]
        if (farEndpoint === targetId) {
            found.push(subjectIsFromSide ? result.steps : [...result.steps].reverse())
        }
    }

    if (found.length === 0) {
        return { verdict: 'notFound' }
    }
    if (found.length > 1) {
        return { verdict: 'ambiguous', chainCount: found.length }
    }
    return { verdict: 'found', steps: found[0] }
}
