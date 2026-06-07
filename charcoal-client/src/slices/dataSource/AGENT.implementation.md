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
const processEnvelope = (aggregator, serializer, ...) => 
  (state, action) => {
    // Reducer logic with access to config; branches on header.type
  }
```

**Why**: Allows configuration to be "baked in" at slice creation time while keeping reducers pure.

#### **2. Pure Functions Throughout**

All event processing is deterministic:
- ❌ No `Date.now()` in reducers - timestamps come from action payloads
- ❌ No side effects in reducers - only state transformations
- ✅ Testable with simple inputs and outputs

**requestIdTracking selectors:** Confirmed-id selectors (`getConfirmedRequestIds`, `getWMLConfirmedRequestIds`) and cross-slice pending selectors (`getEffectivePendingEdits`) are **pure** reads of Redux storage. TTL eviction is **dispatched** cleanup only --- see [Dispatched correlation cleanup](#dispatched-correlation-cleanup) below.

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
- Events include accurate backend-generated timestamps (and `eventId` when available for tie-break)
- Aggregator is deterministic (same events in same order -> same result)
- Authoritative Snapshots may arrive out of order relative to replay Content Updates (subscribe sidecar deserialize latency)

**Guarantees** (what the pattern promises):
- Eventually consistent `materializedView` despite out-of-order delivery and subscribe replay
- Update envelopes retained until authoritative Snapshot rebase (CP invalidation affects caches only, not canonical updates)
- Memory bounded by **authoritative backend Snapshots + post-rebase pruning** (dynamic client strategies out of scope)
- Correct chronological ordering based on event timestamps and `(timestamp, eventId)` tie-break
- Efficient processing for the common in-order case (O(1) fast path)

**Why This Matters**: Violating assumptions (e.g., missing timestamps, non-deterministic aggregators) may break guarantees. Subscribe replay with long timestamp spans is expected workload, not a contract violation. See [AGENT.md](./AGENT.md) **Event ledger model**.

#### **5. Header/Content Envelope Shape**

The client mirrors the server-side header/content split:

- LifeLine delivers `StreamEvent` messages with `streamKey`, `timestamp`, `eventType`, and `update`.
- StreamEventPubSub deserializes and publishes `StreamEventDeserializedPayload` with full `StreamingEventHeader` (dataSourceKey, streamKey, timestamp, type, optional zone).
- `processEnvelope` receives payloads shaped as `StreamEventDeserializedPayload` (see [streamEventPubSub/index.ts](./streamEventPubSub/index.ts)).
- Routing uses `header.type`; the slice calls `deserialize({ content, header })` for all message types; the serializer routes on `header.type` internally (e.g. Snapshot vs events).
- Snapshot **`replayAt`** is read from the wire header at ingress only (see **Sidecar Snapshot Handling** > **Snapshot metadata on wire (ingress)** below); never from `update`.

### **Key Implementation Areas**

When extending the pattern, you'll likely work in these areas:

#### **Event Processing (`reducers.ts`)**

Three main functions handle event processing (target design; see **Implementation status** above):

1. **`applyEvents`**: Helper to apply multiple updates in order. Updates are sorted by `(timestamp, eventId)` ascending (backend parity with `DataCategory: EVENT#${timestamp}::${eventId}`). `eventId` plumbing on client envelopes is a Phase 3 follow-up when not derivable from existing header fields.
2. **`performCleanup`**: **Repurposed** (name retained): inserts non-destructive `CompactedCheckpoint` rows when the ledger tail warrants a cache (update envelope count exceeds `1.5 * desirableMedian` since the latest authoritative Snapshot, or no near-tail CP exists after mass invalidation). **Placement:** `desirableMedian / 2` updates back from the live end of `recentEvents` --- not `desirableMedian` forward from the freshest CP. Never removes update envelopes. Participates in authoritative Snapshot rebase via ledger prune (see algorithm). CP uses a distinct header type --- not `header.type === 'Snapshot'`.
3. **`processEnvelope`**: Unified envelope handler for authoritative Snapshots and updates. Content is pre-deserialized by StreamEventPubSub. Target: shared recompute helper for both paths instead of duplicated snapshot/event branches.

