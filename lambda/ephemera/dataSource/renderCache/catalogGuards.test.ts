import {
    cacheRowCatalogVersion,
    canDeleteCacheRowOnHydrate,
    canUpsertCacheRowAtHydrate,
    catalogRowMatchesEditAssetId,
    isAuthoritativeCacheRow,
    isCatalogRowStale,
    shouldIncrementCatalogVersionOnInvalidation,
    shouldWriteHydratedCatalogVersion,
} from './catalogGuards'
import type { EphemeraCacheCatalogRow } from './baseClasses'

const catalogRow = (overrides: Partial<EphemeraCacheCatalogRow> = {}): EphemeraCacheCatalogRow => ({
    EphemeraId: 'ROOM#test',
    DataCategory: 'Cache::PERSPECTIVE#v1#abc',
    assetStack: ['ASSET#canon', 'ASSET#overlay'],
    catalogVersion: 2,
    hydratedCatalogVersion: 2,
    ...overrides,
})

describe('catalogGuards', () => {
    it('shouldIncrementCatalogVersionOnInvalidation is true only when ready', () => {
        expect(shouldIncrementCatalogVersionOnInvalidation(catalogRow())).toBe(true)
        expect(shouldIncrementCatalogVersionOnInvalidation(catalogRow({ hydratedCatalogVersion: 1 }))).toBe(false)
    })

    it('isCatalogRowStale when hydrated lags catalog', () => {
        expect(isCatalogRowStale(catalogRow({ hydratedCatalogVersion: 1 }))).toBe(true)
        expect(isCatalogRowStale(catalogRow())).toBe(false)
    })

    it('catalogRowMatchesEditAssetId uses layer participation', () => {
        const row = catalogRow()
        expect(catalogRowMatchesEditAssetId(row, 'ASSET#overlay')).toBe(true)
        expect(catalogRowMatchesEditAssetId(row, 'ASSET#other')).toBe(false)
    })

    it('isAuthoritativeCacheRow compares row version to catalog', () => {
        const cat = catalogRow({ catalogVersion: 3 })
        expect(isAuthoritativeCacheRow({ catalogVersion: 3 }, cat)).toBe(true)
        expect(isAuthoritativeCacheRow({ catalogVersion: undefined }, cat)).toBe(false)
        expect(isAuthoritativeCacheRow({ catalogVersion: 2 }, cat)).toBe(false)
    })

    it('cacheRowCatalogVersion treats missing as 0', () => {
        expect(cacheRowCatalogVersion({})).toBe(0)
    })

    it('hydrate row guards allow upsert/delete below incoming only', () => {
        expect(canUpsertCacheRowAtHydrate(1, 2)).toBe(true)
        expect(canUpsertCacheRowAtHydrate(2, 2)).toBe(false)
        expect(canDeleteCacheRowOnHydrate(undefined, 1)).toBe(true)
    })

    it('shouldWriteHydratedCatalogVersion when catalog unchanged', () => {
        expect(shouldWriteHydratedCatalogVersion(2, 2)).toBe(true)
        expect(shouldWriteHydratedCatalogVersion(2, 3)).toBe(false)
    })
})
