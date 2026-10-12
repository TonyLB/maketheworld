import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelStep } from './kernelStep'

type Graphs = ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>

/** One mover's net change of membership across a step sequence. */
export type MembershipChange = {
    entityId: EphemeraMembershipHostId
    /** Hosts whose graph held the mover's node before the sequence and not after. */
    left: EphemeraMembershipHostId[]
    /** Hosts whose graph holds the mover's node after the sequence and did not before. */
    arrived: EphemeraMembershipHostId[]
    /** Index of the mover's last presence step: where its moved fact streams. */
    anchor: number
}

const isPresenceWrite = (step: MutationKernelStep): step is Extract<MutationKernelStep, { kind: 'addPresenceBinding' | 'movePresenceBinding' | 'releasePresenceBinding' | 'repairPresenceBinding' }> => (
    step.kind === 'addPresenceBinding'
    || step.kind === 'movePresenceBinding'
    || step.kind === 'releasePresenceBinding'
    || step.kind === 'repairPresenceBinding'
)

/**
 * Membership is applied inside the presence steps, so what a sequence did to it is read from the graphs
 * rather than from the steps: for each mover (the host of a presence step), which hosts held its node
 * before and after. Adjacency rows, the cache's containers and the moved fact all derive from this one
 * answer. A host is compared only to the movers it is not itself (a graph also holds its own root),
 * and a mover whose own graph was created or destroyed in the sequence compares like any other.
 * Movers with no net change are omitted.
 */
export const membershipChangesOf = (
    steps: readonly MutationKernelStep[],
    priorGraphs: Graphs,
    committedGraphs: Graphs
): MembershipChange[] => {
    const anchors = new Map<EphemeraMembershipHostId, number>()
    steps.forEach((step, index) => {
        if (isPresenceWrite(step)) {
            anchors.set(step.hostId, index)
        }
    })
    const hostIds = [...new Set([...priorGraphs.keys(), ...committedGraphs.keys()])]
    return [...anchors].flatMap(([entityId, anchor]) => {
        const heldIn = (graphs: Graphs) => new Set(hostIds.filter((hostId) => hostId !== entityId && graphs.get(hostId)?.nodeIds.has(entityId)))
        const before = heldIn(priorGraphs)
        const after = heldIn(committedGraphs)
        const left = [...before].filter((hostId) => !after.has(hostId))
        const arrived = [...after].filter((hostId) => !before.has(hostId))
        return left.length > 0 || arrived.length > 0 ? [{ entityId, left, arrived, anchor }] : []
    })
}
