# Data Source Slice - Generic Pattern

**Purpose**: Generic Redux slice pattern for managing real-time subscriptions to backend data sources with intelligent caching and materialized view management.

**Status**: Production Ready (lifecycle, WebSocket integration, requestIdTracking, non-destructive event ledger with `CompactedCheckpoint` and `replayCursor` rebase). See [AGENT.implementation.md](./AGENT.implementation.md) **Event Processing**.

## What It Does

The `dataSource` slice provides a reusable pattern for creating type-safe Redux slices that:

1. **Manage Subscription Lifecycle** - Subscribe and unsubscribe to backend data streams with automatic retry and error handling
2. **Process Real-Time Events** - Deserialize and aggregate incoming WebSocket events into materialized views
3. **Handle Out-of-Order Delivery** - Correctly process events that arrive out of chronological order, including subscribe reload when sidecar Snapshots deserialize slowly
4. **Maintain an Event Ledger** - Retain update envelopes and optional merge caches; bound memory via authoritative backend Snapshots and post-rebase pruning (not client time windows)
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
- **`desirableMedian`** (optional, Phase 3): Tail-anchored CP spacing for `CompactedCheckpoint` insertions; default `10`. See [Event ledger model](#event-ledger-model).

### **Using the Slice**

The created slice automatically handles:
- WebSocket connection via LifeLinePubSub (INITIAL -> INITIALIZE -> READY states)
- Backend subscription management (READY -> SUBSCRIBE -> SUBSCRIBED)
- Event deserialization and aggregation
- Out-of-order event handling with timestamp-based re-aggregation
- Ledger management with non-destructive merge caches and authoritative snapshot rebase
- Automatic retry with exponential backoff on failures
- Terminal error states for unrecoverable failures

## State Machine Flow

```
INITIAL (wait for LifeLine CONNECTED)
  |
  v
INITIALIZE (subscribe to LifeLinePubSub)
  |
  v
READY (idle, waiting for subscription requests)
  |
  v
SUBSCRIBE (subscribing to backend)
  |
  v
SUBSCRIBED (receiving real-time updates)
  |
  v
UNSUBSCRIBE (cleaning up subscription)
  |
  v
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

### **Event ledger model**

Each subscribed stream stores `recentEvents`: a chronological ledger of envelopes used for merge and out-of-order recovery. Three roles must not be conflated:

| Role | Authority | Purpose |
| --- | --- | --- |
| **Authoritative Snapshot** | Backend only | Freeze point; merge baseline; prune boundary via `replayCursor`. Only source that can assert "stream processed through boundary X." |
| **Update envelope** | Per-event | Canonical replay log since the latest authoritative Snapshot. Never removed by checkpoint logic. |
| **CompactedCheckpoint (CP)** | Client-derived hint | Non-destructive merge cache: merged state through all updates with `timestamp <= T`. Accelerates OOO re-aggregation near the ledger tail; **not** a Snapshot substitute. Uses a distinct header type (not `header.type === 'Snapshot'`). |

**Contract invariants:**

1. Update envelopes are canonical --- never removed by CP logic; may be pruned on authoritative Snapshot rebase when `rowCursor(row) <= replayCursor(S)`.
2. Authoritative Snapshots are backend freeze points; `replayCursor = replayAt ?? createdAt` is the merge and prune boundary (parity with backend [`resolveReplayCursorTimestamp`](../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts)).
3. CompactedCheckpoints are optional, invalidatable merge caches; timestamp `T` = merged state through all updates with `timestamp <= T`.
4. **Invalidation (updates):** new information at timestamp `x` drops every CP with `timestamp >= x`.
5. **Authoritative snapshot rebase:** on authoritative `S`, prune **existing** ledger rows where `rowCursor(row) <= replayCursor(S)` (`rowCursor` uses `replayAt ?? timestamp` for snapshot rows, `timestamp` for updates/CPs), then append `S`.
6. **CP creation:** `performCleanup` inserts CPs only. When the ledger tail warrants a cache (update envelope count exceeds `1.5 * desirableMedian` since the latest authoritative Snapshot, or no near-tail CP exists after mass invalidation), place the CP **`desirableMedian / 2` updates back from the live end** of `recentEvents` --- not `desirableMedian` updates forward from the freshest CP. CP timestamp = timestamp of the last update included in that aggregation. Intermediate CPs between snapshot and live end are unnecessary; CP value is only near the live end (e.g. after a late Snapshot invalidates prior CPs, a single CP lands near the tail rather than hugging the snapshot with a large uncovered gap). `desirableMedian` is optional per-slice config (default 10).
7. **Memory bounding** --- authoritative backend Snapshots plus post-rebase pruning (dynamic client strategies out of scope).

**Subscribe vs live:** not separate merge modes. Subscribe reload (OOO sidecar Snapshot + replay Content Updates) and live streaming use the same algorithm when the ledger is non-destructive.

Algorithm detail: [AGENT.implementation.md](./AGENT.implementation.md) **Event Processing**.

### **Sidecar Snapshot Handling**

Snapshot events from the backend may contain inline payloads or domain-shaped sidecar descriptors (e.g. a field whose value is `{ sidecarUrl: string }`). The slice passes raw `content` and `header` to `eventSerializer.deserialize({ content, header })`; the serializer routes on `header.type` and for snapshots performs any sidecar fetch and resolution internally when configured with a `DataSourceEnvironment` (e.g. browser fetch).

**Replay cursor:** Snapshots carry **`createdAt`** (envelope timestamp) and optionally **`replayAt`** (replay watermark for sidecar content). The client uses **`replayCursor = replayAt ?? createdAt`** for merge-after and prune-`<=` boundaries --- not envelope `timestamp` alone when they differ. See backend [Snapshot metadata: `createdAt` and `replayAt`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md).

On authoritative Snapshot arrival (including late sidecar delivery after replay Content Updates), the reducer prunes superseded ledger rows at `replayCursor` and recomputes `materializedView` from the sidecar baseline plus surviving updates.

### **Out-of-Order Event Handling**

Events may arrive out of chronological order due to network conditions or async sidecar deserialize (subscribe reload). The pattern handles this by:

1. **Timestamps**: All events include backend-generated timestamps (not client arrival time); sort tie-break by `(timestamp, eventId)` when `eventId` is available.
2. **Fast path**: If an update is newer than all cached events, apply it directly to the materialized view.
3. **Re-aggregation**: If an update is older than cached events, re-aggregate from the latest authoritative Snapshot (or latest valid CP as shortcut), then apply updates with `timestamp > replayCursor`, sorted by `(timestamp, eventId)`.
4. **No destructive compaction**: CPs supplement the ledger; update envelopes are never folded away before an authoritative Snapshot rebase.
5. **Authoritative snapshot rebase**: A late authoritative Snapshot prunes superseded rows and establishes the correct baseline regardless of prior provisional merges.

Automated regressions for subscribe-reload sequencing (R1--R5) live in [`reducers.test.ts`](./reducers.test.ts) under `describe('subscribe reload sequencing regressions')`.

### **Anti-patterns**

Avoid when extending the merge engine:

- Destructive consolidation that removes update envelopes
- CP rows masquerading as `Snapshot` header type
- Client time windows (e.g. 30s) as a correctness or memory strategy for subscribe replay
- WML-only merge forks when the fix belongs in generic `dataSource/reducers.ts`

### **Pure Functions**

All event processing logic uses pure functions that depend only on their inputs:
- Reducers do not call `Date.now()` --- timestamps come from event payloads
- Deterministic behavior for testing and debugging
- Easy to reason about and maintain

**requestIdTracking selectors:** Confirmed-id selectors and cross-slice pending selectors (e.g. `getEffectivePendingEdits`) are **pure** reads of Redux storage. TTL eviction is **dispatched** cleanup only. See [AGENT.implementation.md](./AGENT.implementation.md) **Dispatched correlation cleanup**.

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
- **WML DataSource**: `../wmlDataSource/` - `mtw.wml` per-asset streams; reference implementation for `requestIdTracking` + `afterProcessEnvelope` (cross-slice pending hygiene with personalAssets); subscribe sidecar OOO stress case
- **Thinking Jobs**: `../thinkingJobs/` - `mtw.ephemera.thinking.scheduling` / stream `global` (`Job Completed` + snapshot replay)
- **More Coming**: Character data, room data, etc.

## Future Enhancements

The generic pattern is complete and production-ready for lifecycle and streaming. Future enhancements could include:

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
