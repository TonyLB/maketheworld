# Data Source Prototype - Client-Side Requirements

**Status: ACTIVE DEVELOPMENT DOCUMENT**

**Last Updated: 2025-10-08** - Updated with concrete implementations from `mtw.assets.contentHeaders` aggregator

This document outlines the requirements and design patterns for implementing client-side data source management in the Make The World frontend. The data source system enables real-time subscription to backend data streams with intelligent caching and materialized view management.

**Key Update**: The aggregation interfaces and example implementation now reflect the actual `ContentHeadersAggregator` implementation in `mtw-interfaces`, replacing previous speculative designs with concrete, tested patterns.

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

The client-side data source system uses a generic constructor pattern (similar to `stateSeekingMachine`) that creates structured slices for each data source:

```typescript
// Generic data source slice creator
interface DataSourceSliceConfig<
  SnapshotPayload,
  ExternalSnapshotPayload,
  UpdatePayload,
  ExternalUpdatePayload
> {
  dataSourceKey: string
  serializer: DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload, SnapshotPayload, ExternalSnapshotPayload>
  aggregation: DataSourceAggregationHelpers<SnapshotPayload, UpdatePayload>
  initialState?: Partial<DataSourceState<SnapshotPayload, UpdatePayload>>
}

// Create a data source slice
const createDataSourceSlice = <
  SnapshotPayload,
  ExternalSnapshotPayload,
  UpdatePayload,
  ExternalUpdatePayload
>(
  config: DataSourceSliceConfig<SnapshotPayload, ExternalSnapshotPayload, UpdatePayload, ExternalUpdatePayload>
) => {
  // Returns a Redux slice with data source specific behavior
  // The serializer handles deserialization from external to internal format
  // The aggregation helpers wrap the mtw-interfaces aggregator for Redux integration
}
```

### **Data Source Slice Structure**

Each data source gets its own slice with the following structure:

```typescript
// Generic data source state
// TSnapshot is the materialized view (aggregated state)
interface DataSourceState<TSnapshot, TEvent> {
  subscriptions: {
    [streamKey: string]: {
      status: 'subscribed' | 'pending' | 'error'
      lastUpdate: number
      materializedView: TSnapshot
      recentEvents: Array<{event: TEvent, timestamp: number}>
      error?: string
    }
  }
  connection: {
    status: 'connected' | 'disconnected' | 'connecting'
    lastHeartbeat: number
  }
}

// Data source slice creator
const createDataSourceSlice = <
  SnapshotPayload,
  ExternalSnapshotPayload,
  UpdatePayload,
  ExternalUpdatePayload
>(
  config: DataSourceSliceConfig<SnapshotPayload, ExternalSnapshotPayload, UpdatePayload, ExternalUpdatePayload>
) => {
  return createSlice({
    name: `dataSource/${config.dataSourceKey}`,
    initialState: {
      subscriptions: {},
      connection: {
        status: 'disconnected' as const,
        lastHeartbeat: 0
      },
      ...config.initialState
    } as DataSourceState<SnapshotPayload, UpdatePayload>,
    reducers: {
      // Subscription management
      subscribe: (state, action: PayloadAction<string[]>) => { 
        // Initialize subscriptions with empty views
        action.payload.forEach(streamKey => {
          if (!state.subscriptions[streamKey]) {
            state.subscriptions[streamKey] = {
              status: 'pending',
              lastUpdate: Date.now(),
              materializedView: config.aggregation.createEmptyView(),
              recentEvents: []
            }
          }
        })
      },
      unsubscribe: (state, action: PayloadAction<string[]>) => {
        action.payload.forEach(streamKey => {
          delete state.subscriptions[streamKey]
        })
      },
      
      // Event processing - deserializes using serializer, then aggregates
      processRawSnapshot: (state, action: PayloadAction<{streamKey: string, rawSnapshot: ExternalSnapshotPayload}>) => {
        const sub = state.subscriptions[action.payload.streamKey]
        if (sub) {
          // Deserialize external snapshot to internal format
          const snapshot = config.serializer.deserializeSnapshot(action.payload.rawSnapshot)
          if (snapshot) {
            sub.materializedView = snapshot
            sub.lastUpdate = Date.now()
            sub.status = 'subscribed'
          } else {
            sub.status = 'error'
            sub.error = 'Failed to deserialize snapshot'
          }
        }
      },
      processRawEvent: (state, action: PayloadAction<{streamKey: string, rawEvent: ExternalUpdatePayload}>) => {
        const sub = state.subscriptions[action.payload.streamKey]
        if (sub) {
          // Deserialize external event to internal format
          const event = config.serializer.deserialize({
            dataSourceKey: config.dataSourceKey,
            streamKey: action.payload.streamKey,
            externalUpdate: action.payload.rawEvent
          })
          
          if (event) {
            // Apply event to materialized view using aggregator
            sub.materializedView = config.aggregation.applyEvent(
              sub.materializedView,
              event
            )
            // Add to recent events with timestamp
            sub.recentEvents.push({
              event,
              timestamp: Date.now()
            })
            // Keep only last 30 seconds of events
            const thirtySecondsAgo = Date.now() - 30000
            sub.recentEvents = sub.recentEvents.filter(e => e.timestamp > thirtySecondsAgo)
            sub.lastUpdate = Date.now()
          } else {
            console.error('Failed to deserialize event')
          }
        }
      },
      
      // Connection management
      setConnectionStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'connecting'>) => {
        state.connection.status = action.payload
        state.connection.lastHeartbeat = Date.now()
      },
      
      // Error handling
      setError: (state, action: PayloadAction<{streamKey: string, error: string}>) => {
        const sub = state.subscriptions[action.payload.streamKey]
        if (sub) {
          sub.status = 'error'
          sub.error = action.payload.error
        }
      }
    }
  })
}
```

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

