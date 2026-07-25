# Message orchestration consolidation: ordered-array delivery, retiring `OrchestrateMessages`

**Status:** In progress, 2026-07-25. Framed through conversation while implementing iteration 9's perception kernel (Phase 4, object-directed look) --- see [`dataSource/actions/AGENT.perceptionKernel.planning.md`](dataSource/actions/AGENT.perceptionKernel.planning.md)'s PK-7 and PK-10 rows for the originating decision record. This document exists so that record doesn't get lost when iteration 9's plan eventually retires, and so the work can proceed independently of that iteration's own scope. **Phase 0 done 2026-07-25**; Phases 1--6 not started.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Purpose

Two findings surfaced while building iteration 9's object-directed look, together pointing at one consolidation:

1. **`EphemeraDataSource.streamEvent` always stamps its own `dataSourceKey`** (`packages/mtw-lambda-patterns/ts/dataSource/index.ts:404`), so a describe/perceive publish can only ever carry the key of whichever DataSource's `streamEvent` closure calls it. `renderOrchestration`'s `Look Command Requested` subscription is keyed specifically to `mtw.ephemera.actions`, which is why `executeStepSequence`/`perceiveStepSequence` had to be called in-process from `dataSource/actions/index.ts` rather than via a bus hop through `positions/index.ts` --- there is currently no dataSource whose ownership cleanly matches "deliver a perception/narration message" as a first-class responsibility.
2. **There are two parallel, unconsolidated perception-delivery mechanisms in production today**, not a hypothetical mixed case awaiting a future command:
   - Character navigate's tail (`positions/navigate/executeCharacterNavigate.ts` -> `afterCharacterMembershipNavigateChanged.ts` -> `orchestrateNavigate.ts`): commits the position graph, then (ordered *after* commit) registers a `PerceptionThreads` entry, kicks a passive render, and lets the resulting `Character Moved` fact drive interleaved arrival/departure narration --- using `internalCache.OrchestrateMessages.newMessageGroup()` + a `messageGroupId` thread.
   - Object-look's `perceiveStepSequence` -> `Look Command Requested` streamEvent (iteration 9, Phase 3/4) --- no `messageGroupId` involvement at all.

