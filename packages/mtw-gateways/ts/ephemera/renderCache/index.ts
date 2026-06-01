export {
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX,
    buildCacheCatalogDataCategory,
    perspectiveKeyFromCatalogDataCategory,
    catalogRowsCacheKey,
    catalogRowCacheKey,
} from './keys'
export type { EphemeraCacheCatalogDataCategory } from './keys'

export type {
    EphemeraCacheComponentId,
    EphemeraCacheCatalogRow,
    EphemeraCacheDynamoItem,
    EphemeraCacheRenderedContent,
    EphemeraCacheProvenance,
    EphemeraCacheMarkState,
    EphemeraPerspectiveId,
} from './types'
export {
    EPHEMERA_CACHE_PROVENANCE_AUTHORED,
    EPHEMERA_CACHE_PROVENANCE_GENERATED,
    isEphemeraCacheDynamoItem,
    isEphemeraCacheCatalogRow,
} from './types'

export {
    cacheRowCatalogVersion,
    shouldIncrementCatalogVersionOnInvalidation,
    isCatalogRowStale,
    catalogRowMatchesEditAssetId,
    isAuthoritativeCacheRow,
    canUpsertCacheRowAtHydrate,
    canDeleteCacheRowOnHydrate,
    shouldWriteHydratedCatalogVersion,
} from './guards'

export { normalizeMarkState, markStatesEqual } from './markState'

export type { EphemeraRenderCacheReadDB } from './fetch'
export {
    queryCacheRowsForComponent,
    queryCatalogRowsForComponent,
    getCatalogRow as fetchCatalogRow,
} from './fetch'

export type {
    AuthoredCatalogDriftResult,
    ClassifyAuthoredCatalogDriftParams,
    ExpectedCacheRecordFromAuthoredExampleParams,
} from './classifyAuthoredCatalogDrift'
export {
    classifyAuthoredCatalogDrift,
    expectedCacheFieldsFromAuthoredExample,
} from './classifyAuthoredCatalogDrift'

export type { RenderCacheSetParams, RenderCacheSetCatalogRowParams } from './factory'
export {
    RenderCacheCacheHandler,
    createRenderCacheCacheHandler,
} from './factory'
