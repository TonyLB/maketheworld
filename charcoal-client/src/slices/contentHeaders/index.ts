// ContentHeaders Data Source Slice
//
// This slice manages subscriptions to the mtw.assets.contentHeaders data source.
// Currently subscribes only to the 'global' stream key.

import { createDataSourceSlice } from '../dataSource'
import {
  ContentHeadersAggregator,
  ContentHeadersEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'

// Create the slice using the generic factory
export const {
  slice: contentHeadersSlice,
  selectors: contentHeadersSelectors,
  publicActions: contentHeadersActions,
  iterateAllSSMs: iterateContentHeaders,
  subscribeToStreams: subscribeToContentHeaders,
  unsubscribeFromStreams: unsubscribeFromContentHeaders
} = createDataSourceSlice({
  name: 'contentHeaders',
  dataSourceKey: 'mtw.assets.contentHeaders',
  aggregator: new ContentHeadersAggregator(),
  eventSerializer: new ContentHeadersEventSerializer(),
  sliceSelector: (state: any) => state.contentHeaders
})

// Re-export for convenience
export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = contentHeadersSelectors

export const {
  processRawEnvelope
} = contentHeadersActions

// Export selectors
export * from './selectors'