**Target merge algorithm** (single path for subscribe reload and live streaming):

```text
On authoritative Snapshot S:
  1. Prune existing ledger: keep rows where rowCursor(row) > replayCursor(S)
  2. Append S (with replayAt persisted when present); sort ledger chronologically
  3. Optionally insert CP via performCleanup (never removes rows)
  4. Recompute materializedView via recomputeMaterializedViewFromLedger

On Update at x:
  1. Append to recentEvents
  2. Drop CPs with timestamp >= x
  3. Optionally insert CP via performCleanup
  4. Recompute (fast path: incremental applyUpdate when strictly in-order)

rowCursor(row): authoritative snapshot -> replayAt ?? timestamp; update/CP -> timestamp
replayCursor(S): replayAt ?? createdAt (resolveReplayCursorTimestamp)
```

**Out-of-order paths:**
- **Fast path**: New update is later than all cached events -> apply directly to `materializedView`.
- **Re-aggregation path**: New update is earlier -> recompute via algorithm step 4 (baseline from latest authoritative Snapshot or valid CP).

**Type discrimination:** `recentEvents` union includes `CompactedCheckpoint` envelopes ([`baseClasses.ts`](./baseClasses.ts): `COMPACTED_CHECKPOINT_HEADER_TYPE`). Authoritative Snapshots persist `replayAt` from wire payload on ledger rows when present.

**Backend parity:** `replayCursor = replayAt ?? createdAt` matches [`resolveReplayCursorTimestamp`](../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts) and backend [Snapshot metadata](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md).

User-facing ledger overview: [AGENT.md](./AGENT.md) **Event ledger model**.

#### **State Machine Actions (`index.api.ts`)**

Three action factories manage lifecycle:

1. **`createInitializeAction`**: Subscribe to StreamEventPubSub; optionally invoke `afterProcessEnvelope` after each `dispatch(processEnvelope(payload))`
2. **`createSubscribeAction`**: Call backend API to subscribe
3. **`createUnsubscribeAction`**: Call backend API to unsubscribe

**Safety Pattern**: Subscribe/unsubscribe throw errors if called before initialization completes.

#### **Sidecar Snapshot Handling**

Snapshot events may carry inline payloads or domain-shaped sidecar descriptors (e.g. a field whose value is `{ sidecarUrl: string }`). Resolution happens inside the serializer when it is configured with a `DataSourceEnvironment`:

1. **StreamEventPubSub** subscribes to LifeLinePubSub, filters StreamEvents, looks up the deserializer by `dataSourceKey`, extracts Snapshot `replayAt` from the wire header (`extractReplayAtFromSnapshotHeader`), then deserializes via `fromWebSocketFormat` + `eventSerializer.deserialize`, and publishes pre-deserialized payloads.
2. **dataSource INITIALIZE** subscribes to StreamEventPubSub, filters by `dataSourceKey`, and passes payload directly to `processEnvelope` (content is already deserialized). Deserializers are registered via `registerDeserializer(dataSourceKey, eventSerializer)` when slices are created.
3. **Reducer** (`reducers.ts`) expects pre-resolved internal content; deserialization happens in StreamEventPubSub before publish.

##### **Snapshot metadata on wire (ingress)**

Subscribe replay and live Snapshot StreamEvents carry envelope metadata on the **extended header**, not in domain `update`. StreamEventPubSub normalizes once at the client boundary; the ledger shape is unchanged.

