import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { EphemeraLudicGraph, HostRelationalEdge } from '../index'

export type TransferEndpointRole = 'subject' | 'target'

export type InteractionUnderTransferOutcome = 'dissolve' | 'carry' | 'defer'

/**
 * SB-5 table (three outcomes). `carry` only exists where there is an actual
 * object to absorb (a load relation, `On`); `Under`'s subject-move ambiguity
 * is spatial clearance, not "what happens to some other object," so it stays
 * `defer` rather than gaining a carry partner.
 */
export function classifyInteractionUnderTransfer(
    relationKind: HostRelationalEdgeKind,
    movedRole: TransferEndpointRole
): InteractionUnderTransferOutcome {
    switch (relationKind) {
        case 'On':
            return movedRole === 'subject' ? 'dissolve' : 'carry'
        case 'Under':
            return movedRole === 'subject' ? 'defer' : 'dissolve'
        case 'Against':
            return 'dissolve'
        case 'Custom':
            return 'defer'
    }
}

export function roleOfObjectInEdge(
    objectId: EphemeraObjectId,
    edge: HostRelationalEdge
): TransferEndpointRole | undefined {
    if (edge.from === objectId) {
        return 'subject'
    }
    if (edge.to === objectId) {
        return 'target'
    }
    return undefined
}

/**
 * A carry closure is a rooted sub-DAG of the source graph, not just a flat
 * member set (PB-8): `rootId` is the starting entity, `members` the absorbed
 * set, `edges` the closure's *internal* edges only (both endpoints inside
 * `members`) --- the induced subgraph, not the severed boundary edges, which
 * stay with `boundaryEdgeOutcomes` and Expansion (PB-9).
 *
 * This is a rooted graph, which is precisely what `EphemeraLudicGraph`
 * would already be if it carried a root. If `positionGraph` ever gains a
 * root concept, this shape should collapse into it rather than persist as a
 * parallel shape re-expressing the same idea (see the reciprocal note on the
 * `positionGraph` side).
 */
export type CarryClosureFragment = {
    rootId: EphemeraObjectId
    members: ReadonlySet<EphemeraObjectId>
    edges: readonly HostRelationalEdge[]
}

/**
 * Transitively absorb objects connected via `carry`-classified edges into one
 * transfer set, iterating to a fixpoint --- re-examining each newly-absorbed
 * object's own edges, not just the starting object's. Guarded by the set
 * itself: an already-absorbed id is never re-enqueued, so a malformed cyclic
 * edge set terminates instead of looping. Each `carry` absorption fires on
 * exactly one edge, so that edge is collected as an internal edge in the
 * same pass.
 */
export function computeCarryClosure(
    startId: EphemeraObjectId,
    graph: EphemeraLudicGraph
): CarryClosureFragment {
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
            if (closureSet.has(otherId)) {
                continue
            }
            if (classifyInteractionUnderTransfer(edge.kind, movedRole) === 'carry') {
                closureSet.add(otherId)
                internalEdges.push(edge)
                queue.push(otherId)
            }
        }
    }

    return { rootId: startId, members: closureSet, edges: internalEdges }
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
        const fromInSet = transferSet.has(edge.from)
        const toInSet = transferSet.has(edge.to)
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
