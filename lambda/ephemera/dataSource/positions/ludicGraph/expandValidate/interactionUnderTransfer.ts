import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph, HostRelationalEdge } from '../index'

export type TransferEndpointRole = 'subject' | 'target'

// `dissolve` has no producer since ISS8216 slice 3 (every peer edge defers). It is kept as the
// no-judgment class the design reserves for a future LLM tier; see Slice 5 of
// taskPlanning/.../AGENT.retireDeterministicRelationParsing.planning.md.
export type InteractionUnderTransferOutcome = 'dissolve' | 'defer'

/**
 * What happens to an existing relation when one of its endpoints moves: `dissolve` (the move
 * severs it, no judgment needed) or `defer` (an interaction to assess). Nothing is absorbed into
 * the move --- a hosted thing lives in its host's own shard and travels with it, so hosting kinds
 * never reach this table (see the throw below).
 *
 * Every peer relation is `Custom`, and it defers whichever end moves: whether a severed peer edge
 * matters (clearance under a table, a rope still lashed) is an interaction judgment for the
 * adjudicator, not a fixed rule. The closed `Under`/`Against` kinds, which dissolved on some
 * moves, are retired (ISS8216 slice 3).
 */
export function classifyInteractionUnderTransfer(
    relationKind: HostRelationalEdgeKind,
    _movedRole: TransferEndpointRole
): InteractionUnderTransferOutcome {
    switch (relationKind) {
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
            // One shape now has a producer: a moved object's own edge into the host it
            // is leaving, member -> that host's root. `buildObjectMoveOp` (3d, 2026-09-08 ---
            // formerly `executeMembershipTransfer`'s retired `honorDefer` mode) strips that edge
            // from the graph before this classifier ever sees it, so it never reaches here. Every
            // other hosting-kind edge reaching this branch is still the unauthored-graph case above.
            //
            // What would legitimately retire this throw: AB-53 keeps containment root-to-part
            // as an ITERATION-1 CONSTRUCTOR DISCIPLINE, not a structural lock. If multi-level
            // graphs ever land, a containment edge can appear here and this becomes a real
            // decision again. Note that even then the answer is likely to be moving the
            // contained thing with its shard rather than classifying it -- AB-5's
            // mint/move/dissolve covers that without traversal.
            throw new Error(`classifyInteractionUnderTransfer: '${relationKind}' has no producer on an exterior graph in iteration 1 (AB-53/AB-54); reaching here means a producer built a graph the constructor does not author`)
        // `case 'Present':` deleted at presenceNodes Slice 3 (PN-14): `'Present'` retired from
        // `HostRelationalEdgeKind` with the edge sense, so this switch has no type left to match
        // it against -- comment and case go together, since the comment's "nothing constructs one
        // yet" would otherwise become "never" without anyone noticing.
    }
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
    graph: EphemeraLudicGraph,
    /**
     * Edges the move itself removes, so they are not boundary edges: the mover's own containment
     * edge into the host it is leaving, which the move op dissolves. A predicate, not a list:
     * `relationalEdges` builds fresh edge objects on every read, so identity never matches.
     */
    isRemovedByMove: (edge: HostRelationalEdge) => boolean = () => false
): BoundaryEdgeOutcome[] {
    const results: BoundaryEdgeOutcome[] = []
    for (const edge of graph.relationalEdges) {
        if (isRemovedByMove(edge)) {
            continue
        }
        // `edge.from`/`.to` are widened to `EphemeraLudicTerminalPrimitive`, but `transferSet` is
        // Object-only: the caller's transfer set is Object | Character and filters back down to
        // Object before calling in here (applyTransferSet.ts). See `ludicGraph/AGENT.md`'s
        // "Character-relation widening" note.
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
