import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StateChangeCommand } from '../localApiEvents'
import internalCache from '../../internalCache'
import { mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'
import { resolveCanonAssetStackForRoom } from './resolveAssetStackForRoom'

/**
 * Apply api.ephemera `State Change` to Dynamo: rooms merge `markState` into `Meta::Room.state.marks`.
 * Non-room component ids are ignored until other meta kinds are supported.
 *
 * Default-mark perspective uses `resolveCanonAssetStackForRoom` (RoomAssets + AssetMetaData). `cmd.assetStack`
 * remains on `StateChangeCommand` for backward compatibility until removed in a follow-on.
 */
export const handleApiStateChangeCommand = async (cmd: StateChangeCommand): Promise<void> => {
    if (!isEphemeraRoomId(cmd.componentId)) {
        return
    }

    const assetStack = await resolveCanonAssetStackForRoom(cmd.componentId, internalCache)

    const result = await mergePersistMetaRoomMarks({
        roomId: cmd.componentId,
        incomingMarks: cmd.markState,
        perspective: { assetStack },
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.state] mergePersistMetaRoomMarks failed: ${result.errorMessage}`)
    }
}
