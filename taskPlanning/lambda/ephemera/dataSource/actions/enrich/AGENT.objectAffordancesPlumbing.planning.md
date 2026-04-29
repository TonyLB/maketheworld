# Object affordances plumbing (planning)

**Status:** In progress. Phase A0 inventory and decision lock complete; next step is Phase A1 (type and validator updates).

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Track a bounded plumbing task to introduce an optional `affordances?: string[]` channel on each `tropeAffinities` element and carry it through types, persistence, and prompt-ingest seams.

The goal is infrastructure only: this task creates the pipe so future work can populate and consume affordance content. It does not author affordance strings or tune prompt behavior to reference them.

## Scope and boundaries

### In scope

- Add `affordances?: string[]` to the relevant `tropeAffinities` element type contracts.
- Ensure persistence layers can store/load the new optional field without regressions.
- Ensure prompt-building/plumbing paths can carry this field into prompt assembly inputs where `tropeAffinities` is already threaded.
- Keep compatibility with existing records/fixtures that do not include `affordances`.
- Add or update targeted tests to lock shape compatibility and non-breaking behavior.

### Out of scope

- Generating or backfilling real affordance content (for example, adding `"Boulders are available if needed for payload"` to specific affinities).
- New planning logic that actively consumes `affordances` for decision quality.
- Prompt rewrites that depend on affordance semantics.
- Broader pipeline quality tuning unrelated to schema/plumbing.

## Pre-implementation decisions to lock

Resolve and record these before Phase A1 code edits begin:

1. Canonical schema owner:
   - Which type/schema is the source of truth for a `tropeAffinities` element?
   - Which downstream contracts are mirrors/derived and must stay in sync?
2. Validation and normalization policy for `affordances`:
   - Allowed: omitted, present as `string[]`, and explicit empty `[]`.
   - Rejected: non-array values and non-string elements.
   - Empty/whitespace-only strings are ignored at construction time (treated as not present).
3. Persistence semantics:
   - Preferred normalization is omitted (do not persist explicit empty by default).
   - Empty arrays are permitted for compatibility but not preferred.
   - Read/write paths must remain compatible for absent and present values.
4. Prompt plumbing boundary:
   - This task only threads `affordances` through prompt input seams plus object-cache persistence paths.
   - Prompt text/rendering remains behaviorally unchanged in this slice.
5. Compatibility and migration:
   - No historical backfill/migration is required.
   - Existing fixtures/data without `affordances` remain valid.
6. Test authority for this slice:
   - Lock exact baseline and targeted regression commands in this doc during A0.

## Decision log (fill during A0)

| Decision | Owner | Outcome | Date |
| --- | --- | --- | --- |
| Canonical `tropeAffinities` schema owner | Anthony + Agent | Lock canonical owner to `packages/mtw-interfaces/ts/coyotePlanAffinities.ts` (`CoyoteTropeAffinity` + `isCoyoteTropeAffinity`). Immediate implication: bounded fan-out alignment updates in downstream carriers/validators, not an architectural rewrite. | 2026-04-29 |
| `affordances` validation policy | Anthony + Agent | Allow omitted / `string[]` / explicit `[]`; reject non-array and non-string elements; ignore empty/whitespace-only strings at construction time. | 2026-04-29 |
| Empty array vs omitted persistence behavior | Anthony + Agent | Normalize to omitted by default; explicit empty arrays are permitted for compatibility but not preferred. | 2026-04-29 |
| Prompt plumbing depth (input-only vs rendered) | Anthony + Agent | Thread through prompt input seams and object-cache persistence paths only; no prompt text/rendering changes in this task. | 2026-04-29 |
| Backfill/migration requirement | Anthony + Agent | No historical backfill/migration required; existing fixtures/data without `affordances` remain valid. | 2026-04-29 |
| Baseline + targeted test command list | Anthony + Agent | Lock baseline and regression command set under `Verification` in this doc. | 2026-04-29 |

## Phase A0 inventory map (locked)

Canonical schema/validation owners:

- `packages/mtw-interfaces/ts/coyotePlanAffinities.ts`
  - Canonical affinity element type and validators (`CoyoteTropeAffinity`, `isCoyoteTropeAffinity`) plus enrich normalization/validation.
- `packages/mtw-interfaces/ts/ephemeraMeta.ts`
  - Canonical persisted room-object carrier (`EphemeraMetaRoomObject.tropeAffinities?`).

Downstream mirrored/derived contracts to keep aligned in A1-A3:

- `lambda/ephemera/dataSource/actions/baseClasses.ts` (`ParseCommandAcmeOrderLine`, `isParseCommandAcmeOrderResult`)
- `lambda/ephemera/dataSource/actions/publishedEvents.ts` (`AcmeOrderPublishedOrder`, payload guards)
- `lambda/ephemera/dataSource/actions/enrich/acmeOrder/interpretAndFinalize.ts` (enrich parse -> parse-command line mapping)

Persistence write/read paths carrying `tropeAffinities`:

