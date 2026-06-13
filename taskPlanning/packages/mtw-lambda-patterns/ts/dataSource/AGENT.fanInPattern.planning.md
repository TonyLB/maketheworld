# DataSource fan-in pattern (`mtw-lambda-patterns`)

**Status:** Not started. **Next:** Phase 0 --- spec + framework hooks in `mtw-lambda-patterns` (cluster queue, `fanInGuard`, deferral integration).

## Purpose

Track a **generic DataSource fan-in processor** that replaces bespoke, order-sensitive side-bands (today: [`PerceptionThreads`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) + direct `register` calls) with **declarative cluster specs**: queue correlated ingress during an invocation, complete clusters when required legs arrive, and handle **negative cases** (optional legs never arrive) via [`messageBus` deferral](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md) at `flushAndSettle` tail.

**Dispose this file** when the pattern is shipped in steady-state docs and PerceptionThreads migration is complete or explicitly deferred. Durable truth graduates to [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md) and [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md).

Framework conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

**Prerequisites (read before tightening cluster output):** [`lambda/ephemera/AGENT.narrativeTranscript.concepts.md`](../../../../../lambda/ephemera/AGENT.narrativeTranscript.concepts.md) --- fictional **`CreatedTime`**, delivery looseness vs correlation; fan-in specs must not re-encode accidental atomic-delivery constraints.

## Problem (first draft today)

[`PerceptionThreads`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) is a **per-invocation correlation registry** with known limits:

- **Bespoke** to perception --- not reusable by other DataSources.
- **Side-band enrollment** --- `Perception Thread Registered` or direct `internalCache.PerceptionThreads.register()` before downstream events (e.g. [`moveCharacter`](../../../../../lambda/ephemera/moveCharacter/index.ts) registers synchronously before transact so Leave/Arrive find a bucket).
- **Order-sensitive** --- register-first, then cascade.
- **Weak negative case** --- incomplete clusters mostly vanish at invocation `InternalCache.clear()` without a settle-time fallback.

## Target model (second iteration)

Per DataSource instance (or shared processor wired into `receiveEvents`):

| Mechanism | Role |
| --- | --- |
| **`fanInGuard`** | Subset of `subscribedEventTypeGuard` --- which envelope types participate in which fan-in spec (some events never fan-in; others may fan-in to cluster A vs B). |
| **Local cluster queue** | During `receiveEvents`, matching events enqueue into open clusters keyed by `clusterKey(event)`. |
| **Positive completion** | When **all required legs** for a cluster spec are present, run `onComplete(cluster)` immediately (order-independent). |
| **Negative / optional intent** | Partial clusters remain after handler settle; **`registerDeferral` / `afterSettled`** inspects open clusters and runs `onDeferredIncomplete(cluster)` --- "intent never arrived" is proven by boundary settle, not by a timeout clock. |

Cross-link: [`InternalMessageBus.flushAndSettle`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts) (settle loop, then `runDeferrals()`).

## Consumers (cross-initiative)

