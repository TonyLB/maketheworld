import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { RoomCharacterListItem } from './baseClasses'
import { readRoomCharacters } from '../dataSource/positions/ludicCache/charactersRow'
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

/**
 * Derive hydrated room occupants in ephemera wire shape (no per-room memo). Membership comes from the
 * room's `LudicCache::Characters` row, never from the room graph; `CharacterMeta` and sessions hydrate it.
 */
export async function getRoomCharacterList(
    roomId: EphemeraRoomId
): Promise<RoomCharacterListItem[]> {
    return hydrateRoomRosterFromCharacterIds(await readRoomCharacters(roomId))
}
