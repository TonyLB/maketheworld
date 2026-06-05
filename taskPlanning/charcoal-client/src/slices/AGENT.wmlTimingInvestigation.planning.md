# WML subscribe merge investigation (charcoal-client)

**Status:** In progress. **Next step:** Phase 2.5 --- instrument `performCleanup` and confirm why it runs during subscribe reload (ledger consolidation before sidecar merge).

**Deferred (separate task):** [`AGENT.extendedHeaderRequestIdFix.planning.md`](AGENT.extendedHeaderRequestIdFix.planning.md) --- wire `extendedHeader.RequestIds` vs client `header.RequestIds` (not this bug's root cause).

This plan is task-scoped. Archive or delete it after the bug is fixed and instrumentation is removed; move any lasting norms into slice `AGENT.md` files next to code.

**Framework:** [`taskPlanning/AGENT.md`](../../../AGENT.md)

**Area development notes:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md)

---

## Purpose

Diagnose and fix incorrect Workbench state after **browser reload** on a subscribed asset: the UI can reflect only a recent **edit delta** (e.g. imported Room + shortName/render) instead of the full merged asset, even though Network shows both **`Snapshot`** and **`Content Update`** `mtw.wml` StreamEvents.

Waiting for a **later snapshot** (or subscribe-time sidecar refresh) restores correct merged content, which suggests a **client-side merge / ordering** failure rather than bad backend WML.

---

## Problem statement (repro)

1. Open a Draft asset in Workbench (Area with existing Rooms).
2. Import a new Room, set shortName and default render; save / stream confirm --- UI looks correct.
3. **Reload the browser** and reopen the asset.
4. Network delivers subscribe **`Snapshot`** (sidecar URL) and replayed **`Content Update`**.
5. UI shows state consistent with **only the edit diff**, not full asset + edit.
6. After snapshot timeout / next snapshot, merged content appears correct.

---

## Manual smoke testing constraints

Manual repro for this bug is **fragile**. Treat the notes below as expected operational difficulty, not investigator error.

**Snapshot regeneration destroys the case.**

When the backend WML snapshot **times out** and is **regenerated from S3** (subscribe sidecar refresh / new presigned snapshot), the stream state moves on. A subscribe/reload repro that depended on a specific **Snapshot + replayed Content Update** pair is often **lost**:

- The sidecar URL and `replayAt` watermark change.
- Replayed Content Updates and **`RequestIds`** from the earlier session no longer match what appears in Network or Redux.
- Redux `recentEvents` may show a different event mix (e.g. synthetic cleanup snapshot, later edits only).

**Expect to recreate the repro frequently.**

In practice, roughly **every five minutes** while smoke-testing, the snapshot cycle can force a **new test case**: edit again (import Room, shortName, render, save), then reload before the window closes. Each fresh case may have its **own idiosyncratic structure** (different RequestIds, different CU count, placement vs room-only deltas split across saves).

**Implications for this investigation.**

| Do | Avoid |
| --- | --- |
| Capture Network + console + Redux **immediately** after reload while instrumentation is on | Treat a single captured `RequestId` or timestamp pair as a permanent fixture |
| Log **patterns** (ingest order, `eventsAfterSnapshotCount`, `positionGraph.nodes`) | Blocking on reproducing the exact `fa55489f-...` / `1780685864729` pair from an earlier session |
| Prefer **automated regression tests** (Phase 4) once the failure mode is identified | Long open DevTools sessions without re-editing; the case may self-heal via fresh snapshot |
| Record repro **wall-clock time** and snapshot `createdAt` / `replayAt` in **Discoveries** when a case is captured | Assuming stale Redux dumps from after subsequent edits still describe the initial reload failure |

