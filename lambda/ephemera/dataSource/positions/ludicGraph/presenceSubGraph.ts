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
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalOwner, ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from './index'

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
