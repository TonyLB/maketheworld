# Topology corpus: when bindings of one whole may share a parent

**What this file is.** The cases that chose the contraction rule ([`AGENT.contract.md`](AGENT.contract.md), "Convergence is contraction"), each with the outcome its story settles and its verdict under the rule as shipped (2026-10-22), plus the criteria rejected along the way, each with the case that rejected it. It exists so that a later, better rule can be graded against the same evidence. The rule is a Prototype; a case it gets wrong reopens it.

## How to read and write cases here

1. **A case is a story first.** It says what the fiction wants a player to see and do, then writes the topology out, then names what it would falsify. It proposes no rule.
2. **Every case writes its topology out in full:** each binding, its parent, and each `ConnectedTo` edge, in the notation below. A case whose shape has to be inferred from prose cannot be checked against a rule.
3. **A case states the outcome the fiction wants, or says plainly that the fiction is undecided.** An undecided case is kept to find out what the fiction wants, not to grade a rule.
4. **A case must discriminate:** some plausible rule must get it wrong. A case every rule passes grades nothing.
5. **A new iteration of the rule adds its cases and regrades every case**, updating each verdict and the "Under the shipped model" paragraph. A verdict that changes is the point of the exercise, not a regression to hide.

### Notation

- `R1⟨A⟩` is binding `R1` whose parent is a binding of `A` (a room's `PRESENCE#Base`, unless the case names another binding). `R1⟨A,T⟩` would be a binding with two parents.
- `R1 – R2` is a `ConnectedTo` edge. It is symmetric ([`AGENT.contract.md`](AGENT.contract.md), "`ConnectedTo` rules").
- **Siblings** are bindings of one whole under the same parent binding (the parent DAG, `fromHostPresences`). **Neighbors** are bindings joined by a `ConnectedTo` edge (the topology). The two graphs are different, and every case keeps them apart.
- A binding's **degree** is its number of `ConnectedTo` edges. A **bare** binding has degree 0.

### The shipped model, which every verdict is read against

- **Extend** (`extendSteps`) splits a binding in place and connects the two pieces. The original keeps its id and its edges, and the new piece hangs off it: extending an end lengthens a string, and extending a middle binding makes a branch. Nothing inserts a binding *into* a stretch. The player route is extend plus a move of the new binding; a move of one binding on its own (a view-move) is the other.
- **The contraction rule** (`siblingContraction.ts` in `@tonylb/mtw-gateways`): a bare sibling merges into a sibling, whatever edges that one has; two siblings that are neighbors contract when at least one has at most two edges and they share no other neighbor; two siblings that both have edges, with none between them, stay apart. Merges repeat until none applies, and the absorbed binding's other edges are rewritten onto the survivor. The planner writes the merges; the kernel's end-of-run check and the drift classifier's `Duplicate` refuse or report a pair the rule would still merge.
- **The principle:** an automatic contraction never changes topology, and topology means **branch points and loops**. The degree condition keeps branch points apart; the shared-neighbor condition keeps loops open. Ends, and the bindings strung between branch points, are not structure.
- **Nothing closes a cycle.** No producer writes a `ConnectedTo` between two bindings already connected by a path.

| Case | Grades | Verdict under the shipped rule |
| --- | --- | --- |
| [CT-C1](#ct-c1-theseus-passes-the-intersection-twice) | Non-adjacent siblings that both have edges | **Passes** (payoff test) |
| [CT-C2](#ct-c2-coiling-the-rope-back-in) | Adjacent siblings on a string; a string shrinking to a point | **Passes**, (a) and (b) (payoff test) |
| [CT-C3](#ct-c3-the-rope-between-two-pulleys) | Non-adjacent siblings that become adjacent; contraction repeated | **Passes**, threaded and pulled off (payoff test) |
| [CT-C4](#ct-c4-the-net-over-four-chairs) | Adjacent siblings that are both branch points | **Kept as an H**, by the principle (rule unit test; no player route builds it) |
| [CT-C5](#ct-c5-the-necklace-on-a-hook) | Adjacent siblings that share a neighbor (a loop) | **Loop kept** (rule unit test); not buildable |
| [CT-C6](#ct-c6-the-thread-wound-around-a-post) | Whether binding count can carry information | Not a contraction case: a count belongs on an edge or attribute |
| [CT-C7](#ct-c7-the-plate-on-the-far-stretch-of-the-cloth) | Attachments carried through a contraction | Contraction never moves an attachment |
| [CT-C8](#ct-c8-the-slime-that-splits-and-flows-back-together) | Bare siblings, and a bare binding beside one with edges | **(b) passes** (payoff test); (a) follows from the same clause |

The payoff test is [`connectedToContraction.payoff.test.ts`](manipulation/membership/connectedToContraction.payoff.test.ts) (extend plus moves through the real planner and kernel, judged by the drift classifier); the rule's unit test is `siblingContraction.test.ts` in `@tonylb/mtw-gateways`.

---

## CT-C1: Theseus passes the intersection twice

### What the fiction wants

Theseus ties the thread at entry A and unspools it through intersection B, into room C, back through intersection B by another arch, and up staircase D. Standing in B, anyone sees **two stretches** of thread crossing the room: one between A and C, one between C and D. Cutting one stretch must leave the other intact. Following the thread back out from D must pass through B, then C, then B again.

**A minimal variant:** a rope carried from room A to room B and back into A without being reeled in. Room A holds both ends: two stretches of one rope, joined only by the loop through B.

### Topology

```
T1⟨A⟩ – T2⟨B⟩ – T3⟨C⟩ – T4⟨B⟩ – T5⟨D⟩
```

`T2` and `T4` are siblings (both under B's Base). Each has degree 2. They are not neighbors; the only path between them runs through `T3⟨C⟩`.

Minimal variant: `R1⟨A⟩ – R2⟨B⟩ – R3⟨A⟩`, with `R1` and `R3` siblings, not neighbors.

### Under the shipped model

Each step is extend-then-move at the far end. `T2` and `T4` both have edges and none between them, so they stay apart, and B's cover lists the thread twice. **Passes.**

### What this case falsifies

- Any rule that merges all siblings regardless of topology (the rule before 2026-10-22, which also left `T3 – T4` naming the absorbed binding).
- Any rule that merges siblings in the same connected component.

## CT-C2: Coiling the rope back in

### What the fiction wants

**(a) A rope in two rooms.** One end is in room A and the rope runs into room B. Standing in A, the player hauls it in. Afterward there is **one rope in room A**, and nothing about it says it once reached B.

**(b) A rope in three rooms, hauled in one room's worth.** The rope runs A → B → C. Standing in B, the player hauls in the stretch from C. Afterward the rope runs A → B and nowhere else, and is otherwise indistinguishable from a rope that was only ever carried from A into B.

### Topology

(a) Before: `R1⟨A⟩ – R2⟨B⟩`, where `R1` is the rope's Base (extend splits in place, so Base stays at the origin). After moving `R2` into A: `R1⟨A⟩ – R2⟨A⟩`, adjacent siblings, both of degree 1.

(b) Before: `R1⟨A⟩ – R2⟨B⟩ – R3⟨C⟩`. After moving `R3` into B: `R1⟨A⟩ – R2⟨B⟩ – R3⟨B⟩`. `R2` and `R3` are adjacent siblings; `R3` has degree 1.

### Under the shipped model

"Haul it in" is a move of the far end home, and the contraction follows: (a) leaves Base alone in A; (b) leaves `R1 – R2`. **Passes.** In (a) the string changes shape, from a line to a point; the fiction wants that, and no branch or loop is lost.

### What this case falsifies

Any rule that leaves adjacent siblings on a string apart, or that refuses the line-to-point collapse in (a) because it changes the shape.

## CT-C3: The rope between two pulleys

### What the fiction wants

A rope is threaded back and forth between two pulleys mounted in one room: from the floor, up over pulley P, down to the floor, up over pulley Q, down to the floor. The room holds **three hanging stretches**, separated by the loops over the pulleys. Pulling the rope off pulley P drops that loop to the floor. The first two stretches become one stretch, and the third stays separate (it still hangs from Q).

### Topology

Threaded:

```
R1⟨room⟩ – Rp⟨P⟩ – R2⟨room⟩ – Rq⟨Q⟩ – R3⟨room⟩
```

`R1`, `R2` and `R3` are siblings. No two of them are neighbors.

After pulling the rope off P (moving `Rp` to the room): `R1⟨room⟩ – Rp⟨room⟩ – R2⟨room⟩ – Rq⟨Q⟩ – R3⟨room⟩`. Now `R1 – Rp` and `Rp – R2` are adjacent sibling pairs. The fiction wants `R1`, `Rp` and `R2` to become one binding, still connected to `Rq`, with `R3` kept apart.

### Under the shipped model

Extend plus moves builds the threaded state, and the three hanging stretches stay apart. Pulling off P contracts `Rp` into `R1`, then `R2` into `R1` (the rewritten edge makes them neighbors), leaving `R1⟨room⟩ – Rq⟨Q⟩ – R3⟨room⟩`. **Passes.**

### What this case falsifies

- Any rule that merges non-adjacent siblings that both have edges (`R1`, `R2`, `R3` while threaded).
- Any contraction applied once rather than until no contractible pair remains.

## CT-C4: The net over four chairs

### What the fiction wants

A cargo net is slung over four chairs, its middle sagging to the floor. At the coarse level the player sees "a net draped over four chairs". At a finer level, the sag may have two low points: one between chairs 1 and 2, one between chairs 3 and 4, with a ridge of net between them.

**The fiction is undecided:** does anything the player can do tell "one low point touching four chairs" from "two low points, each touching two chairs, joined by a ridge"? (Pulling the net off chairs 3 and 4 only; something resting in one low point; where a dropped coin rolls.) If nothing tells them apart, merging them loses nothing.

### Topology

```
N1⟨chair1⟩ – A⟨room⟩ – N2⟨chair2⟩
               |
N3⟨chair3⟩ – B⟨room⟩ – N4⟨chair4⟩
```

`A` and `B` are adjacent siblings, both of degree 3 (an H shape). Contracting them gives one floor binding of degree 4 (an X shape).

### Under the shipped model

`A` and `B` are both branch points, so the rule keeps them apart: the H stays an H (the user's ruling, 2026-10-22: no automatic contraction changes topology). Turning the H into an X on purpose would need a deliberate contract instruction, which does not exist. Extend at a middle binding can make the branches, so this is buildable in principle; no player route does yet.

### What this case falsifies

**If** some play distinguishes H from X, any rule that contracts all adjacent siblings is wrong. **If** the fiction cannot tell them apart, the degree condition is stricter than it needs to be, at no cost the corpus has found.

## CT-C5: The necklace on a hook

### What the fiction wants

A necklace hangs from a hook on the wall, both sides falling into the room and meeting at the bottom. It is a **closed loop**: a player can lift it off the hook and put it over their head. A string hanging from a hook cannot be put on.

### Topology

```
N1⟨hook⟩ – N2⟨room⟩ – N3⟨room⟩ – N1
```

`N2` and `N3` are adjacent siblings and share the neighbor `N1` (a triangle). Contracting them would leave a string hanging from a hook.

**The granularity question this case must answer before it grades anything:** at the coarse level, the necklace is a single binding on the hook, and its being a loop is a property of the object, not of its bindings. This case grades a rule only if the loop must be visible in the topology.

### Under the shipped model

The shared-neighbor condition keeps `N2` and `N3` apart, whatever the granularity question decides. Not buildable: nothing closes a cycle.

### What this case falsifies

Any contraction that collapses a loop, if the granularity question comes out "the topology carries the loop".

## CT-C6: The thread wound around a post

### What the fiction wants

A thread is wound three times around a post. "Unwind the thread" takes three turns, and the description says it is wound three times.

### Topology

`P1⟨post⟩`, one binding. The thread at the post is **one position**, and "three times" describes how it relates to the post, not how many bindings it has. (Three bindings in a row under the post, contracted to one, was the reading first offered and corrected: it would make a count depend on multiplicity.)

### Under the shipped model

Neither the hosting edge nor `ConnectedTo` carries a label, so nothing records a count. That limit does not involve contraction: it holds with one binding.

### What this case falsifies

Any rule whose correctness depends on binding multiplicity carrying information. A count belongs on an edge or an attribute, so contraction need not preserve multiplicity. The same holds for arrangement at one position (coiled, laid out, doubled over): it is not topology, and if a story needs it, it is an attribute.

## CT-C7: The plate on the far stretch of the cloth

### What the fiction wants

A tablecloth is draped over two tables pushed side by side, and a plate sits on the part over table 2. The player pulls the whole cloth onto table 1. The plate comes with the cloth, so afterward it is on the cloth, on table 1.

**A variant with a tie:** the part over table 2 is tied to the table leg with a cord. Pulling it onto table 1 tears the tie or is refused. Either way, the tie cannot follow the cloth to table 1.

### Topology

Before: `C1⟨T1⟩ – C2⟨T2⟩`, with the plate in `C2`'s cover. After moving `C2` onto table 1: `C1⟨T1⟩ – C2⟨T1⟩`, adjacent siblings, the plate still under `C2`.

### Under the shipped model

The move carries `C2`'s cover; the contraction then merges the covers, so the plate ends under the survivor. The tie is a non-hosting edge on `C2`; severing it on the move defers to the adjudicator, as for any edge a move severs.

**Settled (the user, 2026-10-22):** a contraction never moves an attachment. Siblings are under one parent by definition, so an attachment has already traveled with its binding by the move before. Dragging things along, including across rooms, is a **cascading pull**: a separate function the system will need, which resembles contraction only in wording.

### What this case falsifies

Any rule that refuses a contraction to protect an attachment.

## CT-C8: The slime that splits and flows back together

### What the fiction wants

**(a)** A slime is hacked in two. One blob is carried into room B, then back into room A, where it flows back into the rest. Afterward there is one slime, no different from before the cut.

**(b)** A slime in room A has stretched a tendril into room B. A blob cut from it earlier is carried back into room A. It flows into the main mass, and the tendril into B is unaffected.

### Topology

(a) After the cut and the return: `S1⟨A⟩`, `S2⟨A⟩`, bare siblings.

(b) `S1⟨A⟩ – S2⟨B⟩` (the tendril), plus the bare blob `S3⟨A⟩`. `S1` and `S3` are siblings, and only `S1` has an edge.

### Under the shipped model

The bare blob merges into its sibling: (b) leaves `S1⟨A⟩ – S2⟨B⟩`, the tendril intact. **(b) passes** (the blob is a fixture: nothing a player says cuts a slime yet). (a) is the same clause with both bindings bare.

### What this case falsifies

- Any rule that keeps bare siblings apart (a).
- Any rule that keeps a bare binding apart from a sibling that has edges (b).

---

## Criteria rejected along the way

Each with the case that rejected it. A new rule that revives one must answer its case.

- **Merge every pair of siblings** (the rule before 2026-10-22): breaks CT-C1, and forbids CT-C3's threaded state.
- **Same connected component** (merge siblings that are connected at all): every part of an extended whole is in one component, so it merges `T2` and `T4` (CT-C1).
- **Homeomorphism** (merge only if the shape is unchanged): a line and a point are not homeomorphic, so it refuses CT-C2(a)'s coiled rope.
- **Homotopy alone:** H and X are both trees, so it cannot keep CT-C4's H.
- **Adjacency alone** (contract any two neighbors under one parent): collapses CT-C4's branch points and CT-C5's loop.
- **A bare binding stays apart from one with edges:** refused by CT-C8(b).
- **Excluding Base and Unplaced from the bare clause:** in CT-C2(a) and CT-C8 the survivor is a placed Base, so only hostless bindings are excluded (and the collision rule never pairs those: they have no parent).
- **Binding count as information:** refused by CT-C6; a count or an arrangement is an attribute.
