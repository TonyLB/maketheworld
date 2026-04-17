# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`.

**Subscribes to**

- **`mtw.ephemera.objects`** **`Objects Changed`** ([`../objects/events.ts`](../objects/events.ts)).
- **`mtw.ephemera.actions`** **`Await RoadRunner`** (same envelope guard as [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) **`isEphemeraActionsAwaitRoadRunnerEnvelope`**).

## Objects Changed (hypothesis path)

When the event adds at least one object (`add.length > 0`) and the room is a Coyote Game demo room ([`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts); ids via [`RoomKey`](../../../../packages/mtw-utilities/ts/types.ts)), the handler:

1. Queues the placeholder **`WorldMessage`** (`Hypothesis: Generating...`) on **`hypothesisLane:${messageId}`** (see [`messageBus/AGENT.md`](../../messageBus/AGENT.md) **Virtual lanes**).
2. Runs **`Promise.all([messageBus.flush(hypothesisLane), remainder])`**: **`remainder`** invalidates and loads **`internalCache.CoyoteGame.get('intent')`**, which returns a **`CoyoteGameIntentRecord`**: **`intent`** (single **`Hypothesis:`** line) and optional **`sceneAnalysis`** (model scaffolding). Hypothesis text is produced by **`generateHypothesis`** ([`generateHypothesis.ts`](generateHypothesis.ts)): **two** Bedrock round-trips ([`invokeBedrockHypothesisStageOne`](invokeBedrockHypothesis.ts) → [`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts) → [`invokeBedrockHypothesisStageTwo`](invokeBedrockHypothesis.ts)), then [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts) on the stage-2 body. Any stage failure or invalid stage-1 seam yields **`Hypothesis: Stubbed`** only (no partial intent). The terminal **`WorldMessage`** **`RenderTree`** is **`[sceneAnalysis, br, intent]`** when analysis is present, else **`[intent]`** ([`coyoteRenderTree`](coyoteRenderTree.ts) **`br`**).

**Stream / bus:** **`remainder`** emits hypothesis **`streamEvent`** payloads ([`publishedEvents.ts`](publishedEvents.ts)) with that **`RenderTree`**.

Targets: **active** occupants of that room. Stream **`characterId`**: first active occupant.

## Await RoadRunner (plan outcome path)

