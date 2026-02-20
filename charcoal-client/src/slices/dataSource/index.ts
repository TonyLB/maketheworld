import { singleSSM } from '../stateSeekingMachine/singleSSM'
import { DataSourceNodes, DataSourcePublic, DataSourceInternal, DataSourceData, ClientStreamingMessagePayload, ClientStreamingHeader } from './baseClasses'
import { backoffAction, createSubscribeAction, createUnsubscribeAction, createInitializeAction, lifelineCondition } from './index.api'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import type { DataSourceEventSerializer, EventPayload, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { applyEvents, performCleanup, processRawEnvelope } from './reducers'
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
    /** When set, Snapshot events with sidecarUrl are fetched and resolved to ExternalSnapshotPayload before processRawEnvelope. Omit for inline-only data sources. */
    resolveSidecarSnapshot?: (streamKey: string, sidecarUrl: string, rawSnapshot: any) => Promise<ExternalSnapshotPayload>
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
    const { name, dataSourceKey, aggregator, eventSerializer, sliceSelector, promiseCache: providedPromiseCache, holdCondition, resolveSidecarSnapshot } = config

    // Create a promise cache if one wasn't provided
    const promiseCache = providedPromiseCache ?? new PromiseCache<DataSourceData<SnapshotPayload, UpdatePayload>>()

    // We'll create the initialize action after we have access to the public action creators
    // This is necessary because the initialize action needs to dispatch processRawEnvelope
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
    const performCleanupWithConfig = performCleanup(aggregator, applyEventsWithAggregator)
    
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
            processRawEnvelope: processRawEnvelope(
                dataSourceKey,
                aggregator,
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

    // Always return an async thunk that awaits deserialize (or createGetContentInternal when available),
    // then dispatches the reducer with resolved content. Supports both inline and sidecar payloads.
    const processRawEnvelopeWithSidecar = (payload: ClientStreamingMessagePayload<any>) => {
        const { streamKey, timestamp, header, content } = payload
        if (header.type === 'Snapshot' && content?.sidecarUrl && !resolveSidecarSnapshot) {
            console.warn(`[${dataSourceKey}] Snapshot has sidecarUrl but resolveSidecarSnapshot is not configured; ignoring. streamKey=${streamKey}`)
            return
        }
        const serializerWithCreate = eventSerializer as DataSourceEventSerializer<UpdatePayload, any, SnapshotPayload, any> & {
            createGetContentInternal?: (params: { header: ClientStreamingHeader; update: any }) => () => Promise<SnapshotPayload | UpdatePayload>
        }
        return async (dispatch: any) => {
            let internalContent: SnapshotPayload | UpdatePayload | null
            if (header.type === 'Snapshot' && content?.sidecarUrl && resolveSidecarSnapshot) {
                const resolvedExternal = await resolveSidecarSnapshot(streamKey, content.sidecarUrl, content)
                internalContent = serializerWithCreate.deserializeSnapshot
                    ? (await Promise.resolve(serializerWithCreate.deserializeSnapshot!(resolvedExternal as any)))
                    : (resolvedExternal as unknown as SnapshotPayload)
            } else if (serializerWithCreate.createGetContentInternal) {
                internalContent = await serializerWithCreate.createGetContentInternal({ header, update: content })()
            } else if (header.type === 'Snapshot') {
                internalContent = serializerWithCreate.deserializeSnapshot
                    ? (await Promise.resolve(serializerWithCreate.deserializeSnapshot(content as any)))
                    : (content as unknown as SnapshotPayload)
            } else {
                internalContent = await Promise.resolve(serializerWithCreate.deserialize({ content: content as any, header: { ...header, dataSourceKey, streamKey, timestamp } }))
            }
            if (!internalContent) {
                if (header.type === 'Snapshot') {
                    console.warn(`[${dataSourceKey}] Failed to deserialize snapshot for streamKey: ${streamKey}`)
                } else {
                    console.warn(`[${dataSourceKey}] Failed to deserialize event for streamKey: ${streamKey}`)
                }
                return
            }
            dispatch(result.publicActions.processRawEnvelope({
                streamKey,
                timestamp,
                header,
                content: internalContent
            }))
        }
    }

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
        processRawEnvelopeWithSidecar,
        onReadyWrapper,
        sliceSelector  // Pass sliceSelector so we can read current state after onReady
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
        unsubscribeFromStreams
    }
}
