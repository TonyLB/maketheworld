# The action plan: referenced steps, and changes merged in

**Status (2026-11-17): opened; AP-1 to AP-7 settled by the user the same day. Step 0's design was reviewed by the user the same day, as written. Steps 1 and 2 are built: the plan type with references, and the change language with its merge. Step 3 is done: `playByPlay`'s contract builds the plan, and batches 29 and 30 hold parity, 23 of 24 (the user, 2026-11-17). Its form is booked in the imagination plan, with the explicit scene render. Step 4, `consequences` replying in the change language, brings in the explicit scene render first, as 4a (the user, 2026-11-17). **4a's build is done (2026-11-18): the shared `scene` option, and draft 2 with no core. Batch 2 is read (2026-11-18): parity on OC-30/2, OC-1 better. 4a is closed (the user, 2026-11-18): the render holds. Step 5, possibilities, was added the same day (AP-8 and AP-9, settled), to run after 4b. 4b is planned the same day: `consequences` as a reducer on one step of the plan (the user). 4b's build is done (2026-11-18), and draft 3's batch 3 is read: form 6 of 6, content at parity. Bare handles (CQ-P5) are repaired in code, and draft 4 asks for brackets. 4b is closed (the user, 2026-11-18): parity rests on batch 3. Step 5's shape is revised the same day (the user): unlabelled branches (AP-8 amended, AP-9 superseded), the handles widened to the step's own, cells for over-flagging; revise booked as step 6, a correction path. Step 5's design is done the same day, but for the over-flagging cells' baseline batch on draft 4. The cells' baseline, batch 5, is read the same day: `cup` hedged in 2 of 3 (3 with a refused block), `OC-1/teapot1` 0 of 3. Its findings are booked in the imagination plan, and `cup` is recorded, not gated (the user). Step 5's build is done the same day: possibilities, flat paths, the widened handles, the nested render. Draft 5 is written the same day, and batch 6 is read: form 10 of 12, possibilities well-formed. **Step 5 is closed on draft 5 (the user, 2026-11-18):** possibilities work at a draft level. Its tuning items are booked in the imagination plan, and AP-10 has evidence. Next: step 6 (revise, booked, not designed) or the hand back.** Opened under the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5 (the user, 2026-11-17), after the [trial question plan](AGENT.trialQuestion.planning.md) stopped its step 2 and paused. Every hop failure there was about state across steps, not knowledge of the world.

**Why:**
- **The judging pieces need more from the plan.** In the trial, the hops failed whenever the state at a step had to be worked out rather than read:
  - h10's judge left step 1's state unused, even on the golden question;
  - the case against asked whether a thing *is* so before the plan, not whether it is *still* so at the step that needs it (batches 26 and 28);
  - where a consequence was stated as a line (h7's slide), the right question came once the case against was pointed at state.
- **The generating pieces can't yet add to a plan.** `consequences` returns a block of its own, keyed by action number, and nothing merges it into the plan the judges read. Its first open item, the cup gap (the intent's own problem, 0 of 3), is the hops' failure seen from the generating side.
- **Pieces point at steps by quoting them.** `matchQuote` matches the quote back. Batch 28's h7 failed the form check there, by quoting its step with the role label attached.

**What this plan contains** (the user's, 2026-11-17):
1. a unique reference for each step;
2. a reference, unique within its step, for each sub-item: intent, consequences and the like;
3. a change language for adding to the plan ("this run adds the consequence `...` to step [reference]"), and a pipeline that merges a piece's changes in, so running `consequences` on a plan gives a new plan with the consequences interleaved where they belong;
4. then `playByPlay` refactored to create references, and `consequences` to add into the plan.

**Mine, agreed by the user (2026-11-17):**
- one plan type covering the step shapes in use today, with every existing render unchanged by default;
- sub-items referenced even where nothing cites them yet, so contested and supported claims can later be additions aimed at a consequence's reference;
- the change language additions-only at first;
- a merge in pure code, which refuses a change whose reference it can't find;
- the generator refactors held to a bar of parity, with capability tuning left to the imagination plan;
- what's out of scope, named (below).

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). This is an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md): a Prototype with consumers that run, the imagination's two asks.

## Out of scope, named so it isn't lost

