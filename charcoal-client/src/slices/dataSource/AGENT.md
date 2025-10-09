# Data Source Prototype - Client-Side Requirements

**Status: ACTIVE DEVELOPMENT DOCUMENT**

**Last Updated: 2025-10-09** - Refactored to use `singleSSM` state machine pattern

This document outlines the requirements and design patterns for implementing client-side data source management in the Make The World frontend. The data source system enables real-time subscription to backend data streams with intelligent caching and materialized view management.

## Key Architecture Updates

**State Machine Integration (2025-10-09)**: The design now uses the `singleSSM` pattern for subscription lifecycle management, eliminating manual state tracking and retry logic. Key benefits:

- **Automatic Retry Logic**: SUBSCRIBEBACKOFF and UNSUBSCRIBEBACKOFF states handle exponential backoff
- **Clear State Flow**: READY → SUBSCRIBE → SUBSCRIBED → UNSUBSCRIBE with explicit error states
- **Pattern Consistency**: Follows established patterns from `personalAssets` slice (FETCHURL/FETCHURLBACKOFF/FETCHERROR)
- **Reduced Complexity**: State machine handles state transitions, backoff, and error states automatically
- **Intent-Based API**: Use `setIntent(['SUBSCRIBED'])` to trigger subscription, state machine handles the rest

**Previous Update (2025-10-08)**: The aggregation interfaces and example implementation reflect the actual `ContentHeadersAggregator` implementation in `mtw-interfaces`, replacing previous speculative designs with concrete, tested patterns.

## Overview

The data source prototype provides a foundation for managing real-time data subscriptions from backend services, with particular focus on the `mtw.assets.contentHeaders` DataSource and future data sources. The system handles subscription management, event deserialization, caching, and materialized view aggregation.

## Core Requirements

### **1. Subscription Management**
- **Stream Key Subscription**: Straightforward subscribe/unsubscribe to lists of `streamKey`s
- **API Integration**: Deliver subscription requests to the `subscriptions` lambda
- **Connection Management**: Handle WebSocket connections and reconnection logic
- **Batch Operations**: Support subscribing to multiple stream keys in single requests

### **2. Event Deserialization**
- **Interface Integration**: Simple access to deserialization from `mtw-interfaces`
- **Internal Representations**: Operate on deserialized internal event representations
- **Type Safety**: Leverage TypeScript interfaces for event type safety
- **Error Handling**: Graceful handling of deserialization failures

### **3. Intelligent Caching**
- **Event History**: Cache incoming events for reasonable time periods (30-second window)
- **Out-of-Order Handling**: Re-aggregate recent events without assuming order
- **Historical Snapshot**: Replace old historical information with aggregated snapshots
- **Memory Management**: Prevent unbounded growth of event history

### **4. Materialized View Aggregation**
- **Current State**: Maintain materialized view of total data as known by client
- **Aggregation Functions**: Design aggregation patterns for snapshots and streaming events
- **State Consistency**: Ensure consistent view despite out-of-order events
- **Performance**: Efficient aggregation without excessive re-computation

## Technical Architecture

### **Generic Data Source Slice Pattern**

The client-side data source system uses the `singleSSM` pattern to create structured slices for each data source. This eliminates the need for manual status tracking (`status: 'pending' | 'subscribed' | 'error'`) as the state machine provides this automatically through its state transitions.

```typescript
// Generic data source slice creator configuration
interface DataSourceSliceConfig<
  SnapshotPayload,
  ExternalSnapshotPayload,
  UpdatePayload,
  ExternalUpdatePayload
> {
  dataSourceKey: string
  serializer: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload>
  aggregation: DataSourceAggregationHelpers<SnapshotPayload, UpdatePayload>
  subscribeAPI: (streamKeys: string[]) => Promise<void>  // API call to subscribe
  unsubscribeAPI: (streamKeys: string[]) => Promise<void>  // API call to unsubscribe
}

// Create a data source slice using singleSSM
const createDataSourceSlice = <
  SnapshotPayload,
  ExternalSnapshotPayload,
  UpdatePayload,
  ExternalUpdatePayload
>(
  config: DataSourceSliceConfig<SnapshotPayload, ExternalSnapshotPayload, UpdatePayload, ExternalUpdatePayload>
) => {
  // Returns singleSSM result with state machine management
  // - State machine handles: READY → SUBSCRIBE → SUBSCRIBED → UNSUBSCRIBE
  // - Automatic retry with backoff on failure
  // - Terminal error state for unrecoverable failures
  // - Public reducers for event processing (processRawSnapshot, processRawEvent)
  // - Public selectors for data access (getStatus, getSubscribedStreams, getMaterializedView)
}
```

