import { singleSSM } from '../stateSeekingMachine/singleSSM'
import { DataSourceNodes, DataSourcePublic, DataSourceInternal, DataSourceData } from './baseClasses'
import { backoffAction, createSubscribeAction, createUnsubscribeAction } from './index.api'
import { PayloadAction } from '@reduxjs/toolkit'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'

//
// Configuration interface for creating a data source slice
//
export interface DataSourceSliceConfig<SnapshotPayload, UpdatePayload> {
    name: string                          // Slice name (e.g., 'contentHeaders')
    dataSourceKey: string                 // DataSource key (e.g., 'mtw.assets.contentHeaders')
    eventType: string                     // Event type for subscriptions (legacy API, will be removed in Phase 3)
    createEmptyView: () => SnapshotPayload  // Function to create empty materialized view
    sliceSelector: (state: any) => any    // Selector to access this slice in Redux store
    promiseCache?: PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>  // Optional promise cache for state machine coordination
}

//
// Factory function to create a data source slice using singleSSM
// This creates a complete state machine for managing subscriptions to a specific data source
//
export const createDataSourceSlice = <SnapshotPayload, UpdatePayload>(
    config: DataSourceSliceConfig<SnapshotPayload, UpdatePayload>
) => {
    const { name, dataSourceKey, eventType, createEmptyView, sliceSelector, promiseCache: providedPromiseCache } = config

    // Create a promise cache if one wasn't provided
    const promiseCache = providedPromiseCache ?? new PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>()

    // Create the subscribe and unsubscribe actions using factories
    const subscribeAction = createSubscribeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey,
        eventType,
        createEmptyView
    )
    const unsubscribeAction = createUnsubscribeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey,
        eventType
    )

    // Define the state machine template
    const template = {
        initialState: 'READY' as const,
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                activeStreamKeys: [],
                subscribedStreams: {}
            }
        },
        states: {
            READY: {
                stateType: 'CHOICE' as const,
                choices: ['SUBSCRIBE' as const]
            },
            SUBSCRIBE: {
                stateType: 'ATTEMPT' as const,
                action: subscribeAction,
                resolve: 'SUBSCRIBED' as const,
                reject: 'SUBSCRIBEBACKOFF' as const
            },
            SUBSCRIBEBACKOFF: {
                stateType: 'ATTEMPT' as const,
                action: backoffAction,
                resolve: 'SUBSCRIBE' as const,
                reject: 'SUBSCRIBEERROR' as const
            },
            SUBSCRIBEERROR: {
                stateType: 'CHOICE' as const,
                choices: []
            },
            SUBSCRIBED: {
                stateType: 'CHOICE' as const,
                choices: ['UNSUBSCRIBE' as const]
            },
            UNSUBSCRIBE: {
                stateType: 'ATTEMPT' as const,
                action: unsubscribeAction,
                resolve: 'SUBSCRIBED' as const,
                reject: 'UNSUBSCRIBEBACKOFF' as const
            },
            UNSUBSCRIBEBACKOFF: {
                stateType: 'ATTEMPT' as const,
                action: backoffAction,
                resolve: 'UNSUBSCRIBE' as const,
                reject: 'SUBSCRIBEERROR' as const
            }
        }
    }

    // Create the slice using singleSSM
    const result = singleSSM<DataSourceNodes<SnapshotPayload, UpdatePayload>, {
        getActiveStreamKeys: (state: DataSourcePublic<SnapshotPayload, UpdatePayload>) => string[]
        getSubscribedStreams: (state: DataSourcePublic<SnapshotPayload, UpdatePayload>) => DataSourcePublic<SnapshotPayload, UpdatePayload>['subscribedStreams']
    }>({
        name,
        initialSSMState: 'READY',
        initialSSMDesired: ['READY'],
        initialData: template.initialData,
        sliceSelector,
        promiseCache,
        publicReducers: {
            // Phase 1: Stubbed event processing reducers
            // These will be fully implemented in Phase 5 after subscriptions lambda refactor
            processRawSnapshot: (record) => (
                state: any,
                action: PayloadAction<{ streamKey: string; rawSnapshot: any }>
            ) => {
                // TODO Phase 5: Implement full snapshot processing
                // - Deserialize using serializer
                // - Update materializedView
                // - Add to recentEvents
                console.log(`[${dataSourceKey}] processRawSnapshot stubbed for streamKey: ${action.payload.streamKey}`)
                return state
            },
            processRawEvent: (record) => (
                state: any,
                action: PayloadAction<{ streamKey: string; rawEvent: any }>
            ) => {
                // TODO Phase 5: Implement full event processing
                // - Deserialize using serializer
                // - Apply to materializedView using aggregator
                // - Add to recentEvents (with 30-second window)
                // - Handle out-of-order events
                console.log(`[${dataSourceKey}] processRawEvent stubbed for streamKey: ${action.payload.streamKey}`)
                return state
            }
        },
        publicSelectors: {
            getActiveStreamKeys: (state) => state.activeStreamKeys,
            getSubscribedStreams: (state) => state.subscribedStreams
        },
        template
    })

    return result
}

//
// Helper function to trigger subscription to stream keys
// Usage: dispatch(subscribeToStreams(streamKeys))
//
export const createSubscriptionHelper = (sliceActions: any) => {
    return (streamKeys: string[]) => (dispatch: any) => {
        // Store pending stream keys in internal state
        dispatch(sliceActions.internalStateChange({
            newState: 'SUBSCRIBE',
            data: {
                internalData: { pendingStreamKeys: streamKeys }
            }
        }))
        // Set intent to SUBSCRIBED
        dispatch(sliceActions.setIntent(['SUBSCRIBED']))
        // Trigger state machine iteration
        dispatch(heartbeat)
    }
}

//
// Helper function to trigger unsubscription from stream keys
// Usage: dispatch(unsubscribeFromStreams(streamKeys))
//
export const createUnsubscriptionHelper = (sliceActions: any) => {
    return (streamKeys: string[]) => (dispatch: any) => {
        // Store pending stream keys in internal state
        dispatch(sliceActions.internalStateChange({
            newState: 'UNSUBSCRIBE',
            data: {
                internalData: { pendingStreamKeys: streamKeys }
            }
        }))
        // Set intent to SUBSCRIBED (will return to SUBSCRIBED after unsubscribe)
        dispatch(sliceActions.setIntent(['SUBSCRIBED']))
        // Trigger state machine iteration
        dispatch(heartbeat)
    }
}

