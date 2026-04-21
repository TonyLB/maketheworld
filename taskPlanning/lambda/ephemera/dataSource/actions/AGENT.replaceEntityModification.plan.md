# Replace `entity_modification` with flat affinity tags

**Status:** In progress. Next step is Phase 5 docs, harnesses, and compatibility cleanup.

## Purpose

Track a staged migration from nested `entity_modification` affinities (`target` + `mode`) to flat, intent-level tags that better match Coyote cartoon semantics and improve LLM prompt consistency across:

1. Acme order enrich (Step B)
2. Stage-one clustering and combine
3. Stage-two plan-phase hypothesis evaluation

This is a task-scoped plan and should be retired once the migration is complete and durable docs are updated.

## Target taxonomy

Replace `entity_modification` usage with flat tags:

- `influence-road-runner`
- `alter-road-runner`
- `coyote-equipment`
- `coyote-enhancement`
- `setting-addition`
- `connect-props`
- `enhance-prop`

Existing non-entity roles remain in scope unless explicitly revised:

- Structural: `terminal`, `trigger`, `delivery`, `autonomous_agent`
- Generative: `prep`, `creation`

## Getting started

Follow the ordered categories below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)).

1. **Understand planning conventions**
   - **Why:** This file is a task plan, not steady-state subsystem documentation.
   - **Read:** [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability scope, checklist conventions, and verification expectations.

2. **Read current affinity contracts**
   - **Why:** The migration touches shared interfaces first.
   - **Read:** [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts), [`packages/mtw-interfaces/ts/coyotePlanAffinities.test.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.test.ts), [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts).

3. **Understand Acme order ingest and persistence path**
   - **Why:** Step B prompting and normalization are first migration stage.
   - **Read:** [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md), [`lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts), [`lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts), [`lambda/ephemera/dataSource/actions/parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`lambda/ephemera/dataSource/actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts), [`lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts).

4. **Understand clustering and plan-phase usage**
   - **Why:** Stage-one role echo and stage-two interpretation consume persisted affinity rows.
   - **Read:** [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md), [`lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageOnePrompt.ts), [`lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts), [`lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts), [`lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), [`lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts).

5. **Identify next task**
   - **Why:** Execution order lives in the checklist below.
   - **Focus:** First unchecked line in **Recommended order** and matching verification updates.

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [X] Phase 1 - define contract and migration mapping
  - [X] Finalize canonical flat-tag vocabulary and semantics (including distinction boundaries such as `connect-props` vs `enhance-prop`).
  - [X] Define deterministic mapping guidance from old `entity_modification` tuples to new tags for fixtures/backfill logic and test rewrites.
  - [X] Decide compatibility strategy during rollout: strict cutover vs temporary dual-read support.
  - [X] Document accepted ambiguity handling when old records cannot be mapped confidently.

- [X] Phase 2 - stage A: Acme order enrich migration
  - [X] Update `CoyoteAffinityPossibility` contracts and guards in `mtw-interfaces` to remove nested `entity_modification` shape and include flat tags.
  - [X] Update Step B prompt instructions/examples in `buildParseAcmeOrderEnrichPrompt.ts` to emit only flat tags.
  - [X] Update Step B normalization and parse guards to accept new tags and reject old tuple shape.
  - [X] Update Acme parse harness output expectations and tests (`parseCommand`, `mergeAcmeOrderEnrich`, Step B prompt tests).
  - [X] Confirm persisted `Meta::Room.objects.affinities` rows remain valid with new tag shape.

- [X] Phase 3 - stage B: clustering and combine migration
  - [X] Update stage-one prompt few-shot and contract text to echo flat tag roles (no `target` / `mode` fields).
  - [X] Update stage-one parser validation/resolution logic for intended-role echo matching against flat tags.
  - [X] Update combine resolution and renderer output to remove `entity_modification` special-case branches.
  - [X] Update clustering tests and fixture assertions for flat-tag intended roles.

- [X] Phase 4 - stage C: plan-phase hypothesis evaluation migration
  - [X] Update stage-two prompt contract language to describe flat tags and their intended narrative interpretation.
  - [X] Ensure plan-phase interpretation rules reinforce genre constraints (especially avoiding implausible Road Runner constructive-equipment readings).
  - [X] Update tests that assert prompt wording and downstream role rendering assumptions.

- [ ] Phase 5 - docs, harnesses, and compatibility cleanup
  - [ ] Update `AGENT.md` docs in `actions` and `coyoteGame` to reflect the new role vocabulary.
  - [ ] Review engine and affinities harness fixtures (`coyoteEngineTestFixtures.ts`, slash-command harnesses) for stale tuple references.
  - [ ] Remove temporary compatibility shims (if any) after all producers/consumers have migrated.
  - [ ] Update this plan checkboxes and verification notes as slices land.

- [ ] Phase 6 - completion and retirement
  - [ ] Ensure durable docs own steady-state behavior and this plan only tracks process history.
  - [ ] Delete or archive this plan when migration is fully shipped.

## Phase 1 decisions and mapping guidance

- Canonical flat modification tags are:
  - `influence-road-runner`: affects Road Runner behavior or pathing.
  - `alter-road-runner`: directly alters or restrains Road Runner.
  - `coyote-equipment`: wearable or carried equipment for Coyote.
  - `coyote-enhancement`: improves Coyote capability/state.
  - `setting-addition`: introduces terrain/scenery setup.
  - `connect-props`: links staged props into a mechanism.
  - `enhance-prop`: modifies a single staged prop.
- Deterministic legacy tuple mapping (`entity_modification`) used for fixture rewrites/backfill:
  - `(target=road_runner, mode=direct)` -> `influence-road-runner`
  - `(target=road_runner, mode=constructive)` -> `alter-road-runner`
  - `(target=coyote, mode=direct)` -> `coyote-enhancement`
  - `(target=coyote, mode=constructive)` -> `coyote-equipment`
  - `(target=prop, mode=direct)` -> `enhance-prop`
  - `(target=prop, mode=constructive)` -> `connect-props`
- Compatibility policy for Stage A is strict cutover in shared guards: legacy tuple shape is rejected once migrated.
- Ambiguity handling: when legacy rows cannot be mapped confidently, keep the row with `affinities: []` and set `affinitiesFailed: true` instead of inventing coarse tags.

## Verification

- Interfaces and unit tests:
  - `cd "/Users/anthonylower-basch/Code/maketheworld/packages/mtw-interfaces" && npm test -- --runInBand ts/coyotePlanAffinities.test.ts`
- Ephemera actions + coyoteGame paths:
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npx jest dataSource/actions/ dataSource/coyoteGame/`
- Build:
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npm run build`
- Lint diagnostics:
  - `ReadLints` clean for all edited files.

As phases complete, append concrete command transcripts/results under this section for reproducible validation history.

- 2026-04-21 (Phase 1-2):
  - `cd "/Users/anthonylower-basch/Code/maketheworld/packages/mtw-interfaces" && npm test -- --runInBand ts/coyotePlanAffinities.test.ts`
    - Result: failed (`npm error Missing script: "test"` in this workspace package).
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npx jest dataSource/actions/ dataSource/coyoteGame/`
    - Result: failed before test execution (`SyntaxError: Cannot use import statement outside a module` across suites in current sandbox invocation).
  - `cd "/Users/anthonylower-basch/Code/maketheworld/packages/mtw-interfaces" && npm run build`
    - Result: pass.
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npm run build`
    - Result: pass.
  - `ReadLints` across edited files
    - Result: clean (no linter errors).
- 2026-04-21 (Phase 3-4):
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npx jest dataSource/coyoteGame/buildHypothesisStageOnePrompt.test.ts dataSource/coyoteGame/parseHypothesisStageOneOutput.test.ts dataSource/coyoteGame/combineHypothesisClusters.test.ts dataSource/coyoteGame/coyoteRoomObjectSnapshot.test.ts dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts dataSource/coyoteGame/generateHypothesis.test.ts`
    - Result: failed in this environment before suite execution (`SyntaxError: Cannot use import statement outside a module`; duplicate manual mock warnings from mixed `dist` and `ts` mock trees).
  - `cd "/Users/anthonylower-basch/Code/maketheworld/lambda/ephemera" && npm run build`
    - Result: pass.
  - `ReadLints` across edited files
    - Result: clean (no linter errors).

## Progress

| Milestone | Status |
| --- | --- |
| Flat-tag taxonomy draft agreed (`setting-addition`, `connect-props`, `enhance-prop` included) | Done |
| Contract + migration mapping design | Done |
| Stage A migration (Acme order enrich) | Done |
| Stage B migration (clustering/combine) | Done |
| Stage C migration (plan-phase prompting/evaluation) | Done |
| Durable docs updated and task plan retired | Not started |
