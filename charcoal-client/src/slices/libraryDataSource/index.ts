// LibraryDataSource Slice
//
// This slice manages subscriptions to the mtw.assets.library data source.
// Subscribes to the 'global' stream to receive library zone asset IDs.

import { createDataSourceSlice } from '../dataSource'
import {
  LibraryAggregator,
  LibraryEventSerializer,
  LibraryEventUpdate,
  LibrarySnapshot,
  LibraryExternal,
  LibrarySnapshotExternal,
  isLibrarySnapshot,
  isLibraryUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/library'

// Type guards for the slice
// These distinguish between snapshot and update events in the internal format
export const isSnapshot = (
  event: LibrarySnapshot | LibraryEventUpdate
): event is LibrarySnapshot => {
  return isLibrarySnapshot(event)
}

export const isUpdate = (
  event: LibrarySnapshot | LibraryEventUpdate
): event is LibraryEventUpdate => {
  return isLibraryUpdate(event)
}

// Create the slice using the generic factory
export const {
  slice: libraryDataSourceSlice,
  selectors: libraryDataSourceSelectors,
  publicActions: libraryDataSourceActions,
  iterateAllSSMs: iterateLibraryDataSource,
  subscribeToStreams: subscribeToLibraryDataSource,
  unsubscribeFromStreams: unsubscribeFromLibraryDataSource
} = createDataSourceSlice({
  name: 'libraryDataSource',
  dataSourceKey: 'mtw.assets.library',
  aggregator: new LibraryAggregator(),
  eventSerializer: new LibraryEventSerializer(),
  isSnapshot,
  isUpdate,
  sliceSelector: (state: any) => state.libraryDataSource
})

// Helper functions for subscribing to the global library stream
export const subscribeToLibrary = () => {
  return subscribeToLibraryDataSource(['global'])
}

export const unsubscribeFromLibrary = () => {
  return unsubscribeFromLibraryDataSource(['global'])
}

// Re-export selectors for convenience
export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = libraryDataSourceSelectors

export const {
  processRawSnapshot,
  processRawEvent
} = libraryDataSourceActions

// Selector to get library asset IDs from the global stream
export const getLibraryAssetIds = (state: any): string[] => {
  const streams = libraryDataSourceSelectors.getSubscribedStreams(state)
  const globalStream = streams['global']
  return globalStream?.materializedView?.assetIds || []
}

// Selector to check if we're already subscribed to library
export const getIsLibrarySubscribed = (state: any): boolean => {
  const activeStreamKeys = libraryDataSourceSelectors.getActiveStreamKeys(state)
  return activeStreamKeys.includes('global')
}

