# Coyote planSelect: affordance alignment (planning)

**Status:** In progress. StableKey and compatibility choices below are locked; materialization contract is recorded in [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md#materialized-affordance-rows-synthetic-stablekey); synthetic member `stableKey` validation and tests are in [`parsePlanSelectOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts); next step is **Downstream read paths**, then prompt updates.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../../../AGENT.md).

## Purpose

Task-scoped plan for **aligning** staged affordance signal (`environmentAffordances`, `affordancesProvided` from [`coyotePlanAffinities`](../../../../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)) with **explicit rows** in the plan-select handoff so later hops do not have to infer finishing moves and similar beats only from embedded arrays on props.

Target direction (draft): allow planSelect output to **materialize** chosen affordances as first-class plan entities (for example synthetic **`stableKey`** values such as `affordance:coyote` or `affordance:boulder1`) inside **`selectedCandidate.tropeAssignments`** where appropriate, with deterministic validation and downstream handling.

This file is disposable after the initiative completes; steady-state contracts belong in [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md), [`parsePlanSelectOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts), and package interfaces as needed.

## Scope

### In scope

- **Contract design:** required member fields for synthetic rows; which tropes may gain materialized rows first (likely **`Finishing Move`**); relationship to existing **`environmentAffordances`** / **`affordancesProvided`** on real staged props (supplement vs replace for narrative). Synthetic **`stableKey`** values use the **`affordance:`** prefix (see Design decisions).

- **Types and validation:** extend [`PlanSelectCombinedMember`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) / handoff types and [`parsePlanSelectOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) so synthetic affordance members parse reliably; keep golden harness payloads valid.

- **Prompt updates:** [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) --- relax copy-only constraints where appropriate, document when and how to materialize, and optional internal-phase cleanup rules (for example disambiguation heuristics: contraption + safety gear vs projectile-only affordances).

- **Downstream consumers:** at minimum trace [`buildNarrativeBeatPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt.ts), phase-plan / outcome formatters, and anything that maps **`stableKey`** to staged ephemera so synthetic keys are handled explicitly (filter, resolve, or join).

- **Tests:** [`parsePlanSelectOutput.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.test.ts), [`buildPlanSelectPrompt.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts), harness fixtures in [`coyoteEngineTestFixtures.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) as needed.

### Out of scope (unless this plan is updated)

- Changing Stage One candidate seam shape beyond what planSelect already receives combined.

- Client or Acme authoring UI for affordances (upstream metadata stays as today unless a separate task extends it).

## Design decisions (locked)

- **Identity (`stableKey`):** Every materialized affordance uses the **`affordance:`** prefix; add numeric suffixes when multiple rows of the same kind appear in one handoff (for example **`affordance:boulder1`**, **`affordance:boulder2`**). Affordance rows are **not** room-object identities: they do **not** resolve through room-object caches and carry meaning **only** inside the handoff JSON they travel with (no stable reference into ephemera like staged **`stableKey`** on props).

- **Grounding (`room`):** For a first draft, **`room`** on a synthetic affordance member should **inherit the seam label from the sourcing staged object** (the prop or row the affordance was chosen from). Refine later if cross-seam affordances need explicit rules.

- **Coyote vs other finishing affordances:** No separate schema fork. Handle with **prompt and rubric text** only: Coyote remains always eligible as a finishing-move affordance; when choosing Coyote versus environment or provided options, ground the choice in staged props and affordance lists (same heuristics already captured under Prompt updates).

- **Compatibility:** **No** handoff **`schemaVersion`** bump for this. **No** dedicated transition window: a handoff **without** any materialized affordance rows remains **valid** whenever the selected candidate needs no correction (optional materialization only).

## Anchor points

| Concern | Location |
| --- | --- |
| Plan-select prompt | [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) |
| Handoff parser | [`parsePlanSelectOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts) |
| Combined candidate shape for planSelect input | [`combineCandidateOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/combineCandidateOutput.ts) |
| Affordance ref types | [`coyotePlanAffinities.ts`](../../../../../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) |
| Hypothesis pipeline overview | [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) |
| Tropes vocabulary | [`AGENT.tropes.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.tropes.md) |

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../../../../../AGENT.md).
2. Read hypothesis pipeline and plan-select contract sections: [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
3. Read current handoff parser and member validation: [`parsePlanSelectOutput.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.ts).
4. Command authority for this package: [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../../lambda/ephemera/AGENT.testing.md). If anything conflicts, follow that file for cwd, runner, and Jest scope.
5. Baseline verification (from `lambda/ephemera/`, after confirming scripts in [`lambda/ephemera/package.json`](../../../../../../../../../lambda/ephemera/package.json)):

   `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.test.ts`

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you finish them.

**Pointer:** Durable materialization contract (synthetic `stableKey`, `room` v1, optional rows, member/parser shape): [`hypothesis/AGENT.md` section "Materialized affordance rows"](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md#materialized-affordance-rows-synthetic-stablekey).

- [X] Record **materialization contract** (stableKey, room inheritance, optional rows; parser member shape) in a short durable note or interfaces comment and link it from [`hypothesis/AGENT.md`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md) when behavior stabilizes.
- [X] **Types + parser:** extend validation for synthetic members; add focused tests in [`parsePlanSelectOutput.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/parsePlanSelectOutput.test.ts).
  - [X] Golden or harness payloads updated if parser rejects old shapes (no edits needed; goldens use staged keys only).
- [ ] **Downstream read paths:** update narrative beat (and any other consumer) so synthetic stableKeys do not break grounding or duplicate real props.
- [ ] **Prompt:** update [`buildPlanSelectPrompt.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.ts) and snapshot tests in [`buildPlanSelectPrompt.test.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/buildPlanSelectPrompt.test.ts).
- [ ] **Harness / fixtures:** extend [`coyoteEngineTestFixtures.ts`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.ts) or related tests when inject paths need new fields.
- [ ] **Close out:** move lasting contract text into area docs; archive or delete this planning file per [`taskPlanning/AGENT.md`](../../../../../../../../AGENT.md).

## Verification

Re-run after substantive edits (same authority as Getting started):

- `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/planSelect/`

Optionally broaden to hypothesis pipeline tests:

- `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/`

Exact commands and filters may evolve; prefer [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../../lambda/ephemera/AGENT.testing.md) if instructions diverge.

## Progress

| Milestone | Notes |
| --- | --- |
| Contract drafted | StableKey prefix, room v1, compatibility; steady-state prose and authority links in [`hypothesis/AGENT.md#materialized-affordance-rows-synthetic-stablekey`](../../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md#materialized-affordance-rows-synthetic-stablekey); `PlanSelectCombinedMember` JSDoc and parser member validator comment |
| Parser + tests | Member-row `stableKey`: trim; if prefixed with `affordance:`, non-empty suffix matching `[A-Za-z0-9_-]+`; exports `MATERIALIZED_AFFORDANCE_STABLE_KEY_PREFIX`, `isValidMaterializedAffordanceStableKey`; tests for accept / reject / trim; harness unchanged |
| Downstream consumers | |
| Prompt + tests | |
| Harness / integration | |
| Docs migrated; plan retired | |