- **State carried forward,** written as lines or worked out by code. The corpus's `CandidateStep.change` (the kernel's record change, where it knows one) is a starting point for working it out.
- **Contested and Supported claims** (the user's, 2026-11-17), for the case against and the rebuttal. Sub-item references are built so that these can be additions later.
- **The judging pieces reading the new plan,** and whether their prompts cite references instead of quoting. This is how the paused trial question plan resumes, with the hops on hand-written plans. It's this plan's consumer, not its work.
- **Capability tuning** of `playByPlay` and `consequences`, the cup gap first. That stays in the [imagination plan](AGENT.imagination.planning.md).
- **Removing or editing** through the change language. That waits for a consumer that needs it.
- **References stronger under reasoning** (the user, 2026-11-17, at step 3's checkpoint): slugs from hedged or second-person text are vague (`table-might-be`, `you-grasp-edge`, `there-no-clear`). They're fine for now. How references should be formed for a model reasoning over them is later work.

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read the parent's Slice 4.5 item **New judgment capacities, across pieces**, including its constraints ("carrying state across steps is weak in every shape").
3. Read the [trial question plan](AGENT.trialQuestion.planning.md)'s step 2 and its checkpoint, and the results:
   - [`against.2.notes.md`](oracleLoopDrafts/trial/against.2.notes.md), batches 26 and 27;
   - [`against.3.notes.md`](oracleLoopDrafts/trial/against.3.notes.md), batch 28.
4. Read the [imagination plan](AGENT.imagination.planning.md)'s steps 2 and 3. Then read `consequences`' [batch 1 notes](oracleLoopDrafts/consequences/1.notes.md#results-2026-11-11-batch-1) and `playByPlay`'s [draft 14 notes](oracleLoopDrafts/playByPlay/14.notes.md#results-2026-11-12-batch-15).
5. Read the code it builds on, under [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/):
   - **the three step shapes:**
     - `oracleLoop/oracleInputs.ts`: `CandidateStep`, the corpus's, with `says`, `change`, `voids` and `suppliedBy`;
     - `oraclePieces/nonRuleCell.ts`: `NonRuleStep`, with `says`, a role (intended or method) and its `consequences` lines, which the trial uses;
     - `imaginationPieces/imaginationScene.ts`: `actions`, plain strings taken from the corpus by `caseActions`;
   - **how steps are referenced today:** `quotables` and `matchQuote` in `nonRuleCell.ts`;
   - **the generators:** `imaginationPieces/playByPlay.ts`, `imaginationPieces/consequences.ts`, and `checkActionsBlock` and `renderSceneAndActions` in `imaginationScene.ts`;
   - **typed parsing:** `llm/stageContract.ts`, and `pieceProbe/stageInput.ts` (golden and lifted);
   - **the render pins:** `oraclePieces/trial/renderPins.test.ts`, which must stay green and unedited.
6. Calibration's [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
7. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` should produce no output. Both pass before any edit.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **The design, reviewed before it's built** (within AP-1 to AP-7, settled by the user, 2026-11-17; the rest mine unless marked; **reviewed by the user, 2026-11-17, as written**, the five points flagged for review included: the path as the id, no back-conversion, the single-step rule, code minting every path, and the order rule as written).
   - **What it starts from** (read in the code, 2026-11-17):
     - **Three step shapes:**
       - the corpus's `CandidateStep` (`says`, `change`, `voids`, `suppliedBy`);
       - the trial's `NonRuleStep` (`says`, a role, `consequences` lines);
       - the imagination's actions, as plain strings.
     - **`playByPlay` and `consequences` reply in one shared format** (`checkActionsBlock`): `{"actions": [...]}`, an entry per action by position, holding a line per thing keyed by handle, plus a problems list. Neither reply refers to anything except by position.
   - **The type** (AP-1), in a new `calibration/oracleLoop/actionPlan.ts` beside `oracleInputs.ts`. `CandidateStep` itself is unchanged, so the oracle harness and the corpus are untouched. A planned step is a candidate step with its address and its sub-items:

     ```ts
     type StepItem =
         | { kind: 'intent'; path: string; says: string }
         | { kind: 'consequence'; path: string; says: string; thing?: SceneHandle; intended?: true }
         | { kind: 'concern'; path: string; says: string }
     type PlannedStep = CandidateStep & { path: string; items: readonly StepItem[] }
     type ActionPlan = { steps: readonly PlannedStep[] }
     ```

     - **`thing`** keeps what the generators' per-thing lines say they're about.
     - **`concern`** holds the generators' problems lists, which parity needs kept. It is the imagination's "possible problem" (a deferral the oracle classifies), not a judge's claim. Contested and Supported stay out of scope.
     - **Intent is at most one per step,** and comes only from building a plan, not from changes.
   - **References** (AP-2):
     - a step's path is a slug of its `says`, for example `tip-table1`;
     - a sub-item's path is the step's path, a dot, then a slug of its text, for example `tip-table1.teapot1-pours-tea2`.

     **The slug rule** (mine, provisional): the text's words in order, lower case, handles without their brackets, dropping `a`, `an`, `the`, `of`, `to`, `into`, `onto`, `off`, `from`, `with`, `and`, `so`, `that`, `is` and `are`; the first three words that remain, joined by hyphens. The same slug twice in one scope gets `-2`, `-3`, in order of creation.

     **Mine, a simplification for the user's call:** with additions only (AP-4) and slugs fixed when an item is created, a path never changes. So the path can be the minted id itself, and no separate opaque id is needed until something can rename, move or remove an item. A separate id comes back then.
   - **Building a plan, with no model:**
     - **From candidate steps** (the corpus): each step's path minted, with no sub-items.
     - **From the trial's `NonRuleStep`s** (AP-7):
       - an intended step that follows a method step becomes, on the last method step before it, an **intent** (its `says`) and an **intended consequence** (the same text);
       - an intended step with no method step before it (the single-step cells, OC-1 and the like) stays a step, with an intent of its own `says` and no intended consequence. **This rule is mine, for review:** "where relevant" read as "where a method produces it";
       - each `consequences` line becomes an unintended consequence on its step.
     - **From the imagination's action strings:** steps with `suppliedBy: 'system'` (mine; the strings don't say who supplied them).

     **Existing renders don't change:** each piece goes on reading its own inputs, and the plan is built beside them. The pins are untouched by construction, not by a round trip, since AP-7's conversion merges steps and can't be reversed to the old render.
   - **Order within a step** (AP-3): by kind (intent, then consequences, then concerns), and within a kind by when the item was added: the plan's own items first, then each change block's in its order. Only the plan and the changes decide it.
   - **The change language** (AP-4), a fenced JSON block:

     ```json
     {"changes": [
       {"add": "consequence", "to": "tip-table1", "thing": "cup1", "says": "[cup1] slides off with [saucer1] onto the floor"},
       {"add": "concern", "to": "tip-table1", "says": "[cup1] is no longer under [teapot1]'s spout"}
     ]}
     ```

     - `add` is `consequence` or `concern`, and `to` is a step's path.
     - `thing` is optional, a handle with or without brackets, as the per-thing keys take it now.
     - `intended` isn't writable: changes add only unintended consequences, and intended ones come from the plan's intent (AP-7).
     - The merge mints each new item's path from its text, so the model never names an item, only the step it adds to.
   - **The merge,** pure: `mergeChanges(plan, block) -> { plan } | { problems }`. **The whole block is refused** (AP-6) on any of:
     - **form:** no block, or it doesn't parse, or `changes` isn't an array, or a change has no `says`;
     - **the address:** `to` names no step, or names a sub-item;
     - **kind:** an `add` that isn't `consequence` or `concern`;
     - **the thing:** `thing` is a handle not in the scene.

     It is a `StageContract<ActionPlan, ActionPlan>`, so the problems read as every contract's do.
   - **A render of the plan for a generator to read.** Paths shown, one step per line, its items indented, each item with its kind and path:

     ```text
     Step tip-table1: tip [table1]
       - intent tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]
       - consequence (intended) tip-table1.teapot1-pours-tea2-2: [teapot1] pours [tea2] into [cup1]
     ```

     Only the refactored `consequences` reads it. The judges' render is out of scope.
   - **The generators** (AP-5):
     - **`playByPlay` keeps its prompt and reply** (an entry per action, by position). Code builds its new plan:
       - each given action is a step, with its path minted;
       - each per-thing line becomes an unintended consequence with its `thing`;
       - each problem becomes a concern on the step it names, or on the last step if it names none.

       Parity is then a question of form only. **Mine:** the model mints nothing, since an id a model writes is a reference waiting to break.
     - **`consequences` reads the plan's render and replies in the change language:** a new reply format, so its parity batch tests the format as well as the content.
   - **Worked examples, the three hops** (each from the trial's cells, under AP-7):
     - **h5** (`tip`, then the pour): a single step, `tip-table1`, with the intent and the intended consequence above. **A `consequences` run** adds the block above. **Merged:** `tip-table1`'s items are:
       1. the intent;
       2. the intended pour;
       3. `tip-table1.cup1-slides-saucer1`, the slide;
       4. `tip-table1.cup1-no-longer`, the concern.

       The question the trial needed, whether the cup is still under the spout at the pour, is now a concern beside the intended pour on the same step.
     - **h7:** the same step, with its consequence line converted: `tip-table1.saucer1-cup1-slide` (unintended), placed after the intended pour by the order rule. Nothing is added; the plan already holds what the judge needed.
     - **h10:** two steps, `pick-up-saucer1` (no items) and `tip-table1` (as h5). A `consequences` run that adds "[teapot1] slides toward the tipped edge" on `tip-table1` merges after the intended pour. A run that addresses `pick-up-cup1`, which isn't in the plan, is refused whole: `to: "pick-up-cup1" names no step`.
   - **Tests the build will pin:**
     - each slug, and its `-2`;
     - each conversion on every existing cell;
     - the order rule;
     - each refusal;
     - the three worked examples as golden merges;
     - the pins, unedited.
1. [X] **The plan type, with references.** Every existing cell can be built into a plan: the corpus, the non-rule cell and the trial, and the imagination's asks. The existing renders are untouched, since each piece reads its own inputs, so the pins stay green and unedited. Tests:
   - references are unique and stable;
   - each existing cell converts as step 0's rules say;
   - the generator's render of a plan.

   **As built** (2026-11-17), in [`oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts) and its test, with no existing file edited:
   - **The builders:**
     - `planFromCandidateSteps`, for the corpus;
     - `planFromNonRuleSteps`, for the non-rule cell and the trial;
     - `planFromActions`, for the imagination's asks;
     - `renderPlanForGenerator`.
   - **`orderItems`,** the order rule as a stable sort by kind. Step 2's merge reuses it.
   - **Mine, edge rules step 0 doesn't cover, for review:**
     - a text that slugs to nothing takes its scope's word (`step`, or the item's kind);
     - an intended step after a method step that already has an intent throws ("one intent per step"). No cell has that shape;
     - `NonRuleStep`s are `suppliedBy: 'system'`, as the action strings are.
   - **Conversion order:** the intent and the intended consequence go before the step's own `consequences` lines, so h7's slide follows the intended pour, as step 0's example says.
   - **The render** leaves out `thing`, since the text already names it in brackets (mine).
   - **The slug rule as written** gives `put-table1-in` for `put [table1] in [cup1]`, because `in` isn't a stopword. It is kept as reviewed and pinned.
