# Coyote planSelect expansion (planning)

**Status:** In progress. Phase P0 is locked; next step is Phase P1 prompt redesign with structured internal phases.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../../../../AGENT.md).

## Purpose

Track a bounded redesign of the hypothesis `planSelect` hop so it can:

1. Keep a single Bedrock invocation while using explicit internal multi-phase reasoning.
2. Preserve a machine-usable JSON artifact for the cleaned winning candidate.
3. Maintain compatibility with existing hop-1 parser and pipeline boundaries during migration.

This plan is task-scoped and should be removed or archived after this expansion lands and durable guidance is moved into package docs.

## Scope and boundaries

### In scope

- Keep current pipeline step topology unchanged (no additional Bedrock hops).
- Expand plan-select prompt instructions to enforce internal phases:
  - per-candidate issue detection and proposed resolution,
  - rubric judgment over post-resolution candidate views,
  - winner merge and residual-issue output.
- Extend hop-1 final handoff JSON with an optional structured selected-candidate payload for downstream use.
- Keep required v1 keys (`paragraphSummary`, `planIssues`) intact while adding compatibility-safe optional fields.
- Update tests and harness fixtures to cover the new handoff shape and fallback behavior.

### Out of scope

- Changes to stage-one candidate generation or clustering contracts.
- New `planIssues` codes beyond the current allowlist.
- Changes to the number of production LLM invocations in the hypothesis pipeline.
- Redefining trope enum values to include plural trope names as new `CoyoteTrope` variants.

## Current assumptions (agreed so far)

- Internal multi-phase reasoning happens inside one prompt run, not across pipeline steps.
- Phase-specific JSON artifacts are primarily prompt-structuring tools.
- The final trailing JSON fence remains the parser authority for hop-1 handoff.
- Plural-form handling is represented as execution-detail wording and sequencing hints, not trope-type expansion.
- `resolvedBy: "planSelect-merge"` is deferred unless a clear downstream need appears.

## Decisions locked (current)

1. `selectedCandidate` schema strictness:
   - Mirror plan-select input shape exactly in v1 (no extra merge metadata fields).
   - Sequencing hints are omitted in v1.
2. Residual `planIssues` policy:
   - Remove resolved issues from final `planIssues`; only residual unresolved issues remain.
3. Phase-plan consumption:
   - Phase-plan prompt grounding should explicitly prioritize `selectedCandidate` when present.
   - Legacy fallback should be a "do your best" bridge using existing `paragraphSummary` and `planIssues`.
4. Parser tolerance:
   - Unknown top-level handoff keys remain tolerated, but non-authoritative keys are screened out deterministically by narrowing logic.
5. Harness and fixture rollout:
   - Migrate by phased corpus slices, not one sweep.
   - Before fixture-slice updates, run a practical plan-select evaluation pass to validate output quality and stability.
6. Migration compatibility guarantees:
   - Legacy-only handoff (`paragraphSummary` + `planIssues`) remains valid during rollout.
   - `selectedCandidate` is optional in the initial expansion phase and prioritized when present.
   - Final handoff narrowing keeps authoritative keys deterministic for downstream consumption.

## Open questions and decisions needed

- When to flip from "prioritize `selectedCandidate`" to "require `selectedCandidate`" in phase-plan consumption.
- What quality threshold and sample size define "stable enough" to start fixture-slice migration.
- Whether any currently tolerated top-level keys should be explicitly deprecated in parser diagnostics before the required-`selectedCandidate` phase.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../../../../AGENT.md).
2. Read Coyote package and hypothesis pipeline docs:
   - [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md)
3. Read testing command authority before edits: [`lambda/ephemera/AGENT.testing.md`](../../../../../../../../lambda/ephemera/AGENT.testing.md).
   - If command examples conflict elsewhere, follow this file for lambda-level test usage.
4. Review hop-1 prompt/parser/type authority:
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.ts)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.ts)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.ts`](../../../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.ts)
5. Run one baseline verification command before edits (from `lambda/ephemera/`):
   - `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.test.ts`

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase P0 - lock handoff contract delta
  - [X] Decide `selectedCandidate` schema fields and strictness.
  - [X] Decide residual `planIssues` semantics (resolved rows dropped vs status-tagged).
  - [X] Document migration compatibility guarantees (legacy-only handoff remains valid).

- [X] Phase P1 - prompt redesign (single invocation, structured internals)
  - [X] Add explicit phase order and per-phase JSON mini-schema instructions to plan-select prompt.
  - [X] Preserve required markdown sections and trailing handoff JSON fence constraints.
  - [X] Add explicit instructions that final handoff JSON is the only downstream-consumed artifact.

- [X] Phase P2 - hop-1 parser/type updates
  - [X] Extend `CoyoteHop1Handoff` with optional structured winner payload.
  - [X] Validate payload shape with row-scoped parse reasons.
  - [X] Preserve acceptance of legacy handoff JSON with only required v1 keys.

- [X] Phase P3 - phase-plan grounding updates
  - [X] Thread structured winner payload into phase-plan prompt grounding when present.
  - [X] Keep legacy fallback path for existing fixtures and legacy outputs.

- [X] Phase P4 - tests and fixture migration
  - [X] Add/adjust unit tests for prompt instructions and parser narrowing behavior.
  - [X] Update harness fixtures for selected corpus rows with structured winner payload.
  - [X] Verify `runOnly phasePlan` inject compatibility with mixed legacy/new handoffs.

- [ ] Phase P5 - closeout
  - [ ] Run targeted and broad hypothesis tests.
  - [ ] Update progress and checkboxes in this plan.
  - [ ] Move durable behavior notes into package docs and archive/remove this plan.

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

Baseline:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.test.ts
```

Focused hypothesis coverage:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts
```

Harness regression checks:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/coyoteEngineTestFixtures.test.ts
```

## Progress

| Milestone | Status |
| --- | --- |
| Plan drafted | Done |
| Contract delta locked | Done |
| Prompt and parser updates landed | Done |
| Phase-plan grounding updates landed | Done |
| Fixtures and tests migrated | Done |
| Closeout and durable docs sync | Not started |
