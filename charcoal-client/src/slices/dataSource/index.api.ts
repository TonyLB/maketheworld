import { DataSourceAction } from './baseClasses'
import { socketDispatchPromise, LifeLinePubSub, getStatus } from '../lifeLine'
import delayPromise from '../../lib/delayPromise'
import { ISSMHoldCondition } from '../stateSeekingMachine/baseClasses'
import { DataSourceInternal, DataSourcePublic } from './baseClasses'

//
// Condition to check if LifeLine is connected
// DataSource slices should wait for LifeLine to be CONNECTED before initializing
//
export const lifelineCondition: ISSMHoldCondition<DataSourceInternal, DataSourcePublic<any, any>> = (_, getState: any) => {
    const status = getStatus(getState())
    return (status === 'CONNECTED')
}

//
// Generic backoff action for all data sources
// Uses exponential backoff with a maximum of 30 seconds
//
export const backoffAction: DataSourceAction<any, any> = ({ internalData: { incrementalBackoff = 0.5 }}) => async (dispatch) => {
    if (incrementalBackoff >= 30) {
        throw new Error('Max backoff reached')
    }
    await delayPromise(incrementalBackoff * 1000)
    return { internalData: { incrementalBackoff: Math.min(incrementalBackoff * 2, 30) } }
}

