import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import type { ObjectsChangeCommand } from '../localApiEvents'
import type { AcmeOrderPublishedPayload } from '../actions/publishedEvents'
import { applyObjectsChange } from './applyObjectsChange'
import { clearCoyoteGameImprovisationObjects } from './clearCoyoteGameImprovisationObjects'
import type { ObjectsChangedPayload } from './events'
import { streamObjectsChangedFact } from './events'
import { filterTropeAffinitiesByRoom } from './filterTropeAffinitiesByRoom'
import { spawnAndPlaceImprovisationObject } from './spawnAndPlaceImprovisationObject'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'

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
        return
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
        spawnAndPlaceImpl?: typeof spawnAndPlaceImprovisationObject;
        uuidFactory?: () => string;
        getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    }
): Promise<void> => {
    const getMembershipContainers = deps.getMembershipContainers
        ?? ((characterId: EphemeraCharacterId) => internalCache.Positions.getMembershipContainers(characterId))
    const spawnAndPlace = deps.spawnAndPlaceImpl ?? spawnAndPlaceImprovisationObject
    const positionsStreamEvent = streamPositionsEventFromMessageBus(messageBus)

    const containers = await getMembershipContainers(payload.characterId)
    const roomId = containers[0]
    if (!roomId || !isEphemeraRoomId(roomId)) {
        return
    }
    if (payload.orders.length === 0) {
        return
    }

    const makeUuid = deps.uuidFactory ?? uuidv4
    const createdIds: EphemeraObjectId[] = []

    for (const entry of payload.orders) {
        const objectId = `OBJECT#${makeUuid()}` as `OBJECT#${string}`
        const spawnResult = await spawnAndPlace(
            acmeOrderToSpawnArgs(entry, roomId, objectId),
            { messageBus, streamEvent: positionsStreamEvent }
        )
        if (!spawnResult.ok) {
            console.error(`[mtw.ephemera.objects] spawnAndPlaceImprovisationObject failed: ${spawnResult.errorMessage}`)
            return
        }
        createdIds.push(spawnResult.objectId)
    }

    await streamObjectsChangedFact({
        streamEvent: deps.streamEvent,
        streamKey: roomId,
        createdIds,
        destroyedIds: [],
    })
}
