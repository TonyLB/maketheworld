# The non-rule cell: an oracle piece that answers with a verdict or a request

**Status (2026-11-13): steps 1 and 2 done; the baseline is batch 1, 11 of 30 graded calls right, the size cells 9 of 9. Step 3, drafts in isolation (round 1), begun, with a provisional bar for passable: draft 2, the outcomes framed by what they indicate, for the reluctance to allow (NR-P6), changed nothing (batch 2) and isn't kept; draft 3, the non-branching walk with consequences on their step (the contract amended, NR-4), moved the guards in substance (batch 3). At the batch 3 checkpoint it was kept as the base; draft 4, for and against before the finding, wasn't kept (batch 4): the weighing took, and the securing decides it. Draft 5, a tagged factor list before the finding with `cause` made optional, ran (batch 5): the tags became four headings to fill and the guards fell to 0 of 4, while `cause` optional fixed its form fault; the factor list not kept, pending the user. Step 4 can run alongside; step 5, the cell in composition, waits on step 3's exit.** The step layout is agreed ([The step layout and the two shapes](#the-step-layout-and-the-two-shapes)), and NR-1 to NR-4, NR-6 (for the baseline) and NR-7 are settled. The probe's change for NR-7 and the piece are built. Opened from the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, where the non-rule blocker was made next (user, 2026-11-13; [trail](AGENT.oracleLoop.discussion.planning.md#the-non-rule-blocker-first-the-rule-cell-later-2026-11-13)). It is renamed `nonRuleCell` here (user, 2026-11-13): under the verdict-or-request contract, `blocks` is one answer among several, and the name parallels `ruleCell`, its nearest analogue. The piece judges whether a plan can go ahead for reasons no rule names, such as stuffing a table into a teacup. It is the first oracle piece designed from the start to answer with a verdict **or** with requests typed by the imagination's asks ([trail](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12)), so the request contract is drafted here, on a new piece, and the rule cell adopts it later. **The composition probe's first two steps are built in this plan** (mine, 2026-11-13): a request's worth shows only in what comes back, so the cell's requests can't be graded without it. Its growth toward OC-30's chain may outgrow this plan; if so it gets its own.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), as an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The parent holds the subsystem map, the stages (a guess), the seam ledger and the corpus. This plan holds one episode. What it shows about a guess goes **up** to the parent's seam ledger.

## Getting Started

1. Read the parent's [Status](AGENT.oracleLoop.planning.md), its [Slice 4.5 rows](AGENT.oracleLoop.planning.md#recommended-order), the [subsystem map](AGENT.oracleLoop.planning.md#subsystem-map), [the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages) (this piece is the "fits" half of "Fits, missing") and the [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger), newest rows first.
2. Read the trail, newest first: [The corpus's loop cases as chains of hops](AGENT.oracleLoop.discussion.planning.md#the-corpuss-loop-cases-as-chains-of-hops-2026-11-13), [The non-rule cell's steps carry roles](AGENT.oracleLoop.discussion.planning.md#the-non-rule-cells-steps-carry-roles-2026-11-13), [The non-rule blocker first, the rule cell later](AGENT.oracleLoop.discussion.planning.md#the-non-rule-blocker-first-the-rule-cell-later-2026-11-13), [An oracle piece answers with a verdict or a request](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12), and [The oracle decomposes](AGENT.oracleLoop.discussion.planning.md#the-oracle-decomposes-slice-4s-exit-c-2026-11-10).
3. Read the corpus's [How a case is written](AGENT.oracleLoop.corpus.planning.md#how-a-case-is-written), then the size cases OC-3, OC-11 and OC-18, the feat OC-9, and the controls OC-1, OC-2, OC-6 and OC-20, in [the corpus](AGENT.oracleLoop.corpus.planning.md).
4. Read the rule cell's record, the nearest precedent: [`oracleLoopDrafts/ruleCell/iterations.md`](oracleLoopDrafts/ruleCell/iterations.md) and [`3.notes.md`](oracleLoopDrafts/ruleCell/3.notes.md). Then the [imagination plan](AGENT.imagination.planning.md), whose asks this piece's requests are typed by, and its IM-2, IM-3 and IM-5.
5. Read calibration's [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
6. Read the code it builds on:
   - the probe's harness, [`pieceProbe/`](../../../../../lambda/ephemera/calibration/pieceProbe/): `oraclePiece.ts` (an answered piece's single `expected` answer per cell), `pieceAnswer.ts`, `handlePieceProbe.ts` and `pieces.ts`;
   - the rule cell, [`oraclePieces/ruleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/ruleCell.ts);
   - the imagination's pieces, [`imaginationPieces/`](../../../../../lambda/ephemera/calibration/imaginationPieces/): `imaginationScene.ts`, `playByPlay.ts`, `consequences.ts`;
   - the oracle probe's cases, [`oracleCases.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/oracleCases.ts), and the fixtures (`teaTableCupOnFloor`, `tavern`) in `dataSource/positions/ludicCache/sceneFixtures/`.
7. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, no output.

## What is inherited as settled

The parent's [inherited premises](AGENT.oracleLoop.planning.md#what-is-inherited-as-settled) and the imagination plan's [inherited table](AGENT.imagination.planning.md#what-is-inherited-as-settled) hold, with their standings. Also:

| Premise or guess | Standing | What this plan can show |
| --- | --- | --- |
| **One judgment per call, with loops, filters and joins in code** (user, 2026-11-10) | Direction (user's call) | |
| **Micro is the target** | Principle (user) | |
| **The oracle's pieces pick from a closed answer set** (the two families, user, 2026-11-11) | Direction (user's call); the boundary a guess | Whether a set that holds requests with parameters is still "closed" in the sense the families test means |
| **Verdict or request** (user, 2026-11-12): a piece answers in one fenced JSON block, with a verdict from its own closed set or one or more requests typed by the imagination's asks, with parameters. A verdict is about the plan as written, so code may change the plan; a request is "can't judge yet", so code keeps the plan and asks for more. `blocks` means "void the fact, or find an alternate method" | Direction (user's call) | Whether Micro keeps the two kinds apart, and what the third kind of answer costs |
| **Sufficiency is entangled with the judgment, so they share a call** (mine, agreed 2026-11-12); structural gaps are caught in code before any call | Direction (agreed) | |
| **Fresh calls, no tool-call continuation** (user, 2026-11-12): code dispatches a request and calls the piece again fresh, perhaps with the question it asked but not its reasoning, against confirmation bias | Direction (user's call) | Whether passing the question helps (NR-5) |
| **The request vocabulary is in flux** and grows on both sides, the imagination's asks and the pieces' ability to say what would help (user, 2026-11-12) | Direction (user's call) | Which kinds this piece needs first |
| **Per-hop grading; rounds are not the signal** (user, 2026-11-12): a request is unwarranted when it asks for what the inputs establish, repeats one already answered, or comes where the corpus says judge; judging where something is missing is the mirror fault | Direction (user's call) | |
| **`impossible` is an outcome code reaches,** after a blocker and a failed Improve, not any one piece's answer (user, 2026-11-10; JF-5 doesn't hold this piece up, mine, agreed) | Direction (agreed) | |
| **The rule cell is settled on draft 3** (46 of 48), and stays so until this piece has matured the contract (user, 2026-11-13). Code asks `playByPlay` before calling it, so it never needs to ask | Observed on hand-written motions | Through the adapter (step 4): whether it holds on `playByPlay`'s real lines |
| **`playByPlay` on draft 14, `consequences` on draft 1,** both held for the judging pieces (IM-4, user, 2026-11-12): their flags' sensitivity and block shape wait for a reader's reactions | Observed for `playByPlay`'s methods on Micro; flags and form open | What this piece's reactions say about them, handed to the imagination plan |

**Future subsystems that touch this work:**
- **Missing,** the other half of the stages table's "Fits, missing" row: what the plan leaves out. Unclaimed, a call of its own.
- **Works, the verdict** (code): joins this piece's verdict with the rule cell's and Missing's.
- **Improve, the direction:** what a `blocks` from this piece hands on. The corpus's size cases expect none (a shrinking spell is the only repair).
- **The orchestration layer:** dispatches requests to the imagination, carries the intent, owns the loop's cap (IM-3).
- **The imagination's booked asks** (alternate method, mitigation, slot filler), and perhaps a new ask for a fact, such as a size (NR-3).

## The step layout and the two shapes

Agreed 2026-11-13 ([trail](AGENT.oracleLoop.discussion.planning.md#the-non-rule-cells-steps-carry-roles-2026-11-13)), before the question, since it changes NR-1 to NR-3. The design is the user's except where marked mine.

**Each step has a role:**
- **Intended:** what the player's request states, the goal or the stated method: "tea pours from [teapot1]" in OC-6, the hammering in OC-18. Replacing it is a different plan, not another way to carry it out: siphoning the tea isn't another way to pour. Read from the request's words, not the action's (mine): OC-6's request names no cup, so "into [cup1]" is the template's choice, an improvised step.
- **Improvised method:** a step the system supplies to carry out the intent, such as lifting and tilting the teapot. It can be revised, so a block here points to an alternate method.
- **Consequence:** what follows from the steps, such as the saucer sliding off the tipped table. Also improvised, but it can't be sidestepped by changing the method's details, so a block here points to a mitigation.

**Routing is code's.** A failure is blamed on one step, and that step's role picks what follows:
- intended: `blocks`, toward the floor, as in the size cases;
- improvised method: the alternate-method ask;
- consequence: the mitigation ask.

A `needs detail` of the action is routed by role as well (mine, 2026-11-13, from OC-31): on an improvised step it goes to `playByPlay`, and on an intended step to the player, since the method is the player's (JF-19).

The blame goes to the cause, not to the step that fails (mine): a pour into a cup that slid off fails at the intended step, and its cause is the consequence. This gives the method dial's line between elaborating and substituting (JF-16) a step-level form: an alternate method revises an improvised step, while replacing an intended one substitutes.

**The state is the steps.**
- The in-between states are text in the fiction's register, not the world schema. The schema can't hold a tilt or a broken cup, and recording every transitional state in it would cost orders of magnitude more than the rest of the loop. Cost is also what keeps us from defining a deterministic frame for every phenomenon. The text is lossy, and the next judging piece is its only check (mine).
- Text states have no natural aggregator, so the state before step N is steps 1 to N−1 themselves.
- What a step leaves is implied by the step, so there are no separate result lines. The knock-ons are steps, with the consequence role. **Amended for draft 3** (user, 2026-11-13; NR-L6): the knock-ons are consequence lines under the step that causes them, each quotable, so a step and what it causes are judged as one.
- No relevance filter. Deciding which consequences matter to a later step is the judgment itself, so a filter would cost more than it saves and isn't needed in its own right.

**The inputs:** the scene, the player's request, and every step in order with its role.

**Two shapes for one judgment** (NR-8):
1. **One pass,** drafted first and hoped for: one call over the whole sequence.
2. **Per step,** the fallback: one call per step N, independent of the others and so parallel. It sees:
   - the scene;
   - steps 1 to N−1, to take in as context ("imagine the state as of the end of them");
   - step N, in focus;
   - steps N+1 to the end.

   It judges whether step N blocks itself on the face of it. If it doesn't, it judges, bearing step N in mind, whether step N makes any later step impossible: a causal block at step N, perhaps detected at step N+3. Looking forward puts the blame on the call's own step. Looking back has to find which earlier line is to blame, which the one prompt failed at (PR-14).
   - Mine: the calls overlap, since step N+k's own call judges it against the state the earlier steps leave. Code joins them: a failure an earlier call claims belongs to that step, and one no earlier call claims belongs to the step itself. That also covers a step blocked by two earlier steps together.
   - Mine: if the two questions leak into each other, as questions in sequence did under one prompt (PR-9, PR-11), they split into two calls per step, which still run in parallel.

**What the piece answers** (NR-2, NR-3; user, 2026-11-13). Each step's judgment has three outcomes:
- **`blocks`:** with the step quoted and a reason;
- **doesn't block;**
- **can't tell:** the step doesn't give enough to judge, and the piece says how. So far there are two ways: more detail of the action, which goes to `playByPlay`, or more detail of its consequences, which goes to `consequences`. Each carries the step quoted and what is missing.

The answer for the whole plan is the first step, in order, whose outcome isn't "doesn't block" (user). If there is none, the plan `allows`.
- **The step is quoted, not numbered.** A quote gives the reasoning an official place to go, such as "the cup being askance on the floor prevents tea from being poured into it". Without one, the reasoning would be wedged into some other shape.
- **The reason is the brief for what follows.** For an improvised method it goes to the alternate-method ask, for a consequence to the mitigation ask, and the prompt asks for it in that form. For an intended step, it is the floor's sentence, as in the size cases.
- Mine: the first step that blocks or can't be told stops the scan, since a can't-tell at step N leaves the state after it unknown, and the later steps depend on that state.
- Mine: so a reply carries one request, not "one or more" as the verdict-or-request direction allows. More than one would put a loop back inside the prompt.

The alternate method and the mitigation are not the piece's answers, since code reaches them from the blamed step's role. A fact, such as a size, isn't among the requests so far: the size cases expect common sense to settle it.

**Open:**
- ~~whether the roles are shown~~: shown, as the settled question has them (NR-6);
- who assigns the roles in composition. The ask that produced a line doesn't settle it: `playByPlay` repeats the goal in its lines (tea2 "flows into cup1"). That is the composition probe's question; step 2's cells are written by hand, roles included.
- a consequence step that can't happen ("the cup flies to the ceiling") is the imagination's mistake, not the plan's failure, and routing by cause would wrongly send it to a mitigation (mine, 2026-11-13). Rare; a note, not designed for.

## Draft 3's proposal: the non-branching walk, with consequences on their step

**Accepted by the user, 2026-11-13; built the same day** (the piece, its tests, [`3.txt`](oracleLoopDrafts/nonRuleCell/3.txt) and [`3.notes.md`](oracleLoopDrafts/nonRuleCell/3.notes.md)). The two changes are the user's (NR-L5, NR-L6); the shapes, names and defaults below are mine unless marked. It amends NR-4 and the step layout once accepted. Draft 3 is a contract change as well as a prompt change, so it departs from "one change per draft" the way the imagination's draft 11 did: it is a new baseline for the walk, with draft 1's wording carried over wherever the contract doesn't touch it.

**Consequences are input, not output.** The cell is never asked to produce consequences. It reads them, placed under the step that causes them. `consequences` needs no change for this: its block already gives one entry per action, mapping each described thing to a line, so its output is already grouped by step. In composition the adapter puts those lines under the action they came from. `consequences` gives a line for every listed thing, including things that stay put, and under the settled "no relevance filter" all of them go in. In step 2's cells the lines are written by hand.

**The inputs and render (NR-L6):**
- A step is `{ says, role: 'intended' | 'method', consequences?: string[] }`. `consequence` stops being a step's role and becomes the role of a line under a step. Any step can carry consequence lines, an intended one included (a pour can spill).
- The render nests the lines under their step, each with its own role label, so each can be quoted:
  ```
  The steps, in order:
  - (method) tip [table1]
    - (consequence) [saucer1] and [cup1] slide off [table1] onto the floor
  - (intended) [teapot1] pours [tea2] into [cup1]
  ```
- A step with no lines renders as it does now, so every cell but h7 keeps its inputs hash, and the deploy check still covers them.
- **h7** becomes two steps, the tip carrying the slide as a line, and its expected answer becomes `blocks 2/1c1`. h5 (the tip with no lines) still expects `needs detail of consequences 1`, which now reads as "the step that tips a laden table states nothing of what it does to what is on it".
- Open, not for draft 3: whether a step with no lines should say so ("no consequences given") so the cell can tell "none" from "not asked". In composition, code knows whether `consequences` was asked. Left out of draft 3 to keep the change to the layout.

**The reply (NR-L5):** the prose walk stays first (the rule cell's settled describe-then-JSON form), now going through every step, and the block holds one entry per step, in order:
```json
{"steps": [
  {"step": "<the step, quoted>", "finding": "works", "establishes": "<what is now true>"},
  {"step": "<the step, quoted>", "finding": "blocked", "cause": "<the step or consequence line to blame, quoted>", "reason": "<what keeps it from happening>", "establishes": "<what would be true if it happened anyway>"},
  {"step": "<the step, quoted>", "finding": "needs detail", "of": "action" | "consequences", "missing": "<what should be available>", "establishes": "<what is certain from the step as written>"}
]}
```
- **`establishes` on every finding,** so each of the three outcomes has a structured endpoint, and "works" can't be written as an absence. On a one-step cell it is the only place success goes. For "blocked" it is the user's "So now the table is inside the teacup".
- **Each entry quotes its step** (mine), though positions alone would do. A skipped or merged step then shows as a quote that doesn't match, not as silently shifted entries, and the quote keeps its job as the reasoning's place to go.
- **`cause` can quote a consequence line** as well as a step, at or before the blocked step.
- **The finding words** are draft 2's framing ("works", "blocked", "needs detail"). Draft 2's wording of what each one indicates is carried into draft 3, since it was adopted in form and cost nothing on the size cells.
- **No stop.** "Stop at the first step whose finding isn't that it works" goes. The walk ends when the steps do.

**The grade:**
- The block needs a `steps` array with one entry per step. Entry *i*'s quote must match step *i* (a whole match, or a word-boundary partial inside that step only). A wrong count, an out-of-order quote or a quote that matches nothing is malformed.
- Each finding has its own fields as non-empty strings, `establishes` on all three, and no fields from another finding; unknown fields are ignored, as now.
- `cause` is matched against the steps and their lines, giving `N` for a step and `NcK` for line K under step N. A cause after the blocked step is malformed.
- **Code applies the first-non-works rule** (the user's "joins in code"). The canonical answer is unchanged: `allows`, `blocks <step>/<cause>`, or `needs detail of <of> <step>`, with the cause now possibly `NcK`. So batch 3's tally reads against batches 1 and 2 on every cell but h7.
- The findings after the first non-works don't move the grade. They are read by hand: whether the walk carries on, and whether the state is carried forward (NR-P5).

**The open question, what a needs-detail step leaves** (recommendation mine). Its `establishes` gives what is certain from the step as written ("the table is tipped; what happens to the saucer and cup isn't stated"), and the later steps are judged against that, which may give them a needs-detail of their own. Since code takes the first non-works, this doesn't change the graded answer in isolation. It matters in composition, if a needs-detail later in the walk is ever dispatched alongside the first one. That is a step 5 question, so draft 3 doesn't settle it.

**The cap** (mine): every step now gets an entry beside its prose, so a three-step reply is longer. The piece sets `maxTokens: 1024`, as both imagination asks do, and the rubric counts replies cut off.

**What changes, if accepted:**
- `nonRuleCell.ts`: the step type, the render, matching over steps and lines, the grade, h7's cell, and its tests;
- `3.txt`, from draft 1 with the walk and the block replaced and draft 2's outcome wording carried over, and `3.notes.md` with the rubric, both for review before the batch;
- here: NR-4's row and the step layout amended; step 3's draft 3 items ticked as they land;
- calibration `AGENT.md`'s non-rule cell paragraph.

## Draft 5's proposal: a tagged factor list, with `cause` made optional

**Accepted by the user, 2026-11-13; built the same day** (the grade change and its tests, [`5.txt`](oracleLoopDrafts/nonRuleCell/5.txt) and [`5.notes.md`](oracleLoopDrafts/nonRuleCell/5.notes.md)). The factor list and its four tags are the user's (NR-L8). `cause` made optional is mine (NR-L9). The labels, the wording and the defaults below are mine unless marked. Built from draft 3, since draft 4 wasn't kept. It makes two changes, an agreed exception to one change per draft, since each shows in its own measure: the substance on the guards and the hops, and the form in the malformed count.

**The factor list (NR-L8).** Draft 3's findings, its "every step leaves a state" paragraph, and its other sections stay word for word, the securing sentence included (the securing is held). Ahead of the walk comes this new paragraph:

> Before giving a step its finding, list the factors that bear on how well it would go. A factor can be something the scene, the steps before it, or the step itself states, or something the step depends on that none of them states. Mark each one with a tag:
> - For: it is stated, and it helps the step happen.
> - Against: it is stated, and it hinders the step.
> - Effect unclear: it is stated, and how it bears on the step is unclear.
> - Not given: the step depends on it, and nothing given states it.
>
> List as many as bear on the step, under whichever tags fit. Then weigh them to give the finding.

- **Two kinds of factor** (the user's catch, 2026-11-13). An earlier wording framed every factor as a "fact from" the scene, the earlier steps or the step. That left Not given with no source, since it is exactly what none of them states. A thing the step needs but nobody mentions would have been excluded by the lead-in. The lead-in now names both kinds, and each tag says which kind it takes: three are stated, and Not given is the unstated one. Not given is moved last so the three stated tags sit together.

- **No quota per tag** ("under whichever tags fit"). Draft 4 failed by asking for both sides, so the model filled the "for" side with filler and searched for an "against". Here a step can list only For factors.
- **No tag is mapped to a finding** (mine). I first drafted Not given → `of: action` and Effect unclear → `of: consequences`. h5 breaks that mapping: the tip's effect on the saucer and cup is Not given, yet the right ask is `consequences`. So the prompt leaves the weighing to the model, and the rubric reads which tags lead to which findings.
- **The walk's sentence becomes:** "First, take every step in order, through to the last. For each, say in one sentence what it does in the state left by the steps before it, list its factors, then give its finding and the state it leaves." This puts the factors after the description and before the finding, in the prose as well as in the block. If the prose gives the finding first, a slot in the block can't undo it.

**The block.** Each entry gains `"factors"`, a list of strings of the form `"<factor in a few words>: <tag>"`, between `step` and `finding`:
```json
{"steps": [
  {"step": "<the step, quoted>", "factors": ["[cup1] is far smaller than [table1]: Against"], "finding": "blocked", "reason": "…", "establishes": "…"}
]}
```
- **The factor first, its tag after** (the user's question; mine to recommend, 2026-11-13). This is the draft's verdict-first worry at the scale of one factor. With the tag first, the model commits to a side and then writes a fact to fit it, as draft 4's buckets did. With the tag last, it states the fact and then judges how it bears. The prose list uses the same order (a fact, then its tag). For `jq`, the tag is whatever follows the last colon. Held as an alternative: `{"factor": …, "tag": …}` objects, in that key order. They are cleaner to read but cost more tokens, and plain strings come first.
- The lead-in says the block holds "the same factors, a few words each", and that it is **a single** JSON code block, with "single" in place of draft 3's "a". This is aimed at draft 4's per-step blocks, which didn't parse.
- **The grade ignores `factors`** (an unknown field, as now). It is read by hand with `jq`: the tags per cell, and which tags precede which findings. Mine: no form check on it, since a malformed factor list shouldn't hide an answer, which is the trap NR-P7 fell into.

**`cause` made optional (NR-L9).** The blocked shape loses `cause`, and a sentence after it adds it back on condition:
> - {"step": "<the step, quoted>", "factors": [...], "finding": "blocked", "reason": "<…>", "establishes": "<…>"}. Add "cause": "<the earlier step or consequence line to blame, quoted>" when the trouble comes from an earlier step or from a consequence line.
- **The grade:** `cause` absent means the blocked step itself (`blocks N/N`). When present it is matched as now. It may quote the step itself, an earlier step, or a line at or before the step. **A `cause` that quotes nothing given is read as the step itself** (the user, 2026-11-13: see whether that gives coherent results before tuning the wording further). NR-P7 is then counted by hand: a `cause` present on a self-blamed step. A quote of several things, or of something after the step, is still malformed.
- **The other findings are unchanged.** `of` and `missing` stay required. The two batch 4 replies with no `of` were inside per-step blocks, which the "single" change aims at.

**The cap** (mine): `maxTokens` goes from 1024 to 1536. The factors appear in the prose and again in the block, and draft 4's one cut-off reply was a three-step cell with the same doubling. The cap is a setting on the piece, not the prompt, so it changes no hash. The rubric counts cut-off replies and reply lengths.

**Held as a fallback, not in draft 5** (mine): factors in the block only, with the prose cut to the description, finding and state. Reach for it if the doubling brings back draft 4's form failures. It would undo the factor-first order in the prose, so it is not the first try.

**How it is probed:** one payload, all 11 cells, `repeats: 1` (11 calls), as the probing defaults have it. Results are saved to a scratchpad file whose full path I give with the payload's. Cells that draft 5 seems to fix get `repeats: 3` in a confirming payload.

**The rubric outline** (written in full in `5.notes.md` before the batch):
- **The guards and h10:** count of `allows`. Read the glue and the chain by tag: Against (as in draft 4), Effect unclear (OC-1 may then ask for consequences, which may be composition-shaped; read it, don't re-expect it), or For or absent.
- **The size cells hold:** OC-11, OC-18 and OC-3 `blocks 1/1`, with the size tagged Against.
- **The hops:** whether the tip is still "not feasible" (NR-P3); whether h5's missing slide is tagged Not given or Effect unclear and leads to `needs detail of consequences`; whether h7's pour blames `1c1`.
- **Filler:** For factors that restate the step ("the player can reach it"), and lists padded to fill all four tags.
- **Invented Not given factors** (the user's, 2026-11-13): Not given factors that a plain reading of the step doesn't need ("whether the player is strong enough", "whether the cup is clean"). Naming unstated factors may invite NR-P2's preconditions back under a new tag. Counted per cell, and read against which ones push a finding to `needs detail`. The balance between eliciting the real gaps and inventing new ones is expected to take more than one draft.
- **Tag form:** factors whose tag is missing, misplaced (put first), or not one of the four.
- **Order:** does the prose give a finding before the step's factors?
- **OC-9:** what its factors call the trestle's weight ("difficult" under Against or Not given), as evidence for the skill-or-chance finding.
- **Form:** NR-P7's count (a `cause` present on a self-blamed step, and whether it matched); parse failures; cut-off replies; reply lengths against batches 3 and 4.

**What changes, if accepted:**
- `nonRuleCell.ts`: `cause` made optional in the blocked fields and in `readEntry`, `maxTokens: 1536`, the doc comment; tests for an absent `cause`, a self-quoting `cause`, and an unmatched one, plus a probe-run test asserting 1536;
- `5.txt` from `3.txt`, and `5.notes.md` with the full rubric, both for review before the batch; NR-L8 and NR-L9 marked as being run;
- here: NR-4's row amended (`cause` optional); step 3's draft 5 item ticked as each part lands;
- calibration `AGENT.md`'s non-rule cell paragraph (optional `cause`, the 1536 cap, `factors` read by hand).

## The considerations proposal: what to consider, generated on its own

**Accepted by the user, 2026-11-13, with free text; built the same day** (the piece and its tests, [`1.txt`](oracleLoopDrafts/stepConsiderations/1.txt) and [`1.notes.md`](oracleLoopDrafts/stepConsiderations/1.notes.md)). The register and the split are the user's (2026-11-13): before any finding, get out into the open what should be considered for each step. For now, generate only that, and see whether the set looks right. Later, judge the assembled set in its own pass, probably against draft 4's categories, which became hunting targets when asked for up front. The shapes, names and defaults below are mine unless marked.

**Why on its own.** Drafts 4 and 5 put the reasoning in front of the finding, inside the same call. Each time the finding's categories leaked into the reasoning: draft 4 hunted for an "against", and draft 5 filled four tag headings (NR-P9). With no finding to give, nothing downstream pulls the list toward a verdict. That is the oracle's one-judgment-per-call rule applied inside this piece. Generating considerations is one job; judging them is a later one.

**A read piece, not a new draft of the cell.** The output has no answer, so it can't be graded as `nonRuleCell` is. Following the house rule that generators are graded by hand, it is a read piece:
- **The name:** `stepConsiderations`, in `oraclePieces/`.
- **The inputs and render** are `nonRuleCell`'s, reused, as are the 11 cells. The inputs hashes then match batches 1 to 5, and the deploy check carries over.
- **The `check`** covers form only. The block parses and holds `steps`, with one entry per step in order, each quoting its own step (`matchQuote`, as now). Each entry's `considering` is a non-empty list of non-empty strings.
- **`lookFor`, per cell,** is what a good set considers, written before the batch, as the rubric.
- **`maxTokens`** is 1024: there's one list per step, and no finding or `establishes`.
- **Its drafts** go in `oracleLoopDrafts/stepConsiderations/`, numbered from 1, with their own `iterations.md`. The prompt is built from `nonRuleCell`'s draft 3, keeping Role, Reading the scene and Reading the steps (the securing sentence included).

**The task, as drafted** (wording mine):
> Task: For each step, in order, list what someone judging whether it can happen as written should be considering: the things it touches, what they are like, where they are, and what the steps before it have left. Each item is a few words, naming things by their handles. First go through the steps in prose, then end with a single JSON code block, fenced with ```json, holding one object whose "steps" is a list with one entry for each step, in order: {"step": "<the step, quoted>", "considering": ["<item>", ...]}.

- **No categories, no tags, no count.** The list is one plain list, so there is nothing to fill.
- **Free text, not quotes** (mine; the user's call, 2026-11-13: free text, since there are many tuning steps before the output has to be matched against an earlier stage). Quoting only the given lines would rule out invention ("player's strength"), but it would also rule out the gaps we want named. h5's tip needs "what tipping does to [saucer1] and [cup1]", and no line states that. Free text allows both, so the rubric counts the invented items. A quote-only list stays a later variant if invention dominates.
- **"Things it touches, what they are like, where they are, what the earlier steps left"** points at the scene and the walk, not at the player. That aims the list away from batch 5's player-ability items without a "do not". It is still a list of kinds, so the rubric watches whether those four become headings (NR-P9).

**Probing:** one payload, 11 cells, `repeats: 1`, 11 calls, with the results saved to a file.

**The rubric outline** (in full in the draft's notes before the batch):
- **Per cell, against its `lookFor`:**
  - the size on OC-11, OC-18 and OC-3;
  - the glue and what it binds on OC-1, OC-2, OC-6 and the hops;
  - the chain on OC-20;
  - the saucer and cup on the table when it tips (h5, h7's line);
  - the cup's place after the tip (h7's pour);
  - the cup carried with the saucer (h10);
  - the trestle's weight (OC-9).
- **Invented items:** the player's ability or strength, weights, the glue's nature, technique.
- **Verdicts leaking in:** items that judge ("impossible", "difficult", "prevents").
- **Headings:** do the four kinds in the task become sections, filled each time?
- **The walk:** do later steps' lists use what earlier steps left?
- **Length and form:** items per step, check failures, cut-off replies.

**What changes, if accepted:**
- `stepConsiderations.ts` and its tests (render reuse, `check`, cells with `lookFor`), registered, plus a line in `pieces.test.ts`;
- `stepConsiderations/1.txt`, `1.notes.md` and `iterations.md`, for review before the batch;
- here: a step 3 item, and the judging pass booked after it;
- calibration `AGENT.md`'s Piece probe section: a `stepConsiderations` paragraph.

## The trial proposal: argue against, rebut, judge

**For review; not built.** The triad is the user's (2026-11-14): one prompt makes the single best case that the plan can't happen, a second rebuts it, and a third judges which argued better. The user's reasoning is to lean into Micro's bias, not mitigate it: concise biased answers of 200 to 400 tokens may beat unguided ones of 1500 or more. The names, shapes, staging and defaults below are mine unless marked.

**Why lean in** (the evidence, mine). Every draft that kept judgment out of the reasoning got the bias back in whatever slot it offered:
- the non-rule cell's draft 4 "against" hunted;
- its draft 5 tags were all filled (NR-P9);
- `stepConsiderations` reached verdicts in its prose in batch 1 (SC-P3);
- and inside its items in batch 2.

Micro pursues the job it is given relentlessly (the user's observation). The triad gives the bias a job, then gives the opposite bias a job, and leaves the choice to a third call. Each call is one judgment, as the oracle's decomposition has it. Choosing between two short concrete arguments is a smaller judgment than open weighing, the bet that debate and critique-then-judge setups rest on.

**The three pieces,** in `oraclePieces/`, each with one job:
1. **`trialAgainst`, the case against** (a read piece). It takes the non-rule cell's inputs and render, reused, so the inputs hashes match. It gives its single best argument that the whole plan can't happen as written. The reply is brief prose, then `{"step": "<the step it turns on, quoted>", "argument": "<in one or two sentences>"}`. The quote is kept (mine) for routing later, and checked as the non-rule cell checks it.
2. **`trialRebuttal`, the rebuttal** (a read piece). It takes the same inputs plus one argument, and rebuts it concisely: `{"kind": "invented" | "not established" | "wrong", "rebuttal": "<in one or two sentences>"}`. The three kinds are the user's examples: the concern is invented, it assumes details that aren't established, or it is plainly wrong. Mine: `kind` is a single choice, like a finding, not a set of buckets. It is kept because "not established" is the likeliest route to `needs detail`. It gives no option to concede (the user's design: the judge decides).
3. **`trialVerdict`, the judgment** (an answered piece). It takes the same inputs plus the argument and the rebuttal, and answers which is the better argument: `{"answer": "argument" | "rebuttal"}`, after brief prose. Code grades it against each pair's expected answer.

**The order in each prompt** (mine): the scene, the request and the steps first, then the argument (and the rebuttal), then the task. Each prompt reads the scene before the text it answers. This is the first lever against anchoring (below).

**The caps** (mine): `maxTokens` 400 for each, against the non-rule cell's 1536.

**The prompts' shared sections:** Reading the scene and Reading the steps, word for word from the non-rule cell's draft 3, with the securing sentence. Each Role and Task is new and short.

**The risks, in order** (the user's correction, 2026-11-14: Micro pursues the bias it is given, so a defender told to refute will refute; concession is not a headline risk):
1. **Over-refuting.** The rebuttal will argue even against the size ("tables can be small"). The judge must see through it. The size cells test this.
2. **Anchoring to the nearest text.** Micro copies the nearest text in place of an answer (the play-by-play's PR-10 and L-29). The argument is the rebuttal's nearest text, so the rebuttal may dispute the argument's **weight** within its framing ("the glue isn't strong enough to stop the lift") rather than its **premise** ("the glue means the teapot comes up with the table"). The judge would then choose between two arguments sharing the misreading. The first check is premise or weight, in the rebuttal batch. The levers, if needed: the scene first (already the order), or the task worded as "what the argument gets wrong about the scene".
3. **The judge is the model we have struggled with,** on a smaller question.
4. **Requests.** The triad gives possible or impossible. How its outcomes map to the verdict-or-request set (`needs detail` and its `of`; the step and `cause`) is open, and not for the prototype. "Not established" winning is the obvious candidate for `needs detail`.

**Staged, one piece at a time, in the chain's order** (mine), as the drafts-in-isolation habit has it:
1. **Build `trialAgainst` only,** with its draft 1 and rubric, and run it on the 11 cells, `repeats: 1`. Read: on the size cells, is the best argument the size? On the guards and hops, which argument does it pick (the glue, the chain, the slide, something invented), and is it concise?
2. **Then `trialRebuttal`,** with its cells lifted by hand from the first batch's arguments (each cell's `source` naming the batch and reply). It is designed after reading them, since its inputs are their outputs. Read: premise or weight; over-refuting on the size; which `kind`.
3. **Then `trialVerdict`,** on the lifted pairs. Each pair's expected answer is written by hand before its batch: the argument on the size cells and h7; the rebuttal on the guards and h10; for h5, whichever the pair's contents warrant. OC-9 is ungraded.

Chaining the three in code belongs with the composition probe (step 4) once each works alone.

**Where it sits.** It is a prototype inside step 3, beside the non-rule cell (draft 3 with `cause` optional is its base) and `stepConsiderations` (paused at draft 2, its base). If the triad works where the single cell hasn't, that is step 3's exit (c), a new approach for the piece, with a seam-ledger entry. That is the user's call when the evidence is in. `stepConsiderations` may yet feed it: a list of considerations is a possible input for the rebuttal or the judge.

**The drafts:** `oracleLoopDrafts/trial/`, one folder for the three pieces, since they are tuned together. Files are named by piece and number (`against.1.txt`, `against.1.notes.md`, and so on), with one `iterations.md` (`TR-Pn`, `TR-Ln`).

**What changes, if accepted (stage 1 only):**
- `trialAgainst.ts` and its tests (render reuse, the check, cells with `lookFor`), registered, plus a line in `pieces.test.ts`;
- `trial/against.1.txt`, `against.1.notes.md` and `iterations.md`, for review before the batch;
- here: a step 3 item, ticked as the parts land;
- calibration `AGENT.md`: a paragraph on the trial pieces.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [X] **The design pass** (text only, reviewed by the user before any code). **Rests on** the verdict-or-request direction and the stages table's "fits". **Consumer:** step 2's registration and draft 1.
   - [X] **The step layout, first** (user, 2026-11-13): each step's role, the state as the steps themselves, routing by the blamed step's role, and the one-pass and per-step shapes ([The step layout and the two shapes](#the-step-layout-and-the-two-shapes)). It comes before the question because it changes NR-1 to NR-3.
   - [X] **The question** (NR-1; settled by the user, 2026-11-13): what the piece judges, in one sentence. Mine, redrafted around the step layout, accepted: given the scene, what the player asked for, and the steps in order with their roles, can each step happen as written, setting the rules aside? If one can't, which step is to blame?
   - [X] **The verdict set** (NR-2; settled by the user, 2026-11-13): each step's outcome is `blocks`, doesn't block or can't tell; the step is quoted; the reason is the brief for the next ask; the first step in order whose outcome isn't "doesn't block" is the answer ([What the piece answers](#the-step-layout-and-the-two-shapes)).
   - [X] **The first request kinds and their parameters** (NR-3; the user, 2026-11-13): can't tell, by more detail of the action (`playByPlay`) or of its consequences (`consequences`), each with the step quoted and what is missing. A fact, such as a size, is not among them so far. The alternate method and the mitigation are code's, from a role.
   - [X] **The reply's form** (NR-4): one fenced JSON block holding a verdict or a request. Mine, 2026-11-13, accepted by the user the same day:
     - **Describe first, then the block,** the rule cell's settled form (RC-L5, RC-L6). Deciding in the first clause cost the rule cell 10 of 24 (RC-P2). The prose takes the steps in order and says what each does in the state the earlier steps leave, stopping at the first step that blocks or can't be told. That walk is where the reasoning goes before it is quoted.
     - **The block,** one of three shapes, keyed `answer` as the rule cell's, so the grade and Works read both alike:
       - `{"answer": "allows"}`;
       - `{"answer": "blocks", "step": "<the step that can't happen, quoted>", "cause": "<the step to blame, quoted; may be the same>", "reason": "<what stops it>"}`. Code routes by `cause`, and the reason may explain it by reference to `step` (user, 2026-11-13, from OC-30/h7, where the pour fails and the slide is to blame);
       - `{"answer": "needs detail", "of": "action" | "consequences", "step": "<the step, quoted>", "missing": "<what would let it be judged>"}`.

       Only the step that stops the scan appears. The steps that don't block are in the prose, not the block. The names (`needs detail`, `of`, `missing`) are a draft lever, not a contract.
     - **Code's check:** the block parses; `answer` is one of the three; each answer has its fields, and no fields from the others. The quote matches exactly one step, after whitespace, case, brackets and end punctuation are normalized, and a partial quote counts when it falls inside exactly one step. Code takes the step's position and role from the match; the piece never gives a number.
     - **The grade:** `answer`, the step and `of` by code, against the cell's expected; `reason` and `missing` read by hand against a look-for (NR-7).
     - **The risk:** the walk in prose is a loop over the steps, which held for the rule cell's few lines and is untested over a longer sequence. If it doesn't hold, the per-step shape (NR-8) has no walk.
   - [X] **The inputs** (NR-6; 2026-11-13): the step layout's; the roles shown, as the settled question has them, their wording the drafts'; the player's request in its own section, as the yardstick (mine, agreed by the user); **no Rules section**, **the whole scene** and **no flagged problems** in the baseline (user).
   - [X] **The cells** (reviewed by the user, 2026-11-13), each with its expected answer (below, [Proposed cells](#proposed-cells)), with cells where asking is right and cells where it is wrong.
   - [X] **How a request is graded** (NR-7; settled by the user, 2026-11-13, as a place to start): what can be checked as a fact is checked by code (`answer`, the steps and `of`); what is written (`reason`, `missing`) is read by hand against a look-for written before the batch, as the read kind does. That fires the piece probe's revision trigger, as the play-by-play did. What the probe needs (mine, proposed for step 2; the probe today has answered pieces, tallied by code against one `expected` string, and read pieces, with a `lookFor` and no tally, and returns every reply either way):
     - **A piece's own grade:** an optional `grade(reply, cell)` on an answered piece, in place of `pieceAnswer`. The non-rule cell's runs code's check (NR-4), matches the quotes to steps, and gives a canonical answer string: `allows`, `blocks 3/2` (the step, then the cause, by position), `needs detail of consequences 1`. A failed check or a quote that matches no step, or more than one, is malformed.
     - **`expected` in the same canonical form,** so the tally, its right and wrong counts and its count of each answer, stand unchanged; a wrong step shows as a different answer string, not as malformed.
     - **An optional `lookFor` on an answered cell,** carried into the tally beside the expected answer, so the reader has it next to the replies. Code doesn't read it.
2. [X] **The piece and its baseline.** `calibration/oraclePieces/nonRuleCell.ts`, registered in `pieces.ts`, with its tests; its drafts in `oracleLoopDrafts/nonRuleCell/` (`N.txt`, `N.notes.md`, `iterations.md` with Problems, Library and Ledger), laid out as the rule cell's. The probe's change from NR-7 (a piece's own grade, `lookFor` on an answered cell), with its tests. Draft 1 run on every cell, `repeats: 3`, Micro, with a rubric written before the batch. A fresh call's cell is written by hand or lifted from a `playByPlay` batch reply, as the rule cell's were, so no composition is needed to test the second call. **Consumer:** the batch.
   - [X] **The probe's change** (NR-7; built 2026-11-13): an answered piece's optional `grade(reply, cell)` in place of `pieceAnswer`; an optional `lookFor` on an answered cell, carried into the tally; and an optional `expected`, so a cell whose answer is open is tallied, not graded, and counted in the summary's `ungraded` (mine, for OC-9). `replyJsonObject` in `pieceAnswer.ts` reads a reply's block for a piece's own grade.
   - [X] **The piece** (built 2026-11-13): [`oraclePieces/nonRuleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/nonRuleCell.ts), registered, with its tests.
     - **The render:** the whole scene with no Rules section; `The player's request:`; then `The steps, in order:`, one `- (role) step` line each, unnumbered, so a reply quotes rather than numbers.
     - **The grade:** NR-4's check, with the quote matched whole first and otherwise inside one step on word boundaries (mine: "tip" isn't inside "tipping").
     - **The cells:** as [Proposed cells](#proposed-cells), each with its canonical `expected` and a `lookFor`; OC-9 has no `expected`.
   - [X] **Draft 1 and its rubric** (mine, 2026-11-13): [`oracleLoopDrafts/nonRuleCell/1.txt`](oracleLoopDrafts/nonRuleCell/1.txt) and [`1.notes.md`](oracleLoopDrafts/nonRuleCell/1.notes.md), with [`iterations.md`](oracleLoopDrafts/nonRuleCell/iterations.md). Eleven called cells x3 is 33 calls, over the cap of 24, so batch 1 is two payloads: 1a, the eight single-step cells (24), and 1b, the three OC-30 hops (9).
   - [X] **Batch 1** (2026-11-13; [notes](oracleLoopDrafts/nonRuleCell/1.notes.md)): 11 right, 19 wrong, 0 malformed, OC-9's 3 ungraded. The size cells 9 of 9. The guards and the OC-30 hops failed on securing used as a blocker, a method step judged unwise, action detail over-asked, and the state not carried forward (NR-P1 to NR-P5).
3. [ ] **Drafts in isolation (round 1)** (the order revised by the user, 2026-11-13: two rounds of drafts were always to be expected, one to get the cell working passably alone, and one to tune it in composition; until then the first round had no named place, and so no exit to measure). One change per draft, from the baseline, in the piece probe only. **Consumer:** step 5, which this round's exit (a) or (b) gates.
   - **Exits:**
     - (a) the library has nothing left worth a draft in isolation;
     - (b) the bar for "passable in isolation" is met;
     - (c) a batch shows the piece needs a new approach (a seam-ledger entry), such as fits and the request needing separate calls after all, or the one-pass shape failing where the per-step shape would be next (NR-8);
     - (d) a checkpoint with the user every three batches. Batch 3 is the first.
   - **The bar for (b), provisional** (mine, accepted by the user as a starting point, 2026-11-13): every cell right for two batches running, except OC-30/h5 and h7 where their failure is composition-shaped, that is, where the information they lack is what composition supplies (h7's consequence as a step of its own is the clearest case). **Likely to be re-examined as evidence comes in** (user): how much can be reached in isolation isn't known until it is tried, and a bar fixed in advance is a guess, not a gate. Each checkpoint (d) looks at the bar as well as the batches.
   - [X] **Draft 2: the outcomes framed by what they indicate** (batch 2: no change, 11 of 30 again, not kept; [results](oracleLoopDrafts/nonRuleCell/2.notes.md#results-2026-11-13-batch-2)) (user's framing, 2026-11-13; [notes](oracleLoopDrafts/nonRuleCell/2.notes.md)), for NR-P6. Batch 1 showed a reluctance to allow: the stop was the only structured endpoint and drew the reply to it (user's diagnosis, refined in discussion: not token economy, since the single-step cells have no early exit). Each step's finding is that it works, is blocked, or needs detail, each stated as what it indicates. The stop and the block are unchanged.
   - [X] **Draft 3: the non-branching walk** (batch 3: in substance the guards 6 of 12 `allows` against 2, OC-6 3 of 3, every `works` an outcome; 12 malformed on `cause`; the hops 0 of 9; kept at the checkpoint, [results](oracleLoopDrafts/nonRuleCell/3.notes.md#results-2026-11-13-batch-3)) (user, 2026-11-13; [NR-L5](oracleLoopDrafts/nonRuleCell/iterations.md#library)), the structural change. **Design accepted and built** (2026-11-13): [Draft 3's proposal](#draft-3s-proposal-the-non-branching-walk-with-consequences-on-their-step); [`3.txt`](oracleLoopDrafts/nonRuleCell/3.txt) and its rubric in [`3.notes.md`](oracleLoopDrafts/nonRuleCell/3.notes.md), batch 3 run. Draft 2 was expected to fix some but not all of the bias, since the stop stays the only structured endpoint; it fixed none (batch 2).
     - A step that works gets a structured slot for what it establishes (mine, from batch 2, where every "works" finding stated an absence), so success has a structured endpoint of its own, even on a one-step cell.
     - Every step gets a result, even after an impossible one. A blocked step says what it would establish if it happened anyway ("so now the table is inside the teacup") and why it doesn't work, so later steps have a state to be judged against.
     - Code applies the first-non-pass rule, as the "joins in code" direction has it. That also fixes h7's case in batch 1, where a reply saw step 3's failure and answered with step 1's can't-tell.
     - It amends NR-4's block and the grade.
     - Open: what state a needs-detail step leaves for the steps after it.
   - [X] **With draft 3: consequences attached to their step** (built 2026-11-13, with draft 3) (user, 2026-11-13; [NR-L6](oracleLoopDrafts/nonRuleCell/iterations.md#library)), the information change.
     - Consequence lines sit under the step that causes them, each quotable on its own, in place of consequence steps. Otherwise a per-step check asks for consequences at step N that step N+1 gives. The unit of judgment is the step and what it causes, and the h5/h7 difference becomes whether the tip states its consequences.
     - It matches what `consequences` already returns, a line set per action.
     - It amends the step layout (consequence becomes a line's role, not a step's) and NR-4's canonical string (for example `blocks 2/1c1`). Of the cells, it touches only h7's data.
   - [X] **Draft 4: for and against, before the finding, with the `cause` rewording** (batch 4: the weighing took, but it finds the securing; the guards 3 of 12 in substance, OC-6 lost; `cause` 22 malformed; not kept, mine, pending the user; [results](oracleLoopDrafts/nonRuleCell/4.notes.md#batch-4-overall)) (the batch 3 checkpoint, user, 2026-11-13: draft 3 kept as the base; [NR-L7](oracleLoopDrafts/nonRuleCell/iterations.md#library); [notes](oracleLoopDrafts/nonRuleCell/4.notes.md)). Batch 3's replies give the verdict first and fit a reason to it (the user's diagnosis, RC-P2's pattern). Each step now says what in the state bears on it, for and against, before its finding, with a slot for it ahead of `finding`. Combined with NR-P7's fix as a stated exception to one change per draft, since each shows in its own measure. Built and run. The bar for (b) left as it is until draft 4 shows how much of batch 3 was form.
   - **The path forward from batch 4, in order** (agreed with the user, 2026-11-13). Draft 3 is the base, since draft 4 wasn't kept. Each item gets its design written here for review before it's built.
   - [X] **Draft 5: a tagged factor list before the finding, with `cause` made optional** (batch 5, 11 calls: the tags read as four headings, each filled (NR-P9); Not given gathered invented preconditions and decided 5 findings; the guards 0 of 4; `cause` optional worked, 0 malformed; the factor list not kept, NR-L9 kept on its own, mine, pending the user; [results](oracleLoopDrafts/nonRuleCell/5.notes.md#results-2026-11-13-batch-5)) ([NR-L8, NR-L9](oracleLoopDrafts/nonRuleCell/iterations.md#library)). **Design accepted and built** (2026-11-13): [Draft 5's proposal](#draft-5s-proposal-a-tagged-factor-list-with-cause-made-optional); [`5.txt`](oracleLoopDrafts/nonRuleCell/5.txt) and its rubric in [`5.notes.md`](oracleLoopDrafts/nonRuleCell/5.notes.md), for review before batch 5. Draft 4 showed that verdict-first is worth fixing, but "list the for and against" was read as two buckets to fill. The "for" bucket got filler, and the "against" bucket hunted out the securing.
     - **The factor list** (the user's): the factors that bear on how successful the step would be, each tagged. The tags are For, Against, Not given and Effect unclear. "Not given" is a fact the step depends on that the scene doesn't state; it points to `needs detail`, usually of the action. "Effect unclear" is a fact the scene does state, but whose effect isn't clear (the glue when the table tips); it points to `needs detail of consequences`, which goes to the ask that holds the carry model. The fourth tag is the user's; the labels are mine. Then the finding, weighed from the list.
     - **`cause` made optional, as a form fix** (mine): given only when an earlier step or a consequence line is to blame, and absent means this step. Two wordings failed (NR-P7), so this is a contract change: the grade and NR-4's row.
     - **The JSON slot:** a compact `"factors"` list of short tagged lines ahead of `finding`, read by hand. The prose stays brief, since draft 4's doubled reasoning is where its form failures came from.
     - **What to watch:** OC-1 may tag the glue "effect unclear" and ask for consequences. That is wrong against `allows`, but in composition it may be a sound move, so it may be composition-shaped. Read it, don't re-expect in advance.
   - [ ] **Next: what to consider, generated on its own** (the user's, 2026-11-13, after batch 5). **Design accepted and built** (2026-11-13): [The considerations proposal](#the-considerations-proposal-what-to-consider-generated-on-its-own); the `stepConsiderations` read piece, [`1.txt`](oracleLoopDrafts/stepConsiderations/1.txt) and its rubric in [`1.notes.md`](oracleLoopDrafts/stepConsiderations/1.notes.md), batch 1 run ([results](oracleLoopDrafts/stepConsiderations/1.notes.md#results-2026-11-13-batch-1): an inventory, not what bears; the size absent on the size cells; the player's ability kept out); drafts tracked in [its own `iterations.md`](oracleLoopDrafts/stepConsiderations/iterations.md). A read piece lists, per step, what should be considered, with no finding. Judging the assembled list, probably against draft 4's categories, is a later pass, booked once the list looks right.
   - [ ] **Next: the trial, argue against, rebut, judge** (the user's, 2026-11-14, after `stepConsiderations` batch 2). Design for review: [The trial proposal](#the-trial-proposal-argue-against-rebut-judge). Three small biased calls in place of one balanced one, built and probed one piece at a time. `stepConsiderations` is paused at draft 2, its base.
   - [ ] **Then: the skill-or-chance finding** (the booked item below), as a contract change of its own: a fourth finding that code can tell apart. Draft 5's "difficult" factors show how much it's needed. Batches 3 and 4 had "difficult" under "blocked" in at least six replies, and OC-9 asking for "the player's capability".
   - [ ] **Then: intended consequences** (the user's, 2026-11-13; [NR-L10](oracleLoopDrafts/nonRuleCell/iterations.md#library)). A line under a step can be something the method relies on (intended: "[teapot1] tilts with [table1]"), not only a side effect. A failure of an intended line routes toward an alternate method, as a method step's does; a side effect routes toward a mitigation. It is designed here first as a step-layout amendment, since it changes the OC-30 cells' inputs and who writes such lines in composition (the imagination plan's question). It then becomes a draft.
   - **Held: the securing (batch 4's main failure).** The glue or chain read as holding a thing still decides OC-1, OC-6, OC-20 and every OC-30 pour. Option (a) is the rules' consequence in the scene (below); option (b) is the securing left out of what this piece sees. Mine: (a), since the pours need the teapot to move with the table. It is held until draft 5 shows whether "effect unclear" catches the glue by itself, and intended consequences cover the pours.
   - **A candidate, not booked: the rules' consequence in the scene** (mine, from batch 2; it revisits NR-6, the user's call). OC-1's replies read glue as stopping the pair from moving, not as moving them together, and h10's as a teapot that "would fall off or break". The piece has the fact ("glued to") and not its consequence ("moves with what it is secured to"), which the imagination's `rules: 'consequence'` wording gives. To be weighed after draft 3, whose `establishes` slot may show the misreading in its own words.
   - **Booked, next after draft 5 (above): a skill-or-chance outcome** (user, 2026-11-13). Sometimes "I don't know whether that's possible" isn't answered by more detail of the situation: the attempt may or may not work out, depending on the character's skill and on chance. That is a separate exit from the loop, not a request to the imagination. It may take tuning to get it answered without contradicting the instructions that look for a plain physical impossibility as written. This is the parent's JF-2 (`challenging`, "possible, and hard") in this piece's per-step form, and OC-9's trestle is its cell. It is a later iteration, not a gate on this plan's exits; it may land in either round. OC-9 is excepted from the bar for (b), since it has no expected answer.
4. [ ] **The composition probe, first form: what exists** (the parent's Slice 4.5, mine, revised 2026-11-13). `playByPlay` feeding the settled rule cell through an adapter (its lines for the named things; the silence contract for a rule's other end), with code asking `playByPlay` first, on OC-1, OC-6 and OC-20. Each hop's inputs and answer are logged. **Rests on** IM-5's provisional split. **Consumer:** a batch read per hop. It tests the reading direction, and gives the harness the next step plugs into. It doesn't touch the non-rule cell, so it can run beside step 3.
5. [ ] **The cell in composition.** **Gated on** step 3's exit (a) or (b). Its requests dispatched to the imagination, the fresh call with and without the question asked (NR-5), and a round cap (IM-3). Graded per hop: each request warranted or not, each verdict against the corpus. **Consumer:** a batch on the cells where asking is right, and step 6.
6. [ ] **Drafts in composition (round 2),** one change per draft, from step 3's last kept draft, in composition and in the piece probe as each problem calls for.
   - **Exits:** (a) the library has nothing left worth a draft; (b) every cell right, in the probe and per hop, for two batches running; (c) a batch shows the piece needs a new approach (a seam-ledger entry); (d) a checkpoint with the user every three batches.
7. [ ] **Hand back to the parent:**
   - seam-ledger entries: the request contract as it stands, for the rule cell's refactor to adopt; the "fits" stage's standing; what the adapter showed about the rule cell on real lines;
   - the request kinds this piece needed, to the imagination plan (its asks, and any new one);
   - the cell's reactions to `playByPlay`'s form, to the imagination plan, where it is held for; and what the flags experiment showed, if step 5 or 6 ran it ([options](AGENT.imagination.planning.md#what-is-inherited-as-settled): ignore, show for skepticism, classify each in its own call, or use in code), or the experiment itself, to the parent, if not;
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro);
   - the composition probe's state, to the parent's composition probe item, or to its own plan;
   - the skill-or-chance outcome (steps 3 and 6), to JF-2, if no draft took it up;
   - the bar for "passable in isolation" as it ended up, and how far it moved from the provisional one, to the parent: evidence on how much a piece can reach before composition.

   Then this plan is deleted. The piece's registration, the probe and the drafts stay with the parent.

## Proposed cells

Redrafted 2026-11-13 in the step layout; reviewed by the user the same day. All mine except where the corpus gives the expected answer. Each step is quoted with its role: **I**, intended; **M**, improvised method; **C**, consequence. The steps' words are the harness's (`oracleCases.ts`) where it has them. A request where the cell expects a judgment is over-asking, and a judgment where it expects a request is under-asking.

| Cell | Fixture | Steps | Expected | Why |
| --- | --- | --- | --- | --- |
| OC-11 | `teaTableCupOnFloor` | "put [table1] in [cup1]" (I) | `blocks` that step; the size as the reason (corpus) | The size case. Asking for sizes is over-asking: common sense settles them |
| OC-18 | `teaTableCupOnFloor` | "hammer [table1] into [cup1]" (I) | `blocks` that step; the size (corpus) | A method that can't help. Asking for detail of the hammering is over-asking |
| OC-3 | `teaTable` | "put [table1] in [cup1]" (I) | `blocks` that step; the size, not the cup being on the table (corpus) | The record's reason isn't the fiction's |
| OC-1 | `teaTable` | "pick up [table1]" (I) | `allows` | The glue is the rule cell's, and reading it as a blocker is the known false refusal. Asking about the consequences for the things on the table is over-asking: the template has them travel along (corpus) |
| OC-2 | `teaTable` | "pick up [cup1]" (I) | `allows` | A guard |
| OC-20 | `teaTableChained` | "pick up [table1]" (I) | `allows` | The chain is the rule cell's |
| OC-6 | `teaTable` | "pour [tea2] from [teapot1] into [cup1]" (I) | `allows`. **Revised** from the first draft's `needs detail` | With the rules set aside, a pour from a teapot into a cup is ordinary. The missing tilt is the glue's, so it belongs to the rule cell and `playByPlay` |
| OC-30/h5 | `teaTable`, intent amended to "pour tea from [teapot1] into [cup1]" | 1. "tip [table1]" (M); 2. "[teapot1] pours [tea2] into [cup1]" (I) | `needs detail` of consequences, on step 1: what tipping does to the things on the table | **A cell where asking is right.** The cup is on the saucer on the table, so whether it is still under the spout turns on what the tip does to it, which no step says |
| OC-30/h7 | `teaTable`, intent amended | 1. "tip [table1]" (M); 2. "tipping [table1] slides [saucer1] and [cup1] off" (C); 3. "[teapot1] pours [tea2] into [cup1]" (I) | `blocks`, blamed on step 2; a reason fit to brief a mitigation | Hop 6's `consequences` answer to hop 5's request. Step 3 is the one that fails, and step 2 is the cause |
| OC-30/h10 | `teaTable`, intent amended | 1. "pick up [saucer1]" (M); 2. "tip [table1]" (M); 3. "[teapot1] pours [tea2] into [cup1]" (I) | `allows` | Hop 8's repair (user, 2026-11-09). Asking what the tip does is over-asking now, since nothing loose is left on the table |
| OC-9 | `tavern` | "pick up [table1]", a long oak trestle (I) | Open (JF-2) | The skill-or-chance outcome is booked for a later iteration (step 3 or 6). Until then, this cell shows what three outcomes do with a feat |

The three OC-30 cells are this piece's hops in the corpus's [OC-30 chain](AGENT.oracleLoop.corpus.planning.md#loop-cases) (hops 5, 7 and 10; the chain written 2026-11-13). Step 5 runs that chain in composition, and these hand-written forms test each hop alone first. **A candidate fourth cell, OC-31's turn 1**, is the first case of `needs detail` of the action: the bridge is on the far side, which no rule names. It waits on its scene being built.

**Questions the cells raise** (mine):
1. **Answered (user, 2026-11-13): no case of `needs detail` of the action, seen one case at a time.** The corpus's cases were imagined as sections of composite runs, so a piece's cell implies the hops beside it, and the corpus now writes its loop cases as chains of hops. OC-31's turn 1 is the first case of action detail.
2. **Settled (user, 2026-11-13): both are quoted, `step` and `cause`, and code routes by `cause` (NR-4).** The step that fails and the step to blame differ on OC-30/h7: step 3 can't happen, and step 2 is the cause. NR-4's block quotes one step. A walk in order reaches step 3 first, and the reasoning will naturally land there. Mine: quote both, `step` (the one that can't happen) and `cause` (the step to blame, which may be the same step), with code routing by `cause`. That gives the "askance on the floor" reasoning a natural place to go.
3. **Answered (user, 2026-11-13): the OC-30 chain's intent is amended to "pour tea from [teapot1] into [cup1]".** Supplying a request's ordinary purpose is a later question, booked as OC-30's variant, where the user's view of the best UI is to offer the physically possible purpose ("you can pour the tea onto the floor. Is that what you want?"). The question as first raised: a step can mix roles, and the intent includes its ordinary purpose. OC-6's template step is one line, though "pour from [teapot1]" is the request's and "into [cup1]" the template's. The cells above split steps so that each has one role. But I said earlier that roles come from the request's words, which would make the cup improvised and the slide only collateral: the tea still pours. The corpus treats the cup off the spout as against the intent, which means "pour tea" carries "into a cup". So the purpose is intended, and only the choice of `[cup1]` is improvised. Is that your reading?
4. **"Set the rules aside" when the scene's fiction states them.** OC-1's and OC-6's scenes say the teapot is glued, in prose as well as in the rules. Whether the piece is shown the rules is NR-6's open part. These cells are the test of whether it can set them aside either way.

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| NR-1 | The piece's question, in one sentence | Draft 1 | The user's call, step 1 | **Settled** (user, 2026-11-13): step 1's wording, mine, accepted as succinct and asking nothing it shouldn't. It states what is judged; the prompt's own wording is the drafts' |
| NR-2 | The verdict set. Mine: `allows` and `blocks`, as the rule cell's, so Works joins them alike; `blocks` with its reason and, in the one-pass shape, the step blamed. What follows a `blocks` is code's, from that step's role ([the step layout](#the-step-layout-and-the-two-shapes)) | The registration, Works | The user's call, step 1 | **Settled** (user, 2026-11-13): per step, `blocks`, doesn't block or can't tell; the step quoted, which gives the reasoning a place to go; the reason worded as the brief for the alternate-method or mitigation ask; the first non-"doesn't block" step in order is the answer, else `allows` |
| NR-3 | The first request kinds and their parameters, and whether a fact (a size) is a new imagination ask or a kind of more detail. Methods and facts are two kinds (JF-15). Narrowed by the step layout: the alternate method and the mitigation are reached by code from a role, not requested | The registration; the imagination plan's asks | Step 1, then the drafts | **First kinds settled** (user, 2026-11-13): more detail of the action (`playByPlay`) or of its consequences (`consequences`), with the step quoted and what is missing; one request per reply (mine). Open: a fact, such as a size, if a cell needs it |
| NR-4 | The reply's form: one fenced JSON block, a verdict or requests | The check | Step 1 | **Settled** (mine, accepted by the user, 2026-11-13), in step 1: describe first, then `allows`, `blocks` with the step quoted and the reason, or `needs detail` with `of`, the step quoted and what is missing; code matches the quote to one step. Amended (user, 2026-11-13): `blocks` quotes both `step` and `cause`, and code routes by `cause`. **Amended for draft 3** (user, 2026-11-13; built; [Draft 3's proposal](#draft-3s-proposal-the-non-branching-walk-with-consequences-on-their-step)): the block is `steps`, an entry per step with its finding and what it `establishes`; code applies the first-non-works rule, so the canonical answer stands, a cause on a consequence line as `NcK` **Amended for draft 5** (user, 2026-11-13; built): `cause` is optional on `blocked`; absent, or quoting nothing given, it means the blocked step itself |
| NR-5 | Whether the fresh call is told the question it asked | Step 5 | The composition probe | Open (from the trail) |
| NR-6 | What the piece sees: the scene, the actions, the intent; the imagination's lines and flags on a fresh call; the rules shown or not (PB-2's analogue: the rules are the rule cell's) | Render | Step 1, then the drafts | **Settled for the baseline** (2026-11-13). The step layout (user): the scene, the request, and every step in order with its role, with no result lines and no relevance filter. The roles shown, as NR-1 has them, worded by the drafts. The request in its own section (mine, agreed by the user). No Rules section, so the guard cells (OC-1, OC-20) test whether the piece sets aside the securing the prose states; the whole scene, since the piece's job is noticing what the steps leave out; no flagged problems, which are a bucket that lets the imagination defer, not an output later stages are expected to pick up (user). Open: who assigns the roles in composition |
| NR-7 | How the probe grades a request with parameters | The probe | Step 1 | **Settled** (user, 2026-11-13, as a place to start): `answer`, the steps and `of` by code; `reason` and `missing` by hand against a look-for. The probe's change (mine): a piece's own grade giving a canonical answer string, and `lookFor` on an answered cell. **Built** (2026-11-13), with an optional `expected` for a cell whose answer is open |
| NR-8 | One pass over the sequence, or one call per step (the fallback); and whether a per-step call splits its self-check and forward check into two calls | Draft 1 (one pass); steps 3 and 6 | The drafts | Open; one pass first (user, 2026-11-13). The booked non-branching walk (step 3, draft 3) is the one-pass shape with a result for every step, close to the per-step shape's outputs in one call |
| NR-9 | Whether and how this piece reads the imagination's flagged problems: a bucket of unknown worth as evidence (user, 2026-11-13). Ignore them (the baseline, and the control), show them framed for skepticism, classify each in a call of its own, or use them in code as a trigger or an audit | Step 5 | An experiment once composition gives real flagged replies, on hops 5 and 7 and the guard cells | Open; none in the baseline |
| IM-3 | The loop's cap, and what returns when it is hit. The imagination plan's row; step 5 sets a first value | Step 5 | The composition probe | Open |
| IM-5 | Which ask's lines the rule cell reads for a rule's two ends. The imagination plan's row; step 4's adapter takes its provisional split | Step 4 | The composition probe | Open |

## How we work

- The parent's [How we work](AGENT.oracleLoop.planning.md#how-we-work) holds.
- The user runs each batch. I write each payload to a file and give its full path.
- **Probing defaults for step 3, from draft 5 on** (agreed with the user, 2026-11-13, after batch 4's replies were too large to paste):
  - **Results go to a file,** not the conversation. The user saves each response to a path I give, in the scratchpad. I pull the tally, the blocks and the rubric's checks with `jq`, and read in full only the replies the rubric points to.
  - **One repeat while exploring.** `repeats: 1` on every cell, or on the cells a targeted draft aims at plus a guard. Then `repeats: 3` to confirm, only on the cells a draft seems to have fixed, or for the bar's "two batches running".
  - A batch is one payload again, since its size no longer matters, within the cap of 24.
- One change per draft, a rubric written before each batch, and every reply read, not only tallied: requests carry parameters code doesn't grade.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted. A cell's expected answer is mine unless the corpus or the user gives it.

## Verification

- **Each build:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, no output.
- **A draft:** its form check, its tally, then every reply against the rubric written before the batch.
- **Links:** every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| The design pass | Done: the step layout agreed, NR-1 to NR-4 settled, the cells reviewed, NR-6 settled for the baseline, NR-7 settled (2026-11-13); the design pass is complete, step 2 next |
| The piece and its baseline | Done (2026-11-13): the probe's change, the piece, draft 1; batch 1, 11 right of 30 graded, the size cells 9 of 9 |
| Drafts in isolation (round 1) | Under way: draft 2 not kept (batch 2); draft 3 moved the guards (batch 3) and is the base; draft 4 not kept (batch 4); draft 5 (tagged factors, `cause` optional) ran (batch 5): the factor list not kept, `cause` optional kept, pending the user. The bar for passable is provisional |
| The composition probe, first form | Not started |
| The cell in composition | Not started; gated on round 1's exit |
| Drafts in composition (round 2) | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the request contract to the parent's seam ledger for the rule cell's refactor. Then the parent's non-rule cell item is checked, and this plan is deleted.
