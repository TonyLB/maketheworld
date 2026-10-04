# Intent-centric Plan: Plan emits ungrounded attempts, not a family

**Status:** Planned 2026-10-04, not started. Next: slice 0 (characterization fixture), then decide PI-1 and PI-8 before slice 1.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md). Ladder position: [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md), iteration 11.

## Why

The pipeline after Plan already works on intents. A `CommandAttempt` is a list of actions keyed by outcome class. The shared stage expands, adjudicates and selects without caring which route produced the candidate. [`commitAttempt`](../../../../../lambda/ephemera/dataSource/positions/manipulation/commitAttempt.ts) handles each action by its `desiredResult.primitive`, and there is one hand-off event per attempt.

Plan is the one stage still built around families. [`classifySkeletonFamily`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/classifySkeletonFamily.ts) returns a closed union (`membership | relational | relationalDefer | look | none`). [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) sends each arm to its own producer. Each producer builds the plan step itself, then repeats the shared work. Plan therefore produces a family tag, not the ungrounded attempt that [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md)'s `CommandAttempt` section says it emits.

Evidence in today's code:

- **`relationalDefer` is the family list leaking.** On "put X on Y", `matchRelationalTemplate` already knows the intent (a `transferMembership` with `containment: 'On'`), but its output type belongs to the relational family. So it returns `nestingDefer`, and `parseCommand` reroutes it.
- **Containment skips boundary-edge Expansion because of how commands are routed.** "Connected to nothing outside itself" is a precondition of whole-object transfer, and containment is a `transferMembership`. But [`compileObjectContainmentFromSkeleton.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileObjectContainmentFromSkeleton.ts) expands nothing, so `commitAttempt` refuses to put a lashed rope on the table, even though the same rope can be taken.
- **Plan runs twice.** `classifySkeletonFamily` matches the skeleton, then `compileRelationalFromSkeleton` and `compileDescribeFromSkeleton` match it again.
- **Four producers repeat the same work.** Each does its own catalog merge, Identify, keyed pools, `enumerateIdentityAssignments`, self-relation filter, attempt referents, Consult wording and result mapping. `keyedPool` exists twice, nearly verbatim.
- **The LLM fallback is typed as a family picker.** `PlanOnlyFallbackCandidate.plan` is `RelationalPlanStub | MembershipPlanStub` ([`fallback/planOnlyFallback.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/fallback/planOnlyFallback.ts)). An LLM given the attempt vocabulary can compose an answer; an LLM given families can only pick one. This plan exists mainly to get the type right before iteration 2 builds the plan-only and joint prompts.

## Target shape

```text
Parse -> Plan: skeleton -> set of ungrounded attempts (templates today; an LLM fallback later, same type)
      || Identify: one candidate pool per stableRefKey named in any attempt's steps
   -> one generic producer: attempts x joint identity assignments -> grounded attempts (+ prose referents)
   -> shared stage: expand (keyed on primitive) -> adjudicate -> dry run (one executor seed) -> select
   -> one attempt-carrying result -> one exit (bus hand-off, or in-process for narration)
```

Plan still never reads world state. Only its output type changes.

## Scope

**In:** the four object-manipulation routes (membership, relational, containment, describe), including the deterministic take/drop/get fast path; the BD-19 fallback stubs' output type.

