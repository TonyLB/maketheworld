# Membership mutation stack: names, boundaries, and doc register

**Status:** Not started, seeded 2026-09-05. Nothing below is built. The next step is to field the [open decisions](#open-decisions-implementation--plan-only) --- several of them gate what the early slices actually do, and the slice list is deliberately written so that answering them narrows the work rather than expanding it.

**This plan *executes* [CD3](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order); it does not own it.** The design question --- what, if anything, replaces the carry-closure BFS --- stays in `AGENT.abstractionLayers.planning.md`'s Channel D, which has held it since 2026-08-22. What lands here is the code, and MS-8's downstream implementation fork. **Record CD3's outcome in that plan when this one finishes** (Phase 5); do not re-argue it here, and do not close CD3's checkbox from inside this plan without writing the result into its row.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md). It is a **standard implementation plan**, not a design-stage one: the deliverable of every phase is a diff, and the open forks hang off the worklist rather than the worklist existing to close them.

**Scope note.** The subject spans two DataSources --- `positions/` (op, compile, commit, present) and `actions/enrich/objectManipulation/` (parse, plan, executor) --- which is why this plan sits at `taskPlanning/lambda/ephemera/` rather than under `positions/`. It is expected to broaden; the ID series and phase list have room reserved for that.

## Why this initiative exists

The membership mutation stack works. Its **naming and division of responsibility do not describe it.** Both grew by accretion across a run of shipped migrations (`applyObjectSet*` -> `executeObject*` -> the unified kernel; the async fan-ins -> the presentation kernel; the object-lifecycle and character-route Migrate rows), and each migration named its output after **where it was being called from** at the time rather than after what it fundamentally does.

The result is a system whose surface **self-documents its own history**. Four symptoms, each measured against the code as of this seeding --- the fourth added 2026-09-05, and it is the one that changes what the work is: the first three are comprehension cost, while the fourth is live machinery with no remaining reason to run.

1. **Names inherited from call sites.** `executeMembershipTransfer` --- the general, six-caller entry point, used by character membership --- lives inside a file named [`executeObjectMove.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/membership/executeObjectMove.ts). There are two directories named `membership/` with no principle separating them. `applyCharacterRoomMembership` no longer applies anything (the kernel absorbed persistence); its body is now character-route side effects wrapped around a transfer, and its types still carry an *"Ingress-facing stable API (S1-7)"* label with three internal callers.

2. **Divisions drawn by guard clauses.** `orchestrateCharacterDisconnect` exists, per its own doc comment, because `orchestrateCharacterNavigate` returns early on `!to`. `intentKind` appears as three overlapping subsets of one enum, each sized to whoever happens to reach it.

3. **Comments written as diffs rather than as state.** [`kernelStep.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) is 368 lines, over half comment, in a consistent register of *change*: "widened again", "widened twice", "previously gated on", "an earlier revision of this comment overstated it", "see git history for that version's own doc comment". A reader asking *what is a transfer step* reconstructs it from four amendments.

4. **Machinery retained past its justification.** **Carry closure is not weakly motivated --- it is inert**, and has been since 2026-08-22. `computeCarryClosure` is a BFS whose only absorption condition is `classifyInteractionUnderTransfer(...) === 'carry'`; that classifier is a closed switch in which `Under`/`Against`/`Custom` return `defer`/`dissolve` and `On`/`In`/`PartOf`/`Present` throw. **Nothing returns `carry`**, so the closure is always exactly `{startId}` with no internal edges. The codebase already says so in four retired tests (*"`carry` is unreachable from any relation kind"*, `selectMembershipFromPool.test.ts:124` and siblings). Everything above it is currently a distinction with no difference --- see MS-8.

**The falsifiable half of (3):** `PB-J` (12 occurrences), `PB-M` (11) and `LP4h` (12) are plan-ID markers whose defining plans have been deleted --- they have **no referent anywhere in `taskPlanning/`**. That is ~35 comment references pointing at nothing, and it is the dangling-marker anti-pattern [`taskPlanning/AGENT.md`](../../AGENT.md) already names.

