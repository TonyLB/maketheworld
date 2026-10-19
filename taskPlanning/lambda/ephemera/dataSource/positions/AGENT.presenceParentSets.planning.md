# Presence parent sets: implementation

**Status: opened 2026-10-19. Slice 0 done 2026-10-19. Slice 1 done 2026-10-19 (stored rows healed). Slice 2 done 2026-10-19 (readers set-aware). Slice 3 done 2026-10-19 (invariant stated positively; add/repair steps carry parent sets). Slice 4 is next, gated on PS-2 (the move's `from` and the sharing step) and PS-3. PS-2 through PS-4 are Open; PS-3 and PS-4 are the user's to decide.**

**Scope in one sentence: a presence binding names a *set* of parent bindings rather than one, so the presence structure inside the ludicNetwork is a DAG rather than a forest rooted at hostless bindings, and a thing that sits identically under several parents holds one binding instead of copies.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md), and a sub-plan of [`AGENT.presence.planning.md`](AGENT.presence.planning.md). It records no design: the design is [PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only) (direction decided by the user 2026-10-17), and the forks below are only those needed to build it. Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).

**Why.** Monotone covers ([PR-24](AGENT.presence.planning.md#settled-register), shipped 2026-10-18) made a binding identified by what it covers. With one parent pointer, a thing whose cover is the same under two parents must hold two identical bindings, and every later write to it must be doubled. That is the pairing this plan completes. The single pointer already costs in play ([PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice) beat 3): "take the die out of the backgammon set" is refused as `moverBindingAmbiguous`, or, narrowed to one bucket, moves one of the die's two bindings and leaves the die both in hand and in the set.

---

## Getting Started

1. **Read the design.** [PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only) in full: the positive inherited-arity rule, "sharing is stored, never inferred", the 2026-10-17 code survey (i)--(iii), and the two decided rules (a move out of host H removes every parent on H; a join of differing-parent bindings unions parent sets and a split that divides a parent set separates it). Then [PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice), beats 2 and 3, which are this plan's payoff cases. Then [PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only), which gates one slice. [PR-21](AGENT.presence.planning.md#settled-register)(c) is the clause this plan rewrites.
2. **Read the rules it changes**, in [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path): the parent pointer, the transient-duplicate invariant ("A binding's id is stable for the host's life"), the binding-addressed move rule, and Base and Unplaced. In [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md), the producers-and-routing table and the guard paragraph ("**one or more** of whose covers names this presence node --- written as *exactly one* it forecloses the DAG silently").
3. **The code**, under [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) unless noted. The 2026-10-17 survey predates MC-3 (move, split, join and release are now one move), so Slice 0 re-runs it.
   - **Type:** `EphemeraPresenceParentPointer` and `fromHostPresence?` on the presence node, and its type guard (`isEphemeraPresenceParentPointerOrAbsent`), in [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts). WML mirror: `StandardLudicGraphPresenceNodeData['fromHostPresence']` in `packages/mtw-wml/ts/standardize/components/dataTypes/ludicGraph.ts`, carried by `ludicGraphNodeList.ts`.
   - **The accessor seam:** `ludicGraph/presenceParent.ts` (`parentsOf`, `parentOf`, `parentHostsOf`, `bindingHasParentOn`, `parentBindingsOf`, `parentsOfBinding`, `unpointedBindingOf`). Callers: `containmentPopulationSteps.ts`, `removeAuthoredObject.ts`, `resolvePresenceMoves.ts`, `movePresenceBinding.ts` (the `ParentBinding` type), `settleMembership.ts`, `membershipChanges.ts`, `commitStepSequence.ts`, `ludicGraph/presenceAncestry.ts`, `ludicGraph/presenceRooms.ts`, `ludicCache/fold.ts`, `ludicCache/charactersRow.ts`, `dataSource/characterComponentUpdated.ts`.
   - **Direct readers of `fromHostPresence`** (bypassing the seam): `manipulation/kernel/movePresenceBinding.ts` and `applyStepSequenceCore.ts` (12 each), `ludicGraph/wireProjection.ts`, `healPresenceCover.ts`, `containmentPopulationSteps.ts`, `resolvePresenceMoves.ts`, `kernelStep.ts`, `computeStepSequenceFootprint.ts`, `presenceSubGraph.ts`, `ludicCache/types.ts`, `ludicCache/mergeReducer.ts`, `ludicGraph/index.ts`, `ludicGraph/testFixtures.ts` (the `presenceBindingNode` test helper); in gateways, `classifyPresenceCoverDrift.ts` and `containmentDriftScenarios.ts`; in diagnostics, `fixedContainmentDriftSweep/classification.ts` and `presenceCoverDriftSweep/` (`classification.ts`, and a comment in `index.ts`); in mtw-interfaces, a comment in `eventBridge/diagnostics/index.ts`. 42 test files. Slice 0(a) classifies each one.
   - **The move:** `manipulation/kernel/movePresenceBinding.ts`. `pointsAt` is the one-pointer optimistic check; `from: ParentBinding | null` names one parent; the cascade merges a child's two bindings under one target.
   - **The guard:** the transient-duplicate check at the end of `applyStepSequenceCore.ts` (`presencesByParentHost`), which is already the positive rule keyed per parent binding.
   - **The refusal:** `moverBindingAmbiguous` in `manipulation/membership/resolvePresenceMoves.ts`.
   - **PR-26's site:** `contentDestinations` in `manipulation/containment/removeAuthoredObject.ts`.

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols. mtw-wml tests are transpile-only, so check its types with `tsc`.

## What is deliberately out of scope

- **WML syntax for a shared binding.** The [WML relational-edges plan](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md) owns how bindings print. This plan carries the set through the wire types (Slice 2) and leaves authoring syntax there.
- **Authored placement into a multi-binding parent.** Still shelved in `AGENT.implementation.md` behind [C2](AGENT.abstractionLayers.corpus.planning.md#c2-the-rope-in-two-rooms-refused-at-the-gate)'s refusal of authored multi-hosting. Parent sets make that placement *expressible*; lifting the shelf is not this plan.
- **Re-partitioning a whole's contents when its binding count changes** ([PR-12](AGENT.presence.planning.md#open-decisions-design--plan-only) obligation A).

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [X] **Slice 0. Verify premises (no code).** Done 2026-10-19; answers inline. No new decision rows. Evidence added to PS-2 and PS-4 (and the since-decided stored-shape row); lines added to Slices 1, 2, 4 and 8.
  - [X] **(a) Re-run the PR-25 survey against today's code.** Classify every reader of the pointer (the lists in Getting Started) as (i) a host test (`=== H` becomes "some parent is on H"), (ii) a binding test (`pointsAt` becomes membership in the set), (iii) a one-value read that must become a union or a choice (audience, `contentDestinations`, wire, WML), or (iv) a write. For each (iii), say whether the union is forced or is a decision; a choice that is a decision goes to the table below.
    - **Answer.** 24 production files name the field and 13 call the seam (Getting Started now lists both in full). A fifth class was needed, (v), for files that only carry the field.
      - **(i) Host tests:** `bindingPointsAt` (`settleMembership.ts`), `bindingIdsInto` (`charactersRow.ts`), the crossing filter in `fold.ts`, population's `existing`, `resolvePresenceMoves.ts` (`underHost`, `sitsUnderSeenBucket`), `fixedContainmentDriftSweep/classification.ts`, and the classifier's pointers into a host (`classifyPresenceCoverDrift.ts`).
      - **(ii) Binding tests:** `movePresenceBinding.ts` (`pointsAt`, the target lookup, the child check, the collision count), population's shape check, the run-end guard, the classifier's count per binding, `rebuiltCoverEntries`, `orphanedPointersOf` and `orphanRepairsFor`, and the root check in `fixedContainmentDriftSweep`.
      - **Hostless tests** (the empty set): `unpointedBindingOf`, `coverageViolationsOf`, population's live-Object check, the move's `from: null` and Base checks, and the root pick in `testFixtures.ts`.
      - **(iii) Unions.** Every one is forced by PR-25 except `contentDestinations`, which is PR-26:
        - `roomsForPresenceNode` (audience).
        - `parentBindingsOf`, which yields one entry per parent.
        - The hosts of an entity's bindings in `commitStepSequence.ts`, `membershipChanges.ts`, `characterComponentUpdated.ts`, and `healPresenceCover.ts` (hosts to read).
        - `computeStepSequenceFootprint.ts` (hosts to lock).
        - The planner's `from` in `resolvePresenceMoves.ts`, which by move rule (1) becomes every parent on the from host.
      - **(iv) Writes:**
        - The `addPresenceBinding` and `repairPresenceBinding` handlers, and `writeCoverIndex`, whose `before`/`after` becomes a set difference.
        - `movePresenceBinding.ts`: re-point, mint, hostless, child re-point and cover index.
        - The steps that `containmentPopulationSteps.ts` and `healPresenceCover.ts` emit.
      - **(v) Type or mapping only:**
        - `ephemeraMeta.ts` (the type and its guard) and `kernelStep.ts`.
        - The cache guard in `ludicCache/types.ts`, and `mergeReducer.ts`.
        - `wireProjection.ts`, and the WML `dataTypes/ludicGraph.ts` and `ludicGraphNodeList.ts`.
        - Gateways' `PresenceBindingView` and `containmentDriftScenarios.ts`, and `presenceCoverDriftSweep/classification.ts`.
        - Doc comments only: `ludicGraph/index.ts`, `presenceSubGraph.ts`, `presenceCoverDriftSweep/index.ts`, and `eventBridge/diagnostics/index.ts` in mtw-interfaces.

        No client code reads the wire field, so the wire and WML carry the set with no choice to make. They are (v), not (iii).
      - **Tests:** 42 files with 166 literal uses. 31 files build bindings with `presenceBindingNode` (`ludicGraph/testFixtures.ts`), 15 of them among the 42.
  - [X] **(b) Walks.** Confirm the 2026-10-17 claim that every upward walk (`hasPresenceAncestor` in `presenceAncestry.ts`, `roomsForHost` and `roomsForPresenceNode` in `presenceRooms.ts`, `roomsInvalidatedByHosts`) is a breadth-first search with a visited set, so a DAG costs it nothing. Name any that recurse without one.
    - **Answer: confirmed for every upward walk. Two downward recursions have no visited set.**
      - **Upward walks.** `hasPresenceAncestor`, `roomsForHost`, and `roomsInvalidatedByHosts` (which goes through `roomsForHost`) are breadth-first searches at host grain with a visited set. They read only `parent.host` from `parentBindingsOf`, so one entry per parent changes nothing.
      - **The one binding-grain hop.** `roomsForPresenceNode` reads one binding's parent before handing off to `roomsForHost`. It becomes a union (Slice 2).
      - **Downward recursions.** The move's collision cascade (`movePresenceBinding.ts`) and the planner's `cascadeHostsOf` (`resolvePresenceMoves.ts`) recurse without a visited set. They end because the host structure is acyclic (`hasPresenceAncestor` refuses a cycle). Both count two entries naming one host as a collision. Under sharing, one shared child listed by two moved covers is the same binding twice, and its parent set collapses instead (PR-25). A line is added to Slice 4.
      - `presenceSubGraph.ts` and the fold do not walk.
  - [X] **(c) "Exactly one" anywhere.** Grep the contract, the coverage checks (`coverageViolationsOf`), the drift classifier and the heal for a check that a node is named by exactly one cover or has exactly one parent. Each one forecloses the DAG silently (the guard paragraph in `AGENT.implementation.md`) and must be listed for Slice 3.
    - **Answer: no code check forecloses the DAG, but one doc does.**
      - **Already the positive rule.** The run-end guard and the drift classifier's count per binding allow no two of a host's bindings under one parent binding (the classifier reports `Duplicate` above one). They need only the set flattened (Slice 3).
      - **Unaffected.** `coverageViolationsOf` checks for at most one hostless binding, and stays as it is. The cache guard (`isEphemeraLudicCacheData`) walks each cover entry to the binding it names.
      - **One binding per parent host.** `fixedContainmentDriftSweep/classification.ts` takes the first binding into the parent and requires that it names the root. That is a different assumption from one parent per binding, and set-aware readers retire it too (a line is added to Slice 2).
      - **The doc.** In `AGENT.concepts.md`, the paragraph "Bindings form a forest, though components form a DAG" ("never one binding under both … does not transfer to bindings") states the single pointer as a principle. Slice 8 rewrites it.
  - [X] **(d) Who could write sharing.** List every production path that leaves one host with two bindings of identical cover under parents on different hosts (the ring on the Table and in Rings of Power; the backgammon set under both chest bindings). This grounds PS-4.
    - **Answer: no production path writes PR-C5's shape today, and only population ever gives a host a second parent.**
      - **In play:**
        - No producer emits a `subCover`; part moves are kernel-only.
        - A whole move re-points its binding or joins an existing one.
        - Population skips an authored Object that already has a parent.

        So nothing in play gives a host a second binding.
      - **At cache time:** population gives a Room or Feature authored under a second parent a second binding with cover `[]` (a Room's Area carve-out is `[]` by rule). It equals the first binding's cover only when both are empty: a Room in two Areas, or a Feature with no members in two parents. `AGENT.implementation.md` says no authored component has two parents today.
      - **PR-C5's shape** (two bindings of the chest that both cover Backgammon) needs an Object under two parents, which nothing writes, so Slice 7 builds it as a fixture.
      - **Wording correction:** sharing is not only "under parents on different hosts". Backgammon's two parents are both bindings of the chest.
      - **Candidates for PS-4:**
        - (1) population, for a Room or Feature authored under several parents;
        - (2) a play-time verb that adds a parent without leaving one ("put the ring in Rings of Power" while it stays on the Table), which does not exist.
  - [X] **(e) Stored data.** Count presence nodes with a `fromHostPresence` in the dev world, for the stored-shape migration.
    - **Answer: the count decides only whether the stored-shape change needs a migration at all.**
      - **Any nonzero count means nearly every row.** Every placed binding carries the field, so any count above zero means rewriting nearly every row that holds a placed host. The exact number does not change the mechanism.
      - **Where the field is stored:**
        - the `ludicGraph` on the five host kinds' Meta rows;
        - the `ludicCache` rows, where `mergeReducer.ts` copies it and `ludicCache/types.ts` checks it.

        Cache rows rebuild from graphs once marked stale, so only the Meta rows need a rewrite.
      - **History.** The dev world held no presence nodes on 2026-10-11 (`AGENT.implementation.md`). Play since then has minted some.
      - **The user's estimate, 2026-10-19: six rows with presence nodes, and no Objects.** They are the five Coyote Game Rooms and one active character. A Room's Base is hostless, and Coyote uses no Areas, so the Rooms carry no pointer. That leaves **one Meta row to rewrite: the character's binding into its room.** Room cache rows that hold the character as a leaf rebuild once marked stale.
      - **Not measured directly.** Once Slice 1's guard rejects the old field, `LudicGraphStaleStructureSweep` reports exactly the rows to rewrite, which confirms the estimate.
- [X] **Slice 1. The set type behind the seam, behavior unchanged.** Done 2026-10-19. Step fields (`addPresenceBinding`/`repairPresenceBinding`'s `fromHostPresence`, `previousParent`, the move's `from`) and the wire and WML types stay singular until PS-2 and Slice 2, so handlers convert (`[pointer]`) at the boundary and `wireProjection.ts` reads through `parentOf`.
  - [X] Change the stored type to a set: required `fromHostPresences`, empty meaning hostless; the guard (`isEphemeraPresenceParentPointerList`) rejects the retired single field. Every producer still writes at most one parent.
  - [X] Add `parentsOf(binding): ParentBinding[]` to `presenceParent.ts` (with `bindingHasParent`); `parentOf` becomes the transitional single-parent read and throws on more than one.
  - [X] Route every direct reader from Slice 0(a) through the seam. `git grep -nw fromHostPresence` in production code now finds only the retired-field guards, the singular step fields, the wire and WML mappings, and gateways' `orphanRepairsFor` result. Doc comments are renamed.
  - [X] Gateways' `PresenceBindingView` has its own `parentPointersOf` accessor; the classifier, `containmentDriftScenarios.ts` and both diagnostics classifications read through it.
  - [X] `presenceBindingNode`'s `parent` takes a single parent or an array (a set); the other test literals follow the type.
  - [X] Migrate stored rows through the stale-structure heal (the user's design, 2026-10-19): `healLudicGraphStructure` rewrites a presence node's single `fromHostPresence` into a one-element `fromHostPresences`, or `[]` when it was absent, and marks the host's cache stale. Every Meta row holding a presence node is stale under the new guard (a hostless Base needs the empty array too), not only the placed character's. The user ran `LudicGraphStaleStructureSweep` 2026-10-19: it found all six components, and a second run emitted none. The `withParentSet` branch in `healLudicGraphStructure.ts` is now dead weight in this one-instance world and can be deleted at the user's choice.
- [X] **Slice 2. Readers become set-aware.** Done 2026-10-19. No producer yet writes two parents, so tests build multi-parent fixtures directly.
  - [X] (i) Host tests: "some parent is on H" (`bindingHasParentOn`, `parentHostsOf`; `parentHostOf` deleted). (ii) Binding tests: set membership.
  - [X] (iii) Unions: audience resolution (`roomsForPresenceNode`) unions over parents; the cache fold and `charactersRow` see a binding under each parent; the wire and WML types carry the set as `fromHostPresences` (absent when hostless).
  - [X] `fixedContainmentDriftSweep/classification.ts` asks whether some binding of the child has the parent's root among its parents, rather than taking the first binding into the parent (Slice 0(c)).
  - [X] Retire `parentOf`'s single-parent read where nothing still needs it. It stays, throwing on a multi-parent binding, in the writers and planners that name one parent: `healPresenceCover.ts`, `applyStepSequenceCore.ts` (the cover index `before`) (both retired in Slice 3), `movePresenceBinding.ts` and `resolvePresenceMoves.ts` (the move's `from`) until PS-2 and Slice 4, and `contentDestinations` until Slice 6. `parentBinding` is now `parentsOfBinding`.
- [X] **Slice 3. The invariant, stated positively.** Done 2026-10-19. The guard and the classifier's count were already the positive rule over flattened sets (Slice 1/2), so the work was tests, wording, and the pieces that were still single-parent: the cover index, the repair/add handlers, the heal, and `rebuiltCoverEntries`.
  - [X] The run-end guard in `applyStepSequenceCore.ts` keys by parent binding over parent sets: no parent binding is in two of one host's bindings' parent sets (no parent counts as one, as today). Tests: one binding under two parent bindings is legal, a second binding or a repeated parent trips it; the message states the rule.
  - [X] The cover index: `writeCoverIndex` takes parent lists and writes an entry onto every parent in `after` and off every parent only in `before`. The `addPresenceBinding` and `repairPresenceBinding` steps carry `fromHostPresences` / `previousParents` (first half of PS-2, decided here), `settleParentChange` settles a departure per left host and an arrival per arrived host, and `healPresenceCover` and population pass the whole parent set (population swaps only the parent on its own host and keeps the rest). The classifier's `rebuiltCoverEntries` lists every binding that names the parent, not the first. The heal repairs a shared binding once with its whole parent set.
  - [X] Fix each "exactly one" from Slice 0(c): the classifier header and the contract's comparison paragraph now state the rule over parent sets. The concepts paragraph stays with Slice 8.
- [ ] **Slice 4. The move under parent sets.**
  - [ ] Move rule (1): `from` names a host and the parents leaving (PS-2). A whole move out of host H removes every parent on H and keeps parents on other hosts; the optimistic check is "each named parent is still in the set".
  - [ ] Entries arriving at a destination binding that has other parents (PS-3, the user's call): moving into it also shows the entries under those parents.
  - [ ] Base's parenting under a part move (PS-3; today's generic answer, written down in `movePresenceBinding.ts`'s comment, is a placeholder).
  - [ ] `moverBindingAmbiguous` no longer fires for a shared binding: the die moves once.
  - [ ] The cascade counts distinct bindings, not entries per host (Slice 0(b)). The move's collision check and the planner's `cascadeHostsOf` treat one shared child listed by two moved covers as one binding, whose parent set collapses, not as a collision. A child re-pointed from `from` to the target swaps that one parent in its set.
- [ ] **Slice 5. Sharing writes.**
  - [ ] The sharing join: two bindings of one host with different parents and the same cover become one binding whose parent set is the union (the PR-25 row: "a sharing write ... is not a move"). Its step shape is PS-2.
  - [ ] The separating split: dividing a binding's parent set gives each part its own binding.
  - [ ] The cascade: a child left with two bindings under one shared target collapses as today, one level down.
  - [ ] The first production caller (PS-4).
- [ ] **Slice 6. `contentDestinations` (gated on [PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only)).**
- [ ] **Slice 7. Payoff test.** PR-C5 beats 2 and 3 end to end on the real kernel: the backgammon set shared under both chest bindings is one binding, a gem-like add to it lands once and is seen from both, and the die leaves it in one move.
- [ ] **Slice 8. Docs and graduation.**
  - [ ] Graduate PR-25; restate [PR-21](AGENT.presence.planning.md#settled-register)(c).
  - [ ] Contract: the parent-set clause, the positive arity rule, the move rule, the sharing join and split. Implementation: the producers table, the walks, and the "presence is a tree" paragraph.
  - [ ] Concepts: "parent set" and "shared binding", vocabulary only. Rewrite the "Bindings form a forest" paragraph, which states the single pointer as a principle (Slice 0(c)).
  - [ ] Delete this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **PS-2** | **The step fields that name parents.** The move's `from: ParentBinding \| null` becomes the host and the parents leaving (move rule (1)). The sharing join and the separating split need a shape: options are a flag or field on the one move, or a step kind of its own. The kernel prefers a step kind per effect over a flag (`kernelStep.ts`), and MC-3 made the move one step because move, split and join were one effect; sharing changes parents without moving entries, so it is a different effect. **Leaning:** its own step kind. **Slice 0(a):** `addPresenceBinding` (`fromHostPresence`) and `repairPresenceBinding` (`fromHostPresence`, `previousParent`) also name parents, and both pass their pointer to `writeCoverIndex`. **Slice 1** left all of these singular and converts at the handler. **Decided with Slice 3, 2026-10-19: the add and repair steps are widened** (`fromHostPresences`, `previousParents`), because the cover index and the heal cannot be set-aware over a singular field. **Still Open:** the move's `from` and the sharing step's shape. | 4, 5 | Open |
| **PS-3** | **What the move does to parents it does not name** (the two items MC-3 left for PR-25). (a) Entries moved into a destination binding that also has parent Q are then seen under Q too: accept that as the meaning of sharing, or mint a separate binding at the destination when the target is shared. (b) How Base's parenting changes when part of its cover moves; today a part moved out of a hostless Base mints at the destination and Base stays hostless, which the user called an ad-hoc short-term answer. **The user's call.** | 4 | Open (the user) |
| **PS-4** | **Which production path first writes sharing.** "Sharing is stored, never inferred", so equal covers never merge by themselves, and Slice 0(d) lists what could ask for it. Without a caller, the die beat is fixed in the kernel but never reached in play. **The user's call**, informed by Slice 0(d). Gates only Slice 5's last item and the in-play half of the payoff. **Slice 0(d):** no present path writes PR-C5's shape. Nothing in play gives a host a second binding. Only cache-time population gives a host a second parent, for a Room or Feature authored under several parents, and those bindings match only when both covers are empty (a Room in two Areas, or a Feature with no members). The candidates are that population path, or a play-time verb that adds a parent without leaving one, which does not exist yet. | 5 | Open (the user) |

[PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only) stays a design row in the parent plan and gates Slice 6 only.

## Verification

1. **Suite, from `lambda/ephemera`:** `npm run test -- --watchAll=false dataSource/positions/`, and the full ephemera suite after any rename or delete. Then `npx tsc --noEmit` there and in `packages/mtw-interfaces`, `packages/mtw-wml`, `packages/mtw-gateways` and `lambda/diagnostics`.
2. **The seam holds:** after Slice 1, `git grep -nw fromHostPresences -- '*.ts' ':!*.test.ts'` (the stored field) finds only the type, its guard, `presenceParent.ts`, the cache guard and `mergeReducer.ts`, gateways' view accessor, and the handlers that write it. `git grep -nw fromHostPresence` (singular) finds only the retired-field guards and healing, population's local variable, and gateways' `orphanRepairsFor` result; the add/repair step fields became `fromHostPresences` in Slice 3.
3. **No silent single-parent read:** after Slice 2, `git grep -n "parentOf(" -- '*.ts' ':!*.test.ts'` finds only `presenceParent.ts`, `movePresenceBinding.ts` and `resolvePresenceMoves.ts` (until PS-2 and Slice 4), and `removeAuthoredObject.ts` (`contentDestinations`, until Slice 6). `git grep -nw parentHostOf` finds nothing.
4. **Anchor resolution:** every `](Other.md#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Done 2026-10-19 |
| 1. Set type behind the seam | Done 2026-10-19 |
| 2. Set-aware readers | Done 2026-10-19 |
| 3. Positive invariant | Done 2026-10-19 |
| 4. Move under parent sets | Blocked on PS-2 (move `from`), PS-3 |
| 5. Sharing writes | Blocked on PS-2 (sharing step); last item on PS-4 |
| 6. `contentDestinations` | Blocked on PR-26 |
| 7. Payoff test | Waiting on 4, 5 |
| 8. Docs and graduation | Waiting on all |
