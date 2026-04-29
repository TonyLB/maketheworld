# Coyote Game: refactor rubricIssues into planIssues (planning)

**Status:** In progress. Next step is Phase P0 (`contract framing`) to define the first-pass `planIssues` schema and stage ownership.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

Track a task-scoped refactor to replace narrow hop-handoff `rubricIssues` usage with a broader `planIssues` concept that can support both immediate rubric judgment and later-hop remediation/deconfliction work.

This plan intentionally starts high-level. Contract and prompt details are expected to evolve during implementation and tuning, with this document updated as decisions harden.

This file is task-scoped and should be archived or removed when this refactor is complete and durable guidance has been moved to package docs.

## Scope and boundaries

### In scope

- Define a first-pass `planIssues` concept and naming strategy for hypothesis pipeline handoff(s).
- Thread `planIssues` through the relevant hypothesis pipeline seams where `rubricIssues` is currently used.
- Clarify handling intent for issue classes:
  - issues that must influence in-place rubric/winner judgment;
  - issues that are candidate for downstream cleanup/remediation.
- Update prompt contracts, parser contracts, and harness fixtures as needed for the new handoff shape.
- Preserve current stub/abort safety semantics unless an explicit phase decision changes them.
- Document where durable issue semantics should live after this task plan closes.

### Out of scope (initial pass)

- Full redesign of all Coyote quality/tuning rubrics beyond what is required to support `planIssues`.
- Cross-product or UI behavior changes outside `lambda/ephemera` Coyote generation paths.
- Broad telemetry/reporting platform work unless needed for minimal verification of this refactor.
- Final taxonomy lock for every issue subtype (can begin with a pragmatic first-pass schema).

## Success criteria (first pass)

- `rubricIssues` is replaced by `planIssues` in active hypothesis handoff contracts.
- Handoff parser and pipeline orchestration continue to fail safely on malformed required fields.
- Prompts clearly distinguish "judge now" vs "resolve later" expectations for issue handling.
- Harness fixtures and key pipeline tests reflect the new contract and pass.
- Durable docs capture settled semantics for future tuning work; this task plan remains process-only.

## Working method

For each phase:

1. Lock minimal contract decisions needed before code/prompt edits.
2. Apply one bounded set of prompt/parser/orchestration updates.
3. Re-run focused tests and harness checks.
4. Capture open questions and either resolve in-slice or explicitly defer.
5. Update this checklist and implementation notes before moving to the next phase.

## Getting started

1. Skim task-plan conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read Coyote package architecture and pipeline boundaries: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md).
3. Read current hypothesis pipeline docs: [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/AGENT.md).
4. Read current tuning context and active priorities: [`taskPlanning/lambda/ephemera/dataSource/coyoteGame/AGENT.tuneLLMPipeline.planning.md`](AGENT.tuneLLMPipeline.planning.md).
5. Read testing authority for lambda package commands: [`lambda/ephemera/AGENT.testing.md`](../../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict elsewhere, follow this file.
6. Confirm current handoff touchpoints:
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.ts)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.ts)
   - [`lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.ts`](../../../../../../lambda/ephemera/dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.ts)
7. Run one baseline verification command before edits (from `lambda/ephemera/`):
   - `npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.test.ts`

## PlanIssues v1 framing (recommended)

First-pass contract should move from `rubricIssues: string[]` to structured `planIssues` entries that preserve both issue type and handling intent.

### Why v1 is structured (not string-only rename)

- Simple rename (`rubricIssues` -> `planIssues`) improves naming, but does not encode how different issue kinds should influence selection vs later cleanup.
- Structured entries allow plan-select and phase-plan to apply different logic without relying on fragile free-text parsing.
- Keep v1 bounded: add only the fields needed for category-aware behavior and stable parser validation.

### V1 categories

- `intent_signal`: issue indicates likely candidate misread of player intent and should count against that candidate during selection.
- `underspecification`: issue indicates missing/conflicting details that phase-plan deconfliction should resolve; not an automatic selection penalty.

In v1, category should be derived deterministically from `code` in application logic, not emitted by the model.

### V1 issue codes (allowlist)

Intent-signal codes:

- `OUTLIER_PROP_UNACCOUNTED`
- `TROPE_FUNCTION_MISMATCH`
- `STRUCTURAL_CONTRADICTION`

Underspecification codes:

- `DIRECTION_AMBIGUOUS`
- `ROLE_CONFLICT`

Not an issue code in v1:

- `DIRECTION_AGNOSTIC` (resolved state, not a defect)

### V1 handoff shape (provisional)

```ts
type PlanIssueIntentSignalCode =
  | 'OUTLIER_PROP_UNACCOUNTED'
  | 'TROPE_FUNCTION_MISMATCH'
  | 'STRUCTURAL_CONTRADICTION'

type PlanIssueUnderspecificationCode =
  | 'DIRECTION_AMBIGUOUS'
  | 'ROLE_CONFLICT'

type PlanIssueCode = PlanIssueIntentSignalCode | PlanIssueUnderspecificationCode

type PlanIssue = {
  code: PlanIssueCode
  summary: string
  evidence?: string[]
}
```

### V1 validation policy