| Topic | Steady-state rule |
| --- | --- |
| Wire location | **`replayAt` on extended header only** --- `header.replayAt` after `fromWebSocketFormat`, or nested `header.extendedHeader.replayAt` on SNS feedback passthrough |
| Forbidden | **Never** read `update.replayAt` (non-Snapshot or legacy shapes) |
| Timing | Extract **before** `deserialize`; sidecar fetch must not depend on update metadata |
| Lift target | `StreamEventDeserializedPayload.replayAt` -> persisted on `RecentEventEnvelope.replayAt` in reducer |
| Ledger | Unchanged: `replayCursor = replayAt ?? timestamp` (wire `header.timestamp` = `createdAt`) |

**Cross-references:**

- Implementation: [`streamEventPubSub/index.ts`](./streamEventPubSub/index.ts) (`extractReplayAtFromSnapshotHeader`)
- Module nav: [`streamEventPubSub/AGENT.md`](./streamEventPubSub/AGENT.md)
- Backend contract: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (Outbound replay path, **Serialization: extendedHeader**)
- Semantics: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) (**Snapshot metadata: `createdAt` and `replayAt`**)

#### **Slice Factory (`index.ts`)**

Main factory function that:
- Defines state machine template
- Wires up actions and reducers
- Returns slice, selectors, and public actions

**Optional config (Phase 3):** `desirableMedian?: number` --- tail-anchored CP spacing (`desirableMedian / 2` updates back from live end when threshold exceeded); default `10`. Per-slice override when a data source needs a different spacing.

**Extension Point**: Add new public reducers or selectors here.

### **Testing Strategy**

#### **Unit Tests (`reducers.test.ts`)**

Test event processing logic in isolation:
- Mock aggregator and serializer
- Test with controlled timestamps
- Cover in-order, out-of-order, and error cases
- **`describe('subscribe reload sequencing regressions')`** guards R1--R5 subscribe-reload ledger sequencing (OOO sidecar before replay CUs, long-gap replay bundle, `replayAt` prune boundary, `rowCursor` prune, non-destructive `performCleanup` / CP insertion)

**Run**: `npm run test:single -- src/slices/dataSource/reducers.test.ts` (from `charcoal-client/`)

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

Memory per stream is bounded by **authoritative backend Snapshots** and **post-rebase pruning**:
- On authoritative Snapshot `S`, prune **existing** ledger rows where `rowCursor(row) <= replayCursor(S)`, then append `S`
- Update envelopes are never removed by CP logic; only rebase pruning and CP invalidation (caches only)
- Dynamic client memory strategies are out of scope; rely on backend snapshot frequency

`CompactedCheckpoint` rows are **merge caches for OOO re-aggregation performance**, not a memory-bounding mechanism.

#### **Re-Aggregation Cost**

Out-of-order events trigger re-aggregation:
- Cost: O(n) where n = surviving update envelopes in the ledger tail (after prune)
- CP shortcuts reduce work near the tail when valid
- Common case (in-order update) is O(1)

**Optimization**: If aggregation is expensive, consider batch processing in aggregator or tune `desirableMedian` for CP frequency.

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

## requestIdTracking (opt-in factory extension)

**Status:** Production. `wmlDataSource` is the only enabled consumer today (`headerField: 'RequestIds'`). Cross-slice consumers use `getWMLConfirmedRequestIds` in [../wmlDataSource/selectors.ts](../wmlDataSource/selectors.ts).

Opt-in on `createDataSourceSlice` for slices whose backend streams carry client-action correlation ids on the **envelope header** (not LifeLine RPC).

```typescript
requestIdTracking?: {
  /** Which extended header field(s) to read. Default: 'both'. */
  headerField?: 'RequestIds' | 'RequestId' | 'both'
  /** TTL for dispatched pruneStaleConfirmedRequestIds (default 5 minutes); not applied in selectors */
  confirmedTtlMs?: number
}
```

When enabled, per `subscribedStreams[streamKey]` store `confirmedRequestIds: Array<{ id: string; seenAt: number }>`. New streams initialized via `createSubscribeAction` get `confirmedRequestIds: []`.

**TTL constants** (used by dispatched storage GC, shared with `personalAssets`):