**Why State Machine?**
- **No Manual Status**: State machine state (READY, SUBSCRIBE, SUBSCRIBED) replaces manual `status: 'pending' | 'subscribed' | 'error'`
- **Built-in Retry**: SUBSCRIBEBACKOFF/UNSUBSCRIBEBACKOFF states handle exponential backoff automatically
- **Error Handling**: SUBSCRIBEERROR provides clear terminal error state
- **Intent-Based**: `setIntent(['SUBSCRIBED'])` triggers subscription, state machine handles execution
- **Consistency**: Same pattern as `personalAssets` (FETCHURL → FETCHURLBACKOFF → FETCHERROR)

### **State Machine Architecture**

Each data source uses the `singleSSM` pattern to manage subscription lifecycle, eliminating manual state tracking and retry logic. The state machine handles subscription attempts, backoff, and error states automatically.

#### **State Machine States**

```typescript
interface DataSourceNodes {
  READY: ISSMChoiceNode;                    // Initial state, ready to subscribe
  SUBSCRIBE: ISSMAttemptNode<Internal, Public>;  // Attempting subscription
  SUBSCRIBEBACKOFF: ISSMAttemptNode<Internal, Public>; // Backoff before retry
  SUBSCRIBEERROR: ISSMChoiceNode;           // Subscription failed
  SUBSCRIBED: ISSMChoiceNode;               // Successfully subscribed
  UNSUBSCRIBE: ISSMAttemptNode<Internal, Public>; // Attempting unsubscribe
  UNSUBSCRIBEBACKOFF: ISSMAttemptNode<Internal, Public>; // Backoff before retry
}
```

#### **State Machine Flow**

```
READY 
  ↓ (user requests subscription)
SUBSCRIBE (call subscriptions API)
  ↓ success                    ↓ failure
SUBSCRIBED ←──────────── SUBSCRIBEBACKOFF (exponential backoff)
  ↓                              ↓ max retries
UNSUBSCRIBE                 SUBSCRIBEERROR (terminal error state)
  ↓ success
SUBSCRIBED (for partial unsubscribe) or READY (for full unsubscribe)
```

### **Data Source Slice Structure**

Each data source gets its own slice with state machine integration:

