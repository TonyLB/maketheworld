# Presentation kernel: positional state binding for narration

**Status:** Not started, 2026-07-28. Framed through conversation while closing out the `messageOrchestrationConsolidation` initiative (2026-07-25 to 2026-07-28; its task plan shipped all phases and was retired per [`taskPlanning/AGENT.md`](../../AGENT.md) --- the shipped mechanism is documented in [`dataSource/messageOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/messageOrchestration/AGENT.md)). This plan carries what that initiative scoped as its optional Phase 9 capstone ("generalize to a presentation `KernelStep[]` kernel"), **re-framed** around the organizing principle that actually motivates it: narration steps are *positionally* bound to world state, and the kernel walk is the only place that binding is available. Nothing below is built yet.

**Scope clarified 2026-07-29 (PB-L):** this plan does not build a *new* kernel. The presentation kernel's **describe branch already ships** as `perceiveStepSequence.ts` (misnamed "perception kernel"; see [`AGENT.perceptionKernel.planning.md`](dataSource/actions/AGENT.perceptionKernel.planning.md) Phase 3). This plan adds its **narration branch** plus the positional-capture mechanism that feeds it. The two documents are two halves of one kernel.

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

## Design decisions (confirmed through conversation, 2026-07-28; PB-I/J/K added 2026-07-29)

- **PB-A. Narration steps are positionally bound; describe steps are terminally bound.** A narration step resolves its audience against graph state *at its own position in the walk*; a describe step resolves against final committed state. The unified kernel must carry both disciplines explicitly, per step kind --- collapsing them back into one rule in either direction reintroduces the bug this plan exists to remove.

- **PB-B. The binding-time rule, stated mechanically: early-bind a target iff resolving it requires reading *world state*; late-bind iff it requires reading *transport state*.** So `ROOM#` early-binds at beat time to a concrete `CHARACTER#[]`; `CHARACTER#` and `SESSION#` stay late-bound, because "which sessions does this character have connected" is a delivery concern, not a world-state one. `getRoomCharacterList` is the existence proof the two are separable --- it currently performs one of each, in that order.

- **PB-C. The only set-divergence introduced is concurrent third-party membership change, and early binding is the better answer there.** Beat-time and flush-time capture agree on everything the beat's own mutation does. They differ only when *another* invocation changes room membership between beat and flush --- and the audience for "Tess left" should be who was standing there at that beat, not who wandered in while an LLM was still generating a room header. This is a second bug fixed, not a tradeoff absorbed.

- **PB-D. Capture must be assignment, never append.** `applyStepSequenceCore` runs inside a `MultiKeyUpdate` reducer under `exponentialBackoffWrapper` ([`commitStepSequence.ts:115`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts)), so the reducer body can run several times. Every value the existing code retains across that boundary is an idempotent overwrite (`priorGraphs = graphs`, `committedGraphs = new Map(outcome.graphs)`). An accumulating `push` would duplicate narration across retry attempts.

- **PB-E. Anything retained past the reducer's return must be plain-copied.** The reason `committedGraphs` is `new Map(...)` and not the draft-derived value: `MultiKeyUpdate` reducers use Immer `produce()`, and retained draft-backed objects throw "revoked proxy" on later reads. Captured audiences must be plain arrays of ids.

- **PB-F. Capture ids only; hydration and validity stay late.** `hydrateRoomRosterFromCharacterIds` also drops characters whose `CharacterMeta` is missing (`{ check: true }`) --- a validity concern that is neither world nor transport. Beat-time capture snapshots a set of ids and validates nothing.

- **PB-G. Reordering execution is free, because delivery order is already decoupled.** The `messageOrchestration` bundle flushes in *declared* order and assigns `CreatedTime` itself ([`messageOrchestrationFanIn.ts`](../../../lambda/ephemera/dataSource/messageOrchestration/messageOrchestrationFanIn.ts)). Moving `narrate-leave` ahead of `move-mutation` in execution therefore does not perturb `[leave, header, arrive]` delivery at all. This is a direct payoff of the messageOrchestration consolidation and is what makes this change safe now --- before that work, reordering execution would also have reordered delivery.

- **PB-H. Presence and perspective are orthogonal; only presence is in scope.** Positional binding answers *who was where, when*. It does not answer *whether the actor receives their own event, and in what wording*. There is no actor/observer copy split anywhere today --- all narration is third person to one audience ([`publishObjectManipulationPresentation.ts:28-37`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts)) --- so nothing needs one yet. Second-person copy is a natural `referent` build-in to the instruction set (an `ACTOR` / `!ACTOR` target kind, sibling to `!CHARACTER#`), **deliberately deferred**; see PB-4. Flagging it because the `[room, characterId]` idiom *looks* like a perspective mechanism and is not, and someone will otherwise try to solve perspective with the presence tool.

- **PB-I. Kernel plans are *compiled* from abstract operations, not hand-built per call site (added 2026-07-29).** Two levels, not one. An abstract op names *what happened in the world* (`Move(character, from, to)`); a **compiler** expands it into the kernel-ready sequence (`[narrate-leave, move, describe-header, narrate-arrive]`). Callers --- navigate, connect, disconnect --- emit abstract ops and never spell out narration themselves. Only the compiler knows that moving a character narrates, so "a move always brackets leave-then-arrive" becomes an invariant of one function rather than a convention re-derived at three sites. Purpose finding 1 is the precedent for why that matters: three call sites copied the same defensive `[room, characterId]` patch and only one of them needed it, precisely because nothing shared owned the decision. Note the compiler attacks `inferMembershipEmissionShape` from the *opposite* direction to Purpose finding 4: that function reasons **backwards** from `(froms, to)` endpoint data to an event shape, whereas the compiler holds the shape **forwards** from a named op and never has to infer it. Both routes delete it --- this one also prevents the next such inference from being written. The compile boundary is also where PB-2 (built copy vs. ingredients) is properly decided: intent data (`exitAware`, `home`, `connect`) is in hand at compile time, so it need not survive to flush.

- **PB-J. Positional capture is a first-class walk step, not a side-channel (resolves PB-5, 2026-07-29).** Neither of PB-5's two framings: not a sibling walker, and not a side-table of boundary indices threaded past a narrowly-typed `applyStepSequenceCore`. A capture enters the walk array itself.

  **The decisive reason is the footprint.** [`computeStepSequenceFootprint.ts:8-18`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/computeStepSequenceFootprint.ts) is the transaction lock-set declaration, and it is explicit that it must be computed once up front because `MultiKeyUpdate` "cannot be re-entered mid-reducer to lock a newly-discovered host." A capture reads a host's roster, so that host **must** be in the footprint or `graphs.get(hostId)` returns undefined inside the reducer. As an array step, the footprint picks it up automatically and it is structurally impossible to forget. As a side-table, every caller must remember to union capture hosts into the footprint --- an invariant that lives nowhere and is enforced by nothing. Worse, it would fail *late and selectively*: navigate happens to work, because the move already locks both rooms; the first break is a capture against an otherwise-unmutated host, in a feature written much later by someone who never read this plan.

  **The array's real membership test is "does this step need the walk's *position*?"** `describe` does not --- it is terminally bound (PB-A), owned by the perception kernel, and reads final state. Capture does, definitionally. The narrow-type boundary documented at [`kernelStep.ts:35-43`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) was drawn *against `describe` specifically*, and describe's reasons do not transfer to capture. Treating that boundary as a founding principle rather than a scoped exclusion is a mistake this clause exists to prevent repeating.

  **Consequence: the walk's input type widens to admit capture.** Under PB-K's renaming this needs no new type at all --- `MutationKernelStep` means "what the mutation kernel accepts," so `MutationKernelCaptureStep` belongs inside it by definition. (An earlier draft of this clause introduced a separate `KernelWalkStep` purely to avoid `KernelMutationStep` becoming a lie; PB-K dissolves the need for it, which is the main reason that rename should land first.) All three consumers have exactly one production caller (`commitStepSequence`), so blast radius is one file, and each new case is meaningful rather than boilerplate: `applyStepSequenceCore` records the roster and continues; `computeStepSequenceFootprint` contributes the `hostId`, which is the *feature*; `factsForStep` yields nothing, because a capture is not a world event.

  **The half of the old boundary worth keeping, stated normatively:** a capture step carries `hostId` + `captureId` and **no write payload**, so it cannot contribute to the `transactWrite` write set. A read-only step is safe inside the mutation walk *only* under that shape constraint --- enforce it by shape, not by exclusion.

  **Narration itself never enters the walk** --- but it *is* a `KernelStep`. The compiler emits narration steps that reference a `captureId`; the **presentation kernel** (PB-L) filters them out of the shared list post-commit and builds copy and targets from the captured id sets. Because the capture sits at its own position in the walk array, `captureId` carries *identity* only, never position --- which removes index-correlation between the compiler's outputs entirely. (An earlier draft of this clause described that consumer as a bespoke "sibling assembler," which left it unclassified; PB-L identifies it as one branch of a kernel that already exists.)

- **PB-K. `Kernel` is not an unambiguous prefix; qualify per-kernel types with the kernel that owns them (2026-07-29).** There are exactly two kernels --- mutation and presentation (PB-L) --- so `Kernel` alone identifies neither.

  **`KernelStep` stays unprefixed --- it is the one name currently doing its job.** [`kernelStep.ts:46-54`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) defines it as the *shared, cross-kernel* instruction vocabulary that "each kernel filters this shared list down to the steps it owns." It belongs to no single kernel, so it takes no kernel's name. Prefixing it would destroy the only distinction the current scheme gets right.

  **The actual defect is that the shared union's two halves are named on different schemes** --- `KernelMutationStep` on one side, `ExecutorDescribeStep` on the other. Nothing in either name says they are siblings, or that each is one kernel's filtered view of `KernelStep`.

  | Current | Becomes | Note |
  | --- | --- | --- |
  | `KernelStep` | *unchanged* | shared, cross-kernel; correctly unprefixed |
  | `KernelMutationStep` | `MutationKernelStep` | widened to include capture (PB-J) |
  | `ExecutorDescribeStep` | member of new `PresentationKernelStep` | `PresentationKernelStep = ExecutorDescribeStep \| <narration step>` (PB-L). **Do not rename `ExecutorDescribeStep`** --- it is owned by `executorTypes.ts` and reused verbatim; renaming it would steal it from the executor. Until the narration step exists this union has one member, which is fine --- it names the *filter*, not the arity |
  | `perceiveStepSequence` / `PerceiveStepSequenceDeps` | `presentStepSequence` / `PresentStepSequenceDeps` | the shipped describe-half of the presentation kernel (PB-L); 36 occurrences across 7 files |
  | `KernelTransferMembershipStep` | `MutationKernelTransferStep` | cannot simply drop the prefix --- `TransferMembershipStep` is already taken by the executor |
  | `KernelApplyOutcome`, `KernelCommitResult`, `KernelDropped` | `MutationKernel*` | all mutation-kernel-specific |
  | *(new, PB-J)* | `MutationKernelCaptureStep` | |

  **Scale:** 127 occurrences across 20 files, 88% of it `KernelMutationStep` (83) and `KernelStep` (29); all but five consumer files live under `positions/manipulation/kernel/`.

  **Honest weighting:** the `Kernel*` --> `MutationKernel*` transposition is the *least* valuable part --- `KernelMutationStep` vs. `MutationKernelStep` is a subtle flip that buys little alone. The value is in `PresentationKernelStep` (which makes the two halves visible as siblings, and gives the narration step a home to be added to) and in `MutationKernelStep` absorbing capture (which deletes a type PB-J would otherwise need). The transposition is what makes those two coherent, not a win on its own.

- **PB-L. There are exactly two kernels; the presentation kernel has a describe branch and a narration branch (2026-07-29).** Both publish into the player's transcript, and both filter the shared `KernelStep[]` post-commit. The describe branch **already ships** --- [`perceiveStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/perceiveStepSequence.ts), built by [`AGENT.perceptionKernel.planning.md`](dataSource/actions/AGENT.perceptionKernel.planning.md) Phase 3. This plan builds the narration branch and the capture mechanism that feeds it. **The two plans are two halves of one kernel, not two kernels.**

  | Kernel | Filters | Runs |
  | --- | --- | --- |
  | mutation | mutation + capture steps | in the walk, inside the transaction |
  | presentation | describe + narrate steps | after commit |

  **"Perception" was the wrong word and "presentation" is the right one, on the codebase's own usage.** Every `*Presentation*` identifier in production is narration publishing --- `publishMembershipPresentation` (leave/arrive), `publishObjectManipulationPresentation` (take/drop), the fan-ins, the label resolvers; 10 of 13 such files live in `dataSource/perception/`. So the repo already draws the line this clause needs: **perception** is the broad experience category *and a data source's name*; **presentation** is specifically publishing something into the transcript. Naming a kernel "perception" claimed a data source's territory and, worse, implied narration should route through it terminally --- the exact opposite of PB-A. Presentation is a step-kind category, parallel to mutation.

  **Consequence for PB-A, stated precisely:** positional vs. terminal binding is *not* about when publishing happens --- both branches publish post-commit. It is about **where the state came from**: a describe step reads final committed state; a narrate step reads a roster captured mid-walk (PB-J). Do not restate PB-A as an ordering rule.

  **Naming it "presentation" now rather than after the narration branch lands** is deliberate: the word is not false today (publishing a description *is* presentation, just a narrow slice), the widening is two phases out and concrete, and an interim "describe kernel" name would live about a week. The cost is that the name briefly overclaims; the alternative is renaming shipped code twice.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) (durability ladder, open-decisions litmus tests, Recommended order checkbox convention).
2. Read the mechanism this builds on: [`dataSource/messageOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/messageOrchestration/AGENT.md) --- in particular "Publish behavior" (the bundle assigns `CreatedTime` in declared order, which is what decouples execution order from delivery order, PB-G) and its closing note that a kernel step requesting a *header* slot is still undesigned.
3. Read the kernel this extends, in this order:
   - [`kernelStep.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) (step vocabulary and the mutation/non-mutation split)
   - [`applyStepSequenceCore.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/applyStepSequenceCore.ts) (the ordered pure walk over an immutable graph map --- the mechanism this plan hangs capture on)
   - [`commitStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts) (the `MultiKeyUpdate` reducer and retry boundary --- PB-D/PB-E live here)
   - [`executeStepSequence.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/executeStepSequence.ts) (today's global terminal-binding rule)
4. Read the narration being migrated: [`membershipPresentationFanIn.ts`](../../../lambda/ephemera/dataSource/perception/membershipPresentationFanIn.ts) + [`publishMembershipPresentation.ts`](../../../lambda/ephemera/dataSource/perception/publishMembershipPresentation.ts), and the second family [`publishObjectManipulationPresentation.ts`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts).
5. Read the hand-rolled plan construction the compile layer replaces (PB-I): [`orchestrateNavigate.ts:44-70`](../../../lambda/ephemera/dataSource/positions/navigate/orchestrateNavigate.ts) --- one `inferMembershipEmissionShape` call feeding two hand-built lists (steps and `MessageOrchestrationSlotSpec[]`). This is the concrete shape of what PB-6/PB-7 are deciding.
6. Read the target-resolution seam: [`hydrateRoomRoster.ts`](../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts) and [`publishMessage/index.ts`](../../../lambda/ephemera/publishMessage/index.ts)'s target expansion.
7. Durable doc destinations for shipped rules: [`dataSource/positions/AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (normative binding rule), [`AGENT.concepts.md`](../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) (presence-vs-perspective vocabulary), [`AGENT.implementation.md`](../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) (paths and behavior).
8. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md). If commands conflict, that document wins. There is no `taskPlanning/lambda/ephemera/AGENT.development.md`.
9. Baseline (run from `lambda/ephemera`, should pass before edits):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/positions/manipulation/kernel/ \
  dataSource/positions/navigate/ \
  dataSource/perception/ \
  dataSource/messageOrchestration/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step. Nothing below is built yet; all lines start `[ ]`.

- [ ] **Phase 0. Rename per-kernel types and the presentation kernel itself (PB-K, PB-L). Pure rename --- no behavior change.**
  - [ ] Apply PB-K's table. `KernelStep` is deliberately untouched; everything mutation-kernel-specific gains the `MutationKernel` prefix; `PresentationKernelStep` is added as a union *containing* `ExecutorDescribeStep`, which is not itself renamed.
  - [ ] Rename the shipped describe branch: `perceiveStepSequence` --> `presentStepSequence` (+ `PerceiveStepSequenceDeps`), and correct its doc comment, which currently calls itself "iteration 9/Phase 3's perception kernel." Do the mutation-half and presentation-half renames in the *same* commit --- fixing one and leaving its sibling misnamed is worse than either name alone.
  - [ ] **Land this as its own commit, before Phase 1.** 127 mechanical renames in the same diff as Phase 1's semantic change is how a real bug hides in review noise. Rename-symbol handles the edit; `npx tsc --noEmit` proves it; the full suite should pass with zero behavior delta. If any test needs *changing* rather than just renaming, stop --- that means the rename was not pure.
  - [ ] Update the doc comments that explain *why* the mutation types are narrow (`kernelStep.ts`, `applyStepSequenceCore.ts`, `computeStepSequenceFootprint.ts`, `factsForStep.ts`, `applyCharacterRoomMembership.ts`). Design reasoning in this repo lives in those comments, so a stale one is a real defect, not cosmetic --- and PB-J is about to make several of them wrong anyway.
- [ ] **Phase 1. Add a capture step kind to the kernel walk (PB-J).**
  - [ ] Add `MutationKernelCaptureStep` (`hostId` + `captureId`, **no write payload**) as a member of `MutationKernelStep` (`kernelStep.ts`). Under PB-K no new union type is needed --- "what the mutation kernel accepts" already names it. Note narration is *not* a walk step and never enters the kernel (PB-J), so this phase's original "narration step kind" framing is superseded.
  - [ ] Update the three consumers, each of which has exactly one production caller (`commitStepSequence`): `applyStepSequenceCore` (snapshot the host's `characterIds`, continue), `computeStepSequenceFootprint` (contribute `hostId` to the lock set), `factsForStep` (yield nothing --- a capture is not a world event).
  - [ ] Return captured rosters as plain `EphemeraCharacterId[]` keyed by `captureId`, on the `legal` verdict. PB-F makes PB-E free here: ids are primitive strings, so no draft-backed object survives the reducer's return by construction rather than by discipline.
  - [ ] Honor PB-D (assignment, not append) at the reducer boundary. A test that forces a reducer retry and asserts captures are not duplicated is the one that actually proves this.
  - [ ] Tests: a capture before a mutation sees the entity still present; the same capture after it does not; **a capture naming a host no mutation touches still locks that host** (the footprint case --- this is the test that would have caught the side-table design); a failed/illegal commit discards captures entirely.
- [ ] **Phase 2. Introduce the abstract-op compile layer, with navigate as its first consumer.**
  - [ ] Add the abstract op vocabulary and the compiler that expands an op into `KernelStep[]` (PB-I). Resolve PB-6 (what the vocabulary is) and PB-7 (what the compiler emits --- steps only, or steps *and* the `MessageOrchestrationSlotSpec[]` declaration) before writing it.
  - [ ] Express navigate as the op `Move(character, from, to)`. Per PB-J it compiles to *channels*, not one list: walk steps `[capture(from), move-mutation, capture(to)]`, a `describe` step for the header (terminally bound, perception kernel), and narration records referencing the two `captureId`s. Route it through the kernel --- replacing `orchestrateCharacterNavigate`'s hand-rolled shape inference and slot-list computation ([`orchestrateNavigate.ts:44-70`](../../../lambda/ephemera/dataSource/positions/navigate/orchestrateNavigate.ts)).
  - [ ] Add the **narration branch** to the presentation kernel (PB-J, PB-L): a narrate step joins `PresentationKernelStep`, and `presentStepSequence` filters it alongside `describe`, building copy and targets from the commit's captured id sets. This is where PB-2 actually resolves. Not a new component --- the branch sits beside the describe branch that already ships.
  - [ ] Ship the compiler with exactly one consumer, but write it so the second and third (Phase 3) join without a signature change. The invariant is only *proved* once connect/disconnect stop hand-rolling; Phase 2 just has to not preclude that.
  - [ ] Retire the load-bearing `[from, characterId]` patch (`publishMembershipPresentation.ts:92`) --- the captured audience now includes the mover by construction.
  - [ ] Confirm delivery order is untouched (PB-G): the bundle still declares and flushes `[leave, header, arrive]` regardless of the new execution order.
  - [ ] Tests: mover receives their own leave line; occupants of the arrival room do not; occupants of the departure room do not receive the arrive line.
- [ ] **Phase 3. Migrate connect/disconnect through the same compiler; dissolve the shape inference.**
  - [ ] Express connect and disconnect as abstract ops that compile to `[move, narrate-arrive]` and `[narrate-leave, move]` respectively. They must reach those sequences *through the Phase 2 compiler*, not by hand-building them --- a third hand-rolled bracketing is the exact failure PB-I exists to prevent.
  - [ ] This is the phase that proves PB-I: with three consumers on one compiler, assert that no call site names a narration step directly. A grep for narration step kinds outside the compiler should return nothing.
  - [ ] Delete `inferMembershipEmissionShape` and the `MembershipEmissionShape` enum (`membershipPresentationFanIn.ts`) --- the compiled step sequence is the shape, held forwards rather than inferred backwards (Purpose finding 4, PB-I).
  - [ ] Resolve PB-1 (does the membership presentation fan-in retire entirely, or survive for fact-only paths) before deleting the cluster itself.
- [ ] **Phase 4. Retire the redundant `characterId` in the remaining three sites.**
  - [ ] Drop the no-op trailing `characterId` from navigate-arrive and both object-manipulation narration sites. Decide PB-3 first (do the object-manipulation sites migrate onto positional capture, or merely lose the redundant field).
- [ ] **Phase 5. Durable docs.**
  - [ ] `positions/AGENT.contract.md`: the binding-time rule (PB-B) as a normative clause --- which target kinds bind when, and why. Plus PB-J's write-free clause: a capture step carries no write payload and therefore cannot contribute to the `transactWrite` write set --- the constraint that makes a read-only step safe inside the mutation walk. State it as a shape requirement, since it is what replaces the old blanket "mutation steps only" exclusion.
  - [ ] `positions/manipulation/AGENT.*`: note that captured rosters are **load-bearing**, not diagnostics --- they *are* the narration audience. Someone reading "capture channel" as instrumentation will otherwise prune it as dead weight.
  - [ ] `positions/AGENT.concepts.md`: positional-vs-terminal binding, presence-vs-perspective (PB-A, PB-H), and the abstract-op / compiled-step two-level vocabulary (PB-I) --- including the normative rule that call sites emit ops and only the compiler names narration steps. Also PB-K's naming rule: `Kernel` alone names nothing, per-kernel types carry their kernel's name, and `KernelStep` stays unprefixed *because* it is the shared cross-kernel vocabulary. State the reason, or the next person will "fix" the inconsistency by prefixing it. And PB-L's perception-vs-presentation distinction --- perception is the experience category and a data source; presentation is publishing into the transcript. That one belongs in durable docs precisely because the repo has already made the mistake once.
  - [ ] `positions/AGENT.implementation.md` and `positions/manipulation/AGENT.implementation.md`: the capture channel's paths and behavior.
  - [ ] `dataSource/perception/AGENT.md`: correct the narration-delivery passages once the fan-in changes.

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to implement the next slice(s). When a decision ships, record it in `positions/AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PB-1 | Does `MembershipPresentationFanInCluster` retire entirely, or survive for fact-only paths that have no kernel plan to interleave into (`repairCharacterLegalPlacement.ts`)? If it survives, is that a permanent second path or a migration remnant? | Phase 3 | **Open** |
| PB-2 | Does a narration step carry already-built copy, or the ingredients (`characterName`, `exitName`, `intentKind`) for copy to be built at flush? Copy today depends on intent data (`exitAware`, `home`, `connect`) that the kernel has at plan time --- so this is a genuine fork, not an obvious default. **Now scoped by PB-I**: the fork is really "how much does the compiler bake in", and the compiler has all the intent data by construction. | Phase 1 (shape), Phase 2 (compiler) | **Open** |
| PB-3 | Do the two object-manipulation narration sites migrate onto positional capture, or just drop their redundant `characterId`? They have no ordering problem today (the actor never moves), so migration may be uniformity for its own sake. **PB-I adds a second axis**: even if they never need positional capture, `Take`/`Drop` may be worth having as abstract ops so no narration is hand-rolled anywhere. Those two answers are independent. | Phase 4 | **Open** |
| PB-4 | `ACTOR` / `!ACTOR` target kinds for second-person copy, as a `referent` build-in to the instruction set | A later, separate task --- explicitly not this plan | **Deliberately deferred 2026-07-28.** Named so the deferral is explicit rather than silently assumed permanent. Presence and perspective are orthogonal (PB-H); positional binding does not and should not answer perspective. Note `!CHARACTER#` and `GLOBAL` currently have **zero production producers** --- only `publishMessage/index.ts`'s own filter machinery references them --- so this would be building on a largely unexercised part of the target vocabulary. |
| PB-5 | Does `applyStepSequenceCore` grow the capture channel in place, or does a sibling walker own it? | Phase 1 | **Resolved 2026-07-29 --- see PB-J.** Neither. Capture becomes a first-class walk step, admitted by the mutation kernel's own step union (`MutationKernelStep` after PB-K). The footprint's lock-set requirement decided it: a side-table cannot guarantee capture hosts get locked. The premise that widening "touches routes that will never carry narration" was also wrong --- all three consumers have exactly one production caller (`commitStepSequence`). |
| PB-6 | What is the abstract op vocabulary, and is it a closed enum? `Move` alone covers navigate/connect/disconnect (Phases 2--3); `Take`/`Drop` would extend it to object manipulation (PB-3). World operations are genuinely enumerable, so a closed discriminated union is the presumptive answer --- but confirm the set before the compiler's signature hardens. | Phase 2 | **Open** |
| PB-7 | Does the compiler emit `KernelStep[]` only, or also the `MessageOrchestrationSlotSpec[]` bundle declaration? Today `orchestrateNavigate.ts:44-70` hand-builds *both*, from the same inferred shape. If the compiler owns execution order while some caller still hand-builds declared delivery order, PB-I has removed one hand-rolled list and left its twin --- and PB-G's decoupling means the two lists genuinely can disagree without a test noticing. Emitting both from one op is the coherent option; confirm nothing else needs to inject slots independently. | Phase 2 | **Open** |

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

# PB-I/PB-J: narration records and capture steps should be constructed only inside the
# compiler. Substitute the real identifiers once named (Phase 1/2); every hit outside the
# compiler's own directory is a call site hand-rolling its own plan.
grep -rn "narrate-leave\|narrate-arrive\|MutationKernelCaptureStep" --include="*.ts" lambda/ephemera | grep -v node_modules | grep -v "\.test\.ts"

# PB-K: no bare Kernel-prefixed identifier should survive except the shared `KernelStep`.
grep -rhoE "\bKernel[A-Za-z]+" --include="*.ts" lambda/ephemera | grep -v node_modules | sort -u
```
