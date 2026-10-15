/**
 * The `LudicCache::Characters` row's shape and its pure reader: a leaf module, so `store.ts` (which
 * reads the row in its `getItems` for the header) and `charactersRow.ts` share it. Rules: `charactersRow.ts`.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const LUDIC_CACHE_CHARACTERS_DATA_CATEGORY = 'LudicCache::Characters' as const

/** The row as stored; `Partial` because a room nobody has entered has no row at all. */
export type LudicCacheCharactersRow = {
    EphemeraId: EphemeraRoomId
    DataCategory: typeof LUDIC_CACHE_CHARACTERS_DATA_CATEGORY
    [characterId: string]: unknown
}

/** The present characters a row lists (one top-level attribute per character, holding its binding ids). */
export const characterIdsOf = (row: Partial<LudicCacheCharactersRow>): EphemeraCharacterId[] => (
    Object.keys(row).filter((key): key is EphemeraCharacterId => isEphemeraCharacterId(key) && Array.isArray(row[key]))
)
