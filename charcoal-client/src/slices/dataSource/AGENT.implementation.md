# Data Source Slice - Implementation Guide

**Purpose**: Practical guide for implementing data source instances and developing the pattern itself.

**For User Documentation**: See [AGENT.md](./AGENT.md)

---

## Guide 1: Implementing a New Data Source Instance

This section helps you create a specific data source slice (like `contentHeaders`) using the generic pattern.

### **Prerequisites**

Before creating the frontend slice, ensure the backend DataSource work is complete:

1. **Backend DataSource**: Implemented in the appropriate lambda (see `packages/mtw-lambda-patterns/ts/dataSource/`)
2. **Event Contracts**: Types, serializers, and aggregators defined in `mtw-interfaces/ts/eventBridge/[dataSource]/`
3. **Subscriptions Lambda**: Configured to route events for your `dataSourceKey`

**See**: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) for backend implementation guide.

**Discovering existing implementations**: To find frontend slices, use `rg "createDataSourceSlice"` or `rg "dataSourceKey:"` in `src/slices/`. For backend and EventBridge discovery (envelope unions, serializers, lambda DataSources), see [mtw-lambda-patterns AGENT.implementation.md](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) and [mtw-interfaces EventBridge AGENT.implementation.md](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md).

### **Step 1: Import Shared Logic**

Import the aggregator, serializer, and types from `mtw-interfaces`:

```typescript
import {
  MyDataSourceAggregator,
  MyDataSourceEventSerializer,
  MySnapshot,
  MyUpdate,
  MyExternalSnapshot,
  MyExternalUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/myDataSource'
```

**Key Point**: The aggregator and serializer are already implemented in the shared interface layer. You're just importing and using them.

### **Step 2: Create Type Guards**

Define functions to distinguish snapshots from updates:

```typescript
export const isMySnapshot = (event: MySnapshot | MyUpdate): event is MySnapshot => {
  return event.type === 'Snapshot Generated'
}

export const isMyUpdate = (event: MySnapshot | MyUpdate): event is MyUpdate => {
  return event.type !== 'Snapshot Generated'
}
```

**Pattern**: Usually based on event type field.

### **Step 3: Create the Slice**

Call the factory function with your configuration:

```typescript
import { createDataSourceSlice } from '../dataSource'

export const {
  slice: myDataSourceSlice,
  selectors: myDataSourceSelectors,
  publicActions: myDataSourceActions,
  iterateAllSSMs: iterateMyDataSource
} = createDataSourceSlice({
  name: 'myDataSource',
  dataSourceKey: 'my.data.source',  // Must match backend
  aggregator: MyDataSourceAggregator,  // From mtw-interfaces
  eventSerializer: MyDataSourceEventSerializer,  // From mtw-interfaces
  isSnapshot: isMySnapshot,
  isUpdate: isMyUpdate,
  sliceSelector: (state) => state.myDataSource
})
```

**Important**: The `dataSourceKey` must exactly match what the backend uses and what the subscriptions lambda routes.

### **Step 4: Add to Redux Store**

Register your slice in the store configuration:

```typescript
// In store/index.ts
import { myDataSourceSlice } from '../slices/myDataSource'

export const store = configureStore({
  reducer: {
    // ... other reducers
    myDataSource: myDataSourceSlice.reducer
  }
})
```

### **Step 5: Register with State Machine Hook**

**Critical Step**: Add your iterator to the `useStateSeekingMachines` hook so the state machine gets processing cycles:

```typescript
// In components/useSSM.ts
import { iterateMyDataSource } from '../slices/myDataSource'

export const useStateSeekingMachines = () => {
  const dispatch = useDispatch()
  const heartbeat = useSelector(getSliceHeartbeat)
  useEffect(() => {
    // ... other SSM dispatches
    dispatch(iterateMyDataSource)  // Add your iterator here
  }, [dispatch, heartbeat])
}
```

