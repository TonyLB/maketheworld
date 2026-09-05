# Relational narration: migrate reposition onto the move compiler

**Status:** Not started, seeded 2026-07-31. This plan exists because its predecessor --- `AGENT.presentationKernel.planning.md`, which migrated *membership* narration onto a compiled, positionally-bound presentation kernel --- shipped all five of its phases and was deleted per [`taskPlanning/AGENT.md`](../../AGENT.md)'s durability ladder. The durable half of that work now lives in [`positions/AGENT.contract.md`](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), [`AGENT.concepts.md`](../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), and the two `AGENT.implementation.md` files. **This file carries only the decisions that had no durable home, because they concern behavior that is not built yet** --- writing them into `AGENT.contract.md` would be the "wishlist normative text" anti-pattern `taskPlanning/AGENT.md` names directly.

Nothing below is built. No phase ordering is committed to yet; the first slice of real work should start by re-reading the code, since the decisions here were made against a codebase that has since shipped four migration phases.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../AGENT.md).

## Why this initiative exists

**The requirement, stated once:** *if an entity leaves a room, enters a room, or repositions within a room, the characters in that room are notified.* Whether to narrate reduces to "did this host's position graph change"; how reduces to "what was the operation, and what kind of intent produced it."

Membership narration --- the first two clauses --- now works that way. **Reposition, the third clause, does not.** It still runs on the pre-kernel shape: [`objectManipulationPresentationFanIn.ts`](../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationFanIn.ts) maintains its own leg types, cluster identity, endpoint-compatibility matcher, and publish path --- a parallel copy of machinery that exists only because "reposition" had no vocabulary in a leave/arrive op. It also publishes against a **live** `ROOM#` roster at flush rather than a captured one, which is the binding-time defect the predecessor initiative existed to remove.

**Read the deferral as sequencing, not as a scope boundary.** Relational narration belongs in the move family; it was held back deliberately (2026-07-30) because relations are much less developed than membership --- which cuts both ways. There is less existing behavior to reason *from*, and correspondingly less legacy accretion to sift *through*. Both halves argue for the same ordering: get membership's epicycles under control first, then approach relations from a simplified vantage where the question is "what *should* reposition narration be" rather than "what is it currently, and which parts of that were accidents." Folding relational into the predecessor would have inverted that --- forcing the design of the less-understood half while the better-understood half was still mid-migration.

## What already exists to build on

The predecessor left the mechanism complete and the relational path unblocked. Read these first --- they are the substrate, not background:

