/**
 * Total Coyote Game graph-placed objects across demo rooms (count sum, not **`stableKey`** dedup).
 * Used for Acme order enrich pre-checks; room set matches **`collectCoyoteOccupiedStableKeys`**.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CollectCoyoteOccupiedStableKeysDeps } from '../baseClasses'

export async function countCoyotePlacedObjectsAcrossRooms(
    deps?: Partial<CollectCoyoteOccupiedStableKeysDeps>
): Promise<number> {
    const getGameRooms = deps?.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getObjectIdsInRoom = deps?.getObjectIdsInRoom
        ?? (async (roomId: EphemeraRoomId) => [...(await internalCache.Positions.getPositionGraph(roomId)).objectIds])

    const roomKeys = await getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)

    const perRoomCounts = await Promise.all(
        roomIds.map(async (roomId) => (await getObjectIdsInRoom(roomId)).length)
    )

    return perRoomCounts.reduce((sum, n) => sum + n, 0)
}
