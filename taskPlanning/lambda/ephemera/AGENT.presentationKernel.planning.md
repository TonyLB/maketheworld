# Presentation kernel: positional state binding for narration

**Status:** Not started, 2026-07-28. Framed through conversation while closing out [`AGENT.messageOrchestrationConsolidation.planning.md`](AGENT.messageOrchestrationConsolidation.planning.md)'s Phase 8 --- this plan carries what that document scoped as its optional Phase 9 capstone ("generalize to a presentation `KernelStep[]` kernel"), **re-framed** around the organizing principle that actually motivates it: narration steps are *positionally* bound to world state, and the kernel walk is the only place that binding is available. Nothing below is built yet.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Purpose

Four findings, confirmed against current code, together point at one change.

**1. The `[room, characterId]` targeting idiom is load-bearing in exactly one of its four occurrences.**

| Site | Is the trailing `characterId` doing work? |
| --- | --- |
| [`publishMembershipPresentation.ts:92`](../../../lambda/ephemera/dataSource/perception/publishMembershipPresentation.ts) (leave) | **Yes** --- the mover is already removed from `from` by commit time |
| [`publishMembershipPresentation.ts:111`](../../../lambda/ephemera/dataSource/perception/publishMembershipPresentation.ts) (arrive) | No --- the mover is in `to` |
| [`publishObjectManipulationPresentation.ts:56`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts) | No --- take/drop move *objects*; the actor never left the room |
| [`publishObjectManipulationPresentation.ts:69`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts) | No --- same |

`ROOM#` targets expand against the **live** roster at publish time ([`publishMessage/index.ts:83`](../../../lambda/ephemera/publishMessage/index.ts)), so post-commit the mover is missing from `from`'s roster and has to be re-added by hand. One occurrence out of four is a fix; three are a defensive tic copied across two narration families. Nothing at any call site distinguishes them.

**2. The world-state / transport seam already exists inside one function.** [`hydrateRoomRoster.ts:34-40`](../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts) reads `Positions.getPositionGraph(roomId).characterIds` (world state), then hydrates each id with `CharacterSessions.get` (transport state). `ROOM#` expansion is *already* `positionGraph.characterIds` --- the same source the mutation kernel walks. Early binding does not introduce a split; it hoists the first half of an existing two-stage resolution to beat time and leaves the second half at flush.

**3. The kernel currently encodes a single, global *terminal* binding rule that narration cannot live under.** [`executeStepSequence.ts:40-46`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/executeStepSequence.ts) commits every mutation step, then perceives, and its header comment explicitly forbids callers relying on array order. That rule is right for `describe` steps (a description must reflect final committed state) and wrong for narration (a leave line must reflect the room the character was still standing in). This is the structural reason navigate's narration grew a separate fan-in path instead of joining the kernel.

**4. `inferMembershipEmissionShape` reconstructs information the plan already had.** [`membershipPresentationFanIn.ts:88-104`](../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) derives `leaveAndArrive` / `arriveOnly` / `leaveOnly` / `none` from `(froms, to)` endpoint data --- reasoning backwards to what kind of event occurred. Under a kernel step sequence, the shape *is* the plan (`[narrate-leave, move]` vs `[move, narrate-arrive]`), so the inference and the `MembershipEmissionShape` enum both dissolve. This is structurally the same discard-and-reconstruct pattern the messageOrchestration consolidation retired for *delivery ordering*, one layer down, applied to *event shape*.

**Not requirement-gated.** Navigate, connect, and disconnect all already route their mutations through [`commitStepSequence`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts) (see its header: `applyCharacterRoomMembership` (navigate/connect/disconnect)). The interleaving point exists for all three today; only the narration half is still outside.

## Design decisions (confirmed through conversation, 2026-07-28)

- **PB-A. Narration steps are positionally bound; describe steps are terminally bound.** A narration step resolves its audience against graph state *at its own position in the walk*; a describe step resolves against final committed state. The unified kernel must carry both disciplines explicitly, per step kind --- collapsing them back into one rule in either direction reintroduces the bug this plan exists to remove.

- **PB-B. The binding-time rule, stated mechanically: early-bind a target iff resolving it requires reading *world state*; late-bind iff it requires reading *transport state*.** So `ROOM#` early-binds at beat time to a concrete `CHARACTER#[]`; `CHARACTER#` and `SESSION#` stay late-bound, because "which sessions does this character have connected" is a delivery concern, not a world-state one. `getRoomCharacterList` is the existence proof the two are separable --- it currently performs one of each, in that order.

- **PB-C. The only set-divergence introduced is concurrent third-party membership change, and early binding is the better answer there.** Beat-time and flush-time capture agree on everything the beat's own mutation does. They differ only when *another* invocation changes room membership between beat and flush --- and the audience for "Tess left" should be who was standing there at that beat, not who wandered in while an LLM was still generating a room header. This is a second bug fixed, not a tradeoff absorbed.

