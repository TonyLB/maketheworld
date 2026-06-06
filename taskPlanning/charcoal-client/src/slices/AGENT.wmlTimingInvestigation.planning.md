# WML subscribe merge investigation (charcoal-client)

**Status:** In progress. **Next step:** Finish Phase 2.6 durable docs, then Phase 3 --- implement non-destructive ledger + `CompactedCheckpoint` redesign in [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) (design choices recorded below).

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
| 2.5 | Instrument `performCleanup`; confirm cleanup role on subscribe reload | Done |
| 2.6 | Ledger redesign + durable design (non-destructive CPs; abandon 30s window) | In progress (design choices recorded; durable docs pending) |
| 3 | Implement fix per Phase 2.6 design | Not started |
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

### 2026-06-05 --- Phase 2.5 confirmatory reload (`performCleanup` logs)

**Asset:** `ASSET#280e2f0c-1840-451f-a2ce-8742e86350c1` (same asset as Phase 2 failure; fresh edit: import `ROOM#VORTEX`, shortName + default render fields, save, reload). **Wall-clock:** browser reload via `Navigated to http://localhost:3000/`. **UI:** thin --- `ROOM#VORTEX` present with situation text but **not** in `positionGraph`; graph shows only `ROOM#STRAIGHTAWAY`.

**Replay bundle (event timestamps):**

| Event | WS `timestamp` | RequestId | Role |
| --- | --- | --- | --- |
| Snapshot | `1780700419588` | --- | Subscribe sidecar baseline |
| Content Update | `1780700532599` | *(placement)* | **Placement** (Area / topology for `ROOM#VORTEX`) |
| Content Update | `1780700538002` | `984eb650-...` | ShortName (`Cliff Base`) |
| Content Update | `1780700549590` | `1a2981e4-...` | DisplayName |
| Content Update | `1780700556914` | `dd50fd64-...` | Summary |
| Content Update | `1780700563578` | `9235693e-...` | Description |

**Client processing order (console; sidecar Snapshot last):**

1. CU `1780700538002` (shortName) --- `performCleanup` no-op; `processEnvelope` **`event-in-order`** on empty ledger.
2. CU `1780700563578` (description) --- `event-in-order`.
3. CU `1780700556914` (summary) --- `event-reagg`.
4. CU `1780700532599` (placement) --- `event-reagg` (**before** Snapshot `deserializeDone`).
5. CU `1780700549590` (displayName) --- `event-reagg`.
6. Snapshot `1780700419588` --- `performCleanup` with `caller: snapshot`, `incomingTimestamp: 1780700419588`, `latestTimestamp: 1780700563578`; `processEnvelope` **`path: snapshot`**, **`eventsAfterSnapshotCount: 5`**.

**Cleanup consolidation (H4 confirmed):**

When newest CU (`1780700563578`) drove cleanup on the event path:

- `latestTimestamp` = `1780700563578`; `thirtySecondsAgo` = `1780700533578`.
- Placement CU `1780700532599` **<=** `thirtySecondsAgo` --- folded into **`oldEvents`** and consolidated.
- ShortName `1780700538002` and later field CUs **>** `thirtySecondsAgo` --- kept as separate ledger rows.

**Final Redux (`subscribedStreams`):**

- `materializedView`: `AREA#WORLD.positionGraph.nodes` = **`ROOM#STRAIGHTAWAY` only**; `ROOM#VORTEX` component exists with full situation fields but **absent from graph**.
- `recentEvents`:
  1. Real subscribe Snapshot @ `1780700419588` (sidecar: STRAIGHTAWAY-only graph).
  2. **Synthetic** Snapshot @ `1780700533578` (placeholder header; consolidated placement --- VORTEX-only graph).
  3. Field-edit CUs only (shortName, displayName, summary, description).
  - **Placement CU `1780700532599` absent** as a standalone row --- consolidated away before subscribe Snapshot merge.
- `confirmedRequestIds: []` (`extendedHeader.RequestIds` not read by instrumentation --- separate task).

**Why snapshot-path recovery failed despite `eventsAfterSnapshotCount: 5`:**

Snapshot `applyEvents(sidecar, updatesAfter)` re-applies only **non-Snapshot** envelopes with `timestamp > snapshotTimestamp`. The synthetic Snapshot row (`header.type === 'Snapshot'`) is **skipped**. Consolidated placement lived inside synthetic #2, not as a replay CU the sidecar merge could re-apply. Remaining CUs are field-only edits on `ROOM#VORTEX` --- they do not restore full-world topology.