**Why This Matters**: Without registering here, your state machine will never transition states. It will remain stuck at `INITIAL`. The `useStateSeekingMachines` hook is called from the app root and dispatches all SSM iterators whenever the heartbeat changes.

### **Step 6: Use in Components**

Access your data source in React components:

```typescript
import { useSelector } from 'react-redux'
import { myDataSourceSelectors } from '../slices/myDataSource'

function MyComponent() {
  const subscribedStreams = useSelector(myDataSourceSelectors.getSubscribedStreams)
  const streamData = subscribedStreams['my-stream-key']?.materializedView
  
  // Use streamData in your component
}
```

**That's It!** The generic pattern handles all the lifecycle management, WebSocket integration, out-of-order events, and error handling automatically.

### **Summary: Frontend vs Backend Work**

**Backend Work** (see `mtw-lambda-patterns` documentation):
- Implement DataSource in lambda
- Define event types, aggregator, and serializer in `mtw-interfaces`
- Configure subscriptions lambda routing

**Frontend Work** (this guide):
- Import shared logic from `mtw-interfaces`
- Create type guards (frontend-specific)
- Call `createDataSourceSlice` factory
- Wire into Redux store
- Use in components

The heavy lifting (event processing, aggregation logic, serialization) is already done in the shared layer. The frontend slice just configures how to use it.

---

## Guide 2: Developing the Pattern Itself

This section helps you understand and extend the generic `dataSource` pattern.

### **Architecture Overview**

The pattern is split across several files with clear responsibilities:

```
dataSource/
├── baseClasses.ts       # Type definitions and interfaces
├── index.api.ts         # Action factories (INITIALIZE, SUBSCRIBE, UNSUBSCRIBE)
├── index.ts             # Main factory using singleSSM
├── reducers.ts          # Event processing logic (curried functions)
├── reducers.test.ts     # Unit tests for event processing
└── index.test.ts        # Integration tests for slice creation
```

### **Key Design Patterns**

#### **1. Curried Functions for Configuration Injection**

The event processing functions use currying to inject configuration:

```typescript
// Pattern: Outer function takes config, returns reducer
const processRawEnvelope = (aggregator, serializer, ...) => 
  (state, action) => {
    // Reducer logic with access to config; branches on header.type
  }
```

**Why**: Allows configuration to be "baked in" at slice creation time while keeping reducers pure.

#### **2. Pure Functions Throughout**

All event processing is deterministic:
- ❌ No `Date.now()` - timestamps come from action payloads
- ❌ No side effects - only state transformations
- ✅ Testable with simple inputs and outputs

**Why**: Easier testing, debugging, and reasoning about behavior.

#### **3. State Machine for Lifecycle**

Uses `singleSSM` pattern for all subscription lifecycle:
- Automatic retry with backoff
- Clear state transitions
- Terminal error states

**Why**: Eliminates manual state tracking and ensures consistent behavior.

#### **4. Contract and Guarantees**

The pattern operates under specific assumptions and provides corresponding guarantees:

**Assumptions** (what the pattern expects):
- Events arrive within 30 seconds of their timestamp
- Events include accurate backend-generated timestamps
- Aggregator is deterministic (same events in same order → same result)

**Guarantees** (what the pattern promises):
- Eventually consistent state despite out-of-order delivery
- Bounded memory usage (30-second rolling window per stream)
- Correct chronological ordering based on event timestamps
- Efficient processing for common in-order case (O(1) fast path)

**Why This Matters**: Violating assumptions (e.g., extreme delays, missing timestamps) may break guarantees. When developing the pattern or backend integration, keep these contracts in mind.

#### **5. Header/Content Envelope Shape**

The client mirrors the server-side header/content split:

- LifeLine delivers `StreamEvent` messages with `streamKey`, `timestamp`, `eventType`, and `update`.
- The client derives a `ClientStreamingHeader` from `eventType` (and optional `zone`) and treats `update` as `content`.
- `processRawEnvelope` receives payloads shaped as `{ streamKey, timestamp, header, content }` (see [baseClasses.ts](./baseClasses.ts): `ClientStreamingMessagePayload`).
- Routing uses `header.type === 'Snapshot'` vs other types; the reducer calls `deserializeSnapshot(content)` for snapshots or `deserialize({ content, header })` for events.

### **Key Implementation Areas**

When extending the pattern, you'll likely work in these areas:

#### **Event Processing (`reducers.ts`)**

Three main functions handle event processing:

1. **`applyEvents`**: Helper to apply multiple updates in order
2. **`performCleanup`**: Manages 30-second rolling window (uses `header.type` for snapshot vs update discrimination)
3. **`processRawEnvelope`**: Handles incoming snapshots and events; branches on `header.type === 'Snapshot'` to deserialize and apply (in-order fast path, out-of-order re-aggregation)

**Critical Algorithm**: Out-of-order event handling
- **Fast path**: New event is later than all cached events → apply directly
- **Re-aggregation path**: New event is earlier → re-aggregate from latest snapshot

**See**: `AGENT.planning.md` lines 872-1006 for detailed algorithm explanation.

#### **State Machine Actions (`index.api.ts`)**

Three action factories manage lifecycle:

1. **`createInitializeAction`**: Subscribe to LifeLinePubSub
2. **`createSubscribeAction`**: Call backend API to subscribe
3. **`createUnsubscribeAction`**: Call backend API to unsubscribe

**Safety Pattern**: Subscribe/unsubscribe throw errors if called before initialization completes.

#### **Sidecar Snapshot Handling**

Snapshot events may carry a **`sidecarUrl`** instead of an inline payload (backend sends a presigned URL; the client fetches the body). Resolution happens **before** the reducer runs:

1. **LifeLine callback** receives the StreamEvent, builds `envelopePayload`, and dispatches whatever `processRawEnvelope` (the wrapper) returns. Redux Thunk middleware executes async thunks.
2. **Wrapper** (in `index.ts`): Always returns an async thunk that (a) awaits deserialize or `createGetContentInternal` when available, (b) dispatches `processRawEnvelope` with resolved internal content. For sidecar snapshots, the thunk first awaits `resolveSidecarSnapshot`, then deserializes the external payload. If `sidecarUrl` is present but no resolver is configured, the wrapper logs a warning and returns undefined.
3. **Reducer** (`reducers.ts`) expects pre-resolved internal content; deserialization happens only in the thunk.

Data sources that use sidecar (e.g. mtw.wml) set **`resolveSidecarSnapshot`** in the slice config; it should fetch the URL, parse the response (e.g. JSON or WML), and return the same `ExternalSnapshotPayload` shape that `deserializeSnapshot` expects.

#### **Slice Factory (`index.ts`)**

Main factory function that:
- Defines state machine template
- Wires up actions and reducers
- Returns slice, selectors, and public actions

**Extension Point**: Add new public reducers or selectors here.

### **Testing Strategy**

#### **Unit Tests (`reducers.test.ts`)**

Test event processing logic in isolation:
- Mock aggregator and serializer
- Test with controlled timestamps
- Cover in-order, out-of-order, and error cases

**Run**: `npm test -- src/slices/dataSource/reducers.test.ts`

#### **Integration Tests (`index.test.ts`)**

Test slice creation and configuration:
- Verify slice structure
- Check initial state
- Validate selectors and actions

**Run**: `npm test -- src/slices/dataSource/index.test.ts`

#### **Testing Pattern Development**

When adding new functionality:
1. Write unit tests for pure functions first
2. Add integration tests for slice configuration
3. Use mock Redux store for state machine testing

### **Common Extension Points**

#### **Adding New Public Actions**

1. Define action in `index.ts` under `publicReducers`
2. Inject configuration via currying
3. Add tests in `reducers.test.ts`

