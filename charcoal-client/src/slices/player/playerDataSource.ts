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
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
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

// Auto-subscribe helper: Uses slice actions to queue a subscription
// This mimics what subscribeToStreams does, but can be called from onReady
const autoSubscribe = (dispatch: any, getState: any, sliceActions: any, streamKeys: string[]) => {
  try {
    const currentState = (getState() as any).playerDataSource
    if (!currentState) {
      console.warn('[playerDataSource] Cannot auto-subscribe: slice state not found')
      return
    }
    if (!sliceActions || !sliceActions.internalStateChange || !sliceActions.setIntent) {
      console.warn('[playerDataSource] Cannot auto-subscribe: slice actions not available', sliceActions)
      return
    }
    const existingQueue: string[] = currentState.internalData?.subscribeStreamKeys || []
    
    // Add to queue (deduplicate)
    const newQueue = [...new Set([...existingQueue, ...streamKeys])]
    
    // Update internal data with new queue
    dispatch(sliceActions.internalStateChange({
      newState: currentState.meta.currentState,  // Don't change state
      data: {
        internalData: { ...currentState.internalData, subscribeStreamKeys: newQueue }
      }
    }))
    // Set intent to SUBSCRIBED - state machine will transition READY -> SUBSCRIBE -> SUBSCRIBED
    dispatch(sliceActions.setIntent(['SUBSCRIBED']))
    // Trigger state machine iteration via heartbeat
    dispatch(heartbeat)
  } catch (error) {
    console.error('[playerDataSource] Error in autoSubscribe:', error)
  }
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
  holdCondition: playerNameHoldCondition,  // Wait for PlayerName before initializing
  onReady: (dispatch: any, getState: any, sliceActions: any) => {
    // Auto-subscribe when READY: Once the slice is initialized and PlayerName is available,
    // automatically subscribe to the player's own stream
    try {
      const playerName = getPlayerName(getState())
      if (playerName) {
        console.log('[playerDataSource] onReady: Auto-subscribing with playerName:', playerName)
        autoSubscribe(dispatch, getState, sliceActions, [playerName])
      } else {
        console.warn('[playerDataSource] onReady: PlayerName not available yet, skipping auto-subscribe')
      }
    } catch (error) {
      console.error('[playerDataSource] Error in onReady callback:', error)
    }
  }
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

