# Data Source Slice - Generic Pattern

**Purpose**: Generic Redux slice pattern for managing real-time subscriptions to backend data sources with intelligent caching and materialized view management.

**Status**: ✅ Production Ready (23/23 tests passing)

## What It Does

The `dataSource` slice provides a reusable pattern for creating type-safe Redux slices that:

1. **Manage Subscription Lifecycle** - Subscribe and unsubscribe to backend data streams with automatic retry and error handling
2. **Process Real-Time Events** - Deserialize and aggregate incoming WebSocket events into materialized views
3. **Handle Out-of-Order Delivery** - Correctly process events that arrive out of chronological order
4. **Bound Memory Usage** - Maintain a 30-second rolling window of recent events per stream
5. **Integrate with WebSocket** - Automatically connect to LifeLinePubSub for message delivery

## Why It Exists

Backend services publish real-time data through DataSource patterns (see `@tonylb/mtw-lambda-patterns`). The frontend needs a consistent way to:
- Subscribe to specific data streams (e.g., asset headers for a particular asset)
- Receive and process events as they occur
- Maintain an accurate view of current state
- Handle network issues and reconnection gracefully

Rather than reimplementing this logic for each data source, this generic pattern provides a factory function that creates fully-featured slices with minimal configuration.

## How to Use It

### **Creating a Data Source Slice**

```typescript
import { createDataSourceSlice } from './dataSource'
import { MyAggregator, MySerializer } from './my-data-source-logic'

// Create a slice for your specific data source
export const {
  slice,           // Redux slice with state machine
  selectors,       // getActiveStreamKeys, getSubscribedStreams
  publicActions,   // processEnvelope
  iterateAllSSMs   // State machine iterator
} = createDataSourceSlice({
  name: 'myDataSource',
  dataSourceKey: 'my.data.source',
  aggregator: MyAggregator,
  eventSerializer: MySerializer,
  sliceSelector: (state) => state.myDataSource
})
```

### **Configuration Parameters**

- **`name`**: Unique name for the Redux slice
- **`dataSourceKey`**: Backend data source identifier (e.g., `'mtw.assets.contentHeaders'`)
- **`aggregator`**: Object with `createEmpty(streamKey)` and `applyUpdate()` methods for aggregating events
- **`eventSerializer`**: Object with `serialize()` and `deserialize()` methods (handles both events and snapshots via `header.type`)
- **`sliceSelector`**: Function to select this slice from root state

### **Using the Slice**

The created slice automatically handles:
- ✅ WebSocket connection via LifeLinePubSub (INITIAL → INITIALIZE → READY states)
- ✅ Backend subscription management (READY → SUBSCRIBE → SUBSCRIBED)
- ✅ Event deserialization and aggregation
- ✅ Out-of-order event handling with timestamp-based re-aggregation
- ✅ Memory-bounded caching (30-second window)
- ✅ Automatic retry with exponential backoff on failures
- ✅ Terminal error states for unrecoverable failures

## State Machine Flow

```
INITIAL (wait for LifeLine CONNECTED)
  ↓
INITIALIZE (subscribe to LifeLinePubSub)
  ↓
READY (idle, waiting for subscription requests)
  ↓
SUBSCRIBE (subscribing to backend)
  ↓
SUBSCRIBED (receiving real-time updates)
  ↓
UNSUBSCRIBE (cleaning up subscription)
  ↓
READY (back to idle)
```

**Error Handling**:
- `INITIALIZEERROR`: Terminal state for local infrastructure failures
- `SUBSCRIBEERROR`: Terminal state for repeated backend subscription failures
- Automatic retry with backoff for transient failures

### **Error States and User Experience**

The pattern uses two distinct terminal error states with different recovery strategies and user communication needs:

#### **INITIALIZEERROR - Local Infrastructure Failure**
- **Cause**: LifeLinePubSub subscription failed during initialization
- **Meaning**: Critical client-side infrastructure problem
- **Recovery**: Requires page reload or indicates a serious bug
- **User Experience**: "Application error, please reload the page"
- **No Automatic Retry**: Retrying the same local operation won't help

#### **SUBSCRIBEERROR - Backend Subscription Failure**
- **Cause**: Backend API calls failed after multiple retries with exponential backoff
- **Meaning**: Cannot communicate with subscription service (network, auth, or backend issues)
- **Recovery**: Backend might recover, network might improve
- **User Experience**: "Unable to connect to service, please try again later"
- **Has Retry**: Goes through SUBSCRIBEBACKOFF with exponential backoff before reaching terminal state

**Design Benefits**:
- **Clear Error Semantics**: Infrastructure vs. network/backend failures
- **Appropriate Recovery Strategies**: Different remediation for different failure types
- **Better User Communication**: More accurate error messages based on failure type