**Phase 2.5 question answers (Q1--Q6):**

| # | Answer |
| --- | --- |
| Q1 | Cleanup triggered by **`event`** for all replay CUs; **`snapshot`** when subscribe Snapshot processed. |
| Q2 | On snapshot cleanup: `incomingTimestamp: 1780700419588`, `latestTimestamp: 1780700563578` --- window anchored on **newest CU**, not subscribe Snapshot time. |
| Q3 | Placement `1780700532599` in **`oldEvents`** (consolidated); field CUs after `1780700533578` in **`stillRecent`**. |
| Q4 | **`consolidated`** --- synthetic Snapshot created at `1780700533578` before subscribe Snapshot `processEnvelope`. |
| Q5 | `syntheticTimestamp: 1780700533578`; synthetic content: `AREA#WORLD` with **`ROOM#VORTEX` only** in graph (consolidated placement baseline); `baselineSource: empty` on first consolidation (no prior snapshot in `oldEvents`). |
| Q6 | Snapshot reported **`eventsAfterSnapshotCount: 5`**, but count includes **synthetic Snapshot row**; standalone placement envelope **not** available for sidecar re-apply. |

**Hypothesis verdicts (this repro):**

| ID | Verdict | Notes |
| --- | --- | --- |
| H2 | **Confirmed** | Five replay CUs merged before Snapshot `deserializeDone`; snapshot `eventsAfterSnapshotCount: 5`. |
| H4 | **Confirmed** | Direct `performCleanup` logs + synthetic row @ `1780700533578` + placement CU gone from ledger. |
| H3 | **Rejected** (placement) | Placement loss is ledger consolidation, not `StandardForm.merge` failure on topology delta. |

**Phase 3 scope (historical):** originally ingest queue + cleanup deferral. **Superseded by Phase 2.6 redesign** (2026-06-05): single merge algorithm, non-destructive ledger, no subscribe/live mode split. See **Discoveries** (Phase 2.6 design session) and **Phase 2.6** below.

### 2026-06-05 --- Root cause (design level): destructive ledger compaction

Investigation conclusion (post Phase 2.5): the bug is **destructive** `performCleanup` --- folding replay Content Updates into synthetic `Snapshot` rows and **removing** individual envelopes before the authoritative sidecar Snapshot rebases. Out-of-order sidecar delivery is a stress case, not a separate protocol. **Phase 2.6 redesign** replaces destructive synthetics with non-destructive **`CompactedCheckpoint`** rows and retains all update envelopes until an authoritative snapshot supersedes them (memory bounding via backend snapshots only; dynamic management out of scope).

### 2026-06-05 --- Phase 2.6 design session (ledger re-envisioning)

**Abandoned requirements** (were never correct or never necessary):

| Former assumption | Why abandoned |
| --- | --- |
| Events arrive within 30 seconds of their timestamp | False for subscribe replay (events are intentionally old). Not required for correctness. |
| `performCleanup` bounds `recentEvents` memory via 30s timestamp window | Unsafe: client cannot know delivery is complete; OOO updates after an authoritative snapshot still require retained envelopes. Memory bounding is **authoritative backend snapshots only** (dynamic strategies out of scope). |
| Live stream vs subscribe replay need separate reducer modes | **Collapsed:** one algorithm handles both when the ledger is non-destructive and OOO authoritative snapshot rebase is supported. |

**Three ledger roles** (must not conflate):

| Role | Authority | Purpose |
| --- | --- | --- |
| **Authoritative Snapshot** | Backend only | Freeze point; merge baseline; may incorporate events before its timestamp. Only source that can assert "stream processed through boundary X." |
| **Update envelope** | Per-event | Canonical replay log since latest authoritative snapshot. Never removed by checkpoint logic. |
| **CompactedCheckpoint (CP)** | Client-derived hint | Non-destructive merge cache: "given current ledger, merged state through timestamp T is D." Accelerates OOO re-aggregation near ledger tail; **not** a snapshot substitute. |

**Recorded design choices:**

