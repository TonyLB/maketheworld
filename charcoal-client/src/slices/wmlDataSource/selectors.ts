import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { getConfirmedRequestIds } from './index'

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

/**
 * Confirmed applyEdit RequestIds for an asset (stream key), with 5m selector TTL.
 * Cross-slice consumers (e.g. personalAssets getEffectivePendingEdits) should use this,
 * not raw confirmedRequestIds storage.
 */
export function getWMLConfirmedRequestIds(
  state: any,
  assetId: string,
  now?: number
): string[] {
  return getConfirmedRequestIds(state, assetId, now)
}
