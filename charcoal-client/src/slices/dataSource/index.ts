import { singleSSM } from '../stateSeekingMachine/singleSSM'
import { DataSourceNodes, DataSourcePublic, DataSourceInternal, DataSourceData, DEFAULT_DESIRABLE_MEDIAN, type RequestIdTrackingConfig } from './baseClasses'

export { createBrowserDataSourceEnvironment } from './browserEnvironment'
import { registerDeserializer, type StreamEventDeserializedPayload } from './streamEventPubSub'
import { backoffAction, createSubscribeAction, createUnsubscribeAction, createInitializeAction, lifelineCondition } from './index.api'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import type { DataSourceEventSerializer, EventPayload, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { applyEvents, performCleanup, processEnvelope, pruneStaleConfirmedRequestIds } from './reducers'
import { createSelector } from '@reduxjs/toolkit'
import { CONFIRMED_TTL_MS, storedConfirmedRequestIdStrings } from './requestIdTracking'

export { PENDING_TTL_MS, CONFIRMED_TTL_MS, STABLE_EMPTY_CONFIRMED_IDS, storedConfirmedRequestIdStrings, prunePendingEditsStorage } from './requestIdTracking'
import type { ISSMHoldCondition } from '../stateSeekingMachine/baseClasses'

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
    sliceSelector: (state: any) => any    // Selector to access this slice in Redux store
    promiseCache?: PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>  // Optional promise cache for state machine coordination
    onReady?: (dispatch: any, getState: any, sliceActions: any) => void  // Optional callback when slice reaches READY state (after INITIALIZE completes). Receives dispatch, getState, and slice actions for subscription management.
    holdCondition?: ISSMHoldCondition<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>  // Optional additional hold condition (checked alongside lifelineCondition)
    requestIdTracking?: RequestIdTrackingConfig  // Opt-in: persist confirmed stream-header correlation ids per subscribed stream
    /** Runs after dispatch(processEnvelope(payload)) in the StreamEventPubSub subscriber; getState() reflects committed reducer state. */
    afterProcessEnvelope?: (dispatch: any, getState: any, payload: StreamEventDeserializedPayload) => void
    /** Tail-anchored CompactedCheckpoint spacing; default DEFAULT_DESIRABLE_MEDIAN (10). */
    desirableMedian?: number
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
    const { name, dataSourceKey, aggregator, eventSerializer, sliceSelector, promiseCache: providedPromiseCache, holdCondition, requestIdTracking, desirableMedian = DEFAULT_DESIRABLE_MEDIAN } = config

    // Create a promise cache if one wasn't provided
    const promiseCache = providedPromiseCache ?? new PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>()

    // We'll create the initialize action after we have access to the public action creators
    // This is necessary because the initialize action needs to dispatch processEnvelope
    let initializeAction: ReturnType<typeof createInitializeAction<SnapshotPayload, UpdatePayload>>

    // Create the subscribe and unsubscribe actions using factories
    const subscribeAction = createSubscribeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey,
        (streamKey) => aggregator.createEmpty(streamKey),
        requestIdTracking
    )
    const unsubscribeAction = createUnsubscribeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey
    )

    // Define the state machine template
    const template: any = {
        initialState: 'INITIAL' as const,
        initialData: {
            internalData: {
                incrementalBackoff: 0.5,
                subscribeStreamKeys: [],     // Queue of stream keys to subscribe
                unsubscribeStreamKeys: []    // Queue of stream keys to unsubscribe
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
                condition: (data: DataSourceData<SnapshotPayload, UpdatePayload>, getState: any) => {
                    // Always check LifeLine condition
                    if (!lifelineCondition(data, getState)) {
                        return false
                    }
                    // If additional hold condition is provided, check it as well
                    if (holdCondition) {
                        return holdCondition(data, getState)
                    }
                    return true
                }
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
                choices: ['SUBSCRIBE' as const, 'UNSUBSCRIBE' as const]  // Check both queues
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
                choices: []  // Terminal error state
            },
            SUBSCRIBED: {
                stateType: 'REDIRECT' as const,
                newIntent: ['READY' as const],  // Return to steady state
                choices: ['READY' as const]
            },
            UNSUBSCRIBE: {
                stateType: 'ATTEMPT' as const,
                action: unsubscribeAction,
                resolve: 'UNSUBSCRIBED' as const,
                reject: 'UNSUBSCRIBEBACKOFF' as const
            },
            UNSUBSCRIBEBACKOFF: {
                stateType: 'ATTEMPT' as const,
                action: backoffAction,
                resolve: 'UNSUBSCRIBE' as const,
                reject: 'SUBSCRIBEERROR' as const
            },
            UNSUBSCRIBED: {
                stateType: 'REDIRECT' as const,
                newIntent: ['READY' as const],  // Return to steady state
                choices: ['READY' as const]
            }
        }
    }

    // Create curried helper functions from reducers.ts
    const applyEventsWithAggregator = applyEvents(aggregator)
    const performCleanupWithConfig = performCleanup(aggregator, applyEventsWithAggregator, desirableMedian, dataSourceKey)
    
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
            processEnvelope: processEnvelope(
                dataSourceKey,
                aggregator,
                performCleanupWithConfig,
                applyEventsWithAggregator,
                requestIdTracking
            ),
            ...(requestIdTracking
                ? {
                    pruneStaleConfirmedRequestIds: pruneStaleConfirmedRequestIds(
                        requestIdTracking.confirmedTtlMs ?? CONFIRMED_TTL_MS
                    )
                }
                : {})
        },
        publicSelectors: {
            getActiveStreamKeys: (state) => state.activeStreamKeys,
            getSubscribedStreams: (state) => state.subscribedStreams
        },
        template
    })

    // StreamEventPubSub delivers pre-deserialized content; we pass the action creator directly.
    const processEnvelopeAction = result.publicActions.processEnvelope

    // Register deserializer so StreamEventPubSub can deserialize incoming StreamEvents for this data source
    registerDeserializer(dataSourceKey, eventSerializer)

    // Now that we have the result with publicActions, create the initialize action
    // This needs to be done after singleSSM call because we need access to the action creators
    // Create a wrapper for onReady that passes slice actions
    const onReadyWrapper = config.onReady 
        ? (dispatch: any, getState: any, _placeholder: any) => {
            // Pass the actual slice actions instead of the placeholder
            // Verify sliceActions are available
            if (!result.slice.actions || !result.slice.actions.internalStateChange || !result.slice.actions.setIntent) {
                console.warn(`[${name}] onReady wrapper: slice actions not available`, result.slice.actions)
            }
            config.onReady!(dispatch, getState, result.slice.actions)
        }
        : undefined
    initializeAction = createInitializeAction<SnapshotPayload, UpdatePayload>(
        dataSourceKey,
        processEnvelopeAction,
        onReadyWrapper,
        sliceSelector,  // Pass sliceSelector so we can read current state after onReady
        config.afterProcessEnvelope
    )

    // Create subscription/unsubscription helpers
    const subscribeToStreams = (streamKeys: string[]) => (dispatch: any, getState: any) => {
        const currentState = sliceSelector(getState())
        const existingQueue: string[] = currentState.internalData.subscribeStreamKeys || []

        // Add to queue (deduplicate)
        const newQueue = [...new Set([...existingQueue, ...streamKeys])]

        // Update internal data with new queue
        dispatch(result.slice.actions.internalStateChange({
            newState: currentState.meta.currentState,  // Don't change state
            data: {
                internalData: { ...currentState.internalData, subscribeStreamKeys: newQueue }
            }
        }))
        // Set intent to SUBSCRIBED - state machine will transition READY -> SUBSCRIBE -> SUBSCRIBED
        dispatch(result.slice.actions.setIntent(['SUBSCRIBED']))
        // Trigger state machine iteration via heartbeat
        dispatch(heartbeat)
    }

    const unsubscribeFromStreams = (streamKeys: string[]) => (dispatch: any, getState: any) => {
        const currentState = sliceSelector(getState())
        const existingQueue: string[] = currentState.internalData.unsubscribeStreamKeys || []
        
        // Add to queue (deduplicate)
        const newQueue = [...new Set([...existingQueue, ...streamKeys])]
        
        // Update internal data with new queue
        dispatch(result.slice.actions.internalStateChange({
            newState: currentState.meta.currentState,  // Don't change state
            data: {
                internalData: { ...currentState.internalData, unsubscribeStreamKeys: newQueue }
            }
        }))
        // Set intent to UNSUBSCRIBED - state machine will transition READY -> UNSUBSCRIBE -> UNSUBSCRIBED
        dispatch(result.slice.actions.setIntent(['UNSUBSCRIBED']))
        // Trigger state machine iteration via heartbeat
        dispatch(heartbeat)
    }

    return {
        ...result,
        subscribeToStreams,
        unsubscribeFromStreams,
        ...(requestIdTracking
            ? {
                getConfirmedRequestIds: createSelector(
                    [
                        (state: any, streamKey: string) =>
                            sliceSelector(state).publicData.subscribedStreams[streamKey]?.confirmedRequestIds
                    ],
                    (rows) => storedConfirmedRequestIdStrings(rows)
                )
            }
            : {})
    }
}
