/**
 * Total Coyote Game **`Meta::Room.objects`** placements across demo rooms (length sum, not **`stableKey`** dedup).
 * Used for Acme order enrich pre-checks; room set matches **`collectCoyoteOccupiedStableKeys`**.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CollectCoyoteOccupiedStableKeysDeps } from '../stableKey/collectCoyoteOccupiedStableKeys'

export async function countCoyotePlacedObjectsAcrossRooms(
    deps?: Partial<CollectCoyoteOccupiedStableKeysDeps>
): Promise<number> {
    const getGameRooms = deps?.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getRoomMeta = deps?.getRoomMeta
        ?? ((roomId: EphemeraRoomId) => internalCache.ComponentEphemeraMeta.get(roomId))

    const roomKeys = await getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)

    const perRoomCounts = await Promise.all(
        roomIds.map(async (roomId) => {
            const meta = await getRoomMeta(roomId)
            return meta?.objects?.length ?? 0
        })
    )

    return perRoomCounts.reduce((sum, n) => sum + n, 0)
}