Investigating (1) exposed that (2)'s `OrchestrateMessages` mechanism is **widely plumbed but narrowly exercised**: `messageGroupId` is threaded as an optional field through dozens of call sites (`dataSource/perception/orchestrate.ts` alone passes it through ~20+ times, plus `characterPerception.ts`, `kickRoomHeaderBroadcast.ts`, `renderOrchestration/events.ts`, `messageBus/baseClasses.ts`), but there is exactly **one producer** in the whole codebase (`orchestrateNavigate.ts`'s single `newMessageGroup()` call) and exactly **one consumer of the resulting semantics** (`publishMessage/index.ts`, which calls `internalCache.OrchestrateMessages.allOffsets()` to compute each grouped message's `CreatedTime`). The class's actual tree-splicing API (`before()`/`after()`/`next()`) has **zero production callers** --- every call to those three methods is inside `orchestrateMessages.test.ts`, testing the class in isolation.

**The simpler design** (confirmed through conversation, 2026-07-25): Plan/Synthesize's instruction compiler already produces an ordered list (`KernelStep[]`, in command order). Rebuilding a before/during/after tree to re-derive an ordering already known at compile time solves a problem this case doesn't have --- that tree exists to reconstruct ordering for callers who don't have a sequence upfront and need to splice items in as they arrive, which is not what any current caller actually does (navigate uses the tree API in its most degenerate form: one flat tag, no splicing). Instead: the compiled instruction list becomes an ordered array of narration-producing slots (e.g. `[leaveMessage, roomHeader, arriveMessage]`), known upfront at compile time; each slot is filled as its corresponding step is processed (a slot reading post-mutation state simply cannot resolve before its mutation's commit --- a data dependency, not a wall-clock choreography problem); delivery waits for the whole array to **settle** (all slots resolved, or tolerantly failed, to cover an anticipated slot's message never materializing) and then flushes in the array's original compiled order --- decoupling resolution order from delivery order without needing a graph/tree abstraction at all.

**Not requirement-gated.** Character navigate is the standing proof this pattern is needed in production today, not a speculative future case.

## Design decisions (confirmed through conversation, 2026-07-25)

- **Ordered array + settle-then-flush, not `OrchestrateMessages`'s before/during/after tree.** The compiler already knows the order; don't reconstruct it. See Purpose above for the full reasoning.
- **Resolution order and delivery order are decoupled.** A slot's resolver naturally depends on (is invoked after) whatever mutation it needs to reflect; the array is flushed in original compiled order regardless of the wall-clock order in which slots actually resolved.
- **The tree-splicing API (`before`/`after`/`next`) is dead code today, independently of everything else** --- confirmed via full-codebase grep, zero production callers. Safe to prune on its own, whenever convenient, without waiting for the rest of this migration.
- **Full retirement of `OrchestrateMessagesData` is the *last* step of this migration, not a prerequisite to it.** `publishMessage/index.ts` depends on `allOffsets()` for `CreatedTime` computation for every message carrying a `messageGroupId`, across message kinds well beyond perception/narration. Deleting the class before replacing what it does for that call site would break message ordering broadly, not just for perception.
- **PK-7's `dataSourceKey`-ownership question is inherited, not resolved by this migration's framing alone.** Whichever component ends up filling and flushing the ordered array still needs the authority to publish under whatever key downstream subscribers (`renderOrchestration`, `perception`) require. This document should resolve it concretely, not defer it again.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) (durability ladder, open-decisions litmus tests).
2. Read the originating decision record in full: [`dataSource/actions/AGENT.perceptionKernel.planning.md`](dataSource/actions/AGENT.perceptionKernel.planning.md)'s PK-7 and PK-10 rows --- this document expands on those rather than restating iteration 9's own scope.
3. Read the two existing perception-delivery mechanisms this consolidates:
   - [`positions/navigate/executeCharacterNavigate.ts`](../../../lambda/ephemera/dataSource/positions/navigate/executeCharacterNavigate.ts) -> [`afterCharacterMembershipNavigateChanged.ts`](../../../lambda/ephemera/dataSource/positions/navigate/afterCharacterMembershipNavigateChanged.ts) -> [`orchestrateNavigate.ts`](../../../lambda/ephemera/dataSource/positions/navigate/orchestrateNavigate.ts) (the one real `OrchestrateMessages` producer).
   - [`positions/manipulation/kernel/perceiveStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/perceiveStepSequence.ts) and [`executeStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/executeStepSequence.ts) (object-look's kernel, no `messageGroupId` involvement).
4. Read the mechanism being replaced: [`internalCache/orchestrateMessages.ts`](../../../lambda/ephemera/internalCache/orchestrateMessages.ts) (the tree/`allOffsets()` class) and its one consumer, [`publishMessage/index.ts`](../../../lambda/ephemera/publishMessage/index.ts) (`offsetsByMessageId`/`allOffsets()` usage, near the top of `publishMessage`).
5. Read `messageGroupId`'s widest pass-through consumer to understand the field-threading surface area that full retirement (Phase 6 below) will need to prune: [`dataSource/perception/orchestrate.ts`](../../../lambda/ephemera/dataSource/perception/orchestrate.ts).
6. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md).
7. Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  internalCache/orchestrateMessages.test.ts \
  dataSource/positions/navigate/ \
  publishMessage/index.test.ts \
  dataSource/positions/manipulation/kernel/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step. Nothing below is built yet; all lines start `[ ]`.

- [X] **Phase 0. Prune the unused tree-splicing API (independent, safe to do anytime).**
  - [X] Remove `before()`/`after()`/`next()` from `OrchestrateMessagesData` (`internalCache/orchestrateMessages.ts`) and their dedicated test coverage in `orchestrateMessages.test.ts` --- confirmed zero production callers. Keep `newMessageGroup()`/`allOffsets()` (still load-bearing for navigate/`publishMessage` until Phase 4/6 below replace them).
    - **Shipped 2026-07-25.** Removed the three methods from `OrchestrateMessagesData`; re-verified via repo-wide grep immediately before deletion that only `orchestrateMessages.test.ts` referenced them. `newMessageGroup()`, `allOffsets()`, `clear()`, `OrchestrateMessagesById`, and the `OrchestrateMessagesGroup`/`AllOffsetsWorkspace` types are untouched --- simplifying `allOffsets()`'s now-unreachable tree-walk internals stays out of scope for Phase 0, reserved for Phase 1/4. Test file: replaced the three direct method tests plus the tree-building "should properly order elements in allOffsets" test with one smaller test ("should assign offset 0 to every flat, unrelated message group") asserting the actual reachable behavior once the tree-splicing API is gone --- every group is now always a childless root with empty `before`/`during`/`after`, so `allOffsets()` degenerates to 0 for every group. Verified: `internalCache/orchestrateMessages.test.ts` + `dataSource/positions/navigate/` + `publishMessage/index.test.ts` all green (5 suites, 25 tests), `tsc --noEmit` clean.
