import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import type { ObjectsChangeCommand } from '../localApiEvents'
import type { AcmeOrderPublishedPayload } from '../actions/publishedEvents'
import { applyObjectsChange, type ApplyObjectsAddFailure } from './applyObjectsChange'
import { clearCoyoteGameImprovisationObjects } from './clearCoyoteGameImprovisationObjects'
import type { ObjectsChangedPayload } from './events'
import { streamObjectsChangedFact } from './events'
import { filterTropeAffinitiesByRoom } from './filterTropeAffinitiesByRoom'
import { spawnImprovisationObjectsBatch, spawnOneImprovisationObject } from './spawnImprovisationObjectsBatch'
import messageBus from '../../messageBus'
import { resolveCharacterRoomId } from '../positions/membership/resolveCharacterRoomId'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'

const logAddFailures = (addFailures: ApplyObjectsAddFailure[]): void => {
    for (const failure of addFailures) {
        console.error('[mtw.ephemera.objects] add failed', {
            objectId: failure.objectId,
            stableKey: failure.stableKey,
            errorMessage: failure.errorMessage,
        })
    }
}

/**
 * Apply api.ephemera `Objects Change`: spawn/place improvisation objects or remove/delete via graph.
 * Non-room component ids: no-op.
 */
export const handleApiObjectsChangeCommand = async (
    cmd: ObjectsChangeCommand,
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
    }
): Promise<void> => {
    if (!isEphemeraRoomId(cmd.componentId)) {
        return
    }

    const result = await applyObjectsChange({
        roomId: cmd.componentId,
        add: cmd.add,
        remove: cmd.remove,
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.objects] applyObjectsChange failed: ${result.errorMessage}`)
        if (result.addFailures?.length) {
            logAddFailures(result.addFailures)
        }
        return
    }

    if (result.persisted && result.addFailures?.length) {
        logAddFailures(result.addFailures)
    }

    if (result.persisted) {
        await streamObjectsChangedFact({
            streamEvent: deps.streamEvent,
            streamKey: cmd.componentId,
            createdIds: result.createdIds,
            destroyedIds: result.destroyedIds,
        })
    }
}

/**
 * Coyote path: clear improvisation objects across all configured Coyote Game rooms.
 */
export const handleAwaitRoadRunnerClearObjects = async (
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
        getGameRooms?: () => Promise<string[]>;
        clearCoyoteGameImprovisationObjectsImpl?: typeof clearCoyoteGameImprovisationObjects;
    }
): Promise<void> => {
    const clearImpl = deps.clearCoyoteGameImprovisationObjectsImpl ?? clearCoyoteGameImprovisationObjects
    const result = await clearImpl(
        { getGameRooms: deps.getGameRooms },
        { objectsStreamEvent: deps.streamEvent }
    )
    if (!result.ok) {
        console.error(`[mtw.ephemera.objects] clearCoyoteGameImprovisationObjects failed: ${result.errorMessage}`)
    }
}

const acmeOrderToSpawnArgs = (
    entry: AcmeOrderPublishedPayload['orders'][number],
    roomId: EphemeraRoomId,
    objectId: `OBJECT#${string}`
) => ({
    objectId,
    shortName: entry.shortName,
    stableKey: entry.stableKey,
    targetRoomId: roomId,
    ...(entry.tropeAffinities !== undefined
        ? { tropeAffinities: filterTropeAffinitiesByRoom(roomId)(entry.tropeAffinities) }
        : {}),
    ...(entry.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true as const } : {}),
})

/**
 * Coyote Acme delivery: mint OBJECT#, spawn+place improvisation pair + Meta::Object + graph.
 */
export const handleAcmeOrderAddObjects = async (
    payload: AcmeOrderPublishedPayload,
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
        spawnOneImpl?: typeof spawnOneImprovisationObject;
        uuidFactory?: () => string;
        getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
        resolveCharacterRoomId?: typeof resolveCharacterRoomId;
    }
): Promise<void> => {
    const resolveRoomId = deps.resolveCharacterRoomId
        ?? ((characterId: EphemeraCharacterId) => resolveCharacterRoomId(characterId, {
            getMembershipContainers: deps.getMembershipContainers,
        }))
    const positionsStreamEvent = streamPositionsEventFromMessageBus(messageBus)

    if (payload.orders.length === 0) {
        return
    }

    const roomId = await resolveRoomId(payload.characterId)
    if (!isEphemeraRoomId(roomId)) {
        return
    }

    const makeUuid = deps.uuidFactory ?? uuidv4
    const rows = payload.orders.map((entry) => {
        const objectId = `OBJECT#${makeUuid()}` as `OBJECT#${string}`
        return acmeOrderToSpawnArgs(entry, roomId, objectId)
    })

    const { createdIds, addFailures } = await spawnImprovisationObjectsBatch(rows, {
        messageBus,
        streamEvent: positionsStreamEvent,
        spawnOneImpl: deps.spawnOneImpl,
    })

    if (addFailures.length > 0) {
        logAddFailures(addFailures)
    }

    if (createdIds.length === 0) {
        return
    }

    await streamObjectsChangedFact({
        streamEvent: deps.streamEvent,
        streamKey: roomId,
        createdIds,
        destroyedIds: [],
    })
}