| Constant | Value | Module |
| --- | --- | --- |
| `PENDING_TTL_MS` | 3 minutes | [`requestIdTracking.ts`](./requestIdTracking.ts) (re-exported from [`index.ts`](./index.ts)) |
| `CONFIRMED_TTL_MS` | 5 minutes | same |

**Confirmed-id selector** (only when `requestIdTracking` is set on the factory):

- Pure helper: `storedConfirmedRequestIdStrings(rows)` in [`requestIdTracking.ts`](./requestIdTracking.ts) --- maps storage rows to `string[]` (all stored ids; no `Date.now()`). Returns `STABLE_EMPTY_CONFIRMED_IDS` when empty for I1 referential stability. See [../AGENT.client-sync-invariants.md](../AGENT.client-sync-invariants.md).
- Factory export: `getConfirmedRequestIds(state, streamKey)` on the `createDataSourceSlice` return value (Reselect over storage rows; not `publicSelectors` --- needs `streamKey`). Omitted when tracking is disabled.
- wmlDataSource wrapper: `getWMLConfirmedRequestIds(state, assetId)` in [../wmlDataSource/selectors.ts](../wmlDataSource/selectors.ts).

**Implementation modules:**

| Module | Role |
| --- | --- |
| [`requestIdTracking.ts`](./requestIdTracking.ts) | TTL constants; `extractConfirmedIdsFromHeader`, `appendConfirmedRequestIds`, `storedConfirmedRequestIdStrings`; storage GC helpers `prunePendingEditsStorage`, `pruneStaleConfirmedRequestIdRows` |
| [`reducers.ts`](./reducers.ts) | `buildStreamUpdate` appends ids in the same `processEnvelope` pass as aggregator; `pruneStaleConfirmedRequestIds` when tracking enabled |
| [`index.ts`](./index.ts) | Conditional `getConfirmedRequestIds`; re-exports `PENDING_TTL_MS`, `CONFIRMED_TTL_MS`, `STABLE_EMPTY_CONFIRMED_IDS` |
| [`index.api.ts`](./index.api.ts) | Subscribe init includes `confirmedRequestIds: []` when tracking enabled |

**`seenAt`:** Envelope `timestamp` from the dispatched action (not `Date.now()`), matching the pure-timestamp pattern used by event processing reducers.

