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
  sliceSelector: (state: any) => state.wmlDataSource
})

export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = wmlDataSourceSelectors

export const {
  processRawEnvelope
} = wmlDataSourceActions

export * from './selectors'
