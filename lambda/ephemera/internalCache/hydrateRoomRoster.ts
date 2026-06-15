import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionRoomRosterEntry } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import internalCache from './index'

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
