import { singleSSM } from '../stateSeekingMachine/singleSSM'
import { DataSourceNodes, DataSourcePublic, DataSourceInternal, DataSourceData } from './baseClasses'
import { backoffAction, createSubscribeAction, createUnsubscribeAction, createInitializeAction, lifelineCondition } from './index.api'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import type { DataSourceEventSerializer, EventPayload, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { applyEvents, performCleanup, processRawSnapshot, processRawEvent } from './reducers'

//
// Configuration interface for creating a data source slice
//
export interface DataSourceSliceConfig<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    ExternalUpdatePayload extends EventPayload = any,
    ExternalSnapshotPayload extends SerializableObject = any
> {
    name: string                          // Slice name (e.g., 'contentHeaders')
    dataSourceKey: string                 // DataSource key (e.g., 'mtw.assets.contentHeaders')
    aggregator: DataSourceAggregator<SnapshotPayload, UpdatePayload>  // Aggregator for combining events
    eventSerializer: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload>  // Serializer for deserialization
    isSnapshot: (event: UpdatePayload | SnapshotPayload) => event is SnapshotPayload  // Type guard to identify snapshot events
    isUpdate: (event: UpdatePayload | SnapshotPayload) => event is UpdatePayload  // Type guard to identify update events
    sliceSelector: (state: any) => any    // Selector to access this slice in Redux store
    promiseCache?: PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>  // Optional promise cache for state machine coordination
    onReady?: (dispatch: any, getState: any) => void  // Optional callback when slice reaches READY state (after INITIALIZE completes)
}

//
// Factory function to create a data source slice using singleSSM
// This creates a complete state machine for managing subscriptions to a specific data source
//
export const createDataSourceSlice = <
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    ExternalUpdatePayload extends EventPayload = any,
    ExternalSnapshotPayload extends SerializableObject = any
>(
    config: DataSourceSliceConfig<SnapshotPayload, UpdatePayload, ExternalUpdatePayload, ExternalSnapshotPayload>
) => {
    const { name, dataSourceKey, aggregator, eventSerializer, isSnapshot, isUpdate, sliceSelector, promiseCache: providedPromiseCache } = config

    // Create a promise cache if one wasn't provided
    const promiseCache = providedPromiseCache ?? new PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>()

    // We'll create the initialize action after we have access to the public action creators
    // This is necessary because the initialize action needs to dispatch processRawSnapshot and processRawEvent
    let initializeAction: ReturnType<typeof createInitializeAction<SnapshotPayload, UpdatePayload>>

    // Create the subscribe and unsubscribe actions using factories
    const subscribeAction = createSubscribeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey,
        () => aggregator.createEmpty()
    )
    const unsubscribeAction = createUnsubscribeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey
    )

    // Define the state machine template
    const template = {
        initialState: 'INITIAL' as const,
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
            INITIAL: {
                stateType: 'HOLD' as const,
                next: 'INITIALIZE' as const,
                condition: lifelineCondition  // Wait for LifeLine to be CONNECTED
            },
            INITIALIZE: {
                stateType: 'ATTEMPT' as const,
                get action() {
                    // Lazy initialization - will be set after we create the slice
                    return initializeAction
                },
                resolve: 'READY' as const,
                reject: 'INITIALIZEERROR' as const
            },
            INITIALIZEERROR: {
                stateType: 'CHOICE' as const,
                choices: []  // Terminal state - local infrastructure failure
            },
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

    // Create curried helper functions from reducers.ts
    const applyEventsWithAggregator = applyEvents(aggregator)
    const performCleanupWithConfig = performCleanup(aggregator, isSnapshot, isUpdate, applyEventsWithAggregator)
    
    // Create the slice using singleSSM
    const result = singleSSM<DataSourceNodes<SnapshotPayload, UpdatePayload>, {
        getActiveStreamKeys: (state: DataSourcePublic<SnapshotPayload, UpdatePayload>) => string[]
        getSubscribedStreams: (state: DataSourcePublic<SnapshotPayload, UpdatePayload>) => DataSourcePublic<SnapshotPayload, UpdatePayload>['subscribedStreams']
    }>({
        name,
        initialSSMState: 'INITIAL',
        initialSSMDesired: ['READY'],  // Desired state is READY (will auto-transition through INITIAL → INITIALIZE)
        initialData: template.initialData,
        sliceSelector,
        promiseCache,
        publicReducers: {
            // Process incoming snapshot event
            processRawSnapshot: processRawSnapshot(
                dataSourceKey,
                eventSerializer,
                isUpdate,
                performCleanupWithConfig,
                applyEventsWithAggregator
            ),
            
            // Process incoming update event
            processRawEvent: processRawEvent(
                dataSourceKey,
                eventSerializer,
                aggregator,
                isSnapshot,
                isUpdate,
                performCleanupWithConfig,
                applyEventsWithAggregator
            )
        },
        publicSelectors: {
            getActiveStreamKeys: (state) => state.activeStreamKeys,
            getSubscribedStreams: (state) => state.subscribedStreams
        },
        template
    })

    // Now that we have the result with publicActions, create the initialize action
    // This needs to be done after singleSSM call because we need access to the action creators
    initializeAction = createInitializeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey,
        result.publicActions.processRawSnapshot,
        result.publicActions.processRawEvent,
        config.onReady
    )

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

