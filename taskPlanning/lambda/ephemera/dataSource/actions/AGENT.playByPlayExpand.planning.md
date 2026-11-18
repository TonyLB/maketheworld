# `playByPlay` expands a step: the explicit render, simpler reasoning, then the expand form

**Status (2026-11-18): opened; step 0's design done the same day, every open row settled by the user.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, spun off at the user's request alongside the [non-rule cell plan](AGENT.nonRuleCell.planning.md), its consumer. Step 1 closed at draft 16 (kept on the explicit render, now the default), with simpler reasoning moved into the expand form's drafts. Next: step 2, the build.

**Why:**
- **The non-rule cell's request needs an answer of this shape.** That plan settled that "can't tell, more detail of the action" is a request to `playByPlay`, with the step quoted (NR-3). Its composition probe (step 4) has `playByPlay` feeding the pieces after it. Expanding one step of a plan answers that request.
- **[The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan) left room for it.** Changes were additions to sub-items only; adding or expanding steps "waits until iteration gets there" (the user, 2026-11-17). This is there.
- **`consequences` showed the reducer shape works on Micro:** it learned the change language on its first draft.
- **`playByPlay` is behind on both the render and the form.** It is still a judge-render holdout (`JUDGE_RENDER_HOLDOUTS`). Only 6 of 24 replies gave a plan in batches 29 and 30 ([notes](oracleLoopDrafts/playByPlay/15.notes.md#batch-30-the-confirm-2026-11-17)), since a plan is built only from a reply that passes the form.

**What this plan contains** (the user's, 2026-11-18, from the GitHub issue):
1. `playByPlay` on the explicit scene render;
2. simpler reasoning in its prompt;
3. a revised structure: instead of taking a candidate's actions and describing them all, it takes an action plan and one step to expand, and replies with a breakdown of that step.

**Settled by the user (2026-11-18):**
- **Its own plan, under the parent's Slice 4.5,** as the action plan was. The non-rule cell plan names it as a consumer. The imagination plan's booking of `playByPlay` on the explicit render moves here.
- **The step expands in place.** It keeps its path and its items (its intent stays with it), and gains sub-steps in order. Nothing is replaced or removed, so changes stay additions and every path stays true.
- **Sub-steps get new ids, flat, not nested.** A sub-step's path is minted in the plan's one scope of step paths (`grasp-handle`, not `pick-up-teapot1.grasp-handle`), and it is listed as a sub-step of its parent. Its place is in the structure, not in its id, for the reason item paths are flat: an id that names its parent goes false when anything moves.
- **One cause per batch:** the render and the reasoning first, as a draft on the old reply with a parity batch; then the expand form. Ordering is this plan's Recommended order, as `consequences` did 4a before 4b. **Revised (the user, 2026-11-18):** the render ran alone (draft 16); the reasoning moves with the expand form (step 3), since the examples it needs are the expand form's reply.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). This is an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md): a Prototype whose consumer, the non-rule cell's request, runs later.

## Step 0's design (reviewed by the user, 2026-11-18; mine unless marked)

**1. Sub-steps are items** (the user, 2026-11-18, on my question back: no separate `steps` field). A new `StepItem` kind, `step`, holding a full planned step:

```ts
| { kind: 'step'; path: string; says: string; suppliedBy: 'system'; items: readonly StepItem[] }
```

- **Why an item:** a possibility already holds structure inside items; one ordered list, placed by the order rule, means the merge, the render, `itemTexts`, `itemPaths` and the target lookup each walk one thing. A sub-step holds its own items, so its intent, a later possibility and its own sub-steps (PX-4: expandable) need nothing new.
- **The order within a step:** **intent, sub-steps, consequences, possibility, concern.** A step reads as what it's for, how it's done, then what happens.
- **The one exception to the path rule:** every other item's path is its step's path, a dot and a slug. A `step` item's path is a **step path**, minted in the plan's one scope of step paths at any depth (the user's flat ids: `lift-teapot1-table1`, not `pour-tea2-teapot1.lift-teapot1-table1`). Minting, and the check that `to` names a step, branch on the kind. The durable doc says so.
- **A step can be tagged `atomic`** (the user, 2026-11-18: "as expanded as it can be", so a requester doesn't keep asking): `atomic?: true` on a planned step and on a `step` item, as `intended` is a tag on a consequence. A step is expanded, or atomic, or neither, never both. **Unlike `intended`, it is set after creation,** by a reply: the first change that modifies what is in the plan. It is set once and never cleared, nothing is removed and no path moves, so the path stays the id; the rule becomes "changes only add, or set a once-only tag", and the durable doc says so. **No reason text for now** (a tag has none): the fact stops repeat requests; a judge weighing whether the step really is simple may later want the reason.
- **A flat reading of the method** (the leaves, depth first) is a helper for a reader that wants one sequence; **booked, not built**, since no reader needs it yet.
- **The slug's possessive wart** ("grasp [teapot1]'s handle" gives `grasp-teapot1-s`) is left to the booked "references stronger under reasoning".

**2. The change form** (PX-2):

```json
{"changes": [
  {"add": "steps", "steps": [
    {"says": "lift [teapot1] off [table1]", "intent": "[teapot1] is held above [cup1]"},
    {"says": "tilt [teapot1] over [cup1]", "intent": "[tea2] pours into [cup1]"}
  ]}
]}
```

- **`add: "steps"` with an optional `intent`** (agreed by the user, 2026-11-18). Code supplies `to`, the target. Each entry: `says` required; `intent` optional, only where it helps (the user, PX-1).
- **`{"mark": "atomic"}`** (the user, 2026-11-18, on my proposal): a new verb, since it sets a tag rather than adding; code supplies `to`. The merge mints each sub-step's path and its intent's (`lift-teapot1-table1.intent`).
- `bracketHandles` repairs `says` and `intent`.
- **`playByPlay`'s contract takes only `add: "steps"`,** through a new merge option, `adds`; a consequence or concern from it is refused. That is how `concern` comes out (PX-5). `consequences` keeps its three kinds.

**3. The refusals** (the whole block, as now):
- fewer than two sub-steps (the user, PX-4);
- an entry that isn't an object, has no `says`, or has a key other than `says` and `intent`;
- an `add` or `mark` the piece doesn't take;
- **the atomic tag** (the user, 2026-11-18): expanding a step tagged atomic ("marked as one motion; nothing to expand"); marking a step already expanded; a block that both expands and marks one step; marking a step twice;
- **for `playByPlay`, an empty `changes`:** every reply expands the step or marks it atomic.

**Not refused: a handle the scene doesn't hold** (the user, 2026-11-18): a breakdown may improvise an object ("slide [cloth1] under [teapot1]"). The merge keeps it as written, `bracketHandles` leaves it, and the rubric records each one. **Knock-on:** the next piece's render throws on a handle not in the fixture, so `consequences` reading `playByPlay`'s output would; that is out of scope here, and improvised handles in the plan are booked on the parent's [action plan item](AGENT.oracleLoop.planning.md#recommended-order), where the oracle's `Improvisation` (an object filling a slot) is the type to meet.

**Settled with it** (the user, 2026-11-18): **a step is expanded at most once; more detail goes into its sub-steps,** any of which may be expanded in turn. The refusal reads "already expanded; expand one of its sub-steps for more detail". A second expansion of the same step would sit beside the first (changes only add) and read as one method when it is two: that is the alternate-method ask's job (the [imagination plan](AGENT.imagination.planning.md)'s step 4). Redoing a too-coarse expansion is a non-additive change, booked with revise.

**4. `playByPlay`'s inputs and render:**
- **Inputs:** `{ fixture, plan, target, alsoShown }`. No things to describe, since there are no per-thing lines; `alsoShown` stays, as OC-20's wall needs it.
- **The render:** the scene of `alsoShown` and every handle the plan names; `The plan:` (`renderPlanForGenerator`); `The step to expand: <path>`. As `consequences`', without its things line.
- **The generator render** (PX-3, the user's: indented): a sub-step is an item line, its own items indented under it. The atomic tag shows as `(intended)` does: `Step pick-up-table1 (atomic): pick up [table1]`, `- step grasp-handle-teapot1 (atomic): …`. OC-6 after a merge:

```text
Step pour-tea2-teapot1: pour [tea2] from [teapot1] into [cup1]
  - intent pour-tea2-teapot1.intent: pour [tea2] from [teapot1] into [cup1]
  - step lift-teapot1-table1: lift [teapot1] off [table1]
    - intent lift-teapot1-table1.intent: [teapot1] is held above [cup1]
  - step tilt-teapot1-over: tilt [teapot1] over [cup1]
    - intent tilt-teapot1-over.intent: [tea2] pours into [cup1]
```

**5. The cells** (PX-7): one-step plans built by hand, each intent the request's own text.

| Cell | Step (path) | `alsoShown` | Look-for under the expand form |
| --- | --- | --- | --- |
| OC-1 | `pick up [table1]` (`pick-up-table1`) | [teapot1], [cup1], [saucer1] | An ordinary lift (grip the edges, lift), **or** the step marked atomic. **Defect:** a sub-step dealing with the glue (PB-P2) |
| OC-6 | `pour [tea2] from [teapot1] into [cup1]` (`pour-tea2-teapot1`) | [table1] | The teapot lifted or tilted over the cup, as pouring needs, not fitted to the glue. **Defects:** an "unglue" sub-step (PB-P2); switching to tipping the table (an alternate method) |
| OC-19 | `pry [teapot1] off [table1] with [hammer1]` (`pry-teapot1-table1`) | — | The claw set under the teapot, then the teapot levered up and off |
| OC-20 | `pick up [table1]` (`pick-up-table1`), `teaTableChained` | [wall1] | The table lifted and pulled from the wall. **Defect:** a sub-step detaching the chain first (PB-P2) |

- **Recorded across cells:** over-steps (PB-P7); outcomes narrated as settled (PB-P5); which sub-steps carry intents, and whether they say what the old lines said; any sub-step that reads like a worry with nowhere else to go ("carefully steady [teapot1]"), the evidence PX-5 waits on.
- **What PX-1 costs the look-fors:** "the table staying" (OC-19) and "the wall staying" (OC-20) were per-thing lines. Graded as "no sub-step moves it", with whether an intent states it recorded.

## Out of scope, named so it isn't lost

- **The non-rule cell dispatching its request** to `playByPlay` and reading the result. That is the non-rule cell plan's steps 4 and 5; this plan gives them the piece.
- **Capability tuning past parity** (`playByPlay`'s flag sensitivity, held for the judging pieces, IM-4). It stays in the [imagination plan](AGENT.imagination.planning.md).
- **`consequences` on sub-steps:** whether it expands a sub-step's consequences or the parent's. It follows once sub-steps exist, as state carried forward does.
- **Simultaneous sub-steps** (one done while another is held, such as bracing a crate while pulling the rug from under it). Order is the content of an expansion (PX-2), so a list can't say "at the same time"; not ready to handle (the user, 2026-11-18). A reply or cell that seems to need it is recorded as a case for later.
- **Replacing or removing steps,** and revise, booked on the parent's [action plan item](AGENT.oracleLoop.planning.md#recommended-order).

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan): the item kinds, flat paths, the change language and its refusals, the render, and where `concern` stands.
3. Read the parent's Slice 4.5 [action plan item](AGENT.oracleLoop.planning.md#recommended-order), its booked items included.
4. Read the non-rule cell plan's request kinds (NR-3, its step 1) and its step 4, the composition probe: what it asks of `playByPlay`.
5. Read `playByPlay`'s record:
   - the [imagination plan](AGENT.imagination.planning.md)'s step 2 and its bookings;
   - [`oracleLoopDrafts/playByPlay/iterations.md`](oracleLoopDrafts/playByPlay/iterations.md), its problems (PB-P1 to PB-P7) and library;
   - [draft 14's notes](oracleLoopDrafts/playByPlay/14.notes.md), the kept draft, and [batch 29 and 30's](oracleLoopDrafts/playByPlay/15.notes.md), the plan-building batches.
6. Read how `consequences` made the same move, the precedent for this plan's order: [draft 2's notes](oracleLoopDrafts/consequences/2.notes.md) (the render alone), [draft 3's](oracleLoopDrafts/consequences/3.notes.md) (the reducer) and [draft 5's](oracleLoopDrafts/consequences/5.notes.md) (possibilities).
7. Read the code, under [`lambda/ephemera/calibration/`](../../../../../lambda/ephemera/calibration/):
   - `imaginationPieces/playByPlay.ts` (`planFromPlayByPlay`, `playByPlayContract`, the cells) and its test;
   - `imaginationPieces/consequences.ts`, the reducer to follow (`renderConsequences`, `consequencesContract`, `replyHandles`);
   - `oracleLoop/actionPlan.ts` (`mintPaths`, `mergeChanges`, `mergeStepChanges`, `renderPlanForGenerator`);
   - `imaginationPieces/imaginationScene.ts` (`renderScene`, the `scene` option) and `pieceProbe/sceneRenders.ts`.
8. Calibration's [Piece probe](../../../../../lambda/ephemera/calibration/AGENT.md#piece-probe), [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
9. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` should produce no output. Both pass before any edit.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [X] **The design, reviewed before it's built** (text only), with worked examples on the four cells:
   - [X] **What an expansion adds** (PX-1, the user, 2026-11-18): sub-steps with intents, no per-thing lines.
   - [X] **The change form's shape** (PX-2): one change holding the ordered list. **The render** (PX-3): indented.
   - [X] **Problems** (PX-5): `concern` out; the bucket's value read from the batches. **Simpler reasoning** (PX-6): draft 14 measured on the explicit render first.
   - [X] **The write-up** ([reviewed](#step-0s-design-reviewed-by-the-user-2026-11-18-mine-unless-marked), 2026-11-18): sub-steps as a `step` item (the user's), the order, the path exception, the change form, the refusals, the inputs and render. The user's calls: a step expands at most once; an `atomic` tag set once by `{"mark": "atomic"}`, in place of an empty `changes`; `add: "steps"` with an optional `intent`; no refusal of a handle the scene doesn't hold (improvised objects).
   - [X] **The cells' plans** (PX-7) and their look-fors, [in the same section](#step-0s-design-reviewed-by-the-user-2026-11-18-mine-unless-marked).
1. [X] **The explicit render and simpler reasoning, on the old reply.** **Closed at draft 16 (the user, 2026-11-18):** the render, kept; simpler reasoning moved into step 3. Draft 16 is draft 14's ask on `{ "scene": "explicit" }`, assembled with no core (PX-6): the render alone, measured first. Simpler reasoning follows in later drafts, from what it shows. The reply format and the cells are unchanged, so a miss has one cause, the prompt. It needs no step 0 write-up, so it can run beside it. **The bar is parity** with draft 14 (every method at the bar, no attempts; batches 29 and 30: 23 of 24), read by hand against a rubric written before the batch. Form is recorded, and better form is welcome. **Numbered 16, not 15** (mine, 2026-11-18): draft 15 is already [batches 29 and 30's](oracleLoopDrafts/playByPlay/15.notes.md), draft 14's prompt with the plan built in code.
   - [X] Draft 16 ([`16.ask.txt`](oracleLoopDrafts/playByPlay/16.ask.txt), `a30583fa`) and its [rubric](oracleLoopDrafts/playByPlay/16.notes.md), the payload in the scratchpad (2026-11-18); the user runs it as batch 31.
   - [X] The batch read ([batch 31](oracleLoopDrafts/playByPlay/16.notes.md#results-2026-11-18-batch-31): parity on every method, no attempts, form 9 of 12); **kept by the user, 2026-11-18, the prompt to beat.** The default flipped to explicit (`PLAY_BY_PLAY_OPTIONS`, through `imaginationOptionsParser`, shared with `consequences`), `playByPlay` left `JUDGE_RENDER_HOLDOUTS`, and its explicit inputs hashes are pinned. The render's chain line ("can still be moved together", read as OC-20's wall moving 3 of 3) is booked in calibration's [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders), and watched as the reasoning is revised (the user).
   - **Simpler reasoning moved to step 3** (the user, 2026-11-18). Draft 16's examples pull against its Task (the user's reading): the Task asks for bracketed handles, a line per thing and a JSON block, and the examples give bare nouns, a narration and no block. Re-aligning them on the old reply would tune examples the expand form replaces, since the user's reconceived examples (a short list of sub-steps, then the block) are the expand form's reply, and on the old block they'd collide with one entry per action (PB-P7).
2. [ ] **The build: the expand form,** in pure code with tests and no LLM: the plan type's sub-steps, the change form and its refusals, minting sub-step paths in the plan's step scope, the render, `playByPlay`'s new inputs (a plan, the step to expand, and the things), its contract, and `read-plans`.
3. [ ] **The expand form's drafts, with simpler reasoning:** the ask taught to reply with the step's breakdown. **The bar is parity** with draft 16 (batch 31) on the same look-fors, read from the merged plan. Expect several drafts. **The framing** (the user, 2026-11-18, unless marked):
   - **The examples reconceived:** each a short list of the step's sub-steps, each with its intent, then the JSON block. The reasoning is the summary list, not a prose narration.
   - **The examples aligned with the Task** (mine, from the user's reading of draft 16): bracketed handles as the scene writes them, the block shown in every example, and nothing the Task doesn't ask for.
   - **No Problems section** (PX-5). Whether the examples carry what the bucket did (keeping the securing out of the method, PR-1) is read from the batches.
   - **Sub-steps strictly in order;** no simultaneity (out of scope, below). The user's first sketch (the rug pulled while the crate is braced) is set aside on that ground, and the rug example is written fresh when the draft is.
   - **A secured thing that rides along,** with no sub-step for it (the bolted lamp; mine), so a securing isn't taught as something to clear. **Watched:** a sub-step that clears a securing (PB-P2: unchaining OC-20's table, ungluing OC-6's teapot), and OC-20's wall read as moving (the render's chain line, in calibration's [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders)).
4. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| PX-1 | What an expansion adds | Step 2 | Step 0's design | **Settled** (the user, 2026-11-18, a first iteration): **sub-steps, with no per-thing consequence lines.** What those lines did well goes into each sub-step's **intent** item where it helps (what the sub-step is for: "[teapot1] is tilted over [cup1]"). **PB-P7 turns over:** "the action split into sub-steps" is now the point; a sub-step the step's intent doesn't need (the teapot set back down after the pour) stays a defect. **Knock-on (mine):** the non-rule cell's composition probe planned an adapter reading `playByPlay`'s lines for the named things (IM-5); with no lines, that adapter reads sub-steps and their intents, or `consequences` supplies the lines. That is the non-rule cell plan's question, noted there |
| PX-2 | The change form | Step 2 | Step 0's design | **Settled** (the user, 2026-11-18, on my lean): **one change holding the ordered list,** nested, as a possibility holds its branches; order is the content. Code supplies the parent, as it supplies `to`. Field names in step 0's write-up |
| PX-3 | How the render shows sub-steps | Step 2 | Step 0's design | **Settled** (the user, 2026-11-18): **indented under their parent,** one level per expansion |
| PX-4 | The refusals | Step 2 | Step 0's design | **Settled** (the user, 2026-11-18): **a sub-step can itself be expanded; a single sub-step is not an expansion** (at least two); **a step already expanded takes no second expansion,** more detail going into its sub-steps |
| PX-5 | Problems | Steps 1 to 3 | The batches | **Settled** (the user, 2026-11-18): **`concern` comes out** ([where `concern` stands](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)). Then see what, if anything, is needed beyond what exists for the same benefit: the bucket that kept worries out of the method (the user's 2026-11-13 revision, Observed on `playByPlay` in batches 9 to 15). Read from the batches, not decided ahead |
| PX-6 | What "simpler reasoning" means | Step 1 | The batches | **Settled** (the user, 2026-11-18): **draft 14 is the starting point, measured on the explicit render first.** Draft 16 (numbered past batches 29 and 30's draft 15) is draft 14's ask on the explicit render with no core (the reading guide dropped, as `consequences`' draft 2 did); simplification follows from what that batch shows. **Updated (the user, 2026-11-18):** batch 31 kept draft 16; simplification moves into the expand form's drafts (step 3), with the examples reconceived |
| PX-7 | The cells' plans under the expand form | Steps 2 and 3 | Step 0's design | **Settled** (reviewed by the user, 2026-11-18): one-step plans built by hand, each intent the request's own text; look-fors as in [step 0's design](#step-0s-design-reviewed-by-the-user-2026-11-18-mine-unless-marked) |

## How we work

- The non-rule cell plan's [How we work](AGENT.nonRuleCell.planning.md#how-we-work) holds:
  - the user runs each batch, and I write each payload to the scratchpad and give its full path;
  - results go to a file, read with `jq`;
  - one repeat to explore, three to confirm;
  - a rubric before each batch;
  - each change attributed.
- Step 2 is code with tests only, and needs no batch.
- The drafts continue `playByPlay`'s numbering in [`oracleLoopDrafts/playByPlay/`](oracleLoopDrafts/playByPlay/iterations.md), from 16 (15 is batches 29 and 30's).
- Every iteration is marked here, on its step's item, as it lands.

## Verification

- **Each build:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` produce no output. `renderPins.test.ts` is unchanged and green.
- **A batch:** its form check, then every reply against the rubric written before it.
- **Links:** every relative link and anchor in this plan resolves.

## Progress

| Step | State |
| --- | --- |
| The design | **Done** (2026-11-18): reviewed by the user; PX-1 to PX-7 settled, with the `atomic` tag |
| The explicit render and simpler reasoning | **Done** (2026-11-18): draft 16 kept on batch 31 (parity, form 9 of 12), the default flipped; simpler reasoning moved into step 3 |
| The build: the expand form | Not started |
| The expand form's drafts | Not started; carries simpler reasoning and the reconceived examples |
| Hand back | Not started |

## When it finishes

- **The rules** for sub-steps and the expand form go into calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), and `playByPlay`'s paragraph in [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece).
- **The non-rule cell plan** gets the piece for its steps 4 and 5.
- **The imagination plan** gets `playByPlay` back for tuning past parity.
- **The parent's item** is ticked, with what was booked.
- **A sweep for inbound links and plan-ID markers** (`PX-n`), then this plan is deleted.
