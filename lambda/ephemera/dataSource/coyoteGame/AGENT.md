# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`.

**Subscribes to**

- **`mtw.ephemera.objects`** **`Objects Changed`** ([`../objects/events.ts`](../objects/events.ts)).
- **`mtw.ephemera.actions`** **`Await RoadRunner`** (same envelope guard as [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) **`isEphemeraActionsAwaitRoadRunnerEnvelope`**).

## Objects Changed (hypothesis path)

When the event adds at least one object (`add.length > 0`) and the room is a Coyote Game demo room ([`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts); ids via [`RoomKey`](../../../../packages/mtw-utilities/ts/types.ts)), the handler:

1. Queues the placeholder **`WorldMessage`** (`Hypothesis: Generating...`) on **`hypothesisLane:${messageId}`** (see [`messageBus/AGENT.md`](../../messageBus/AGENT.md) **Virtual lanes**).
2. Runs **`Promise.all([messageBus.flush(hypothesisLane), remainder])`**: **`remainder`** invalidates and loads **`internalCache.CoyoteGame.get('intent')`**, which returns a **`CoyoteGameIntentRecord`**: **`intent`** (single **`Hypothesis:`** line) and optional **`sceneAnalysis`** (model scaffolding). Hypothesis text is produced by **`generateHypothesis`** ([`generateHypothesis.ts`](generateHypothesis.ts)): **two** Bedrock round-trips --- stage 1 ([`invokeBedrockHypothesisStageOne`](invokeBedrockHypothesis.ts) → [`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts) → [`combineHypothesisClusters`](combineHypothesisClusters.ts) / [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts)), then stage 2 ([`invokeBedrockHypothesisStageTwo`](invokeBedrockHypothesis.ts)) --- then [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts) on the stage-2 body. Any stage failure, invalid stage-1 seam, or combine failure yields **`Hypothesis: Stubbed`** only (no partial intent). The terminal **`WorldMessage`** **`RenderTree`** is **`[sceneAnalysis, br, intent]`** when analysis is present, else **`[intent]`** ([`coyoteRenderTree`](coyoteRenderTree.ts) **`br`**).

The ordered seam-through-plan-phase steps use the shared linear pipeline runner ([`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts)); see [`llm/pipeline/AGENT.md`](../../llm/pipeline/AGENT.md). **Future work:** hypothesis **plan-phase** may split into **additional LLM steps**; that is easier to evolve on the pipeline runner than with ad hoc sequencing.

**Stream / bus:** **`remainder`** emits hypothesis **`streamEvent`** payloads ([`publishedEvents.ts`](publishedEvents.ts)) with that **`RenderTree`**.

Targets: **active** occupants of that room. Stream **`characterId`**: first active occupant.

## Await RoadRunner (plan outcome path)

On **`Await RoadRunner`** from actions, the handler targets **all active characters across all Coyote demo rooms** ([`collectActiveCharactersInCoyoteRooms`](collectActiveCharactersInCoyoteRooms.ts)), queues **`Outcome: Generating...`** on **`outcomeLane:${messageId}`**, then the same **`flush` + `remainder`** pattern with **`Plan Outcome Generation Started` / `Result`** stream events (**`streamKey`** = triggering **`characterId`** from the actions payload). The **`remainder`** path calls **`internalCache.CoyoteGame.invalidate('outcome')`** then **`internalCache.CoyoteGame.get('outcome')`**: the last outcome is stored durably (same pattern as **`intent`** on [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts)). The generator is [`generatePlanOutcome`](generatePlanOutcome.ts): a **single Bedrock call** (first draft) using [`buildPlanOutcomePrompt`](buildPlanOutcomePrompt.ts) over staged objects ([`loadCoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts)) plus the current hypothesis line (**`intent`** from **`CoyoteGame.get('intent')`**, wired in [`internalCache`](../../internalCache/index.ts) as the string only). Prompt rules require the Road Runner to remain safe and the setback to land on the Coyote where possible; multi-stage refinement is future work.

