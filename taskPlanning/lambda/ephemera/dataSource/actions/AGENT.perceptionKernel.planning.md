# Perception kernel: heterogeneous instructions, object-directed look (iteration 9)

**Status:** Named 2026-07-24, not started. Design confirmed through conversation; no code built yet.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Ladder position: [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), iteration 9.

## Purpose

Today's Execute-layer kernel (`positions/manipulation/kernel/`) is a pure mutation engine: its whole design --- atomic `transactWrite` bundling (BD-31), diff-derived fact streaming (`factsForStep.ts`) --- exists to solve problems only a graph *mutation* has. There is no path today for a command whose job is to **read** current state and deliver a description, rather than change anything.

This gap is concrete, not hypothetical: neither bare `look`/`l` paraphrases (e.g. "peruse the room") nor any object-directed look ("look rocket skates", "examine `<object>`") has a text-parse path today. `ParseCommandLookComponentResult` (`baseClasses.ts:170`) already exists, but its `componentId` is typed `EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId` --- **not** `EphemeraObjectId` --- and it's explicitly "Not produced by Bedrock parse," only by trusted UI clicks (`routeTrustedUiAction.ts:58-67`). Object-directed look is new scope, not a missing front end on an existing type.

This iteration:

1. Widens Synthesize's grounded-instruction vocabulary to include a **read/describe** kind alongside today's three mutation kinds, so `LookComponent`-shaped commands can reuse the same Grounding/Identify machinery object manipulation already has (this is what finally gives iteration 7's deferred **CPG-5** --- cross-family Identify/Grounding unification --- a second concrete case to build against; see [`AGENT.classifyPlanGeneralization.planning.md`](AGENT.classifyPlanGeneralization.planning.md), CPG-5 row).
2. Builds a new, deliberately lightweight **perception kernel** that consumes the `describe` instructions.
3. Wires strict sequential orchestration between the two kernels (positionGraph kernel commits first; perception kernel reads its committed output second) --- never list order, never parallel.
4. Adds a Plan-stage command-plan entry for object-directed look, following iteration 7's existing layer-4 pattern (`matchRelationalTemplate.ts` is the precedent).

**Explicitly separate from the `LookRoom`-paraphrase LLM-fallback gap** (iteration 7 sub-iteration 2's deliberately-unclosed regression --- "peruse the room" has no closed lexicon and needs an LLM fallback, not a template). That gap is about *classify/Plan not recognizing the command at all*; this iteration is about *what happens once Plan has produced a grounded read instruction*. Whether the paraphrase-fallback work folds into this iteration or stays separate is an open decision below, not assumed either way.

## Design decisions (confirmed through conversation, 2026-07-24)

- **No new "partition" stage.** Grounding stays one shared pass producing a single instruction list (already grounded, tagged by `kind` --- same shape as today's `KernelStep` union, just widened). Each kernel applies its own type-guard filter over that shared list to pull out the instructions it owns. Rejected explicitly: a dedicated dispatcher that sorts instructions into per-kernel buckets up front --- that's a second place that has to know about every kernel's step kinds and silently goes stale when a new kernel is added. This mirrors BD-30/BD-34's existing "shared environment, per-primitive dispatch" precedent rather than introducing a new pattern.
- **Kernels are invoked sequentially, not read off list/kind order and not run in parallel.** The positionGraph kernel's filter-and-commit runs first (unchanged behavior); only after it completes does the perception kernel's filter-and-render run, against the positionGraph kernel's resulting graph state. Reasoning, confirmed directly: descriptions exist only to be delivered to the player, and delivering one that a subsequent mutation in the same command immediately invalidates is worse than the extra sequencing. This ordering is a property of **invocation**, not of the instruction list's structure --- it must not be allowed to become an assumption baked into list order.
- **Perception kernel is not a second instance of the positionGraph kernel's machinery.** The worklist executor, `transactWrite` bundling, and carry-closure fixpoint all exist to solve mutation-specific problems (atomicity, multi-step consistency). A read-only kernel has none of those problems --- it's closer to "walk a short list of already-grounded referents, render each," and should be built that size, not scaled up to match the mutation kernel's internal shape out of a symmetry instinct.
- **Degenerate cases fall out for free** under this design: a pure manipulation command leaves the perception kernel's filtered list empty (no-op); a pure look command leaves the positionGraph kernel's filtered list empty (no-op, unchanged from today).
- **Always-last is safe to assume**, confirmed directly: descriptions are only ever generated in order to deliver them to the player, so there is no case where a later step in the same command needs to depend on an already-generated description.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) and [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) (ladder position, BD-N index --- especially BD-27/BD-30/BD-31/BD-34/BD-36, the executor/kernel decisions this iteration extends).
2. Read [`AGENT.classifyPlanGeneralization.planning.md`](AGENT.classifyPlanGeneralization.planning.md)'s CPG-5 pointer and [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md)'s "Three conceptual jobs" section --- the durable finding there (`EphemeraPositionGraph` nodes are already `'Object'`/`'Character'`-tagged siblings under one mechanism, so referent resolution doesn't need to structurally differ) is the premise Phase 2 below builds on; the concrete gaps that stand between that fact and working code are this plan's own debt (Phase 2), not restated in the durable doc.
3. Read the current kernel to understand what's being extended, not replaced: [`positions/manipulation/kernel/kernelStep.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) (the mutation-only step vocabulary), [`positions/manipulation/kernel/factsForStep.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/factsForStep.ts) (diff-derived fact streaming --- note why this doesn't generalize to a read step), [`positions/manipulation/kernel/commitStepSequence.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts) (atomic commit, the thing the perception kernel must NOT need).
4. Read the existing `LookRoom` render-orchestration precedent (lane ordering: Perception Thread Registered -> flush(lane) -> default-lane Render Requested) --- referenced in the (now-retired) `AGENT.actionParse.plan.md`'s git history and in `dataSource/actions/AGENT.md`; confirm current shape before assuming it's still accurate.
5. Read `baseClasses.ts:169-176` (`ParseCommandLookComponentResult`) and `routeTrustedUiAction.ts:58-67` (its only current producer) to see exactly what's reused vs. new.
6. Read [`enrich/objectManipulation/synthesize/executorTypes.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/executorTypes.ts) and [`plan/matchRelationalTemplate.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/matchRelationalTemplate.ts) --- the instruction shape to widen, and the layer-4 Plan-dispatch precedent to follow for the new look-family matcher.
7. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).
8. Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/positions/manipulation/kernel/ \
  dataSource/actions/enrich/objectManipulation/synthesize/ \
  dataSource/actions/parseCommand.test.ts
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step. Nothing below is built yet; all lines start `[ ]`.

- [X] **Phase 1. Widen the grounded-instruction vocabulary.**
  - [X] Decide where a new `describe` instruction kind lives: widen `KernelStep`/`ExecutorParsePlanStep` directly, or a sibling type the two kernels share. Must carry a resolved referent (id + kind: room/object/character/feature/knowledge) --- parameterize over referent kind the same way `KernelTransferMembershipStep` already generalized over entity kind (BD-36), rather than one step shape per look-variant.
    - **Decided (2026-07-24): widen directly.** Added `ExecutorDescribeStep` (`executorTypes.ts`) --- `{ kind: 'describe', referentId, referentKind: 'room'|'object'|'character'|'feature'|'knowledge' }`, singular referent (no carry-closure concept for a read) --- to `ExecutorParsePlanStep` and `isExecutorParsePlanStep`. Widened `KernelStep` (`kernelStep.ts`) to `KernelMutationStep | ExecutorDescribeStep`, reusing the describe step verbatim (no kernel-layer widening needed, same as relational steps). Split out `KernelMutationStep` (today's pre-widening shape) as the type the positionGraph kernel's commit machinery (`commitStepSequence.ts`, `applyStepSequenceCore.ts`, `computeStepSequenceFootprint.ts`, `factsForStep.ts`, `types.ts`, plus all four mutation-route call sites) keeps accepting --- a `describe` step must never reach that machinery, so those signatures stay narrow rather than widen to the shared list's type. `fromExecutorStep` is overloaded so mutation-only callers still get `KernelMutationStep` back without a cast. All touched suites green (195 tests, 18 suites).
  - [X] Decide whether `ParseCommandLookComponentResult` widens its `componentId` union to include `EphemeraObjectId` (and `EphemeraCharacterId`, if character-directed look is in scope), or whether object/character-directed look becomes its own terminal result type. Note it is explicitly documented today as "Not produced by Bedrock parse" --- widening it changes that invariant and needs its own confirmation, not an assumption.
    - **Decided (2026-07-24): widens.** `ParseCommandLookComponentResult.componentId` widens to `EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraObjectId` --- object-directed look reuses this same result type rather than getting its own terminal type. The "Not produced by Bedrock parse" invariant changes: Phase 4's new Plan-stage matcher becomes a second producer alongside `routeTrustedUiAction.ts`. Character-directed look is not decided here --- left to PK-3's scope call; if in scope, `EphemeraCharacterId` joins this same union rather than forcing a separate result type.
- [ ] **Phase 2. Resolve CPG-5 concretely for this one case.**
  - [ ] Build (or extend) a referent catalog that covers Object (and Character, if in scope) for the look family, reusing Grounding rather than a bespoke resolver --- mirroring the shape `mergeObjectManipulationCatalogs` already has for room-vs-held.
  - [ ] Close the two concrete gaps standing between `AGENT.concepts.md`'s Object/Character sibling-tag finding and working code: (1) `RoomInPlayObjectCatalogEntry` (`roomObjectCatalogForCharacter.ts`) is `EphemeraObjectId`-typed only and never scans Character nodes --- a character-inclusive catalog needs building, the same shape of work `mergeObjectManipulationCatalogs` already does for room-vs-held; (2) `EphemeraObjectId`/`EphemeraCharacterId` are distinct branded types throughout, so a referent that could resolve to either needs a widened id union. Resolve only as far as this iteration's concrete referent needs require --- do not build a fully general cross-family `Identify` abstraction speculatively.
- [ ] **Phase 3. Build the perception kernel.**
  - [ ] New module under `positions/manipulation/kernel/` (or a sibling directory, TBD) that filters a shared instruction list for `describe` steps and renders each against already-resolved graph state. No worklist/fixpoint, no `transactWrite` --- confirm this scope boundary in the module's own doc comment so a future reader doesn't assume parity with the mutation kernel's internals.
  - [ ] Wire the sequential orchestration at the Execute dispatch boundary: invoke positionGraph kernel's filter-and-commit first (`await`), then invoke perception kernel's filter-and-render second, passing it the positionGraph kernel's resulting graph state. Confirm this ordering is enforced by the calling code, not an assumption about list order.
  - [ ] Decide how the perception kernel's output reaches the render pipeline: does it emit into the existing `LookRoom` lane-ordering mechanism (Perception Thread Registered -> flush(lane) -> Render Requested), or does it need its own delivery path?
- [ ] **Phase 4. Plan-stage dispatch for object-directed look.**
  - [ ] Add a command-plan entry for object-directed look (e.g. `look <object>`/`examine <object>`), following iteration 7's layer-4 pattern (`matchRelationalTemplate.ts` is the concrete precedent) --- deterministic template or skeleton matcher, producing a grounded `describe` instruction via Phase 1/2's machinery.
  - [ ] End-to-end test: a "look `<object>`" command produces zero mutation instructions, one `describe` instruction, and a rendered description delivered to the acting character, with no interaction with the positionGraph kernel's commit path beyond reading its (unchanged) graph state.

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PK-1 | Exact shape/location of the new `describe` instruction kind (widen `KernelStep` vs. sibling type) | Phase 1 | Resolved 2026-07-24: widened `KernelStep`/`ExecutorParsePlanStep` directly (see Phase 1 note) |
| PK-2 | Whether `ParseCommandLookComponentResult` widens, or object/character-directed look gets its own result type | Phase 1, Phase 4 | Resolved 2026-07-24: widens `componentId` to include `EphemeraObjectId`; character inclusion deferred to PK-3 |
| PK-3 | How far Phase 2's referent-catalog work goes --- object-only, or object+character | Phase 2 | Open |
| PK-4 | Perception kernel's output delivery path --- reuse `LookRoom`'s existing lane-ordering mechanism, or a new one | Phase 3 | Open |
| PK-5 | Whether the `LookRoom`-paraphrase LLM-fallback gap (iteration 7 sub-iteration 2's deliberately-unclosed regression) folds into this iteration's scope or stays a separate, later concern | None yet --- named so it isn't silently assumed either way | Open |

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/positions/manipulation/kernel/ \
  dataSource/actions/enrich/objectManipulation/synthesize/ \
  dataSource/actions/parseCommand.test.ts
npm run build
```

## Progress

| Milestone | Status |
| --- | --- |
| Design confirmed through conversation (shared instruction list + per-kernel filter, sequential invocation, lightweight perception kernel) | Done (2026-07-24) |
| Phase 1 (instruction vocabulary widening) | Done (2026-07-24) |
| Phase 2 (CPG-5 resolved for this case) | Not started |
| Phase 3 (perception kernel + sequential orchestration) | Not started |
| Phase 4 (Plan-stage dispatch for object-directed look) | Not started |