**Dispatched storage GC:** When `requestIdTracking` is enabled, `pruneStaleConfirmedRequestIds` removes stale rows from `confirmedRequestIds` storage (injectable `now`, default `requestIdTracking.confirmedTtlMs ?? CONFIRMED_TTL_MS`). Skips any id present in `pendingKeys` (oscillation invariant). Periodic cleanup is orchestrated by `personalAssets.pruneStaleRequestCorrelation`, dispatched on `LifeLinePubSub` `PeriodicTick` (~30s during connected session). See [Dispatched correlation cleanup](#dispatched-correlation-cleanup).

**Normalization (storage always `{ id, seenAt }[]`):**

| `headerField` | Record in `processEnvelope` when |
| --- | --- |
| `RequestIds` | `Array.isArray(v) && v.length > 0` -> append each string |
| `RequestId` | `typeof v === 'string' && v.length > 0` -> append one id |
| `both` (default) | Non-empty `RequestIds` array and/or non-empty `RequestId` string; dedupe within the pass |

**Recording rule:** No runtime `header.type` allowlist. Non-empty header field = resolved client-originated action; empty `[]` or omitted = no confirmation. Merge Conflict records ids even when `materializedView` is unchanged.

**Not in scope:** LifeLine `socketDispatchPromise` / `ReturnValue` correlation (see [`../lifeLine/AGENT.md`](../lifeLine/AGENT.md)).

**Slices today:** Only `wmlDataSource` enables tracking (`headerField: 'RequestIds'`). Other `createDataSourceSlice` instances (`contentHeaders`, `libraryDataSource`, `thinkingJobs`) may enable when producers set stream-header `RequestId`.

**Authoritative producer inventory:** [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Stream correlation ids**).

### Dispatched correlation cleanup

Pending/confirmed correlation uses **pure selectors** for the effective overlay and **dispatched actions** for TTL eviction. Stale physical rows may remain in Redux storage briefly; selectors read storage as-is (confirmed-id filter only on pending overlay).

**TTL owners:**

| Path | Trigger | Role |
| --- | --- | --- |
| `pendingHygieneCheck` | wml `afterProcessEnvelope` (event-driven) | Primary confirm path: clear pending by confirmed/header RequestIds, TTL-trim stale pending rows |
| `saveEdit` / `trimStalePendingEdits` | Optimistic enqueue + lazy trim | Secondary storage hygiene on pending rows |
| `pruneStaleRequestCorrelation` | `LifeLinePubSub` `PeriodicTick` (~30s) | GC for zombie rows (failed WS, missed hygiene, idle tab) |

**Oscillation invariant:** Physical cleanup must **never** prune a `confirmedRequestId` while a `pendingEdit` with the same `meta.key` still exists in storage. Otherwise a pure id-based selector filter could lose suppression and re-expose a pending overlay.

**Per-asset cleanup order** (in `pruneStaleRequestCorrelation`):

1. Clear pending rows whose `meta.key` is in confirmed storage (belt-and-suspenders for missed `pendingHygieneCheck`).
2. Trim pending rows older than `PENDING_TTL_MS`.
3. Trim confirmed rows older than `CONFIRMED_TTL_MS`, skipping any id that still has a matching pending row.

**Constants and asymmetry:**

| Constant | Value | Applied in |
| --- | --- | --- |
| `PENDING_TTL_MS` | 3 minutes | Dispatched pending trim (`trimStalePendingEdits`, `saveEdit`, `pruneStaleRequestCorrelation`) |
| `CONFIRMED_TTL_MS` | 5 minutes | Dispatched `pruneStaleConfirmedRequestIds` |

Confirmed ids outlive the pending cap (5m > 3m) so a physical pending row that lingers in storage is still suppressed by confirmed filtering for an extra window after pending age trim alone would apply.

**Idle tab:** Eviction happens on the next envelope hygiene, save enqueue, or periodic tick --- not on selector read. Slow or failed stream confirm past TTL produces a missing-edit symptom, not doubling.

**Cross-link:** Selector purity and dispatched TTL are summarized in [AGENT.md](./AGENT.md) **Pure Functions**.

### Characterization tests (requestIdTracking)

All cases implemented in [`reducers.test.ts`](./reducers.test.ts) (`processEnvelope requestIdTracking`) and [`index.test.ts`](./index.test.ts) (case 9 subscribe init). Selector tests in `reducers.test.ts` (`storedConfirmedRequestIdStrings / getConfirmedRequestIds`); TTL eviction tests in `pruneStaleRequestCorrelation.test.ts` and `periodicCleanupSubscriber.test.ts`:

| # | Case | Setup | Action | Assert |
| --- | --- | --- | --- | --- |
| 1 | Content Update + ids | tracking on; base view `['a']` | `processEnvelope` with successful update + `RequestIds: ['req-A']` | `materializedView` includes delta; `confirmedRequestIds` has `req-A` with `seenAt === timestamp` |
| 2 | Merge Conflict + ids | tracking on; base view `['a']` | failing aggregator + `RequestIds: ['req-B']` | `materializedView` still `['a']`; `confirmedRequestIds` has `req-B` |
| 3 | Empty / omitted ids | tracking on; existing confirmed rows | event with `RequestIds: []` or omitted | `confirmedRequestIds` unchanged; view per aggregator |
| 4 | `headerField: 'RequestIds'` | tracking with field mode | header with only `RequestId: 'x'` | no new rows |
| 5 | `headerField: 'RequestId'` | tracking with field mode | header with only `RequestId: 'x'` | one row `x` |
| 6 | `headerField: 'both'` + dedupe | both fields set | `RequestIds: ['a']`, `RequestId: 'a'` | one row `a` (not duplicated) |
| 7 | Stream key isolation | two subscribed streams | confirm id on `stream1` only | `stream2.confirmedRequestIds` untouched |
| 8 | Tracking disabled | no `requestIdTracking` config | event with `RequestIds` | no `confirmedRequestIds` key on stream |
| 9 | Subscribe init | factory subscribe new stream | (integration) | new stream has `confirmedRequestIds: []` when tracking enabled |
| 10 | Append across events | existing `[{ id: 'old', seenAt: 1 }]` | second event `RequestIds: ['new']` | array is `[old, new]` (no eager prune in reducer) |

**Selector tests:** `getConfirmedRequestIds` / `storedConfirmedRequestIdStrings` return all storage ids (including stale rows not yet pruned). TTL exclusion is tested on `pruneStaleConfirmedRequestIds` and `pruneStaleRequestCorrelation` with injectable `now`.

---

## afterProcessEnvelope (opt-in factory extension)

**Status:** Production. `wmlDataSource` is the only consumer today. `personalAssets` registers `pendingHygieneCheck` via `registerWmlAfterProcessEnvelopeConsumer` at module load (avoids import cycle).

Opt-in on `createDataSourceSlice` for cross-slice work that must run **after** the owning slice's `processEnvelope` reducer commits (parallel to `onReady`, but per-stream-event rather than at INITIALIZE).

```typescript
afterProcessEnvelope?: (
  dispatch: any,
  getState: any,
  payload: StreamEventDeserializedPayload
) => void
```

**Wiring:**

| Touchpoint | Role |
| --- | --- |
| [`index.ts`](./index.ts) | `afterProcessEnvelope?` on `DataSourceSliceConfig`; passed as 5th arg to `createInitializeAction` |
| [`index.api.ts`](./index.api.ts) | StreamEventPubSub subscriber: `dispatch(processEnvelope(payload))` then `afterProcessEnvelope?.(dispatch, getState, payload)` |

**Ordering guarantee:** RTK dispatches reducers synchronously. `getState()` inside the callback sees updated `materializedView` and `confirmedRequestIds` (when `requestIdTracking` is enabled). The callback is not invoked when the data-source guard rejects the envelope.

**Consumer (wired):** `wmlDataSource` invokes a delegate registered by `personalAssets` (`registerWmlAfterProcessEnvelopeConsumer` in [`wmlDataSource/index.ts`](../wmlDataSource/index.ts); registration in [`personalAssets/index.ts`](../personalAssets/index.ts)). The callback dispatches `pendingHygieneCheck(streamKey, payload)` when `streamKey` is a valid asset UUID. Other `createDataSourceSlice` instances omit the hook.

### Characterization tests (afterProcessEnvelope)

Implemented in [`index.test.ts`](./index.test.ts) (`afterProcessEnvelope` describe):

| # | Case | Assert |
| --- | --- | --- |
| 1 | Configured | Factory passes callback to `createInitializeAction`; publish invokes `(dispatch, getState, payload)` once |
| 2 | Omitted | Factory passes `undefined`; publish does not invoke a callback |
| 3 | Post-commit `getState` | With `requestIdTracking`, callback `getConfirmedRequestIds(getState(), streamKey, now)` includes ids from the same envelope; `materializedView` updated |

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
→ Read `reducers.ts` `processEnvelope` function
→ See **Event Processing (`reducers.ts`)** in this document and [AGENT.md](./AGENT.md) **Event ledger model**

### **Modifying State Machine Flow**
→ Edit state machine template in `index.ts`
→ Update `AGENT.md` state machine diagram

---

## Related Documentation

- **[User Guide](./AGENT.md)**: High-level functionality and usage
- **[Planning History](./AGENT.planning.md)**: Development process and decisions
- **[Backend DataSource Pattern](../../../packages/mtw-lambda-patterns/ts/dataSource/)**: Backend counterpart

---

*Last Updated: 2026-06-06*
