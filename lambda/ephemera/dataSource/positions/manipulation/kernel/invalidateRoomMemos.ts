import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../../../internalCache'

/** Drops a room's memoised header roster and component meta, so the next compose reads them afresh. */
export const invalidateRoomMemos = (roomId: EphemeraRoomId): void => {
    internalCache.ComponentEphemeraMeta.invalidate(roomId)
    internalCache.AffordanceRoomDeliverable.invalidate(roomId)
}
