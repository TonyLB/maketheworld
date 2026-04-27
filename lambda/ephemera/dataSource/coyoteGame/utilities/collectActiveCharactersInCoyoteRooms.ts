import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'
import internalCache from '../../../internalCache'

/**
 * All characters with at least one session in any Coyote Game demo room, de-duplicated by EphemeraId.
 */
export async function collectActiveCharactersInCoyoteRooms(): Promise<EphemeraCharacterId[]> {
    const keys = await internalCache.CoyoteGame.get('gameRooms')
    const seen = new Set<EphemeraCharacterId>()
    const out: EphemeraCharacterId[] = []
    for (const k of keys) {
        const roomId = RoomKey(k) as EphemeraRoomId
        const occupants = await internalCache.RoomCharacterList.get(roomId)
        for (const o of occupants ?? []) {
            if (o.SessionIds.length === 0) {
                continue
            }
            if (seen.has(o.EphemeraId)) {
                continue
            }
            seen.add(o.EphemeraId)
            out.push(o.EphemeraId)
        }
    }
    return out
}
