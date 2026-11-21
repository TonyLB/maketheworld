# Piece views: each prompt's view of the shared state

**Status (2026-11-21): opened; step 0, the design pass with the user, is next.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, opened by the user at the close of the item standing plan (retired 2026-11-21), whose remaining standing problems were all ones a view removes. An implementation plan: the first prototype is designed and built here, with `playByPlay`'s view its first instance.

## The idea (the user, 2026-11-21)

**Every prompt has a viewpoint, and its inputs are built to respect it.** A view decides two things for a piece:
1. **What gets in:** the kinds of item, and the facts, its task can make use of. What it can't use is filtered out.
2. **How what gets in is worded:** in language aligned with the piece's task.

The action plan carries everything: a proposed rule violation, another agent's unchecked consequence. A piece's render shows only its view, so `playByPlay`, which has no use for a proposed violation in any case, is never shown one.

**The line between filtered and kept (mine, agreed):** filter judgments and other agents' claims, not the facts they rest on. `playByPlay` still needs the chain, with its slack, worded for its task, to write "[table1] pulls against its chain to [wall1]". It doesn't need anyone's verdict on it.

**The reply side mirrors it (mine, agreed):** a reply asks only for what its view supports. A piece that never reads rule stances isn't asked to write one.

## Why (the evidence)

By calibration's [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro):
- **§3, the filler comes from the most authoritative nearby text.** Whatever is shown is a source: `OC-20/proposed`'s input proposal written back as a sub-step (batch 58, one-entry `steps` 3), the concession cell's unchecked "cannot be lifted" read as fact (drafts 21 to 22a), the scene's glue sentence mirrored as a `causes` (draft 32).
- **§1, shown isn't read, and the render is prompt text.** A block that can't help costs attention, and the render's wording moves replies as the ask's does.
- **§2, every slot gets filled.** The rule stance survived three renames (drafts 28 to 30) with its strays flat; a slot that isn't asked for can't be overfilled.

**What the item standing plan left, all removed by a view** (the user, 2026-11-21): `playByPlay` mis-responding to incoming rule violations and provisional consequences. Its other open problems are `playByPlay`'s own tuning, in the [imagination plan](AGENT.imagination.planning.md)'s step 2.

