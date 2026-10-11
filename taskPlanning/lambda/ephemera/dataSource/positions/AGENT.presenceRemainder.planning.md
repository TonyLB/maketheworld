# Presence remainder: implementation

**Status: not started. Next step: [Slice 0](#recommended-order) (verify premises).** Opened 2026-10-11 from [`AGENT.presenceRemainderDesignSweep.planning.md`'s Slice 1b](AGENT.presenceRemainderDesignSweep.planning.md#recommended-order), as soon as PR-21 was Locked. **Why now (the user, 2026-10-11):** the `fromHostId` -> `fromHostPresence` migration is the largest part of this change and only grows with each feature added before it; and until a direct-to-presence parent path exists, new code has to walk binding-to-host, which is the debt this design removes.

**Scope in one sentence: build PR-21 --- the remainder cover, the optional `fromHostPresence` parent pointer, pointers governing with covers as their index, the room rule, and audience stopping at the room --- in code and in stored data.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md). It records no design: the design is [PR-20 and PR-21](AGENT.presence.planning.md#open-decisions-design--plan-only), and the forks below are only those needed to build it. Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md), and the Target items in [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#presence-as-a-cover) flip to Shipped.

---

## Getting Started

1. **Read the design.** PR-20 and PR-21 in [`AGENT.presence.planning.md`](AGENT.presence.planning.md#open-decisions-design--plan-only), graded by their Status cells; then their detail in [PR-20](AGENT.presence.discussion.planning.md#pr-20-requirement-what-must-presence-say-about-rooms-and-about-things-present-nowhere) and [PR-21](AGENT.presence.discussion.planning.md#pr-21-representation-the-remainder-binding-and-its-parent-pointer). PR-21's exclusion list and re-open trigger bound this plan.
2. **Read the rule it changes:** [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path) --- cover, consolidation, and the single write path. This plan adds no new emitter of bindings.
3. **The code**, all under [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/):
   - **Parent walkers:** [`ludicGraph/presenceRooms.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceRooms.ts) (`roomsForHost`, `roomsForPresenceNode`, `roomsForReferent`; called from `manipulation/commitAttempt.ts`) and [`ludicGraph/presenceAncestry.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceAncestry.ts) (`hasPresenceAncestor`; called from `manipulation/membership/planObjectMoveTransfer.ts`). Both fan out binding-to-host over every presence node of a host.
   - **Writers:** [`manipulation/kernel/compile/presenceBindingStepsForMove.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/compile/presenceBindingStepsForMove.ts) (remove-then-add per rehost), [`manipulation/containment/containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) (cache-time population, idempotent on `fromHostId`), and `manipulation/kernel/applyStepSequenceCore.ts`'s `addPresenceBinding` (mints every binding `Full`) and `removePresenceBinding` (matches on `fromHostId`) handlers.
   - **Cache fold:** `ludicCache/fold.ts` (`buildLudicCache`; its `memberBindings` lookup and crossing-collapse binding lookup both match on `fromHostId`), `ludicCache/mergeReducer.ts` (`presenceCacheNodesFromFold` expands `Full` to members), `ludicCache/catalogHandles.ts` (`bucketsByMember`), `ludicCache/roomObjectContents.ts` (reads cache covers).
   - **Type, guards, wire:** [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`EphemeraPresenceCover`, the presence node, `isEphemeraPresenceCover`), `ludicCache/types.ts` (cache guard), `ludicGraph/wireProjection.ts` (presence conversion), `ludicGraph/presenceSubGraph.ts`.
4. **The sibling plan.** [`AGENT.presenceRemainderDesignSweep.planning.md`](AGENT.presenceRemainderDesignSweep.planning.md) corrects the design plans and present-tense docs in parallel. It gates nothing here.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/ dataSource/positions/manipulation/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols.

## What is deliberately out of scope

- **PR-21's exclusions:** the bucket-split primitive for placement (PR-12, PR-14); things bound directly into an Area; apprehension scale.
- **Doc corrections** to the design plans and present-tense docs: the sweep plan's Slices 2--3. This plan updates the contract and implementation docs only as its own slices ship.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [ ] **Classify every reader.** `grep -rn "fromHostId\|presenceNodes" --include='*.ts' lambda/ephemera/dataSource packages/mtw-interfaces/ts | grep -v test` hits about 28 files, most of them crossing-port `fromHostId`, not presence. List each presence reader here, so Slice 4 has a complete target list. Known so far beyond Getting Started step 3: `actions/enrich/objectManipulation/synthesize/findRelationalChain.ts` (a presence node read as a port's owner).
  - [ ] **Count multi-`Full` parents.** Find stored hosts with more than one presence binding --- for example a Feature authored into several rooms in `packages/mtw-wml/ts/*.wml` --- and the test fixtures that build one. This grounds PRm-1.
  - [ ] **Order against [`AGENT.authoredObjectPopulation.planning.md`](AGENT.authoredObjectPopulation.planning.md).** It widens the same population emitter to Objects. Decide which lands first; whichever is second adopts the other's emitter shape.
- [ ] **Slice 1. The seam.** Add one accessor in `ludicGraph/`, roughly `parentBinding(owner, binding, getGraph)`, derived from today's data per PRm-1. Move `roomsForHost`, `roomsForPresenceNode` and `hasPresenceAncestor` onto it. From then on new code has a direct-to-presence parent path, and Slice 4 swaps the accessor's implementation instead of chasing call sites. **Observed in the design sweep's Slice 3:** the two walkers already differ over a room: `roomsForHost` treats a room as a terminal, while `hasPresenceAncestor` follows the room's Area binding and so counts Areas among a host's ancestors. Decide in this slice whether the shared accessor keeps both behaviors (a room-stop option) or unifies them; its one caller, `planObjectMoveTransfer.ts`, shows which is needed.
  - [ ] Behavior-preserving: the existing `presenceRooms.test.ts` and `presenceAncestry.test.ts` pass unchanged.
  - [ ] New unit tests for the accessor, including the first fixture with an Area-hosted room and a parent with two bindings.
- [ ] **Slice 2. The extra-bucket defect.** A room-seeded cache gives each room member a bucket `{ host: <room>, presence: <room's Area binding> }`, which resolves to no rooms (verified by reading in the sweep's Slice 0). Fold a room's Area bindings as carve-outs with empty member lists, per PR-21(f).
  - [ ] Payoff test: a room-seeded `ludicCacheObjectHandles` handle's `presence` resolves, through `roomsForReferent`, to exactly that room.
- [ ] **Slice 3. The cover type.** A remainder flag replaces `Full`, encoded per PRm-2, with at most one remainder per whole.
  - [ ] Type and guards: `ephemeraMeta.ts`, `ludicCache/types.ts`; wire: `wireProjection.ts`.
  - [ ] `Full` in shipped docs: [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md), [`AGENT.ludicCacheRebuild.planning.md`](AGENT.ludicCacheRebuild.planning.md), [`lambda/ephemera/AGENT.caching.planning.md`](../../../../../lambda/ephemera/AGENT.caching.planning.md), [`AGENT.designVariant.performance.md`](../../../../AGENT.designVariant.performance.md).
- [ ] **Slice 4. Stored `fromHostPresence`.** An optional `fromHostPresence: { host, presence }` replaces `fromHostId` on presence nodes.
  - [ ] Writers name the parent binding. Population applies the room rule: a room's remainder is always hostless, and its Area bindings are carve-outs with empty member lists.
  - [ ] `parentBinding` reads the stored pointer; the derivation is retired.
  - [ ] Every presence reader from Slice 0's list moves over, including `containmentPopulationSteps`'s idempotency check and the fold's `memberBindings` filter.
- [ ] **Slice 5. Moves and disconnects.**
  - [ ] A move re-points the mover's stable remainder, in place of `presenceBindingStepsForMove`'s remove-then-add.
  - [ ] A disconnect, destroy or scrub re-points to a hostless remainder instead of deleting the binding.
  - [ ] Re-check the character-cardinality validator in `applyStepSequenceCore` (PR-13): an offline character keeps one hostless remainder, which still satisfies "at most one".
- [ ] **Slice 6. Pointers govern.**
  - [ ] Every member carries a binding; an unbound member is reported, never guessed.
  - [ ] A pointer-versus-cover drift sweep, matching the existing diagnostics sweeps (inline `EventBridgeClient`, per-call DI).
  - [ ] A cover-rebuild heal that reads every member's graph.
- [ ] **Slice 7. Migrate stored bindings,** including room bindings into Areas, per PRm-3.
- [ ] **Forward candidate (unscheduled).** The AcmeOrder spawn's compensating delete in [`spawnImprovisationObjectsBatch.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) exists because "created but not placed" is not a legal state today. Under a hostless remainder it is; schedule it once Slice 5 lands, or shelve it in `AGENT.implementation.md`.
- [ ] **Slice 8. Close.**
  - [ ] Rules into `positions/AGENT.contract.md` and `AGENT.implementation.md`; `AGENT.concepts.md` Target items flip to Shipped.
  - [ ] PR-21's live remainder (its exact encoding) is settled; graduate PR-20 and PR-21 in the presence plan.
  - [ ] Graduation sweep: grep for inbound links to this file, then delete it.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **PRm-1** | **What does the seam return, and how is it derived before `fromHostPresence` is stored?** The sweep's wording --- the parent binding whose cover lists `{ owner, binding }`, otherwise the host's single `Full` binding --- leaves three cases open, all in today's data. No stored cover is `Enumerated`, so the second branch always runs. (1) The parent is a Room in an Area: its only binding is the Area binding, so "single Full" picks it, which is the Slice 2 defect and contradicts PR-21(f). (2) The parent has no binding (a Room with no Area, or another top-level host): there is no binding to name, but the parent host is known. (3) The parent has several bindings (a Feature in two rooms): the data cannot say which, and PR-21(d) says report, never guess. **Recommended:** return `{ host, presence? }`. `host` always comes from `fromHostId`; `presence` is set only when the derivation is unambiguous (a cover lists the binding, or a non-room parent holds exactly one binding). A walker given no `presence` falls back to today's host-grain fan-out, kept in one place. Slice 4 makes `presence` required, the same optional-field-made-required pattern as `groundedId?`. This keeps Slice 1 behavior-preserving and leaves the defect fix to Slice 2. | Slice 1 | Open (recommended) |
| **PRm-2** | **The cover's exact encoding.** PR-21(b) locks the shape, roughly `{ remainder: boolean, members }`, with at most one remainder per whole; the field names, whether it stays a tagged union, and whether a remainder's `members` is stored or always empty are open. | Slice 3 | Open |
| **PRm-3** | **Migration mechanism.** A one-shot script over stored graphs, or heal-on-read through Slice 6's cover-rebuild heal. | Slice 7 | Open |

## Verification

```bash
# Baseline and per-slice tests (from repo root):
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/ dataSource/positions/manipulation/

# After Slice 4: no presence reader still matches on `fromHostId` (port readers remain; check each hit against Slice 0's list).
grep -rn "fromHostId" --include='*.ts' lambda/ephemera/dataSource packages/mtw-interfaces/ts | grep -v test

# Relative links resolve in every touched markdown file (pass the files as arguments).
node -e 'const fs=require("fs"),path=require("path");let bad=0;for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,"utf8");for(const m of t.matchAll(/\]\(([^)#\s]+)(#[^)\s]*)?\)/g)){const p=m[1];if(/^[a-z]+:/.test(p))continue;if(!fs.existsSync(path.resolve(path.dirname(f),p))){bad++;console.log(f+": "+p)}}}console.log(bad?bad+" broken":"links ok")' <files>
```

**Payoff check:** Slice 2's test --- a room-seeded handle's audience is its room --- asserts on the resolved room set, the observable output, not on the cache's intermediate buckets.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Not started |
| 1. The seam | Not started (PRm-1) |
| 2. Extra-bucket defect | Not started |
| 3. Cover type | Not started (PRm-2) |
| 4. Stored `fromHostPresence` | Not started |
| 5. Moves and disconnects | Not started |
| 6. Pointers govern | Not started |
| 7. Migrate stored bindings | Not started (PRm-3) |
| 8. Close | Not started |
