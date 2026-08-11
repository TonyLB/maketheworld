import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { RoomCharacterListItem } from './baseClasses'
import internalCache from './index'

export async function hydrateRoomRosterFromCharacterIds(
    characterIds: EphemeraCharacterId[]
): Promise<RoomCharacterListItem[]> {
    if (characterIds.length === 0) {
        return []
    }

    const entries = await Promise.all(
        characterIds.map(async (characterId): Promise<RoomCharacterListItem | undefined> => {
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

    return entries.filter((entry): entry is RoomCharacterListItem => entry !== undefined)
}

/** Derive hydrated room occupants in ephemera wire shape (no per-room memo). */
export async function getRoomCharacterList(
    roomId: EphemeraRoomId
): Promise<RoomCharacterListItem[]> {
    const graph = await internalCache.Positions.getLudicGraph(roomId)
    const characterIds = [...graph.characterIds]
    return hydrateRoomRosterFromCharacterIds(characterIds)
}