#### **Adding New Selectors**

1. Define selector in `index.ts` under `publicSelectors`
2. Use for derived state or computed values
3. Document in `AGENT.md` if user-facing

#### **Modifying Event Processing**

1. Edit helper functions in `reducers.ts`
2. Update unit tests in `reducers.test.ts`
3. Consider impact on out-of-order handling

**Warning**: Event processing is complex - small changes can affect correctness. Always run full test suite.

### **Debugging Tips**

#### **Event Processing Issues**

Enable debug logging in reducers:
```typescript
console.log(`[${dataSourceKey}] Processing event:`, {
  streamKey,
  timestamp,
  recentEvents: recentEvents.length
})
```

#### **State Machine Issues**

Check current state:
```typescript
const state = useSelector(myDataSourceSelectors.getStatus)
console.log('Current state:', state)
```

#### **Out-of-Order Events**

Log event timestamps to verify ordering:
```typescript
const events = subscribedStreams[streamKey]?.recentEvents
console.log('Event timeline:', events?.map(e => e.timestamp).sort())
```

### **Performance Considerations**

#### **Memory Usage**

The 30-second window bounds memory per stream:
- Each stream: ~30s of events
- Cleanup happens automatically on each event
- Old events consolidated into synthetic snapshots

**Optimization**: If memory is critical, reduce window size in `performCleanup`.

#### **Re-Aggregation Cost**

Out-of-order events trigger re-aggregation:
- Cost: O(n) where n = events in window
- Bounded by 30-second window
- Common case (in-order) is O(1)

**Optimization**: If aggregation is expensive, consider batch processing in aggregator.

### **Integration with Backend**

The pattern expects backend to provide:

1. **EventBridge Events**: Via subscriptions lambda and LifeLinePubSub
2. **Timestamps**: Backend-generated timestamps in each message
3. **Stream Keys**: Consistent stream key format

**See**: `lambda/subscriptions/` for backend integration details.

---

## File-by-File Guide

Quick reference for what each file does:

### **`baseClasses.ts`**
- Type definitions for state machine
- Interfaces for internal and public data
- Import point for type checking

### **`index.api.ts`**
- Action factories for state machine transitions
- LifeLine condition for INITIAL state
- Safety checks for lifecycle guarantees

### **`index.ts`**
- Main `createDataSourceSlice` factory
- State machine template definition
- Public reducer and selector configuration

### **`reducers.ts`**
- Core event processing logic
- Curried helper functions
- Pure functions for testability

### **`reducers.test.ts`**
- Comprehensive unit test coverage
- Mock aggregator and serializer
- Tests for all event processing paths

### **`index.test.ts`**
- Integration tests for slice creation
- Validates configuration and structure
- Tests public API surface

---

## Quick Reference: Common Tasks

### **Creating a New Instance**
→ Follow Guide 1 above

### **Adding a New Feature to the Pattern**
1. Identify extension point (reducer, action, selector)
2. Add tests first
3. Implement feature
4. Update `AGENT.md` if user-facing

### **Debugging Event Processing**
1. Check `recentEvents` in Redux DevTools
2. Add logging in `reducers.ts`
3. Verify timestamps are correct

### **Understanding Out-of-Order Handling**
→ Read `reducers.ts` `processRawEnvelope` function
→ See `AGENT.planning.md` lines 872-1006 for algorithm details

### **Modifying State Machine Flow**
→ Edit state machine template in `index.ts`
→ Update `AGENT.md` state machine diagram

---

## Related Documentation

- **[User Guide](./AGENT.md)**: High-level functionality and usage
- **[Planning History](./AGENT.planning.md)**: Development process and decisions
- **[Backend DataSource Pattern](../../../packages/mtw-lambda-patterns/ts/dataSource/)**: Backend counterpart

---

*Last Updated: 2025-10-11*
