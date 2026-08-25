# Edge abstractions --- evidence corpus

**Companion to [`AGENT.edgeAbstractions.planning.md`](AGENT.edgeAbstractions.planning.md)** (evidence corpus class, per the [ladder](../../../../AGENT.designVariant.md#the-companion-file-ladder)). Created **2026-08-24**, on the day the plan opened.

**Split out immediately, and the reason is not case count.** The plan's [Two scales of one edge](AGENT.edgeAbstractions.planning.md#two-scales-of-one-edge) uses the flashlight to *establish the vocabulary every row is phrased in*. A case written in the plan body would sit under that exhibit and be read as illustrating it --- and **a case that illustrates the formulation it is printed under cannot falsify it.** That is the failure the presence plan recorded against itself (*"all three answers lean on the same cover formulation ... no amount of case-writing in that vocabulary would catch it"*). **Separating the files is what keeps the exhibit and the evidence distinguishable.**

## How to read and write cases here

1. **Cases are written against *today's* model** --- today's `ludicGraph`, today's relation kinds, today's ports. A case that presumes an unshipped construct is grading a proposal, not the world.
2. **Do not propose solutions in the corpus.** A case states what the fiction wants and which limit that hits. Where it goes next belongs in a row.
3. **Every case names its falsification target at booking time** --- the presence plan lost three of four corpus sub-steps to briefs that could not state one, and the phase-level finding is recorded in [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md#candidate-method-findings). **A case that cannot fail is not evidence.**
4. **A case must discriminate.** If the candidate answers in [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) all give the same result, the case confirms rather than tests.
5. **Cite the parent corpus; do not restate it.** [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread), [C9](AGENT.abstractionLayers.corpus.planning.md#c9-coiling-the-rope-back-in), [C11](AGENT.abstractionLayers.corpus.planning.md#c11-the-rube-goldberg-machine), [C19](AGENT.abstractionLayers.corpus.planning.md#c19-filling-out-the-place-setting-and-the-tavern-that-ran-out-of-napkins) and [LC7](AGENT.abstractionLayers.ludicCache.corpus.planning.md#lc7-the-cable-that-passes-straight-through-the-box) already exist. **None was written to grade an edge-scale claim**, so each may be *re-graded* here --- with a pointer and a note on which EA row it bears on, never a copy.

**This corpus disposes with the plan**, with the ladder's one asymmetry to ask at disposal: whether it graduates somewhere durable instead of being deleted.

| Case | Grades | State |
| --- | --- | --- |
| [EA-C1](#ea-c1-the-power-cord-and-the-flashlight) | [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-3](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-4](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) | **Written 2026-08-24.** Setup and limit recorded; findings not yet argued |
| [EA-C2](#ea-c2-the-clamp-and-the-second-contact-point) | [EA-3](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-2](AGENT.edgeAbstractions.planning.md#settled-register), [EA-4](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-8](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) | **Written 2026-08-24.** Setup, contrast and limit recorded; findings not yet argued. **Note it does not grade [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) directly**, which was the brief it was reserved under --- see [what it does not grade](#what-ea-c2-does-not-grade) |
| [EA-C3](#ea-c3-cutting-the-thread) | [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-5](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-2](AGENT.edgeAbstractions.planning.md#settled-register), [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) | **Written 2026-08-24.** **The first case in this corpus with a history**, which is the brief EA-C1 and EA-C2 both failed. Setup and limits recorded; findings not yet argued. **It does *not* supply [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) clause (vii)'s owed overlap case** --- see [what it does not grade](#what-ea-c3-does-not-grade) |

---

## EA-C1: the power cord and the flashlight

**Booked 2026-08-24 from conversation.** This is the case the plan's exhibit was drawn from, written here in the form that can grade rather than illustrate.

### What the fiction wants

A `PowerCord` runs from a wall socket in the Room, across the floor, and into a `Flashlight` that has been opened up on a workbench. The cord has parts: a `Cord` (the length of it) and a `StrippedEnd` (bare copper). The stripped end has been soldered to the flashlight's `BatteryCase`.

A player entering the Room should be able to learn *there is a power cord here, and it threads into the flashlight*. A player examining the flashlight should be able to learn *a power cord comes into this, and it is soldered to the battery case*. **Both are true at once, and neither is the other's summary.**

### How it is represented today

`PowerCord` is **multi-hosted** --- present in both the Room and the Flashlight, which [AB-8](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)'s re-frame makes legitimate rather than drift. At part scale the edges are unproblematic and all four are expressible in today's `EphemeraLudicRelationalEdgeData`:

| Edge | Kind (AB-54 class) | Lives in | Crosses the Flashlight boundary? |
| --- | --- | --- | --- |
| `Cord -[ConnectedTo]-> StrippedEnd` | `Custom` (peer) | `PowerCord`'s own graph | **No** --- interior to the cord |
| `StrippedEnd -[SolderedTo]-> BatteryCase` | `Custom` (peer) | crossing | **Yes** |
| `BatteryCase -[PartOf]-> Flashlight` | `PartOf` (hosting) | `Flashlight`'s graph | No |
| `PowerCord -[In]-> Room` | `In` (hosting) | `Room`'s graph | No |

### The limit it hits

**Nothing in the above says what relationship `PowerCord` itself has with `Flashlight` itself.**

- **`In` does not say it.** Under [AB-54](AGENT.abstractionLayers.planning.md#settled-register) a hosting kind **is** the membership fact, and membership is not what the fiction wants stated here. *The cord is in the flashlight* is at best misleading --- most of the cord is on the floor.
- **The part-scale edges do not say it either, not as they stand.** `SolderedTo` relates a `StrippedEnd` to a `BatteryCase`. Recovering *the cord threads into the flashlight* from it requires tracing `StrippedEnd` back to `PowerCord`, which needs the cord to have a **materialized interior graph** --- undecided at [AB-62](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only), and under its lazy branch there may be nothing to trace.
- **So the whole-scale relation is currently neither stated nor reliably derivable.** This is [AB-57](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) part (2), stated as a case rather than as a diagnosis. **One correction against that row, verified 2026-08-24:** its claim that the crossing is *"neither represented nor derivable"* is half wrong on the representation side --- `EphemeraLudicTerminalId` admits a **port-qualified** terminal ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), so an edge terminating on the flashlight's port is expressible today. **What is missing is a producer and a meaning, not a slot.**

### What this case would falsify

**Stated at booking time, per the rule above.**

1. **Against [EA-3](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*which part-scale edges correspond*).** The plan's leaning is **crossing edges only**. **This case falsifies that if the fiction demands that `ConnectedTo` --- wholly interior to the cord --- be visible at flashlight scale.** On the setup as written it does not: a player examining the flashlight has no call to learn that the cord's stripped end is attached to the rest of the cord. **That is a weak pass, not a confirmation**, because the case was not built to strain it; see EA-C2. **Discharged 2026-08-24: [EA-C2](#ea-c2-the-clamp-and-the-second-contact-point) strains it and the leaning does not survive as worded.** The route is not the one anticipated here --- the interior edge is not *shown* at flashlight scale, it is *consulted* to decide how many whole-scale edges there are. **So this target was aimed slightly wrong**, and the anticipated falsifier (*the fiction demands `ConnectedTo` be visible*) is still unmet.
2. **Against [EA-4](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*must it be traversable*).** If *"there is a power cord here, and it threads into the flashlight"* is a terminal statement --- something a player reads and cannot act on --- then naming suffices and reification is admissible. **If the player can `pull the cord out of the flashlight`, the whole-scale relation is an operand and must be traversable.** The fiction as written **wants the second**, which if it holds disqualifies [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)(a) outright. **Do not treat that as settled from this case alone** --- it is one case, and the reversibility it turns on is exactly the *manner* content [EA-2](AGENT.edgeAbstractions.planning.md#settled-register) has not decided is real.
3. **Against [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*one fact or two*), and this is the one the case is weakest at.** All three positions --- *one truth two views*, *part-scale is truth*, *whole-scale is authored truth* --- produce the same reading of the setup above, because the setup describes a world already fully populated at both scales. **This case does not discriminate on EA-1.** What would is a **history**: a world in which the two scales are authored at different times, or in which a write at one scale must propagate to the other. **That is [EA-5](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)'s territory and it is what EA-C2 should reach for.**

### What it does not grade, stated so the case is not over-read

- **Not presence.** *Which hosts hold a reference to the cord* is a presence question and belongs to [`AGENT.presence.planning.md`](AGENT.presence.planning.md). This case takes multi-hosting as given.
- **Not materialization.** The case **sizes** [AB-62](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only) by showing what a derivation would have to traverse; it does not choose between materialize-on-hosting, lazy, and derive-at-read.
- **Not narration.** Whether either sentence is *rendered* to the player, and in what words, is normative in [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md).

### Findings

**None yet.** The case is written and its targets are named; nothing has been argued against it. **Do not add a finding here that restates the setup** --- a finding is something the case forced that was not visible before it.

---

## EA-C2: the clamp and the second contact point

**Booked 2026-08-24 from conversation.** A refinement of [EA-C1](#ea-c1-the-power-cord-and-the-flashlight), which it does not restate --- read that case first. **It was reserved under the brief *find a case with a history*, and it does not have one:** the world it describes is steady-state, authored all at once. **It is booked anyway because it turned out to grade a different row, and to grade it harder than EA-C1 could.** The brief is not thereby discharged --- see [what it does not grade](#what-ea-c2-does-not-grade).

### What the fiction wants

Everything in EA-C1, plus: the flashlight has a `Clamp` --- a strain relief on the housing --- and the clamp grips **the cord**, some way back from the bare copper. So the cord is now held by the flashlight at **two separate places, on two separate parts of itself**: soldered at the `StrippedEnd`, clamped along the `Cord`.

A player examining the flashlight should learn *a power cord comes into this, soldered to the battery case and held by the strain clamp*. A player in the Room should learn something whose natural phrasing fuses both: *the power cord threads securely into the flashlight*.

### How it is represented today

Two edges are added to EA-C1's four. Both are expressible now; neither is the difficulty.

| Edge | Kind (AB-54 class) | Lives in | Crosses the Flashlight boundary? |
| --- | --- | --- | --- |
| `Clamp -[PartOf]-> Flashlight` | `PartOf` (hosting) | `Flashlight`'s graph | No |
| `Clamp -[Secures]-> Cord` | `Custom` (peer) | crossing | **Yes** |

**The whole-scale reading the fiction reaches for is a single edge:** `PowerCord -[SecurelyThreadsInto]-> Flashlight`.

### The contrast that makes this a test rather than an illustration

**Per rule 4, the case must discriminate, and on its own the setup above does not.** Both crossing edges have one terminal inside `PowerCord` and one inside `Flashlight`, so **any rule that collapses a crossing edge to its two host wholes yields one whole-scale edge automatically** --- no reasoning about the cord's interior required. The case only bites when set against a second world:

> **The severed-cord world.** Identical, except the cord is in **two disconnected pieces**, both hosted by `PowerCord`: a stub soldered to the battery case, and a separate length caught in the clamp. No `ConnectedTo` between them.

**Endpoint collapse cannot tell these two worlds apart.** Both present two crossing edges between the same pair of wholes. **The fiction distinguishes them sharply** --- in the first, pulling the cord moves the whole thing and the flashlight comes with it; in the second there is no *threading* at all, just two objects that happen to touch the same box.

**What separates them is `Cord -[ConnectedTo]-> StrippedEnd`, which is wholly interior to the cord and crosses nothing.**

### The limit it hits

**Interior connectivity is a precondition of whole-scale correspondence, and no crossing edge witnesses it.** That is the load-bearing statement of this case, and it is narrower than it first looks --- **the interior edge is *consulted*, not *shown***. Nothing here says a player examining the flashlight should learn that the cord's stripped end is attached to the rest of the cord. It says that whether there is **one** whole-scale edge or **two** cannot be decided without reading an edge that does not cross.

**A second limit, on content rather than grouping.** `SecurelyThreadsInto` is not `SolderedTo` composed with `Secures` under any rule either edge supplies. The verb comes from one contact, the adverb from the other, and the fusion is not a function of the pair. **State the escape honestly, because it is available:** a whole-scale edge might carry *both* manners as a set and leave the fusion to narration, which this corpus does not grade. **That escape is [EA-2](AGENT.edgeAbstractions.planning.md#settled-register)'s actual question** --- is manner fictional content or narration's job --- so this case sharpens EA-2 rather than answering it.

**A third, which no row currently owns.** `SolderedTo` runs cord-to-flashlight; `Secures` runs flashlight-to-cord. **The two crossing edges point in opposite directions and the whole-scale edge has one direction**, which is therefore not inherited from either. This is the [locked frame](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06)'s unstated port direction arriving at edge scale. **Recommendation, not a decision: leave it inside EA-2**, which already names *a direction* as candidate manner content, rather than minting a row for it before anything has been argued.

### What this case would falsify

**Stated at booking time, per rule 3.**

1. **Against [EA-3](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*which part-scale edges correspond*), and this is the target it was built for.** EA-C1 gave the **crossing-edges-only** leaning a weak pass and deferred here. **This case falsifies it as stated, while leaving a repaired version standing:** crossing-only survives as a rule about which edges a whole-scale edge is *the view of*, and fails as a rule about which edges the correspondence must *consult*. **If that split cannot be made to hold** --- if consulting an interior edge turns out to mean the whole-scale edge is a view of it too --- **then boundary-relativity does not bound the work the way the leaning promised**, because the set to consult is no longer identified by the boundary. **Do not read the split as established; read it as the thing EA-3 now has to argue.**
2. **Against [EA-4](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*must it be traversable*), strengthening EA-C1's target 2 rather than repeating it.** *Pull the cord out of the flashlight* must now **fail**, or must first oblige unclamping. **So the whole-scale relation is not merely an operand --- it is an operand whose outcome is fixed by a part-scale edge that contributed none of its verb.** A construct carrying only the fused name cannot answer it, which pushes on [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)(a) from a second direction. **This is falsified if the fiction is content for the pull to succeed and simply narrate the clamp giving way**, which is not absurd and has not been asked.
3. **Against [EA-8](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*do edges need identity*), by supplying the first **many-to-one** correspondence in the corpus.** EA-C1 had a single crossing edge, so it could not tell a correspondence from a coincidence. Here one whole-scale edge answers to a **set** of identity-less values. **Under [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)(b) that set has to be enumerated, which needs edge identity; under (c) it is *whatever transits this port*, which needs none.** **Flag against the case, not for it:** EA-7 records that (c) is cheap enough to look right for reasons unrelated to whether it is, and this case looks favourably on (c). **It is one case, and it was written by someone who already knew (c) was cheap.**

### What EA-C2 does not grade

- **Not [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), and the reserved brief is therefore still open.** The world is steady-state, so all three positions read it identically --- exactly EA-C1's weakness, inherited unchanged. **A case with a history is still owed.** The one indirect pressure: non-compositional manner is awkward for **(b) part-scale is truth**, since there is no rule that derives the adverb. That is pressure, not a finding, and the set-plus-narration escape above dissolves it.
- **Not [EA-5](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only).** Nothing changes in this world. *Unclamp the cord* is the obvious next question and is deliberately not asked here --- **it is the seed of the history case**, and putting it in this one would blur which case grades which row.
- **Not narration, presence, or materialization**, on the same grounds EA-C1 records.

### Findings

**None yet.** Targets are named; nothing has been argued. **The severed-cord contrast is setup, not a finding** --- a finding is what survives someone trying to make the crossing-only rule work anyway.

---

## EA-C3: cutting the thread

**Booked 2026-08-24 from conversation, as a thought experiment the user worked out and offered.** The thread is [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread), which this case does **not** restate --- read it there. **This is the first case in this corpus whose world changes over time**, which is the brief [EA-C1](#ea-c1-the-power-cord-and-the-flashlight) target 3 named (*"what would discriminate is a **history**"*) and which [EA-C2](#ea-c2-the-clamp-and-the-second-contact-point) was reserved under and did not meet.

**On rule 1 (cases are written against today's model), which this case has to answer for up front.** Everything in the setup below is expressible now: a multi-hosted node, one **presence port** per host, a **port-qualified terminal** on an edge (`EphemeraLudicTerminalId`, [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), and node-parts joined by `PartOf`. **What is unshipped is only the *reading*** --- that the whole-scale node is an *Arrangement* in [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)(a)'s sense. **That is precisely what lets this case grade (a) rather than assume it:** (a)'s realization already has a shipped shape, so the case can be run and watched.

### What the fiction wants

`LengthOfThread` is a single node, multi-hosted across the rooms of the labyrinth --- one presence port per room --- with **no node-parts**. Two edges flank it: `Skein -[ConnectedTo]-> LengthOfThread` and `LengthOfThread -[ConnectedTo]-> TiedEnd`, each landing on the presence port for the room the relevant end is in. **Direction and ordering are carried port-to-port along the node**, which is what makes the coarse scale reasonable-with at all; the room-by-room chain is never foreclosed and, for this thread, will be built.

Then a player **cuts the thread in one room**.

Afterward the fiction wants: *the skein is still connected to a loose end back there, and the tied end is connected to nothing that reaches you.* **The two halves must be independently traceable, and the trace from one to the other must fail.**

### The two operations, which look alike and are not

**(1) Refining a room, which is optional and inert.** Mint a `ThreadSpan` node-part for any room you like. The flanking edges may be **left on the presence port** --- the port still says what of the thread is being connected to --- or **pulled down onto the `ThreadSpan`**. **Either is correct and nothing about the world differs**, because the edges keep one referent under both. This is the *expands into* pattern with the coarse scale surviving untouched.

**(2) Cutting, which forces the refinement (1) merely permitted.** The cut requires:

- minting **two** node-parts in the room, one per cut end;
- **pulling the flanking edges down** onto them --- here **mandatory**, not a choice;
- and then **not writing** a `ConnectedTo` between the two parts.

**The absence of that edge is the entire content of the cut.** What remains is a chain of edges from the skein to one cut end, and a second, disjoint chain from the other cut end to the tied end several rooms away.

### The limit it hits

**A break cannot be expressed at a scale that has no interior, and this is the load-bearing statement of the case.** At coarse scale the presence port is atomic and both flanking edges land on it; connectivity there is not asserted, it is *structurally unavoidable*, so there is nowhere to put an absence. **A scale can only express a break at a granularity where the break has two sides.**

**Which yields the discriminator for when descent is forced, and it generalizes past thread:** you must descend when the coarse locus would **conflate two things the fine scale must distinguish**. In (1) the edges keep one referent, so the pull-down is inert; in (2) they must acquire *different* referents, so the pull-down is the whole operation.

**A second limit, on which sub-node locus does the work.** The thread's presence ports carry direction *across* rooms without any node-part being minted. **The cut is inside one room, so both cut ends share a single presence port, and the port is provably not fine enough.** Stated as the case leaves it: **ports buy independence across hosts; node-parts buy independence within a host.** No row currently owns that division, and this case does not propose one --- per rule 2, where it goes belongs in a row.

**A third, on what happens to the coarse scale afterward.** The Arrangement may be **split into two** (*two lengths of thread*) or **relabelled** (*cut length of thread*), **and both are legitimate**, chosen by how the author expects to reason later. **One fine-scale state therefore admits more than one correct coarse rendering**, and the choice is not a derivation.

### What this case would falsify

**Stated at booking time, per rule 3.**

1. **Against [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*one fact or two*), which is the target the history was owed for.** The pressure is the third limit. **A *view* has no choices** --- so if the coarse scale is one of two views of a single truth, split-versus-relabel should be settled by the fine-scale state, and it is not. **(b) part-scale is truth** and **(c) whole-scale is authored truth** both absorb it comfortably; (c) explains it best, since re-authoring is what an authored thing needs. **State the escape honestly, because it is real:** a defender of (a) can call split-versus-relabel mere labelling, with the underlying truth determined either way and only the presentation free. **That escape is answerable only by finding something the two renderings make the system *do* differently, which this case does not yet supply.**
2. **Against [EA-5](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) (*propagation*).** The cut is a fine-scale write that the coarse scale cannot ignore. **This falsifies any rule that propagates fine-to-coarse automatically**, because the correct coarse result is under-determined by the fine write. If EA-5 lands on automatic propagation, it must say which of split and relabel it produces --- **and answering that with a default is a design decision, not a derivation.**
3. **Against [EA-7](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)(a) (*two edges and a node*), from a direction EA-C1 and EA-C2 did not reach.** (a) survives the cut only if the node can be **replaced or re-labelled without orphaning the flanking edges**, which after the pull-down no longer terminate on it. **If the flanking edges must be rewritten as part of a cut, (a)'s realization is not the cheap one it looks like**, and the cost lands on exactly the operation the fiction performs most often.
4. **Against [EA-2](AGENT.edgeAbstractions.planning.md#settled-register) (*is manner real content*), as support rather than strain, which is why it is listed last.** Under EA-2's derivability disposal rule the Arrangement holds **no** continuity fact --- continuity is derivable by joining the parts, hence a [ludicCache](AGENT.abstractionLayers.ludicCache.corpus.planning.md) entry, not a fact of the relation. **So the cut creates no contradiction to repair**, which is *why* both re-renderings are legitimate. **Read that as the rule predicting the case, and discount it accordingly** --- the case was worked after the rule was written, by someone who knew it.

### What EA-C3 does not grade

- **Not [EA-1](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) clause (vii), and the case owed there is still owed.** Clause (vii) asks for the overlap where *"a minted part scale can falsify a coarse claim **only where the coarse edge actually holds one**."* **This case cannot find that overlap, and the reason is instructive:** EA-2's disposal rule keeps evacuating the coarse scale of precisely the claims a cut could contradict. **The owed case must therefore turn on a coarse fact that is *not* derivable by joining parts** --- **aperture** and **reversibility** are the two candidates on the table, which is a second reason to care where those live. **Do not let this case be filed against clause (vii); it is a near-miss that maps the target, not a hit.**
- **Not [PR-11](AGENT.presence.planning.md), despite appearances, and the apparent collision is worth recording because it resolves.** PR-11 holds that a presence port with no materialised edge is *"trivially consistent, not underdetermined"*; this case reads an absent edge as **meaning the thread is cut**. Both hold, because the absences differ: PR-11's port **asserts a binding** whose edge merely is not written, whereas the cut's two node-parts were **minted**, and minting them is the act that writes the scale at which connection would be recorded. **Absence reads as negation only once someone has asserted the scale where the positive would live** --- which is clause (vii) applied, not breached, and identifies **minting the parts** as how a scale gets written.
- **Not [EA-3](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only), [EA-4](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) or [EA-8](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only).** No boundary is crossed here --- every edge in the setup is between peers or within one host's graph --- so the correspondence questions those rows ask do not arise. **The cut is not a crossing case and should not be pressed into service as one.**
- **Not narration, presence, or materialization**, on the same grounds EA-C1 records. **In particular the case takes multi-hosting and one-port-per-room as given** and grades neither.

### Findings

**None yet.** Targets are named; nothing has been argued. **The forced-refinement rule is setup, not a finding** --- a finding is what survives someone trying to express the cut at coarse scale anyway, and no one has tried.

**One observation held back from the findings deliberately**, because it is about the modelling rather than about the world: **cutting is not a verb.** It is mint-two, pull-edges-down, do-not-connect --- the same three primitives every other operation uses, arranged so that they mean *cut*. **If that survives contact with a second destructive operation** (severing, untying, burning through) **it is a finding about the whole representation and belongs in the plan, not here.**
