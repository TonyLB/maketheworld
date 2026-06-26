import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../../internalCache'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../applyHostEffects'
import { planObjectTakeHoldTransfer } from '../adapters/planObjectTakeHoldTransfer'
import type { MembershipDiff } from '../../membership/types'
import {
    addObjectToGraph,
    playPositionGraphToStoredTopology,
    removeObjectFromGraph,
} from '../../membership/positionGraphMerge'
import type { CharacterInventoryDiff } from './characterInventoryTransactItems'
import type {
    ObjectMembershipDiff,
    ObjectTakeHoldApplyArgs,
    UpdateTakeHoldPositionGraphsResult,
} from './types'

export { computeTakeHoldDiff } from '../adapters/computeTakeHoldDiff'

export type UpdateTakeHoldPositionGraphsDependencies = {
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>;
} & ApplyHostEffectsDependencies

const defaultGetMembershipContainers = async (
    objectId: EphemeraObjectId
): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(objectId)

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

export const computePostApplyTakeHoldGraphs = async (args: {
    objectId: EphemeraObjectId;
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
    roomDiff: MembershipDiff;
    characterDiff: CharacterInventoryDiff;
    getRoomPositionGraph: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>;
    getCharacterPositionGraph: (characterId: EphemeraCharacterId) => Promise<PlayPositionGraph>;
}): Promise<{
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>;
    postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>>;
}> => {
    const postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> = {}
    const postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>> = {}

    if (args.roomDiff.changed) {
        const priorStored = playPositionGraphToStoredTopology(await args.getRoomPositionGraph(args.roomId))
        postApplyRoomGraphs[args.roomId] = removeObjectFromGraph(priorStored, args.objectId)
    }

    if (args.characterDiff.changed) {
        const priorStored = playPositionGraphToStoredTopology(
            await args.getCharacterPositionGraph(args.characterId)
        )
        postApplyCharacterGraphs[args.characterId] = addObjectToGraph(priorStored, args.objectId)
    }

    return { postApplyRoomGraphs, postApplyCharacterGraphs }
}

export const updateTakeHoldPositionGraphs = async (
    args: ObjectTakeHoldApplyArgs,
    deps?: UpdateTakeHoldPositionGraphsDependencies
): Promise<UpdateTakeHoldPositionGraphsResult> => {
    const getMembershipContainers = deps?.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planObjectTakeHoldTransfer({
        objectId: args.objectId,
        roomId: args.roomId,
        characterId: args.characterId,
        priorContainers,
    })

    const diff = objectMembershipDiffFromProjection(plan.projection)

    if (!diff.changed) {
        return { ok: true, persisted: false, diff }
    }

    const kernelResult = await applyHostEffects(
        { hostEffects: plan.hostEffects },
        deps
    )

    if (!kernelResult.ok) {
        return {
            ok: false,
            errorCode: 'OBJECT_TAKE_HOLD_TRANSACT_FAILED',
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true, persisted: false, diff }
    }

    return {
        ok: true,
        persisted: true,
        diff,
        postApplyRoomGraphs: roomGraphsFromKernelResult(kernelResult.postApplyGraphs),
        postApplyCharacterGraphs: characterGraphsFromKernelResult(kernelResult.postApplyGraphs),
    }
}
