# Coyote plan outcome refactor (rich hypothesis record)

**Status:** Not started. Next step: plumb `CoyoteGameIntentRecord` into outcome generation and extend prompts.

Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability rules (this file retires after the task), **Recommended order** checkbox conventions, and what belongs here versus [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md).

## Purpose

Refactor **plan outcome** generation so it uses the **full durable hypothesis record**, not only the single-line `Hypothesis:` string (`intent`). Today [`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts) and [`buildPlanOutcomePrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts) receive just `hypothesisLine`; [`internalCache`](../../../../../lambda/ephemera/internalCache/index.ts) wires `getIntent` as `(await CoyoteGame.get('intent')).intent`, discarding **`walkthrough`** (scene analysis prose aligned to the plan) and **`phasePlan`** (validated [`CoyotePhasePlan`](../../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts)).

The outcome model should ground the single **"Outcome:"** line in the same **beat sequence and prop vocabulary** the hypothesis pipeline produced, while preserving existing **Road Runner safety** and **Coyote backfire** rules.

This plan is task-scoped; archive or delete it when the initiative ships and fold any lasting behavior notes into code-adjacent `AGENT.md`.

## Goals

1. **Data plumbing:** Pass `CoyoteGameIntentRecord` (or equivalent) into outcome generation so **no extra Dynamo reads** are required beyond `CoyoteGame.get('intent')`.
2. **Prompt enrichment:**
   - Treat **`walkthrough`** as canonical narrative context when present (player-visible scene analysis aligned to **`phasePlan`**).
   - When **`phasePlan`** is present, add a **deterministic human-readable outline** derived from structured phases (ordered steps, achievements, stable keys resolved to staged **`shortName`**, virtual entities summarized). Prefer concise prose bullets over dumping raw JSON unless a small fenced summary aids the model.
3. **Fallback:** When **`phasePlan`** is absent (validation failed but prose survived, or legacy rows), outcome still uses **`intent`** and optional **`walkthrough`**.
4. **Caching split:** Revisit [`buildPlanOutcomePromptParts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildPlanOutcomePrompt.ts) **`splitAt`** so the **invariant** prefix (topology, safety constraints, voice rules) stays stable for Bedrock prompt caching while the **dynamic** tail grows.
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

- [ ] **Plumb intent record into outcome generation**
  - [ ] Extend `GeneratePlanOutcomeDeps` to accept full `CoyoteGameIntentRecord` (e.g. `getIntentRecord` or equivalent) alongside or instead of string-only `getIntent`.
  - [ ] Update `internalCache` `generateOutcome` closure to pass the record from `CoyoteGame.get('intent')` without extra fetches.
  - [ ] Keep overrides for tests (`hypothesisLineOverride` pattern may expand to optional full record override if needed).

- [ ] **Enrich `buildPlanOutcomePrompt`**
  - [ ] Add sections for **Hypothesis line** (short anchor) and **Scene analysis** when `walkthrough` is present, with instructions that execution should follow that analysis in cartoon time.
  - [ ] Add **Phase plan (execution outline)** when `phasePlan` is present: ordered phases, `achievement`, `prepVsBeat`, resolved stable keys and brief virtual-entity summaries; instruct the model to compress into one **Outcome:** line with Coyote backfire and Road Runner safety.
  - [ ] **Recompute `invariantPrefix` / `dynamicSuffix` split** for prompt caching after section order and line count stabilize.

- [ ] **Implement `formatPhasePlanForOutcomePrompt` (or named equivalent)**
  - [ ] Pure function: input `CoyotePhasePlan` + `CoyoteRoomObjectsByRoom`, output markdown or plain-text block.
  - [ ] Resolve `stableKeysUsed` to **`shortName`** via snapshot; handle unknown keys gracefully for robustness.

- [ ] **Tests and docs**
  - [ ] Unit tests: prompt contains expected sections when `walkthrough` / `phasePlan` present or absent.
  - [ ] Unit tests: formatter output snapshots or string assertions for a small fixture `phasePlan`.
  - [ ] Update [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) outcome bullet to describe rich prompt inputs (short task-specific note; avoid pasting large architecture).

## Verification

- From `lambda/ephemera`: `npm run build`
- Targeted Jest (adjust paths if test file names change):
  - `npm run test -- --runInBand dataSource/coyoteGame/buildPlanOutcomePrompt.test.ts dataSource/coyoteGame/generatePlanOutcome.test.ts dataSource/coyoteGame/handleAwaitRoadRunnerForPlanOutcome.test.ts internalCache/index.test.ts internalCache/coyoteGame.test.ts`
- Lint clean on touched files (`read_lints` / IDE diagnostics).

## Progress

| Milestone | Status |
| --- | --- |
| Intent record plumbed to `generatePlanOutcome` / cache | Not started |
| Prompt sections: walkthrough + phase outline | Not started |
| Formatter helper + tests | Not started |
| Prompt cache split validated | Not started |
| `AGENT.md` outcome path updated | Not started |
