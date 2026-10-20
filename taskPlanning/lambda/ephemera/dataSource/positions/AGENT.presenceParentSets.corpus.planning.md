# Presence parent sets: the move corpus

**Companion to [`AGENT.presenceParentSets.planning.md`](AGENT.presenceParentSets.planning.md), created 2026-10-19.** This file holds state-transition cases for the move shape (PS-2, PS-3) and the evaluation of each proposed instruction framework against them. Open rows and progress stay in the plan.

**The form of a case.** We have state S1, and we want to reach state S2. A case says what S1 and S2 are, what must not change on the way (usually the view of a parent that the move does not name), and the fiction, if there is one. A case is written without reference to any framework. A framework is then judged on what instruction, or composition of instructions, takes S1 to S2, and how that instruction behaves.

**Admission rules.**

1. A case states S1 and S2 in full in the notation below. A case whose S2 is the corpus's own reading rather than one the user gave says so, and gives the other readings.
2. An evaluation names a framework from [Frameworks](#frameworks) and gives, for each case, the steps (or "unreachable", or the site where it stops) and the criteria it fails.
3. A new framework is added to [Frameworks](#frameworks) with its instruction shapes, and then evaluated against every case. A partial evaluation is labelled partial.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## Notation

`B{A, C} = [X, Y]` is binding `B` of the mover, with parents `A` and `C` (bindings in other hosts), covering entries `X` and `Y`. Entries name child bindings, so a child of `X`'s host has `B` among its parents. `B{} = [...]` is hostless. Bindings named `Base` and `Unplaced` are the two hostless bindings of [PR-24](AGENT.presence.planning.md#settled-register). When nothing is said otherwise, every case is about one mover host.

The legality invariant every S1 and S2 obeys: **for each parent binding, at most one binding of a host has it in its parent set** (the run-end guard in `applyStepSequenceCore.ts`). Covers may overlap ([PR-24](AGENT.presence.planning.md#settled-register)).

## Criteria

Each evaluation grades each case on these criteria.

- **R. Reachable.** Some composition reaches S2 exactly.
- **U. Unnamed parents.** No parent that the instructions do not name changes its view, unless the instruction states that it does.
- **A. Unambiguous.** Each instruction, read against S1, has exactly one result.
- **S. Stale-safe.** Each step checks what its producer read, so a stale read is a refusal, not a different write.
- **C. Cost.** The number of steps, and what the planner must read to compose them.

Intermediate states inside one run need not be legal: the guard checks only at the run's end. A step's own checks still run.

## Cases

### Group 0: the simple cases

The three basic changes to a parent set, with no fiction. The user gave them on 2026-10-19. They are numbered after the others so that existing ids stay stable. M15 is M8 without the fiction, and M17 is M6 with an existing target in place of a new one.

**M15. Join: two bindings with equal covers become one shared binding.**
S1: `C{A} = [X]`, `C′{B} = [X]`.
S2: `C{A, B} = [X]`.

**M16. Separation: one shared binding becomes two.**
S1: `C{A, B} = [X]`.
S2: `C{A} = [X]`, `C′{B} = [X]`.

**M17. A part moves from one parent's view into another binding.** Y moves out of C as B sees it, and into D.
S1: `C{A, B} = [X, Y]`, `D{E} = [X]`.
S2: `C{A} = [X, Y]`, `C′{B} = [X]`, `D{E} = [X, Y]`.

### Group 1: one parent moves, another is not named

The fiction for this group is the ring that sits on the Table and is also one of the Rings of Power (RoP). The player moves it from the Table to the Shelf. In every case Rings of Power must see what it saw before, and the Table must see nothing of the ring afterwards.

**M1. No collision.**
S1: `R{Table, RoP} = [g]`.
S2: `R{Shelf, RoP} = [g]`.

**M2. The ring already sits on the Shelf, with an equal cover.**
S1: `R{Table, RoP} = [g]`, `R2{Shelf} = [g]`.
S2: one binding `{Shelf, RoP} = [g]`. Which id it keeps is open (draft O1).

**M3. The Shelf's cover is a strict subset.**
S1: `R{Table, RoP} = [g, h]`, `R2{Shelf} = [g]`.
S2: `R{Shelf, RoP} = [g, h]`. The Shelf gains h.

**M4. The Shelf's cover is a strict superset.**
S1: `R{Table, RoP} = [g, h]`, `R2{Shelf} = [g, h, k]`.
S2: `R{RoP} = [g, h]`, `R2{Shelf} = [g, h, k]`. Rings of Power must not gain k, so the two bindings stay apart. This is the corpus's reading. The other reading, one binding `{Shelf, RoP} = [g, h, k]`, changes what Rings of Power sees.

**M5. The covers are disjoint.**
S1: `R{Table, RoP} = [g]`, `R2{Shelf} = [h]`.
S2: `R{RoP} = [g]`, `R2{Shelf} = [g, h]`. This is the corpus's reading, under PS-3(a)'s draft answer. The other reading, `{Shelf, RoP} = [g, h]`, gives Rings of Power h. **M5a** is the same without RoP: S1 `R{Table} = [g]`, `R2{Shelf} = [h]`, S2 `R2{Shelf} = [g, h]`.

### Group 2: part of a binding, as some parents see it

Binding B is seen by two parents, A and C. One entry is to leave A's view and be seen under Q, while C keeps seeing everything. This is the user's example, 2026-10-19. C's view must not change.

**M6. X leaves A's view for Q's.**
S1: `B{A, C} = [X, Y]`.
S2: `B{C} = [X, Y]`, `B′{A} = [Y]`, `N{Q} = [X]`. B′ and N are new ids; which binding keeps the id B is not part of the case.

### Group 3: through a shared binding

The backgammon set sits in two chests at once ([PR-C5](AGENT.presence.corpus.planning.md#pr-c5-the-steamer-chest-in-the-attic-and-the-backgammon-set-inherited-twice)). In S1 of M7, Backgammon holds one binding, `BG{chestA, chestB}`. Nothing else Backgammon covers may change.

**M7. The die is taken out of the set and held in the hand** (beat 3). The mover is the die.
S1: `d{BG} = []`.
S2: `d{Hand} = []`.

**M8. The set's two bindings become one shared binding** (beat 2; the PS-4 question). The mover is Backgammon.
S1: `BG1{chestA} = [d]`, `BG2{chestB} = [d]`.
S2: `BG{chestA, chestB} = [d]`.

### Requests with no legal S2

These are not cases. Each is a request that a framework might let a producer write, and no legal state satisfies it. A framework is graded on whether it can write the request at all.

- **Q1** (from M6's first statement). From `B{A, C} = [X, Y]`, ask for `B{A} = [Y]` and `D{A} = [X]`. That is two bindings under A.
- **Q2** (M8 with unequal covers). From `BG1{chestA} = [d, s]`, `BG2{chestB} = [d]`, ask for one shared binding. Either chest's view would change.

### Group 4: Base, Unplaced, and fallthrough

Base and Unplaced are both stored, and both may be hostless at once. The user decided this on 2026-10-19. Base holds the default contents. Unplaced is the catch-all for entries that fell out of every placed binding. Base never absorbs Unplaced. Unplaced exists only while it covers something, and Base always exists.

**M9. Part of a hostless Base is placed** (PS-3(b)).
S1: `Base{} = [X, Y]`.
S2: `Base{} = [Y]`, `N{Q} = [X]`. **M9a**, Base placed: S1 `Base{A} = [X, Y]`, S2 `Base{A} = [Y]`, `N{Q} = [X]`. In both, Base's parents are unchanged.

**M10. A departure while Base is placed elsewhere.**
S1: `Base{Q} = [Y]`, `B{A} = [X]`.
S2: `Base{Q} = [Y]`, `Unplaced{} = [X]`.

**M11. The same, but Base also covers the departing entry.**
S1: `Base{Q} = [X, Y]`, `B{A} = [X]`.
S2: `Base{Q} = [X, Y]`. X is still placed, so nothing falls through and there is no Unplaced.

**M12. Base leaves its last parent while Unplaced exists** (draft O2).
S1: `Base{Q} = [Y]`, `Unplaced{} = [Z]`.
S2: `Base{} = [Y]`, `Unplaced{} = [Z]`. Unplaced survives, which answers draft O2 (user, 2026-10-19). The earlier S2 was `Base{} = [Y, Z]` with Unplaced gone, which is today's absorb. The evaluations of D and E below were graded against that earlier S2.

### Group 5: convergence (scrubs)

**M13. Two bindings in different hosts are both moved to the hand.**
S1: `p1{Table} = [a]`, `p2{Chair} = [b]`.
S2: `p{Hand} = [a, b]`, one binding.

**M14. Two bindings in the same host are both moved to the hand.** The plank sits under two bindings of one table.
S1: `p1{T1} = [a]`, `p2{T2} = [b]`, where T1 and T2 are both bindings of the table.
S2: `p{Hand} = [a, b]`, one binding. PR-25 rule (1) says a move out of a host removes every parent on that host.

**M18. A scrub whose children collide one level down.** Two hosts: the plank (p) and the apple (a), which sits on both of the plank's bindings through two bindings of its own. The corpus added this case on 2026-10-19, while evaluating D. It is the shape `cascadeHostsOf` exists for in K.
S1: plank `p1{Table} = [a1]`, `p2{Chair} = [a2]`; apple `a1{p1} = []`, `a2{p2} = []`.
S2: plank `p{Hand} = [a]`; apple `a{p} = []`, one binding. **M18a** is the same with unequal child covers, `a1{p1} = [s]` and `a2{p2} = []`. Its S2 is the apple `a{p} = [s]`. That is the corpus's reading: both views that saw the apple go away, so the union changes no view that survives.

---

## Frameworks

- **K. Today's kernel.** `movePresenceBinding` takes one binding, one `from: ParentBinding | null`, one `to`, and an optional `subCover`. A whole move replaces the parent set with `[to]` (`movePresenceBinding.ts:106`). Moved children's parent sets are overwritten with the target (`:201`). A child left with two bindings under the target is merged recursively (`:247`). `resolvePresenceMoves` is the planner.
- **P. Parent-addressed** (the user's first proposal, 2026-10-19). `fromHostPresences[]`, optional `subCover`, `toHostPresences[]`. The listed items, or the subCover, are removed from each from-parent. A child is unplaced if and only if it has no positions left. Not evaluated case by case: the user withdrew it on two ambiguities, each of which shows in a case here. With Base under A and B, adding contents under B alone leaves it unclear which binding is Base (M9a's shape). And with identical contents under two parents, nothing says whether they join (M8).
- **B. Binding-addressed** (the user's second proposal, 2026-10-19). `fromBindings: { presenceBindingId, presenceParents?, subCover? }[]`, and likewise `toBindings`. Not evaluated case by case. Q1 is writable in it, which led to D.
- **D. Pairing change and content move.** The plan's first-iteration draft, retired 2026-10-20 in favour of F. Its open points: **O1**, which binding survives a collision; **O2**, Base going hostless while Unplaced exists (answered: no collision, Group 4); **O3**, marking a target as minted or existing; **O4**, the planner composes several steps from one read.
  - A *pairing change* edits one binding's parents (leave, gain, or both; a separation onto a named new binding) and never its own cover. A collision merges only equal covers.
  - A *content move* takes a subCover out of all of one binding, into an existing binding, a minted one with stated parents, or nowhere. It never changes a parent set, except that a minted target's parents are set.
  - The *end-state rule*: an entry is in the hostless binding if and only if no placed binding covers it.
- **E. Parent groupings** (the user's proposal, 2026-10-19). D's two operations become one step, `{ from: ParentBinding[][], to: ParentBinding[][], subCover? }`, which names bindings by their parent sets. These rules are the corpus's reading of it. The user later judged E "still probably not right" (2026-10-19), and F follows from that.
  - **E1.** Each list in `from` names one existing binding of the mover by its exact, full parent set. The invariant makes that name unique, and `[]` names the hostless binding. The match is the stale-read check.
  - **E2.** The lists in `to` are the new grouping, and no parent may appear in two of them. A parent that is in `to` but in no `from` list is gained. If a binding that the step does not name already sits under that parent, the step is refused. To join that binding, the step names it in `from`.
  - **E3. Whole step (no subCover).** The `from` bindings are replaced by one binding per `to` list, and each new binding covers the union of every `from` cover. A parent named in `to` whose view changes has that change stated by the step that names it.
  - **E4. SubCover step.** S leaves every `from` binding, and those bindings keep their parents. Each `to` list names an existing binding or a new one, and S is added to it. An empty `from` is a copy.
  - **E5.** A whole step with `to: []` removes the `from` bindings. D's end-state rule decides what falls through.
  - **E6.** A child left with several bindings under one new binding gets the same step one level down, for example from `[[p1], [p2]]` to `[[p]]`.
- **F. Reparent, join, split** (worked out with the user, 2026-10-19). Three kernel operations, each with its natural meaning. The instruction compiler builds higher-order requests, such as "move these contents elsewhere", out of them.
  - **Reparent.** One binding gains named parents, loses named parents, or both. Its cover does not change.
  - **Join.** Several bindings become one. Its parents are the union of their parents, and its cover is the union of their covers. If Base is one of them, the result is Base. Otherwise, which id survives is F-O1.
  - **Split.** One binding becomes several pieces. Each piece takes a subset of the parents and a subset of the cover. At both levels the subsets may overlap, and together they must cover the original. The step says which piece keeps the original id.
  - **Inside a run**, the parenting invariant may be broken. Two pieces of a split may sit under one parent until a later step moves one of them.
  - **At the end of a run:**
    - **F-R1. Removal.** A binding with no parents, other than Base or Unplaced, is removed. Each child binding that pointed at it drops that parent. A child binding left with no other parent on this host gains `{host, Unplaced}`, and Unplaced is created if it does not exist.
    - **F-R2. The root bindings.** Base and Unplaced are stored, and both may be hostless at once (Group 4). Unplaced is removed when empty. Base always exists.
    - **F-R3. Collisions.** Two bindings of one host under one parent (Unplaced included) are joined, then the same rule applies one level down.
    - **F-R4. Checks.** The parenting invariant holds. Every parent whose view at the end differs from its view at the start is named by the request (the view rule). Views are compared across the whole run, not after each step.

## Evaluation: D

| Case | Steps | R | U | A | S | C |
| --- | --- | --- | --- | --- | --- | --- |
| M15 | Pairing change C: gain B. It collides with C′, the covers are equal, so they merge | ✓ | ✓ | O1 | ✓ | 1 |
| M16 | Pairing change: separate B off C onto C′ | ✓ | ✓ | ✓ | O3 | 1 |
| M17 | Separate B off C onto C′; content move C′'s `[Y]` into D | ✓ | ✓ | ✓ | O3 | 2 |
| M1 | Pairing change R: leave Table, gain Shelf | ✓ | ✓ | ✓ | F5 | 1 |
| M2 | The same; it collides with R2, covers equal, merge | ✓ | ✓ | O1 | ✓ | 1 |
| M3 | Content move R2's `[g]` into R; pairing change R2: leave Shelf (removed); pairing change R: leave Table, gain Shelf. Two steps if step 1 is dropped (F2) | ✓ | ✓ | ✓ | O4 | 3 (2) |
| M4 | Pairing change R: leave Table | ✓ | ✓ | ✓ | F5 | 1 |
| M5 | Separate Table off R onto R′; content move R′'s `[g]` into R2; pairing change R′: leave Table (removed) | ✓ | ✓ | ✓ | O3, O4 | 3 |
| M5a | Content move R's `[g]` into R2; pairing change R: leave Table (removed) | ✓ | ✓ | ✓ | O4 | 2 |
| M6 | Separate A off B onto B′; content move B′'s `[X]` into minted `N{Q}` | ✓ | ✓ | ✓ | O3 | 2 |
| M7 | Pairing change d: leave BG, gain Hand | ✓ | ✓ | ✓ | F5 | 1 |
| M8 | Pairing change BG1: gain chestB; it collides with BG2, covers equal, merge | ✓ | ✓ | O1 | ✓ | 1 |
| M9, M9a | Content move Base's `[X]` into minted `N{Q}` | ✓ | ✓ | ✓ | O3 | 1 |
| M10 | Pairing change B: leave A (removed); X falls through | ✓ | ✓ | F3 | ✓ | 1 |
| M11 | The same; X is still covered by Base, so nothing falls through | ✓ | ✓ | F3 | ✓ | 1 |
| M12 | Pairing change Base: leave Q; Z folds into Base | ✓ | ✓ | O2 | ✓ | 1 |
| M13 | Pairing change p1: leave Table, gain Hand; content move p2's `[b]` into p1; pairing change p2: leave Chair (removed) | ✓ | ✓ | ✓ | O4 | 3 |
| M14 | The same with T1 and T2 | ✓ | ✓ | ✓ | O4 | 3 |
| M18 | M13's steps. Step 2 leaves the apple with a1 and a2 both under p1, a collision that D does not define | ? | ✓ | F4 | O4 | 3+ |
| M18a | The same, with unequal child covers | ? | ✓ | F4 | O4 | 3+ |

**What the evaluation shows about D.** Each row was re-derived step by step from the draft's text on 2026-10-19, tracking every child's parent set.

1. **F1. Every case through M14 reaches its S2 exactly, and no unnamed parent's view changes.**
   - The one-step cases are M15, M16, M1, M2, M4, M7 and M9 to M12. Each is one pairing change or one content move.
   - Q2 is refused because the covers are unequal.
   - Q1's one-step form cannot be written. Its nearest composition is a separation, then a content move into a minted `D{A}`, and the mint-collision check refuses it.
2. **F2. M3 needs two steps, not three, once F3 is settled.**
   - Removing R2 first (pairing change R2: leave Shelf) does not make g fall through, because R still covers it. R is then re-pointed.
   - The content move in the three-step version exists only to strip R2 from g's parents. That is exactly what the draft leaves unstated (F3).
   - M4, the mirror case, takes one step. A superset at the destination needs no merge because the bindings stay apart.
3. **F3. The draft does not say what removing a binding does to its children's parent sets.**
   - It says a pairing change leaves the children's pointers untouched "because the binding keeps its id". A binding removed when it has no parents left does not keep its id.
   - M10 and M11 depend on the missing rule. In M10, x's parents must go from `{B}` to `{Unplaced}`. In M11, they must go from `{Base, B}` to `{Base}`.
   - The rule that follows from the end-state rule: the removed binding leaves each child's parent set. A child whose entry falls through gains the hostless binding.
4. **F4. The draft does not define a collision one level down.**
   - A content move's child "swaps B for the target among its parents". If that child's host already has a different binding under the target, the child host ends with two bindings under one parent. That breaks the invariant, and the draft's collision rule covers only a binding that *gains a parent* through a pairing change.
   - M18 hits this at step 2.
   - Two readings:
     - (a) The swap is a pairing change on the child, so equal covers merge and unequal ones are refused. M18 then works in three steps. M18a is refused unless the planner first composes at the apple's level (a content move of a1's `[s]`, and so on, recursively).
     - (b) The step is refused, and the planner always composes downward.
   - Either way, O4 grows from "the planner composes scrubs" to "the planner composes scrubs down the DAG". That is what K's `cascadeHostsOf` plus the recursive merge does today in one step.
5. **F5. A pairing change does not say whether it expects a collision, so it is not stale-safe.**
   - A producer reads M1 and emits leave Table, gain Shelf. If an equal-cover `R2{Shelf}` appears before the write, the step merges where the producer planned a plain re-point. That is a different write, not a refusal.
   - The same holds for M4 and M7. This is O3's question asked for gains rather than mints.
   - The fix is the same shape: a gain states its expected partner (none, or the binding it merges with), and O1's survivor can be read from that.
6. **F6. Transient views depend on the order of steps, and the planner can choose an order that never widens a view.**
   - M13 is now ordered with p1 re-pointed first. Hand briefly sees `[a, b]` and the Chair sees an empty p2, but the Table never sees b.
   - M3's two-step form (F2) has no transient at all.
   - M5 and M6 still pass through a separation's copy. That widens nothing: each parent sees what it saw before.
   - Whether anything observes a transient at all needs confirming against how a run commits.
7. **F7. There is no copy step.** M5 costs a separation, a content move and a removal, so a copy takes three steps. Whether a copy should be its own step is a question for D's next iteration.
8. **F8. M12 depends on O2.** If O2 is answered by the equal-only collision rule instead of the end-state rule, M12 is refused unless Unplaced is empty.

**What D's next iteration owes**, by the findings above:

- the removal rule (F3);
- the child-level collision (F4);
- an expected-collision field on gains (F5, folded into O1 and O3).

F7 and F8 are open choices, not gaps.

## Evaluation: E

| Case | Steps | R | U | A | S | C |
| --- | --- | --- | --- | --- | --- | --- |
| M15 | from `[[A], [B]]` to `[[A, B]]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M16 | from `[[A, B]]` to `[[A], [B]]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M17 | from `[[A, B]]` to `[[A], [B]]`; subCover `[Y]` from `[[B]]` to `[[E]]` | ✓ | ✓ | E-O1 | ✓ | 2 |
| M1 | from `[[Table, RoP]]` to `[[Shelf, RoP]]` | ✓ | ✓ | ✓ | ✓ | 1 |
| M2 | from `[[Table, RoP], [Shelf]]` to `[[Shelf, RoP]]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M3 | from `[[Table, RoP], [Shelf]]` to `[[Shelf, RoP]]`; the union is `[g, h]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M4 | from `[[Table, RoP]]` to `[[RoP]]` | ✓ | ✓ | ✓ | ✓ | 1 |
| M5 | from `[[Table, RoP]]` to `[[RoP]]`; subCover `[g]` from `[]` to `[[Shelf]]` (copy) | ✓ | ✓ | ✓ | ✓ | 2 |
| M5a | from `[[Table], [Shelf]]` to `[[Shelf]]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M6 | from `[[A, C]]` to `[[A], [C]]`; subCover `[X]` from `[[A]]` to new `[[Q]]` | ✓ | ✓ | E-O1 | E-O3 | 2 |
| M7 | from `[[BG]]` to `[[Hand]]` | ✓ | ✓ | ✓ | ✓ | 1 |
| M8 | from `[[chestA], [chestB]]` to `[[chestA, chestB]]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M9, M9a | subCover `[X]` from `[[]]` (or `[[A]]`) to new `[[Q]]` | ✓ | ✓ | ✓ | E-O3 | 1 |
| M10, M11 | from `[[A]]` to `[]`; the end-state rule decides what falls through | ✓ | ✓ | E-F3 | ✓ | 1 |
| M12 | from `[[Q], []]` to `[[]]`; Unplaced is named | ✓ | ✓ | ✓ (Base survives) | ✓ | 1 |
| M13, M14 | from `[[Table], [Chair]]` (or `[[T1], [T2]]`) to `[[Hand]]` | ✓ | ✓ | E-O1 | ✓ | 1 |
| M18, M18a | M13's step; by E6, the apple gets from `[[p1], [p2]]` to `[[p]]` | ✓ | ✓ | E-O1 | ✓ | 1 |

**What the evaluation shows about E.**

1. **Every case reaches its S2.**
   - The only two-step cases are M5, M6 and M17. Each needs entries to regroup as only some parents see them, so a whole step is followed by a subCover step.
   - Q1 cannot be written: it needs A in two `to` lists.
2. **E closes D's F4, F5 and F7, and answers O2.**
   - F5: a join must name its partner, so a binding that appears after the producer's read causes a refusal (E2), not a merge.
   - F4: joins are unions, so the child-level cascade is the same step one level down (E6) and always succeeds. It is K's recursive merge, stated as a rule.
   - F7: an empty `from` is the copy.
   - O2: Base going hostless must name Unplaced, `[]`, or it collides with a binding it did not name.
3. **Unequal joins become legal.**
   - Q2, `from [[chestA], [chestB]] to [[chestA, chestB]]` with `BG1 = [d, s]`, is writable. chestB gains s, a change the step states because it names chestB.
   - This gives up D's rule that only equal covers merge. Whether a producer should be able to write this is a choice for the user. If not, E3 gains a refusal: unequal covers whose parents are all carried over from `from`.
4. **E-O1. The id rule moves to every step that changes a grouping.** Bindings are addressed by parent sets, so ids matter only to children's pointers and to Base. A separation of `Base{A, B}` must still say which half keeps Base, and that was the ambiguity that retired P. E needs a stated rule. One candidate: a `to` list keeps the id of the `from` binding whose parents it shares most, with ties broken by order, and Base always survives.
5. **E-O3. A new `to` binding in a subCover step must be marked new.** Otherwise a stale producer joins where it meant to mint.
6. **E-F3. Removal's effect on children's parent sets still needs stating,** for `to: []` only.
7. **Transients mostly go away.** Scrubs and unequal merges are one step, so the planner orders steps only in M5, M6 and M17. None of those widens a view.
8. **Cost moves into the step.** A planner composing E reads the full parent set of every binding it names, and the covers of any parent it gains. The kernel computes the unions and the cascade, as K does today.

## Evaluation: F

Each row gives the steps the compiler would emit. "Auto" marks a join that F-R3 makes at the run's end. Gaining a parent is a reparent, so a copy of an entry into another binding is a reparent of the entry's child binding, one level down (marked "child").

| Case | Steps | R | U | A | S | C |
| --- | --- | --- | --- | --- | --- | --- |
| M15 | Join C, C′ | ✓ | ✓ | F-O1 | ✓ | 1 |
| M16 | Split C into `{A}:[X]`, `{B}:[X]` | ✓ | ✓ | ✓ | ✓ | 1 |
| M17 | Split C into `{A}:[X, Y]`, `{B}:[X]`; child: Y's binding gains D | ✓ | ✓ | ✓ | F-O2 | 2 |
| M1 | Reparent R: lose Table, gain Shelf | ✓ | ✓ | ✓ | F-O2 | 1 |
| M2 | Reparent R: lose Table, gain Shelf; auto join with R2 | ✓ | ✓ | F-O1 | F-O2 | 1 |
| M3 | As M2; the union is `[g, h]`, and the Shelf, which is named, gains h | ✓ | ✓ | F-O1 | F-O2 | 1 |
| M4 | Reparent R: lose Table. Gaining the Shelf would auto-join and give RoP k, which F-R4 refuses | ✓ | ✓ | ✓ | ✓ | 1 |
| M5 | Reparent R: lose Table; child: g's binding gains R2 | ✓ | ✓ | ✓ | F-O2 | 2 |
| M5a | Reparent R: lose Table, gain Shelf; auto join with R2 | ✓ | ✓ | F-O1 | F-O2 | 1 |
| M6 | Split B into `{C}:[X, Y]` (keeps B), `{A}:[Y]`, `{A}:[X]`; reparent the third: lose A, gain Q | ✓ | ✓ | ✓ | ✓ | 2 |
| M7 | Reparent d: lose BG, gain Hand | ✓ | ✓ | ✓ | F-O2 | 1 |
| M8 | Join BG1, BG2 | ✓ | ✓ | F-O1 | ✓ | 1 |
| M9, M9a | Split Base into `{}:[Y]` (keeps Base), `{}:[X]` (or `{A}:…` for M9a); reparent the second: gain Q (M9a: lose A, gain Q) | ✓ | ✓ | ✓ | ✓ | 2 |
| M10 | Reparent B: lose A. F-R1 removes B, and X's binding gains `{host, Unplaced}` | ✓ | ✓ | ✓ | ✓ | 1 |
| M11 | As M10. X's binding still has Base, so it gains nothing | ✓ | ✓ | ✓ | ✓ | 1 |
| M12 | Reparent Base: lose Q. F-R2 keeps both root bindings | ✓ | ✓ | ✓ | ✓ | 1 |
| M13, M14 | Reparent p1 (lose Table or T1, gain Hand), reparent p2 (likewise); auto join | ✓ | ✓ | F-O1 | F-O2 | 2 |
| M18, M18a | M13's steps; F-R3 then joins the apple's two bindings under p. p1 and p2 are gone at the run's end, so no surviving view changes | ✓ | ✓ | F-O1 | F-O2 | 2 |

**What the evaluation shows about F.**

1. **Every case reaches its S2.** The two-step cases are those where part of a binding regroups (M5, M6, M9, M9a, M17) and the scrubs (M13, M14, M18).
2. **A copy is a reparent one level down.** An entry that is added to a binding is a child binding that gains a parent (M5, M17). Moving content needs no operation of its own in the kernel. It is a compiler-level operation.
3. **There is no mint.** A binding under a new parent comes from a split followed by a reparent (M6, M9). The split's temporary violation (two pieces under A in M6) is what makes that possible without a hostless piece.
4. **Removal is stated** (F-R1), which closes D's F3 and E-F3. M11 is no longer K's wrong write.
5. **The view rule does the work of D's equal-cover rule.** M4 and M5 refuse the join that gaining the Shelf would cause. M3 and M5a allow it, because only the named Shelf's view changes. Q2 is writable, and is legal if the request names both chests.
6. **Q1 is writable as steps and refused at the run's end** by the parenting invariant.
7. **Base gets no special case apart from naming.** It wins any join, and a split says which piece keeps it.

**What F still owes.**

- **F-O1. Which id survives an ordinary join** (draft O1).
- **F-O2. Stale-safety of gains.** An auto join under a gained parent can merge a binding that appeared after the producer's read. The view rule catches this only when an unnamed view changes. This is D's F5 again. One candidate is for a gain to state the bindings it expects to collide with.
- **F-O3. Where the view rule is checked, and what "named" means.** The compiler can check it, but the kernel must then verify the covers the compiler read, so that a stale read is a refusal.
- **F-O4. The request shape** that the compiler accepts for higher-order operations, and how a request states the pieces of a split.

## Evaluation: K (baseline)

Partial: K is the code Slice 4 replaces. It is graded so the corpus records what changes.

- **Every case whose mover binding has more than one parent stops at `parentOf`**, which throws on a multi-parent binding (`presenceParent.ts:36`). It is called in `movePresenceBinding.ts:228` and `resolvePresenceMoves.ts:170`. That is M16, M17, and M1 to M6. Without RoP, M1 to M5 are reached by a union merge into the Shelf's binding.
- **M7** is reached: d has one parent.
- **M15 and M8** are unreachable: no step adds a parent without replacing the set.
- **M9, M9a and M10** are reached.
- **M11 is a wrong write.** K mints `Unplaced = [X]` beside a Base that still covers X, and overwrites X's child binding's parent set with `{Unplaced}` (`:201`). Base's cover then names a child that no longer points back.
- **M12 is a different write.** Base absorbs Unplaced (`:139`), but S2 keeps Unplaced. K reached the earlier S2.
- **M13** is reached in one planner call: two moves, then the recursive merge.
- **M18 and M18a** are reached in one planner call. The recursive merge (`:247`) unions the apple's two bindings whether or not their covers are equal, and `cascadeHostsOf` names the apple's host for the lock.
- **M14** is refused, `moverBindingAmbiguous`, unless `moverGroundedPresence` narrows to one binding. Narrowed, it moves one binding and leaves the plank under the other.
