import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'

/**
 * Directed-cycle check over one host's relational edges of a single kind
 * (Step 2b step 5, BD-23). Walks `graph.relationalEdges` filtered to `kind`
 * as a directed `from -> to` graph and reports whether any cycle exists ---
 * a self-edge (`from === to`) is a one-node cycle, caught by the same walk
 * with no special case. Scoped to `'On' | 'Under'` only (not `Against`/
 * `Custom`): those are the two kinds whose real-world semantics imply a
 * hierarchy that cannot loop back on itself; `Against` and `Custom` are
 * deliberately out of scope here, per the same "grow as concrete cases
 * demand" discipline this codebase already applies to Expansion/Assertion.
 *
 * `'On' | 'Under'` is its own grouping, not AB-54's hosting-kind/peer-kind
 * partition (`On` hosts, `Under` is a peer) -- recorded, not resolved, on
 * AB-63 in AGENT.abstractionLayers.planning.md, which owns whether/how this
 * parameter should change. (That row was LD-12 in the ludicGraph-ports plan
 * until 2026-08-23; it moved when that plan closed.)
 */
type CycleWalkState = {
    /** Nodes on the current recursion path --- a hit here is a genuine cycle. */
    visiting: ReadonlySet<EphemeraObjectId>
    /** Nodes already fully explored (from any root) without finding a cycle --- memoization, not path state. */
    visited: ReadonlySet<EphemeraObjectId>
}

type CycleWalkResult = {
    hasCycle: boolean
    visited: ReadonlySet<EphemeraObjectId>
}

export function detectRelationalCycle(
    graph: EphemeraLudicGraph,
    kind: 'On' | 'Under'
): boolean {
    /**
     * `edge.from`/`.to` are `EphemeraLudicTerminalId`-typed (LP4/LP7) --- any legal
     * host-kind component or a port-qualified reference on one --- but `'On'`/`'Under'` are
     * spatial placement kinds that only ever connect Objects in practice; a non-Object
     * endpoint here would not be a cycle this operator's semantics care about, so it's
     * filtered out rather than asserted on.
     */
    const adjacency = graph.relationalEdges
        .filter((edge) => edge.kind === kind
            && typeof edge.from === 'string' && typeof edge.to === 'string'
            && isEphemeraObjectId(edge.from) && isEphemeraObjectId(edge.to))
        .reduce((acc, edge) => {
            const from = edge.from as EphemeraObjectId
            const to = edge.to as EphemeraObjectId
            acc.set(from, [...(acc.get(from) ?? []), to])
            return acc
        }, new Map<EphemeraObjectId, EphemeraObjectId[]>())

    /**
     * `visiting` is scoped to this call's own stack frame (each recursive
     * call gets its own snapshot, extended by one node) --- no explicit
     * backtracking needed on return, unlike a shared mutated Set. `visited`
     * is threaded through return values instead, since it is a genuine
     * cross-call memoization cache (nodes fully explored from *any* root):
     * passing it as an argument alone, with no way back out, would silently
     * drop memoization across sibling roots in the loop below.
     */
    const hasCycleFrom = (
        node: EphemeraObjectId,
        { visiting, visited }: CycleWalkState = { visiting: new Set(), visited: new Set() }
    ): CycleWalkResult => {
        if (visiting.has(node)) {
            return { hasCycle: true, visited }
        }
        if (visited.has(node)) {
            return { hasCycle: false, visited }
        }

        const nextVisiting = new Set([...visiting, node])
        const nextVisited = new Set([...visited, node])

        return (adjacency.get(node) ?? []).reduce<CycleWalkResult>(
            (acc, neighbor) => (acc.hasCycle
                ? acc
                : hasCycleFrom(neighbor, { visiting: nextVisiting, visited: acc.visited })),
            { hasCycle: false, visited: nextVisited }
        )
    }

    return [...adjacency.keys()].reduce<CycleWalkResult>(
        (acc, node) => (acc.hasCycle
            ? acc
            : hasCycleFrom(node, { visiting: new Set(), visited: acc.visited })),
        { hasCycle: false, visited: new Set() }
    ).hasCycle
}
