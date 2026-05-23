export {
    cacheRowCatalogVersion,
    shouldIncrementCatalogVersionOnInvalidation,
    isCatalogRowStale,
    catalogRowMatchesEditAssetId,
    isAuthoritativeCacheRow,
    canUpsertCacheRowAtHydrate,
    canDeleteCacheRowOnHydrate,
    shouldWriteHydratedCatalogVersion,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
