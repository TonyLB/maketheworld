import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraAreaId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { applyDeparture } from '../../ludicGraph/expandValidate/applyDeparture'
import { bindingHasParentOn } from '../../ludicGraph/presenceParent'
import { isBystanderMove } from './bystander'
import type { MutationKernelApplyOutcome } from './types'

type Graphs = ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>

/** Whether some binding of the mover, on its own graph, points at the host. */
export const bindingPointsAt = (moverId: EphemeraMembershipHostId, hostId: EphemeraMembershipHostId, graphs: Graphs): boolean => (
    (graphs.get(moverId)?.presenceNodes ?? []).some((node) => bindingHasParentOn(node, hostId))
)

/**
 * The hosting kind a node carries on arrival at a host (HK-7), before any explicit
 * `establishRelation` refines it (`put X on Y` sets `On`). An object in a character's graph is
 * `Held`; an object anywhere else is `In`; a Room, Feature or Area nests `PartOf` (fixed
 * nesting, not mobile placement). This is what gives take and drop a kind, since they write no
 * establish step.
 */
export const defaultHostingKind = (moverId: EphemeraMembershipHostId, hostId: EphemeraMembershipHostId): EphemeraHostingKind => {
    if (isEphemeraObjectId(moverId)) {
        return isEphemeraCharacterId(hostId) ? 'Held' : 'In'
    }
    if (isEphemeraRoomId(moverId) || isEphemeraFeatureId(moverId) || isEphemeraAreaId(moverId)) {
        return 'PartOf'
    }
    return 'In'
}

export type SettleMembershipOutcome =
    | { verdict: 'legal'; graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph> }
    | Exclude<MutationKernelApplyOutcome, { verdict: 'legal' }>

/**
 * Membership follows the bindings: a mover's node is a member of a host while **some binding of the
 * mover points at that host**. A presence step calls this after it has written the mover's pointer
 * (so `graphs` already holds the written binding), naming the host the write left and the host it
 * arrived at.
 *
 * - **Departure from `left`** (skipped when it is also `arrived`): nothing while another binding of the
 *   mover still points there. Otherwise the host's graph must be in the footprint
 *   (`hostNotInFootprint`) and still hold the node (`staleTransferCandidate`), and the node leaves
 *   through `applyDeparture`, which runs the boundary-edge legality check (`repairable`, aimed at
 *   `left`). A Room or Feature never relocates, so one departing is a caller bug and throws.
 * - **Arrival at `arrived`**: adds the node, with its `defaultHostingKind`, only if it is not already there, so arriving where the
 *   mover already holds a binding adds nothing, and a replayed population step is harmless.
 *
 * **A bystander** (`isBystanderMove`: a character at a Room) is not a node of the room's graph: neither
 * departure nor arrival touches it, and the room need not be in `graphs`. The room's characters row
 * indexes the bystander, and the mover's own binding checks have already vouched for the move.
 *
 * A node held in a host that no binding names is drift this does not touch: the drift sweeps heal it.
 * Pure over `graphs`; the returned map is a copy.
 */
export const settleMembership = (
    graphs: Graphs,
    moverId: EphemeraMembershipHostId,
    { left, arrived }: { left?: EphemeraMembershipHostId; arrived?: EphemeraMembershipHostId }
): SettleMembershipOutcome => {
    const next = new Map(graphs)

    if (left !== undefined && left !== arrived && !isBystanderMove(moverId, left) && !bindingPointsAt(moverId, left, graphs)) {
        if (isEphemeraRoomId(moverId) || isEphemeraFeatureId(moverId)) {
            throw new Error(
                `settleMembership: ${moverId} departs ${left} --- structural invariant violated (Room/Feature/Area are hosts that never relocate)`
            )
        }
        const sourceGraph = next.get(left)
        if (!sourceGraph) {
            return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
        }
        if (!sourceGraph.nodeIds.has(moverId)) {
            return { verdict: 'stale', reasonCode: 'staleTransferCandidate' }
        }
        const departure = applyDeparture(sourceGraph, moverId as EphemeraObjectId | EphemeraCharacterId)
        if (departure.verdict === 'repairable') {
            // `applyDeparture` names the offending edge but not the host it sits on --- supply `left` here:
            // boundary edges are found on the source graph, so that is where a repair step is aimed.
            return {
                verdict: 'repairable',
                reasonCode: departure.reasonCode,
                authority: departure.authority,
                repair: { kind: departure.repairKind, hostId: left, edge: departure.edge },
            }
        }
        next.set(left, departure.sourceGraph)
    }

    if (arrived !== undefined && !isBystanderMove(moverId, arrived)) {
        const destGraph = next.get(arrived)
        if (!destGraph) {
            return { verdict: 'stale', reasonCode: 'hostNotInFootprint' }
        }
        if (isEphemeraAreaId(moverId)) {
            throw new Error(`settleMembership: ${moverId} arrives at ${arrived} --- structural invariant violated (an Area is never contained)`)
        }
        if (!destGraph.nodeIds.has(moverId)) {
            next.set(arrived, destGraph.addNode(moverId, defaultHostingKind(moverId, arrived)))
        }
    }

    return { verdict: 'legal', graphs: next }
}
