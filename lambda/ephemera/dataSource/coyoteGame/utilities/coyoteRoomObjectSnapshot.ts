import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

export type CoyoteRoomObjectSnapshotDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
}

/** Staged objects by room for Coyote hypothesis/outcome prompts (full meta rows incl. trope affinities). */
export type CoyoteRoomObjectsByRoom = Record<EphemeraRoomId, EphemeraMetaRoomObject[]>

export async function loadCoyoteRoomObjectsByRoom(
    deps: CoyoteRoomObjectSnapshotDeps
): Promise<CoyoteRoomObjectsByRoom> {
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
            meta?.objects ?? [],
        ])
    ) as CoyoteRoomObjectsByRoom
}

function formatRoomLabel(roomId: EphemeraRoomId): string {
    return roomId.replace(/^ROOM#/, '')
}

function sortedRoomEntries(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): [EphemeraRoomId, EphemeraMetaRoomObject[]][] {
    return (Object.entries(roomObjectsByRoom) as [EphemeraRoomId, EphemeraMetaRoomObject[]][])
        .sort(([a], [b]) => (a as string).localeCompare(b as string))
}

/** Renders trope-affinity lines for one staged object. */
export function formatCoyoteObjectAffinitySuffix(o: EphemeraMetaRoomObject): string {
    const parts: string[] = []
    if (o.tropeAffinities && o.tropeAffinities.length > 0) {
        parts.push(`tropes: ${o.tropeAffinities.map((entry) => (
            `${entry.trope} ${entry.aptness} (${entry.narrowing})`
        )).join('; ')}`)
    }
    else if (o.tropeAffinitiesFailed === true) {
        parts.push('trope affinities unavailable (enrich failed)')
    }
    return parts.join(' | ')
}

function formatCoyoteStagedObjectLine(o: EphemeraMetaRoomObject): string {
    const suffix = formatCoyoteObjectAffinitySuffix(o)
    const keyPart = ` — stableKey: ${o.stableKey}`
    if (suffix) {
        return `${o.shortName}${keyPart} — ${suffix}`
    }
    return `${o.shortName}${keyPart}`
}

/** Shared "staged objects by room" block for Coyote prompts (hypothesis, plan outcome). */
export function formatCoyoteStagedObjectsByRoom(roomObjectsByRoom: CoyoteRoomObjectsByRoom): string {
    const entries = sortedRoomEntries(roomObjectsByRoom)
    const blocks = entries.map(([roomId, objects]) => {
        const label = formatRoomLabel(roomId)
        if (objects.length === 0) {
            return `${label}: (none)`
        }
        const lines = objects.map(formatCoyoteStagedObjectLine)
        return `${label}:\n${lines.map((line) => `  ${line}`).join('\n')}`
    })
    const snapshotSection = blocks.join('\n')
    return snapshotSection || '(none)'
}

/**
 * Stage-one clustering grounding payload:
 * stable JSON for room-grouped staged objects with full trope/affordance data.
 */
export function serializeCoyoteStagedObjectsByRoomJson(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): string {
    const payload = {
        rooms: sortedRoomEntries(roomObjectsByRoom).map(([roomId, objects]) => ({
            roomId,
            room: formatRoomLabel(roomId),
            objects: objects.map((o) => ({
                uuid: o.uuid,
                shortName: o.shortName,
                stableKey: o.stableKey,
                ...(o.tropeAffinities !== undefined ? { tropeAffinities: o.tropeAffinities } : {}),
                ...(o.tropeAffinitiesFailed !== undefined ? { tropeAffinitiesFailed: o.tropeAffinitiesFailed } : {}),
            })),
        })),
    }
    return JSON.stringify(payload, null, 2)
}