**On (4), keep two things apart.** The *requirement* did not die; it moved into the representation. "Take the tray and the cup comes too" is still true, but AB-54 made it structural rather than computational --- the cup is a node of the tray's own shard, and the tray's host is what changes, so the carry happens by not happening. What is dead is closure-the-computation, not carry-the-behavior.

**This is not a correctness initiative.** The suite is green (49 suites / 514 tests) and no defect is alleged. The cost being paid is comprehension cost, at the exact layer that has absorbed the most change and will absorb more.

**Stored data is not a concern for (4)** (confirmed 2026-09-05): peer-level `On` edges could only have been persisted before 2026-08-22, and `CoyoteGame` clears all objects frequently enough that the instance is several cleanup cycles past any that existed. No migration step is owed.

## What already exists to build on

Read these before the first slice --- they are the substrate, and two of them are what the durable half of this work merges *into*:

1. [`positions/AGENT.concepts.md` --- Manipulation layering](../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) and **Abstract op and compiled step**, **Naming: `Kernel` alone names nothing**. The vocabulary is already largely right; the code has drifted from it. **Two of its claims are currently false in the code** --- see MS-2 and MS-7.
2. [`positions/manipulation/AGENT.implementation.md`](../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) --- kernel spec, compile layer, per-route ingress map, and the code map that this plan's renames invalidate.
3. [`positions/AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) --- the normative clauses (capture shape, narration binding, single-hosted restriction) that constrain every slice here.
4. The stack itself, in execution order: `index.ts` dispatch -> `buildCharacterMoveOp` / `buildObjectMoveOp` -> [`compilePositionKernelOp`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/compilePositionKernelOp.ts) -> [`commitStepSequence`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/commitStepSequence.ts) -> [`applyStepSequenceCore`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/applyStepSequenceCore.ts) -> `factsForStep` -> `presentStepSequence`.
5. **[`AGENT.abstractionLayers.planning.md`](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order), Channel D --- `CD2` / `CD2h` / `CD3` / `CD4`.** The design record for AB-54's `On` partition and everything that followed from it. **CD3 is the row this plan executes**, and its text was re-verified against the code on 2026-09-03: `InteractionUnderTransferOutcome` still reads `'dissolve' | 'carry' | 'defer'` and `computeCarryClosure` is still a BFS. Read `CD2`'s "Consequence, named rather than hidden: `carry` is now dead" paragraph before touching anything in Phase 1d --- it lists the test sweep already done, so the retired-with-a-comment tests are expected, not a gap.

**Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md) --- `npm run test`, not `npm test`, run from `lambda/ephemera`. There is no `taskPlanning/lambda/ephemera/AGENT.development.md`.

**Two hazards this plan will hit repeatedly, both already documented and both earned the hard way:**

- `*.integration.test.ts` files sit **outside** the tsconfig include and mock modules **by path**. `npx tsc --noEmit` cannot catch a break in them. This plan is mostly renames and deletions, which is precisely the change class that breaks them --- run the full jest suite after every one, and grep module **paths**, not only symbols.
- `ts-jest` caches type-check results per unchanged file. Per `AGENT.testing.md`, after any change that makes a shared field required (or removes one), run `npm run test -- --clearCache` once before believing a green suite. **The files that break are the ones you did not touch.**

Baseline (passes as of seeding: 49 suites, 514 tests; run from `lambda/ephemera`):

```bash
npm run test -- --watchAll=false dataSource/positions/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines `[X]` as each sub-step finishes. Nothing below is built yet, so all lines start `[ ]`.

**Phases 1--2 are subtraction and renaming with no behavior change, and are safe to run before the open decisions are fielded. Phase 3 is gated on them.** The ordering is deliberate: each phase removes noise that would otherwise have to be reasoned through in the next.

- [ ] **Phase 1. Subtract what is already known dead.** No design questions; each item is provable by grep or by exhaustion over a closed union.
  - [X] 1a. Delete `narratedInline` / `narrationHandledInline` end to end --- 11 files (the "8 files" estimate undercounted `commitStepSequence.ts`, `factsForStep.ts`, and `buildCharacterMovedFact.ts`), 2 exported types, one `PositionsPublishedPayload` field and its validator. Set by four call sites, written onto the `Character Moved` fact, and **read by nothing**; `handleConnectionsCharactersPresence.ts:40` already said so. Done 2026-09-06: full suite green (351 suites / 2849 tests), `tsc --noEmit` clean, grep for both names across `lambda/`/`packages/` returns nothing. No `AGENT.contract.md`/`AGENT.implementation.md` update was owed --- neither asserted the field as a rule, so there was nothing normative to correct.
  - [X] 1b. Collapse `syncMembershipAdjacency.ts` and `syncObjectMembershipAdjacency.ts` --- 66 lines each, identical apart from whether the parameter is called `characterId` or `objectId`. Gated on MS-1 for whether the survivor should exist at all. Done 2026-09-06: MS-1 resolved (a) --- kernel-routing didn't apply (both functions fix only the `positionAdjacency` reverse index for the case where the `ludicGraph` is already correct; the kernel's `transferMembership` step always asserts a graph mutation, so there's no step kind for "write the index only," and adding one would be new kernel design, not a subtraction). `syncObjectMembershipAdjacency.ts` deleted; `syncMembershipAdjacency.ts` widened to `componentId: EphemeraCharacterId | EphemeraObjectId` (the name the codebase already uses for this union). Both repair sweeps repointed; both test files merged; three durable-doc code-map/reference rows repointed (`AGENT.contract.md:276`, `manipulation/AGENT.implementation.md:286`, and one duplicate row deleted from `positions/AGENT.implementation.md`). Full suite green (350 suites / 2847 tests, 1 pre-existing skip), `tsc --noEmit` clean.
  - [X] 1c. Marker and expired-promise sweep. Done 2026-09-06: scope was bigger than the headline `PB-J`/`PB-M`/`LP4h` counts --- every `PB-<letter>` variant in the code (`2,3,6,7,8,9,A,D,E,F,G,I,J,L,M`) was dangling the same way, since 1c's own recommended-order line said "the dangling `PB-*` / `LP4h` references" (a wildcard); only `PB-K` still has a referent (`AGENT.abstractionLayers.discussion.planning.md`) and was left alone. 24 files, ~50 occurrences, all resolved via MS-4 option (c) (delete the marker, prose was already self-contained in every case). Two carve-outs: `computeCarryClosure`'s own body/doc-comment in `interactionUnderTransfer.ts` was left untouched (1d deletes the whole function next slice, so editing its markers now would be pure churn); `ludicGraph/AGENT.md`'s one `LP4h` mention was left as durable-doc historical narration. The expired-promise half was dropped: `executorTypes.ts:16-22`'s claim that `parsePlanStep.ts` "only loses [`hostRoomId`] at the Migrate slice" has shipped is false --- `EstablishRelationStep`/`DissolveRelationStep` still carry `hostRoomId`, still actively read/constructed by the live relational route (`filterLegalRelationalCandidates.ts`, `executor.ts`, `groundChange.ts`, `compileRelationalFromSkeleton.ts`); the comment is accurate as written and was left alone. Full suite green (350 suites / 2847 tests, 1 pre-existing skip), `tsc --noEmit` clean.
  - [X] 1d. **Execute [CD3](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order)'s two deletions.** `carry` leaves `InteractionUnderTransferOutcome` (shrinking it to `'dissolve' | 'defer'`), and `computeCarryClosure` stops being a BFS. Belongs in Phase 1 because both are provably-dead subtraction --- unreachability is a proof by exhaustion over a closed union, not a judgment call. **What replaces the BFS is CD3's question, not this plan's**; if CD3's answer is not yet settled when this slice comes up, take the narrowest step that preserves today's observable behavior (a singleton) and leave the replacement to CD3. The downstream consequences are MS-8's and belong in Phase 2a, not here. Done 2026-09-06: CD3's answer was not yet settled, so the narrowest step shipped --- `computeCarryClosure` is now a single pass over `startId`'s own edges (no queue, no absorption set), still calling `classifyInteractionUnderTransfer` per touching edge purely to preserve the AB-54 hosting-kind-throw invariant (`interactionUnderTransfer.test.ts:123-134` requires it), always returning a singleton graph. Two now-dead downstream `'carry'`-outcome defensive checks were removed (`applyTransferSet.ts:44-47`, `executor.ts:276-282`, both already stranded of live tests as of the 2026-08-22 retirement sweep). `AGENT.contract.md:114`'s BFS-mechanism sentence was corrected to match (Phase-1b precedent: fix contract/implementation text immediately when the code it describes changes, don't defer to Phase 5). `PositionKernelMovedSet`, `carriedCount`, and `executeObjectMove`/`executeMembershipTransfer` were left untouched --- MS-8's, gated on this slice, Phase 2a's job. CD3's own checkbox in `AGENT.abstractionLayers.planning.md` stays open; recording the outcome there is Phase 5a. Full suite green (350 suites / 2847 tests, 1 pre-existing skip), `tsc --noEmit` clean.
