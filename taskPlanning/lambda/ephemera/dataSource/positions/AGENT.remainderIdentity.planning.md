# Remainder identity: implementation

**Status: not started (opened 2026-10-16). Next step: Slice 0 (verify premises, no code). Slices 1-5 wait on [PR-23](AGENT.presence.planning.md#open-decisions-design--plan-only) being decided on Slice 0's findings.**

**Scope in one sentence: give every whole's remainder binding one fixed presence id, so `(host, REMAINDER)` names it without reading the graph, and keep that true through every write.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md), and a sub-plan of [`AGENT.presence.planning.md`](AGENT.presence.planning.md). It records no design: the design question is PR-23, and the forks below are only those needed to build it. **If PR-23 is decided against, delete this plan**; the WML plan's [OD-9](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md#open-decisions-implementation--plan-only) then takes its fallback (the minted id printed, with a `remainder` mark). Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).

**Why now.** The [WML relational-edges plan](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md) needs authors to name a binding, and an edge onto a binding names both the host and the presence id (its OD-3). A minted uuid can't be authored. A fixed remainder id can, and it lets the WML wire leave the remainder unprinted (OD-9 rule 3).

---

## Getting Started

1. **Read the design.** PR-23 in [`AGENT.presence.planning.md`](AGENT.presence.planning.md#open-decisions-design--plan-only): its premise, its three requirements, and its "not to be bundled in" clause. Then [PR-21](AGENT.presence.planning.md#settled-register)(e) (a binding's id is stable for the whole's life), which this plan must not break.
2. **Read the rules it changes**, all in [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path):
   - `cover`: a `Remainder` "may appear in any number of a whole's bindings". This plan tightens that to exactly one.
   - The parent pointer: "nothing guesses a binding". A fixed id isn't a guess, but the clause needs rewording.
   - The single write path. This plan adds no emitter; it changes what existing emitters mint.
   - PR-21(e)'s stable-id clause, and the room rule (a Room or Area keeps one hostless remainder for good).
3. **The code**, under [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) unless noted:
   - **Remainder mint sites:**
     - [`manipulation/membership/executeComponentCreation.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/executeComponentCreation.ts) (birth, `:53`);
     - [`manipulation/membership/resolvePresenceMoves.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/membership/resolvePresenceMoves.ts) (`mintedRootUuid`, `:145`), emitted by `kernel/compile/presenceBindingStepsForMove.ts`;
     - [`manipulation/containment/containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts) (`rootStep`, `:33`, and the mint at `:136`).
     - The handlers in `manipulation/kernel/applyStepSequenceCore.ts` (`:242`, `:283`) take the uuid from the step.
   - **Split and join:**
     - `manipulation/membership/resolvePresenceSplit.ts` mints fresh ids for new bindings, which never hold the Remainder (`splitRemainderMoved`).
     - [`manipulation/kernel/joinPresenceBindings.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/kernel/joinPresenceBindings.ts) merges the Remainder onto the survivor, which keeps its own id.
   - **Type:** [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`EphemeraPresenceCover`, `remainderCover()`, the presence node) and `packages/mtw-interfaces/ts/baseClasses.ts` (`EphemeraPresenceNodeId`, `isEphemeraPresenceNodeId`).
   - **Readers keyed by presence id**, the Slice 0 sweep's starting list:
     - `ludicGraph/presenceSubGraph.ts`, `ludicGraph/wireProjection.ts`;
     - `ludicCache/fold.ts`, `ludicCache/mergeReducer.ts`, `ludicCache/catalogHandles.ts`, `ludicCache/types.ts`.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols.

## What is deliberately out of scope

- **A bare component reference defaulting to its remainder.** Under [PR-15](AGENT.presence.planning.md#settled-register), an edge onto a binding is a different claim from an edge onto the whole (PR-23's "not to be bundled in").
- **WML syntax.** The WML plan's Slice 1 and OD-3 own how `(host, REMAINDER)` is written.
- **Population into a parent with several bindings.** Today it is refused because nothing may guess which parent binding a child sits under. With a fixed id, population could name the parent's remainder, the way WML OD-9 rule 2 reads a directly placed member. That is a behavior change for the presence plan to decide, not a consequence of this one.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here, then carry the summary to PR-23's row for the user to decide.
  - [ ] **(a) Exactly one Remainder holder per whole.** List every way a whole can end up with two bindings that hold a `Remainder`. Known: split refuses to move it, join merges to one, the rehost handler mints only when the mover has no binding, and `rootStep` mints once per run. To check:
    - a thing improvised into two rooms (`applyStepSequenceCore.test.ts:732`'s multi-binding case);
    - [PR-C1](AGENT.presence.corpus.planning.md#pr-c1-the-contraption-in-two-rooms-and-whether-covers-nest)'s contraption;
    - whether any fixture builds two holders on purpose.

    A legitimate two-holder case is a finding against PR-23, not something to work around here.
  - [ ] **(b) Global-uniqueness sweep.** Find every place that keys by a bare presence id across more than one host's graph: sets, maps, cache stitching, catalog handles' `presence`, sweep findings, Dynamo keys, the wire, and the client (`charcoal-client/src`). Classify each as host-qualified already (safe) or needing a fix. The fixes become Slice 3's list.
  - [ ] **(c) Join producers.** Find who chooses a join's survivor, and whether the absorbed binding can hold the Remainder today. This grounds RI-2.
  - [ ] **(d) Id-shape assumptions.** Find anything that parses the value after `PRESENCE#` as a uuid or derives other ids from it, such as `stubPortIdFromEdge` in `presenceSubGraph.ts`, validators, or regexes.
  - [ ] **(e) Stored data.** A read-only count of dev-world presence nodes holding a `Remainder`, and of wholes with more than one holder. Running it is the user's call.
- [ ] **Slice 1. The sentinel and its invariant.**
  - [ ] Add one constant to `ephemeraMeta.ts`, `PRESENCE#REMAINDER` (RI-1) and a helper that builds the remainder binding's key.
  - [ ] The invariant: a binding holds the `Remainder` if and only if its key is the sentinel, and every whole has exactly one. Check it at the end-of-run validator in `applyStepSequenceCore` (beside PM-2's collision check) and in the graph guard.
  - [ ] Unit tests: the guard rejects a sentinel-keyed binding without a `Remainder`, a `Remainder` on a non-sentinel key, and two holders.
- [ ] **Slice 2. Producers mint the sentinel.**
  - [ ] Every mint site from Getting Started step 3 mints the sentinel for a remainder. Split is unchanged.
  - [ ] Join follows RI-2 (a): the producer orders the Remainder holder first so it survives, and `joinPresenceBindings` refuses a join whose absorbed binding holds the Remainder (`joinRemainderAbsorbed`). Test both: a two-binding move where the holder is not first in `presenceMoves` still keeps `PRESENCE#REMAINDER`, and a hand-built step absorbing the holder is refused.
  - [ ] **Payoff test**, through `compilePositionKernelOp`: create a component, place it, move it, split it, join it back, disconnect it. After every step, exactly one binding holds the `Remainder`, it is keyed by the sentinel, and every child pointer naming it still resolves.
- [ ] **Slice 3. Uniqueness fixes** from Slice 0(b). Each fix qualifies the key by host and gets a test where two hosts' remainders meet in one structure (for example, a fold over a room holding a box, both with sentinel remainders).
- [ ] **Slice 4. Migrate stored data** (RI-3: population renames, the existing drift sweep triggers it).
  - [ ] **The rename.** Renaming a whole's remainder key also rewrites:
    - children's `fromHostPresence.presence` that names it;
    - parent cover entries `{ host: <whole>, presence: <old> }`;
    - edges ending at it (`{ owner, port: 'PRESENCE#<old>' }`);
    - cached `ludicCache` rows.

    No kernel step renames a binding today: `repairPresenceBinding` rewrites a pointer and cover but keeps `universalKey`. Use either a new rename step, or existing steps committed as one sequence: mint the sentinel, repair each child to name it, remove the old binding. Decide which when the slice starts.
  - [ ] **Population.** `rootStep` (and the non-room branch's root check) treats a remainder not keyed `PRESENCE#REMAINDER` as drift and emits the rename. A correct root still emits nothing, so a clean rerun commits no transaction.
  - [ ] **Classifier.** `lambda/diagnostics/containmentPopulationDriftSweep/classification.ts` flags such a parent, so `healContainmentPopulation` reaches it.
  - [ ] **Preconditions and deploy gate (the user's):** clear improvised Objects and players; deploy; run `{ type: 'ContainmentPopulationDriftSweep' }` twice, the second reading `emittedCount: 0`. Slice 0(e)'s count says whether anything outside population's reach (a character's own remainder, say) is left holding an old id.
- [ ] **Slice 5. Docs and graduation.**
  - [ ] Contract: the `cover` clause (exactly one `Remainder`), the stable-id clause (a remainder's id is the sentinel), and the "nothing guesses" wording.
  - [ ] `AGENT.implementation.md`: the mint sites.
  - [ ] `AGENT.concepts.md`: vocabulary only, if a term is new.
  - [ ] Graduate PR-23. Update the WML plan's OD-8 and OD-9 (remainder form decided) and its LG-6 rewrite note.
  - [ ] Delete this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **RI-1** | **The sentinel's spelling.** `PRESENCE#REMAINDER` keeps the existing tag, so `isEphemeraPresenceNodeId` and `isPresenceTaggedPortId` accept it unchanged, and it can't collide with a uuid. The WML key form (the WML plan's Slice 1 check (b)) follows whatever is chosen. | 1 | **Decided 2026-10-17 (the user): `PRESENCE#REMAINDER`.** |
| **RI-2** | **Which binding survives a join when the Remainder holder is not the first move.** Join absorbs one binding: its id ends, its children are re-pointed, and the survivor keeps its id. Either choice of survivor satisfies PR-21(e) (corrected 2026-10-17: an earlier draft said swapping roles breaks PR-21(e); it doesn't, because nothing is renamed). Under the sentinel, though, the Remainder holder must be the survivor, or the merged Remainder would sit on a non-sentinel key. Today `presenceBindingStepsForMove` makes the first move's binding the survivor, in `presenceMoves` order. (a) **The producer picks the Remainder holder** as survivor (the resolver or compiler orders it first), and the kernel refuses a join whose absorbed binding holds the Remainder (`joinRemainderAbsorbed`, mirroring split's `splitRemainderMoved`). (b) **The kernel picks**: it ignores the step's order and keeps whichever binding holds the Remainder. (b) silently overrides the producer, so any later step in the same sequence that names the producer's survivor goes stale. | 2 | **Decided 2026-10-17 (the user): (a).** |
| **RI-3** | **How stored remainder ids migrate.** **Population learns the rename, and the existing `ContainmentPopulationDriftSweep` triggers it.** Wiping is ruled out for authored wholes, since Rooms can't be cleared without destroying the CoyoteGame setting; Objects and players can be (the user, 2026-10-17). A re-cache can't do it: `cacheAsset` emits `Component Updated` only for components in its diff (`cacheAsset.ts:59`), so an unchanged room never reaches population. And today's `rootStep` accepts any hostless remainder as a room's root, so even a forced re-cache would commit nothing. **So:** (1) before deploy, the user clears improvised Objects and players; (2) population treats a remainder not keyed `PRESENCE#REMAINDER` as drift and renames it (Slice 4's rename); (3) the drift classifier gains that check, so the existing sweep, which already reaches every Room, Area and Feature parent, finds each one and heals it through population. No new sweep, and no change to `cacheAsset`. | 4 | **Decided 2026-10-17 (the user).** |

## Verification

1. **Suite, from `lambda/ephemera`:** `npm run test -- --watchAll=false dataSource/positions/`, and the full ephemera suite after any rename. Then `npx tsc --noEmit` there and in `packages/mtw-interfaces`.
2. **No uuid remainders left in code:** after Slice 2, `grep -rn "uuidv4" lambda/ephemera/dataSource/positions/manipulation` shows no remainder mint.
3. **Anchor resolution:** every `](Other.md#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Not started |
| 1. Sentinel and invariant | Waiting on PR-23 |
| 2. Producers | Waiting on PR-23 |
| 3. Uniqueness fixes | Waiting on Slice 0(b) |
| 4. Migration | Waiting on Slice 2 |
| 5. Docs and graduation | Not started |
