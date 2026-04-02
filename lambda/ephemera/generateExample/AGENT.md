# Ephemera GenerateExample - AGENT

`lambda/ephemera/generateExample/` owns **Bedrock-backed room description generation** for cache examples.

When no exact cache match exists, this module builds a prompt from generation context (Room, Lens, Marks, Guidance) and cached examples, invokes Bedrock Nova 2 Lite, and parses the model JSON into `EphemeraCacheRenderedContent`. It depends on `renderCache/baseClasses` for the example shape and record types.

## Scope

- `generateRoomDescription`: orchestrates prompt build, Bedrock invoke, JSON parse/validate.
- `buildRoomDescriptionPrompt`: converts `StandardForm` + cached examples to plain-text prompt.
- `invokeBedrockRoomDescription`: AWS Bedrock client call with timeout.

Consumers: `dataSource/renderOrchestration/generateRoomPreview` (room cache-miss flow). The orchestration layer decides when to generate; this module performs the LLM work.
