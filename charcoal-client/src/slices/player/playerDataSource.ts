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
  isPlayerSnapshot
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import { getPlayerName } from '../settings'
import type { DataSourceInternal, DataSourcePublic } from '../dataSource/baseClasses'
import type { ISSMHoldCondition } from '../stateSeekingMachine/baseClasses'

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

// Hold condition: Wait for PlayerName to be populated from SessionInitialized message
// This ensures we can subscribe with the actual player name instead of 'self'
const playerNameHoldCondition: ISSMHoldCondition<DataSourceInternal, DataSourcePublic<PlayerSnapshot, PlayerEventUpdate>> = (_, getState) => {
  const playerName = getPlayerName(getState())
  return playerName !== ''
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
  sliceSelector: (state: any) => state.playerDataSource,
  holdCondition: playerNameHoldCondition  // Wait for PlayerName before initializing
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

