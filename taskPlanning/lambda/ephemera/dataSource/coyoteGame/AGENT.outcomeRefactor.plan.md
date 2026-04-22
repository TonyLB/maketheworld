# Coyote plan outcome refactor (rich hypothesis record)

**Status:** In progress. Next step: initiative cleanup (remaining non-code checklist only if needed); prompt enrichment and formatter are shipped.

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability rules (this file retires after the task), **Recommended order** checkbox conventions, and what belongs here versus [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md).

## Purpose

Refactor **plan outcome** generation so it uses the **full durable hypothesis record**, not only the single-line `Hypothesis:` string (`intent`). [`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts) takes **`getIntentRecord`** (full [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts)) from [`internalCache`](../../../../../lambda/ephemera/internalCache/index.ts) via `CoyoteGame.get('intent')` with no extra fetch; [`buildPlanOutcomePromptParts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts) receives **`hypothesisLine`** plus optional **`walkthrough`** and **`phasePlan`** (validated [`CoyotePhasePlan`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts)), with phase text from [`formatPhasePlanForOutcomePrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/formatPhasePlanForOutcomePrompt.ts).

The outcome model should ground the single **"Outcome:"** line in the same **beat sequence and prop vocabulary** the hypothesis pipeline produced, while preserving existing **Road Runner safety** and **Coyote backfire** rules.

This plan is task-scoped; archive or delete it when the initiative ships and fold any lasting behavior notes into code-adjacent `AGENT.md`.

## Goals

1. **Data plumbing:** Pass `CoyoteGameIntentRecord` (or equivalent) into outcome generation so **no extra Dynamo reads** are required beyond `CoyoteGame.get('intent')`.
2. **Prompt enrichment:**
   - Treat **`walkthrough`** as canonical narrative context when present (player-visible scene analysis aligned to **`phasePlan`**).
   - When **`phasePlan`** is present, add a **deterministic human-readable outline** derived from structured phases (ordered steps, achievements, stable keys resolved to staged **`shortName`**, virtual entities summarized). Prefer concise prose bullets over dumping raw JSON unless a small fenced summary aids the model.
3. **Fallback:** When **`phasePlan`** is absent (validation failed but prose survived, or legacy rows), outcome still uses **`intent`** and optional **`walkthrough`**.
4. **Caching split:** [`buildPlanOutcomePromptParts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts) uses a fixed **invariant** prefix array (topology, safety, voice) and a **dynamic** tail (hypothesis, optional scene analysis and phase outline, staged snapshot); no numeric **`splitAt`** drift.
5. **Tests:** Extend [`buildPlanOutcomePrompt.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts), [`generatePlanOutcome.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.test.ts), and [`internalCache/index.test.ts`](../../../../../lambda/ephemera/internalCache/index.test.ts) or focused Coyote cache tests so new sections and deps are covered; keep **Jest** from `lambda/ephemera`.

## Non-goals (for this initiative)

- **Multi-hop outcome refinement** (second Bedrock pass, critic model) unless a later task explicitly adds it; [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) already notes multi-stage refinement as future work.
- Replacing the **single-line** player-visible outcome format (`RenderTree` with one `Outcome:` string) unless product requests richer structure.

## Integration points

| Area | Role |
| --- | --- |
| [`CoyoteGameIntentRecord`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) | `intent`, optional `walkthrough`, optional `phasePlan` |
| [`internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts) | `generateOutcome` deps: pass full record or `getIntentRecord` |
| [`collectCoyoteSnapshotStableKeys`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPhasePlanContext.ts) / staged objects | Resolve **`stableKeysUsed`** and labels for outline text |
| [`CoyotePhasePlan`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts) | Phase structure: `stableKeysUsed`, `virtualEntities`, `achievement`, `prepVsBeat` |

## Material decisions

- **Dep API:** Prefer `getIntentRecord: () => Promise<CoyoteGameIntentRecord>` (or passing the record from the single `get('intent')` call site) over widening `getIntent` to return a string that is actually a concatenation hack.
- **Outline ownership:** Implement a small pure helper (e.g. `formatPhasePlanForOutcomePrompt(phasePlan, roomObjectsByRoom)`) colocated with prompt building or snapshot code, **reusing** snapshot maps for stable key to display name. Keep line count bounded for long plans (optional caps documented in code if needed).
- **Stub behavior:** Preserve **`Outcome: Stubbed`** on Bedrock failure or unparseable body; no change to player-facing failure contract unless explicitly decided.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)).

1. **Understand project foundations**
   - **Why:** Task plans live under [`taskPlanning/`](../../../../); this file should not duplicate steady-state architecture.
   - **Read:** [`taskPlanning/AGENT.md`](../../../../AGENT.md). Skim [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) for the Await Road Runner / outcome path and hypothesis pipeline overview.

2. **Read this document**
   - **Why:** **Recommended order** and **Verification** are the durable checklists for the slice.

3. **Understand core integration points**
   - **Focus:** [`generatePlanOutcome.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts), [`buildPlanOutcomePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts), [`internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts) (CoyoteGame wiring), [`coyoteGame.ts`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) (intent record shape).