```typescript
// Internal state (managed by state machine actions)
interface DataSourceInternal {
  incrementalBackoff: number;
  pendingStreamKeys?: string[];  // Stream keys to subscribe/unsubscribe
  error?: string;
}

// Public state (accessed by components)
interface DataSourcePublic<TSnapshot, TEvent> {
  subscribedStreams: {
    [streamKey: string]: {
      materializedView: TSnapshot
      recentEvents: Array<{event: TEvent, timestamp: number}>
      lastUpdate: number
    }
  }
}

// Data source slice creator using singleSSM
const createDataSourceSlice = <
  SnapshotPayload,
  ExternalSnapshotPayload,
  UpdatePayload,
  ExternalUpdatePayload
>(
  config: DataSourceSliceConfig<SnapshotPayload, ExternalSnapshotPayload, UpdatePayload, ExternalUpdatePayload>
) => {
  // Define state machine template
  const template = {
    initialState: 'READY',
    initialData: {
      internalData: {
        incrementalBackoff: 0.5
      },
      publicData: {
        subscribedStreams: {}
      }
    },
    states: {
      READY: {
        stateType: 'CHOICE',
        choices: ['SUBSCRIBE']
      },
      SUBSCRIBE: {
        stateType: 'ATTEMPT',
        action: subscribeAction(config),
        resolve: 'SUBSCRIBED',
        reject: 'SUBSCRIBEBACKOFF'
      },
      SUBSCRIBEBACKOFF: {
        stateType: 'ATTEMPT',
        action: backoffAction,
        resolve: 'SUBSCRIBE',
        reject: 'SUBSCRIBEERROR'
      },
      SUBSCRIBEERROR: {
        stateType: 'CHOICE',
        choices: []  // Terminal error state
      },
      SUBSCRIBED: {
        stateType: 'CHOICE',
        choices: ['UNSUBSCRIBE']
      },
      UNSUBSCRIBE: {
        stateType: 'ATTEMPT',
        action: unsubscribeAction(config),
        resolve: 'SUBSCRIBED',  // or READY if all streams unsubscribed
        reject: 'UNSUBSCRIBEBACKOFF'
      },
      UNSUBSCRIBEBACKOFF: {
        stateType: 'ATTEMPT',
        action: backoffAction,
        resolve: 'UNSUBSCRIBE',
        reject: 'SUBSCRIBEERROR'
      }
    }
  }
  
  // Create the slice using singleSSM
  return singleSSM({
    name: `dataSource/${config.dataSourceKey}`,
    initialSSMState: 'READY',
    initialSSMDesired: ['READY'],  // Start ready, not subscribed
    initialData: template.initialData,
    sliceSelector: (state) => state[config.dataSourceKey],
    publicReducers: {
      // Event processing - deserializes and aggregates
      processRawSnapshot: processRawSnapshotReducer(config),
      processRawEvent: processRawEventReducer(config)
    },
    publicSelectors: {
      getStatus: (state) => state.meta.currentState,
      getSubscribedStreams: (state) => state.publicData.subscribedStreams,
      getMaterializedView: (streamKey: string) => (state) => 
        state.publicData.subscribedStreams[streamKey]?.materializedView
    },
    template
  })
}
```

### **Key Advantages of State Machine Pattern**

1. **Automatic Retry Logic**: `SUBSCRIBEBACKOFF` handles exponential backoff automatically
2. **Error State Management**: `SUBSCRIBEERROR` provides clear terminal error state
3. **Intent-Based Transitions**: Use `setIntent(['SUBSCRIBED'])` to trigger subscription
4. **Status Tracking**: State machine provides `getStatus()` selector for current state
5. **No Manual State Tracking**: Eliminates `status: 'pending' | 'subscribed' | 'error'` duplication

### **Data Source Configuration**

Each data source is configured with serialization and aggregation logic. **These are implemented in `mtw-interfaces` alongside the event types**, since they define the data source's shape and behavior:

```typescript
// Actual DataSourceEventSerializer interface from mtw-lambda-patterns
// Implemented in mtw-interfaces for each data source
interface DataSourceEventSerializer<
  UpdatePayload,           // Internal event type (e.g. ContentHeadersEventUpdate)
  ExternalUpdatePayload,   // External event type (e.g. ContentHeadersExternal)
  SnapshotPayload,         // Internal snapshot type (e.g. ContentHeadersSnapshot)
  ExternalSnapshotPayload  // External snapshot type (e.g. ContentHeadersSnapshotExternal)
> {
  // Convert internal event to external format for transmission
  serialize(params: {
    dataSourceKey: string
    streamKey: string
    update: UpdatePayload
  }): ExternalUpdatePayload
  
  // Convert external event back to internal format
  // Returns null if deserialization fails
  deserialize(params: {
    dataSourceKey: string
    streamKey: string
    externalUpdate: ExternalUpdatePayload
  }): UpdatePayload | null
  
  // Convert internal snapshot to external format for transmission
  serializeSnapshot(snapshot: SnapshotPayload): ExternalSnapshotPayload
  
  // Convert external snapshot back to internal format
  // Returns null if deserialization fails
  deserializeSnapshot(externalSnapshot: ExternalSnapshotPayload): SnapshotPayload | null
}

// Aggregation interface (implemented in mtw-interfaces)
// Based on actual ContentHeadersAggregator implementation
interface DataSourceAggregator<SnapshotPayload, UpdatePayload> {
  // Create an empty snapshot (initial state before any data arrives)
  createEmpty(): SnapshotPayload
  
  // Apply a single update event to a snapshot (immutable pattern)
  // Returns success/failure with updated snapshot
  applyUpdate(
    snapshot: SnapshotPayload,
    update: UpdatePayload
  ): { success: true; snapshot: SnapshotPayload } | { success: false; error: Error; snapshot: SnapshotPayload }
}

// Client-side helper interface for slice integration
// Wraps the aggregator for Redux usage
interface DataSourceAggregationHelpers<SnapshotPayload, UpdatePayload> {
  createEmptyView(): SnapshotPayload
  applyEvent(snapshot: SnapshotPayload, event: UpdatePayload): SnapshotPayload
  applyEvents(snapshot: SnapshotPayload, events: UpdatePayload[]): SnapshotPayload
}
```

