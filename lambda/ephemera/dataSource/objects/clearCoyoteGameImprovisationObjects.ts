import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import { collectActiveCharactersInCoyoteRooms } from '../coyoteGame/utilities/collectActiveCharactersInCoyoteRooms'
import { executeMembershipTransfer } from '../positions/manipulation/membership/executeObjectMove'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'
import type { ObjectsChangedPayload } from './events'
import { streamObjectsChangedFact } from './events'
import { persistDeleteImprovisationObject } from './persistImprovisationObject'

export type ClearCoyoteGameImprovisationObjectsArgs = {
    getGameRooms?: () => Promise<string[]>;
    getRoomLudicGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
    getActiveCharactersInCoyoteRooms?: () => Promise<EphemeraCharacterId[]>;
    getCharacterLudicGraph?: (characterId: EphemeraCharacterId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
}

export type ClearCoyoteGameImprovisationObjectsResult =
    | { ok: true; persisted: false; destroyedIds: [] }
    | { ok: true; persisted: true; destroyedIds: EphemeraObjectId[] }
    | { ok: false; errorMessage: string }

export type ClearCoyoteGameImprovisationObjectsDependencies = {
    messageBus?: typeof messageBus;
    positionsStreamEvent?: StreamEventFunction<PositionsPublishedPayload>;
    objectsStreamEvent?: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
    applyClearMembershipImpl?: typeof executeMembershipTransfer;
    deleteObjectImpl?: typeof persistDeleteImprovisationObject;
}

const roomIdsFromMembershipFroms = (froms: readonly string[]): EphemeraRoomId[] =>
    froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))

/**
 * Coyote RoadRunner clear: remove all improvisation OBJECT# from game-room and active-character graphs, delete rows, emit I4 fact.
 */
export const clearCoyoteGameImprovisationObjects = async (
    args: ClearCoyoteGameImprovisationObjectsArgs = {},
    deps: ClearCoyoteGameImprovisationObjectsDependencies = {}
): Promise<ClearCoyoteGameImprovisationObjectsResult> => {
    const getGameRooms = args.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getRoomLudicGraph = args.getRoomLudicGraph
        ?? ((roomId: EphemeraRoomId) => internalCache.Positions.getLudicGraph(roomId))
    const getActiveCharacters = args.getActiveCharactersInCoyoteRooms ?? collectActiveCharactersInCoyoteRooms
    const getCharacterLudicGraph = args.getCharacterLudicGraph
        ?? ((characterId: EphemeraCharacterId) => internalCache.Positions.getLudicGraph(characterId))

    const bus = deps.messageBus ?? messageBus
    const positionsStreamEvent = deps.positionsStreamEvent ?? streamPositionsEventFromMessageBus(bus)
    const applyClearMembership = deps.applyClearMembershipImpl ?? executeMembershipTransfer
    const deleteObject = deps.deleteObjectImpl ?? persistDeleteImprovisationObject

    const gameRooms = await getGameRooms()
    const affectedRoomIds = gameRooms.map((roomKey) => RoomKey(roomKey) as EphemeraRoomId)

    const objectIdSet = new Set<EphemeraObjectId>()
    for (const roomId of affectedRoomIds) {
        const graph = await getRoomLudicGraph(roomId)
        for (const objectId of graph.objectIds) {
            objectIdSet.add(objectId)
        }
    }

    const activeCharacters = await getActiveCharacters()
    for (const characterId of activeCharacters) {
        const graph = await getCharacterLudicGraph(characterId)
        for (const objectId of graph.objectIds) {
            objectIdSet.add(objectId)
        }
    }

    const objectIds = [...objectIdSet]
    if (objectIds.length === 0) {
        return { ok: true, persisted: false, destroyedIds: [] }
    }

    for (const objectId of objectIds) {
        const membershipResult = await applyClearMembership({
            entityId: objectId,
            target: null,
            messageBus: bus,
            streamEvent: positionsStreamEvent,
        })
        if (!membershipResult.ok) {
            return { ok: false, errorMessage: membershipResult.errorMessage ?? `executeMembershipTransfer failed for ${objectId}` }
        }

        const deleteAffectedRoomIds = [
            ...new Set([
                ...affectedRoomIds,
                ...roomIdsFromMembershipFroms(membershipResult.froms),
            ]),
        ]

        const deleteResult = await deleteObject({ objectId, affectedRoomIds: deleteAffectedRoomIds })
        if (!deleteResult.ok) {
            return { ok: false, errorMessage: deleteResult.errorMessage }
        }
    }

    if (deps.objectsStreamEvent) {
        const streamKey = objectIds[0] ?? affectedRoomIds[0]
        await streamObjectsChangedFact({
            streamEvent: deps.objectsStreamEvent,
            streamKey,
            createdIds: [],
            destroyedIds: objectIds,
        })
    }

    return { ok: true, persisted: true, destroyedIds: objectIds }
}
