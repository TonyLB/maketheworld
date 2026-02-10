import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'

/**
 * Get the materialized WML view (base) for a given asset from the WML dataSource slice.
 * Returns undefined if the asset is not subscribed or no snapshot has been applied yet.
 * Used when personalAssets derives base from dataSource (post-refactor).
 */
export function getWMLBase(state: any, assetId: string): StandardFormData | undefined {
  const streams = state.wmlDataSource?.publicData?.subscribedStreams
  return streams?.[assetId]?.materializedView
}
