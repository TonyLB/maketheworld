# Content Headers Data Source Slice

## Overview

This slice implements a specific data source using the generic `dataSource` pattern. It manages real-time subscriptions to content headers data, maintaining materialized views of header information for assets in the Make The World system.

## Purpose

The Content Headers slice demonstrates the practical application of the generic `dataSource` pattern by:
- Managing subscriptions to `mtw.assets.contentHeaders` data source
- Deserializing content header events using `mtw-interfaces` deserializers
- Aggregating header updates into a coherent materialized view
- Providing UI components with access to real-time header data

**Component display labels:** Human-readable component titles in the UI use [`componentDisplayLabel`](../../lib/componentDisplayLabel.ts) (not selectors in this slice). Selectors here expose materialized `StandardForm` data and grouping only.

## Architecture

### **Data Source Configuration**

This slice uses the generic `createDataSourceSlice` factory with content-headers-specific configuration:

```typescript
import { createDataSourceSlice } from '../dataSource'
import { 
  ContentHeadersAggregator,
  ContentHeadersEventSerializer
} from '@tonylb/mtw-interfaces/ts/eventBridge/contentHeaders'

export const {
  slice: contentHeadersSlice,
  selectors: contentHeadersSelectors,
  publicActions: contentHeadersActions,
  iterateAllSSMs: iterateContentHeadersSSMs
} = createDataSourceSlice({
  name: 'contentHeaders',
  dataSourceKey: 'mtw.assets.contentHeaders',
  aggregator: ContentHeadersAggregator,
  eventSerializer: ContentHeadersEventSerializer,
  sliceSelector: (state) => state.contentHeaders
})
```

### **Event Types**

The content headers data source handles these event types:

**Snapshots**:
- `Snapshot Generated`: Complete current state of headers for an asset

**Updates**:
- `Headers Updated`: Changes to header fields
- `Zone Updated`: Changes to zone information

### **Materialized View**

The materialized view represents the current state of content headers:

```typescript
type ContentHeadersMaterializedView = {
  assetId: string
  headers: {
    name?: string
    description?: string
    // ... other header fields
  }
  zones: {
    [zoneId: string]: {
      // zone information
    }
  }
}
```

### **Aggregation Logic**

The aggregator (implemented in `mtw-interfaces`) handles:
- Starting from an empty view or snapshot
- Applying header updates incrementally
- Applying zone updates incrementally
- Maintaining consistency across updates

## Implementation Plan

### **Phase 1: Slice Creation** 📋 PLANNED

**Objectives**:
- Create the content headers slice using the dataSource factory
- Configure with content-headers-specific types and logic
- Set up initial Redux integration

**Tasks**:
- [ ] Create `index.ts` with slice factory invocation
- [ ] Export slice, selectors, and actions
- [ ] Add to Redux store configuration
- [ ] Add to root reducer

**Files to Create**:
- `charcoal-client/src/slices/contentHeaders/index.ts`
- Update `charcoal-client/src/store/index.ts`

### **Phase 2: Subscription Helpers** 📋 PLANNED

**Objectives**:
- Create helper functions for subscribing to asset headers
- Provide easy-to-use API for components

**Tasks**:
- [ ] Create `useContentHeaders` hook for component integration
- [ ] Create `subscribeToAssetHeaders` helper thunk
- [ ] Create `unsubscribeFromAssetHeaders` helper thunk
- [ ] Add TypeScript types for hook return values

**Example Usage**:
```typescript
// In a component
const assetHeaders = useContentHeaders(assetId)

// Programmatic subscription
dispatch(subscribeToAssetHeaders(assetId))
```

### **Phase 3: UI Components** 📋 PLANNED

**Objectives**:
- Create UI components that consume content headers data
- Demonstrate real-time updates in the UI

**Tasks**:
- [ ] Create `AssetHeaderDisplay` component
- [ ] Create `ZoneDisplay` component
- [ ] Add loading states and error handling
- [ ] Add real-time update indicators

**Components**:
- `AssetHeaderDisplay`: Shows asset name, description, and metadata
- `ZoneDisplay`: Shows zone information for an asset
- `HeadersList`: Shows list of headers with live updates

### **Phase 4: Integration Testing** 📋 PLANNED

**Objectives**:
- End-to-end testing of subscription and aggregation
- Verify real-time updates work correctly

**Tasks**:
- [ ] Create integration tests with mock WebSocket
- [ ] Test subscription lifecycle
- [ ] Test out-of-order event handling
- [ ] Test UI component integration
- [ ] Test error handling and recovery