1. **CP metadata:** CP has a `timestamp` like every other `recentEvents` row. It aggregates every **Update** with `timestamp <=` that value (inclusive).
2. **Invalidation (updates):** Any new information at timestamp `x` invalidates every CP with `timestamp >= x`. Example: OOO `e` between `d` and `f` drops `CP2`; rebuild from `CP1 + d + e + f + ...`.
3. **Authoritative snapshot rebase + prune (OQ1, OQ2):** On authoritative `S`, **prune** from `recentEvents` every row (prior snapshots, updates, CPs) with `timestamp <= replayCursor(S)` where `replayCursor = replayAt ?? createdAt` (backend `resolveReplayCursorTimestamp`). Pruning supersedes separate CP invalidation rules for that rebase. Recompute `materializedView` from `S +` updates with `timestamp > replayCursor(S)`. OOO `S` predating events: `[a,b,c,CP1,d,e,f]` + late `S` -> prune superseded rows, merge `S +` surviving updates. **No ingest gate required for final correctness** (provisional UI: OQ7).
4. **CP creation (`performCleanup` repurposed):** No envelope removal. Fixed **`desirableMedian`** (start constant, maybe dynamic later). When **update envelope** count since latest CP exceeds **`1.5 * desirableMedian`**, insert a new CP **`desirableMedian` updates** past the previous CP anchor (count updates only, not CP or Snapshot rows). CP timestamp = timestamp of the last update included in that aggregation.
5. **Type discrimination:** New header/type for CP --- **not** `header.type === 'Snapshot'`. Extend `recentEvents` union typing accordingly.
6. **Subscribe vs live:** Not a meaningful distinction in the **dataSource merge engine**; same process by design.

**Target merge algorithm (single path):**

```text
On any envelope (Update or authoritative Snapshot):
  1. Append to recentEvents
  2. If authoritative Snapshot S: prune all rows with timestamp <= replayCursor(S);
     skip CP invalidation (prune removes them). Else if Update at x: drop CPs with timestamp >= x
  3. Optionally insert CP via performCleanup threshold (updates only; never removes rows)
  4. Recompute materializedView:
       baseline = latest authoritative Snapshot (by envelope timestamp)
       replayCursor = replayAt ?? createdAt on that snapshot
       else latest valid CP; else createEmpty
       apply Updates with timestamp > replayCursor, sorted by (timestamp, eventId)
       (use latest valid CP as shortcut when valid)
```

**Anti-patterns (still avoid):**

- Destructive consolidation that removes update envelopes
- CP rows masquerading as `Snapshot` header type
- Expanding a global 30s window to "fix" replay
- WML-only merge forks when the fix belongs in generic `dataSource/reducers.ts`

---

## Failure model (abstract)

Use as mental model for Phase 3; mechanism detail in **Discoveries**. **Fix direction superseded** by Phase 2.6 ledger redesign (below); root cause summary retained.

**What broke (mechanism):**

```text
  WebSocket          streamEventPubSub          processEnvelope (reducer)
  (delivery)         (async deserialize)        (merge + destructive cleanup)
       |                      |                          |
       |    fire-and-forget     |   CUs merge on empty/    |
       |    sidecar slow       |   thin baseline; cleanup   |
       +----------------------+-- REMOVES replay envelopes -+
```

1. **Ingest:** Sidecar Snapshot deserializes slowly; inline CUs reach reducer first (delivery reordering).
2. **Reducer event path:** CUs merge on `createEmpty` or thin provisional baseline; optional CPs on wrong prefix.
3. **Reducer + `performCleanup` (old):** 30s destructive consolidation **removes** replay envelopes (e.g. placement CU) before sidecar rebase; snapshot-path `applyEvents` cannot re-apply them.

**Why "diff only" UI:** thin provisional `materializedView` from wrong baseline; placement envelope gone from ledger before authoritative `S` lands.

**Fix direction (Phase 3 --- per Phase 2.6 design decisions):**

| Priority | Target | Change |
| --- | --- | --- |
| 1 | [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) | Remove destructive 30s consolidation; add `CompactedCheckpoint` type; invalidation + non-destructive CP insertion in `performCleanup`; unified rebase for OOO updates and OOO authoritative snapshots. |
| 2 | [`dataSource/baseClasses.ts`](../../../../charcoal-client/src/slices/dataSource/baseClasses.ts) + tests | Extend `recentEvents` union typing; update [`reducers.test.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.test.ts). |
| 3 | Durable docs | Replace abandoned contract assumptions in [`AGENT.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.md) / [`AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md). |
| 4 | (Product layer, optional) | Provisional UI gating (OQ7) --- do not feed thin pre-`S` `materializedView` to Workbench `committed` |

**Not required for correctness:** per-`streamKey` ingest queue, subscribe/live mode flags, 30s window deferral.

---

## Phase 2.6 --- Ledger redesign and durable design

Phase 2.5 confirmed **mechanism** (destructive cleanup removes replay envelopes). Phase 2.6 **re-envisions** the ledger: non-destructive **`CompactedCheckpoint`** rows, abandoned 30s window, single merge path for subscribe reload and live streaming. Design choices recorded in **Discoveries** (2026-06-05 Phase 2.6 design session).

### Why this phase exists

Current durable docs ([`dataSource/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.md), [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md)) encode **abandoned** assumptions:

