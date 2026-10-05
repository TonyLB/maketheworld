# Intent-centric Plan: Plan emits ungrounded attempts, not a family

**Status:** Slice 0 done 2026-10-05 (characterization fixture, 21 rows green). Next: slice 1. Every decision row is decided.

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
   -> Enumerate: each attempt x each joint identity assignment (one id per stableRefKey) = the candidates
   -> Grounding: stamp each candidate's ids, short names and glosses onto its steps' referents
   -> shared stage: expand (satisfy each desired result's preconditions) -> adjudicate -> dry run (one executor seed) -> select
   -> one attempt-carrying result -> one exit (bus hand-off, or in-process for narration)
```

Plan still never reads world state. Only its output type changes.

**Terms.** This plan uses `actions/AGENT.concepts.md`'s attempt vocabulary: an action's **desired result** and its kind (a position step, or narration); a desired result's **preconditions**; the **challenges** a facilitating action carries; and a candidate's **defer reason**. `primitive` appears only as the name of the `Change.primitive` field. Dispatch in this plan is keyed on one of those four things, never on a route.

## Scope

**In:** the four object-manipulation routes (membership, relational, containment, describe), including the deterministic take/drop/get fast path; the BD-19 fallback stubs' output type.

**Out (each named so it isn't mistaken for a gap):**

- **Non-object families.** Help, Home, LookRoom, Navigation and AcmeOrder still go through `DeterministicTemplate` -> `ParseCommandResult`. Navigation is arguably a `transferMembership` of `actingCharacter`, but nothing in this plan needs it.
- **Multi-action intents from the player's words** (corpus row 6, "take the entire coil of rope"). The type will admit them, but no template emits one.
- **The LLM plan fallback itself, and confidence calibration across plans.** Those are iteration 2 (BD-19 (3)), [`AGENT.manipulationFrameAndRelational.planning.md`](AGENT.manipulationFrameAndRelational.planning.md).
- **The relational-complexity LLM adjudicator.** Slice 3 builds the deferred adjudication tier it plugs into, with a naive implementation that judges nothing; the LLM itself is ladder layer 1's unowned remainder.
- **`Assertion` emission** (iteration 6). Templates that emit attempts can carry `Assertion` steps later; this plan adds none.

## Getting Started

1. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (Pipeline shape, Plan steps and referents, `CommandAttempt`) and [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md). Grounding stays total substitution. The joint candidate space moves from each producer to one shared **Enumerate** step, which runs before Grounding. Today the concepts doc's Grounding bullet assigns that space to "the producer", and slice 5 updates it. "Producer" stays the word for a route's whole pipeline, never for Enumerate.
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
| 0 | Characterization fixture at the published attempt | None | Done 2026-10-05 |
| 1 | Plan emits ungrounded attempts; `classifySkeletonFamily` retired | None | Not started |
| 2 | One generic producer for the skeleton routes (relational, containment, describe) | None | Not started |
| 3 | Membership joins; membership's gates become preconditions of transfer | **Yes:** containment gains boundary expansion; takes/drops with a pending `Under` or exit-edge challenge abstain | Not started |
| 4 | One `ParseCommandResult` arm for every command attempt, one exit | Not-in-a-room message only (PI-6) | Not started |
| 5 | Fallback stubs retyped, docs graduated, plan deleted | None | Not started |

## Recommended order

Pending work is `[ ]`, completed is `[X]`. Mark each nested line `[X]` as it is done, as well as its parent.

- [X] **Slice 0: characterization fixture.** One table-driven test through `parseCommand`, asserting each command's result `type` and its published `CommandAttemptData` (actions in order, each action's `desiredResult` and description, referents). It stays green, unchanged, through slices 1 and 2. Slice 3 changes exactly the containment-with-boundary-edge rows and the two complexity-LLM take rows, and slice 4 the not-in-a-room rows, on purpose.
   - [X] Rows: `take X` / `get X` / `drop X` (fast path and Parse path); `take X` when X is lashed (`Custom` edge: dissolve plus take); `take X` when X touches an exit, and when X is under something (`Under` subject-move), both reaching the complexity LLM today, with its invocation stubbed; `put X against Y`; `tie X to Y` (`Custom`); `take X off Y` (dissolve); `put X on Y` / `put X in Y` (containment), including one whose X sits inside another object (a `withinObject` locus; see PI-3); `put X partof Y` (still an Error); `look X`; a two-candidate span that reaches Consult on each route; and a take, a relational command and a containment command issued with no room (the not-in-a-room check PI-6 unifies).
   - [X] Check [`parseCommand.test.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.test.ts) first, and extend it rather than adding a parallel file if it already drives these commands.
   - [X] Pinned 2026-10-05 as a `describe('characterization fixture: published attempt (ISS8203 slice 0)')` block of 21 rows, each snapshotting the whole `parseCommand` result and the LLM stub call counts (file snapshots in `__snapshots__/parseCommand.test.ts.snap`, since inline snapshots would not write here). Reading the captures against the rows above found three places where the row's description is not what the code does, so the snapshot pins the code, not the row: `take X off Y` is a two-candidate Consult, not a dissolve; `put X partof Y` is a Custom `EstablishRelation` labelled `partof`, not an Error (no player phrase maps to `PartOf`, see `relationKind.ts`); and `tie X to Y` labels its relation `to`. The complexity-LLM rows stub a `relationalPlacement` answer and pin today's `relational placement is not implemented yet` Error. Slice 3 changes that, not the stub. Both the Consult and the `partof` results depend on `embedSpan` being stubbed as unavailable, which the rows record in their call counts.
