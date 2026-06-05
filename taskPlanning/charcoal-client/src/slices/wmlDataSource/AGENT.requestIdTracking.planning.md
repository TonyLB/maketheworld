# RequestId tracking and pending-edit derivation (wmlDataSource + personalAssets)

**Status:** Phase 4a slice 1 complete (`afterProcessEnvelope` factory hook). **Next:** Phase 4a slice 2 (pending hygiene thunk + wml wiring), then band-aid rollback.

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability rules (this file is task-scoped; delete after merge). Client test commands: [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md).

---

## Purpose

Fix **non-atomic derived view** when a single `mtw.wml` StreamEvent fans out to multiple Redux slices. Today `getLocalStandardForm` merges `base + pendingEdits + edit`. Content Update merges the same edit delta onto `base` (via `wmlDataSource`) while `pendingEdits` may still contain that delta until a separate dispatch clears it --- producing **doubling** (or, with the current `subscribeFirst` band-aid, a brief **missing-edit** flash). Reconcile in `useWorkbenchComponent` can canonize either glitch.

**Target:** Treat **confirmed RequestIds** as part of the canonical backend view owned by **`wmlDataSource`**, and **derive effective pending** at select time so `base` update and pending exclusion are **consistent in one selector read**, without depending on dispatch order.

