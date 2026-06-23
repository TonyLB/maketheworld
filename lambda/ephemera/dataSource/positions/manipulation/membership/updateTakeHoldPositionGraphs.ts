import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../../internalCache'
import { buildObjectPlacementTransactItems } from '../../membership/objectPlacementTransactItems'
import type { MembershipDiff } from '../../membership/types'
import {
    addObjectToGraph,
    playPositionGraphToStoredTopology,
    removeObjectFromGraph,
} from '../../membership/positionGraphMerge'
import { buildCharacterInventoryTransactItems } from './characterInventoryTransactItems'
import type { CharacterInventoryDiff } from './characterInventoryTransactItems'
import type {
    ObjectMembershipDiff,
    ObjectTakeHoldApplyArgs,
    UpdateTakeHoldPositionGraphsResult,
} from './types'

export type UpdateTakeHoldPositionGraphsDependencies = {
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>;
    getRoomPositionGraph?: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>;
    getCharacterPositionGraph?: (characterId: EphemeraCharacterId) => Promise<PlayPositionGraph>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

const defaultGetMembershipContainers = async (
    objectId: EphemeraObjectId
): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(objectId)

export const computeTakeHoldDiff = (args: {
    priorContainers: EphemeraMembershipHostId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}): {
    diff: ObjectMembershipDiff;
    roomDiff: MembershipDiff;
    characterDiff: CharacterInventoryDiff;
} => {
    const priorRooms = args.priorContainers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
    const priorCharacterHosts = args.priorContainers.filter(
        (id): id is EphemeraCharacterId => isEphemeraCharacterId(id)
    )

    const objectInSourceRoom = priorRooms.includes(args.roomId)
    const objectOnTargetCharacter = priorCharacterHosts.includes(args.characterId)
    const needsRoomRemove = objectInSourceRoom
    const needsCharacterAdd = !objectOnTargetCharacter
    const needsCharacterMove = priorCharacterHosts.some((hostId) => hostId !== args.characterId)
    const changed = needsRoomRemove || needsCharacterAdd || needsCharacterMove

    const diff: ObjectMembershipDiff = {
        froms: needsRoomRemove ? [args.roomId] : [],
        to: args.characterId,
        changed,
    }

    const roomDiff: MembershipDiff = {
        froms: needsRoomRemove ? [args.roomId] : [],
        to: null,
        changed: needsRoomRemove,
    }

    const characterDiff: CharacterInventoryDiff = {
        froms: priorCharacterHosts.filter((hostId) => hostId !== args.characterId),
        to: args.characterId,
        changed: needsCharacterAdd || needsCharacterMove,
    }

    return { diff, roomDiff, characterDiff }
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
    const getRoomPositionGraph = deps?.getRoomPositionGraph
        ?? ((roomId: EphemeraRoomId) => internalCache.Positions.getPositionGraph(roomId))
    const getCharacterPositionGraph = deps?.getCharacterPositionGraph
        ?? ((characterId: EphemeraCharacterId) => internalCache.Positions.getPositionGraph(characterId))
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    const priorContainers = await getMembershipContainers(args.objectId)
    const { diff, roomDiff, characterDiff } = computeTakeHoldDiff({
        priorContainers,
        roomId: args.roomId,
        characterId: args.characterId,
    })

    if (!diff.changed) {
        return { ok: true, persisted: false, diff }
    }

    const { postApplyRoomGraphs, postApplyCharacterGraphs } = await computePostApplyTakeHoldGraphs({
        objectId: args.objectId,
        roomId: args.roomId,
        characterId: args.characterId,
        roomDiff,
        characterDiff,
        getRoomPositionGraph,
        getCharacterPositionGraph,
    })

    try {
        let persisted = false
        await exponentialBackoffWrapper(async () => {
            const transactItems = [
                ...buildObjectPlacementTransactItems({ objectId: args.objectId, diff: roomDiff }),
                ...buildCharacterInventoryTransactItems({ objectId: args.objectId, diff: characterDiff }),
            ]

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
            postApplyCharacterGraphs,
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
            ok: false,
            errorCode: 'OBJECT_TAKE_HOLD_TRANSACT_FAILED',
            errorMessage: message,
        }
    }
}
