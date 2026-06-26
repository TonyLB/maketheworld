import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import internalCache from '../../../internalCache'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../manipulation/applyHostEffects'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import {
    addObjectToGraph,
    playPositionGraphToStoredTopology,
    removeObjectFromGraph,
} from './positionGraphMerge'
import type {
    MembershipDiff,
    ObjectMembershipApplyArgs,
    UpdatePositionGraphsResult,
} from './types'

export type UpdateObjectPositionGraphsDependencies = {
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
} & ApplyHostEffectsDependencies

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

const roomGraphsFromKernelResult = (
    postApplyGraphs: Partial<Record<string, EphemeraPlayPositionGraph>>
): Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> => {
    return Object.entries(postApplyGraphs).reduce<Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>>(
        (result, [hostId, graph]) => {
            if (isEphemeraRoomId(hostId)) {
                result[hostId] = graph
            }
            return result
        },
        {}
    )
}

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

export const computePostApplyObjectRoomGraphs = async (
    objectId: EphemeraObjectId,
    diff: MembershipDiff,
    getRoomPositionGraph: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>
): Promise<Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>> => {
    const postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> = {}
    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)

    await Promise.all(
        affectedRooms.map(async (roomId) => {
            const priorStored = playPositionGraphToStoredTopology(await getRoomPositionGraph(roomId))
            if (diff.froms.includes(roomId)) {
                postApplyRoomGraphs[roomId] = removeObjectFromGraph(priorStored, objectId)
            }
            if (diff.to === roomId) {
                postApplyRoomGraphs[roomId] = addObjectToGraph(priorStored, objectId)
            }
        })
    )

    return postApplyRoomGraphs
}

export const updateObjectPositionGraphs = async (
    args: ObjectMembershipApplyArgs,
    deps?: UpdateObjectPositionGraphsDependencies
): Promise<UpdatePositionGraphsResult> => {
    const getMembershipContainers = deps?.getMembershipContainers ?? defaultGetMembershipContainers

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
        return { ok: true, persisted: false, diff }
    }

    const kernelResult = await applyHostEffects(
        { hostEffects: plan.hostEffects },
        deps
    )

    if (!kernelResult.ok) {
        return {
            ok: false,
            errorCode: 'OBJECT_MEMBERSHIP_TRANSACT_FAILED',
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
    }
}
