import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StateChangeCommand } from '../localApiEvents'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'

/**
 * Apply api.ephemera `State Change` to Dynamo: rooms merge `markState` into `Meta::Room.state.marks`.
 * Non-room component ids are ignored until other meta kinds are supported.
 *
 * Default marks (when none stored) use `computeDefaultMarksForRoom`, which resolves the Canon asset stack via
 * `resolveCanonAssetStackForRoom` only in that path.
 */
export const handleApiStateChangeCommand = async (cmd: StateChangeCommand): Promise<void> => {
    if (!isEphemeraRoomId(cmd.componentId)) {
        return
    }

    const result = await mergePersistMetaRoomMarks({
        roomId: cmd.componentId,
        incomingMarks: cmd.markState,
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.state] mergePersistMetaRoomMarks failed: ${result.errorMessage}`)
    }
}
