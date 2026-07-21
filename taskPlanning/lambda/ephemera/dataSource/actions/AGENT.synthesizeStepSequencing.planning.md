# Object manipulation: generalized Synthesize step sequencing (iteration 8)

**Status:** Named, not started, deliberately. Split out 2026-07-21 while investigating BD-16's `sameHost` rebuild --- caught before it became scope creep on that work: shipping `sameHost` didn't require this generalization (an ad hoc, route-specific Expansion check was enough, matching the existing precedent `expandTransferMembership.ts` already set on the membership route), but it surfaced a real, distinct gap worth naming on its own. See [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) for the full iteration ladder.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Design and (eventually) build one real, generic Synthesize-side executor that walks an ordered sequence of ungrounded steps --- `Change`s and `Assertion`s alternating as needed --- performing Grounding, Expansion (inserting repair steps when an `Assertion` is violated), and Validation per step, so that a repair (a `TransferMembershipStep`, say) becomes a first-class step in a real grounded sequence rather than a bolted-on field on some other step's result.

This is **not** new design from nothing: the shape already exists, unwired, in two places:

- `plan/compileUngroundedPlan.ts`'s `compileRelationalUngroundedPlan` already returns a real `UngroundedPlanStep[]` of exactly `[sameHostAssertion, change]` --- written, tested in isolation, never called by any live route.
- `sandboxPlan.ts`'s `evaluateSandboxPlan` already folds a step array through state generically, and is the one place (`selectIdentityPlanTuple.ts`, membership dry-run only) where an Expansion-inserted repair (`expandTransferMembership.ts`'s `dissolveSteps`) gets appended into one real array before evaluation --- but it never reaches the live commit path.

Two shipped live examples now exist to design the generalization against, where previously there were none: BD-13 (`computeCarryClosure`, cascading fixpoint entirely within Expansion, no Plan involvement needed) and BD-16 (`expandSameHost`, a genuine Assertion-shaped precondition with a real repair step, currently bolted on as `transferFromHostId` rather than appended to a sequence). Per this project's own "expand as concrete cases demand" discipline (the same principle that kept `Assertion`'s union to one member until BD-16 needed a second), this is the point at which designing the general shape stops being premature.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read the durable vocabulary this design must fit: [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md) --- "Change vs. Assertion," "Synthesize's three sub-roles" (Grounding, Expansion, Validation), and the "Grounding and Expansion likely interleave, not run as two strict passes" note, which flags exactly this question as open without designing it.
3. Read the two existing worked examples in full: [`enrich/objectManipulation/synthesize/expandTransferMembership.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/expandTransferMembership.ts) (BD-13, membership) and [`enrich/objectManipulation/synthesize/expandSameHost.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/synthesize/expandSameHost.ts) (BD-16, relational) --- both should be expressible as instances of whatever general executor this iteration designs, without changing their own logic.
4. Read the two existing-but-unwired scaffolds: `plan/compileUngroundedPlan.ts` (`compileRelationalUngroundedPlan`/`compileMembershipUngroundedPlan`) and `sandboxPlan.ts` (`evaluateSandboxPlan`, called from `selectIdentityPlanTuple.ts`) --- the design question is whether/how to reconcile these with the live route, not whether to invent a third shape.
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).

## Open decisions (implementation --- plan only)

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| BD-27 | **Generalized ordered-step Synthesize executor --- named 2026-07-21, found while rebuilding BD-16's `sameHost` repair.** Today, every live route (membership via `expandTransferMembership`, relational via `expandSameHost`) hardcodes its own one-off unconditional Expansion check and bolts any repair onto the final result as an extra field, rather than appending it to a real ordered `ParsePlanStep[]`/`UngroundedPlanStep[]` a shared executor walks. Two orphaned designs already exist for the "real" shape (`compileRelationalUngroundedPlan`'s `[Assertion, Change]` array; `evaluateSandboxPlan`'s generic fold, sandbox-only). | Nothing currently --- both live routes work correctly today via the ad hoc pattern; this is quality-of-design debt, not a blocking gap | **Direction decided 2026-07-21 (below); not yet scoped or built** |
| BD-27a | **One executor, both routes, ad hoc call sites retired.** Membership and relational should not each own their own bespoke synthesis compiler --- they should both express their intent in one shared, expressive ungrounded-instruction language, and one executor walks it for both. `expandTransferMembership`'s and `expandSameHost`'s own Expansion *logic* stays (they're the two worked examples the executor must express, per Purpose above); what retires is each route's private wiring of "when to call it and what to do with the result." | BD-27 | **Decided** |
| BD-27b | **`compileRelationalUngroundedPlan`/`evaluateSandboxPlan` reshape, not reuse-as-is.** Both were written for a narrower purpose than this (Plan-only step emission with no live evaluator; sandbox dry-run legality checking) and should be expected to need real reshaping to serve as the live, generalized executor and its step vocabulary --- not treated as finished pieces that just need wiring up. | BD-27, BD-27a | **Decided** |
| BD-27c | **The kernel layer generalizes too, down toward `positionGraph` primitives.** The point of this generalization is not just to unify Plan/Synthesize's step vocabulary while leaving `applyObjectSetTransfer.ts`/`applyObjectRelationalChangeWithTransfer.ts` as two separate player-intent-shaped compound kernels --- the kernel should generalize down to something closer to `EphemeraPositionGraph`'s own primitives (`addObject`/`removeObject`/`applyRelationalPatch`/`applyMembershipEffect`, the same shared vocabulary `applyTransferSet.ts` and `applyHostRelationalPatch.ts` already both build on), rather than staying organized around "what a player asked for." A general grounded step sequence should bottom out in a general atomic apply over that primitive vocabulary, not route-specific transact-builders that happen to share a MultiKeyUpdate pattern. | BD-27, BD-27a | **Decided** |

## Recommended order

Use `[ ]` for pending and `[X]` for complete.

- [ ] **Do not begin implementation until someone actually schedules this iteration** --- both live routes work correctly today; direction is decided (BD-27a/b/c) but scoping/building is not yet underway. This row exists to hold that discipline visibly.
- [ ] Read `compileRelationalUngroundedPlan`/`compileMembershipUngroundedPlan` and `evaluateSandboxPlan` in full and write down concretely what reshaping each needs (BD-27b) to become the live step vocabulary and executor, rather than treating them as drop-in reusable.
- [ ] Design the general executor against BD-13 and BD-16 as its two required worked examples --- it must be able to express both without changing either's own Expansion logic (BD-27a).
- [ ] Design the general kernel-layer apply over `EphemeraPositionGraph` primitives (BD-27c) that a grounded step sequence bottoms out in, superseding the route-specific compound kernels' bespoke transact-building (their shared MultiKeyUpdate/legality-reuse pattern is the starting point, not the target shape).
- [ ] Migrate membership and relational routes onto the new executor and kernel, retiring the two ad hoc call sites and the two route-specific compound kernels, with no behavior change to either's test suite.

## Verification

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/plan/ \
  dataSource/actions/enrich/objectManipulation/synthesize/ \
  dataSource/actions/enrich/objectManipulation/sandboxPlan.test.ts \
  dataSource/positions/manipulation/
```

## Progress

| Milestone | Status |
| --- | --- |
| BD-27 named; two orphaned scaffolds and two live worked examples identified; split into its own iteration to avoid anchoring BD-16's rebuild on an open-ended reconciliation | Done (2026-07-21) |
