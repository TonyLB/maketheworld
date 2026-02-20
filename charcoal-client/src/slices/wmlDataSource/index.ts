// WML Data Source Slice
//
// This slice manages subscriptions to the mtw.wml data source. It owns the canonical
// backend WML view (materializedView) per subscribed asset. Initial state comes from
// Snapshot events (sidecar URL); Content Update and Merge Conflict events update the view.

import { createDataSourceSlice, createBrowserDataSourceEnvironment } from '../dataSource'
import {
  WMLAggregator,
  WMLDataSourceEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

/**
 * Resolve sidecar snapshot: fetch WML from presigned URL and return it as WML text payload.
 * The slice passes this to processRawEnvelope; WMLDataSourceEventSerializer.deserializeSnapshot
 * parses the WML into StandardForm and converts to StandardFormData before storing in Redux.
 * Exported for testing.
 */
export async function resolveSidecarSnapshot(
  _streamKey: string,
  sidecarUrl: string,
  _rawSnapshot: any
): Promise<{ wml: string }> {
  const response = await fetch(sidecarUrl)
  if (!response.ok) {
    throw new Error(`[wmlDataSource] Sidecar fetch failed: ${response.status} ${response.statusText}`)
  }
  const rawWml = await response.text()
  const wml = rawWml.replace(/\r/g, '')
  return { wml }
}

// Create the slice using the generic factory
export const {
  slice: wmlDataSourceSlice,
  selectors: wmlDataSourceSelectors,
  publicActions: wmlDataSourceActions,
  iterateAllSSMs: iterateWmlDataSource,
  subscribeToStreams: subscribeToWmlDataSource,
  unsubscribeFromStreams: unsubscribeFromWmlDataSource
} = createDataSourceSlice({
  name: 'wmlDataSource',
  dataSourceKey: 'mtw.wml',
  aggregator: new WMLAggregator(),
  eventSerializer: new WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment()),
  sliceSelector: (state: any) => state.wmlDataSource,
  resolveSidecarSnapshot
})

export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = wmlDataSourceSelectors

export const {
  processRawEnvelope
} = wmlDataSourceActions

export * from './selectors'