| Initiative | Depends on | Phase |
| --- | --- | --- |
| **Move presentation** (intent + fact) | Fan-in **Phase 0 + Phase 1** | Actions emit move **intent**; positions emit **Character Moved** fact; perception correlates for exit-aware narrative |
| [`positions` slice 1b presentation](../../../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#cross-initiative-dependencies) | Phase 0 + Phase 1 | **Not** a blocker for slice **1a** persistence boundary |
| **PerceptionThreads retirement** | Phase 2+ per thread kind | Migrate `roomDescription`, `roomHeaderBroadcast`, `sessionOrientationRender`, `characterMove`, etc. one by one |

## Proof case (Phase 1)

**Parallel to PerceptionThreads** --- do not block Phase 0 on retiring all thread kinds.

1. **Intent leg:** move command parsed --- e.g. `Action Intent: Move Character` (character, from, to, exit used).
2. **Fact leg:** membership changed --- e.g. `Character Moved` (character, from, to, legal exits from positions topology check).
3. **Fan-in handler:** when both correlate, emit player-facing leave/arrive (and header kick if still required) with exit-aware copy when intent exit is in fact's legal set.
4. **Deferred handler:** fact only at settle --- generic narrative (connect, home, admin teleport, or navigate without retained intent).

This validates negative-case deferral without requiring N-leg render lifecycle in Phase 0.

## Phase 2+ (PerceptionThreads migration)

Render fan-in is **not** a simple 2-event AND. Each migrated flow needs a **cluster contract**:

- Required / optional / terminal legs (e.g. kick, `Generation Started`, `Render Pertains`, error/deferred terminals).
- State machine across legs (`Initial` -> `Generating` -> `Terminal`, `messageId`, `createdTime`).
- Fan-out: one terminal event may complete **many** open clusters in the same bucket.

Migrate **one thread kind at a time**; keep PerceptionThreads for unmigrated flows until each spec ships.

## Open decisions (implementation --- plan only)

Plan-only. When a decision ships, record in durable DataSource / messageBus docs and remove the row.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| F0-1 | Fan-in processor lives **inside** `DataSource.subscribe` callback vs **wrapper** around `receiveEvents` | Phase 0 | Open |
| F0-2 | Cluster store scope: **per DataSource instance** vs shared **per lambda invocation** service | Phase 0 | Open |
| F0-3 | Deferral tag: **one global fan-in deferral** vs **per fanInSpec** registrant | Phase 0 | Open |
| F1-1 | Correlation key for move proof case: `requestId` vs `(characterId, from, to, invocation)` composite | Phase 1 | Open |
| F1-2 | Intent event type/name and owning DataSource (`mtw.ephemera.actions` stream vs `api.ephemera` ingress) | Phase 1 | Open |
| F1-3 | Fact event type/name (`Character Moved` on `mtw.ephemera.positions` vs bus message) | Phase 1 | Open |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [ ] **Phase 0 --- framework pattern**
  - [ ] Resolve **Open decisions** F0-1 through F0-3
  - [ ] Spec cluster record shape (`clusterKey`, legs received, spec id, opaque state)
  - [ ] Implement `fanInGuard` + queue + positive `onComplete` dispatch
  - [ ] Wire **`afterSettled`** deferral for `onDeferredIncomplete` (document interaction with existing deferrals e.g. publish coalescer)
  - [ ] Unit tests in `packages/mtw-lambda-patterns/ts/dataSource/` (synthetic envelopes; mock messageBus)
  - [ ] Graduate API sketch to [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md)

- [ ] **Phase 1 --- move proof case (perception consumer)**
  - [ ] Resolve **Open decisions** F1-1 through F1-3 (coordinate with [`positions` S1-2 / slice 1b](../../../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md))
  - [ ] Add fan-in spec on `mtw.ephemera.perception` (or agreed consumer) for intent + fact legs
  - [ ] Implement `onComplete` (exit-aware narrative) and `onDeferredIncomplete` (generic move)
  - [ ] Ephemera tests: both legs same invocation; fact-only at settle; order independence (fact before intent)
  - [ ] Document parallel operation with legacy `characterMove` PerceptionThreads until cutover flag

- [ ] **Phase 2 --- retire `characterMove` PerceptionThreads**
  - [ ] Stop `moveCharacter` direct `PerceptionThreads.register` for cross-room header path when fan-in owns presentation
  - [ ] Remove redundant pre-baked `leaveWorldMessage` / `arriveWorldMessage` on registration
  - [ ] Update [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) delivery paths table

- [ ] **Phase 3+ --- migrate remaining thread kinds**
  - [ ] `roomDescription` (kick + render terminal + optional Generating)
  - [ ] `roomHeaderBroadcast`
  - [ ] `sessionOrientationRender` / `sessionOrientationAffordances`
  - [ ] Delete `PerceptionThreads` when last spec migrates (or slim to stub if one flow remains exceptional)

- [ ] **Close initiative**
  - [ ] Merge lasting pattern docs into package `AGENT*.md`
  - [ ] Delete this planning file

---

## Verification

From repo root (Phase 0):

```bash
npm --prefix packages/mtw-lambda-patterns run test -- --watchAll=false ts/dataSource/
```

Phase 1 adds ephemera perception / move tests (exact paths TBD when F1-* decide event shapes):

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/perception/ \
  moveCharacter/index.test.ts \
  dataSource/actions/index.test.ts
```

**Phase 0 gate:** cluster completes on any leg order; deferred handler runs once per invocation after settle; no duplicate `onComplete` for same cluster.

**Phase 1 gate:** exit-aware copy when intent exit matches fact legal set; generic copy when intent absent at settle.

---

## Progress

| Milestone | Status |
| --- | --- |
| Phase 0: framework pattern | Not started |
| Phase 1: move proof case | Not started |
| Phase 2: retire characterMove PerceptionThreads | Not started |
| Phase 3+: other thread kinds | Not started |
| Initiative close | Not started |