1. [`positions/AGENT.contract.md` --- Narration and presentation](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#narration-and-presentation). The four normative clauses: binding time, capture shape, verb-from-delta, narrate-only-on-commit. **Every one of them applies unchanged to reposition.**
2. [`positions/AGENT.concepts.md`](../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) --- positional vs. terminal binding, presence vs. perspective, abstract-op/compiled-step, the two-kernel split.
3. [`positions/manipulation/AGENT.implementation.md` --- Compile layer](../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md#compile-layer-kernelcompile) and **Presentation kernel**. The compiler and the narrate branch, as shipped.
4. The thing being replaced: [`objectManipulationPresentationFanIn.ts`](../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationFanIn.ts), [`objectManipulationPresentationLegAdapters.ts`](../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationLegAdapters.ts), [`publishObjectManipulationPresentation.ts`](../../../lambda/ephemera/dataSource/perception/publishObjectManipulationPresentation.ts). Note the last of these had **no** test coverage at all until the predecessor's final phase repurposed a retired file to cover it.
5. The precedent for how a family joins: `NarrationSpecification` in [`kernel/kernelStep.ts`](../../../lambda/ephemera/dataSource/positions/manipulation/kernel/kernelStep.ts) is a discriminated union **on narration family**, and its doc comment records the trigger for escalating past a closed union. Adding `objectMove` alongside `membershipMove` cost one union member and one `case`. A `reposition` family should cost the same --- **if it does not, that is a signal worth stopping on**, because it means reposition is not actually the third member of this family.

**Testing authority:** [`lambda/ephemera/AGENT.testing.md`](../../../lambda/ephemera/AGENT.testing.md) --- `npm run test`, not `npm test`, run from `lambda/ephemera`. There is no `taskPlanning/lambda/ephemera/AGENT.development.md`.

**One hazard inherited from the predecessor, worth knowing before the first rename:** `*.integration.test.ts` files sit **outside** the tsconfig include and mock modules **by path**, so `npx tsc --noEmit` cannot catch a break in them. Two separate phases learned this the hard way. Run the full jest suite after any rename or deletion, and grep module *paths*, not only symbols.

Baseline (should pass before edits, run from `lambda/ephemera`):

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/ \
  dataSource/perception/ \
  dataSource/messageOrchestration/
```

## Recommended order

Use `[ ]` for pending and `[X]` for complete; mark nested lines `[X]` as each sub-step finishes. Nothing below is built yet, so all lines start `[ ]`. **This ordering is a sketch, not a committed plan** --- the first real slice should be planned against the code as it then stands.

- [ ] **Phase 1. Decide what a reposition op is.** The open question the predecessor could not answer: is reposition a *third member of the move family* (an op whose `from`/`to` are positions within one host) or a *sibling op kind* that shares the compiler and the presentation kernel but not `PositionKernelMoveOp`'s shape? Membership's `froms`/`to` are hosts; a reposition does not change host at all, so forcing it into that shape may be the same frame mismatch that generated the epicycles the first time.
- [ ] **Phase 2. Add the `reposition` narration family** to `NarrationSpecification` and `presentStepSequence`'s `buildNarrationCopy`, preserving today's strings verbatim so the migration is provably an *audience* change and not a copy change. (This is exactly how the object family landed, and the preserved strings doubled as the regression pin.)
- [ ] **Phase 3. Migrate `applyObjectRelationalChange`'s call sites** onto the compiler; capture the host's roster mid-walk; retire the relational fan-in, its leg adapters, its cluster, and its subscriptions.
- [ ] **Phase 4. Resolve PB-10's delivery-order obligation** (below) with a test, not a comment.
- [ ] **Phase 5. Durable docs, and retire this plan.** Same shape as the predecessor's final phase: move lasting rules into `AGENT.contract.md` / `AGENT.concepts.md` / `AGENT.implementation.md`, correct `perception/AGENT.md` (the `ObjectManipulation*` fan-in disappears entirely at that point), then delete this file. Budget real time for it --- the predecessor found its durable docs were not merely missing new rules but **actively stale**, pointing at modules three phases had deleted, and the corrections were larger than the additions.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to implement upcoming slices. When one ships, record it in `positions/AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| RN-1 | **`ACTOR` / `!ACTOR` target kinds for second-person copy**, as a `referent` build-in to the instruction set. | A later, separate task --- explicitly not this plan either | **Deliberately deferred 2026-07-28.** Named so the deferral stays explicit rather than becoming a silent permanent assumption. Presence and perspective are orthogonal; positional binding does not and should not answer perspective. Note `!CHARACTER#` and `GLOBAL` currently have **zero production producers** --- only `publishMessage/index.ts`'s own filter machinery references them --- so this would build on a largely unexercised part of the target vocabulary. Carried forward from the predecessor's PB-4. |
| RN-2 | **Does a severed boundary edge narrate?** See below --- resolved, but its obligation is unmet. | Phase 3/4 | **Resolved 2026-07-30 as (b).** Obligation outstanding. |

### RN-2 in full (carried from the predecessor's PB-10)

**The question.** When a tray is taken and a cup resting on it does *not* come along, the room's position graph changes twice: the tray's subtree leaves (an event with an actor and an intent) and the cup's `on-tray` relation is severed (a *consequence*). The host-changed rule says both narrate. Product judgment might say the second is silent, or folds into the first's copy.

- **(a)** Silent --- consequences never narrate independently.
- **(b)** Its own line, via the relational narration family.
- **(c)** Folded into the primary event's copy ("George picks up the tray, leaving the cup behind"), which the carry fragment's surviving edges make reachable.

**Resolved: (b), as a serviceable first iteration.** "George takes the glass off the tray." / "George picks up the tray." is perfectly clear communication --- only a little stilted --- while (c)'s single merged line is a materially larger lift in copy generation.

**(c) stays reachable at low cost, and the architecture already guarantees it.** The severed-edge set and the primary move arrive in `compilePositionKernelOp`'s hands *at the same moment* (the op carries `dissolvedEdges`), so merging two lines into one is later a copy-and-sequencing change inside one pure function --- no re-plumbing of Expansion, no op-shape change. Slot count is compiler-owned too (call sites declare `plan.slots` verbatim), so collapsing two slots into one stays contained. **This is explicitly not a corner being painted into.**

**Revisit trigger for (c) --- a cardinality threshold, not "someday":** (b) degrades from stilted to genuinely bad when several relations sever at once (a tray with five items left behind yields five dissolve lines plus one move line). If that case becomes reachable in practice, *that* is the signal to do (c) --- not a general dissatisfaction with the prose.

**The obligation (b) creates, which nothing currently discharges.** Dissolve narration must be **delivered** before the move's, or the pair reads backwards: "George picks up the tray. George takes the glass off the tray." implies the wrong sequence, or worse leaves it ambiguous whether the glass travelled. Step order already gets this right --- a carry's steps are `[dissolveRelation*, transferMembership]` and `factsForStep` streams in step order deliberately --- **but delivery order comes from declared slot order, not step order.** The compiler must therefore declare dissolve slots ahead of the move's. Unlike the bundle-declaration ordering discussed alongside it (a consistency preference, deliberately *not* a contract clause), this one **is** load-bearing --- for comprehensibility rather than correctness, which makes it exactly the kind of thing a test should pin rather than a comment.

**Note the current code answers this by accident.** The relational fan-in's dissolve leg exists, so whether a boundary sweep produces player-visible text today is a function of which events happen to be published, not of a decision anyone made. **This is a product call, not an architecture one --- record the answer, do not derive it.**

**Known bug in the machinery this plan retires, found live 2026-09-02 (`tie string to cup`, the edge-chain prototype vertical's own readout run):** [`objectManipulationPresentationLegAdapters.ts`](../../../lambda/ephemera/dataSource/perception/objectManipulationPresentationLegAdapters.ts) gates narration on `isEphemeraRoomId(content.hostId)`; a genuine crossing's published `hostId` is the *last leg's own* host, which for a cross-shard relation is frequently an Object, not a Room (see [`positions/AGENT.contract.md` --- Ingress summary](../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#ingress-summary) on "a genuine crossing has no single host") --- so narration is silently dropped for every relational establish/dissolve that crosses a shard boundary. Not fixed on the old fan-in, and **not necessarily this plan's job to fix as a targeted patch**: Phase 3 retires this exact adapter and its room-only gate wholesale in favor of the compiled presentation kernel, which does not key narration off a single ad-hoc `hostId` field --- confirm the new mechanism actually delivers a crossing's narration (a room-side and a far-side leg both touch a room's roster at different removes) before calling Phase 3 done, since this bug is exactly the kind of silent gap a migration can carry forward unnoticed if nothing tests for it directly.

## Verification

Per slice, from `lambda/ephemera`:

```bash
npm run test -- --watchAll=false \
  dataSource/positions/manipulation/ \
  dataSource/perception/ \
  dataSource/messageOrchestration/

# Full suite before marking a phase done --- integration tests are NOT covered by tsc
npm run test -- --watchAll=false

npx tsc --noEmit
```

Grep checks once the migration lands, from the repo root:

```bash
# Narrate and capture *steps* are constructed only inside the compiler. Every hit outside it is a
# call site hand-rolling its own plan. Note this greps step kinds only --- the `build*MoveOp` modules
# legitimately construct narration-*input* objects, which is what call sites are supposed to supply.
grep -rn "kind: 'narrate'\|kind: 'capture'" --include="*.ts" lambda/ephemera \
  | grep -v node_modules | grep -v "\.test\.ts" \
  | grep -v "manipulation/kernel/compile/" | grep -v "manipulation/kernel/kernelStep.ts"

# The relational fan-in should be gone in its entirety, not half-deleted
grep -rn "ObjectRelationalPresentationFanInCluster\|objectManipulationPresentationClusterFromLeg" \
  --include="*.ts" lambda/ephemera | grep -v node_modules
```
