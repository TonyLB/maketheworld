# `playByPlay` expands a step: the explicit render, simpler reasoning, then the expand form

**Status (2026-11-18): opened, not started.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, spun off at the user's request alongside the [non-rule cell plan](AGENT.nonRuleCell.planning.md), its consumer. Next: step 0, the design pass.

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
- **One cause per batch:** the render and the reasoning first, as a draft on the old reply with a parity batch; then the expand form. Ordering is this plan's Recommended order, as `consequences` did 4a before 4b.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md). This is an implementation plan under the parent's pilot of the [proposed design variant](../../../../AGENT.designVariant.proposed.md): a Prototype whose consumer, the non-rule cell's request, runs later.

## Out of scope, named so it isn't lost

- **The non-rule cell dispatching its request** to `playByPlay` and reading the result. That is the non-rule cell plan's steps 4 and 5; this plan gives them the piece.
- **Capability tuning past parity** (`playByPlay`'s flag sensitivity, held for the judging pieces, IM-4). It stays in the [imagination plan](AGENT.imagination.planning.md).
- **`consequences` on sub-steps:** whether it expands a sub-step's consequences or the parent's. It follows once sub-steps exist, as state carried forward does.
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

0. [ ] **The design, reviewed before it's built** (text only). It settles the open rows below and gives worked examples on the four cells:
   - [ ] **What an expansion adds** (PX-1): sub-steps with their own lines, the plan type's new shape, and the order rule;
   - [ ] **The change form** (PX-2) and its refusals (PX-4), with code supplying the parent, as it supplies `to`;
   - [ ] **The render** (PX-3);
   - [ ] **Problems and the bucket** (PX-5);
   - [ ] **What "simpler reasoning" means** for step 1's draft (PX-6, the user's to say);
   - [ ] **The cells' plans** (PX-7) and their look-fors under the expand form.
1. [ ] **The explicit render and simpler reasoning, on the old reply.** A draft of its own (draft 15), assembled with no core, on `{ "scene": "explicit" }`. The reply format and the cells are unchanged, so a miss has one cause, the prompt. **The bar is parity** with draft 14 (every method at the bar, no attempts; batches 29 and 30: 23 of 24), read by hand against a rubric written before the batch. Form is recorded, and better form is welcome.
   - [ ] Draft 15 and its rubric, the payload in the scratchpad; the user runs it.
   - [ ] The batch read; the default flips to explicit if the draft is kept (`playByPlay` leaves `JUDGE_RENDER_HOLDOUTS`, its inputs hashes re-pinned).
2. [ ] **The build: the expand form,** in pure code with tests and no LLM: the plan type's sub-steps, the change form and its refusals, minting sub-step paths in the plan's step scope, the render, `playByPlay`'s new inputs (a plan, the step to expand, and the things), its contract, and `read-plans`.
3. [ ] **The expand form's drafts:** the ask taught to reply with the step's breakdown. **The bar is parity** with step 1's kept draft on the same look-fors, read from the merged plan. Expect several drafts.
4. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs build | Settled by | Status |
| --- | --- | --- | --- | --- |
| PX-1 | What an expansion adds. Sub-steps alone (each a `says`), or sub-steps with their own per-thing consequence lines, as today's per-action lines are? The rule cell and the composition probe read those lines (IM-5). **And PB-P7 turns over:** "the action split into sub-steps" was a defect when the actions were fixed; it is now the point. What stays a defect is a sub-step the step's intent doesn't need (the teapot set back down after the pour) | Step 2 | Step 0's design | Open |
| PX-2 | The change form. One change per sub-step, or one change holding the ordered list (as a possibility holds its branches)? Mine, a lean: one change holding the list, since order is the content | Step 2 | Step 0's design | Open |
| PX-3 | How the render shows sub-steps: indented under their parent, as branches sit under a possibility. Whether a reader that wants a flat sequence gets one from the render or from code | Step 2 | Step 0's design | Open |
| PX-4 | The refusals. Can a sub-step itself be expanded (free under flat ids, but it needs a rule or a depth limit)? Can a step be expanded twice? How few sub-steps is still an expansion? | Step 2 | Step 0's design | Open |
| PX-5 | Problems. `concern` is not a generator output for judging ([where `concern` stands](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan)), and taking it out of `playByPlay`'s plan was booked in the imagination plan; it moves here. Whether `playByPlay` keeps a bucket for worries, so they stay out of the method (the user's 2026-11-13 revision, Observed on `playByPlay` in batches 9 to 15), is tested at its draft | Steps 1 to 3 | Step 0's design, then the batches | Open |
| PX-6 | What "simpler reasoning" means for draft 15 (the user's, 2026-11-18). Draft 14 is the starting point | Step 1 | The user, at step 0 | Open |
| PX-7 | The cells' plans under the expand form. OC-1, OC-6, OC-19 and OC-20 are single-request cells, so expanding the one step equals writing the whole method, and their look-fors carry over, as `consequences`' did. Each is a one-step plan built by hand, its intent the request's own text (the single-step rule) | Steps 2 and 3 | Step 0's design | Open |

## How we work

- The non-rule cell plan's [How we work](AGENT.nonRuleCell.planning.md#how-we-work) holds:
  - the user runs each batch, and I write each payload to the scratchpad and give its full path;
  - results go to a file, read with `jq`;
  - one repeat to explore, three to confirm;
  - a rubric before each batch;
  - each change attributed.
- Step 2 is code with tests only, and needs no batch.
- The drafts continue `playByPlay`'s numbering in [`oracleLoopDrafts/playByPlay/`](oracleLoopDrafts/playByPlay/iterations.md), from 15.
- Every iteration is marked here, on its step's item, as it lands.

## Verification

- **Each build:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` produce no output. `renderPins.test.ts` is unchanged and green.
- **A batch:** its form check, then every reply against the rubric written before it.
- **Links:** every relative link and anchor in this plan resolves.

## Progress

| Step | State |
| --- | --- |
| The design | Not started |
| The explicit render and simpler reasoning | Not started |
| The build: the expand form | Not started |
| The expand form's drafts | Not started |
| Hand back | Not started |

## When it finishes

- **The rules** for sub-steps and the expand form go into calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), and `playByPlay`'s paragraph in [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece).
- **The non-rule cell plan** gets the piece for its steps 4 and 5.
- **The imagination plan** gets `playByPlay` back for tuning past parity.
- **The parent's item** is ticked, with what was booked.
- **A sweep for inbound links and plan-ID markers** (`PX-n`), then this plan is deleted.
