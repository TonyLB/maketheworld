import { singleSSM } from '../stateSeekingMachine/singleSSM'
import { DataSourceNodes, DataSourcePublic, DataSourceInternal, DataSourceData } from './baseClasses'
import { backoffAction, createSubscribeAction, createUnsubscribeAction, createInitializeAction, lifelineCondition } from './index.api'
import { PayloadAction } from '@reduxjs/toolkit'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import type { DataSourceEventSerializer, EventPayload, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'

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

    //
    // Helper function: Apply multiple update events to a baseline snapshot (reduce pattern)
    // Note: Only accepts UpdatePayload events, not snapshots
    //
    const applyEvents = (
        baselineSnapshot: SnapshotPayload,
        events: Array<{ event: UpdatePayload; timestamp: number }>
    ): SnapshotPayload => {
        return events.reduce((snapshot, { event }) => {
            const result = aggregator.applyUpdate(snapshot, event)
            return result.success ? result.snapshot : snapshot
        }, baselineSnapshot)
    }
    
    //
    // Helper function: Perform 30-second cleanup (consolidate old events into snapshot)
    // Returns cleaned up recentEvents array
    // Takes incomingTimestamp to ensure cleanup accounts for the event being processed
    //
    const performCleanup = (
        recentEvents: Array<{ event: UpdatePayload | SnapshotPayload; timestamp: number }>,
        incomingTimestamp: number
    ): Array<{ event: UpdatePayload | SnapshotPayload; timestamp: number }> => {
        // Use the latest timestamp (including incoming event) as "now" (pure function - no Date.now())
        // If recentEvents is empty, the spread becomes no-op and Math.max(incomingTimestamp) = incomingTimestamp
        const latestTimestamp = Math.max(...recentEvents.map(e => e.timestamp), incomingTimestamp)
        const thirtySecondsAgo = latestTimestamp - 30000
        
        // Separate old and recent events
        const oldEvents = recentEvents.filter(e => e.timestamp <= thirtySecondsAgo)
        const stillRecentEvents = recentEvents.filter(e => e.timestamp > thirtySecondsAgo)
        
        if (oldEvents.length === 0) {
            // No cleanup needed
            return recentEvents
        }
        
        // Find the most recent snapshot in oldEvents (or use empty as baseline)
        const snapshotEvents = oldEvents.filter((e): e is { timestamp: number, event: SnapshotPayload } => isSnapshot(e.event))
        const baselineSnapshot = snapshotEvents.length > 0
            ? snapshotEvents[snapshotEvents.length - 1].event
            : aggregator.createEmpty()
        
        // Find events after the baseline snapshot
        const baselineTimestamp = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1].timestamp : 0
        const eventsAfterBaseline = oldEvents
            .filter(e => e.timestamp > baselineTimestamp && isUpdate(e.event))
            .sort((a, b) => a.timestamp - b.timestamp)
            .filter((e): e is { timestamp: number, event: UpdatePayload } => isUpdate(e.event))
        
        // Consolidate by applying events to baseline
        const consolidatedSnapshot = applyEvents(baselineSnapshot, eventsAfterBaseline)
        
        // Create synthetic snapshot event at 30-second boundary
        const syntheticSnapshot: { event: SnapshotPayload; timestamp: number } = {
            event: consolidatedSnapshot,
            timestamp: thirtySecondsAgo
        }
        
        // Return cleaned up recentEvents with synthetic snapshot + recent events
        return [syntheticSnapshot, ...stillRecentEvents]
    }
    
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
            processRawSnapshot: (record) => (
                state: any,
                action: PayloadAction<{ streamKey: string; rawSnapshot: ExternalSnapshotPayload }>
            ) => {
                const { streamKey, rawSnapshot } = action.payload
                const stream = state.publicData.subscribedStreams[streamKey]
                if (!stream) {
                    // Stream not subscribed, ignore
                    return state
                }
                
                // Deserialize snapshot
                const snapshot = eventSerializer.deserializeSnapshot(rawSnapshot)
                if (!snapshot) {
                    console.warn(`[${dataSourceKey}] Failed to deserialize snapshot for streamKey: ${streamKey}`)
                    return state
                }
                
                // Snapshot timestamp (using Date.now() until Phase 6 timestamp infrastructure)
                const snapshotTimestamp = Date.now()
                
                // Perform cleanup before processing (pass incoming timestamp for accurate window calculation)
                const cleanedRecentEvents = performCleanup(stream.recentEvents, snapshotTimestamp)
                
                // Find events that happened AFTER this snapshot
                const eventsAfterSnapshot = cleanedRecentEvents.filter(
                    e => e.timestamp > snapshotTimestamp
                )
                
                // Create new recent events: snapshot first, then events after it
                const snapshotEvent = { event: snapshot, timestamp: snapshotTimestamp }
                const newRecentEvents = [snapshotEvent, ...eventsAfterSnapshot]
                
                // Re-aggregate: Start with snapshot, apply any UPDATE events that came after it
                const updateEventsAfterSnapshot = eventsAfterSnapshot.filter((e): e is { timestamp: number, event: UpdatePayload } => isUpdate(e.event))
                const newMaterializedView = applyEvents(snapshot, updateEventsAfterSnapshot)
                
                return {
                    ...state,
                    publicData: {
                        ...state.publicData,
                        subscribedStreams: {
                            ...state.publicData.subscribedStreams,
                            [streamKey]: {
                                materializedView: newMaterializedView,
                                recentEvents: newRecentEvents
                            }
                        }
                    }
                }
            },
            
            // Process incoming update event
            processRawEvent: (record) => (
                state: any,
                action: PayloadAction<{ streamKey: string; rawEvent: ExternalUpdatePayload }>
            ) => {
                const { streamKey, rawEvent } = action.payload
                const stream = state.publicData.subscribedStreams[streamKey]
                if (!stream) {
                    // Stream not subscribed, ignore
                    return state
                }
                
                // Deserialize event
                const event = eventSerializer.deserialize({
                    dataSourceKey,
                    streamKey,
                    externalUpdate: rawEvent
                })
                if (!event) {
                    console.warn(`[${dataSourceKey}] Failed to deserialize event for streamKey: ${streamKey}`)
                    return state
                }
                
                // Determine event timestamp (using Date.now() until Phase 6 timestamp infrastructure)
                const eventTimestamp = Date.now() // TODO: Extract timestamp from event if available
                
                // Perform cleanup before processing (pass incoming timestamp for accurate window calculation)
                const cleanedRecentEvents = performCleanup(stream.recentEvents, eventTimestamp)
                const latestTimestamp = cleanedRecentEvents.length > 0
                    ? Math.max(...cleanedRecentEvents.map(e => e.timestamp))
                    : 0
                
                const isInOrder = eventTimestamp >= latestTimestamp
                
                if (isInOrder) {
                    // FAST PATH: Simple aggregation
                    const result = aggregator.applyUpdate(stream.materializedView, event)
                    const newMaterializedView = result.success ? result.snapshot : stream.materializedView
                    const newRecentEvents = [...cleanedRecentEvents, { event, timestamp: eventTimestamp }]
                    
                    return {
                        ...state,
                        publicData: {
                            ...state.publicData,
                            subscribedStreams: {
                                ...state.publicData.subscribedStreams,
                                [streamKey]: {
                                    materializedView: newMaterializedView,
                                    recentEvents: newRecentEvents
                                }
                            }
                        }
                    }
                } else {
                    // OUT-OF-ORDER PATH: Re-aggregate from snapshot
                    // Find most recent snapshot in recentEvents
                    const snapshotEvents = cleanedRecentEvents.filter((e): e is { timestamp: number, event: SnapshotPayload } => isSnapshot(e.event))
                    const baselineSnapshot = snapshotEvents.length > 0
                        ? snapshotEvents[snapshotEvents.length - 1].event
                        : aggregator.createEmpty()
                    const baselineTimestamp = snapshotEvents.length > 0 
                        ? snapshotEvents[snapshotEvents.length - 1].timestamp 
                        : 0
                    
                    // Collect all events including new one
                    const allEvents = [
                        ...cleanedRecentEvents.filter(e => e.timestamp > baselineTimestamp),
                        { event, timestamp: eventTimestamp }
                    ]
                    
                    // Sort by timestamp
                    const sortedEvents = allEvents.sort((a, b) => a.timestamp - b.timestamp)
                    
                    // Filter for only UPDATE events to apply (snapshots shouldn't be re-applied)
                    const sortedUpdateEvents = sortedEvents.filter((e): e is { timestamp: number, event: UpdatePayload } => isUpdate(e.event))
                    
                    // Re-aggregate in chronological order
                    const newMaterializedView = applyEvents(baselineSnapshot, sortedUpdateEvents)
                    
                    // Include baseline snapshot + all sorted events (updates and any intermediate snapshots)
                    const newRecentEvents = snapshotEvents.length > 0
                        ? [snapshotEvents[snapshotEvents.length - 1], ...sortedEvents]
                        : sortedEvents
                    
                    return {
                        ...state,
                        publicData: {
                            ...state.publicData,
                            subscribedStreams: {
                                ...state.publicData.subscribedStreams,
                                [streamKey]: {
                                    materializedView: newMaterializedView,
                                    recentEvents: newRecentEvents
                                }
                            }
                        }
                    }
                }
            }
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
        result.publicActions.processRawEvent
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

