import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { walkAncestryContainers } from '../../../actions/enrich/objectManipulation/synthesize/findShardBoundary'
import { runExecutor, seedFromGroundedSteps } from '../../../actions/enrich/objectManipulation/synthesize/executor'
import type { ExecutorRelationalChain, ExpansionEnvironment } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import { lowerRelationalChain } from '../../../actions/enrich/objectManipulation/synthesize/buildCrossingLegs'
import type {
    DissolveRelationChange,
    EstablishRelationChange,
    GroundedReferent,
} from '../../../actions/enrich/objectManipulation/plan/planStep'

export type PlanRelationalEdgeTransferResult =
    | { ok: true; steps: MutationKernelStep[] }
    | { ok: false; errorCode: string; errorMessage: string }

/**
 * Relational's live-state replan (AP-9, slice 3a-iii) --- mirrors `planObjectMoveTransfer`'s
 * shape for membership: takes the grounded edge and rebuilds its chain fresh, against
 * ancestry/graphs read now, rather than trusting the `steps` a stale dry-run snapshot
 * computed at parse time (`compileRelationalFromSkeleton.ts`'s `relationalDryRun`, which this
 * mirrors closely --- same ancestry walk, same `runExecutor`/`lowerRelationalChain` call
 * shape, just without the selection-time candidate pool/consult machinery, since by the time
 * this runs an attempt has already been selected).
 *
 * Reaches into `actions/enrich/objectManipulation/synthesize/` directly --- not a new
 * dependency direction: `repairAdministrativeChainDissolve.ts` and
 * `clearCoyoteGameImprovisationObjects.ts` already import `lowerRelationalChain` from there
 * (AP-9's premises, checked 2026-10-02). Actions-side still needs the same modules for its own
 * pre-publish dry run during selection, so leaving them in place avoids inverting that
 * dependency for no benefit.
 */
export const planRelationalEdgeTransfer = async (
    change: EstablishRelationChange<GroundedReferent> | DissolveRelationChange<GroundedReferent>
): Promise<PlanRelationalEdgeTransferResult> => {
    const subjectId = change.subject.groundedId
    const targetId = change.target.groundedId
    if (!isEphemeraObjectId(subjectId) || !isEphemeraObjectId(targetId)) {
        return {
            ok: false,
            errorCode: 'nonObjectEndpoint',
            errorMessage: 'planRelationalEdgeTransfer: expected Object subject/target ids',
        }
    }

    const getMembershipContainersForWalk = (
        id: EphemeraPositionAdjacencyContainedId
    ): Promise<EphemeraMembershipHostId[]> => internalCache.Positions.getMembershipContainers(id as EphemeraObjectId)

    const [subjectAncestry, targetAncestry] = await Promise.all([
        walkAncestryContainers(subjectId, getMembershipContainersForWalk),
        walkAncestryContainers(targetId, getMembershipContainersForWalk),
    ])
    const containersByHostId = new Map<EphemeraMembershipHostId, EphemeraMembershipHostId[]>()
    subjectAncestry.forEach((containers, hostId) => containersByHostId.set(hostId, containers))
    targetAncestry.forEach((containers, hostId) => containersByHostId.set(hostId, containers))

    const hostByObjectId = new Map<EphemeraObjectId, EphemeraMembershipHostId>()
    for (const objectId of [subjectId, targetId]) {
        const containers = containersByHostId.get(objectId)
        if (containers?.length === 1) {
            hostByObjectId.set(objectId, containers[0])
        }
    }

    const hostGraphMap = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
    for (const hostId of hostByObjectId.values()) {
        if (!hostGraphMap.has(hostId)) {
            hostGraphMap.set(hostId, await internalCache.Positions.getLudicGraph(hostId))
        }
    }

    const env: ExpansionEnvironment = {
        getGraph: (hostId) => hostGraphMap.get(hostId),
        getCurrentHost: (objectId) => hostByObjectId.get(objectId as EphemeraObjectId),
        getMembershipContainers: (id) => containersByHostId.get(id) ?? [],
    }

    const seed = seedFromGroundedSteps([change])
    const outcome = runExecutor(seed, env)

    if (outcome.verdict === 'defer') {
        return { ok: false, errorCode: 'defer', errorMessage: outcome.reason }
    }
    if (outcome.verdict === 'error') {
        return { ok: false, errorCode: 'expansionError', errorMessage: outcome.reason }
    }

    const chain = outcome.steps.find((step): step is ExecutorRelationalChain => step.kind === 'relationalChain')
    if (chain === undefined) {
        return {
            ok: false,
            errorCode: 'noChain',
            errorMessage: 'planRelationalEdgeTransfer: no relational chain found for this edge',
        }
    }

    return { ok: true, steps: lowerRelationalChain(chain.steps, chain.operationKind) }
}
