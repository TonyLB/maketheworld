import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { assetStackIncludesEditAssetId } from '../../assets/components/componentExamples'

import type { AffordanceCacheRow } from './types'

/** M4: bump catalogVersion only when the row was ready (not already stale). */
export const shouldIncrementCatalogVersionOnInvalidation = (row: AffordanceCacheRow): boolean =>
    row.hydratedCatalogVersion === row.catalogVersion

export const isCatalogRowStale = (row: AffordanceCacheRow): boolean =>
    row.hydratedCatalogVersion < row.catalogVersion

export const isCatalogRowHydrated = (row: AffordanceCacheRow): boolean =>
    row.hydratedCatalogVersion === row.catalogVersion

export const catalogRowMatchesEditAssetId = (
    row: Pick<AffordanceCacheRow, 'assetStack'>,
    editAssetId: AssetUUID
): boolean => assetStackIncludesEditAssetId(row.assetStack, editAssetId)

/** Serve topology only when catalog epoch is fully hydrated. */
export const isAuthoritativeAffordanceRow = (row: AffordanceCacheRow): boolean =>
    isCatalogRowHydrated(row)

export const canUpsertAffordanceRowAtHydrate = (
    existingVersion: number | undefined,
    incomingCatalogVersion: number
): boolean => (existingVersion ?? 0) < incomingCatalogVersion

/** H6: write hydratedCatalogVersion only if catalogVersion unchanged since hydrate start. */
export const shouldWriteHydratedCatalogVersion = (
    incomingCatalogVersion: number,
    currentCatalogVersionAtEnd: number
): boolean => incomingCatalogVersion === currentCatalogVersionAtEnd