**Product / demo context:** [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

## Staged objects snapshot (plan-role affinities)

**Loader:** [`loadCoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts) gathers **`EphemeraMetaRoomObject[]`** per Coyote game room from **`getRoomMeta`** / **`Meta::Room.objects`** (same read path production uses).

**`stableKey`:** Staged rows may include optional **`stableKey`** (e.g. after Acme delivery). Full wire and uniqueness rules: **[`../actions/AGENT.md`](../actions/AGENT.md)**. Coyote-wide uniqueness for Acme minted **`stableKey`** values is enforced in **`mtw.ephemera.actions`** before **`Acme Order`** publishes, using the same Coyote demo room roster as **[`CoyoteGame.gameRooms`](../../internalCache/coyoteGame.ts)**. The object record carries **`stableKey`** for stable machine references; hypothesis Stage One snapshot lines echo **`shortName`**, **`stableKey`**, and compact **plan-role** text via [`formatCoyoteStagedObjectLine`](coyoteRoomObjectSnapshot.ts).

**Prompt text:** [`formatCoyoteStagedObjectsByRoom`](coyoteRoomObjectSnapshot.ts) fills **`## Current staged objects by room`** for [`buildHypothesisStageOnePromptParts`](buildHypothesisStageOnePrompt.ts) and [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts). Stage Two hypothesis consumes **combined-only** Markdown from [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts) (not this raw snapshot block). Each staged object prints **`shortName`**, **`stableKey`**, plus compact lines for persisted **plan-role** possibilities (**`affinities`**: flat modification tags, structural roles, generative roles `prep` / `creation`, and **`aptness`** --- see [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). Flat modification tags are **`influence-road-runner`**, **`alter-road-runner`**, **`coyote-equipment`**, **`coyote-enhancement`**, **`setting-addition`**, **`connect-props`**, and **`enhance-prop`**. Use `prep` for before-beat setup (digging, rigging, assembly) and `creation` for in-beat generated effects. **`affinitiesFailed`** becomes the explicit suffix **`plan roles unavailable (enrich failed)`** so the model can separate enrich failure from legacy rows that never had affinity data.

**Types:** **`CoyoteRoomObjectsByRoom`** (**`Record<EphemeraRoomId, EphemeraMetaRoomObject[]>`**) threads through [`generateHypothesis`](generateHypothesis.ts), [`generatePlanOutcome`](generatePlanOutcome.ts), and **`roomObjectsByRoomOverride`** on harnesses. **[`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts)** validates the stage-1 seam against the staged-object multiset **and** structure (sections, bullets, affinity and cluster tokens, member refs, etc.); see that module and [`parseHypothesisStageOneOutput.test.ts`](parseHypothesisStageOneOutput.test.ts). Prompt wording that defines the emitted seam shape is in [`buildHypothesisStageOnePrompt`](buildHypothesisStageOnePrompt.ts).

## Bedrock prompt caching

[`invokeBedrockHypothesis`](invokeBedrockHypothesis.ts) sends a single user message as `text` (static instructions), [`cachePoint`](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html), then `text` (dynamic tail).

**Hypothesis (two rounds):** [`buildHypothesisStageOnePromptParts`](buildHypothesisStageOnePrompt.ts) and [`buildHypothesisStageTwoPromptParts`](buildHypothesisStageTwoPrompt.ts) each split invariant vs dynamic tails. Shared geography lives in [`coyoteHypothesisPromptShared.ts`](coyoteHypothesisPromptShared.ts); both stages include a dynamic **`## Seam room labels`** block mapping canonical **`ROOM#…`** ids to **short seam labels** (prefix stripped for now); stage 1 dynamic = that mapping + staged-object snapshot; stage 2 dynamic = that mapping + **combined clustering Markdown** (hydrated from seam + snapshot via [`combineHypothesisClusters`](combineHypothesisClusters.ts), no raw seam + snapshot replay). Stage-1 seam references objects by **`stableKey`**. [`invokeBedrockHypothesisStageOne`](invokeBedrockHypothesis.ts) / [`invokeBedrockHypothesisStageTwo`](invokeBedrockHypothesis.ts) apply stage **`maxTokens`**.

**Stage Two body contract:** [`invokeBedrockHypothesisStageTwo`](invokeBedrockHypothesis.ts) defaults **`extendedThinking`** to **`false`** (pass **`extendedThinking: true`** to experiment with Nova **`reasoningConfig`**; see [`invokeBedrockConverseText`](../../llm/invokeBedrockConverseText.ts) in [`llm/AGENT.md`](../../llm/AGENT.md)). Chain-of-reasoning lives in assistant **`body`**: **`## Scene analysis`** Markdown, then a **final** fenced block (language **`text`**) containing **only** the **`Hypothesis:`** line (see [`buildHypothesisStageTwoPrompt`](buildHypothesisStageTwoPrompt.ts)). [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts) prefers that **final-fence** shape; if absent, it falls back to a **legacy** parse (optional outer ``` wrap, then first **`Hypothesis:`** line). It still drops lines **before** **`## Scene analysis`** from stored **`sceneAnalysis`** when that heading appears. [`generateHypothesisWithStageResults`](generateHypothesis.ts) may include **`stageTwoReasoningContent`** when extended thinking is on and Bedrock returns **`reasoningContent`**; it is not persisted on **`CoyoteGame`** intent.

**Stage Two plan-phase prompt (invariant sections):** [`buildHypothesisStageTwoPrompt`](buildHypothesisStageTwoPrompt.ts) assembles fixed instruction blocks (for example combined clustering Markdown contract, interpretation rules, temporal ordering of **prep** vs **creation**, virtual scenery and prep-invented props tied to shared topology in [`coyoteHypothesisPromptShared.ts`](coyoteHypothesisPromptShared.ts), and scene analysis + fenced Hypothesis rules). Stage Two must still respect **## Combined clustering** membership and **## Outliers**; virtual scenery does not replace staged objects or merge outliers into clusters.

**Output token caps:** [`BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS`](invokeBedrockHypothesis.ts) (stage 1 seam) vs [`BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS`](invokeBedrockHypothesis.ts) (stage 2 **`body`**: scene analysis + fenced **`Hypothesis:`**). Tune these constants if the model truncates.

**Stage Two: pattern alignment, parsing rule, and tuning (steady state):**

- **Same family as `llm` fenced tails:** Stage Two follows the **Markdown reasoning prefix + fenced tail** pattern described in [`llm/AGENT.md`](../../llm/AGENT.md) for [`splitMarkdownReasoningAndJson`](../../llm/splitMarkdownReasoningAndJson.ts): here the tail is a **`Hypothesis:`** line inside a **`text`** fence, not JSON. A related **observable reasoning + structured tail** flow (Markdown + JSON) lives in Acme enrich: [`mergeAcmeOrderEnrich`](../actions/mergeAcmeOrderEnrich.ts) / [`parseCommand`](../actions/parseCommand.ts).
- **Parser rule:** [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts) prefers the **last** fenced block whose interior is **only** a single **`Hypothesis:`** line; the **prefix** before that fence is scene analysis (subject to the usual drop of lines before **`## Scene analysis`**). If no such fence qualifies, **legacy** behavior applies (optional outer wrap, then first **`Hypothesis:`** line).
- **Design choices:** A **fence** is required for a deterministic machine slice; a **heading-only** scratchpad without a fence was not chosen for that reason. An extra Bedrock round-trip dedicated to plan notes is **not** the default (only if a future change needs it).
- **Tuning and diagnostics:** [`generateHypothesisWithStageResults`](generateHypothesis.ts) **`stageTwoReasoningContent`** is set only when Bedrock returns **`reasoningContent`** (for example Stage Two called with **`extendedThinking: true`**). Use **`usageStage2`** from the [engine testing harness](#engine-testing-harness-dev) to compare token cost when changing prompts or models.

**Plan outcome consistency:** [`generatePlanOutcome`](generatePlanOutcome.ts) is a separate Bedrock path, but narrative rules for the cartoon beat should stay **aligned** with Stage Two hypothesis wording where both describe the same plan (topology, prep vs beat, roles) so players do not see contradictory framing between hypothesis and outcome.

**Hypothesis pipeline (steady state):** Stage 1 uses **world topology** + **staged-object snapshot** in its dynamic tail; stage 2 uses **world topology** + **combined clustering input** (not the stage-1 snapshot block). Round-trip 2 does not replay the stage-1 *instruction* preamble from round-trip 1. Both hypothesis invocations default to **[`BEDROCK_HYPOTHESIS_MODEL_ID`](invokeBedrockHypothesis.ts)**; the stage wrappers differ mainly by **`maxTokens`**. Changing the seam contract means updating [`buildHypothesisStageOnePrompt`](buildHypothesisStageOnePrompt.ts), [`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts) (and tests), [`combineHypothesisClusters`](combineHypothesisClusters.ts), and [`buildHypothesisStageTwoPrompt`](buildHypothesisStageTwoPrompt.ts) together --- there is no separate seam version field. The seam is not persisted on [`CoyoteGame`](../../internalCache/coyoteGame.ts) intent; inspect it via harness **`stageOneBody`**, unit tests, or local runs. If the model wraps stage-1 output in an outer Markdown fence, [`stripHypothesisStageOneFence`](parseHypothesisStageOneOutput.ts) strips it before validation.

### Clustering and combine (design)

Stage One answers **which staged objects belong in the same functional or thematic maneuver**. **Temporal ordering**, beat sequencing, explicit assembly phases, and inferred intermediates are **plan-phase** responsibilities (Stage Two hypothesis, [`generatePlanOutcome`](generatePlanOutcome.ts), later refinements), not clustering.

Per cluster member, the seam may include an optional **`intendedRole`**: a **structured echo** of **one** persisted **[`CoyoteAffinityPossibility`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** row already on that object (allowed vocabulary only; **`prep`** vs **`creation`** semantics match Acme enrich). When **`affinities`** are omitted or **`affinitiesFailed`**, omit **`intendedRole`** for that member --- no synthetic role token.

[`combineHypothesisClusters`](combineHypothesisClusters.ts) validates the parsed seam against [`CoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts) and builds **[`CombineClustersReturn`](../../../../packages/mtw-interfaces/ts/coyoteCombineClusters.ts)**; [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts) turns that into the Stage Two Markdown block. Staged objects listed under **`outliers`** are in **no** named cluster; Stage Two intake must treat them explicitly (do not silently fold them into a cluster).

**Timeouts:** [`EphemeraFunction`](../../../../template.yaml) sets **`Timeout: 60`** for the Lambda; each Bedrock hypothesis call uses [`BEDROCK_HYPOTHESIS_TIMEOUT_MS`](invokeBedrockHypothesis.ts) per invocation (production hypothesis path runs **two** sequential calls).

**Plan outcome:** [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts).

**Legacy single-call hypothesis prompt:** [`buildHypothesisPromptParts`](buildHypothesisPrompt.ts) is kept for regression comparison; production uses the two-stage builders.

## Engine testing harness (dev)

**Purpose:** A **repeatable, non-production** path to run the same **hypothesis** Bedrock stack as live play (same model, prompt cache layout, and parse rules) against **ten fixed staged-object snapshots**, and return **one `WorldOOCMessage` per fixture** so you can compare quality and cost after prompt or model changes. The harness does **not** require real `Meta::Room` state for those rooms, and it does **not** read or write [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts) intent/outcome in Dynamo.

**Pipeline (mirrors production, not `CacheCoyoteGameData`):** For each fixture, [`runCoyoteEngineTestHarness`](runCoyoteEngineTestHarness.ts) calls [`generateHypothesisWithStageResults`](generateHypothesis.ts) with **`roomObjectsByRoomOverride`** (normalized fixture map) and dummy **`getGameRooms`** / **`getRoomMeta`**. Each fixture performs **two** Bedrock hypothesis calls plus parsing; published text includes **`usageStage1`**, raw **`stageOneBody`** (stage-1 model output for seam diagnosis), **`usageStage2`**, and combined **`elapsedMs`**. Tests may inject **`generateHypothesisPipelineImpl`**.

**Activation:** Commands go through [`parseCommand`](../actions/parseCommand.ts). **`CoyoteEngineTest`** is returned **without Bedrock** when the trimmed command matches the slash prefix **`/test generation`** (optional whitespace then more text); see [`coyoteEngineTestSlashCommand`](../actions/coyoteEngineTestSlashCommand.ts). Step A classification does **not** emit **`CoyoteEngineTest`** from the LLM. [`actions/index.ts`](../actions/index.ts) runs [`runCoyoteEngineTestHarness`](runCoyoteEngineTestHarness.ts) only when **`COYOTE_ENGINE_TEST_HARNESS_ENABLED`** is **`true`** (constant at top of that file); otherwise it replies that the harness is disabled.

**Runner behavior:** **Hypothesis only** for this harness (plan-outcome harness is future work). **`testBatchSize`** defaults to **`1`** (sequential fixture runs; each fixture is **two** Bedrock calls); higher values run multiple worker loops in parallel (tradeoff: throttling vs latency). **Continue-on-error:** a failed fixture still gets a published line and the batch continues. Each message includes **`n/total`**, fixture **`id`**, optional scene analysis, **`Hypothesis:`** line, **`elapsedMs`**, **`usageStage1:`**, **`stageOneBody:`**, **`usageStage2:`** (or **`(skipped)`** / usage none as before).

**Fixtures:** Canonical data is [`coyoteEngineTestFixtures.ts`](coyoteEngineTestFixtures.ts) (`COYOTE_ENGINE_TEST_FIXTURES`, optional **`hypothesisLine`** reserved for a future outcome harness). Room keys use **`ROOM#${roomKey}`**; when serializing prompts, room order matches [`defaultCoyoteGameData.gameRooms`](../../internalCache/coyoteGame.ts) (`VORTEX`, `STRAIGHTAWAY`, …), same as live **`getGameRooms()`** behavior.

**Future (degraded snapshot coverage):** The stock fixtures are intended as a **golden path** for comparing prompts and cost. A later improvement is to add fixtures (or a separate test list) that include staged objects with **`affinitiesFailed: true`** or **omitted** **`affinities`** (legacy or pre-enrich) so Stage One, any post-seam **combine** step, and Stage Two are **explicitly** regression-tested when plan roles are missing or marked failed. Engine fixtures intentionally stayed golden-path-only when clustering shipped; degraded-snapshot coverage remains a separately scheduled hardening pass (see **[Clustering and combine (design)](#clustering-and-combine-design)** above for runtime tolerance expectations).

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

**Manual check:** Toggle the harness flag if needed, send **`/test generation`** (or with trailing words after a space), expect **ten** labeled replies; normal play paths should still persist Coyote intent/outcome only through the usual cache flows.

## Acme parse affinities harness (dev)

**Purpose:** Manual review of **Step A + Step B** (`parseCommand`) on the Coyote LLM handoff **Iteration 2** corpus: **ten** single-item orders, one Bedrock classification plus one enrich call per phrase.

**Activation:** [`parseCommand`](../actions/parseCommand.ts) returns **`CoyoteAffinitiesTest`** (no Bedrock) when the trimmed command matches **`/test affinities`** (optional whitespace then more text); see [`coyoteAffinitiesTestSlashCommand`](../actions/coyoteAffinitiesTestSlashCommand.ts). [`actions/index.ts`](../actions/index.ts) runs [`runAcmeOrderAffinitiesHarness`](../actions/runAcmeOrderAffinitiesHarness.ts) only when **`COYOTE_AFFINITIES_TEST_HARNESS_ENABLED`** is **`true`** (constant in that file; default **`false`**). Otherwise the player sees that the harness is disabled.

**Runner:** For each phrase in [`acmeOrderAffinitiesHarnessPhrases`](../actions/acmeOrderAffinitiesHarnessPhrases.ts), the harness calls **`parseCommand`** with **`command`** = **`order`** + that phrase, and publishes **one** consolidated **`WorldOOCMessage`** with numbered sections (`1/10` .. `10/10`), **`elapsedMs`**, and **`JSON.stringify`** of each **`ParseCommandResult`** (merged **`AcmeOrder`** including **`affinities`** when successful).

**Cost:** Ten phrases times **two** Converse calls each (**twenty** invocations per full run when enabled). Budget Lambda time accordingly (raise ephemera Lambda timeout if needed).

**Verification:** `cd lambda/ephemera && npx jest dataSource/coyoteGame/ dataSource/actions/`
