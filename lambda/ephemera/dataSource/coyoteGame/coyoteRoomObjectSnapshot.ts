import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export type CoyoteRoomObjectSnapshotDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
}

/** Staged object shortNames by room for Coyote hypothesis/outcome prompts. */
export async function loadCoyoteRoomObjectsByRoom(
    deps: CoyoteRoomObjectSnapshotDeps
): Promise<Record<EphemeraRoomId, string[]>> {
    const roomKeys = await deps.getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)
    const roomMetaList = await Promise.all(
        roomIds.map(async (roomId) => ({
            roomId,
            meta: await deps.getRoomMeta(roomId),
        }))
    )

    return Object.fromEntries(
        roomMetaList.map(({ roomId, meta }) => [
            roomId,
            (meta?.objects ?? []).map(({ shortName }) => shortName),
        ])
    ) as Record<EphemeraRoomId, string[]>
}

function formatRoomLabel(roomId: EphemeraRoomId): string {
    return roomId.replace(/^ROOM#/, '')
}

function formatObjectList(objects: string[]): string {
    return objects.length > 0 ? objects.join(', ') : '(none)'
}

/** Shared "staged objects by room" block for Coyote prompts (hypothesis, plan outcome). */
export function formatCoyoteStagedObjectsByRoom(roomObjectsByRoom: Record<EphemeraRoomId, string[]>): string {
    const snapshotSection = Object.entries(roomObjectsByRoom)
        .map(([roomId, objects]) => `${formatRoomLabel(roomId as EphemeraRoomId)}: ${formatObjectList(objects)}`)
        .join('\n')
    return snapshotSection || '(none)'
}