- [ ] **Phase 2. Name things for what they are.** Pure moves and renames; the payoff test is that a reader can find the character membership path without knowing the object routes' history.
  - [ ] 2a. **Resolve `executeObjectMove` vs. `executeMembershipTransfer` per MS-8 --- one function or two.** *Reworked 2026-09-05: this was "split `executeObjectMove.ts` into two modules." That framing assumed the two functions were distinct, and the stated reason they are distinct is carry closure, which 1d retires.* Ask the merge question first; a split is what happens only if the answer is that they stay two. Whichever way it goes, the surviving module(s) must not be named for one caller's verb.
  - [ ] 2b. Resolve the two `membership/` directories per MS-3.
  - [ ] 2c. Rename `applyCharacterRoomMembership` for what it now does, and drop the stale "stable API" label from `membership/types.ts`.
  - [ ] 2d. Reconcile the three `intentKind` subsets into one declared vocabulary.
- [ ] **Phase 3. Repair the divisions of responsibility.** Behavior-adjacent; each item is gated on its decision row.
  - [ ] 3a. Single owner for step shape (MS-2) --- retire `executeMembershipTransfer`'s hand-built default branch so every route reaches the kernel through the compiler.
  - [ ] 3b. One diff vocabulary (MS-5) --- remove the host/room narrow-and-rewiden that exists only to reconcile `MembershipDiff` with the host-general shape.
  - [ ] 3c. Converge the `orchestrate*` trio (MS-6), if MS-6 says they should converge.
