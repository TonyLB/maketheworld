import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetStackIncludesEditAssetId } from '../../assets/components/componentExamples'

import type { EphemeraCacheCatalogRow, EphemeraCacheDynamoItem } from './types'

export const cacheRowCatalogVersion = (row: Pick<EphemeraCacheDynamoItem, 'catalogVersion'>): number =>
    row.catalogVersion ?? 0

/** M4: bump catalogVersion only when the row was ready (not already stale). */
export const shouldIncrementCatalogVersionOnInvalidation = (row: EphemeraCacheCatalogRow): boolean =>
    row.hydratedCatalogVersion === row.catalogVersion

export const isCatalogRowStale = (row: EphemeraCacheCatalogRow): boolean =>
    row.hydratedCatalogVersion < row.catalogVersion

export const catalogRowMatchesEditAssetId = (
    row: Pick<EphemeraCacheCatalogRow, 'assetStack'>,
    editAssetId: AssetUUID
): boolean => assetStackIncludesEditAssetId(row.assetStack, editAssetId)

/** V2: authoritative CACHE# row for display/exact-match at current catalog epoch. */
export const isAuthoritativeCacheRow = (
    row: Pick<EphemeraCacheDynamoItem, 'catalogVersion'>,
    catalogRow: Pick<EphemeraCacheCatalogRow, 'catalogVersion'>
): boolean => cacheRowCatalogVersion(row) === catalogRow.catalogVersion

export const canUpsertCacheRowAtHydrate = (
    existingVersion: number | undefined,
    incomingCatalogVersion: number
): boolean => (existingVersion ?? 0) < incomingCatalogVersion

export const canDeleteCacheRowOnHydrate = canUpsertCacheRowAtHydrate

/** H6: write hydratedCatalogVersion only if catalogVersion unchanged since hydrate start. */
export const shouldWriteHydratedCatalogVersion = (
    incomingCatalogVersion: number,
    currentCatalogVersionAtEnd: number
): boolean => incomingCatalogVersion === currentCatalogVersionAtEnd
