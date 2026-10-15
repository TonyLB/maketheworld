import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { extractCharacterIdsFromLudicGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'

const asTrimmedString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

export const normalizeRoomId = (value: unknown): string | undefined => {
    const roomId = asTrimmedString(value)
    if (!roomId) {
        return undefined
    }
    return roomId.startsWith('ROOM#') ? roomId : `ROOM#${roomId}`
}

export const listGraphCharacterIds = (ludicGraph: unknown): string[] => {
    if (!isEphemeraLudicGraphFieldPayload(ludicGraph)) {
        return []
    }
    return extractCharacterIdsFromLudicGraph(ludicGraph)
}

/**
 * The characters a `LudicCache::Characters` row lists: one top-level attribute per present character,
 * keyed by its id and holding its binding ids. Key attributes and anything else are ignored.
 */
export const listRowCharacterIds = (row: unknown): string[] => (
    row !== null && typeof row === 'object'
        ? Object.entries(row as Record<string, unknown>)
            .filter(([key, value]) => isEphemeraCharacterId(key) && Array.isArray(value))
            .map(([key]) => key)
        : []
)

/**
 * Row-forward occupancy drift for one room. The room's `LudicCache::Characters` row is the index; each
 * character's own binding pointer governs it (a pointer governs its index), so this compares the row against
 * what the character's side says. Per character on the row:
 * - drift when no live sessions (ghost on the row), or
 * - drift when in-play but membership adjacency does not list this roomId.
 *
 * Any character still named by the room's *stored graph* (`legacyGraphCharacterIds`) is drift too: bystanders
 * left room graphs in Slice 4, so such a node predates it and is handed to the row by the heal
 * (`migrateRoomBystanders`). Once the data is clean this input is always empty.
 *
 * Stale adjacency without a row entry is not visible to this room-forward scan (explicit gap).
 */
export const roomHasOccupancyDrift = (args: {
    roomId: string
    rowCharacterIds: string[]
    legacyGraphCharacterIds?: string[]
    adjacencySessionsByCharacter: Map<string, Set<string>>
    membershipContainersByCharacter: Map<string, string[]>
}): boolean => {
    const {
        roomId,
        rowCharacterIds,
        legacyGraphCharacterIds = [],
        adjacencySessionsByCharacter,
        membershipContainersByCharacter,
    } = args
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) {
        return false
    }
    if (legacyGraphCharacterIds.length > 0) {
        return true
    }

    for (const characterId of rowCharacterIds) {
        if (!isEphemeraCharacterId(characterId)) {
            continue
        }
        const sessions = adjacencySessionsByCharacter.get(characterId)
        const hasSessions = Boolean(sessions && sessions.size > 0)
        if (!hasSessions) {
            return true
        }
        const containers = membershipContainersByCharacter.get(characterId) ?? []
        const normalizedContainers = containers
            .map((containerId) => normalizeRoomId(containerId))
            .filter((containerId): containerId is string => Boolean(containerId))
        if (!normalizedContainers.includes(normalizedRoomId)) {
            return true
        }
    }
    return false
}