- [ ] **Phase 4. Comment register.** Rewrite the stack's doc comments to describe present state rather than the path to it, per the standard MS-7 settles. Archaeology (retired predecessor filenames, superseded-design rationale) either graduates to a durable doc or goes; git retains it either way.
- [ ] **Phase 5. Durable docs, and retire this plan.** Correct `manipulation/AGENT.implementation.md`'s code map (every Phase 2 rename invalidates it), reconcile `AGENT.concepts.md`'s claims with what the code then actually does, add any earned rules to `AGENT.contract.md`, then delete this file.
  - [ ] 5a. **Record CD3's outcome in [`AGENT.abstractionLayers.planning.md`](dataSource/positions/AGENT.abstractionLayers.planning.md#recommended-order)** --- what shipped, what replaced the BFS (if anything), and what MS-8 decided --- then close its checkbox there. **This is the step that keeps CD3's design ownership real rather than nominal**, and it is the one most likely to be skipped, because by then the code will be merged and the row will look like paperwork. It is not: CD3 is cited by Channel D's own summary row and by the presence plan's PR-4, and a closed-in-code-but-open-in-plan row is exactly the drift this initiative exists to stop reproducing. **Budget real time**: the sibling `relationalNarration` plan records that a predecessor's durable docs were not merely missing new rules but actively stale, and the corrections were larger than the additions.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement upcoming slices. When one ships, record it in `positions/AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