**Out (each named so it isn't mistaken for a gap):**

- **Non-object families.** Help, Home, LookRoom, Navigation and AcmeOrder still go through `DeterministicTemplate` -> `ParseCommandResult`. Navigation is arguably a `transferMembership` of `actingCharacter`, but nothing in this plan needs it.
- **Multi-action intents from the player's words** (corpus row 6, "take the entire coil of rope"). The type will admit them, but no template emits one.
- **The LLM plan fallback itself, and confidence calibration across plans.** Those are iteration 2 (BD-19 (3)), [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md).
- **`Assertion` emission** (iteration 6). Templates that emit attempts can carry `Assertion` steps later; this plan adds none.

## Getting Started

1. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (Pipeline shape, Plan steps and referents, `CommandAttempt`) and [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md). Grounding stays total, and the producer keeps owning the joint candidate space.
2. Read [`actions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md), sections "Object-manipulation pipeline: route wiring" and "Shared selection stage". These map the stage to its module, which is what this plan collapses.
3. Read the four producers side by side: `compileMembershipAtomic.ts` with `proposeMembershipCandidates.ts`, `compileRelationalFromSkeleton.ts`, `compileObjectContainmentFromSkeleton.ts` and `compileDescribeFromSkeleton.ts`. Then read `selectPlanCandidate.ts`'s `sandboxMembershipDryRun` next to `compileRelationalFromSkeleton.ts`'s `relationalDryRun`. Both dry runs ground the attempt, seed the executor with every grounded step and run it; that overlap is the basis of PI-3.
4. **Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file. Jest, run from `lambda/ephemera` with `npm run test -- --watchAll=false <paths>` (not `npm test`). `npx tsc --noEmit` alone is not enough, because `*.integration.test.ts` sits outside `tsconfig`.
5. **Baseline (passed 2026-10-04: 1283 passed, 2 skipped):**

   ```bash
   cd lambda/ephemera && npm run test -- --watchAll=false dataSource/actions/ dataSource/positions/manipulation/
   ```

## Progress

| Slice | What | Behaviour change | Status |
| --- | --- | --- | --- |
| 0 | Characterization fixture at the published attempt | None | Not started |
| 1 | Plan emits ungrounded attempts; `classifySkeletonFamily` retired | None | Not started |
| 2 | One generic producer for the skeleton routes (relational, containment, describe) | None | Not started |
| 3 | Membership joins; Expansion keyed on primitive | **Yes:** containment gains boundary expansion | Not started |
| 4 | One attempt-carrying result, one exit | None | Not started |
| 5 | Fallback stubs retyped, docs graduated, plan deleted | None | Not started |

## Recommended order

Pending work is `[ ]`, completed is `[X]`. Mark each nested line `[X]` as it is done, as well as its parent.

- [ ] **Slice 0: characterization fixture.** One table-driven test through `parseCommand`, asserting each command's result `type` and its published `CommandAttemptData` (actions in order, each action's `desiredResult` and description, referents). It stays green, unchanged, through slices 1, 2 and 4. Slice 3 changes exactly the containment-with-boundary-edge rows, on purpose.
   - [ ] Rows: `take X` / `get X` / `drop X` (fast path and Parse path); `take X` when X is lashed (`Custom` edge: dissolve plus take); `put X against Y`; `tie X to Y` (`Custom`); `take X off Y` (dissolve); `put X on Y` / `put X in Y` (containment); `put X partof Y` (still an Error); `look X`; a two-candidate span that reaches Consult on each route.
   - [ ] Check [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts) first, and extend it rather than adding a parallel file if it already drives these commands.
- [ ] **Slice 1: Plan emits ungrounded attempts.** Behaviour-preserving.
   - [ ] Settle PI-1 (the ungrounded attempt's shape) and PI-8 (union versus first match).
   - [ ] `matchRelationalTemplate`, `matchLookTemplate` and a new membership template (`take`/`get`/`drop`, lifted from `classifySkeletonFamily`'s leading-verb arm and `planMembershipDesiredResult`) each return ungrounded attempts. The relational template emits the containment `transferMembership` itself for `On`/`In`. `nestingDefer` and `relationalDefer` are retired. `PartOf` becomes the template's typed decline, and `nestingRelational` stays the player-facing Error.
   - [ ] `planSkeleton(skeleton)` replaces `classifySkeletonFamily`. In this slice `parseCommand` still routes to the existing producers, choosing one by the attempt's primary action (primitive or outcome class) instead of by a family tag, and passes Plan's attempt in, so no producer matches the skeleton again.
   - [ ] Slice 0 fixture green and unchanged; plan tests moved from `classifySkeletonFamily.test.ts` to the templates.
- [ ] **Slice 2: one generic producer for the skeleton routes.** Behaviour-preserving.
   - [ ] Settle PI-2 (descriptions and Consult wording) and PI-3 (dry run).
   - [ ] One producer: gather the span referents across the attempts' steps (`stepReferents`, keyed by `stableRefKey`), run Identify once, call `enumerateIdentityAssignments`, drop self-relations for each `Change` with two span referents, build prose referents, ground, and hand off to the shared stage. It replaces `proposeRelationalCandidates`, `proposeContainmentCandidates` and `proposeDescribeCandidates`, and both copies of `keyedPool`.
   - [ ] The dry run follows PI-3. Relational's hosting-kind chain check and its ancestry prefetch become environment construction, not route code.
   - [ ] Containment still expands no boundary edges in this slice, so the fixture stays unchanged.
- [ ] **Slice 3: membership joins; Expansion keyed on primitive.** The one slice that changes behaviour.
   - [ ] Settle PI-5 (complexity LLM) and PI-7 (the fast path's skeleton).
   - [ ] The deterministic `take`/`get`/`drop` fast path enters Plan with a synthesized skeleton, so `verbClass` and the synthetic `primaryObject` ref key stop being pipeline inputs after Plan.
   - [ ] Boundary-edge Expansion (`attemptActionsFromBoundaryOutcomes`) runs for every `transferMembership` action, whichever template produced it, reading the source graph from the candidate's locus. Membership's locus gate (`validateMembershipPlanDryRun`) and multi-presence gate (`evaluateComplexityPreGates`) become checks on `transferMembership`, not on a route.
   - [ ] `compileMembershipAtomic`'s complexity-LLM fallback becomes the PI-5 defer handler. It still re-grounds via the shared stage when the LLM changes the operation.
   - [ ] **Payoff test, at the observable output.** "put rope on table" with the rope lashed to a post: the published attempt holds a met `Custom` dissolve before the containment transfer. There is no real cross-Lambda harness, so the test uses a real-serializer round trip (`toJSON` -> `fromJSON`) into the real `commitAttempt`, with only leaf dependencies mocked. It shows the lashing dissolved and the rope on the table's shard. Today the same command is refused at commit.
   - [ ] Update the slice 0 rows this changes, and no others.
- [ ] **Slice 4: one result, one exit.** Behaviour-preserving.
   - [ ] Settle PI-6.
   - [ ] `ParseCommandObjectManipulationResult`, `ParseCommandEstablishRelationResult` and `ParseCommandObjectContainmentResult` collapse into one attempt-carrying result (`attempt` required). `index.ts`'s three branches into `publishLudicNetworkChangeRequested` become one. The relational `steps` field, read today only for the not-in-a-room guard, is retired with it.
   - [ ] Describe's in-process exit (the [normative `dataSourceKey` note](../../../../../lambda/ephemera/dataSource/actions/AGENT.md#look-ingress)) is chosen by the attempt's content (narration actions only), not by a separate result type.
- [ ] **Slice 5: fallback stubs, docs, deletion.**
   - [ ] Retype `PlanOnlyFallbackCandidate.plan` and the joint fallback's plan to the ungrounded attempt. Retire `RelationalPlanStub` and `MembershipPlanStub` (`identityPlanCandidate.ts`) if nothing else reads them. Update iteration 2's plan where it names their output.
   - [ ] `actions/AGENT.concepts.md`: rewrite the Plan row of "Three conceptual jobs" and the fast-path table's Plan row, from "instruction-primitive family" to "a set of ungrounded attempts". This is a real vocabulary change; check the file's own "Maintaining this file" rule.
   - [ ] `actions/AGENT.implementation.md`: route wiring becomes one producer, and the pipeline-sequence block and classify-ownership table lose their family arms. `actions/AGENT.contract.md`: add a rule only if a slice produced one (candidate: "Plan's output type is the ungrounded attempt; a fallback must emit the same type").
   - [ ] Graduation sweep: grep `classifySkeletonFamily`, `relationalDefer`, `nestingDefer` and the retired producer names across `lambda/` and `taskPlanning/`; grep `](` for links into deleted files; resolve any `PI-n` markers left in code. Then delete this plan and mark its ladder row.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PI-1 | **The ungrounded attempt's shape.** `CommandAttemptReferent.id` is required, so a `CommandAttempt` cannot exist before grounding today. Options: (a) Plan emits a `CommandAttempt` with an empty referents list, and grounding fills it in; (b) `CommandAttemptReferent.id` becomes optional, in the spirit of `groundedId?`; (c) a separate plan-side type. **Lean (a):** the steps' `objectSpan` referents already carry everything Plan knows, and the prose referents are catalog data Plan cannot have. This matches the concepts doc's "no separate ungrounded-attempt type". | 1 | Open |
| PI-8 | **How templates combine.** First match (today's relational > look > membership order) versus the union of every template's attempts. **Lean: union.** The templates are disjoint today (by token count and verb), so the result is the same now, and a union is what lets an ambiguous verb offer sibling attempts later. | 1 | Open |
| PI-2 | **Where action descriptions and Consult wording come from** once one producer builds every attempt. Today each producer writes its own strings ("Put X on Y", "Establish relation: X / Y", Consult's "put the X on the Y"). **Lean:** one describer per primitive or outcome class, taking the grounded step and the prose referents, used both for `describe()` and for `toConsultAlternative`. Keep today's strings exactly so slice 0 stays unchanged. | 2 | Open |
| PI-3 | **One dry run, or one per primitive.** `sandboxMembershipDryRun` and `relationalDryRun` both ground the attempt, seed `runExecutor` with every grounded step and run it; they differ in environment construction and a few gates. **Lean:** one dry run over an environment built once per command (the graphs for the candidates' loci plus relational's ancestry prefetch), with the remaining gates keyed on primitive. Confirm in slice 2 that nothing in `relationalDryRun` depends on its narrower environment. | 2 | Open |
| PI-5 | **Complexity-LLM handoff.** Today it is membership's alone (exit-edge or `Under` defer), its prompt is take/drop-specific, and it can change the operation. **Lean:** the shared stage takes an optional defer handler for each primitive. The complexity LLM registers for non-containment `transferMembership`, and containment's `defer` still abstains (today's behaviour, since it has no handler). A changed operation is re-planned as a sibling attempt through the same stage. | 3 | Open |
| PI-7 | **The fast path's skeleton.** The deterministic `take`/`get`/`drop` check (`deterministicChecks.ts`) emits `rawObjectSpans` with no skeleton. **Lean:** synthesize `[text(verb), objectSpan(span)]` and stamp it with `stampStableRefKeys`, the way `DeterministicTemplate`'s `matched` arm already pairs a skeleton with an intent. It then enters `planSkeleton` like any parsed skeleton, and `primaryObject` disappears. | 3 | Open |
| PI-6 | **Name and fields of the single result.** It must carry what `index.ts` reads today (the attempt, confidence, and whatever the not-in-a-room guards need). Each per-route field (`operationKind`, `subjectId`, `containment`, `steps`) is checked for a reader; one with no reader is dropped, not carried forward. | 4 | Open |

## Coordination

- **Iteration 2 (BD-19), the active rung.** Its plan-only and joint fallbacks emit Plan's output type, so this plan should land before their prompts are designed (steps 4-5 of BD-19's build sequence); otherwise the prompts are written against family stubs that slice 5 retires. The identity-only fallback is unaffected: it resolves identities against a fixed plan.
- **CPG-6** (relational `DeterministicTemplate` wiring, [`AGENT.classifyPlanGeneralization.planning.md`](AGENT.classifyPlanGeneralization.planning.md)) becomes simpler after slice 1, because a template's output is then the same type the producer consumes. Nothing here depends on it.
- **The commit side does not change.** `commitAttempt` already dispatches by primitive and threads `containment` through. Slice 3's payoff test is the check on that claim.

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false dataSource/actions/ dataSource/positions/manipulation/
npx tsc --noEmit
```

Before closing slices 3 and 4, which change shared required fields and result types, run `npm run test -- --clearCache` once and then the full suite (`npm run test -- --watchAll=false`). See [`AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md), "Two ways a suite lies about being green".

Greps that must come back empty by slice 5 (verify each grep actually ran):

```bash
grep -rn "classifySkeletonFamily\|relationalDefer\|nestingDefer\|proposeContainmentCandidates\|proposeDescribeCandidates" lambda/ephemera taskPlanning
```
