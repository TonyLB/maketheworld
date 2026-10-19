# Presence parent sets: implementation

**Status: opened 2026-10-19. Slice 0 is next. PS-1 through PS-4 are Open; PS-3 and PS-4 are the user's to decide.**

**Scope in one sentence: a presence binding names a *set* of parent bindings rather than one, so the presence structure inside the ludicNetwork is a DAG rather than a forest rooted at hostless bindings, and a thing that sits identically under several parents holds one binding instead of copies.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md), and a sub-plan of [`AGENT.presence.planning.md`](AGENT.presence.planning.md). It records no design: the design is [PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only) (direction decided by the user 2026-10-17), and the forks below are only those needed to build it. Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).

**Why.** Monotone covers ([PR-24](AGENT.presence.planning.md#settled-register), shipped 2026-10-18) made a binding identified by what it covers. With one parent pointer, a thing whose cover is the same under two parents must hold two identical bindings, and every later write to it must be doubled. That is the pairing this plan completes. The single pointer already costs in play ([PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice) beat 3): "take the die out of the backgammon set" is refused as `moverBindingAmbiguous`, or, narrowed to one bucket, moves one of the die's two bindings and leaves the die both in hand and in the set.

---

## Getting Started

1. **Read the design.** [PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only) in full: the positive inherited-arity rule, "sharing is stored, never inferred", the 2026-10-17 code survey (i)--(iii), and the two decided rules (a move out of host H removes every parent on H; a join of differing-parent bindings unions parent sets and a split that divides a parent set separates it). Then [PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice), beats 2 and 3, which are this plan's payoff cases. Then [PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only), which gates one slice. [PR-21](AGENT.presence.planning.md#settled-register)(c) is the clause this plan rewrites.
2. **Read the rules it changes**, in [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path): the parent pointer, the transient-duplicate invariant ("A binding's id is stable for the whole's life"), the binding-addressed move rule, and Base and Unplaced. In [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md), the producers-and-routing table and the guard paragraph ("**one or more** of whose covers names this presence node --- written as *exactly one* it forecloses the DAG silently").
3. **The code**, under [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) unless noted. The 2026-10-17 survey predates MC-3 (move, split, join and release are now one move), so Slice 0 re-runs it.
   - **Type:** `EphemeraPresenceParentPointer` and `fromHostPresence?` on the presence node, and its type guard (`isEphemeraPresenceParentPointerOrAbsent`), in [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts). WML mirror: `StandardLudicGraphPresenceNodeData['fromHostPresence']` in `packages/mtw-wml/ts/standardize/components/dataTypes/ludicGraph.ts`, carried by `ludicGraphNodeList.ts`.
   - **The accessor seam:** `ludicGraph/presenceParent.ts` (`parentOf`, `parentHostOf`, `parentBindingsOf`, `parentBinding`, `unpointedBindingOf`). Callers: `containmentPopulationSteps.ts`, `resolvePresenceMoves.ts`, `settleMembership.ts`, `membershipChanges.ts`, `commitStepSequence.ts`, `ludicCache/fold.ts`, `ludicCache/charactersRow.ts`, `dataSource/characterComponentUpdated.ts`.
   - **Direct readers of `fromHostPresence`** (bypassing the seam): `manipulation/kernel/movePresenceBinding.ts` and `applyStepSequenceCore.ts` (12 each), `ludicGraph/wireProjection.ts`, `healPresenceCover.ts`, `containmentPopulationSteps.ts`, `resolvePresenceMoves.ts`, `kernelStep.ts`, `computeStepSequenceFootprint.ts`, `presenceSubGraph.ts`, `ludicCache/types.ts`, `ludicCache/mergeReducer.ts`, `ludicGraph/index.ts`; in gateways, `classifyPresenceCoverDrift.ts` and `containmentDriftScenarios.ts`; in diagnostics, `fixedContainmentDriftSweep/classification.ts` and `presenceCoverDriftSweep/`. About 42 test files.
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

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [ ] **(a) Re-run the PR-25 survey against today's code.** Classify every reader of the pointer (the lists in Getting Started) as (i) a host test (`=== H` becomes "some parent is on H"), (ii) a binding test (`pointsAt` becomes membership in the set), (iii) a one-value read that must become a union or a choice (audience, `contentDestinations`, wire, WML), or (iv) a write. For each (iii), say whether the union is forced or is a decision; a choice that is a decision goes to the table below.
  - [ ] **(b) Walks.** Confirm the 2026-10-17 claim that every upward walk (`hasPresenceAncestor` in `presenceAncestry.ts`, `roomsForHost` and `roomsForPresenceNode` in `presenceRooms.ts`, `roomsInvalidatedByHosts`) is a breadth-first search with a visited set, so a DAG costs it nothing. Name any that recurse without one.
  - [ ] **(c) "Exactly one" anywhere.** Grep the contract, the coverage checks (`coverageViolationsOf`), the drift classifier and the heal for a check that a node is named by exactly one cover or has exactly one parent. Each one forecloses the DAG silently (the guard paragraph in `AGENT.implementation.md`) and must be listed for Slice 3.
  - [ ] **(d) Who could write sharing.** List every production path that leaves one whole with two bindings of identical cover under parents on different hosts (the ring on the Table and in Rings of Power; the backgammon set under both chest bindings). This grounds PS-4.
  - [ ] **(e) Stored data.** Count presence nodes with a `fromHostPresence` in the dev world, for PS-1's migration.
- [ ] **Slice 1. The set type behind the seam, behavior unchanged.**
  - [ ] Change the stored type to a set (PS-1). Every producer still writes at most one parent.
  - [ ] Add `parentsOf(binding): ParentBinding[]` to `presenceParent.ts`; `parentOf` becomes the transitional single-parent read and throws on more than one, so any reader not yet migrated fails loudly rather than reading the first parent.
  - [ ] Route every direct reader from Slice 0(a) through the seam. After this slice, `git grep fromHostPresence` in production code finds only `presenceParent.ts`, the type, the type guard, and the wire and WML mappings.
  - [ ] Migrate stored rows (PS-1).
- [ ] **Slice 2. Readers become set-aware.** No producer yet writes two parents, so tests build multi-parent fixtures directly.
  - [ ] (i) Host tests: "some parent is on H". (ii) Binding tests: set membership.
  - [ ] (iii) Unions: audience resolution (`roomsForPresenceNode`) unions over parents; the cache fold and `charactersRow` see a binding under each parent; the wire and WML types carry the set.
  - [ ] Retire `parentOf`'s single-parent read where nothing still needs it. `contentDestinations` keeps it until Slice 6.
- [ ] **Slice 3. The invariant, stated positively.**
  - [ ] The run-end guard in `applyStepSequenceCore.ts` keys by parent binding over parent sets: no parent binding is in two of one whole's bindings' parent sets (no parent counts as one, as today).
  - [ ] The cover index: a binding's entry is on every parent's cover, and every parent cover's entry for a node is matched by exactly one of that node's bindings having that parent (PR-25's rule). The drift classifier and the heal read it the same way.
  - [ ] Fix each "exactly one" from Slice 0(c).
- [ ] **Slice 4. The move under parent sets.**
  - [ ] Move rule (1): `from` names a host and the parents leaving (PS-2). A whole move out of host H removes every parent on H and keeps parents on other hosts; the optimistic check is "each named parent is still in the set".
  - [ ] Entries arriving at a destination binding that has other parents (PS-3, the user's call): moving into it also shows the entries under those parents.
  - [ ] Base's parenting under a part move (PS-3; today's generic answer, written down in `movePresenceBinding.ts`'s comment, is a placeholder).
  - [ ] `moverBindingAmbiguous` no longer fires for a shared binding: the die moves once.
- [ ] **Slice 5. Sharing writes.**
  - [ ] The sharing join: two bindings of one whole with different parents and the same cover become one binding whose parent set is the union (the PR-25 row: "a sharing write ... is not a move"). Its step shape is PS-2.
  - [ ] The separating split: dividing a binding's parent set gives each part its own binding.
  - [ ] The cascade: a child left with two bindings under one shared target collapses as today, one level down.
  - [ ] The first production caller (PS-4).
- [ ] **Slice 6. `contentDestinations` (gated on [PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only)).**
- [ ] **Slice 7. Payoff test.** PR-C5 beats 2 and 3 end to end on the real kernel: the backgammon set shared under both chest bindings is one binding, a gem-like add to it lands once and is seen from both, and the die leaves it in one move.
- [ ] **Slice 8. Docs and graduation.**
  - [ ] Graduate PR-25; restate [PR-21](AGENT.presence.planning.md#settled-register)(c).
  - [ ] Contract: the parent-set clause, the positive arity rule, the move rule, the sharing join and split. Implementation: the producers table, the walks, and the "presence is a tree" paragraph.
  - [ ] Concepts: "parent set" and "shared binding", vocabulary only.
  - [ ] Delete this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **PS-1** | **The stored shape of the parent set, and how stored rows migrate.** PR-25 leaves this to implementation. **Recommended:** replace `fromHostPresence?: Pointer` with a required `fromHostPresences: Pointer[]`, empty meaning hostless, rather than keeping the optional single field beside an optional array. One field gives one reading of "hostless", and the type guard rejects the old field outright as it rejected `fromHostId` (`ephemeraMeta.ts`), so a surviving row reports through `LudicGraphStaleStructureSweep`. Pre-rollout, the migration is a one-shot rewrite rather than a dual-read period. | 1 | Open |
| **PS-2** | **The step fields that name parents.** The move's `from: ParentBinding \| null` becomes the host and the parents leaving (move rule (1)). The sharing join and the separating split need a shape: options are a flag or field on the one move, or a step kind of its own. The kernel prefers a step kind per effect over a flag (`kernelStep.ts`), and MC-3 made the move one step because move, split and join were one effect; sharing changes parents without moving entries, so it is a different effect. **Leaning:** its own step kind. | 4, 5 | Open |
| **PS-3** | **What the move does to parents it does not name** (the two items MC-3 left for PR-25). (a) Entries moved into a destination binding that also has parent Q are then seen under Q too: accept that as the meaning of sharing, or mint a separate binding at the destination when the target is shared. (b) How Base's parenting changes when part of its cover moves; today a part moved out of a hostless Base mints at the destination and Base stays hostless, which the user called an ad-hoc short-term answer. **The user's call.** | 4 | Open (the user) |
| **PS-4** | **Which production path first writes sharing.** "Sharing is stored, never inferred", so equal covers never merge by themselves, and Slice 0(d) lists what could ask for it. Without a caller, the die beat is fixed in the kernel but never reached in play. **The user's call**, informed by Slice 0(d). Gates only Slice 5's last item and the in-play half of the payoff. | 5 | Open (the user) |

[PR-26](AGENT.presence.planning.md#open-decisions-design--plan-only) stays a design row in the parent plan and gates Slice 6 only.

## Verification

1. **Suite, from `lambda/ephemera`:** `npm run test -- --watchAll=false dataSource/positions/`, and the full ephemera suite after any rename or delete. Then `npx tsc --noEmit` there and in `packages/mtw-interfaces`, `packages/mtw-wml`, `packages/mtw-gateways` and `lambda/diagnostics`.
2. **The seam holds:** after Slice 1, `git grep -n fromHostPresence -- '*.ts' ':!*.test.ts'` finds only the type, its guard, `presenceParent.ts`, and the wire and WML mappings.
3. **No silent single-parent read:** after Slice 2, `git grep -n "parentOf(" -- '*.ts' ':!*.test.ts'` finds only `contentDestinations` (until Slice 6) and `presenceParent.ts`.
4. **Anchor resolution:** every `](Other.md#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Ready |
| 1. Set type behind the seam | Blocked on PS-1 |
| 2. Set-aware readers | Waiting on 1 |
| 3. Positive invariant | Waiting on 2 |
| 4. Move under parent sets | Blocked on PS-2, PS-3 |
| 5. Sharing writes | Blocked on PS-2; last item on PS-4 |
| 6. `contentDestinations` | Blocked on PR-26 |
| 7. Payoff test | Waiting on 4, 5 |
| 8. Docs and graduation | Waiting on all |
