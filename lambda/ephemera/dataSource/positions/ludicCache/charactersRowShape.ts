/**
 * The `LudicCache::Characters` row's shape and its pure readers: a leaf module, so `store.ts` (which
 * reads the row in its `getItems` for the header) and `charactersRow.ts` (which reads the room graph
 * through `store.ts`) share it without a runtime import cycle. Rules: `charactersRow.ts`.
 */
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export const LUDIC_CACHE_CHARACTERS_DATA_CATEGORY = 'LudicCache::Characters' as const

/** `Partial` because a kernel write can create the row before any rebuild has completed it. */
export type LudicCacheCharactersRow = {
    EphemeraId: EphemeraRoomId
    DataCategory: typeof LUDIC_CACHE_CHARACTERS_DATA_CATEGORY
    complete?: true
    [characterId: string]: unknown
}

/** The present characters a row lists (one top-level attribute per character, holding its binding ids). */
export const characterIdsOf = (row: Partial<LudicCacheCharactersRow>): EphemeraCharacterId[] => (
    Object.keys(row).filter((key): key is EphemeraCharacterId => isEphemeraCharacterId(key) && Array.isArray(row[key]))
)

/** A row is trusted only once a rebuild has stood behind it: a kernel write alone can leave a partial row. */
export const isCompleteCharactersRow = (row: Partial<LudicCacheCharactersRow> | undefined): row is Partial<LudicCacheCharactersRow> & { complete: true } => (
    row?.complete === true
)
