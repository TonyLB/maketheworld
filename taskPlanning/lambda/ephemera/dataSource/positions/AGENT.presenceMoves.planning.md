# Presence-binding moves: implementation

**Status: not started. Opened 2026-10-12. Next: [Slice 0](#recommended-order).** **Why now (the user, 2026-10-12):** kernel moves are addressed by **host**, so whatever a producer knows about *which binding* is lost at the op boundary and rebuilt inside the lock by a best guess (`withParentPresence`, via `childParentBindingIdOf`). The guess holds only while every destination has one binding. The first live producer that gives a host a second binding (a plank laid across two tables) breaks it, and that producer is expected soon.

**Scope in one sentence: replace the host-addressed presence move with three binding-addressed kernel instructions --- split, join and move --- and then make `presence` required in `fromHostPresence`.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md). The design below was settled in conversation with the user on 2026-10-12. It builds a first, deliberately narrow version of what the open design rows [PR-12 and PR-14](AGENT.presence.planning.md#open-decisions-design--plan-only) describe, and answers neither row in full. Deleted when the work lands. Lasting rules go to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).

---

## The design (the user, 2026-10-12)

Three kernel instructions, each naming bindings rather than hosts:

1. **Split** one binding of a whole into a **list** of bindings **under the same parent**, with an instruction saying how its cover is distributed among them.
2. **Join** two bindings of a whole that have the same parent into one.
3. **Move** one binding of a whole to a named destination binding. The whole's node (and its adjacency row) is added to the arrival host's graph only if this is its **first** binding at that host, and removed from the departure host's graph only if it was its **last** binding there.

**Where these come from in the design rows.** [PR-12](AGENT.presence.planning.md#open-decisions-design--plan-only)'s forward note: "placement becomes moving nodes from one bucket to another ... so first placement and bucket splitting share one primitive", and its "Also here": the planner -> kernel boundary must carry "a redistribution (which entities to which binding, not merely which host)". Split is the constructor PR-12 obligation A (the cascade) is aimed at. The distribution instruction is [PR-14](AGENT.presence.planning.md#open-decisions-design--plan-only)'s member language, which rules an explicit `ID[]` list plus a remainder legal. Join is [C9, "coiling the rope back in"](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in).

**Scope cuts for this version (agreed 2026-10-12):**

- **Split is disjoint and never cascades.** Each member of the split binding goes to exactly one result, and exactly one result keeps the `Remainder`. A split then only re-points its children's pointers; it never mints a binding on a child. An overlapping split (a member in two results, which PR-14 permits) obliges the child to split too, to the depth of the composition. That is PR-12 obligation A, and out of scope here. [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#ludicgraph-play-manipulation-model)'s "presence descent is unimplemented" prediction stays unbuilt.
- **Split stays under one parent.** A whole across two parents (the plank across two tables) composes: split under the current parent, then move each result.
- **The distribution instruction is explicit lists.** PR-14's rule-shaped language is an ergonomic later improvement, not a requirement.
- **No producer is in scope for split or join.** This plan builds the kernel steps and their compile path; the first live producer (a command that lays something across two hosts) is its own work. Payoff tests therefore run through the compiler and the sweep's classifier, not a player command.

**What a move names, found 2026-10-12.** A referent's `groundedPresence` ([`planStep.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/planStep.ts), filled by `presencesHolding` in [`presenceSubGraph.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceSubGraph.ts)) names the bucket of the **holding** host in which the referent is seen, not the referent's own binding. For a destination, that narrows its binding (the one whose `fromHostPresence` names the seen bucket) without always determining it: two bindings of one destination under the same parent bucket, which a split produces, both match. See [PM-1](#open-decisions-implementation--plan-only).

## Getting Started

1. **Read the design rows** this plan builds part of, graded by their Status cells: PR-12 and PR-14 in [`AGENT.presence.planning.md`](AGENT.presence.planning.md#open-decisions-design--plan-only), and the corpus cases [C2](AGENT.abstractionLayers.corpus.planning.md#c2-the-rope-in-two-rooms-refused-at-the-gate) and [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in).
2. **Read the rules it changes:** [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path) (the single write path: split and join are new kernel steps emitted by the move compiler, so no new emitter) and [the presence cover drift self-heal](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#mtwdiagnostics--presence-cover-drift-self-heal) (pointers govern; its classifier is this plan's payoff check).
3. **The code**, all under [`lambda/ephemera/dataSource/positions/manipulation/`](../../../../../lambda/ephemera/dataSource/positions/manipulation/) unless noted:
   - **Op and compile:** `kernel/compile/positionKernelOp.ts` (`PositionKernelMoveOp`: `froms` and `to` are hosts), `kernel/compile/compilePositionKernelOp.ts`, `kernel/compile/presenceBindingStepsForMove.ts`.
   - **Steps and apply:** `kernel/kernelStep.ts` (`MutationKernelTransferStep`, `MutationKernelRehostPresenceBindingStep`), `kernel/applyStepSequenceCore.ts` (`withParentPresence`, the `rehostPresenceBinding` handler, the character-cardinality validator), `kernel/commitStepSequence.ts` (adjacency `Put`/`Delete` per transfer), `kernel/computeStepSequenceFootprint.ts`, `kernel/factsForStep.ts`.
   - **Producers of move ops:** `membership/buildCharacterMoveOp.ts`, `membership/buildObjectMoveOp.ts`, and `executeMembershipTransfer`'s callers (spawn, clear/scrub, place, drift repair).
   - **The guess being retired:** `childParentBindingIdOf` in [`ludicGraph/presenceParent.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceParent.ts).
   - **Payoff check:** `classifyPresenceCoverDrift` / `coverRebuildsFor` in [`@tonylb/mtw-gateways`](../../../../../packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts).

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/ dataSource/positions/manipulation/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols.

## What is deliberately out of scope

- **PR-12 obligation A** (overlapping splits and the cascade they oblige), and a **join** that would cascade (see [PM-2](#open-decisions-implementation--plan-only)).
- **A live producer** for split or join.
- **Authored multi-hosting.** WML names a parent by component key and cannot name a binding, so cache-time population into a parent with several bindings has no binding to write. That is shelved in [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#ludicgraph-play-manipulation-model) ("Shelved: authored placement into a multi-binding parent"), keyed to lifting [C2](AGENT.abstractionLayers.corpus.planning.md#c2-the-rope-in-two-rooms-refused-at-the-gate)'s refusal. This plan only makes population refuse that case explicitly ([Slice 5](#recommended-order)).
- **Characters** split or join nothing: they stay single-hosted (PR-13's validator).

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [ ] **Every producer of a move.** List each producer of `PositionKernelMoveOp` and each `executeMembershipTransfer` caller, and record which mover binding and which destination binding each could name from what it already holds, without a new read.
  - [ ] **Every reader that assumes one membership per (entity, host).** The adjacency row (`commitStepSequence`), the transfer step's `fromHostIds` set, `factsForStep`'s moved facts, and anything reading the arrival graph's node for the mover. Slice 2 changes when these are written.
  - [ ] **`groundedPresence` to destination binding.** Confirm by test that "the destination binding whose `fromHostPresence` names the seen bucket" is unique for every destination shape that exists today. Grounds PM-1.
- [ ] **Slice 1. A move names bindings.** `rehostPresenceBinding` names the mover's binding and the destination binding (`{ host, presence }`) instead of host sets, and `PositionKernelMoveOp` carries them from the producer. Resolution by host remains only as PM-1 allows (unambiguous, else stale, never a guess). Behavior-preserving for every single-binding mover and destination.
  - [ ] Payoff test, compiled through `compilePositionKernelOp`: moving an object onto a destination with two bindings lands under the named one, and the sweep's classifier reads clean on the resulting graphs. Today it would land host-only.
- [ ] **Slice 2. Membership counts bindings.** A move adds the mover's node and adjacency row at the arrival host only for its first binding there, and removes them at the departure host only for its last. Moving one binding of a multi-binding whole leaves its other bindings, and their children, untouched.
  - [ ] Retire [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md#ludicgraph-play-manipulation-model)'s "Known residual, multi-binding demint" paragraph, which this fixes.
  - [ ] Destroy, scrub and disconnect keep today's rule: every binding leaves, and the last stays hostless.
- [ ] **Slice 3. Split.** A new kernel step (name is this slice's to choose) on the whole's graph: the binding to split, the results (a fresh id and explicit entries for each), and which result keeps the `Remainder`. The binding's id survives as one of the results, so children naming it are not orphaned. Children moved to another result have their pointers re-pointed in the same commit (their graphs join the footprint). The handler refuses anything outside this version's scope: an overlap between results, an entry the binding does not cover, or anything but exactly one `Remainder`. Compiled from a new op kind.
  - [ ] Payoff: after a split, `classifyPresenceCoverDrift` over the whole and every child reads no findings, and `coverRebuildsFor` is empty.
- [ ] **Slice 4. Join.** A new kernel step: two bindings of one whole with the same parent become one. The survivor keeps its id and takes the absorbed binding's entries (and its `Remainder`, if it held one); children naming the absorbed binding are re-pointed to the survivor. A child left holding two bindings into the survivor is [PM-2](#open-decisions-implementation--plan-only).
  - [ ] Payoff: split then join round-trips to the original cover, and the classifier reads clean at each step.
- [ ] **Slice 5. Required `presence` in `fromHostPresence`.** Moved from [the presenceRemainder plan](AGENT.presenceRemainder.planning.md#recommended-order) on 2026-10-12. Once Slice 1 lands, no move writes a host-only pointer. Tighten `EphemeraPresenceParentPointer`, its guards and mtw-wml's wire type (`dataTypes/ludicGraph.ts`). Delete `withParentPresence` (used by the `rehostPresenceBinding` and `addPresenceBinding` handlers). Population's `{ host: parentId }` branch becomes an explicit refusal (logged, nothing written) for a parent with several bindings, which only authored multi-hosting can reach. Update the drift classifier's check (a) in [`containmentPopulationDriftSweep/classification.ts`](../../../../../lambda/diagnostics/containmentPopulationDriftSweep/classification.ts), and drop the host-grain case from `classifyPresenceCoverDrift`. Deploy and run `LudicGraphStaleStructureSweep`, which must read zero.
- [ ] **Slice 6. Close.**
  - [ ] Rules into `positions/AGENT.contract.md` (split, join, binding-addressed move, membership by binding count, required `presence`) and `AGENT.implementation.md`.
  - [ ] Add a forward note to PR-12 and PR-14 in the presence design plan: what this version built, and what it left open (overlap and cascade, the rule-shaped member language).
  - [ ] Graduation sweep: grep for inbound links to this file, then delete it.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **PM-1** | **Where does a move's binding come from when the producer doesn't hold it?** Producers know hosts. `groundedPresence` narrows a destination's binding to the one under the bucket where it is seen, but two bindings of the destination under one parent bucket both match, and nothing names the mover's own binding. Candidates: (a) the step may name a host where the binding at that host is unique, resolved inside the lock, and is stale when it is not (no guess); (b) Grounding learns each referent's own bindings, as an optional field on the referent. (a) suffices until something splits under one parent; (b) is what a producer of that case will need. | Slice 1 | Open |
| **PM-2** | **A join whose child already holds a binding under each joined binding.** After the join the child holds two bindings naming the survivor, which the sweep reports as `Duplicate`. Either the join refuses (the child must be joined first), or it cascades into the child (PR-12 obligation A, out of scope). | Slice 4 | Open; refusing fits this version's scope |

## Verification

```bash
# Baseline and per-slice tests (from repo root):
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/ dataSource/positions/manipulation/
cd lambda/ephemera && npm run test -- --watchAll=false   # full suite: integration tests sit outside tsconfig
cd lambda/ephemera && npx tsc --noEmit
cd packages/mtw-gateways && npm test   # classifyPresenceCoverDrift (Slice 5)
cd lambda/diagnostics && npm test && npx tsc --noEmit   # drift classifier check (a) (Slice 5)

# Relative links resolve in every touched markdown file (pass the files as arguments).
node -e 'const fs=require("fs"),path=require("path");let bad=0;for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,"utf8");for(const m of t.matchAll(/\]\(([^)#\s]+)(#[^)\s]*)?\)/g)){const p=m[1];if(/^[a-z]+:/.test(p))continue;if(!fs.existsSync(path.resolve(path.dirname(f),p))){bad++;console.log(f+": "+p)}}}console.log(bad?bad+" broken":"links ok")' <files>
```

**Payoff check:** every slice's payoff runs the shared drift classifier over the graphs it wrote, the same comparison the deployed `PresenceCoverDriftSweep` makes, so a clean classifier is what a clean sweep would read.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Not started |
| 1. A move names bindings | Not started |
| 2. Membership counts bindings | Not started |
| 3. Split | Not started |
| 4. Join | Not started |
| 5. Required `presence` | Not started |
| 6. Close | Not started |
