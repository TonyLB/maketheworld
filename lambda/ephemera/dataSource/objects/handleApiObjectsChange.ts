import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ObjectsChangeCommand } from '../localApiEvents'
import { mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'
import type { ObjectsChangedPayload } from './events'

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
