# Scene model filters: what a piece knows, apart from how it is worded

**Status (2026-11-26): step 1 is done: the survey, and the design ([below](#the-survey-2026-11-26)), approved by the user with SF-1 to SF-5. Step 2, the viewed scene model, is built (2026-11-26). Next: step 3, the filter applied by the platform.** Branch `iss8426-scene-model-filters`. When it finishes, the [triage plan](AGENT.triage.planning.md) resumes with its branch-only arm, on the renderer this plan makes possible.

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

1. [X] **The survey and the design, for the user's review,** before any code.
   - [X] Every registered piece: its knowledge, where that is applied today, and each wording choice it makes or takes as an arm ([the survey](#the-survey-2026-11-26))
   - [X] Every place a renderer reads more than the filtered scene ([below](#what-reads-past-the-filter))
   - [X] The design, proposed (mine, [below](#the-design-proposed-2026-11-26)): the filter's signature and where it is applied; the renderer's signature; arms as each piece's named renderers; and an answer proposed to each open decision
   - [X] The user's review of the design (2026-11-26): approved, SF-1 to SF-5 as proposed
2. [X] **Rule identity on the model,** so no renderer needs the full scene (built 2026-11-26)
   - [X] **The viewed scene model** ([`sceneProse/viewedSceneModel.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/viewedSceneModel.ts)): `ViewedSceneModel`, `{ model, rules }`, the model and its rule handles; `viewedSceneModel(full)` mints them on the full model; `filterViewedModel` applies a filter of the model and keeps the handle of each securing the filtered model still has, never minting again. **Moved and renamed (the user, 2026-11-26):** it was `ViewedScene` in `calibration/pieceProbe/`, beside the render axes, but it is a sibling of the model, not of a render; and it read as a near-synonym of `SceneView`, the declaration it is the result of
   - [X] **The explicit render off `full`:** `RuleHandles`, `ruleHandlesOf` and `securingEdge` in [`sceneRules.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/sceneRules.ts), beside `judgeRules` (first written into the render, and moved with the rename); a render that tags requires `ruleHandles` (the options are a union), and throws on a securing whose handle it wasn't given. Its three callers (`renderScene`, triage, the non-rule cell) take the handles from a viewed scene model. `renderScene`'s judge path now reads its heading from the sub-scene, the same text
   - [X] **Checked:** every render pin unchanged (the full suite, 5,722 tests, and tsc). The viewed scene model's tests, the stem collision among them; re-minting on the filtered model is caught, before and after the move
3. [ ] **The filter, applied by the platform** before a piece's render: the knowledge axes only. Each piece's render takes the filtered model, and stops calling `withoutSecuring` and `subScene` itself. Every render pin unchanged
4. [ ] **Wording as a renderer** on the view: the securing's wording, the Rules section, a rule's parts shown, and judge against explicit, each a piece's renderer or one of its named arms. `SceneView` keeps only the knowledge axes. Every render pin unchanged
5. [ ] **The registry's checks,** rewritten to what the structure now guarantees ([SF-4](#open-decisions-implementation--plan-only)); `optionDrift` against the named arms
6. [ ] **Docs:** calibration's Piece views and Scene renders, each piece's settings, and the holdouts list if an entry's reason changes
7. [ ] **Hand back** ([When it finishes](#when-it-finishes))

## The survey (2026-11-26)

Eleven pieces, ten registrations and the trial's family of four. **Knowledge** is what the scene the piece reads may hold. **Applied in** is the code that applies it today. **Wording** is everything else about how the scene reads. **Arms** are the payload options over either.

| Piece | Knowledge (`shows`, securing) | Applied in | Wording | Arms |
| --- | --- | --- | --- | --- |
| `playByPlay` | sub-scene (what it also shows, the plan's handles, the handles `missing` names); securing known | `renderScene` ([`imaginationScene.ts`](../../../../../lambda/ephemera/calibration/imaginationPieces/imaginationScene.ts)): `subScene`, and `withoutSecuring` were it omitted | explicit by default, with `conditions` tags (from `full`); or judge | `scene` |
| `consequences` | sub-scene (its things, the plan's handles, those its render names); securing known | `renderScene` | explicit by default, the securing `shown`; or judge | `scene` |
| `triage` | whole; securing known | `renderTriage`, no filter | explicit with `conditions` (`full: scene`) | none |
| `sceneReading` | whole; securing omitted | its own render, `withoutSecuring` | judge or explicit, the arm compared, with no default | `render` |
| rule cell | sub-scene of the rule's ends, or none; securing known | its own render, `subScene(full, rule.ends)` | judge only, the scene's Rules section an option, and its own Rule section with the view's `ruleParts` (fact, enforcing) | `show`, `sceneRules` |
| non-rule cell | whole; securing known | `renderNonRuleCell`, `withoutSecuring` were it omitted | judge by default, or explicit (`full: scene`) | `scene` |
| `stepConsiderations` | the non-rule cell's view and render | as the non-rule cell | as the non-rule cell | none |
| trial against | whole; securing known (the trial's kept setting, omitted, is booked for its next redraft) | `renderNonRuleCell` | judge or explicit | `securing`, `scene` |
| trial rebuttal | whole; securing omitted | `renderArguedParts`, then `renderNonRuleCell` | judge or explicit | `upstream`, `scene` |
| trial verdict | whole; securing omitted; the scene in the system part | as the rebuttal | judge or explicit | `upstream`, `scene` |
| trial ruling | whole; securing omitted | `renderNonRuleCell` | explicit, fixed | `upstream` |

**Two kinds of arm, both on payloads:** knowledge (`against`'s `securing`, the rule cell's `show`) and wording (`scene`, `render`, `sceneRules`). Both stay nameable.

**Out of scope:** production's own scene formats (`SceneFormat`, `sceneProse/index.ts`), a dispatch used by the scene test harness and its slash command. No calibration piece goes through it.

### What reads past the filter

- **`renderSceneExplicit`'s `full`** ([`renderSceneExplicit.ts`](../../../../../lambda/ephemera/dataSource/actions/sceneProse/renderSceneExplicit.ts)): a securing's rule handle comes from `judgeRules(full)`. `judgeRules` gives a rule the short handle from its ends' stems only where that is unique among **that scene's** rules, so a sub-scene with fewer rules could mint a different handle. `full` is there for identity, but it means the renderer reads the whole scene. Used by `playByPlay` (via `renderScene`), triage and the non-rule cell.
- **`renderNonRuleCell` passes the unfiltered scene as `full`,** even when it has filtered the securing out. Under `omitted`, no securing is left to tag, so nothing leaks today, but the door is open.
- **`heading(full)`,** in `renderScene`'s judge path and the rule cell: **not a leak.** `heading` reads only `room`, and `subScene` keeps `room` as it is, so the text is the same either way. It goes with the rest.
- **The renders themselves:** every render can call `fixtureScene` and read the full scene. A structural filter only holds if renders stop doing that (SF-4).

## The design, proposed (2026-11-26)

Mine, approved by the user as written (2026-11-26).

1. **A viewed scene model** (SF-5): `ViewedSceneModel = { model: SceneModel; rules: ReadonlyMap<edge, handle> }`, in `sceneProse` beside the model filters (moved from calibration and renamed, the user, 2026-11-26). The rule handles are minted from the full scene (`judgeRules(full)`, so today's handles) **before** any filter, and the filter keeps an entry only while both ends remain. `renderSceneExplicit` takes its tags from that map, not from `full`, and `full` goes. **The alternative:** an optional `rule` on a secured relation in `SceneModel`, the "one optional field" path, but `SceneModel` is production's (`ludicCache`), and only calibration reads rule handles yet.
2. **The filter**, `viewScene(full, knowledge, handles?) => ViewedSceneModel | undefined`: the securing dropped where it is not known (`withoutSecuring`), then `subScene` on the given handles, or none. **The knowledge axes** (SF-1): `shows` as now, and `securing: 'known' | 'omitted'`. A knowledge arm (`against`'s `securing`, the rule cell's `show`) overrides its axis by name, as `optionDrift` already expects.
3. **Who applies it** (SF-2): the piece declares `sceneHandles(cell, options)` where it shows a sub-scene (`playByPlay`, `consequences`, the rule cell), computed from its inputs, and may read the full scene to do so (the rule cell finds its rule's ends). A shared step builds the fixture's scene, mints the rules, and applies `viewScene`. The piece's `render` gets the viewed scene model as an argument, and no longer calls `fixtureScene`, `withoutSecuring` or `subScene`.
4. **The renderer** (SF-3): `SceneRenderer = (viewed: ViewedSceneModel) => string`, the scene block alone. A view holds its default, and a piece may name arms, `{ judge, explicit }`, chosen by the `scene` option. The piece's `render` composes the prompt as now (the plan, the request, the question, a system part). **The wording axes go to renderers:** `shown` against `conditions` is explicit with or without tags; `sceneRules` is the judge renderer with or without its Rules section; `ruleParts` is the rule cell's own Rule section, a constant of that piece, not the scene view's. Shared renderers live with the existing ones, and a piece's own (triage's lens, later) stays in the piece.
5. **The checks** (SF-4): the text search stays, as a backstop, because a render could still call `fixtureScene`. Beside it, a structural check: each piece's render, handed a viewed scene model, renders it unchanged against its pins. A test fails on a render module that calls `fixtureScene`.
6. **Order:** step 2 (the viewed scene model, its rule map, the explicit renderer off `full`), then 3, then 4, each with every pin unchanged.

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next step(s). Not copied into package `AGENT.concepts.md`. All mine unless marked.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| SF-1 | **How `securing` splits.** `omitted` is knowledge: the securing relations are gone from the model. `shown` and `conditions` are wording of a securing the model has. Proposed: the knowledge axis becomes `securing: 'known' \| 'omitted'`, and the two wordings become renderers ([design](#the-design-proposed-2026-11-26), 2) | Step 1 | **Settled** (the user, 2026-11-26) |
| SF-2 | **The sub-scene's handles.** `shows: 'subScene'` is knowledge, but which things it keeps depends on the inputs, and each piece computes them its own way (`playByPlay`: what it also shows, the plan's handles, the handles `missing` names; the rule cell: the rule's ends). Proposed: the view declares `subScene`, and the piece supplies the handles as a function of its inputs, which the platform passes to `subScene` ([design](#the-design-proposed-2026-11-26), 3) | Step 1 | **Settled** (the user, 2026-11-26) |
| SF-3 | **The renderer's signature.** A render gives a string, or its system and user parts under `system` delivery, and today's renders put more than the scene in it (the plan, the request, the question). Proposed: the view's renderer covers the scene block alone, from the filtered model; the piece's `render` composes the prompt as now ([design](#the-design-proposed-2026-11-26), 4) | Step 1 | **Settled** (the user, 2026-11-26) |
| SF-4 | **The text-leak check.** Once the renderer gets only the filtered model, a structural check can say the filter was applied (no securing relations under an omitted securing). Keep the text search as a backstop, or retire it. Proposed: keep it, beside a structural check, and a test against a render calling `fixtureScene` ([design](#the-design-proposed-2026-11-26), 5) | Step 5 | **Settled** (the user, 2026-11-26) |
| SF-5 | **Rule identity on the model.** Where a securing's rule handle is minted: on the model when it is built, or by a step before the filter. It must give today's handles, or every pin with a rule tag moves. Proposed: a `ViewedSceneModel` carrying a rule map minted from the full scene, over an optional field on production's `SceneModel`; in `sceneProse`, beside the filters it composes (amended by the user, 2026-11-26, from "in calibration") ([design](#the-design-proposed-2026-11-26), 1) | Step 2 | **Settled** (the user, 2026-11-26) |

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
| 1. The survey and the design | Done 2026-11-26: the design approved by the user |
| 2. Rule identity on the model | Built 2026-11-26: the viewed scene model, in `sceneProse`, and the explicit render off `full`; every pin unchanged |
| 3. The filter, applied by the platform | Not started |
| 4. Wording as a renderer | Not started |
| 5. The registry's checks | Not started |
| 6. Docs | Not started |
| 7. Hand back | Not started |

## When it finishes

- **The triage plan** resumes ([its step 5](AGENT.triage.planning.md#recommended-order)): the branch-only arm, and the non-exhaustive scene lens, as a prompt sentence first and a renderer of triage's if it earns one.
- **Calibration's docs** hold the rules (step 6), and this plan is deleted after a sweep for inbound links.
