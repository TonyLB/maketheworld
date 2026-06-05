import { createSelector } from '@reduxjs/toolkit'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { storedConfirmedRequestIdStrings } from '../dataSource'

/**
 * Get the materialized WML view (base) for a given asset from the WML dataSource slice.
 * Returns undefined if the asset is not subscribed or no snapshot has been applied yet.
 * Used when personalAssets derives base from dataSource (post-refactor).
 */
export function getWMLBase(state: any, assetId: string): StandardFormData | undefined {
  const streams = state?.wmlDataSource?.publicData?.subscribedStreams
  return streams?.[assetId]?.materializedView
}

/**
 * Get the materialized WML view for a given asset as a StandardForm.
 * Returns undefined if the asset is not subscribed, no snapshot has been applied yet,
 * or the stored materializedView cannot be converted.
 */
export function getWMLBaseStandardForm(state: any, assetId: string): StandardForm | undefined {
  const base = getWMLBase(state, assetId)
  if (!base) {
    return undefined
  }
  try {
    return new StandardForm(base)
  } catch {
    return undefined
  }
}

const selectWMLConfirmedRequestIdRows = (state: any, assetId: string) =>
  state?.wmlDataSource?.publicData?.subscribedStreams?.[assetId]?.confirmedRequestIds

/**
 * Confirmed applyEdit RequestIds for an asset (stream key), derived from storage.
 * Cross-slice consumers (e.g. personalAssets getEffectivePendingEdits) should use this,
 * not raw confirmedRequestIds storage. TTL eviction is dispatched cleanup, not selector-time.
 */
export const getWMLConfirmedRequestIds = createSelector(
  [selectWMLConfirmedRequestIdRows],
  (rows) => storedConfirmedRequestIdStrings(rows)
)
