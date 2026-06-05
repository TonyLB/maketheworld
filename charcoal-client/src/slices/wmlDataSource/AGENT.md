# WML DataSource Slice

## Overview

The **wmlDataSource** slice is the single source of truth for the canonical backend WML view per subscribed asset. It manages mtw.wml subscriptions, processes Snapshot and Content Update events, and maintains `materializedView` (StandardFormData) for each subscribed stream.

### Purpose

- Own mtw.wml subscribe/unsubscribe lifecycle; send WebSocket subscribe/unsubscribe via the dataSource state machine
- Process Snapshot events (sidecar URL or inline) to establish initial `materializedView`
- Process Content Update events to merge deltas onto the current view
- Process Merge Conflict events (no view update; personalAssets handles toast)
- Expose `getWMLBase(state, assetId)` for consumers that need the backend view (e.g. personalAssets derives base from it)
- Persist confirmed `RequestIds` per asset via `requestIdTracking`; expose `getWMLConfirmedRequestIds(state, assetId)` for cross-slice pending derivation

### Key Concepts

- **materializedView**: The canonical backend WML state for a subscribed asset. Stored in `subscribedStreams[assetId].materializedView` as StandardFormData.
- **Snapshot**: Initial state delivered on subscribe; may be inline `{ wml: string }` or domain-shaped sidecar `{ wml: { sidecarUrl } }`. The serializer fetches sidecar URLs when configured with a DataSourceEnvironment.
- **Content Update**: Incremental update; aggregator merges the delta onto the current materializedView.
- **Merge Conflict**: Event is received but does not update materializedView; personalAssets shows toast via `pendingHygieneCheck` (post-envelope hygiene).
- **RequestIds (stream confirmation)**: Content Update and Merge Conflict may carry non-empty `RequestIds` in the envelope header when a client `applyEdit` resolves. This slice records them in `subscribedStreams[assetId].confirmedRequestIds` (`requestIdTracking` enabled with `headerField: 'RequestIds'`). Content Update merges the delta and appends ids; Merge Conflict appends ids without changing `materializedView`. Use `getWMLConfirmedRequestIds(state, assetId, now?)` for the effective confirmed set (5-minute selector TTL at read time; see [../dataSource/AGENT.implementation.md](../dataSource/AGENT.implementation.md) **requestIdTracking**). Cross-slice consumers (e.g. `personalAssets` `getEffectivePendingEdits` in [../personalAssets/selectors.ts](../personalAssets/selectors.ts)) should use that selector, not raw storage. **`afterProcessEnvelope`**: after each `processEnvelope`, invokes `personalAssets.pendingHygieneCheck` (registered at module load) to clear raw pending, TTL-trim, and show Merge Conflict toast. The `subscribeFirst` band-aid (`wmlStreamHandlers.ts`) remains until Phase 4b rollback. Producer contract: [`lambda/wml/AGENT.event.md`](../../../../lambda/wml/AGENT.event.md); cross-data-source inventory: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Stream correlation ids**).

---

## Architecture

### Data Source Configuration

Uses `createDataSourceSlice` with `dataSourceKey: 'mtw.wml'`:

- **Aggregator**: WMLAggregator (createEmpty, applyUpdate for Content Update; Merge Conflict leaves view unchanged)
- **Serializer**: WMLDataSourceEventSerializer with `createBrowserDataSourceEnvironment()`; handles sidecar resolution internally
- **requestIdTracking**: `{ headerField: 'RequestIds' }` --- persists confirmed correlation ids per subscribed stream

### Relationship to personalAssets

- **personalAssets triggers subscribe/unsubscribe** via `subscribeToWmlDataSource([id])` / `unsubscribeFromWmlDataSource([id])` when opening or clearing an asset. personalAssets does **not** send subscribe/unsubscribe messages itself.
- **personalAssets derives base and confirmed RequestIds** from wmlDataSource via `getWMLBase` and `getWMLConfirmedRequestIds`; both are injected by `augmentPublicDataForSelect` for selectors. Base is also supplied by the `updateStandard` thunk for the reducer.
- **Same-tick re-render**: One StreamEvent updates wmlDataSource `materializedView` and `confirmedRequestIds`, then `afterProcessEnvelope` dispatches `personalAssets.pendingHygieneCheck` to trim raw `pendingEdits` in the same subscriber tick.

---

## Integration Points

### Dependencies

- **dataSource** ([../dataSource/](../dataSource/)): `createDataSourceSlice`, `createBrowserDataSourceEnvironment`
- **lifeLine**: WebSocket delivery; dataSource INITIALIZE subscribes to LifeLine for mtw.wml StreamEvents
- **mtw-interfaces**: WMLAggregator, WMLDataSourceEventSerializer

### Cross-References

- **personalAssets**: [../personalAssets/AGENT.md](../personalAssets/AGENT.md) - Triggers subscribe/unsubscribe; derives base from getWMLBase
- **dataSource implementation**: [packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) - Sidecar resolution, Snapshot envelope conventions

---

## Navigation Tips

### Key Files

| File | Purpose |
|------|---------|
| [index.ts](./index.ts) | Slice creation via createDataSourceSlice |
| [selectors.ts](./selectors.ts) | getWMLBase, getWMLBaseStandardForm, getWMLConfirmedRequestIds |