- **PB-D. Capture must be assignment, never append.** `applyStepSequenceCore` runs inside a `MultiKeyUpdate` reducer under `exponentialBackoffWrapper` ([`commitStepSequence.ts:115`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts)), so the reducer body can run several times. Every value the existing code retains across that boundary is an idempotent overwrite (`priorGraphs = graphs`, `committedGraphs = new Map(outcome.graphs)`). An accumulating `push` would duplicate narration across retry attempts.

- **PB-E. Anything retained past the reducer's return must be plain-copied.** The reason `committedGraphs` is `new Map(...)` and not the draft-derived value: `MultiKeyUpdate` reducers use Immer `produce()`, and retained draft-backed objects throw "revoked proxy" on later reads. Captured audiences must be plain arrays of ids.

- **PB-F. Capture ids only; hydration and validity stay late.** `hydrateRoomRosterFromCharacterIds` also drops characters whose `CharacterMeta` is missing (`{ check: true }`) --- a validity concern that is neither world nor transport. Beat-time capture snapshots a set of ids and validates nothing.

- **PB-G. Reordering execution is free, because delivery order is already decoupled.** The `messageOrchestration` bundle flushes in *declared* order and assigns `CreatedTime` itself ([`messageOrchestrationFanIn.ts`](../../../lambda/ephemera/dataSource/messageOrchestration/messageOrchestrationFanIn.ts)). Moving `narrate-leave` ahead of `move-mutation` in execution therefore does not perturb `[leave, header, arrive]` delivery at all. This is a direct payoff of [`AGENT.messageOrchestrationConsolidation.planning.md`](AGENT.messageOrchestrationConsolidation.planning.md)'s Phases 1--8 and is what makes this change safe now.