- Events arrive within 30 seconds of their timestamp
- `performCleanup` safely bounds `recentEvents` memory
- Synthetic `Snapshot` rows are internal ledger compaction

Investigation showed subscribe reload fails because **destructive** compaction removes envelopes the authoritative snapshot rebase needs --- not because subscribe requires a separate reducer mode.

**Goal:** record the new contract in durable docs; implement once in generic `reducers.ts`.

### New contract invariants (single merge path)

1. **Update envelopes are canonical** --- never removed by CP logic; may be **pruned on authoritative snapshot rebase** when `timestamp <= replayCursor(S)`.
2. **Authoritative Snapshots** --- backend freeze points; `replayCursor = replayAt ?? createdAt` is the merge/prune boundary (same as backend [`resolveReplayCursorTimestamp`](../../../../packages/mtw-lambda-patterns/ts/dataSource/index.ts)).
3. **CompactedCheckpoints** --- optional, invalidatable merge caches; timestamp `T` = merged state through all updates with `timestamp <= T`; supplement the ledger, do not replace events.
4. **Invalidation (updates):** new information at `x` -> drop every CP with `timestamp >= x`.
5. **Authoritative snapshot rebase:** prune all ledger rows with `timestamp <= replayCursor(S)` (prior snapshots, updates, CPs).
6. **CP creation:** `performCleanup` inserts CPs only; when updates since latest CP exceed `1.5 * desirableMedian`, add CP `desirableMedian` updates past previous anchor (`desirableMedian` per-slice optional config, default 10).
7. **Memory bounding** --- authoritative backend snapshots + post-rebase pruning (out of scope: dynamic client strategies).

**Subscribe vs live:** not separate merge modes. Subscribe reload is a workload that stresses OOO authoritative snapshot + long timestamp spans; the same algorithm handles it when the ledger is non-destructive.

**Provisional UI (product layer, optional --- OQ7):** Yes --- essentially **do not display** (and do not let `useWorkbenchComponent` treat as `committed`) streaming `materializedView` that is likely provisional until authoritative sidecar `S` finishes loading and rebases. Today `getWMLBase` -> personalAssets `base` -> `getStandardForm` -> session `committed` with no "rebased yet" guard; thin pre-`S` merges can drive Workbench. Merge engine stays unified; gating is a selector/SSM flag (e.g. `hasAuthoritativeRebase` per stream). **Freeze risk:** see **OQ7 --- updates-only backends** below --- gate must not wait forever on a snapshot that will never arrive.

### Design questions D1--D6 (evaluation)

| # | Original question | Status | Resolution |
| --- | --- | --- | --- |
| D1 | How does ingest detect subscribe replay vs live? | **Superseded** | No phase detection required for merge correctness. |
| D2 | Ingest queue vs reducer hold buffer? | **Superseded** | No hold buffer required for correctness; optional for provisional UI only. |
| D3 | Cleanup policy during subscribe? | **Superseded** | Destructive cleanup removed entirely; `performCleanup` = CP insertion threshold only. |
| D4 | When does 30s consolidation resume? | **Superseded** | 30s window abandoned; CP uses `desirableMedian` threshold. |
| D5 | Synthetics during subscribe? | **Superseded** | Synthetic `Snapshot` rows eliminated; replaced by typed `CompactedCheckpoint` + invalidation rules. |
| D6 | All `dataSource` slices vs WML-first? | **Resolved** | **Generic pattern** in [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) --- all slices using `createDataSourceSlice` inherit the fix. |

### Outstanding questions OQ1--OQ7 (resolutions)

