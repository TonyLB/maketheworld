import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'
import type { ObjectsChangeCommand } from '../localApiEvents'
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
