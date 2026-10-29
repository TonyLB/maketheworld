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
 * the move --- a hosted thing lives in its host's own shard and travels with it, and its hosting kind
 * is a field of its node, so no hosting kind reaches this table.
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
        case 'Justifies':
            // Both terminals are edges of one graph, so a part's move never sees one as a
            // boundary edge: its legs are not incident to any component.
            return 'defer'
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
        // `edge.from`/`.to` are widened to `EphemeraLudicNodeTerminal`, but the mover is
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
