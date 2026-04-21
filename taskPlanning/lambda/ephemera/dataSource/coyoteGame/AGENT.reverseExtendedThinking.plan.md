# Coyote hypothesis: reverse extended thinking (plan-phase) task plan

**Status:** **Implemented** in code (Stage Two **`extendedThinking`** default off; prompt requires scene analysis + final fenced **text** tail; [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) final-fence path + legacy). **Baseline:** keep comparing **`usageStage2`** after deploy vs the **>3k** / **<1k** trend. **Next:** optional harness or production check, then **Close out** this plan when you are satisfied.

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability, what belongs here vs [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)). Retire or delete this plan after the initiative ships and durable notes land in code-adjacent `AGENT.md` if needed.

## Purpose

The Coyote **hypothesis Stage Two** path ([`generateHypothesis`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts)) currently defaults **Amazon Nova extended reasoning** on [`invokeBedrockHypothesisStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts): `extendedThinking: true` with Nova **`reasoningConfig`** ([`invokeBedrockConverseText`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts), default **`reasoningEffort`** `medium`). Empirically this appears to spend on the order of **~4x** total tokens versus a plain text completion, with **most** of that budget in the **reasoning channel** rather than the assistant **`body`**. Recent **`usageStage2`** samples are climbing toward **>3k** tokens where the prior stack was **<1k** for Stage Two. Quality improvements have been **modest** relative to that cost.

Before implementation, the **prompt** steered planning into the Nova **reasoning** channel ([`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts)), which hid chain-of-thought from **`body`**-based metrics except optional **`stageTwoReasoningContent`** on [`generateHypothesisWithStageResults`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts). That path is replaced by **`## Scene analysis`** + a fenced **`Hypothesis:`** tail in **`body`**.

**Goal:** Refactor back toward **explicit** chain-of-reasoning in the **assistant text stream** (or another **observable** first-class representation), reusing **split-parse** patterns already in the repo, so that:

- token spend is **transparent** in the same artifacts we already inspect (harness output, `body` shape);
- we can **drop or segment** reasoning from what players see without relying on an opaque provider-side reasoning channel;
- we preserve the **two-round** hypothesis architecture (Stage One seam + combine + Stage Two plan-phase) and existing validators ([`parseHypothesisStageOneOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisStageOneOutput.ts), [`combineHypothesisClusters`](../../../../../lambda/ephemera/dataSource/coyoteGame/combineHypothesisClusters.ts), [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts)).

**Non-goals (unless scope changes):**

- Replacing Stage One / combine / Stage Two split with a single mega-prompt (regression risk; separate decision).
- Persisting long reasoning blobs on [`CoyoteGame`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) intent (storage and product scope unchanged unless explicitly chosen).

## Background (steady-state pointers)

| Area | Role |
| --- | --- |
| Stage Two invocation | [`invokeBedrockHypothesisStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) defaults **`extendedThinking: false`**; pass **`true`** to experiment. |
| Nova transport + reasoning | [`invokeBedrockConverseText`](../../../../../lambda/ephemera/llm/invokeBedrockConverseText.ts); success may include **`reasoningContent`** when extended thinking is on. |
| Stage Two prompt contract | [`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts): **`## Scene analysis`** + final fenced block (language **text**) with **`Hypothesis:`** only. |
| Player-visible parse | [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts): **final-fence** path preferred; **legacy** whole-wrap + first **`Hypothesis:`** line; trims preamble before `## Scene analysis` when present. |
| Shared split-parse prior art | [`splitMarkdownReasoningAndJson`](../../../../../lambda/ephemera/llm/splitMarkdownReasoningAndJson.ts) and [`llm/AGENT.md`](../../../../../lambda/ephemera/llm/AGENT.md) (Markdown scratchpad + **fenced** structured tail); Acme enrich path in [`mergeAcmeOrderEnrich`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts) / [`parseCommand`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) for **observable** reasoning alongside structured output. Stage Two should follow the same **scratchpad + fenced final output** shape for hypothesis text. |
| Cost/quality comparison | [`runCoyoteEngineTestHarness`](../../../../../lambda/ephemera/dataSource/coyoteGame/runCoyoteEngineTestHarness.ts) exposes **`usageStage1`**, **`usageStage2`**, **`stageOneBody`**, elapsed time per fixture. |

## Chosen direction (Stage Two hypothesis)

We are **standardizing** on the repo pattern for chain-of-reasoning in **`body`**: a **reasoning prefix**, then a **machine-sliced fenced tail** (same structural idea as [`splitMarkdownReasoningAndJson`](../../../../../lambda/ephemera/llm/splitMarkdownReasoningAndJson.ts): Markdown reasoning, then a fence --- here the tail is the **`Hypothesis:`** line instead of JSON).

**Scratchpad:** **`## Scene analysis`** is where the model does **chain-of-reasoning** (ordering, topology, plan logic) in **player-facing** prose. It is **not** a separate hidden `## Plan notes` block.

**Fenced tail:** The **final** fenced block contains **only** the terminal line(s) we parse mechanically, typically the single **`Hypothesis:`** sentence --- the **commit** after reasoning.

**Implementation:** Find the **final** fenced block. **Everything before that fence** is the scene-analysis Markdown (including the `## Scene analysis` heading and body). **Fence interior** is the **`Hypothesis:`** line. Concatenate **`prefix + "\n" + interior`** for [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts), or assign the two slices directly to **`sceneAnalysis`** / **`intent`** if you prefer not to re-parse. Pick a single fence language (for example `text`) and document it in the prompt so slicing stays deterministic.

PRs that implement this task should treat the above as the **contract** unless a follow-up explicitly revisits it.

## Alternatives and fallbacks (not chosen)

1. **Extended thinking off only (narrow baseline)**  
   Set Stage Two **`extendedThinking`** default to **`false`** without changing output shape. Still useful as a **measurement** step (compare **`usage`** before full parser work). Risk without the chosen prompt + fence: scratch content may appear outside a reliable delimiter.

2. **Heading-only scratchpad (no fence)**  
   Optional **`## Plan notes`** (or similar) **before** **`## Scene analysis`**. [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) can drop lines before **`## Scene analysis`** when that heading is present. **Not chosen** --- we want the **fenced** tail for deterministic slicing, aligned with other Bedrock call sites.

3. **Optional third Bedrock stage**  
   A separate short call for "plan notes" would add latency and another **`usage`** line; **last resort** if the chosen single-call contract proves unworkable in practice.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)).

