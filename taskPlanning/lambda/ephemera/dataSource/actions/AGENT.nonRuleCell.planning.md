# The non-rule cell: an oracle piece that answers with a verdict or a request

**Status (2026-11-13): step 1, the design pass (text only), done; step 2, the piece and its baseline, next. The step layout is agreed ([The step layout and the two shapes](#the-step-layout-and-the-two-shapes)), since it changes the question, and the question, the verdict set, the first request kinds and the reply's form (NR-1 to NR-4) are settled; the cells are reviewed, the inputs (NR-6) settled for the baseline, and the grading (NR-7) settled. No code yet.** Opened from the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, where the non-rule blocker was made next (user, 2026-11-13; [trail](AGENT.oracleLoop.discussion.planning.md#the-non-rule-blocker-first-the-rule-cell-later-2026-11-13)). It is renamed `nonRuleCell` here (user, 2026-11-13): under the verdict-or-request contract, `blocks` is one answer among several, and the name parallels `ruleCell`, its nearest analogue. The piece judges whether a plan can go ahead for reasons no rule names, such as stuffing a table into a teacup. It is the first oracle piece designed from the start to answer with a verdict **or** with requests typed by the imagination's asks ([trail](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12)), so the request contract is drafted here, on a new piece, and the rule cell adopts it later. **The composition probe's first two steps are built in this plan** (mine, 2026-11-13): a request's worth shows only in what comes back, so the cell's requests can't be graded without it. Its growth toward OC-30's chain may outgrow this plan; if so it gets its own.

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
| **The rule cell is settled on draft 3** (46 of 48), and stays so until this piece has matured the contract (user, 2026-11-13). Code asks `playByPlay` before calling it, so it never needs to ask | Observed on hand-written motions | Through the adapter (step 3): whether it holds on `playByPlay`'s real lines |
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
- What a step leaves is implied by the step, so there are no separate result lines. The knock-ons are steps, with the consequence role.
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
2. [ ] **The piece and its baseline.** `calibration/oraclePieces/nonRuleCell.ts`, registered in `pieces.ts`, with its tests; its drafts in `oracleLoopDrafts/nonRuleCell/` (`N.txt`, `N.notes.md`, `iterations.md` with Problems, Library and Ledger), laid out as the rule cell's. The probe's change from NR-7 (a piece's own grade, `lookFor` on an answered cell), with its tests. Draft 1 run on every cell, `repeats: 3`, Micro, with a rubric written before the batch. A fresh call's cell is written by hand or lifted from a `playByPlay` batch reply, as the rule cell's were, so no composition is needed to test the second call. **Consumer:** the batch.
3. [ ] **The composition probe, first form: what exists** (the parent's Slice 4.5, mine, revised 2026-11-13). `playByPlay` feeding the settled rule cell through an adapter (its lines for the named things; the silence contract for a rule's other end), with code asking `playByPlay` first, on OC-1, OC-6 and OC-20. Each hop's inputs and answer are logged. **Rests on** IM-5's provisional split. **Consumer:** a batch read per hop. It tests the reading direction, and gives the harness the next step plugs into. Can run beside step 2's drafts.
4. [ ] **The cell in composition.** Its requests dispatched to the imagination, the fresh call with and without the question asked (NR-5), and a round cap (IM-3). Graded per hop: each request warranted or not, each verdict against the corpus. **Consumer:** a batch on the cells where asking is right.
5. [ ] **Drafts,** one change per draft, from the baseline, in the piece probe and in composition as each problem calls for.
   - **Booked for a later iteration, not the baseline: a skill-or-chance outcome** (user, 2026-11-13). Sometimes "I don't know whether that's possible" isn't answered by more detail of the situation: the attempt may or may not work out, depending on the character's skill and on chance. That is a separate exit from the loop, not a request to the imagination. It may take tuning to get it answered without contradicting the instructions that look for a plain physical impossibility as written. This is the parent's JF-2 (`challenging`, "possible, and hard") in this piece's per-step form, and OC-9's trestle is its cell. It is a later iteration, not a gate on this plan's exits.
   - **Exits:** (a) the library has nothing left worth a draft; (b) every cell right, in the probe and per hop, for two batches running; (c) a batch shows the piece needs a new approach (a seam-ledger entry), such as fits and the request needing separate calls after all, or the one-pass shape failing where the per-step shape would be next (NR-8); (d) a checkpoint with the user every three batches.
6. [ ] **Hand back to the parent:**
   - seam-ledger entries: the request contract as it stands, for the rule cell's refactor to adopt; the "fits" stage's standing; what the adapter showed about the rule cell on real lines;
   - the request kinds this piece needed, to the imagination plan (its asks, and any new one);
   - the cell's reactions to `playByPlay`'s form, to the imagination plan, where it is held for; and what the flags experiment showed, if step 4 or 5 ran it ([options](AGENT.imagination.planning.md#what-is-inherited-as-settled): ignore, show for skepticism, classify each in its own call, or use in code), or the experiment itself, to the parent, if not;
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro);
   - the composition probe's state, to the parent's composition probe item, or to its own plan;
   - the skill-or-chance outcome (step 5), to JF-2, if no draft took it up.

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
| OC-9 | `tavern` | "pick up [table1]", a long oak trestle (I) | Open (JF-2) | The skill-or-chance outcome is booked for a later iteration (step 5). Until then, this cell shows what three outcomes do with a feat |

The three OC-30 cells are this piece's hops in the corpus's [OC-30 chain](AGENT.oracleLoop.corpus.planning.md#loop-cases) (hops 5, 7 and 10; the chain written 2026-11-13). Step 4 runs that chain in composition, and these hand-written forms test each hop alone first. **A candidate fourth cell, OC-31's turn 1**, is the first case of `needs detail` of the action: the bridge is on the far side, which no rule names. It waits on its scene being built.

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
| NR-4 | The reply's form: one fenced JSON block, a verdict or requests | The check | Step 1 | **Settled** (mine, accepted by the user, 2026-11-13), in step 1: describe first, then `allows`, `blocks` with the step quoted and the reason, or `needs detail` with `of`, the step quoted and what is missing; code matches the quote to one step. Amended (user, 2026-11-13): `blocks` quotes both `step` and `cause`, and code routes by `cause` |
| NR-5 | Whether the fresh call is told the question it asked | Step 4 | The composition probe | Open (from the trail) |
| NR-6 | What the piece sees: the scene, the actions, the intent; the imagination's lines and flags on a fresh call; the rules shown or not (PB-2's analogue: the rules are the rule cell's) | Render | Step 1, then the drafts | **Settled for the baseline** (2026-11-13). The step layout (user): the scene, the request, and every step in order with its role, with no result lines and no relevance filter. The roles shown, as NR-1 has them, worded by the drafts. The request in its own section (mine, agreed by the user). No Rules section, so the guard cells (OC-1, OC-20) test whether the piece sets aside the securing the prose states; the whole scene, since the piece's job is noticing what the steps leave out; no flagged problems, which are a bucket that lets the imagination defer, not an output later stages are expected to pick up (user). Open: who assigns the roles in composition |
| NR-7 | How the probe grades a request with parameters | The probe | Step 1 | **Settled** (user, 2026-11-13, as a place to start): `answer`, the steps and `of` by code; `reason` and `missing` by hand against a look-for. The probe's change (mine, proposed): a piece's own grade giving a canonical answer string, and `lookFor` on an answered cell |
| NR-8 | One pass over the sequence, or one call per step (the fallback); and whether a per-step call splits its self-check and forward check into two calls | Draft 1 (one pass); step 5 | The drafts | Open; one pass first (user, 2026-11-13) |
| NR-9 | Whether and how this piece reads the imagination's flagged problems: a bucket of unknown worth as evidence (user, 2026-11-13). Ignore them (the baseline, and the control), show them framed for skepticism, classify each in a call of its own, or use them in code as a trigger or an audit | Step 4 | An experiment once composition gives real flagged replies, on hops 5 and 7 and the guard cells | Open; none in the baseline |
| IM-3 | The loop's cap, and what returns when it is hit. The imagination plan's row; step 4 sets a first value | Step 4 | The composition probe | Open |
| IM-5 | Which ask's lines the rule cell reads for a rule's two ends. The imagination plan's row; step 3's adapter takes its provisional split | Step 3 | The composition probe | Open |

## How we work

- The parent's [How we work](AGENT.oracleLoop.planning.md#how-we-work) holds.
- The user runs each batch and pastes the result. I write each payload to a file and give its full path.
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
| The piece and its baseline | Not started |
| The composition probe, first form | Not started |
| The cell in composition | Not started |
| Drafts | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the request contract to the parent's seam ledger for the rule cell's refactor. Then the parent's non-rule cell item is checked, and this plan is deleted.