- [ ] **Phase 1. Design the ordered-array/settle-then-flush model concretely.**
  - [ ] Define what a "slot" is: how a compiled `KernelStep`/narration-producing instruction gets an associated resolver, what "settle" means operationally (`Promise.allSettled`-shaped? explicit timeout? explicit flush signal from the caller?), and how a slot that never produces a message (an "anticipated message failing") is represented without blocking the flush.
  - [ ] Design the new `mtw.ephemera.messages` DataSource's publish/subscribe contract: what it accepts as input (the ordered array/slot list), what it emits, and to whom.
- [ ] **Phase 2. Resolve the `dataSourceKey`/ownership question (PK-7/PK-10) concretely for the new DataSource.**
  - [ ] Decide whether `Look Command Requested` (and its narration-sibling events) get re-issued under the new `mtw.ephemera.messages` key, or whether the new DataSource wraps/re-publishes under existing keys. Update `renderOrchestration`'s and `perception`'s subscriptions accordingly.
- [ ] **Phase 3. Migrate navigate's tail onto the new model.**
  - [ ] Replace `orchestrateNavigate.ts`'s `newMessageGroup()`/`messageGroupId`-threading with the new ordered-array producer, preserving today's interleaved arrival/departure narration + room-header behavior.
- [ ] **Phase 4. Migrate `publishMessage`'s `CreatedTime` computation off `allOffsets()`.**
  - [ ] Since the new model knows final order before flushing, replace `offsetsByMessageId`/`allOffsets()`-based `CreatedTime` computation with directly-assigned sequential values from the already-ordered array, for messages produced via the new path. Confirm non-perception message kinds untouched by this migration keep their existing (non-grouped) `CreatedTime` behavior.
- [ ] **Phase 5. Migrate object-look's perception kernel onto the same model.**
  - [ ] Reconcile iteration 9's Phase 4 in-process `executeStepSequence` call (`dataSource/actions/index.ts`) with the new `mtw.ephemera.messages` DataSource --- decide whether object-look keeps its in-process shape or moves onto the new pub/sub path now that ownership (Phase 2) is resolved.
- [ ] **Phase 6. Retire `OrchestrateMessagesData` and prune `messageGroupId` field-threading.**
  - [ ] Only after Phases 3--5 land: delete `OrchestrateMessagesData` (`internalCache/orchestrateMessages.ts`), remove it from `internalCache/index.ts`, and prune the now-dead `messageGroupId` optional field from its pass-through signatures (`dataSource/perception/orchestrate.ts` and siblings). Confirm via grep that no references remain outside history.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| MO-1 | New DataSource's `dataSourceKey` name (`mtw.ephemera.messages`, or an alternative) | Phase 1 | Open |
| MO-2 | Where "slot resolution" and "flush" actually get triggered --- who calls the equivalent of today's `afterCharacterMembershipNavigateChanged`/`executeStepSequence` call sites under the new model | Phase 1, Phase 3, Phase 5 | Open |
| MO-3 | Whether navigate's `PerceptionThreads.register` call itself moves onto the new model, or only the narration-ordering piece around it | Phase 3 | Open |
| MO-4 | Settle/timeout semantics for an anticipated slot whose message never materializes (what failure mode is actually being guarded against, and what the caller sees) | Phase 1 | Open |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  internalCache/orchestrateMessages.test.ts \
  dataSource/positions/navigate/ \
  publishMessage/index.test.ts \
  dataSource/positions/manipulation/kernel/ \
  dataSource/actions/index.test.ts
npx tsc --noEmit
```

## Progress

| Milestone | Status |
| --- | --- |
| Findings framed through conversation (PK-7/PK-10 in iteration 9's plan; `OrchestrateMessages` usage traced --- tree API dead, `newMessageGroup`/`allOffsets` load-bearing via one producer/one consumer) | Done (2026-07-25) |
| This planning document created | Done (2026-07-25) |
| Phase 0 (prune dead tree API) | **Done (2026-07-25)** --- `before()`/`after()`/`next()` removed from `OrchestrateMessagesData`; test coverage rewritten to match the remaining reachable behavior; `newMessageGroup()`/`allOffsets()` untouched |
| Phase 1 (design ordered-array/settle-then-flush model) | Not started |
| Phase 2 (resolve dataSourceKey ownership) | Not started |
| Phase 3 (migrate navigate) | Not started |
| Phase 4 (migrate `publishMessage`) | Not started |
| Phase 5 (migrate object-look perception kernel) | Not started |
| Phase 6 (retire `OrchestrateMessagesData`) | Not started |
