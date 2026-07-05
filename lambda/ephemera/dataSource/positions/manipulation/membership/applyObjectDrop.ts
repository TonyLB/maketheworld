import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectComponentGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../applyHostEffects'
import { planObjectDropTransfer } from '../adapters/planObjectDropTransfer'
import type { DropApplyResult, ObjectDropApplyArgs, ObjectMembershipDiff } from './types'

export type ApplyObjectDropDependencies = {
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
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPositionGraphFieldPayload][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const seedCharacterGraphMemos = (
    postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPositionGraphFieldPayload>>
): void => {
    for (const [characterId, storedGraph] of Object.entries(postApplyCharacterGraphs) as [EphemeraCharacterId, EphemeraPositionGraphFieldPayload][]) {
        internalCache.Positions.set({
            componentId: characterId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

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
    postApplyGraphs: Partial<Record<string, EphemeraPositionGraphFieldPayload>>
): Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>> => {
    const result: Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>> = {}
    for (const [hostId, graph] of Object.entries(postApplyGraphs)) {
        if (isEphemeraRoomId(hostId)) {
            result[hostId] = graph
        }
    }
    return result
}

const characterGraphsFromKernelResult = (
    postApplyGraphs: Partial<Record<string, EphemeraPositionGraphFieldPayload>>
): Partial<Record<EphemeraCharacterId, EphemeraPositionGraphFieldPayload>> => {
    const result: Partial<Record<EphemeraCharacterId, EphemeraPositionGraphFieldPayload>> = {}
    for (const [hostId, graph] of Object.entries(postApplyGraphs)) {
        if (isEphemeraCharacterId(hostId)) {
            result[hostId] = graph
        }
    }
    return result
}

export const applyObjectDrop = async (
    args: ObjectDropApplyArgs,
    deps: ApplyObjectDropDependencies
): Promise<DropApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planObjectDropTransfer({
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
        containers: [args.roomId],
    })

    deps.messageBus.publish({
        type: 'RoomUpdate',
        roomId: args.roomId,
    })

    return {
        ok: true,
        ...diff,
        beatAnchorTime,
    }
}
