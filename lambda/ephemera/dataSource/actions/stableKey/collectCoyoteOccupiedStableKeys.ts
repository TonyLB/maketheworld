/**
 * Coyote-wide **`stableKey`** occupancy for Acme order enrich and **`finalizeStableKeysDeterministic`**.
 * See **Scope and non-goals** / **Where enforcement runs** in [`../AGENT.md`](../AGENT.md)
 * (**Acme catalog lines and `stableKey`**).
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CollectCoyoteOccupiedStableKeysDeps } from '../baseClasses'

/** Union of non-empty **`stableKey`** values from **`Meta::Room.objects`** across Coyote game rooms. */
export async function collectCoyoteOccupiedStableKeys(
    deps?: Partial<CollectCoyoteOccupiedStableKeysDeps>
): Promise<ReadonlySet<string>> {
    const getGameRooms = deps?.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getRoomMeta = deps?.getRoomMeta
        ?? ((roomId: EphemeraRoomId) => internalCache.ComponentEphemeraMeta.get(roomId))

    const roomKeys = await getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)
    const occupied = new Set<string>()

    await Promise.all(roomIds.map(async (roomId) => {
        const meta = await getRoomMeta(roomId)
        for (const obj of meta?.objects ?? []) {
            const raw = obj.stableKey
            if (typeof raw !== 'string') {
                continue
            }
            const trimmed = raw.trim()
            if (trimmed.length > 0) {
                occupied.add(trimmed)
            }
        }
    }))

    return occupied
}
