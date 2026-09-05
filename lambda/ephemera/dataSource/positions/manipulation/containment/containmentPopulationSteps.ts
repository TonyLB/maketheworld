import { v4 as uuidv4 } from 'uuid'
import type { EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ExecutorEstablishRelationStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { MutationKernelAddPresencePortStep, MutationKernelStep, MutationKernelTransferStep } from '../kernel/kernelStep'

/**
 * RD-4 (`AGENT.presenceRefactor.planning.md` step 3): the pure step-computer for cache-time
 * containment authoring (Room-in-Area, Feature-in-Room, Feature-in-Feature). Takes both graphs
 * already fetched, so the idempotency obligation --- `cacheAsset` reruns frequently over state that
 * already reflects a prior write --- is met by checking current state here rather than relying on
 * the reducer to absorb a replay (neither `transferMembership`'s pure-add branch nor
 * `addPresencePort` is safe to replay unconditionally --- see this directory's callers).
 *
 * Three independent checks, not a single all-or-nothing branch, because a cache rerun can land in
 * any partially-populated state (e.g. a prior run committed the node-add but failed before the
 * presence port, or `cacheAsset` retried after a partial failure):
 *
 * - **Node membership**: emitted only if `childId` is not already a node of `parentGraph`.
 * - **Presence port**: emitted only if `childGraph` carries no `Present` port with
 *   `fromHostId === parentId` already (RD-1/RD-2's shape, shared with `presencePortStepsForMove`).
 * - **Containment edge**: emitted only if `parentGraph` carries no `PartOf` edge from `childId` to
 *   `parentId` already. `establishRelation`'s `op: 'add'` is already idempotent-safe on an existing
 *   edge (`EphemeraLudicGraph.applyRelationalPatch`) --- this check isn't load-bearing for
 *   correctness --- but skipping it when nothing changed is what keeps a fully-populated `cacheAsset`
 *   rerun from committing a transaction at all, rather than three no-op writes every time. Always
 *   `PartOf`, never `In` --- RD-4, 2026-09-05: Room-in-Area and Feature-in-Room/Feature are
 *   fixed/authored nestings, not the mobile placement `In` is for.
 */
export const containmentPopulationSteps = (
    parentId: EphemeraMembershipHostId,
    childId: EphemeraRoomId | EphemeraFeatureId,
    parentGraph: EphemeraLudicGraph,
    childGraph: EphemeraLudicGraph
): MutationKernelStep[] => {
    const steps: MutationKernelStep[] = []

    if (!parentGraph.nodeIds.has(childId)) {
        const nodeStep: MutationKernelTransferStep = {
            kind: 'transferMembership',
            entityIds: new Set([childId]),
            fromHostIds: new Set(),
            toHostId: parentId,
        }
        steps.push(nodeStep)
    }

    const hasPresencePort = childGraph.ports.some((port) => port.kind === 'Present' && port.fromHostId === parentId)
    if (!hasPresencePort) {
        const portStep: MutationKernelAddPresencePortStep = {
            kind: 'addPresencePort',
            hostId: childId,
            port: { portId: uuidv4(), fromHostId: parentId, kind: 'Present' },
        }
        steps.push(portStep)
    }

    const hasContainmentEdge = parentGraph.relationalEdges.some(
        (edge) => edge.kind === 'PartOf' && edge.from === childId && edge.to === parentId
    )
    if (!hasContainmentEdge) {
        const edgeStep: ExecutorEstablishRelationStep = {
            kind: 'establishRelation',
            subjectId: childId,
            targetId: parentId,
            hostId: parentId,
            relationKind: 'PartOf',
        }
        steps.push(edgeStep)
    }

    return steps
}