## WebSocket Integration

### **Using Existing LifeLinePubSub Infrastructure**

The content headers slice automatically integrates with `LifeLinePubSub` through the `dataSource` pattern. The generic slice handles:

- ✅ Subscribing to LifeLinePubSub during INITIALIZE state
- ✅ Filtering messages by `dataSourceKey` (`mtw.assets.contentHeaders`)
- ✅ Routing all StreamEvents to `processEnvelope` (snapshot vs event discriminated by `header.type`)
- ✅ Extracting timestamps from messages
- ✅ Managing subscription lifecycle

**Key Benefits**:
- ✅ WebSocket connection already managed by lifeLine state machine
- ✅ Reconnection logic already implemented
- ✅ Message routing pattern already established
- ✅ Works with existing subscription infrastructure
- ✅ No duplicate WebSocket connections needed
- ✅ All handled automatically by the dataSource generic

## State Machine Flow

The content headers slice inherits the state machine from `dataSource`:

```
INITIAL (wait for LifeLine) 
  → INITIALIZE (subscribe to LifeLinePubSub)
  → READY (idle, waiting for subscription requests)
  → SUBSCRIBE (subscribing to backend for specific streamKey)
  → SUBSCRIBED (receiving real-time updates)
  → UNSUBSCRIBE (unsubscribing from backend)
  → READY (back to idle)

Error paths:
  INITIALIZE → INITIALIZEERROR (terminal)
  SUBSCRIBE → SUBSCRIBEBACKOFF → SUBSCRIBE (retry)
  SUBSCRIBE → SUBSCRIBEERROR (terminal after retries)
  UNSUBSCRIBE → UNSUBSCRIBEBACKOFF → UNSUBSCRIBE (retry)
```

## Success Criteria

### **Functional Requirements**
- [ ] Can subscribe to content headers for specific assets
- [ ] Receives and displays real-time header updates
- [ ] Handles out-of-order events correctly
- [ ] Can unsubscribe and clean up resources
- [ ] Provides type-safe API for components
- [ ] Gracefully handles errors and retries

### **Performance Requirements**
- [ ] Real-time updates appear within 100ms of WebSocket delivery
- [ ] Memory usage bounded by 30-second window
- [ ] No unnecessary re-renders in UI components
- [ ] Efficient subscription management (no redundant subscriptions)

### **Integration Requirements**
- [ ] Works with existing Redux store
- [ ] Integrates with LifeLinePubSub
- [ ] Uses deserializers from mtw-interfaces
- [ ] Uses aggregator from mtw-interfaces
- [ ] Type-safe throughout

## Dependencies

### **Backend Dependencies**
- **Subscriptions Lambda**: Must route `mtw.assets.contentHeaders` events
- **Content Headers DataSource**: Must generate snapshots and events
- **WebSocket Service**: Must deliver events to client

### **Frontend Dependencies**
- **dataSource Generic**: The generic slice factory
- **mtw-interfaces**: Content headers types, deserializer, and aggregator
- **Redux Store**: State management
- **LifeLinePubSub**: WebSocket message delivery

### **mtw-interfaces Dependencies**
- **ContentHeadersAggregator**: Aggregation logic for header updates
- **ContentHeadersEventSerializer**: Deserialization of external events
- **Type Definitions**: ContentHeaders types and interfaces
- **Type Guards**: isContentHeadersSnapshot, isContentHeadersUpdate

## Future Extensions

### **Enhanced Features**
- [ ] **Optimistic Updates**: Update UI before server confirmation
- [ ] **Diff Display**: Show what changed in real-time
- [ ] **History View**: Show recent changes to headers
- [ ] **Batch Operations**: Subscribe to multiple assets efficiently

### **Performance Optimizations**
- [ ] **Virtualization**: Handle large numbers of subscribed assets
- [ ] **Memoization**: Cache computed views for better performance
- [ ] **Debouncing**: Batch rapid updates for smoother UI

## Navigation

This document is part of the comprehensive Make The World documentation system:

- **[Data Source Pattern](../dataSource/AGENT.md)**: Generic data source implementation
- **[Main Project Documentation](../../../AGENT.md)**: Complete project overview
- **[Development Roadmap](../../../AGENT.development.md)**: Current migration and architecture evolution

---

*This document serves as the technical specification for implementing the Content Headers data source slice. It should be updated as implementation progresses.*

