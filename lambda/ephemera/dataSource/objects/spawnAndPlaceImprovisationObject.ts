import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

import type { MessageBus } from '../../messageBus/baseClasses'
import { applyObjectRoomMembership } from '../positions/membership/applyObjectRoomMembership'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import {
    persistDeleteImprovisationObject,
    persistSpawnImprovisationObject,
} from './persistImprovisationObject'

export type SpawnAndPlaceImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    targetRoomId: EphemeraRoomId;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}

export type SpawnAndPlaceImprovisationObjectDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    spawnImpl?: typeof persistSpawnImprovisationObject;
    applyMembershipImpl?: typeof applyObjectRoomMembership;
    deleteImpl?: typeof persistDeleteImprovisationObject;
}

/**
 * Two-step spawn coordinator: existence rows, then room placement via manipulation kernel.
 */
export const spawnAndPlaceImprovisationObject = async (
    args: SpawnAndPlaceImprovisationObjectArgs,
    deps: SpawnAndPlaceImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const spawnImpl = deps.spawnImpl ?? persistSpawnImprovisationObject
    const applyMembershipImpl = deps.applyMembershipImpl ?? applyObjectRoomMembership
    const deleteImpl = deps.deleteImpl ?? persistDeleteImprovisationObject

    const spawnResult = await spawnImpl({
        objectId: args.objectId,
        shortName: args.shortName,
        stableKey: args.stableKey,
        tropeAffinities: args.tropeAffinities,
        tropeAffinitiesFailed: args.tropeAffinitiesFailed,
    })
    if (!spawnResult.ok) {
        return spawnResult
    }

    const placeResult = await applyMembershipImpl(
        { objectId: args.objectId, targetRoomId: args.targetRoomId },
        { messageBus: deps.messageBus, streamEvent: deps.streamEvent }
    )
    if (!placeResult.ok) {
        const placementError = placeResult.errorMessage ?? 'applyObjectRoomMembership failed'
        const deleteResult = await deleteImpl({
            objectId: args.objectId,
            affectedRoomIds: [args.targetRoomId],
        })
        if (!deleteResult.ok) {
            console.error('[mtw.ephemera.objects] spawn placement failed; compensation delete failed', {
                objectId: args.objectId,
                placementError,
                deleteError: deleteResult.errorMessage,
            })
        }
        return { ok: false, errorMessage: placementError }
    }

    return { ok: true, objectId: args.objectId }
}
