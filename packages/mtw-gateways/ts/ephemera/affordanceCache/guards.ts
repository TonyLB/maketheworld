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

/** Legacy version-only check (render CACHE# child rows). Do not use for colocated Affordance:: rows. */
export const canUpsertAffordanceRowAtHydrate = (
    existingVersion: number | undefined,
    incomingCatalogVersion: number
): boolean => (existingVersion ?? 0) < incomingCatalogVersion

/**
 * Colocated Affordance:: topology persist: allow when incoming epoch is current and the row is
 * still stale (first hydrate at catalogVersion 1), or when catalog lags incoming.
 */
export const shouldPersistAffordanceTopologyAtHydrate = (
    existing: AffordanceCacheRow | undefined,
    incomingCatalogVersion: number
): boolean => {
    if (existing === undefined) {
        return true
    }
    if (existing.catalogVersion > incomingCatalogVersion) {
        return false
    }
    if (existing.catalogVersion < incomingCatalogVersion) {
        return true
    }
    return isCatalogRowStale(existing)
}

/** H6: write hydratedCatalogVersion only if catalogVersion unchanged since hydrate start. */
export const shouldWriteHydratedCatalogVersion = (
    incomingCatalogVersion: number,
    currentCatalogVersionAtEnd: number
): boolean => incomingCatalogVersion === currentCatalogVersionAtEnd
