# Scene model filters: what a piece knows, apart from how it is worded

**Status (2026-11-26): opened, nothing built. Next: step 1, the survey and the design, for the user's review.** Branch `iss8426-scene-model-filters`. When it finishes, the [triage plan](AGENT.triage.planning.md) resumes with its branch-only arm, on the renderer this plan makes possible.

**The idea, the user's** (2026-11-26, from triage's checkpoint): **what a piece may know is a filter on the scene model, applied before rendering. How the scene is worded is a renderer, a callback on the piece's view.** The renderer never sees more than the filter leaves, so it can't leak what it was never given.

**Why now** (mine, agreed):
- `SceneView` ([`sceneRenders.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/sceneRenders.ts)) mixes two kinds of axis. `shows` and an omitted securing are about knowledge. `shown` against `conditions`, `sceneRules`, `ruleParts`, and which render (`judge`, `explicit`) are about wording. Every new wording widens a shared union, and the shared renderers dispatch on it. Triage's proposed lens (the scene as a non-exhaustive list) would have been one more value.
- The knowledge policy is enforced only by whichever render code honors it: each piece's render calls `withoutSecuring` or `subScene` itself, or passes `securing` down to a shared renderer that decides. So the registry's check ([`pieceViews.test.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/pieceViews.test.ts)) has to search rendered text for securing words. That is a check after the fact, standing in for a guarantee the structure doesn't give.

Task plan framework: [`taskPlanning/AGENT.md`](../../../../AGENT.md), an implementation plan. The code is calibration's (a Prototype), with the shared scene renderers in `dataSource/actions/sceneProse/`.

## Getting Started