## Architecture

The pattern builds on several key technologies:

- **`singleSSM`**: State-seeking machine pattern for lifecycle management
- **`LifeLinePubSub`**: WebSocket message delivery infrastructure  
- **`@tonylb/mtw-lambda-patterns`**: Shared types for aggregation and serialization
- **Redux Toolkit**: State management with immer for immutable updates

## Design Philosophy

### **Safety and Lifecycle Guarantees**

The pattern enforces strict lifecycle ordering through multiple safety mechanisms:

**INITIAL HOLD State**:
- Waits for LifeLine WebSocket to reach CONNECTED state before initialization
- Prevents backend subscription API calls before WebSocket connection is ready
- Follows established patterns from other slices that depend on real-time infrastructure

**Initialization Guards**:
- Runtime safety checks in subscribe/unsubscribe actions
- Throws errors if called before INITIALIZE state completes
- Prevents premature backend calls, state machine bypass, and race conditions

**Benefits**:
- **Type Safety**: Compile-time state machine structure validation
- **Runtime Safety**: Guards prevent premature backend calls
- **Clear Errors**: Descriptive error messages identify lifecycle violations
- **Pattern Consistency**: Follows established lifecycle patterns across the codebase

## Key Features

### **Sidecar Snapshot Handling**

Snapshot events from the backend may contain inline payloads or domain-shaped sidecar descriptors (e.g. a field whose value is `{ sidecarUrl: string }`). The slice passes raw `content` and `header` to `eventSerializer.deserialize({ content, header })`; the serializer routes on `header.type` and for snapshots performs any sidecar fetch and resolution internally when configured with a `DataSourceEnvironment` (e.g. browser fetch). Timestamp-based ordering (ignore events before snapshot, apply events after) works unchanged.

### **Out-of-Order Event Handling**

Events may arrive out of chronological order due to network conditions. The pattern handles this by:

1. **Timestamps**: All events include backend-generated timestamps (not client arrival time)
2. **Fast Path**: If an event is newer than all cached events, apply it directly to the materialized view
3. **Re-aggregation**: If an event is older than cached events, re-aggregate from the latest snapshot plus all subsequent events in timestamp order
4. **Window Cleanup**: Events older than 30 seconds are consolidated into a synthetic snapshot to bound memory

### **Pure Functions**

All event processing logic uses pure functions that depend only on their inputs:
- No `Date.now()` calls - timestamps come from event payloads
- Deterministic behavior for testing and debugging
- Easy to reason about and maintain

### **Type Safety**

Full TypeScript support with generics:
```typescript
createDataSourceSlice<
  SnapshotPayload,      // Internal snapshot type
  UpdatePayload,        // Internal update event type
  ExternalSnapshotPayload,   // External snapshot format
  ExternalUpdatePayload      // External update format
>(config)
```

## Examples

See these implementations using this pattern:

- **Content Headers**: `../contentHeaders/` - First implementation for asset header data
- **Thinking Jobs**: `../thinkingJobs/` - `mtw.ephemera.thinking.scheduling` / stream `global` (`Job Completed` + snapshot replay)
- **More Coming**: Character data, room data, etc.

## Future Enhancements

The generic pattern is complete and production-ready. Future enhancements could include:

### **Additional Data Sources**
- **Character Data**: Real-time character state updates
- **Room Data**: Live room information and updates  
- **Asset Metadata**: Complete asset information and relationships

### **Advanced Features**
- **Conflict Resolution**: Handle conflicting updates from multiple sources
- **Optimistic Updates**: Support for optimistic UI updates before server confirmation
- **Offline Support**: Graceful degradation when disconnected with queue-and-replay
- **Performance Monitoring**: Built-in metrics and performance tracking
- **Data Source Composition**: Combine multiple data sources into unified views
- **Custom Aggregation Strategies**: User-defined aggregation functions for specialized use cases
- **Batch Subscriptions**: Optimize subscribing to multiple related streams simultaneously

## Documentation

- **[Implementation Guide](./AGENT.implementation.md)**: Technical overview of the codebase
- **[Planning History](./AGENT.planning.md)**: Historical record of development process
- **[Content Headers Slice](../contentHeaders/AGENT.md)**: First concrete implementation

## Related Documentation

- **[Main Project](../../../AGENT.md)**: Complete project overview
- **[Development Roadmap](../../../AGENT.development.md)**: Current architecture evolution
- **[Backend DataSource Pattern](../../../packages/mtw-lambda-patterns/ts/dataSource/)**: Backend counterpart

---

*For technical implementation details, see [AGENT.implementation.md](./AGENT.implementation.md)*