**Note**: Both `DataSourceEventSerializer` and `DataSourceAggregator` are implemented in `mtw-interfaces/ts/eventBridge/[dataSource]/` as they define the data source's behavioral contract independent of execution location. The client-side slice uses these implementations directly.

### **Example: Content Headers Data Source**

Here's how to create a content headers data source slice using the state machine pattern:

```typescript
import {
  ContentHeadersSnapshot,
  ContentHeadersEventUpdate,
  ContentHeadersAggregator,
  ContentHeadersEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import { subscribeToDataSource, unsubscribeFromDataSource } from '../../api/subscriptions'

// The serializer and aggregator are already implemented in mtw-interfaces
const serializer = new ContentHeadersEventSerializer()
const aggregator = new ContentHeadersAggregator()

// Define the state machine actions
const subscribeAction = (config) => async ({ internalData, publicData, actions }) => {
  const { pendingStreamKeys } = internalData
  if (!pendingStreamKeys || pendingStreamKeys.length === 0) {
    return { internalData, publicData }
  }
  
  try {
    // Call subscriptions API
    await subscribeToDataSource({
      dataSourceKey: config.dataSourceKey,
      streamKeys: pendingStreamKeys
    })
    
    // Initialize empty views for new streams
    const newStreams = { ...publicData.subscribedStreams }
    pendingStreamKeys.forEach(streamKey => {
      if (!newStreams[streamKey]) {
        newStreams[streamKey] = {
          materializedView: aggregator.createEmpty(),
          recentEvents: [],
          lastUpdate: Date.now()
        }
      }
    })
    
    return {
      internalData: { ...internalData, pendingStreamKeys: undefined },
      publicData: { ...publicData, subscribedStreams: newStreams }
    }
  } catch (error) {
    return {
      internalData: { ...internalData, error: error.message },
      publicData
    }
  }
}

const unsubscribeAction = (config) => async ({ internalData, publicData, actions }) => {
  const { pendingStreamKeys } = internalData
  if (!pendingStreamKeys || pendingStreamKeys.length === 0) {
    return { internalData, publicData }
  }
  
  try {
    // Call subscriptions API
    await unsubscribeFromDataSource({
      dataSourceKey: config.dataSourceKey,
      streamKeys: pendingStreamKeys
    })
    
    // Remove unsubscribed streams
    const newStreams = { ...publicData.subscribedStreams }
    pendingStreamKeys.forEach(streamKey => {
      delete newStreams[streamKey]
    })
    
    return {
      internalData: { ...internalData, pendingStreamKeys: undefined },
      publicData: { ...publicData, subscribedStreams: newStreams }
    }
  } catch (error) {
    return {
      internalData: { ...internalData, error: error.message },
      publicData
    }
  }
}

const backoffAction = async ({ internalData, publicData }) => {
  const backoffMs = internalData.incrementalBackoff * 1000
  await new Promise(resolve => setTimeout(resolve, backoffMs))
  
  return {
    internalData: {
      ...internalData,
      incrementalBackoff: Math.min(internalData.incrementalBackoff * 2, 30)
    },
    publicData
  }
}

// Create the content headers slice with state machine
const {
  slice: contentHeadersSlice,
  selectors: contentHeadersSelectors,
  publicActions: contentHeadersPublicActions,
  iterateAllSSMs: iterateContentHeaders
} = singleSSM({
  name: 'contentHeaders',
  initialSSMState: 'READY',
  initialSSMDesired: ['READY'],
  initialData: {
    internalData: {
      incrementalBackoff: 0.5
    },
    publicData: {
      subscribedStreams: {}
    }
  },
  sliceSelector: (state) => state.contentHeaders,
  publicReducers: {
    // Process incoming snapshot
    processRawSnapshot: (record) => (state, action) => {
      const { streamKey, rawSnapshot } = action.payload
      const stream = state.publicData.subscribedStreams[streamKey]
      if (!stream) return state
      
      const snapshot = serializer.deserializeSnapshot(rawSnapshot)
      if (!snapshot) return state
      
      return {
        ...state,
        publicData: {
          ...state.publicData,
          subscribedStreams: {
            ...state.publicData.subscribedStreams,
            [streamKey]: {
              ...stream,
              materializedView: snapshot,
              lastUpdate: Date.now()
            }
          }
        }
      }
    },
    
    // Process incoming event
    processRawEvent: (record) => (state, action) => {
      const { streamKey, rawEvent } = action.payload
      const stream = state.publicData.subscribedStreams[streamKey]
      if (!stream) return state
      
      const event = serializer.deserialize({
        dataSourceKey: 'mtw.assets.contentHeaders',
        streamKey,
        externalUpdate: rawEvent
      })
      if (!event) return state
      
      // Apply event using aggregator
      const result = aggregator.applyUpdate(stream.materializedView, event)
      
      return {
        ...state,
        publicData: {
          ...state.publicData,
          subscribedStreams: {
            ...state.publicData.subscribedStreams,
            [streamKey]: {
              materializedView: result.success ? result.snapshot : stream.materializedView,
              recentEvents: [
                ...stream.recentEvents,
                { event, timestamp: Date.now() }
              ].filter(e => e.timestamp > Date.now() - 30000), // Keep last 30 seconds
              lastUpdate: Date.now()
            }
          }
        }
      }
    }
  },
  publicSelectors: {
    getSubscribedStreams: (state) => state.publicData.subscribedStreams,
    getMaterializedView: (streamKey: string) => (state) =>
      state.publicData.subscribedStreams[streamKey]?.materializedView
  },
  template: {
    initialState: 'READY',
    initialData: {
      internalData: { incrementalBackoff: 0.5 },
      publicData: { subscribedStreams: {} }
    },
    states: {
      READY: {
        stateType: 'CHOICE',
        choices: ['SUBSCRIBE']
      },
      SUBSCRIBE: {
        stateType: 'ATTEMPT',
        action: subscribeAction({ dataSourceKey: 'mtw.assets.contentHeaders' }),
        resolve: 'SUBSCRIBED',
        reject: 'SUBSCRIBEBACKOFF'
      },
      SUBSCRIBEBACKOFF: {
        stateType: 'ATTEMPT',
        action: backoffAction,
        resolve: 'SUBSCRIBE',
        reject: 'SUBSCRIBEERROR'
      },
      SUBSCRIBEERROR: {
        stateType: 'CHOICE',
        choices: []
      },
      SUBSCRIBED: {
        stateType: 'CHOICE',
        choices: ['UNSUBSCRIBE']
      },
      UNSUBSCRIBE: {
        stateType: 'ATTEMPT',
        action: unsubscribeAction({ dataSourceKey: 'mtw.assets.contentHeaders' }),
        resolve: 'SUBSCRIBED',
        reject: 'UNSUBSCRIBEBACKOFF'
      },
      UNSUBSCRIBEBACKOFF: {
        stateType: 'ATTEMPT',
        action: backoffAction,
        resolve: 'UNSUBSCRIBE',
        reject: 'SUBSCRIBEERROR'
      }
    }
  }
})

// Types from mtw-interfaces:
// - ContentHeadersSnapshot: { type: 'Snapshot Generated', assets: Array<{ assetId, zone, standardForm }> }
// - ContentHeadersEventUpdate: Headers Updated | Zone Updated | Snapshot Generated
// - Headers Updated: { type: 'Headers Updated', assetId, zone, standardForm }
// - Zone Updated: { type: 'Zone Updated', assetId, fromZone, toZone }
```

