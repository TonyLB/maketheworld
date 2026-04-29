# Coyote planSelect expansion (planning)

**Status:** In progress. Next step is to lock the hop-1 handoff shape for a structured selected-candidate artifact.

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

## Open questions and decisions needed

1. `selectedCandidate` schema strictness:
   - Should it mirror plan-select input shape exactly, or allow extra merge metadata?
   - Should sequencing hints be required, optional, or omitted in v1?
2. Residual `planIssues` policy:
   - Should resolved issues be fully removed from final `planIssues`, or retained with explicit status?
3. Phase-plan consumption:
   - Should phase-plan prompt grounding explicitly prioritize `selectedCandidate` when present?
   - What fallback language should apply when only legacy hop-1 keys exist?
4. Parser tolerance:
   - Should unknown top-level handoff keys stay tolerated, or should `selectedCandidate` rollout tighten key validation?
5. Harness rollout:
   - Should fixtures migrate in one sweep or by phased corpus slices?

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

- [ ] Phase P0 - lock handoff contract delta
  - [ ] Decide `selectedCandidate` schema fields and strictness.
  - [ ] Decide residual `planIssues` semantics (resolved rows dropped vs status-tagged).
  - [ ] Document migration compatibility guarantees (legacy-only handoff remains valid).

- [ ] Phase P1 - prompt redesign (single invocation, structured internals)
  - [ ] Add explicit phase order and per-phase JSON mini-schema instructions to plan-select prompt.
  - [ ] Preserve required markdown sections and trailing handoff JSON fence constraints.
  - [ ] Add explicit instructions that final handoff JSON is the only downstream-consumed artifact.

- [ ] Phase P2 - hop-1 parser/type updates
  - [ ] Extend `CoyoteHop1Handoff` with optional structured winner payload.
  - [ ] Validate payload shape with row-scoped parse reasons.
  - [ ] Preserve acceptance of legacy handoff JSON with only required v1 keys.

- [ ] Phase P3 - phase-plan grounding updates
  - [ ] Thread structured winner payload into phase-plan prompt grounding when present.
  - [ ] Keep legacy fallback path for existing fixtures and legacy outputs.

- [ ] Phase P4 - tests and fixture migration
  - [ ] Add/adjust unit tests for prompt instructions and parser narrowing behavior.
  - [ ] Update harness fixtures for selected corpus rows with structured winner payload.
  - [ ] Verify `runOnly phasePlan` inject compatibility with mixed legacy/new handoffs.

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
| Contract delta locked | Not started |
| Prompt and parser updates landed | Not started |
| Phase-plan grounding updates landed | Not started |
| Fixtures and tests migrated | Not started |
| Closeout and durable docs sync | Not started |
