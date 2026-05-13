# Coyote Game: tune trope-centered LLM pipeline (planning)

**Status:** In progress. Next step is Phase T3 (`plan selection`) tuning using the newly frozen clustering outputs as incoming fixture expectations. Gimmick refactor coordination is complete (durable contracts in [`../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)); when refreezing fixtures or bumping plan-select seams, account for per-candidate **`gimmick`** and **`schemaVersion: 4`**.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Track a bounded quality-tuning initiative for the trope-centered Coyote pipeline after the throughline refactor landed. This plan focuses on removing remaining legacy `intendedRole` assumptions, calibrating each hop against a growing fixture corpus, and re-freezing next-hop harness inputs as each tuned hop stabilizes.

This file is task-scoped and should be archived or removed when this tuning pass is complete and durable guidance has been moved to package docs.

## Scope and boundaries

### In scope

- Remove residual `intendedRole` dependencies in seams, prompts, parser assumptions, and harness fixtures where trope-first contracts now apply.
- Tune pipeline quality in strict hop order:
  - `clustering`
  - `plan selection`
  - `phase-plan`
  - `outcome`
- Use bounded prompt revisions plus deterministic parser/validator hardening only where needed to improve contract reliability and output quality.
- Expand and version fixture corpus as tuning proceeds, with explicit per-hop expected outcomes.
- Re-freeze next-hop harness fixtures immediately after each hop is tuned.
- Carry spatial second-pass work here (previously noted in trope-centered refactor plan).

### Out of scope

- Major contract redesigns that supersede Phase 3/4 type seams (unless explicitly added by a follow-up plan update).
- Open-ended creative prompt overhauls without fixture-backed acceptance criteria.
- UI/product behavior changes outside Coyote generation pipelines and harness/tooling.

## Success criteria (first sweep)

- All four hops produce trope-first outputs with no required legacy `intendedRole` assumptions.
- Regression suite for tuned fixtures passes consistently under documented command context.
- Each hop meets explicitly recorded subjective exit criteria before advancing:
  - current output quality is acceptable on the external rubric spreadsheet for this hop;
  - known failure clusters are either addressed in-slice or logged as intentional carry-forward;
  - no blocker-severity failures are left untracked.
- A complete end-to-end sweep is recorded with before/after notes for each hop.

## Working method

For each hop in sequence:

1. Run baseline tests and fixture evaluation.
2. Triage top failure clusters (contract, rubric quality, topology/spatial coherence, style constraints).
3. Apply one bounded revision set.
4. Re-run evaluation and record deltas.
5. Freeze fixture snapshots for this hop.
6. Update next-hop fixtures to reflect tuned upstream output.
7. Advance only if subjective exit criteria are met and logged in notes/spreadsheet.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read current trope-centered refactor state and completed phases: [`taskPlanning/lambda/ephemera/dataSource/coyoteGame/AGENT.tropeCenteredRefactor.planning.md`](AGENT.tropeCenteredRefactor.planning.md).
3. Read trope vocabulary and constraints: [`lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md).
4. Read testing authority for this package before running commands: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If command examples conflict elsewhere, follow this file for lambda-level Jest usage.
5. Confirm command context from package scripts: [`lambda/ephemera/package.json`](../../../../../../lambda/ephemera/package.json) and root [`package.json`](../../../../../../package.json).
6. Review harness authority and fixture source:
   - [`lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts)
7. Run one baseline verification command before edits (from `lambda/ephemera/`):
   - `npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts`

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase T0 - lock tuning protocol and corpus governance
  - [X] Define per-hop subjective exit criteria (spreadsheet rubric judgment + blocker policy + note-taking expectations).
  - [X] Lock fixture corpus update policy as latest-write canonical state (no append-only history; keep current reason tags and expected directional outcomes aligned to active behavior goals).
  - [X] Define scorecard template for before/after reporting at each hop:
    - `qualityScore` (0-50 composite, from external spreadsheet rubric)
    - `elapsedMs` (total time elapsed for evaluated run)
    - `decision` (`advance` or `iterate`)

- [X] Phase T1 - remove legacy `intendedRole` assumptions
  - [X] Inventory all remaining `intendedRole` reads and classify required vs removable.
  - [X] Remove required-by-contract assumptions from trope-first seams, prompts, and parser expectations.
  - [X] Re-freeze fixtures and tests proving no required legacy role fields remain for tuned hops.
  - Locked implementation notes:
    - Stage One member schema is now trope-first and strict: member/outlier objects require `stableKey` + `tropeFunction`; legacy `intendedRole` is rejected as an unknown key in parser validation.
    - Combined clustering and Stage Two prompt contracts now consume/render `tropeFunction` annotations and no longer reference plan-role `intendedRole` semantics.
    - Harness and hypothesis seam fixtures were re-frozen to trope-first member annotations (`coyoteEngineTestFixtures`, pipeline seam mocks), with parser/combine/prompt regressions updated to lock the strict deprecation behavior.

- [X] Phase T2 - tune `clustering` hop
  - [X] Run corpus eval and identify dominant failure clusters.
  - [X] Apply bounded revision pass (prompt/parser/validation copy as needed).
  - [X] Re-run eval and record deltas.
  - [X] Freeze `clustering` fixture outputs and update `plan selection` incoming fixture expectations.
  - Locked implementation notes:
    - Clustering tuning pass advanced quality from 27/50 to 30/50 on the ten-fixture corpus while maintaining a 14-second total run time.
    - Harness fixtures are now trope-first at the object level via canonical `tropeAffinities` entries, with `tropeAffinitiesFailed` placeholders removed for tuning runs.
    - `planSelectInject` is now frozen for fixtures `01-10` using hand-authored Stage One golden seam bodies rendered through parse/combine/markdown production paths, establishing canonical incoming expectations for Phase T3.

- [ ] Phase T3 - tune `plan selection` hop
  - [ ] Evaluate conflict-catalog/rubric/winner quality and handoff reliability.
  - [ ] Apply bounded revision pass.
  - [ ] Re-run eval and record deltas.
  - [ ] Freeze `plan selection` outputs and update `phase-plan` incoming fixture expectations.

- [ ] Phase T4 - tune `phase-plan` hop (including spatial second pass)
  - [ ] Add explicit spatial judgment inputs to plan-selection/phase-plan expectations (room boundaries, co-staged props, path feasibility).
  - [ ] Add explicit spatial deconfliction checks for trope sequence and walk-through consistency.
  - [ ] Expand fixtures with spatial contradiction cases and expected corrections.
  - [ ] Apply bounded revision and re-freeze phase-plan fixtures.

- [ ] Phase T5 - tune `outcome` hop
  - [ ] Evaluate outcome faithfulness to trope sequence, deconfliction, walkthrough beats, and safety constraints.
  - [ ] Apply bounded revision pass.
  - [ ] Re-run eval and lock outcome regressions.

- [ ] Phase T6 - full pipeline sweep and closeout
  - [ ] Run one full end-to-end sweep through all four hops on active corpus.
  - [ ] Capture unresolved failures and classify follow-up vs acceptable residual risk.
  - [ ] Update this plan checkboxes and summarize locked implementation notes for the completed sweep.
  - [ ] Move durable learnings to package docs and archive/remove this task plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

Baseline:

```bash
npm run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts
```

Coyote harness + pipeline:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/sharedParsers/parseHypothesisModelOutput.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome.test.ts
```

Broad Coyote package confidence (as needed after cross-hop changes):

```bash
npx jest dataSource/coyoteGame/
```

## Progress

| Milestone | Status |
| --- | --- |
| Tuning plan drafted | Done |
| Protocol + corpus governance locked | Not started |
| Legacy `intendedRole` assumptions removed | Not started |
| Clustering tuned and re-frozen | Done |
| Plan selection tuned and re-frozen | Not started |
| Phase-plan tuned (spatial second pass included) | Not started |
| Outcome tuned and re-frozen | Not started |
| Full sweep complete; durable docs updated | Not started |