### **Redux Integration**

#### **Store Configuration**
Each data source slice is added to the Redux store:

```typescript
// Store configuration
const store = configureStore({
  reducer: {
    // Existing slices
    personalAssets: personalAssetsSlice.reducer,
    // ... other slices
    
    // Data source slices
    contentHeaders: contentHeadersSlice.reducer,
    // Future data sources
    // characterData: characterDataSlice.reducer,
    // roomData: roomDataSlice.reducer,
  }
})
```

#### **Redux Selectors**

Each data source provides state machine selectors and data access selectors:

```typescript
// Content headers selectors (provided by singleSSM)
const {
  getStatus,              // Current state machine state
  getIntent,              // Desired state(s)
  getSubscribedStreams,   // All subscribed streams with their views
  getMaterializedView     // Get view for specific stream
} = contentHeadersSelectors

// Usage in components
const ContentHeadersComponent = () => {
  const dispatch = useDispatch()
  
  // Get current state machine status
  const status = useSelector(getStatus)  // 'READY' | 'SUBSCRIBE' | 'SUBSCRIBED' | etc.
  
  // Get all subscribed streams
  const subscribedStreams = useSelector(getSubscribedStreams)
  
  // Get specific stream's materialized view
  const globalView = useSelector((state) => getMaterializedView('global')(state))
  
  // Check if we're in an active subscription state
  const isSubscribed = status === 'SUBSCRIBED'
  const isSubscribing = status === 'SUBSCRIBE' || status === 'SUBSCRIBEBACKOFF'
  const hasError = status === 'SUBSCRIBEERROR'
  
  // Component logic...
}
```