1. **Skim framework docs**  
   - **Why:** Task-plan conventions and checkbox rules.  
   - **Read:** [`taskPlanning/AGENT.md`](../../../../AGENT.md); this file **Purpose** and **Chosen direction**.

2. **Read durable Coyote hypothesis docs**  
   - **Why:** Stage boundaries and parser contracts are easy to break.  
   - **Read:** [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) (especially **Stage Two body contract**, **Hypothesis pipeline**, engine harness).

3. **Inspect implementation hot spots**  
   - **Files:** [`invokeBedrockHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts), [`buildHypothesisStageTwoPrompt.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts), [`parseHypothesisModelOutput.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts), [`generateHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.ts).

4. **Establish measurement**  
   - **Why:** The complaint is token economics; decisions should cite **`usage`** from harness or CloudWatch, not only vibes.  
   - **Focus:** Baseline Stage Two **`usage`** is already being captured (trend **>3k** vs **<1k** historically). After implementation, compare extended thinking **off** + new **`body`** contract vs the old baseline; still split **`body`** vs **`reasoningContent`** when extended thinking remains on in experiments.

5. **Tests**  
   - **Why:** Parser changes must stay tight.  
   - **Commands:** See **Verification** (Jest from `lambda/ephemera`).

## Progress

| Milestone | Notes |
| --- | --- |
| Baseline metrics | **In progress:** compare post-deploy **`usageStage2`** to prior **>3k** trend. |
| Prompt + invocation change | **Done:** `extendedThinking` default **false**; [`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) fenced tail + scene analysis instructions. |
| Parser + tests | **Done:** [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) `findAllFenceBlocks` + legacy; Jest updated. |
| Durable doc touch-up | **Done:** [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Stage Two body contract**. |

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step (see [`taskPlanning/AGENT.md` Recommended order checkboxes](../../../../AGENT.md#recommended-order-checkboxes)).

- [X] Baseline: Stage Two **`usage`** is already being captured (trending toward **>3k** tokens vs **<1k** previously; optional **`reasoningContent`** size). Keep logging on a fixed harness run or scripted comparison through implementation for before/after; note subjective quality on the same fixtures.
- [X] **Direction:** **Chosen direction** is **Markdown `## Scene analysis` (reasoning scratchpad) + fenced `Hypothesis:` tail** --- documented in **Chosen direction (Stage Two hypothesis)** above; not revisiting unless a follow-up task says otherwise.
- [X] Implementation: flip [`invokeBedrockHypothesisStageTwo`](../../../../../lambda/ephemera/dataSource/coyoteGame/invokeBedrockHypothesis.ts) defaults and adjust [`buildHypothesisStageTwoPrompt`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.ts) to implement that contract (no steering planning into the Nova reasoning channel; extended thinking off for Stage Two unless explicitly overridden).
- [X] Parser: extend [`parseHypothesisModelOutput`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.ts) for any new headings or delimiters; keep **`CoyoteGameIntentRecord`** player-safe.
- [X] Tests: update [`parseHypothesisModelOutput.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/parseHypothesisModelOutput.test.ts), [`buildHypothesisStageTwoPrompt.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/buildHypothesisStageTwoPrompt.test.ts) if present, and [`generateHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/generateHypothesis.test.ts) as needed.
- [X] Docs: refresh [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Stage Two** bullets; update this plan's **Progress** and **Recommended order** checkboxes.
- [ ] Close out: delete or archive this task plan when the behavior is stable and the team no longer needs the checklist.

## Verification

- Ran: `cd lambda/ephemera && npx jest dataSource/coyoteGame/` (81 tests, all passing at implementation time).
- From repo root: `cd lambda/ephemera && npx jest dataSource/coyoteGame/` (aligns with [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) **Verification**).
- After parser or prompt edits, add or adjust unit tests so **stub intent**, **scene analysis**, and **`Hypothesis:`** extraction stay deterministic.
- Optional: run the Coyote engine test harness (disabled by default; see **Engine testing harness** in [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)) to compare **`usageStage2`** across branches.

## Material decisions to confirm early

- Whether **`stageTwoReasoningContent`** remains useful for diagnostics once reasoning is explicit in **`body`**, or should be deprecated in favor of a single observable stream.
- Whether to keep **`BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS`** at current values when extended thinking is off (output may shift length).
