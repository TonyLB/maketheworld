import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectComponentGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
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

const seedRoomGraphMemos = (
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPlayPositionGraph][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const seedCharacterGraphMemos = (
    postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>>
): void => {
    for (const [characterId, storedGraph] of Object.entries(postApplyCharacterGraphs) as [EphemeraCharacterId, EphemeraPlayPositionGraph][]) {
        internalCache.Positions.set({
            componentId: characterId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
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

const roomGraphsFromKernelResult = (
    postApplyGraphs: Partial<Record<string, EphemeraPlayPositionGraph>>
): Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> => {
    const result: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> = {}
    for (const [hostId, graph] of Object.entries(postApplyGraphs)) {
        if (isEphemeraRoomId(hostId)) {
            result[hostId] = graph
        }
    }
    return result
}

const characterGraphsFromKernelResult = (
    postApplyGraphs: Partial<Record<string, EphemeraPlayPositionGraph>>
): Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>> => {
    const result: Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>> = {}
    for (const [hostId, graph] of Object.entries(postApplyGraphs)) {
        if (isEphemeraCharacterId(hostId)) {
            result[hostId] = graph
        }
    }
    return result
}

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
    const postApplyRoomGraphs = roomGraphsFromKernelResult(kernelResult.postApplyGraphs)
    const postApplyCharacterGraphs = characterGraphsFromKernelResult(kernelResult.postApplyGraphs)

    const fact = buildObjectMovedFact({
        objectId: args.objectId,
        diff,
        beatAnchorTime,
    })
    if (fact) {
        await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

    seedRoomGraphMemos(postApplyRoomGraphs)
    seedCharacterGraphMemos(postApplyCharacterGraphs)
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
