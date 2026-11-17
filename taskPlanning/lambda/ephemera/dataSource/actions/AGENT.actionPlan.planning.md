# The action plan: referenced steps, and changes merged in

**Status (2026-11-17): opened; AP-1 to AP-7 settled by the user the same day. Step 0's design was reviewed by the user the same day, as written. Nothing is built. Next: steps 1 and 2, the type and the merge, code and tests with no batch.** Opened under the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5 (the user, 2026-11-17), after the [trial question plan](AGENT.trialQuestion.planning.md) stopped its step 2 and paused. Every hop failure there was about state across steps, not knowledge of the world.

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
1. [ ] **The plan type, with references.** Every existing cell can be built into a plan: the corpus, the non-rule cell and the trial, and the imagination's asks. The existing renders are untouched, since each piece reads its own inputs, so the pins stay green and unedited. Tests:
   - references are unique and stable;
   - each existing cell converts as step 0's rules say;
   - the generator's render of a plan.
2. [ ] **The change language and the merge,** in pure code, tested with no LLM:
   - a change block parses through a stage contract;
   - a merge applies the additions in place;
   - a change naming a reference that isn't in the plan is refused, and the refusal says why;
   - the merged plan renders.

   Golden changes for the hops pin the worked examples from step 0.
3. [ ] **`playByPlay` refactored to create references.** Its output becomes a plan, or the additions to one (AP-5). **The bar is parity:** its existing cells at draft 14's level (every method at the bar, no attempts), read by hand against a rubric written before the batch.
4. [ ] **`consequences` refactored to add into the plan:** a run on a plan yields changes, and the merge gives the new plan. **The bar is parity** with its batch 1, read by hand. The cup gap is carried to the imagination plan, not tuned here.
5. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

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
| The plan type, with references | Next |
| The change language and the merge | Not started |
| `playByPlay` creates references | Not started |
| `consequences` adds into the plan | Not started |
| Hand back | Not started |

## When it finishes

- **The trial question plan resumes** on the new plan: the hops on hand-written plans, then on generated ones. This plan's item in the parent says so.
- **The imagination plan's step 3** resumes on the refactored `consequences`, the cup gap first.
- **The type and the merge are documented** in calibration's `AGENT.md`, beside the stage contract. The rules for reasoning in this plan's Open decisions move to a durable doc there.
- **What's out of scope** (above) goes to the parent as booked items: state carried forward, and Contested and Supported claims.
- **A sweep for inbound links,** then this plan is deleted.