- [ ] **Slice 1: Plan emits ungrounded attempts.** Behaviour-preserving.
   - [ ] PI-1 and PI-8 are decided: span referents carry what grounding learns, and `planSkeleton` returns the union of every template's attempts.
   - [ ] Per PI-1: one shared stamp function writes each assignment's `groundedId`, `shortName` and `gloss` onto every span referent with that key, and every producer calls it. Containment and membership stop leaving their steps unstamped. `sandboxMembershipDryRun` reads ids from its own step rather than rebuilding them from `attempt.referents()`. `CommandAttempt` stops storing a referents list: `renderProse` and `toJSON` build it from the steps, so the published `CommandAttemptData` and the slice 0 fixture are unchanged. Correct `CommandAttemptReferent`'s doc comment, which claims nothing deterministic reads the list.
   - [ ] `matchRelationalTemplate`, `matchLookTemplate` and a new membership template (`take`/`get`/`drop`, lifted from `classifySkeletonFamily`'s leading-verb arm and `planMembershipDesiredResult`) each return ungrounded attempts. The relational template emits the containment `transferMembership` itself for `On`/`In`. `nestingDefer` and `relationalDefer` are retired. `PartOf` becomes the template's typed decline, and `nestingRelational` stays the player-facing Error.
   - [ ] `planSkeleton(skeleton)` replaces `classifySkeletonFamily`. In this slice `parseCommand` still routes to the existing producers, choosing one by the kind of the attempt's primary desired result (and, for a transfer, its `containment` flag) instead of by a family tag. This transitional dispatch is the last route-shaped code, and slices 2-3 remove it. `parseCommand` passes Plan's attempt into the producer, so no producer matches the skeleton again.
   - [ ] Slice 0 fixture green and unchanged; plan tests moved from `classifySkeletonFamily.test.ts` to the templates.
- [ ] **Slice 2: one generic producer for the skeleton routes.** Behaviour-preserving.
   - [ ] Confirm PI-3's check before building on it: nothing in `relationalDryRun` depends on its narrower environment. PI-2 and PI-3 are decided.
   - [ ] One producer, built from shared steps. Gather the span referents across the attempts' steps (`stepReferents`, keyed by `stableRefKey`), and run Identify once. Then **Enumerate**: `enumerateIdentityAssignments`, plus one rule that distinct span keys within one step get distinct ids. That rule replaces each route's self-relation filter and is the "bench on bench" case `stableRefKey` exists for. Ground with PI-1's stamp function, and hand off to the shared stage. It replaces `proposeRelationalCandidates`, `proposeContainmentCandidates` and `proposeDescribeCandidates`, and both copies of `keyedPool`.
   - [ ] The dry run follows PI-3. Relational's ancestry prefetch becomes environment construction, not route code.
   - [ ] Containment still expands no boundary edges in this slice, so the fixture stays unchanged.
- [ ] **Slice 3: membership joins; membership's gates become preconditions of transfer.** The one slice that changes behaviour.
   - [ ] PI-7 is decided: the fast path synthesizes and stamps a skeleton.
   - [ ] The deterministic `take`/`get`/`drop` fast path enters Plan with a synthesized skeleton, so `verbClass` and the synthetic `primaryObject` ref key stop being pipeline inputs after Plan.
   - [ ] **Expansion satisfies the transfer's isolation precondition wherever a transfer appears.** "The moved object is connected to nothing outside itself" is a precondition of every whole-object transfer. Its facilitating actions (`attemptActionsFromBoundaryOutcomes`) are added for every `transferMembership` desired result, whichever template produced it, using the source graph for the candidate's locus. That one change is what gives containment its boundary expansion.
   - [ ] **Membership's take/drop gates become transfer preconditions, stated over `from`/`to`** (PI-3). `validateMembershipPlanDryRun` checks today that the locus matches a take or drop (`membershipOperationKindFromLocus`), and its doc comment already reads that as "does the locus satisfy `from`". Stated directly, there are two: `from` resolves to the object's actual host (failing is `notCarryingObject`), and `from` differs from `to` (failing is `alreadyHoldingObject`). Both hold for a containment move by construction. `evaluateComplexityPreGates`' multi-presence check likewise becomes a check on any transfer's moved object, not on the membership route.
   - [ ] **Every doubt about a move is a challenge, so "defer" has one meaning: a challenge left pending.** Exit-edge contact becomes a challenge on the transfer that touches the exit, added by Expansion like a boundary edge's, instead of a defer reason computed by the dry run. The unmodeled-locus defer is already gone under PI-3's environment.
   - [ ] **Adjudication becomes one seam with two tiers that share a contract**: an attempt in, the same attempt with verdicts recorded out, each tier judging only the challenge kinds its policy claims (the adjudicator-policy precedent in `actions/AGENT.concepts.md`).
      - [ ] The **per-candidate tier** is today's `adjudicateAttempt`, synchronous and cheap. It runs on every candidate in the shared stage, whatever produced it; today only the membership route calls it. Its Coyote policy stays as is: `Custom` met, everything else left pending.
      - [ ] The **deferred tier** runs once, from Selection, on the top deferred candidate. It may be asynchronous and receives the room context the prose renderer takes. That candidate goes back through Validation with its new verdicts. Its naive implementation judges nothing, so the candidate abstains. The relational-complexity LLM adjudicator replaces it later without the shared stage changing (ladder layer 1's unowned remainder).
   - [ ] **Retire the complexity-LLM hop**: `compileMembershipAtomic`'s fallback, `finalizeComplexityFromEnrich`'s path and the complexity prompt. Its jobs don't carry over as a handler. The take/drop override is settled by the `from` precondition, unmodeled loci by PI-3's environment, and pending `Under` and exit-edge challenges by the deferred tier. **Interim behaviour change, accepted:** a take or drop with a pending `Under` or exit-edge challenge abstains until the LLM adjudicator lands, as relational and containment defers do today.
   - [ ] **Payoff test, at the observable output.** "put rope on table" with the rope lashed to a post: the published attempt holds a met `Custom` dissolve before the containment transfer. There is no real cross-Lambda harness, so the test uses a real-serializer round trip (`toJSON` -> `fromJSON`) into the real `commitAttempt`, with only leaf dependencies mocked. It shows the lashing dissolved and the rope on the table's shard. Today the same command is refused at commit.
   - [ ] Update the slice 0 rows this changes, and no others: the containment-with-boundary-edge rows, plus the exit-edge and `Under`-pending take rows (complexity-LLM answer, now abstain).
- [ ] **Slice 4: one result, one exit.** Behaviour-preserving apart from the not-in-a-room message (PI-6).
   - [ ] Per PI-6: `ParseCommandObjectManipulationResult`, `ParseCommandEstablishRelationResult` and `ParseCommandObjectContainmentResult` collapse into one `{ type: 'CommandAttempt', attempt, confidence }` arm, with `attempt` required. Describe returns the same arm instead of `LookComponent`, which stays for UI-triggered looks. `index.ts`'s three branches into `publishLudicNetworkChangeRequested` become one.
   - [ ] One not-in-a-room check for every attempt: `roomExitContext.fromRoomId`, with "You are not in a room, so you cannot do that." Update the slice 0 not-in-a-room rows, and no others.
   - [ ] Describe's in-process exit (the [normative `dataSourceKey` note](../../../../../lambda/ephemera/dataSource/actions/AGENT.md#look-ingress)) is chosen by the attempt's content (narration actions only), not by a separate result type.
- [ ] **Slice 5: fallback stubs, docs, deletion.**
   - [ ] Retype `PlanOnlyFallbackCandidate.plan` and the joint fallback's plan to the ungrounded attempt. Retire `RelationalPlanStub` and `MembershipPlanStub` (`identityPlanCandidate.ts`) if nothing else reads them. Update iteration 2's plan where it names their output.
   - [ ] `actions/AGENT.concepts.md`: rewrite the Plan row of "Three conceptual jobs" and the fast-path table's Plan row, from "instruction-primitive family" to "a set of ungrounded attempts". This is a real vocabulary change; check the file's own "Maintaining this file" rule.
   - [ ] `actions/AGENT.concepts.md` "Pipeline shape" and the Grounding bullet: the joint candidate space and the rule that one step's relation joins distinct objects move from "the producer" to Enumerate, named as a step before Grounding. "Producer" keeps its meaning as a route's pipeline. `CommandAttempt`'s referents become a section rendered from the steps, not a stored field.
   - [ ] `actions/AGENT.concepts.md` Pipeline shape, Selection: "the top `defer` goes to the complexity LLM where the route has one" becomes the deferred adjudication tier, and Adjudicate is described as two tiers sharing one contract.
   - [ ] `actions/AGENT.implementation.md`: route wiring becomes one producer, and the pipeline-sequence block and classify-ownership table lose their family arms. `actions/AGENT.contract.md`: add a rule only if a slice produced one (candidate: "Plan's output type is the ungrounded attempt; a fallback must emit the same type").
   - [ ] Graduation sweep: grep `classifySkeletonFamily`, `relationalDefer`, `nestingDefer` and the retired producer names across `lambda/` and `taskPlanning/`; grep `](` for links into deleted files; resolve any `PI-n` markers left in code. Then delete this plan and mark its ladder row.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| PI-1 | **The ungrounded attempt's shape.** The actions already hold `PlanStep`, whose referents carry an optional `groundedId`, so the steps can already be ungrounded. The obstacle is `CommandAttempt`'s separate stored list of `CommandAttemptReferent` rows (`refKey`, required `id`, `shortName`, `gloss?`). That list is section 2 of the attempt prose, which an LLM reads: the gloss is how a world-knowledge check tells a heavy crate from an empty one. Today it is also the only grounding record for two routes. Containment and membership leave their steps unstamped, and `sandboxMembershipDryRun` rebuilds the key-to-id map from the list (`selectPlanCandidate.ts`, the `buildReferentAssignment` call). Relational stamps its steps and also fills the list, so one fact lives in two places. Options: (a) Plan emits a `CommandAttempt` with an empty list, and grounding fills it in; (b) `CommandAttemptReferent.id` becomes optional; (c) a separate plan-side type; (d) retire the stored list. `ObjectSpanReferent` gains `shortName?` and `gloss?`, Grounding stamps them by key alongside `groundedId`, and the prose section is rendered from the steps' distinct span keys. **Decided (2026-10-05): (d)** (replacing an earlier lean towards (a)). The list holds facts about one span key, and the steps' span referents already have that knowledge's optional slot. (a) gives one field two states, and an empty list cannot be told from "grounded, no referents". (b) makes optional a list that need not exist before grounding. Before and after grounding the attempt then has one shape, and only optional fields differ. That matches the concepts doc's "no separate ungrounded-attempt type". Cost: a key's name and gloss are copied onto each place the key appears (`object` and `from.referentTarget`), kept consistent by key, as `groundedId` already is. Membership's synthetic `primaryObject` key needs no special case: stamping matches by key, whatever its origin, and PI-7 removes it in slice 3. | 1 | Decided |
| PI-8 | **How templates combine.** First match (today's relational > look > membership order) versus the union of every template's attempts. **Decided (2026-10-04): union.** The templates are disjoint today (by token count and verb), so the result is the same now, and a union is what lets an ambiguous verb offer sibling attempts later. | 1 | Decided |
| PI-2 | **Where action descriptions and Consult wording come from** once one producer builds every attempt. Today each producer writes its own strings ("Put X on Y", "Establish relation: X / Y", Consult's "put the X on the Y"). **Decided (2026-10-04):** one describer per desired-result kind (each position step's `Change.primitive`, plus narration), taking the grounded desired result (whose span referents carry their short names, per PI-1), used both for `describe()` and for `toConsultAlternative`. Keep today's strings exactly so slice 0 stays unchanged. | 2 | Decided |
| PI-3 | **One dry run, with route gates restated as preconditions.** `sandboxMembershipDryRun` and `relationalDryRun` both ground the attempt, seed `runExecutor` with every grounded step and run it. They differ in two things. (1) **Environment:** sandbox graphs for room and actor, versus relational's ancestry prefetch. (2) **Route gates:** membership's take/drop locus check and exit-edge escalation; relational's hosting-kind check on the chain's first edge. **Decided (2026-10-04):** one dry run over an environment built once per command. Each remaining gate is either a precondition of its desired result, or retired. The locus check becomes the two `from`/`to` transfer preconditions in slice 3. Exit-edge contact becomes a challenge on any transfer (slice 3). The hosting-kind check is unreachable by its own comment, because `PeerRelationalEdgeKind` already excludes hosting kinds, so it is deleted rather than generalized. **Environment caveat:** today membership defers a candidate whose locus is `withinObject` or `heldByOtherCharacter`, because the sandbox holds only the room and actor graphs. Containment accepts a `withinObject` subject today and resolves its host at commit. So the shared environment must load the graph for each candidate's locus rather than inherit that defer, or containment loses commands it handles now. Slice 0 needs a containment row with a `withinObject` subject to catch this. | 2 | Decided |
| PI-7 | **The fast path's skeleton.** The deterministic `take`/`get`/`drop` check (`deterministicChecks.ts`) emits `rawObjectSpans` with no skeleton. **Decided (2026-10-04):** synthesize `[text(verb), objectSpan(span)]` and stamp it with `stampStableRefKeys`, the way `DeterministicTemplate`'s `matched` arm already pairs a skeleton with an intent. It then enters `planSkeleton` like any parsed skeleton, and `primaryObject` disappears. | 3 | Decided |
| PI-6 | **One `ParseCommandResult` arm for every command attempt.** `parseCommand` returns a `ParseCommandResult` union, and `index.ts` dispatches on it. On success, today's routes return separate arms: membership `ObjectManipulation`, relational `EstablishRelation`, containment `ObjectContainment`, and describe `LookComponent` (shared with UI-triggered looks, which carry no attempt). All four carry a `CommandAttempt`. Readers, checked 2026-10-05: every consumer is `index.ts`'s three hand-off branches. `attempt` and `confidence` are read by all of them. `operationKind` is read only for the membership not-in-a-room message's wording ("drop" vs "pick up"), and relational's `steps` only to infer the room for its not-in-a-room check. Containment has no such check. `objectIds`, `subjectId`, `targetId`, `containment`, `relationKind` and `relationLabel` are read only by the result type guards' own shape checks. **Decided (2026-10-05):** one arm, `{ type: 'CommandAttempt', attempt: CommandAttemptData, confidence }`, with `attempt` required, returned by all four routes. `LookComponent` stays for UI-triggered looks. Every per-route field is dropped. One not-in-a-room check covers every attempt: `roomExitContext.fromRoomId`, with "You are not in a room, so you cannot do that." This is a small accepted behaviour change: membership loses its verb-specific wording, relational stops inferring the room from steps, and containment gains the check. Keeping the take/drop wording would mean reading the primary desired result as a take or a drop, which puts a family check back into the one branch being merged. Consult, Abstain, Error and the non-object families' arms are unchanged. | 4 | Decided |

## Coordination

- **Iteration 2 (BD-19), the active rung.** Its plan-only and joint fallbacks emit Plan's output type, so this plan should land before their prompts are designed (steps 4-5 of BD-19's build sequence); otherwise the prompts are written against family stubs that slice 5 retires. The identity-only fallback is unaffected: it resolves identities against a fixed plan.
- **CPG-6** (relational `DeterministicTemplate` wiring, [`AGENT.classifyPlanGeneralization.planning.md`](AGENT.classifyPlanGeneralization.planning.md)) becomes simpler after slice 1, because a template's output is then the same type the producer consumes. Nothing here depends on it.
- **The commit side does not change.** `commitAttempt` already dispatches each action by its desired result's kind (the `Change.primitive` field) and threads `containment` through. Slice 3's payoff test is the check on that claim.

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
