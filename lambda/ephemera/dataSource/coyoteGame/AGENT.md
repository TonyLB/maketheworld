# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`.

**Subscribes to**

- **`mtw.ephemera.objects`** **`Objects Changed`** ([`../objects/events.ts`](../objects/events.ts)).
- **`mtw.ephemera.actions`** **`Await RoadRunner`** (same envelope guard as [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) **`isEphemeraActionsAwaitRoadRunnerEnvelope`**).

## Objects Changed (hypothesis path)

When the event adds at least one object (`add.length > 0`) and the room is a Coyote Game demo room ([`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts); ids via [`RoomKey`](../../../../packages/mtw-utilities/ts/types.ts)), the handler:

1. Queues the placeholder **`CoyoteGameHypothesisMessage`** (`Hypothesis: Generating...`) on **`hypothesisLane:${messageId}`** (see [`messageBus/AGENT.md`](../../messageBus/AGENT.md) **Virtual lanes**).
2. Runs **`Promise.all([messageBus.flush(hypothesisLane), remainder])`**: **`remainder`** invalidates and loads **`internalCache.CoyoteGame.get('intent')`**, which returns a **`CoyoteGameIntentRecord`**: required **`intent`** (single **`Hypothesis:`** line); optional **`walkthrough`** (player-facing prose aligned to the plan, usually the hop-2 **`## Scene analysis`** body); optional nested **`phasePlan`** (validated structured plan, types in [`packages/mtw-interfaces/ts/coyotePhasePlan.ts`](../../../../packages/mtw-interfaces/ts/coyotePhasePlan.ts)). Legacy Dynamo rows may still store **`sceneAnalysis`**; on read it is mapped into **`walkthrough`** when **`walkthrough`** is absent ([`internalCache/coyoteGame.ts`](../../internalCache/coyoteGame.ts)).

Hypothesis generation is **`generateHypothesis`** ([`generateHypothesis.ts`](generateHypothesis.ts)) → **`runCoyoteHypothesisPipeline`** ([`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts)): **three** sequential Bedrock calls --- (1) **stage one** clustering seam ([`invokeBedrockHypothesisStageOne`](invokeBedrockHypothesis.ts) → [`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts) → [`combineHypothesisClusters`](combineHypothesisClusters.ts) / [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts)); (2) **plan-selection hop** (rubric, winner, fenced JSON handoff --- [`parseHop1HandoffFromSelectionBody`](coyoteHop1Handoff.ts)); (3) **phase-plan hop** (structured **`phasePlan`** JSON when valid, **`## Scene analysis`**, fenced **`Hypothesis:`** --- [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts)). Failure before or during hop 1 handoff parsing yields **`Hypothesis: Stubbed`** only (no partial intent). Hop-2 **phase-plan JSON validation failure** does **not** abort the pipeline when prose still yields a usable **`Hypothesis:`** line; the durable row may omit **`phasePlan`** while keeping **`intent`** and optional **`walkthrough`** ([`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts)).

The terminal **`CoyoteGameHypothesisMessage`** **`RenderTree`** is **`[walkthrough, br, intent]`** when **`walkthrough`** is present, else **`[intent]`** ([`handleObjectsChangedForHypothesis`](handleObjectsChangedForHypothesis.ts), [`coyoteRenderTree`](coyoteRenderTree.ts) **`br`**).

The ordered seam-through-plan-phase steps use the shared linear pipeline runner ([`coyoteHypothesisPipeline.ts`](coyoteHypothesisPipeline.ts)); see [`llm/pipeline/AGENT.md`](../../llm/pipeline/AGENT.md).

**Stream / bus:** **`remainder`** emits hypothesis **`streamEvent`** payloads ([`publishedEvents.ts`](publishedEvents.ts)) with that **`RenderTree`**. Compact hypothesis placeholder and terminal bus publishes both use **`DisplayProtocol: 'CoyoteGameHypothesisMessage'`** (not `WorldMessage`), so client routing can apply hypothesis-specific presentation while preserving world-line message fields (`Message`, optional `MessageId`, optional `CreatedTime`).

Targets: **active** occupants of that room. Stream **`characterId`**: first active occupant.

## Await RoadRunner (plan outcome path)

On **`Await RoadRunner`** from actions, the handler targets **all active characters across all Coyote demo rooms** ([`collectActiveCharactersInCoyoteRooms`](collectActiveCharactersInCoyoteRooms.ts)), queues **`Outcome: Generating...`** on **`outcomeLane:${messageId}`**, then the same **`flush` + `remainder`** pattern with **`Plan Outcome Generation Started` / `Result`** stream events (**`streamKey`** = triggering **`characterId`** from the actions payload). The **`remainder`** path calls **`internalCache.CoyoteGame.invalidate('outcome')`** then **`internalCache.CoyoteGame.get('outcome')`**: the last outcome is stored durably (same pattern as **`intent`** on [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts)). The generator is [`generatePlanOutcome`](generatePlanOutcome.ts): a **single Bedrock call** (first draft) using [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts) over staged objects ([`loadCoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts)) plus the durable **[`CoyoteGameIntentRecord`](../../internalCache/coyoteGame.ts)** from **`CoyoteGame.get('intent')`** (**`intent`** line; optional **`walkthrough`** as **## Scene analysis** context; optional **`phasePlan`** outline via [`formatPhasePlanForOutcomePrompt`](formatPhasePlanForOutcomePrompt.ts)). [`internalCache`](../../internalCache/index.ts) passes the full record into outcome generation without extra Dynamo reads. Prompt rules require the Road Runner to remain safe and the setback to land on the Coyote where possible; multi-stage refinement is future work.

**Steady-state plan outcome contract:**

- **One** model call, one player-facing **`Outcome:`** line in the returned **`RenderTree`** (or stub on failure / unparseable body; unchanged product contract).
- **Inputs** are the same **staged-object snapshot** as other Coyote LLM paths plus the **cached intent row**; if hop-2 never persisted **`phasePlan`**, or validation dropped it, the prompt still has **`intent`** and optional **`walkthrough`** only.
- **Dynamic prompt tail order** (all after the shared topology / safety / **## Voice** block, for prompt caching): **`## Hypothesis line`**, optional **`## Scene analysis`** (with cartoon-time instructions) when **`walkthrough`** is set, optional **`## Phase plan (execution outline)`** when **`phasePlan`** is set, then **`## Current staged objects by room`**.

**Product / demo context:** [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

## Staged objects snapshot (plan-role affinities)

**Loader:** [`loadCoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts) gathers **`EphemeraMetaRoomObject[]`** per Coyote game room from **`getRoomMeta`** / **`Meta::Room.objects`** (same read path production uses).

**`stableKey`:** Staged rows may include optional **`stableKey`** (e.g. after Acme delivery). Full wire and uniqueness rules: **[`../actions/AGENT.md`](../actions/AGENT.md)**. Coyote-wide uniqueness for Acme minted **`stableKey`** values is enforced in **`mtw.ephemera.actions`** before **`Acme Order`** publishes, using the same Coyote demo room roster as **[`CoyoteGame.gameRooms`](../../internalCache/coyoteGame.ts)**. The object record carries **`stableKey`** for stable machine references; hypothesis Stage One snapshot lines echo **`shortName`**, **`stableKey`**, and compact **plan-role** text via [`formatCoyoteStagedObjectLine`](coyoteRoomObjectSnapshot.ts).

**Prompt text:** [`formatCoyoteStagedObjectsByRoom`](coyoteRoomObjectSnapshot.ts) fills **`## Current staged objects by room`** for [`buildHypothesisStageOnePromptParts`](buildHypothesisStageOnePrompt.ts) and [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts). Plan-selection and phase-plan hops consume **combined-only** Markdown from [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts) (not this raw snapshot block). Each staged object prints **`shortName`**, **`stableKey`**, plus compact lines for persisted **plan-role** possibilities (**`affinities`**: flat modification tags, structural roles, generative roles `prep` / `creation`, and **`aptness`** --- see [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)). Flat modification tags are **`influence-road-runner`**, **`alter-road-runner`**, **`coyote-equipment`**, **`coyote-enhancement`**, **`setting-addition`**, **`connect-props`**, and **`enhance-prop`**. Use `prep` for before-beat setup (digging, rigging, assembly) and `creation` for in-beat generated effects. **`affinitiesFailed`** becomes the explicit suffix **`plan roles unavailable (enrich failed)`** so the model can separate enrich failure from legacy rows that never had affinity data.

**Types:** **`CoyoteRoomObjectsByRoom`** (**`Record<EphemeraRoomId, EphemeraMetaRoomObject[]>`**) threads through [`generateHypothesis`](generateHypothesis.ts), [`generatePlanOutcome`](generatePlanOutcome.ts), and **`roomObjectsByRoomOverride`** on harnesses. **[`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts)** validates the stage-1 seam against the staged-object multiset **and** structure (sections, bullets, affinity and cluster tokens, member refs, etc.); see that module and [`parseHypothesisStageOneOutput.test.ts`](parseHypothesisStageOneOutput.test.ts). Prompt wording that defines the emitted seam shape is in [`buildHypothesisStageOnePrompt`](buildHypothesisStageOnePrompt.ts).

## Bedrock prompt caching

[`invokeBedrockHypothesis`](invokeBedrockHypothesis.ts) sends a single user message as `text` (static instructions), [`cachePoint`](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html), then `text` (dynamic tail).

**Plan outcome (one Bedrock call, separate from the three hypothesis calls):** [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts) + [`generatePlanOutcome`](generatePlanOutcome.ts) use the same **invariant + dynamic** split (shared **## World topology** / **## Hard constraints** / **## Voice** block, then per-request tail). No table row below; see **Steady-state plan outcome contract** under [Await RoadRunner](#await-roadrunner-plan-outcome-path).

**Hypothesis (Option A, three Bedrock calls):** [`buildHypothesisStageOnePromptParts`](buildHypothesisStageOnePrompt.ts), [`buildHypothesisPlanSelectionPromptParts`](buildHypothesisPlanSelectionPromptParts.ts), and [`buildHypothesisPhasePlanHopPromptParts`](buildHypothesisPhasePlanHopPromptParts.ts) each split invariant vs dynamic tails. Shared geography lives in [`coyoteHypothesisPromptShared.ts`](coyoteHypothesisPromptShared.ts). All three include a dynamic **`## Seam room labels`** block; stage 1 dynamic adds the staged-object snapshot; post-combine hops add **combined clustering Markdown** (from [`combineHypothesisClusters`](combineHypothesisClusters.ts) / [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts)), the hop-1 handoff (`**paragraphSummary**` / **`rubricIssues`** from the last **` ```json `** block per [`coyoteHop1Handoff.ts`](coyoteHop1Handoff.ts)), plus hop-2-only context for phase-plan validation. Stage-1 seam references objects by **`stableKey`**.

| Call | Wrapper | Typical `maxTokens` source |
| --- | --- | --- |
| Stage one | [`invokeBedrockHypothesisStageOne`](invokeBedrockHypothesis.ts) | [`BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS`](invokeBedrockHypothesis.ts) |
| Plan selection | [`invokeBedrockHypothesisPlanSelection`](invokeBedrockHypothesis.ts) | [`BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS`](invokeBedrockHypothesis.ts) |
| Phase-plan hop | [`invokeBedrockHypothesisPhasePlanHop`](invokeBedrockHypothesis.ts) | [`BEDROCK_HYPOTHESIS_PHASE_PLAN_HOP_MAX_TOKENS`](invokeBedrockHypothesis.ts) |

[`invokeBedrockHypothesisStageTwo`](invokeBedrockHypothesis.ts) is a **deprecated alias** for [`invokeBedrockHypothesisPhasePlanHop`](invokeBedrockHypothesis.ts) (same invoke). Tune per-hop output caps from harness **`usagePlanSelection`** / **`usagePhasePlanHop`**; topology stays three calls.

**Hop 1 (plan selection) contract:** Assistant output ends with a **last** fenced **` ```json `** block whose object includes **`paragraphSummary`** and **`rubricIssues`** (see [`coyoteHop1Handoff.ts`](coyoteHop1Handoff.ts)). Earlier content is rubric matrix and explicit plan selection.

**Hop 2 (phase-plan + surface) contract:** [`invokeBedrockHypothesisPhasePlanHop`](invokeBedrockHypothesis.ts) defaults **`extendedThinking`** to **`false`** (pass **`extendedThinking: true`** to experiment with Nova **`reasoningConfig`**; see [`invokeBedrockConverseText`](../../llm/invokeBedrockConverseText.ts) in [`llm/AGENT.md`](../../llm/AGENT.md)). Assistant **`body`** may include a leading **` ```json `** fence for **`phasePlan`** (parsed and validated in [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts)); the **final** player contract remains a **` ```text `** fence containing **only** the **`Hypothesis:`** line. Prefix before that **text** fence maps to **`walkthrough`** when it contains **`## Scene analysis`** content. [`generateHypothesisWithStageResults`](generateHypothesis.ts) exposes **`stageTwoReasoningContent`** when the phase-plan hop returns **`reasoningContent`** (not persisted on **`CoyoteGame`** intent).

**Hop 2: pattern alignment and parsing (steady state):**

- **Same family as `llm` fenced tails:** hop 2 follows the **Markdown reasoning prefix + fenced tail(s)** pattern in [`llm/AGENT.md`](../../llm/AGENT.md); the committed player tail is **`Hypothesis:`** inside a final **`text`** fence. Structured JSON may appear in an earlier fence. Acme enrich is a related multi-fence flow: [`mergeAcmeOrderEnrich`](../actions/mergeAcmeOrderEnrich.ts) / [`parseCommand`](../actions/parseCommand.ts).
- **Parser rule:** [`parseHypothesisModelOutput`](parseHypothesisModelOutput.ts) validates optional **`phasePlan`** against the staged snapshot; it prefers the **last** **`text`** fence whose interior is **only** a single **`Hypothesis:`** line. The **walkthrough** prefix drops leaked lines before **`## Scene analysis`** when that heading appears. If the **text** fence is missing, **legacy** parsing may still recover **`Hypothesis:`** from the body.

**Shared prompt fragments:** [`buildHypothesisStageTwoPrompt.ts`](buildHypothesisStageTwoPrompt.ts) still holds **combined clustering** and plan-phase instruction fragments imported by the Option A builders; **[`buildHypothesisStageTwoPromptParts`](buildHypothesisStageTwoPrompt.ts)** is **not** wired in production (kept for tests / comparison). Instructions must still respect **## Combined clustering** membership and **## Outliers**; virtual scenery does not replace staged objects or merge outliers into clusters.

**Plan outcome consistency:** [`generatePlanOutcome`](generatePlanOutcome.ts) is a separate Bedrock path. [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts) always includes the **`intent`** line and staged-object snapshot; it adds **`walkthrough`** and a deterministic **`phasePlan`** outline when present on the intent record. Narrative rules for the beat should stay **aligned** with that line and staged topology. When **`phasePlan`** is present and valid on the intent record, any code path that **uses** structured plan data must not contradict it; when **`phasePlan`** is **missing** or invalid after hop 2, downstream prompts must **degrade gracefully** and must not assume a full structured plan.

**Hypothesis pipeline (steady state):** Stage 1 uses **world topology** + **staged-object snapshot**. After combine, plan-selection and the phase-plan hop use **combined clustering** + topology (not the raw stage-1 snapshot block); later hops do not replay the stage-1 *instruction* preamble. All three hypothesis invocations default to **[`BEDROCK_HYPOTHESIS_MODEL_ID`](invokeBedrockHypothesis.ts)**; wrappers differ by **`maxTokens`**. Changing the **seam** contract means updating [`buildHypothesisStageOnePrompt`](buildHypothesisStageOnePrompt.ts), [`parseHypothesisStageOneOutput`](parseHypothesisStageOneOutput.ts) (and tests), and [`combineHypothesisClusters`](combineHypothesisClusters.ts) together --- there is no separate seam version field. The seam is not persisted on [`CoyoteGame`](../../internalCache/coyoteGame.ts) intent; inspect it via harness **`stageOneBody`**, unit tests, or local runs. If the model wraps stage-1 output in an outer Markdown fence, [`stripHypothesisStageOneFence`](parseHypothesisStageOneOutput.ts) strips it before validation.

### Clustering and combine (design)

Stage One answers **which staged objects belong in the same functional or thematic maneuver**. **Temporal ordering**, beat sequencing, explicit assembly phases, and inferred intermediates are **plan-phase** responsibilities (hypothesis plan-selection / phase-plan hops, [`generatePlanOutcome`](generatePlanOutcome.ts), later refinements), not clustering.

Per cluster member, the seam may include an optional **`intendedRole`**: a **structured echo** of **one** persisted **[`CoyoteAffinityPossibility`](../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** row already on that object (allowed vocabulary only; **`prep`** vs **`creation`** semantics match Acme enrich). When **`affinities`** are omitted or **`affinitiesFailed`**, omit **`intendedRole`** for that member --- no synthetic role token.

[`combineHypothesisClusters`](combineHypothesisClusters.ts) validates the parsed seam against [`CoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts) and builds **[`CombineClustersReturn`](../../../../packages/mtw-interfaces/ts/coyoteCombineClusters.ts)**; [`renderCombinedHypothesisForStageTwo`](combineHypothesisClusters.ts) turns that into combined clustering Markdown for post-combine hops. Staged objects listed under **`outliers`** are in **no** named cluster; plan-phase prompts must treat them explicitly (do not silently fold them into a cluster).

**Timeouts:** [`EphemeraFunction`](../../../../template.yaml) sets **`Timeout: 60`** for the Lambda; each Bedrock hypothesis call uses [`BEDROCK_HYPOTHESIS_TIMEOUT_MS`](invokeBedrockHypothesis.ts) per invocation (production hypothesis path runs **three** sequential calls).

**Plan outcome:** [`buildPlanOutcomePromptParts`](buildPlanOutcomePrompt.ts) splits a fixed **invariant** prefix (topology, safety, voice) from a **dynamic** tail (**Hypothesis line**, optional scene analysis, optional phase outline from [`formatPhasePlanForOutcomePrompt`](formatPhasePlanForOutcomePrompt.ts), staged-object snapshot) for Bedrock prompt caching.

**Legacy single-call hypothesis prompt:** [`buildHypothesisPromptParts`](buildHypothesisPrompt.ts) is kept for regression comparison; production uses stage one plus Option A plan-selection and phase-plan hop builders.

## Engine testing harness (dev)

**Purpose:** A **repeatable, non-production** path to run the same **hypothesis** Bedrock stack as live play (same model, prompt cache layout, and parse rules) against **ten fixed staged-object snapshots**, and return **one `WorldOOCMessage` per fixture** so you can compare quality and cost after prompt or model changes. The harness does **not** require real `Meta::Room` state for those rooms, and it does **not** read or write [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts) intent/outcome in Dynamo.

**Pipeline (mirrors production, not `CacheCoyoteGameData`):** For each fixture, [`runCoyoteEngineTestHarness`](runCoyoteEngineTestHarness.ts) calls [`generateHypothesisWithStageResults`](generateHypothesis.ts) with **`roomObjectsByRoomOverride`** (normalized fixture map) and dummy **`getGameRooms`** / **`getRoomMeta`**. Each fixture performs **three** Bedrock hypothesis calls plus parsing. Published output concatenates, per fixture: optional **`walkthrough`** (hop-2 scene analysis when present), **`intent`**, **`elapsedMs`**, **`usageStage1:`**, **`stageOneBody:`**, **`usagePlanSelection:`**, **`usagePhasePlanHop:`**, **`selectionBody:`** (hop-1 assistant text), **`phasePlanJson:`** (validated JSON interior or `(none)` plus optional **`phasePlanValidationReason`**). Tests may inject **`generateHypothesisPipelineImpl`**.

**Activation:** Commands go through [`parseCommand`](../actions/parseCommand.ts). **`CoyoteEngineTest`** is returned **without Bedrock** when the trimmed command matches the slash prefix **`/test generation`** (optional whitespace then more text); see [`coyoteEngineTestSlashCommand`](../actions/coyoteEngineTestSlashCommand.ts). Step A classification does **not** emit **`CoyoteEngineTest`** from the LLM. [`actions/index.ts`](../actions/index.ts) runs [`runCoyoteEngineTestHarness`](runCoyoteEngineTestHarness.ts) only when **`COYOTE_ENGINE_TEST_HARNESS_ENABLED`** is **`true`** (constant at top of that file); otherwise it replies that the harness is disabled.

**Runner behavior:** **Hypothesis only** for this harness (plan-outcome harness is future work). **`testBatchSize`** defaults to **`1`** (sequential fixture runs; each fixture is **three** Bedrock calls); higher values run multiple worker loops in parallel (tradeoff: throttling vs latency). **Continue-on-error:** a failed fixture still gets a published line and the batch continues. Each message includes **`n/total`**, fixture **`id`**, optional **`walkthrough`**, **`Hypothesis:`** line, **`elapsedMs`**, **`usageStage1:`**, **`stageOneBody:`**, **`usagePlanSelection:`**, **`usagePhasePlanHop:`**, **`selectionBody:`**, **`phasePlanJson:`** (or **`(skipped)`** / **`(none)`** as applicable).

**Fixtures:** Canonical data is [`coyoteEngineTestFixtures.ts`](coyoteEngineTestFixtures.ts) (`COYOTE_ENGINE_TEST_FIXTURES`, optional **`hypothesisLine`** reserved for a future outcome harness). Room keys use **`ROOM#${roomKey}`**; when serializing prompts, room order matches [`defaultCoyoteGameData.gameRooms`](../../internalCache/coyoteGame.ts) (`VORTEX`, `STRAIGHTAWAY`, …), same as live **`getGameRooms()`** behavior.

**Future (degraded snapshot coverage):** The stock fixtures are intended as a **golden path** for comparing prompts and cost. A later improvement is to add fixtures (or a separate test list) that include staged objects with **`affinitiesFailed: true`** or **omitted** **`affinities`** (legacy or pre-enrich) so Stage One, any post-seam **combine** step, and post-combine plan hops are **explicitly** regression-tested when plan roles are missing or marked failed. Engine fixtures intentionally stayed golden-path-only when clustering shipped; degraded-snapshot coverage remains a separately scheduled hardening pass (see **[Clustering and combine (design)](#clustering-and-combine-design)** above for runtime tolerance expectations).

**Authoring names to engine rooms**

| Authoring phrase | `roomKey` | `EphemeraRoomId` |
| --- | --- | --- |
| Base of Cliff | `VORTEX` | `ROOM#VORTEX` |
| Top of Cliff | `CLIFFTOP` | `ROOM#CLIFFTOP` |
| Straightaway | `STRAIGHTAWAY` | `ROOM#STRAIGHTAWAY` |
| Corner | `CORNER` | `ROOM#CORNER` |
| Bridge | `BRIDGE` | `ROOM#BRIDGE` |

**Operational:** Ten fixtures × **three** hypothesis Bedrock calls per fixture by default (**thirty** Converse invocations per full harness run). Budget Lambda time accordingly (raise ephemera Lambda timeout if needed; raise **`testBatchSize`** cautiously).

**Related:** [`generatePlanOutcome`](generatePlanOutcome.ts) supports **`roomObjectsByRoomOverride`** and **`hypothesisLineOverride`** for future harness work. Product context: [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

**Manual check:** Toggle the harness flag if needed, send **`/test generation`** (or with trailing words after a space), expect **ten** labeled replies; normal play paths should still persist Coyote intent/outcome only through the usual cache flows.

## Acme parse affinities harness (dev)

**Purpose:** Manual review of **Step A + Step B** (`parseCommand`) on the Coyote LLM handoff **Iteration 2** corpus: **ten** single-item orders, one Bedrock classification plus one enrich call per phrase.

**Activation:** [`parseCommand`](../actions/parseCommand.ts) returns **`CoyoteAffinitiesTest`** (no Bedrock) when the trimmed command matches **`/test affinities`** (optional whitespace then more text); see [`coyoteAffinitiesTestSlashCommand`](../actions/coyoteAffinitiesTestSlashCommand.ts). [`actions/index.ts`](../actions/index.ts) runs [`runAcmeOrderAffinitiesHarness`](../actions/runAcmeOrderAffinitiesHarness.ts) only when **`COYOTE_AFFINITIES_TEST_HARNESS_ENABLED`** is **`true`** (constant in that file; default **`false`**). Otherwise the player sees that the harness is disabled.

**Runner:** For each phrase in [`acmeOrderAffinitiesHarnessPhrases`](../actions/acmeOrderAffinitiesHarnessPhrases.ts), the harness calls **`parseCommand`** with **`command`** = **`order`** + that phrase, and publishes **one** consolidated **`WorldOOCMessage`** with numbered sections (`1/10` .. `10/10`), **`elapsedMs`**, and **`JSON.stringify`** of each **`ParseCommandResult`** (merged **`AcmeOrder`** including **`affinities`** when successful).

**Cost:** Ten phrases times **two** Converse calls each (**twenty** invocations per full run when enabled). Budget Lambda time accordingly (raise ephemera Lambda timeout if needed).

**Verification:** `cd lambda/ephemera && npx jest dataSource/coyoteGame/ dataSource/actions/`
