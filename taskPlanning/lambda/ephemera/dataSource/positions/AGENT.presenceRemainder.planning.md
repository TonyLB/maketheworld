# Presence remainder: implementation

**Status: in progress. Slices 0-1 done 2026-10-11. Next step: [Slice 2](#recommended-order) (the extra-bucket defect).** Opened 2026-10-11, as soon as PR-21 was Locked. **Why now (the user, 2026-10-11):** the `fromHostId` -> `fromHostPresence` migration is the largest part of this change and only grows with each feature added before it; and until a direct-to-presence parent path exists, new code has to walk binding-to-host, which is the debt this design removes.

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
4. **The doc corrections are done.** The design plans and present-tense docs were corrected 2026-10-11 (rows amended, false "rooms are never members" claims fixed, the remainder model marked unbuilt); nothing here waits on them.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/ dataSource/positions/manipulation/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols.

## What is deliberately out of scope

- **PR-21's exclusions:** the bucket-split primitive for placement (PR-12, PR-14); things bound directly into an Area; apprehension scale.
- **Doc corrections** to the design plans and present-tense docs: done 2026-10-11. This plan updates the contract and implementation docs only as its own slices ship.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [X] **Classify every reader.** `grep -rn "fromHostId\|presenceNodes" --include='*.ts' lambda/ephemera/dataSource packages/mtw-interfaces/ts | grep -v test` hits 35 files (135 lines), most of them crossing-port or transfer `fromHostId`, not presence. List each presence reader here, so Slice 4 has a complete target list. Known so far beyond Getting Started step 3: `actions/enrich/objectManipulation/synthesize/findRelationalChain.ts` (a presence node read as a port's owner).
    - **Answer (2026-10-11).** Presence readers, Slice 4's target list (beyond Getting Started step 3's walkers and writers): `ludicGraph/presenceSubGraph.ts` (lookups at the `presenceNodes.find`, the exterior-address node built from `ephemeraLudicTerminalOwner`, and the holder scan), `ludicGraph/index.ts` (`presenceNodes` getter, `addPresenceNode`, `removePresenceNode`), `kernel/kernelStep.ts` (the add/remove binding step types carry `fromHostId`), `ludicCache/mergeReducer.ts:462` (copies `fromHostId` onto cache nodes), `ludicCache/types.ts:169-172` (guard), `ludicCache/catalogHandles.ts`, `ludicCache/roomObjectContents.ts` (cover readers; unaffected until Slice 3), `ephemeraMeta.ts:422` (type) and its guard. **Not `fromHostId` readers:** `findRelationalChain.ts:96` reads only `universalKey` off the presence node, so Slice 4 does not touch it; `publishedEvents.ts`, `interactionUnderTransfer.ts` and `ludicGraph/baseClasses.ts` mention `presenceNodes` only in retirement comments. **Port or transfer `fromHostId`/`fromHostIds`, excluded:** `healLudicGraphPortMismatch.ts`, `findRelationalChainsForRemoval.ts`, `buildCrossingLegs.ts`, `parsePlanStep.ts`, `executor.ts`, `commitAttempt.ts`, `planObjectMoveTransfer.ts`, `buildObjectMoveOp.ts`, `compilePositionKernelOp.ts`, `commitStepSequence.ts`, `factsForStep.ts`, `computeStepSequenceFootprint.ts`. **Fixtures:** 43 test files mention `fromHostId`; Slice 4 migrates those that build presence nodes.
    - **Found:** `ludicCache/fold.ts:144` uses `.find` on a child's bindings, so it takes the first binding of a multi-binding parent without saying so. Slice 4 must replace it; the seam leaves `presence` unset for a multi-binding parent (never guess).
  - [X] **Count multi-`Full` parents.** Find stored hosts with more than one presence binding --- for example a Feature authored into several rooms in `packages/mtw-wml/ts/*.wml` --- and the test fixtures that build one. This grounded the seam's multi-binding case.
    - **Answer (2026-10-11).** Authored: none. The only WML with Rooms and Features, `packages/mtw-wml/ts/dungeon.wml`, places `orc` and `pie` in one room each. Multi-binding comes only from improvised Objects, which is legal by design (`applyStepSequenceCore.test.ts:732`). Fixtures that build one: `ludicCache/fold.test.ts` (`objZ`), `ludicCache/roomObjectContents.test.ts:76`, `ludicCache/catalogHandles.test.ts:210`, `applyStepSequenceCore.test.ts:732`, `wireProjection.test.ts:106`. Stored dev-world data was not sampled; that remains the user's to check if wanted. So the multi-binding case is real but exercised only by fixtures. Area-hosted-room binding fixtures exist only in the containment tests (`containmentPopulationSteps.test.ts`, `populateContainmentAtCache.test.ts`); no walker or cache test has one, which Slice 1 adds.
  - [X] **Order against [`AGENT.authoredObjectPopulation.planning.md`](AGENT.authoredObjectPopulation.planning.md).** It widens the same population emitter to Objects. Decide which lands first; whichever is second adopts the other's emitter shape.
    - **Answer (2026-10-11).** Both edit `containmentPopulationSteps.ts`: that plan widens the id filter and adds a re-cache guard (AO2), while Slice 4 here rewrites the binding idempotency check at `:65`. **Decided (the user, 2026-10-11): Slices 1-4 here, then [`AGENT.authoredObjectPopulation.planning.md`](AGENT.authoredObjectPopulation.planning.md), then Slices 5+.** Reason: that plan governs *which components* get authored into a presence, not *how* a binding is represented, so it can build on the settled `fromHostPresence` emitter, and AO2's re-cache guard is then written once, after Slice 5's re-pointing is the only remaining open question for it to account for.
- [X] **Slice 1. The seam.** Add one accessor in `ludicGraph/`, roughly `parentBinding(owner, binding, getGraph)`. Move `roomsForHost`, `roomsForPresenceNode` and `hasPresenceAncestor` onto it. From then on new code has a direct-to-presence parent path, and Slice 4 swaps the accessor's implementation instead of chasing call sites. **Observed 2026-10-11, while correcting the docs:** the two walkers already differ over a room: `roomsForHost` treats a room as a terminal, while `hasPresenceAncestor` follows the room's Area binding and so counts Areas among a host's ancestors. Decide in this slice whether the shared accessor keeps both behaviors (a room-stop option) or unifies them; its one caller, `planObjectMoveTransfer.ts`, shows which is needed.
  - [X] Behavior-preserving: the existing `presenceRooms.test.ts` and `presenceAncestry.test.ts` pass unchanged.
  - [X] New unit tests for the accessor, including the first fixture with an Area-hosted room and a parent with two bindings.
    - **Done 2026-10-11.** Room-stop stayed a walker policy, not an accessor option: `roomsForHost` stops at rooms, `hasPresenceAncestor` still follows into Areas (unifying would change nothing for its one caller, which asks about an Object ancestor, but is a behavior change; revisit if the extra reads matter). The accessor is [`ludicGraph/presenceParent.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceParent.ts); `presence` derivation is opt-in (`resolvePresence`) and unused by the walkers until Slice 2/4. Rule recorded in `positions/AGENT.implementation.md`.
- [ ] **Slice 2. The extra-bucket defect.** A room-seeded cache gives each room member a bucket `{ host: <room>, presence: <room's Area binding> }`, which resolves to no rooms (verified by reading, 2026-10-11). Fold a room's Area bindings as carve-outs with empty member lists, per PR-21(f).
  - [ ] Payoff test: a room-seeded `ludicCacheObjectHandles` handle's `presence` resolves, through `roomsForReferent`, to exactly that room.
- [ ] **Slice 3. The cover type.** A remainder flag replaces `Full`, encoded per PRm-2, with at most one remainder per whole.
  - [ ] Type and guards: `ephemeraMeta.ts`, `ludicCache/types.ts`; wire: `wireProjection.ts`.
  - [ ] `Full` in shipped docs: [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md), [`AGENT.ludicCacheRebuild.planning.md`](AGENT.ludicCacheRebuild.planning.md), [`lambda/ephemera/AGENT.caching.planning.md`](../../../../../lambda/ephemera/AGENT.caching.planning.md), [`AGENT.designVariant.performance.md`](../../../../AGENT.designVariant.performance.md).
- [ ] **Slice 4. Stored `fromHostPresence`.** An optional `fromHostPresence: { host, presence }` replaces `fromHostId` on presence nodes.
  - [ ] Writers name the parent binding. Population applies the room rule: a room's remainder is always hostless, and its Area bindings are carve-outs with empty member lists.
  - [ ] `parentBinding` reads the stored pointer; the derivation is retired.
  - [ ] Every presence reader from [Slice 0's recorded list](#recommended-order) moves over, including `containmentPopulationSteps`'s idempotency check and the fold's `memberBindings` filter.
- [ ] **Slice 5. Moves and disconnects.** Starts after `AGENT.authoredObjectPopulation.planning.md` lands (ordering decided in Slice 0).
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
  - [ ] Re-read [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md)'s "room boundary" statements (the *Earned below the room, aspirational above it* row, clause 3's note, the *room-boundary warning*, and the *Not modelled* line "whether Room or Area belong in the part-of ladder at all"). Room-in-Area `PartOf` population has shipped since 2026-09-05, so "at all" is arguably answered for Room-in-Area. Left unedited by the 2026-10-11 doc corrections because deciding it is a judgment, not a false-premise fix; settle it here with the user.
  - [ ] PR-21's live remainder (its exact encoding) is settled; graduate PR-20 and PR-21 in the presence plan.
  - [ ] Graduation sweep: grep for inbound links to this file, then delete it.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **PRm-2** | **The cover's exact encoding.** PR-21(b) locks the shape, roughly `{ remainder: boolean, members }`, with at most one remainder per whole; the field names, whether it stays a tagged union, and whether a remainder's `members` is stored or always empty are open. | Slice 3 | Open |
| **PRm-3** | **Migration mechanism.** A one-shot script over stored graphs, or heal-on-read through Slice 6's cover-rebuild heal. | Slice 7 | Open |

## Verification

```bash
# Baseline and per-slice tests (from repo root):
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/ dataSource/positions/manipulation/

# After Slice 4: no presence reader still matches on `fromHostId` (port readers remain; check each hit against Slice 0's recorded list).
grep -rn "fromHostId" --include='*.ts' lambda/ephemera/dataSource packages/mtw-interfaces/ts | grep -v test

# Relative links resolve in every touched markdown file (pass the files as arguments).
node -e 'const fs=require("fs"),path=require("path");let bad=0;for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,"utf8");for(const m of t.matchAll(/\]\(([^)#\s]+)(#[^)\s]*)?\)/g)){const p=m[1];if(/^[a-z]+:/.test(p))continue;if(!fs.existsSync(path.resolve(path.dirname(f),p))){bad++;console.log(f+": "+p)}}}console.log(bad?bad+" broken":"links ok")' <files>
```

**Payoff check:** Slice 2's test --- a room-seeded handle's audience is its room --- asserts on the resolved room set, the observable output, not on the cache's intermediate buckets.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | Done 2026-10-11 |
| 1. The seam | Done 2026-10-11 |
| 2. Extra-bucket defect | Not started |
| 3. Cover type | Not started (PRm-2) |
| 4. Stored `fromHostPresence` | Not started |
| 5. Moves and disconnects | Not started |
| 6. Pointers govern | Not started |
| 7. Migrate stored bindings | Not started (PRm-3) |
| 8. Close | Not started |
