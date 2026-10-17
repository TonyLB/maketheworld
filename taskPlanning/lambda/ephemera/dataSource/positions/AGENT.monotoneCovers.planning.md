# Monotone covers: implementation

**Status: opened 2026-10-17. Slice 0 (verify premises) is next. The design direction is [PR-24](AGENT.presence.planning.md#open-decisions-design--plan-only), decided by the user; [PR-25](AGENT.presence.planning.md#open-decisions-design--plan-only) (one binding for a thing that is the same in several parents) is open and does not gate Slices 0-3.**

**Scope in one sentence: make every presence cover an explicit list of entries, so no cover means "whatever the other bindings don't list", and route context-free adds to the whole's one hostless binding.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md), and a sub-plan of [`AGENT.presence.planning.md`](AGENT.presence.planning.md). It records no design: the design is PR-24, and the forks below are only those needed to build it. **It supersedes `AGENT.remainderIdentity.planning.md`** (deleted 2026-10-17; its Slice 0 findings that still apply are carried into Slice 0 below, and its decisions into the table). Deleted when the work lands; lasting rules move to [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) and [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md).

**Why.** Prototypes with `Full`, then `Remainder`, kept hitting problems that trace to one property: a `Remainder` cover is a complement (every node no other binding lists), so its meaning changes whenever another binding changes, and it needs a closed world to evaluate. PR-23's fixed remainder id failed for that reason (a whole hosted in several places holds several Remainders), and the same complement shows up in the cache fold, split, join, and the WML printer. The cache already refuses it: `EphemeraLudicCachePresenceNode` has entry-only covers "by construction" ([`ludicCache/types.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/types.ts), PN-19). This plan moves the graph to the cache's shape.

---

## Getting Started

1. **Read the design.** PR-24 in [`AGENT.presence.planning.md`](AGENT.presence.planning.md#open-decisions-design--plan-only) (its five rules), PR-25 (the open multi-parent question), and the superseded PR-23 row for the remainderIdentity findings. Then [PR-21](AGENT.presence.planning.md#settled-register), whose clauses (a) and (b) PR-24 re-opens and whose (c), (f) and (h) it rewords from "hostless remainder" to "hostless binding".
2. **Read the rules it changes**, in [the presence-nodes section of `positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#presence-nodes-cover-consolidation-and-the-single-write-path): `cover` (a `Remainder` "may appear in any number of a whole's bindings"), the room rule, and the stable-id clause.
3. **The code**, under [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) unless noted:
   - **Type:** [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`EphemeraPresenceCover`, `EphemeraPresenceCoverRemainder`, `remainderCover()`); the WML mirror `StandardLudicGraphPresenceCoverRemainderData` in `packages/mtw-wml/ts/standardize/components/dataTypes/ludicGraph.ts`.
   - **Writers of a `Remainder`:** `manipulation/kernel/applyStepSequenceCore.ts` (`:243`, and `addPresenceBinding`'s default at `:285`); `manipulation/containment/containmentPopulationSteps.ts` (`rootStep`, `:39`); `manipulation/kernel/joinPresenceBindings.ts` (`:62`, keeps it if either side has it); split leaves it on the original binding (`manipulation/membership/resolvePresenceSplit.ts`).
   - **Readers that evaluate the complement:** `ludicGraph/presenceSubGraph.ts` (`unclaimedComponentNodes`, `:44`, used at `:93`); `ludicCache/mergeReducer.ts` (`:384-439`).
   - **The hostless binding today:** `ludicGraph/presenceParent.ts` (`hostlessRemainderOf`, `:70`, a `.find`); used by `resolvePresenceMoves.ts` (`:65`, a move into a destination points at the destination's hostless binding, which is already PR-24 rule 3's routing; `:141`) and `containmentPopulationSteps.ts` (`:28`).
   - **Drift:** `packages/mtw-gateways/ts/ephemera/positions/classifyPresenceCoverDrift.ts`; `lambda/diagnostics/containmentPopulationDriftSweep/classification.ts` (`isHostlessRemainder`).

**Test orientation.** Command authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); if commands conflict, follow it. Baseline, run from `lambda/ephemera`, which must pass before edits:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/
```

`*.integration.test.ts` files sit outside `tsconfig`; after any rename or delete, run the full suite and grep module paths, not just symbols. mtw-wml tests are transpile-only, so check its types with `tsc`.

## What is deliberately out of scope

- **PR-25, when several parents share one binding.** Today a binding has one parent pointer, so a ring on a Table that is also a member of Rings of Power (bound into the Room) holds two bindings. PR-25's candidate is a parent set ([PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice)). This plan builds monotone covers over today's one-pointer bindings and does not change that.
- **A bare component reference defaulting to a binding.** Under [PR-15](AGENT.presence.planning.md#settled-register), an edge onto a binding is a different claim from an edge onto the whole.
- **WML syntax.** The [WML relational-edges plan](../../../../packages/mtw-wml/standardize/AGENT.wmlRelationalEdges.planning.md) owns how the hostless binding is written; Slice 6 only updates its pointers.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no code).** Record each answer inline here.
  - [ ] **(a) Every producer that relies on a `Remainder`.** Start from the Getting Started lists. For each, say whether the add has context naming a binding (a move, a split, an authored placement) or is context-free (it then routes to the hostless binding, rule 3), and what it writes instead. Include every place that adds a component node to a graph without touching a cover, since today the Remainder covers it silently.
  - [ ] **(b) Characters.** Confirm how a room's cover reaches its present characters today (the cache walk includes them, `ludicCache/types.ts:180-183`; check whether through the room's `Remainder` expansion or the characters row), and where rule 5's "the room's hostless binding covers every character in the row" is computed.
  - [ ] **(c) Hostless bindings.** Who mints a hostless binding (`createComponent`, `rootStep`, the rehost of a root), whether a non-room whole can hold one today, and whether anything can produce two on one whole. This grounds rule 3's "at most one".
  - [ ] **(d) Carried from remainderIdentity's Slice 0** (verified 2026-10-17; recheck the citations, then use them for the fixed hostless id in Slice 4):
    - Id shape: the suffix after `PRESENCE#` is opaque everywhere (`isEphemeraTaggedId`, `isPresenceTaggedPortId`, `PresenceKey`, `stubPortIdFromEdge`, `presenceUuidFromKey`); the one constraint is no `#` in it.
    - Uniqueness: nearly every reference is host-qualified. Two need fixing for a shared id: `ephemeraLudicTerminalsEqual` (`ephemeraMeta.ts`) ignores `owner` for a bare terminal against an address; `ludicCache/catalogHandles.ts` `addBucket` dedupes by bare `presence`. Guard tests only: `fold.ts`, `mergeReducer.ts` (the bindings-by-owner map), `applyStepSequenceCore.ts`'s collision check, `computeStepSequenceFootprint.ts`, `ludicCache/types.ts` `bindingsByOwner`, mtw-wml `ludicGraphNodeList.ts`.
  - [ ] **(e) Stored data.** A read-only count of dev-world bindings whose cover holds a `Remainder`, and of wholes with more than one hostless binding. No script exists; the nearest pattern is `presenceCoverDriftSweep/index.ts` (injectable `listCandidateRows`). Running it is the user's call.
- [ ] **Slice 1. The coverage invariant.** Every component node of a whole is covered by at least one of its bindings, and a whole has at most one hostless binding. Both are checked on the whole's own graph: in the end-of-run validator in `applyStepSequenceCore` and in `classifyPresenceCoverDrift` (new kinds for an uncovered member and a second hostless binding). While `Remainder` still exists it counts as covering, so this slice changes no behavior. Unit tests for each kind.
- [ ] **Slice 2. Producers write explicit entries.** Each producer from Slice 0(a) writes the entries it means: an add with context names its binding, a context-free add lands in the hostless binding (MC-1 for a whole with none), split and join write each side's members as explicit entries (a complement computed once at write time is fine; it's evaluating one at read time that this plan removes). `addPresenceBinding` loses its `remainderCover()` default. **Payoff test**, through `compilePositionKernelOp`: create, place, move, split, join back, disconnect; after every step no binding holds a `Remainder` and the Slice 1 invariant holds.
- [ ] **Slice 3. Bystanders.** The room's hostless binding covers its explicit entries plus every character in the characters row, unconditionally (overlap with the room's other bindings is allowed; "characters no other binding lists" would bring the complement back). The cache fold reads that instead of expanding a `Remainder`. Arrivals and departures still write only the characters row. Test: a character arriving in a room whose `ludicGraph` is unchanged appears in the room's cache under the hostless binding.
- [ ] **Slice 4. A fixed id for the hostless binding** (MC-2 spelling). The remainderIdentity sentinel, now unique because rule 3 makes the hostless binding unique per whole. Producers mint it; the Slice 0(d) uniqueness fixes, each with a test where two hosts' hostless bindings meet in one structure (a fold over a room holding a box).
- [ ] **Slice 5. Migrate stored data** (RI-3, carried): population treats a `Remainder` cover, or a hostless binding not keyed by the fixed id, as drift; it expands the `Remainder` to explicit entries (from `unclaimedComponentNodes`, once) and renames the id, rewriting children's `fromHostPresence`, parent cover entries, edges ending at it, and cached `ludicCache` rows. The drift classifier gains both checks so the existing `ContainmentPopulationDriftSweep` reaches them. **Deploy gate (the user's):** clear improvised Objects and players; deploy; run the sweep twice, the second reading `emittedCount: 0`.
- [ ] **Slice 6. Remove `Remainder`.** Delete `EphemeraPresenceCoverRemainder`, `remainderCover()`, the WML mirror, `unclaimedComponentNodes`' complement use, and the cache's Remainder expansion; the graph-side cover type becomes entries only, like the cache's. Full ephemera suite plus `tsc` in mtw-interfaces, mtw-wml, mtw-gateways.
- [ ] **Slice 7. Docs and graduation.**
  - [ ] Contract: the `cover` clause (entries only, coverage invariant), the hostless-binding clause (at most one, takes context-free adds, fixed id), the room rule, the bystander source.
  - [ ] `AGENT.implementation.md`: the producers and their routing.
  - [ ] Graduate PR-24, and update [PR-21](AGENT.presence.planning.md#settled-register) (a), (b), (c), (f), (h). Update the WML plan's OD-3, OD-8 and OD-9 (they depend on PR-23, which this plan supersedes).
  - [ ] Delete this plan.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **MC-1** | **A context-free add to a whole with no hostless binding and several bindings.** (a) Refuse, so the author or action must name one; (b) mint a hostless binding on the whole and add there. Today population refuses parents with several bindings, which is (a). Slice 0(a) says whether any producer reaches this case. | 2 | Open |
| **MC-2** | **The fixed id's spelling.** RI-1 chose `PRESENCE#REMAINDER` (the user, 2026-10-17) when it named the remainder; it now names the hostless binding, which is no longer a remainder. | 4 | Open |
| **RI-2** | **Join survivor when the Remainder holder is not first.** **N/A under PR-24:** no binding holds a `Remainder` after Slice 2, and two hostless bindings can't be joined because a whole has at most one. | --- | N/A (2026-10-17) |
| **RI-3** | **How stored ids migrate.** Population learns the rewrite and the existing `ContainmentPopulationDriftSweep` triggers it; Rooms can't be wiped (CoyoteGame setting), improvised Objects and players can. A re-cache can't do it (`cacheAsset` emits `Component Updated` only for components in its diff). Carried to Slice 5, now covering the `Remainder` expansion as well as the rename. | 5 | **Decided 2026-10-17 (the user)** for the rename; the expansion rides the same path |

## Verification

1. **Suite, from `lambda/ephemera`:** `npm run test -- --watchAll=false dataSource/positions/`, and the full ephemera suite after any rename or delete. Then `npx tsc --noEmit` there and in `packages/mtw-interfaces`, `packages/mtw-wml` and `packages/mtw-gateways`.
2. **No complement left:** after Slice 6, `git grep -n "Remainder'" -- '*.ts'` finds no cover sentinel.
3. **Anchor resolution:** every `](Other.md#anchor)` in this file resolves. Copy existing links rather than deriving slugs.

## Progress

| Slice | State |
| --- | --- |
| 0. Verify premises | Not started; (d) carried from remainderIdentity |
| 1. Coverage invariant | Not started |
| 2. Producers | Waiting on Slice 0(a), MC-1 |
| 3. Bystanders | Waiting on Slice 0(b) |
| 4. Fixed hostless id | Waiting on Slice 0(c), MC-2 |
| 5. Migration | Waiting on Slices 2 and 4 |
| 6. Remove `Remainder` | Waiting on Slice 5 |
| 7. Docs and graduation | Not started |
