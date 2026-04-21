# Coyote plan-phase (Stage 2 hypothesis) tuning

**Status:** Not started. Clustering / combine pass is landed; this plan covers the next slice: extended thinking in Bedrock, Stage 2 alignment with richer cluster data, and prompt updates for temporal ordering and virtual scenery.

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

- [ ] Bedrock utility: **`extendedThinking`** + **`reasoningContent`**
  - [ ] Add **`extendedThinking?: boolean`** (default **`false`**) to [`InvokeBedrockConverseTextParams`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts) and plumb into **`ConverseCommandInput`** per AWS Bedrock extended-thinking API for the target model(s).
  - [ ] On success, populate optional **`reasoningContent: string`** (or structured type if API returns blocks) on [`InvokeBedrockConverseTextSuccess`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts) when the response includes reasoning; keep **`body`** as primary assistant **text** output only.
  - [ ] Extend **text extraction** helpers if content blocks distinguish **text** vs **reasoning** (mirror patterns from AWS SDK types).
  - [ ] Unit tests: mocked client returns reasoning + text; flag off preserves current behavior.

- [ ] Hypothesis wrappers pass-through
  - [ ] Thread **`extendedThinking`** (and optional returned **`reasoningContent`**) through [`invokeBedrockHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) / [`InvokeBedrockHypothesisResult`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) types as needed.
  - [ ] **`invokeBedrockHypothesisStageTwo`**: set **`extendedThinking: true`**; Stage One unchanged unless you intentionally align (default leave Stage One off).

- [ ] Stage 2 alignment with richer cluster/combine data
  - [ ] Audit [`buildHypothesisStageTwoPromptParts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) against current [`renderCombinedHypothesisForStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts) output (cluster names, **`intendedRole`**, outliers, affinity lines). Update instructions so the model uses **roles** and **outliers** deliberately.
  - [ ] Add or refresh **prompt tests** so Stage 2 instructions mention **prep** vs **creation** semantics consistent with [`coyotePlanAffinities`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts).

- [ ] Thinking vs output contract (Stage 2 prompt)
  - [ ] Document: reasoning channel = planning and ordering; **`body`** = scene analysis (if any) + **`Hypothesis:`** line only (no chain-of-thought preamble).
  - [ ] Coordinate with **`parseHypothesisModelOutput`** expectations (see next section).

- [ ] Refactor parsing: drop chain-of-reason stripping from primary path
  - [ ] If any Stage 2 path splits leading Markdown from JSON/text, replace with **clean `body`** + optional **`reasoningContent`** from invocation (hypothesis-specific; follow [`splitMarkdownReasoningAndJson`](../../../../../lambda/ephemera/llm/splitMarkdownReasoningAndJson.ts) patterns only where still needed for non-extended-thinking fallbacks).
  - [ ] Update [`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts) (and harness types) to carry **`reasoningContent`** for metrics or debug when present; do not inject reasoning into **`CoyoteGameIntentRecord`** unless product asks (default: omit from player-visible cache).

- [ ] Temporal ordering in Stage 2 prompt
  - [ ] State explicitly: **prep** steps happen **before** trigger/beat; **creation** effects occur **during** execution; contraption firing order is readable from the **`Hypothesis:`** line narrative.

- [ ] Virtual scenery and invented prep objects
  - [ ] Add prompt bullets: may reference **environmental props** (boulders, cliff/ground rocks, lever rocks, cactus, etc.) as plan elements.
  - [ ] Add prompt bullets: **prep** may **introduce** ephemeral/virtual props (fake tunnel paint, dug pit, piles) that need not appear as staged **`Meta::Room.objects`** rows.

- [ ] Verification sweep
  - [ ] Run Jest targets for touched files; **`npm run build`** in **`lambda/ephemera`**.
  - [ ] Optional: one harness fixture run with **`COYOTE_ENGINE_TEST_HARNESS_ENABLED`** workflow to spot-check Stage 2 output shape (document command in **Verification** when used).

## Verification

- From **`lambda/ephemera`**: `npm run build`
- Targeted tests (adjust paths as tests are added):
  - `npm run test -- --runInBand llm/invokeBedrockConverseText.test.ts` (add file if missing)
  - `npm run test -- --runInBand dataSource/coyoteGame/invokeBedrockHypothesis.test.ts dataSource/coyoteGame/generateHypothesis.test.ts dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts`
- Confirm **`ReadLints`** clean on edited files.

## Progress

| Milestone | Status |
| --- | --- |
| `invokeBedrockConverseText` extended thinking + reasoning extraction | Not started |
| Stage 2 invocation uses extended thinking; types plumbed | Not started |
| Stage 2 prompt: cluster alignment, temporal ordering, virtual scenery / prep-created objects | Not started |
| Parsing/harness updated; chain-of-reason stripping removed from primary Stage 2 path | Not started |
| Build + tests green | Not started |
