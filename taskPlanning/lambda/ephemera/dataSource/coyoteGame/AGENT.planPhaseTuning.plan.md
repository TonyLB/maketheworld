# Coyote plan-phase (Stage 2 hypothesis) tuning

**Status:** In progress. **Extended thinking**, **cluster/combine alignment**, **thinking vs visible text** (Stage 2 prompt), **parse + pipeline (`stageTwoReasoning`)** are done. Remaining: **temporal ordering** and **virtual scenery** prompt bullets, and a final verification sweep.

## Purpose

After the clustering tuning pass, **Stage Two hypothesis** ([`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), [`invokeBedrockHypothesisStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts), [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts)) should **fully consume** the richer [`combineHypothesisClusters`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts) / [`renderCombinedHypothesisForStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts) Markdown and related interfaces ([`packages/mtw-interfaces/ts/coyoteCombineClusters.ts`](../../../../../packages/mtw-interfaces/ts/coyoteCombineClusters.ts), [`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)).

Separately, the shared Bedrock helper [`invokeBedrockConverseText`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts) should gain optional **extended thinking** support so callers can obtain **`reasoningContent`** when the model provides it, reducing reliance on **chain-of-reasoning embedded in the primary text output** for hypothesis (and eventually other call sites).

This document is task-scoped. Retire or delete it once the initiative ships and any lasting notes live in [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) or adjacent durable docs.

## Scope

**In scope**

- **`extendedThinking`** flag (default **`false`**) on the general Converse invocation utility; on success, surface **`reasoningContent`** where the Bedrock response includes it (alongside existing **`body`** / **`usage`**).
- Hypothesis Stage 2: enable extended thinking on that call; define **what belongs in thinking vs structured user-visible output** (scene analysis + single **`Hypothesis:`** line per [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts)).
- Refactor Stage 2 **output handling** so parsing does not depend on stripping leading chain-of-reason Markdown from **`body`**; treat **`reasoningContent`** as the reasoning channel when present.
- Prompt work: clearer **temporal ordering** --- **`prep`**-class actions complete **before** the contraption fires or the main beat runs; **`creation`**-class effects occur **during** plan execution / the cartoon beat.
- Prompt work: explicit permission to treat **virtual scenery** (boulders on cliff or ground, rocks for lever action, cactus, etc.) as **first-class plan elements** even when not staged rows.
- Prompt work: explicit permission to **create virtual objects during prep** (e.g. painted **fake tunnel** on a rock face, a **pit** dug with a shovel) as narratively grounded setup.

**Out of scope (unless discovered blocking)**

- Plan outcome generation ([`generatePlanOutcome`](../../../../../lambda/ephemera/dataSource/coyoteGame/generatePlanOutcome.ts)); this plan lists follow-ups that **should stay consistent** with Stage 2 wording but does not scope full outcome rework.
- Changing Stage One seam schema (already tuned); only **consumer** alignment in Stage 2 prompts and tests.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)). Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for durability, checkbox conventions, and what belongs here versus package docs.

