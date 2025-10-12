// ContentHeaders Data Source Slice
//
// This slice manages subscriptions to the mtw.assets.contentHeaders data source.
// Currently subscribes only to the 'global' stream key.

import { createDataSourceSlice } from '../dataSource'
import {
  ContentHeadersAggregator,
  ContentHeadersEventSerializer,
  ContentHeadersEventUpdate,
  ContentHeadersSnapshot,
  ContentHeadersExternal,
  ContentHeadersSnapshotExternal,
  isContentHeadersSnapshot,
  isContentHeadersUpdate,
  isZoneUpdatedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'

// Type guards for the slice
// These distinguish between different event types in the internal format
export const isSnapshot = (
  event: ContentHeadersSnapshot | ContentHeadersEventUpdate
): event is ContentHeadersSnapshot => {
  return isContentHeadersSnapshot(event)
}

export const isUpdate = (
  event: ContentHeadersSnapshot | ContentHeadersEventUpdate
): event is ContentHeadersEventUpdate => {
  return isContentHeadersUpdate(event) || isZoneUpdatedEvent(event)
}

// Create the slice using the generic factory
export const {
  slice: contentHeadersSlice,
  selectors: contentHeadersSelectors,
  publicActions: contentHeadersActions,
  iterateAllSSMs: iterateContentHeaders
} = createDataSourceSlice({
  name: 'contentHeaders',
  dataSourceKey: 'mtw.assets.contentHeaders',
  aggregator: new ContentHeadersAggregator(),
  eventSerializer: new ContentHeadersEventSerializer(),
  isSnapshot,
  isUpdate,
  sliceSelector: (state: any) => state.contentHeaders,
  // Auto-subscribe to 'global' stream when slice initializes
  onReady: (dispatch) => {
    // Set up subscription to global streamKey
    dispatch(contentHeadersSlice.actions.internalStateChange({
      newState: 'SUBSCRIBE',
      data: {
        internalData: { pendingStreamKeys: ['global'] }
      }
    }))
    dispatch(contentHeadersSlice.actions.setIntent(['SUBSCRIBED']))
    dispatch(iterateContentHeaders)
  }
})

// Re-export for convenience
export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = contentHeadersSelectors

export const {
  processRawSnapshot,
  processRawEvent
} = contentHeadersActions

