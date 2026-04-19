# Ephemera LLM utilities - AGENT

`lambda/ephemera/llm/` holds **shared, Bedrock-facing primitives** that are not tied to a single feature: **transport** (Runtime `Converse`, text out) and **model-output parsing** (splitting chain-of-reasoning Markdown from final JSON, and normalizing a JSON object substring from messy assistant text). Feature code keeps **prompts, domain validation, and business types** elsewhere; this directory defines **reusable patterns** so new call sites do not re-implement fences, timeouts, or the "Markdown then JSON" response shape.

## Scope (key files)

- [`invokeBedrockConverseText.ts`](invokeBedrockConverseText.ts) -- **Converse** call: messages, `maxTokens` / `temperature` / `timeoutMs`, aggregated text `body`, typed success or failure. Default client uses `AWS_REGION`. Thin wrappers (parse, room description, Acme enrich, hypothesis) import this and set model id and message shape.
- [`extractJsonObjectText.ts`](extractJsonObjectText.ts) -- Strips optional full-wrap fenced **json** blocks, then takes the slice from the first **{** through the last **}**. Used for "JSON somewhere in the blob" recovery; same family of behavior as several hand-rolled extractors in `dataSource/actions` and `generateExample` (candidates for consolidation over time).
- [`splitMarkdownReasoningAndJson.ts`](splitMarkdownReasoningAndJson.ts) -- If the response **ends** in a triple-backtick **json** block, treats the last such fence as the final JSON; otherwise falls back to `extractJsonObjectText` and attributes a **reasoning** prefix. Returns `ok` plus `reasoningMarkdown` and `jsonText`, or an error; does **not** call `JSON.parse` into domain types (callers run existing interpreters and guards).

## Patterns

- **Transport vs parsing:** Invoke helpers return success with a string `body` or a structured failure. Parsers only read that `body`; they stay agnostic to `@tonylb/mtw-interfaces` and action merge rules.
- **Fenced JSON tail:** For prompts that ask for Markdown reasoning and a final JSON object, prefer a **trailing** fenced **json** block so `splitMarkdownReasoningAndJson` can avoid stray braces in prose. If that is not possible, the first-brace heuristic may mis-split; say so in the prompt or add a dedicated delimiter in a follow-up.
- **Tests:** Jest lives next to sources in this folder; run tests from `lambda/ephemera` per `package.json`.

## Integration points

- **Callers of** `invokeBedrockConverseText`: [`../generateExample/AGENT.md`](../generateExample/AGENT.md) (re-exports in [`../generateExample/index.ts`](../generateExample/index.ts)), [`../dataSource/coyoteGame/invokeBedrockHypothesis.ts`](../dataSource/coyoteGame/invokeBedrockHypothesis.ts).
- **Downstream use of** `splitMarkdownReasoningAndJson` / `extractJsonObjectText`: any step that needs a **single JSON object** from a model after optional Markdown (for example Acme order enrich; see [`AGENT.objectAffinities.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectAffinities.plan.md)) should import from here instead of duplicating fence logic.

## Navigation

- Add a new **Converse**-level concern here; add **feature-specific** Bedrock wrappers next to the feature (for example `generateExample` or `dataSource/coyoteGame`) and import the shared pieces from `llm/`.
- Parent: [`../AGENT.md`](../AGENT.md) (ephemera lambda), [`../../../AGENT.md`](../../../AGENT.md) (repo root documentation standards).