1. **Understand project foundations**
   - **Why**: Task plans live under [`taskPlanning/`](../../../../); root [`AGENT.md`](../../../../../AGENT.md) indexes Coyote and ephemera docs.
   - **Read**: [`taskPlanning/AGENT.md`](../../../../AGENT.md); Coyote module overview [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (**Clustering and combine**, **Staged objects snapshot**, hypothesis pipeline).

2. **Read this document**
   - **Why**: **Recommended order** is the durable checklist; **Verification** tracks commands for this slice.
   - **Focus**: Purpose, scope, and material decisions below.

3. **Core integration points**
   - **Shared LLM exit**: [`invokeBedrockConverseText`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts) (extend for **`extendedThinking`** + **`reasoningContent`** extraction from Converse response content blocks).
   - **Hypothesis Stage 2**: [`invokeBedrockHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) passes through to Converse; [`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) wires pipeline; [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) parses Stage 2 **`body`**.
   - **Stage 2 prompt**: [`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), shared copy in [`coyoteHypothesisPromptShared.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPromptShared.ts).
   - **Combine output**: [`combineHypothesisClusters`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts), [`renderCombinedHypothesisForStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts).

4. **Testing**
   - **Why**: Ephemera uses Jest from [`lambda/ephemera`](../../../../../lambda/ephemera); extend [`invokeBedrockHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.test.ts), [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) tests if present, [`generateHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.test.ts), and [`buildHypothesisStageTwoPrompt.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts) (or add tests where gaps appear). Harness: [`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts) / [`coyoteEngineTestFixtures.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteEngineTestFixtures.ts).

5. **Baseline before edits**
   - Run **Verification** commands below on a clean tree.

## Material decisions

- **Extended thinking default**: **`extendedThinking: false`** everywhere unless a call site opts in (Stage 2 hypothesis first).
- **Thinking vs output**: Document in Stage 2 prompt that **reasoning / scratch work** belongs in the model reasoning channel when enabled; **visible** player-facing content remains the structured Stage 2 output (**optional scene analysis**, one **`Hypothesis:`** line) without leading prose in **`body`**.
- **Backward compatibility**: When **`reasoningContent`** is absent (older models or flag off), behavior should remain safe: **`body`** parsing may still tolerate minimal fence/wrap if needed until all paths emit clean bodies.
- **Virtual objects**: Prompt language should align with world geography in [`coyoteHypothesisPromptShared.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteHypothesisPromptShared.ts) and demo rooms ([`AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) room table); avoid contradicting staged-object rules.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested bullets `[X]` as you complete each sub-step.

- [X] Bedrock utility: **`extendedThinking`** + **`reasoningContent`**
  - [X] Add **`extendedThinking?: boolean`** (default **`false`**) to [`InvokeBedrockConverseTextParams`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts) and plumb into **`ConverseCommandInput`** per AWS Bedrock extended-thinking API for the target model(s).
  - [X] On success, populate optional **`reasoningContent: string`** (or structured type if API returns blocks) on [`InvokeBedrockConverseTextSuccess`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts) when the response includes reasoning; keep **`body`** as primary assistant **text** output only.
  - [X] Extend **text extraction** helpers if content blocks distinguish **text** vs **reasoning** (mirror patterns from AWS SDK types).
  - [X] Unit tests: mocked client returns reasoning + text; flag off preserves current behavior.