- Require `code` and `summary` for every `planIssues` entry.
- Derive classification from `code` in deterministic helper logic (for example `isIntentSignalPlanIssueCode` / `isUnderspecificationPlanIssueCode`), not from model output.
- Reject unknown `code` values via parser allowlist validation.
- Keep `evidence` optional in v1; revisit required-evidence policy after prompt-engineering signal quality is evaluated.
- Permit extra keys in v1 handoff JSON only if required keys remain present and well-typed.

### V1 stage behavior

- Plan-select:
  - Include all relevant issues in `planIssues`.
  - Use `PlanIssueIntentSignalCode` matches as negative winner/rubric evidence.
  - Treat `PlanIssueUnderspecificationCode` matches as deconfliction obligations, not automatic disqualifiers.
- Phase-plan:
  - Treat `planIssues` as authoritative grounding constraints.
  - Resolve all `planIssues` entries in deconfliction/scene logic, including both `PlanIssueUnderspecificationCode` and `PlanIssueIntentSignalCode` cases that pass through selection.
  - Do not require upstream phases to pre-plan remediation steps in the handoff payload.
  - Escalate unresolved `PlanIssueIntentSignalCode` issues only when they block coherent execution of the selected candidate.
  - Do not persist `planIssues` durably beyond phase-plan handling in this slice.

## Open questions (to resolve early)

- How should phase-plan attempt repair for each `PlanIssueIntentSignalCode` / `PlanIssueUnderspecificationCode` while preserving selected-candidate fidelity?
- What thresholds should trigger future tightening (for example requiring `evidence` on selected codes)?
- Should any additional issue codes be added after first-pass implementation and tuning feedback?

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [ ] Phase P0 - lock first-pass `planIssues` contract framing
  - [ ] Confirm v1 code unions (`PlanIssueIntentSignalCode` / `PlanIssueUnderspecificationCode`) and allowlist membership.
  - [ ] Confirm minimum required fields and first-pass strictness policy.
  - [ ] Confirm prompt-level semantics for selection penalty vs deconfliction obligation.
  - [ ] Lock no-durable-persistence policy for `planIssues` beyond phase-plan handling.
  - [ ] Record unresolved taxonomy/typing questions as explicit deferred work.

- [ ] Phase P1 - rename/refocus baseline migration (`rubricIssues` -> `planIssues`)
  - [ ] Replace handoff key names and prompt copy from rubric-specific language to plan-level language.
  - [ ] Keep behavior otherwise equivalent to current flow to minimize migration risk.
  - [ ] Update tests/fixtures for key rename and wording changes.

- [ ] Phase P2 - structured `planIssues` contract and parser hardening
  - [ ] Replace `planIssues: string[]` shape with structured issue objects.
  - [ ] Implement parser validation for required fields and code-union membership.
  - [ ] Update parser failure messages for malformed issue rows.
  - [ ] Preserve current abort/stub behavior for malformed handoff payloads unless explicitly changed.
  - [ ] Refresh unit tests around happy path and malformed payload handling.

- [ ] Phase P3 - align plan-selection and phase-plan prompt contracts
  - [ ] Update plan-selection prompt instructions to emit structured `planIssues` with v1 category semantics.
  - [ ] Update phase-plan grounding block copy to consume structured `planIssues` semantics clearly.
  - [ ] Keep copy constraints aligned with Coyote perspective and existing ordering guardrails.
  - [ ] Re-run prompt-part unit tests and adjust fixtures as needed.

- [ ] Phase P4 - harness and fixture migration
  - [ ] Migrate harness inject fixtures and any golden handoff snapshots to structured `planIssues`.
  - [ ] Update harness assertions and output expectations.
  - [ ] Remove backward-compatibility dual-shape handling once fixture migration is complete (no compatibility window required).
  - [ ] Confirm partial-run (`runOnly` / `runUntil`) paths remain valid with migrated handoff data.

- [ ] Phase P5 - evaluation, cleanup, and closeout
  - [ ] Run focused hypothesis pipeline and harness regressions.
  - [ ] Capture follow-up complications discovered during implementation as either in-slice fixes or explicit deferrals.
  - [ ] Move durable semantics to package docs (`AGENT.md`/pipeline docs) as appropriate.
  - [ ] Update this plan checkboxes and archive/remove this file when the initiative is complete.

## Verification

Run from `lambda/ephemera/` unless noted otherwise.

Baseline:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHop1Handoff.test.ts
```

Focused hypothesis pipeline checks:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPlanSelectionPromptParts.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/buildHypothesisPhasePlanHopPromptParts.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/coyoteHypothesisPipeline.test.ts
npm run test -- --watchAll=false dataSource/coyoteGame/generators/pipelines/hypothesis/generateHypothesis.test.ts
```

Harness regression:

```bash
npm run test -- --watchAll=false dataSource/coyoteGame/generators/testHarness/runCoyoteEngineTestHarness.test.ts
```

## Progress

| Milestone | Status |
| --- | --- |
| Plan drafted | Done |
| Contract framing locked (`planIssues` v1) | Not started |
| Rename/refocus baseline migration complete | Not started |
| Structured handoff/parser migration complete | Not started |
| Prompt alignment complete | Not started |
| Harness/fixture migration complete | Not started |
| Regression pass complete | Not started |
| Durable docs updated and plan archived | Not started |
