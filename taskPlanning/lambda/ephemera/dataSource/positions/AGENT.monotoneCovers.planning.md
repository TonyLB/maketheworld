# Monotone covers: implementation

**Status: opened 2026-10-17. Slice 0 done 2026-10-18; MC-1 and MC-2 decided 2026-10-18 (`PRESENCE#Base` and `PRESENCE#Unplaced`). Slice 1 done 2026-10-18; Slice 4 is next, and runs before Slice 2. MC-3 (one presence move replacing move, split, join and release) is open and gates Slice 2, which is drafted in its shape. The design direction is [PR-24](AGENT.presence.planning.md#open-decisions-design--plan-only), decided by the user; [PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only) (a binding's parents are a set) has its direction decided but is not built here, and does not gate Slices 0-3.**

**Scope in one sentence: make every presence cover an explicit list of entries, so no cover means "whatever the other bindings don't list", and route context-free adds to the whole's `PRESENCE#Base` binding.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md), and a sub-plan of [`AGENT.presence.planning.md`](AGENT.presence.planning.md). It records no design: the design is PR-24, and the forks below are only those needed to build it. **It supersedes `AGENT.remainderIdentity.planning.md`** (deleted 2026-10-17; its Slice 0 findings that still apply are carried into Slice 0 below, and its decisions into the table). Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).

**Why.** Prototypes with `Full`, then `Remainder`, kept hitting problems that trace to one property: a `Remainder` cover is a complement (every node no other binding lists), so its meaning changes whenever another binding changes, and it needs a closed world to evaluate. PR-23's fixed remainder id failed for that reason (a whole hosted in several places holds several Remainders), and the same complement shows up in the cache fold, split, join, and the WML printer. The cache already refuses it: `EphemeraLudicCachePresenceNode` has entry-only covers "by construction" ([`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts), PN-19). This plan moves the graph to the cache's shape.

---

## Getting Started

1. **Read the design.** PR-24 in [`AGENT.presence.planning.md`](AGENT.presence.planning.md#open-decisions-design--plan-only) (its five rules), PR-25 (parent sets, decided but not built here), and the superseded PR-23 row for the remainderIdentity findings. Then [PR-21](AGENT.presence.planning.md#settled-register), whose clauses (a) and (b) PR-24 re-opens and whose (c), (f) and (h) it rewords from "hostless remainder" to "hostless binding".
2. **Read the rules it changes**, in [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path): `cover` (a `Remainder` "may appear in any number of a whole's bindings"), the room rule, and the stable-id clause.
3. **The code**, under [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) unless noted:
   - **Type:** [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`EphemeraPresenceCover`, `EphemeraPresenceCoverRemainder`, `remainderCover()`); the WML mirror `StandardLudicGraphPresenceCoverRemainderData` in `packages/mtw-wml/ts/standardize/components/dataTypes/ludicGraph.ts`.
   - **Writers of a `Remainder`:** `manipulation/kernel/applyStepSequenceCore.ts` (`:243`, and `addPresenceBinding`'s default at `:285`); `manipulation/containment/containmentPopulationSteps.ts` (`rootStep`, `:39`); `manipulation/kernel/joinPresenceBindings.ts` (`:62`, keeps it if either side has it); split leaves it on the original binding (`manipulation/membership/resolvePresenceSplit.ts`).
   - **Readers that evaluate the complement:** `ludicGraph/presenceSubGraph.ts` (`unclaimedComponentNodes`, `:44`, used at `:93`); `ludicCache/mergeReducer.ts` (`:384-439`).
   - **The hostless binding today:** `ludicGraph/presenceParent.ts` (`hostlessRemainderOf`, `:70`, a `.find`); used by `resolvePresenceMoves.ts` (`:65`, a move into a destination points at the destination's hostless binding, which is already PR-24 rule 3's routing; `:141`) and `containmentPopulationSteps.ts` (`:28`).
   - **Drift:** `packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts`; `lambda/diagnostics/containmentPopulationDriftSweep/classification.ts` (`isHostlessRemainder`); `manipulation/containment/healPresenceCover.ts` (rebuilds only remainder-free covers from the children's pointers).
   - **Wire:** `ludicGraph/wireProjection.ts` (`:98`, maps a `Remainder` onto the wire).
   - **The cover index:** `manipulation/kernel/settleMembership.ts` and the presence-step handlers in `applyStepSequenceCore.ts` (`movePresenceBinding` `:33`, `releasePresenceBinding` `:73`). They write the child's pointer and the parent's `nodeIds`, never the parent binding's cover (Slice 0(a)).

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols. mtw-wml tests are transpile-only, so check its types with `tsc`.

## What is deliberately out of scope

- **PR-25, when several parents share one binding.** Today a binding has one parent pointer, so a ring on a Table that is also a member of Rings of Power (bound into the Room) holds two bindings. The user decided 2026-10-17 that a binding's parents become a set ([PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only), [PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice)); no plan builds it yet. This plan builds monotone covers over today's one-pointer bindings and does not change that.
- **A bare component reference defaulting to a binding.** Under [PR-15](AGENT.presence.planning.md#settled-register), an edge onto a binding is a different claim from an edge onto the whole.
- **WML syntax.** The [WML relational-edges plan](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md) owns how the hostless binding is written; Slice 6 only updates its pointers.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [X] **(a) Every producer that relies on a `Remainder`.** Start from the Getting Started lists. For each, say whether the add has context naming a binding (a move, a split, an authored placement) or is context-free (it then routes to the hostless binding, rule 3), and what it writes instead. Include every place that adds a component node to a graph without touching a cover, since today the Remainder covers it silently.
    - **Writers of a `Remainder`** (paths under `manipulation/`):
      - `createComponent` (`kernel/applyStepSequenceCore.ts:243`): context-free, the new whole's own hostless binding. It writes `{ members: [] }`, because a new component has no members.
      - `addPresenceBinding`'s default (`:285`), reached three ways:
        - `rootStep` (`containment/containmentPopulationSteps.ts:35-39`): context-free, a parent's first binding. It writes every current member of the parent, computed once at write time.
        - Population placing a child (`:131-137`): with context. The child's first binding writes its current members. A non-first binding writes `[]`, like the room's Area carve-out (`:115`).
        - `mintedRootUuid` (`kernel/compile/presenceBindingStepsForMove.ts:29`): a context-free mint, then a move with context. It writes every current member of the mover.
      - Join (`kernel/joinPresenceBindings.ts:62`): writes the union of both sides' entries and drops the merged `Remainder`.
      - Split (`membership/resolvePresenceSplit.ts`, `kernel/splitPresenceBinding.ts:50`):
        - It already writes entries. The `Remainder` stays on the original binding.
        - `memberNotCovered` refuses any member reached only through the `Remainder`, which today is every member in practice.
        - **No production caller:** only `positionKernelOp.ts`'s types and tests reach it.
    - **The cover index, the main finding.** No presence step adds an arriving child to its parent binding's cover, or removes a departing child from it.
      - `movePresenceBinding` (`:33-66`), `addPresenceBinding` with a pointer, `repairPresenceBinding` and `releasePresenceBinding` (`:73-90`), through `kernel/settleMembership.ts:85-87`, write only the child's pointer and the parent's `nodeIds`.
      - Today a parent's `Remainder` covers the arrival without being told. A remainder-free parent goes `Stale` until `healPresenceCover` rebuilds it from the pointers.
      - `settleMembership` is the only production `addNode` (`ludicGraph/index.ts:507`), so every component node a whole gains arrives through these steps.
      - So Slice 2 adds an index write to each step: an entry onto the `to` binding's cover, and off the `from` binding's. The footprint already locks both hosts for every non-bystander presence step (`kernel/computeStepSequenceFootprint.ts:51-69`), so no step shape or footprint changes.
      - Bystanders are exempt: they never touch the room graph (rule 5, (b)).
    - **Hostless lookups key on the `Remainder`.** `hostlessRemainderOf` (`ludicGraph/presenceParent.ts:70-74`) and diagnostics' `isHostlessRemainder` (`classification.ts:11-14`) find a hostless binding only if its cover holds a `Remainder`.
      - Once covers are entries only, both must mean "the binding with no parent pointer".
      - Otherwise room roots read as missing (`destinationBindingMissing`), and `rootStep` mints a second one.
    - **Overlap (the PR-25 caveat).** No producer lists a member in two of one whole's bindings unless the member holds a separate binding for each.
      - Split refuses `splitNotDisjoint`. The join planner refuses `joinChildrenCollide`. The heal lists a member only under the binding its pointer names.
      - The one exception is implicit and is already drift: two `Remainder` bindings both cover every unclaimed member, and `classifyPresenceCoverDrift` reports `Stale` for the one the member doesn't point at.
      - That `Stale` finding is report-only, because `coverRebuildsFor` skips `Remainder` bindings.
      - "A non-first binding writes `[]`" removes this case. It is forced by PR-21's "the pointer governs; the cover is its index", so it is not a decision.
    - **MC-1:** no producer reaches the case except as a refusal, which is option (a) today.
      - Population skips a parent with several bindings (`:108-111`).
      - `destinationBindingOf` refuses with `destinationBindingAmbiguous` (`membership/resolvePresenceMoves.ts:77-81`).
      - Rooms and Areas always hold a hostless binding.
  - [X] **(b) Characters.** Confirm how a room's cover reaches its present characters today (the cache walk includes them, `ludicCache/types.ts:180-183`; check whether through the room's `Remainder` expansion or the characters row), and where rule 5's "the room's hostless binding covers every character in the row" is computed.
    - **Neither: bystanderSeparation already ships rule 5's storage.**
      - The room graph holds no character node (`settleMembership.ts:36-38`; `ludicCache/enumerateShards.ts:11-17`), so the room's `Remainder` covers none.
      - The characters row indexes bystanders.
      - The contract says "A bystander is not in its room's graph or cache".
      - Readers union the row in at read time (`ludicCache/roomObjectContents.ts:55,86`).
    - So rule 5 already holds: the hostless binding's coverage of characters is the row, read beside the cache, and arrivals write only the row.
    - Slice 3 as first written would have put characters into the room cache, against that contract. It is rewritten below.
    - The `types.ts:180-183` comment ("a present character included") is stale for a room-seeded walk.
  - [X] **(c) Hostless bindings.** Who mints a hostless binding (`createComponent`, `rootStep`, the rehost of a root), whether a non-room whole can hold one today, and whether anything can produce two on one whole. This grounds rule 3's "at most one".
    - **Minted by:**
      - `createComponent` (`:240-244`);
      - `rootStep`: a Room or Area without one, or any other parent with no binding at all;
      - `mintedRootUuid`: a mover with no binding under its `from` hosts and no hostless binding;
      - `releasePresenceBinding`, when it strips the pointer from a whole's last binding (`:85-89`).
    - A non-room whole holds one while unplaced or offline: an unplaced Feature or Object, a created Object before its first placement, an offline character.
    - **Two on one whole can happen today:**
      - Splitting a hostless binding gives its additions no pointer (`splitPresenceBinding.ts:77`).
      - `mintedRootUuid` can mint beside a hostless binding that holds no `Remainder`, because `hostlessRemainderOf` doesn't see it.
      - Nothing objects: the transient-duplicate guard skips hostless bindings (`applyStepSequenceCore.ts:446-470`).
    - So rule 3's check runs at the end of the run. A split of the hostless binding followed by placing one side legitimately passes through two.
  - [X] **(d) Carried from remainderIdentity's Slice 0** (verified 2026-10-17, citations rechecked 2026-10-18; use them for the fixed hostless id in Slice 4):
    - Id shape: the suffix after `PRESENCE#` is opaque everywhere: `isEphemeraTaggedId` (`baseClasses.ts:33`), `isPresenceTaggedPortId` (`ephemeraMeta.ts:293`), `PresenceKey` (`mtw-utilities/ts/types.ts:46`), `stubPortIdFromEdge` (`presenceSubGraph.ts:160`) and `presenceUuidFromKey` (`fold.ts:64`). The one constraint is no `#` in it.
    - Uniqueness: nearly every reference is host-qualified. Two need fixing for a shared id:
      - `ephemeraLudicTerminalsEqual` (`ephemeraMeta.ts:325-334`) ignores `owner` for a bare terminal against an address (`:329-331`).
      - `ludicCache/catalogHandles.ts` `addBucket` (`:57-60`) dedupes by bare `presence`.
    - Guard tests only:
      - `fold.ts` (`:136`);
      - `mergeReducer.ts` (the bindings-by-owner map);
      - `applyStepSequenceCore.ts`'s collision check;
      - `computeStepSequenceFootprint.ts`;
      - `ludicCache/types.ts` `bindingsByOwner` (`:188`);
      - mtw-wml `standardize/components/ludicGraphNodeList.ts`.
  - [X] **(e) Stored data.** A read-only count of dev-world bindings whose cover holds a `Remainder`, and of wholes with more than one hostless binding. No script exists; the nearest pattern is `presenceCoverDriftSweep/index.ts` (injectable `listCandidateRows`). Running it is the user's call.
    - **Counted by the user, 2026-10-18:** five Rooms and one character hold a `Remainder`. There are no Objects, because the user removed them all.
    - A second hostless binding can't be among these:
      - The two paths that make one are a split of a hostless binding (split has no production caller) and `mintedRootUuid` beside a hostless binding without a `Remainder` (every stored hostless binding holds one).
      - The end-of-run check caps a character at one binding.
    - So Slice 5 migrates six bindings.
- [X] **Slice 1. The coverage invariant.** Every component node of a whole is covered by at least one of its bindings, and a whole has at most one hostless binding. Both are checked on the whole's own graph: in the end-of-run validator in `applyStepSequenceCore` and in `classifyPresenceCoverDrift` (new kinds for an uncovered member and a second hostless binding). Both run at the end of the run, like the transient-duplicate guard, because a split of a hostless binding passes through two (Slice 0(c)). "Hostless" means no parent pointer, not `hostlessRemainderOf`'s "no pointer and a `Remainder`". The hostless check is the transient-duplicate guard's rule (no two of a child's bindings under one parent binding, `applyStepSequenceCore.ts:446-470`) extended to "no parent", so build it there rather than as a second check (MC-3's invariant). While `Remainder` still exists it counts as covering, so this slice changes no behavior. Unit tests for each kind.
  - **As built (2026-10-18):**
    - **One definition.** `coverageViolationsOf(whole)` in `packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts` (returns `uncovered` members and, when there are several, `hostlessBindings`). It is used by the end-of-run validator in `applyStepSequenceCore` (it throws, like the duplicate guard, and checks only graphs the run wrote) and by `classifyPresenceCoverDrift`, which gains the report-only kinds `Uncovered` and `SecondHostless` (the sweep's `healable` still comes only from `coverRebuildsFor`).
    - **Not behavior-neutral for fixtures.** A `Remainder` does cover every unlisted member, so no real binding fails. But 29 tests built a host with no binding at all, or no root binding, that then gained a member; the check rightly rejects that (the user chose to fix the fixtures, not scope the check to wholes with a binding). Fixed by giving each such host its conventional root binding in `applyStepSequenceCore`, `commitStepSequence`, `executeMembershipTransfer` and `applyObjectRelationalChange` tests and `crossingTakePayoff.integration.test.ts`; three drift-classifier fixtures gave a carve-out binding no pointer, so they read as a second hostless binding, and now point at a parent.
    - **Production reading:** every failure was a fixture; no production path was found that leaves a whole with members and no covering binding. Slice 0(c) still holds that `createComponent`/`rootStep` mint the root first.
    - Slice 4's "Slice 1's check gains: exactly one Base, and Unplaced only while Base has a position" extends `coverageViolationsOf`'s hostless count; it needs no new check site.
- [ ] **Slice 2. Producers write explicit entries.** Each producer from Slice 0(a) writes the entries it means: an add with context names its binding, a context-free add lands in `PRESENCE#Base` (MC-1), and a cover divided or merged writes each side's members as explicit entries (a complement computed once at write time is fine; it's evaluating one at read time that this plan removes). `addPresenceBinding` loses its `remainderCover()` default. **Drafted in MC-3's shape (Open):** the moves, splits, joins and releases become one presence move (2a), and the remaining producers follow (2b). If MC-3 is declined, 2a instead adds the index writes and the Base and Unplaced transitions to each of today's four steps.
  - [ ] **Slice 2a. One presence move (MC-3).** One kernel step, `movePresenceBinding` given an optional `subCover`, replaces `splitPresenceBinding`, `joinPresenceBindings` and `releasePresenceBinding` (`kernel/kernelStep.ts:139-196`):
    - **The move.** It takes the whole of a binding, or the `subCover` part of its cover, to a destination parent binding or to no parent. If the child has no binding under that destination, the move mints one (or re-points the binding, when it takes the whole). If the child already has one there, the moved entries join it, and a binding moved whole is removed. A `subCover` move leaves the source binding in place, even with an empty cover. A move never adds a parent to a binding (MC-3's temporary answer, until PR-25 builds parent sets).
    - **The cover index.** The same step writes the parent covers: an entry onto the destination parent's cover when a binding arrives there, and off the old parent's when one leaves. This retires today's gap, where steps write only the child's pointer and the parent's `nodeIds` (Slice 0(a)). Bystanders are exempt.
    - **Children re-point, and collisions merge.** Each moved entry is a child's binding, so it re-points to the binding that now covers it. A child that ends up with two bindings under that binding has them merged by the same move one level down, so the merge repeats until no collision is left. That ends, because the host graph is a DAG. This retires the planner's `joinChildrenCollide` refusal (`membership/resolvePresenceMoves.ts:130-134`). The planner reads down the chain to name the footprint, and the kernel re-verifies under the lock, so a stale read is `stale`.
    - **Base and Unplaced (MC-1).** When a merge involves Base, Base survives (RI-2), and moving part of Base's cover away leaves Base in place. A move to no parent lands in Base if Base is hostless, otherwise in `PRESENCE#Unplaced`, minting it if needed. So:
      - placing a hostless Base with part of its cover leaves the rest in a new Unplaced;
      - Base moved to no parent absorbs Unplaced;
      - a release (a binding losing its parent) goes to Unplaced, never into a placed Base. Folding the binding into Base would attach its contents to a context nobody wrote, which is how a default `Remainder` fails in [PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice)'s beat 1.
    - **Callers.** The membership planner's "several moves, then a join" becomes several moves into one destination. Split has no production caller (Slice 0(a)), so only its tests move. `mintedRootUuid`'s mint before a move (`kernel/compile/presenceBindingStepsForMove.ts:29`) retires, because the move mints.
    - Unit tests for each case: a whole moved, a part moved, a mint, a join, a repeated merge two levels deep, a move to no parent with Base placed and with Base hostless, and a `subCover` move that empties its source binding and leaves it in place.
  - [ ] **Slice 2b. The remaining producers.**
    - **The cover index for the other pointer writes.** `addPresenceBinding` and `repairPresenceBinding`, when given a pointer, write the parent binding's cover the way 2a's move does.
    - **What a mint writes.** A whole's first binding writes its current members. A non-first binding writes `[]`.
    - **Hostless lookups.** `hostlessRemainderOf` and `isHostlessRemainder` become "the binding with no parent pointer", and are renamed to say so. A context-free add looks up Base by its id instead (Slice 4).
    - **Payoff test**, through `compilePositionKernelOp`: create, place, move, move part away, move it back, disconnect. After every step:
      - no binding holds a `Remainder`;
      - the Slice 1 invariant holds, and Base exists;
      - each parent's cover lists its arrivals without a `healPresenceCover` run.
- [ ] **Slice 3. Bystanders (probably docs-only; the user confirms).** The room's hostless binding covers its explicit entries plus every character in the characters row, unconditionally. Overlap with the room's other bindings is allowed; "characters no other binding lists" would bring the complement back. Arrivals and departures still write only the characters row.
  - Slice 0(b) found this storage already shipped: the coverage is the row read beside the cache. The cache is unchanged, because "A bystander is not in its room's graph or cache" stays.
  - What is left:
    - The coverage invariant leaves bystanders out. They are not nodes, so no code changes.
    - Fix the stale comment at `ludicCache/types.ts:180-183`.
    - In Slice 7, the contract's bystander clause changes "the room's `Remainder` cover lists no entry for it" to name the hostless binding and the row.
- [ ] **Slice 4. Fixed ids `PRESENCE#Base` and `PRESENCE#Unplaced`** (MC-2). Runs before Slice 2, which routes by Base's id. Each is unique per whole by construction.
  - `createComponent` and `rootStep` mint Base. `mintedRootUuid` keeps minting a fresh id, because Base already exists by then (until Slice 2a retires it). Unplaced is minted by Slice 2a's move to no parent.
  - Until Slice 5 migrates stored data, a whole with no Base id reads its hostless binding as Base, or its only binding if it has no hostless one. Slice 5 retires that fallback.
  - Slice 1's check gains: exactly one Base, and Unplaced only while Base has a position.
  - The Slice 0(d) uniqueness fixes, each with a test where two hosts' Base bindings meet in one structure (a fold over a room holding a box).
- [ ] **Slice 5. Migrate stored data** (RI-3, carried): population treats a `Remainder` cover, or a whole with no `PRESENCE#Base`, as drift; it expands the `Remainder` to explicit entries (from `unclaimedComponentNodes`, once) and renames the `Remainder` holder to Base (every stored holder is its whole's original binding; the six from Slice 0(e) need no Unplaced), rewriting children's `fromHostPresence`, parent cover entries, edges ending at it, and cached `ludicCache` rows. The drift classifier gains both checks so the existing `ContainmentPopulationDriftSweep` reaches them. **Deploy gate (the user's):** clear improvised Objects and players; deploy; run the sweep twice, the second reading `emittedCount: 0`.
- [ ] **Slice 6. Remove `Remainder`.** Delete `EphemeraPresenceCoverRemainder`, `remainderCover()`, the WML mirror, `unclaimedComponentNodes`' complement use, and the cache's Remainder expansion; the graph-side cover type becomes entries only, like the cache's. Full ephemera suite plus `tsc` in mtw-interfaces, mtw-wml, mtw-gateways.
- [ ] **Slice 7. Docs and graduation.**
  - [ ] Contract: the `cover` clause (entries only, coverage invariant), the Base and Unplaced clause (Base always exists and takes context-free adds; Unplaced only while Base has a position; at most one hostless binding; the join, split and release rules), the presence-move clause if MC-3 is adopted (one move step, and no two of a child's bindings under one parent binding or under no parent, even inside a run), the room rule, the bystander source.
  - [ ] `AGENT.implementation.md`: the producers and their routing.
  - [ ] Graduate PR-24, and update [PR-21](AGENT.presence.planning.md#settled-register) (a), (b), (c), (f), (h). Update the WML plan's OD-3, OD-8 and OD-9 (they depend on PR-23, which this plan supersedes).
  - [ ] Delete this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **MC-1** | **A context-free add to a whole with no hostless binding and several bindings.** (a) Refuse, so the author or action must name one; (b) mint a hostless binding on the whole and add there. Today population refuses parents with several bindings, which is (a). **Slice 0(a) (2026-10-18):** no producer reaches the case except as a refusal. Population skips the parent, `destinationBindingOf` refuses with `destinationBindingAmbiguous`, and Rooms and Areas always hold a hostless binding. Today is (a) throughout. **Decided 2026-10-18 (the user): neither; the case can't arise.** Every whole always holds `PRESENCE#Base`, which takes every context-free add whether or not it has a position, and an optional hostless `PRESENCE#Unplaced` holds contents explicitly unplaced while Base has a position (PR-24 rule 3, refined). Accepted cost: when a whole has several bindings and Base has a position, a context-free add lands wherever Base is. | 2 | **Decided 2026-10-18 (the user)** |
| **MC-2** | **The fixed id's spelling.** RI-1 chose `PRESENCE#REMAINDER` (the user, 2026-10-17) when it named the remainder; it now names the hostless binding, which is no longer a remainder. **Decided 2026-10-18 (the user):** two ids, `PRESENCE#Base` and `PRESENCE#Unplaced` (MC-1). | 4 | **Decided 2026-10-18 (the user)** |
| **MC-3** | **One presence move in place of move, split, join and release** (proposed by the user 2026-10-18). A move takes a binding, or a `subCover` part of its cover, to a destination parent binding or to no parent. It mints a binding there if the child has none, and otherwise joins the moved entries into the existing one. Children re-point, and a child left with two bindings under one parent binding has them merged by the same move one level down. Base survives every merge, and a move to no parent lands in Base if Base is hostless, otherwise in Unplaced. A release goes to Unplaced, not into a placed Base ([PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice) beat 1). **The invariant it builds in:** no two of a child's bindings are under one parent binding, counting "no parent" as one. That is today's transient-duplicate guard (`applyStepSequenceCore.ts:446-470`), now holding inside a run too, and rule 3 is its hostless case. It is PR-25's parent-set rule in the case where each binding has one parent. **Temporary answer for parent sets (the user, 2026-10-18; holds until PR-25 is built):** a move only moves entries, and never adds the moved binding's parent to another binding. A move with no `subCover` moves the binding itself. If the child already has a binding at the destination, the moved binding's entries join it and the moved binding is removed, so its old parent loses the child. Otherwise the binding is re-pointed. A move with a `subCover` moves entries only, and the source binding stays even if its cover ends up `[]`, because an empty cover is meaningful (PR-C5 beat 1's "the chest, nothing inside it"; Base; a non-first mint). So a binding leaves its parent only through an explicit move of the whole binding. **Left for PR-25:** under parent sets, the binding already at P may also have parent Q, so moving into it would show the entries under Q, and a sharing write (a join of bindings with different parents) is not a move. Building parent sets must extend the move to handle both, with [PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only). **If declined:** Slice 2a adds the index writes and the Base and Unplaced transitions to each of today's four steps, and keeps the `joinChildrenCollide` refusal. | 2 | **Open** |
| **RI-2** | **Join survivor when the Remainder holder is not first.** **N/A under PR-24:** no binding holds a `Remainder` after Slice 2, and two hostless bindings can't be joined because a whole has at most one. **Re-answered by MC-1 (2026-10-18):** Base always survives a join, including Unplaced joining into Base. | 2 | **Decided 2026-10-18 (the user)** |
| **RI-3** | **How stored ids migrate.** Population learns the rewrite and the existing `ContainmentPopulationDriftSweep` triggers it; Rooms can't be wiped (CoyoteGame setting), improvised Objects and players can. A re-cache can't do it (`cacheAsset` emits `Component Updated` only for components in its diff). Carried to Slice 5, now covering the `Remainder` expansion as well as the rename. | 5 | **Decided 2026-10-17 (the user)** for the rename; the expansion rides the same path |

## Verification

1. **Suite, from `lambda/ephemera`:** `npm run test -- --watchAll=false dataSource/positions/`, and the full ephemera suite after any rename or delete. Then `npx tsc --noEmit` there and in `packages/mtw-interfaces`, `packages/mtw-wml` and `packages/mtw-gateways`.
2. **No complement left:** after Slice 6, `git grep -n "Remainder'" -- '*.ts'` finds no cover sentinel.
3. **Anchor resolution:** every `](Other.md#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Done 2026-10-18; (e) counts five Rooms and one character with a `Remainder` |
| 1. Coverage invariant | Done 2026-10-18; shared `coverageViolationsOf`, 29 fixtures given root bindings |
| 2a. One presence move | Waiting on MC-3 and Slice 4; drafted in MC-3's shape |
| 2b. Remaining producers | Waiting on Slice 2a |
| 3. Bystanders | Rewritten per 0(b); probably docs-only, the user confirms |
| 4. Fixed ids (Base, Unplaced) | Ready after Slice 1; runs before Slice 2 |
| 5. Migration | Waiting on Slices 2b and 4 |
| 6. Remove `Remainder` | Waiting on Slice 5 |
| 7. Docs and graduation | Not started |
