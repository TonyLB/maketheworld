import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import messageBus from '../../messageBus'
import { applyObjectRoomMembership } from '../positions/membership/applyObjectRoomMembership'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'
import { filterTropeAffinitiesByRoom } from './filterTropeAffinitiesByRoom'
import { persistDeleteImprovisationObject } from './persistImprovisationObject'
import { spawnAndPlaceImprovisationObject } from './spawnAndPlaceImprovisationObject'

export type ApplyObjectsChangeArgs = {
    roomId: EphemeraRoomId;
    add: EphemeraMetaRoomObject[];
    remove: EphemeraObjectId[];
}

export type ApplyObjectsChangeResult =
    | { ok: true; persisted: false }
    | { ok: true; persisted: true; createdIds: EphemeraObjectId[]; destroyedIds: EphemeraObjectId[] }
    | { ok: false; errorMessage: string }

export type ApplyObjectsChangeDependencies = {
    messageBus?: typeof messageBus;
    positionsStreamEvent?: StreamEventFunction<PositionsPublishedPayload>;
    spawnAndPlaceImpl?: typeof spawnAndPlaceImprovisationObject;
    applyMembershipImpl?: typeof applyObjectRoomMembership;
    deleteObjectImpl?: typeof persistDeleteImprovisationObject;
}

const mapAddEntryToSpawnArgs = (
    entry: EphemeraMetaRoomObject,
    roomId: EphemeraRoomId
) => ({
    objectId: entry.uuid,
    shortName: entry.shortName,
    stableKey: entry.stableKey,
    targetRoomId: roomId,
    ...(entry.tropeAffinities !== undefined
        ? { tropeAffinities: filterTropeAffinitiesByRoom(roomId)(entry.tropeAffinities) }
        : {}),
    ...(entry.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true as const } : {}),
})

/**
 * Room-scoped improvisation spawn/place and remove/delete for `Objects Change` ingress.
 */
export const applyObjectsChange = async (
    args: ApplyObjectsChangeArgs,
    deps: ApplyObjectsChangeDependencies = {}
): Promise<ApplyObjectsChangeResult> => {
    if (args.add.length === 0 && args.remove.length === 0) {
        return { ok: true, persisted: false }
    }

    const bus = deps.messageBus ?? messageBus
    const positionsStreamEvent = deps.positionsStreamEvent ?? streamPositionsEventFromMessageBus(bus)
    const spawnAndPlace = deps.spawnAndPlaceImpl ?? spawnAndPlaceImprovisationObject
    const applyMembership = deps.applyMembershipImpl ?? applyObjectRoomMembership
    const deleteObject = deps.deleteObjectImpl ?? persistDeleteImprovisationObject

    const createdIds: EphemeraObjectId[] = []
    const destroyedIds: EphemeraObjectId[] = []

    for (const entry of args.add) {
        const spawnResult = await spawnAndPlace(
            mapAddEntryToSpawnArgs(entry, args.roomId),
            { messageBus: bus, streamEvent: positionsStreamEvent }
        )
        if (!spawnResult.ok) {
            return { ok: false, errorMessage: spawnResult.errorMessage }
        }
        createdIds.push(spawnResult.objectId)
    }

    for (const objectId of args.remove) {
        const membershipResult = await applyMembership(
            { objectId, targetRoomId: null },
            { messageBus: bus, streamEvent: positionsStreamEvent }
        )
        if (!membershipResult.ok) {
            return { ok: false, errorMessage: membershipResult.errorMessage ?? `applyObjectRoomMembership failed for ${objectId}` }
        }

        const affectedRoomIds = [
            ...new Set([
                ...membershipResult.froms,
                ...(membershipResult.to ? [membershipResult.to] : []),
                args.roomId,
            ]),
        ]

        const deleteResult = await deleteObject({ objectId, affectedRoomIds })
        if (!deleteResult.ok) {
            return { ok: false, errorMessage: deleteResult.errorMessage }
        }
        destroyedIds.push(objectId)
    }

    if (createdIds.length === 0 && destroyedIds.length === 0) {
        return { ok: true, persisted: false }
    }

    return { ok: true, persisted: true, createdIds, destroyedIds }
}
