export {
    shouldIncrementCatalogVersionOnInvalidation,
    isCatalogRowStale,
    isCatalogRowHydrated,
    catalogRowMatchesEditAssetId,
    isAuthoritativeAffordanceRow,
    canUpsertAffordanceRowAtHydrate,
    shouldWriteHydratedCatalogVersion,
} from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
