# Data Source Prototype - Client-Side Requirements

**Status: ACTIVE DEVELOPMENT DOCUMENT**

This document outlines the requirements and design patterns for implementing client-side data source management in the Make The World frontend. The data source system enables real-time subscription to backend data streams with intelligent caching and materialized view management.

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
interface DataSourceSliceConfig<TData, TSnapshot, TEvent> {
  dataSourceKey: string
  deserializer: DataSourceDeserializer<TSnapshot, TEvent>
  aggregation: DataSourceAggregation<TData, TSnapshot, TEvent>
  initialState?: Partial<DataSourceState<TData>>
}

// Create a data source slice
const createDataSourceSlice = <TData, TSnapshot, TEvent>(
  config: DataSourceSliceConfig<TData, TSnapshot, TEvent>
) => {
  // Returns a Redux slice with data source specific behavior
}
```

### **Data Source Slice Structure**

Each data source gets its own slice with the following structure:

```typescript
// Generic data source state
interface DataSourceState<TData> {
  subscriptions: {
    [streamKey: string]: {
      status: 'subscribed' | 'pending' | 'error'
      lastUpdate: number
      materializedView: TData
      recentEvents: TEvent[]
      error?: string
    }
  }
  connection: {
    status: 'connected' | 'disconnected' | 'connecting'
    lastHeartbeat: number
  }
}

// Data source slice creator
const createDataSourceSlice = <TData, TSnapshot, TEvent>(
  config: DataSourceSliceConfig<TData, TSnapshot, TEvent>
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
    } as DataSourceState<TData>,
    reducers: {
      // Subscription management
      subscribe: (state, action: PayloadAction<string[]>) => { /* ... */ },
      unsubscribe: (state, action: PayloadAction<string[]>) => { /* ... */ },
      
      // Event processing
      processSnapshot: (state, action: PayloadAction<{streamKey: string, snapshot: TSnapshot}>) => { /* ... */ },
      processStreamingEvent: (state, action: PayloadAction<{streamKey: string, event: TEvent}>) => { /* ... */ },
      
      // Connection management
      setConnectionStatus: (state, action: PayloadAction<'connected' | 'disconnected' | 'connecting'>) => { /* ... */ },
      
      // Error handling
      setError: (state, action: PayloadAction<{streamKey: string, error: string}>) => { /* ... */ }
    }
  })
}
```

### **Data Source Configuration**

Each data source is configured with specific deserializers and aggregation logic:

```typescript
// Deserializer interface
interface DataSourceDeserializer<TSnapshot, TEvent> {
  deserializeSnapshot(rawSnapshot: any): TSnapshot | null
  deserializeEvent(rawEvent: any): TEvent | null
  validateSnapshot(snapshot: any): boolean
  validateEvent(event: any): boolean
}

// Aggregation interface
interface DataSourceAggregation<TData, TSnapshot, TEvent> {
  aggregateSnapshotAndEvents(snapshot: TSnapshot, events: TEvent[]): TData
  mergeViews(view1: TData, view2: TData): TData
  reorderAndAggregate(events: TEvent[]): TEvent[]
  createEmptyView(): TData
}
```

### **Example: Content Headers Data Source**

Here's how to create a content headers data source slice:

```typescript
// Content headers specific types
interface ContentHeadersData {
  assets: {
    [assetId: string]: {
      zone: 'Canon' | 'Library' | 'Personal'
      components: {
        [componentId: string]: {
          shortName: string
          type: 'Room' | 'Feature' | 'Knowledge' | 'Character'
          parentId?: string
        }
      }
    }
  }
  lastUpdated: number
}

interface ContentHeadersSnapshot {
  assets: ContentHeadersData['assets']
  timestamp: number
}

interface ContentHeadersEvent {
  type: 'Component Updated' | 'Component Removed'
  component: any
  timestamp: number
}

