# Play-by-play: the oracle's generative piece, read by hand

**Status (2026-11-10): written, not started; next, step 1, the piece probe's reading mode.** The second sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, after the rule cell ([`oracleLoopDrafts/ruleCell/`](oracleLoopDrafts/ruleCell/iterations.md)). The play-by-play says what each thing does as a candidate's actions happen, transient motion included ([the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages)). Its output is the rule cell's input, and later the non-rule blocker's. This plan builds two things:
- **A reading mode for the piece probe,** for a piece with no closed answer set: code checks each reply's form, and the replies are read by hand.
- **The play-by-play,** registered on it and drafted until it settles.

Composing it with the rule cell is the composition probe's work, not this plan's.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), as an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The parent holds the subsystem map, the stages (a guess), the seam ledger and the corpus. This plan holds one episode. What it shows about a guess goes **up** to the parent's seam ledger.

## Getting Started

1. Read the parent's [Status](AGENT.oracleLoop.planning.md), its [Slice 4.5 rows](AGENT.oracleLoop.planning.md#recommended-order), [the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages) and the [seam ledger](AGENT.oracleLoop.planning.md#seam-ledger), newest rows first.
2. Read [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), including what the rule cell's drafts 1 to 3 showed, and the [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe).
3. Read what Slice 4 learned about this step inside the one prompt:
   - [`10.notes.md`](oracleLoopDrafts/10.notes.md): `Picture` renamed `Play-by-play` (L-30, the user's), the register going to the record and not to the physics, and the tilt coming back with "each thing that moves, in order";
   - the flat [`iterations.md`](oracleLoopDrafts/iterations.md): PR-1 (the tilt made to fit the glue), L-29 and L-30, and the [disposition](oracleLoopDrafts/iterations.md#disposition-at-slice-4s-exit-2026-11-10);
   - the trail's [The oracle decomposes](AGENT.oracleLoop.discussion.planning.md#the-oracle-decomposes-slice-4s-exit-c-2026-11-10): the play-by-play was the one generative judgment that worked best (draft 6).
4. Read the code it builds on:
   - the probe: [`oraclePieces/`](../../../../../lambda/ephemera/calibration/oraclePieces/): `oraclePiece.ts`, `handlePieceProbe.ts`, `runPieceProbe.ts`, `pieceAnswer.ts`;
   - the rule cell, [`ruleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/ruleCell.ts), whose `RuleCellAction.motions` is what this piece's output has to fill;
   - the oracle probe's cases, [`oracleCases.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/oracleCases.ts), whose candidates' steps are this piece's actions;
   - the reasoning-then-JSON split, [`splitMarkdownReasoningAndJson.ts`](../../../../../lambda/ephemera/llm/splitMarkdownReasoningAndJson.ts);
   - [`subScene.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/subScene.ts) and [`renderSceneJudge.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/renderSceneJudge.ts).
5. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null`, last 4607 passed, 9 skipped, and `npx tsc --noEmit </dev/null`, no output.

## What is inherited as settled

The parent's [inherited premises](AGENT.oracleLoop.planning.md#what-is-inherited-as-settled) hold, with their standings. Also:

| Premise or guess | Standing | What this plan can show |
| --- | --- | --- |
| **One judgment per call, with loops, filters and joins in code** (user, 2026-11-10) | Direction (user's call). The rule cell is its first evidence | Whether one call can narrate the actions *and* give a line per thing per action, or whether that is a loop inside the prompt (Slice 4's failure) and the piece splits in two |
| **A generator is graded by hand** (user, 2026-11-10): the more creativity a piece is asked for, the less its replies can be read against a closed rubric | Principle (user) | |
| **The play-by-play is a stage that code calls and feeds forward** (user, 2026-11-10) | Direction (user's call) | |
| **Its output feeds the rule cell as is:** a line per rule end per action, the shape of `RuleCellAction.motions` (mine) | Guess | Whether lines written for every thing read as the rule cell's hand-written lines did: relational enough, and naming the other thing by handle |
| **The play-by-play describes physics, not the rules.** It says what each thing has to do for the actions to happen, and the rule cell judges whether a rule allows it (mine, from PR-1: in Slice 4 the tilt was drawn to fit the glue) | Guess | Whether, with the glue in the scene, the teapot is still tilted for OC-6 |
| **Micro is the target** | Principle (user) | |

**Future subsystems that touch this work:**
- **The rule cell** (settled on draft 3) reads this piece's output. Nothing here changes it.
- **The non-rule blocker,** next in Slice 4.5 (user), would read this piece's output for "fits". Its cases (OC-11, table in cup) are not this plan's, unless a draft asks for one.
- **The composition probe** (user), after both pieces. Nothing here builds toward it beyond giving the output as plain data in the rule cell's shape.
- **Relevance by code:** which things the play-by-play is asked about, computed from the plan's things, what is on or in them, and the ends of the rules naming them. Here a cell lists its things by hand (PB-1).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [ ] **The piece probe's reading mode.** A change to the probe, which is the piece probe's revision trigger firing: a second piece needs more than a registration to plug in (expected, from the user's principle above). **Rests on** the user's principle that a generator is read by hand. **Consumer:** the play-by-play (step 2), then its draft 1 run by the user (step 3). **Revision trigger:** the reading mode needs a third shape of piece, or the form check can't be written as a function of one reply and its cell.
   - [ ] **The registration** grows a second kind (mine, details decided in the build). A piece is either:
     - **answered,** as now: `answers`, and an `expected` per cell, tallied by code; or
     - **read:** no answer set. It has a `check(reply, cell)` that gives the form problems of one reply (none when it passes), and each cell carries a `lookFor` in place of `expected`: what a reader looks for, written before the batch.

     The rest of the registration (`cells`, `parseOptions`, `render`, `byCode`) is shared. `ruleCell` is unchanged.
   - [ ] **The result** for a read piece:
     - the instructions' hash and length;
     - **per cell first:** its `lookFor`; the form passes and fails of n, with each failure's reason; the rendered inputs' hash;
     - a summary: calls, form fails, errors;
     - then **the replies grouped by cell,** for reading, each with its form problems.
   - [ ] **The cap** stays 24 per invoke (PP-2, the user's: long calls mean a piece too big, not a higher cap).
   - [ ] **Tests,** following `handlePieceProbe.test.ts`, with a toy read piece: a passing and a failing reply, the grouping, the hashes stable, and the answered piece's results byte for byte unchanged (`ruleCell.test.ts` passes unchanged).
2. [ ] **The play-by-play, registered** (`oraclePieces/playByPlay.ts`), a read piece.
   - **Its inputs:**
     - a fixture;
     - the candidate's actions in order, each as its words (`says`); taken from an oracle probe case where there is one;
     - the things to describe, by handle (PB-1: listed by hand in the cell).
   - **The render (mine, provisional headings):** the sub-scene of the listed things, then the actions (`Action n: …`), then `The things: [a], [b], …`. The sub-scene's Rules section is off by default (PB-2), as an option.
   - **The output's form** is the draft's to ask for, and the check's to read (mine): reasoning, then a fenced `json` block whose `actions` has one entry per action, each mapping every listed handle to a non-empty string. That is the rule cell's `motions` for any pair of the things. The check reports: no block, or one that doesn't parse; the wrong count of actions; a listed handle missing; a handle not listed; an empty line.
   - **The first cells,** from the oracle probe's cases and the rule cell's. The things and what to look for are mine, and the user is to review them before draft 1's batch:

     | Cell | Actions | Things | Look for |
     | --- | --- | --- | --- |
     | OC-1 | pick up [table1] | table1, teapot1, cup1, saucer1 | everything on the table rises with it; nothing moves relative to the table unless the reply says why |
     | OC-6 | pour [tea2] from [teapot1] into [cup1] | teapot1, table1, cup1 | the teapot lifted or tilted off the table, as pouring needs, and not written to fit the glue (PR-1) |
     | OC-30/2 | tip [table1] so that [teapot1] pours [tea2] into [cup1] | table1, teapot1, cup1, saucer1 | the teapot tips with the table; the saucer and cup slide (the corpus's end result) |
     | OC-19 | pry [teapot1] off [table1] with [hammer1] | teapot1, table1, hammer1 | the teapot levered up and off the table, the table staying |
     | OC-20 | pick up [table1] | table1, wall1 | the table lifted and pulled from the wall, the wall staying |

     OC-20 has no candidate in the oracle probe, since the template refuses the move; the cell writes the action by hand, as the rule cell's did. Five cells x 3 is 15 calls: small, since every reply is read.
   - [ ] **Tests** (`playByPlay.test.ts`): the render; the check over a passing reply and each problem; every cell's handles resolve in its fixture.
3. [ ] **Draft 1, and its first batch.**
   - **The draft (mine):** short. A role; "Reading the scene", the rule cell's; the label `Play-by-play` (L-30, the user's); what each thing has to do physically for the actions to happen, each thing in order; first the narration in a few sentences, then the block (the rule cell's describe-first, draft 3).
   - **Where it lives:** `oracleLoopDrafts/playByPlay/`, with notes, a rubric written before the batch and its own `iterations.md`, as the rule cell's.
   - **The rubric's questions** (mine, for every reply): (a) physics or the record: does it say what has to happen, or restate the action (draft 10's register)? (b) fit to the rule: is a motion written to keep a rule true (PR-1)? (c) knock-on motion: the saucer and cup on OC-30/2; (d) the lines read relationally: would the rule cell read each pair's lines as together or apart without guessing (PR-11's "tilts"/"tilts")? (e) narration and lines agree; (f) invented things or handles.
   - **The batch:** the five cells, 3 repeats, Micro. The form check is read first, then every reply.
4. [ ] **The drafting loop,** one change per draft, until it settles. **Exits:**
   - (a) the library has nothing left worth a draft;
   - (b) every reply on every cell meets its look-for and the form, for two drafts running;
   - (c) a batch shows the piece needs a new approach, such as the narration right and the lines wrong, which splits it into a narration and an extraction. That gets a seam-ledger entry, and the episode stops;
   - (d) a checkpoint with the user every three batches.

   Cells are added as the drafts find gaps, each with a source.
5. [ ] **Hand back to the parent:**
   - seam-ledger entries for the reading mode (the revision trigger) and the piece;
   - the play-by-play's row in the stages table, marked Observed if it settles;
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the reading mode into the [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) subsection;
   - the settled draft's replies kept as candidate inputs for the composition probe.

   Then this plan is deleted. The probe, the piece's registration and its drafts stay with the parent.

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| PB-1 | Which things the play-by-play describes. A thing the plan doesn't name can still move: OC-1's teapot, OC-30/2's saucer. Mine: for the probe, each cell lists its things by hand; computing them (the plan's things, what is on or in them, and the ends of the rules naming them) is code booked for the composition probe | Step 2's inputs | The user's call | Open; mine, by hand |
| PB-2 | Whether the play-by-play sees the rules. Seeing them risks PR-1, the motion written to fit the rule; the Fiction says "glued to" either way. Mine: the sub-scene's Rules section off by default, built as an option so a batch can compare | Step 2's render | The first batches | Open; mine, off |
| PB-3 | Whether the play-by-play sees the candidate's changes (the after-state), where a template gives them. Mine: not in draft 1, since the stages table puts Changes first but Slice 2.5 found an after-state shown and not read | Step 2's render | The drafts | Open; mine, not shown. A library entry, not built until a draft asks |
| PB-4 | Where the reading mode lives: a second kind of `OraclePiece`, or a separate registration and event. Mine: a second kind of the same registration and the same `PieceProbe` event, so the call loop, the refusals and the cap are shared | Step 1 | The build | Open; mine, one registration |

## How we work

- The parent's [How we work](AGENT.oracleLoop.planning.md#how-we-work) holds, except that every reply is read, against a rubric written before the batch (user). So batches stay small.
- The user runs each batch and pastes the result. I write each payload to a file and give its full path, with the draft as `instructions` without its trailing newline.
- Each change is attributed. Anything not from the user is labelled "mine" until accepted.
- A cell's look-for is mine unless the corpus or the user gives it, and only the user revises it once it has been reviewed.

## Verification

- **Steps 1 and 2:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`. `ruleCell`'s and `handlePieceProbe`'s existing tests pass unchanged.
- **A draft:** its form check, then every reply against the rubric written before the batch.
- **Links:** every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| The reading mode | Not started |
| The play-by-play, registered | Not started |
| Draft 1 and its batch | Not started |
| The drafting loop | Not started |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the reading mode to the [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) subsection. Then the parent's Slice 4.5 row is checked, and this plan is deleted.
