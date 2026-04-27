import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'
import internalCache from '../../../internalCache'

/**
 * True when `roomId` is one of the Coyote Game demo rooms (from invocation-local CoyoteGame cache).
 * Cache keys may be short names or full `ROOM#...` ids; {@link RoomKey} normalizes for comparison.
 */
export async function isCoyoteGameRoom(roomId: EphemeraRoomId): Promise<boolean> {
    const keys = await internalCache.CoyoteGame.get('gameRooms')
    return keys.some((k) => RoomKey(k) === roomId)
}
