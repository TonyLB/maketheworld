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
 * See taskPlanning/lambda/ephemera/dataSource/positions/AGENT.ludicCacheReducer.planning.md
 * for the plan this file implements.
 */
import type { EphemeraLudicGraphPort, EphemeraLudicTerminalId, EphemeraLudicTerminalPrimitive, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalOwner, ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { HostRelationalEdge } from './index'
import { EphemeraLudicGraph, nodeFromId, toStoredRelationalEdge } from './index'

/**
 * The bucket a presence port names --- the nodes of `graph` present at that binding. No shipped
 * writer produces a multi-bucket graph today (see the plan's finding), so this rule is invented
 * here, per LR-2/LR-3:
 *
 * - Keyed on `portId` alone (LR-3), never on host id --- a graph may carry more than one
 *   presence port.
 * - The root is in the bucket unconditionally (PR-9), regardless of which arm below applies.
 * - **Zero or one presence port on `graph`:** every node in `graph.nodeIds` is in the bucket ---
 *   the degenerate case the plan's finding documents (at most one presence port means *reached
 *   from the port* and *every node* coincide; with zero ports there is no split to speak of
 *   either).
 * - **More than one presence port:** membership is the nodes reached by a single `Present`-kind
 *   edge whose `from` is the port-qualified terminal `{ owner: graph.hostId, port: portId }` ---
 *   a direct edge lookup, not a transitive walk. PR-4 fixes `Present` edges as running
 *   PORT -> NODE, never node -> node, so within one graph there is nothing to chain onto after
 *   the first hop (multi-level containment inside a single graph is explicitly out of scope,
 *   PR-4's exclusion list item 5). A `to` endpoint may itself be port-qualified (the
 *   nested-cover-alignment case, PR-C1's `port_A -[Present]-> GHG#port_1`); it is resolved to
 *   its owning node, since the cover ranges over nodes only (PR-9).
 *
 * `ephemeraLudicTerminalsEqual` is used to match the `from` terminal, not id comparison --- a
 * port-qualified terminal and a bare id on the same owner are deliberately not equal.
 */
export const nodesFromPresencePort = (
    graph: EphemeraLudicGraph,
    portId: string
): Set<EphemeraLudicTerminalPrimitive> => {
    const root = ephemeraLudicTerminalOwner(graph.rootId)
    const presencePortCount = graph.ports.filter((port) => port.kind === 'Present').length
    if (presencePortCount <= 1) {
        return new Set([...graph.nodeIds, root])
    }
    const portTerminal = { owner: graph.hostId, port: portId }
    return graph.relationalEdges
        .filter((edge) => edge.kind === 'Present' && ephemeraLudicTerminalsEqual(edge.from, portTerminal))
        .reduce(
            (nodes, edge) => nodes.add(ephemeraLudicTerminalOwner(edge.to)),
            new Set<EphemeraLudicTerminalPrimitive>([root])
        )
}

/**
 * 1b-i: a pure, local re-encoding of exactly the fields `edgesMatch` (`baseClasses.ts`) treats
 * as an edge's identity --- `from`, `to`, `kind`, `relationLabel` on `Custom`, `chainId`.
 * Deliberately duplicated rather than imported (LR-1's dependency tag): two edges can only
 * collide on this key if the graph's own comparison already cannot tell them apart, so it is a
 * canonical encoding of existing identity, not a separate scheme. Used to mint a stub port's id
 * below, and nowhere else --- it is not a general edge hash.
 */
const edgeIdentityKey = (edge: HostRelationalEdge): string => {
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
 * The sub-graph a set of nodes induces on `graph`, per LR-1: all of `nodes`, all the edges
 * between them, and --- the decision this function exists to implement --- what becomes of an
 * edge with exactly one endpoint outside `nodes`. **Drop is unavailable** (C7): the cut always
 * lands on a port, real or minted.
 *
 * - **Both endpoints in `nodes`:** kept unchanged.
 * - **Neither endpoint in `nodes`:** dropped --- it doesn't touch this bucket (PR-9's cover
 *   ranges over nodes, and an edge naming none of them has nothing to anchor it here).
 * - **Exactly one endpoint outside `nodes` (a straddle):**
 *   - **Already port-qualified far endpoint** --- LR-1's narrow case, true whenever the far node
 *     genuinely belongs to a different graph (a bare id cannot refer across hosts). Kept
 *     unchanged; nothing is minted, since that port's home graph is the other side, not this one.
 *   - **Bare-id far endpoint** --- LR-1's straddle proper: a peer in *this same* graph that
 *     simply isn't in the chosen bucket (PR-C1), with no port anywhere to fall back on. A stub
 *     port is minted (1b-ii) and that endpoint is rewritten to `{ owner: graph.hostId, port }`,
 *     the same addressing idiom `nodesFromPresencePort` already uses for the graph's own ports.
 *
 * Returns an `EphemeraLudicGraph` rather than a bespoke shape --- the induced sub-graph is a
 * graph on the *same* host (a bucket is a cut of `graph`, not a different graph), so `hostId` and
 * `rootId` are carried over unchanged; the root is always present in `nodes` by Slice 1a's own
 * contract. The returned graph's `ports` are exactly the stub ports minted here, never `graph`'s
 * own port entries --- those are a concern for whichever caller reads the parent graph directly.
 *
 * Transient only (LR-1): minting never writes to `edge.edgeId` and never mutates `graph`.
 */
export const subGraphFromNodes = (
    graph: EphemeraLudicGraph,
    nodes: Set<EphemeraLudicTerminalPrimitive>
): EphemeraLudicGraph => {
    const subNodes = [...graph.nodeIds].filter((id) => nodes.has(id)).map(nodeFromId)

    const { edges, ports } = graph.relationalEdges.reduce<{
        edges: HostRelationalEdge[]
        ports: EphemeraLudicGraphPort[]
    }>(
        (acc, edge) => {
            const fromIn = nodes.has(ephemeraLudicTerminalOwner(edge.from))
            const toIn = nodes.has(ephemeraLudicTerminalOwner(edge.to))
            if (fromIn && toIn) {
                return { ...acc, edges: [...acc.edges, edge] }
            }
            if (!fromIn && !toIn) {
                return acc
            }
            const outsideTerminal = fromIn ? edge.to : edge.from
            if (typeof outsideTerminal !== 'string') {
                // Already port-qualified --- LR-1's narrow case, nothing to mint.
                return { ...acc, edges: [...acc.edges, edge] }
            }
            // A bare-id straddle can never be `Present`-kind: `Present` edges structurally run
            // PORT -> NODE (PR-4), so `edge.kind` here is always `Exclude<HostRelationalEdgeKind,
            // 'Present'>` --- exactly what a crossing port's `kind` field requires --- with no
            // cast needed beyond narrowing the union.
            const portId = edgeIdentityKey(edge)
            const port: EphemeraLudicGraphPort = {
                portId,
                fromHostId: outsideTerminal,
                kind: edge.kind as Exclude<HostRelationalEdgeKind, 'Present'>,
                ...(edge.kind === 'Custom' ? { exteriorRelationLabel: edge.relationLabel } : {}),
            }
            const stubTerminal = { owner: graph.hostId, port: portId }
            const rewritten = fromIn ? { ...edge, to: stubTerminal } : { ...edge, from: stubTerminal }
            return { edges: [...acc.edges, rewritten], ports: [...acc.ports, port] }
        },
        { edges: [], ports: [] }
    )

    return EphemeraLudicGraph.fromFieldPayload(graph.hostId, {
        rootId: graph.rootId,
        nodes: subNodes,
        edges: edges.map(toStoredRelationalEdge),
        ports,
    })
}
