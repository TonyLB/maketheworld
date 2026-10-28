import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph, HostRelationalEdge } from '../index'

export type TransferEndpointRole = 'subject' | 'target'

// `dissolve` has no producer (every peer edge defers). It is kept as the no-judgment class reserved
// for a future LLM tier.
export type InteractionUnderTransferOutcome = 'dissolve' | 'defer'

/**
 * What happens to an existing relation when one of its endpoints moves: `dissolve` (the move
 * severs it, no judgment needed) or `defer` (an interaction to assess). Nothing is absorbed into
 * the move --- a hosted thing lives in its host's own shard and travels with it, so hosting kinds
 * never reach this table (see the throw below).
 *
 * Every peer relation is `Custom`, and it defers whichever end moves (`ConnectedTo`, topology
 * within one whole, defers the same way): whether a severed peer edge
 * matters (clearance under a table, a rope still lashed) is an interaction judgment for the
 * adjudicator, not a fixed rule. The closed `Under`/`Against` kinds, which dissolved on some
 * moves, no longer exist.
 */
export function classifyInteractionUnderTransfer(
    relationKind: HostRelationalEdgeKind,
    _movedRole: TransferEndpointRole
): InteractionUnderTransferOutcome {
    switch (relationKind) {
        case 'Custom':
            return 'defer'
        case 'ConnectedTo':
            // A `ConnectedTo` edge reaches this graph only when a part moves out of its own whole,
            // which tears the whole apart: an interaction for the adjudicator, as a peer edge is,
            // as a first iteration.
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
            // The mover's own edge into the host it is leaving used to be the one producer. A hosting
            // kind is now a field of the member's node (hostingKindOnNode HK-3/HK-7), which leaves
            // with the node, so no writer produces a hosting-kind edge and this branch is
            // unreachable. Slice 3 of that plan narrows the stored edge type and removes the branch.
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
 * The mover's boundary edges --- relational edges with the mover at one end and something staying
 * behind at the other --- each classified. A move names one object (anything it hosts lives in its
 * own shard and travels with it), so no edge has both ends moving.
 */
export function boundaryEdgeOutcomes(
    moverId: EphemeraObjectId,
    graph: EphemeraLudicGraph
): BoundaryEdgeOutcome[] {
    const results: BoundaryEdgeOutcome[] = []
    for (const edge of graph.relationalEdges) {
        // `edge.from`/`.to` are widened to `EphemeraLudicTerminalPrimitive`, but the mover is
        // Object-only: `applyDeparture.ts` calls in here only for an object. See
        // `ludicGraph/AGENT.md`'s "Character-relation widening" note.
        const fromIsMover = edge.from === moverId
        const toIsMover = edge.to === moverId
        if (fromIsMover === toIsMover) {
            continue
        }
        const movedRole: TransferEndpointRole = fromIsMover ? 'subject' : 'target'
        results.push({
            edge,
            movedRole,
            outcome: classifyInteractionUnderTransfer(edge.kind, movedRole),
        })
    }
    return results
}
