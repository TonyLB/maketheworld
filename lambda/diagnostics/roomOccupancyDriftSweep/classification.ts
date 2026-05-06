type RoomOccupant = {
    EphemeraId?: string
    SessionIds?: string[]
    sessions?: string[]
}

type CharacterMeta = {
    EphemeraId: string
    RoomId?: string
}

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

const normalizeSessionIds = (candidate: RoomOccupant): string[] => {
    const source = candidate.SessionIds ?? candidate.sessions ?? []
    if (!Array.isArray(source)) {
        return []
    }
    return [...new Set(source.map(asTrimmedString).filter((value): value is string => Boolean(value)))].sort()
}

export const listOccupancyEntries = (activeCharacters: unknown): { characterId: string; sessionIds: string[] }[] => {
    if (!Array.isArray(activeCharacters)) {
        return []
    }
    return activeCharacters
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null
            }
            const characterId = asTrimmedString((entry as RoomOccupant).EphemeraId)
            if (!characterId) {
                return null
            }
            return {
                characterId,
                sessionIds: normalizeSessionIds(entry as RoomOccupant)
            }
        })
        .filter((entry): entry is { characterId: string; sessionIds: string[] } => Boolean(entry))
}

export const authoritativeRoomByCharacter = (rows: CharacterMeta[]): Map<string, string> =>
    new Map(
        rows
            .map(({ EphemeraId, RoomId }) => {
                const characterId = asTrimmedString(EphemeraId)
                const normalizedRoomId = normalizeRoomId(RoomId)
                if (!characterId || !normalizedRoomId) {
                    return null
                }
                return [characterId, normalizedRoomId] as const
            })
            .filter((entry): entry is readonly [string, string] => Boolean(entry))
    )

const fingerprintEntries = (entries: { characterId: string; sessionIds: string[] }[]): string[] =>
    entries
        .map(({ characterId, sessionIds }) => `${characterId}:${sessionIds.join(',')}`)
        .sort()

export const roomHasOccupancyDrift = (args: {
    roomId: string
    occupancyEntries: { characterId: string; sessionIds: string[] }[]
    adjacencySessionsByCharacter: Map<string, Set<string>>
    roomByCharacter: Map<string, string>
}): { drift: boolean; needsCheckLocation: boolean } => {
    const { roomId, occupancyEntries, adjacencySessionsByCharacter, roomByCharacter } = args
    let needsCheckLocation = false

    const expectedEntries = [...adjacencySessionsByCharacter.entries()]
        .map(([characterId, sessions]) => {
            const authoritativeRoom = roomByCharacter.get(characterId)
            if (!authoritativeRoom) {
                needsCheckLocation = true
                return null
            }
            if (authoritativeRoom !== roomId) {
                return null
            }
            return {
                characterId,
                sessionIds: [...sessions].sort()
            }
        })
        .filter((entry): entry is { characterId: string; sessionIds: string[] } => Boolean(entry))

    for (const { characterId } of occupancyEntries) {
        const authoritativeRoom = roomByCharacter.get(characterId)
        if (!authoritativeRoom) {
            needsCheckLocation = true
        }
    }

    const actualFingerprint = fingerprintEntries(occupancyEntries)
    const expectedFingerprint = fingerprintEntries(expectedEntries)
    return {
        drift: actualFingerprint.join('|') !== expectedFingerprint.join('|'),
        needsCheckLocation
    }
}