#### **Redux Actions**

Each data source provides state machine actions and event processing reducers:

```typescript
// Content headers slice (returned from createDataSourceSlice)
const {
  slice: contentHeadersSlice,
  selectors: contentHeadersSelectors,
  publicActions: contentHeadersActions,
  iterateAllSSMs: iterateContentHeaders
} = createDataSourceSlice({
  dataSourceKey: 'mtw.assets.contentHeaders',
  serializer: new ContentHeadersEventSerializer(),
  aggregation: { /* aggregation helpers */ }
})

// State machine actions
const { setIntent } = contentHeadersSlice.actions

// Public actions for event processing
const {
  processRawSnapshot,
  processRawEvent
} = contentHeadersActions

// Usage in components
const dispatch = useDispatch()

// Subscribe to stream keys
const handleSubscribe = (streamKeys: string[]) => {
  // Store stream keys in internal state and trigger subscription
  dispatch(contentHeadersSlice.actions.internalStateChange({
    newState: 'SUBSCRIBE',
    data: {
      internalData: { pendingStreamKeys: streamKeys }
    }
  }))
  // Set intent to SUBSCRIBED - state machine will handle the transition
  dispatch(setIntent(['SUBSCRIBED']))
  // Iterate the state machine to execute the subscription action
  dispatch(iterateContentHeaders)
}

// Unsubscribe from stream keys
const handleUnsubscribe = (streamKeys: string[]) => {
  dispatch(contentHeadersSlice.actions.internalStateChange({
    newState: 'UNSUBSCRIBE',
    data: {
      internalData: { pendingStreamKeys: streamKeys }
    }
  }))
  dispatch(setIntent(['SUBSCRIBED']))  // Intent is to return to SUBSCRIBED state
  dispatch(iterateContentHeaders)
}

// Process incoming WebSocket messages
// (typically handled by middleware via LifeLinePubSub subscription)
const handleWebSocketMessage = (message: any) => {
  if (message.type === 'Snapshot Generated') {
    dispatch(processRawSnapshot({
      streamKey: 'global',
      rawSnapshot: message as ContentHeadersSnapshotExternal
    }))
  } else if (message.type === 'Headers Updated' || message.type === 'Zone Updated') {
    dispatch(processRawEvent({
      streamKey: 'global',
      rawEvent: message as ContentHeadersExternal
    }))
  }
}
```

