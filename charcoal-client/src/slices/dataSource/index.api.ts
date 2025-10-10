import { DataSourceAction } from './baseClasses'
import { socketDispatchPromise, LifeLinePubSub } from '../lifeLine'
import delayPromise from '../../lib/delayPromise'

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
    processRawSnapshot: (payload: { streamKey: string; rawSnapshot: any }) => any,
    processRawEvent: (payload: { streamKey: string; rawEvent: any }) => any
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch) => {
        try {
            // Subscribe to LifeLinePubSub to receive incoming WebSocket messages
            const lifeLineSubscription = LifeLinePubSub.subscribe(({ payload }) => {
                // Filter for subscription messages from this data source
                if (payload.messageType === 'Subscription' && payload.dataSourceKey === dataSourceKey) {
                    const { streamKey, update } = payload
                    
                    // Route to appropriate processor based on message type
                    if (update.type === 'Snapshot Generated') {
                        dispatch(processRawSnapshot({ streamKey, rawSnapshot: update }))
                    } else {
                        // All other update types are events
                        dispatch(processRawEvent({ streamKey, rawEvent: update }))
                    }
                }
            })
            
            return {
                internalData: {
                    ...internalData,
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
// Takes the dataSourceKey to configure the subscription
//
export const createSubscribeAction = <SnapshotPayload, UpdatePayload>(
    dataSourceKey: string,
    createEmptyView: () => SnapshotPayload
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch) => {
        const { pendingStreamKeys } = internalData
        
        if (!pendingStreamKeys || pendingStreamKeys.length === 0) {
            return { internalData, publicData }
        }
        
        try {
            // Subscribe to stream keys via the subscriptions API (single batch call)
            await dispatch(socketDispatchPromise({
                message: 'subscribe',
                dataSourceKey,
                streamKeys: pendingStreamKeys  // Array of stream keys in single call
            }, { service: 'subscriptions' }))
            
            // Initialize empty views for new streams and add to active list
            const newSubscribedStreams = { ...publicData.subscribedStreams }
            const newActiveStreamKeys = [...(publicData.activeStreamKeys ?? [])]
            
            pendingStreamKeys.forEach(streamKey => {
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
                    pendingStreamKeys: undefined,
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
        const { pendingStreamKeys } = internalData
        
        if (!pendingStreamKeys || pendingStreamKeys.length === 0) {
            return { internalData, publicData }
        }
        
        try {
            // Unsubscribe from stream keys via the subscriptions API (single batch call)
            await dispatch(socketDispatchPromise({
                message: 'unsubscribe',
                dataSourceKey,
                streamKeys: pendingStreamKeys  // Array of stream keys in single call
            }, { service: 'subscriptions' }))
            
            // Remove streams from active list (but keep data structure for async events)
            const newActiveStreamKeys = (publicData.activeStreamKeys ?? []).filter(
                key => !pendingStreamKeys.includes(key)
            )
            
            return {
                internalData: { 
                    ...internalData, 
                    pendingStreamKeys: undefined,
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


