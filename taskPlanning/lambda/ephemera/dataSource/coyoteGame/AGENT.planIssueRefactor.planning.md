# Coyote Game: refactor rubricIssues into planIssues (planning)

**Status:** In progress. Next step is Phase P2 (structured `planIssues` contract and parser hardening).

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

## Deferred after P0 contract framing

- **P2 follow-up:** Decide whether parser strictness should evolve from "allow extra keys" to explicit key allowlists per `planIssues` row after real handoff quality is measured.
- **P3/P4 follow-up:** Define per-code remediation guidance text for phase-plan prompt copy so deconfliction obligations are specific without overfitting to current fixture language.
- **P5 follow-up:** Re-evaluate whether `evidence` should become required for selected codes once tuning establishes stable signal quality thresholds.
- **P5+ follow-up:** Consider controlled expansion of `PlanIssueCode` taxonomy only when new classes show repeatable value across fixtures and regressions.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as each sub-step lands.

- [X] Phase P0 - lock first-pass `planIssues` contract framing
  - [X] Confirm v1 code unions (`PlanIssueIntentSignalCode` / `PlanIssueUnderspecificationCode`) and allowlist membership.
  - [X] Confirm minimum required fields and first-pass strictness policy.
  - [X] Confirm prompt-level semantics for selection penalty vs deconfliction obligation.
  - [X] Lock no-durable-persistence policy for `planIssues` beyond phase-plan handling.
  - [X] Record unresolved taxonomy/typing questions as explicit deferred work.
  - Locked implementation notes:
    - Hop-1 handoff contract authority remains centered on `coyoteHop1Handoff.ts`, with prompt semantics anchored in `buildHypothesisPlanSelectionPromptParts.ts` and `buildHypothesisPhasePlanHopPromptParts.ts`.
    - P0 locks the v1 code allowlist exactly as documented above: intent-signal (`OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`, `STRUCTURAL_CONTRADICTION`) and underspecification (`DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`); `DIRECTION_AGNOSTIC` remains excluded.
    - P0 locks required row fields to `code` and `summary`, keeps `evidence` optional, and keeps first-pass strictness as required-field/type plus unknown-code rejection while tolerating extra keys when required fields are valid.
    - Prompt-level semantics are locked: intent-signal issues count as negative winner evidence in plan-select, while underspecification issues are deconfliction obligations; phase-plan consumes all `planIssues` as grounding constraints.
    - No durable persistence of `planIssues` is permitted beyond phase-plan handling in this slice; persistence/telemetry expansion remains out of scope unless needed for safety.

- [X] Phase P1 - rename/refocus baseline migration (`rubricIssues` -> `planIssues`)
  - [X] Replace handoff key names and prompt copy from rubric-specific language to plan-level language.
  - [X] Keep behavior otherwise equivalent to current flow to minimize migration risk.
  - [X] Update tests/fixtures for key rename and wording changes.
  - Locked implementation notes:
    - Hop-1 handoff JSON key and `CoyoteHop1Handoff` field renamed from `rubricIssues` to `planIssues`; value remains `string[]`; parser required keys, section-heading checks, and extra-key tolerance unchanged from pre-P1 behavior.
    - Phase-plan grounding block label renamed from `**Intent-confidence gaps:**` to `**Plan issues:**`; plan-selection Markdown section headings (`## Intent conflicts`, `## Rubric comparison`, `## Winner selection`) unchanged in this slice (deferred to P3 prompt alignment).
    - Debug log field for successful parse counts renamed from `rubricIssueCount` to `planIssueCount`.
    - Harness fixture `FIXTURE_01_PHASE_PLAN_HANDOFF` and all colocated unit tests updated to the new key and label; no backward-compat dual-read of `rubricIssues`.