Instrumentation should make **transient** failures capturable in one reload cycle; Phase 4 tests exist partly so we are not permanently dependent on the five-minute manual window.

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Client sync invariants (I4 layer ordering):** [`charcoal-client/src/slices/AGENT.client-sync-invariants.md`](../../../../charcoal-client/src/slices/AGENT.client-sync-invariants.md)
3. **wmlDataSource:** [`charcoal-client/src/slices/wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md)
4. **dataSource pattern (out-of-order, sidecar, cleanup):** [`charcoal-client/src/slices/dataSource/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.md), [`charcoal-client/src/slices/dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md)
5. **Stream ingest bridge (async deserialize):** [`charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md)
6. **Client instrumentation conventions:** [`charcoal-client/AGENT.testing.instrumentation.md`](../../../../charcoal-client/AGENT.testing.instrumentation.md)
7. **Backend subscribe / replayAt:** [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) (**Snapshot metadata: `createdAt` and `replayAt`**), [`lambda/wml/dataSource/snapshotContent.ts`](../../../../lambda/wml/dataSource/snapshotContent.ts)

**Test command authority:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md). Run from `charcoal-client/`.

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/dataSource/index.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
```

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Investigation / hypothesis (no code) | Done |
| 1 | Add gated `wml-stream-sync` instrumentation | Done |
| 2 | Reproduce with logs; record findings in **Discoveries** | Done |
| 2.5 | Instrument `performCleanup`; confirm cleanup role on subscribe reload | Not started |
| 3 | Fix root cause (ingest ordering + snapshot-path cleanup policy) | Not started |
| 4 | Regression test(s) | Not started |
| 5 | Remove instrumentation; update durable docs if needed | Not started |

---

## Discoveries (investigation log)

Record dated entries as we learn more. Keep task-specific detail here; link to code/docs for steady-state behavior.

### 2026-06-05 --- Initial analysis (pre-instrumentation)

**Out-of-order handling should recover for observed timestamps.**

Example subscribe pair (asset `ASSET#36fd91da-8c69-48aa-98b4-3e5dccbcb22b`):

| Event | WS `timestamp` | Notes |
| --- | --- | --- |
| Snapshot | `1780685828686` | `update.replayAt`: `1780685829053`; sidecar key `.../1780685829053.wml` |
| Content Update | `1780685864729` | ~36s **after** snapshot `createdAt`; inline WML with Area/Room placement |

