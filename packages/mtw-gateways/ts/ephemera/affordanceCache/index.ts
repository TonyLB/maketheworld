export {
    EPHEMERA_AFFORDANCE_DATA_CATEGORY_PREFIX,
    buildAffordanceDataCategory,
    perspectiveKeyFromAffordanceDataCategory,
    affordanceRowsCacheKey,
    affordanceRowCacheKey,
} from './keys'
export type { EphemeraAffordanceDataCategory } from './keys'

export type { AffordanceCacheRow } from './types'
export { isAffordanceCacheRow, createAffordanceCacheRow } from './types'

export {
    shouldIncrementCatalogVersionOnInvalidation,
    isCatalogRowStale,
    isCatalogRowHydrated,
    catalogRowMatchesEditAssetId,
    isAuthoritativeAffordanceRow,
    canUpsertAffordanceRowAtHydrate,
    shouldWriteHydratedCatalogVersion,
} from './guards'

export type { EphemeraAffordanceCacheReadDB } from './fetch'
export {
    queryAffordanceRowsForRoom,
    getAffordanceRowFromDynamo,
} from './fetch'

export type { AffordanceCacheSetParams } from './factory'
export {
    AffordanceCacheCacheHandler,
    createAffordanceCacheCacheHandler,
} from './factory'
