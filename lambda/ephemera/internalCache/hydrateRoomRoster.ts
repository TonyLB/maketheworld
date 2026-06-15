import type { PlayPositionRoomRosterEntry } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { RoomCharacterListItem } from './baseClasses'
import internalCache from './index'

export const playPositionRosterEntryToRoomCharacterListItem = (
    entry: PlayPositionRoomRosterEntry
): RoomCharacterListItem => ({
    EphemeraId: entry.EphemeraId,
    DisplayName: entry.DisplayName,
    SessionIds: entry.SessionIds,
    ...(entry.Color !== undefined ? { Color: entry.Color } : {}),
    ...(entry.fileURL !== undefined ? { fileURL: entry.fileURL } : {}),
})

export async function hydrateRoomRosterFromCharacterIds(
    characterIds: EphemeraCharacterId[]
): Promise<PlayPositionRoomRosterEntry[]> {
    if (characterIds.length === 0) {
        return []
    }

    const entries = await Promise.all(
        characterIds.map(async (characterId): Promise<PlayPositionRoomRosterEntry | undefined> => {
            const characterMeta = await internalCache.CharacterMeta.get(characterId, { check: true })
            if (!characterMeta) {
                return undefined
            }
            const sessions = await internalCache.CharacterSessions.get(characterId)
            return {
                EphemeraId: characterId,
                DisplayName: characterMeta.Name,
                SessionIds: sessions ?? [],
                ...(characterMeta.Color !== undefined ? { Color: characterMeta.Color } : {}),
                ...(characterMeta.fileURL !== undefined ? { fileURL: characterMeta.fileURL } : {}),
            }
        })
    )

    return entries.filter((entry): entry is PlayPositionRoomRosterEntry => entry !== undefined)
}

/** Derive hydrated room occupants in ephemera wire shape (no per-room memo). */
export async function getRoomCharacterList(
    roomId: EphemeraRoomId
): Promise<RoomCharacterListItem[]> {
    const roster = await internalCache.Positions.getRoomRoster(roomId)
    return roster.map(playPositionRosterEntryToRoomCharacterListItem)
}
