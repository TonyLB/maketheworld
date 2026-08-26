# Label-across-ports displacement sweep

**Status: in progress.** Phases 0--2 are done below. **Next step: [Phase 3](#recommended-order) --- report the verdict to EA-10.** The verdict is **displacement holds, conditional on solutions to [two named requirements](#the-verdict-stated-before-the-table-because-it-is-conditional) --- and this family already holds a *candidate* that covers both, in the representations called SPLIT and ARRANGE**; see [the Phase 2 verdict](#the-verdict-stated-before-the-table-because-it-is-conditional) before reading anything else here as a clean result.

**This is a plain implementation plan, not a design-variant one**, and that is deliberate. It follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) and **not** [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md): its deliverable is an **inventory and a verdict per entry**, produced by reading documents that already exist. No corpus of new cases is built here, no rows graduate here, and nothing in this file is normative. When the sweep finishes, its verdict goes to [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) and **this file is deleted**.

## Why this exists

[EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) was booked on a **grading method rather than an answer**: the proposal that a whole-scale edge is carried by minted port-to-port summary edges inside an Arrangement is to be graded by whether it **displaces** an earlier-iteration pattern, tested per case by **survival of removal**. The row was booked with its displacement target deliberately unnamed.

**The target is now named, and this plan is the sweep.** It is *the decision that an edge's `relationLabel` may vary across a port boundary.*

## Getting Started

Read in this order. All four are prerequisites for grading, not background.

