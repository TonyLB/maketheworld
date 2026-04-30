import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'
import { v4 as uuidv4 } from 'uuid'
import type { ObjectsChangeCommand } from '../localApiEvents'
import type { AcmeOrderPublishedPayload } from '../actions/publishedEvents'
import { clearPersistMetaRoomObjects, mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'
import type { ObjectsChangedPayload } from './events'
import internalCache from '../../internalCache'

/**
 * Apply api.ephemera `Objects Change` to Dynamo: rooms merge `add` / `remove` into `Meta::Room.objects`.
 * Non-room component ids: no-op. No ReturnValue for v1.
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

    const result = await mergePersistMetaRoomObjects({
        roomId: cmd.componentId,
        add: cmd.add,
        remove: cmd.remove,
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.objects] mergePersistMetaRoomObjects failed: ${result.errorMessage}`)
        return
    }

    if (result.persisted) {
        await deps.streamEvent({
            streamKey: cmd.componentId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: cmd.componentId,
                add: cmd.add,
                remove: cmd.remove,
                priorObjects: result.priorObjects,
                newObjects: result.newObjects,
            },
        })
    }
}

/**
 * Internal helper: force-clear all room objects and publish an `Objects Changed` update.
 * Intended for server-driven clear flows where caller does not need to enumerate prior object ids.
 */
export const clearRoomObjectsAndPublishUpdate = async (
    roomId: EphemeraRoomId,
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
    }
): Promise<void> => {
    const result = await clearPersistMetaRoomObjects({ roomId })
    if (!result.ok) {
        console.error(`[mtw.ephemera.objects] clearPersistMetaRoomObjects failed: ${result.errorMessage}`)
        return
    }
    if (!result.persisted) {
        return
    }
    await deps.streamEvent({
        streamKey: roomId,
        header: { type: 'Objects Changed' },
        update: {
            type: 'Objects Changed',
            componentId: roomId,
            add: [],
            remove: result.priorObjects.map(({ uuid }) => uuid),
            priorObjects: result.priorObjects,
            newObjects: [],
        },
    })
}

/**
 * Coyote path: clear objects in every configured Coyote Game room.
 */
export const handleAwaitRoadRunnerClearObjects = async (
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
        getGameRooms?: () => Promise<string[]>;
        clearRoomObjectsAndPublishUpdateImpl?: typeof clearRoomObjectsAndPublishUpdate;
    }
): Promise<void> => {
    const getGameRooms = deps.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const clearImpl = deps.clearRoomObjectsAndPublishUpdateImpl ?? clearRoomObjectsAndPublishUpdate
    const gameRooms = await getGameRooms()
    await Promise.all(gameRooms.map((roomId) => clearImpl(RoomKey(roomId) as EphemeraRoomId, { streamEvent: deps.streamEvent })))
}

/**
 * Coyote Acme delivery: persist finalized `stableKey` from `AcmeOrderPublishedOrder` onto
 * `Meta::Room.objects` with `shortName` and canonical trope fields;
 * mapping is pass-through (uniqueness enforced upstream in `mtw.ephemera.actions`).
 */
const acmeOrderToMetaRoomObject = (
    entry: AcmeOrderPublishedPayload['orders'][number],
    uuid: `OBJECT#${string}`
) => ({
    uuid,
    shortName: entry.shortName,
    stableKey: entry.stableKey,
    ...(entry.tropeAffinities !== undefined ? { tropeAffinities: entry.tropeAffinities } : {}),
    ...(entry.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true as const } : {}),
})

export const handleAcmeOrderAddObjects = async (
    payload: AcmeOrderPublishedPayload,
    deps: {
        streamEvent: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
        mergePersistMetaRoomObjectsImpl?: typeof mergePersistMetaRoomObjects;
        uuidFactory?: () => string;
        getCharacterMeta?: (characterId: EphemeraCharacterId) => Promise<{ RoomId?: string } | undefined>;
    }
): Promise<void> => {
    const getCharacterMeta = deps.getCharacterMeta ?? ((characterId: EphemeraCharacterId) => internalCache.CharacterMeta.get(characterId))
    const mergePersist = deps.mergePersistMetaRoomObjectsImpl ?? mergePersistMetaRoomObjects
    const roomId = (await getCharacterMeta(payload.characterId))?.RoomId
    if (typeof roomId !== 'string' || !isEphemeraRoomId(roomId)) {
        return
    }
    const makeUuid = deps.uuidFactory ?? uuidv4
    const add = payload.orders.map((entry) => acmeOrderToMetaRoomObject(
        entry,
        `OBJECT#${makeUuid()}` as `OBJECT#${string}`
    ))
    if (add.length === 0) {
        return
    }
    const result = await mergePersist({
        roomId,
        add,
        remove: [],
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.objects] mergePersistMetaRoomObjects failed: ${result.errorMessage}`)
        return
    }
    if (result.persisted) {
        await deps.streamEvent({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: roomId,
                add,
                remove: [],
                priorObjects: result.priorObjects,
                newObjects: result.newObjects,
            },
        })
    }
}
