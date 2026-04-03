import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { StateChangeCommand } from '../localApiEvents'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'
import type { StateChangedPayload } from './events'

/**
 * Apply api.ephemera `State Change` to Dynamo: rooms merge `markState` into `Meta::Room.state.marks`.
 * Non-room component ids are ignored until other meta kinds are supported.
 *
 * Default marks (when none stored) use `computeDefaultMarksForRoom`, which resolves the Canon asset stack via
 * `resolveCanonAssetStackForRoom` only in that path.
 */
export const handleApiStateChangeCommand = async (
    cmd: StateChangeCommand,
    deps: {
        streamEvent: StreamEventFunction<StateChangedPayload, StreamingEventHeader>;
    }
): Promise<void> => {
    if (!isEphemeraRoomId(cmd.componentId)) {
        return
    }

    const result = await mergePersistMetaRoomMarks({
        roomId: cmd.componentId,
        incomingMarks: cmd.markState,
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.state] mergePersistMetaRoomMarks failed: ${result.errorMessage}`)
        return
    }

    if (result.persisted) {
        await deps.streamEvent({
            streamKey: cmd.componentId,
            header: { type: 'State Changed' },
            update: {
                type: 'State Changed',
                componentId: cmd.componentId,
                incomingMarkState: cmd.markState,
                priorState: result.priorState,
                newState: result.newState,
            },
        })
    }
}
