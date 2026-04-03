import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StateChangeCommand } from '../localApiEvents'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'

/**
 * Apply api.ephemera `State Change` to Dynamo: rooms merge `markState` into `Meta::Room.state.marks`.
 * Non-room component ids are ignored until other meta kinds are supported.
 *
 * TEMPORARY (State Change assetStack): `cmd.assetStack` is forwarded as `perspective.assetStack` only until
 * default marks can be derived from the canonical participation stack without caller-supplied plumbing; see
 * `StateChangeCommand` in `localApiEvents.ts`.
 */
export const handleApiStateChangeCommand = async (cmd: StateChangeCommand): Promise<void> => {
    if (!isEphemeraRoomId(cmd.componentId)) {
        return
    }

    const result = await mergePersistMetaRoomMarks({
        roomId: cmd.componentId,
        incomingMarks: cmd.markState,
        // TEMPORARY (State Change assetStack): replace with resolver output when available.
        perspective: { assetStack: cmd.assetStack ?? [] },
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.state] mergePersistMetaRoomMarks failed: ${result.errorMessage}`)
    }
}
