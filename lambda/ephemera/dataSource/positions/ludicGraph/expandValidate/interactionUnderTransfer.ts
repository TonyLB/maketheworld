import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ClosedRelationKind, HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalRefersTo, isClosedRelationKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { EphemeraLudicGraph, objectNode, type HostRelationalEdge } from '../index'

export type TransferEndpointRole = 'subject' | 'target'

export type InteractionUnderTransferOutcome = 'dissolve' | 'defer'

/**
 * SB-5 table, two outcomes. `carry` was retired 2026-09-06 (CD3): it was only ever produced
 * by `On`, and `On` joined the hosting-kind throw below 2026-08-22 (Channel D, CD2), so it had
 * been unreachable dead code since then.
 *
 * The closed-kind pair (`Under`/`Against`) is a lookup into `CLOSED_RELATION_BEHAVIOR` below,
 * not case arms (MS-9, 2026-09-06): `ephemeraMeta.ts`'s `CLOSED_RELATION_KINDS` array is the
 * source of truth for which kinds get the deterministic fast-path, and this table is the local
 * behavior TypeScript forces an update to if that array ever grows. `Under`'s subject-move
 * ambiguity is spatial clearance, not "what happens to some other object," so it stays `defer`.
 */
const CLOSED_RELATION_BEHAVIOR: Record<ClosedRelationKind, {
    onSubjectMove: InteractionUnderTransferOutcome
    onTargetMove: InteractionUnderTransferOutcome
}> = {
    Under: { onSubjectMove: 'defer', onTargetMove: 'dissolve' },
    Against: { onSubjectMove: 'dissolve', onTargetMove: 'dissolve' },
}

export function classifyInteractionUnderTransfer(
    relationKind: HostRelationalEdgeKind,
    movedRole: TransferEndpointRole
): InteractionUnderTransferOutcome {
    if (isClosedRelationKind(relationKind)) {
        const behavior = CLOSED_RELATION_BEHAVIOR[relationKind]
        return movedRole === 'subject' ? behavior.onSubjectMove : behavior.onTargetMove
    }
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
 * Returns the moved object's own closure as an `EphemeraLudicGraph` --- always a singleton
 * today (`hostId = rootId = startId`, no other nodes, no edges): CD3 (2026-09-06) retired
 * `carry` from `InteractionUnderTransferOutcome`, and no other outcome ever warranted
 * absorbing another object into the set, so this stopped being a BFS. It still walks every
 * edge touching `startId` and re-runs `classifyInteractionUnderTransfer` on each, purely for
 * the AB-54 hosting-kind invariant throw --- a room holding a pre-existing hosting-kind edge
 * would surface it here, at the earliest point that can catch it.
 *
 * What a genuine multi-member closure would read from instead (a shard read, per CD3) is
 * unbuilt, and deliberately not built here: nothing today produces a moved object with real
 * absorbed members, so there is nothing yet to read.
 */
export function computeCarryClosure(
    startId: EphemeraObjectId,
    graph: EphemeraLudicGraph
): EphemeraLudicGraph {
    for (const edge of graph.relationalEdges) {
        const movedRole = roleOfObjectInEdge(startId, edge)
        if (movedRole === undefined) {
            continue
        }
        const otherId = movedRole === 'subject' ? edge.to : edge.from
        /**
         * LP4 widened `edge.from`/`.to` to `EphemeraLudicTerminalPrimitive`, but this remains
         * Object-only here --- a non-Object `otherId` can't occur in practice yet, since nothing
         * produces a relational edge with a non-Object endpoint, but skip rather than assume.
         * See `ludicGraph/AGENT.md`'s "Character-relation widening, deferred (BD-36)" note.
         */
        if (typeof otherId !== 'string' || !isEphemeraObjectId(otherId)) {
            continue
        }
        // Classified for its throwing side effect only (the AB-54 hosting-kind invariant);
        // no outcome grows the closure now that `carry` is unreachable (CD3).
        classifyInteractionUnderTransfer(edge.kind, movedRole)
    }

    return EphemeraLudicGraph.fromJSON({
        hostId: startId,
        rootId: startId,
        nodes: [objectNode(startId)],
        edges: [],
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
        // The caller's transfer set is Object | Character but filters back down to
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
