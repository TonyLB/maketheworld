import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import type { EphemeraPositionGraph } from '../../positionGraph'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../applyHostEffects'
import { planObjectTakeHoldTransfer } from '../adapters/planObjectTakeHoldTransfer'
import type { ObjectMembershipDiff, ObjectTakeHoldApplyArgs, TakeHoldApplyResult } from './types'

export type ApplyObjectTakeHoldDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>;
    kernelPersist?: ApplyHostEffectsDependencies;
}

const defaultGetMembershipContainers = async (
    objectId: EphemeraObjectId
): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(objectId)

const seedRoomGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (!isEphemeraRoomId(graph.hostId)) {
            continue
        }
        internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
        internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        internalCache.Positions.set(graph)
    }
}

const seedCharacterGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (!isEphemeraCharacterId(graph.hostId)) {
            continue
        }
        internalCache.Positions.set(graph)
    }
}

const roomIdsFromDiffFroms = (froms: string[]): EphemeraRoomId[] =>
    froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))

const objectMembershipDiffFromProjection = (projection: {
    froms: EphemeraMembershipHostId[];
    to: EphemeraMembershipHostId | null;
    changed: boolean;
}): ObjectMembershipDiff => ({
    froms: projection.froms,
    to: projection.to,
    changed: projection.changed,
})

export const applyObjectTakeHold = async (
    args: ObjectTakeHoldApplyArgs,
    deps: ApplyObjectTakeHoldDependencies
): Promise<TakeHoldApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planObjectTakeHoldTransfer({
        objectId: args.objectId,
        roomId: args.roomId,
        characterId: args.characterId,
        priorContainers,
    })

    const diff = objectMembershipDiffFromProjection(plan.projection)

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    const kernelResult = await applyHostEffects(
        { hostEffects: plan.hostEffects, edgeCarries: args.carriedEdges ?? [] },
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

    seedRoomGraphMemos(kernelResult.postApplyGraphs)
    seedCharacterGraphMemos(kernelResult.postApplyGraphs)
    internalCache.Positions.setMembershipContainers({
        componentId: args.objectId,
        containers: [args.characterId],
    })

    roomIdsFromDiffFroms(diff.froms).forEach((roomId) => {
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
