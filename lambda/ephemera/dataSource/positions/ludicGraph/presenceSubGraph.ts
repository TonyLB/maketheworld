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
 * Slice 2b: the node set for *more than one* binding into the same parent --- a child present at
 * one parent shard through two presence ports (two bindings), rather than one. Folds
 * `nodesFromPresencePort` over `portIds` and unions the results.
 *
 * **Why this is the whole of 2b.** The naive move would cut each bucket separately
 * (`subGraphFromNodes` once per port) and merge the two resulting graphs afterward --- but that
 * merge would need its own reconciliation step, since a node exclusive to one bucket and joined
 * by a content edge to a node exclusive to the other would come back independently stub-ported
 * on each side. `subGraphFromNodes` takes a node
 * *set*, not a prior cut, so cutting once over the union avoids the artifact instead of undoing
 * it: `subGraphFromNodes(graph, nodesFromPresencePorts(graph, portIds))`. This function supplies
 * only that union; the single-cut composition is the caller's job.
 */
export const nodesFromPresencePorts = (
    graph: EphemeraLudicGraph,
    portIds: string[]
): Set<EphemeraLudicTerminalPrimitive> =>
    portIds.reduce(
        (acc, portId) => new Set([...acc, ...nodesFromPresencePort(graph, portId)]),
        new Set<EphemeraLudicTerminalPrimitive>()
    )

/**
 * 1b-i: the id of a stub port minted for a same-host straddle. Two things have to be true of it,
 * and they pull in different directions --- it must come out **identical from both sides of the
 * cut** (the matching mechanism: two buckets discover they hold halves of one edge by both naming
 * the port after the whole), and it must be **recognizable as a stub** rather than an authored
 * crossing port.
 *
 * **The `STUB-` prefix is load-bearing, not decoration.** A stub is minted carrying the severed
 * edge's own `kind`, so `isCrossingPort` --- which narrows on `kind` --- cannot tell a stub from an
 * authored `EphemeraCrossingPort`. The same-host merge needs that distinction to avoid treating a
 * real boundary present in two buckets as a severed edge to splice. The clean discriminator is a
 * field on the port type, but that is `ephemeraMeta.ts`, outside LR-1's dependency tag above; a
 * recognizable id is the version of it available in here. **Nothing sniffs the prefix yet** --- it
 * is minted ahead of the consumer deliberately, so that landing the merge-side change is a change
 * to one function rather than two.
 *
 * **Two forms, and why `chainId` is admissible as a key.** `chainId` is a *chain* identity while
 * this is an *edge* identity, which is a real category distinction --- but a chain contributes **at
 * most one leg per host** (a chain's waypoints are ports and its terminals are nodes, so it cannot
 * double back), and a stub id is only ever required to be unique *among stub ports in this one
 * cut*. At that scope the chain names the leg unambiguously. That is a property of construction,
 * not an invariant the types enforce: see `subGraphFromNodes`'s duplicate check, which exists to
 * make its violation loud.
 *
 * The fallback re-encodes exactly the fields `edgesMatch` (`baseClasses.ts`) treats as an edge's
 * identity. Deliberately duplicated rather than imported (LR-1's dependency tag): two edges can
 * only collide on it if the graph's own comparison already cannot tell them apart, so it is a
 * canonical encoding of existing identity, not a separate scheme. `chainId` is absent from it
 * because this branch is only reached when `edge.chainId` is falsy, and a zero-length `chainId` is
 * rejected at the type guard --- so it would contribute a constant, and reading as though the
 * branch discriminated on it.
 */
const stubPortIdFromEdge = (edge: HostRelationalEdge): string => {
    if (edge.chainId) {
        return `STUB-${edge.chainId}`
    }
    const terminalKey = (terminal: EphemeraLudicTerminalId): string =>
        typeof terminal === 'string' ? terminal : `${terminal.owner}#${terminal.port}`
    return `STUB-${JSON.stringify([
        terminalKey(edge.from),
        terminalKey(edge.to),
        edge.kind,
        edge.kind === 'Custom' ? edge.relationLabel : '',
    ])}`
}

