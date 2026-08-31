import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalRefersTo } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph, objectNode, toStoredRelationalEdge, type HostRelationalEdge } from '../index'

export type TransferEndpointRole = 'subject' | 'target'

export type InteractionUnderTransferOutcome = 'dissolve' | 'carry' | 'defer'

/**
 * SB-5 table (three outcomes). `carry` was only ever produced by `On`
 * (a load relation); `On` joined the hosting-kind throw below 2026-08-22
 * (Channel D, CD2, reduced scope), so `carry` is now unreachable dead code
 * rather than a live outcome -- retiring it from `InteractionUnderTransferOutcome`
 * and collapsing `computeCarryClosure` to a shard read is CD3, deliberately
 * deferred (not needed to unblock Presence). `Under`'s subject-move ambiguity
 * is spatial clearance, not "what happens to some other object," so it stays
 * `defer` rather than gaining a carry partner.
 */
export function classifyInteractionUnderTransfer(
    relationKind: HostRelationalEdgeKind,
    movedRole: TransferEndpointRole
): InteractionUnderTransferOutcome {
    switch (relationKind) {
        case 'Under':
            return movedRole === 'subject' ? 'defer' : 'dissolve'
        case 'Against':
            return 'dissolve'
        case 'Custom':
            return 'defer'
        case 'On':
        case 'In':
        case 'PartOf':
            // An invariant assertion, not a placeholder awaiting a classification, as of
            // AB-53/AB-54 (2026-08-19). Hosting and containment are one mechanism: a hosting
            // kind ('On', 'In', 'PartOf') puts the subordinate node in its host's own shard,
            // so a containment edge is not present in the exterior graph this classifier runs
            // over, and reaching here means a producer built a graph the constructor does not
            // author. The earlier note here -- "replace before ludicCache nests" -- is withdrawn.
            //
            // One shape now has a producer (PV1-2): a moved object's own edge into the host it
            // is leaving, member -> that host's root. `executeObjectMove` strips that edge from
            // the graph before this classifier (or the executor's operand-expansion, which
            // calls it internally) ever sees it, so it never reaches here. Every other hosting-
            // kind edge reaching this branch is still the unauthored-graph case above.
            //
            // What would legitimately retire this throw: AB-53 keeps containment root-to-part
            // as an ITERATION-1 CONSTRUCTOR DISCIPLINE, not a structural lock. If multi-level
            // graphs ever land, a containment edge can appear here and this becomes a real
            // decision again (LD-11). Note that even then the answer is likely to be deleting
            // the carry path rather than classifying it -- AB-5's mint/move/dissolve covers
            // carry behaviour without traversal. Until then, LD-11 survives only for the
            // 'Against' reconciliation, which is a peer kind and never lands in this branch.
            throw new Error(`classifyInteractionUnderTransfer: '${relationKind}' has no producer on an exterior graph in iteration 1 (AB-53/AB-54); reaching here means a producer built a graph the constructor does not author`)
        case 'Present':
            // Not a hosting/containment kind (AB-53/AB-54 doesn't apply): a 'Present' edge is
            // port -> node, the presence plan's own third "partitioning" class (PR-4, reading
            // (d)). Nothing constructs one yet, and this classifier has never been asked to
            // route a port-qualified endpoint --- reaching here means a producer built a graph
            // this transfer classifier does not yet know how to handle.
            throw new Error(`classifyInteractionUnderTransfer: '${relationKind}' is not yet classifiable here (presence plan PR-4/reading (d)); reaching here means a producer built a graph the constructor does not author`)
    }
}

export function roleOfObjectInEdge(
    objectId: EphemeraObjectId,
    edge: HostRelationalEdge
): TransferEndpointRole | undefined {
    if (ephemeraLudicTerminalRefersTo(edge.from, objectId)) {
        return 'subject'
    }
    if (ephemeraLudicTerminalRefersTo(edge.to, objectId)) {
        return 'target'
    }
    return undefined
}

