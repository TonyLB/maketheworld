# Play-by-play: the oracle's generative piece, read by hand

**Status (2026-11-10): steps 1 and 2 built, the piece probe's reading mode and the play-by-play registered on it. Step 3 done: draft 1's batch is the baseline ([`oracleLoopDrafts/playByPlay/`](oracleLoopDrafts/playByPlay/iterations.md)). OC-6's teapot is tilted 3 of 3 with nothing fitted to the glue (PR-1 met); form 8 of 15, 10 of 15 under the revised check; OC-30/2's knock-on slide 0 of 3. Step 4 under way: draft 2, the silence contract (user), solved the form (15 of 15) but brought PR-1 back on OC-6 (1 of 3). Draft 3, the consequence framing (user), brought the knock-on (OC-30/2 2 of 3, from 0), but the actions were read as attempts whose outcome the rules settle (PB-P5). The consequence view of the rules is built (`rules: 'consequence'`, user). Batch 4, draft 3 with it: PB-P5 unchanged, and OC-30/2's knock-on lost (0 of 3), with "moves with" spread to everything on the table. Batch 5, draft 4 (the actions carried out as written, PB-L14) with the view on: no effect, with OC-6 and OC-19 0 of 3. At the checkpoint the user chose to continue. Draft 5, draft 1's framing plus a sentence for the consequences with the view off (PB-L15), is the base: in batch 6, OC-6, OC-19, OC-20 and OC-1 are 3 of 3 with no attempts, and the knock-on 1 of 3, partly.** The second sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, after the rule cell ([`oracleLoopDrafts/ruleCell/`](oracleLoopDrafts/ruleCell/iterations.md)). The play-by-play says what each thing does as a candidate's actions happen, transient motion included ([the oracle as stages](AGENT.oracleLoop.planning.md#the-oracle-as-stages)). Its output is the rule cell's input, and later the non-rule blocker's. This plan builds two things:
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
- **The composition probe** (user), after both pieces. Nothing here builds toward it beyond giving the output as plain data in the rule cell's shape. Under the silence contract, it owns the code that fills in a silent rule end from the scene ("stays on [table1]").
- **Unwanted consequences, judged later** (user, 2026-11-10): an action's consequences that go against the request (the saucer sliding out from under the cup) are judged by a later stage that sees the request. They go to Improve, which tries preparatory or mitigating actions, and code runs the play-by-play again on the revised candidate. So the play-by-play reports consequences neutrally, the bad ones included, and never sees the request. For the parent's stages table at the hand-back: a judgment the table lacks, and "works" as no rule blocking, fitting, and no unwanted consequence.
- **An iterative play-by-play generator** (user, 2026-11-10), later but soon: one that reasons over actions a rule forbids. Until then, this piece's drafts carry no example of a forbidden action.
- **Relevance by code:** which things the play-by-play is asked about, computed from the plan's things, what is on or in them, and the ends of the rules naming them. Here a cell lists its things by hand (PB-1).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [X] **The piece probe's reading mode.** Built 2026-11-10; tests and `tsc` pass (4611 passed, 9 skipped). The registration is a second kind (`kind: 'read'`, `ReadPiece`) in `oraclePiece.ts`, run and tallied in `readPiece.ts`, branched in `handlePieceProbe.ts`; `ruleCell.ts` and its tests are untouched. `check` gives `string[]`. A change to the probe, which is the piece probe's revision trigger firing: a second piece needs more than a registration to plug in (expected, from the user's principle above). **Rests on** the user's principle that a generator is read by hand. **Consumer:** the play-by-play (step 2), then its draft 1 run by the user (step 3). **Revision trigger:** the reading mode needs a third shape of piece, or the form check can't be written as a function of one reply and its cell.
   - [X] **The registration** grows a second kind (mine, details decided in the build). A piece is either:
     - **answered,** as now: `answers`, and an `expected` per cell, tallied by code; or
     - **read:** no answer set. It has a `check(reply, cell)` that gives the form problems of one reply (none when it passes), and each cell carries a `lookFor` in place of `expected`: what a reader looks for, written before the batch.

     The rest of the registration (`cells`, `parseOptions`, `render`, `byCode`) is shared. `ruleCell` is unchanged.
   - [X] **The result** for a read piece:
     - the instructions' hash and length;
     - **per cell first:** its `lookFor`; the form passes and fails of n, with each failure's reason; the rendered inputs' hash;
     - a summary: calls, form fails, errors;
     - then **the replies grouped by cell,** for reading, each with its form problems.
   - [X] **The cap** stays 24 per invoke (PP-2, the user's: long calls mean a piece too big, not a higher cap).
   - [X] **Tests,** following `handlePieceProbe.test.ts`, with a toy read piece: a passing and a failing reply, the grouping, the hashes stable, and the answered piece's results byte for byte unchanged (`ruleCell.test.ts` passes unchanged).
2. [X] **The play-by-play, registered** (`oraclePieces/playByPlay.ts`), a read piece. Built 2026-11-10; tests and `tsc` pass (4640 passed, 9 skipped). It plugged in with a registration alone, so the reading mode's revision trigger didn't fire. One departure from the render as written (mine): the sub-scene is over the listed things **and the handles the actions name**, since OC-6 and OC-30/2 name `[tea2]`, which no cell lists, and the prompt would otherwise name a thing the scene doesn't show. The rule cell's sub-scene is its rule's ends alone. The user accepted it to try first, with the whole scene as a possible later option (PB-5). The actions of OC-1, OC-6, OC-30/2 and OC-19 are read from `oracleCases`, not copied. A key is read with or without its brackets, since the prompt writes every handle in brackets, and where both spellings appear their lines are merged (user, 2026-11-10): spelling is code's to normalize, not a form failure for a draft to fix.
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
   - [X] **Tests** (`playByPlay.test.ts`): the render; the check over a passing reply and each problem; every cell's handles resolve in its fixture.
   - **Revised 2026-11-10, after batch 1: the silence contract** (user: an action doesn't affect every thing). A listed thing with no line is no longer a form failure. It is silent, and it stays in its frame. The line for every thing came from the rule cell's `motions` (mine, the guess that the output feeds the rule cell as is). Code filling in a silent rule end is the composition probe's (below).
3. [X] **Draft 1, and its first batch.**
   - **The draft (mine):** short. A role; "Reading the scene", the rule cell's; the label `Play-by-play` (L-30, the user's); what each thing has to do physically for the actions to happen, each thing in order; first the narration in a few sentences, then the block (the rule cell's describe-first, draft 3).
   - **Where it lives:** `oracleLoopDrafts/playByPlay/`, with notes, a rubric written before the batch and its own `iterations.md`, as the rule cell's.
   - **The rubric's questions** (mine, for every reply): (a) physics or the record: does it say what has to happen, or restate the action (draft 10's register)? (b) fit to the rule: is a motion written to keep a rule true (PR-1)? (c) knock-on motion: the saucer and cup on OC-30/2; (d) the lines read relationally: would the rule cell read each pair's lines as together or apart without guessing (PR-11's "tilts"/"tilts")? (e) narration and lines agree; (f) invented things or handles.
   - **The batch:** the five cells, 3 repeats, Micro. The form check is read first, then every reply.
   - **Written 2026-11-10** ([`1.txt`](oracleLoopDrafts/playByPlay/1.txt), hash `5371b3bc`, 3,872 characters; [notes and rubric](oracleLoopDrafts/playByPlay/1.notes.md); [`iterations.md`](oracleLoopDrafts/playByPlay/iterations.md)). Not short, against the sketch above: a first, minimal draft (mine) lost most of what made the step work in the one prompt, so draft 1 carries one-prompt draft 11's context over as it is (user, 2026-11-10): the game-master role, `Reading the scene` without its `Rules` bullet, and `Relations and frames` with the crate and rug examples. Cutting back is the later drafts' job, one cut per draft (PB-L6). Left out:
     - the bolted-lamp example (user): reasoning over forbidden actions is for a later, iterative play-by-play generator;
     - `Improvising`, and the motorcycle-and-shoebox sentence, which is about fits;
     - "each thing in order" (mine), since draft 10's "each thing that moves, in order" lost the tilt; the physics is asked for in drafts 6, 11 and 12's words.

     The lines are not asked to name the other thing, so rubric (d) reads the baseline unprompted (mine). The cells' inputs hashes are in the notes, for the deploy check.
   - **Batch 1 run 2026-11-10** (15 calls, Micro; [results](oracleLoopDrafts/playByPlay/1.notes.md#results-2026-11-10-batch-1)), the baseline:
     - **The motion carries.** OC-6's teapot is lifted and tilted 3 of 3, the table still, and nothing is fitted to the glue (PR-1 met). OC-1's carry is 3 of 3, given the frame model's reason. OC-19 and OC-20 are 3 of 3 in substance.
     - **Form: 8 of 15** (PB-P1). The `actions` list is written as one entry per thing, or with a line only for the thing the action names.
     - **A goal-directed register (mine, a reading).** "What each thing has to do for the actions to happen" is read as what the plan needs. So OC-30/2's saucer and cup "need to stay", and slide 0 of 3 (PB-P3). And 4 replies add a step that clears the chain or the glue (PB-P2), the forbidden-action reasoning left for a later generator.
     - **Not exit (c) yet (mine).** Where the lines are missing, the narration is right, but the misses are in the block's shape, which one draft can try (PB-L7) before the piece is split.
4. [ ] **The drafting loop,** one change per draft, until it settles. Draft 2 ([notes](oracleLoopDrafts/playByPlay/2.notes.md), hash `ab5bf3c3`) is the silence contract (PB-L10), written 2026-11-10. Batch 2: form 15 of 15; OC-30/2's tip-with 3 of 3; OC-6 1 of 3, with the teapot kept "stationary relative to the table" because it is glued (PR-1), likely from the sentence's relational wording. Draft 3 ([notes](oracleLoopDrafts/playByPlay/3.notes.md), hash `4c72c6fd`) is the consequence framing (PB-L12, user, 2026-11-10): what is done and what follows from it, whether or not the plan needs it, with rules used only for what they cause. Batch 3: OC-30/2's knock-on 2 of 3 (from 0 of 3), but 14 of 15 descriptions open "You attempt" or "You are attempting", with the outcome settled by the rule: OC-20's lift blocked 2 of 3, OC-19 branched on the glue 2 of 3. Form 8 of 15, in a new record shape. **Exits:**
   - (a) the library has nothing left worth a draft;
   - (b) every reply on every cell meets its look-for and the form, for two drafts running;
   - (c) a batch shows the piece needs a new approach, such as the narration right and the lines wrong, which splits it into a narration and an extraction. That gets a seam-ledger entry, and the episode stops;
   - (d) a checkpoint with the user every three batches.

   Cells are added as the drafts find gaps, each with a source.

   **Before exit (b): shorten the reply** (user, 2026-11-10: needlessly verbose). The output cap was raised to 1024 tokens for this piece when draft 5's replies were cut off at 512 (PB-P6). Once the replies are good, a draft (or a few) asks for a shorter reply, and the cap comes back down if it can (PB-L16).
5. [ ] **Hand back to the parent:**
   - seam-ledger entries for the reading mode (the revision trigger) and the piece;
   - the play-by-play's row in the stages table, marked Observed if it settles;
   - what the drafts showed about writing for Micro, into [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the reading mode into the [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) subsection;
   - the settled draft's replies kept as candidate inputs for the composition probe.

   Then this plan is deleted. The probe, the piece's registration and its drafts stay with the parent.

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| PB-1 | Which things the play-by-play describes. A thing the plan doesn't name can still move: OC-1's teapot, OC-30/2's saucer. Mine: for the probe, each cell lists its things by hand; computing them (the plan's things, what is on or in them, and the ends of the rules naming them) is code booked for the composition probe | Step 2's inputs | The user's call | Open; mine, by hand. Built that way (2026-11-10): `things` on each cell |
| PB-2 | Whether the play-by-play sees the rules. Seeing them risks PR-1, the motion written to fit the rule; the Fiction says "glued to" either way. Mine: the sub-scene's Rules section off by default, built as an option so a batch can compare | Step 2's render | The first batches | Open; mine, off. Built as the `sceneRules` option, `false` by default (2026-11-10). Batch 1, with it off: no motion fitted to the glue on OC-6, but the Fiction's "glued to" and "chained to" were read as things the plan must clear (PB-P2). **Revised 2026-11-10** (user): the play-by-play uses a rule only for what it causes, so the option is `rules`, `none` or `consequence` (each rule's fact and its consequence, read off the securing edge: when the thing secured to moves, the secured thing moves with it), replacing `sceneRules` |
| PB-3 | Whether the play-by-play sees the candidate's changes (the after-state), where a template gives them. Mine: not in draft 1, since the stages table puts Changes first but Slice 2.5 found an after-state shown and not read | Step 2's render | The drafts | Open; mine, not shown. A library entry, not built until a draft asks |
| PB-4 | Where the reading mode lives: a second kind of `OraclePiece`, or a separate registration and event. Mine: a second kind of the same registration and the same `PieceProbe` event, so the call loop, the refusals and the cap are shared | Step 1 | The build | Settled by the build (2026-11-10), mine: `ReadPiece` beside `OraclePiece` in one registry (`RegisteredPiece`), the same event. The revision trigger's second clause held: the form check is a function of one reply and its cell |
| PB-5 | How much of the scene the play-by-play sees. A thing can move without being listed or named (OC-1's teapot, OC-30/2's saucer), so this may be the piece that most needs the whole scene (user, 2026-11-10). Built (mine): the sub-scene of the listed things and the handles the actions name. A possible option (user): the whole scene's render | Step 2's render; the drafts | The drafts | Open; trying the sub-scene first (user). The whole scene is a library entry, not built until a draft asks. Batch 1: OC-30/2's missing slide is not for want of the scene, since the saucer and cup are listed and shown; it reads as the register (PB-P3) |

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
| The reading mode | Done 2026-11-10 |
| The play-by-play, registered | Done 2026-11-10 |
| Draft 1 and its batch | Done 2026-11-10 (batch 1, the baseline) |
| The drafting loop | Started 2026-11-10: batches 2 to 6 run; checkpoint 2026-11-10 (continue); draft 5 the base |
| Hand back | Not started |

## When it finishes

What the drafts showed goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), and the reading mode to the [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) subsection. Then the parent's Slice 4.5 row is checked, and this plan is deleted.