**Interim band-aid (already shipped):** [`registerPersonalAssetsWmlStreamHandlers`](../../../../charcoal-client/src/slices/personalAssets/wmlStreamHandlers.ts) + `StreamEventPubSub.subscribeFirst` clears pending before `wmlDataSource` merges. Remove after this initiative verifies the structural fix. **Rollback inventory:** [Recorded changes (2026-06-04 working tree)](#recorded-changes-2026-06-04-working-tree) --- the working tree also contains **unrelated** workbench/debounce changes; do not conflate them with band-aid removal.

---

## Problem summary (task-specific)

| Layer | Today | Failure mode |
| --- | --- | --- |
| Stream fan-out | One event -> `wmlDataSource.processEnvelope` + `personalAssets.receiveWMLEvent` | Two dispatches; intermediate Redux states |
| `getLocalStandardForm` | `base.merge(pending...).merge(edit)` | Same delta in `base` and `pending` -> concat literals |
| `getStandardForm` | `inherited.merge(local)` | Inherits local-layer glitch into `committed` |
| Session reconcile | Adopts `committed` as `incoming` | Canonizes bad Redux snapshot |

---

## Target architecture

```text
Content Update (RequestIds: [req-A])
        |
        v
wmlDataSource.processEnvelope  (single dispatch)
  - materializedView += delta
  - confirmedRequestIds += req-A (with seenAt)
        |
        v
afterProcessEnvelope(streamKey, payload)   // factory hook; strictly after reducer commit
  -> personalAssets pendingHygieneCheck(assetId)
       - clear raw pendingEdits by confirmed RequestIds (storage + saving indicator)
       - TTL-trim stale pending rows
       - Merge Conflict toast when header.type matches and pending had row
        |
        v
getEffectivePendingEdits(assetId, now)
  = pendingEdits
      .filter(p => !confirmedSet.has(p.meta.key))   // confirmed first
      .filter(p => now - p.meta.time < PENDING_TTL) // 3 minutes
        |
        v
getLocalStandardForm
  = base + effectivePending + edit   // no double-count at any dispatch order

confirmedSet from wmlDataSource selector:
  confirmedRequestIds.filter(r => now - r.seenAt < CONFIRMED_TTL)  // 5 minutes
```

**Belt-and-suspenders TTL (chosen):** Correctness does **not** depend on dispatched cleanup or timers. **Primary:** dynamic TTL in selectors on every read. **Secondary:** lazy storage trim when activity occurs (`saveEdit`).

| Constant | Value | Applied in |
| --- | --- | --- |
| `PENDING_TTL_MS` | 3 minutes | `getEffectivePendingEdits` (selector); lazy purge on `saveEdit` |
| `CONFIRMED_TTL_MS` | 5 minutes | DataSource confirmed-RequestId selector |

Confirmed ids outlive effective pending overlay (5m > 3m) so a physical pending row that lingers in storage is still suppressed by confirmed filtering for an extra window after the pending age cap would alone apply.

**Lazy storage hygiene (secondary):** On stream confirm, `afterProcessEnvelope` dispatches `personalAssets` pending hygiene (clear by confirmed RequestIds + TTL trim). On `saveEdit` enqueue, also remove raw `pendingEdits` rows with `meta.time` older than `PENDING_TTL_MS` (same threshold as selector). Eager clear is **not** required for merge correctness (selectors handle that); it **is** required for saving indicator, `revertSaveEdit`, and storage trim promptly after confirm.

**Merge Conflict:** RequestIds on conflict events should also enter the confirmed set (edit failed; overlay must not merge on top of base).

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Header contract + client DataSource factory design | Complete |
| 1 | Confirmed RequestId storage in `createDataSourceSlice` | Complete |
| 2 | `wmlDataSource` enable + selectors | Complete |
| 3 | `personalAssets` effective-pending derivation | Complete |
| 4 | `afterProcessEnvelope` hygiene, band-aid rollback (inventory A/B), verification | In progress (factory hook landed) |
| 5 | Durable docs + retire this plan | Not started |

---

## Getting Started

1. **Task framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. **Client testing (command authority):** [`charcoal-client/AGENT.testing.md`](../../../../charcoal-client/AGENT.testing.md) via [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md) --- run from `charcoal-client/`, Vitest (`npm run test:single -- <path>`).
3. **WML header / RequestIds on wire (durable):**
   - [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- extended header, `RequestIds` in header not content
   - [`packages/mtw-interfaces/ts/eventBridge/wml/index.ts`](../../../../packages/mtw-interfaces/ts/eventBridge/wml/index.ts) --- `WMLStreamingEventHeader`
   - [`lambda/wml/AGENT.event.md`](../../../../lambda/wml/AGENT.event.md) --- producer behavior
4. **Client slices (durable):**
   - [`charcoal-client/src/slices/wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md)
   - [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) --- optimistic save, pendingEdits
   - [`charcoal-client/src/slices/dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) --- `createDataSourceSlice`, `processEnvelope`
5. **Baseline verification (should pass before edits):**

```bash
cd charcoal-client
npm run test:single -- src/slices/personalAssets/reducers.test.ts
npm run test:single -- src/slices/dataSource/reducers.test.ts
```

---

## Design notes (Phase 0 decisions)

### A. RequestIds are already first-class on the wire for `mtw.wml`

`WMLStreamingEventHeader = StreamingEventHeader & { RequestIds?: string[] }`. Producers pass `RequestIds` in the header fragment; serializers keep them out of content. Subscriptions merge extended header fields to the WebSocket top level.

**Gap:** the **client DataSource slice** does not yet **persist** confirmed RequestIds or expose them to cross-slice selectors. `StreamEventDeserializedPayload.header` is typed loosely (`[key: string]: unknown`), which forced casts in [`wmlStreamHandlers.ts`](../../../../charcoal-client/src/slices/personalAssets/wmlStreamHandlers.ts). **Typing fix (chosen):** Design note **F** --- hybrid generic-at-factory-boundary strategy; implement during Phase 1 factory work.

### B. Generalize in the DataSource factory (not wml-only one-off)

Prefer an **opt-in factory option** on `createDataSourceSlice`, e.g.:

```typescript
requestIdTracking?: {
  /** Which extended header field(s) to read. Default: 'both'. */
  headerField?: 'RequestIds' | 'RequestId' | 'both'
  /** Selector TTL for confirmed ids (default 5 minutes); applied at read time, not in reducer */
  confirmedTtlMs?: number
}
```

When enabled, per `subscribedStreams[streamKey]` store:

```typescript
confirmedRequestIds: Array<{ id: string; seenAt: number }>
```

**Normalization (storage always `{ id, seenAt }[]`):**

| `headerField` | Record in `processEnvelope` when |
| --- | --- |
| `RequestIds` | `Array.isArray(v) && v.length > 0` -> append each string |
| `RequestId` | `typeof v === 'string' && v.length > 0` -> append one id |
| `both` (default) | Non-empty `RequestIds` and/or non-empty `RequestId`; dedupe within the pass |

**Recording rule (no event-type allowlist):** In `processEnvelope`, after the aggregator runs, record ids from the configured header field(s) when non-empty. The header field is the contract --- producers attach correlation ids only when a client-originated action is resolved. On **`mtw.wml`**, non-empty `RequestIds` today means applyEdit carried `RequestId` (`Content Update` / `Merge Conflict`); other types omit or send `[]`. Assets/ephemera scheduling types reserve singular `RequestId` on the wire but producers omit until wired.

**Why not filter by `header.type`:** Merge Conflict must record ids even though `materializedView` is unchanged. Content Update records ids and merges the delta. Both share the same rule: non-empty header field. An allowlist would duplicate producer knowledge and risk missing a type (e.g. conflict) that must suppress pending without updating base.

**Phase 0 audit (completed 2026-06-05):** Cross-data-source grep of `RequestId`/`RequestIds` under `lambda/`, `packages/mtw-interfaces`, `charcoal-client/src/slices`. Authoritative inventory: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Stream correlation ids**). Conclusion: only **`mtw.wml` `processApplyEdit`** sets non-empty stream-header correlation ids today (`RequestIds`); LifeLine RPC uses singular `RequestId` separately (out of factory scope). Not a runtime allowlist in code.

Export generic selectors, e.g. `getConfirmedRequestIds(state, streamKey, now?)` returning ids whose `seenAt` is within `CONFIRMED_TTL_MS` (default 5 minutes). Apply TTL **in the selector** on every read; do not rely on reducer-side eviction for correctness.

**Storage vs selector:** `processEnvelope` may append to `confirmedRequestIds` without eagerly pruning stale rows (optional lazy trim on dispatch is secondary hygiene only). `recentEvents` retention (30s cleanup) and RequestId TTL (5m) serve different purposes; document both in a shared constants module (e.g. `PENDING_TTL_MS`, `CONFIRMED_TTL_MS`).

**Phase 0 spike landed (2026-06-05):** Types in [`baseClasses.ts`](../../../../charcoal-client/src/slices/dataSource/baseClasses.ts); normalization in [`requestIdTracking.ts`](../../../../charcoal-client/src/slices/dataSource/requestIdTracking.ts); recording via `buildStreamUpdate` in [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) (same pass as aggregator); subscribe init in [`index.api.ts`](../../../../charcoal-client/src/slices/dataSource/index.api.ts). **`seenAt`** = envelope `timestamp` (not `Date.now()`). Spike tests + Phase 1 characterization checklist: [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) (**requestIdTracking**).

### C. Cross-slice selector (personalAssets)

Add **`getEffectivePendingEdits(assetId)`** in `personalAssets/selectors.ts`:

- Inputs: `personalAssets.pendingEdits`, confirmed RequestId set from wmlDataSource (5m selector TTL), and `now` (default `Date.now()`)
- Filter order:
  1. Exclude if `meta.key` is in confirmed set
  2. Exclude if `now - meta.time >= PENDING_TTL_MS` (3 minutes; `meta.time` set at optimistic enqueue in `saveEdit` reducer)
- Output: rows that remain in the effective overlay

Update **`getLocalStandardForm`** to merge **effective** pending, not raw array.

**`getStandardForm` unchanged structurally** --- still `inherited.merge(local)`; local is now correct under stream timing.

**Testing note:** inject a fixed `now` in selector tests (or mock time) so TTL behavior is deterministic; bare `Date.now()` inside selectors bypasses memoization on the time axis (acceptable for small arrays).

### D. What happens to eager `clearPendingEditsByRequestIds`

| Concern | After structural fix |
| --- | --- |
| Correctness of merged view | Selector filtering + selector TTL (primary) |
| Storage hygiene + saving indicator + `revertSaveEdit` | `afterProcessEnvelope` -> `personalAssets` pending hygiene (strictly after wml reducer); belt-and-suspenders TTL trim on `saveEdit` |
| Merge Conflict toast | Fold into pending hygiene thunk (`header.type` + pre-clear pending snapshot); no separate PubSub subscription |
| `subscribeFirst` / `wmlStreamHandlers` | Remove once hygiene hook + tests land (ordering band-aid obsolete) |
| `receiveWMLEvent` | Retire or reduce to internal helper called from hygiene thunk; no store-init PubSub handler |

### E. TTL: belt-and-suspenders (chosen)

Correctness must not depend on dispatch order, stream handlers, or background timers. Use **dynamic TTL in selectors** (primary) plus **lazy storage trim on activity** (secondary).

**Primary (selectors, every read):**

| Selector | TTL | Rule |
| --- | --- | --- |
| Confirmed RequestIds (DataSource) | **5 minutes** | Include `{ id, seenAt }` only when `now - seenAt < CONFIRMED_TTL_MS` |
| `getEffectivePendingEdits` | **3 minutes** | After confirmed filter, exclude pending when `now - meta.time >= PENDING_TTL_MS` |

**Secondary (lazy, on dispatch):**

| Action | Rule |
| --- | --- |
| `afterProcessEnvelope` (per stream event) | Dispatch pending hygiene for `streamKey`: clear rows whose `meta.key` is in effective confirmed set; TTL-trim stale rows; Merge Conflict toast when applicable |
| `saveEdit` enqueue | Remove raw `pendingEdits` rows with `now - meta.time >= PENDING_TTL_MS` (same 3m threshold) |

**Why asymmetric 3m / 5m:** Confirmed ids live longer than the pending overlay cap. Between 3-5 minutes, confirmed filtering still suppresses a lingering physical pending row even if the age filter alone would not.

**Assumption:** Normal save + stream confirm completes well under 3 minutes (autosave debounce is 5s). If confirm takes longer, the pending overlay drops from the effective view while `base` may still be stale (missing-edit symptom on failure/slowness, not doubling). Document in durable docs.

**Implementation caveats:**

- Use `meta.time` from enqueue, not time of first `updateStandard`.
- Selectors that call `Date.now()` re-evaluate TTL each render; fine for small lists; tests must inject `now`.
- Optional reducer-side prune of `confirmedRequestIds` / `pendingEdits` arrays is hygiene only, not required for correctness.

### F. `StreamEventDeserializedPayload` typing (Phase 0 spike, chosen 2026-06-05)

**Decision:** Hybrid --- keep the PubSub bus loosely typed; thread extended `Header` through the DataSource factory and per-slice subscribe guards. Aligns with `ResolvedStreamingEnvelope<Content, Header>` and `DataSourceEventSerializer<..., Header>` in mtw-lambda-patterns.

**Layers:**

| Layer | Type | Role |
| --- | --- | --- |
| **StreamEventPubSub** | Base `StreamEventDeserializedPayload` (default `Header = StreamingEventHeader`, `content: unknown`) | Heterogeneous bus; LifeLine bridge publishes all data sources through one PubSub instance |
| **Subscribe guard** | Per-slice `HeaderGuard<H>` (e.g. `WMLStreamingEventHeader` from mtw-interfaces) via extended `makeStreamEventGuardForDataSource` | Narrows payload before dispatch; replaces ad hoc `as WMLStreamingEventHeader` casts |
| **Factory / reducer** | `createDataSourceSlice<..., Header>`; `processEnvelope` action is `PayloadAction<StreamEventDeserializedPayload<Header, UpdatePayload \| SnapshotPayload>>` | Typed access to extended header fields (`RequestIds`, future `RequestId`) inside reducer and `requestIdTracking` |
| **Cross-slice consumers** | Import per-data-source header types + guards from mtw-interfaces | e.g. `personalAssets` reads confirmed ids via wmlDataSource selectors, not by re-parsing loose headers |

**Concrete shape (implement in Phase 1):**

```typescript
// streamEventPubSub/index.ts
export type StreamEventDeserializedPayload<
  Header extends StreamingEventHeader = StreamingEventHeader,
  Content = unknown
> = {
  dataSourceKey: string
  streamKey: string
  timestamp: number
  header: Header
  content: Content
}

// Guard factory accepts optional header guard (default: dataSourceKey match only)
export function makeStreamEventGuardForDataSource<H extends StreamingEventHeader>(
  dataSourceKey: string,
  headerGuard?: HeaderGuard<H>
): (envelope: ResolvedStreamingEnvelope<unknown, StreamingEventHeader>) =>
  envelope is ResolvedStreamingEnvelope<unknown, H>
```

**Out of scope for this spike (deferred):** Discriminated-union payload so `header.type` narrows `content` --- see [`AGENT.development.md`](../../../../AGENT.development.md) (*DataSource client slice: envelope payload discriminated union*). RequestId tracking only needs typed extended header fields, not full content narrowing.

**Implementation touchpoints (Phase 1):**

- [`streamEventPubSub/index.ts`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts) --- generic payload alias; extend guard factory
- [`createDataSourceSlice`](../../../../charcoal-client/src/slices/dataSource/index.ts) / [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) --- `Header` type param; typed `processEnvelope`
- [`wmlDataSource/index.ts`](../../../../charcoal-client/src/slices/wmlDataSource/index.ts) --- pass `WMLStreamingEventHeader` (from serializer) at slice creation
- [`wmlStreamHandlers.ts`](../../../../charcoal-client/src/slices/personalAssets/wmlStreamHandlers.ts) --- **delete** in Phase 4b after `afterProcessEnvelope` hygiene lands (design note **G**)

**Rejected alternative:** Per-data-source narrow helper types only (Option B) without factory generics --- would leave `requestIdTracking` reading `(header as Record<string, unknown>)` and duplicate casts at every consumer.

### G. Cross-slice pending hygiene via `afterProcessEnvelope` (chosen 2026-06-05)

**Problem:** Phase 3 fixes merge correctness at selector read time, but raw `pendingEdits` still drives the saving indicator, `revertSaveEdit`, and storage size. TTL-only lazy purge on `saveEdit` does not run on stream confirm. A parallel `StreamEventPubSub` subscriber (`subscribeFirst` band-aid) cleared pending before wml merge --- ordering hack, not a durable cross-slice contract.

**Decision:** Add an opt-in factory callback on `DataSourceSliceConfig`, parallel to `onReady`:

```typescript
afterProcessEnvelope?: (
  dispatch: AppDispatch,
  getState: () => RootState,
  payload: StreamEventDeserializedPayload
) => void
```

**Wiring (mirror `onReady`):**

| Touchpoint | Change |
| --- | --- |
| [`dataSource/index.ts`](../../../../charcoal-client/src/slices/dataSource/index.ts) | Add `afterProcessEnvelope?` to `DataSourceSliceConfig`; pass through to `createInitializeAction` |
| [`dataSource/index.api.ts`](../../../../charcoal-client/src/slices/dataSource/index.api.ts) | In StreamEventPubSub subscriber: `dispatch(processEnvelope(payload))` then `afterProcessEnvelope?.(dispatch, getState, payload)` |
| [`wmlDataSource/index.ts`](../../../../charcoal-client/src/slices/wmlDataSource/index.ts) | Supply callback that dispatches `personalAssets` pending hygiene for `payload.streamKey` |
| [`personalAssets/index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) | New thunk (e.g. `pendingHygieneCheck(assetId, envelope)`) --- not a second PubSub subscription |

**Ordering guarantee:** Callback runs in the **same** subscriber that dispatches `processEnvelope`, **after** the synchronous reducer commit. `getState()` inside the callback sees updated `materializedView` and `confirmedRequestIds`. Replaces `subscribeFirst` ordering without a second personalAssets stream listener.

**Pending hygiene thunk responsibilities (asset-scoped):**

1. Read effective confirmed RequestIds via `getWMLConfirmedRequestIds(state, assetId)` (post-envelope state).
2. Dispatch `clearPendingEditsByRequestIds` for ids present in raw `pendingEdits` (physical trim + saving indicator off).
3. TTL-trim stale `pendingEdits` rows (`meta.time` older than `PENDING_TTL_MS`).
4. Merge Conflict toast: when `header.type === 'Merge Conflict'` and a matching pending row existed **before** clear (capture snapshot pre-dispatch).
5. `revertSaveEdit` guard: no-op when `requestId` is already in confirmed set (belt-and-suspenders if clear races wire failure).

**wml-only coupling:** Generic factory defines the hook; only `wmlDataSource` passes a callback that imports `personalAssets`. Other `createDataSourceSlice` instances omit it.

**Rejected alternatives:**

- **Normal `StreamEventPubSub.subscribe` from personalAssets** --- subscriber registration order vs wml INITIALIZE timing is fragile.
- **RTK listener middleware on `processEnvelope`** --- not established in this store; less discoverable than factory hook beside `onReady`.
- **Selector-only (no physical clear)** --- leaves `saving: pendingEdits.length > 0` stuck after confirm; `revertSaveEdit` can incorrectly roll back after stream confirm.

---

## Recorded changes (2026-06-04 working tree)

**Authoritative inventory.** Captured from the uncommitted working tree while all deltas were visible together. Commits will land separately; **do not reconstruct this list from `git log` / `git blame` later** --- update this section if a path changes before merge.

**Scope:** 22 modified paths + 2 new files (+ this plan). Categories **A-E** label rollback intent for Phase 4.

| Cat | Path | What changed | Rollback / keep |
| --- | --- | --- | --- |
| **A** | [`wmlStreamHandlers.ts`](../../../../charcoal-client/src/slices/personalAssets/wmlStreamHandlers.ts) (**new**) | `registerPersonalAssetsWmlStreamHandlers`: global `StreamEventPubSub.subscribeFirst` on `mtw.wml` when header has non-empty `RequestIds`; dispatches `receiveWMLEvent(streamKey)`. | **Delete file** in Phase 4 |
| **A** | [`store/index.ts`](../../../../charcoal-client/src/store/index.ts) | Import + `registerPersonalAssetsWmlStreamHandlers(store.dispatch)` immediately after `configureStore`. | **Remove** import + call |
| **A** | [`lib/pubSub/index.ts`](../../../../charcoal-client/src/lib/pubSub/index.ts) | New `subscribeFirst(callback)`: prepends subscriber so it runs before existing subscribers on each `publish`. | **Remove method** if no other caller |
| **A** | [`lib/pubSub/index.test.ts`](../../../../charcoal-client/src/lib/pubSub/index.test.ts) | Test: `subscribeFirst` callback runs before `subscribe` callback on publish. | **Remove test** with method |
| **B** | [`index.api.ts`](../../../../charcoal-client/src/slices/personalAssets/index.api.ts) | Removed `StreamEventPubSub` / `receiveWMLEvent` imports. **`subscribeAction`:** deleted per-asset `StreamEventPubSub.subscribe` block; returns `internalData: {}` instead of `{ subscription }`. **`clearAction`:** removed `StreamEventPubSub.unsubscribe(subscription)` and `internalData: { subscription: undefined }`; returns `{}`. Doc comment points at store-init handler. | After Phase 4: **keep** no per-asset PubSub subscription; hygiene via `afterProcessEnvelope`; update comments; remove dead `subscription` field |
| **B** | [`baseClasses.ts`](../../../../charcoal-client/src/slices/personalAssets/baseClasses.ts) | **Unchanged in working tree**; `internalData.subscription?: any` still declared but no longer written. | Remove dead field when settling **B** |
| **C** | [`index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) | Register `revertSaveEdit` reducer. Module-level `saveEditChainByKey` Map serializes concurrent saves per asset key. **`saveEdit`:** generate `requestId`, dispatch `saveEdit` reducer **before** `socketDispatchPromise(applyEdit)`, build WML from pending row snapshot, `catch` -> `revertSaveEdit`. | **Keep** (optimistic persist + wire failure + serialization) |
| **C** | [`reducers.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.ts) | Comment on optimistic `saveEdit`. New **`revertSaveEdit`:** remove pending row by `requestId` if present, merge snapshot back into `edit`; no-op if stream already cleared. | **Keep** |
| **C** | [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) | **Phase 0 block (+2):** `first shortName on empty imported room...`, `second flush with unchanged shortName...`. **New describe `optimistic saveEdit and revertSaveEdit` (+7):** enqueue/clear edit, revert restore, revert no-op after stream clear, revert merges into in-flight edit, optimistic local single copy, `base updated before clearPending doubles` (ordering bug), `stream-first clear after optimistic enqueue`. | **Keep** optimistic/revert tests; ordering-bug tests become historical after Phase 4 |
| **C** | [`AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) | `pendingEdits` / `saveEdit` docs: optimistic enqueue before send, `revertSaveEdit`, new **Optimistic persist flow** section (race fix, in-flight merge, saving indicator). WML integration: documents `subscribeFirst` band-aid. | **Keep** optimistic sections; **Phase 5** remove band-aid wording only |
| **C** | [`AGENT.testing.instrumentation.md`](../../../../charcoal-client/AGENT.testing.instrumentation.md) | Workbench session instrumentation section (new). `applyEdit` section: enqueue timing wording. | **Keep** workbench section (cat **E**); enqueue wording stays with **C** |
| **D** | [`lambda/wml/dataSource/mtw-wml.ts`](../../../../lambda/wml/dataSource/mtw-wml.ts) | `processApplyEdit` catch: `streamEvent` Merge Conflict with `RequestIds: [payload.RequestId]` (was log-only; client saw `INVALID MESSAGE`). | **Keep** unless product changes error UX |
| **E** | [`useDebounce.ts`](../../../../charcoal-client/src/hooks/useDebounce.ts) | `useDebouncedOnChange`: optional `enabled` (default `true`); both debounce effects no-op when `enabled === false`. | **Keep** (own commit); unrelated to Phase 4 |
| **E** | [`StandardLiteralEditor.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/StandardLiteral/StandardLiteralEditor.tsx) | `literalPlainString(value)` for display; prop sync via `[stringValue]` effect; pass `enabled: debounce` to hook; onChange guard is `newValue !== stringValue` only. | **Keep** |
| **E** | [`TopLevelStandardLiteralEditor.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/StandardLiteral/TopLevelStandardLiteralEditor.tsx) | Same pattern as `StandardLiteralEditor`. | **Keep** |
| **E** | [`useWorkbenchComponent.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx) | Optional `instrumentation` prop; `logSession` via `workbenchSessionInstrumentation`. Logs on flush skip/dispatch/reconcile/session reset. **`committedEchoSkipped`:** early return when `incoming.equals(lastFlush)` (was implicit via reconcile path). **Behavior:** after reconcile, `scheduleDebouncedFlush()` only when `hasLocalEdits` (`lastReceived.diff(working)` defined) --- was unconditional. | **Keep** behavior fix + logs; Phase 4 does not touch |
| **E** | [`useWorkbenchAssetMeta.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) | Optional `instrumentation`; session logs on flush/reconcile (mirror component). **`committedEchoSkipped`** early return when incoming equals `lastFlush`. Reconcile still calls `scheduleDebouncedFlush` when working or lastReceived changed (unchanged condition). | **Keep** |
| **E** | [`WorkbenchComponent/baseClasses.ts`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/baseClasses.ts) | `instrumentation?: ScopedInstrumentationOptions` on provider props. | **Keep** |
| **E** | [`WorkbenchAssetMeta/baseClasses.ts`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/baseClasses.ts) | Same `instrumentation` prop. | **Keep** |
| **E** | [`workbenchSessionInstrumentation.ts`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchSessionInstrumentation.ts) (**new**) | Session keys, `sessionStorage` activation, `logWorkbenchSession`, component/asset snapshot helpers. | **Keep** |
| **E** | [`scopedInstrumentation.ts`](../../../../charcoal-client/src/testing/scopedInstrumentation.ts) | `INSTRUMENTATION_KEYS.WORKBENCH_COMPONENT_SESSION`, `WORKBENCH_ASSET_META_SESSION`. | **Keep** |
| **E** | [`WorkbenchComponent/testing/mock.ts`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/testing/mock.ts) | Layered mock: `seedLayeredWorkbenchAsset`, `syncLayeredMockFromState`, `runLayeredUpdateStandardMock` (real `updateStandard` reducer over base/inherited/edit); `getLayeredMergedRoomShortName`, `isLayeredWorkbenchAssetMockActive`; `resetWorkbenchAssetMock` clears layered state; `applyLastFlushToCommitted` uses layered sync. | **Keep** |
| **E** | [`WorkbenchComponent/testing/harness.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/testing/harness.tsx) | Export layered mock helpers; `skipSeedWorkbenchAsset`; `setCommittedWml` uses layered sync when active. | **Keep** |
| **E** | [`WorkbenchShortNameField.test.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/WorkbenchShortNameField.test.tsx) | Test: `debounce={false}` does not fire debounced onChange after prop sync rerender. | **Keep** |
| **E** | [`workbenchMutations.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.test.ts) | Trailing blank line only (no logic change). | **Keep** or drop whitespace in cleanup |
| **-** | This plan (`AGENT.requestIdTracking.planning.md`) | RequestId tracking design + this inventory. | Update as work progresses |

**Not modified in working tree (referenced by rollback):** [`receiveWMLEvent`](../../../../charcoal-client/src/slices/personalAssets/index.ts) thunk --- pre-existing; used by band-aid handler today; Phase 4 folds clear + toast into pending hygiene thunk via `afterProcessEnvelope`, then retires band-aid and PubSub wiring.

### Category summary (Phase 4 intent)

| Cat | Rollback when `getEffectivePendingEdits` is verified |
| --- | --- |
| **A** | Delete ordering band-aid: `wmlStreamHandlers`, store registration, `subscribeFirst` (+ test) |
| **B** | Settle stream wiring: no personalAssets `StreamEventPubSub` subscription (hygiene via `afterProcessEnvelope`); remove dead `subscription` field in `baseClasses.ts`; update `index.api.ts` comments --- **A alone is insufficient** |
| **C** | **Do not roll back** --- optimistic save, revert, tests, docs (trim band-aid prose in Phase 5) |
| **D** | **Keep** --- lambda Merge Conflict stream on applyEdit failure |
| **E** | **Do not roll back during Phase 4** --- separate workbench/editor/instrumentation track |

**Suggested commit split (before Phase 4):** **C** + **D** (persist + lambda UX) | **A** + **B** (band-aid) | **E** (workbench/editor/instrumentation) | this plan.

### Phase 4 rollback verification

After removing section **A** (and settling **B**):

```bash
cd charcoal-client
rg "subscribeFirst|wmlStreamHandlers|registerPersonalAssetsWmlStreamHandlers" src
# Expect: no matches (or only comments in this plan)

rg "receiveWMLEvent|wmlStreamHandlers|registerPersonalAssetsWmlStreamHandlers" src/slices/personalAssets
# Expect: no PubSub handler; pending hygiene via afterProcessEnvelope (receiveWMLEvent retired or internal-only)
```

Update durable docs to remove `subscribeFirst` / "clear before merge" language (Phase 5).

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]`. Mark nested bullets `[X]` as each sub-step finishes.

### Phase 0 --- Header contract and factory spike

- [X] Optional audit: grep `RequestId`/`RequestIds` across backend data sources + client slices --- confirm stream-header producers; document in durable docs (**not** a runtime event-type allowlist). See Design note B **Phase 0 audit** and patterns **Stream correlation ids**.
- [X] Spike: extend `StreamEventDeserializedPayload` typing strategy --- **chosen hybrid** (loose PubSub bus + generic `Header` at factory boundary + per-slice header guards). See Design note **F**.
- [X] Spike: `DataSourceSliceConfig.requestIdTracking` shape; record confirmed ids from configured `headerField` when non-empty (same `processEnvelope` pass as aggregator)
- [X] Write reducer-level characterization test plan (confirm id + base update in one `processEnvelope` action; Merge Conflict records id without view change) --- see [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) (**Characterization tests (Phase 1)**)

### Phase 1 --- DataSource factory: confirmed RequestId storage

- [X] Add shared TTL constants (`PENDING_TTL_MS` = 3m, `CONFIRMED_TTL_MS` = 5m)
- [X] Extend `DataSourcePublic.subscribedStreams[streamKey]` with `confirmedRequestIds` (only when tracking enabled) --- landed in Phase 0 spike
- [X] Append `{ id, seenAt }` in `processEnvelope` when configured header field(s) are non-empty (any event type; storage append; normalize RequestId vs RequestIds) --- landed in Phase 0 spike
- [X] Export confirmed-RequestId selector with **dynamic 5m TTL** at read time (`now` injectable for tests)
- [X] Unit tests in [`charcoal-client/src/slices/dataSource/reducers.test.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.test.ts): cases 3-10 from characterization table; selector excludes ids older than 5m; unrelated stream keys isolated (cases 1-2 done in spike)

### Phase 2 --- Enable on `wmlDataSource`

- [X] Pass `requestIdTracking` config in [`charcoal-client/src/slices/wmlDataSource/index.ts`](../../../../charcoal-client/src/slices/wmlDataSource/index.ts)
- [X] Add [`selectors.ts`](../../../../charcoal-client/src/slices/wmlDataSource/selectors.ts) exports wrapping factory selector
- [X] Update [`charcoal-client/src/slices/wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) (steady-state behavior)

### Phase 3 --- personalAssets effective pending derivation

- [X] Add `getEffectivePendingEdits` cross-slice selector (confirmed filter, then **3m** `meta.time` filter)
- [X] Change `getLocalStandardForm` to use effective pending
- [X] Selector tests: base updated + raw pending present + confirmed id -> effective empty (no double); pending older than 3m excluded; inject fixed `now`
- [X] Add tests in [`selectors.test.ts`](../../../../charcoal-client/src/slices/personalAssets/selectors.test.ts) if present

### Phase 4 --- Cross-slice hygiene, band-aid rollback, and verification

Complete [Recorded changes](#recorded-changes-2026-06-04-working-tree) category **A** only after **4a** lands and tests pass. See design note **G**.

#### 4a --- `afterProcessEnvelope` factory hook + personalAssets pending hygiene (do first)

- [X] Add opt-in `afterProcessEnvelope?` to `DataSourceSliceConfig` in [`dataSource/index.ts`](../../../../charcoal-client/src/slices/dataSource/index.ts) (parallel to `onReady`; receives `dispatch`, `getState`, full `StreamEventDeserializedPayload`)
- [X] Thread callback through `createDataSourceSlice` -> `createInitializeAction` in [`dataSource/index.api.ts`](../../../../charcoal-client/src/slices/dataSource/index.api.ts): invoke **after** `dispatch(processEnvelope(payload))` in the StreamEventPubSub subscriber
- [X] Factory tests in [`dataSource/index.test.ts`](../../../../charcoal-client/src/slices/dataSource/index.test.ts): callback runs when configured; omitted when not; `getState()` after invoke sees reducer commit (mock reducer or spy dispatch order)
- [ ] Add `pendingHygieneCheck(assetId, envelope)` thunk in [`personalAssets/index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts): clear raw `pendingEdits` by effective confirmed RequestIds (`getWMLConfirmedRequestIds`); TTL-trim stale rows; Merge Conflict toast (pre-clear pending snapshot + `header.type`); fold or replace [`receiveWMLEvent`](../../../../charcoal-client/src/slices/personalAssets/index.ts) clear/toast paths
- [ ] `revertSaveEdit` confirmed guard: no-op when `requestId` is already in effective confirmed set (not only when physical row missing)
- [ ] Wire [`wmlDataSource/index.ts`](../../../../charcoal-client/src/slices/wmlDataSource/index.ts) `afterProcessEnvelope` to dispatch `pendingHygieneCheck(payload.streamKey, payload)` when `streamKey` is a valid asset UUID
- [ ] Tests: hygiene clears confirmed pending + drops saving indicator; Merge Conflict toast when pending matched; TTL trim; ordering --- wml `processEnvelope` then hygiene (no doubling in `getLocalStandardForm`); extend [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) / [`selectors.test.ts`](../../../../charcoal-client/src/slices/personalAssets/selectors.test.ts) as needed

#### 4b --- Lazy purge, band-aid rollback, category B cleanup, verification

- [ ] Lazy purge on `saveEdit` enqueue: remove raw `pendingEdits` with `meta.time` older than `PENDING_TTL_MS` (3m; secondary storage trim on user activity)
- [ ] **Delete** [`wmlStreamHandlers.ts`](../../../../charcoal-client/src/slices/personalAssets/wmlStreamHandlers.ts)
- [ ] **Remove** [`store/index.ts`](../../../../charcoal-client/src/store/index.ts) `registerPersonalAssetsWmlStreamHandlers` import and call
- [ ] **Remove** `PubSub.subscribeFirst` and its test if grep shows no other callers
- [ ] Settle category **B**: no personalAssets `StreamEventPubSub` subscription; remove dead `internalData.subscription` from [`baseClasses.ts`](../../../../charcoal-client/src/slices/personalAssets/baseClasses.ts); update [`index.api.ts`](../../../../charcoal-client/src/slices/personalAssets/index.api.ts) comments (hygiene via `afterProcessEnvelope`, not store-init handler)
- [ ] **Do not revert** section **C** (optimistic save / `revertSaveEdit` / save chain) or section **E** (workbench editor/session files)
- [ ] Run band-aid rollback grep commands (inventory section)
- [ ] Manual repro: imported room shortName/summary through flush + autosave --- no doubling, no visible revert flash; saving indicator clears on stream confirm

### Phase 5 --- Durable docs and cleanup

- [ ] Update [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) --- `getEffectivePendingEdits` vs raw `pendingEdits`; pending hygiene via wml `afterProcessEnvelope`; band-aid removed; short pointer to implementation doc for TTL rationale
- [ ] Update [`wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) --- `requestIdTracking` enabled; `afterProcessEnvelope` -> personalAssets hygiene; confirmed-id selector as cross-slice source (link to implementation doc)
- [ ] Update [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) --- `requestIdTracking` option (recording, selectors, tests); `afterProcessEnvelope` hook (wiring, ordering guarantee, wml -> personalAssets example)
- [ ] In same file, **requestIdTracking** section: add durable **Selector-time TTL (intentional impurity)** note --- correctness at read (not wall-clock-driven UI expiry); why select-time `now` is acceptable vs Redux purity/memoization norms; idle-tab behavior; backend `seenAt` vs client `now` / `meta.time`; rejected timer/reducer-eviction as correctness deps; carve-out from reducer "no `Date.now()`" rule (cross-link [`dataSource/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.md) Pure Functions if needed)
- [ ] Delete this task plan (git retains history)

---

## Verification

```bash
cd charcoal-client

# DataSource factory + afterProcessEnvelope hook
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/dataSource/index.test.ts
npm run test:single -- src/lib/pubSub/index.test.ts

# personalAssets pending / local form
npm run test:single -- src/slices/personalAssets/reducers.test.ts
npm run test:single -- src/slices/personalAssets/selectors.test.ts

# Workbench session (if reconcile tests added)
npm run test:single -- src/components/Workbench/foundations/workbenchMutations.test.ts
```

**Manual:** Edit summary on imported room; wait session flush (~1s) + autosave (~5s). Field stable, no doubling; `saving` true during in-flight pending; no flash to pre-save value on stream confirm.

**Grep sanity after Phase 4** (see [Recorded changes](#recorded-changes-2026-06-04-working-tree)):

```bash
rg "subscribeFirst|wmlStreamHandlers|registerPersonalAssetsWmlStreamHandlers" charcoal-client/src
```

Expect no production use of the ordering band-aid or personalAssets PubSub stream handler. Pending hygiene runs via `afterProcessEnvelope` on `wmlDataSource`.

---

## Out of scope (this initiative)

- Orphan RequestId ledger (deferred earlier; likely unnecessary once selector filtering works)
- Backend change to stream full merged snapshot instead of delta
- Moving `pendingEdits` storage into `wmlDataSource` (optional future; not required for correctness)
- `StandardRenderEditor` debounce / editor sync (separate track)

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task plan framework |
| [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md) | Vitest commands |
| [`charcoal-client/src/slices/wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) | wmlDataSource steady state |
| [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) | pendingEdits, optimistic save |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | Extended header / wire format |
| [`lambda/subscriptions/AGENT.md`](../../../../lambda/subscriptions/AGENT.md) | WebSocket `RequestIds` projection |
