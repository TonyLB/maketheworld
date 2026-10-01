# Generalize the command-attempt pipeline

**Status:** Drafted 2026-10-01 (ISS8202). Nothing built. Next: decide AP-1, which is slice 0.

This plan is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md). It is an implementation plan: the open questions are few, and each belongs to a slice.

## Why

The membership route runs every candidate through one chain: ground + expand + adjudicate, dry run, then select by confidence with a floor and a margin. The relational route runs a different chain and takes its first legal candidate. The rehost route has no candidate pool at all. So only membership can choose among several readings of a command, or ask the player when two are close.

This is the structural half of [BD-25](AGENT.manipulationFrameAndRelational.planning.md#bd-25), pulled forward. The iterations plan put it at [iteration 2 step 2](AGENT.objectManipulationIterations.planning.md#resuming-iteration-2-2026-09-23), after the plan-only fallback (step 1). It now comes first (decided 2026-10-01): a plan-only fallback that proposes N ranked plans of any family needs one selector to send them through, and today two of the three routes have none.

## Target shape

The [attempt plan's Target shape](AGENT.commandAttemptPhase.planning.md#target-shape) is route-agnostic, and this plan builds it for relational:

**plans × identity candidates -> ground -> expand -> adjudicate -> dry run -> select**

- **One shared stage**, which dispatches on the plan's kind. Membership is the first case and relational the second. BD-25 recorded that this is built by extraction, not as a parallel selector.
- **The selection unit is a grounded candidate carrying its attempt**, as on the membership route since [attempt plan slice 2.6](AGENT.commandAttemptPhase.planning.md#recommended-order). The selected candidate's attempt is the one published.
- **The attempt is grounded by substitution** ([slice 2.8](AGENT.commandAttemptPhase.planning.md#recommended-order)): Plan's `Change` keeps its referents' `stableRefKey`s, and grounding adds `groundedId`s.
- **Selection is `selectPlanTuple`, unchanged.** Calibrated ranking (BD-19 (3), then BD-25's rubric) later swaps in through `getConfidence` without changing the stage's shape.
- **Membership-specific names are renamed during the extraction**, not before (BD-25).

## Scope

- **In:** extracting the chain; moving relational onto it; relational's attempt built per candidate, before selection.
- **Out:** calibrated ranking (BD-19 (3), BD-25's rubric); any LLM fallback (iteration 2 steps 1 and 3); a sibling-attempt producer (the stage stays a `map`, per slice 2.6).
- **Rehost: AP-4.**

## Premises checked against code (2026-10-01)

- **Membership's chain.** [`proposeMembershipTuples`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/proposeMembershipTuples.ts) (pool + `verbClass` -> `IdentityPlanCandidate[]`) -> [`selectIdentityPlanTuple`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/selectIdentityPlanTuple.ts), which runs [`groundMembershipCandidates`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/groundMembershipCandidates.ts) and then `selectPlanTuple` with `sandboxMembershipDryRun` as its `dryRun` -> [`selectMembershipFromPool`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/selectMembershipFromPool.ts)'s `mapSelection` (existence/presence guard, catalog scope) -> [`compileMembershipAtomic`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileMembershipAtomic.ts)'s exits.
  - `selectPlanTuple<T>` is already generic over the candidate type (`getConfidence`, `dryRun`, `toConsultAlternative` are callbacks).
  - Membership grounds by hand (`withGroundedId` on the desired result's object), not through `groundChange`. Its deterministic fast path has no Parse skeleton, so its `stableRefKey` is synthesized (`'primaryObject'`).
- **Relational's chain** ([`compileRelationalFromSkeleton.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileRelationalFromSkeleton.ts)). `matchRelationalTemplate` -> `runIdentityStageOverSkeleton` -> `resolvedSpansFromPools` -> `groundChange` (the Cartesian product of grounded `ParsePlanStep`s) -> per candidate, an executor run seeded with `sameHost`, plus `filterLegalRelationalCandidates` on the portless path -> `preparedCandidates[0]` (line 455).
  - **No candidate carries a confidence.** `resolvedSpansFromPools` keeps only `candidateIds`, discarding each candidate's `jointRelevance`. `RelationalIdentityPlanCandidate` (`identityPlanCandidate.ts`, confidence = `min(subject, target)`) exists, but the live route does not use it.
  - **The attempt is built once, after selection** (`buildRelationalAttempt`), with synthesized ref keys (`${id}/subject`), not Parse's `stableRefKey`, and with no `groundedId`. That predates slice 2.8's substitution rule.
  - **A `defer` is dropped**, like an illegal candidate. When nothing survives, the route returns `Abstain`. There is no complexity LLM on this route.
  - **Its async prefetch** (ancestry walk, host graphs) runs once over every distinct candidate id before the loop. The per-candidate work after it is synchronous, just as membership's sandbox state is built before its synchronous chain.
- **Consult.** The selector's alternative type `SpanResolutionConsultAlternative` requires one `objectId`. The wire type `ParseCommandConsultAlternative` has `objectId?` optional and `proposedCommand` required, and the egress (`actions/index.ts`, `consultMessageForPlayer`) reads only the alternatives. So a relational Consult is deliverable on the wire, but not through today's selector type (AP-3).
- **Rehost** ([`compileObjectRehostFromSkeleton.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/compileObjectRehostFromSkeleton.ts)) resolves each span to exactly one object, or errors with `ambiguousMatch`. No `PlanStep` shape exists for its containment argument, so its attempt's `desiredResult` is `undefined`.
- **Selector thresholds** ([`embeddingMatch/thresholds.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/embeddingMatch/thresholds.ts)): `T_JOINT_ABS = 0.42`, `T_JOINT_ABS_UNARY = 0.48`, `T_JOINT_MARGIN = 0.08`. They were calibrated on single-span membership relevance. A relational candidate's combined confidence (AP-2) meets them for the first time.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| AP-1 | **The shared stage's interface.** What is one candidate (its plan as `PlanStep<GroundedReferent>`, its identity per `stableRefKey`, its confidence, its attempt)? And what does each plan kind supply: proposal, grounding, expansion, the dry run, the Consult alternative, the post-selection exit? By [`AGENT.architecture.codeOrganization.md`](../../../../../AGENT.architecture.codeOrganization.md)'s "which axis grows" test, the plan kinds grow (membership, relational, rehost, then the fallbacks' outcome classes). That points to a declared-interface family, one member per plan kind, rather than a switch. Also open: does relational ground through `groundChange` (its Cartesian product) and membership keep its hand grounding, or do both ground the same way? And should the dry run carry its validated kernel steps out (relational needs them for the publish), rather than having them recomputed after selection? | 0 | Open |
| AP-2 | **Confidence for a candidate with several referents.** Leaning: `min` over the referents' `jointRelevance`, the existing precedent (`RelationalIdentityPlanCandidate`). `combineConfidenceNaive`'s own doc comment reserves `min` for two measurements of the same kind, which this is. BD-25's calibrated rubric replaces it later. | 2b | Open (leaning `min`) |
| AP-3 | **A Consult alternative that names several objects.** The selector's alternative type needs one `objectId`, and a relational alternative names two. Options: widen it to `objectIds`, or let the alternative be `proposedCommand` with `objectId?` as on the wire. Its `proposedCommand` wording ("put the red cup on the table") comes from the plan kind (AP-1). | 2b | Open |
| AP-4 | **Is rehost in scope?** It has no pool and no `PlanStep` for containment, so joining means building both. BD-25 says rehost joins "when it gains a candidate pool". Leaning: out of scope, recorded as a follow-up, unless the plan-only fallback (iteration 2 step 1) needs to emit rehost plans. | 3 | Open (leaning out) |

## Recommended order

Mark pending work `[ ]` and completed work `[X]`, including nested lines, as each one is done.

0. [ ] **Decide the shared stage's interface (AP-1).** No code. Output: the AP-1 row settled, with a short sketch of the member interface and of the candidate type.
   - [ ] For each step of membership's chain, record whether it is general or specific to the plan kind. Specific so far: the locus rule (`membershipSourceHostId`), boundary-edge expansion, the sandbox dry run, the existence/presence guard, the Consult wording.
   - [ ] Do the same for relational's chain: `groundChange`'s product, the `sameHost` executor run, the portless legality filter, the crossing branch, and the hosting-kind guard.
   - [ ] Decide the names the extracted modules get (BD-25: renamed during the extraction).
1. [ ] **Extract, with membership as the only member.** This slice changes no behaviour.
   - [ ] Move `selectIdentityPlanTuple`'s composition and `groundMembershipCandidates` behind the shared stage, with membership as its first member. `selectPlanTuple` itself is unchanged.
   - [ ] Rename the membership-named stage modules and repoint every caller. That includes the unwired identity-only fallback (`fallback/identityOnlyFallback.ts`), which also dry-runs through `sandboxMembershipDryRun`.
   - [ ] Existing tests stay green. The only test diffs allowed are imports and renamed symbols.
   - [ ] Docs: `actions/AGENT.concepts.md` (Pipeline shape, the `CommandAttempt` section's membership paragraph), `enrich/objectManipulation/AGENT.md`, and `actions/AGENT.implementation.md` describe the shared stage.
2a. [ ] **Relational: build the attempt per candidate.** This slice changes no behaviour. It mirrors attempt plan slice 2.6, so that 2b's diff holds only its behaviour change.
   - [ ] Add relational as the stage's second member. Each grounded candidate carries an attempt built by substitution: Plan's `match.change`, with `groundedId`s added, keeping Parse's `stableRefKey`s. This retires `buildRelationalAttempt`'s synthesized ref keys.
   - [ ] The member's dry run is today's per-candidate executor run plus the legality filter, returning the validated kernel steps (per AP-1).
   - [ ] Selection stays "first legal candidate", through a temporary selector the slice names, so the published result is byte-identical. The attempt's referents section changes ref keys; a test diff is allowed only for that.
2b. [ ] **Relational: `selectPlanTuple` replaces the first legal candidate.** This slice changes behaviour.
   - [ ] Carry each referent's `jointRelevance` through grounding, so a candidate has a confidence (AP-2). `resolvedSpansFromPools` keeps the pool's scores, or the stage reads them from the pools directly.
   - [ ] Thin margin -> `Consult` (AP-3); head below the floor -> `Abstain`; no legal candidate but a `defer` -> `Abstain`, as today, since this route has no complexity LLM (iteration 2 step 3 owns that).
   - [ ] Payoff tests through `parseCommand`, ending at the result the player sees: two similar cups and a table -> `Consult` naming both; one clear match -> `EstablishRelation` as before.
   - [ ] **Check the thresholds against relational confidences.** Run the existing relational tests and the step 0 corpus's relational rows, and record any command that now abstains below `T_JOINT_ABS`. Retuning the thresholds is not this slice's work: record what was found, and stop.
   - [ ] Remove the `preparedCandidates[0]` comment and its BD-25 pointer.
3. [ ] **Rehost joins.** Only if AP-4 says it is in scope; otherwise, drop this slice and record rehost as a follow-up in the iterations plan.
4. [ ] **Graduate and delete.**
   - [ ] `actions/AGENT.concepts.md`: Pipeline shape no longer says "Relational takes the first legal candidate". The "one single-plan seam" note says what the shared stage now accepts.
   - [ ] BD-25's row keeps only its calibrated-ranking half. The iterations plan's step 2 keeps only wiring the identity-only fallback. The attempt plan's Scope paragraph points at the shared stage.
   - [ ] Graduation sweep: grep `](` for links into this file, then delete it.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) (Pipeline shape; Synthesize's three sub-roles; `CommandAttempt`) and [`AGENT.architecture.codeOrganization.md`](../../../../../AGENT.architecture.codeOrganization.md) (families and containers; which axis grows), since AP-1 applies it.
3. Read [BD-25](AGENT.manipulationFrameAndRelational.planning.md#bd-25) for the design intent, and the [attempt plan](AGENT.commandAttemptPhase.planning.md)'s slices 2.6 and 2.8 for how membership's chain got its present shape.
4. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file. Integration tests (`*.integration.test.ts`) sit outside `tsconfig`, so run the suite, not just `tsc`.
5. Baseline, which should pass before any edit (from `lambda/ephemera`; 153 suites green on 2026-10-01):

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/ \
  dataSource/positions/manipulation/
```

## Verification

- Every slice: the baseline command above, plus the full `lambda/ephemera` suite whenever a module is renamed or deleted (slices 1, 2a, 4). Grep for module paths, not just symbols.
- Slices 1 and 2a change no behaviour: diff no narration or result assertion. A slice that changes no behaviour and still needs test edits has changed behaviour (2a's ref-key diff is the one named exception).
- Slice 2b: payoff tests end at the `parseCommand` result, not at the selector's verdict.