1. Read calibration's [Piece views](../../../../../lambda/ephemera/calibration/AGENT.md#piece-views), [Scene renders](../../../../../lambda/ephemera/calibration/AGENT.md#scene-renders) and [The platform's holdouts](../../../../../lambda/ephemera/calibration/AGENT.md#the-platforms-holdouts).
2. Read the triage plan's [checkpoint](AGENT.triage.planning.md#the-checkpoint-2026-11-26), where this came from.
3. Read the code:
   - [`pieceProbe/sceneRenders.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/sceneRenders.ts): `SceneView` and its axes;
   - [`pieceProbe/oraclePiece.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/oraclePiece.ts): `PieceView`, a piece's `render`;
   - [`pieceProbe/pieceViews.test.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/pieceViews.test.ts): the registry's checks of each render against its view (`renderedSceneProblems`, `optionDrift`);
   - the four renders that apply a filter themselves: [`imaginationPieces/imaginationScene.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/imaginationScene.ts) (`renderScene`), [`oraclePieces/nonRuleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/nonRuleCell.ts) (`renderNonRuleCell`, which the trial's stages call), [`oraclePieces/sceneReading.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/sceneReading.ts), [`oraclePieces/ruleCell.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/ruleCell.ts); and [`oraclePieces/triage.ts`](../../../../../lambda/ephemera/calibration/oraclePieces/triage.ts) (`renderTriage`);
   - the filters, [`sceneProse/sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts) (`withoutSecuring`, `judgeRules`) and [`sceneProse/subScene.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/subScene.ts);
   - the renderers, [`sceneProse/renderSceneExplicit.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/renderSceneExplicit.ts) (its `full` option) and `renderSceneJudge.ts` (`judgeSceneSections`).
4. Testing doc: [`lambda/ephemera/AGENT.md`](../../../../../lambda/ephemera/AGENT.md); if commands conflict, follow it. From `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`. Both pass before any edit.

## What is inherited as settled

| Premise | Consequence here | Whose |
| --- | --- | --- |
| A piece reads its inputs through a declared view | The knowledge part of the view stays declared, as names, so payload arms and settings tables can name it | The platform's (pieceViews, 2026-11-22) |
| Every piece's render pins are the safety net | No rendered prompt changes in this plan: a pin that moves is a bug here, unless the user agrees it | Mine, as for every platform refactor |
| The explicit render is the direction for every piece | The judge render stays as an arm where pieces still take it; nothing here retires it | The user's, 2026-11-18 |
| A setting is never copied between pieces without its own reason | A piece's renderer and its named arms are its own; a renderer moves to shared code when a second piece wants it | The user's, 2026-11-24 |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`; mark nested lines `[X]` as they are done.

1. [ ] **The survey and the design, for the user's review,** before any code.
   - [ ] Every registered piece (13 registrations): its knowledge (what it shows, and whether the securing is omitted), where that is applied today, and each wording choice it makes or takes as an arm
   - [ ] Every place a renderer reads more than the filtered scene. Found so far (2026-11-26):
      - `renderSceneExplicit`'s `full` option, used to mint a securing's rule handle from the full scene so a sub-scene's tags match everyone else's (`securingTag`, `judgeRules(full)`);
      - `renderNonRuleCell` passes the unfiltered scene as `full` even under `omitted`;
      - `renderScene` and the rule cell take the heading from the full scene (`heading(full)`)
   - [ ] The design: the filter's signature and where the platform applies it; the renderer's signature; arms as each piece's named renderers; and the answers to the open decisions below
2. [ ] **Rule identity on the model,** so no renderer needs the full scene: a securing carries its rule's handle in the model, minted before any filter. Every render pin unchanged
3. [ ] **The filter, applied by the platform** before a piece's render: the knowledge axes only. Each piece's render takes the filtered model, and stops calling `withoutSecuring` and `subScene` itself. Every render pin unchanged
4. [ ] **Wording as a renderer** on the view: the securing's wording, the Rules section, a rule's parts shown, and judge against explicit, each a piece's renderer or one of its named arms. `SceneView` keeps only the knowledge axes. Every render pin unchanged
5. [ ] **The registry's checks,** rewritten to what the structure now guarantees ([SF-4](#open-decisions-implementation--plan-only)); `optionDrift` against the named arms
6. [ ] **Docs:** calibration's Piece views and Scene renders, each piece's settings, and the holdouts list if an entry's reason changes
7. [ ] **Hand back** ([When it finishes](#when-it-finishes))

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next step(s). Not copied into package `AGENT.concepts.md`. All mine unless marked.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| SF-1 | **How `securing` splits.** `omitted` is knowledge: the securing relations are gone from the model. `shown` and `conditions` are wording of a securing the model has. Proposed: the knowledge axis becomes a boolean or a two-value name (securing known or not), and the two wordings become renderers | Step 1 | Open |
| SF-2 | **The sub-scene's handles.** `shows: 'subScene'` is knowledge, but which things it keeps depends on the inputs, and each piece computes them its own way (`playByPlay`: what it also shows, the plan's handles, the handles `missing` names; the rule cell: the rule's ends). Proposed: the view declares `subScene`, and the piece supplies the handles as a function of its inputs, which the platform passes to `subScene` | Step 1 | Open |
| SF-3 | **The renderer's signature.** A render gives a string, or its system and user parts under `system` delivery, and today's renders put more than the scene in it (the plan, the request, the question). Proposed: the view's renderer covers the scene block alone, from the filtered model; the piece's `render` composes the prompt as now | Step 1 | Open |
| SF-4 | **The text-leak check.** Once the renderer gets only the filtered model, a structural check can say the filter was applied (no securing relations under an omitted securing). Keep the text search as a backstop, or retire it | Step 5 | Open |
| SF-5 | **Rule identity on the model.** Where a securing's rule handle is minted: on the model when it is built, or by a step before the filter. It must give today's handles, or every pin with a rule tag moves | Step 2 | Open |

## How we work

- The user commits. No LLM call in this plan: every step is checked by the render pins, with every prompt unchanged.
- No bare `SF-n` in code or tests.
- My proposals stay marked as mine until the user takes them.

## Verification

- **Each step:** from `lambda/ephemera/`, `npm run test -- --watchAll=false </dev/null` and `npx tsc --noEmit </dev/null`, no output. Every piece's render pins unchanged ([`pieceProbe/renderPins.test.ts`](../../../../../lambda/ephemera/calibration/pieceProbe/renderPins.test.ts) and each piece's own).
- **Steps 3 and 4:** a break shown to be caught: a filter skipped, and a renderer handed the full scene.
- **Links:** every relative link and anchor in this plan resolves.

## Progress

| Step | State |
| --- | --- |
| 1. The survey and the design | Not started |
| 2. Rule identity on the model | Not started |
| 3. The filter, applied by the platform | Not started |
| 4. Wording as a renderer | Not started |
| 5. The registry's checks | Not started |
| 6. Docs | Not started |
| 7. Hand back | Not started |

## When it finishes

- **The triage plan** resumes ([its step 5](AGENT.triage.planning.md#recommended-order)): the branch-only arm, and the non-exhaustive scene lens, as a prompt sentence first and a renderer of triage's if it earns one.
- **Calibration's docs** hold the rules (step 6), and this plan is deleted after a sweep for inbound links.
