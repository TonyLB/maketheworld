# Piece probe: a harness for small oracle pieces, and the rule cell as its first

**Status (2026-11-10): step 1 done, the piece probe built ([Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe)); next, step 2, the rule cell.** The first sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5. Slice 4 took its exit (c): as one prompt, the oracle fails on Micro wherever it loops or looks back ([trail](AGENT.oracleLoop.discussion.planning.md#the-oracle-decomposes-slice-4s-exit-c-2026-11-10)). So the oracle is now built from pieces that each make one judgment per call, with code doing the loops, filters and joins. This plan builds two things:
- **The piece probe:** a harness seam that a piece plugs into with little labour.
- **The rule cell:** the first piece plugged in. It is the user's rules-blocking piece.

Composing the pieces is not this plan's work.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), as an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The parent holds the subsystem map, the [stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages) (a guess), the seam ledger and the corpus. This plan holds one episode: building the seam, and drafting the rule cell on it until it settles. What it shows about a guess goes **up** to the parent's seam ledger.

## Getting Started

1. Read the parent's [Status](AGENT.oracleLoop.planning.md), its [subsystem map, stages and seam ledger](AGENT.oracleLoop.planning.md#subsystem-map), and the trail's [The oracle decomposes](AGENT.oracleLoop.discussion.planning.md#the-oracle-decomposes-slice-4s-exit-c-2026-11-10).
2. Read [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), including what drafts 1 to 12 showed, and the [Oracle probe](../../../../../lambda/ephemera/calibration/AGENT.md#oracle-probe). The piece probe reuses its parts.
3. Read the [disposition](oracleLoopDrafts/iterations.md#disposition-at-slice-4s-exit-2026-11-10) of Slice 4's problems and library. PR-9 and PR-11 are the rule cell's problems. L-2b, L-15, L-29 and L-34 are its first library entries.
4. Read the code it builds on:
   - [`runOracleProbe.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/runOracleProbe.ts) (the call loop);
   - [`handleOracleProbe.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/handleOracleProbe.ts) (refusals before the first call, hashes);
   - `judgeRulesLines` and its wordings in [`sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts);
   - the event router, [`routeCalibrationEvent.ts`](../../../../../lambda/ephemera/calibration/routeCalibrationEvent.ts);
   - the piece probe, step 1's build: [`oraclePieces/`](../../../../../lambda/ephemera/calibration/oraclePieces/) and its [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) subsection.
5. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null`, last 4546 passed, 9 skipped, and `npx tsc --noEmit </dev/null`, no output.

## What is inherited as settled

The parent's [inherited premises](AGENT.oracleLoop.planning.md#what-is-inherited-as-settled) hold, with their standings. Also:

| Premise or guess | Standing | What this plan can show |
| --- | --- | --- |
| **One judgment per call, with loops, filters and joins in code** (user, 2026-11-10) | Direction (user's call), from Slice 4's evidence and prior art | A piece that fails at one judgment: the piece is too big, or the judgment needs a different input |
| **The [stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages)**, and the rule cell's place among them (mine) | Guess | The rule cell's inputs are what an earlier stage could produce: a play-by-play, and the window from the attempt and code |
| **The rules are relational** (mine, agreed in direction): a rule forbids two things moving relative to each other, not a thing moving | Guess, from OC-1 | A cell where both things move together and the rule allows it |
| **Micro is the target** | Principle (user) | |
| **A piece is graded given its inputs.** The cell's expected answer follows from the play-by-play it is given, even when that play-by-play is wrong about the case (mine) | Guess | Whether expected answers written this way separate the cell's faults from the play-by-play's |

**Future subsystems that touch this work:**
- **The other pieces:** the attempt, the play-by-play, fits and missing, and improve.
- **A composition probe** (the user's, 2026-11-10). It would run the pieces in order on a corpus case, with code doing the joins, and grade the result against the case's end result. It is imagined, and booked to after a second piece works on its own (see [Open decisions](#open-decisions-implementation--plan-only)). Nothing here builds toward it beyond keeping a piece's inputs and answer as plain data.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [X] **The piece probe.** A Prototype in a new directory, `calibration/oraclePieces/`, so it can be disposed of in one go. **Rests on** the jobs every piece has, which don't depend on what the pieces turn out to be (mine, agreed 2026-11-10). **Consumer:** the rule cell (step 2), then its draft 1 run by the user (step 3). **Revision trigger:** a piece needs more than a registration to plug in: a change to the event, the runner or the grading. Tested as written: not true while the rule cell is the only piece, so it is tested by the second piece.
   - [X] **A piece registration,** `OraclePiece<Inputs, Options>`, through `registerPiece` into `pieces.ts`:
     - `name`;
     - `answers`, the closed answer set (the rule cell's: `blocks`, `allows`);
     - `cells`, keyed by ID. Each cell carries its inputs, its `expected` answer, a `source` (the batch and reply it was lifted from, or "hand-written") and a `note`;
     - `parseOptions(value)`, which checks the event's `options` and gives the piece's options or a refusal (mine, added in the build: "checked by the piece" needed a place to check them);
     - `render(cell, options)`, which builds the prompt text after the instructions. It is async, so it can build a fixture's scene;
     - `byCode(cell)`, optional: an answer code gives without a call, such as an empty window. It is reported as such.
   - [X] **The event,** `{ type: 'PieceProbe', piece, cells, instructions, repeats?, model?, options? }`:
     - `instructions` is required. `cells` defaults to all of the piece's cells.
     - `options` is piece-specific and checked by the piece, such as the rule wording.
     - Every refusal happens before the first call: an unknown piece or cell, no instructions, over the cap, or a bad option.
     - The cap is 24 calls per invoke (PP-2), as its own constant.
   - [X] **The run and the grade.** The call loop is factored out of `runOracleProbe` as `runProbeCalls`; it factored cleanly. The grade is `pieceAnswer(reply, answers)`: the last line starting `Answer:`, read against the answer set. It gives an answer, or `malformed` with the reason. The verdict goes last, as Micro needs.
   - [X] **The result:**
     - the instructions' hash and length;
     - **a tally per cell first,** for each cell: its expected answer; right, wrong and malformed of n; the answers given; whether code answered it; and the rendered inputs' hash;
     - a summary: right of called, by-code cells, errors, malformed;
     - then each call's reply, for reading the wrong ones.
   - [X] **Routed** in `routeCalibrationEvent.ts`.
   - [X] **Tests,** with a mocked invoke and a toy piece, following `handleOracleProbe.test.ts`:
     - each refusal;
     - a right, a wrong and a malformed reply;
     - a cell answered by code makes no call;
     - the tally's counts;
     - the hashes are stable;
     - `OracleProbe` and `JudgeProbe` are unchanged.
2. [ ] **The rule cell, registered** (`oraclePieces/ruleCell.ts`), the user's rules-blocking piece.
   - **Its inputs:**
     - a fixture;
     - a rule handle;
     - the plan's actions in order, each with what the play-by-play says each of the rule's things does;
     - optionally, the index of the action that voids the rule.
   - **What code does:** computes the window, the actions before the voiding one or all of them. An empty window is "allows" by code.
   - **The render:**
     - the rule's sentence for that handle, from `judgeRulesLines` with the wording option (`v45`, `violation`, `inForce`), defaulting to PP-3's choice;
     - the things the rule names;
     - each action in the window, with its motions.

     The scene is left out by default (PP-1).
   - **The first cells,** from the corpus and from replies we already have. Each case is written as "the play-by-play given, then the expected answer"; the IDs are mine:

     | Case | The play-by-play given | Expected |
     | --- | --- | --- |
     | OC-1 | the table lifted, the teapot travelling with it | allows |
     | OC-6 | the teapot lifted and tilted to pour (batch 16, OC-6/2) | blocks |
     | OC-6 | the teapot stays on the table while the tea moves (batch 16, OC-6/1) | allows |
     | OC-30/2 | the table tipped, the teapot doesn't move relative to it (batch 16, OC-30/2/2) | allows |
     | OC-30/2 | the table and teapot tilted together | allows |
     | OC-19 | voided at action 1 | allows, by code |
     | OC-19 | the pry failing, the attempt not voiding: the teapot levered up while glued | blocks |
     | OC-20 | the table dragged from the wall it's chained to | blocks |

     The wrong-input OC-6 cell is there on purpose: the cell is graded given its input, under the premise above.
   - [ ] **Tests:**
     - the window: none, voided at 1, and voided later;
     - the render for each wording;
     - the by-code cell;
     - every cell's handles resolve in its fixture's render.
3. [ ] **The rule cell's draft 1, and its first batch.**
   - **The draft (mine):** short. A role sentence, the rule, the motions, one question ("Does what these lines describe move [x] and [y] relative to each other more than the rule allows?"), reasoning in one or two sentences, then `Answer: blocks` or `Answer: allows`.
   - **Where it lives:** in a drafts directory for the piece, with notes and a rubric, as in Slice 4 (PP-4).
   - **The batch:** the eight cells, 3 repeats each, on Micro. Read the tally first, and only the wrong replies.
4. [ ] **The drafting loop for the rule cell, graded by the tally,** until it settles. Slice 4's loop: problems, a library and a ledger, one change per draft. **Exits:**
   - (a) the library has nothing left worth a draft;
   - (b) every cell right 3 of 3 for two drafts running;
   - (c) a batch shows the piece needs a new approach, such as a judgment that doesn't fit in one cell. That gets a seam-ledger entry, and the episode stops;
   - (d) a checkpoint with the user every three batches.

   Cells are added as the drafts find gaps, each with a source.
5. [ ] **Hand back to the parent:**
   - seam-ledger entries for the probe and the cell;
   - the rule cell's row in the stages table, marked Observed if it settles;
   - the second piece named, and whether the seam held for it (the revision trigger);
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).

   Then this plan is deleted. The probe, the cell's registration and its drafts stay with the parent, for the composition probe.

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| PP-1 | Does the rule cell see the scene, or only the rule, its things and their motions? Mine: none of the scene by default, since Slice 4's replies wandered into the scene's text, with `show.scene` as an option | Step 2's render | The first batch, with a second invoke under `show.scene` if a cell needs what a thing is (a table's legs, a chain's length) | Open; default none |
| PP-2 | The call cap for a piece. Its calls are short, and the tally is read by code, which were reasons for the cap of 12 | Step 1's refusals: a cap of its own, `PIECE_PROBE_CALL_CAP`, apart from the shared `PROBE_CALL_CAP` | The user, 2026-11-10 | **Settled: 24 per invoke.** The premise is that decomposing makes calls shorter. If a piece's calls get long enough for 24 to become onerous, that's a different kind of problem, a sign the piece is too big, not a reason to change the cap (user) |
| PP-3 | The rule wording for the cell: `v45`, `violation` or `inForce`. Mine: `inForce`, since its "blocks" matches the answer set. The drafts can try the others as an option, with no new code | Step 2's default | The first batches | Open |
| PP-4 | Where a piece's drafts live: `oracleLoopDrafts/` (numbering carried on, mixed with the one-prompt drafts), or a directory per piece, such as `oraclePieceDrafts/ruleCell/`, with its own numbering and `iterations.md`. Mine: a directory per piece, owned by the parent like `oracleLoopDrafts/` | Step 3 | The user's call | Open |
| PP-5 | When the composition probe (the user's) gets its own plan. Mine: after a second piece settles, since composing one piece with code tests nothing new | The parent's Slice 4.5 | A second piece settling | Open |

## How we work

- The parent's [How we work](AGENT.oracleLoop.planning.md#how-we-work) holds, except that a piece's batch is graded by its tally. I read the wrong replies, not every reply.
- The user runs each batch and pastes the result. I write each payload to a file and give its full path, with the draft as `instructions` without its trailing newline.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.
- A cell's expected answer is mine unless the corpus or the user gives it. An expected answer that is mine is a guess, and only the user revises it once it has been reviewed.

## Verification

- **Steps 1 and 2:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`. The built judge is unchanged: a flag-off `JudgeProbe` still reports instructions hash `22e97265`. `OracleProbe`'s tests pass unchanged.
- **A draft:** its tally, against the rubric written before the batch.
- **Links:** every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| The piece probe | Done 2026-11-10: `PieceProbe` in `calibration/oraclePieces/`, no piece registered yet |
| The rule cell, registered | Not started |
| Draft 1 and its batch | Not started |
| The drafting loop | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed about writing for Micro goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The probe and the cell are documented in a new **Piece probe** subsection of [`calibration/AGENT.md`](../../../../../lambda/ephemera/calibration/AGENT.md), written in step 1 and updated as the cell settles. Then the parent's Slice 4.5 sub-row is checked, and this plan is deleted.
