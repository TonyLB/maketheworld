# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`.

This package handles Coyote gameplay synthesis after object updates and explicit "Await RoadRunner" actions.

## Subscribes to

- `mtw.ephemera.objects` `Objects Changed` ([`../objects/events.ts`](../objects/events.ts))
- `mtw.ephemera.actions` `Await RoadRunner` ([`../actions/publishedEvents.ts`](../actions/publishedEvents.ts))

## Layout and key files

| Area | Path | Purpose |
| --- | --- | --- |
| DataSource entry | [`index.ts`](index.ts) | Event dispatch into the two ingress handlers |
| Handlers | [`handlers/`](handlers/) | Ingress behavior for hypothesis and outcome paths |
| Utilities | [`utilities/`](utilities/) | Snapshot loaders, room guards, render helpers, shared non-LLM helpers |
| Hypothesis pipeline | [`generators/pipelines/hypothesis/`](generators/pipelines/hypothesis/) | Multi-hop hypothesis generation pipeline |
| Outcome pipeline | [`generators/pipelines/outcome/`](generators/pipelines/outcome/) | Single-call outcome generation pipeline |
| Shared parsers | [`generators/sharedParsers/`](generators/sharedParsers/) | Cross-pipeline parser contracts (for example terminal hypothesis parse) |
| Test harness | [`generators/testHarness/`](generators/testHarness/) | Non-production Coyote engine harness and fixtures |
| Published payloads | [`publishedEvents.ts`](publishedEvents.ts) | Stream payload contracts |
| Subscribed envelope guard | [`subscribedEvents.ts`](subscribedEvents.ts) | Ingress envelope contract |

Pipeline-local docs:

- Hypothesis: [`generators/pipelines/hypothesis/AGENT.md`](generators/pipelines/hypothesis/AGENT.md)
- Outcome: [`generators/pipelines/outcome/AGENT.md`](generators/pipelines/outcome/AGENT.md)

## Objects Changed (hypothesis path)

[`handlers/handleObjectsChangedForHypothesis.ts`](handlers/handleObjectsChangedForHypothesis.ts):

1. Accepts only object-add events in Coyote demo rooms.
2. Sends placeholder `CoyoteGameHypothesisMessage` on `hypothesisLane:${messageId}`.
3. Flushes lane while remainder invalidates and reloads `internalCache.CoyoteGame.get('intent')`.
4. Publishes final hypothesis render tree and stream event payload.

Hypothesis generation chain:

- Entry: [`generators/pipelines/hypothesis/generateHypothesis.ts`](generators/pipelines/hypothesis/generateHypothesis.ts)
- Orchestration: [`generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts`](generators/pipelines/hypothesis/coyoteHypothesisPipeline.ts)
- Terminal shared parse: [`generators/sharedParsers/parseHypothesisModelOutput.ts`](generators/sharedParsers/parseHypothesisModelOutput.ts)

## Await RoadRunner (outcome path)

[`handlers/handleAwaitRoadRunnerForPlanOutcome.ts`](handlers/handleAwaitRoadRunnerForPlanOutcome.ts):

1. Targets active characters across all Coyote game rooms.
2. Sends `Outcome: Generating...` on `outcomeLane:${messageId}`.
3. Flushes lane while remainder invalidates and reloads `internalCache.CoyoteGame.get('outcome')`.
4. Publishes final world message and stream event payload.

Outcome generation chain:

- Entry: [`generators/pipelines/outcome/generatePlanOutcome.ts`](generators/pipelines/outcome/generatePlanOutcome.ts)
- Prompt builder: [`generators/pipelines/outcome/buildPlanOutcomePrompt.ts`](generators/pipelines/outcome/buildPlanOutcomePrompt.ts)
- Phase-plan formatter: [`generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts`](generators/pipelines/outcome/formatPhasePlanForOutcomePrompt.ts)

## Staged object snapshot and affinities

Snapshot and formatting helpers are centralized in [`utilities/coyoteRoomObjectSnapshot.ts`](utilities/coyoteRoomObjectSnapshot.ts), including:

- `loadCoyoteRoomObjectsByRoom`
- `formatCoyoteStagedObjectLine`
- `formatCoyoteStagedObjectsByRoom`

These are consumed by both hypothesis and outcome pipelines and by test harness paths.

## Engine testing harness (dev)

Harness code is under [`generators/testHarness/`](generators/testHarness/):

- Runner: [`generators/testHarness/runCoyoteEngineTestHarness.ts`](generators/testHarness/runCoyoteEngineTestHarness.ts)
- Fixtures: [`generators/testHarness/coyoteEngineTestFixtures.ts`](generators/testHarness/coyoteEngineTestFixtures.ts)

Activation path:

- Parse command slash route in `actions`: [`../actions/parseCommand.ts`](../actions/parseCommand.ts)
- Harness execution gate: [`../actions/index.ts`](../actions/index.ts)

## Verification

From `lambda/ephemera/`:

```bash
npx jest dataSource/coyoteGame/ dataSource/actions/
```

During focused iteration:

```bash
npx jest dataSource/coyoteGame/
```

## Related docs

- DataSource index: [`../AGENT.md`](../AGENT.md)
- LLM utilities and parser patterns: [`../../llm/AGENT.md`](../../llm/AGENT.md)
- LLM linear pipeline runner: [`../../llm/pipeline/AGENT.md`](../../llm/pipeline/AGENT.md)
- Product/demo context: [`../../../../AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md)