1. **The clause itself:** [*A port is a scale boundary, not a relay* (2026-08-06)](AGENT.abstractionLayers.proposals.planning.md#a-port-is-a-scale-boundary-not-a-relay-2026-08-06) --- the origin section, including the two rules that follow it.
2. **The correction that changed its grain:** [PR-C2 Finding 2](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing) --- the 2026-08-22 vocabulary split. **Read this before the origin section can be used**, because the origin section's word *kind* does not mean today's `kind`.
3. **The construct that may displace it:** [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)'s Status, in full, including its three caveats.
4. **The shipped surface:** [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`EphemeraLudicRelationalEdgeData`, `EphemeraLudicGraphPort`) and [the port record's field scope and conflict rule](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#port-records-field-scope-and-the-conflict-rule).

**Command authority for this area:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) governs any code touched; if commands conflict, follow it. **No code is touched in Phases 0--2**, so the only baseline this plan needs is the documentation one in [Verification](#verification).

---

## Phase 0 --- the clause, recorded

### What it says today, and it is not what it says on the page

The clause was written **2026-08-06** as:

> **The two edges joined by a port need not carry the same kind, and usually will not.**

**That sentence must not be read in today's vocabulary, and reading it that way is a logged error.** When it was written, *kind* meant **the fiction-level relation name**. [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) has since split that word into a closed seven-value `HostRelationalEdgeKind` and a separate `relationLabel`. The misreading is recorded as the `vocab-drift` entry dated 2026-08-22 in [the performance tally](../../../../AGENT.designVariant.performance.md).

**So the clause under sweep, stated at today's grain, is this:**

| | Claim | Standing |
| --- | --- | --- |
| **(i)** | A port is a **scale boundary at which the description changes**, not a relay | The framing. Everything else is a consequence |
| **(ii)** | The **`relationLabel` may differ on each side of a port**, and neither side is a copy of the other --- `ThreadsInto` at room scale, `SolderedTo` at flashlight scale | **This is the clause the sweep targets** |
| **(iii)** | `kind` is **invariant** across the port --- one fact seen three times, since an edge passes *through* a port rather than terminating either side | **Not a target.** Established by PR-C2 Finding 2, *after* and *against* the original wording. Removing (ii) does not touch it. **Scope corrected 2026-08-25: (iii) holds for CROSSING ports and not for all ports** --- see the note below |
| **(iv)** | Where the labels are equal (the rope's `TiedTo` on both sides) they are **coincidentally equal, not redundant** --- *do not "optimize" the rope* | A defensive rule that exists **only because** (ii) is true. It falls with (ii) |

**Scope correction to (iii), 2026-08-25 from conversation, and it is load-bearing for [the Phase 2 verdict](#the-verdict-stated-before-the-table-because-it-is-conditional).** Phase 2 was graded on the premise that **(iii) applies to every port.** It does not. **A presence port is only ever an edge *terminal*, never a crossing** --- [a port's exterior end is a graph plus an *optional* endpoint, and a presence port is the one with no endpoint](AGENT.presence.planning.md#presence-as-a-cover), so there is no second edge for a first to pass through. **PR-C2 Finding 2 generalized from a `Custom` crossing to all ports without checking**, and its *"vacuously true where no edge exists"* clause is the tell: it recorded as a **contingent** gap what is **categorical** for `kind === 'Present'`. **This is [PR-15](AGENT.presence.planning.md#settled-register)**, and the correction is registered there rather than settled here. **What it changes for this plan:** *pass-through* is a property of **crossing ports**, so any grade that reads *an edge cannot terminate at a port* is scoped to those and must not be quoted at presence ports.

**Its formal status:** the scale-boundary reading is registered as **locked-with-a-lower-bar** ([`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md#what-is-not-locked-and-must-not-ride-in-on-this) --- *"re-openable on a case, not merely on a preference"*). **That bar has been met once already** on the neighbouring property (C22 re-opened single-use as PQ-14), so the register itself contemplates this sweep's shape. **This plan does not need permission to run; it needs a case to conclude.**

### The displacement hypothesis, in the user's own framing

The suspicion is that (ii) is **an edge abstraction failing to pick which detail level to evaluate at**, dressed up as a property of ports. `Cord -[ThreadsInto]-> Flashlight-port -[SoldersTo]-> BatteryTerminal` is one situation with at least three representations:

**These are named rather than lettered, deliberately.** The user's framing offered them as (a)/(b)/(c), and this plan also grades [PR-C2 Finding 3's (A)/(B)/(C) fork](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing) in the same phase. **Two three-way forks one letter apart is a collision waiting to happen**, so the representations get words. **Cite them as COARSEN / SPLIT / ARRANGE, never as a letter.**

| Representation | Shape | What carries the scale change |
| --- | --- | --- |
| **COARSEN** *(the user's (a))* | `Cord -[ConnectedTo]-> Flashlight-port -> BatteryTerminal` | Nothing --- coarsened to one label, detail dropped |
| **SPLIT** *(the user's (b))* | `Cord#RoomPort -[ConnectedTo]-> Cord#FlashlightPort` **+** `Cord#FlashlightPort -[SolderedTo]-> BatteryTerminal` | **Two edges at two scales.** The differing labels are on *different edges*, not on two ends of one |
| **ARRANGE** *(the user's (c))* | SPLIT **+** `Cord -[ConnectedTo]-> Arrangement#Port1 -[ConnectedTo]-> Arrangement#Port2 -[ConnectedTo]-> BatteryTerminal` | [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)'s interior summary edge, layered over SPLIT |

**The claim to test is that SPLIT and ARRANGE make (ii) unnecessary**, because a difference of label becomes a difference of **edge** --- each one authored at the scale it is true at --- rather than a variation *within* one edge that the port must reconcile.

**What the sweep is not.** It is not an argument that (ii) was wrong when adopted, and a finding that it was right in 2026-08 is not a finding against displacement. **Displacement asks only whether anything still needs it.** **Sharpened 2026-08-25 (user), after a grade was run the wrong way round: *given the uses we can see for SAME-type crossing edges, are there cases where MULTI-type crossings are the ONLY solution to a corpus case?* **Grade the case, never the representation** --- that a crossing is useful somewhere is not evidence it is the right representation here, and testing (ii) inside a crossing you have not shown is required assumes the answer. See [the ladder challenge](#the-ladder-challenge-and-why-it-did-not-land-2026-08-25).**

### The three caveats, inherited from EA-10 and binding here

1. **Asymmetry.** A clean sweep retires (ii). It **does not graduate** EA-10's construct. *The old thing is removable* and *the new thing is right* are different claims, and only the first is in this plan's reach.
2. **Count discriminating leans, not mentions.** A site that merely *cites* the clause without depending on it inherits nothing to EA-10, because it was not evidence for (ii) either. The inventory below separates these columns for exactly this reason.
3. **This work does not live in a corpus file.** Corpus rule 1 bars cases presuming unshipped constructs and rule 2 bars proposing solutions there. Findings land **here**, then in EA-10's row as argument; corpus files receive at most a re-grade pointer under rule 5.

---

## Phase 1 --- inventory of where we have leaned on it

**Method, recorded so the sweep is repeatable and auditable.** Search terms run across `taskPlanning/` and `packages/`, `lambda/`, `charcoal-client/`:

```
relationLabel              exteriorRelationLabel
"scale boundary"           a-port-is-a-scale-boundary-not-a-relay   (anchor citations)
SolderedTo | ThreadsInto | "threads into" | "soldered to"
LP6 | LP6a | LP6b          "need not carry the same"
```

**Confidence: high but not certified.** These terms catch every site that names the clause, its anchor, its worked example, or its shipped fields. **A site that depends on (ii) without using any of that vocabulary would be missed**, and that is the residual risk this phase carries into Phase 2 rather than resolving.

### A. The clause and its immediate consequences

| # | Site | What it leans on | Lean or mention? |
| --- | --- | --- | --- |
| **A1** | [Origin section](AGENT.abstractionLayers.proposals.planning.md#a-port-is-a-scale-boundary-not-a-relay-2026-08-06) | Is the clause | **Origin** |
| **A2** | Same section, **PQ-1 (original)** verdict (*"each side stores its own kind and nothing is duplicated"*) | (ii) directly --- the storage decision **reverses** on it | **Lean, load-bearing** |
| **A3** | Same section, rule 1 --- *the port is the unit of lifecycle, not either edge* | (ii): *"independent kinds let the halves diverge under dissolution"* | **Lean** --- but check whether single-use alone carries it |
| **A4** | Same section, rule 2 --- *do not "optimize" the rope* | (iv), which exists only under (ii) | **Lean, falls with the clause** |
| **A5** | Same section, coarsening **losslessness** (*"the exterior kind was never about the interior part"*) | (ii) | **Lean, load-bearing** |
| **A6** | Same section, **no compatibility matrix** | (ii) --- there is cross-boundary variation to be tempted to police | ~~**Lean, weak**~~ **--- downgraded in Phase 2 to *mention*.** The argument is AB-19's and holds without (ii) |
| **A7** | [PQ-1's record split](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused) --- *complementary with the interior authoritative* | A2's *complementary, not redundant*, one layer down | **Added in Phase 2 by LS-3's mitigation**, not by the Phase 1 search --- **lean, superseded** |

### B. Downstream in the abstraction-layers family

| # | Site | What it leans on | Lean or mention? |
| --- | --- | --- | --- |
| **B1** | [`AGENT.abstractionLayers.planning.md`](AGENT.abstractionLayers.planning.md) --- the classification table's **third row** exists because port coarsening is *"lossless at the level read"* | A5, hence (ii) | **Lean, structural** --- a row of a table exists because of it |
| **B2** | Same file --- the 2026-08-07 **audience-relative** qualification of losslessness | A5 | **Lean, inherited** |
| **B3** | Same file --- the **locked-with-a-lower-bar** register entry | The clause's status itself | **Status record**, not a lean |
| **B4** | Same file --- **CD6**, kind-agreement validation and write-time repair (relocated 2026-08-23 from LP6b) | (iii), and (ii) only as the thing it must **not** check | **Mention, inverted** --- see note below |
| **B5** | [`AGENT.abstractionLayers.discussion.planning.md`](AGENT.abstractionLayers.discussion.planning.md) --- the 2026-08-06 derivation, and the *"caught a live defect within minutes"* entry | Provenance | **Record** --- moves, never re-argued |
| **B6** | [`AGENT.abstractionLayers.proposals.planning.md`](AGENT.abstractionLayers.proposals.planning.md) --- the **three-graph perceptual-link chain** on C22, which cites port-as-scale-boundary *"genuinely rather than nominally"* and cites *do not "optimize" the rope* against collapsing the chain | A1 and A4 | **Lean, and the most interesting one** --- see note below |
| **B7** | Same file --- **PQ-14** (does single-use survive multi-level chains) | B6's chain, hence the clause indirectly | **Downstream of a lean** |
| **B8** | [`AGENT.abstractionLayers.corpus.planning.md`](AGENT.abstractionLayers.corpus.planning.md) --- the two-operations split (failure recovery vs deliberate summarization) | A5 | **Lean, inherited** |
| **B9** | Same file --- [C22](AGENT.abstractionLayers.corpus.planning.md#c22-the-ships-wheel-and-the-lighthouse) | The case B6 argues from | **Case** --- grade by removal |

**On B4, because it inverts and that is easy to misfile.** CD6 validates that the port's `kind` agrees with each edge through it. That obligation is **(iii)**, and it survives (ii)'s removal untouched. What (ii) contributes is the **prohibition** --- *never extend the check to `relationLabel`*. **Remove (ii) and CD6 gets stronger, not weaker.** Recorded as a mention rather than a lean, and flagged as a site where removal is a **simplification**. **Re-graded in Phase 2 --- that reading is half the story**, and CD6 also needs *narrowing* on a second axis; see [the B4 row](#b-the-abstraction-layers-family).

**On B6, because it is the sharpest test in the inventory.** The chain is `ROOM#Bridge -[Shown]-> port -> ROOM#Bridge node in AREA#Boat -[Shown]-> port -> ... -> FEATURE#Lighthouse` --- three edges, three graphs, two ports --- and it is defended *against* collapse on the ground that the hops are only coincidentally alike. **That is a port-to-port chain carrying one relation across scales, which is structurally what EA-10 proposes.** If (b)/(c) representation subsumes it, B6 is a case that *transfers*; if the chain proves it needs per-hop label variation that no re-representation supplies, **B6 kills the displacement claim outright.** Grade it first.

### C. The presence family --- where the clause was last touched

| # | Site | What it leans on | Lean or mention? |
| --- | --- | --- | --- |
| **C1** | [PR-C2 Finding 2](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing) | Restates (ii) at today's grain and **establishes (iii)** | **The clause's current authority** |
| **C2** | PR-C2 Finding 3 --- the (A)/(B) fork over whether the port stores its labels | (ii) supplies the whole question. **Under one label there is no fork** | **Lean, load-bearing** |
| **C3** | PR-C2's **2026-08-23 amendment** --- *a port may store exactly what is INVARIANT ACROSS THE FAN*; `kind` is, `relationLabel` is not | (ii), as the reason the interior label is refused | **Lean, load-bearing** |
| **C4** | [PR-11](AGENT.presence.planning.md#settled-register) --- the port carries a `kind`, plus the exterior `Custom` label | C2/C3's outcome | **Graduated row resting on a lean** |
| **C5** | [`AGENT.presence.discussion.planning.md`](AGENT.presence.discussion.planning.md) --- PR-11's derivation | Provenance | **Record** |

**C2--C4 are the expensive part of the inventory.** PR-11 is **graduated**, and `exteriorRelationLabel` is **shipped**. Removing (ii) does not automatically un-graduate PR-11 --- the port still needs a `kind` --- but it does dissolve the fork PR-11's hardest half was decided on. **Phase 2 must state, per row, whether the verdict survives on its other legs.**

### D. Shipped code and normative docs

| # | Site | What depends on the clause |
| --- | --- | --- |
| **D1** | [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) --- `EphemeraLudicRelationalEdgeData.relationLabel?`, and the guard making it required non-empty when `kind === 'Custom'` | **The label's existence, not its variation.** Survives (ii)'s removal unchanged |
| **D2** | Same file --- `EphemeraLudicGraphPort.exteriorRelationLabel?`, and its comment *"the interior edges are siblings of `ports` ... a port's interior fan has no single label"* | **(ii) directly.** The field exists to denormalize *the exterior one of two differing labels* |
| **D3** | [Port records: field scope and the conflict rule](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#port-records-field-scope-and-the-conflict-rule) | The two-scope split, of which `exteriorRelationLabel` is half. **Normative text** |
| **D4** | [`classifyLudicGraphPortMismatch.ts`](../../../../../packages/mtw-gateways/ts/ephemera/positions/classifyLudicGraphPortMismatch.ts) --- `exteriorValuesOfEdge`, `exteriorValuesEqual` compare `kind` **and** `exteriorRelationLabel` | D2. Shipped, tested, with a diagnostics sweep and a self-heal behind it |
| **D5** | [`ludicGraphPortMismatchSweep/`](../../../../../lambda/diagnostics/ludicGraphPortMismatchSweep/) and [`healLudicGraphPortMismatch.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/healLudicGraphPortMismatch.ts) | D4's consumers |
| **D6** | [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md) relation-kind mental model | Already two kinds stale per **CD5**; do not fix it here |

**D1 is the line that keeps the sweep honest.** `relationLabel` **is not the clause.** A fiction-level label is needed whether or not it may differ across a boundary. **Only `exteriorRelationLabel` (D2--D5) is downstream of (ii)**, and it is roughly one field, one comparison function, and their tests.

### E. The edge-abstractions family --- the inheritance the sweep is *for*

| # | Site | Note |
| --- | --- | --- |
| **E1** | [EA-C1: the power cord and the flashlight](AGENT.edgeAbstractions.corpus.planning.md#ea-c1-the-power-cord-and-the-flashlight) | **Built on the clause's own worked example.** Written against today's model per corpus rule 1, i.e. **before** EA-10 existed --- so it cannot have been shaped to fit it |
| **E2** | [EA-C2: the clamp and the second contact point](AGENT.edgeAbstractions.corpus.planning.md#ea-c2-the-clamp-and-the-second-contact-point) | Same case family; adds two crossing edges pointing in **opposite directions** |
| **E3** | [EA-C3: cutting the thread](AGENT.edgeAbstractions.corpus.planning.md#ea-c3-cutting-the-thread) | Ariadne, not the cord. **Test whether it is discriminating at all** before counting it |
| **E4** | [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) | Where this plan reports |

**E1--E3 are the cases EA-10 stands to inherit**, and caveat 2 applies hardest here: **a case that does not discriminate on (ii) transfers nothing.** E1 and E2 are the cord-and-flashlight pair, which is (ii)'s founding example, so they are the strongest candidates and also the ones most at risk of being counted twice.

---

## Phase 2 --- grading by removal-survival

**Counterfactual:** [LS-1](#the-counterfactual-phase-2-grades-against-ls-1-decided) --- one `relationLabel` on the port record, every edge through the port agreeing with it.

### The verdict, stated before the table because it is conditional

**No site was found where (ii) is load-bearing and unreplaceable, so the sweep does not stop early --- but the displacement is conditional.** **Contested 2026-08-25 and the challenge did not land** --- see [below](#the-ladder-challenge-and-why-it-did-not-land-2026-08-25). The grades stand as written.

**The condition is stated as *requirements*, not as a representation, and the distinction is not cosmetic (rephrased 2026-08-25 from the user).** An earlier wording read *conditional on ARRANGE at crossing boundaries, unconditionally at presence ones*, which **names the candidate inside the condition** and thereby makes ARRANGE part of the finding. That is [the ladder challenge's own error](#the-ladder-challenge-and-why-it-did-not-land-2026-08-25) --- holding a representation fixed --- committed in the verdict line rather than in a grade. **Stated correctly: removing (ii) is safe once something meets X and Y below. This family already holds a *candidate* that meets both. The candidate is not the condition, and if it falls the requirements survive it, still gradeable.**

| | The requirement removal creates | Where it is established | What must supply it |
| --- | --- | --- | --- |
| **X** | **A coarse relation needs its own authored phrasing, and that phrasing is not derivable from the fine one.** `ThreadsInto` is not a function of `SolderedTo`; under one label per port the coarse read reports *a power cord is soldered to the flashlight*, **wrong at room scale** | [A5](#a-origin-and-immediate-consequences), which carries [B1, B2 and B8](#b-the-abstraction-layers-family) --- **four rows** | **SPLIT alone satisfies X.** Two edges at two scales, each label authored where it is true, the coarse edge real and carrying its own label |
| **Y** | **Many fine edges must be nameable as one coarse relation**, including when they carry **different labels and point in different directions.** (ii) never described this: it speaks of *a* label per side, and here the interior side has two | [E2](#e-discrimination-graded-before-inheritance-is-counted) (EA-C2, `Clamp -[Secures]-> Cord` beside `SolderedTo`) | **ARRANGE satisfies Y**, and does so by **supplying a locus for an authored coarse label --- not by computing the fusion.** [EA-C2](AGENT.edgeAbstractions.corpus.planning.md#ea-c2-the-clamp-and-the-second-contact-point) is explicit that `SecurelyThreadsInto` is not `SolderedTo` composed with `Secures` under any rule either edge supplies. ARRANGE gives that fusion somewhere to be **written down**, which is [PR-11](AGENT.presence.planning.md#settled-register)'s *authored at mint* shape one level up |

**There is no independent Z, and the reason is stronger than the one first given (corrected 2026-08-25).** What looked like a third --- [C3](#c-the-presence-family--and-the-damage-that-was-withdrawn)'s finding that one-label-per-port is **ill-formed** where the interior fan is multi-edged --- was first written off as *Y seen from the counterfactual's side.* **That was too generous to it.** The fan finding is **instanced only on a presence port** and belongs to the presence branch entirely, so it is **not on the crossing branch in any form** --- neither a third requirement nor a re-view of Y. **X and Y are the whole of the crossing-side condition.**

**Why one candidate covers both: ARRANGE is defined as SPLIT-plus.** See [the representation table](#the-displacement-hypothesis-in-the-users-own-framing).

**The presence half falls out of this phrasing rather than needing its own clause, which is why the rephrasing is an improvement and not a restatement.** At a presence port there is **no crossing**, so **X never arises** --- the earlier wording had to carry *unconditionally at presence ones* as an exception, and under X/Y it is simply a case where the conditions are not triggered. **Cite it this way in [PR-15](AGENT.presence.planning.md#settled-register).**

**"Candidate" is load-bearing and must not be dropped when this verdict is quoted.** [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) is **Open**: it still owes [PQ-1](AGENT.abstractionLayers.proposals.planning.md#the-port-record-split-complementary-with-the-interior-authoritative-settled-2026-08-06)'s *what does it save* bar, a discriminating case, [AB-62](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)'s materialization size, and an answer to its **own named weakness** --- *port-to-port edges are only ever summary edges* fails on an authored Arrangement, where such an edge could be primary. **Caveat 1 governs: a clean sweep retires (ii) and does not graduate this.**

### The ladder challenge, and why it did not land (2026-08-25)

**Raised from conversation as a candidate *lean, load-bearing* --- the finding this sweep reported it could not produce. It is recorded because the observation inside it is true and useful, and because the way it failed is worth more than the challenge was.**

**The observation, which stands.** `Boulder -[TiedTo]-> Rope#portA -[TiedTo]-> RopeEnd1` supports a **fine** read (traverse the partner edge: *which part is it tied to*) and a **coarse** one (treat the port as terminal: *the rope in this room is tied to the boulder*). A presence-port terminal reads identically at the coarse grain and differs underneath --- *there is no finer fact* versus *there is one and I have not expanded it*. **On the cord, where the two grains are worded differently, one label per port would force the coarse read to report *a power cord is soldered to the flashlight*, which is wrong at room scale.** So an exterior label is not merely a denormalization of the outer half; **it is the phrasing the coarse read is spoken in.** That is real, and [PR-15](AGENT.presence.planning.md#settled-register) and [the origin section's two-operations note](AGENT.abstractionLayers.proposals.planning.md#a-port-is-a-scale-boundary-not-a-relay-2026-08-06) both took useful corrections from it.

**Why it is not a load-bearing site, which is a scope error and not a matter of degree.** The claim was *at a crossing port, nothing else **in that structure** supplies the coarse phrasing.* **True, and irrelevant.** [This plan's own method](#the-displacement-hypothesis-in-the-users-own-framing) grades **cases**, not structures --- *displacement asks only whether anything still needs it* --- and the COARSEN/SPLIT/ARRANGE table exists **because one situation has several representations.** Holding the crossing fixed and then finding (ii) necessary inside it **assumes the answer.** And the assumption was already refuted in this plan's own text: **presence-SPLIT represents the cord case**, so the case does not require a crossing, so (ii) is not required by the case.

**The test restated in the sharper form it should have had all along (user, 2026-08-25).** **Given the uses we can see for SAME-type crossing edges and chains of them, are there cases where MULTI-type crossings are the ONLY solution to a corpus case?** **That crossing edges remain useful for some representations is not evidence that they are the right representation for *these* ones.** Same-type chains (the rope's `TiedTo`/`TiedTo`, [B6](#b-the-abstraction-layers-family)'s `Shown` chain) are useful and need nothing from (ii); the sweep turns entirely on whether a *differing-label* crossing is ever forced. **No such case has been produced.**

**Logged** as `framing-inherited` in [the performance tally](../../../../AGENT.designVariant.performance.md) --- the quantifier was wrong: *exists a representation that needs it* was graded where *every representation needs it* was owed.

### A. Origin and immediate consequences

| # | Verdict | Grading |
| --- | --- | --- |
| **A2** | **Falls in reasoning, conclusion survives** | *"If the kinds legitimately differ there is no shared fact to disagree about"* is (ii) doing the work, and under removal the two-writer worry returns. **But PR-C2 Finding 3 consequence 1 already retired that comfort** --- arbitration *"was always live and merely unexercised"*, shown on `fromHostId`, which has nothing to do with labels. The storage conclusion stands on locality; only its 2026-08-06 justification falls. **Unchanged by the 2026-08-25 [ladder challenge](#the-ladder-challenge-and-why-it-did-not-land-2026-08-25)** |
| **A3** | **Survives** | Severing the exterior edge and leaving the interior one strands a port *structurally* --- soldered to a battery case while exiting nowhere --- whether or not the labels differed. Independent kinds were the **illustration**, single-use and the dangling reference are the **load** |
| **A4** | **Falls, by construction** | It is (iv). Nothing is left unprotected: what it forbade was collapsing two records into one on the assumption they must match, and under removal they *do* match, so the collapse it feared becomes correct rather than dangerous |
| **A5** | **Transfers --- and this is the pivotal grade** | Losslessness holds because the exterior label is authored at exterior scale and is already the right summary. Under one label per port that reading collapses; under **SPLIT/ARRANGE** it survives intact, because the two labels sit on **different edges at different scales** and coarsening means reading only the outer one. **A5 is what B1, B2 and B8 all inherit, so its transfer carries four rows.** **The 2026-08-25 ladder challenge did not disturb this grade --- see [why](#the-ladder-challenge-and-why-it-did-not-land-2026-08-25).** |
| **A6** | **Survives, and was never a lean** | The no-compatibility-matrix argument is AB-19's --- *do not compile fictional physics into lookup* --- and it holds against policing label agreement just as it held against policing coherence. Downgraded from *lean, weak* to **mention** |
| **A7** | **Survives on an independent leg** | **New entry, found by [LS-3](#open-decisions-implementation--plan-only)'s mitigation and absent from Phase 1** --- [PQ-1's record split](AGENT.abstractionLayers.proposals.planning.md#open-questions-ab-34-sub-questions-ids-stable-never-reused), *complementary with the interior authoritative*, which is A2's *"complementary, not redundant"* one layer down. Its 2026-08-12 re-grounding on P6 (the ingress list is **reference data**) makes no claim about labels, so it survives removal |

### B. The abstraction-layers family

| # | Verdict | Grading |
| --- | --- | --- |
| **B1, B2, B8** | **Transfer with A5** | All three are losslessness downstream. They transfer under SPLIT/ARRANGE and fall under a literal one-label reading --- **so they are the rows that make ARRANGE load-bearing rather than optional** |
| **B4** | ~~**Simplifies**~~ **--- RE-GRADED 2026-08-25 to *simplifies on one axis, narrows on another*, and it is the inventory's most affected row rather than its tidiest** | The label half stands: the prohibition *never extend the check to `relationLabel`* becomes an obligation, and CD6 validates **more**. **But [PR-15](AGENT.presence.planning.md#settled-register) narrows it in the opposite direction on a second axis** --- CD6 quantifies over edges that *refer to* the port ([`edgesReferringToPort`](../../../../../packages/mtw-gateways/ts/ephemera/positions/classifyLudicGraphPortMismatch.ts) matches `from` **or** `to`), which conflates passing **through** with terminating **at**. **At a presence port the check is a category error, not a check to soften**, and shipping it as written would have [the self-heal](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/healLudicGraphPortMismatch.ts) rewrite the port's `kind` to `Custom` and destroy the binding. **So CD6 gets wider on what it compares and narrower on what it compares over.** Still **reported separately per [LS-2](#open-decisions-implementation--plan-only), not counted** --- and **CD6 is now BLOCKED on PR-15**, which this plan records but does not own |
| **B6** | **Survives, and does not kill the claim** | The chain's anti-collapse defence cites A4, but A4 is a **rhetorical prop, not the load.** What actually prevents collapsing three edges in three graphs into one is that `AREA#Bay`'s graph cannot hold an edge from `ROOM#Bridge`'s root at all --- the port exists because the reference crosses a storage boundary. **The defence re-derives on structural addressability and clause 2, and comes out stronger for not resting on an incidental resemblance.** The passage's *"the facts differ per level"* re-reads, under removal, as different **renderings of one relation at different scales** --- which is the displacement hypothesis stating itself in the defence of the site it was supposed to threaten |
| **B7, B9** | **Downstream of B6** | Transfer with it. PQ-14's scalability question is about **crossing count**, untouched by labels |
| **B3, B5** | **Records** | Status and provenance. No verdict applies |

### C. The presence family --- and the damage that was withdrawn

| # | Verdict | Grading |
| --- | --- | --- |
| **C2** | **Simplifies** | The (A)/(B) fork has two dimensions --- *store a label at all* and *which of the two*. Removal deletes the second and leaves the first, whose answer is unchanged: the exterior edge is **in another shard**, so the port stores it to stay locally answerable. Same verdict, shorter argument |
| **C3** | ~~**Falls in reasoning; the rule survives on a leg that is not (ii)**~~ **--- RE-GRADED 2026-08-25 (user) to *falls on the crossing branch; the surviving leg is presence-only*** | The 2026-08-23 amendment gives **two** reasons for refusing the interior label, and the first grade kept the second alive at every port. **It is not alive at a crossing one.** The locality reason is (ii)'s and falls. **The fan-out reason was read as general and is instanced only on a presence port** --- its own sentence is *"a **`Present`** port fans out across the unrelated members of its bucket"*, and *the unrelated members of its bucket* is a presence bucket. **Under [PR-15](AGENT.presence.planning.md#settled-register)'s partition that instance sits entirely on the presence branch**, where it is owned and where kind-agreement is a category error anyway. **So on the crossing branch the fan reason has no case behind it**, and what survives there is **locality alone** --- C2's reason, the exterior edge being in another shard. **Logged as `overbroad-inheritance`**; see [the note below](#c-the-presence-family--and-the-damage-that-was-withdrawn) |
| **C4** | **Survives unchanged** | **PR-11 does not un-graduate.** Its substance --- the port carries a `kind`, authored at mint rather than derived from edges --- rests on Finding 2, i.e. **(iii)**. Under removal the word *exterior* in *"plus the exterior label"* becomes redundant qualification rather than a claim. **The expensive part of the inventory comes back cheap** |
| **C1, C5** | **Authority / record** | C1 is where (iii) was established and is explicitly out of sweep |

**A cost was claimed here and is WITHDRAWN 2026-08-25 (user). Recorded rather than deleted, because the way it was wrong is the same way (iii) was wrong two days earlier.**

**What was claimed.** That C3's fan reason makes **[LS-1](#the-counterfactual-phase-2-grades-against-ls-1-decided)'s literal form not generally satisfiable** --- a port whose interior fan carries several differently-labelled edges having no single label for every edge to agree with --- so one-label-per-port is only **well-formed** where the interior fan is single-edged.

**Why it does not hold.** The fan reason's **only worked instance is a presence port**, and [PR-15](AGENT.presence.planning.md#settled-register) puts presence ports on the other branch. **On the non-presence branch there is no case behind it**, and none was produced --- which is [this plan's own stated test](#the-displacement-hypothesis-in-the-users-own-framing) applied to a cost instead of to a grade.

**The rule that replaces it, from the user, and it is stronger than a patch: *at a non-presence port, all edges agree on `kind` and `relationLabel` --- with each other and with the port.*** That is **[(i)](#what-it-says-today-and-it-is-not-what-it-says-on-the-page) restated as a validation**: a port is the scale boundary of **one** relation, so differently-labelled crossings are more than one relation and warrant more than one port --- which single-use already implies by giving each crossing its own exterior referrer.

**Two supports.** **[E2](#e-the-edge-abstractions-family--the-inheritance-the-sweep-is-for) does not falsify it** --- its two differently-labelled crossings get **two ports** under single-use, so it is many-to-one **at the Arrangement** (requirement Y) and never a fan **within** a port. And **the shipped comparison is already nearer this rule than to (ii)**: [`exteriorValuesEqual`](../../../../../packages/mtw-gateways/ts/ephemera/positions/classifyLudicGraphPortMismatch.ts) compares `kind` **and** the label across everything `edgesReferringToPort` returns, so widening it is [D4](#d-code-consequence-sized) as already sized --- **the comparison losing an exception, not new machinery.**

**The error, named because it repeats.** [PR-C2 Finding 2](AGENT.presence.corpus.planning.md#pr-c2-the-flashlight-the-power-cord-and-the-port-that-locates-nothing) generalized **from a `Custom` crossing to all ports**; this generalized **from a `Present` fan to all ports.** **Two over-generalizations in one clause's neighbourhood in two days is a property of the material, not a coincidence** --- the port vocabulary reads uniform and the two kinds do not behave alike. **Logged as `overbroad-inheritance`** in [the performance tally](../../../../AGENT.designVariant.performance.md). **Standing instruction for anyone grading here: before carrying a sentence about *ports* across the PR-15 partition, find the port kind it was instanced on.**

### D. Code consequence, sized

**Small, and nothing is deleted.**

| # | Consequence under removal |
| --- | --- |
| **D1** | **Untouched.** `relationLabel` and the `Custom` requiredness rule are needed either way --- D1 was never the clause. **Re-worded 2026-08-26: "the `Custom` requiredness guard" is now the *type's own shape*** --- `relationLabel` moved onto a discriminated union (`RelationalEdgeKindAndLabel` / `RelationalKindAndLabel` in [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), so the rule is structural rather than a runtime check repeated per layer, and it now runs **both** ways (no non-`Custom` kind may carry a label). **This does not disturb the grade** --- the field and the rule still exist either way, which is all D1 asserted |
| **D2** | **Rename, not deletion.** `exteriorRelationLabel` becomes the port's `relationLabel`; **the comment *"a port's interior fan has no single label"* stays true** and becomes the field's justification rather than a caveat on it (C3) |
| **D3** | **Contract text edits.** The exterior/interior scope split survives for `fromHostId`; the label's membership in the exterior scope becomes moot |
| **D4** | **Widened, not weakened.** `exteriorValuesEqual` compares against every edge through the port instead of the exterior one --- the same shape as CD6's inversion (B4). **Gated on PR-15**, which changes *which* edges count as through it |
| **D5** | **Unchanged shape, wider coverage.** The sweep and self-heal keep working on a broader invariant |

### E. Discrimination, graded before inheritance is counted

| # | Discriminating? | Grading |
| --- | --- | --- |
| **E1** | **Yes --- but not independently of the origin** | EA-C1 *is* the cord-and-flashlight example the clause was written on. Counting it beside A5 would count one situation twice. **One discriminating case, held jointly with the origin** |
| **E2** | **Yes, and it is the strongest in the sweep** | EA-C2 adds `Clamp -[Secures]-> Cord` beside `SolderedTo`: **two interior crossings, differently labelled, fused into one exterior `ThreadsInto`.** (ii) does not even cover this --- it describes *a* label on each side, and here the interior side has two. **The case is many-to-one, which is a fan, and **ARRANGE** is what represents it.** Written 2026-08-24 against today's model, before EA-10, so it cannot have been shaped to fit |
| **E3** | **No** | EA-C3 cuts Ariadne's thread. It grades **dissolution and identity** --- A3's territory --- and is silent on labels. **Transfers nothing**, per caveat 2 |

**Count of discriminating inherited cases: two** --- E1 (jointly with the origin) and E2. **B6 is a transfer, not an inheritance**, and is reported as such.

### LS-3's mitigation, executed

Re-read the [locked-with-a-lower-bar register's neighbours](AGENT.abstractionLayers.planning.md#what-is-not-locked-and-must-not-ride-in-on-this) --- AB-12(b), AB-30, AB-48, PQ-4, PQ-8, PQ-9, PQ-10, PQ-12, PQ-13, PQ-1's record split. **One new site: PQ-1's record split, now A7**, which depends on A2's *complementary, not redundant* without using any Phase 1 search term. **That is the mitigation paying for itself once**, and it is also the honest limit of it: the risk is reduced, not closed, and Phase 3 reports it as residual.

---

## Recommended order

Pending work uses `[ ]`, completed work uses `[X]`. Mark nested lines `[X]` as each is done.

- [X] **Phase 0. Record the clause.** Its wording, its vocabulary drift, its four claims, its formal status, and the displacement hypothesis. Above.
- [X] **Phase 1. Inventory the leans.** Sections A--E, with the search method recorded and the mention/lean column separated per caveat 2. Above.
- [X] **Phase 2. Grade each entry by removal-survival.** [Above](#phase-2--grading-by-removal-survival). No site proved load-bearing and unreplaceable, so the sweep ran to completion; the displacement is **conditional on solutions to requirements X and Y**, which SPLIT and ARRANGE are a *candidate* for rather than the definition of --- see [the verdict](#the-verdict-stated-before-the-table-because-it-is-conditional).
  - [X] **B6 (the C22 three-graph chain) first**, as the inventory's sharpest test. **Survives; its defence re-derives structurally.**
  - [X] **C2--C4 next**, since they are the only leans under a **graduated** row. **PR-11 does not un-graduate.**
  - [X] **A2--A5**, the origin's own consequences. **A5 transfers and carries four downstream rows with it.**
  - [X] **D2--D5**, to size the code consequence if the sweep comes back clean. **A rename and a widened comparison; nothing deleted.**
  - [X] **E1--E3 last**, and grade **discrimination** before counting inheritance. **Two discriminating, one not.**
- [ ] **Phase 3. Report to [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only).** A verdict on displacement, the count of **discriminating** cases inherited, and --- per caveat 1 --- an explicit statement that a clean sweep has **not** graduated EA-10. Re-grade pointers (never copies) into corpus files under rule 5.
- [ ] **Phase 4. Dispose.** Move any lasting finding into the parent plans, then **delete this file.**

### What is deliberately not in scope

- **Building EA-10's construct**, or deciding its `kind`-marker-at-mint question. This plan grades a removal, not an adoption.
- **Touching code.** D2--D5 are **sized** in Phase 2 and changed only if a decision downstream of EA-10 says so.
- **Fixing `AGENT.concepts.md`** (D6) --- that is CD5's, and doing it here would be the drive-by that step exists to prevent.
- **Re-arguing (iii).** `kind` pass-through is not under sweep and no Phase-2 verdict may disturb it. **The 2026-08-25 scope correction is not an exception to this** --- it came from conversation and is registered as [PR-15](AGENT.presence.planning.md#settled-register), a row this plan does not own. **This plan records the narrowing and grades against it; it did not derive it and may not extend it.**

## Open decisions (implementation --- plan only)

Plan-only: decisions being made in order to run the next phase. When the plan closes, findings go to [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only) and these rows go away with the file.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **LS-1** | **Does *removal* mean "one label per port" or "no label on the port record"?** The two differ at D2: the first keeps `exteriorRelationLabel` as an uncontested denormalization, the second deletes it. **Grading A2 and C2--C3 needs this fixed first**, because they answer differently under each | Phase 2 | **Decided 2026-08-25 (user): one label on the port record.** See the counterfactual below |
| **LS-2** | **Does a *simplifies* verdict (B4) count toward displacement, or only *survives* / *falls*?** A site that gets cleaner under removal is evidence the pattern is carrying weight it should not, but it is not a case that **needed** the pattern | Phase 3's count | **Decided 2026-08-25 (user): report separately**, do not add to the inherited count |
| **LS-3** | **What closes the residual search risk in Phase 1?** The vocabulary sweep cannot find a site that depends on (ii) without naming it | Phase 3 | **Decided 2026-08-25 (user): re-read the [locked-with-a-lower-bar register](AGENT.abstractionLayers.planning.md#what-is-not-locked-and-must-not-ride-in-on-this) neighbours**, on the theory that anything depending on this property was probably registered next to it. Adopted *in the interest of thoroughness* --- it is a mitigation, not a proof, and Phase 3 still reports the risk as residual |

### The counterfactual Phase 2 grades against (LS-1, decided)

**Removal means: a port record carries exactly one `relationLabel`, and every edge through the port agrees with it.** The field is **not** deleted --- it stops being *the exterior one of two differing labels* and becomes *the port's label*, which is what `exteriorRelationLabel`'s name would no longer describe.

Three consequences bind the grading:

- **`kind`'s treatment is the model.** Under removal, `relationLabel` joins `kind` as something a port may store because it is **invariant across the fan** --- which is exactly the test PR-C2's 2026-08-23 amendment (C3) already states. C3 is therefore graded on whether its *reason for excluding the label* survives, not on whether its rule does.
- **CD6's prohibition becomes an obligation.** Kind-agreement validation extends to label-agreement rather than being forbidden from it. This confirms B4's inversion, and under **LS-2** it is reported separately rather than counted. **Only on the label axis** --- [PR-15](AGENT.presence.planning.md#settled-register) narrows the same check on a second one, so *stronger* is not the whole verdict.
- **A *falls* verdict is not automatically a cost.** Sites that exist only to defend variation (A4, and the fork in C2) do not need replacing when the variation goes; they need only to be shown to leave nothing unprotected behind them.

## Progress

| Phase | State |
| --- | --- |
| **Phase 0 --- clause record** | **Done 2026-08-25.** Four claims separated; (iii) explicitly excluded from the sweep; the 2026-08-06 wording marked as unreadable in today's vocabulary |
| **Phase 1 --- inventory** | **Done 2026-08-25.** 5 sections, 27 entries. Confidence high, **not certified** --- see LS-3. **Amended in Phase 2: A7 added (28), A6 downgraded to a mention** |
| **Phase 2 --- grading** | **Done 2026-08-25, then narrowed the same day by PR-15's scope correction to (iii).** All entries graded. **Verdict: displacement holds --- requiring ARRANGE at CROSSING boundaries, and requiring nothing extra at PRESENCE ones.** **Contested the same day by the ladder challenge and upheld** --- the challenge graded a structure where the method grades a case; A2/A5 unchanged. **B4 re-graded** (simplifies on the label axis, narrows on the quantifier axis; CD6 now blocked on PR-15). No load-bearing unreplaceable site; **PR-11 survives ungraduated-from**; two discriminating cases inherited (E1 jointly with the origin, E2); one *simplifies* (B4) reported separately per LS-2 |
| **Phase 3 --- report to EA-10** | Not started |
| **Phase 4 --- dispose** | Not started |

## Verification

This plan's deliverable is documentation, so verification is documentation-shaped.

- **Link integrity.** Every relative link and `#anchor` in this file resolves. Anchors in this family are non-obvious --- `---` in a heading is an em dash, and its two surrounding spaces each become a hyphen, so `## Open decisions (design --- plan only)` is `#open-decisions-design--plan-only`. **Copy an existing link rather than deriving the slug.**
- **Inventory completeness.** Re-running the [Phase 1 search terms](#phase-1--inventory-of-where-we-have-leaned-on-it) produces no site absent from sections A--E.
- **No code touched in Phases 0--2.** `git status` shows changes only under `taskPlanning/`.
- **Phase 3 only:** after any code change downstream of a verdict, run the full `lambda/ephemera` suite --- its `*.integration.test.ts` files sit outside `tsconfig`, so `tsc` alone does not cover a rename or a deletion.

## Lifecycle

**Delete this file at Phase 4.** Nothing here is durable: the clause record is a reading of documents that still exist, and the inventory is reproducible from the search terms above. **What must survive is the verdict**, and it survives in [EA-10](AGENT.edgeAbstractions.planning.md#open-decisions-design--plan-only)'s row --- so Phase 3 is not done until that row can be read without this file.
