# Ephemera GenerateExample - AGENT

`lambda/ephemera/generateExample/` owns **Bedrock-backed** helpers used from ephemera: shared **Converse** plumbing, **room description** generation for cache examples, and **command parse** invocation (prompting and parse wiring live with the actions DataSource as that work lands).

When no exact cache match exists, room flow builds a prompt from generation context (Room, Lens, Marks, Guidance) and cached examples, invokes Bedrock Nova 2 Lite, and parses the model JSON into `EphemeraCacheRenderedContent`. It depends on [`dataSource/renderCache/baseClasses.ts`](../dataSource/renderCache/baseClasses.ts) for the example shape and record types.

## Scope

- Shared Bedrock **`Converse`** plumbing lives in [`../llm/invokeBedrockConverseText.ts`](../llm/invokeBedrockConverseText.ts) (`invokeBedrockConverseText`, re-exported from this package `index`).
- `invokeBedrockRoomDescription`: room-description defaults on top of `invokeBedrockConverseText`.
- `invokeBedrockParseCommand`: parse-oriented defaults (lower max tokens, lower temperature) on top of `invokeBedrockConverseText`; defaults to **Nova Micro** for Step A intent classification unless `model` / `modelId` override is provided.
- `invokeBedrockAcmeOrderEnrich`: Step B Acme enrich defaults to **Nova 2 Lite** (higher-output JSON path), separate from Step A parse default.
- `generateRoomDescription`: orchestrates prompt build, Bedrock invoke, JSON parse/validate.
- `buildRoomDescriptionPrompt`: converts `StandardForm` + cached examples to plain-text prompt.

Consumers: `dataSource/renderOrchestration/generateRoomPreview` (room cache-miss flow). The orchestration layer decides when to generate; this module performs the LLM work.