## Implementation Plan

### **Phase 1: State Machine Integration (Week 1)**
- **State Machine Template**: Define standard data source state machine with READY, SUBSCRIBE, SUBSCRIBED, UNSUBSCRIBE states
- **Generic Slice Factory**: Create `createDataSourceSlice` function using `singleSSM`
- **Type Safety**: Generic types for internal/public data, snapshots, and events
- **State Machine Actions**: Implement subscribe/unsubscribe actions with API calls
- **Event Processing Reducers**: Public reducers for processRawSnapshot and processRawEvent
- **Configuration Interface**: Serializer and aggregation configuration

### **Phase 2: mtw-interfaces Integration (Week 2)** ✅ COMPLETE for Content Headers
- ✅ **Serializer Implementation**: `ContentHeadersEventSerializer` in `mtw-interfaces/ts/eventBridge/assets/contentHeaders/`
- ✅ **Aggregation Implementation**: `ContentHeadersAggregator` in `mtw-interfaces/ts/eventBridge/assets/contentHeaders/`
- ✅ **Content Headers Example**: Fully implemented and tested
- ✅ **Testing**: 18 unit tests for serialization and aggregation logic (all passing)

### **Phase 3: WebSocket Integration** ✅ INFRASTRUCTURE COMPLETE
- ✅ **Shared WebSocket Service**: Already exists via `LifeLinePubSub` in `slices/lifeLine`
- ✅ **Message Routing**: WebSocket messages already published to `LifeLinePubSub`
- ✅ **Reconnection Logic**: State machine handles backoff and retry
- **TODO**: Subscribe data source slices to `LifeLinePubSub` (same pattern as player, activeCharacters, library slices)

### **Phase 4: Content Headers Implementation (Week 4)**
- **Content Headers Slice**: Create content headers data source slice using mtw-interfaces
- **UI Components**: Create components that consume content headers data
- **Integration Testing**: End-to-end testing of subscription and aggregation logic

### **WebSocket Integration**

#### **Using Existing LifeLinePubSub Infrastructure**

The client already has WebSocket infrastructure via `LifeLinePubSub`. Data source slices integrate with it using the same pattern as existing slices:

```typescript
// Import the existing LifeLinePubSub
import { LifeLinePubSub } from '../lifeLine'

// Subscribe to LifeLinePubSub in your data source initialization
export const initializeContentHeadersDataSource = (): ThunkAction<void, RootState, unknown, AnyAction> => {
  return (dispatch, getState) => {
    // Subscribe to LifeLinePubSub to receive WebSocket messages
    const subscription = LifeLinePubSub.subscribe(({ payload }) => {
      // Check if this is a data source message
      if (payload.messageType === 'StreamEvent') {
        const { dataSourceKey, streamKey, message } = payload
        
        if (dataSourceKey === 'mtw.assets.contentHeaders') {
          // Process based on message type
          if (message.type === 'Snapshot Generated') {
            dispatch(processContentHeadersSnapshot({
              streamKey,
              rawSnapshot: message as ContentHeadersSnapshotExternal
            }))
          } else if (message.type === 'Headers Updated' || message.type === 'Zone Updated') {
            dispatch(processContentHeadersEvent({
              streamKey,
              rawEvent: message as ContentHeadersExternal
            }))
          }
        }
      }
    })
    
    // Store subscription for cleanup
    // (implementation depends on slice structure)
  }
}
```

**Key Benefits of Using LifeLinePubSub:**
- ✅ WebSocket connection already managed by lifeLine state machine
- ✅ Reconnection logic already implemented
- ✅ Message routing pattern already established
- ✅ Works with existing subscription infrastructure
- ✅ No duplicate WebSocket connections needed

## Success Criteria