2. [X] **The change language and the merge,** in pure code, tested with no LLM:
   - a change block parses through a stage contract;
   - a merge applies the additions in place;
   - a change naming a reference that isn't in the plan is refused, and the refusal says why;
   - the merged plan renders.

   Golden changes for the hops pin the worked examples from step 0.

   **As built** (2026-11-17), in [`oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts) and its test, with no other file edited:
   - **The functions:**
     - `mergeChanges(plan, block, handles)` returns `{ plan }` or `{ problems }`;
     - `planChangesContract` reads a reply's trailing JSON block (`replyJsonObject`) and then merges it;
     - `PlanChange` is a change once checked.

     The hops' golden merges pin step 0's worked examples, h5's exactly. h10's refusal is `change 2: to "pick-up-cup1" names no step`.
   - **Mine, a departure from step 0, for review:** the contract is `StageContract<PlanChangesInput, ActionPlan>`, where `PlanChangesInput` is `{ plan, handles }`. A plan doesn't hold the scene, so "a thing not in the scene" needs the scene's handles from the caller. The handles the plan names would be too few: OC-30/2's `[saucer1]` and `[cup1]` aren't named by `tip [table1]`.
   - **Mine, edge rules step 0 doesn't cover, for review:**
     - a key other than `add`, `to`, `thing` and `says` is refused, and `intended` is named as not writable;
     - a `thing` on a concern is refused, since a concern has none;
     - an empty `changes` array is valid and leaves the plan unchanged;
     - every problem is prefixed `change N:`.
   - **Minting checks the paths already taken,** rather than counting slugs. A new item takes its slug if it's free, and otherwise the first free `-n`. The merge relies on this: a repeat of the intent's text becomes `-3`. It also closes a hole in step 1 (mine): a text that slugs to `tip-table1-2` could collide with a repeat. Step 1's paths are unchanged on every cell, and its tests pass unedited.
3. [X] **`playByPlay` refactored to create references** (done 2026-11-17). Its output becomes a plan, or the additions to one (AP-5). **The bar is parity:** its existing cells at draft 14's level (every method at the bar, no attempts), read by hand against a rubric written before the batch.
   - [X] **The build** (2026-11-17), in [`imaginationPieces/playByPlay.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/playByPlay.ts) and its test. The prompt, the render and the cells are unchanged, so the inputs hashes hold:
     - **`planFromPlayByPlay` and `playByPlayContract`,** step 0's design. The contract is now the probe's form check. Step 1's `planOf` is exported so the builder can use it.
     - **`npm run read-plans -- <results.json>`** prints a batch's plans for reading, from `playByPlayPlansText`.
     - **Mine, for review:**
       - a problem "names" a step when it says `Action N`, the render's own label; otherwise it goes on the last step;
       - consequences follow the described things' order;
       - a `"problems"` that is present must be a list of non-empty strings: the one form rule beyond `checkActionsBlock`'s, whose problems are otherwise unchanged (tested).
     - **Known before the batch (mine):** batch 15's form was 3 of 12, and only a reply that passes gives a plan. Raising the form is the imagination plan's tuning; it is raised at this step's checkpoint.
   - [X] **Batch 29, the parity batch** ([notes and results](oracleLoopDrafts/playByPlay/15.notes.md#results-2026-11-17-batch-29), 2026-11-17): draft 14's prompt unchanged (`5ca3aec6`), 4 cells x3 on Micro.
     - **Form 4 of 12** (batch 15: 3), none refused by the new `problems` rule.
     - **Every method at the bar but one reply:** OC-20 repeat 3's block narrates an attempt, in a reply that fails the form anyway.
     - **The 4 plans read cleanly.** The hedged concerns slug vaguely (`table-might-be`); a stopword addition is proposed in the notes (mine).
   - [X] **Batch 30, the confirm** ([results](oracleLoopDrafts/playByPlay/15.notes.md#batch-30-the-confirm-2026-11-17), 2026-11-17):
     - **Form 2 of 12.**
     - **Every method at the bar, and no attempts.** Across both batches, 23 of 24 are at the bar, with 1 attempt. **Parity holds (mine).**
     - **6 of 24 replies gave a plan.**
   - [X] **Step 3's checkpoint** (the user, 2026-11-17):
     - **parity:** 23 of 24 is parity, and step 3 is closed;
     - **the form:** booked in the imagination plan, with `playByPlay` refactored onto the explicit scene render. The user's main interest is how `playByPlay` responds to that render;
     - **the vague paths** (`table-might-be`, `there-no-clear`): fine for now. Making references that hold up better under reasoning is later work, booked below.
4. [X] **`consequences` refactored to add into the plan:** a run on a plan yields changes, and the merge gives the new plan. **The bar is parity** with its batch 1, read by hand. The cup gap is carried to the imagination plan, not tuned here.

   **The explicit scene render comes in the same refactor** (the user's, 2026-11-17: the explicit render was being worked in piece by piece, each time a piece needed changing). It comes in two parts, so a parity miss has one cause (the sequencing is mine, agreed):
   - [X] **4a. The explicit render, with the old reply format.** An option in the shared `imaginationScene.ts` swaps the scene section for the explicit render and drops the reading guide, as the trial's `scene: 'explicit'` does. The default is unchanged, so `playByPlay`'s hashes and the render pins hold. One batch on `consequences`' two cells (OC-30/2 and OC-1) is read against batch 1, for the render alone.
     - [X] **The build** (2026-11-18), in [`imaginationPieces/imaginationScene.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/imaginationScene.ts), [`pieceProbe/assembleDraft.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/assembleDraft.ts) and their tests:
       - **`scene?: 'judge' | 'explicit'`** in `ImaginationOptions`. Under `explicit`, `renderSceneAndActions` gives `renderSceneExplicit` of the same sub-scene, securing shown. The default renders byte for byte as before: batch 1's inputs hashes (`d1d07973`, `b96b6792`) are pinned in `consequences.test.ts`. `renderPins.test.ts` is unedited.
       - **`SCENE_RENDERS` moved to a leaf module,** [`pieceProbe/sceneRenders.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/sceneRenders.ts), since `nonRuleCell.ts` imports from `imaginationScene.ts`. The trial's stages import it from there.
       - **Mine, departures from the row, for review:**
         - **the reading guide is dropped in the draft, not by the option:** it's prompt text (core 2 is the guide, all of it), so `npm run assemble-draft` takes `-` for no core. It also gained `--options JSON` for the payload's options;
         - **the list line is `The things to describe:`** under the explicit render, since the render heads its own per-thing section `The things:`;
         - **`scene: 'explicit'` with `rules: 'consequence'` is refused:** the render states the securing as a carry line itself.
     - [X] **Batch 2** ([draft 2 notes and rubric](oracleLoopDrafts/consequences/2.notes.md), written 2026-11-18; [results](oracleLoopDrafts/consequences/2.notes.md#results-2026-11-18-batch-2), 2026-11-18): [`2.ask.txt`](oracleLoopDrafts/consequences/2.ask.txt) (`3c80dbae`), no core, `{ "scene": "explicit" }`, both cells x3 on Micro.
       - **Form 3 of 6,** as batch 1. OC-30/2's cause is new: a line for [table1] in 2 of 3.
       - **OC-30/2 at parity:** 0 of 3, 3 partly, as batch 1. The knock-on is 3 of 3, hedged in 2, and the cup out from under the spout is 0 of 3.
       - **OC-1 better:** 3 of 3, with the carry kept and no problems. The glue flag is gone.
       - **The securing line cuts both ways (mine):** "even when [table1] is tipped" ends OC-1's glue doubt, and is the likely source of OC-30/2's teapot "tipping over" and spilling (the method questioned, 2 of 3).
       - **Parity holds for the render alone (mine).**
     - [X] **4a's checkpoint** (the user, 2026-11-18): **the render holds,** and 4b builds on it. The explicit render as every piece's default is booked (below).
   - [X] **4b. The change language, on the render 4a settles.** `consequences` reads `renderPlanForGenerator` in place of the numbered actions, and replies `{"changes": ...}`. `planChangesContract` merges the reply, with the scene's handles. A short build, then a draft loop: the reply format is new to the prompt, so expect several drafts, not one parity batch.

     **A reducer, not a sweep** (the user's, 2026-11-18). The first `consequences` was a global sweep: one player request, and every action described at once. The plan now holds each step's intent, so `consequences` takes a plan, the path of the step to expand, and the things to describe, and its reply adds to that one step. What follows from that:
     - **The cells' plans are built by hand** (agreed). The corpus has no per-step intents. OC-30/2 splits as h5 does: the step `tip [table1]`, with the intent `[teapot1] pours [tea2] into [cup1]` and its intended consequence. OC-1 stays one step, `pick up [table1]`, with its own text as its intent (the single-step rule). Each is a small `planOf` per cell, tested. In production the plan comes from `playByPlay`.
     - **Parity still means something** (agreed). Both cells are single-step plans, so expanding the target step and expanding every step are the same task, and batches 1 and 2 stay comparable. **The flip side:** these cells can't test the reducer shape. A multi-step cell, with its target mid-plan and a later step that shouldn't be described, is booked for after parity.
     - **The intent changes, not just the format** (agreed). OC-30/2's intent line moves from the player's "I want to pour tea from [teapot1]" to the step's "[teapot1] pours [tea2] into [cup1]", which names [cup1]. If "the cup out from under the spout" (0 of 3 so far) moves, this is a possible cause beside the format. The rubric records it. It isn't avoided, since the per-step intent is the design.
     - **The target step holds its intent and no consequences** (the user, 2026-11-18, on the build's plan). An intended consequence would state the pour as already happening, so the reply establishes the outcome rather than being handed it. So the cells aren't built by `planFromNonRuleSteps`, which adds AP-7's intended consequence. This changes the cue as well: OC-30/2's step is now `tip [table1]`, where batches 1 and 2 had "tip [table1] so that [teapot1] pours [tea2] into [cup1]". The rubric records it beside the intent line.
     - **Code supplies `to`** (mine, agreed). With one target step, the model doesn't write `to`: code fills it from the target, by step 0's rule that an id a model writes is a reference waiting to break. The change language and `mergeChanges` are unchanged. A `to` the reply does write must name the target, and is otherwise refused.

     **Mine, agreed by the user (2026-11-18):**
     - **Form and content graded apart,** both by hand. Form: does the block merge? Content: against batch 1's and 2's look-fors, read from the reply and its block. Parity is content at batch 2's level, with form rising across drafts toward most replies merging.
     - **The loop tunes the format only:** the Task, the form sentence, and the examples rewritten as `{"changes": [...]}`. The content problems stay where they're booked: CQ-P1's hedges with step 5, the cup gap with the imagination plan, and CQ-L2 (`Relations and frames`) untried.
     - **Room for step 5:** nothing built. The build just mustn't block a third `add` kind, which today's `checkChange` doesn't.

     - [X] **The build** (2026-11-18), in [`oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts), [`imaginationPieces/consequences.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/consequences.ts), [`imaginationScene.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/imaginationScene.ts), [`plansText.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/plansText.ts) and their tests:
       - **The inputs:** `{ fixture, plan, target, things }`. The render is the scene (`renderScene`, split out of `renderSceneAndActions`, which `playByPlay` keeps byte for byte), then `The plan:`, `The step to expand:` and `The things to describe:`.
       - **The cells' plans** (`consequencesPlans`): one step each, holding its intent and no consequences, pinned by a test. New inputs hashes: OC-30/2 `869da3e1`, OC-1 `bfa18eab`, replacing the batch 1 pins.
       - **The form check is `consequencesContract`:** `mergeStepChanges` supplies each `to` and refuses a written `to` other than the target, then calls `mergeChanges`, unchanged. It reads only `to`, so a third `add` kind passes through it (tested).
       - **The default is explicit,** and `consequences` has left `JUDGE_RENDER_HOLDOUTS`. `{ rules: 'consequence' }` alone is now refused, since it meets the explicit default.
       - **`npm run read-plans`** prints either piece's plans, chosen by the response's `piece` (`readPlansCli.ts`, renamed from `readPlayByPlayPlansCli.ts`).
       - **Mine, departures from the row, for review:**
         - **the listed things are the merge's handles,** not the scene's: a change naming an unlisted thing is a form failure, as CQ-P4's [table1] line was in batch 2 (*widened at step 5's build*, 2026-11-18, to the step's own handles as well, the user's);
         - **the labels** `The plan:` and `The step to expand:`;
         - **OC-1's intent repeats its step,** so its path is `pick-up-table1.pick-up-table1`. That is the single-step rule as agreed, and it reads oddly.
     - [X] **Draft 3 and its batch:** the ask rewritten for the change language, with a rubric written before the batch. Later drafts get a checkbox each, as they land.
       - [X] **Draft 3 written** (2026-11-18; [notes and rubric](oracleLoopDrafts/consequences/3.notes.md)): [`3.ask.txt`](oracleLoopDrafts/consequences/3.ask.txt) (`328e9767`), no core, default options. The examples gain handles and a `Changes:` line, unfenced (mine). CQ-L3 in the [iterations](oracleLoopDrafts/consequences/iterations.md).
       - [X] **Batch 3** ([results](oracleLoopDrafts/consequences/3.notes.md#results-2026-11-18-batch-3), 2026-11-18): both cells x3 on Micro.
         - **Form 6 of 6 merge** (batches 1 and 2: 3 of 6). Every key and kind is right: no written `to`, no `intended`, no unlisted thing.
         - **Bare handles in `says`, 4 of 6** (CQ-P5). The check doesn't see this, and the plan's lines name no bracketed things.
         - **OC-1 at parity:** the carry 3/3, no concern.
         - **OC-30/2 at parity:** the knock-on 3/3, hedged 3/3. The hedges are now in the block. Against the intent 3/3, no collateral. The cup out from under the spout is 0/3.
         - **Parity, on the first draft (mine).**
       - **CQ-P5, fixed with two layers** (the user, 2026-11-18): the prompt asks for brackets, and code repairs what's left.
         - [X] **The repair** (2026-11-18): `bracketHandles` in [`oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts). `consequencesContract` applies it to each `says` before the merge, against every handle the prompt names. Re-read through it, batch 3's plans are all bracketed.
         - [X] **Draft 4 and batch 4** ([notes and rubric](oracleLoopDrafts/consequences/4.notes.md), written 2026-11-18; [results](oracleLoopDrafts/consequences/4.notes.md#results-2026-11-18-batch-4), 2026-11-18): [`4.ask.txt`](oracleLoopDrafts/consequences/4.ask.txt) (`9b48d605`), draft 3 plus one sentence asking for brackets.
           - **Brackets 6 of 6.**
           - **Form 5 of 6:** an unlisted [teapot1] (CQ-P4).
           - **OC-1 at parity.**
           - **OC-30/2 below batch 3:** the knock-on 1 of 3, and the concerns turned to the teapot pouring, 3 of 3 (CQ-P3). I can't name the cause from this batch.
           - **Two gaps in the build (mine):** a stray top-level key (`"concerns"`) is dropped without a problem, and the unlisted-thing refusal says "not in the scene".
       - [X] **The two gaps fixed** (2026-11-18, agreed by the user). In `mergeChanges`:
         - **a key beside `changes` refuses the block,** so what it holds is never dropped unseen;
         - **a refusal names the handles as the caller has them** (`handlesAre`): `consequences` says "is not a listed thing".

         Re-read through them, batch 4's OC-1 repeat 3 is refused, so form is 4 of 6.
     - [X] **4b's checkpoint** (the user, 2026-11-18): **4b is closed.**
       - **Parity rests on batch 3.** The format holds the content.
       - **Batch 4's drop isn't chased.** Exact parity on this intermediate output isn't the aim: the hedges and the teapot doubts are step 5's ground, and step 5 revisits both.
       - **Draft 4 is kept** (mine, agreed), with the code repair behind it.
       - **Carried to step 5's first rubric (mine, agreed):**
         - OC-30/2's hedges (how far [table1] is tipped) and its teapot doubts (whether it pours) are the `execution` possibility, written as text;
         - the cell varies widely between batches of 3, so one batch's drop isn't a signal.

   **Why now** (mine, agreed):
   - step 4 rewrites the prompt anyway, to read the plan and reply in the change language;
   - `consequences` has one baseline batch and no tuned draft, so no tuned wording is lost;
   - the judges already read the explicit render, and they will read what `consequences` adds through the merged plan.

   **Also served:** the option is shared, so `playByPlay`'s booked refactor onto the explicit render (in the imagination plan) becomes a payload with the option set, not a second build.

   **Booked after 4a's batch** (the user, 2026-11-18): the explicit render becomes every piece's default. Each piece moves when it is next redrafted, and a holdouts test tracks the rest. The rule is in [calibration's Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders), with a row in the [oracle loop plan](AGENT.oracleLoop.planning.md#seam-ledger)'s Seam ledger. Under that rule, `consequences`' default flipped at 4b's build (2026-11-18), its kept draft 2 having run explicit.
5. [X] **Possibilities: a spread of outcomes, kept in the plan** (the user's, 2026-11-18). A step can hold the outcomes it might have, not just the one the generator settles on. This step's design comes before its build, as step 0's did.

   **Why:** `consequences`' hedges were read as a defect (CQ-P1: "the slide stated as what happens"). But the OC-30/2 hedges all name one thing the action leaves open, how far [table1] is tipped ([batch 2](oracleLoopDrafts/consequences/2.notes.md#results-2026-11-18-batch-2)). That is the generator reasoning about a spread of possibilities instead of fixing on one outcome and justifying it. The later stages need exactly that, for example a judge arguing "this is possible, but needs a skill check". Today the spread is lost in two ways: a reply hedges in prose and writes the outcome flatly in its JSON, or it turns each conditional into a `concern` with the condition buried in its text.

   **The shape** (the user's, 2026-11-18; the branches unlabelled, the user's, the same day), worked on the h5 hop:

   ```text
   Step tip-table1: tip [table1]
     - intent tip-table1.intent: [teapot1] pours [tea2] into [cup1]
     - possibility (execution) tip-table1.execution: tipping [table1] only far enough to pour without sliding [saucer1] off
       - maybe tip-table1.maybe:
         - consequence tip-table1.teapot1-pours-tea2: [teapot1] pours [tea2] into [cup1]
       - maybe tip-table1.maybe-2:
         - consequence tip-table1.saucer1-cup1-slide: [saucer1] and [cup1] slide off and fall to the floor
         - consequence tip-table1.tea2-spills: [tea2] spills
   ```

   **Every item has a minted path, flat under its step** (the user, 2026-11-18), as every step item already has one (AP-2). This covers the intent, the possibility, each branch, and each consequence.
   - **The rule:** an item's path is the step's path plus one slug, minted in the step's one scope at any depth. `mintPaths` already uses the bare slug when it's free, then `-2`, `-3`, so a lone item never carries a number.
   - **Consequences and concerns slug their text;** a step holds several, and a judge citing `tip-table1.tea2-spills` reads without a lookup. **Every other kind slugs its kind:** `intent`, `maybe`. A text slug adds nothing beside the item's own text (the user's: `tip-table1.intent` over `tip-table1.teapot1-pours-tea2`).
   - **A possibility slugs its kind of openness,** `execution` (mine).
   - **Why flat, not nested** (mine, agreed):
     - A nested path names its parent. Revise (step 6) moves items and keeps their paths, so a nested path would go false. A flat id stays true wherever the item sits; its place comes from the structure. Step 0 made the path the id because, with additions only, a path never changes; revise is the first change that moves an item, and flat ids keep that true.
     - It is less for the model to copy where it names a path (revise's `keeps`). Batch 3 already had one reply copying the intent's path.
   - **Not forced by naming:** whether a step may hold two intents. `intent-2` mints either way.
   - **At the build:** intents are renamed from text slugs to `intent`, which changes every rendered plan's paths. Both consequences inputs hashes (`869da3e1`, `bfa18eab`) are re-pinned in step 5's build, not retrofitted now.

   - **A new `StepItem` kind, `possibility`,** with a kind of openness, a condition (`says`), and branches. Each branch holds consequences. One level, no nesting.
   - **`execution` is the first kind and the common case** (the user, 2026-11-18: "are they able to make that intent happen?" will be ridiculously common, so it is named, not handled as an edge case).
     - The condition says what the actor must manage.
     - **What settles it is the judging pieces' call:** a skill check, the oracle's `challenging` (JF-2), chance, a question to the player, or, in the Coyote Game's preparation, plain success. The generator never writes "skill check" (agreed, 2026-11-18).
     - **The kind is kept for now** (mine, a lean, open to revisit). It says how a possibility is settled: an `execution` question goes to a skill check, and a later `unestablished` one to a detail of the world. With one kind, Micro pays nothing to write it.
   - **The branches are unlabelled: a `Maybe` with a minted path, and no `managed` or `not managed`** (the user, 2026-11-18). Replaces the labelled branches settled earlier the same day.
     - **Why (the user's):** the only consumer of "which branch is the intent?" is an adjudicator, for example one judging whether the intent can be achieved. It reads the consequences and the condition closely anyway, so it can see which branch is the one where the intended outcome happens. A label would say that a second time.
     - **What follows (mine, agreed):**
       - there are no labels for Micro to get wrong;
       - a spread can have more than two branches (on h5: pours cleanly; pours but the saucer slides; slides before it pours);
       - the merge moves nothing, so AP-9 is superseded. Additions stay additions, and a path never changes.
   - **The expand form states the intended outcome itself** (agreed, 2026-11-18). The target step holds its intent and no intended consequence, as 4b's cells do. The generator writes the pour, as an ordinary consequence in the branch where it happens. `intended` stays unwritable.
   - **The handles a reply may name: the listed things, plus every handle in the target step's own text and its intent** (the user, 2026-11-18). Replaces 4b's "the listed things" (mine).
     - **Why:** the success branch has to name what the intent names: on OC-30/2, [teapot1] and [tea2], which aren't listed. The natural limit is the step's own world, what the actor touches and what they mean to affect, not just what the reply was told to focus on.
     - **One rule for every change** (mine, agreed), possibilities and flat consequences alike.
     - **The knock-on, accepted:** batch 2's [table1] line (CQ-P4) becomes legal under `tip [table1]`. It is redundant, not wrong. A thing outside both is still refused.
   - **At most one `execution` possibility per step,** as a first limit (the move that forced it is gone). A second waits for a case that needs it.
   - **`concern` is partly absorbed:** a branch in which the intended outcome doesn't happen is the problem against the intent, readable by the adjudicator from the structure.
   - **A test for a hedge worth keeping:** a possibility names a condition the plan leaves open. A hedge against the scene ("unless it's securely positioned", where the scene says it isn't) or against the method (CQ-P3) is still a defect.
   - **Over-flagging is measured, not assumed** (the user, 2026-11-18). No cell yet tests it.
     - **What the record shows:** the only control is OC-1, `pick up [table1]`, with things on top. That isn't a mundane action, and a slide is a fair doubt there. On the explicit render (batches 2 to 4), it hedged in 2 of 9 replies, and neither reached a merged plan:
       - batch 3's prose had "damaged if lifted improperly";
       - batch 4's "may cause … to fall off" was in a refused `concerns` key.

       OC-30/2's hedges are right. No batch has shown hedging where it was clearly wrong.
     - **Two kinds of charity, not one** (the user, 2026-11-18):
       - **Imagined charity, the generator's:** is there a spread at all? It turns on the action, the actor and the circumstances the scene sets. Picking up a teacup has no possibility worth stating, unless the actor is incompetent, drugged, or being shot at.
       - **Adjudication charity, the judges':** given a spread, which branch happens? It turns on the genre or setting. A leap off a high dive into a tiny drum of water has two possibilities. In the Coyote Game, the Coyote gets the intended one automatically when there's no pressure, and meets at least one devastating unintended consequence when the Road Runner is involved.
       - **What follows** (mine, agreed):
         - the spread doesn't depend on the adjudication setting. The high dive gets its branches in the Coyote Game's preparation too, and the judge settles it ("plain success", above);
         - the adjudication setting has one reader, the judges. The generator never sees it, so this design books no generator dial;
         - a third thing, not to blur with these: the oracle loop's charity budget, which is how far an improvised fact stretches in the player's favour.
     - **Cells to add (agreed, 2026-11-18).** Both are on `teaTable`, with hand-written plans as 4b's are. Their `source` is marked constructed, since neither is an oracle corpus case (mine). Each target step holds its intent alone.

       | Cell | Step and intent | Things to describe | Why a hedge is a defect |
       | --- | --- | --- | --- |
       | **A mundane action** (`cup`) | `pick up [cup1]` | [saucer1], [tea1] | **Imagined charity.** The scene sets an ordinary actor under no pressure ("You are holding nothing"). [cup1] holds [tea1], which rises with it, and [saucer1] stays put. There is no spread. **Not an empty cup** (the user, 2026-11-18, at the build): no fixture has one, so [tea1] is listed and "may spill" is the tempting hedge |
       | **A hedge against the scene** (`OC-1/teapot1`) | `pick up [table1]` (OC-1's step) | [teapot1] alone | **Established.** The render says the glued teapot "goes wherever [table1] goes, even when [table1] is tipped". Under the reply's handle rule, the step names only [table1], so a reply can't drift to [saucer1] and [cup1], whose slide is a fair doubt. It is OC-1 narrowed: only the list changes |

     - **The baseline:** both cells on draft 4 unchanged, `repeats: 3`, Micro, 6 calls. Draft 4 has no possibilities, so a hedge shows as a conditional `says` ("may", "if", "unless") or a concern, and both count. **The bar is 0 of 3 on each cell,** recorded at baseline and graded at step 5's draft. The rubric is written before the batch, in the next draft's notes.
     - ~~**Booked, not designed: the cup with the actor changed**~~ (mine, agreed). It was the same `pick up [cup1]` with the actor drugged or under fire. **Superseded** (the user, 2026-11-18, after batch 5) by narrative interest as an input, booked in the [imagination plan](AGENT.imagination.planning.md)'s step 3.
     - **After batch 5** (the user, 2026-11-18):
       - **`cup` is recorded, not gated.** Whether a spill is worth surfacing is now an open question, booked in the imagination plan. So step 5's drafts record what `cup` does: a possibility, a concern or neither, and where the firm part sits.
       - **`OC-1/teapot1` keeps its bar of 0 of 3.** A hedge against the glue line contradicts the scene, whatever the narrative wants.
       - **Booked beside it, in the imagination plan:**
         - a cell where firm consequences beside a possibility is clearly right;
         - CQ-P6.

         Neither is needed to finish this plan.
       - **"This design books no generator dial" stands.** It concerns the adjudication setting. Narrative interest is a different input, booked as such.
   - **Out of scope here:** other kinds of openness, such as `unestablished` (the outcome hangs on a detail the scene doesn't set: the non-rule cell's "needs detail of", from the generating side), until a case shows one. Also what a later step depends on after a possibility: that is "state carried forward", above, made visible here.

   **When a plan carries an intended consequence** (booked at 4b's build; answered for the expand form, agreed, 2026-11-18):
   - **Not on a step a generator expands.** The intent item is enough there. A step-level intended consequence beside a branch where the intent fails would contradict it.
   - **AP-7 stands for the trial,** which judges a stated outcome. **To check before the build** (mine): the trial's reader takes its stated outcome from `planFromNonRuleSteps`' intended consequence. A plan that went through step 5 would have to give it that outcome another way, or reach the trial through revise (step 6). Read the trial's reader for this; don't assume it.
     - **Checked at the build** (2026-11-18): nothing reads `planFromNonRuleSteps` outside its tests. The trial still renders from its own `NonRuleStep`s, which is the bridge state below. So nothing breaks now. The question returns when the trial moves onto the plan.

   **The change language's form for a possibility** (settled, 2026-11-18):
   - **One change adds the whole group** (the field names are mine, matching today's keys):

     ```json
     {"add": "possibility", "kind": "execution",
      "says": "tipping [table1] only far enough to pour without sliding [saucer1] off",
      "branches": [
        [{"thing": "[teapot1]", "says": "[teapot1] pours [tea2] into [cup1]"}],
        [{"thing": "[saucer1]", "says": "[saucer1] and [cup1] slide off and fall to the floor"},
         {"thing": "[tea2]", "says": "[tea2] spills"}]
      ]}
     ```

   - **A branch is a list of consequences, written as flat ones are:** `thing` is optional, `says` is required, code supplies `to`, and the merge mints every path.
   - **Flat means every branch; inside a branch means only that branch** (the user, 2026-11-18). A consequence added flat beside a possibility happens however the possibility falls ("[table1] tips"). A consequence inside a branch happens only in that branch. This gives the certain parts a place, and keeps a line from being repeated across branches. **The prompt says so, and the rubric records it:** does Micro put certain outcomes in the branches?

   **The refusals** (mine, agreed by the user, 2026-11-18):
   - **At least two branches.** One branch isn't a spread.
   - **An empty branch is allowed.** "It doesn't tip far enough, and nothing happens" is a real outcome.
   - **No `concern` inside a branch.** A branch in which the intent fails already is one.
   - **At most one `execution` possibility per step** (above).
   - **The handles in a branch follow the reply's rule** (above): the listed things plus the step's own.

   **Booked: whether the plan still needs `concern` at all** (the user, 2026-11-18; AP-10, open). A branch in which the intent fails says what a concern against the intent said, from the structure. What would be left is a concern with no possibility to sit in: collateral (CQ-P2), or a doubt about the method (CQ-P3). Revisit once step 5's batches show what concerns are still written beside possibilities.

   **The generator render** (`renderPlanForGenerator`; settled, 2026-11-18):
   - **Nested lines, one indent per level,** as in the shape's example. Flat consequences stay at the item level, and the indent is what shows the "every branch" reading. The kind of openness shows in parentheses, as `(intended)` does.
   - **Who reads it:** `consequences`' prompt (`The plan:`) and `read-plans`. In the expand form the target step holds only its intent, so a possibility reaches a prompt only through another step that holds one (state carried forward, out of scope) or through revise (step 6). Step 5's build needs it for `read-plans`.
   - **A bridge state** (the user, 2026-11-18): the trial and the judges don't read this render yet. They render from the old shapes, which the render pins hold, until they move onto the plan ([When it finishes](#when-it-finishes): the trial question plan resumes on it). Whether they read the plan through this render or one of their own is that plan's question.
   - **The knock-on:** the intent's path becomes `tip-table1.intent` (above), re-pinned at the build.

   **Still to design before the build:**
   - ~~the change language's form for a possibility~~: settled above;
   - ~~the paths minted for a possibility and its branches~~: settled above (flat under the step; text slugs for consequences and concerns, the kind for the rest);
   - ~~the generator render~~: settled below;
   - ~~the refusals~~: settled above;
   - ~~the new cells~~: settled above. ~~Left: their baseline batch on draft 4~~: batch 5, read 2026-11-18.

   - [X] **The design** (2026-11-18, with the user): the shape, the paths, the change form, the refusals, the render and the cells, as above.
   - [X] **The cells' baseline batch on draft 4:** the two cells built, a rubric written before the batch, the payload in the scratchpad; the user runs it.
     - [X] **The cells built** (2026-11-18): `cup` and `OC-1/teapot1` in `consequences.ts`, inputs hashes `5db10e38` and `ef0c4cda` pinned. The other two cells' hashes are unchanged.
     - [X] **The rubric** in [`5.notes.md`](oracleLoopDrafts/consequences/5.notes.md#rubric-written-before-the-batch-mine-until-reviewed), and the payload written (`--cells cup,OC-1/teapot1`, 6 calls).
     - [X] **Batch 5 run and read** (2026-11-18; [results](oracleLoopDrafts/consequences/5.notes.md#results-2026-11-18-batch-5)):
       - **Hedges, against a bar of 0 of 3:**
         - `cup`: 2 of 3 counted, 3 of 3 with a refused block. They are all concerns about a spill, two of them on an invented intent "without spilling" (CQ-P7).
         - `OC-1/teapot1`: 0 of 3.
       - **Found beside the hedges:**
         - [saucer1] is lifted with the cup in 3 of 3 (CQ-P6), a reading failure that step 5 doesn't address;
         - the glue is contradicted flat in 1 of 3 (CQ-P8).
   - [X] **The build** (2026-11-18): the `possibility` kind, the change form and its refusals, flat paths with intents renamed (inputs hashes re-pinned), the widened handle rule, and the nested render. In [`oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts), [`imaginationPieces/consequences.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/consequences.ts) and their tests. `renderPins.test.ts` is unedited.
     - **The design's example is a golden merge,** with its paths and its render as written above.
     - **Intents slug their kind,** so every plan's intent is now `<step>.intent`. An AP-7 intended consequence drops its `-2` and slugs its text (`tip-table1.teapot1-pours-tea2`).
     - **New inputs hashes:**
       - OC-30/2 `c639e8eb` and OC-1 `030c1940` (step 4b's were `869da3e1` and `bfa18eab`);
       - `cup` `8bb8636c` and `OC-1/teapot1` `ad08de90` (batch 5 ran `5db10e38` and `ef0c4cda`).

       Draft 4's prompt is unchanged. Only the plan's intent line reads differently.
     - **The handles are `replyHandles`:** the listed things, plus the target step's text and its intent. The refusal reads "is not a listed thing or named by the step". `bracketHandles` reaches into branches.
     - **Mine, edge rules the design doesn't cover, for review:**
       - **The stored field is `openness`.** The change writes `kind`, as designed, but `kind` is already the item's discriminant.
       - **The order within a step** is intent, flat consequences, the possibility, then concerns. The certain parts come first, since they happen however it falls.
       - **A branch entry** may carry `add: "consequence"`, since Micro may write a branch's consequences as flat ones. `add: "concern"` gets the design's refusal. Any other key is refused, a `to` included.
       - **`kind` is required,** and a `thing` on the possibility is refused.
       - **An empty branch renders** as a bare `- maybe <path>:` line.
       - **The builders (`planOf`) take no possibilities:** only a change makes one.
       - **The one-`execution` limit** counts both the plan's possibilities and the block's.
   - [X] **The drafts:** the ask taught to write possibilities, graded on OC-30/2, OC-1 and `OC-1/teapot1`, with `cup` recorded (the user, 2026-11-18).
     - [X] **Draft 5 written** (2026-11-18; [notes and rubric](oracleLoopDrafts/consequences/5.notes.md#draft-5-possibilities-batch-6)): [`5.ask.txt`](oracleLoopDrafts/consequences/5.ask.txt) (`affc196d`), CQ-L5. The leans are mine, agreed by the user: a tray-through-a-crowd example with a spread, "Possibilities: none." on the rest, and the Task's split of what happens from what might, with problems narrowed to what happens. The payload is all four cells × 3.
     - [X] **Batch 6 run and read** (2026-11-18; [results](oracleLoopDrafts/consequences/5.notes.md#results-2026-11-18-batch-6)): 4 cells × 3 on Micro.
       - **Form 10 of 12.** Every merged possibility is well-formed. Both misses are sibling keys copying the prose headings (CQ-P10).
       - **OC-30/2:** a possibility 3 of 3, with the pour in a branch. The cup out from under the spout is still 0 of 3.
       - **OC-1 and `cup`:** no possibility 3 of 3. Concerns all but vanish, and CQ-P6 is gone.
       - **`OC-1/teapot1` hedged 3 of 3:** the tray example's "keeping level" is lifted onto the glued teapot (CQ-P9).
     - [X] **Step 5's checkpoint** (the user, 2026-11-18): **step 5 is closed on draft 5.** Possibilities work at a draft level within `consequences`: the form holds, and a spread appears where one is real and not elsewhere. Draft 5 is kept.
       - **Booked in the [imagination plan](AGENT.imagination.planning.md)'s step 3, as tuning, not blockers:**
         - CQ-P9, the example echo, which is `OC-1/teapot1`'s missed bar;
         - CQ-P10, sibling keys;
         - OC-30/2's uneven spread, and the cup gap;
         - `cup`'s new tea misreading.
       - **AP-10 now has evidence** (below).

   **After 4b,** so that 4b's parity batch has one cause, the format. 4b's design leaves room for a third add kind.
6. [ ] **Revise: a correction path, booked** (the user, 2026-11-18). Not designed. The expand form (step 5) stays the common path.
   - **What it is:** a form of `consequences` for a step that already has consequences, given one question to look at. It restructures the step around that question.
   - **When it's used:** as a fallback, when a model wrote consequences too eagerly and they are then called into question. A trial plan's contested intended consequence (AP-7) is the first case.
   - **Why not first** (the user's question; the trade-offs, agreed):
     - **For eager-then-revise:** each call does one thing, and possibilities appear only where a judge doubts the outcome.
     - **Against it:**
       - it throws away the spread the generator already writes (batches 2 and 3), for a judge to find again;
       - the flat outcome anchors the revision;
       - a wrong flat outcome leaks silently if nobody questions it;
       - it puts the first non-additive change on the common path.
   - **The mechanism, leaned on (mine):** the model names what a branch absorbs, for example `"keeps": ["tip-table1.teapot1-pours-tea2"]`. The merge moves those items, and they keep their paths. The merge refuses a path that doesn't exist, or one claimed twice. This is AP-9's move, with the model choosing what moves. The alternative is general replace and remove operations, which open every merge rule at once.
   - **Open:** where the question comes from. It could be free text from a judge, or a kind (`execution`) with code supplying the wording.
7. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| AP-1 | Which type becomes the plan: `CandidateStep` extended (the corpus's, and the most upstream; the imagination's actions already come from it), or a new type that the three shapes adapt to | Step 1 | Step 0's design | **Settled** (the user, 2026-11-17): **extend `CandidateStep`** |
| AP-2 | The reference form | Steps 1 and 2 | Step 0's design | **Settled** (the user, 2026-11-17): **ids minted at creation, addressed by a readable positional path,** for example `tilt-teapot1.tea-pours` for an intent. **Mine, for step 0:** how the readable parts are formed, and how two parts with the same words in one scope are told apart (`-2`, minted at creation) |
| AP-3 | Where the merge puts an addition | Step 2 | Step 0's design | **Settled** (the user, 2026-11-17): **in place within its step, in a deterministic order** (code interleaves). Step 0 fixes the order |
| AP-4 | Whether the first change language can add a step | Steps 2 to 4 | Step 0's design | **Settled** (the user, 2026-11-17): **sub-items only.** Nothing is designed ahead of need. Adding or expanding steps (for example `playByPlay` asked to expand a step in place) waits until iteration gets there |
| AP-5 | What `playByPlay` returns | Step 3 | Step 0's design | **Settled for now** (the user, 2026-11-17): **a new plan,** minting its steps' ids |
| AP-6 | How a refused change counts | Step 2 | Step 0's design | **Settled for now** (the user, 2026-11-17): **the whole block is refused,** with every problem reported, as a stage contract's are |
| AP-7 | How the trial's roles map in | Step 1 | Step 0's design, with the user | **Settled** (the user, 2026-11-17): **the intended step becomes both an intent sub-item and, where relevant, an intended consequence.** The render pins hold the old render either way |
| AP-8 | How a spread of outcomes is held in the plan | Step 5 | Step 5's design | **Settled** (the user, 2026-11-18; amended the same day): **a `possibility` grouping of unlabelled `Maybe` branches,** each with a minted path. Its first kind is `execution`. The generator states the intended outcome itself, in the branch where it happens; an adjudicator reads which branch that is. The generator names what must be managed; what settles it is the judging pieces' call. *Amended from* `managed` and `not managed` branches with the intended consequence in `managed` (the user's reason: the adjudicator reads the branches anyway) |
| AP-9 | How the intended consequence reaches the `managed` branch | Step 5 | Step 5's design | **Superseded** (the user, 2026-11-18): with unlabelled branches there is no `managed` branch to move it into, and the expand form's target step holds no intended consequence. *Was* (mine, agreed): the merge moves it, a moved item keeping its path. The move returns, chosen by the model, as revise's leaned-on mechanism (step 6) |
| AP-10 | Whether the plan still needs a `concern` kind, once possibilities hold a spread | After step 5 | Step 5's batches | **Open** (booked by the user, 2026-11-18): a branch in which the intent fails already says what a concern against the intent says. To read: what concerns are still written beside possibilities, and whether they are collateral (CQ-P2), method doubts (CQ-P3), or something a possibility should hold. **Evidence from batch 6** (draft 5, problems narrowed to "any consequence that happens"): 1 concern in 10 merged plans, and it was collateral (OC-1). The refused replies held one against the intent and one collateral |

## How we work

- The parent's [How we work](AGENT.nonRuleCell.planning.md#how-we-work) holds:
  - the user runs each batch, and I write each payload to the scratchpad and give its full path;
  - results go to a file, read with `jq`;
  - one repeat to explore, three to confirm;
  - a rubric before each batch;
  - each change attributed.
- Steps 1 and 2 are code with tests only, and need no batch.
- The drafts for steps 3 and 4 continue each ask's numbering in its own folder (`oracleLoopDrafts/playByPlay/`, `oracleLoopDrafts/consequences/`).
- **Every iteration is marked here,** on its step's item, as it lands.

## Verification

- **Each build:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` produce no output. `renderPins.test.ts` is unchanged and green.
- **A batch:** its form check, then every reply against the rubric written before it.
- **Links:** every relative link and anchor in this plan resolves.

## Progress

| Step | State |
| --- | --- |
| The design | **Done** (2026-11-17): reviewed by the user, as written |
| The plan type, with references | **Done** (2026-11-17): `oracleLoop/actionPlan.ts`, every existing cell converts |
| The change language and the merge | **Done** (2026-11-17): `mergeChanges` and `planChangesContract`, the hops' golden merges pinned |
| `playByPlay` creates references | **Done** (2026-11-17): `playByPlayContract`; batches 29 and 30 at parity (the user) |
| `consequences` adds into the plan | **Done** (2026-11-18): 4a, the explicit render; 4b, a reducer on one step in the change language. Batch 3 is the parity batch; draft 4 is kept (the user) |
| Possibilities | **Done** (the user, 2026-11-18): closed on draft 5. Design done (the user, 2026-11-18): unlabelled branches, flat paths, the step's own handles, the change form, refusals, the render, the over-flagging cells. Baseline batch 5 read (2026-11-18): `cup` hedged 2 of 3 (CQ-P7), `OC-1/teapot1` 0 of 3; CQ-P6 and CQ-P8 found. The findings are booked in the imagination plan, with `cup` recorded, not gated. Build done (2026-11-18). Draft 5's batch 6 read (2026-11-18): form 10/12, OC-30/2 possibility 3/3, `OC-1/teapot1` echo 3/3 (CQ-P9), booked in the imagination plan |
| Revise | Booked (the user, 2026-11-18): a correction path, after step 5. Not designed |
| Hand back | Not started |

## When it finishes

- **The trial question plan resumes** on the new plan: the hops on hand-written plans, then on generated ones. Its judges move off the old shapes and the render pins onto the plan, ending the bridge state step 5 records. This plan's item in the parent says so.
- **The imagination plan's step 3** resumes on the refactored `consequences`, the cup gap first.
- **The type and the merge are documented** in calibration's `AGENT.md`, beside the stage contract. The rules for reasoning in this plan's Open decisions move to a durable doc there.
- **What's out of scope** (above) goes to the parent as booked items: state carried forward, and Contested and Supported claims.
- **A sweep for inbound links,** then this plan is deleted.
