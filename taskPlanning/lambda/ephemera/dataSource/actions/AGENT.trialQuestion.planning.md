# The trial's question: the judge answers the case against's question

**Status (2026-11-17): paused after step 2. Step 0, the explicit scene render, comes first (the user's, added 2026-11-16): its design was reviewed by the user (2026-11-17): QS-4, the securing as a pre-processing step; QS-5, the questions, with R-2 dropped; the stance kept as a frame in the Role. Built the same day: the explicit render, the `sceneReading` piece, the two drafts and the rubric. Batches 17 and 18 ran: `sections` 6 of 8, `explicit` 8 of 8. The `sections` misses (R-3 and R-9) settle from absence, "not established" read as no. The confirm at x3 (batches 19 and 20) held: R-3 `sections` 2 of 4 against `explicit` 4 of 4, R-9 0 of 4 against 4 of 4. At the checkpoint (2026-11-17) the user chose the explicit render for step 1. Their reading: taking away the "you are interpreting a data structure" framing unlocked Micro's common sense. Step 0 is done. Step 0.5, delivery by system instructions (the user's idea, 2026-11-17), tested on the verdict: its design was reviewed by the user (2026-11-17), with the two parts built in code by `renderParts`, not split at run time. Built the same day. Batch 21 (8b by system delivery) held 16b's 4 of 10; the misses are reasoning (size read as absolute, off-question rebuttals accepted), not source trust. The user kept it as a tuning option: the tool is the gain. Step 0.5 is done. Step 1's design, on the explicit render, and its expected answers (QS-1) were reviewed by the user (2026-11-17). Built the same day, with the draft `ruling.1.txt` and its rubric. Batch 22 scored 9 of 10, with every size cell and guard right; the one miss is h10 (step 1 unused). The confirm, batch 23a, held 21 of 21, so the checkpoint's bar is met. The guards mostly settle from absence toward the plan-allowing answer. At the checkpoint (2026-11-17) the user chose to go on: the judge keeps the explicit render, and the case against takes it too, in step 2. Step 1 is done. Step 1.5 (the user's, 2026-11-17) retests earlier judge shapes on the explicit render, the verdict and the walk, before step 2. Its design was reviewed by the user and built the same day, with both drafts and rubrics; batches 24 and 25 ran: the verdict held 16b's 4 of 10 on the explicit render: its misses are not the render's, and weighing argued text is set aside, not rejected (the user). The walk scored 6 of 10, with the glue its main failure. At the checkpoint (2026-11-17) the user took these results as enough, handed to the oracle loop. Step 1.5 is done. Step 2's design was reviewed by the user (2026-11-17), with QS-2 settled (the case against gives its question and the answer that blocks) and the securing omitted for this step. Built the same day, with `against.2.txt` and its rubric. Batch 26: the size questions right, every `blocking` no, and the hops all asking after the omitted securing. Lifted. Batch 27, the ruling on those questions, scored 7 of 10 against the golden 9: the deciding questions held, and the hops' securing question was settled by absence. Draft 3 (batch 28) failed the stop rule agreed before it, 1 of 3 hops. At the checkpoint (2026-11-17) the user stopped step 2 on batches 26 and 27, with the questions kept as a tuning tool. **This plan is paused** while the hops' need, clearer state across steps, goes upstream to the action representation, the play-by-play and `consequences`. The new capacities are booked on the oracle loop.** Opened from the [non-rule cell plan](AGENT.nonRuleCell.planning.md)'s trial, after verdict batch 16 and the checkpoint at which the user chose to keep drafting the judge. This plan is a prototype and its measurement. It folds back into the non-rule cell plan when it finishes ([When it finishes](#when-it-finishes)).

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
| **The securing omitted** from what the trial's stages see (against batch 2) | Kept for step 2, for a like-for-like comparison; not settled as permanent (the user, 2026-11-17) | h5's expected answer holds only with it omitted |
| **The verdict on draft 8,** held while this prototype runs | Held (user, 2026-11-16: keep drafting the judge; this plan is that drafting by another route) | |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **The explicit scene render, probed on reading questions** (the user's idea, 2026-11-16). Each prompt today carries a guide for translating the render into English ("Reading the scene"), beside a render that is not very explicit English. The idea is to drop the guide and build the explicit render. Its first example, the user's: "When [table1] moves, unsecured objects on it ([saucer1]) move with it unless the physics would indicate they come off". The per-object default is also the user's: "Other properties of this object are not established, and assumed to be normal in context". Writing the thing's gloss into that default, and dropping "not established", are mine and agreed. **Rests on** the lessons that reading sections are read past, and that the settling slot is filled from the most authoritative nearby text. **Consumer:** step 1, which is built on the render this step picks. What it finds about rendering goes to sceneProjection's SP-10, which is open.
   - [X] **The design, reviewed before it's built** (mine unless marked; reviewed by the user, 2026-11-17, with QS-4, QS-5 and the stance in the Role settled):
     - **The guide's three kinds,** each rendered:
       1. **Decoding the format:** handles, and a row indented under a row being on or in it. The Graph's indented list is replaced by a line per thing that says where it is in words. The Fiction stays as it is.
       2. **What moves with what:** each thing that holds something gets a conditional line, with the physics left to the reader: "When [table1] moves, what is on it moves with it, unless the motion slides or tips it off." For contents: "… unless the motion spills it out."
       3. **What is unstated** (the user's default, with the gloss): "In everything the scene doesn't say, [table1] is as an ordinary small round tea table is." A thing with no gloss takes its name: "as an ordinary cup is".
     - **The securing: rendered when the scene has it, removed before the render** (the user, 2026-11-17). The explicit render renders whatever scene model it is handed, securing included. Whether a prompt shows the securing is a pre-processing step on the scene model, applied or not, and not a property of the render. That step exists already: `withoutSecuring` (`sceneProse/sceneRules.ts`), which the trial applies through `renderNonRuleCell(cell, { securing: 'omitted' })`. It drops each secured `Custom` relation and each bare `SecuredTo`. The justifying links go with them, since the scene model folds `Justifies` into the `secured` flag (QS-4).
       - **With the securing present,** a secured thing's carry line takes the place of the conditional one, for example: "[teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped" (the wording mine, provisional). Its direction (a host end against a non-host end) comes from the rule `actionRule` in `sceneRules.ts` already applies, reused rather than restated. A golden test on a scene with securing pins it, though no step 0 batch shows it.
       - **With the securing removed,** nothing is said about fastening either way. A line calling [saucer1] "loose" or "not fastened" would assert what the omission leaves silent, and on h5 it would be false, since [teapot1] is glued and that is omitted.
       - **Step 0's batches run with it removed,** matching the trial today. No question in R-1..R-9 reads the secured wording (on h7, R-8 is no either way). Trying it shown takes a question of its own, such as "If [table1] is tipped steeply, does [teapot1] stay?", expected yes when shown.
     - **The stance, kept as a frame in the Role** (the user, 2026-11-17; the placement and wording mine, agreed). The old scene guide had two parts: what the render means, and how to read the scene as a whole (the rule cell's judge, for example [`oracleLoopDrafts/12.txt`](oracleLoopDrafts/12.txt): "This place is fiction, not a simulation"). The three kinds above render the first part. The second is about no one thing, so it can't become per-thing lines:
       - **absence:** a thing the scene doesn't mention is neither present nor absent, and the per-object default covers only the things listed;
       - **precision:** the scene gives relations, not exact positions;
       - **persistence:** an established fact holds without being shown to survive;
       - **who answers what:** the scene says what is here and how it is placed, and what things are like and can do comes from what you know of the world.

       It goes in the Role, not in a Reading section, since reading sections are read past (verdict drafts 4 and 7). The draft wording, provisional: "The scene is the fiction established so far, not a full simulation: what it states is true, what it leaves out is open, and what things are like comes from what you know of the world." Both arms carry it word for word. So the `sections` arm differs from the trial's draft 7, which had no stance, and the probe measures only the translation.
     - **Held constant between the two arms:** the Fiction, the Role with its stance, the Task and the questions. The probe's prompt has no request and no steps: each question is asked of the scene alone, its "if" questions being hypotheticals about the scene, not part of a plan. That framing is quieter than the trial's, where the misses came with a confident text beside the scene (TR-P21), so the arms may both reach the ceiling. In that case the decision below goes to "both, as a pair". The steps' own guide (roles, consequence lines, "the state left by the steps before") is a later candidate for the same treatment as the scene's, in step 1 or after.
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
       - **`explicit`:** the render above, of the scene after `withoutSecuring`, with no Reading the scene.

       Both drafts (`reading.1s.txt` and `reading.1e.txt`) are otherwise word for word the same: a Role (answer one question about a scene in a game world, with the stance above), and a Task (one or two sentences on what the scene establishes about the question, then `{"answer": "yes" | "no"}`). The cap is 400.
     - **The questions** (QS-5; the questions and expected answers mine, accepted by the user, 2026-11-17, with R-2 dropped). They are drawn from the trial's misses, since SP-10's reading questions were right on every render (24 of 24) and could not tell renders apart. Their polarity is mixed. Each is asked of a corpus case's scene, as the trial's cells render it:

       | ID | Scene | Question | Expected | The miss it aims at |
       | --- | --- | --- | --- | --- |
       | R-1 | OC-11 | Could [table1] fit inside [cup1]? | no | the size (TR-P16: "small round, so it fits") |
       | R-3 | OC-1 | Could one person pick up [table1]? | yes | the guard's size, the other way |
       | R-4 | OC-6 | Is [tea2] in something tea can be poured from? | yes | the guard's container |
       | R-5 | h7 | If [table1] is tipped steeply, does [cup1] stay where it is? | no | the slide (TR-P14) |
       | R-6 | h7 | If [table1] is carried level across the room, do [saucer1] and [cup1] go with it? | yes | the carry |
       | R-7 | h7 | If [saucer1] is picked up, does [cup1] come with it? | yes | h10's hinge, step 1 |
       | R-8 | h7 | If [saucer1] is picked up, does [teapot1] come with it? | no | the carry spread too far (`affordance`'s failure in SP-10) |
       | R-9 | h7 | If [cup1] is held under [teapot1]'s spout and [teapot1] is tilted, does tea go into [cup1]? | yes | an unstated capacity, the default |

     - **The measure:** each arm a payload, 8 cells x1 (batches 17 and 18), then x3 on any question the two arms split on.
     - **The decision it serves:** which render step 1 is built on.
       - **The explicit render** if it is right wherever `sections` is, and right on at least one of the misses that `sections` gets wrong.
       - **Today's render** if `explicit` loses a question `sections` gets right, unless the loss is in wording the next draft can fix. That's the user's call at the checkpoint.
       - **Both, as a pair in step 1,** if neither arm misses anything: the questions were too easy again, and the ruling's own cells tell the renders apart.
     - **What to read beyond the tally:**
       - whether the stance's "what it leaves out is open" is read as "unknown, so no": TR-P20's failure, and in the explicit arm it pulls against the per-object default. R-9, an unstated capacity, is where it shows;
       - whether the default line is quoted as the settling source ("ordinary, so it works") where it shouldn't decide;
       - whether the conditional "when it moves" lines are read as events that happened;
       - whether the repeated lines are skimmed.
   - [X] **Build** (2026-11-17):
     - [X] `renderSceneExplicit.ts` with a golden test on `teaTable` and `teaTableCupOnFloor` with the securing removed, and on `teaTable` and `teaTableChained` with it shown;
     - [X] the `sceneReading` piece with its cells and tests (each render, the refusal of a missing `render`, the grade, a run through the probe with a stub), registered in `pieces.ts`;
     - [X] the trial's render pins stay green, unchanged.
     - **As built** (mine, for the user's review; each departs from or adds to the reviewed design):
       - **"as an ordinary tea is"**, where the design's golden has "as ordinary tea is". The scene model can't tell a mass noun from a count noun, and a list of mass nouns would be a closed lexicon for an open vocabulary. The article is always "an", since "ordinary" follows it. If this is contested, it becomes an Open decisions row.
       - **With the securing shown, the host's carry line names only its loose children:** "When [table1] moves, [saucer1] moves with it, unless …". The design said the secured thing's line "takes the place of the conditional one" but not what the host's line becomes. A secured line sits after the thing's place. When neither end hosts the other (the chain to the wall), the line is the fact followed by `actionRule`'s sentences, reused.
       - **Shapes step 0 doesn't probe throw:** a join, a spread thing, Concepts. A part or section is listed and gets no carry line.
       - **The question line** is `The question: …`, last in the render.
       - **The grade** is the probe's default (`pieceAnswer`), with no stage contract, since the piece isn't a trial stage.
       - **Helpers exported, not restated:** `listWords` (`renderSceneRegisters.ts`), `securingWords`, `actionRule` and `hostsOf` (`sceneRules.ts`), and `targetWords` (`sceneWording.ts`).
   - [X] **The drafts and rubric** (2026-11-17): [`reading.1s.txt`](oracleLoopDrafts/trial/reading.1s.txt) (1032 chars), [`reading.1e.txt`](oracleLoopDrafts/trial/reading.1e.txt) (515), the rubric in [`reading.1.notes.md`](oracleLoopDrafts/trial/reading.1.notes.md), and the two payloads in the session's scratchpad, `batch17-sections.json` and `batch18-explicit.json`.
   - [X] **Batches 17 and 18** (2026-11-17): `sections` 6 of 8, `explicit` 8 of 8, none malformed ([results](oracleLoopDrafts/trial/reading.1.notes.md#batches-17-and-18-2026-11-17-8-cells-x1-each)). Every `sections` answer settled from absence was a no: R-3 and R-9 wrong, and R-5 right by the same move. Verdict draft 7's ordinary-default sentence was read past a fourth time. `explicit` overrode the absence from the default line (R-3), and quoted the carry lines as rules, never as events.
   - [X] **The confirm** (2026-11-17), x3 on the questions the arms split on, R-3 and R-9: batches 19 (`sections`) and 20 (`explicit`). Over the two batches, `sections` got R-3 2 of 4 and R-9 0 of 4, and `explicit` got both 4 of 4 ([results](oracleLoopDrafts/trial/reading.1.notes.md#the-confirm-batches-19-and-20-2026-11-17-r-3-and-r-9-x3-each)). `explicit`'s descriptions are weaker than its answers: none of R-9's four supports its yes.
   - [X] **Checkpoint, with the user** (2026-11-17): **the explicit render, for step 1,** by the decision above. The user called the results strong, and encouraging for strength downstream. **The user's reading:** taking away the "you are interpreting a data structure" framing (a guide decoding a format, beside a render that needs decoding) unlocked Micro's ability to apply common sense. The guide's ordinary-default sentence had been read past four times. The same rule, written into each thing's own line, settled R-3 and R-9 every time (TR-L18). **Carried into step 1:** the descriptions can be weaker than the answers (R-9, none of four supporting its yes), so the ruling's rubric reads whether each description supports its answer. What this shows about rendering was recorded on sceneProjection's SP-10 on 2026-11-17 (the user's timing; [the note](AGENT.sceneProjection.planning.md#the-explicit-render-evidence-from-the-trial-2026-11-17)): the evidence, a direction pending step 1, and the scene-render consumers as the refactor's scope. **The ruling is the first prototype of that refactor:** the first consumer with a request and steps beside the scene. It covers the scene half only, since Reading the steps stays.
1. [X] **The ruling: the judge answers the golden question alone** (the probe mine; the framing the user's). It is a new answered stage of the `trial` family, `ruling` (mine; the name is the user's to change). It sees the scene with the securing omitted, the request, the steps and the question: the rebuttal's render without the argument. It answers `{"answer": "yes" | "no"}` to the question. **Rests on** the golden questions as written. **Consumer:** the decision at step 1's checkpoint.
   - [X] **Step 0.5: delivery by system instructions** (the user's idea, 2026-11-17; flagged after batch 16 as "system/user delivery to check"). It sits here because it comes before the ruling's build, but it doesn't gate the ruling: the ruling's first batch keeps user delivery, so that batch stays one change. Today every probe sends one user message, and `invokeBedrockConverseText` has no `system` parameter. **The idea:** the Role and the scene go in system instructions, which Micro may trust more, and the argued text goes in the user message. **Rests on** nothing measured: whether Micro trusts system text more is the question. **Consumer:** every later stage, as an option for tuning.
     - [X] **The design, reviewed before it's built** (mine unless marked; reviewed by the user, 2026-11-17, with `renderParts` in place of a run-time split, and the verdict's two parts accepted):
       - **The Bedrock wrapper:** `InvokeBedrockConverseTextParams` gains an optional `system?: string`, sent as Converse's `system: [{ text }]`. Absent, the request is as today, so production and every existing caller are untouched.
       - **The probe:**
         - a payload gains `delivery: 'user' | 'system'` at the top level, beside `repeats` and `model`, defaulting to `user`;
         - an answered or read piece gains an optional `renderParts(cell, options) → Promise<{ system, user }>`, which builds the two parts as separate strings in code. Nothing splits a rendered string at run time (the user, 2026-11-17). `delivery: 'system'` on a piece without `renderParts` is refused before any call;
         - in either delivery, a piece with `renderParts` has `render` return `system`, a blank line, then `user`. A test pins that this join is byte for byte today's render, so the inputs hashes, the render pins and every check (which reads the whole render) are unchanged. The join is what the inputs hash and the checks read, and under `delivery: 'user'` it is also what is sent. Under `delivery: 'system'` the hash is the same, since the text is the same, so the response's `delivery` is what tells the two apart (batch 21 against 16b, for example);
         - with `system`, the system text is the instructions, a blank line, then the system part, and the user message is the user part;
         - the text and its order are unchanged, only delivered in two messages: today's prompt is the instructions, then the render, and the draft's Task is already before the scene. The prompt is built in two places, `runPieceProbe` and `runReadPiece`, and both take the delivery;
         - the response reports `delivery`;
         - `runProbeCalls` (`oracleLoop/runOracleProbe.ts`) takes an optional `system` per prompt.
       - **The verdict's parts,** from `renderArguedParts`, which already returns the scene and the question as separate strings:
         - The system part is `parts.scene`: the scene, the request and the steps (`renderNonRuleCell`). The request and steps are the system's own record of the plan, not argued material, so they go with the scene. **Mine, accepted by the user (2026-11-17).**
         - The user part is the question, then the two tags. **Mine, accepted by the user (2026-11-17):** the question goes with the argued text. In step 2 the case against writes the question, so it is argued material, not trusted.
       - **The test, batch 21:** verdict draft 8b (`verdict.8b.txt`, unchanged) on the lifted pairs, with `delivery: 'system'`, 11 cells x1. Compared with batch 16b (4 of 10). One change: the delivery. Deploy first.
       - **Rubric** (in `verdict.8.notes.md`'s results, written before the batch): the tally against 16b; the settling clause's source (TR-P21: is "the scene says" still followed by the rebuttal's line?); the size cells and the guards; whether any reply treats the system text as something to report on, not something to reason from.
       - **The keep rule** (the user, 2026-11-17): the option is kept unless it moves the verdict strongly in the wrong direction. It is worth having for later tuning even before it delivers value. Whether a later stage uses it by default is decided at that stage, not here.
     - [X] **Build** (2026-11-17): `system` on `invokeBedrockConverseText`; `delivery` on the payload and in the response; `renderParts`, `joinParts` and `promptFor` in `pieceProbe/oraclePiece.ts`, the one prompt builder both runners use; `renderTrialVerdictParts` on the verdict, which `renderTrialVerdict` joins. Documented in calibration's Piece probe and `llm/AGENT.md`. The build as planned, with tests: the wrapper passes `system` through, and omits it when absent; `delivery: 'system'` sends the instructions and the system part as the system text and the user part as the user message; a piece without `renderParts` is refused; the verdict's `render` is its two parts joined, and its user part starts at the question. The render pins stay green, unchanged.
     - [X] **Batch 21,** and the user's call at the keep rule (2026-11-17; [results](oracleLoopDrafts/trial/verdict.8.notes.md#batch-21-8b-by-system-delivery-trialquestion-step-05)): 4 of 10, as 16b, with only OC-9 (ungraded) changed, toward the ordinary. The size cells settle from the scene's own "small round tea table", so source trust can't be told apart on them. What fails is reasoning: "small" read as absolute, and rebuttals that answer another question accepted. **Kept** (the user): the main thing is that the tool is now available, even where later tuning finds it isn't the right one; the verdict keeps its divide as it stands.
   - [X] **The design, reviewed before it's built** (mine unless marked; reviewed by the user, 2026-11-17, as written, with the expected answers, QS-1):
     - **Render:** `renderArguedParts`' scene and question, joined as in the rebuttal's render, with no argument and no tags. The scene is in **the explicit render** (step 0's checkpoint, 2026-11-17), of the scene after `withoutSecuring`, so Reading the scene is dropped from the prompt below. The rebuttal's and verdict's renders and pins stay unchanged, so the ruling needs its own scene part. `upstream: 'golden'` only: the lifted arguments have no question (`fitsCurrentContract`), so `lifted` is refused as missing.
     - **Prompt, `ruling.1.txt`:**
       - Role: answer one question about a player's plan in a game world, **with step 0's stance as its frame**, word for word: "The scene is the fiction established so far, not a full simulation: what it states is true, what it leaves out is open, and what things are like comes from what you know of the world." The user, 2026-11-17: a necessary part of every Role that reads the explicit render. **Its standing is a carried default, not a measured finding:** both of step 0's arms had the stance, so its contribution was never isolated. It didn't stop `sections` reading absence as no, and whether the explicit render needs it is untested;
       - Reading the scene: dropped, since step 0 chose the explicit render;
       - Reading the steps: unchanged;
       - Task: one or two sentences on what the scene and the steps establish about the question, then the block.

       There is no mention of sides, since nothing argued is shown. The cap is 400.
     - **Grade** through the stage's contract: the block parses, and `answer` is `yes` or `no`, graded against each cell's `expected.ruling`.
     - **Expected answers** (mine, accepted by the user, 2026-11-17: QS-1). The questions' polarity is mixed, which checks for a bias toward yes:

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
   - [X] **Build** (2026-11-17): the stage (`oraclePieces/trial/ruling.ts`), registered in `index.ts`, with its tests: the render (no argument, the question last), the golden-only refusal, the grade, the cells, and a run through the probe with a stub. Every cell renders in the explicit render, OC-9's tavern included. The existing render pins stay green, unchanged. The draft is [`ruling.1.txt`](oracleLoopDrafts/trial/ruling.1.txt) (1019 chars), as designed: the stance in the Role, Reading the steps verdict 8b's word for word, and reading.1e's Task with "and the steps" added.
     - **As built** (mine, for the user's review; each departs from or adds to the reviewed design):
       - **The scene part:** `renderNonRuleCell` gains `scene: 'judge' | 'explicit'` (default `judge`), which swaps only the scene block, so the request and steps are the non-rule cell's and every other render is byte for byte unchanged. One optional field on the existing render, not a second render.
       - **The question line is `The question: …`** (sceneReading's), not `renderArguedParts`' "The question the argument answers: …", which names an argument the ruling doesn't show.
       - **`lifted` is refused through `fitsCurrentContract`** ("doesn't fit the current contract: it has no question"), not by the options. When step 2's arguments carry questions, `lifted` renders with no code change. The argument's step is still checked against the plan's steps, as the rebuttal's render does.
       - **No `renderParts`:** the first batch keeps user delivery (step 0.5), so `delivery: 'system'` is refused on this stage for now.
       - **The look-fors** (`lookFor.ruling`, mine, written before the batch): from QS-1's answers, each naming what the description should use (the size compared, the slide line, step 1). h5 and h10 carry "read apart" notes.
       - **The contract repeats the verdict's parse shape** with its own answer set. Sharing one would touch the verdict's tested contract; left for a cleanup.
   - [X] **The rubric** (2026-11-17), in [`ruling.1.notes.md`](oracleLoopDrafts/trial/ruling.1.notes.md), written before the batch, and the payload in the session's scratchpad, `trial-ruling-1-payload.json`.
   - [X] **The first batch,** batch 22 (2026-11-17; [results](oracleLoopDrafts/trial/ruling.1.notes.md#batch-22-2026-11-17-11-cells-x1)): **9 of 10**, 0 malformed. Every size cell and guard is right, which no verdict batch reached. The size cells compare the two sizes from common sense, and h7 reads the slide line. The one miss is h10: the tip is taken to move the cup, and step 1 goes unused. Also seen (mine, x1): the player's request read as evidence that the plan can happen (OC-1, and OC-9 against its own reading of the trestle).
   - [X] **The confirm:** x3 on the cells the first batch got right, the size cells and the guards at least. Run only if the first batch separates them. Batch 23, split at the cap of 24 calls: **23a**, the seven cells the bar reads (the size cells and the guards) x3, 21 calls, `trial-ruling-1-confirm-a-payload.json`; **23b**, optional, the three OC-30 hops x3, 9 calls, `trial-ruling-1-confirm-b-payload.json` (mine: whether h5 and h7 hold, and whether h10's miss is stable).
     - **Batch 23a** (2026-11-17; [results](oracleLoopDrafts/trial/ruling.1.notes.md#batch-23a-2026-11-17-the-confirm-the-seven-cells-the-bar-reads-x3)): **21 of 21**, so 28 of 28 over the bar's cells with batch 22. **The bar is met.** The size cells compare the sizes 9 of 9. The guards state the deciding fact in 4 of 12; the other 8 settle from absence ("nothing says it can't") toward the plan-allowing answer, which is each guard's expected one, and two of those say "we cannot determine" and then answer. Mine: a guard whose plan-allowing answer is yes would separate judgment from that default (QS-2's ground). 23b not run.
   - [X] **Checkpoint, with the user.** The decision it serves is whether to go on to step 2.
     - **The user's call (2026-11-17): go on, the judge keeping the explicit render.** In the user's words, after days or weeks of trying to get even half this strength of common-sense reasoning from Micro, this finds the apparent cause of much of the disconnect, and resolves it. The size cells, wrong in every verdict batch, compared the sizes 12 of 12. The case against is to take the explicit render too, in step 2, while it is updated to give better results and to convey the question it poses.
     - **Carried into step 2** (mine): the guards settle mostly from absence toward the plan-allowing answer (23a). A case-against question that common sense doesn't settle may get that answer from absence alone. h10's miss is consequences-dependent: the tip has no consequence line, and step 1's state went unused.
     - **The bar (mine, provisional):** the size cells and the guards right at x3 (OC-11, OC-18, OC-3, OC-1, OC-2, OC-20, OC-6), a split no verdict batch reached.
     - **If met:** the question carries the judgment, and step 2 tests whether the case against can write one.
     - **If not:** the framing doesn't rescue free judgment on Micro. The finding goes up, and verdict drafting resumes in the parent.
2. [X] **The case against gives its question** (stopped at its checkpoint, 2026-11-17, on batches 26 and 27) (the user's job for it, above), **in the explicit render** (the user, 2026-11-17, at step 1's checkpoint). Its own design goes here before it's built, after step 1's checkpoint. It is booked in the parent's later items as "the case against giving its question".
   - [X] **Step 1.5: earlier judge architectures, retested on the explicit render** (the user, 2026-11-17, after step 1's checkpoint). It sits here because it comes before step 2's design, as step 0.5 sat in step 1. **The question:** was any judge shape we tuned and left behind failing for the render's sake, and so now better than the ruling? It matters because the pipeline needs more than yes or no: needs detail (improvise), needs the consequences (visualize), and the ability check (OC-9, JF-2). The new capacities themselves belong to the oracle loop, not here (the user, 2026-11-17; [booked there](AGENT.oracleLoop.planning.md#recommended-order)). This step only says which shapes are live under the explicit render. **Rests on** steps 0 and 1: Micro's common sense works on plain world statements. **Consumer:** the oracle loop's capacities item, and step 3's judge.
     - [X] **The design, reviewed before it's built** (mine unless marked; reviewed by the user, 2026-11-17, as written):
       - **Two retests, each one unit of change:** the explicit render in place of the judge render, Reading the scene dropped, and step 0's stance in the Role. Step 0 measured those three as one arm, and the user made the stance part of every Role that reads the explicit render (2026-11-17). Everything else is as the baseline draft has it.
       - **B: the verdict** (the test is the user's, 2026-11-17), batch 24:
         - **The draft, `verdict.9.txt`:** 8b with the unit above. One wording change is forced: 8b's Task says "by using the Reading the scene instructions above to consider that claim", and that section is gone. It becomes "by considering that claim in the context of the larger scene" (mine).
         - **The build:**
           - the verdict's options gain `scene: 'judge' | 'explicit'` (default `judge`), parsed by a verdict-specific parser, since `parseUpstreamOptions` refuses extra keys;
           - `renderArguedParts` passes the option to `renderNonRuleCell`;
           - the pins stay unchanged, the rebuttal's render among them.
         - **The lifted rebuttals were argued on the judge render.** Their quotes are Fiction sentences, which the explicit render keeps word for word, so every quote is still on the page. A test pins that.
         - **The payload:** lifted, 11 cells x1, user delivery, as 16b.
         - **Compared with** 16b and 21, 4 of 10 each, the guards only.
         - **What it decides:**
           - **if the size cells and h5 turn right,** the render was the bottleneck, and verdict drafting is live again for step 3;
           - **if not,** the anchoring is real (QS-3), and argued text stays out of the judge's view.
       - **A: the walk** (the non-rule cell; mine, the user agreed to the retests, 2026-11-17), batch 25:
         - **The draft, `nonRuleCell/6.txt`:** draft 3, the kept base, with the unit above, and with draft 5's `cause` made optional (NR-L9, kept on its own; the grade already reads it).
         - **Why `cause` comes too:** without it, draft 3's form fault hides 12 of 33 answers (batch 3), and the retest would grade its own form, not the render. So it's two changes against batch 3, flagged. NR-L9's effect was measured on its own in batch 5: 0 malformed, nothing else moved.
         - **The build:** `nonRuleCell`'s options become `{ scene?: 'judge' | 'explicit' }` (absent means `judge`, so every existing payload stands).
         - **The securing stays shown,** as the piece always has it. The explicit render states it as a carry line ("[teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped"), where the Graph gave `glued to [table1], secured`.
         - **NR-P1,** the securing as a blocker (13 replies in batch 3), is the miss to read. The line says what the glue does, not that anything is stuck, so it may help or make the securing louder (QS-4's worry).
         - **The payload:** 11 cells x1.
         - **Compared with** batch 3 read for substance: 15 of 30, the size cells 9 of 9, the guards 6 of 12, the hops 0 of 9.
         - **What it decides:** whether the walk, the shape that already has `needs detail` of the action or of its consequences, is live under the explicit render as the host for richer outcomes.
       - **The rubric for each** goes in its notes before its batch: `verdict.9.notes.md` and `nonRuleCell/6.notes.md`.
       - **Order:** one build and one deploy for both, then the two batches, in either order.
     - [X] **Build** (2026-11-17), as designed:
       - **The verdict:** `parseVerdictOptions` takes `{ upstream, scene? }`, and `renderArguedParts` takes `scene` through to `renderNonRuleCell`.
       - **The walk:** `nonRuleCell`'s options are none or `{ scene }`, parsed by `parseNonRuleCellOptions`.
       - **Tests:**
         - each default render is byte for byte unchanged (the pins are green and unedited, and the judge scene named renders as none);
         - the explicit render swaps only the scene block, on every cell of each piece;
         - every lifted rebuttal's quotes are still rendered lines under the explicit scene.
       - **Docs:** calibration's verdict and non-rule cell paragraphs.
       - Both payloads were run through the probe handler with a stub: 11 explicit prompts each, with no Graph and no Reading the scene.
     - [X] **Drafts and rubrics** (2026-11-17):
       - [`verdict.9.txt`](oracleLoopDrafts/trial/verdict.9.txt) (2838 chars) with [`verdict.9.notes.md`](oracleLoopDrafts/trial/verdict.9.notes.md);
       - [`nonRuleCell/6.txt`](oracleLoopDrafts/nonRuleCell/6.txt) (2791 chars) with [`6.notes.md`](oracleLoopDrafts/nonRuleCell/6.notes.md);
       - the payloads in the session's scratchpad: `trial-verdict-9-payload.json` and `nonRuleCell-6-payload.json`.
     - [X] **Batch 24 (B) and batch 25 (A)** (2026-11-17):
       - **B, the verdict** ([results](oracleLoopDrafts/trial/verdict.9.notes.md#results-2026-11-17-batch-24)): **4 of 10, every answer as 16b's,** `rebuttal` 11 of 11. On the same scene where the ruling compared sizes 9 of 9, the settling clause restates the rebuttal's inference as the scene's (h7: its invented quote). **Mine:** the render wasn't the bottleneck for this packaging of the argued text. **The user's correction (2026-11-17):** this shows only that we haven't yet found how to deliver and frame an argument so that the judge is informed by it and still draws its own conclusions. So far there are two poles: the arguments ignored (the ruling, by construction) and the arguments accepted wholesale (every verdict draft). Weighing an argument as one fallible input hasn't been reached even a little. It doesn't follow that it can't be.
       - **A, the walk** ([results](oracleLoopDrafts/nonRuleCell/6.notes.md#results-2026-11-17-trial-batch-25)): **6 of 10, 1 malformed.** The size cells 3 of 3. The guards 3 of 4, with OC-1 right for the first time from the default line; OC-20 still blocks on the chain. The hops 0 of 3. The glue is read as the table's (NR-P1) in 6 of 11, the explicit securing line notwithstanding. **Mine:** not a clean comparison with the ruling, which saw the securing omitted, and two of three hop failures turn on the glue.
     - [X] **Checkpoint, with the user** (2026-11-17): **the current results are enough;** no securing-omitted batch for the walk (my lean, agreed by the user). **Handed to the oracle loop's capacities item, as live under the explicit render:**
       - **the ruling** (C), for yes or no: 28 of 28 on the size cells and guards, the guards mostly settled from absence;
       - **the walk** (A): 6 of 10 with the securing shown, its main failure the glue read as the table's, hops 0 of 3;
       - **the verdict** (B), as packaged: the argued text accepted wholesale, unchanged by the render. Weighing argued text is QS-3's quest, set aside, not rejected.
   - [X] **The design, reviewed before it's built** (mine unless marked; reviewed by the user, 2026-11-17, as written, with one correction found in the build: see h5 below):
     - **The reply** (QS-2, the user's, 2026-11-17): the case against gives its question, and the answer it thinks makes the plan impossible. In the user's example: the question is "Can [table1] fit inside [cup1]?", and a "no" makes "put [table1] in [cup1]" impossible. `TrialArgument` gains `blocking: 'yes' | 'no'` and its `question` is required in the contract. The JSON block, its keys in this order (mine): `{"question", "blocking", "step", "argument"}`, the argument reduced to why that answer makes the step impossible. **Why the answer is given, not kept by code** (the user): in step 3 the rebuttal can attack the inference itself ("that answer doesn't make it impossible; examine that part of the question").
     - **The scene:** the explicit render (the user, at step 1's checkpoint), with the securing omitted (the user, 2026-11-17: for a comparison with steps 1 and 1.5 like for like; not settled as permanent). The against stage gains `scene: 'judge' | 'explicit'` beside `securing`, defaulting to `judge`, so its two pins stay unchanged.
     - **The draft, `against.2.txt`** (mine), a new contract, as the ruling was a new stage, not one change on draft 1:
       - the Role with step 0's stance, word for word;
       - Reading the scene dropped;
       - Reading the steps kept as draft 1 has it (with "judged separately" for fastening);
       - the Task: the one question whose answer does the most to show the plan can't happen as written, the answer that would, the step it turns on, and why, in a sentence or two of prose, then the block.
     - **The golden arguments gain `blocking`** (mine, from QS-1's table): yes for the three size questions, OC-2, OC-6, OC-1 and OC-20; no for h5, h7 and h10's "still where it can pour". So each golden's outcome is the same as its expected ruling read through `blocking`.
     - **A record hazard, flagged (mine):** the lifted rebuttals' `consumed` hash is computed live from today's golden argument (`rebutted` in `trialCases.ts`), not stored. Adding `blocking` would move the hash and still pair, silently, though batch 8's rebuttals never saw `blocking`. **My recommendation:** store batch 8's hashes as literals, computed before the edit, and hash what a rebuttal read: the golden argument without `blocking`, which its render doesn't show. Then pairing stays a check of what was read, and the verdict pins are unchanged.
     - **The ruling, graded by outcome** (mine): it still answers yes or no, and never sees `blocking`, which is argued material. Its grade becomes the plan's outcome: `blocks` when the answer equals the argument's `blocking`, otherwise `allows`. Each cell's expected outcome is derived from QS-1 and the golden `blocking`, and a test pins it to the non-rule cell's expected outcome wherever that is allows or blocks. h5 differs: the non-rule cell expects needs detail (of the consequences), and QS-1's no reads as blocks, in the scene shown with the glue omitted. OC-9 stays open. On golden questions, grading by outcome is exactly equivalent to batches 22 and 23a's grading, and a test pins that too. `lifted` then renders with no other change.
     - **The lifted slot:** step 2's against batch replaces batch 2's lifted arguments, under the trial's rule: repeat 1, or the first whose reply passes the parse, with no choosing by quality. Batch 2's arguments stay in `against.1.notes.md`. The rebuttal's lifted render moves with them; it isn't pinned.
     - **Measured twice,** as planned:
       - **batch 26, the case against,** 11 cells x1: read by hand whether each question is the deciding one or the most noticeable one, whether its `blocking` follows, and whether common sense settles it. That last is 23a's warning: where the scene is silent, the judge drifts toward letting the plan through;
       - **batch 27, its questions lifted into the ruling,** 11 cells x1, graded by outcome against batch 22's 9 of 10.
     - **Not in this step:** the rebuttal and the verdict on the new contract (step 3), and showing the securing.
   - [X] **Build** (2026-11-17):
     - **The case against's contract:** `question`, `blocking`, `step` and `argument`, every problem listed. Its options gain `scene`, defaulting to the judge render, and the explicit render swaps only the scene block on every cell.
     - **`fitsCurrentContract`** now needs the question and `blocking`, so batch 2's lifted arguments are refused until batch 26 replaces them.
     - **The goldens' `blocking`,** as designed.
     - **The pairing** (mine, as recommended): `pickPaired` gains `read`, the part of the earlier value the later stage was shown. The verdict passes `arguedAsRebutted` (step, argument, question). Batch 8's consumed hashes are literals, recorded before the edit. A test pins each literal to what the rebuttal read, and pins that it differs from the whole golden's hash.
     - **The ruling, graded by outcome:** `answers` is `blocks` or `allows`. Tests pin:
       - the expected outcomes;
       - the equivalence with grading the answer, on every cell and both answers;
       - one answer grading opposite ways under the two polarities;
       - that the render never shows `blocking`.
     - **A correction to the design** (found by the test): the cell where the ruling's outcome differs from the non-rule cell's is **h5**, not h10. The non-rule cell expects needs detail on h5 and allows on h10. The design text is corrected.
     - The render pins are unchanged and unedited. The suite: 4932 passed, `tsc` clean.
     - **Docs:** calibration's against, ruling and golden-and-lifted paragraphs.
   - [X] **The draft and rubric** (2026-11-17): [`against.2.txt`](oracleLoopDrafts/trial/against.2.txt) (1389 chars, instructions `dffffeb2`) with [`against.2.notes.md`](oracleLoopDrafts/trial/against.2.notes.md). The payload is `trial-against-2-payload.json` in the session's scratchpad. Run through the probe handler with a stub: 11 explicit prompts, no securing, form clean.
   - [X] **Batch 26, the case against** (2026-11-17; [results](oracleLoopDrafts/trial/against.2.notes.md#batch-26-2026-11-17-11-cells-x1)):
     - **Form:** 11 of 11 pass, but with no prose before the block in any reply.
     - **The size cells:** the deciding question, 3 of 3.
     - **Polarity:** `blocking` follows in all 11, and is no in all 11. Every question asks whether a precondition holds.
     - **The guards:** OC-20 the weight; OC-1, OC-2 and OC-6 ask whether something is stable, which the ordinary default settles toward allows.
     - **The hops:** all three ask whether [teapot1] is securely positioned, the omitted securing, and h7's slide line goes unused. **Mine:** a candidate mechanism is Reading the steps' "glued, chained or otherwise fastened … judged separately", the prompt's only fastening text.
   - [X] **Lift batch 26** (2026-11-17): repeat 1 on every cell. `renderPins.test.ts` gains batch 26's renders, which match the deployed batch. The lifted render tests moved from "refused" to the batch 26 questions. The suite: 4936 passed.
   - [X] **Batch 27**, the ruling on the lifted questions, graded by outcome (2026-11-17; [results](oracleLoopDrafts/trial/against.2.notes.md#batch-27-2026-11-17-the-ruling-on-the-lifted-questions-11-cells-x1)):
     - **7 of 10,** against the golden questions' 9 of 10, so the bar is not met.
     - **The deciding questions mostly held:** the size cells 2 of 3, and OC-20.
     - **OC-11 missed on the question's own wording:** "small enough" carries the scene's "small" in (TR-P16).
     - **The hops' securing question was settled by absence, both ways:** h5 and h7 reason alike and answer opposite.
     - **Mine:** the weak link is the case against's choice of question on the hops, not the ruling.
   - [X] **Draft 3, the question asked about the state at its step** (mine; the user called it sensible, 2026-11-17). One sentence added to the Task: "Ask about the state at the step it turns on, as left by the steps before it." [`against.3.txt`](oracleLoopDrafts/trial/against.3.txt) and its [rubric](oracleLoopDrafts/trial/against.3.notes.md). The payload is `trial-against-3-payload.json`, with no deploy needed. **Why:** the hops asked whether something *is* so before the plan runs, which the scene leaves open, not whether it is *still* so at the step that needs it.
     - **The stop rule** (agreed with the user, before the batch): at least 2 of the 3 hops ask about the state at their step. If it passes, lift and rerun the ruling. **If not** (the user's direction, 2026-11-17): step 2 stops where it stands, with the questions kept as a tuning tool. The hops go up as needing clearer state from upstream. The next attempt is the play-by-play and consequences revision, which would release `consequences`' hold (IM-4). **Mine, on its shape:** split it as step 0 split the scene. First, a render of the steps that states each step's resulting state, prototyped on hand-written fixture lines. Then, whether `consequences` and `playByPlay` can produce those lines.
     - [X] **Batch 28** (2026-11-17; [results](oracleLoopDrafts/trial/against.3.notes.md#batch-28-2026-11-17-11-cells-x1)):
       - **The stop rule fails, 1 of 3 by my reading.** h7 asks the state at the pour, from the slide line. h5 is borderline: it asks about the tip's effect as a capability of the teapot, with its `blocking` reversed; whether it counts is the user's call.
       - **"Can X … without spilling" took over** in 7 of 11, and OC-18 lost the size.
       - **Every `yes` for `blocking` is reversed** (4 of them), so it follows in 7 of 11.
       - No hop asks about the securing, but OC-9 invents glue.
       - Nothing lifted.
   - [X] **Checkpoint, with the user** (2026-11-17): **step 2 stops on batches 26 and 27** (the user, agreeing on h5).
     - **Batch 28** was informative but isn't a new prompt to beat. Draft 2 stays the case against's base, and batch 26's arguments stay lifted.
     - **The questions are kept as a tuning tool.** The hops go up as needing clearer state from upstream ([the imagination plan's `consequences`](AGENT.imagination.planning.md#recommended-order), and the [oracle loop](AGENT.oracleLoop.planning.md#recommended-order)).
     - **This plan pauses,** probably briefly, while the action representation is worked on upstream, in the action plan. It doesn't fold back yet.
     - **The action representation landed** (2026-11-18; the action plan retired, [its item](AGENT.oracleLoop.planning.md#recommended-order), [its rules](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)): steps and sub-items with minted paths, consequences stated as lines, possibilities as branches. The judges don't read it yet (the bridge state); moving them onto it is how this plan resumes, booked on that item. Resuming is the user's call.
     - **When it resumes on the plan:** revise is booked on the oracle loop plan's [action plan item](AGENT.oracleLoop.planning.md#recommended-order) (the user, 2026-11-18), with this plan's judges as its first consumer. A judge contesting a step's outcome, such as h5's intended pour, is the case that designs it. The open question is where the revise question comes from: a judge's free text, or a kind with code-supplied wording.
3. [ ] **The rebuttal as the relevance attack** (mine, from the user's glued-teapot example). Designed here after step 2, and only if step 2 holds. Its question is whether the rebuttal can say "true, but it doesn't bear on the plan", and whether the judge can weigh that against the question's answer. It may need a verdict stage of a new shape. That is the parent's "the relevance attack as its own sentence" item.
4. [ ] **Fold back into the parent** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| QS-1 | The expected answers in step 1's table, h10's especially | Step 1's cells | The user's review | **Settled** (the user, 2026-11-17): mine as written, h10 **yes** (the state after step 1, not the exchange reading of its verdict expectation) |
| QS-2 | Whether a question names which of its answers blocks the plan, or code keeps each question's polarity. The golden questions are mixed, and the rebuttal's renders are pinned to them as written | Step 2's contract | Step 2's design | **Settled** (the user, 2026-11-17): the case against gives the question and the answer it thinks makes the plan impossible, so the rebuttal can later attack that inference (step 3) |
| QS-3 | Whether the ruling ever sees the argument: a control for anchoring, the argument tagged beside the question | A step 1 follow-on; the quest below | Step 1's checkpoint; then a return after the judgment pieces level up | **Set aside, not rejected** (the user, 2026-11-17). Batch 24: the explicit render alone doesn't stop the verdict accepting the rebuttal wholesale. **The quest, the user's:** a judge informed by argued text that still draws its own conclusions, weighing each argument as one fallible input. Neither pole reached so far (ignored, or accepted) is that. The user calls it the holy grail of debate-based judgment: reaching it would change how the loops needed grow with complexity, not just their constant. **It is set aside while other refinements improve judgment throughout, as the simpler prototypes found the explicit render, then returned to** |
| QS-4 | Whether the explicit render states the securing ("[teapot1] is glued to [table1], so it goes wherever [table1] goes, even when [table1] is tipped"). The trial omits it, since the case against argued it in 10 of 11 (against batch 2), and an explicit line makes it louder. The non-rule cell shows it in a Rules section | Step 0's render, and every trial stage after | The user, 2026-11-17 | **Settled as a split:** the render states whatever securing its scene model holds, and whether a prompt shows it is the pre-processing step `withoutSecuring`, applied or not. Step 0 applies it, as the trial does. Whether any trial stage shows it stays open, a per-payload choice |
| QS-5 | Step 0's reading questions and their expected answers | Step 0's cells | The user's review | **Settled** (the user, 2026-11-17): mine as written, with R-2 dropped. It asked whether the scene shows [table1] to be unusually small, a judgment of what is unusual, not an observable property or consequence like the others; R-1 tests the same misreading through its consequence. The IDs are kept, so there is no R-2 |

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
| The explicit scene render | **Done** (2026-11-17): the explicit render chosen for step 1 (batches 17 to 20) |
| Step 0.5: delivery by system instructions | Done (2026-11-17): built; batch 21 4 of 10, as 16b; kept as a tuning option (the user), the verdict's divide as it stands |
| The ruling, alone | **Done** (2026-11-17): batch 22 9 of 10, confirm 23a 21 of 21; at the checkpoint the user chose to go on, the judge keeping the explicit render |
| Earlier architectures on the explicit render | **Done** (2026-11-17): the verdict 4 of 10 as before (weighing argued text set aside, not rejected); the walk 6 of 10, the glue its main failure; taken as enough at the checkpoint, handed to the oracle loop |
| The case against gives its question | Batches 26 and 27 run (2026-11-17): the composition 7 of 10 against the golden 9; the hops' questions are the weak link. Draft 3 (batch 28) fails its stop rule. **Stopped** at the checkpoint (the user, 2026-11-17): the questions kept as a tool, the hops sent upstream; QS-2 settled; the case against takes the explicit render too (the user, 2026-11-17) |
| The rebuttal as the relevance attack | Not started; paused with the plan, until the action representation lands upstream |
| Fold back | Not started |

## When it finishes

It finishes at any step's checkpoint that ends the prototype, or after step 3. Then:
- **The parent's trial design is amended, or not:**
  - **if the question holds,** a design section in the non-rule cell plan records the three roles, each stage's contract, and the batches' results in brief. Its later items and the held labels item are revised to fit.
  - **if not,** the finding goes on the trial's step 3 item, and verdict drafting resumes from draft 8.
- **The trial's `iterations.md` keeps the entries.** The `ruling.N` drafts and notes stay in the trial's folder.
- **What step 0 showed about rendering** is already on sceneProjection's SP-10 (2026-11-17). At the fold-back, add what step 1 showed about the explicit render beside a request and steps, and move `renderSceneExplicit.ts`, if kept, into the `sceneProse` docs.
- **What the batches showed about Micro** goes to [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro). The ruling stage, if kept, goes in calibration's trial paragraphs.
- **Open rows** move to the parent or are settled. QS-3's quest, weighing argued text as one fallible input, moves up as a set-aside direction, not a closed question (the user, 2026-11-17).
- **A sweep for inbound links,** then this plan is deleted.
