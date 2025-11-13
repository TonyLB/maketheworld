// Player Data Source Slice
//
// This slice manages subscriptions to the mtw.assets.players data source.
// It uses the generic createDataSourceSlice pattern to get proper out-of-order
// event handling, event caching, and timestamp-based re-aggregation.

import { createDataSourceSlice } from '../dataSource'
import {
  PlayerAggregator,
  PlayerEventSerializer,
  PlayerEventUpdate,
  PlayerSnapshot,
  PlayerSnapshotExternal,
  PlayerExternal,
  isPlayerSnapshot,
  isPlayerSettingsUpdated,
  isPlayerAssetAssigned,
  isPlayerAssetRemoved,
  isPlayerCharacterAssigned,
  isPlayerCharacterRemoved
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'

// Type guards for the slice
// These distinguish between snapshot and update events in the internal format
export const isPlayerDataSourceSnapshot = (
  event: PlayerSnapshot | PlayerEventUpdate
): event is PlayerSnapshot => {
  return isPlayerSnapshot(event)
}

export const isPlayerDataSourceUpdate = (
  event: PlayerSnapshot | PlayerEventUpdate
): event is PlayerEventUpdate => {
  return !isPlayerSnapshot(event)
}

// Create the slice using the generic factory
export const {
  slice: playerDataSourceSlice,
  selectors: playerDataSourceSelectors,
  publicActions: playerDataSourceActions,
  iterateAllSSMs: iteratePlayerDataSource,
  subscribeToStreams: subscribeToPlayerDataSource,
  unsubscribeFromStreams: unsubscribeFromPlayerDataSource
} = createDataSourceSlice({
  name: 'playerDataSource',
  dataSourceKey: 'mtw.assets.players',
  aggregator: new PlayerAggregator(),
  eventSerializer: new PlayerEventSerializer(),
  isSnapshot: isPlayerDataSourceSnapshot,
  isUpdate: isPlayerDataSourceUpdate,
  sliceSelector: (state: any) => state.playerDataSource
})

// Re-export for convenience
export const {
  getActiveStreamKeys,
  getSubscribedStreams
} = playerDataSourceSelectors

export const {
  processRawSnapshot,
  processRawEvent
} = playerDataSourceActions