// Create the content headers slice
const contentHeadersSlice = createDataSourceSlice<ContentHeadersData, ContentHeadersSnapshot, ContentHeadersEvent>({
  dataSourceKey: 'mtw.assets.contentHeaders',
  deserializer: {
    deserializeSnapshot: (raw) => {
      // Deserialize using mtw-interfaces
      return raw ? { assets: raw.assets, timestamp: raw.timestamp } : null
    },
    deserializeEvent: (raw) => {
      // Deserialize using AssetsEventSerializer
      return raw ? { type: raw.type, component: raw.component, timestamp: raw.timestamp } : null
    },
    validateSnapshot: (snapshot) => Boolean(snapshot?.assets),
    validateEvent: (event) => Boolean(event?.type && event?.component)
  },
  aggregation: {
    aggregateSnapshotAndEvents: (snapshot, events) => {
      let result = { ...snapshot.assets }
      
      // Apply events in chronological order
      const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp)
      for (const event of sortedEvents) {
        result = applyEventToAssets(result, event)
      }
      
      return {
        assets: result,
        lastUpdated: Math.max(snapshot.timestamp, ...events.map(e => e.timestamp))
      }
    },
    mergeViews: (view1, view2) => ({
      assets: { ...view1.assets, ...view2.assets },
      lastUpdated: Math.max(view1.lastUpdated, view2.lastUpdated)
    }),
    reorderAndAggregate: (events) => {
      return events
        .sort((a, b) => a.timestamp - b.timestamp)
        .filter((event, index, array) => 
          index === 0 || event.timestamp !== array[index - 1].timestamp
        )
    },
    createEmptyView: () => ({ assets: {}, lastUpdated: 0 })
  }
})
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
  processSnapshot: processContentHeadersSnapshot,
  processStreamingEvent: processContentHeadersEvent,
  setConnectionStatus: setContentHeadersConnectionStatus
} = contentHeadersSlice.actions

// Usage in components
const dispatch = useDispatch()

const handleSubscribe = () => {
  dispatch(subscribeToContentHeaders(['content-headers']))
}

const handleUnsubscribe = () => {
  dispatch(unsubscribeFromContentHeaders(['content-headers']))
}
```

## Implementation Plan

### **Phase 1: Generic Slice Creator (Week 1)**
- **Generic Slice Factory**: Create `createDataSourceSlice` function
- **Type Safety**: Generic types for data, snapshots, and events
- **Basic Reducers**: Subscription, event processing, and connection management
- **Configuration Interface**: Deserializer and aggregation configuration

### **Phase 2: WebSocket Integration (Week 2)**
- **Shared WebSocket Service**: Connection management for all data sources
- **Message Routing**: Route messages to appropriate data source slices
- **Reconnection Logic**: Handle connection failures and reconnection
- **Middleware Integration**: Connect WebSocket service to Redux actions

### **Phase 3: Content Headers Implementation (Week 3)**
- **Content Headers Slice**: Create content headers data source slice
- **Deserializer Integration**: Use `AssetsEventSerializer` from `mtw-interfaces`
- **Aggregation Logic**: Implement content headers specific aggregation
- **UI Components**: Create components that consume content headers data
- **Testing**: Comprehensive testing of subscription and aggregation logic

### **WebSocket Integration**

#### **Shared WebSocket Service**
A shared WebSocket service manages connections for all data sources:

```typescript
// WebSocket service for data source subscriptions
class DataSourceWebSocketService {
  private ws: WebSocket | null = null
  private subscribers: Map<string, Set<string>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  
  connect(): Promise<void> {
    // Connect to backend subscription service
  }
  
  subscribe(dataSourceKey: string, streamKeys: string[]): void {
    // Send subscription request
  }
  
  unsubscribe(dataSourceKey: string, streamKeys: string[]): void {
    // Send unsubscription request
  }
  
  private handleMessage(event: MessageEvent): void {
    // Route messages to appropriate data source slices
  }
  
  private handleReconnect(): void {
    // Handle reconnection logic
  }
}

// Singleton instance
export const dataSourceWebSocket = new DataSourceWebSocketService()
```

#### **Data Source Middleware**
Middleware handles WebSocket integration for each data source:

```typescript
// Data source middleware
const createDataSourceMiddleware = (dataSourceKey: string) => {
  return (store: MiddlewareAPI) => (next: Dispatch) => (action: AnyAction) => {
    const result = next(action)
    
    // Handle subscription actions
    if (action.type === `${dataSourceKey}/subscribe`) {
      dataSourceWebSocket.subscribe(dataSourceKey, action.payload)
    }
    
    if (action.type === `${dataSourceKey}/unsubscribe`) {
      dataSourceWebSocket.unsubscribe(dataSourceKey, action.payload)
    }
    
    return result
  }
}
```

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

## Dependencies

### **Backend Dependencies**
- **Subscriptions Lambda**: Must be operational for subscription management
- **Data Sources**: `mtw.assets.contentHeaders` and other data sources must be available
- **WebSocket Service**: Real-time event delivery infrastructure

### **Frontend Dependencies**
- **Redux Store**: State management infrastructure
- **mtw-interfaces**: Event deserialization and type definitions
- **WebSocket Client**: Real-time communication capability
- **stateSeekingMachine**: Pattern for generic slice creation

### **External Dependencies**
- **TypeScript**: Type safety and interface definitions
- **Redux Toolkit**: Modern Redux patterns and utilities
- **WebSocket API**: Browser WebSocket support
- **Generic Programming**: TypeScript generics for slice factory pattern

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
