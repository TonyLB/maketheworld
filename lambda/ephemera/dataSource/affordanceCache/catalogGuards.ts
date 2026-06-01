export {
    shouldIncrementCatalogVersionOnInvalidation,
    isCatalogRowStale,
    isCatalogRowHydrated,
    catalogRowMatchesEditAssetId,
    isAuthoritativeAffordanceRow,
    canUpsertAffordanceRowAtHydrate,
    shouldPersistAffordanceTopologyAtHydrate,
    shouldWriteHydratedCatalogVersion,
} from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
