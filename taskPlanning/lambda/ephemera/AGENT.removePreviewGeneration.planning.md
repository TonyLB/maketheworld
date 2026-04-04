# Remove Preview Generation (lambda/ephemera)

**Status:** Task plan (durable). **Charcoal-client:** the remove-preview-generation task (historical `taskPlanning/charcoal-client` plan, now retired) already removed workbench preview UI and client dispatch of `message: 'generateRoomPreview'`. Prefer landing server removal after that baseline, or coordinate removal in the same release window.

## Getting Started

Read **[`taskPlanning/AGENT.md`](../../AGENT.md)** --- **Why**: What belongs in task plans versus durable docs, and how plans are retired when work completes.

Follow the [root "Getting Started" pattern for complex tasks](../../AGENT.md#getting-started-pattern-for-complex-tasks) (7-step orientation). Use this section as the concrete map for **this** task.

1. **Understand project foundations**
   - **[`AGENT.md`](../../AGENT.md)** (repo root) --- **Why**: Monorepo navigation and documentation conventions. **Focus**: How `taskPlanning/` docs relate to `lambda/ephemera` package docs.
   - **[`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md)** --- **Why**: Canonical description of preview vs passive today. **Focus**: Request-scoped `RenderPreviewRequested` vs `RenderRequested`; what disappears vs what must remain (`findRender`, cache miss generation).
   - **[`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md)** --- **Why**: Epic-level throughline (state -> orchestration -> cache -> messages). **Focus**: Why removing preview reduces parallel contracts before you refactor orchestration/cache together.
   - **Charcoal-client (completed)** --- The remove-preview client task is **done** (retired task plan). Workbench no longer routes to preview or sends preview API messages. **Focus**: Server slice can assume no live client callers of that wire; coordinate release window with [`packages/mtw-interfaces` follow-on](../../packages/mtw-interfaces/AGENT.removePreviewGeneration.planning.md) if needed.

2. **Read this document (order)**
   - **Goal** --- preview **ingress** and **conversation type** removed; **`generateRoomPreview.ts`** (orchestration module) **kept** for passive cache miss.
   - **Follow-on (packages)** --- `mtw-interfaces` types are a separate pass; do not block lambda deletion on them if the compiler still allows incremental cleanup.
   - **Recommended order (server)** --- work top-down from `app.ts` and adapters into orchestration, then conversations, then optional internalCache and docs.

3. **Understand core integration points**
   - **`app.ts`**: Maps `generateRoomPreview` API message to `sendRenderPreviewRequested` (bus / streaming path). Removing preview starts here or immediately after client stops sending.
   - **`orchestrationHandler.ts`**: The **`isRenderPreviewRequested`** branch registers `CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW` **before** intake and uses **stubbed** `findRender` deps (`getCacheRecordById` no-op). That is the fork you eliminate; passive keeps real pointer deps.
   - **`conversations/conversationTypes/generateRoomPreview/`**: Only serves preview streaming; safe to remove with the preview branch (distinct from **`generateRoomPreview`** function in `renderOrchestration/`).

4. **Review implemented code (concrete entry points)**
   - [`app.ts`](../../lambda/ephemera/app.ts) --- `isGenerateRoomPreviewAPIMessage` block.
   - [`dataSource/renderOrchestration/orchestrationHandler.ts`](../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) --- full preview branch vs passive branch.
   - [`dataSource/renderOrchestration/requestIntake.ts`](../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts) --- `RenderPreviewRequested` fast path.
   - [`dataSource/apiEphemera.ts`](../../lambda/ephemera/dataSource/apiEphemera.ts) --- `Generate Room Preview` streaming envelope (if still used only for this API).

5. **Check testing patterns**
   - [`orchestrationHandler.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts) --- `RenderPreviewRequested` / preview `describe` blocks.
   - [`requestIntake.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.test.ts), [`index.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/index.test.ts), [`subscribedEvents.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.test.ts), [`apiEphemera.test.ts`](../../lambda/ephemera/dataSource/apiEphemera.test.ts) --- preview-specific cases.
   - **Key insight**: After removal, passive-only tests should still cover `findRender` + `generateRoomPreview` on miss.

6. **Identify next task**
   - Use **Recommended order (server)** as the checklist; finish **Entry and streaming adapters** before deleting conversation types so orchestration compiles at each step.

7. **Run tests before starting (baseline)**
   - From repo root: `cd lambda/ephemera && npx tsc --noEmit` --- expect clean.
   - `cd lambda/ephemera && npx jest dataSource/renderOrchestration conversations --passWithNoTests` (adjust to your usual Jest scope) --- note pass count before edits.
   - Re-run `tsc` and targeted Jest after each logical chunk.

## Goal

Remove the **preview** branch of render orchestration: `RenderPreviewRequested` ingress, `RenderPreviewRequested` / `Generate Room Preview` api.ephemera wiring, and the **`generateRoomPreview` conversation type** used only for request-scoped preview streaming. Preserve **`generateRoomPreview`** in [`dataSource/renderOrchestration/generateRoomPreview.ts`](../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) and **`findRender`** --- passive **`RenderRequested`** still uses generation on cache miss.

## Follow-on (packages)

**Interfaces and wire contracts** for Ephemera API and client messages (`GenerateRoomPreviewAPIMessage`, `isGenerateRoomPreviewAPIMessage`, `EphemeraClientMessageConversationStepGenerateRoomPreview`, legacy `GenerateRoomPreview` client message, terminal helpers such as `isConversationStepGenerateRoomPreview`, etc.) live in **`packages/mtw-interfaces`**. After this lambda slice is clean and the compiler reports remaining references, execute:

[`taskPlanning/packages/mtw-interfaces/AGENT.removePreviewGeneration.planning.md`](../../packages/mtw-interfaces/AGENT.removePreviewGeneration.planning.md)

That document narrows or removes the types above, regenerates **`dist/`** if applicable, and fixes any remaining imports across the monorepo.

## Recommended order (server)

1. **Entry and streaming adapters**
   - [`app.ts`](../../lambda/ephemera/app.ts): remove `isGenerateRoomPreviewAPIMessage` handling and `sendRenderPreviewRequested` usage.
   - [`dataSource/apiEphemera.ts`](../../lambda/ephemera/dataSource/apiEphemera.ts): remove `Generate Room Preview` envelope guards, `sendGenerateRoomPreview`, and tests in [`apiEphemera.test.ts`](../../lambda/ephemera/dataSource/apiEphemera.test.ts).
   - [`dataSource/localApiEvents.ts`](../../lambda/ephemera/dataSource/localApiEvents.ts): remove `GenerateRoomPreviewCommand` / `isGenerateRoomPreviewCommand` if only used for the above (adjust unions that reference them).

2. **renderOrchestration**
   - [`subscribedEvents.ts`](../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts): remove `Render Preview Requested` ingress helpers and `sendRenderPreviewRequested`.
   - [`index.ts`](../../lambda/ephemera/dataSource/renderOrchestration/index.ts): drop `isRenderPreviewRequestedIngressEnvelope` branch and preview command mapping.
   - [`orchestrationHandler.ts`](../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts): remove the entire **`isRenderPreviewRequested`** branch; passive path only. Drop imports only used by that branch (e.g. generate-room-preview composite handle guard).
   - [`requestIntake.ts`](../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.ts): remove `RenderPreviewRequested` branch; signature may narrow to `RenderRequested` only.
   - [`events.ts`](../../lambda/ephemera/dataSource/renderOrchestration/events.ts) (and [`baseClasses.ts`](../../lambda/ephemera/dataSource/renderOrchestration/baseClasses.ts) if applicable): remove `RenderPreviewRequested` types and guards.
   - Tests: [`orchestrationHandler.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts) (preview `describe` blocks), [`requestIntake.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/requestIntake.test.ts), [`index.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/index.test.ts), [`subscribedEvents.test.ts`](../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.test.ts).

3. **Conversations**
   - Remove the [`conversations/conversationTypes/generateRoomPreview/`](../../lambda/ephemera/conversations/conversationTypes/generateRoomPreview/) module (materialize, baseClasses, `renderResolveOutputToGenerateRoomPreviewResult`, tests).
   - Update [`conversationTypes/index.ts`](../../lambda/ephemera/conversations/conversationTypes/index.ts), [`compositeRead.ts`](../../lambda/ephemera/conversations/conversationTypes/compositeRead.ts), [`storableConversationRecord.ts`](../../lambda/ephemera/conversations/conversationTypes/storableConversationRecord.ts), [`handle.ts`](../../lambda/ephemera/conversations/conversationTypes/handle.ts), [`conversations/index.ts`](../../lambda/ephemera/conversations/index.ts), and [`registry.test.ts`](../../lambda/ephemera/conversations/registry.test.ts) to drop `CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW` and generate-room-preview handles.

4. **internalCache (optional cleanup)**
   - Evaluate [`PreviewGenerationRequestsData`](../../lambda/ephemera/internalCache/previewGenerationRequests.ts): if unused outside tests / `clear()`, remove the class, [`previewGenerationRequests.test.ts`](../../lambda/ephemera/internalCache/previewGenerationRequests.test.ts), and wiring in [`internalCache/index.ts`](../../lambda/ephemera/internalCache/index.ts).

5. **messageBus / cross-package**
   - If `RenderPreviewRequested` appears in [`lambda/ephemera/messageBus`](../../lambda/ephemera/messageBus) or shared types, remove or narrow with the same change set.

6. **Documentation**
   - Update [`dataSource/renderOrchestration/AGENT.md`](../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md), [`renderCache/AGENT.md`](../../lambda/ephemera/renderCache/AGENT.md), and any planning docs that describe preview ingress, `RenderPreviewRequested`, or preview vs passive split.

## Verification

- `npx tsc --noEmit` in `lambda/ephemera`.
- Jest for affected packages.
- Repo-wide `grep` for `RenderPreviewRequested`, `Render Preview Requested`, `sendRenderPreviewRequested`, `CONVERSATION_TYPE_GENERATE_ROOM_PREVIEW`, `generateRoomPreview` **conversation type** (distinguish from **`generateRoomPreview` function**).
