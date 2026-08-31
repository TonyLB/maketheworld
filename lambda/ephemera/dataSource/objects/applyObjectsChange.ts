import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import messageBus from '../../messageBus'
import { executeMembershipTransfer } from '../positions/manipulation/membership/executeObjectMove'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'
import { filterTropeAffinitiesByRoom } from './filterTropeAffinitiesByRoom'
import { persistDeleteImprovisationObject } from './persistImprovisationObject'
import {
    spawnImprovisationObjectsBatch,
    spawnOneImprovisationObject,
    type ApplyObjectsAddFailure,
} from './spawnImprovisationObjectsBatch'

export type { ApplyObjectsAddFailure }

export type ApplyObjectsChangeArgs = {
    roomId: EphemeraRoomId;
    add: EphemeraMetaRoomObject[];
    remove: EphemeraObjectId[];
}

export type ApplyObjectsChangeResult =
    | { ok: true; persisted: false }
    | { ok: true; persisted: true; createdIds: EphemeraObjectId[]; destroyedIds: EphemeraObjectId[]; addFailures?: ApplyObjectsAddFailure[] }
    | { ok: false; errorMessage: string; addFailures?: ApplyObjectsAddFailure[] }

export type ApplyObjectsChangeDependencies = {
    messageBus?: typeof messageBus;
    positionsStreamEvent?: StreamEventFunction<PositionsPublishedPayload>;
    spawnOneImpl?: typeof spawnOneImprovisationObject;
    applyClearMembershipImpl?: typeof executeMembershipTransfer;
    deleteObjectImpl?: typeof persistDeleteImprovisationObject;
}

export const mapAddEntryToSpawnArgs = (
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
    const spawnOne = deps.spawnOneImpl ?? spawnOneImprovisationObject
    const applyClearMembership = deps.applyClearMembershipImpl ?? executeMembershipTransfer
    const deleteObject = deps.deleteObjectImpl ?? persistDeleteImprovisationObject

    const destroyedIds: EphemeraObjectId[] = []

    const addRows = args.add.map((entry) => mapAddEntryToSpawnArgs(entry, args.roomId))
    const { createdIds, addFailures } = await spawnImprovisationObjectsBatch(addRows, {
        messageBus: bus,
        streamEvent: positionsStreamEvent,
        spawnOneImpl: spawnOne,
    })

    for (const objectId of args.remove) {
        const membershipResult = await applyClearMembership({
            entityId: objectId,
            target: null,
            messageBus: bus,
            streamEvent: positionsStreamEvent,
        })
        if (!membershipResult.ok) {
            return { ok: false, errorMessage: membershipResult.errorMessage ?? `executeMembershipTransfer failed for ${objectId}` }
        }

        const affectedRoomIds = [
            ...new Set([
                ...membershipResult.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
                ...(membershipResult.to !== null && isEphemeraRoomId(membershipResult.to) ? [membershipResult.to] : []),
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
        if (addFailures.length > 0) {
            return {
                ok: false,
                errorMessage: `${addFailures.length} add(s) failed`,
                addFailures,
            }
        }
        return { ok: true, persisted: false }
    }

    return {
        ok: true,
        persisted: true,
        createdIds,
        destroyedIds,
        ...(addFailures.length > 0 ? { addFailures } : {}),
    }
}
