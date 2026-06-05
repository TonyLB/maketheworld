# WML subscribe merge investigation (charcoal-client)

**Status:** In progress. **Next step:** Phase 1 --- add gated instrumentation (`wml-stream-sync`) and reproduce reload bug with console + Redux evidence.

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
| 1 | Add gated `wml-stream-sync` instrumentation | Not started |
| 2 | Reproduce with logs; record findings in **Discoveries** | Not started |
| 3 | Fix root cause (code or contract) | Not started |
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

---

## Instrumentation registry

Track **every** temporary log/gate added for this task. Phase 5 must remove or revert all rows here.

| ID | Activation key | File(s) | What it logs | Added | Removed |
| --- | --- | --- | --- | --- | --- |
| *(none yet)* | `wml-stream-sync` | *(planned)* | See **Planned instrumentation** below | --- | --- |

**Activation (when implemented):**

```javascript
sessionStorage.setItem('mtw-instrumentation', '["wml-stream-sync"]')
// disable: sessionStorage.removeItem('mtw-instrumentation')
```

Also add `WML_STREAM_SYNC: 'wml-stream-sync'` to [`charcoal-client/src/testing/scopedInstrumentation.ts`](../../../../charcoal-client/src/testing/scopedInstrumentation.ts) when instrumentation lands.

### Planned instrumentation (not yet in code)

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

| ID | Hypothesis | How to test |
| --- | --- | --- |
| H1 | Placement CU never reaches `processEnvelope` (deserialize drop / race) | Ingest log: WS CU `fa55489f` never reaches `published` |
| H2 | Snapshot `processEnvelope` runs with empty `recentEvents`; placement CU never re-applied afterward | Reducer log: snapshot with `eventsAfterSnapshotCount: 0`, then no subsequent CU with same RequestId |
| H3 | Placement CU applies but `StandardForm.merge` does not update `positionGraph.nodes` | Reducer log: CU published + applied, `positionGraphNodes` unchanged |
| H4 | `performCleanup` consolidation drops placement CU from synthetic snapshot | Compare synthetic snapshot content vs events in window before cleanup |
| H5 | Stale sidecar at subscribe; replay CU excluded by timestamp semantics | Compare sidecar WML fetch vs CU WML; check backend `replayAt` vs CU timestamp |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets as you finish them).

- [ ] **Phase 1 --- Instrumentation**
  - [ ] Add `WML_STREAM_SYNC` to `scopedInstrumentation.ts`
  - [ ] Implement ingest timeline in `streamEventPubSub` (gate on `mtw.wml` + activation key)
  - [ ] Implement `processEnvelope` trace in `reducers.ts` (gate on `mtw.wml` via passed config or header check in wrapper --- prefer minimal coupling)
  - [ ] Implement `afterEnvelope` trace in `personalAssets` consumer
  - [ ] Update **Instrumentation registry** table with file paths and dates
- [ ] **Phase 2 --- Reproduce and record**
  - [ ] Enable `sessionStorage` activation **before** edit/save/reload (see **Manual smoke testing constraints**)
  - [ ] Create fresh edit (import + shortName + render + save); reload **immediately** while case is live
  - [ ] Capture in one pass: Network Snapshot + CU timestamps/RequestIds; console ingest + reducer sequence; Redux `subscribedStreams` snapshot
  - [ ] Append findings to **Discoveries** (include wall-clock time; note if snapshot had since regenerated); mark H1--H5 confirmed/rejected
- [ ] **Phase 3 --- Fix**
  - [ ] Implement fix (candidate areas: async ordering in `streamEventPubSub`, snapshot `replayAt` on client, merge semantics for Area placement deltas, cleanup consolidation)
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

- Backend subscribe delivers Snapshot with **`createdAt`** envelope time and **`replayAt`** in payload; replay queries Dynamo strictly after **`replayAt`**. Client merge boundary today uses **`createdAt` only** --- document or fix if investigation confirms H5.
- Do not duplicate full `dataSource` algorithm docs here; link [`AGENT.implementation.md`](../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) **Event Processing** and **Sidecar Snapshot Handling** sections.
