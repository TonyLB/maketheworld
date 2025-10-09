import { DataSourceAction } from './baseClasses'
import { socketDispatchPromise } from '../lifeLine'
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
// Factory function to create subscribe action for a specific data source
// Takes the dataSourceKey and eventType to configure the subscription
//
// NOTE: This currently uses the legacy subscriptions API format that requires:
//   - `type` parameter (eventType) - will be removed in Phase 3 refactor
//   - Single `streamKey` per call - will become `streamKeys: string[]` array
// After Phase 3 (subscriptions lambda refactor), this will be simplified to:
//   dispatch(socketDispatchPromise({
//     message: 'subscribe',
//     dataSourceKey,
//     streamKeys: pendingStreamKeys  // Array of keys in single call
//   }, { service: 'subscriptions' }))
//
export const createSubscribeAction = <SnapshotPayload, UpdatePayload>(
    dataSourceKey: string,
    eventType: string,  // TODO: Remove after Phase 3 - no longer needed with granular DataSources
    createEmptyView: () => SnapshotPayload
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch) => {
        const { pendingStreamKeys } = internalData
        
        if (!pendingStreamKeys || pendingStreamKeys.length === 0) {
            return { internalData, publicData }
        }
        
        try {
            // Subscribe to each stream key via the subscriptions API
            // TODO Phase 3: Replace with single call accepting streamKeys array
            await Promise.all(
                pendingStreamKeys.map((streamKey) =>
                    dispatch(socketDispatchPromise({
                        message: 'subscribe',
                        dataSourceKey,
                        type: eventType,  // TODO Phase 3: Remove this parameter
                        streamKey  // TODO Phase 3: This becomes streamKeys array at top level
                    }, { service: 'subscriptions' }))
                )
            )
            
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
// Takes the dataSourceKey and eventType to configure the unsubscription
//
// NOTE: Same legacy API format as subscribe - will be simplified in Phase 3
//
export const createUnsubscribeAction = <SnapshotPayload, UpdatePayload>(
    dataSourceKey: string,
    eventType: string,  // TODO: Remove after Phase 3 - no longer needed with granular DataSources
): DataSourceAction<SnapshotPayload, UpdatePayload> => {
    return ({ internalData, publicData }) => async (dispatch) => {
        const { pendingStreamKeys } = internalData
        
        if (!pendingStreamKeys || pendingStreamKeys.length === 0) {
            return { internalData, publicData }
        }
        
        try {
            // Unsubscribe from each stream key via the subscriptions API
            // TODO Phase 3: Replace with single call accepting streamKeys array
            await Promise.all(
                pendingStreamKeys.map((streamKey) =>
                    dispatch(socketDispatchPromise({
                        message: 'unsubscribe',
                        dataSourceKey,
                        type: eventType,  // TODO Phase 3: Remove this parameter
                        streamKey  // TODO Phase 3: This becomes streamKeys array at top level
                    }, { service: 'subscriptions' }))
                )
            )
            
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