/**
 * Transitively absorb objects connected via `carry`-classified edges into one
 * transfer set, iterating to a fixpoint --- re-examining each newly-absorbed
 * object's own edges, not just the starting object's. Guarded by the set
 * itself: an already-absorbed id is never re-enqueued, so a malformed cyclic
 * edge set terminates instead of looping. Each `carry` absorption fires on
 * exactly one edge, so that edge is collected as an internal edge in the
 * same pass.
 *
 * Returns an `EphemeraLudicGraph` --- a carry closure is a rooted sub-DAG of
 * the source graph (PB-8), which is exactly what `EphemeraLudicGraph` is
 * once it carries a root (LP4a). Built with `hostId = rootId = startId` (the
 * object being moved; `EphemeraObjectId` is a legal `EphemeraMembershipHostId`
 * member per LP0), `nodes` the absorbed members, `edges` the closure's
 * *internal* edges only (both endpoints inside the member set) --- the
 * induced subgraph, not the severed boundary edges, which stay with
 * `boundaryEdgeOutcomes` and Expansion (PB-9). This collapses the former
 * standalone `CarryClosureFragment` shape into the class rather than
 * persisting it as parallel duplication (see the reciprocal note on the
 * `ludicGraph` side, `AGENT.md`).
 */
export function computeCarryClosure(
    startId: EphemeraObjectId,
    graph: EphemeraLudicGraph
): EphemeraLudicGraph {
    const closureSet = new Set<EphemeraObjectId>([startId])
    const internalEdges: HostRelationalEdge[] = []
    const queue: EphemeraObjectId[] = [startId]
    const edges = graph.relationalEdges

    while (queue.length > 0) {
        const current = queue.shift() as EphemeraObjectId
        for (const edge of edges) {
            const movedRole = roleOfObjectInEdge(current, edge)
            if (movedRole === undefined) {
                continue
            }
            const otherId = movedRole === 'subject' ? edge.to : edge.from
            /**
             * LP4 widened `edge.from`/`.to` to `EphemeraLudicTerminalPrimitive`, but carry
             * closure is still Object-only here (this module's collapse into a rooted
             * `ludicGraph` is LP4a's job, not the Object-only narrowing's) --- a non-Object
             * `otherId` can't occur in practice yet, since nothing produces a relational edge
             * with a non-Object endpoint, but skip rather than assume. LP4h checked and does
             * not retire this narrow --- its scope is `applyTransferSet`'s transfer-set
             * parameter, not this module. This remains unowned; see `ludicGraph/AGENT.md`'s
             * "Character-relation widening, deferred (BD-36)" note.
             */
            if (typeof otherId !== 'string' || !isEphemeraObjectId(otherId) || closureSet.has(otherId)) {
                continue
            }
            if (classifyInteractionUnderTransfer(edge.kind, movedRole) === 'carry') {
                closureSet.add(otherId)
                internalEdges.push(edge)
                queue.push(otherId)
            }
        }
    }

    return EphemeraLudicGraph.fromJSON({
        hostId: startId,
        rootId: startId,
        nodes: [...closureSet].map(objectNode),
        edges: internalEdges.map(toStoredRelationalEdge),
        ports: [],
    })
}

export type BoundaryEdgeOutcome = {
    edge: HostRelationalEdge
    movedRole: TransferEndpointRole
    outcome: InteractionUnderTransferOutcome
}

/**
 * Edges crossing the boundary of a resolved transfer set --- exactly one
 * endpoint inside the set --- each classified. Edges with both endpoints
 * inside the set are internal (never evaluated, never dissolved) and are
 * not part of this result.
 */
export function boundaryEdgeOutcomes(
    transferSet: ReadonlySet<EphemeraObjectId>,
    graph: EphemeraLudicGraph
): BoundaryEdgeOutcome[] {
    const results: BoundaryEdgeOutcome[] = []
    for (const edge of graph.relationalEdges) {
        // Same LP4-vs-LP4a boundary as computeCarryClosure above: transferSet is Object-only.
        // LP4h widened its caller's transfer set to Object | Character but filters back down to
        // Object before calling in here (applyTransferSet.ts) --- this function's own scope is
        // unchanged, and remains unowned the same way computeCarryClosure's narrow does above.
        const fromInSet = typeof edge.from === 'string' && isEphemeraObjectId(edge.from) && transferSet.has(edge.from)
        const toInSet = typeof edge.to === 'string' && isEphemeraObjectId(edge.to) && transferSet.has(edge.to)
        if (fromInSet === toInSet) {
            continue
        }
        const movedRole: TransferEndpointRole = fromInSet ? 'subject' : 'target'
        results.push({
            edge,
            movedRole,
            outcome: classifyInteractionUnderTransfer(edge.kind, movedRole),
        })
    }
    return results
}
