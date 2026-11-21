# Piece views: each prompt's view of the shared state

**Status (2026-11-21): step 0, the design pass with the user, in progress: [the inventory](#the-inventory) done; VW-1 and VW-5 next.** A sub-plan of the [oracle loop plan](AGENT.oracleLoop.planning.md)'s Slice 4.5, opened by the user at the close of the item standing plan (retired 2026-11-21), whose remaining standing problems were all ones a view removes. An implementation plan: the first prototype is designed and built here, with `playByPlay`'s view its first instance.

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

**Views that already exist, ad hoc** (inventoried in step 0, [The inventory](#the-inventory)):
- the non-rule cell's render leaves out the Rules section, "since securing is the rule cell's", and the rebuttal's leaves out the securing itself (calibration's [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece));
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
   - [X] **The inventory:** each piece's views as they stand, what each shows and leaves out, and how it words them (done 2026-11-21, [The inventory](#the-inventory)).
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
3. [ ] **The other pieces declared as views,** with no change in behaviour: every inputs hash unchanged. The scene side joins the view here (VW-1's order): first, which options are experiment arms (`scene: 'judge' | 'explicit'` during the migration, kept as payload options) and which are the piece's view (`rules: 'conditions'`, `securing: 'omitted'`, `ruleCell`'s `show` and rule parts, moved into its declaration); then each piece's scene settings consolidated into its view.
4. [ ] **Hand back** ([When it finishes](#when-it-finishes)).

## The design pass

### The inventory

Each registered piece's view as it stands (2026-11-21, mine, read from the code; reviewed by the user).

**The scene side:**

| Piece | Scene shown | The securing, and its wording | Rules |
| --- | --- | --- | --- |
| `ruleCell` | judge render, the sub-scene of the rule's two things | the judge Graph | the one rule: its fact and enforcing rubric only (no voiding rubric, no consequence) |
| `nonRuleCell`, `stepConsiderations`, `trial/against` (default) | the whole scene; judge, or explicit by option | shown; under explicit, `actionRule`'s "cannot be moved apart until they are freed" | no Rules section |
| `trial/against` (`securing: 'omitted'`), `trial/rebuttal`, `trial/verdict`, `trial/ruling` | the whole scene (`ruling` explicit) | removed (`withoutSecuring`) | none |
| `sceneReading` | the whole scene, either render | removed | none |
| `playByPlay` | explicit, the sub-scene of `alsoShown`, the plan's handles and `missing`'s | `rules: 'conditions'`: handle tag, the condition with the relation's words, a carry keeping the slack | handles, through the tags |
| `consequences` | explicit, the sub-scene of the things and the plan's handles | `rules: 'none'`: `actionRule`'s impossibility, or the hosted carry line | none |

**The plan side:**

| Piece | Plan input | Filtered |
| --- | --- | --- |
| `playByPlay` | `renderPlanForGenerator`, the whole plan | No: every kind, every author, rule items with stances, `alreadyAnswers`; only the `(unchecked)` tag marks standing, which didn't keep the registers apart (drafts 21 to 22a) |
| `consequences` | the same render | No; dormant, since its cells hold no rule or unchecked items. It can't name a rule (`rules: 'none'`) but would be shown `Rule (...)` lines |
| `ruleCell` | its own hand-written motion lines, windowed by code at `voidedAt` | Yes: the rule's two ends, the actions the rule is in force for |
| `nonRuleCell` and the trial | their own step shape (role and consequence lines), not the action plan (the bridge state) | n/a |

**Other agents' claims, shown by design:** `trial/rebuttal` sees the argument, `trial/verdict` both sides; judging them is their task. `trial/ruling` sees the case against's question but never its `blocking`: an instance already built of filtering a judgment and keeping what it rests on, the nearest model for `playByPlay`'s view. `playByPlay` sees proposals it has no use for (`OC-20/proposed`, the concession cell), the case this plan exists for.

**The reply side:**

| Piece | Asks for | Fits its view |
| --- | --- | --- |
| `playByPlay` | `says`, `intent`, `steps`, `consequences` with `rules: [{rule, stance}]` | The stance is VW-3's question |
| `consequences` | a `changes` list, `concern` included | `concern` is booked out (the imagination plan's step 3) |
| `ruleCell` | a description, then `blocks` or `allows` | Yes |
| `nonRuleCell` | per step a `finding`, `establishes`, and `reason`/`cause` or `of`/`missing` | Yes |
| the trial's stages | each its stage contract | Yes |

**Where views live today** (VW-5's input): scattered across option types and render functions: `ImaginationOptions`' `rules` and `scene`, `SecuringShown`, `RuleCellOptions`' `show` and `sceneRules`, `TrialAgainstOptions`, and `securing: 'omitted'` hard-coded in the rebuttal and the ruling. The one registry-wide check is `JUDGE_RENDER_HOLDOUTS`.

**What it suggests** (mine; leads for VW-1 and VW-5, not settled):
1. **The scene side has views; the plan side has none.** The scene's axes are which part, how the securing is worded, and which of a rule's parts are shown; the last is a view in all but name ("each piece shows only the part it uses", the user, 2026-11-10). VW-1's new ground is the plan side: which kinds, whose, which standing.
2. **Options and views differ.** Some options are experiment arms (`scene: 'judge' | 'explicit'`, during the migration); some are the piece's own view (`rules: 'conditions'`, `securing: 'omitted'`). A view type might take in the second and leave the arms as options. Step 3's unchanged hashes mean each declared view reproduces today's render, options included.
3. **`consequences` is the mirror's first test.** Revise-mode `consequences` is the authority for `playByPlay`'s unchecked consequences, so its view must show them; additive `consequences` may be better without them (§3). A view may depend on the mode, not only the piece.
4. **The securing has four wordings and an absence.** `nonRuleCell` gets the "cannot be moved apart" impossibility, the wording behind the concession cell's failures; its task is reasons no rule names, so the securing may be outside its view. A question for when it reads the plan.

## Open decisions (implementation --- plan only)

| ID | Question | Informs | Settled by | Status |
| --- | --- | --- | --- | --- |
| VW-1 | What a view declares: the plan kinds it reads (and whose: all authors, or the piece's own and the authorities'), how each is worded, the scene render options | Step 0, step 1 | The user | **Decided for the prototype** (the user, 2026-11-21): a view declares the plan kinds it reads and, for each, whether it reads `all` its entries (unchecked and confirmed) or only the confirmed (`authoritative`). No exemption for the piece's own items: its own unchecked proposals are filtered like anyone's. **The order** (mine, agreed by the user, 2026-11-21): step 1 builds the plan filter alone; the scene's wording and render options join the view in step 3, which first sorts the options that are experiment arms (they stay payload options) from those that are the piece's view (they move into its declaration); wording per plan kind waits for a piece that needs it, since none does yet |
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
| The design pass | In progress: the inventory done 2026-11-21; VW-1 and VW-5 next |
| The build | Not started |
| `playByPlay` on its view | Not started |
| The other pieces | Not started |
| Hand back | Not started |

## When it finishes

- **The rules** for views go into calibration's [The action plan](../../../../../lambda/ephemera/calibration/AGENT.md#the-action-plan), [A read piece](../../../../../lambda/ephemera/calibration/AGENT.md#a-read-piece) and [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders).
- **The parent's item** is ticked with what was booked; the checkers' and the resilience pass's bookings updated for what a view changes.
- **A sweep for inbound links and plan-ID markers** (`VW-n`), then this plan is deleted.
