# The non-rule cell: an oracle piece that answers with a verdict or a request

**Status (2026-11-16): steps 1 and 2 done; the baseline is batch 1, 11 of 30 graded calls right, the size cells 9 of 9. Step 3, drafts in isolation (round 1), begun, with a provisional bar for passable: draft 2, the outcomes framed by what they indicate, for the reluctance to allow (NR-P6), changed nothing (batch 2) and isn't kept; draft 3, the non-branching walk with consequences on their step (the contract amended, NR-4), moved the guards in substance (batch 3). At the batch 3 checkpoint it was kept as the base; draft 4, for and against before the finding, wasn't kept (batch 4): the weighing took, and the securing decides it. Draft 5, a tagged factor list before the finding with `cause` made optional, ran (batch 5): the tags became four headings to fill and the guards fell to 0 of 4, while `cause` optional fixed its form fault; the factor list not kept, pending the user. Since then, step 3 has gone to separate pieces: `stepConsiderations` (paused at draft 2), then the trial. The case against is kept on draft 1 with the securing omitted. The rebuttal's base is draft 5, confirmed at x3 (batch 8): weak arguments rebutted truly, sound ones visibly falsely. The trial family (Slice A) is built: one harness kind, `trial`, with the stage by `options.stage`, renders pinned to the batches. The verdict (Slice B) is built: a third stage, answered, on lifted pairs, over a typed stage contract. Batch 9, its draft 1: 6 of 10, the guards 4 of 4 and the size cells 1 of 3. Draft 2, the exchange as the object of judgment, ran in batch 10 at 5 of 10: the verdict now follows its stated tests, but the tests are filled by echo of the rebuttal (TR-P17). Draft 3, the point of disagreement as the synthesis, ran in batch 11 at 5 of 10: the synthesis takes in form, but its deciding clause is filled from the rebuttal's half just before it (TR-P18). The user's diagnosis: form over validity. Draft 4, skepticism stated in a reading section, ran in batch 12 at 5 of 10 with every answer unchanged: read past. Draft 5, the two voices tagged, ran in batch 13 at 6 of 10: one answer moved (OC-18), otherwise as batch 12. Draft 6, the skepticism moved into the decision, fell through in batch 14 (4 of 10, `rebuttal` 11 of 11): it was read as absence against the argument (TR-P20). In the discussion of per-side labels, the user traced the fault to how a scene is read: unstated details default to the ordinary. Draft 7, that rule in the verdict's Reading the scene, was read past in batch 15 (5 of 10). Across batches 11 to 15 the settling clause's named source decides the answer (TR-P21). No step asked the judge to evaluate soundness. Draft 8 added that at the task site, as a pair with and without "skeptically": both 4 of 10 in batch 16, identical; the stance had no effect, and the evaluation was read as consistency with the rebuttal's quoted line. At the checkpoint after batch 16, the user chose to keep drafting the judge. Next, by another route: [the trial's question](AGENT.trialQuestion.planning.md), a prototype in its own plan, in which the judge answers the case against's question. Step 4 can run alongside; step 5, the cell in composition, waits on step 3's exit.** The step layout is agreed ([The step layout and the two shapes](#the-step-layout-and-the-two-shapes)), and NR-1 to NR-4, NR-6 (for the baseline) and NR-7 are settled. The probe's change for NR-7 and the piece are built. Opened from the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, where the non-rule blocker was made next (user, 2026-11-13; [trail](AGENT.oracleLoop.discussion.planning.md#the-non-rule-blocker-first-the-rule-cell-later-2026-11-13)). It is renamed `nonRuleCell` here (user, 2026-11-13): under the verdict-or-request contract, `blocks` is one answer among several, and the name parallels `ruleCell`, its nearest analogue. The piece judges whether a plan can go ahead for reasons no rule names, such as stuffing a table into a teacup. It is the first oracle piece designed from the start to answer with a verdict **or** with requests typed by the imagination's asks ([trail](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12)), so the request contract is drafted here, on a new piece, and the rule cell adopts it later. **The composition probe's first two steps are built in this plan** (mine, 2026-11-13): a request's worth shows only in what comes back, so the cell's requests can't be graded without it. Its growth toward OC-30's chain may outgrow this plan; if so it gets its own.

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

**Accepted by the user, 2026-11-14; stage 1 built the same day** (`trialAgainst` and its tests, [`against.1.txt`](oracleLoopDrafts/trial/against.1.txt) and [`against.1.notes.md`](oracleLoopDrafts/trial/against.1.notes.md)). The user expects even stage 1 to test the hypothesis: whether a stated bias gives more focused results in fewer tokens. The triad is the user's (2026-11-14): one prompt makes the single best case that the plan can't happen, a second rebuts it, and a third judges which argued better. The user's reasoning is to lean into Micro's bias, not mitigate it: concise biased answers of 200 to 400 tokens may beat unguided ones of 1500 or more. The names, shapes, staging and defaults below are mine unless marked.

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

### Rebuttal draft 2: claim, evidence, kind

**Accepted by the user, 2026-11-15; built the same day** (the check's two quotes, the read-piece check given the rendered text, [`rebuttal.2.txt`](oracleLoopDrafts/trial/rebuttal.2.txt) and [`rebuttal.2.notes.md`](oracleLoopDrafts/trial/rebuttal.2.notes.md)). The chain is the user's (2026-11-15): read the scene and the steps, find the argument's most refutable assertion, then classify. The quotes, field names and wording are mine.

**Why** (rebuttal batch 3, TR-P4). `not established` was the move in 9 of 11 replies. The weak arguments got rebuttals no stronger than the sound ones: OC-1 disputes the weight as unknown and misses the scene's "a small round tea table". The kinds aren't exclusive: whatever the scene contradicts, it also doesn't say (the user). **A weak rebuttal of a sound argument is the job, not the fault** (the user): it is the judge's signal. The fix is aimed at the weak arguments' rebuttals.

**The chain, in the prose and in the block's order:**
1. **`claim`:** the claim in the argument that is easiest to refute, quoted from the argument.
2. **`evidence`:** the line of the scene or the steps (a consequence line included) that bears on that claim, quoted, or `"none"`.
3. **`kind`,** by how the evidence relates to the claim:
   - `wrong`: the quoted line says otherwise;
   - `invented`: no line bears on it;
   - `not established`: it turns on a detail the scene could have given but didn't.
4. **`rebuttal`,** in a sentence.

The block is `{"claim": …, "evidence": … | "none", "kind": …, "rebuttal": …}`.

**The check gains two quotes.** `claim` must fall inside the argument, after the normalizing `matchQuote` uses (whole or word-bounded part). `evidence` must be `none` or fall inside one line of the render's scene or steps. The scene lines are the Fiction sentences and Graph rows; the step lines are the steps and their consequence lines. Both are form problems, listed. The lines are drawn from the render itself, so a quote of anything shown counts.

**No common-knowledge clause.** I proposed defining "established" to include common knowledge, then dropped it after the user's point. It would have stopped the size cells' rebuttals from being weak, and their weakness is what the judge needs. With the chain, a sound argument's rebuttal shows its weakness in its structure: `evidence: "none"`, or a quote that doesn't bear on the claim.

**Two changes, a stated exception** to one change per draft: the chain, and the kinds redefined against the quote, which the chain needs.

**Unchanged:** the cells and lifted arguments (so the comparison with batch 3 is like for like), the render, the Role, the Reading sections, and the cap of 400.

**The rubric outline** (in full in `rebuttal.2.notes.md` before the batch):
- **Weak arguments** (OC-1, OC-2, OC-20, OC-6): a quoted contradicting line and `wrong`. OC-1 and OC-20 should quote "small round tea table".
- **Sound arguments** (the size cells, h7): `evidence: "none"`, or a quote that doesn't bear on the claim. h7: does it quote the slide line, and what kind does it then give?
- **The claim chosen:** the argument's actual weak point, or its framing (anchoring)?
- **The quote checks:** how many pass, and what the misses are.
- **h5 and h10,** apart; **OC-9,** the kind; **length** against batch 3's 314 to 488 chars.

**What changes, if accepted:** `trialRebuttal.ts` (the check's two quotes, the scene and step lines from the render, the doc comment) and its tests; `rebuttal.2.txt` and `rebuttal.2.notes.md`, for review before the batch; here, the trial item; calibration `AGENT.md`'s rebuttal paragraph. A deploy, since the check changes.

### The rebuttal's failure, diagnosed (2026-11-15)

The user asked for this diagnosis before any further design: the case against extracts and articulates the relevant points, while the rebuttal delivers a linguistic formula that applies only by accident.

**The mechanism (the user's): the rebuttal gets the answer without the question.** The case against works because it *chooses its question*: the one it thinks it can best argue against. The rebuttal receives only the answer, or the evidence claimed for an assertion without the assertion itself. It then has to reason back to what question the argument is answering. It doesn't. The implication is that the case against should give both its question and its answer. That can be tested in the prompt first, with the questions written by hand, before the case against is redesigned.

**The symptom (mine), which the mechanism explains:**
- **The case against makes world claims.** "The table is too large to fit inside the cup" draws on common sense the scene never states, applied to the scene's things.
- **The rebuttal makes claims about the argument's support:** "the scene does not specify…", "not established", "not supported by the given information". That audit has one answer that is always true, since scenes don't state common sense, so it applies to everything and is right only by accident.
- **What explains it:** with no question in hand, the argument's text is the only target, and auditing a text's support is what you do with an answer whose question you don't have.
- **What else it explains:**
  - batch 4's claim was the whole argument, 11 of 11, because the reconstruction into a question and an answer is exactly what was skipped;
  - the rebuttals that did real work were all world claims: OC-6 in batch 3 ("The teapot can directly pour its contents into the cup"), OC-2's workaround, and OC-11's mistaken "could fit".
- **Echoes:** the non-rule cell's batch 2, where every "works" was written as an absence, until draft 3 gave success its own world-level slot.

**Prompt-level causes I named, to be separated by test:**
- the kinds are epistemic categories, and draft 2 defined each by "how the line relates to the claim";
- "from the scene and the steps" was a source to argue from for the case against, but became a standard to measure against for the rebuttal.

**The separating test:** supply the question by hand, and change nothing else.
- **The questions:** each the plain yes-or-no form of the argument's subject, worded so it doesn't carry our answer. "Can one person pick up [table1]?", not "Is [table1] too heavy?"
- **If the rebuttals become world claims,** the question is the lever.
- **If they stay at the support level,** the prompt-level causes are doing real work as well.

**What it opens for the rebuttal's redesign (the user's, 2026-11-15):**
- **The rebuttal can attack either part.** It can attack the **answer** to the question, or the **bearing** of the question on the plan's possibility.
- **The user's example:** against a plan to tilt the table to pour from the teapot, the case against might argue "is the teapot secured to the table? Yes, glued, by established fact". The rebuttal isn't "it's not glued", or "glued doesn't mean secured". It is that the question is irrelevant: it isn't an objection that addresses what the case against is required to address, whether the plan can happen.
- **The kinds map onto the two targets** (the user thinks; the detail of the mapping is mine, for review):

  | Kind | Target | What it says |
  | --- | --- | --- |
  | `wrong` | the answer | the scene or the steps say otherwise |
  | `not established` | the answer | it turns on a detail the scene could have given and didn't |
  | `invented` | the answer, or the question | an answer resting on nothing given; or a question that presupposes something not given |
  | **irrelevant** (new) | the question | answering it either way doesn't bear on whether the plan can happen |

  `invented` is the one that spans both. Mine: it may split into an unsupported answer and a loaded question.
- **Order** (mine): the separating test comes first, with the kinds unchanged, so it can tell the question's effect from the kinds'. The two-target rebuttal, with relevance as a kind, is the redesign after it.

### Rebuttal draft 3: the question supplied (the separating test)

**Accepted by the user, 2026-11-15, with two amendments from review, then built.** The test is the user's (TR-L5). The questions, the render line and the base are mine, amended as below:
- **The hops' questions are anchored on the step that fails** (the user): the state at that step, not the cause's premise. The single-step cells keep the premise form, since there the two coincide.
- **The cells' inputs are `golden` and `lifted` sources** (the user's harness design, in How we work), and this test runs `golden`. The golden arguments are the lifted ones adopted verbatim, as interim goldens (the user: fine as interim). Proper goldens for the guards, the strongest argument a good case against could make with no real blocker, are a separate change after the test.

**What it tests:** whether supplying the question the argument answers turns the rebuttal from claims about the argument's support into claims about the world. Nothing else in the prompt changes, so the question's effect can be told apart from the kinds'.

**The questions: the argument's premise, put as a yes-or-no question in the argument's own words** (mine). The plan's first framing was "the plain form of the argument's subject, worded so it doesn't carry our answer". Taking the argument's own words does that more strictly: the question then carries only the argument's lean, never ours. It is also what the case against could later give itself. It follows the user's model, where the question is about the premise ("is the teapot secured?"), so that its bearing on the plan can be attacked separately later.

| Cell | The argument (lifted) | The question |
| --- | --- | --- |
| OC-11, OC-3 | The table is too large to fit inside the cup. | Is [table1] too large to fit inside [cup1]? |
| OC-18 | … too large and structurally unsuited to fit into the cup. | Is [table1] too large and structurally unsuited to fit into [cup1]? |
| OC-1, OC-20, OC-9 | … too large and heavy to be picked up by a single person … | Is [table1] too large and heavy to be picked up by a single person? |
| OC-2 | … the player is not holding anything to lift the cup directly. | Does holding nothing keep the player from lifting [cup1] directly? |
| OC-6 | … cannot be directly poured into the cup without first being transferred … | Must [tea2] be transferred to another container before it can be poured into [cup1]? |
| h5 | Tipping the table would cause the teapot to fall off and spill its contents. | By the time of "[teapot1] pours [tea2] into [cup1]", is [teapot1] still where it can pour into [cup1]? |
| h7 | The first step would cause the cup to fall off the table, making it impossible to pour tea into it. | By the time of "[teapot1] pours [tea2] into [cup1]", is [cup1] still where [teapot1] can pour into it? |
| h10 | Tipping the table would cause the saucer, cup, and tea to fall off … | By the time of "[teapot1] pours [tea2] into [cup1]", is [cup1] still where [teapot1] can pour into it? |

The hops' questions ask about the state at the step that fails (the user's amendment). They carry their bearing on the plan, so on them only the answer can be rebutted; relevance is the tool for questions that lack a bearing. Being hand-written in the grounded form, they may be better than the case against's own will be.

**The inputs and render:** each cell's argument gains `question`. The render puts a line before the argument: `The question the argument answers: <question>`. Role's list of what follows gains "and the question it answers". That is the only prompt change. The inputs hashes change on every cell, which is the intended difference.

**The base: rebuttal draft 2** (mine). Its check already measures grounding (the `evidence` quote), so it needs no code beyond the render. Batch 4 is the comparison, like for like. Draft 1 would compare with batch 3, but it would need the check to take both forms. The cost is that draft 2's "claim easiest to refute" now overlaps the question. Read whether the claim becomes the question, or a part of the argument.

**TR-P5** (the label in a quote) is fixed alongside it: a check fault, not a prompt change.

**The rubric outline** (in full in `rebuttal.3.notes.md` before the batch):
- **The main measure:** each rebuttal sorted by hand as a **world claim** (about the things: "[table1] is a small round tea table, light enough for one person") or a **support claim** (about the argument: "the scene does not specify"). Batch 4 is the baseline, about 3 of 11 world claims.
- **Weak arguments:** does the rebuttal answer the question from the scene? OC-1 and OC-20: "No: [table1] is a small round tea table". OC-2: "No: picking up is what empty hands do". OC-6: "No: a teapot pours".
- **Sound arguments:** does the rebuttal answer "no" weakly, or concede in substance? The question in the argument's words might lead it to agree, which would be a new failure.
- **The claim field:** the question, a part of the argument, or still the whole argument?
- **The kinds' spread,** against batch 4's `invented` 8.
- **Length, the quote checks, h5 and h10 apart.**

**What changes, if accepted:**
- `trialRebuttal.ts`: `question` on `TrialArgument`, the render line, the Role's wording carried in the draft, the TR-P5 fix, the cells' questions; and its tests;
- `rebuttal.3.txt` (draft 2 with Role's list extended) and `rebuttal.3.notes.md`;
- here, the trial item; calibration `AGENT.md`.

A deploy, since the render changes.

### Rebuttal draft 4: evidence, then both attacks

**Accepted by the user, 2026-11-15; built the same day** (the check's fields, the cap of 600, [`rebuttal.4.txt`](oracleLoopDrafts/trial/rebuttal.4.txt) and [`rebuttal.4.notes.md`](oracleLoopDrafts/trial/rebuttal.4.notes.md)). The shape is the user's, settled in discussion on 2026-11-15. The question is attacked first, with the evidence quoted before the attack. Relevance is a separate attack, after the answer. **The rebuttal attacks both, as well as it can, every time.** The field names, wording and defaults are mine unless marked.

**Why** (rebuttal batch 5, TR-P7): the question was supplied and never used, since no step of the Task named it. **An input only counts once a step uses it** (agreed with the user). So each step names what it reads.

**Biased throughout, not honest** (the user's correction to my first version of this design). My first version asked for the question's answer "given honestly", so that a sound argument would draw an agreeing answer. That asks the rebuttal to weigh the evidence fairly, which is the unguided judgment the triad exists to avoid. The triad works by giving each call a bias and leaving the weighing to the judge. With both attacks always made, the user's three cases fall out on their own:
- bad evidence for a relevant question: the attack on the answer is strong, and the attack on the question is forced;
- good evidence for the wrong question: the attack on the answer is forced, and the attack on the question is strong;
- both bad: both attacks are strong.

On a sound argument both attacks are forced. The judge's signal is which attacks hold.

**The procedure, in the prose and in the block's order:**
1. **`evidence`:** the lines of the scene or the steps that bear on the question, quoted, or `["none"]`. It comes first, as the reading, so both attacks argue from lines on the table. Choosing the lines that help is advocacy, and the judge sees what was chosen.
2. **`answerWrong`:** an argument, as strong as it can make it and from those lines, that the argument's answer to the question is wrong.
3. **`kind`:** after that argument, so it classifies what was argued, not what will be: `wrong` (the lines say otherwise), `invented` (no line bears on it), `not established` (it turns on a detail the scene could have given). These are draft 2's three.
4. **`questionIrrelevant`:** an argument, as strong as it can make it, that the question doesn't bear on whether the plan can happen, so the argument wouldn't prove the plan impossible even if its answer were right.

**Relevance comes last** (the user's order). Attacking the answer first forces a claim about the world before the relevance attack is open. The two are independent, and the rebuttal makes both and chooses neither. **It is in this batch rather than the next** (mine): it is generated last, so it can't shape the earlier slots except through the prompt's wording, and the answer-side measures stay comparable to batch 5. This is a stated exception to one change per draft.

**The Task** (wording mine):
> Task: Rebut the argument in four parts, a sentence or two each. First, quote the lines of the scene or the steps that bear on the question the argument answers, exactly as they are written, or say "none" if no line bears on it. Second, argue as strongly as you can, from those lines, that the argument's answer to that question is wrong. Third, give the kind of what you argued: "wrong" when the lines say otherwise, "invented" when no line bears on it, or "not established" when it turns on a detail the scene could have given but didn't. Fourth, argue as strongly as you can that the question doesn't bear on whether the plan can happen, so the argument wouldn't show the plan impossible even if its answer were right. Then end with a single JSON code block, fenced with ```json, holding one object: {"evidence": ["<a quoted line>", ...] or ["none"], "answerWrong": "<the first argument>", "kind": "wrong" or "invented" or "not established", "questionIrrelevant": "<the second argument>"}.

**The check:**
- `evidence` is a non-empty list, either `["none"]` or each item quoting a scene or step line, as now;
- `answerWrong` and `questionIrrelevant` are non-empty strings;
- `kind` is one of the three.

The `claim` and `rebuttal` fields and their checks go. The claim step never worked (TR-P6), and the two attacks replace the single rebuttal.

**Unchanged:** the cells, the golden questions and arguments (`upstream: golden`), the render, the Role and the Reading sections. **The cap:** 400 to 600 tokens (mine), for the second attack.

**What we expect of the relevance attack in this cell set: forced everywhere.** The hops' questions claim their bearing ("is [cup1] still where [teapot1] can pour into it?"), and the single-step questions are premises that bear directly (size, weight). Cells where it should be strong, salient but irrelevant arguments like batch 1's glue, need golden cells of their own. They are written later with the guard goldens.

**The rubric outline** (in full in `rebuttal.4.notes.md` before the batch):
- **The main measure, world or support claim,** sorted by hand on `answerWrong`. Batches 4 and 5: about 3 of 11.
- **Weak arguments:** does `evidence` hold "a small round tea table" (OC-1, OC-20), "You are holding nothing." (OC-2), the teapot's tea (OC-6)? Does `answerWrong` use it, with `kind` `wrong`?
- **Sound arguments:** is `answerWrong` visibly forced, and does it stay forced, with no concession? h7: does `evidence` hold the slide line, and what does the attack do with it?
- **Evidence before the attack:** does the attack draw on the quoted lines, or ignore them?
- **`questionIrrelevant`:** forced on every cell, as expected? Read whether any is persuasive, a false strong attack, and what it claims.
- **The kinds' spread,** the quote checks, length against batch 5's 594 to 1209 chars, cut-offs at 600, h5 and h10 apart.

**What changes, if accepted:**
- `trialRebuttal.ts`: the check's fields, the cap; and its tests;
- `rebuttal.4.txt` (draft 3 with the Task replaced) and `rebuttal.4.notes.md`;
- here, the trial item; calibration `AGENT.md`.

A deploy, since the check changes. **The judge, when built,** reads the argument against both attacks.

**Run, 2026-11-15 (batch 6):** [results](oracleLoopDrafts/trial/rebuttal.4.notes.md#results-2026-11-15-batch-6). Evidence-first took; the block's slots did not (TR-P8 to P10).

### Rebuttal draft 5: one sentence, incoming argues, but

**Accepted by the user, 2026-11-15; built the same day** (the check, [`rebuttal.5.txt`](oracleLoopDrafts/trial/rebuttal.5.txt) and [`rebuttal.5.notes.md`](oracleLoopDrafts/trial/rebuttal.5.notes.md)). The shape is the user's, from the discussion after batch 6:
- the sentence opens with a ruthlessly concise summary, "Incoming argues '…'";
- it pivots straight to a source, "… but the scene says / common sense indicates …", that something else is actually true;
- a second branch, for a premise the scene never gives, lists "the only facts the scene establishes about" the thing in question;
- relevance is left out of this draft, to see whether the structure changes how the rebuttal weighs the incoming argument against the evidence.

The single-string contract, the closed list of sources, the check, the block-only reply and the Task's wording are mine.

**Why** (batch 6, TR-P8 to P10): about three quarters of each reply restated the argument, its question and the quoted lines, part by part, before the block. The user's concern: a rebuttal that generates most of its output by regurgitating the case against will argue inside its frame. The data fit that. h7 quoted the slide line, then attacked "falling" in the argument's words. Five `answerWrong` fields restated the answer. `kind` classified the argument. This form allows one labelled restatement, then puts the rebuttal's own source and the scene's lines next.

**The two branches:**
1. `Incoming argues '<the argument's answer, briefly>', but <source> …`, where the source is one of:
   - `the scene says '<a line, quoted>'`;
   - `the steps say '<a step, quoted>'`;
   - `common sense indicates that '<a claim>' is actually true`.
2. `Incoming argues '<the argument's answer, briefly>', but the only facts the scene and the steps establish about <[handle]> are: '<a line>', '<a line>', …`

Branch 2 is the "not established" move, with the absence **shown** rather than asserted (the user's widening). `invented` and `not established` fold into it, and `wrong` and world knowledge are branch 1.

**The Task** (wording mine; Role and the Reading sections unchanged from draft 4):
> Task: Rebut the argument in one sentence, as strongly as you can. Begin with the argument's answer to its question, as briefly as you can: Incoming argues '<that answer>'. Then continue with what is actually so, in whichever of these forms rebuts it most strongly: ", but the scene says '<a line of the scene, quoted exactly>'"; ", but the steps say '<a step, quoted exactly>'"; ", but common sense indicates that '<what is actually true>' is actually true"; or ", but the only facts the scene and the steps establish about <the thing, by its [handle]> are: '<a line, quoted exactly>', '<another>', …". Reply with a single JSON code block, fenced with ```json, holding one object: {"rebuttal": "<the sentence>"}.

**The block only** (mine). The sentence is the reasoning, and the prose before the block was where the restating happened. If Micro writes prose anyway, the rubric counts it.

**The check** (mine):
- `rebuttal` is a string opening `Incoming argues '…'` and pivoting on `, but `. The quote characters are read leniently (single or double, straight or curly).
- **Branch 1:** the source is one of the three. A scene or steps source carries a quote that matches a rendered line.
- **Branch 2:** the handle is in the scene. The list is non-empty, and each item quotes a rendered line naming that handle.
- **TR-P11, the quote tolerance:** a line passes when quoted with its `Fiction:`/`Graph:` prefix or a role label (`(consequence)` or `consequence :`), or as several Graph rows each matching. An elision is still a misquote.
- `evidence`, `answerWrong`, `kind` and `questionIrrelevant` go.

**Unchanged:** the cells, the golden questions and arguments (`upstream: golden`), the render, Role and the Reading sections, the cap of 600 tokens.

**The rubric outline** (in full in `rebuttal.5.notes.md` before the batch):
- **The branch split per cell**, against batch 3's `not established` 9 of 11: does branch 2 become the universal move?
- **The summary:** one premise or the whole argument (TR-P6)? A strawman? Restated more than once?
- **Weak arguments:**
  - OC-1 and OC-20: "a small round tea table", through either branch;
  - OC-2: "You are holding nothing." used as what picking up needs;
  - OC-6: a teapot as what tea is poured from (branch 1, the scene or common sense).
- **Sound arguments** (the size cells, h7): is the forced rebuttal visibly false? That is the tell. Read a size cell's branch 2 list of "a small round tea table", which looks like a rebuttal and isn't one (batch 4's inverted tell). h7: is the slide line among the facts about [cup1], and what does the sentence do with it?
- **Branch 2's completeness**, a measure, not a gate: the rendered lines naming the handle that the list leaves out, and whether what's left out is the inconvenient line.
- **World or support** on branch 1 claims; the quote checks; length against batch 6's 1233 to 2302 chars; prose outside the block; cut-offs; h5 and h10 apart.

**What changes, if accepted:**
- `trialRebuttal.ts`: the check, for one string in two branches with the TR-P11 tolerance; and its tests;
- `rebuttal.5.txt` (draft 4 with the Task replaced) and `rebuttal.5.notes.md`;
- the trial `iterations.md` (TR-L8);
- here, the trial item;
- calibration `AGENT.md`.

A deploy, since the check changes. **The relevance attack** comes back as its own sentence once the answer side works.

**Run, 2026-11-15 (batch 7):** [results](oracleLoopDrafts/trial/rebuttal.5.notes.md#results-2026-11-15-batch-7). The summary dropped everywhere (TR-P12). "The scene says '<line>', which implies <claim>" on every cell.

### The trial family: one harness kind, the stage by specifier

**Designed 2026-11-16; Slices A and B built the same day** (Slice B to [its own design](#slice-bs-design-the-verdict-and-the-stage-contract)). The idea is the user's: collect the trial's pieces under one harness kind, with a specifier for the stage under test and the `golden`/`lifted` choice already settled. This is a step toward a pipeline-aware harness, short of a full pipeline that feeds against into rebuttal into verdict. The layout below, the pairing rule and the slicing are mine unless marked.

**Why now:** the verdict is the first piece with two upstream inputs. As separate pieces, each stage copies the cells again: `trialRebuttal`'s cells already spread the non-rule cell's inputs and add `against`, and the verdict would spread them once more and add `rebuttal`. A lifted rebuttal is also a reply to one particular argument (batch 8 answered the golden arguments), so the verdict can't pair stages freely.

**The shape:**
- **One trial record per cell** (`trialCases.ts`):
  - the non-rule cell's inputs, source and note;
  - a `StageInput` slot per later stage: `against: StageInput<TrialArgument>` now, `rebuttal: StageInput<TrialRebuttalReply>` with the verdict;
  - a `lookFor` per stage: `{ against, rebuttal, verdict? }`, each written before its batch, as now.
- **One harness kind, `trial`, with stages:**
  - `against`: options `{ stage: 'against', securing?: 'shown' | 'omitted' }`, with no upstream, since it is the first stage;
  - `rebuttal`: `{ stage: 'rebuttal', upstream: 'golden' | 'lifted' }`;
  - `verdict` (Slice B): `{ stage: 'verdict', upstream }`.

  Each stage is a read piece underneath, with its own render, check and cap (400 and 600 tokens, as now). The payload is `{"piece": "trial", "options": {"stage": "rebuttal", "upstream": "golden"}, …}`. An unknown or missing stage is refused, with the list of stages.
- **The harness change** (`pieceProbe/`):
  - `oraclePiece.ts` gains a `PieceFamily` (`kind: 'family'`, `name`, `stages`) and `registerFamily`;
  - in `handlePieceProbe.ts`, a family resolves to its stage's piece from `options.stage`, and the remaining options go to that stage's `parseOptions`. Everything after that runs as for any read piece;
  - the response gives `piece: "trial"` and `stage`.

  The other pieces are untouched.
- **The pairing rule, for the verdict** (mine; Slice B). A lifted value records what it consumed: `lifted.consumed = { upstream, hash }`, the source of the stage before and a hash of the value it read.
  - `upstream: 'lifted'` at the verdict then takes a real rebuttal **with the argument it actually answered**. That argument is found through `consumed`, and the hash is checked, so editing a golden argument later breaks the pair loudly, not silently.
  - `upstream: 'golden'` is hand-written all the way up.

  One switch keeps a clear meaning at every stage. "Golden argument, real rebuttal" is just what a rebuttal lifted from batch 8 is.

**The slices:**
- **Slice A, the family with the two stages built so far:**
  - move `trialAgainst.ts` and `trialRebuttal.ts` into `oraclePieces/trial/` as `against.ts` and `rebuttal.ts`, with their tests, over one `trialCases.ts`;
  - register `trial`, retiring the names `trialAgainst` and `trialRebuttal` (pre-rollout, no outside consumers);
  - **renders byte-identical:** a test pins each stage's inputs hashes to the ones batches 2 and 8 reported. No prompt changes, and no batch is needed.

  The scratchpad's old payloads stop working, and new ones say `piece: "trial"`.

  **As built** (mine): the rebuttal's notes on h5 and h10 differ from the non-rule cell's, so a record carries `notes` per stage beside its `lookFor`, not one shared note. Both against renders are pinned (securing shown, batch 1; omitted, batch 2), as well as the rebuttal's golden (batch 8).
- **Slice B, the verdict stage:**
  - **a typed stage contract** (mine, 2026-11-16; to design here with the verdict's prompt). Each stage declares its `Input` and its `Output`, with `parse(reply) → Output | problems` as the single source of truth. Its form check is that parse, and a lifted value is that parse recorded with what it `consumed`. This replaces hand-copying replies into `trialCases.ts`.
    - **Why now:** today a check returns problems and throws the reply's structure away. The against stage has no parser that gives a `TrialArgument`, so chaining (step 4) has nothing typed to pass on. The verdict is the first stage with two upstream outputs, so it tests the contract on the case it exists for.
    - **Where it lives** (from the user's point, 2026-11-16, that the probe is a lasting tool): somewhere both the probe and production import, not inside `pieceProbe/`. Then the probe tunes exactly what production runs, and the probe's and production's copies can't drift. Before designing it, read the pipeline it will join (the command-attempt pipeline in `actions/`), and don't wire into it.
    - **Not yet:** classes, or a coordinator that runs stages in order. They wait for step 4's live chaining, when what coordinating involves is known. Merging the three quote matchers (`matchQuote`, `quotesALine`, `evidenceLines`) is tidying, with batch replays as its tests, and is not part of this;
  - `lifted.consumed` in `stageInput.ts`, with the pairing check;
  - the batch 8 rebuttals recorded as lifted values on the trial records, through the rebuttal's `parse`;
  - the verdict's render: the scene and steps, then the question, then the argument followed directly by the rebuttal, so "But …" reads as its reply;
  - its check, cells and prompt. **The verdict's prompt and reply get their own design here before Slice B is built.**

**What changes, Slice A:**
- `pieceProbe/oraclePiece.ts`, `handlePieceProbe.ts`, `pieces.ts`, and their tests (a stub family: stage resolved, unknown stage refused, the stage's options parsed);
- `oraclePieces/trial/`, moved from the two piece files, and their tests;
- calibration `AGENT.md`: the Piece probe section (families) and the trial paragraphs;
- here, the trial item;
- the trial `iterations.md` header (the files named by stage).

**The step it takes:** toward [step 4](#recommended-order), the composition probe, where pieces feed each other in code. The trial proposal already places "chaining the three in code" there, once each works alone (the user pointed to it, 2026-11-16). The family gives step 4's chaining a home: the stage order and each lifted value's provenance, which it can later fill by running the stage before instead of reading a recorded batch.

### Slice B's design: the verdict and the stage contract

**Accepted by the user, 2026-11-16, as a first iteration: something that can reasonably decide between the two. Built the same day.** The user's framing: the whole pipeline will be tuned and refactored later, toward what improvement to suggest from the combinations of arguments, rebuttals and judgments; this slice only has to judge. Where the contracts live is the user's call (2026-11-16): the generic part in `llm/`, the trial's three concrete contracts in `oraclePieces/trial/`, moving to a production feature folder when production takes the oracle over. Everything else here is mine.

**The stage contract:**
- **`llm/stageContract.ts`** (new): `StageParse<Output> = { value: Output } | { problems: string[] }`, and `StageContract<Input, Output> = { name, parse(reply, shown: { input, rendered }) → StageParse<Output> }`. `jsonObject` and `replyJsonObject` move there from `pieceAnswer.ts`. `llm/` has the reasoning and JSON split but no "an object, or why not" step, and its `AGENT.md` puts reusable parsing in `llm/` and domain validation in feature code.
- **Each trial stage exports its `contract`,** and the probe's check or grade is the problems from its `parse`:
  - `against`: `Input` the non-rule cell's inputs; `Output` a `TrialArgument` (`{step, argument}`);
  - `rebuttal`: `Input` adds `argument`; `Output` `{ rebuttal, parsed }`, the sentence and its `ParsedRebuttal`;
  - `verdict`: `Input` adds `rebuttal`; `Output` `'argument' | 'rebuttal'`.
- **The harness passes the payload's parsed options to `check` and `grade`,** so a stage resolves its upstream input for the parse as its render does.
- **Not in this slice:** classes, a coordinator, merging the quote matchers, and render in the contract (it builds fixture scenes, which is the probe's).
- **Where production would take it** (read, not wired): `llm/pipeline`'s `defineLlmInvokeStep`, in `applyOutputs`. The actions pipeline's LLM slot today is the `adjudicateDeferred` stub.

**The pairing rule** (`stageInput.ts`): `lifted` gains an optional `consumed: { upstream, hash }`, the hash a `textHash` of the value's sorted-key JSON.
- `upstream: 'lifted'`: the lifted rebuttal, then the argument it consumed, from that source, with the hash checked. A mismatch throws, so the probe refuses the payload as a cell-data error.
- `upstream: 'golden'`: golden all the way up.

**The batch 8 rebuttals as lifted values:**
- a `rebuttal` slot on each trial record, each lifted value the reply's sentence run through `parseRebuttal`, with `consumed` naming the golden argument batch 8 answered;
- **the repeat:** the first whose reply passes the current parse. That is r1 everywhere but OC-3, which takes r2, since r1 lists a fact that doesn't name its handle. No choosing by quality;
- **no golden rebuttals yet.** Writing the strongest rebuttal per cell is its own design, so `upstream: 'golden'` is refused at the verdict until they exist.

**The verdict** (an answered stage of the family):
- **The render:** the rebuttal's, then `The rebuttal: <sentence>` on the next line, so "But …" reads as the argument's reply.
- **The answers:** `argument` or `rebuttal`, graded by the contract's parse: the trailing block parses and `answer` is one of the two. No `Answer:` line. The cap is 400 tokens.
- **The expected answers,** from the trial proposal:

  | Expected | Cells |
  | --- | --- |
  | `argument` | the size cells (OC-11, OC-18, OC-3), h7; h5, since the loose-teapot argument is sound in the scene shown and its rebuttal dodges |
  | `rebuttal` | the guards (OC-1, OC-2, OC-20, OC-6), h10 |
  | ungraded | OC-9 |

  h5 and h10 are read apart. Each cell gets a verdict look-for; h7's asks whether the judge reads the rebuttal's evasion of the slide line as weak (TR-P14).
- **Draft 1:**
  - **Role,** new: judging between an argument against a player's plan and its rebuttal, with what follows listed;
  - **Reading the scene and Reading the steps,** word for word from rebuttal draft 5;
  - **Task,** new: a description before the verdict (RC-L5), with each input used by a step (TR-P7):
    > Task: Decide whether the argument or the rebuttal is right about the question the argument answers. First, in one or two sentences, say what the scene and the steps say about that question, quoting the lines that bear on it. Then end with a single JSON code block, fenced with ```json, holding one object: {"answer": "argument"} when the argument is right, or {"answer": "rebuttal"} when the rebuttal is right.
- **What to watch:** anchoring on the rebuttal, the nearest text (the size cells show it); the description becoming the verdict; "right" read loosely on h5 and h10.

**Batch 9:** `{ "stage": "verdict", "upstream": "lifted" }`, 11 cells, `repeats: 1`, after a deploy, with a rubric in `verdict.1.notes.md` before it.

**What changes:**
- `llm/stageContract.ts` and its test; `llm/AGENT.md`;
- `pieceProbe/`: `pieceAnswer.ts`, `oraclePiece.ts`, `handlePieceProbe.ts`, `stageInput.ts`, and their tests;
- `oraclePieces/`: `nonRuleCell.ts` and `stepConsiderations.ts` (imports); `trial/`: `against.ts`, `rebuttal.ts` (contracts, renders pinned unchanged), `trialCases.ts`, `verdict.ts`, `index.ts`, and their tests;
- `verdict.1.txt`, `verdict.1.notes.md`, the trial `iterations.md`;
- here; calibration `AGENT.md`.

**As built** (mine):
- **The rebuttal's sentence parser** moved to `trial/rebuttalSentence.ts`, so the records can parse a lifted rebuttal at load without an import cycle.
- **An answered piece's `grade`** takes the rendered text as well as the options, in the same order as a read piece's `check`.
- **The rebuttal's render after its argument is resolved** is `renderArgued`, which the verdict's render starts from. The pins are unchanged.
- **Batch 8 replayed** through the contract-derived check: 31 of 33, as before.

### Verdict draft 2: the exchange as the object

**Accepted by the user, 2026-11-16; built the same day** ([`verdict.2.txt`](oracleLoopDrafts/trial/verdict.2.txt), its rubric in [`verdict.2.notes.md`](oracleLoopDrafts/trial/verdict.2.notes.md), h10 re-expected in `trialCases.ts`). The direction is the user's, from the diagnosis after batch 9: the judge should strictly compare which of the argument and the rebuttal succeeded, not judge the scene freely. The scene's reading instructions stay as they are. Whether the judge needs different instructions for reading the scene, in the context of the exchange, is a later question, asked only after this draft (the user). The wording, the expected-answer revision and the rubric are mine.

**Why** (the diagnosis, batch 9; TR-P15, TR-P16). Mine, agreed by the user as a reasonable first step. The prompt treats the argument and the rebuttal as second-class data, in four places:
1. **The Task makes the question the thing judged.** "Right about the question" asks the judge to answer the question itself and then match a side to its answer. That is a departure of mine from the user's design, a judge of "which argued better" (the trial proposal), and it wasn't flagged when draft 1 was written.
2. **The only step operates on the scene and the steps.** "Say what the scene and the steps say about that question" has no counterpart for the argument or the rebuttal, so they are reported, not weighed (TR-P7). Every description summarizes them (TR-P15).
3. **Only the scene and the steps have a reading rule.** The scene is "what has been established". Nothing says how to read an argument or a rebuttal, or when a rebuttal succeeds.
4. **So authority goes to whichever side quotes the scene,** which is always the rebuttal (draft 5's "the scene says '…', which implies …"). Its inference rides on the quote's authority, unexamined: OC-11 and OC-3's "small round, so it fits", h5's "unnecessary", OC-9's "no weight restriction" (TR-P16).

**One change: the exchange becomes the object of judgment.** The Role, a new reading section and the Task each carry it, and none stands without the others, so they are one change, not three. Each has a slot:
- **Role** (replaced): "You judge an exchange about a player's plan in a game world: an argument that the plan can't happen as written, and a rebuttal of that argument. Below are the scene, the player's request, the plan's steps in order, each marked with its role, then the question the argument answers, the argument, and the rebuttal."
- **Reading the argument and the rebuttal** (new, after Reading the steps): "The argument answers its question and claims that the plan can't happen. The rebuttal replies to the argument: it quotes a line of the scene or the steps, or appeals to common sense, and says what follows from that. The rebuttal succeeds when what it says follows from what it quotes or appeals to, and answers the argument's claim. The argument stands when the rebuttal's reply doesn't follow from its source, or answers something other than the argument's claim."
- **Task** (replaced): "Task: Decide which argued better, the argument or the rebuttal. First, in one or two sentences, take the rebuttal's reply: say what it quotes or appeals to, then whether what it says follows from that, and whether it answers the argument's claim. Then end with a single JSON code block, fenced with ```json, holding one object: {"answer": "argument"} when the argument argued better, or {"answer": "rebuttal"} when the rebuttal argued better."

Every input gets a step that uses it (TR-P7): the question and the argument's claim through what the rebuttal must answer, and the rebuttal's source and inference through the two tests. The description now judges the rebuttal's move, not the scene. The risk is RC-P2's: deciding first and fitting the tests to it.

**Unchanged:** Reading the scene and Reading the steps (the user), the render (so batch 9's inputs hashes hold), the cells and the lifted pairs, the grade and the answers, and the cap of 400.

**The expected answers, revised for the framing** (mine). They follow each pair's contents, as the trial proposal already had it for h5. Under "which argued better", h10's lifted pair changes:
- **h10: `rebuttal` → `argument`.** The rebuttal ("tipping the table is not necessary to pour tea") answers something other than the argument's claim that the cup falls, and never uses the step that matters, step 1's saucer taken off the table. The argument is wrong on the state, but the rebuttal doesn't show it. The cell stays read apart.
- **The rest stand:**
  - the size cells: the rebuttal's "small, so it fits" doesn't follow from "a small round tea table";
  - h7: the rebuttal answers the argument's claim without the slide line that decides it, and its "still on [table1]" doesn't follow from "In [cup1] there is [tea1] Tea";
  - h5: the rebuttal's dodge answers something other than the claim;
  - the guards: each rebuttal's claim follows from its line and answers the argument;
  - OC-9 stays ungraded. Under this framing, the rebuttal's "doesn't specify any weight restrictions, implying it can be lifted" doesn't follow, so `argument` is the likely reading.

**The rubric outline** (in full in `verdict.2.notes.md` before the batch):
- **The tally,** against batch 9's 6 of 10, with h10 re-expected, so batch 9 rescores at 7 of 10 like for like (its h10 answer was `argument`, now right; the rest unchanged). The answers' spread, against batch 9's `rebuttal` 8 of 11.
- **The size cells:** does the description say that "a small round tea table" doesn't make it small enough to fit inside a cup?
- **The guards:** does the follow test pass them, or does a strict reading of "follows" turn true rebuttals down, the mirror fault?
- **Restatement** (TR-P15): does the description still summarize all the inputs, or take up the rebuttal's reply as told?
- **Decide then fit:** does the description name the verdict first and fit the two tests to it?
- **h7, h5, h10, OC-9:** whether "answers the argument's claim" catches the evasion and the dodges.
- **Form, length, cut-offs.**

**What changes, if accepted:**
- `verdict.2.txt` (draft 1 with the Role and Task replaced and the reading section added) and `verdict.2.notes.md`;
- `trialCases.ts`: h10's expected verdict, with its look-for, and the test that lists the expected answers;
- the trial `iterations.md` (TR-L10); here, the trial item;
- calibration `AGENT.md`'s verdict paragraph ("which argued better").

No deploy is needed for the prompt, but the expected-answer change is in the cells, so it needs one before batch 10. Batch 10 is 11 cells x1 on the lifted pairs.

### Verdict draft 3: the point of disagreement

**Accepted by the user, 2026-11-16 ("let's give it a try"); built the same day** ([`verdict.3.txt`](oracleLoopDrafts/trial/verdict.3.txt), its rubric in [`verdict.3.notes.md`](oracleLoopDrafts/trial/verdict.3.notes.md)). The aim is the user's, from batch 10: Micro attends so narrowly to one input that it can't synthesize a view of the argument and the rebuttal in context with each other, so ask for that synthesis as an intermediate result. The sentence form, its branches and the wording are mine.

**Why** (batch 10; TR-P17). Draft 2's tests were each answered from the rebuttal's own text: "follows" from its "which implies", "answers" as "same subject". Nothing outside the rebuttal was measured against.

**One change: the description becomes the point of disagreement.** The Task's description step is replaced by one sentence in one of two forms:
1. "On the question, the argument says '…'; the rebuttal says '…'; so they disagree about …, which the scene says / the steps say / common sense says is …".
2. "On the question, the argument says '…'; the rebuttal answers a different question: '…'".

The verdict is tied to the sentence. It is `argument` when what is so agrees with the argument, or when the rebuttal answers a different question. It is `rebuttal` when what is so agrees with the rebuttal.

The shape draws on three things that worked:
- **the rule cell's relational description,** where the description states how two things relate rather than assessing one;
- **rebuttal draft 5's fixed sentence with a turn,** in place of slots that get filled literally;
- **the question as the anchor,** since it is the one input outside both texts.

The scene is read again, but only at the point in dispute, so the comparison stays strict.

**The risks:**
- the rebuttal's half is copied in its own framing;
- the settling clause repeats the rebuttal's source;
- the second form goes unused, or is overused.

If one call can't hold the synthesis and the verdict, the disagreement can become its own stage feeding the judge.

**Unchanged:**
- the Role and the three reading sections;
- the render, the lifted pairs and the expected answers;
- the grade and the cap of 400.

The rubric outline is in `verdict.3.notes.md`. In short: the form per cell, each half against the question, the crux, whether the settling clause ever disagrees with the rebuttal, the size cells' common sense, h7's slide line, the second form on h5 and h10, and whether the verdict follows the sentence.

**A tangent for later** (the user, 2026-11-16): the framing will likely differ by the shape of the argument and the rebuttal once those prompts gain nuance. For example: "the argument says the teapot is glued to the table; the rebuttal says that is true but irrelevant to the larger question of whether tilting the table causes the tea to pour". That is the relevance attack's shape, and it is booked under the trial's later items.

### Verdict draft 4: skepticism stated

**Accepted by the user, 2026-11-16; built the same day on draft 3** ([`verdict.4.txt`](oracleLoopDrafts/trial/verdict.4.txt), its rubric in [`verdict.4.notes.md`](oracleLoopDrafts/trial/verdict.4.notes.md)).

**The diagnosis is the user's, after batch 11: form over validity.** The rebuttal always has the confident form of a valid counter-argument ("my opponent says 2 + 2 is 4, but the facts indicate it is 5"). The judge reads that form, decides its inputs contain a valid counter-argument, and looks no further. It explains TR-P16 to P18 as one mechanism:
- the guards are right every batch, since there form and validity agree;
- the argument wins only where the judge brings a counter-fact of its own (OC-3 in batch 11, OC-18 in batches 9 and 10);
- draft 2's "follows" was answered by the rebuttal's own "which implies".

**A correction to batch 8's reading** (mine): its sound arguments' rebuttals were "visibly false" only to a reader of validity. To a reader of form, the false rebuttals look exactly like the true ones.

**The idea is the user's:** prompt Micro to be skeptical, saying plainly that an input may not be true, rather than tweaking format, which is always a little fragile.

**One change** (wording mine). Two sentences are added at the end of Reading the argument and the rebuttal:

> Both were written by sides told to argue their position as strongly as they can, whatever is actually so, so each states its claims with the same confidence whether they are true or not. A quoted line shows only what that line says; what a side draws from it may or may not follow.

The sentences have three properties:
- **a fact about the inputs,** the triad's own design;
- **symmetric** between the two sides;
- **positive,** with no "do not".

The evidence that Micro takes epistemic status from wording comes from the play-by-play: "might get in the way" kept problems hypothetical, and "runs into" made them actual.

**The risks:**
- over-applied skepticism turning down the guards' true rebuttals;
- prose that Micro reads past, as prose definitions were in the judge drafts.

**Unchanged:**
- draft 3's disagreement sentence;
- the render, the cells and the cap.

### Verdict draft 5: the two voices tagged

**Accepted by the user, 2026-11-16; built the same day** ([`verdict.5.txt`](oracleLoopDrafts/trial/verdict.5.txt), its rubric in [`verdict.5.notes.md`](oracleLoopDrafts/trial/verdict.5.notes.md); the render split as `renderArguedParts`, the verdict's pins moved, the rebuttal's unchanged). The idea and the tag names are the user's: mark the argument and the rebuttal with XML-style tags, to make it as clear as possible that they are two different and opposing voices. The user chose `<argues-plan-cannot-happen>` (and so `<argues-plan-can-happen>`). The user's understanding from research is that Nova Micro is trained on internal XML-style tags and may respond to them strongly. The placement, the wording and the rubric are mine.

**Why** (batch 12; TR-P19). Draft 4's skepticism, stated in a reading section, was read past. The render sets up the two as voices only weakly:
- **Labels name roles, not voices:** `The argument against the plan, turning on the step "…": …` and `The rebuttal: …`. Until draft 4, nothing said who wrote either, or that either had a stake.
- **They read as one conversation,** by Slice B's design (mine): the rebuttal on the line straight after the argument, "so 'But …' reads as its reply".
- **No boundary separates the rebuttal's voice from the scene's.** The scene is fenced (`Scene:` … `End of scene.`), but the two sides are bare lines after it, and the rebuttal quotes scene lines word for word. Batches 10 to 12 gave the rebuttal's claims as the scene's: OC-18's "which the scene says is true about the cup being large enough", and h7's "which the scene says is true that the cup remains intact".

**What tags may do that draft 4 didn't:**
- **They put each side's stance on its text, at the literal place,** where draft 4 put it in a background section. Tight steps at a literal place worked in the judge drafts where prose definitions didn't, and a label has moved Micro before (`Picture` renamed `Play-by-play`: 0 of 3 to 2 of 3).
- **They give the boundary a mark:** a scene line quoted inside `<argues-plan-can-happen>` is visibly that side speaking.

**One change: the two sides tagged, and the Role naming the tags.** The two parts go together, since the tags only tie to the answer keys if the prompt says which is which.
- **The render** (the verdict's only; the rebuttal stage's render is untouched). The scene, the request and the steps come first, then the question line, outside both tags, since it is the neutral yardstick. Then:
  ```
  <argues-plan-cannot-happen>
  The argument against the plan, turning on the step "…": …
  </argues-plan-cannot-happen>
  <argues-plan-can-happen>
  The rebuttal: …
  </argues-plan-can-happen>
  ```
  The lines inside are as now, so the answer keys `argument` and `rebuttal` keep their labels.
- **Role, its list of inputs:** "… then the question the argument answers, the argument, in `<argues-plan-cannot-happen>`, and the rebuttal, in `<argues-plan-can-happen>`."
- **Unchanged:**
  - draft 4's two skepticism sentences, which the tags may give a concrete referent ("both were written by sides told to argue …");
  - draft 3's disagreement sentence and the verdict's rule;
  - the cells and the expected answers;
  - the grade, the answers and the cap of 400.

**The risks:**
- **Tag names about the plan may pull the judge back to judging the plan freely,** where the strict comparison settles only the disputed point. Read whether the settling clause speaks of the plan or the crux.
- **The tags echoed into the reply.** That is harmless unless it displaces the sentence form.
- **The guards:** true rebuttals turned down once the rebuttal is marked as a voice with a stake (the mirror fault).
- **Micro may read past the tags** as it read past draft 4's sentences.

**The rubric outline** (in full in `verdict.5.notes.md` before the batch), against batch 12's 5 of 10, every answer as batch 11's:
- **The settling clause,** the main measure: how many disagree with the rebuttal (batches 11 and 12: 1 of 11)?
- **The scene-attribution:** does any clause still give the rebuttal's claim as what the scene says (OC-18, OC-11, h7)?
- **The size cells:** whether common sense settles against the rebuttal.
- **The guards:** still right.
- **h7:** the slide line.
- **h5 and h10:** the crux, and whether the second form is ever used.
- **The tags in the reply,** and whether either side is named as a voice ("the side arguing …").
- **The verdict follows the sentence.**
- **Form, length, cut-offs.**

**What changes, if accepted:**
- `trial/verdict.ts`: the render, with the argued part split from `renderArgued` so the tags can wrap each side. The rebuttal stage's renders stay byte-identical, held by their pins.
- The verdict's tests.
- `renderPins.test.ts`: the verdict's pins move to batch 13's hashes after the batch.
- `verdict.5.txt` (draft 4 with the Role's list amended) and `verdict.5.notes.md`.
- The trial `iterations.md` (TR-L13); here, the trial item; calibration `AGENT.md`'s verdict paragraph (the render).

A deploy is needed, since the render changes. Batch 13 is 11 cells x1 on the lifted pairs.

### Verdict draft 6: skepticism in the decision

**Built 2026-11-16, on draft 5** ([`verdict.6.txt`](oracleLoopDrafts/trial/verdict.6.txt), its rubric in [`verdict.6.notes.md`](oracleLoopDrafts/trial/verdict.6.notes.md)). The direction is the user's, after batch 13: first just move the skepticism into the decision, and see whether Micro can apply judgment with only that instruction. The placement and the lead-in wording are mine. The batch is the review: the change is draft 4's sentences moved.

**Why** (batches 12 and 13). The skepticism stated in a reading section was read past, and the tags didn't change that. Batch 13's one moved answer (OC-18) came with a clause weighing what the quoted line shows on its own, the sentence acted on for the first time. TR-P7's pattern says an instruction no step uses is ignored.

**One change.** Draft 4's two sentences move from Reading the argument and the rebuttal into the Task. They sit straight after the first form's template, led in by "For the last part, what is actually so about that point, take neither side's word for it: …". Everything else is draft 5's.

**If it falls through, next** (the user's, 2026-11-16, booked): the judge labels the argument and the rebuttal **separately**, each as strong or weak, possibly with a third label, **desperate**, for a reply that is really reaching. The user's example is "the fiction doesn't determine what relative size the table and cup are" (batch 13's OC-18 clause, in the rebuttal's favour, or the facts branch on the size cells). It is to be discussed before it is designed.

### Verdict draft 7: the ordinary as the default

**Accepted by the user, 2026-11-16; built the same day** ([`verdict.7.txt`](oracleLoopDrafts/trial/verdict.7.txt), its rubric in [`verdict.7.notes.md`](oracleLoopDrafts/trial/verdict.7.notes.md)). The diagnosis and the rule are the user's, after batch 14, and so is the wording of the rule's first half. The placement, the scope, the second half's wording and the rubric are mine.

**The diagnosis** (the user's). Resting a rebuttal on what the scene doesn't say is not necessarily a failure. The user's example: "Incoming argues that the key cannot be put into the box because it's a huge decorative key and the box is a jeweler's ring box, but neither of those things are established in the scene, the arguer just invented those details". So "not established" can't simply be marked a losing move. The fault is in how a scene is read. "If it's not said in the scene, it's not established" is too strong: most scenes don't establish a breathable atmosphere. What was meant is closer to "a variance from the obvious norm is not established unless the scene says it". What is not established tends to default toward common sense, not toward what would have been mentioned if it were true.

**Where the strict reading lives** (mine). Reading the scene doesn't say "unstated means unestablished". It says "the scene below is what has been established about this place" and is silent on defaults, so "established" reads as exhaustive. The strictness is stated outright elsewhere:
- in the rebuttal's contract: draft 1's kind "a detail the scene could have given but didn't", and draft 5's branch "the only facts the scene and the steps establish about …";
- in verdict draft 6's step: "a quoted line shows only what that line says".

So the fix adds a default rule, not removes a sentence.

**The same reading behind more of the record** (mine):
- the rebuttal's universal "not established" (TR-P4);
- the judge's absence against the argument (TR-P20);
- the non-rule cell's over-asking for action detail (batch 1), and its draft 5 "Not given" tag gathering invented preconditions (NR-P9).

Each treats "unstated" as "unknown" rather than "ordinary".

**One change, on draft 5** (6 of 10, the best so far; draft 6's step-skepticism, which backfired, stays out). A sentence is added to the end of the verdict's Reading the scene:

> Things are as such things ordinarily are, except where the scene says otherwise: a detail the scene leaves out is expected to have some ordinary value, and a claim that something departs from the ordinary needs the scene to say so.

"Is expected to have some ordinary value" is the user's wording, in place of my "takes its ordinary value", which implied a single default. The range matters:
- **The whole ordinary range on one side settles the point:** no ordinary table fits inside an ordinary cup.
- **A range that spans both outcomes leaves it open,** rightly: some long oak trestles one person can lift, some not. That is OC-9's skill-or-chance (JF-2).

**What the rule decides on the cells.** Neither side needs a quote; the side that relies on a departure from the ordinary carries the burden. That is symmetric, as draft 6 wasn't.

| Cell | The departure | Favours |
| --- | --- | --- |
| The size cells | a table small enough to go inside a cup | the argument |
| OC-1, OC-20 | a small tea table too heavy for one person | the rebuttal |
| OC-6 | tea that must be moved to another container before pouring | the rebuttal |
| OC-2 | empty hands keeping a cup from being lifted | the rebuttal |
| OC-9 | open, the range spanning | ungraded |

**Where it won't help:** h7 contradicts a stated line (the slide), which is not a matter of defaults, and h5 and h10 are dodges. Those stay open.

**Scope: the verdict first** (mine). Reading the scene is shared word for word by the non-rule cell, the case against, the rebuttal and the verdict, and the rebuttal's facts branch is the strict reading in contract form. If the verdict shows the rule works, the shared section, and the rebuttal's branch with it, is the larger change after this. It is kept apart so this test stays one change.

**The rubric outline** (in full in `verdict.7.notes.md` before the batch), against batch 13's 6 of 10:
- **The settling clause:** does it appeal to the ordinary ("a table doesn't ordinarily fit in a cup"), and on which side?
- **The size cells,** above all OC-11, wrong in every batch.
- **The guards:** still right, now possibly on the ordinary as well as the line.
- **OC-9:** whether the range is read as open.
- **The absence move** (TR-P20): any clause still settling by "the scene doesn't specify".
- **h7, h5 and h10:** read, not expected to move.
- **The verdict follows the sentence; form, length, cut-offs.**

**What changes, if accepted:**
- `verdict.7.txt` (draft 5 with the sentence added) and `verdict.7.notes.md`;
- the trial `iterations.md` (TR-L16);
- here, the trial item.

No code changes and no deploy (the prompt is in the payload). Batch 15 is 11 cells x1 on the lifted pairs.

### Verdict draft 8: evaluation at the task site, as a pair

**Accepted by the user, 2026-11-16; built the same day on draft 7** ([`verdict.8a.txt`](oracleLoopDrafts/trial/verdict.8a.txt), [`verdict.8b.txt`](oracleLoopDrafts/trial/verdict.8b.txt), the rubric in [`verdict.8.notes.md`](oracleLoopDrafts/trial/verdict.8.notes.md)).

**Why** (the user's questions after batch 15):
- **Does anything in the judge prompt ask it to judge whether the two sides reason soundly,** or does it leave the door open to "which looks more like what we describe"? Mine, on reading draft 7: nothing does. The Task is a template, "whichever of these two forms fits", with slots for copying, naming and choosing a source, and a verdict by agreement. The reading section describes the rebuttal by the very form every rebuttal has. Micro did what was asked, which is now an entry in [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
- **Has anything disproven that an attitude applied directly at the task site would have influence?** No.
  - Drafts 4, 5 and 7 put a stance in a reading section, with no evaluating step for it to modify.
  - Draft 6's sentence at the task site had an effect, in the wrong direction.
  - "Evaluate … skeptically" has never been tried: no draft since 2 has had an evaluating verb.

**One change, in a pair.** The user's wording ("Evaluate the validity of the claim by using the 'Read the scene' instructions to skeptically consider this claim in the context of the larger scene") is fitted to the template's settling part, where draft 6's sentence sat:
- **8a:** "For the last part, what is actually so about that point, evaluate the validity of each side's claim by using the Reading the scene instructions above to skeptically consider that claim in the context of the larger scene."
- **8b:** the same without "skeptically".

**Mine:**
- "each side's claim", for evenness, against TR-P20;
- the section named by its label;
- running the two as a pair. 8b against batch 15 tests the evaluating operation, tied to Reading the scene and its ordinary-default rule. 8a against 8b tests the manner word at the task site.

The rubric is in the notes. **Batch 16** is two payloads, 16a and 16b, 11 cells x1 each, with no deploy.

### Rebuttal draft 3, first design: gather the lines, then the claim (withdrawn)

**Withdrawn before review** (the user, 2026-11-15: the problem hadn't been diagnosed enough for a next design; kept as a record of the option). Mine, from batch 4. The aim is still the user's chain (read, find the weak point, classify), with the reading made an operation that has an output.

**Why** (rebuttal batch 4):
- **The chain was done as headings,** each holding only its answer, with no reading in between.
- **The claim was the whole argument** in 11 of 11 replies (TR-P6).
- **The evidence was found by chance:** OC-11 found "a small round tea table" and OC-1, on the same scene, did not. The search for evidence came after the claim, so the argument's wording framed it.

**The change:** one step put in front of the chain, the gathering. The claim and the evidence then come from what was gathered.
1. **`lines`:** every line of the scene and the steps that mentions a thing the argument names, quoted. For OC-1 the argument names the table, so `lines` holds the table's Fiction sentence and its Graph row, "[table1] Table (a small round tea table), in the Parlour". It is a lookup by thing, with an output.
2. **`claim`:** one assertion the argument makes about one thing, in a few words ("too large and heavy"), quoted from the argument. This is aimed at TR-P6.
3. **`evidence`:** the gathered line that bears on the claim, or `"none"`.
4. **`kind`, then `rebuttal`,** as in draft 2.

The block is `{"lines": […], "claim", "evidence", "kind", "rebuttal"}`, in that order.

**The check:**
- each of `lines` quotes a render line;
- `evidence` is `none` or falls inside one of `lines`;
- `claim` is as before.

**TR-P5 is fixed:** a line quoted with its role label or list marker, as the prompt shows it, passes.

Mine, the alternatives:
- **Missing lines:** omitted lines are left to the reader, not the check. Code can't map the argument's "the table" to `[table1]` without matching names, and a strict check would hide answers, as NR-P7's did.
- **A whole-argument claim:** left to the rubric, not flagged by the check.

**The cap:** 400 to 600 tokens (mine), since `lines` can be several rows.

**One change**, the gathering, with the check fault fixed alongside it.

**Unchanged:** the cells and lifted arguments (so batch 5 compares like for like with batches 3 and 4), the render, the Role, the Reading sections, and the kinds' definitions.

**The rubric outline** (in full in `rebuttal.3.notes.md` before the batch):
- **Weak arguments, the main measure:** does OC-1's and OC-20's `lines` hold "small round tea table"? Is it then the `evidence`, with `wrong`?
- **Gathering:** lines missed, and lines that aren't about the named things.
- **The claim:** a part of the argument, or still the whole?
- **Sound arguments:** OC-11 and OC-18 will likely gather the same line and misuse it ("small, so it could fit"). Read whether the misuse is visible. h7: is the slide gathered, and how is it used?
- **The kinds' spread,** length, and the quote checks.

**What changes, if accepted:**
- `trialRebuttal.ts`: the `lines` check, evidence matched against `lines`, labels accepted, `maxTokens` 600; and its tests;
- `rebuttal.3.txt` and `rebuttal.3.notes.md`, for review before the batch;
- here: the trial item;
- calibration `AGENT.md`.

A deploy, since the check changes.

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
   - [ ] **Next: what to consider, generated on its own** (the user's, 2026-11-13, after batch 5). **Design accepted and built** (2026-11-13): [The considerations proposal](#the-considerations-proposal-what-to-consider-generated-on-its-own); the `stepConsiderations` read piece, [`1.txt`](oracleLoopDrafts/stepConsiderations/1.txt) and its rubric in [`1.notes.md`](oracleLoopDrafts/stepConsiderations/1.notes.md), batch 1 run ([results](oracleLoopDrafts/stepConsiderations/1.notes.md#results-2026-11-13-batch-1): an inventory, not what bears; the size absent on the size cells; the player's ability kept out). **Draft 2** (mine, approved by the user 2026-11-14; [notes](oracleLoopDrafts/stepConsiderations/2.notes.md)): the four kinds replaced by "facts about the things it involves, and how they relate to each other and to what the step asks of them", items as short statements. Batch 2 ([results](oracleLoopDrafts/stepConsiderations/2.notes.md#results-2026-11-14-batch-2)): statements 11 of 11, the size on the size cells, h7 carried forward; verdicts inside the items, 10 of 11; knock-ons missing. Kept as the base, then paused for the trial. **The single-list variant** (the user's question, SC-L2) is booked after the content is relational; drafts tracked in [its own `iterations.md`](oracleLoopDrafts/stepConsiderations/iterations.md). A read piece lists, per step, what should be considered, with no finding. Judging the assembled list, probably against draft 4's categories, is a later pass, booked once the list looks right.
   - [ ] **Next: the trial, argue against, rebut, judge** (the user's, 2026-11-14, after `stepConsiderations` batch 2; [design](#the-trial-proposal-argue-against-rebut-judge)). Three small biased calls in place of one balanced one, built and probed one piece at a time. **Order agreed** (user, 2026-11-14): the triad first, on the cells the consequences gap doesn't touch, with h5 and h10 read apart; then consequences (intended lines, state lines on h10), since only the hops depend on them and the triad is the larger unknown. Drafts, problems (TR-P) and library (TR-L) are in [the trial's `iterations.md`](oracleLoopDrafts/trial/iterations.md).
     - [X] **Stage 1, the case against (`trialAgainst`), draft 1.** Batch 1: the securing argued in 10 of 11 (TR-P1). Batch 2, the securing omitted (TR-L2): the size 3 of 3, h7's slide, and the pours lose the teapot's tilt (TR-P3) ([results](oracleLoopDrafts/trial/against.1.notes.md#results-2026-11-14-batch-2-the-securing-omitted)). Kept, pending the user.
     - [X] **Stage 2, the rebuttal (`trialRebuttal`): draft 5 is the base** (mine, pending the user). The drafts:
       - [X] Draft 1, a concise rebuttal with its kind (batch 3): `not established` 9 of 11, uniform (TR-P4) ([results](oracleLoopDrafts/trial/rebuttal.1.notes.md#results-2026-11-14-batch-3)).
       - [X] Draft 2, claim, evidence, kind ([design](#rebuttal-draft-2-claim-evidence-kind); batch 4): the chain taken as headings, the tell inverted ([results](oracleLoopDrafts/trial/rebuttal.2.notes.md#results-2026-11-15-batch-4)). Its successor's first design was withdrawn ([gather the lines](#rebuttal-draft-3-first-design-gather-the-lines-then-the-claim-withdrawn)) until [the failure was diagnosed](#the-rebuttals-failure-diagnosed-2026-11-15): the answer without the question (the user's mechanism).
       - [X] Draft 3, the question supplied ([design](#rebuttal-draft-3-the-question-supplied-the-separating-test); batch 5): inconclusive, the question never used (TR-P7) ([results](oracleLoopDrafts/trial/rebuttal.3.notes.md#results-2026-11-15-batch-5)). Golden and lifted inputs added (`stageInput.ts`).
       - [X] Draft 4, evidence then both attacks ([design](#rebuttal-draft-4-evidence-then-both-attacks); batch 6): evidence quoted but not argued from; the slots misread (TR-P8 to P10) ([results](oracleLoopDrafts/trial/rebuttal.4.notes.md#results-2026-11-15-batch-6)).
       - [X] Draft 5, one sentence, "but the scene says …" ([design](#rebuttal-draft-5-one-sentence-incoming-argues-but); the user's shape). Batch 7: the summary dropped (TR-P12, not a fault: the render ends on the argument), world claims 11 of 11 ([results](oracleLoopDrafts/trial/rebuttal.5.notes.md#results-2026-11-15-batch-7)). Batch 8, confirmed at x3: weak arguments rebutted truly from a quoted line 12 of 12, sound ones visibly falsely 9 of 9; h7 never quotes the slide (TR-P14); h5 and h10 invent stability ([results](oracleLoopDrafts/trial/rebuttal.5.notes.md#results-2026-11-16-batch-8)).
     - [x] **Slice A: the trial family, the two stages built so far** (the user's idea, 2026-11-16; [design](#the-trial-family-one-harness-kind-the-stage-by-specifier)). **Built** (2026-11-16): one harness kind, `trial`, with `options.stage` and the stage's own options, over one trial record per cell (`oraclePieces/trial/`); the names `trialAgainst` and `trialRebuttal` retired. Every stage's renders pinned by test to batches 1, 2 and 8's inputs hashes, green before and after the move, so no batch. TR-P13 fixed: batch 8 replays at 31 of 33. A step toward step 4's chaining. Deploy before the next trial payload.
     - [x] **Slice B: the verdict stage (`trialVerdict`).** **Accepted and built** (2026-11-16; [Slice B's design](#slice-bs-design-the-verdict-and-the-stage-contract)): the stage `verdict`, answered, graded through its contract; `llm/stageContract.ts` with each trial stage's `contract`; `lifted.consumed` and `pickPaired`; batch 8's rebuttals lifted (repeat 1, OC-3 repeat 2); [`verdict.1.txt`](oracleLoopDrafts/trial/verdict.1.txt) and its rubric in [`verdict.1.notes.md`](oracleLoopDrafts/trial/verdict.1.notes.md). Deploy before batch 9. The typed stage contract (each stage's `Input`, `Output` and `parse`, shared by the probe and production; [design](#the-trial-family-one-harness-kind-the-stage-by-specifier)), the pairing rule (`lifted.consumed`), the batch 8 rebuttals recorded as lifted values, the render (the argument, then the rebuttal as its reply), the check and the cells. **The verdict's prompt and reply get their own design here before it's built.** h7 tests whether the judge reads an evasion as weak (TR-P14).
       - [x] **Batch 9:** verdict draft 1 on the lifted pairs, 11 cells x1: 6 of 10. The guards 4 of 4, h7 right with the slide line stated; the size cells 1 of 3, the judge accepting "small round, so it fits" (TR-P16); every description restates the inputs (TR-P15) ([results](oracleLoopDrafts/trial/verdict.1.notes.md#results-2026-11-16-batch-9)). The verdict's base. Its next draft is designed here before it's built.
       - [x] **Verdict draft 2: the exchange as the object** (the user's direction, 2026-11-16, from [the diagnosis](#verdict-draft-2-the-exchange-as-the-object): the argument and the rebuttal were second-class data). **Accepted and built** (2026-11-16; [`verdict.2.txt`](oracleLoopDrafts/trial/verdict.2.txt), [rubric](oracleLoopDrafts/trial/verdict.2.notes.md)). Deploy before batch 10. A reading section for the argument and the rebuttal; the Task judging "which argued better" by whether the rebuttal's reply follows from its source and answers the argument's claim; h10 re-expected as `argument` (mine). The scene's reading instructions unchanged until after this draft (the user).
       - [x] **Batch 10:** verdict draft 2 on the lifted pairs, 11 cells x1: 5 of 10, against batch 9 rescored (7 of 10). The description takes up the rebuttal's reply and the verdict follows its tests, 11 of 11; but "follows" and "answers" are affirmed by echo of the rebuttal's own "which implies" (TR-P17), `rebuttal` 10 of 11, and h7 loses the slide line ([results](oracleLoopDrafts/trial/verdict.2.notes.md#results-2026-11-16-batch-10)). The deploy graded h10 against its old expected answer; rescored by hand.
       - [x] **Verdict draft 3: the point of disagreement** (the user's aim, 2026-11-16: synthesis of the two in context with each other; [design](#verdict-draft-3-the-point-of-disagreement)). **Accepted and built** ([`verdict.3.txt`](oracleLoopDrafts/trial/verdict.3.txt), [rubric](oracleLoopDrafts/trial/verdict.3.notes.md)): the description is one sentence naming what the two disagree about and what settles it, or that the rebuttal answers a different question.
       - [x] **Batch 11:** verdict draft 3 on the lifted pairs, 11 cells x1: 5 of 10. The sentence in the first form 11 of 11 and the crux often right (OC-11, h7); but the settling clause continues the rebuttal's half, copied whole just before it, 10 of 11 (TR-P18); the second form unused; `rebuttal` 10 of 11 ([results](oracleLoopDrafts/trial/verdict.3.notes.md#results-2026-11-16-batch-11)).
       - [x] **Verdict draft 4: skepticism stated** (the user's diagnosis, form over validity, and the user's idea, 2026-11-16; [design](#verdict-draft-4-skepticism-stated)). **Accepted and built** on draft 3 ([`verdict.4.txt`](oracleLoopDrafts/trial/verdict.4.txt), [rubric](oracleLoopDrafts/trial/verdict.4.notes.md)): two sentences saying both sides were written to argue whatever is so, and that a quoted line shows only what it says.
       - [x] **Batch 12:** verdict draft 4 on the lifted pairs, 11 cells x1: 5 of 10, every answer as batch 11's. No reply shows skepticism; the settling clause still gives the rebuttal's claim as the scene's. Read past, since no step uses the sentences (TR-P7's pattern) ([results](oracleLoopDrafts/trial/verdict.4.notes.md#results-2026-11-16-batch-12)).
       - [x] **Verdict draft 5: the two voices tagged** (the user's idea and tag names, 2026-11-16; [design](#verdict-draft-5-the-two-voices-tagged)). **Accepted and built** ([`verdict.5.txt`](oracleLoopDrafts/trial/verdict.5.txt), [rubric](oracleLoopDrafts/trial/verdict.5.notes.md)). Deploy before batch 13. The argument in `<argues-plan-cannot-happen>` and the rebuttal in `<argues-plan-can-happen>`, the question outside both, the Role naming the tags; on draft 4. Before moving the skepticism into the step (the user's order).
       - [x] **Batch 13:** verdict draft 5 on the lifted pairs, 11 cells x1: 6 of 10. Only OC-18 moved, to right, its settling clause the first to weigh whether the quoted line supports the rebuttal's claim; otherwise as batch 12. No tag echoed; the scene-attribution persists (OC-11, h7) ([results](oracleLoopDrafts/trial/verdict.5.notes.md#results-2026-11-16-batch-13)).
       - [x] **Verdict draft 6: skepticism in the decision** (the user's direction, 2026-11-16; [design](#verdict-draft-6-skepticism-in-the-decision)). **Built** on draft 5 ([`verdict.6.txt`](oracleLoopDrafts/trial/verdict.6.txt), [rubric](oracleLoopDrafts/trial/verdict.6.notes.md)): draft 4's sentences moved from the reading section into the Task, on the settling clause.
       - [x] **Batch 14:** verdict draft 6 on the lifted pairs, 11 cells x1: 4 of 10, `rebuttal` 11 of 11. The skepticism in the step was read as "the scene doesn't establish it", against the argument's unquoted claims (TR-P20). Falls through ([results](oracleLoopDrafts/trial/verdict.6.notes.md#results-2026-11-16-batch-14)).
       - [x] **Verdict draft 7: the ordinary as the default** (the user's diagnosis and rule, 2026-11-16; [design](#verdict-draft-7-the-ordinary-as-the-default)). **Accepted and built** ([`verdict.7.txt`](oracleLoopDrafts/trial/verdict.7.txt), [rubric](oracleLoopDrafts/trial/verdict.7.notes.md)). A sentence in the verdict's Reading the scene: a detail the scene leaves out is expected to have some ordinary value, and a departure from the ordinary needs the scene to say so. On draft 5; the shared section after.
       - [x] **Batch 15:** verdict draft 7 on the lifted pairs, 11 cells x1: 5 of 10, every answer as batches 11 and 12; the rule never appears in a reply, read past in a reading section. Across batches 11 to 15, the settling clause's source decides: "the scene says" gives `rebuttal` 42 of 43 (TR-P21) ([results](oracleLoopDrafts/trial/verdict.7.notes.md#results-2026-11-16-batch-15)).
       - [x] **Verdict draft 8: evaluation at the task site, as a pair** (the user's questions and wording, 2026-11-16; [design](#verdict-draft-8-evaluation-at-the-task-site-as-a-pair)). **Accepted and built** on draft 7 ([`verdict.8a.txt`](oracleLoopDrafts/trial/verdict.8a.txt), [`verdict.8b.txt`](oracleLoopDrafts/trial/verdict.8b.txt), [rubric](oracleLoopDrafts/trial/verdict.8.notes.md)): "evaluate the validity of each side's claim by using the Reading the scene instructions above to [skeptically] consider that claim in the context of the larger scene", with and without "skeptically".
       - [x] **Batch 16:** verdict drafts 8a and 8b, two payloads, 11 cells x1 each: both 4 of 10, `rebuttal` 11 of 11, identical cell by cell. "Skeptically" at the task site shows no effect; the evaluation was read as consistency with the scene, whose only text on the point is the rebuttal's line; "the scene says" 22 of 22, OC-3 lost ([results](oracleLoopDrafts/trial/verdict.8.notes.md#results-2026-11-16-batch-16)).
       - [x] **Checkpoint (d), the verdict, after batch 16** (2026-11-16; the first since the verdict began, eight batches in). **The user: keep drafting the judge.** The mechanism, as it stands: the judge does what its step asks; stances outside the step are read past; it reads from whatever source the step names; and the rebuttal's quote is the only scene text on the point, so any check against the scene finds the rebuttal agreeing with it. The bar for passable is unchanged.
      - [ ] **The trial's question, a prototype in its own plan** ([`AGENT.trialQuestion.planning.md`](AGENT.trialQuestion.planning.md), opened 2026-11-16). The user's hypothesis: an adversarial question framing the judgment may let free judgment work where the single cell didn't, with the case against's job becoming "find a question you think the judge will, upon consideration, agree proves the plan impossible". Its first probe is the judge answering the golden questions alone. It folds back here when it finishes.
       - [ ] **Each side labelled separately** (the user's, 2026-11-16): the judge labels each side strong or weak, perhaps a third label, desperate, for a reply that is reaching. A call per side is my question, not the user's. Discussed after batch 14: "not established" isn't necessarily desperate (the user's key-and-ring-box example), which led to draft 7. Held.
     - [ ] **Later in the trial:**
       - the relevance attack as its own sentence, once the answer side works (left out of draft 5); with it, the verdict's framing per shape of argument and rebuttal (the user, 2026-11-16: "the argument says the teapot is glued; the rebuttal says that is true but irrelevant to whether tilting the table causes the tea to pour");
       - golden cells for salient-but-irrelevant arguments and the guards (the glue), where the facts branch and the relevance attack should be strong;
       - golden rebuttals, the strongest a rebuttal could make, so the verdict runs on `upstream: 'golden'` too (none written in Slice B);
       - the case against giving its question, so a lifted argument fits the rebuttal's current contract;
       - chaining the three in code, in step 4;
       - **system instructions and user input, delivered apart** (the user, 2026-11-16, to check later). Nova Micro is trained on a distinction between system instructions and user input, and the probe doesn't use it: `runProbeCalls` sends the draft and the cell's render together as one `user` message (`oracleLoop/runOracleProbe.ts`), and `llm/invokeBedrockConverseText` takes no `system` parameter (checked 2026-11-16). To check what is done behind the scenes, and whether the Bedrock utilities need more delivery options, such as the draft as the `system` prompt and the render as the user turn. A delivery change moves every piece's batches, so it is probed as a change of its own.
   - [ ] **Then: the skill-or-chance finding** (the booked item below), as a contract change of its own: a fourth finding that code can tell apart. Draft 5's "difficult" factors show how much it's needed. Batches 3 and 4 had "difficult" under "blocked" in at least six replies, and OC-9 asking for "the player's capability".
   - [ ] **Then: intended consequences** (the user's, 2026-11-13; [NR-L10](oracleLoopDrafts/nonRuleCell/iterations.md#library)). A line under a step can be something the method relies on (intended: "[teapot1] tilts with [table1]"), not only a side effect. A failure of an intended line routes toward an alternate method, as a method step's does; a side effect routes toward a mitigation. It is designed here first as a step-layout amendment, since it changes the OC-30 cells' inputs and who writes such lines in composition (the imagination plan's question). It then becomes a draft.
   - **The securing, tested** (`trialAgainst` batch 2, 2026-11-14): option (b), left out of what the case against sees. With it gone, the size is argued 3 of 3 and h7's slide is argued rightly; the cost is the pours' teapot tilt (TR-P3), for intended consequences or option (a). The user: this is more defensible now that a special-purpose prompt, the rule cell, judges the scene with the securing and is told to focus on it. **Held until then: the securing (batch 4's main failure).** The glue or chain read as holding a thing still decides OC-1, OC-6, OC-20 and every OC-30 pour. Option (a) is the rules' consequence in the scene (below); option (b) is the securing left out of what this piece sees. Mine: (a), since the pours need the teapot to move with the table. It is held until draft 5 shows whether "effect unclear" catches the glue by itself, and intended consequences cover the pours.
   - **A candidate, not booked: the rules' consequence in the scene** (mine, from batch 2; it revisits NR-6, the user's call). OC-1's replies read glue as stopping the pair from moving, not as moving them together, and h10's as a teapot that "would fall off or break". The piece has the fact ("glued to") and not its consequence ("moves with what it is secured to"), which the imagination's `rules: 'consequence'` wording gives. To be weighed after draft 3, whose `establishes` slot may show the misreading in its own words.
   - **Booked, next after draft 5 (above): a skill-or-chance outcome** (user, 2026-11-13). Sometimes "I don't know whether that's possible" isn't answered by more detail of the situation: the attempt may or may not work out, depending on the character's skill and on chance. That is a separate exit from the loop, not a request to the imagination. It may take tuning to get it answered without contradicting the instructions that look for a plain physical impossibility as written. This is the parent's JF-2 (`challenging`, "possible, and hard") in this piece's per-step form, and OC-9's trestle is its cell. It is a later iteration, not a gate on this plan's exits; it may land in either round. OC-9 is excepted from the bar for (b), since it has no expected answer.
4. [ ] **The composition probe, first form: what exists** (the parent's Slice 4.5, mine, revised 2026-11-13). *Note (2026-11-18):* `playByPlay` is being reshaped to expand one step of an action plan in place, in [its own plan](AGENT.playByPlayExpand.planning.md), with this plan's "more detail of the action" request (NR-3) as its consumer; the adapter below may read its sub-steps instead. `playByPlay` feeding the settled rule cell through an adapter (its lines for the named things; the silence contract for a rule's other end), with code asking `playByPlay` first, on OC-1, OC-6 and OC-20. Each hop's inputs and answer are logged. **Rests on** IM-5's provisional split. **Consumer:** a batch read per hop. It tests the reading direction, and gives the harness the next step plugs into. It doesn't touch the non-rule cell, so it can run beside step 3. **A step toward it is in step 3:** the trial family (Slice A) records the stage order and each lifted value's provenance, where chaining the trial's three pieces in code will go. Slice B's stage contracts give each stage a typed output to pass on. Read for their future place, not wired: production would take a contract's `parse` in `llm/pipeline`'s `defineLlmInvokeStep`, in `applyOutputs`; the actions pipeline's LLM slot is the `adjudicateDeferred` stub today.
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
- **Golden and lifted inputs for a later stage** (the user, 2026-11-15). A piece fed by an earlier stage gives each cell two sources for that stage's part:
  - **`golden`:** hand-written in the earlier stage's contract form, and no better than that contract asks for. It isolates the later piece's failures, and it is the earlier stage's target made concrete.
  - **`lifted`:** a real output of the earlier stage, with its source batch and repeat. It tests robustness to the earlier stage's realistic failures.

  A payload names its source with `upstream: 'golden' | 'lifted'`; there is no default. The trial's stages are one harness kind (Slice A), so a payload names `"piece": "trial"` and its stage too: `"options": {"stage": "rebuttal", "upstream": "golden"}`. A source a cell lacks throws at render, and the probe refuses the payload as a cell-data error. A lifted value recorded under an older contract counts as missing. One lifted value per cell, replaced when a newer batch is adopted. A lifted value that answered an earlier stage records what it `consumed` (that stage's source and the hash of the value it read), so a stage reading two upstream values (the verdict) shows the lifted one with the very value it answered, and an edit to that value since breaks the pair loudly (Slice B). Composition (steps 4 and 5) stays where the gap between the two is measured.
- **Every iteration is marked in this plan** (the user, 2026-11-15). Each draft's design is written here, minimally, before it's built, for review; a draft that changes a piece's contract or check gets a design section. Its batch's results are marked on its step 3 item as they land. The notes file holds the detail; the plan holds the record.
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
| Drafts in isolation (round 1) | Under way. The single piece: draft 3 is the base (drafts 2, 4 and 5 not kept; `cause` optional kept). `stepConsiderations` paused at draft 2. The trial: the case against kept on draft 1 (securing omitted); the rebuttal's base is draft 5 (batch 8, confirmed at x3); the trial family built (Slice A, 2026-11-16); the verdict built (Slice B, 2026-11-16), draft 1 at 6 of 10 (batch 9); draft 2 at 5 of 10 (batch 10), its tests filled by echo; draft 3 at 5 of 10 (batch 11); draft 4 (skepticism) at 5 of 10 (batch 12), read past; draft 5 (the voices tagged) at 6 of 10 (batch 13), one cell moved; draft 6 (skepticism in the decision) fell through at 4 of 10 (batch 14); draft 7 (the ordinary as the default) read past at 5 of 10 (batch 15); draft 8 (evaluation at the task site, a pair) at 4 of 10 both (batch 16). The bar for passable is provisional |
| The composition probe, first form | Not started |
| The cell in composition | Not started; gated on round 1's exit |
| Drafts in composition (round 2) | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the request contract to the parent's seam ledger for the rule cell's refactor. Then the parent's non-rule cell item is checked, and this plan is deleted.