- **PB-H. Presence and perspective are orthogonal; only presence is in scope.** Positional binding answers *who was where, when*. It does not answer *whether the actor receives their own event, and in what wording*. There is no actor/observer copy split anywhere today --- all narration is third person to one audience ([`publishObjectManipulationPresentation.ts:28-37`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts)) --- so nothing needs one yet. Second-person copy is a natural `referent` build-in to the instruction set (an `ACTOR` / `!ACTOR` target kind, sibling to `!CHARACTER#`), **deliberately deferred**; see PB-4. Flagging it because the `[room, characterId]` idiom *looks* like a perspective mechanism and is not, and someone will otherwise try to solve perspective with the presence tool.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) (durability ladder, open-decisions litmus tests, Recommended order checkbox convention).
2. Read the originating framing: [`AGENT.messageOrchestrationConsolidation.planning.md`](AGENT.messageOrchestrationConsolidation.planning.md)'s Phase 9 row and its 2026-07-26 "Navigate is a presentation `KernelStep[]` plan" Design decision --- this plan supersedes both.
3. Read the kernel this extends, in this order:
   - [`kernelStep.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) (step vocabulary and the mutation/non-mutation split)
   - [`applyStepSequenceCore.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/applyStepSequenceCore.ts) (the ordered pure walk over an immutable graph map --- the mechanism this plan hangs capture on)
   - [`commitStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts) (the `MultiKeyUpdate` reducer and retry boundary --- PB-D/PB-E live here)
   - [`executeStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/executeStepSequence.ts) (today's global terminal-binding rule)
4. Read the narration being migrated: [`membershipPresentationFanIn.ts`](../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) + [`publishMembershipPresentation.ts`](../../../lambda/ephemera/dataSource/perception/publishMembershipPresentation.ts), and the second family [`publishObjectManipulationPresentation.ts`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts).
5. Read the target-resolution seam: [`hydrateRoomRoster.ts`](../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts) and [`publishMessage/index.ts`](../../../lambda/ephemera/publishMessage/index.ts)'s target expansion.
6. Durable doc destinations for shipped rules: [`dataSource/positions/AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (normative binding rule), [`AGENT.concepts.md`](../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (presence-vs-perspective vocabulary), [`AGENT.implementation.md`](../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) (paths and behavior).
7. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md). If commands conflict, that document wins. There is no `taskPlanning/lambda/ephemera/AGENT.development.md`.
8. Baseline (run from `lambda/ephemera`, should pass before edits):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/positions/manipulation/kernel/ \
  dataSource/positions/navigate/ \
  dataSource/perception/ \
  dataSource/messageOrchestration/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step. Nothing below is built yet; all lines start `[ ]`.

- [ ] **Phase 1. Add a narration step kind and positional capture to the kernel walk.**
  - [ ] Extend `KernelStep` with a narration step kind, distinct from `KernelMutationStep` and from `describe` steps (`kernelStep.ts`). Decide its payload shape against PB-2 below (does it carry built copy, or the ingredients to build copy later).
  - [ ] Give the ordered walk a positional capture channel: at a narration step's position, snapshot the relevant host's `characterIds` from the live `graphs` map. Resolve PB-5 first (does `applyStepSequenceCore` grow this, or a sibling walker own it) --- the function is currently pure and returns a verdict union, so this is a signature change either way.
  - [ ] Honor PB-D (assignment, not append) and PB-E (plain-copy) at the reducer boundary. A test that forces a reducer retry and asserts narration is not duplicated is the one that actually proves this.
  - [ ] Tests: capture at a pre-mutation position sees the entity still present; capture at a post-mutation position does not; a failed/illegal commit discards captured narration entirely.
- [ ] **Phase 2. Migrate navigate onto positional narration.**
  - [ ] Express navigate as `[narrate-leave, move-mutation, describe-header, narrate-arrive]` and route it through the kernel, replacing `orchestrateCharacterNavigate`'s hand-rolled slot-list computation.
  - [ ] Retire the load-bearing `[from, characterId]` patch (`publishMembershipPresentation.ts:92`) --- the captured audience now includes the mover by construction.
  - [ ] Confirm delivery order is untouched (PB-G): the bundle still declares and flushes `[leave, header, arrive]` regardless of the new execution order.
  - [ ] Tests: mover receives their own leave line; occupants of the arrival room do not; occupants of the departure room do not receive the arrive line.
- [ ] **Phase 3. Migrate connect/disconnect; dissolve the shape inference.**
  - [ ] Express connect as `[move, narrate-arrive]` and disconnect as `[narrate-leave, move]`.
  - [ ] Delete `inferMembershipEmissionShape` and the `MembershipEmissionShape` enum (`membershipPresentationFanIn.ts`) --- the step sequence is the shape (Purpose finding 4).
  - [ ] Resolve PB-1 (does the membership presentation fan-in retire entirely, or survive for fact-only paths) before deleting the cluster itself.
- [ ] **Phase 4. Retire the redundant `characterId` in the remaining three sites.**
  - [ ] Drop the no-op trailing `characterId` from navigate-arrive and both object-manipulation narration sites. Decide PB-3 first (do the object-manipulation sites migrate onto positional capture, or merely lose the redundant field).
- [ ] **Phase 5. Durable docs.**
  - [ ] `positions/AGENT.contract.md`: the binding-time rule (PB-B) as a normative clause --- which target kinds bind when, and why.
  - [ ] `positions/AGENT.concepts.md`: positional-vs-terminal binding, and presence-vs-perspective (PB-A, PB-H) as vocabulary.
  - [ ] `positions/AGENT.implementation.md` and `positions/manipulation/AGENT.implementation.md`: the capture channel's paths and behavior.
  - [ ] `dataSource/perception/AGENT.md`: correct the narration-delivery passages once the fan-in changes.

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to implement the next slice(s). When a decision ships, record it in `positions/AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PB-1 | Does `MembershipPresentationFanInCluster` retire entirely, or survive for fact-only paths that have no kernel plan to interleave into (`repairCharacterLegalPlacement.ts`)? If it survives, is that a permanent second path or a migration remnant? | Phase 3 | **Open** |
| PB-2 | Does a narration step carry already-built copy, or the ingredients (`characterName`, `exitName`, `intentKind`) for copy to be built at flush? Copy today depends on intent data (`exitAware`, `home`, `connect`) that the kernel has at plan time --- so this is a genuine fork, not an obvious default. | Phase 1 | **Open** |
| PB-3 | Do the two object-manipulation narration sites migrate onto positional capture, or just drop their redundant `characterId`? They have no ordering problem today (the actor never moves), so migration may be uniformity for its own sake. | Phase 4 | **Open** |
| PB-4 | `ACTOR` / `!ACTOR` target kinds for second-person copy, as a `referent` build-in to the instruction set | A later, separate task --- explicitly not this plan | **Deliberately deferred 2026-07-28.** Named so the deferral is explicit rather than silently assumed permanent. Presence and perspective are orthogonal (PB-H); positional binding does not and should not answer perspective. Note `!CHARACTER#` and `GLOBAL` currently have **zero production producers** --- only `publishMessage/index.ts`'s own filter machinery references them --- so this would be building on a largely unexercised part of the target vocabulary. |
| PB-5 | Does `applyStepSequenceCore` grow the capture channel in place, or does a sibling walker own it? The function is currently pure (`steps + graphs -> KernelApplyOutcome`) and shared by every live mutation route, so widening it touches routes that will never carry narration. | Phase 1 | **Open** |

## Verification

Per slice, from `lambda/ephemera`:

```bash
# Baseline / per-slice
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/kernel/ \
  dataSource/positions/navigate/ \
  dataSource/perception/ \
  dataSource/messageOrchestration/

# Full suite before marking a phase done
npm run test -- --watchAll=false

# Typecheck
npx tsc --noEmit
```

Grep checks once Phase 3 and Phase 4 land:

```bash
# The [room, characterId] idiom should have no remaining occurrences
grep -rn "targets: \[.*, *\(args\.\|plan\.\)characterId\]" --include="*.ts" lambda/ephemera | grep -v node_modules

# Shape inference should be gone
grep -rn "inferMembershipEmissionShape\|MembershipEmissionShape" --include="*.ts" lambda/ephemera | grep -v node_modules
```
