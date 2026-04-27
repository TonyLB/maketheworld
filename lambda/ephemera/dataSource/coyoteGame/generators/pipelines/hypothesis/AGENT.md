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

## Tests

- Unit tests are colocated as `*.test.ts` in this folder.
- Harness-focused tests remain under [`../../testHarness/`](../../testHarness/).