- Write path: `actions/index.ts` -> `objects/handleApiObjectsChange.ts` -> `objects/mergePersistMetaRoomObjects.ts`
- Read path: `internalCache/componentEphemeraMeta.ts` -> `coyoteGame/utilities/coyoteRoomObjectSnapshot.ts` -> hypothesis/outcome pipelines
  - `coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts`
  - `coyoteGame/generators/pipelines/outcome/generatePlanOutcome.ts`

Prompt/pipeline seams where `tropeAffinities` is threaded:

- Snapshot formatter seam: `coyoteGame/utilities/coyoteRoomObjectSnapshot.ts`
- Hypothesis prompt seam consumers:
  - `coyoteGame/generators/pipelines/hypothesis/buildHypothesisStageOnePrompt.ts`
  - `coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.ts`
  - `coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.ts`
- Outcome prompt seam consumer:
  - `coyoteGame/generators/pipelines/outcome/buildPlanOutcomePrompt.ts`
- Harness seam contracts to keep aligned:
  - `coyoteGame/generators/pipelines/hypothesis/coyoteHarnessInjectTypes.ts`
  - `coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts`

Implementation-facing A1 clarifications:

- Validation policy lock applies at canonical construction/normalization boundaries: allow omitted, `string[]`, and explicit empty `[]`; reject non-array and non-string elements.
- Empty or whitespace-only affordance entries should be filtered during normalization, then persistence should prefer omission over explicit empty arrays.
- Prompt behavior lock remains input-plumbing only for this task: no intentional text/rendering behavior change in A1-A3.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read area context for current Coyote tuning/plumbing dependencies:
   - [`taskPlanning/lambda/ephemera/dataSource/coyoteGame/AGENT.tuneLLMPipeline.planning.md`](../coyoteGame/AGENT.tuneLLMPipeline.planning.md)
   - [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)
3. Read test-command authority before execution: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If command examples conflict elsewhere, follow this file.
4. Capture a baseline run for the targeted test slice before edits (command list to finalize in this plan as files are confirmed).

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase A0 - inventory schema and plumbing surfaces
  - [X] Locate all `tropeAffinities` type definitions and validators/parsers.
  - [X] Locate persistence write/read paths for objects carrying `tropeAffinities`.
  - [X] Locate prompt-part builders and pipeline seams that pass `tropeAffinities` through.
  - [X] Resolve all items in `Pre-implementation decisions to lock` and record outcomes in `Decision log`.
  - [X] Finalize targeted test list for this slice.

- [X] Phase A1 - add type and validation support
  - [X] Add optional `affordances?: string[]` to canonical interfaces/types.
  - [X] Update parser/validator schemas to accept missing or present `affordances`.
  - [X] Preserve strictness for non-array or non-string invalid values.
  - Locked implementation notes:
    - Canonical `CoyoteTropeAffinity` now includes optional `affordances?: string[]` in `packages/mtw-interfaces/ts/coyotePlanAffinities.ts`.
    - Guard policy is enforced in `isCoyoteTropeAffinity`: omitted/array accepted; non-array and non-string array elements rejected.
    - A1 targeted verification passed:
      - `npm --prefix packages/mtw-interfaces run test -- --watchAll=false ts/coyotePlanAffinities.test.ts`
      - `npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts`
      - `npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/actions/parseCommand.test.ts`

- [ ] Phase A2 - persistence plumbing
  - [ ] Ensure serialization/writes preserve optional `affordances` when present.
  - [ ] Ensure hydration/reads expose `affordances` when present and remain compatible when absent.
  - [ ] Add regression coverage for both present and absent cases.

- [ ] Phase A3 - prompt-ingest plumbing
  - [ ] Thread `affordances` through prompt input structures where `tropeAffinities` already flows.
  - [ ] Keep prompt content behavior unchanged (channel may remain unused textually).
  - [ ] Add/update tests to prove no regressions in existing prompt assembly behavior.

- [ ] Phase A4 - verification and closeout
  - [ ] Run targeted tests for schemas, persistence, and prompt plumbing.
  - [ ] Run broader confidence slice for impacted Coyote paths.
  - [ ] Update this checklist and capture brief locked implementation notes.
  - [ ] Archive/remove this plan when shipped and durable notes are moved per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Verification

Run from repository root using `--prefix` so commands work under repo-root sandbox constraints.

Baseline:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/actions/publishedEvents.test.ts
```

Targeted regression:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/actions/parseCommand.test.ts
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/objects/mergePersistMetaRoomObjects.test.ts
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.test.ts
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/coyoteGame/utilities/coyoteRoomObjectSnapshot.test.ts
```

Also run canonical interface guard coverage from root with `--prefix`:

```bash
npm --prefix packages/mtw-interfaces run test -- --watchAll=false ts/coyotePlanAffinities.test.ts
```

Broader confidence slice (after targeted regression):

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.test.ts
```

## Progress

| Milestone | Status |
| --- | --- |
| Plan drafted | Done |
| Schema surfaces inventoried | Done |
| Type + validator updates landed | Done |
| Persistence plumbing landed | Not started |
| Prompt-ingest plumbing landed | Not started |
| Verification complete | Not started |