//
// Factory function to create initialize action for a specific data source
// Sets up LifeLinePubSub subscription to route incoming events to the data source
//
export const createInitializeAction = <SnapshotPayload, UpdatePayload>(
    dataSourceKey: string,
    processRawSnapshot: (payload: { streamKey: string; timestamp: number; rawSnapshot: any }) => any,
    processRawEvent: (payload: { streamKey: string; timestamp: number; rawEvent: any }) => any,
    onReady?: (dispatch: any, getState: any, sliceActions: any) => void,
    sliceSelector?: (state: any) => any
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch, getState) => {
        try {
            // Subscribe to LifeLinePubSub to receive incoming WebSocket messages
            const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
                // Filter for StreamEvent messages from this data source
                if (payload.messageType === 'StreamEvent' && payload.dataSourceKey === dataSourceKey) {
                    const { streamKey, timestamp, update } = payload
                    
                    // Route to appropriate processor based on message type
                    if (update.type === 'Snapshot Generated') {
                        dispatch(processRawSnapshot({ streamKey, timestamp, rawSnapshot: update }))
                    } else {
                        // All other update types are events
                        dispatch(processRawEvent({ streamKey, timestamp, rawEvent: update }))
                    }
                }
            })
            
            // Call onReady callback if provided (after successful initialization)
            // The wrapper in createDataSourceSlice provides sliceActions as the third parameter
            if (onReady) {
                // The wrapper will provide the actual sliceActions - we just need to call it
                // The third parameter will be replaced by the wrapper
                onReady(dispatch, getState, {} as any)  // Placeholder - wrapper replaces this with actual sliceActions
            }
            
            // After onReady may have queued subscriptions, read the current state to preserve any changes
            // The onReady callback may have dispatched internalStateChange to queue subscriptions,
            // and we need to preserve those in our return value to avoid overwriting them
            let currentInternalData = internalData
            if (sliceSelector && onReady) {
                // Read the current slice state to get any changes made by onReady
                const currentState = getState()
                const sliceState = sliceSelector(currentState)
                if (sliceState?.internalData) {
                    // Preserve subscribeStreamKeys and unsubscribeStreamKeys that may have been queued by onReady
                    currentInternalData = {
                        ...internalData,
                        subscribeStreamKeys: sliceState.internalData.subscribeStreamKeys || internalData.subscribeStreamKeys || [],
                        unsubscribeStreamKeys: sliceState.internalData.unsubscribeStreamKeys || internalData.unsubscribeStreamKeys || []
                    }
                }
            }
            
            return {
                internalData: {
                    ...currentInternalData,
                    lifeLineSubscription
                },
                publicData
            }
        } catch (error) {
            // Critical infrastructure failure - cannot proceed without LifeLinePubSub
            throw new Error(`Failed to initialize LifeLinePubSub subscription: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
}

//
// Factory function to create subscribe action for a specific data source
// Takes the dataSourceKey and aggregator to configure the subscription
//
export const createSubscribeAction = <SnapshotPayload, UpdatePayload>(
    dataSourceKey: string,
    createEmptyView: () => SnapshotPayload
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch) => {
        const { subscribeStreamKeys, lifeLineSubscription } = internalData
        
        // Safety check: Ensure INITIALIZE has completed before attempting backend subscription
        if (!lifeLineSubscription) {
            throw new Error(`[${dataSourceKey}] Cannot subscribe to backend before INITIALIZE completes (LifeLinePubSub not set up)`)
        }
        
        if (!subscribeStreamKeys || subscribeStreamKeys.length === 0) {
            return { internalData, publicData }
        }
        
        try {
            // Subscribe to stream keys via the subscriptions API (single batch call)
            await dispatch(socketDispatchPromise({
                message: 'subscribe',
                dataSourceKey,
                streamKeys: subscribeStreamKeys  // Array of stream keys in single call
            }, { service: 'subscriptions' }))
            
            // Initialize empty views for new streams and add to active list
            const newSubscribedStreams = { ...publicData.subscribedStreams }
            const newActiveStreamKeys = [...(publicData.activeStreamKeys ?? [])]
            
            subscribeStreamKeys.forEach(streamKey => {
                if (!newSubscribedStreams[streamKey]) {
                    newSubscribedStreams[streamKey] = {
                        materializedView: createEmptyView(),
                        recentEvents: []
                    }
                }
                if (!newActiveStreamKeys.includes(streamKey)) {
                    newActiveStreamKeys.push(streamKey)
                }
            })
            
            return {
                internalData: { 
                    ...internalData, 
                    subscribeStreamKeys: [],  // Clear the queue on success
                    incrementalBackoff: 0.5  // Reset backoff on success
                },
                publicData: { 
                    ...publicData, 
                    subscribedStreams: newSubscribedStreams,
                    activeStreamKeys: newActiveStreamKeys
                }
            }
        } catch (error) {
            return {
                internalData: { 
                    ...internalData, 
                    error: error instanceof Error ? error.message : 'Subscription failed'
                },
                publicData
            }
        }
    }
}

//
// Factory function to create unsubscribe action for a specific data source
// Takes the dataSourceKey to configure the unsubscription
//
export const createUnsubscribeAction = <SnapshotPayload, UpdatePayload>(
    dataSourceKey: string
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch) => {
        const { unsubscribeStreamKeys, lifeLineSubscription } = internalData
        
        // Safety check: Ensure INITIALIZE has completed before attempting backend unsubscription
        if (!lifeLineSubscription) {
            throw new Error(`[${dataSourceKey}] Cannot unsubscribe from backend before INITIALIZE completes (LifeLinePubSub not set up)`)
        }
        
        if (!unsubscribeStreamKeys || unsubscribeStreamKeys.length === 0) {
            return { internalData, publicData }
        }
        
        try {
            // Unsubscribe from stream keys via the subscriptions API (single batch call)
            await dispatch(socketDispatchPromise({
                message: 'unsubscribe',
                dataSourceKey,
                streamKeys: unsubscribeStreamKeys  // Array of stream keys in single call
            }, { service: 'subscriptions' }))
            
            // Remove streams from active list (but keep data structure for async events)
            const newActiveStreamKeys = (publicData.activeStreamKeys ?? []).filter(
                key => !unsubscribeStreamKeys.includes(key)
            )
            
            return {
                internalData: { 
                    ...internalData, 
                    unsubscribeStreamKeys: [],  // Clear the queue on success
                    incrementalBackoff: 0.5  // Reset backoff on success
                },
                publicData: { 
                    ...publicData,
                    activeStreamKeys: newActiveStreamKeys
                }
            }
        } catch (error) {
            return {
                internalData: { 
                    ...internalData, 
                    error: error instanceof Error ? error.message : 'Unsubscription failed'
                },
                publicData
            }
        }
    }
}