4. **Review hypothesis output contract**
   - **Focus:** [`parseHypothesisModelOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) (`CoyoteGameIntentRecord` population), [`coyoteHypothesisPhasePlanContext.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPhasePlanContext.ts) (snapshot keys for validation; reuse ideas for resolution).

5. **Check testing patterns**
   - **Why:** Ephemera uses **Jest** from [`lambda/ephemera`](../../../../../lambda/ephemera); run targeted test files after edits.
   - **Files:** Existing Coyote tests under [`lambda/ephemera/dataSource/coyoteGame/*.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/).

6. **Run baseline tests**
   - **Why:** Confirm green before and after refactor; see **Verification**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as each sub-step finishes.

- [X] **Plumb intent record into outcome generation**
  - [X] Extend `GeneratePlanOutcomeDeps` to accept full `CoyoteGameIntentRecord` (e.g. `getIntentRecord` or equivalent) alongside or instead of string-only `getIntent`.
  - [X] Update `internalCache` `generateOutcome` closure to pass the record from `CoyoteGame.get('intent')` without extra fetches.
  - [X] Keep overrides for tests (`hypothesisLineOverride` pattern may expand to optional full record override if needed).

- [X] **Enrich `buildPlanOutcomePrompt`**
  - [X] Add sections for **Hypothesis line** (short anchor) and **Scene analysis** when `walkthrough` is present, with instructions that execution should follow that analysis in cartoon time.
  - [X] Add **Phase plan (execution outline)** when `phasePlan` is present: ordered phases, `achievement`, `prepVsBeat`, resolved stable keys and brief virtual-entity summaries; instruct the model to compress into one **Outcome:** line with Coyote backfire and Road Runner safety.
  - [X] **Recompute `invariantPrefix` / `dynamicSuffix` split** for prompt caching after section order and line count stabilize.

- [X] **Implement `formatPhasePlanForOutcomePrompt` (or named equivalent)**
  - [X] Pure function: input `CoyotePhasePlan` + `CoyoteRoomObjectsByRoom`, output markdown or plain-text block.
  - [X] Resolve `stableKeysUsed` to **`shortName`** via snapshot; handle unknown keys gracefully for robustness.

- [X] **Tests and docs**
  - [X] Unit tests: prompt contains expected sections when `walkthrough` / `phasePlan` present or absent.
  - [X] Unit tests: formatter output snapshots or string assertions for a small fixture `phasePlan`.
  - [X] Update [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) outcome bullet to describe rich prompt inputs (short task-specific note; avoid pasting large architecture).

## Verification

- From `lambda/ephemera`: `npm run build`
- Targeted Jest (adjust paths if test file names change):
  - `npm run test -- --runInBand dataSource/coyoteGame/buildPlanOutcomePrompt.test.ts dataSource/coyoteGame/formatPhasePlanForOutcomePrompt.test.ts dataSource/coyoteGame/generatePlanOutcome.test.ts dataSource/coyoteGame/handleAwaitRoadRunnerForPlanOutcome.test.ts internalCache/index.test.ts internalCache/coyoteGame.test.ts`
- Lint clean on touched files (`read_lints` / IDE diagnostics).

## Progress

| Milestone | Status |
| --- | --- |
| Intent record plumbed to `generatePlanOutcome` / cache | Done |
| Prompt sections: walkthrough + phase outline | Done |
| Formatter helper + tests | Done |
| Prompt cache split validated | Done |
| `AGENT.md` outcome path updated | Done |
