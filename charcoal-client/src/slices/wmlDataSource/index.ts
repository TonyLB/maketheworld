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

export type GetConfirmedRequestIds = (
  state: any,
  streamKey: string,
  now?: number
) => string[]

// Create the slice using the generic factory
const wmlDataSourceFactory = createDataSourceSlice({
  name: 'wmlDataSource',
  dataSourceKey: 'mtw.wml',
  aggregator: new WMLAggregator(),
  eventSerializer: new WMLDataSourceEventSerializer(createBrowserDataSourceEnvironment()),
  sliceSelector: (state: any) => state.wmlDataSource,
  requestIdTracking: { headerField: 'RequestIds' }
})

export const {
  slice: wmlDataSourceSlice,
  selectors: wmlDataSourceSelectors,
  publicActions: wmlDataSourceActions,
  iterateAllSSMs: iterateWmlDataSource,
  subscribeToStreams: subscribeToWmlDataSource,
  unsubscribeFromStreams: unsubscribeFromWmlDataSource
} = wmlDataSourceFactory

const factoryGetConfirmedRequestIds = wmlDataSourceFactory.getConfirmedRequestIds
if (!factoryGetConfirmedRequestIds) {
  throw new Error('wmlDataSource: getConfirmedRequestIds requires requestIdTracking')
}
export const getConfirmedRequestIds: GetConfirmedRequestIds = factoryGetConfirmedRequestIds

export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = wmlDataSourceSelectors

export const {
  processEnvelope
} = wmlDataSourceActions

export * from './selectors'