`processEnvelope` snapshot path re-applies updates with `timestamp > snapshotTimestamp` ([`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts)). Sidecar **fetch delay** alone should not prevent recovery once the snapshot reducer runs with the CU already in `recentEvents`.

**Client ignores `replayAt`.**

The charcoal `dataSource` slice has **no** references to `replayAt`. Ordering uses WebSocket top-level `timestamp` (= backend `createdAt`), not `update.replayAt` (sidecar watermark). The ~367ms `createdAt` vs `replayAt` gap is not the cause for the example CU (+36s), but it is a real contract skew for events between those two times.

**Redux dump suggests a narrower failure than "snapshot never merged".**

After reload + subsequent edits, `wmlDataSource.subscribedStreams[assetId]` showed:

- **`materializedView`**: full Area + original Rooms + `ROOM#BRIDGE` component with shortName/situations (not empty-base + diff only).
- **`AREA#WORLD.positionGraph.nodes`**: still `CLIFFTOP`, `CORNER`, `STRAIGHTAWAY`, `VORTEX` --- **`ROOM#BRIDGE` missing** from graph despite component existing.
- **`recentEvents`**: synthetic Snapshot from `performCleanup` at `1780685922917` (placeholder header); two Content Updates with **different** RequestIds than the subscribe replay CU in Network.
- Subscribe replay CU (placement WML: Area wrapping Room, RequestId `fa55489f-...`, timestamp `1780685864729`) **not present** in `recentEvents`. *(That pair was valid for one session; see **Manual smoke testing constraints** --- do not expect the same ids after snapshot regeneration.)*

**Working hypothesis:** the **placement** Content Update (topology / Area ref) never entered the merge chain that produced `materializedView`, while **room-only** deltas (shortName, default render) did apply on top of the sidecar baseline. UI "edit diff only" may mean missing topology / graph placement, not necessarily empty `materializedView`.

**"Wait for next snapshot" fix** is consistent with a **fresh server-side sidecar** bypassing the broken client merge chain, not with 30s cleanup alone fixing merge logic.

### 2026-06-05 --- Manual smoke test (`wml-stream-sync` on)

**Sessions:** one **happy-path** reload (`ASSET#36fd91da-...`) and one **failure** reload (`ASSET#280e2f0c-...`). Instrumentation enabled via `sessionStorage` before reload.

#### Happy path (no UI bug)

After reload, subscribe Snapshot sidecar fetch (~136ms) completed **before** replay Content Updates were processed. Snapshot `processEnvelope`: `eventsAfterSnapshotCount: 0`. Sidecar `materializedView` already included full graph (e.g. `ROOM#BRIDGE` in `positionGraphNodes`); replay CUs were redundant field merges. **Not a useful failure capture** --- backend snapshot had already incorporated prior edits.

#### Failure repro (`ASSET#280e2f0c-1840-451f-a2ce-8742e86350c1`)

**Wall-clock:** browser reload via `Navigated to http://localhost:3000/` (2026-06-05 session). **UI:** thin asset (one room + edited situation fields), not full world.

**Network subscribe bundle (wire order):**

| Event | WS `timestamp` | RequestId(s) | Role |
| --- | --- | --- | --- |
| Snapshot | `1780693218706` | --- | `replayAt: 1780693219008`; sidecar `.../1780693219008.wml` |
| Content Update | `1780693238927` | `c8b77015-...` | **Placement** (Area wraps `ROOM#STRAIGHTAWAY`) |
| Content Update | `1780693245326` | `c58bd1f9-...` | ShortName |
| Content Update | `1780693328753` | `09cb6763-...` | DisplayName |
| *(+ later CUs in Redux)* | `1780693334305`, `1780693341574` | `052c5567-...`, `321dca67-...` | Summary, Description |

**Client processing order (console; not the same as event timestamps):**

1. **Before** Snapshot `lifelineReceived`: Description CU (`3341574`) `event-in-order` on empty `recentEvents`; Summary CU (`3334305`) `event-reagg`.
2. Snapshot `lifelineReceived` + `deserializeStart` (`3218706`).
3. Placement CU (`3238927`) `processEnvelope` **`event-reagg`** --- **before** Snapshot `deserializeDone`.
4. ShortName CU (`3245326`) `event-reagg`.
5. Snapshot `deserializeDone` -> `processEnvelope` **`path: snapshot`**, **`eventsAfterSnapshotCount: 3`**, `latestCachedTimestamp: 1780693341574`.
6. DisplayName CU (`3328753`) `event-reagg` after snapshot.

**Final Redux (`subscribedStreams`):**

- `materializedView`: thin --- `AREA#WORLD` with only `ROOM#STRAIGHTAWAY` in graph; situation fields merged on that room.
- `recentEvents`: **no** subscribe Snapshot row with real `mtw.wml` header; **synthetic** Snapshot at `1780693311574` (placeholder header); surviving field-edit CUs only --- placement (`c8b77015`) and shortName (`c58bd1f9`) **absent** from event list.
- `confirmedRequestIds: []` (RequestIds on wire live under `extendedHeader`; instrumentation/tracking read top-level `header.RequestIds` --- separate plumbing gap).

**Hypothesis verdicts (this repro):**

| ID | Verdict | Notes |
| --- | --- | --- |
| H1 | **Rejected** | Placement and other CUs reached `deserializeDone`, `published`, and `processEnvelope`. |
| H2 | **Confirmed (variant)** | Snapshot ran with **`eventsAfterSnapshotCount: 3`**; replay CUs were already in `recentEvents` and several had been merged **before** sidecar snapshot `processEnvelope`. |
| H3 | **Rejected** (field-edit path) | Situation displayName/summary/description merged correctly onto the thin room; not a `StandardForm.merge` failure for those deltas. |
| H4 | **Confirmed in play** | Only snapshot in storage is **synthetic** cleanup; subscribe Snapshot row gone. Cleanup `thirtySecondsAgo` derived from **newest CU**, not subscribe snapshot time. |
| H5 | **Secondary / open** | Sidecar content at `1780693219008.wml` not fetched in-session; failure explained without proving thin sidecar bytes. Ordering + cleanup suffice for this repro. |

**Root cause (failure repro):** not missing WS delivery and not deserialize drops. **`streamEventPubSub` fire-and-forget async** lets fast inline CUs publish before slow sidecar Snapshot; **`performCleanup` on the snapshot path** can consolidate replay CUs into a synthetic baseline **before** sidecar merge, so snapshot `applyEvents(sidecar, updatesAfter)` sees a **truncated** replay set. Reducer out-of-order logic exists but **preconditions were violated** (see **Failure model** below).

---

## Failure model (abstract)

Use this as the mental model for Phase 3; details stay in **Discoveries** above.

**Invariant the client needs on subscribe reload:**

> **Authoritative snapshot first** --- the sidecar Snapshot must become the merge baseline before any replay Content Update for that stream is applied (or must be the sole baseline used when it lands).

**Three layers (where things break):**

```text
  WebSocket          streamEventPubSub          processEnvelope (reducer)
  (delivery)         (async deserialize)        (merge + cleanup)
       |                      |                          |
       |    fire-and-forget     |   assumes snapshot in    |
       |    sidecar slow       |   recentEvents OR empty  |
       +----------------------+--------------------------+
```

1. **Ingest (`streamEventPubSub`):** Snapshot and CUs deserialize in parallel. Sidecar fetch is slow; inline CUs are fast -> **CUs can hit the reducer first** even when Network lists Snapshot first.
2. **Reducer event path:** Out-of-order **re-aggregation** works only if a **trustworthy snapshot** is already in `recentEvents`. Otherwise baseline is `createEmpty` or a **synthetic** cleanup snapshot built from wrong prior merges.
3. **Reducer snapshot path:** Intended recovery: `materializedView = applyEvents(sidecar, updates with timestamp > snapshot)`. But **`performCleanup` runs first**, using `max(recentEvents, incoming)` as "now". When replay CUs arrived early and timestamps span >30s, cleanup **folds early replay CUs into synthetic** and removes them from the list sidecar re-apply uses.

**Why "diff only" UI:**

- User sees **edit deltas merged onto a thin baseline** (one room, partial graph), not **sidecar full asset + replay**.
- Waiting for **next snapshot** fixes it because a **fresh sidecar** bypasses the broken chain (same as happy-path session).

**Fix directions (Phase 3):**

| Priority | Target | Idea |
| --- | --- | --- |
| 1 | [`streamEventPubSub/index.ts`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts) | Per-`streamKey` queue: hold replay CUs until subscribe Snapshot for that stream has **published** (or serialize deserialize). |
| 2 | [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) | On authoritative Snapshot ingest, skip or defer `performCleanup` that would consolidate not-yet-rebased replay CUs. |
| 3 | (Optional) | Read `replayAt` for merge boundary (H5 secondary). |

**Out-of-order handling is not worthless** --- it was never designed for "replay deltas applied minutes (timestamp-space) ahead of a subscribe snapshot that is still fetching." That is the gap.

---

## Phase 2.5 --- Confirm `performCleanup` role

Phase 2 proved **ingest ordering** and inferred **cleanup consolidation** from ledger diffs + synthetic snapshot rows. Phase 2.5 turns H4 from inference into **observed** behavior: log every `performCleanup` invocation during `wml-stream-sync` and answer **why it runs when we expect subscribe recovery to need a full replay ledger**.

### Why we think cleanup is suspicious on subscribe reload

`performCleanup` ([`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts)) implements a **30-second rolling window** for `recentEvents` storage hygiene. It is invoked at the **start of every** `processEnvelope` (both Snapshot and Content Update paths), before merge logic runs.

On subscribe reload we **expect**:

1. Authoritative **sidecar Snapshot** becomes baseline.
2. **All replay Content Updates** with `timestamp > snapshot.createdAt` remain available for snapshot-path `applyEvents(sidecar, updatesAfter)`.

We **do not expect** (for this scenario):

- Cleanup to use **newest replay CU timestamp** as "now" while processing an **older** subscribe Snapshot envelope (`incomingTimestamp` << `max(recentEvents)`).
- Early replay rows (placement, shortName) to be **folded into synthetic** and removed as separate envelopes **before** sidecar merge completes.

Failure repro math (see **Discoveries** 2026-06-05): when incoming CU `1780693341574` runs cleanup, `thirtySecondsAgo = 1780693311574`. Placement `1780693238927` and shortName `1780693245326` are `<= thirtySecondsAgo` and fall into `oldEvents` per code. That is **by design** of the 30s window, not an accident --- the open question is whether cleanup should run at all in this subscribe window.

### Phase 2.5 questions (answer from logs + one optional repro)

| # | Question |
| --- | --- |
| Q1 | **Which caller** triggered cleanup? (`caller: 'snapshot' \| 'event'`, plus `headerType` / `path` from the surrounding `processEnvelope`) |
| Q2 | What were **`incomingTimestamp`**, **`latestTimestamp`**, **`thirtySecondsAgo`**? Does `latestTimestamp` come from a CU while `incomingTimestamp` is the subscribe Snapshot? |
| Q3 | **`oldEventsCount`** vs **`stillRecentCount`** --- which replay RequestIds / timestamps landed in `oldEvents`? |
| Q4 | Did cleanup **`consolidate`** (synthetic created) or **no-op** (`oldEvents.length === 0`)? |
| Q5 | If consolidated: **`syntheticTimestamp`**, **`baselineSource`** (`empty` \| `snapshot-in-oldEvents` \| `synthetic-prior`), and summary of consolidated event types/timestamps |
| Q6 | On subscribe Snapshot `processEnvelope`: what was **`eventsAfterSnapshotCount`** after cleanup had already run on the same `recentEvents`? |

### Planned instrumentation (not yet in code)

Gate on `wml-stream-sync` + `dataSourceKey === 'mtw.wml'` (same as `processEnvelope` trace). Log from inside or immediately around `performCleanup` return:

| Field | Purpose |
| --- | --- |
| `caller` | `'snapshot'` or `'event'` (passed from `processEnvelope` branch) |
| `streamKey` | Asset stream |
| `incomingTimestamp` | Envelope being processed |
| `latestTimestamp` | `max(recentEvents, incoming)` per cleanup |
| `thirtySecondsAgo` | Window boundary |
| `oldEventsSummary` | `{ type, timestamp }[]` before consolidation |
| `stillRecentSummary` | `{ type, timestamp }[]` kept as-is |
| `action` | `'no-op'` \| `'consolidated'` |
| `syntheticTimestamp` | When consolidated |
| `baselineSource` | How baseline snapshot content was chosen |

Prefix: `[wml-stream-sync] performCleanup`. Implementation home: [`wmlStreamSyncInstrumentation.ts`](../../../../charcoal-client/src/testing/wmlStreamSyncInstrumentation.ts) + call from [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts).

### Instrumentation signal triage (Phase 2 learnings)

| Site | Keep for Phase 2.5? | Notes |
| --- | --- | --- |
| `ingest` | **Yes** | Processing order vs event timestamps |
| `processEnvelope` | **Yes** | `path`, `eventsAfterSnapshotCount` |
| `performCleanup` | **Add** | Primary Phase 2.5 deliverable |
| `afterEnvelope` | **Low** | personalAssets layer; not where thin `materializedView` failed |

### Exit criteria for Phase 2.5

- At least one failure or success reload log shows **`performCleanup`** lines bracketing subscribe Snapshot + replay CUs.
- **Discoveries** entry updates H4 to **Confirmed** or revises mechanism (e.g. cleanup no-op on snapshot path but event path already consolidated).
- Phase 3 fix scope is explicit: ingest queue only, cleanup policy only, or **both** (current **Failure model** assumes both).

---

## Instrumentation registry

Track **every** temporary log/gate added for this task. Phase 5 must remove or revert all rows here.

| ID | Activation key | File(s) | What it logs | Added | Removed |
| --- | --- | --- | --- | --- | --- |
| wml-stream-sync | `wml-stream-sync` | [`scopedInstrumentation.ts`](../../../../charcoal-client/src/testing/scopedInstrumentation.ts), [`wmlStreamSyncInstrumentation.ts`](../../../../charcoal-client/src/testing/wmlStreamSyncInstrumentation.ts), [`streamEventPubSub/index.ts`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts), [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts), [`personalAssets/index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) | `ingest` phases, `processEnvelope`, `afterEnvelope` (see table below) | 2026-06-05 | --- |

**Activation:**

```javascript
sessionStorage.setItem('mtw-instrumentation', '["wml-stream-sync"]')
// disable: sessionStorage.removeItem('mtw-instrumentation')
```

`WML_STREAM_SYNC` is in [`charcoal-client/src/testing/scopedInstrumentation.ts`](../../../../charcoal-client/src/testing/scopedInstrumentation.ts).

### Instrumentation sites (implemented)

Follow [`charcoal-client/AGENT.testing.instrumentation.md`](../../../../charcoal-client/AGENT.testing.instrumentation.md): use `console.log`, log WML digests not raw JSON, gate on `wml-stream-sync`.

| Site | Prefix / event | Fields to log |
| --- | --- | --- |
| [`streamEventPubSub/index.ts`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts) | `[wml-stream-sync] ingest` | `phase` (`lifelineReceived` / `deserializeStart` / `deserializeDone` / `published` / `droppedNull` / `failed`), `dataSourceKey`, `streamKey`, `header.type`, envelope `timestamp`, `replayAt` (from raw update when Snapshot), `deserializeMs`, `RequestIds` |
| [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) `processEnvelope` | `[wml-stream-sync] processEnvelope` | `path` (`snapshot` / `event-in-order` / `event-reagg`), `incomingTimestamp`, `latestCachedTimestamp`, `eventsAfterSnapshotCount`, `recentEventsSummary` (`{ type, timestamp, requestIds }[]`), `positionGraphNodes` (from `AREA#*` in materialized view if present), truncated WML digest of `materializedView` |
| [`personalAssets/index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) `registerWmlAfterProcessEnvelopeConsumer` | `[wml-stream-sync] afterEnvelope` | same envelope ids; `baseComponentCount`, `positionGraphNodes`, `effectivePendingCount`, `localFormComponentCount` |

**Cleanup checklist (Phase 5):**

- [ ] Remove all `[wml-stream-sync]` log sites listed in **Instrumentation registry**
- [ ] Remove `WML_STREAM_SYNC` from `INSTRUMENTATION_KEYS` if unused elsewhere
- [ ] Remove any `sessionStorage` docs added only for this task from code comments (keep activation in this plan until deleted)
- [ ] Confirm no call sites pass `options: { instrumentation: ['wml-stream-sync'] }` unless intentionally kept for future debugging

---

## Hypotheses to confirm or reject

| ID | Hypothesis | Status (2026-06-05 smoke test) |
| --- | --- | --- |
| H1 | Placement CU never reaches `processEnvelope` (deserialize drop / race) | **Rejected** --- CUs reach `published` and `processEnvelope`; failure is **ordering**, not drops. |
| H2 | Snapshot `processEnvelope` runs with replay CUs already merged on wrong baseline; sidecar re-apply incomplete | **Confirmed** --- `eventsAfterSnapshotCount: 3`; placement `processEnvelope` before Snapshot `deserializeDone`. |
| H3 | Placement CU applies but `StandardForm.merge` does not update `positionGraph.nodes` | **Rejected** for field-edit repro; **open** for Phase 0 BRIDGE placement-only case (different session). |
| H4 | `performCleanup` consolidation drops replay CUs before sidecar snapshot merge | **Strong inference** --- synthetic snapshot in `recentEvents`; placement/shortName gone from ledger vs Network. **Phase 2.5** adds direct cleanup logs. |
| H5 | Stale sidecar at subscribe; replay CU excluded by timestamp semantics | **Open / secondary** --- failure repro explained by H2+H4 without sidecar byte inspection; `replayAt` still unused on client. |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets as you finish them).

- [X] **Phase 1 --- Instrumentation**
  - [X] Add `WML_STREAM_SYNC` to `scopedInstrumentation.ts`
  - [X] Implement ingest timeline in `streamEventPubSub` (gate on `mtw.wml` + activation key)
  - [X] Implement `processEnvelope` trace in `reducers.ts` (gate on `mtw.wml` via passed config or header check in wrapper --- prefer minimal coupling)
  - [X] Implement `afterEnvelope` trace in `personalAssets` consumer
  - [X] Update **Instrumentation registry** table with file paths and dates
- [X] **Phase 2 --- Reproduce and record**
  - [X] Enable `sessionStorage` activation **before** edit/save/reload (see **Manual smoke testing constraints**)
  - [X] Create fresh edit (import + shortName + render + save); reload **immediately** while case is live
  - [X] Capture in one pass: Network Snapshot + CU timestamps/RequestIds; console ingest + reducer sequence; Redux `subscribedStreams` snapshot
  - [X] Append findings to **Discoveries** (include wall-clock time; note if snapshot had since regenerated); mark H1--H5 confirmed/rejected
- [ ] **Phase 2.5 --- Confirm `performCleanup` role**
  - [ ] Add gated `[wml-stream-sync] performCleanup` trace in [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) (see **Phase 2.5** below)
  - [ ] Update **Instrumentation registry** with cleanup log site and date
  - [ ] Optional: one confirmatory reload; append **Discoveries** with cleanup lines tied to subscribe Snapshot / replay CUs
  - [ ] Record answers to **Phase 2.5 questions** (why cleanup runs; which events consolidated; caller path snapshot vs event)
- [ ] **Phase 3 --- Fix**
  - [ ] Implement fix (see **Failure model**: per-stream ingest queue in `streamEventPubSub`; snapshot-path cleanup exemption in `reducers.ts`)
  - [ ] Manual verify: reload -> full merged UI without waiting for next snapshot
- [ ] **Phase 4 --- Tests**
  - [ ] Add reducer or integration test: CU before sidecar snapshot completes; assert final `materializedView` includes placement (including `positionGraph.nodes` if applicable)
  - [ ] Run baseline slice tests (see **Verification**)
- [ ] **Phase 5 --- Cleanup**
  - [ ] Complete **Instrumentation registry** cleanup checklist
  - [ ] Move any lasting contract notes (e.g. client should use `replayAt` for snapshot boundary) into [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) or [`wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) if still relevant
  - [ ] Delete or archive this task plan

---

## Verification

**During investigation (after instrumentation):**

1. Enable `wml-stream-sync` in browser console **before** creating the edit under test.
2. Edit -> save -> reload + open asset **promptly** (snapshot regeneration ~every five minutes can invalidate the case; see **Manual smoke testing constraints**).
3. Confirm log sequence includes subscribe Snapshot and replay Content Update; record timestamps/RequestIds for **this** session only.
4. Inspect Redux immediately: `wmlDataSource.publicData.subscribedStreams[<assetId>].materializedView` and `AREA#WORLD.positionGraph.nodes`.

**Phase 2.5 (cleanup confirmation):**

1. After cleanup instrumentation lands, reload with `wml-stream-sync` enabled.
2. Capture `[wml-stream-sync] performCleanup` lines for the subscribe window.
3. Answer **Phase 2.5 questions** Q1--Q6 in **Discoveries** (one dated entry).

**Automated (after fix):**

```bash
cd charcoal-client
npm run test:single -- src/slices/dataSource/reducers.test.ts
npm run test:single -- src/slices/dataSource/index.test.ts
npm run test:single -- src/slices/wmlDataSource/index.test.ts
# add path(s) for new regression test(s) when written
```

**Manual (after fix):**

- Import Room + shortName + default render -> save -> reload -> Workbench shows full Area + new Room in graph and editors (no "diff only" state).

---

## Coordination notes

- Backend subscribe delivers Snapshot with **`createdAt`** envelope time and **`replayAt`** in payload; replay queries Dynamo strictly after **`replayAt`**. Client merge boundary today uses **`createdAt` only** --- optional follow-up (H5 secondary).
- **`extendedHeader.RequestIds`:** separate deferred task --- [`AGENT.extendedHeaderRequestIdFix.planning.md`](AGENT.extendedHeaderRequestIdFix.planning.md). Not root cause of thin `materializedView` on reload; track via GitHub Issue after WML timing fix ships.
- Do not duplicate full `dataSource` algorithm docs here; link [`AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) **Event Processing** and **Sidecar Snapshot Handling** sections.