| # | Question | Status | Resolution |
| --- | --- | --- | --- |
| OQ1 | Authoritative snapshot CP invalidation | **Resolved** (with OQ2) | Post-rebase **prune** removes CPs and superseded rows; no separate invalidation rule needed beyond prune + update-path `CP >= x`. |
| OQ2 | Post-rebase envelope pruning | **Resolved** | On authoritative `S`, prune **all** `recentEvents` rows with `timestamp <= replayCursor(S)` (`replayAt ?? createdAt`). Keeps updates strictly after the snapshot watermark only. |
| OQ3 | Same-timestamp tie-break | **Resolved** (wire note) | Sort by **`(timestamp, eventId)`** ascending, matching backend Dynamo `DataCategory: EVENT#${timestamp}::${eventId}` ([`formatTransform.ts`](../../../../packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts)). **Gap:** `eventId` is not on the WebSocket payload today ([`toWebSocketFormat`](../../../../packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts) omits it); backend `getRecentEvents` also sorts by timestamp only. Phase 3: store `eventId` on `RecentEventEnvelope` when available; follow-up may require plumbing `eventId` through stream delivery for full parity. |
| OQ4 | `desirableMedian` value and home | **Resolved** | Optional **`createDataSourceSlice` config** (not required); **default 10**. Per-slice override when a data source needs a different threshold. |
| OQ5 | `performCleanup` rename | **Resolved** | **Defer rename** --- function still prunes ledger rows on authoritative snapshot arrival; also inserts CPs. Document repurposing in AGENT.md. |
| OQ6 | `replayAt` merge boundary | **Resolved** | **Required** for frontend parity with backend: use `replayCursor = replayAt ?? createdAt` for apply-after and prune-`<=` boundaries ([`mtw-lambda-patterns` AGENT.md](../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) **Snapshot metadata**). Persist `replayAt` on authoritative snapshot ledger rows (from deserialized snapshot payload). Closes H5 for merge semantics. |
| OQ7 | Provisional UI gating | **Resolved** (optional implement) | **Yes** --- do not expose provisional pre-rebase `materializedView` to Workbench display / session `committed` while sidecar snapshot is still loading (particularly). Product-layer guard on `getWMLBase` / personalAssets / SSM; **not** a merge-engine mode split. **Must** account for updates-only backends (below). |

#### OQ7 --- updates-only backends (freeze risk)

Naive gating --- "hide base until first authoritative Snapshot in `recentEvents`" --- can **freeze the UI indefinitely** when a DataSource legitimately delivers **only updates** and never sends a Snapshot for that stream or subscribe session.

**Backend cases (today):**

| Pattern | Snapshot on subscribe? | Examples |
| --- | --- | --- |
| **`replayable: true`** | Yes --- `initializeSubscription` delivers Snapshot + replay | `mtw.wml`, `mtw.ephemera.thinking.scheduling` |
| **`replayable: false`** | **No** --- live EventBridge/bus events only | `mtw.assets`, many `mtw.ephemera.*` bus-only sources ([`lambda/assets/dataSource`](../../../../lambda/assets/dataSource/index.ts), ephemera perception/actions/objects, etc.) |

For **non-replayable** slices, `materializedView` is built incrementally from updates alone (`createEmpty` + merge). There will **never** be an authoritative Snapshot row to clear a `hasAuthoritativeRebase`-style gate. Workbench (or any consumer) would stay on loading/empty `committed` forever.

**Edge cases even on replayable sources:**

- Mid-session subscribe after missing Initialize Subscription snapshot (reconnect race, partial delivery).
- Future or misconfigured backend that streams updates without a matching snapshot for a stream key.
- Streams that were already live before client subscribed (updates only from subscribe moment forward).

**Guard design requirements (when implementing OQ7):**

1. **Scope gating to streams that expect a subscribe snapshot** --- e.g. replayable DataSources where Initialize Subscription is part of the contract, or **WML-only** first (narrowest blast radius for this bug).
2. **Do not gate on "any Snapshot ever" for generic `getWMLBase`-style selectors** shared across all `createDataSourceSlice` instances unless each slice declares `expectsSubscribeSnapshot` (or equivalent) in factory config.
3. **Fallback unblock:** if updates have been applied and no Snapshot arrives within a bounded window (or after subscribe SSM reaches a terminal "synced without snapshot" state), treat current `materializedView` as displayable --- merge engine already produces best-effort state from updates-only.
4. **Distinguish "provisional thin pre-rebase" from "updates-only steady state":** gate only when ledger shows **updates without any authoritative Snapshot** *and* snapshot is still **expected** (sidecar deserialize in flight, subscribe-replay window), not when the DataSource is defined as updates-only.

