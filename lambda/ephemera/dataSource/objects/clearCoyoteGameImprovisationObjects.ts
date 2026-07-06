import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import { applyObjectRoomMembership } from '../positions/membership/applyObjectRoomMembership'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'
import type { ObjectsChangedPayload } from './events'
import { streamObjectsChangedFact } from './events'
import { persistDeleteImprovisationObject } from './persistImprovisationObject'

export type ClearCoyoteGameImprovisationObjectsArgs = {
    getGameRooms?: () => Promise<string[]>;
    getRoomPositionGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getPositionGraph>;
}

export type ClearCoyoteGameImprovisationObjectsResult =
    | { ok: true; persisted: false; destroyedIds: [] }
    | { ok: true; persisted: true; destroyedIds: EphemeraObjectId[] }
    | { ok: false; errorMessage: string }

export type ClearCoyoteGameImprovisationObjectsDependencies = {
    messageBus?: typeof messageBus;
    positionsStreamEvent?: StreamEventFunction<PositionsPublishedPayload>;
    objectsStreamEvent?: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
    applyMembershipImpl?: typeof applyObjectRoomMembership;
    deleteObjectImpl?: typeof persistDeleteImprovisationObject;
}

/**
 * Coyote RoadRunner clear: remove all OBJECT# nodes from game-room graphs, delete improvisation rows, emit I4 fact.
 */
export const clearCoyoteGameImprovisationObjects = async (
    args: ClearCoyoteGameImprovisationObjectsArgs = {},
    deps: ClearCoyoteGameImprovisationObjectsDependencies = {}
): Promise<ClearCoyoteGameImprovisationObjectsResult> => {
    const getGameRooms = args.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getRoomPositionGraph = args.getRoomPositionGraph
        ?? ((roomId: EphemeraRoomId) => internalCache.Positions.getPositionGraph(roomId))

    const bus = deps.messageBus ?? messageBus
    const positionsStreamEvent = deps.positionsStreamEvent ?? streamPositionsEventFromMessageBus(bus)
    const applyMembership = deps.applyMembershipImpl ?? applyObjectRoomMembership
    const deleteObject = deps.deleteObjectImpl ?? persistDeleteImprovisationObject

    const gameRooms = await getGameRooms()
    const affectedRoomIds = gameRooms.map((roomKey) => RoomKey(roomKey) as EphemeraRoomId)

    const objectIdSet = new Set<EphemeraObjectId>()
    for (const roomId of affectedRoomIds) {
        const graph = await getRoomPositionGraph(roomId)
        for (const objectId of graph.objectIds) {
            objectIdSet.add(objectId)
        }
    }

    const objectIds = [...objectIdSet]
    if (objectIds.length === 0) {
        return { ok: true, persisted: false, destroyedIds: [] }
    }

    for (const objectId of objectIds) {
        const membershipResult = await applyMembership(
            { objectId, targetRoomId: null },
            { messageBus: bus, streamEvent: positionsStreamEvent }
        )
        if (!membershipResult.ok) {
            return { ok: false, errorMessage: membershipResult.errorMessage ?? `applyObjectRoomMembership failed for ${objectId}` }
        }

        const deleteResult = await deleteObject({ objectId, affectedRoomIds })
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
