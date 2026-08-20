import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalRefersTo } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph, objectNode, toStoredRelationalEdge, type HostRelationalEdge } from '../index'

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
        case 'In':
        case 'PartOf':
            // LP4c-i placeholder: unreachable today (LD-13 keeps containment off the ingress
            // path), and must stay a throw, not a real classification -- LD-11 decides what
            // these return. Replace before ludicCache authors containment nesting directly,
            // which is this throw's actual expiry, not LP4c-ii landing.
            throw new Error(`classifyInteractionUnderTransfer: containment kind '${relationKind}' not yet classified (LD-11)`)
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
            if (!isEphemeraObjectId(otherId) || closureSet.has(otherId)) {
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
        const fromInSet = isEphemeraObjectId(edge.from) && transferSet.has(edge.from)
        const toInSet = isEphemeraObjectId(edge.to) && transferSet.has(edge.to)
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