**Recommended first implementation:** WML Workbench path only (`wmlDataSource` + personalAssets), gated while subscribe sidecar Snapshot is pending --- not a global `dataSource` display lock.

**Remaining implementation follow-up (from OQ3):** plumb `eventId` onto client stream envelopes if not derivable from existing header fields.

### Durable documents to update (Phase 2.6 deliverables)

| Document | Update |
| --- | --- |
| [`dataSource/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.md) | Replace 30s window / synthetic snapshot language; document three ledger roles; CP purpose (OOO perf, not memory) |
| [`dataSource/AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) | Rewrite **Contract and Guarantees**; event processing algorithm with CP invalidation + OOO snapshot rebase; remove abandoned assumptions |
| [`dataSource/baseClasses.ts`](../../../../charcoal-client/src/slices/dataSource/baseClasses.ts) | (Phase 3) `CompactedCheckpoint` in `recentEvents` union |
| [`wmlDataSource/AGENT.md`](../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) | Sidecar subscribe notes; provisional-UI gating if adopted (**OQ7 freeze risk** for updates-only sources) |
| [`AGENT.client-sync-invariants.md`](../../../../charcoal-client/src/slices/AGENT.client-sync-invariants.md) | Layer 2: `materializedView` authoritative after rebase; provisional state before first `S` if documented; do not gate updates-only DataSources |

**No longer required:** [`streamEventPubSub/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md) ingest-gate design. **OQ7** is product-layer (wmlDataSource/personalAssets), not streamEventPubSub ordering.

### Phase 3 implementation checklist (from design)

- [ ] Add `CompactedCheckpoint` header type; extend `RecentEventEnvelope` / `recentEvents` union
- [ ] Remove destructive 30s consolidation from `performCleanup`; implement CP insertion threshold
- [ ] Implement CP invalidation on update at `x` (`CP.timestamp >= x`)
- [ ] Implement authoritative Snapshot handling: prune `recentEvents` at `replayCursor(S)`; rebase `materializedView` from `S` + updates after `replayCursor`
- [ ] Use `replayAt ?? createdAt` for snapshot merge/prune boundary; persist `replayAt` on snapshot ledger rows
- [ ] Sort updates by `(timestamp, eventId)`; add `eventId` to envelope type when available
- [ ] Add optional `desirableMedian` to `createDataSourceSlice` config (default 10)
- [ ] Unify `processEnvelope` snapshot and event paths around shared recompute helper
- [ ] Update [`reducers.test.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.test.ts): subscribe OOO (`CU` before `S`), OOO update mid-ledger, CP creation threshold, CP invalidation
- [ ] Migrate durable docs (table above)

### Exit criteria for Phase 2.6

- [X] **Design choices** recorded (Discoveries + this section)
- [X] **D1--D6** evaluated (five superseded, D6 resolved)
- [X] **Outstanding questions OQ1--OQ7** listed and **resolved** (OQ3 wire-format follow-up noted)
- [X] **Phase 3 checklist** derived from design (replaces ingest gate + mode flags)
- [ ] **Durable doc updates** merged into slice `AGENT.md` files (can complete alongside Phase 3)

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

### Planned instrumentation (implemented 2026-06-05)

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
| `performCleanup` | **Yes** | Implemented 2026-06-05; primary Phase 2.5 deliverable |
| `afterEnvelope` | **Low** | personalAssets layer; not where thin `materializedView` failed |

### Exit criteria for Phase 2.5

- [X] At least one failure or success reload log shows **`performCleanup`** lines bracketing subscribe Snapshot + replay CUs.
- [X] **Discoveries** entry updates H4 to **Confirmed** (2026-06-05 Phase 2.5 confirmatory reload).
- [X] Phase 3 fix scope is explicit: ingest queue only, cleanup policy only, or **both** (current **Failure model** assumes both).

---

## Instrumentation registry

Track **every** temporary log/gate added for this task. Phase 5 must remove or revert all rows here.

