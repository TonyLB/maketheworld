import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

export type CoyoteRoomObjectSnapshotDeps = {
    getGameRooms: () => Promise<string[]>
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
}

/** Staged objects by room for Coyote hypothesis/outcome prompts (full meta rows incl. affinities). */
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

/** Compact deterministic line for one affinity possibility (prompt-facing; tunable copy). */
export function formatCoyoteAffinityPossibility(p: CoyoteAffinityPossibility): string {
    if (p.role === 'entity_modification') {
        return `entity_modification ${p.target} ${p.mode} ${p.aptness.toFixed(2)}`
    }
    return `${p.role} ${p.aptness.toFixed(2)}`
}

/**
 * Renders plan-role lines for one staged object. Legacy rows (no affinities, not failed) add no suffix.
 */
export function formatCoyoteObjectAffinitySuffix(o: EphemeraMetaRoomObject): string {
    if (o.affinitiesFailed === true) {
        return 'plan roles unavailable (enrich failed)'
    }
    const raw = o.affinities
    if (!raw || raw.length === 0) {
        return ''
    }
    const sorted = [...raw].sort((a, b) => b.aptness - a.aptness)
    const capped = sorted.slice(0, ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE)
    return capped.map(formatCoyoteAffinityPossibility).join('; ')
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
    const entries = (Object.entries(roomObjectsByRoom) as [EphemeraRoomId, EphemeraMetaRoomObject[]][])
        .sort(([a], [b]) => (a as string).localeCompare(b as string))
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
