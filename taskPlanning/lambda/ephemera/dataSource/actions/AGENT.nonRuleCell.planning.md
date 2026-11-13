# The non-rule cell: an oracle piece that answers with a verdict or a request

**Status (2026-11-13): written; step 1 (the design pass, text only) is next. No code yet.** Opened from the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, where the non-rule blocker was made next (user, 2026-11-13; [trail](AGENT.oracleLoop.discussion.planning.md#the-non-rule-blocker-first-the-rule-cell-later-2026-11-13)). It is renamed `nonRuleCell` here (user, 2026-11-13): under the verdict-or-request contract, `blocks` is one answer among several, and the name parallels `ruleCell`, its nearest analogue. The piece judges whether a plan can go ahead for reasons no rule names, such as stuffing a table into a teacup. It is the first oracle piece designed from the start to answer with a verdict **or** with requests typed by the imagination's asks ([trail](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12)), so the request contract is drafted here, on a new piece, and the rule cell adopts it later. **The composition probe's first two steps are built in this plan** (mine, 2026-11-13): a request's worth shows only in what comes back, so the cell's requests can't be graded without it. Its growth toward OC-30's chain may outgrow this plan; if so it gets its own.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), as an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The parent holds the subsystem map, the stages (a guess), the seam ledger and the corpus. This plan holds one episode. What it shows about a guess goes **up** to the parent's seam ledger.

## Getting Started

1. Read the parent's [Status](AGENT.oracleLoop.planning.md), its [Slice 4.5 rows](AGENT.oracleLoop.planning.md#recommended-order), the [subsystem map](AGENT.oracleLoop.planning.md#subsystem-map), [the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages) (this piece is the "fits" half of "Fits, missing") and the [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger), newest rows first.
2. Read the trail, newest first: [The non-rule blocker first, the rule cell later](AGENT.oracleLoop.discussion.planning.md#the-non-rule-blocker-first-the-rule-cell-later-2026-11-13), [An oracle piece answers with a verdict or a request](AGENT.oracleLoop.discussion.planning.md#an-oracle-piece-answers-with-a-verdict-or-a-request-2026-11-12), and [The oracle decomposes](AGENT.oracleLoop.discussion.planning.md#the-oracle-decomposes-slice-4s-exit-c-2026-11-10).
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

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [ ] **The design pass** (text only, reviewed by the user before any code). **Rests on** the verdict-or-request direction and the stages table's "fits". **Consumer:** step 2's registration and draft 1.
   - [ ] **The question** (NR-1): what the piece judges, in one sentence. Mine, a first wording: given the scene and the plan's actions, could these things do and end up as the actions say, setting the rules aside.
   - [ ] **The verdict set** (NR-2) and what each verdict carries, such as the reason the corpus expects ("the size as its sentence", OC-3, OC-11, OC-18).
   - [ ] **The first request kinds and their parameters** (NR-3): `needs detail` (which action, which thing, which question) sends `playByPlay`; others as the cells call for them, a fact such as a size among the candidates.
   - [ ] **The reply's form** (NR-4): one fenced JSON block holding a verdict or requests.
   - [ ] **The inputs** (NR-6): the scene, the actions and the intent; whether the imagination's lines and flags are shown on a fresh call, and how.
   - [ ] **The cells,** each with its expected answer (below, [Proposed cells](#proposed-cells)), with cells where asking is right and cells where it is wrong.
   - [ ] **How a request is graded** (NR-7): an answered piece has one `expected` string per cell, and a request has parameters. Mine: the kind is graded by code, the parameters read by hand against a look-for, as the read kind does. That fires the piece probe's revision trigger, as the play-by-play did.
2. [ ] **The piece and its baseline.** `calibration/oraclePieces/nonRuleCell.ts`, registered in `pieces.ts`, with its tests; its drafts in `oracleLoopDrafts/nonRuleCell/` (`N.txt`, `N.notes.md`, `iterations.md` with Problems, Library and Ledger), laid out as the rule cell's. The probe's change from NR-7, if taken. Draft 1 run on every cell, `repeats: 3`, Micro, with a rubric written before the batch. A fresh call's cell is written by hand or lifted from a `playByPlay` batch reply, as the rule cell's were, so no composition is needed to test the second call. **Consumer:** the batch.
3. [ ] **The composition probe, first form: what exists** (the parent's Slice 4.5, mine, revised 2026-11-13). `playByPlay` feeding the settled rule cell through an adapter (its lines for the named things; the silence contract for a rule's other end), with code asking `playByPlay` first, on OC-1, OC-6 and OC-20. Each hop's inputs and answer are logged. **Rests on** IM-5's provisional split. **Consumer:** a batch read per hop. It tests the reading direction, and gives the harness the next step plugs into. Can run beside step 2's drafts.
4. [ ] **The cell in composition.** Its requests dispatched to the imagination, the fresh call with and without the question asked (NR-5), and a round cap (IM-3). Graded per hop: each request warranted or not, each verdict against the corpus. **Consumer:** a batch on the cells where asking is right.
5. [ ] **Drafts,** one change per draft, from the baseline, in the piece probe and in composition as each problem calls for.
   - **Exits:** (a) the library has nothing left worth a draft; (b) every cell right, in the probe and per hop, for two batches running; (c) a batch shows the piece needs a new approach (a seam-ledger entry), such as fits and the request needing separate calls after all; (d) a checkpoint with the user every three batches.
6. [ ] **Hand back to the parent:**
   - seam-ledger entries: the request contract as it stands, for the rule cell's refactor to adopt; the "fits" stage's standing; what the adapter showed about the rule cell on real lines;
   - the request kinds this piece needed, to the imagination plan (its asks, and any new one);
   - the cell's reactions to `playByPlay`'s flags and form, to the imagination plan, where they are held for;
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro);
   - the composition probe's state, to the parent's composition probe item, or to its own plan.

   Then this plan is deleted. The piece's registration, the probe and the drafts stay with the parent.

## Proposed cells

Mine until the user reviews them in step 1. From the corpus where it has the case; the expected answers are the corpus's where it gives one.

| Cell | Fixture and action | Expected (mine) | Why |
| --- | --- | --- | --- |
| OC-11 | `teaTableCupOnFloor`, put [table1] in [cup1] | `blocks`, the size as the reason | The corpus's size case. A request for the sizes is over-asking: common sense establishes them |
| OC-18 | `teaTableCupOnFloor`, hammer [table1] into [cup1] (hand-written) | `blocks`, the size | A method that can't help (corpus): a request for detail on the hammering is over-asking |
| OC-3 | `teaTable`, put [table1] in [cup1] (hand-written; the dry run refuses it) | `blocks`, the size, not the cup being on the table | The record's reason isn't the fiction's (corpus). Perhaps later: the action text alone doesn't show the cycle |
| OC-1 | `teaTable`, pick up [table1] | `allows` | The glue is the rule cell's; reading it as a blocker is the known false refusal |
| OC-2 | `teaTable`, pick up [cup1] | `allows` | A guard |
| OC-20 | `teaTableChained`, pick up [table1] (hand-written) | `allows` | The chain is the rule cell's |
| OC-9 | `tavern`, pick up [table1], a long oak trestle | Open: `allows`, the feat a skill question, or something else | The corpus expects "open" (JF-2); for the user |
| OC-6 | `teaTable`, the template's pour | Mine, a guess: `needs detail` on how the teapot tips | The corpus's known issue is the missing tilt. A candidate for a cell where asking is right, but the tilt may be Missing's, not this piece's |

**A gap:** the corpus has no clear case where this piece should ask. Writing one is for step 1, with the user, in the corpus.

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| NR-1 | The piece's question, in one sentence | Draft 1 | The user's call, step 1 | Open; mine above |
| NR-2 | The verdict set. Mine: `allows` and `blocks`, as the rule cell's, so Works joins them alike; `blocks` with its reason | The registration, Works | The user's call, step 1 | Open |
| NR-3 | The first request kinds and their parameters, and whether a fact (a size) is a new imagination ask or a kind of more detail. Methods and facts are two kinds (JF-15) | The registration; the imagination plan's asks | Step 1, then the drafts | Open |
| NR-4 | The reply's form: one fenced JSON block, a verdict or requests | The check | Step 1 | Open; mine as stated |
| NR-5 | Whether the fresh call is told the question it asked | Step 4 | The composition probe | Open (from the trail) |
| NR-6 | What the piece sees: the scene, the actions, the intent; the imagination's lines and flags on a fresh call; the rules shown or not (PB-2's analogue: the rules are the rule cell's) | Render | Step 1, then the drafts | Open |
| NR-7 | How the probe grades a request with parameters | The probe | Step 1 | Open; mine: the kind by code, parameters by hand |
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
| The design pass | Next |
| The piece and its baseline | Not started |
| The composition probe, first form | Not started |
| The cell in composition | Not started |
| Drafts | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the request contract to the parent's seam ledger for the rule cell's refactor. Then the parent's non-rule cell item is checked, and this plan is deleted.