IDs are `MS-*` and are not reused. **MS-9 onward is deliberately unallocated** --- this plan expects to broaden, and new concerns should land as fresh rows here rather than being folded into existing ones. MS-8 was the first such arrival (2026-09-05) and is the worked example: it came in as a question about whether an existing body of functionality still had a reason to exist, and it reshaped a slice rather than adding one.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| MS-2 | **Should the compiler be the only producer of step shape?** [`AGENT.concepts.md`](../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) states plans are "compiled from abstract operations, never hand-built per call site" --- but `executeObjectMove.ts:311-319` hand-builds a `transferMembership` literal whenever `compileMutationSteps` is absent, which is every object-lifecycle route. Either the code moves to the claim or the claim is wrong and should be narrowed. Resolving this is what makes MS-5 tractable. | 3a | Open |
| MS-3 | **What is the right directory shape?** Today `positions/membership/` and `positions/manipulation/membership/` split by nothing stateable, cross-import both ways, and put `buildObjectMoveOp` in one while `executeObjectMove` sits in the other. Options: merge into one; or keep two with a **stated** boundary that the file placement then has to obey. Resolved 2026-09-06: consolidate everything into `positions/manipulation/membership/` --- the standalone `positions/membership/` directory goes away, its contents move into the `manipulation/` tree, no stated-boundary option was taken. | 2b | Resolved 2026-09-06 |
| MS-4 | **Should live markers (`BD-*`, `RD-*`, `LP4a`) get the same delete-in-place treatment as dangling ones?** Resolved 2026-09-06 for the dangling half: every occurrence of every dangling `PB-*` letter and `LP4h` had its rule already stated in self-contained prose, so option (c) (delete the marker, keep the prose) applied uniformly --- no case needed (a) inline-the-rule or (b) link-to-contract. Resolved 2026-09-06 for the live half: no, live markers do **not** get swept now. They stay in place as references and are retired individually, one at a time, when the plan each one points to completes --- the same lifecycle every other live marker in the codebase already follows. No batch sweep is owed in Phase 4. | 4 | Resolved 2026-09-06 |
| MS-5 | **Does `MembershipDiff` stay room-typed?** It is `EphemeraRoomId`-shaped while the kernel below it is host-general, so `applyCharacterRoomMembership` narrows host->room and re-widens room->host in two places within thirty lines purely to reconcile them. Either the character route genuinely owes a room-only guarantee (in which case say where it is enforced) or the type should widen. Resolved 2026-09-06: the type widens --- `MembershipDiff` becomes host-general (matching the kernel it feeds), and the narrow-host->room / re-widen-room->host pair in `applyCharacterRoomMembership` is removed rather than justified. | 3b | Resolved 2026-09-06 |
| MS-6 | **Do `orchestrateCharacterNavigate` / `orchestrateCharacterDisconnect` / `orchestrateObjectMove` converge?** All three are build-op -> compile -> declare bundle -> present; the only real difference is navigate's header slot. The disconnect/navigate split is admittedly a guard clause. Counter-argument on the record: the sibling `buildObjectMoveOp` doc comment argues that merging two disjoint bodies under one name is worse than two siblings --- **that argument may apply here too**, and this row should test it rather than assume convergence is the goal. Resolved 2026-09-06: yes, converge. All three become one `orchestrateComponentMove`, which checks whether the component being moved is a Character and generates the header (navigate's slot) only in that case --- the `buildObjectMoveOp` counter-argument was weighed and doesn't reach here, since the header check is one conditional inside a shared body, not two disjoint bodies forced under a shared name. | 3c | Resolved 2026-09-06 |
| MS-7 | **What does a doc comment in this stack owe?** Needed as a *standard* before Phase 4, or the rewrite is taste. Candidate: a comment states present behavior and the constraint that forces it; supersession history, retired predecessor filenames, and "widened again" narration go to git or to a durable doc. Open sub-question: `kernelStep.ts`'s long comments contain real, load-bearing design reasoning (the expression-problem escalation trigger, the Immer provenance rule) that should **not** be lost --- so this row is partly "which durable doc receives it," not only "what gets cut." | 4 | Open |
| MS-8 | **Are `executeObjectMove` and `executeMembershipTransfer` one function?** The latter is documented as *"the no-carry-closure sibling of `executeObjectMove`"* --- **carry closure is the stated reason they are two**, and 1d retires it. Four things collapse with it, and this row must decide each: (i) `executeObjectMove` runs the whole Synthesize executor (`createExpansionEnvironment`, `runExecutor`, `settledGroups`, `groupIdByObject`) to re-derive a set that can only be `{primaryObjectId}` --- the largest single body of machinery in the object-move path; (ii) `PositionKernelMovedSet`'s `closure`/`entity` union, and the "primacy is `fragment.rootId`, never derived from edges" argument protecting an invariant nothing can violate; (iii) `carriedCount`, always 1, so the "and everything on it" copy is unreachable; (iv) `ExecuteObjectMoveArgs.objectIds`, a list whose re-derivation always returns one element. **Not a re-run of CD3** --- this row takes CD3's verdict as input and asks only what the call surface becomes. **Ordering:** it is gated on CD3 answering whether a shard read replaces the BFS, since a surviving read may be exactly what still distinguishes the two paths. **Counter-argument on the record, same as MS-6's:** `boundaryEdgeOutcomes` stays live for the peer kinds and is genuinely object-only, so "no carry closure" may not have been the only difference --- check before merging. | 2a | Open |

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false dataSource/positions/

