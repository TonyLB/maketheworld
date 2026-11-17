# The trial's question: the judge answers the case against's question

**Status (2026-11-16): opened. Step 0, the explicit scene render, comes first (the user's, added the same day): its design is written below, pending review. Step 1's design waits on step 0's choice of render. Nothing built.** Opened from the [non-rule cell plan](AGENT.nonRuleCell.planning.md)'s trial, after verdict batch 16 and the checkpoint at which the user chose to keep drafting the judge. This plan is a prototype and its measurement. It folds back into the non-rule cell plan when it finishes ([When it finishes](#when-it-finishes)).

**Why** (the record so far, in the parent's [Recommended order](AGENT.nonRuleCell.planning.md#recommended-order)):
- **Eight verdict drafts scored 4 to 6 of 10** (batches 9 to 16).
- **The guards were right in every batch,** and OC-11 and h5 were wrong in every batch.
- **The mechanism** (TR-P19 to P21): the judge does what its step asks. The rebuttal's quoted line is the only scene text on the point, so any check against the scene finds the rebuttal agreeing with it. "The scene says" in the settling clause gave `rebuttal` 64 of 65 across batches 11 to 16.
- **Micro judges content correctly when no persuasive text is in view:**
  - the non-rule cell's size cells, 9 of 9 (batch 1);
  - the case against's size answers, 3 of 3 (against batch 2).

**The idea, the user's** (2026-11-16):
- **The hypothesis:** what the single cell lacked was an adversarial **question** framing the specific judgment. The user is skeptical that free judgment will work better than it did in the single cell, but grants that the single cell had no such question, and that it might make the difference.
- **The case against's main job shifts** from "find a question you can argue, and (primarily) give a good argument" to **"find a question you think the judge will, upon consideration, agree proves the plan impossible."**

**Mine, from that idea** (agreed by the user as a reading of it, not yet as a design):
- **Three roles:** the case against picks the deciding question, the judge answers it, and the rebuttal contests whether it bears on the plan.
- **The rebuttal becomes the relevance attack** (TR-L6, set aside since rebuttal draft 5), the user's glued-teapot shape: "true, but beside the point".
- **"Will, upon consideration, agree" asks the case against to predict an honest judge,** which is a different bias from "argue as strongly as you can". Against batch 1 reached for the most salient fact (the securing, 10 of 11), not the deciding one.
- **The cheapest first probe is the judge alone:** it answers the hand-written golden questions with no argument and no rebuttal shown.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md). The non-rule cell plan holds the trial's design, cells and record. This plan holds one prototype, and what it shows goes back **up** there.

## Getting Started

1. Read the parent's Status. Then its [trial proposal](AGENT.nonRuleCell.planning.md#the-trial-proposal-argue-against-rebut-judge), [the trial family](AGENT.nonRuleCell.planning.md#the-trial-family-one-harness-kind-the-stage-by-specifier) and [Slice B's design](AGENT.nonRuleCell.planning.md#slice-bs-design-the-verdict-and-the-stage-contract) (the stage contract, golden and lifted, `pickPaired`).
2. Read the verdict's record, newest first:
   - the parent's step 3 trial items, from Slice B to the checkpoint after batch 16;
   - [Verdict draft 8](AGENT.nonRuleCell.planning.md#verdict-draft-8-evaluation-at-the-task-site-as-a-pair) and its [results](oracleLoopDrafts/trial/verdict.8.notes.md#results-2026-11-16-batch-16);
   - [`verdict.1.notes.md`](oracleLoopDrafts/trial/verdict.1.notes.md), the base;
   - the trial's [`iterations.md`](oracleLoopDrafts/trial/iterations.md), TR-P15 to P21 and TR-L6 and TR-L15.
3. Read calibration's [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro), the group on the trial's verdict drafts included.
4. Read the code it builds on, in [`calibration/oraclePieces/trial/`](../../../../../lambda/ephemera/calibration/oraclePieces/trial/):
   - `trialCases.ts`: the golden questions, each cell's `expected` and `lookFor`;
   - `rebuttal.ts`: `renderArguedParts`, whose scene and question parts the new stage reuses;
   - `verdict.ts`: the answered stage to copy the shape of, and its contract;
   - `index.ts`, and the render pins in `renderPins.test.ts`.
5. For step 0, read sceneProjection's [SP-10 contenders](AGENT.sceneProjection.planning.md#candidate-formats) and its SP-10 row in [Open decisions](AGENT.sceneProjection.planning.md#open-decisions-implementation--plan-only). The `affordance` and `examples` renders are the nearest precedents. Then read the trial's renderer, [`sceneProse/renderSceneJudge.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/renderSceneJudge.ts).
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` should produce no output. Both pass before any edit.

## What is inherited as settled

The parent's [inherited table](AGENT.nonRuleCell.planning.md#what-is-inherited-as-settled) holds, with its standings. Also:

| Premise or guess | Standing | What this plan can show |
| --- | --- | --- |
| **The triad** (user, 2026-11-14): small biased calls in place of one balanced one | Direction (user's call) | Whether its roles move as above |
| **The trial family:** one harness kind, the stage by `options.stage`; golden and lifted inputs; each stage's typed contract | Built (Slices A and B) | |
| **Micro does what the step asks;** stances in reading sections are read past; the settling slot is filled from the most authoritative nearby text | Observed (verdict batches 9 to 16) | Whether a question with no persuasive text beside it escapes the last |
| **The ordinary-default rule** (user, 2026-11-16): "a detail the scene leaves out is expected to have some ordinary value", and a departure from the ordinary needs the scene to say so | Direction (user's call); read past in verdict draft 7's reading section | Whether it is used when nothing in view contradicts it |
| **The securing omitted** from what the trial's stages see (against batch 2) | Kept, pending the user | h5's expected answer holds only with it omitted |
| **The verdict on draft 8,** held while this prototype runs | Held (user, 2026-11-16: keep drafting the judge; this plan is that drafting by another route) | |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [ ] **The explicit scene render, probed on reading questions** (the user's idea, 2026-11-16). Each prompt today carries a guide for translating the render into English ("Reading the scene"), beside a render that is not very explicit English. The idea is to drop the guide and build the explicit render. Its first example, the user's: "When [table1] moves, unsecured objects on it ([saucer1]) move with it unless the physics would indicate they come off". The per-object default is also the user's: "Other properties of this object are not established, and assumed to be normal in context". Writing the thing's gloss into that default, and dropping "not established", are mine and agreed. **Rests on** the lessons that reading sections are read past, and that the settling slot is filled from the most authoritative nearby text. **Consumer:** step 1, which is built on the render this step picks. What it finds about rendering goes to sceneProjection's SP-10, which is open.
   - [ ] **The design, reviewed before it's built** (written here for review; mine unless marked):
     - **The guide's three kinds,** each rendered:
       1. **Decoding the format:** handles, and a row indented under a row being on or in it. The Graph's indented list is replaced by a line per thing that says where it is in words. The Fiction stays as it is.
       2. **What moves with what:** each thing that holds something gets a conditional line, with the physics left to the reader: "When [table1] moves, what is on it moves with it, unless the motion slides or tips it off." For contents: "… unless the motion spills it out."
       3. **What is unstated** (the user's default, with the gloss): "In everything the scene doesn't say, [table1] is as an ordinary small round tea table is." A thing with no gloss takes its name: "as an ordinary cup is".
     - **Not stated: fastening.** The trial omits the securing (against batch 2), so the explicit render says nothing about it either way. A line calling [saucer1] "loose" or "not fastened" would assert what the omission leaves silent, and on h5 it would be false, since [teapot1] is glued and that is omitted. Whether the explicit render states the securing is QS-4.
     - **Held constant:** the Fiction, the request, the steps and Reading the steps. The steps' own guide (roles, consequence lines, "the state left by the steps before") is a later candidate for the same treatment, not this one.
     - **The render, `sceneProse/renderSceneExplicit.ts`** (beside `renderSceneJudge.ts`, which is unchanged, so every pinned render stays as it was), on h7's scene:

       ```text
       Scene: The Parlour

       Fiction:
       In the Parlour there is [table1] Table (a small round tea table).
       On [table1] there are [saucer1] Saucer and [teapot1] Teapot.
       On [saucer1] there is [cup1] Cup.
       In [cup1] there is [tea1] Tea.
       In [teapot1] there is [tea2] Tea.
       You are holding nothing.

       The things:
       - [table1] Table (a small round tea table) is in the Parlour. On it are [saucer1] and [teapot1]. When [table1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [table1] is as an ordinary small round tea table is.
       - [saucer1] Saucer is on [table1]. On it is [cup1]. When [saucer1] moves, what is on it moves with it, unless the motion slides or tips it off. In everything the scene doesn't say, [saucer1] is as an ordinary saucer is.
       - [cup1] Cup is on [saucer1]. In it is [tea1]. When [cup1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [cup1] is as an ordinary cup is.
       - [tea1] Tea is in [cup1]. In everything the scene doesn't say, [tea1] is as ordinary tea is.
       - [teapot1] Teapot is on [table1]. In it is [tea2]. When [teapot1] moves, what is in it moves with it, unless the motion spills it out. In everything the scene doesn't say, [teapot1] is as an ordinary teapot is.
       - [tea2] Tea is in [teapot1]. In everything the scene doesn't say, [tea2] is as ordinary tea is.

       End of scene.
       ```

       The wording is pinned by a golden test. Things are listed in the Graph's order, each saying only its own place, not its chain to the room.
     - **The probe: a new answered piece, `sceneReading`,** in `oraclePieces/`. Its answer set is closed (yes or no), so it is an answered piece by the families test, though it judges no plan. Its option is `render: 'sections' | 'explicit'`, required, with no default, since the two arms are two payloads with different instructions:
       - **`sections`:** today's render (`renderSceneJudge`, the securing omitted), with verdict draft 7's Reading the scene, the ordinary-default sentence included;
       - **`explicit`:** the render above, with no Reading the scene.

       Both drafts (`reading.1s.txt` and `reading.1e.txt`) are otherwise word for word the same: a Role (answer one question about a scene in a game world), and a Task (one or two sentences on what the scene establishes about the question, then `{"answer": "yes" | "no"}`). The cap is 400.
     - **The questions** (QS-5; the expected answers mine, for review). They are drawn from the trial's misses, since SP-10's reading questions were right on every render (24 of 24) and could not tell renders apart. Their polarity is mixed. Each is asked of a corpus case's scene, as the trial's cells render it:

       | ID | Scene | Question | Expected | The miss it aims at |
       | --- | --- | --- | --- | --- |
       | R-1 | OC-11 | Could [table1] fit inside [cup1]? | no | the size (TR-P16: "small round, so it fits") |
       | R-2 | OC-11 | Does the scene show [table1] to be unusually small for a table? | no | "small round" read as small enough |
       | R-3 | OC-1 | Could one person pick up [table1]? | yes | the guard's size, the other way |
       | R-4 | OC-6 | Is [tea2] in something tea can be poured from? | yes | the guard's container |
       | R-5 | h7 | If [table1] is tipped steeply, does [cup1] stay where it is? | no | the slide (TR-P14) |
       | R-6 | h7 | If [table1] is carried level across the room, do [saucer1] and [cup1] go with it? | yes | the carry |
       | R-7 | h7 | If [saucer1] is picked up, does [cup1] come with it? | yes | h10's hinge, step 1 |
       | R-8 | h7 | If [saucer1] is picked up, does [teapot1] come with it? | no | the carry spread too far (`affordance`'s failure in SP-10) |
       | R-9 | h7 | If [cup1] is held under [teapot1]'s spout and [teapot1] is tilted, does tea go into [cup1]? | yes | an unstated capacity, the default |

     - **The measure:** each arm a payload, 9 cells x1 (batches 17 and 18), then x3 on any question the two arms split on.
     - **The decision it serves:** which render step 1 is built on.
       - **The explicit render** if it is right wherever `sections` is, and right on at least one of the misses that `sections` gets wrong.
       - **Today's render** if `explicit` loses a question `sections` gets right, unless the loss is in wording the next draft can fix. That's the user's call at the checkpoint.
       - **Both, as a pair in step 1,** if neither arm misses anything: the questions were too easy again, and the ruling's own cells tell the renders apart.
     - **What to read beyond the tally:**
       - whether the default line is quoted as the settling source ("ordinary, so it works") where it shouldn't decide;
       - whether the conditional "when it moves" lines are read as events that happened;
       - whether the repeated lines are skimmed.
   - [ ] **Build:**
     - `renderSceneExplicit.ts` with a golden test on `teaTable` and `teaTableCupOnFloor`;
     - the `sceneReading` piece with its cells and tests (each render, the refusal of a missing `render`, the grade, a run through the probe with a stub), registered in `pieces.ts`;
     - the trial's render pins stay green, unchanged.
   - [ ] **The drafts and rubric:** `oracleLoopDrafts/trial/reading.1s.txt`, `reading.1e.txt` and `reading.1.notes.md`, the rubric written before the batch, and the two payloads at full scratchpad paths.
   - [ ] **Batches 17 and 18:** the two arms, 9 cells x1 each. Deploy first.
   - [ ] **The confirm,** if the arms split: x3 on the questions they split on.
   - [ ] **Checkpoint, with the user:** the render for step 1, by the decision above.
1. [ ] **The ruling: the judge answers the golden question alone** (the probe mine; the framing the user's). It is a new answered stage of the `trial` family, `ruling` (mine; the name is the user's to change). It sees the scene with the securing omitted, the request, the steps and the question: the rebuttal's render without the argument. It answers `{"answer": "yes" | "no"}` to the question. **Rests on** the golden questions as written. **Consumer:** the decision at step 1's checkpoint.
   - [ ] **The design, reviewed before it's built** (written here for review):
     - **Render:** `renderArguedParts`' scene and question, joined as in the rebuttal's render, with no argument and no tags. The scene is in the render step 0 picks; if step 0 picks the explicit render, Reading the scene is dropped from the prompt below, and if it picks both, the ruling runs as a pair. `upstream: 'golden'` only: the lifted arguments have no question (`fitsCurrentContract`), so `lifted` is refused as missing.
     - **Prompt, `ruling.1.txt`:**
       - Role: answer one question about a player's plan in a game world;
       - Reading the scene: verdict draft 7's, the ordinary-default sentence included;
       - Reading the steps: unchanged;
       - Task: one or two sentences on what the scene and the steps establish about the question, then the block.

       There is no stance and no mention of sides, since nothing argued is shown. The cap is 400.
     - **Grade** through the stage's contract: the block parses, and `answer` is `yes` or `no`, graded against each cell's `expected.ruling`.
     - **Expected answers** (mine, for review before the batch). The questions' polarity is mixed, which checks for a bias toward yes:

       | Cell | Golden question | Expected | Plan |
       | --- | --- | --- | --- |
       | OC-11, OC-3 | Is [table1] too large to fit inside [cup1]? | yes | can't |
       | OC-18 | Is [table1] too large and structurally unsuited to fit into [cup1]? | yes | can't |
       | OC-1, OC-20 | Is [table1] too large and heavy to be picked up by a single person? | no | can |
       | OC-2 | Does holding nothing keep the player from lifting [cup1] directly? | no | can |
       | OC-6 | Must [tea2] be transferred to another container …? | no | can |
       | h5 | By the time of the pour, is [teapot1] still where it can pour into [cup1]? | no (the teapot loose, the glue omitted) | can't |
       | h7 | By the time of the pour, is [cup1] still where [teapot1] can pour into it? | no (the slide line) | can't |
       | h10 | the same question as h7 | **yes:** step 1 has taken [saucer1], with [cup1] on it, off the table | can |
       | OC-9 | Is [table1] too large and heavy …? (the trestle) | open, ungraded | open |

       **h10 differs from its verdict expectation** (`argument`, an exchange reading). Here only the world is asked about, so the answer follows the state. h5 and h10 are read apart, as before.
     - **Cells:** the eleven, each with `expected.ruling` and `lookFor.ruling`.
   - [ ] **Build:** the stage (`oraclePieces/trial/ruling.ts`), registered in `index.ts`, with its tests: the render (no argument, the question last before the Task), the golden-only refusal, the grade, the cells, and a run through the probe with a stub. The existing render pins stay green, unchanged.
   - [ ] **The rubric,** in `oracleLoopDrafts/trial/ruling.1.notes.md`, written before the batch, and the payload at a full scratchpad path.
   - [ ] **The first batch:** `{"stage": "ruling", "upstream": "golden"}`, 11 cells x1. Deploy first.
   - [ ] **The confirm:** x3 on the cells the first batch got right, the size cells and the guards at least. Run only if the first batch separates them.
   - [ ] **Checkpoint, with the user.** The decision it serves is whether to go on to step 2.
     - **The bar (mine, provisional):** the size cells and the guards right at x3 (OC-11, OC-18, OC-3, OC-1, OC-2, OC-20, OC-6), a split no verdict batch reached.
     - **If met:** the question carries the judgment, and step 2 tests whether the case against can write one.
     - **If not:** the framing doesn't rescue free judgment on Micro. The finding goes up, and verdict drafting resumes in the parent.
2. [ ] **The case against gives its question** (the user's job for it, above). Its own design goes here before it's built, after step 1's checkpoint. It is booked in the parent's later items as "the case against giving its question".
   - The shape, provisional (mine): `TrialArgument`'s `question` becomes the reply's main field, with the argument reduced to why its answer makes the plan impossible. It may name which answer blocks (QS-2).
   - Measured twice:
     - **read by hand:** is each question the deciding one, or the salient one (the securing, against batch 1)?
     - **lifted into the ruling:** the questions recorded with what they `consumed`, `upstream: 'lifted'`. Graded per cell: does the plan's outcome come out right?
3. [ ] **The rebuttal as the relevance attack** (mine, from the user's glued-teapot example). Designed here after step 2, and only if step 2 holds. Its question is whether the rebuttal can say "true, but it doesn't bear on the plan", and whether the judge can weigh that against the question's answer. It may need a verdict stage of a new shape. That is the parent's "the relevance attack as its own sentence" item.
4. [ ] **Fold back into the parent** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| QS-1 | The expected answers in step 1's table, h10's especially | Step 1's cells | The user's review | Open (mine) |
| QS-2 | Whether a question names which of its answers blocks the plan, or code keeps each question's polarity. The golden questions are mixed, and the rebuttal's renders are pinned to them as written | Step 2's contract | Step 2's design | Open |
| QS-3 | Whether the ruling ever sees the argument: a control for anchoring, the argument tagged beside the question | A step 1 follow-on | Step 1's checkpoint | Open; not in step 1 |
| QS-4 | Whether the explicit render states the securing ("[teapot1] is glued to [table1], so it stays with [table1] however [table1] moves"). The trial omits it, since the case against argued it in 10 of 11 (against batch 2), and an explicit line makes it louder. The non-rule cell shows it in a Rules section | Step 0's render, and every trial stage after | The user's call | Open; omitted in step 0, as in the trial |
| QS-5 | Step 0's reading questions and their expected answers | Step 0's cells | The user's review | Open (mine) |

## How we work

- The parent's [How we work](AGENT.nonRuleCell.planning.md#how-we-work) holds:
  - the user runs each batch, and I write each payload to the scratchpad and give its full path;
  - results go to a file, read with `jq`;
  - one repeat to explore, three to confirm;
  - one change per draft, with a rubric before each batch;
  - each change attributed.
- The drafts live beside the trial's others, in [`oracleLoopDrafts/trial/`](oracleLoopDrafts/trial/iterations.md), as `ruling.N.txt` and `ruling.N.notes.md`. Problems and library entries continue the trial's `TR-P` and `TR-L` numbering in its `iterations.md`.
- Batch numbers continue the trial's, from 17.
- **Every iteration is marked here,** on its step's item, as it lands. The parent's trial item gets one pointer line, not a record per batch, until the fold back.

## Verification

- **Each build:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, no output. `renderPins.test.ts` unchanged and green.
- **A batch:** its form check, its tally, then every reply against the rubric written before it.
- **Links:** every relative link and anchor in this plan and the parent resolves.

## Progress

| Step | State |
| --- | --- |
| The explicit scene render | Designed, pending review |
| The ruling, alone | Designed, pending review; its render waits on step 0 |
| The case against gives its question | Not started; after step 1's checkpoint |
| The rebuttal as the relevance attack | Not started; only if step 2 holds |
| Fold back | Not started |

## When it finishes

It finishes at any step's checkpoint that ends the prototype, or after step 3. Then:
- **The parent's trial design is amended, or not:**
  - **if the question holds,** a design section in the non-rule cell plan records the three roles, each stage's contract, and the batches' results in brief. Its later items and the held labels item are revised to fit.
  - **if not,** the finding goes on the trial's step 3 item, and verdict drafting resumes from draft 8.
- **The trial's `iterations.md` keeps the entries.** The `ruling.N` drafts and notes stay in the trial's folder.
- **What step 0 showed about rendering** goes to sceneProjection's SP-10 row, and `renderSceneExplicit.ts`, if kept, to the `sceneProse` docs.
- **What the batches showed about Micro** goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The ruling stage, if kept, goes in calibration's trial paragraphs.
- **Open rows** move to the parent or are settled.
- **A sweep for inbound links,** then this plan is deleted.