On **`Await RoadRunner`** from actions, the handler targets **all active characters across all Coyote demo rooms** ([`collectActiveCharactersInCoyoteRooms`](collectActiveCharactersInCoyoteRooms.ts)), queues **`Outcome: Generating...`** on **`outcomeLane:${messageId}`**, then the same **`flush` + `remainder`** pattern with **`Plan Outcome Generation Started` / `Result`** stream events (**`streamKey`** = triggering **`characterId`** from the actions payload). The **`remainder`** path calls **`internalCache.CoyoteGame.invalidate('outcome')`** then **`internalCache.CoyoteGame.get('outcome')`**: the last outcome is stored durably (same pattern as **`intent`** on [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts)). The generator is [`generatePlanOutcome`](generatePlanOutcome.ts): a **single Bedrock call** (first draft) using [`buildPlanOutcomePrompt`](buildPlanOutcomePrompt.ts) over staged objects ([`loadCoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts)) plus the current hypothesis line (**`intent`** from **`CoyoteGame.get('intent')`**, wired in [`internalCache`](../../internalCache/index.ts) as the string only). Prompt rules require the Road Runner to remain safe and the setback to land on the Coyote where possible; multi-stage refinement is future work.

**Product / demo context:** [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

## Bedrock prompt caching

[`invokeBedrockHypothesis`](invokeBedrockHypothesis.ts) sends a single user message as `text` (static instructions), [`cachePoint`](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html), then `text` (dynamic tail).

**Hypothesis (two rounds):** [`buildHypothesisStageOnePromptParts`](buildHypothesisStageOnePrompt.ts) and [`buildHypothesisStageTwoPromptParts`](buildHypothesisStageTwoPrompt.ts) each split invariant vs dynamic tails. Shared geography lives in [`coyoteHypothesisPromptShared.ts`](coyoteHypothesisPromptShared.ts); both stages include a dynamic **`## Seam room labels`** block mapping canonical **`ROOM#…`** ids to **short seam labels** (prefix stripped for now); stage 1 dynamic = that mapping + staged-object snapshot; stage 2 dynamic = mapping + validated **seam Markdown** + snapshot. Stage-1 seam output uses short labels (optional `ROOM#` on headings/members is normalized when parsing). [`invokeBedrockHypothesisStageOne`](invokeBedrockHypothesis.ts) / [`invokeBedrockHypothesisStageTwo`](invokeBedrockHypothesis.ts) apply stage **`maxTokens`**.

**Plan outcome:** [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts).

**Legacy single-call hypothesis prompt:** [`buildHypothesisPromptParts`](buildHypothesisPrompt.ts) is kept for regression comparison; production uses the two-stage builders.

## Engine testing harness (dev)

**Purpose:** A **repeatable, non-production** path to run the same **hypothesis** Bedrock stack as live play (same model, prompt cache layout, and parse rules) against **ten fixed staged-object snapshots**, and return **one `WorldOOCMessage` per fixture** so you can compare quality and cost after prompt or model changes. The harness does **not** require real `Meta::Room` state for those rooms, and it does **not** read or write [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts) intent/outcome in Dynamo.

**Pipeline (mirrors production, not `CacheCoyoteGameData`):** For each fixture, [`runCoyoteEngineTestHarness`](runCoyoteEngineTestHarness.ts) calls [`generateHypothesisWithStageResults`](generateHypothesis.ts) with **`roomObjectsByRoomOverride`** (normalized fixture map) and dummy **`getGameRooms`** / **`getRoomMeta`**. Each fixture performs **two** Bedrock hypothesis calls plus parsing; published text includes **`usageStage1`**, raw **`stageOneBody`** (stage-1 model output for seam diagnosis), **`usageStage2`**, and combined **`elapsedMs`**. Tests may inject **`generateHypothesisPipelineImpl`**.

**Activation:** Commands go through [`parseCommand`](../actions/parseCommand.ts). The classifier prompt ([`buildParseCommandIntentClassificationPrompt`](../actions/buildParseCommandIntentClassificationPrompt.ts)) and validator ([`parseCommandIntentClassification`](../actions/parseCommandIntentClassification.ts)) can yield **`CoyoteEngineTest`** ([`ParseCommandResult`](../actions/baseClasses.ts)). [`actions/index.ts`](../actions/index.ts) runs [`runCoyoteEngineTestHarness`](runCoyoteEngineTestHarness.ts) only when **`COYOTE_ENGINE_TEST_HARNESS_ENABLED`** is **`true`** (constant at top of that file); otherwise it replies that the harness is disabled. Uses the unified LLM parse pipeline (no string-prefix gate).

**Runner behavior:** **Hypothesis only** for this harness (plan-outcome harness is future work). **`testBatchSize`** defaults to **`1`** (sequential fixture runs; each fixture is **two** Bedrock calls); higher values run multiple worker loops in parallel (tradeoff: throttling vs latency). **Continue-on-error:** a failed fixture still gets a published line and the batch continues. Each message includes **`n/total`**, fixture **`id`**, optional scene analysis, **`Hypothesis:`** line, **`elapsedMs`**, **`usageStage1:`**, **`stageOneBody:`**, **`usageStage2:`** (or **`(skipped)`** / usage none as before).

**Fixtures:** Canonical data is [`coyoteEngineTestFixtures.ts`](coyoteEngineTestFixtures.ts) (`COYOTE_ENGINE_TEST_FIXTURES`, optional **`hypothesisLine`** reserved for a future outcome harness). Room keys use **`ROOM#${roomKey}`**; when serializing prompts, room order matches [`defaultCoyoteGameData.gameRooms`](../../internalCache/coyoteGame.ts) (`VORTEX`, `STRAIGHTAWAY`, …), same as live **`getGameRooms()`** behavior.

**Authoring names to engine rooms**

| Authoring phrase | `roomKey` | `EphemeraRoomId` |
| --- | --- | --- |
| Base of Cliff | `VORTEX` | `ROOM#VORTEX` |
| Top of Cliff | `CLIFFTOP` | `ROOM#CLIFFTOP` |
| Straightaway | `STRAIGHTAWAY` | `ROOM#STRAIGHTAWAY` |
| Corner | `CORNER` | `ROOM#CORNER` |
| Bridge | `BRIDGE` | `ROOM#BRIDGE` |

**Operational:** Ten fixtures × **two** hypothesis Bedrock calls per fixture by default (**twenty** Converse invocations per full harness run). Budget Lambda time accordingly (raise ephemera Lambda timeout if needed; raise **`testBatchSize`** cautiously).

**Related:** [`generatePlanOutcome`](generatePlanOutcome.ts) supports **`roomObjectsByRoomOverride`** and **`hypothesisLineOverride`** for future harness work. Product context: [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

**Manual check:** Toggle the harness flag if needed, send a line classified as **`CoyoteEngineTest`**, expect **ten** labeled replies; normal play paths should still persist Coyote intent/outcome only through the usual cache flows.

**Verification:** `cd lambda/ephemera && npx jest dataSource/coyoteGame/ dataSource/actions/`