# Full suite before marking a phase done --- integration tests are NOT covered by tsc,
# and this plan is mostly renames and deletions, which is what breaks them.
npm run test -- --watchAll=false

npx tsc --noEmit
```

After any slice that removes or requires a shared field (1a especially), once:

```bash
npm run test -- --clearCache
```

Grep checks, from the repo root:

```bash
# Phase 1a: narratedInline should be gone in its entirety, not half-deleted.
grep -rn "narratedInline\|narrationHandledInline" --include="*.ts" lambda/ packages/ | grep -v node_modules

# Phase 1c / MS-4: no plan-ID marker in code should lack a referent in taskPlanning/.
# For each marker the first command reports, the second must return a file.
grep -rhoE "\b(PB-[A-Z0-9]|LP4[a-z]|RD-[0-9]+|BD-[0-9]+[a-z]?)\b" \
  --include="*.ts" lambda/ephemera/dataSource/positions | sort -u
grep -rl "<marker>" taskPlanning/

# Phase 1d / CD3: `carry` should be gone from the outcome union and from every consumer.
# `classifyInteractionUnderTransfer` and `boundaryEdgeOutcomes` both STAY --- they serve the
# peer kinds. It is the `carry` branch and the BFS that go, not the module.
grep -rn "'carry'\|computeCarryClosure\|CarryClosure\|carriedCount" --include="*.ts" \
  lambda/ephemera | grep -v node_modules

# Phase 2a / MS-8: the object-move path should no longer run the Synthesize executor to
# re-derive a set that can only be a singleton. Expect these to survive only in the
# relational/tie routes, which genuinely need Expansion.
grep -rn "runExecutor\|createExpansionEnvironment\|settledGroups\|groupIdByObject" \
  --include="*.ts" lambda/ephemera | grep -v node_modules | grep -v "\.test\.ts"

# Phase 2a: character membership must not import from a module named for object moves.
grep -rn "membership/executeObjectMove" --include="*.ts" lambda/ephemera | grep -v node_modules

# Phase 3a / MS-2: transferMembership steps are constructed only inside the compiler.
# Any hit outside it is a call site hand-rolling its own plan.
grep -rn "kind: 'transferMembership'" --include="*.ts" lambda/ephemera \
  | grep -v node_modules | grep -v "\.test\.ts" \
  | grep -v "manipulation/kernel/compile/"

# Standing invariant from manipulation/AGENT.implementation.md --- must stay empty.
grep -rn "getMembershipContainers" lambda/ephemera/dataSource/positions/manipulation/kernel/
```

**Anchor pass:** every rename in Phase 2 invalidates paths in `manipulation/AGENT.implementation.md`'s code map and in this file. Cross-file markdown anchors fail **silently** --- re-resolve them as an explicit step in Phase 5, and prefer copying an existing link to deriving a slug.

## Progress

| Phase | Status |
| --- | --- |
| 1. Subtract known-dead | 1a/1b/1c/1d done (2026-09-06). Phase 1 complete |
| 2. Name for what they are | Not started (2a gated on MS-8, now unblocked --- CD3 shipped as a singleton) |
| 3. Repair responsibilities | Not started (gated on MS-1/2/3/5/6) |
| 4. Comment register | Not started (gated on MS-7) |
| 5. Durable docs and disposal | Not started |