/**
 * The sub-graph a set of nodes induces on `graph`, per LR-1: all of `nodes`, all the *content*
 * edges between them, and --- the decision this function exists to implement --- what becomes of
 * a content edge with exactly one endpoint outside `nodes`. **Drop is unavailable** (C7): the cut
 * always lands on a port, real or minted.
 *
 * **`Present`-kind edges are excluded before any of that classification runs (LR-6, revised).**
 * They are bucket-membership metadata --- `nodesFromPresencePort` has already fully consumed them
 * to produce `nodes` --- not a spatial relationship between two members the way `Under`/`Custom`/
 * `PartOf` are, so they are never interior content, never dropped, and never straddle-minted; they
 * simply do not participate. (They are also, mechanically, guaranteed to straddle in the naive
 * classification for every node outside the current bucket in a multi-port graph: a `Present`
 * edge's `from` always resolves to the root, which PR-9 puts in *every* bucket, so `fromIn` is
 * always true and `toIn` is false for any node exclusively in a different bucket --- treating that
 * as an ordinary straddle would mint a redundant synthetic port for a crossing a *real* port
 * already documents.) **Deactivated rather than deleted:** whether an interior node's own
 * `Present` edge needs representing again --- e.g. as merge-time provenance --- is a question for
 * Slice 2's ludicCache merge design, not this function; it may return in a different form once
 * that lands.
 *
 * Remaining (non-`Present`) content edges:
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
 * contract. The returned graph's `ports` are the minted stub ports plus **all** of `graph`'s own
 * presence ports, regardless of bucket (LR-6): `fromHostId` on a presence port is already the
 * "which shard is this whole home to" fact, independent of which bucket is being extracted, so
 * carrying every one of them forward makes that fact recoverable from any single bucket's
 * sub-graph with no merge-time reconciliation needed later. (Non-presence ports of `graph` are
 * not carried through --- only the boundary this bucket itself cuts, plus the whole's own
 * presence bindings.)
 *
 * Transient only (LR-1): minting never writes to `edge.edgeId` and never mutates `graph`.
 */
export const subGraphFromNodes = (
    graph: EphemeraLudicGraph,
    nodes: Set<EphemeraLudicTerminalPrimitive>
): EphemeraLudicGraph => {
    const subNodes = [...graph.nodeIds].filter((id) => nodes.has(id)).map(nodeFromId)

    const contentEdges = graph.relationalEdges.filter((edge) => edge.kind !== 'Present')

    const { edges, ports } = contentEdges.reduce<{
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
            // Never `Present`-kind here --- excluded above --- so `edge.kind` is always
            // `Exclude<HostRelationalEdgeKind, 'Present'>`, exactly what a crossing port's `kind`
            // field requires, with no narrowing left to do beyond the cast itself.
            const portId = stubPortIdFromEdge(edge)
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

    // Two stubs minted with one id in a single cut is a data-integrity break, not a case to paper
    // over --- the same stance `legsAgree` takes in the reducer. It would otherwise be silent:
    // `fromFieldPayload` copies `ports` without deduping (unlike `addPort`), and the merge resolves
    // legs with `.find`, so the second crossing would simply be discarded. Reachable only by
    // violating "at most one leg of a chain per host", which nothing enforces --- hence a check
    // rather than a comment.
    const duplicateStubId = ports
        .map(({ portId }) => portId)
        .find((portId, index, all) => all.indexOf(portId) !== index)
    if (duplicateStubId !== undefined) {
        throw new Error(
            `Two straddling edges on ${graph.hostId} mint the same stub port id ${duplicateStubId}`
        )
    }

    const presencePorts = graph.ports.filter((port) => port.kind === 'Present')

    return EphemeraLudicGraph.fromFieldPayload(graph.hostId, {
        rootId: graph.rootId,
        nodes: subNodes,
        edges: edges.map(toStoredRelationalEdge),
        ports: [...presencePorts, ...ports],
    })
}
