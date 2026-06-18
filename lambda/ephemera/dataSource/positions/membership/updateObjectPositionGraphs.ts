import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'
import { buildObjectPlacementTransactItems } from './objectPlacementTransactItems'
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
import { computeMembershipDiff } from './updatePositionGraphs'

export type UpdateObjectPositionGraphsDependencies = {
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraRoomId[]>;
    getRoomPositionGraph?: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const defaultGetMembershipContainers = async (objectId: EphemeraObjectId): Promise<EphemeraRoomId[]> =>
    internalCache.Positions.getMembershipContainers(objectId)

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
    const getRoomPositionGraph = deps?.getRoomPositionGraph
        ?? ((roomId: EphemeraRoomId) => internalCache.Positions.getPositionGraph(roomId))
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.objectId)
    const diff = computeMembershipDiff(priorContainers, args.targetRoomId)

    if (!diff.changed) {
        return { ok: true, persisted: false, diff }
    }

    const postApplyRoomGraphs = await computePostApplyObjectRoomGraphs(
        args.objectId,
        diff,
        getRoomPositionGraph
    )

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems = buildObjectPlacementTransactItems({
                objectId: args.objectId,
                diff,
            })

            if (transactItems.length === 0) {
                return
            }

            await transactWrite(transactItems)
            persisted = true
        }, { retryErrors: ['TransactionCanceledException'] })

        if (!persisted) {
            return { ok: true, persisted: false, diff }
        }

        return {
            ok: true,
            persisted: true,
            diff,
            postApplyRoomGraphs,
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ok: false,
            errorCode: 'OBJECT_MEMBERSHIP_TRANSACT_FAILED',
            errorMessage: message,
        }
    }
}