- [X] Phase P2 - structured `planIssues` contract and parser hardening
  - [X] Replace `planIssues: string[]` shape with structured issue objects.
  - [X] Implement parser validation for required fields and code-union membership.
  - [X] Update parser failure messages for malformed issue rows.
  - [X] Preserve current abort/stub behavior for malformed handoff payloads unless explicitly changed.
  - [X] Refresh unit tests around happy path and malformed payload handling.
  - Locked implementation notes:
    - `CoyoteHop1Handoff.planIssues` now carries structured rows (`code`, `summary`, optional `evidence`) with exported v1 code unions and deterministic code-classification helpers; parser validation enforces required fields and code allowlist membership while continuing to tolerate extra keys when required fields are valid.
    - Parser failure reasons are now row-scoped (`planIssues[index] ...`) for malformed rows (non-object row, missing/invalid `code`, unknown code, missing/invalid `summary`, invalid `evidence`), improving malformed-payload diagnostics without widening parser surface.
    - Abort/stub behavior is unchanged: malformed handoff payloads still fail parse and trigger existing pipeline abort-to-stub semantics in orchestration.
    - Plan-selection prompt handoff contract now instructs structured `planIssues` rows with v1 code allowlist, and phase-plan grounding renders plan issues as `[CODE] summary` bullets with optional evidence lines.
    - Fixtures and focused tests were migrated to the structured shape across hypothesis pipeline and harness paths (`coyoteHop1Handoff`, prompt-part tests, `coyoteHypothesisPipeline`, `generateHypothesis`, harness fixture + runner tests).

- [X] Phase P3 - align plan-selection and phase-plan prompt contracts
  - [X] Update plan-selection prompt instructions to emit structured `planIssues` with v1 category semantics.
  - [X] Update phase-plan grounding block copy to consume structured `planIssues` semantics clearly.
  - [X] Keep copy constraints aligned with Coyote perspective and existing ordering guardrails.
  - [X] Re-run prompt-part unit tests and adjust fixtures as needed.
  - Locked implementation notes:
    - Plan-selection handoff instructions now explicitly encode v1 code-class semantics without expanding required handoff shape: intent-signal codes (`OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`, `STRUCTURAL_CONTRADICTION`) count as negative winner evidence, while underspecification codes (`DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`) are downstream deconfliction obligations rather than automatic disqualifiers.
    - Phase-plan grounding copy now treats chosen summary plus `planIssues` as authoritative constraints, with explicit handling guidance for intent-signal risk resolution/escalation versus mandatory underspecification deconfliction.
    - Prompt-level Coyote perspective and ordering guardrails were preserved; no section-heading/order contract changes were introduced for hop-1 parsing.
    - Focused prompt-part tests were updated to assert the new wording semantics and pass under direct Jest config invocation (`buildHypothesisPlanSelectionPromptParts.test.ts`, `buildHypothesisPhasePlanHopPromptParts.test.ts`).

- [X] Phase P4 - harness and fixture migration
  - [X] Migrate harness inject fixtures and any golden handoff snapshots to structured `planIssues`.
  - [X] Update harness assertions and output expectations.
  - [X] Remove backward-compatibility dual-shape handling once fixture migration is complete (no compatibility window required).
  - [X] Confirm partial-run (`runOnly` / `runUntil`) paths remain valid with migrated handoff data.
  - Locked implementation notes:
    - Harness fixtures now include structured hop-1 golden handoff snapshots keyed by fixture id (`HOP1_HANDOFF_GOLDEN_BY_FIXTURE_ID`), and `phasePlanInject` is auto-populated from `planSelectInject` plus structured `hop1Handoff` when available.
    - Harness regression coverage now explicitly locks successful `runOnly planSelect` and `runOnly phasePlan` inject flows, including structured `hop1Handoff.planIssues` rows in injected phase-plan state.
    - No dual-shape fallback remains in harness-facing plan-issue handling for this slice; fixture/test paths now exercise only structured `planIssues` rows (`code`, `summary`, optional `evidence`).
    - Partial-run validation remains intact across `runUntil` and `runOnly` paths under focused hypothesis/harness regression runs (`runCoyoteEngineTestHarness.test.ts`, `generateHypothesis.test.ts`, `coyoteHypothesisPipeline.test.ts`).

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
| Contract framing locked (`planIssues` v1) | Done |
| Rename/refocus baseline migration complete | Done |
| Structured handoff/parser migration complete | Done |
| Prompt alignment complete | Done |
| Harness/fixture migration complete | Done |
| Regression pass complete | Not started |
| Durable docs updated and plan archived | Not started |