- [X] Hypothesis wrappers pass-through
  - [X] Thread **`extendedThinking`** (and optional returned **`reasoningContent`**) through [`invokeBedrockHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) / [`InvokeBedrockHypothesisResult`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) types as needed.
  - [X] **`invokeBedrockHypothesisStageTwo`**: set **`extendedThinking: true`**; Stage One unchanged unless you intentionally align (default leave Stage One off).

- [X] Stage 2 alignment with richer cluster/combine data
  - [X] Audit [`buildHypothesisStageTwoPromptParts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) against current [`renderCombinedHypothesisForStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts) output (cluster names, **`intendedRole`**, outliers, affinity lines). Update instructions so the model uses **roles** and **outliers** deliberately. (**Implemented:** **`COMBINED_CLUSTERING_CONTRACT_LINES`** in Stage 2 prompt; outliers render with **room** / **`intendedRole`** like cluster members.)
  - [X] Add or refresh **prompt tests** so Stage 2 instructions mention **prep** vs **creation** semantics consistent with [`coyotePlanAffinities`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts). (**Covered:** [`buildHypothesisStageTwoPrompt.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts), [`combineHypothesisClusters.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.test.ts) renderer assertions.)

- [X] Thinking vs output contract (Stage 2 prompt)
  - [X] Document: reasoning channel = planning and ordering; **`body`** = scene analysis (if any) + **`Hypothesis:`** line only (no chain-of-thought preamble). (**Implemented:** **`EXTENDED_REASONING_VS_VISIBLE_TEXT_LINES`** in [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts).)
  - [X] Coordinate with **`parseHypothesisModelOutput`** expectations (see next section).

- [X] Refactor parsing: drop chain-of-reason stripping from primary path
  - [X] Hypothesis Stage 2 does not use trailing JSON; no **`splitMarkdownReasoningAndJson`** wire-up. **`parseHypothesisModelOutput`** trims lines **before** **`## Scene analysis`** when present so stray preamble is not stored as **`sceneAnalysis`**. Passes **`reasoningContentProvided`** from the Bedrock result for API symmetry ([`ParseHypothesisModelOutputOptions`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts)).
  - [X] Update [`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts): optional **`stageTwoReasoningContent`** on **`GenerateHypothesisPipelineResult`** when Stage Two returns **`reasoningContent`**; not on **`CoyoteGameIntentRecord`**.

- [ ] Temporal ordering in Stage 2 prompt
  - [ ] State explicitly: **prep** steps happen **before** trigger/beat; **creation** effects occur **during** execution; contraption firing order is readable from the **`Hypothesis:`** line narrative.

- [ ] Virtual scenery and invented prep objects
  - [ ] Add prompt bullets: may reference **environmental props** (boulders, cliff/ground rocks, lever rocks, cactus, etc.) as plan elements.
  - [ ] Add prompt bullets: **prep** may **introduce** ephemeral/virtual props (fake tunnel paint, dug pit, piles) that need not appear as staged **`Meta::Room.objects`** rows.

- [ ] Verification sweep
  - [ ] Run Jest targets for touched files; **`npm run build`** in **`lambda/ephemera`**.
  - **Manual (web client):** Optional Stage 2 harness spot-check with **`COYOTE_ENGINE_TEST_HARNESS_ENABLED`** is done in the **application** when you want eyes on output shape --- not an agent/CLI step here; no shell command documented under **Verification**.

## Verification

- From **`lambda/ephemera`**: `npm run build`
- Bedrock utility slice (`extendedThinking` / `reasoningContent`): `npm run test -- --runInBand llm/invokeBedrockConverseText.test.ts` (passes); `npm run build` (passes).
- Hypothesis wrappers slice: `npm run test -- --runInBand dataSource/coyoteGame/invokeBedrockHypothesis.test.ts dataSource/coyoteGame/generateHypothesis.test.ts` (passes); `npm run build` (passes).
- Targeted tests (adjust paths as tests are added):
  - `npm run test -- --runInBand llm/invokeBedrockConverseText.test.ts`
  - `npm run test -- --runInBand dataSource/coyoteGame/invokeBedrockHypothesis.test.ts dataSource/coyoteGame/generateHypothesis.test.ts dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts`
  - Cluster alignment slice (passes): `npm run test -- --runInBand dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts dataSource/coyoteGame/combineHypothesisClusters.test.ts`
  - Thinking / parsing slice (passes): `npm run test -- --runInBand dataSource/coyoteGame/parseHypothesisModelOutput.test.ts dataSource/coyoteGame/generateHypothesis.test.ts`
- Confirm **`ReadLints`** clean on edited files.

## Progress

| Milestone | Status |
| --- | --- |
| `invokeBedrockConverseText` extended thinking + reasoning extraction | Done |
| Stage 2 invocation uses extended thinking; types plumbed | Done |
| Stage 2 prompt + combine Markdown: cluster roles, outliers, prep vs creation; outlier **`intendedRole`** / room in renderer | Done |
| Stage 2 prompt: temporal ordering, virtual scenery / prep-created objects (remaining bullets) | Not started |
| Thinking vs **`body`** prompt; **`parseHypothesisModelOutput`** trim; **`stageTwoReasoningContent`** on pipeline result | Done |
| Build + tests green | Not started |
