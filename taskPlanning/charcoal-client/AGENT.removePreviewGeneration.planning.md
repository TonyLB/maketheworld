# Remove Preview Generation (charcoal-client)

**Status:** Task plan (durable). Execute in order with the sibling [lambda/ephemera plan](../lambda/ephemera/AGENT.removePreviewGeneration.planning.md); client changes should land so nothing still dispatches preview APIs before or with server handler removal.

## Getting Started

Follow the [root "Getting Started" pattern for complex tasks](../../AGENT.md#getting-started-pattern-for-complex-tasks) (7-step orientation). Use this section as the concrete map for **this** task.

1. **Understand project foundations**
   - **[`AGENT.md`](../../AGENT.md)** (repo root) --- **Why**: Monorepo navigation and documentation conventions. **Focus**: How durable planning under `taskPlanning/` relates to package `AGENT.md` files.
   - **[`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md)** --- **Why**: Workbench vs play mode and client architecture. **Focus**: Where authoring UI lives before you edit Room / Workbench components.
   - **[`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md)** --- **Why**: Epic context for the **throughline** you are aligning with by removing preview. **Focus**: State, orchestration, cache, conversations, lifeLine boundaries.
   - **[`charcoal-client/src/slices/lifeLine/AGENT.md`](../../charcoal-client/src/slices/lifeLine/AGENT.md)** --- **Why**: Preview today uses `socketDispatchPromise` / `ConversationStep` terminal rules. **Focus**: `isTerminalConversationStep`, legacy `GenerateRoomPreview`, and `pipeline: 'generateRoomPreview'` (what to delete or simplify from docs).

2. **Read this document (order)**
   - **Goal** --- what stays vs goes (preview wire and UI only; not the server `generateRoomPreview` implementation).
   - **Recommended order** --- execution sequence; start with UI so nothing routes to a removed editor.
   - **Verification** --- grep and test commands before you declare the slice done.

3. **Understand core integration points**
   - **Workbench routing**: `preview:${roomId}` is a synthetic `currentComponentId` that selects `RoomPreviewEditor` in `WorkbenchAssetEditor`; removing preview means removing that branch and the breadcrumb that enters it from `RoomEditor`.
   - **API dispatch**: `RoomPreviewEditor` uses **`socketDispatchPromise`** with `message: 'generateRoomPreview'` (see component source). No other feature should keep that message after this task.
   - **Inbound messages**: Terminals and `ConversationStep` shapes for preview are documented in lifeLine AGENT and tested in `socketDispatchConversation.test.ts` --- trim only what is preview-specific.

4. **Review implemented code (concrete entry points)**
   - [`RoomPreviewEditor.tsx`](../../charcoal-client/src/components/Workbench/RoomEdit/RoomPreviewEditor.tsx) --- full preview flow (dispatch + result handling).
   - [`WorkbenchAssetEditor.tsx`](../../charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx) --- `preview:` branch.
   - [`RoomEditor.tsx`](../../charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx) --- navigation into preview.
   - [`index.api.ts`](../../charcoal-client/src/slices/lifeLine/index.api.ts) --- `socketDispatchPromise` / `socketDispatchConversation` (shared infra; do not remove wholesale).

5. **Check testing patterns**
   - [`socketDispatchConversation.test.ts`](../../charcoal-client/src/slices/lifeLine/socketDispatchConversation.test.ts) --- preview-specific assertions; preserve tests that cover generic terminal / correlation behavior.
   - Run the same test file after edits to confirm nothing unrelated regressed.

6. **Identify next task**
   - Use **Recommended order** in this file as the checklist; complete **UI and navigation** before lifeLine/doc cleanup so grep-driven cleanup is unambiguous.

7. **Run tests before starting (baseline)**
   - From repo root: `cd charcoal-client && npm test -- --testPathPattern=lifeLine` (or your project's usual Jest entrypoint).
   - **Expect**: Existing suite passes; note failures before changing code. After edits, rerun the same command plus a full `npm test` if you touched shared modules.

## Goal

Remove the **development-only** workbench path that calls `message: 'generateRoomPreview'` and consumes `GenerateRoomPreview` / correlated `ConversationStep` results, so the client aligns with the **throughline** (room state update -> passive render -> messages) and no longer depends on preview-specific wire shapes.

## Recommended order

1. **UI and navigation**
   - Remove [`RoomPreviewEditor`](../../charcoal-client/src/components/Workbench/RoomEdit/RoomPreviewEditor.tsx) (or delete the file after stripping imports).
   - In [`WorkbenchAssetEditor`](../../charcoal-client/src/components/Workbench/WorkbenchAssetEditor.tsx), remove the `preview:${roomId}` branch and `RoomPreviewEditor` import.
   - In [`RoomEditor`](../../charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx), remove breadcrumb / navigation entries that target `preview:${universalKey}` (and any copy that advertises Preview).
   - In [`WorkbenchContainer`](../../charcoal-client/src/components/Workbench/WorkbenchContainer.tsx), remove handling for `universalKey` values that start with `preview:` (if present only for this flow).

2. **LifeLine / Redux integration**
   - [`socketDispatchPromise`](../../charcoal-client/src/slices/lifeLine/index.api.ts): no longer needed **for this feature** from `RoomPreviewEditor`; confirm no other callers use `message: 'generateRoomPreview'` (grep the repo).
   - [`index.ts`](../../charcoal-client/src/slices/lifeLine/index.ts): stop re-exporting [`isConversationStepGenerateRoomPreview`](../../packages/mtw-interfaces/ts/ephemera.ts) if nothing imports it after cleanup.
   - Update [`socketDispatchConversation.test.ts`](../../charcoal-client/src/slices/lifeLine/socketDispatchConversation.test.ts): remove or rewrite tests that assert **`GenerateRoomPreview`** legacy terminals or **`pipeline: 'generateRoomPreview'`** `ConversationStep` behavior **if** those tests exist only for preview (keep generic terminal behavior tests if still valid for other pipelines).
   - Update [`charcoal-client/src/slices/lifeLine/AGENT.md`](../../charcoal-client/src/slices/lifeLine/AGENT.md): delete or shorten sections that document preview correlation, `GenerateRoomPreview` one-shot, and `generateRoomPreview` pipeline steps.

3. **Comments and shared libs (non-blocking)**
   - Trim or rephrase comments in [`situationLabel.ts`](../../charcoal-client/src/lib/situationLabel.ts), [`buildGenerationContextSubset.ts`](../../charcoal-client/src/lib/buildGenerationContextSubset.ts), and [`perspectiveFromOrigins.ts`](../../charcoal-client/src/lib/perspectiveFromOrigins.ts) that reference **generateRoomPreview** as the **caller** if misleading after removal (they may still describe mark shape for other uses).

4. **Types and interfaces**

   Shared API and client message types live in **`@tonylb/mtw-interfaces`**. Do **not** delete `GenerateRoomPreviewAPIMessage`, `EphemeraClientMessageConversationStepGenerateRoomPreview`, etc. here until the **packages** task plan exists and TypeScript reports no remaining references. Track that work under `taskPlanning/packages/mtw-interfaces/AGENT.removePreviewGeneration.planning.md` (created after lambda cleanup).

## Verification

- `grep` charcoal-client for `generateRoomPreview`, `GenerateRoomPreview`, `preview:`, `RoomPreviewEditor` -> no stale product code (tests/docs may mention history briefly).
- Build and test charcoal-client (unit tests for lifeLine as needed).
