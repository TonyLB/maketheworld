import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../../internalCache'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { boundaryEdgeOutcomes } from '../../ludicGraph/expandValidate/interactionUnderTransfer'
import { planObjectClearFromAllHosts } from '../adapters/planObjectClearFromAllHosts'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { MutationKernelStep } from '../kernel/kernelStep'
import type { ClearMembershipApplyResult, ObjectClearMembershipApplyArgs } from './types'

export type ApplyObjectClearMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>;
}

const defaultGetMembershipContainers = async (
    objectId: EphemeraObjectId
): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(objectId)

/**
 * Migrate row (object-lifecycle, BD-35): retired `applyHostEffects` (whose transact-item builders
 * called `EphemeraLudicGraph.removeObject`'s silent edge-strip) in favor of the general kernel.
 * Every departure host's edges referencing the object are swept explicitly via `boundaryEdgeOutcomes`
 * on the singleton `{objectId}` set (no carry-closure growth --- there is no destination for a carry
 * partner to move into, so every outcome, carry/dissolve/defer alike, collapses to "sever it": the
 * object ceases to exist on that host regardless of relation kind, exactly what the old silent strip
 * already did unconditionally, just made explicit and fact-emitting instead of implicit). Facts
 * stream (this route never suppresses `Object Relation Changed`) --- this is BD-28's originally-silent
 * dissolution finally becoming visible for destroy/edit.
 */
export const applyObjectClearMembership = async (
    args: ObjectClearMembershipApplyArgs,
    deps: ApplyObjectClearMembershipDependencies
): Promise<ClearMembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planObjectClearFromAllHosts({ priorContainers })

    const diff = plan.projection

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    // LP7 widened HostRelationalEdge.from/to to EphemeraLudicTerminalId; no producer can build a
    // port-qualified boundary edge yet, so skip rather than assume (matches the ludicGraph
    // boundary/carry-closure narrows, ludicGraph/AGENT.md's BD-36 paragraph).
    const hostByReferencedId = new Map<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>()
    const dissolveSteps: MutationKernelStep[] = []
    for (const hostId of diff.froms) {
        const graph = await internalCache.Positions.getLudicGraph(hostId)
        const outcomes = boundaryEdgeOutcomes(new Set([args.objectId]), graph)
        for (const { edge } of outcomes) {
            if (!isEphemeraLudicTerminalPrimitive(edge.from) || !isEphemeraLudicTerminalPrimitive(edge.to)) {
                continue
            }
            hostByReferencedId.set(edge.from, hostId)
            hostByReferencedId.set(edge.to, hostId)
            dissolveSteps.push({
                kind: 'dissolveRelation',
                subjectId: edge.from,
                targetId: edge.to,
                ...relationKindAndLabelOf(edge),
            })
        }
    }

    const transferStep: MutationKernelStep = {
        kind: 'transferMembership',
        entityIds: new Set([args.objectId]),
        fromHostIds: new Set(diff.froms),
        toHostId: null,
    }

    const result = await commitStepSequence(
        { steps: [...dissolveSteps, transferStep] },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent,
            getCurrentHost: (id) => hostByReferencedId.get(id),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyObjectClearMembership failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, ...diff, beatAnchorTime: result.beatAnchorTime }
}
