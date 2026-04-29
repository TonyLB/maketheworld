# Coyote hypothesis pipeline

This folder owns the multi-hop hypothesis generation flow for `mtw.ephemera.coyoteGame`.

Parent docs:

- Package overview: [`../../../AGENT.md`](../../../AGENT.md)
- LLM pipeline framework: [`../../../../../llm/pipeline/AGENT.md`](../../../../../llm/pipeline/AGENT.md)

## Scope

The hypothesis pipeline is the production path for `Objects Changed` events in Coyote rooms:

1. Stage one seam generation from staged room objects.
2. Plan-selection hop over combined clusters.
3. Phase-plan hop that returns `Hypothesis:` and optional structured plan/walkthrough.

This folder contains pipeline-local prompts, orchestration, parsing, and Bedrock wrappers for that flow.

## Key files

- [`generateHypothesis.ts`](generateHypothesis.ts): entrypoint used by production and harness code.
- [`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts): ordered orchestration over the linear runner.
- [`invokeBedrockHypothesis.ts`](invokeBedrockHypothesis.ts): stage-specific Bedrock invoke wrappers and token limits.
- [`buildHypothesisStageOnePrompt.ts`](buildHypothesisStageOnePrompt.ts): stage-one prompt parts.
- [`buildHypothesisPlanSelectionPromptParts.ts`](buildHypothesisPlanSelectionPromptParts.ts): plan-selection prompt builder.
- [`buildHypothesisPhasePlanHopPromptParts.ts`](buildHypothesisPhasePlanHopPromptParts.ts): phase-plan prompt builder.
- [`parseHypothesisStageOneOutput.ts`](parseHypothesisStageOneOutput.ts): stage-one seam parsing and validation.
- [`coyoteHop1Handoff.ts`](coyoteHop1Handoff.ts): extracts hop-1 handoff contract.
- [`combineHypothesisClusters.ts`](combineHypothesisClusters.ts): combine and render cluster output for later hops.

## Contracts and boundaries

- Terminal parse of model output into cache-facing intent fields is shared and lives in [`../../sharedParsers/parseHypothesisModelOutput.ts`](../../sharedParsers/parseHypothesisModelOutput.ts), not in this folder.
- Cross-cutting staged-object helpers and render-tree constants are under [`../../../utilities/`](../../../utilities/).
- Harness code lives under [`../../testHarness/`](../../testHarness/) and imports this pipeline rather than duplicating it.

## Hop-1 handoff (`planIssues`) contract

Authority for plan-selection to phase-plan handoff shape is [`coyoteHop1Handoff.ts`](coyoteHop1Handoff.ts).

- Required JSON keys are `paragraphSummary` and `planIssues`.
- `planIssues` rows are structured objects with required `code` and `summary`, plus optional `evidence: string[]`.
- Allowed `code` values are:
  - Intent-signal: `OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`, `STRUCTURAL_CONTRADICTION`
  - Underspecification: `DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`
- Classification is deterministic in application logic (`isIntentSignalPlanIssueCode`, `isUnderspecificationPlanIssueCode`), not model-emitted.

Parser safety posture:

- Reject unknown codes and malformed rows with row-scoped reasons (`planIssues[index] ...`).
- Require well-typed `paragraphSummary`, `planIssues`, `code`, and `summary`.
- Keep extra keys tolerant in v1 as long as required keys remain present and valid.

Stage responsibilities:

- Plan-selection emits all relevant `planIssues`; intent-signal rows count as negative winner evidence.
- Underspecification rows are deconfliction obligations, not automatic disqualifiers.
- Phase-plan treats chosen summary and all `planIssues` as authoritative constraints and resolves or escalates accordingly.

## Tests

- Unit tests are colocated as `*.test.ts` in this folder.
- Harness-focused tests remain under [`../../testHarness/`](../../testHarness/).
