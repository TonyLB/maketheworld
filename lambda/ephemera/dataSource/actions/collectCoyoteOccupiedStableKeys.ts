/**
 * Coyote-wide **`stableKey`** occupancy for Step B enrich and **`finalizeStableKeysDeterministic`**.
 * See task plan **Uniqueness scope** / **Where deterministic enforcement runs** in
 * `taskPlanning/.../AGENT.acmeObject-stableKey.plan.md`.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../internalCache'

export type CollectCoyoteOccupiedStableKeysDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
}

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
