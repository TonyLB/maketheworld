# ConnectedTo: the topology corpus

**Companion to [`AGENT.connectedTo.planning.md`](AGENT.connectedTo.planning.md)** (evidence corpus class, per the [ladder](../../../../AGENT.designVariant.md#the-companion-file-ladder)). Created **2026-10-22** for [OD-6](AGENT.connectedTo.planning.md#open-decisions-implementation--plan-only): when may two bindings of one object sit under the same parent binding, and when must they be contracted into one? The row's own return path asked for this corpus before any rule is chosen.

## How to read and write cases here

The edge-abstractions corpus's [rules 1--5](AGENT.edgeAbstractions.corpus.planning.md#how-to-read-and-write-cases-here) apply, cited rather than restated: cases are written against today's model, propose no solution, name what they would falsify, must discriminate between the candidates, and cite a parent case rather than copy it. Two local additions:

1. **Every case writes its topology out in full:** each binding, its parent, and each `ConnectedTo` edge, in the notation below. A case whose shape has to be inferred from prose cannot be checked against a rule.
2. **A case states the outcome the fiction wants, or says plainly that the fiction is undecided.** An undecided case is booked to find out what the fiction wants, not to grade a rule.

**This corpus disposes with the plan.** At disposal, ask whether it graduates somewhere durable, since a topology rule will outlive the plan that chose it.

### Notation

- `R1⟨A⟩` is binding `R1` whose parent is a binding of `A` (a room's `PRESENCE#Base`, unless the case names another binding). `R1⟨A,T⟩` would be a binding with two parents.
- `R1 – R2` is a `ConnectedTo` edge. It is symmetric ([`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), "`ConnectedTo` rules").
- **Siblings** are bindings of one object under the same parent binding. That is the parent DAG (`fromHostPresences`). **Neighbors** are bindings joined by a `ConnectedTo` edge. That is the topology. The two graphs are different, and every case keeps them apart.
- A binding's **degree** is its number of `ConnectedTo` edges. A **bare** binding has degree 0.

### Today's model, which every case is written against

- **The collision rule:** `applyStepSequenceCore` throws at the end of a run that leaves two bindings of one host under the same parent binding ("a join was missing"). `classifyPresenceCoverDrift` reports the same state as `Duplicate`.
- **The convergence join:** when a move leaves the mover with two bindings under one parent, `resolvePresenceMoves` writes a `joinPresenceBindings`, unasked. The binding already under the destination survives, and Base always survives. A `ConnectedTo` *between* the two joined bindings is dissolved first. Any other `ConnectedTo` on the absorbed binding is **not** rewritten and is left naming a binding that no longer exists (Progress row 4 of the plan).
- **Extend** (`extendSteps`) splits a binding in place and connects the two pieces. The original keeps its id and its edges, and the new piece hangs off it. So extending the end of a string lengthens it, and extending a binding in the middle makes a branch. What extend cannot do is insert a binding *into* a stretch, since that needs a choice of which piece keeps which edge; its doc records this ("nothing here does"). The only player route is extend plus a move of the new binding.
- **Nothing closes a cycle.** No producer writes a `ConnectedTo` between two bindings that are already connected by a path.

| Case | Grades | State |
| --- | --- | --- |
| [CT-C1](#ct-c1-theseus-passes-the-intersection-twice) | Non-adjacent siblings that both have edges | **Passes under the shipped rule** (Slice 6 payoff): 2 keeps `T2`, `T4` apart; the pre-Slice-6 rule failed |
| [CT-C2](#ct-c2-coiling-the-rope-back-in) | Adjacent siblings on a string; a string shrinking to a point | **Passes under the shipped rule** (Slice 6 payoff); shrinking to one binding is not a topology change (no branch or loop lost) |
| [CT-C3](#ct-c3-the-rope-between-two-pulleys) | Non-adjacent siblings that become adjacent; contraction applied repeatedly | **Passes under the shipped rule** in both states (Slice 6 payoff); the pre-Slice-6 rule failed |
| [CT-C4](#ct-c4-the-net-over-four-chairs) | Adjacent siblings that are both branch points | **Closed 2026-10-22 by the user:** no automatic contraction changes topology, so the H stays |
| [CT-C5](#ct-c5-the-necklace-on-a-hook) | Adjacent siblings that share a neighbor (a loop) | **Read 2026-10-22.** Ungraded but harmless: the same principle forbids collapsing a loop whatever granularity decides |
| [CT-C6](#ct-c6-the-thread-wound-around-a-post) | Whether binding count can carry information | **Read 2026-10-22.** Not a contraction case; a count belongs on an edge or attribute |
| [CT-C7](#ct-c7-the-plate-on-the-far-stretch-of-the-cloth) | Attachments carried through a contraction | **Closed 2026-10-22 by the user:** a contraction never moves an attachment; cascading pulls are a separate, later function |
| [CT-C8](#ct-c8-the-slime-that-splits-and-flows-back-together) | Bare siblings, and a bare binding beside one with edges | **(b) passes under the shipped rule** (Slice 6 payoff); forced amendment 1 to the candidates |

---

## CT-C1: Theseus passes the intersection twice

**Re-grades [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread)** (Ariadne's thread) at binding granularity. C7 asked how a thread present in many rooms is represented at all. This case takes the representation as built and asks only what happens when the route revisits a room.

### What the fiction wants

Theseus ties the thread at entry A and unspools it through intersection B, into room C, back through intersection B by another arch, and up staircase D. Standing in B, anyone sees **two stretches** of thread crossing the room: one between A and C, one between C and D. Cutting one stretch must leave the other intact. Following the thread back out from D must pass through B, then C, then B again.

**A minimal variant:** a rope carried from room A to room B and back into A without being reeled in. Room A holds both ends: two stretches of one rope, joined only by the loop through B.

### Topology

```
T1⟨A⟩ – T2⟨B⟩ – T3⟨C⟩ – T4⟨B⟩ – T5⟨D⟩
```

`T2` and `T4` are siblings (both under B's Base). Each has degree 2. They are not neighbors; the only path between them runs through `T3⟨C⟩`.

Minimal variant: `R1⟨A⟩ – R2⟨B⟩ – R3⟨A⟩`, with `R1` and `R3` siblings, not neighbors.

### Today

Each step is extend-then-move at the far end: extend `T3` (an end, so the new piece simply lengthens the string), then move the new binding into B. That move leaves two bindings under B's Base, so the planner writes a convergence join: `T4` is absorbed into `T2`. No edge runs between them, so nothing is dissolved. The edge `T3 – T4` is left naming the absorbed binding. In the minimal variant, carrying `R3` into A joins it into `R1` (Base survives) and leaves `R2 – R3` dangling.

### The limit it hits

The collision rule cannot hold for this fiction. Today's model either throws or merges the two stretches, and the merge leaves a dangling edge and a thread that no longer passes through B twice.

### What this case would falsify

- Any rule that merges all siblings regardless of topology (today's rule).
- Any rule that merges siblings in the same connected component (rejected on this case; see the reading below).

## CT-C2: Coiling the rope back in

**Re-grades [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in)** at binding granularity. C9 showed that hauling a rope in needs no edge changes under a port model. This case asks what the binding topology does when two stretches of a string end up under one parent.

### What the fiction wants

**(a) A rope in two rooms.** One end is in room A and the rope runs into room B. Standing in A, the player hauls it in. Afterward there is **one rope in room A**, and nothing about it says it once reached B.

**(b) A rope in three rooms, hauled in one room's worth.** The rope runs A → B → C. Standing in B, the player hauls in the stretch from C. Afterward the rope runs A → B and nowhere else, and is otherwise indistinguishable from a rope that was only ever carried from A into B.

### Topology

(a) Before: `R1⟨A⟩ – R2⟨B⟩`, where `R1` is the rope's Base (extend splits in place, so Base stays at the origin). After moving `R2` into A: `R1⟨A⟩ – R2⟨A⟩`, adjacent siblings, both of degree 1.

(b) Before: `R1⟨A⟩ – R2⟨B⟩ – R3⟨C⟩`. After moving `R3` into B: `R1⟨A⟩ – R2⟨B⟩ – R3⟨B⟩`. `R2` and `R3` are adjacent siblings; `R3` has degree 1.

### Today

Both work. The convergence join dissolves the edge between the pair and absorbs the moved binding. In (a) the rope is left with Base alone, and in (b) with `R1 – R2`. No other edge exists on the absorbed binding, so nothing dangles.

### The limit it hits

None. This is a worked success, kept as the baseline any rule must still pass: adjacent siblings on a string contract, and a two-binding string that ends up under one parent becomes a single binding. In (a) the string changes shape (from a line to a point); the fiction wants that change.

### What this case would falsify

Any rule that leaves adjacent siblings on a string apart, or that refuses the line-to-point collapse in (a) because it changes the shape.

## CT-C3: The rope between two pulleys

No parent case. The user's example of 2026-10-22.

### What the fiction wants

A rope is threaded back and forth between two pulleys mounted in one room: from the floor, up over pulley P, down to the floor, up over pulley Q, down to the floor. The room holds **three hanging stretches**, separated by the loops over the pulleys. Pulling the rope off pulley P drops that loop to the floor. The first two stretches become one stretch, and the third stays separate (it still hangs from Q).

### Topology

Threaded:

```
R1⟨room⟩ – Rp⟨P⟩ – R2⟨room⟩ – Rq⟨Q⟩ – R3⟨room⟩
```

`R1`, `R2` and `R3` are siblings. No two of them are neighbors.

After pulling the rope off P (moving `Rp` to the room): `R1⟨room⟩ – Rp⟨room⟩ – R2⟨room⟩ – Rq⟨Q⟩ – R3⟨room⟩`. Now `R1 – Rp` and `Rp – R2` are adjacent sibling pairs. The fiction wants `R1`, `Rp` and `R2` to become one binding, still connected to `Rq`, with `R3` kept apart.

### Today

Extend can build each step: start with `R1` in the room, extend it and move the new end onto P (`Rp`), extend `Rp` and move the new end down to the room (`R2`), and so on. The build stops at that third step. Moving `R2` into the room leaves it a sibling of `R1`, so the planner's convergence join absorbs `R2` into `R1` and leaves `Rp – R2` naming the absorbed binding. The threaded state is never reached. Even if it were, pulling the rope off P would need `R1`, `Rp` and `R2` to contract in turn, and the convergence join handles one pair per move.

### The limit it hits

The collision rule and the convergence join forbid the threaded state, and the join handles only one pair per move.

### What this case would falsify

- Any rule that merges non-adjacent siblings that both have edges (`R1`, `R2`, `R3` while threaded).
- Any contraction applied once rather than until no contractible pair remains. One step leaves `R1`, `Rp` and `R2` as two bindings, not one.

## CT-C4: The net over four chairs

No parent case. Added 2026-10-22 to test OD-6's candidate 3 (homeomorphic contraction) on two branch points.

### What the fiction wants

A cargo net is slung over four chairs, its middle sagging to the floor. At the coarse level the player sees "a net draped over four chairs". At a finer level, the sag may have two low points: one between chairs 1 and 2, one between chairs 3 and 4, with a ridge of net between them.

**The fiction is undecided**, and the case is booked to find out. Does anything the player can do tell "one low point touching four chairs" from "two low points, each touching two chairs, joined by a ridge"? Some candidates:
- pulling the net off chairs 3 and 4 only;
- something resting in one low point;
- describing where a dropped coin rolls.

If nothing tells them apart, merging them loses nothing.

### Topology

```
N1⟨chair1⟩ – A⟨room⟩ – N2⟨chair2⟩
               |
N3⟨chair3⟩ – B⟨room⟩ – N4⟨chair4⟩
```

That is, `A – N1`, `A – N2`, `A – B`, `B – N3`, `B – N4`. `A` and `B` are adjacent siblings, both of degree 3 (an H shape). Contracting them gives one floor binding of degree 4 (an X shape).

### Today

Extend can make the branches: extending `A` after it has an edge hangs another piece off it. The build stops where CT-C3's does: putting `B` in the room beside `A` triggers the convergence join, which absorbs one into the other.

### What this case would falsify

Candidate 3 refuses this contraction, because it merges two branch points. **If** the fiction cannot tell H from X, the candidate is too strict. **If** some play distinguishes them, the candidate is right, and any rule that contracts all adjacent siblings is wrong.

## CT-C5: The necklace on a hook

No parent case.

### What the fiction wants

A necklace hangs from a hook on the wall, both sides falling into the room and meeting at the bottom. It is a **closed loop**: a player can lift it off the hook and put it over their head. A string hanging from a hook cannot be put on.

### Topology

```
N1⟨hook⟩ – N2⟨room⟩ – N3⟨room⟩ – N1
```

`N2` and `N3` are adjacent siblings and share the neighbor `N1` (a triangle). Contracting them leaves `N1` with two edges to one binding, or one edge if the duplicate is collapsed. Either way the loop is lost, and the necklace reads as a string hanging from a hook.

**The granularity question this case must answer before it grades anything:** at the coarse level, the necklace is a single binding on the hook, and its being a loop is a property of the object, not of its bindings. This case grades a rule only if the loop must be visible in the topology.

### Today

Not buildable: nothing closes a cycle, and `N2` and `N3` under the room trip the collision rule.

### What this case would falsify

Any contraction that collapses a loop, if the case's granularity question comes out "the topology carries the loop".

## CT-C6: The thread wound around a post

No parent case. Booked from the 2026-10-22 discussion, where the user corrected the reading this case was first offered for.

### What the fiction wants

A thread is wound three times around a post. "Unwind the thread" takes three turns, and the description says it is wound three times.

### Topology

The reading first offered was three bindings in a row, `P1⟨post⟩ – P2⟨post⟩ – P3⟨post⟩`, contracted to one, which would lose the count. The user's correction: the thread at the post is **one position**, so it is `P1⟨post⟩` alone, and "three times" describes how it relates to the post, not how many bindings it has.

### Today

The thread's binding sits under the post's binding. Neither the hosting edge nor `ConnectedTo` carries a label, so nothing records a count.

### The limit it hits

Today's model has nowhere to record "wound three times". That limit does not involve contraction: it holds even with one binding.

### What this case would falsify

Any rule whose correctness depends on binding multiplicity carrying information. If a count could be read off the number of sibling bindings, every contraction rule would destroy it. This case is evidence that such information belongs on an edge, and that contraction need not preserve multiplicity.

## CT-C7: The plate on the far stretch of the cloth

No parent case. Booked to test whether contraction can betray an attachment.

### What the fiction wants

A tablecloth is draped over two tables pushed side by side, and a plate sits on the part over table 2. The player pulls the whole cloth onto table 1. The plate comes with the cloth (it was sitting on that stretch), so afterward the plate is on the cloth, on table 1.

**A variant with a tie instead of a plate:** the part over table 2 is tied to the table leg with a cord. Pulling it onto table 1 tears the tie or is refused. Either way, the tie cannot follow the cloth to table 1.

### Topology

Before: `C1⟨T1⟩ – C2⟨T2⟩`. The plate's binding is under `C2`, that is, in `C2`'s cover. After moving `C2` onto table 1: `C1⟨T1⟩ – C2⟨T1⟩`, adjacent siblings. The plate is still under `C2`.

### Today

The move carries `C2`'s cover with it. The convergence join then absorbs one binding into the other and merges the covers, so the plate ends under the survivor. The tie is a non-hosting edge on `C2`; severing it on the move defers to the adjudicator, as for any edge a move severs.

### The question this case asks

**Can a contraction ever move an attachment from one position to another?** Siblings are under one parent by definition, so the attachment has already traveled with its binding by the time the contraction runs. If this holds in every case, attachments place no constraint on contraction rules. If some attachment (a plate on one specific low point of CT-C4's net, say) distinguishes two siblings, that is a constraint.

### What this case would falsify

Any rule that refuses a contraction to protect an attachment, if the answer here is that the attachment never moves.

## CT-C8: The slime that splits and flows back together

No parent case. The OD-6 row named slime.

### What the fiction wants

**(a)** A slime is hacked in two. One blob is carried into room B, then back into room A, where it flows back into the rest. Afterward there is one slime, no different from before the cut.

**(b)** A slime in room A has stretched a tendril into room B. A blob cut from it earlier is carried back into room A. It flows into the main mass, and the tendril into B is unaffected.

### Topology

(a) After the cut and the return: `S1⟨A⟩`, `S2⟨A⟩`, bare siblings.

(b) `S1⟨A⟩ – S2⟨B⟩` (the tendril), plus the bare blob `S3⟨A⟩`. `S1` and `S3` are siblings, and only `S1` has an edge.

### Today

(a) works: a split (`partMoveSteps`, which no request reaches yet) followed by a move back triggers the convergence join. (b) also works: `S3` is absorbed into `S1` (the binding already under the destination survives), and `S3` has no edges to dangle.

### The limit it hits

None today. It is a worked baseline for the bare cases.

### What this case would falsify

- Any rule that keeps bare siblings apart (a).
- Any rule that keeps a bare binding apart from a sibling that has edges (b). OD-6's candidate 2, read literally, does this ("at least one of which has topology, and they are not connected to each other"). Whether the fiction in (b) is right is this case's question.

---

## Reading against OD-6's candidates (2026-10-22)

**The rule chosen (OD-6, decided 2026-10-22; shipped by Slice 6, stated in [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), "Convergence is contraction"):** for siblings, (1) a binding with no `ConnectedTo` edge merges into a sibling, whatever edges that sibling has; (2) two siblings that both have edges, with no edge between them, stay apart; (3) two neighbors contract when at least one has at most two edges and they share no other neighbor, repeated until no such pair remains, with the absorbed binding's other edges rewritten onto the survivor. The planner writes the contraction; the kernel and `Duplicate` refuse or report a pair the rule would still merge. There is no player-facing contract instruction.

**Criteria rejected along the way, each with the case that rejected it:**
- **Same connected component** (merge siblings that are connected at all): every part of an extended whole is in one component, so it merges `T2` and `T4` (CT-C1).
- **Homeomorphism** (merge only if the shape is unchanged): a line and a point are not homeomorphic, so it refuses CT-C2(a)'s coiled rope.
- **Homotopy alone:** H and X are both trees, so it cannot keep CT-C4's H.
- **Adjacency alone** (the row's first leaning: contract any two neighbors under one parent): it collapses CT-C4's two branch points and CT-C5's loop; the degree and shared-neighbor conditions are what it lacked.
- **A bare binding stays apart from one with edges** (the first wording of candidate 2): refused by CT-C8(b), where the blob flows back into a slime with a tendril.
- **Candidate 1 excluding Base and Unplaced:** in CT-C2(a) and CT-C8 the survivor is a placed Base, so only hostless bindings are excluded (and the collision rule never pairs those: they have no parent).

- **The principle the reading produced (the user's):** an automatic contraction never changes the topology, and topology means **branch points and loops**. Ends, and the bindings strung between branch points, are not structure: a string may shorten, down to one binding (CT-C2(a)). Candidate 3's two conditions are exactly this test: one protects branch points (CT-C4), the other loops (CT-C5).
- **Homeomorphism was the wrong framing.** It would have refused CT-C2(a), since a line and a point are not homeomorphic. Homotopy alone is too weak, since H and X (CT-C4) are both trees. Naming branch points and loops directly is what fits every case.
- **Binding count carries no information (CT-C6), and neither does arrangement.** A winding count, or how a rope lies in one room (coiled, laid out, doubled over), is not topology; if a story needs it, it is an attribute, never a count of bindings. This is what lets every contraction drop bindings freely.
- **Contraction is local (CT-C7).** It merges bindings already at one position, so it never moves an attachment. Dragging things along, including across rooms, is a cascading pull: a separate function the system will need later, not contraction.
- **CT-C8(b) forced amendment 1:** a bare binding merges into any sibling, whatever edges that sibling has. CT-C8's "What this case would falsify" keeps its booking wording; the falsified reading of candidate 2 is the pre-amendment one.
- **What the corpus did not decide, and how it was settled:** who writes the contraction (the planner, as it writes convergence joins: rewriting `ConnectedTo` edges is a planning choice), and whether contract stays a Plan instruction (no: under the principle, an explicit contract would be needed only for a deliberate topology change, bunching the net into one heap, say, and no case here asks for one).
- **Verdicts under the shipped rule (Slice 6, `connectedToContraction.payoff.test.ts`, through extend plus a move of the new end, judged by the drift classifier):** CT-C1 passes (both stretches in B, and the minimal variant), CT-C2 (a) and (b) pass, CT-C3 passes threaded and pulled off P, CT-C8(b) passes. CT-C4 and CT-C5 follow from the rule's conditions (`siblingContraction.test.ts`); no player route builds them yet.
- **Buildability:** CT-C1, CT-C3 and CT-C4 are blocked today only by the collision rule and the convergence join; extend at the far end (lengthening) or at a middle binding (branching) builds every step. CT-C5 also needs a producer that closes a loop, which nothing has.

