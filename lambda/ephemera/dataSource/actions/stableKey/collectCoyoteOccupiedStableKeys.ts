/**
 * Coyote-wide **`stableKey`** occupancy for Acme order enrich and **`finalizeStableKeysDeterministic`**.
 * See **Scope and non-goals** / **Where enforcement runs** in [`../AGENT.md`](../AGENT.md)
 * (**Acme catalog lines and `stableKey`**).
 */
import { extractObjectIdsFromPlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CollectCoyoteOccupiedStableKeysDeps } from '../baseClasses'

/** Union of non-empty **`stableKey`** values from graph-placed objects across Coyote game rooms. */
export async function collectCoyoteOccupiedStableKeys(
    deps?: Partial<CollectCoyoteOccupiedStableKeysDeps>
): Promise<ReadonlySet<string>> {
    const getGameRooms = deps?.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getObjectIdsInRoom = deps?.getObjectIdsInRoom
        ?? (async (roomId: EphemeraRoomId) => extractObjectIdsFromPlayPositionGraph(
            await internalCache.Positions.getPositionGraph(roomId)
        ))
    const getObjectMeta = deps?.getObjectMeta
        ?? ((objectId: EphemeraObjectId) => internalCache.ObjectEphemeraMeta.get(objectId))

    const roomKeys = await getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)
    const occupied = new Set<string>()

    await Promise.all(roomIds.map(async (roomId) => {
        const objectIds = await getObjectIdsInRoom(roomId)
        await Promise.all(objectIds.map(async (objectId) => {
            const meta = await getObjectMeta(objectId)
            const raw = meta?.stableKey
            if (typeof raw !== 'string') {
                return
            }
            const trimmed = raw.trim()
            if (trimmed.length > 0) {
                occupied.add(trimmed)
            }
        }))
    }))

    return occupied
}