### **Functional Requirements**
- [ ] Generic slice creator works for multiple data sources using `singleSSM` pattern
- [ ] Each data source has its own state machine with READY → SUBSCRIBE → SUBSCRIBED → UNSUBSCRIBE flow
- [ ] Automatic retry logic with SUBSCRIBEBACKOFF and UNSUBSCRIBEBACKOFF states
- [ ] Terminal error handling with SUBSCRIBEERROR state
- [ ] Can subscribe/unsubscribe to multiple stream keys per data source
- [ ] Receives and deserializes events using `mtw-interfaces` deserializers
- [ ] Maintains materialized views of current state per subscribed stream
- [ ] Handles out-of-order events correctly with data source specific aggregation
- [ ] Integrates with Redux for state management via `singleSSM`
- [ ] Provides easy access via state machine selectors (getStatus, getSubscribedStreams, getMaterializedView)

### **Performance Requirements**
- [ ] Efficient aggregation without excessive re-computation
- [ ] Memory usage stays within bounds (30-second window per subscribed stream)
- [ ] Real-time updates with minimal latency
- [ ] Graceful handling of subscription failures via backoff mechanism
- [ ] State machine prevents redundant subscription attempts
- [ ] Shared WebSocket service for efficient connection management (via LifeLinePubSub)

### **Integration Requirements**
- [ ] Works with `mtw.assets.contentHeaders` DataSource
- [ ] Uses `singleSSM` for state machine implementation
- [ ] Follows established patterns from `personalAssets` slice (SUBSCRIBE/SUBSCRIBEBACKOFF/SUBSCRIBEERROR)
- [ ] Compatible with existing Redux patterns and LifeLinePubSub
- [ ] Extensible for future data sources (character data, room data, etc.)
- [ ] Type-safe throughout the system with proper TypeScript generics
- [ ] Deserialization and aggregation logic implemented in `mtw-interfaces`
- [ ] Client-side slices consume logic from `mtw-interfaces` rather than implementing it locally
- [ ] State machine provides clear status tracking (READY, SUBSCRIBE, SUBSCRIBED, etc.)

## Dependencies

### **Backend Dependencies**
- **Subscriptions Lambda**: Must be operational for subscription management
- **Data Sources**: `mtw.assets.contentHeaders` and other data sources must be available
- **WebSocket Service**: Real-time event delivery infrastructure

### **Frontend Dependencies**
- **Redux Store**: State management infrastructure
- **mtw-interfaces**: Event deserialization, aggregation logic, and type definitions
- **WebSocket Client**: Real-time communication capability
- **stateSeekingMachine**: Pattern for generic slice creation

### **External Dependencies**
- **TypeScript**: Type safety and interface definitions
- **Redux Toolkit**: Modern Redux patterns and utilities
- **WebSocket API**: Browser WebSocket support
- **Generic Programming**: TypeScript generics for slice factory pattern

### **mtw-interfaces Dependencies**
- **Deserializer Implementation**: Must be implemented in `mtw-interfaces/ts/eventBridge/[dataSource]/`
- **Aggregation Implementation**: Must be implemented in `mtw-interfaces/ts/eventBridge/[dataSource]/`
- **Type Definitions**: Data source specific types for snapshots, events, and materialized views
- **Testing**: Unit tests for deserialization and aggregation logic

## Future Extensions

### **Additional Data Sources**
- **Character Data**: Real-time character state updates
- **Room Data**: Live room information and updates
- **Asset Data**: Asset metadata and content updates

### **Advanced Features**
- **Conflict Resolution**: Handle conflicting updates from multiple sources
- **Optimistic Updates**: Support for optimistic UI updates
- **Offline Support**: Graceful degradation when disconnected
- **Performance Monitoring**: Metrics and performance tracking
- **Data Source Composition**: Combine multiple data sources into unified views
- **Custom Aggregation**: User-defined aggregation functions for specialized use cases

## Navigation

This document is part of the comprehensive Make The World documentation system:

- **[Main Project Documentation](../../../AGENT.md)**: Complete project overview and navigation
- **[Development Roadmap](../../../AGENT.development.md)**: Current migration and architecture evolution
- **[Publishing Planning](../../../AGENT.publishing.planning.md)**: Publishing MVP implementation plan
- **[Architecture Philosophy](../../../AGENT.architecture.philosophy.md)**: Core architectural principles

---

*This document serves as the technical specification for implementing client-side data source management. It should be updated as requirements evolve and implementation progresses.*