**Views that already exist, ad hoc** (to inventory in step 0):
- the non-rule cell's render and the rebuttal's leave out the securing, "since securing is the rule cell's" (calibration's [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece));
- `playByPlay`'s `rules: 'conditions'` and `consequences`' carry lines word the same securing for each task;
- the per-piece `scene` option and `JUDGE_RENDER_HOLDOUTS` ([Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders));
- `renderPlanForGenerator`, one plan render for every generator.

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once, for durability and the content split.
2. Read calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan) (the item kinds, standing, the change language, the merge, the generator's render), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) (each piece's inputs and render), [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) and [Writing prompts for Nova Micro](../../../../../lambda/ephemera/calibration/AGENT.md#writing-prompts-for-nova-micro).
3. Read the parent's Slice 4.5 [items](AGENT.oracleLoop.planning.md#recommended-order): the action plan item's checker bookings (revise-mode `consequences`, the rule cell on proposed violations) and the resilience pass, which a view changes.
4. The scene side's earlier work: the [scene projection plan](AGENT.sceneProjection.planning.md)'s SP-10, rendering a scene for an LLM reader.
5. The code, under [`lambda/ephemera/`](../../../../../lambda/ephemera/):
   - [`calibration/oracleLoop/actionPlan.ts`](../../../../../lambda/ephemera/calibration/oracleLoop/actionPlan.ts): the plan types, the merge (a revision clears the target's items) and `renderPlanForGenerator`;
   - [`calibration/imaginationPieces/playByPlay.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/playByPlay.ts) and [`imaginationScene.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/imaginationScene.ts): the reply, the cells, the scene options;
   - [`calibration/pieceProbe/sceneRenders.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/sceneRenders.ts) and its test, the model for a check that every piece declares its view;
   - [`calibration/oraclePieces/nonRuleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/nonRuleCell.ts): a render that omits the securing.
6. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md). From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null` produce no output. Both pass before any edit.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

0. [ ] **The design pass, with the user** (text only, before any build):
   - [ ] **The inventory:** each piece's views as they stand, what each shows and leaves out, and how it words them.
   - [ ] **What a view declares** (VW-1) and **where it lives in code** (VW-5).
   - [ ] **The reply side:** each piece's reply asks only for what its view supports; for `playByPlay`, the stance (VW-3, VW-4).
   - [ ] **Hidden items on a revision** (VW-2).
   - [ ] **The authority map's mirror:** a checker's view always shows the claims it rules on.
1. [ ] **The build,** in code with tests and no LLM, each part checked off as it lands:
   - [ ] the view type, and the render built from a view;
   - [ ] `playByPlay`'s view: no rule items, and no unchecked items another piece wrote; its reply as VW-3 settles;
   - [ ] the merge rule for hidden items (VW-2);
   - [ ] a test that every registered piece declares a view.
2. [ ] **`playByPlay` on its view:** two batches per draft against the last kept draft, with the look-fors rewritten first: OC-20's lift and OC-19's pry graded on the consequence, not its tag; `OC-20/proposed` and the concession cell on a plan whose proposal isn't shown; OC-1 with no `causes` look-for. The tuning baseline is the imagination plan's step 2.
3. [ ] **The other pieces declared as views,** with no change in behaviour: every inputs hash unchanged.
4. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## Open decisions (implementation --- plan only)

| ID | Question | Informs | Settled by | Status |
| --- | --- | --- | --- | --- |
| VW-1 | What a view declares: the plan kinds it reads (and whose: all authors, or the piece's own and the authorities'), how each is worded, the scene render options | Step 0, step 1 | The user | Open |
| VW-2 | What happens to an item a view hides when the piece revises its step. Today a revision clears the target's items and the ask asks for kept ones to be given again; a hidden item can't be. Kept on the step, re-attached by code, or dropped | Step 1 | The user | Open (handed here from the item standing plan, the user, 2026-11-21) |
| VW-3 | `playByPlay`'s stance. (a) a proposal names the rule it bears on, with no stance; (b) it names neither, and code pairs each consequence with the rules on its thing's edges for the authorities to judge (mine, leaned on: §2, §7 one judgment per call, and "ask only for what the model alone can provide") | Step 1 | The user | Open |
| VW-4 | Under (b), who judges each stance: `violation` by the rule cell (its `blocks`, 46 of 48 on draft 3); `causes` for a carry from the scene's own securing edge, by code; `voids` (prying the glue loose) unjudged for now, a question for the rule cell, or a piece of its own. Costs calls (one per paired consequence), so pairing only consequences whose thing touches a rule | Step 1 | The user | Open |
| VW-5 | Where a view lives: beside each piece's reply contract, in its registration, or in a shared module | Step 1 | Mine, for the user | Open |

## How we work

- The design pass comes first, as text, and the user reviews it before any build.
- Each build part is checked off as it lands, with tests and tsc clean.
- Batches: one change per draft, two batches per draft, the rubric written before the batch with my bounds listed apart. Payloads are named by full path; the user runs them.
- The user commits.

## Verification

From `lambda/ephemera/`: `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, both with no output. In step 3, every piece's inputs hashes unchanged.

## Progress

| Step | State |
| --- | --- |
| The design pass | Not started |
| The build | Not started |
| `playByPlay` on its view | Not started |
| The other pieces | Not started |
| Hand back | Not started |

## When it finishes

- **The rules** for views go into calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) and [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders).
- **The parent's item** is ticked with what was booked; the checkers' and the resilience pass's bookings updated for what a view changes.
- **A sweep for inbound links and plan-ID markers** (`VW-n`), then this plan is deleted.
