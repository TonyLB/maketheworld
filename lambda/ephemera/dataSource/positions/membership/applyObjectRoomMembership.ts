import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../manipulation/applyHostEffects'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import type { EphemeraPositionGraph } from '../positionGraph'
import { buildObjectMovedFact } from './buildObjectMovedFact'
import { streamObjectMembershipFact } from './streamObjectMembershipFact'
import type { MembershipApplyResult, MembershipDiff, ObjectMembershipApplyArgs } from './types'

export type ApplyObjectRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
    kernelPersist?: ApplyHostEffectsDependencies;
}

const defaultGetMembershipContainers = async (objectId: EphemeraObjectId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(objectId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

const seedPositionsGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (!isEphemeraRoomId(graph.hostId)) {
            continue
        }
        internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
        internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        internalCache.Positions.set(graph)
    }
}

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

const membershipDiffFromProjection = (projection: {
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    changed: boolean;
}): MembershipDiff => ({
    froms: projection.froms,
    to: projection.to,
    changed: projection.changed,
})

export const applyObjectRoomMembership = async (
    args: ObjectMembershipApplyArgs,
    deps: ApplyObjectRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planMembershipTransfer({
        entityId: args.objectId,
        entityKind: 'object',
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

    const kernelResult = await applyHostEffects(
        { hostEffects: plan.hostEffects },
        deps.kernelPersist
    )

    if (!kernelResult.ok) {
        console.error(`[mtw.ephemera.positions] applyHostEffects failed: ${kernelResult.errorMessage}`)
        return {
            ok: false,
            errorCode: kernelResult.errorCode,
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true, ...diff }
    }

    const beatAnchorTime = getCurrentTimestamp()

    const fact = buildObjectMovedFact({
        objectId: args.objectId,
        diff,
        beatAnchorTime,
    })
    if (fact) {
        await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)
    seedPositionsGraphMemos(kernelResult.postApplyGraphs)
    internalCache.Positions.setMembershipContainers({
        componentId: args.objectId,
        containers: diff.to ? [diff.to] : [],
    })

    affectedRooms.forEach((roomId) => {
        deps.messageBus.publish({
            type: 'RoomUpdate',
            roomId,
        })
    })

    return {
        ok: true,
        ...diff,
        beatAnchorTime,
    }
}