Here's how to create a content headers data source slice using the actual implemented types and aggregator:

```typescript
import {
  ContentHeadersSnapshot,
  ContentHeadersEventUpdate,
  ContentHeadersAggregator,
  ContentHeadersEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'

// The serializer and aggregator are already implemented in mtw-interfaces
const serializer = new ContentHeadersEventSerializer()
const aggregator = new ContentHeadersAggregator()

// Create the content headers slice
const contentHeadersSlice = createDataSourceSlice<
  ContentHeadersSnapshot,        // Internal snapshot type
  ContentHeadersSnapshotExternal, // External snapshot type
  ContentHeadersEventUpdate,      // Internal event type
  ContentHeadersExternal          // External event type
>({
  dataSourceKey: 'mtw.assets.contentHeaders',
  
  // Use the actual serializer from mtw-interfaces directly
  serializer: serializer,
  
  // Aggregation uses the actual aggregator from mtw-interfaces
  aggregation: {
    // Create empty state
    createEmptyView: () => {
      return aggregator.createEmpty()
    },
    
    // Apply a single event to the snapshot
    applyEvent: (snapshot: ContentHeadersSnapshot, event: ContentHeadersEventUpdate) => {
      const result = aggregator.applyUpdate(snapshot, event)
      if (result.success) {
        return result.snapshot
      } else {
        console.error('Failed to apply event:', result.error)
        return snapshot // Return unchanged on error
      }
    },
    
    // Apply multiple events in sequence
    applyEvents: (snapshot: ContentHeadersSnapshot, events: ContentHeadersEventUpdate[]) => {
      return events.reduce((currentSnapshot, event) => {
        const result = aggregator.applyUpdate(currentSnapshot, event)
        return result.success ? result.snapshot : currentSnapshot
      }, snapshot)
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
Each data source provides its own selectors:

```typescript
// Content headers selectors
const selectContentHeaders = (state: RootState) => state.contentHeaders
const selectContentHeadersView = (state: RootState, streamKey: string) => 
  state.contentHeaders.subscriptions[streamKey]?.materializedView
const selectContentHeadersStatus = (state: RootState, streamKey: string) =>
  state.contentHeaders.subscriptions[streamKey]?.status

// Usage in components
const ContentHeadersComponent = () => {
  const contentHeaders = useSelector(selectContentHeaders)
  const headersView = useSelector((state) => selectContentHeadersView(state, 'content-headers'))
  const status = useSelector((state) => selectContentHeadersStatus(state, 'content-headers'))
  
  // Component logic...
}
```

#### **Redux Actions**
Each data source provides its own actions:

```typescript
// Content headers actions
const {
  subscribe: subscribeToContentHeaders,
  unsubscribe: unsubscribeFromContentHeaders,
  processRawSnapshot: processContentHeadersSnapshot,
  processRawEvent: processContentHeadersEvent,
  setConnectionStatus: setContentHeadersConnectionStatus,
  setError: setContentHeadersError
} = contentHeadersSlice.actions

// Usage in components
const dispatch = useDispatch()

// Subscribe to stream
const handleSubscribe = () => {
  dispatch(subscribeToContentHeaders(['global']))
}

// Unsubscribe from stream
const handleUnsubscribe = () => {
  dispatch(unsubscribeFromContentHeaders(['global']))
}

// Process incoming WebSocket messages
// (typically handled by middleware, not direct component usage)
const handleWebSocketMessage = (message: any) => {
  if (message.type === 'Snapshot Generated') {
    dispatch(processContentHeadersSnapshot({
      streamKey: 'global',
      rawSnapshot: message as ContentHeadersSnapshotExternal
    }))
  } else if (message.type === 'Headers Updated' || message.type === 'Zone Updated') {
    dispatch(processContentHeadersEvent({
      streamKey: 'global',
      rawEvent: message as ContentHeadersExternal
    }))
  }
}
```

## Implementation Plan

### **Phase 1: Generic Slice Creator (Week 1)**
- **Generic Slice Factory**: Create `createDataSourceSlice` function
- **Type Safety**: Generic types for data, snapshots, and events
- **Basic Reducers**: Subscription, event processing, and connection management
- **Configuration Interface**: Deserializer and aggregation configuration

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
- [ ] Generic slice creator works for multiple data sources
- [ ] Each data source has its own Redux slice with type safety
- [ ] Can subscribe/unsubscribe to multiple stream keys per data source
- [ ] Receives and deserializes events using `mtw-interfaces` deserializers
- [ ] Maintains materialized views of current state per data source
- [ ] Handles out-of-order events correctly with data source specific aggregation
- [ ] Integrates with Redux for state management
- [ ] Provides easy access via data source specific Redux selectors

### **Performance Requirements**
- [ ] Efficient aggregation without excessive re-computation
- [ ] Memory usage stays within bounds (30-second window per data source)
- [ ] Real-time updates with minimal latency
- [ ] Graceful handling of connection issues
- [ ] Shared WebSocket service for efficient connection management

### **Integration Requirements**
- [ ] Works with `mtw.assets.contentHeaders` DataSource
- [ ] Compatible with existing Redux patterns
- [ ] Extensible for future data sources (character data, room data, etc.)
- [ ] Type-safe throughout the system
- [ ] Follows `stateSeekingMachine` pattern for consistency
- [ ] Deserialization and aggregation logic implemented in `mtw-interfaces`
- [ ] Client-side slices consume logic from `mtw-interfaces` rather than implementing it locally

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
