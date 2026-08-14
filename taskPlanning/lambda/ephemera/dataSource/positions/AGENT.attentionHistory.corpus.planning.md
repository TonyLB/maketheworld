# Attention history: the Phase 0 corpus

**Companion to [`AGENT.attentionHistory.planning.md`](AGENT.attentionHistory.planning.md), opened 2026-08-12** on the precedent of the parent initiative's own corpus split. This file holds **worked cases and nothing else**. Open rows, the retention axis, and the progress table stay in the plan.

**Read this as part of the plan, not as an appendix.** An AH row is worded the way it is because of a case here.

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## What counts as a case here, and how it differs from the C-series

**The [C-series](AGENT.abstractionLayers.corpus.planning.md) rule cannot apply, and pretending otherwise would produce a corpus of nothing.** That rule is: *a case that cites a remembered claim rather than a line of code is not yet corpus.* **(The C-series [restated its rules 2026-08-14](AGENT.abstractionLayers.corpus.planning.md#phase-0-corpus) and now admits a second kind --- a case against an unbuilt proposal, anchored to the clause it falsifies. That second rule does not rescue attention either, for the same reason: it anchors to a proposal's clause table, and attention's cases turn on play. The split below stands unchanged.)** **Attention has no shipped implementation at all** --- there is no code site for a case to stop at, and there will not be until this plan graduates.

**The discipline is transplanted rather than dropped, and the replacement is stricter in the way that matters:**

> **A case is corpus when two candidate designs would produce a *different player-visible outcome*.** Name the outcome, in both directions.

**A case where the designs differ only in cost is not corpus** --- it is a benchmark, and it belongs to AH-1's measurement rather than to Phase 0. **A case where they produce the same play is not a case at all**, however interesting the internals. This is [the parent's falsification clause](AGENT.abstractionLayers.proposals.planning.md#what-counts-as-a-falsification-case-learned-the-hard-way-2026-08-05) with *named axis* replaced by *named play difference*, because attention has one consumer and does not need the axis half.

**Scope reminder, and it will disqualify tempting cases.** Attention serves **reference-location** only. A case about what a room's prose *says* is a **description** case --- it belongs to the parent, not here. The test: if the case's payoff is what the player *reads*, it is out; if the payoff is what the player can successfully *refer to*, it is in.

### Annotation line, uniform across cases

**promotion | demotion | both** --- which **AH** rows it decides --- where it sits on the **retention axis** (endpoint-only suffices | needs path) --- **the player-visible difference**, stated in both directions.

**The retention tag is the one that earns this corpus its keep.** Each case is a vote on whether a record set can carry attention or whether something path-aware is required, and reading that column down is the direct input to AH-1. **Do not fill the [tally](#retention-axis-tally) before the cases are worked** --- it is the corpus's output, not its premise.

---

## Phase 0 corpus

**Ten seed cases: A1--A9 stated 2026-08-12, A10 added 2026-08-13. None worked.** Each records its setup and what it discriminates; findings are deliberately absent.

**The corpus's known blind spot, recorded up front on the parent's precedent:** every case below is **single-room**. Attention across a boundary --- a character who can see into the next room, a whole spanning two rooms with different attention states in each --- is untested, and a claim that survives A1--A10 has not yet met that. **Expect at least one cross-boundary case before AH-1 is answered.**

### A1: The occupant who steps out and right back in

**Setup.** Room has one occupant. They look in a chest, revealing a brass key. They step out to the corridor and immediately step back in. They type `get key`.

**What it discriminates.** Room-empties is the plan's primary reset candidate, and this is the case that makes it look wrong. **A literal reading resets the window** --- the room emptied --- so the key is no longer promoted and `get key` falls through to a graph walk. **A salience reading keeps it**, because nothing in the fiction made the key less relevant in the four seconds the character was in the corridor.

**Why it is not merely an edge case.** If room-empties is wrong here, it is wrong as a *rule* and can survive only as an optimization --- which is exactly the demotion of AH-6 from mechanism to shortcut. **This case decides that demotion.**

*Annotation:* demotion --- AH-6 --- endpoint-only suffices --- **`get key` succeeds versus falls through to a slower walk that may or may not still find it.**

**Not yet worked.**

### A2: The rope that was carried away

**Setup.** A rope is surfaced in room A. Another character picks it up and carries it to room B. A player in room A types `untie rope`.

**What it discriminates.** Whether **removal demotes**, or whether the stale handle is simply allowed to fail through. **Under fall-through it costs nothing to leave the entry**: the handle resolves to an address, the graph says the rope is not here, and the refusal is correct and already paid for by [P6 clause 4](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses). **Under active demotion**, mutation must write to the attention record --- which puts attention on the write path and re-opens a latency question the design has so far avoided entirely.

**The trap to check for.** *"You don't see any rope"* versus *"the rope is no longer here"* are different fictional registers, and the second is better play. If the good message requires the stale entry to still exist, then **demotion is actively harmful here** and the cheap option is also the right one.

*Annotation:* demotion --- AH-2, AH-6 --- endpoint-only suffices --- **a correct refusal that names the rope versus a blank failure to recognise the word.**

**Not yet worked.**

### A3: The box inside the box

**Setup.** A crate holds a lockbox; the lockbox holds a switch. A player opens the crate. The room's narration says a lockbox is inside. They type `flip switch`.

**What it discriminates.** **How far one surfacing reaches, and P6 clause 2 does not say.** One level: the lockbox is promoted, the switch is not, `flip switch` falls through. Transitive: the switch is promoted too --- but then a single `look` into a deeply nested container promotes an unbounded subtree, and **attention-scoping stops bounding anything**, which is the failure P6 exists to prevent.

**Run this early.** AH-3 blocks more rows than any other, and the answer changes what a "surfacing event" even records --- which is AH-1's input.

**It also tests the ingress list**, the cache's [first real consumer](AGENT.abstractionLayers.proposals.planning.md#which-axes-want-the-ingress-list-and-why-pq-1-does-not-reverse-2026-08-12): if the lockbox exposes a port that is live in the crate, does opening the crate promote that port, the object behind it, or neither?

*Annotation:* promotion --- **AH-3**, AH-1 --- endpoint-only suffices --- **`flip switch` binds immediately versus requires opening the lockbox first.**

**Not yet worked.**

### A4: "Is there a screwdriver?" --- "No."

**Setup.** A player asks whether there is a screwdriver in the workshop. There is not, and under [P5](AGENT.abstractionLayers.proposals.planning.md#proposal-p5-improvisational-licence-as-a-first-class-graph-item) the system mints that absence as a fact rather than merely declining. A minute later, the same or another player asks again.

**What it discriminates.** **Whether a negative takes salience.** If the minted absence is not recorded in attention, the second ask re-enters improvisation and **may mint a different answer** --- which is a continuity break, not a performance problem. If it is recorded, *"the screwdriver"* becomes a referrable handle that resolves to *there isn't one*, a different and better register than *"you don't see any screwdriver."*

**Why this case is load-bearing for the retention axis.** A record set of surfaced *addresses* has no obvious slot for **a thing that does not exist**. Either the minted absence gets an address in `ludicGraph` (and the case is ordinary), or attention must record something that is not an address --- **and that is the first real pressure toward a richer record than `{ address -> salience }`.**

*Annotation:* promotion --- **AH-5**, AH-1 --- **candidate needs-path** --- **a stable "there is no screwdriver" versus a second ask that can invent one.**

**Not yet worked.**

### A5: The second character, arriving after

**Setup.** A opens a chest in the parlour; the room is told a revolver is inside. A leaves. B enters the parlour, having seen none of it. B types `get revolver`.

**What it discriminates.** P6 committed to **room-scoped** attention on the principle that what licenses reference is what the *room was told*, not what a mind perceived. **This case tests the principle at its weakest point** --- B was not present to be told.

**Both readings are defensible and that is why it is a case.** Room-scoped says yes: the revolver is in the room's live narrative, and a shared scene is the medium's unit. Presence-filtered says no: B has no fictional basis for knowing, and inheriting it is a leak that lets players read the room's history off the parser.

**If presence-filtering wins, the room-scoped commitment in P6 narrows** and AH-6's per-character-window candidate stops being an option and becomes a requirement.

**Re-scoped 2026-08-12, before being worked, and it shrank.** [The ledger-as-instruction-set frame](AGENT.attentionHistory.planning.md#the-attention-ledger-as-an-instruction-set-2026-08-12) surfaced that `manipulation/kernel`'s **`capture` step already solves audience-at-that-beat**: it snapshots a host's occupants mid-walk, and that snapshot *is* the audience narration is delivered to, precisely because "the audience for *Tess left* has to be who was standing in the room at that beat." **So this is no longer a question about whether attention can be time-correct --- shipped code does that --- but a narrower one: does an attention promotion attach to the captured roster, or to the host?** Read `capture`'s semantics before working this case; a version of it argued from first principles will re-derive machinery that exists.

*Annotation:* promotion --- AH-2, AH-6 --- endpoint-only suffices --- **B can name the revolver on arrival versus must open the chest for themselves.**

**Not yet worked.**

### A6: A says "there's a switch in there"

**Setup.** A looks into a cabinet and sees a switch. Rather than doing anything mechanical, A **says aloud**: *"there's a switch in there."* B, who has not looked, types `flip switch`.

**What it discriminates.** **Whether player speech confers salience** --- and it is the hardest case in the corpus, because there is no system event carrying structured data. The narration is free text authored by a player.

**The reason it cannot be dismissed as an edge case.** This is [reincorporation](AGENT.abstractionLayers.planning.md#fiction-is-a-fault-tolerant-medium--and-what-that-does-not-excuse-2026-08-09) in its purest form, and it is the thing the medium is *for*. A design where the fiction advances by players naming things, but the reference layer only hears the parser, has an obvious and permanent seam in it.

**The costly reading, named so it is chosen rather than backed into:** recovering addresses from free-text speech is inference, which is an LLM job, which the low-latency path cannot afford. **The cheap reading:** speech confers nothing, and B's `flip switch` falls through to a graph walk that succeeds anyway because the cabinet is open --- **in which case the seam may be narrower than it looks**, and this case's real job is to measure how often fall-through quietly covers it.

*Annotation:* promotion --- **AH-2**, AH-1 --- **needs path** --- **B binds "switch" directly versus depends entirely on fall-through.**

**Not yet worked.**

### A7: The LLM opens the bag

**Setup.** A reasoning query --- *is there anything in the satchel that could cut rope?* --- causes traversal into the satchel's interior graph. No character looked; nothing was narrated. A player then types `get shears`.

**What it discriminates.** **Whether traversal on the reasoning path confers salience. It almost certainly must not**, and the case is stated so that conclusion can be falsified rather than assumed.

**Why promotion here would be a defect and not merely wasteful.** Reasoning and reference-location are different consumers with different budgets, and the reasoning path routinely opens things no one in the fiction has looked at. Promoting from it **leaks structure into the player's reference surface that nobody learned**, which is the same class of failure as the [coarsening default applied on the reasoning path](AGENT.abstractionLayers.planning.md#what-the-conflict-catches-immediately) --- a mechanism built for one audience misapplied to another.

**The negative-case discipline matters.** If A7 confirms *no*, it establishes that **the write to attention is bound to narration, not to traversal**, which is a sharper rule than "perception events promote" and constrains AH-2 more than any positive case will.

*Annotation:* promotion (negative case) --- **AH-7**, AH-2 --- endpoint-only suffices --- **`get shears` binds off a query the player never saw versus falls through as it should.**

**Not yet worked.**

### A8: The lever pushed once, and the lever that is the whole scene

**Setup.** Two levers in a control room. Lever X is mentioned once in passing. Lever Y is pushed, pulled, pushed again, and argued about for ten minutes. Later, a player types `pull lever` with no qualifier.

**What it discriminates.** **Whether salience has magnitude, and what feeds it.** A bare set of surfaced addresses cannot distinguish X from Y and must either ask a disambiguating question or guess. A scalar can rank Y first --- **but only if the record is not purely endpoint-only**, since push-pull-push aggregates to the same *state* while carrying very different *weight*.

**This is where aggregation shows its cost.** The parent conversation established that push/pull/push is not meaningfully different from push/push **for state**. This case asks whether it is different **for salience** --- and if it is, then the record set needs at least a count or a decay accumulator, which is the first concrete step off the endpoint-only end of the axis.

**It also carries AH-4's second half:** does re-surfacing **refresh** recency, or **accumulate** weight? Y is both recent and heavy; separate the two by making X recent and light.

*Annotation:* both --- **AH-4**, AH-1 --- **needs more than endpoint-only** --- **`pull lever` resolves to Y versus prompts for disambiguation.**

**Not yet worked.**

### A9: The busy hub

**Setup.** A tavern common room that has not been empty in three days of play. Hundreds of narrated events, dozens of objects surfaced and forgotten.

**What it discriminates.** **AH-6's own case, and the reason PC-1 was carried into this plan.** Room-empties never fires, so under a window rule the window never resets and attention-scoping degrades toward exhaustive depth --- which is P6's benefit lost by slow accretion rather than by a decision.

**The candidate this case exists to test, stated as a hypothesis to attack rather than a plan:** under **decaying salience**, the set may be self-bounding without any boundary at all. Entries that keep being re-surfaced stay hot **because they genuinely are salient**; one-off mentions decay out; the set stabilises at what is actually in play, bounded by interaction volume rather than by elapsed time. **If that holds, AH-6 shrinks from an open mechanism to an optimization** and room-empties survives only as a bulk-clear shortcut.

**What would falsify it.** A tavern where fifty objects are all genuinely, continuously salient --- at which point the bound is real but too large, and something must give that is not decay. **Also check the mirror failure:** a hub busy enough that a referent a player is *mid-sentence about* decays under traffic from other conversations. That is A1's violation arriving by a different route, and it is the reason oldest-first degradation is already marked suspect.

*Annotation:* demotion --- **AH-6**, AH-4 --- endpoint-only suffices *(if decay carries it)* --- **a referent from an hour ago still binds versus the room forgets things while they are still being discussed.**

**Not yet worked.**

### A10: The book on the table, and the books on the shelf

**Setup.** A room holds a table and a bookshelf. **One book lies on the table; several more stand on the shelf.** Players look at the table. They then type a command referencing `book`.

**What it discriminates.** **Whether attention is permitted to suppress an ambiguity check that has a real basis.** The referent fast path today would find several plausible `book` candidates, compute a joint relevance for each, and abstain when the top two sit within `T_MARGIN` --- handing the command to the slow path, which is the **correct** outcome given the evidence it has. Attention would break that tie in favour of the book on the table. **The question is whether it is entitled to.**

**Both directions are defensible, which is what makes it corpus rather than a bug report:**

- **Attention gates.** The reference resolves immediately to the book they were just looking at. This is almost certainly what the player meant, it is fast, and it is exactly the intent-tracking `ludicCache` exists to provide.
- **Attention does not gate.** The system asks which book, because *several books* is a genuine fact about the room and the player never said which. **Attention did not make the other books stop existing.**

**Why this case outranks its size, and it is a [clause 4](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses) problem rather than a tuning problem.** The plan's degradation guarantee is that an error in the attention record costs **slow**, never **wrong**. **A tie broken by attention violates that directly:** if the player meant a shelf book --- visible, referrable, never handled --- the system does not fall through to a slower path. It resolves **confidently, silently, and wrongly, fast.** That is the one failure mode the design declares non-negotiable, and attention near the accept/abstain gate is the first mechanism proposed that can produce it.

**The trap is that filtering does not escape it either.** Narrowing the candidate pool by attention *before* scoring removes the very competitor whose presence would have fired the margin gate. **The suppression is inherent to using attention near the gate, not a property of one of the two mechanisms** --- so this case cannot be answered by choosing filter-versus-rank.

**Two escapes to grade against, rather than to assume:**

1. **Attention orders but never gates.** It ranks what the slow path is shown and is barred from influencing the margin. Clause 4 preserved exactly; the round trip is not saved, only better aimed.
2. **Attention may gate, but the narration must disclose the assumption** --- *"You pick up the book you were reading."* **This is the escape only a narrative system affords:** a wrong fast resolution that announces what it assumed is visible and correctable in the next beat, where a silent one is not. Whether *fast-wrong-and-obvious* is a genuinely different category from *fast-wrong* is the judgement this case exists to force.

**Vary it deliberately when working the case.** If the players looked at the *bookshelf* rather than the table, attention points at the ambiguous set instead of away from it --- and an attention record that promotes several siblings equally must not manufacture confidence it does not have.

*Annotation:* promotion --- **AH-3**, AH-2, and the [clause 4](AGENT.abstractionLayers.proposals.planning.md#the-five-clauses) guarantee --- endpoint-only suffices --- **the reference binds silently to the attended book versus the system asks which book, and the difference is player-visible in both directions: a saved round trip when it is right, and a wrong object handled without comment when it is not.**

**Not yet worked.**

---

## Retention-axis tally

**Empty by design.** Fill as cases are worked, one row each; **reading this column down is the direct input to AH-1**, and pre-filling it would make the corpus argue for a conclusion instead of producing one.

**Endpoint-only** = a record set of `{ address -> salience }` carries the case. **Needs path** = the case turns on how the state was reached, and something richer is required.

| Case | Endpoint-only or needs path | What forced it | Confidence |
| --- | --- | --- | --- |
| *(A1--A10 --- not yet worked)* | | | |

## Coverage gaps, recorded up front

1. **Every case is single-room.** Cross-boundary attention is untested --- see the note above the case list.
2. **No case tests a *whole* spanning rooms with different attention states in each**, which is where [C7](AGENT.abstractionLayers.corpus.planning.md#c7-ariadnes-thread)'s thread would land if brought over.
3. **No case tests attention interacting with asset re-merge**, the [play-vs-asset bifurcation](AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only). If an improvised, salient object is clobbered by a re-merge, what happens to its attention entry is undefined.
4. **No case is above human scale.** The parent corpus needed C10 to find that axis; this one has not looked.