| ID | Activation key | File(s) | What it logs | Added | Removed |
| --- | --- | --- | --- | --- | --- |
| wml-stream-sync | `wml-stream-sync` | [`scopedInstrumentation.ts`](../../../../charcoal-client/src/testing/scopedInstrumentation.ts), [`wmlStreamSyncInstrumentation.ts`](../../../../charcoal-client/src/testing/wmlStreamSyncInstrumentation.ts), [`streamEventPubSub/index.ts`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/index.ts), [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts), [`personalAssets/index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) | `ingest` phases, `processEnvelope`, `performCleanup`, `afterEnvelope` (see table below) | 2026-06-05 | --- |

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
| [`dataSource/reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) `performCleanup` | `[wml-stream-sync] performCleanup` | `caller` (`snapshot` / `event`), `headerType`, `streamKey`, `incomingTimestamp`, `latestTimestamp`, `thirtySecondsAgo`, `oldEventsSummary`, `stillRecentSummary`, `action` (`no-op` / `consolidated`), `syntheticTimestamp`, `baselineSource` (`empty` / `snapshot-in-oldEvents` / `synthetic-prior`) |
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
| H2 | Snapshot `processEnvelope` runs with replay CUs already merged on wrong baseline; sidecar re-apply incomplete | **Confirmed** --- Phase 2 and Phase 2.5 repros; placement CU processed before Snapshot `deserializeDone`. |
| H3 | Placement CU applies but `StandardForm.merge` does not update `positionGraph.nodes` | **Rejected** --- placement loss is cleanup consolidation / ledger truncation, not merge failure on topology delta. |
| H4 | `performCleanup` consolidation drops replay CUs before sidecar snapshot merge | **Confirmed** --- Phase 2.5: synthetic @ `1780700533578`, placement `1780700532599` absent from ledger; snapshot re-apply skips synthetic Snapshot rows. |
| H5 | Stale sidecar at subscribe; replay CU excluded by timestamp semantics | **Addressed in Phase 2.6 design** --- client will use `replayAt ?? createdAt` for merge/prune boundary (OQ6); failure repro explained by H2+H4 without proving stale sidecar bytes. |

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
- [X] **Phase 2.5 --- Confirm `performCleanup` role**
  - [X] Add gated `[wml-stream-sync] performCleanup` trace in [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts) (see **Phase 2.5** below)
  - [X] Update **Instrumentation registry** with cleanup log site and date
  - [X] Optional: one confirmatory reload; append **Discoveries** with cleanup lines tied to subscribe Snapshot / replay CUs
  - [X] Record answers to **Phase 2.5 questions** (why cleanup runs; which events consolidated; caller path snapshot vs event)
- [ ] **Phase 2.6 --- Ledger redesign and durable design**
  - [X] Record design choices, D1--D6 evaluation, outstanding questions OQ1--OQ7 (see **Phase 2.6**)
  - [X] Derive Phase 3 implementation checklist (non-destructive CPs; no ingest gate / mode flags)
  - [X] Resolve **OQ1--OQ7** (recorded in **Phase 2.6**; OQ3 `eventId` wire plumbing may extend into Phase 3)
  - [ ] Update [`dataSource/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.md) and [`AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) (may land with Phase 3)
  - [ ] Complete **Phase 2.6 exit criteria** (durable docs)
- [ ] **Phase 3 --- Implement (per Phase 2.6 design)**
  - [ ] `CompactedCheckpoint` type + non-destructive `performCleanup` + invalidation + unified rebase in [`reducers.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.ts)
  - [ ] Update [`reducers.test.ts`](../../../../charcoal-client/src/slices/dataSource/reducers.test.ts) (CU before sidecar `S`; OOO update; CP threshold/invalidation)
  - [ ] Manual verify: reload -> full merged UI without waiting for next snapshot
- [ ] **Phase 4 --- Tests**
  - [ ] Add reducer or integration test: CU before sidecar snapshot completes; assert final `materializedView` includes placement (including `positionGraph.nodes` if applicable)
  - [ ] Run baseline slice tests (see **Verification**)
- [ ] **Phase 5 --- Cleanup**
  - [ ] Complete **Instrumentation registry** cleanup checklist
  - [ ] Confirm Phase 2.6 durable doc updates are complete (no duplicate contract notes left only in this plan)
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

**Phase 2.6 (design before implementation):**

1. Design choices and D1--D6 evaluation recorded in this plan.
2. OQ1--OQ7 resolved in **Phase 2.6** (see resolutions table).
3. Complete durable doc updates (may ship with Phase 3).

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
- Do not duplicate full `dataSource` algorithm docs here; link [`AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) **Event Processing** and **Sidecar Snapshot Handling** sections. **Phase 2.6** owns rewriting those docs for the non-destructive CP ledger model.
