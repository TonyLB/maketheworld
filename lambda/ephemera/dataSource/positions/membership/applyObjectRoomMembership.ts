import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { boundaryEdgeOutcomes } from '../ludicGraph/expandValidate/interactionUnderTransfer'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import { commitStepSequence } from '../manipulation/kernel/commitStepSequence'
import type { MutationKernelStep } from '../manipulation/kernel/kernelStep'
import type { MembershipApplyResult, MembershipDiff, ObjectMembershipApplyArgs } from './types'

export type ApplyObjectRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
    /**
     * Gates only the newly-explicit `Object Relation Changed` fact for a boundary edge severed by
     * this call (`Object Moved` is unaffected). Ordinary place/spawn/remove leaves this unset (facts
     * stream); `repairObjectPlacementDrift`'s multi-room scrub sets it `true` --- a drift-consistency
     * fixup is a silent internal correction, not a player-visible event.
     */
    suppressRelationalFacts?: boolean;
}

const defaultGetMembershipContainers = async (objectId: EphemeraObjectId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(objectId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

const membershipDiffFromProjection = (projection: {
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    changed: boolean;
}): MembershipDiff => ({
    froms: projection.froms,
    to: projection.to,
    changed: projection.changed,
})

/**
 * Migrate row (object-lifecycle, BD-35): retired `applyHostEffects` in favor of the general kernel,
 * matching `applyObjectClearMembership`'s sibling migration. Every departure room's edges referencing
 * the object are swept explicitly via `boundaryEdgeOutcomes` on the singleton `{objectId}` set (no
 * carry-closure growth --- there is no "everything riding along" partner for a place/remove/scrub, so
 * every outcome collapses to "sever it", same reasoning as destroy/clear).
 */
export const applyObjectRoomMembership = async (
    args: ObjectMembershipApplyArgs,
    deps: ApplyObjectRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planMembershipTransfer({
        applyMode: 'end-state',
        target: args.targetRoomId,
        priorContainers,
    })

    const diff = membershipDiffFromProjection({
        froms: plan.projection.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
        to: plan.projection.to !== null && isEphemeraRoomId(plan.projection.to) ? plan.projection.to : null,
        changed: plan.projection.changed,
    })

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    const hostByReferencedId = new Map<EphemeraObjectId, EphemeraRoomId>()
    const dissolveSteps: MutationKernelStep[] = []
    for (const roomId of diff.froms) {
        const graph = await internalCache.Positions.getLudicGraph(roomId)
        const outcomes = boundaryEdgeOutcomes(new Set([args.objectId]), graph)
        // LP4 widened HostRelationalEdge.from/to; this sweep is still Object-only in practice
        // (see applyObjectRelationalChange.ts's identical fix).
        for (const { edge } of outcomes) {
            if (!isEphemeraObjectId(edge.from) || !isEphemeraObjectId(edge.to)) {
                throw new Error(`Boundary dissolve edge ${edge.from} -> ${edge.to} has a non-Object endpoint`)
            }
            hostByReferencedId.set(edge.from, roomId)
            hostByReferencedId.set(edge.to, roomId)
            dissolveSteps.push({
                kind: 'dissolveRelation',
                subjectId: edge.from,
                targetId: edge.to,
                relationKind: edge.kind,
                ...(edge.relationLabel !== undefined ? { relationLabel: edge.relationLabel } : {}),
            })
        }
    }

    const transferStep: MutationKernelStep = {
        kind: 'transferMembership',
        entityIds: new Set([args.objectId]),
        fromHostIds: new Set(diff.froms),
        toHostId: diff.to,
    }

    const result = await commitStepSequence(
        { steps: [...dissolveSteps, transferStep] },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent,
            getCurrentHost: (id) => hostByReferencedId.get(id),
            ...(deps.suppressRelationalFacts !== undefined ? { suppressRelationalFacts: deps.suppressRelationalFacts } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyObjectRoomMembership failed: ${result.errorMessage}`)
        return {
            ok: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
        }
    }

    return {
        ok: true,
        ...diff,
        beatAnchorTime: result.beatAnchorTime,
    }
}
