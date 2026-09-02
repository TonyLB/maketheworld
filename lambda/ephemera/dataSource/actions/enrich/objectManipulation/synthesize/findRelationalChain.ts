import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort, EphemeraLudicTerminalId, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
 * live), so it walks **existing relational edges and ports** instead (PV1-3b-11).
 *
 * **Not wired into `expandSameHost.ts` by this row** -- `expandSameHost`'s `dissolveRelation`
 * branch still calls `findShardBoundary` unconditionally regardless of `operationKind`, silently
 * correct only for the portless case (see that file's own doc comment). Rewiring the dissolve
 * branch onto this function is PV1-3b-14; emitting the actual remove-leg/remove-port steps from
 * the chain this function finds is PV1-3b-13. This row is the standalone walk and its tests only.
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
 * Depth-first, no cap (PV1-3b-11 decision 4 -- following an already-built chain is a linear walk
 * with no branching to search among, unlike establish's genuinely combinatorial route search).
 * `visitedPortIds` guards against a malformed/cyclic graph re-crossing a port it already used --
 * defensive, not a real shape this data can take by construction (every `portId` is minted once,
 * PV1-3), the same spirit as `walkAncestry`'s own `visited` seed.
 */
const collectChains = (
    terminal: EphemeraLudicTerminalId,
    hostId: EphemeraMembershipHostId,
    targetId: EphemeraObjectId,
    relationKind: HostRelationalEdgeKind,
    relationLabel: string | undefined,
    getGraph: ExpansionEnvironment['getGraph'],
    visitedPortIds: ReadonlySet<string>,
    stepsSoFar: readonly RelationalChainStep[]
): RelationalChainStep[][] => {
    const graph = getGraph(hostId)
    if (!graph) {
        return []
    }

    const matchingEdges = graph.relationalEdges.filter(
        (edge) =>
            edgeMatchesRelation(edge, relationKind, relationLabel)
            && (ephemeraLudicTerminalsEqual(edge.from, terminal) || ephemeraLudicTerminalsEqual(edge.to, terminal))
    )

    const chains: RelationalChainStep[][] = []

    for (const edge of matchingEdges) {
        const nextTerminal = ephemeraLudicTerminalsEqual(edge.from, terminal) ? edge.to : edge.from
        const edgeStep: RelationalChainStep = { type: 'edge', hostId, edge }

        if (isEphemeraLudicTerminalPrimitive(nextTerminal)) {
            // A primitive endpoint that isn't `targetId` is a dead end, not an intermediate hop --
            // per PV-1's model every host boundary a chain crosses does so through a port; two
            // edges meeting at a bystander primitive inside one graph are two separate relations,
            // not one chain continuing.
            if (nextTerminal === targetId) {
                chains.push([...stepsSoFar, edgeStep])
            }
            continue
        }

        const portId = nextTerminal.port
        if (visitedPortIds.has(portId)) {
            continue
        }
        const portOwnerHostId = ephemeraLudicTerminalOwner(nextTerminal)
        const portOwnerGraph = getGraph(portOwnerHostId)
        const port = portOwnerGraph?.ports.find((candidate) => candidate.portId === portId)
        // A port address with no backing port record is a dangling reference, and a `Present`
        // port is a presence port (PR-15: never a crossing) -- either way, a dead end to decline,
        // not a throw; this walk only ever reads already-committed state.
        if (!port || port.kind === 'Present') {
            continue
        }
        const portStep: RelationalChainStep = { type: 'port', hostId: portOwnerHostId, port }

        chains.push(
            ...collectChains(
                nextTerminal,
                portOwnerHostId,
                targetId,
                relationKind,
                relationLabel,
                getGraph,
                new Set([...visitedPortIds, portId]),
                [...stepsSoFar, edgeStep, portStep]
            )
        )
    }

    return chains
}

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

    const chains = collectChains(subjectId, startHostId, targetId, relationKind, relationLabel, getGraph, new Set(), [])

    if (chains.length === 0) {
        return { verdict: 'notFound' }
    }
    if (chains.length > 1) {
        return { verdict: 'ambiguous', chainCount: chains.length }
    }
    return { verdict: 'found', steps: chains[0] }
}
