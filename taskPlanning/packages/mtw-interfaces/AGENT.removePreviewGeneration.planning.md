# Remove Preview Generation (`@tonylb/mtw-interfaces`)

**Status:** In progress. **API surface in [`ephemera.ts`](../../../packages/mtw-interfaces/ts/ephemera.ts):** **Complete** (preview API message types and `isEphemeraAPIMessage` branch removed). **Remaining:** client message types and helpers, [`ephemera.test.ts`](../../../packages/mtw-interfaces/ts/ephemera.test.ts), monorepo consumers if any. **Prerequisites (lambda):** **Complete.** Preview ingress, preview conversation type, and related wiring were removed from `lambda/ephemera`; steady-state behavior is documented in [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) and [`lambda/ephemera/conversations/AGENT.md`](../../../lambda/ephemera/conversations/AGENT.md). **Charcoal-client:** the remove-preview client task is **complete** (retired `taskPlanning/charcoal-client` plan); workbench preview and `generateRoomPreview` dispatch are gone---this package pass finishes obsolete **shared wire types** for preview on the server-to-client side.

## Getting Started

Read **[`taskPlanning/AGENT.md`](../../AGENT.md)** --- **Why**: What belongs in task plans versus durable docs, durability ladder, and how plans are retired.

Follow the [root "Getting Started" pattern for complex tasks](../../../AGENT.md#getting-started-pattern-for-complex-tasks) (7-step orientation). Use this section as the concrete map for **this** task.

1. **Understand project foundations**
   - **[`packages/mtw-interfaces/AGENT.md`](../../../packages/mtw-interfaces/AGENT.md)** --- **Why**: Role of the package as shared wire contracts. **Focus**: Ephemera API vs client message categories; do not duplicate long-form protocol docs here.
   - **[`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md)** and **[`lambda/ephemera/conversations/AGENT.md`](../../../lambda/ephemera/conversations/AGENT.md)** --- **Why**: Current passive orchestration and **`roomStateRender`** conversations; distinction between removed **`generateRoomPreview` conversation** and the **`generateRoomPreview`** cache-miss helper in `renderOrchestration/`. **Focus**: Confirm lambda no longer imports preview-only shapes before deleting types here.
   - **Charcoal-client (completed)** --- No production dispatch of `message: 'generateRoomPreview'`; see [`charcoal-client/src/slices/lifeLine/AGENT.md`](../../../charcoal-client/src/slices/lifeLine/AGENT.md) for **`socketDispatchConversation`** framework notes. **Focus**: Preview-only terminal types become removable here once lambda and **`tsc`** allow.

2. **Read this document (order)**
   - **Goal** --- remove Ephemera **API** and **client** types and guards that exist only for preview generation and its `ConversationStep` pipeline, after downstream code no longer imports them.
   - **Non-goal** --- documenting passive render contracts (unchanged).
   - **Recommended order** --- prerequisites, then edit [`ephemera.ts`](../../../packages/mtw-interfaces/ts/ephemera.ts) in coherent chunks (API union, client union, helpers, tests), then fix any remaining monorepo imports. **`dist/`** is gitignored and not imported by this monorepo (consumers use `@tonylb/mtw-interfaces/ts/...`); no compiled artifact step for this task.

3. **Understand core integration points**
   - **API (client to server):** **Removed.** Former `GenerateRoomPreviewAPIMessage`, `isGenerateRoomPreviewAPIMessage`, and the `generateRoomPreview` branch of [`EphemeraAPIMessage`](../../../packages/mtw-interfaces/ts/ephemera.ts) / [`isEphemeraAPIMessage`](../../../packages/mtw-interfaces/ts/ephemera.ts) are no longer in [`ephemera.ts`](../../../packages/mtw-interfaces/ts/ephemera.ts).
   - **Client (server to client):** [`GenerateRoomPreviewBody`](../../../packages/mtw-interfaces/ts/ephemera.ts), [`ConversationStepPipeline`](../../../packages/mtw-interfaces/ts/ephemera.ts) (currently only `'generateRoomPreview'`), [`EphemeraClientMessageConversationStepGenerateRoomPreview`](../../../packages/mtw-interfaces/ts/ephemera.ts) and related extracted types, legacy [`EphemeraClientMessageGenerateRoomPreview`](../../../packages/mtw-interfaces/ts/ephemera.ts), narrowing helpers [`isEphemeraClientMessageGenerateRoomPreview`](../../../packages/mtw-interfaces/ts/ephemera.ts), [`isEphemeraClientMessageConversationStep`](../../../packages/mtw-interfaces/ts/ephemera.ts), [`isConversationStepGenerateRoomPreview`](../../../packages/mtw-interfaces/ts/ephemera.ts) / [`isGenerateRoomPreviewConversationStep`](../../../packages/mtw-interfaces/ts/ephemera.ts).
   - **Cross-cutting:** [`isTerminalConversationStep`](../../../packages/mtw-interfaces/ts/ephemera.ts) (default terminal detection for multi-message streams) references preview-shaped payloads; narrow or rewrite when preview steps are gone. [`isEphemeraClientMessage`](../../../packages/mtw-interfaces/ts/ephemera.ts) switch cases for `ConversationStep` and `GenerateRoomPreview`.

4. **Review implemented code (concrete entry points)**
   - [`packages/mtw-interfaces/ts/ephemera.ts`](../../../packages/mtw-interfaces/ts/ephemera.ts) --- primary edit surface.
   - [`packages/mtw-interfaces/ts/ephemera.test.ts`](../../../packages/mtw-interfaces/ts/ephemera.test.ts) --- preview-specific suites and assertions to delete or replace.

5. **Check testing patterns**
   - Package uses **Jest** (`npm test` from [`packages/mtw-interfaces`](../../../packages/mtw-interfaces)). Run [`ephemera.test.ts`](../../../packages/mtw-interfaces/ts/ephemera.test.ts) after edits.
   - `npx tsc --noEmit -p tsconfig.ref.json` in `packages/mtw-interfaces` --- expect clean before declaring done.

6. **Identify next task**
   - Use **Recommended order** below. **Do not** delete exported names while `lambda/ephemera` or other packages still import them unless you are shipping a coordinated multi-package change.

7. **Run tests before starting (baseline)**
   - `cd packages/mtw-interfaces && npm test` --- note pass count.
   - Optional: `npx tsc --noEmit -p tsconfig.ref.json` --- baseline typecheck.

## Goal

Remove shared **wire types and runtime guards** for preview-only Ephemera flows. **Done:** the `generateRoomPreview` API message shape and related guards. **Still to do:** the `GenerateRoomPreview` / `ConversationStep` + `pipeline: 'generateRoomPreview'` client message shapes and associated type guards---after the **lambda** preview ingress and conversation type are gone and **`tsc`/grep** show no remaining legitimate references. Keeps `@tonylb/mtw-interfaces` aligned with the perception throughline (state update, passive render, messages) without carrying obsolete preview contracts.

## Progress

| Step | Area | State |
| --- | --- | --- |
| 0 | Prerequisites | **Confirmed.** Lambda and other packages outside `mtw-interfaces` do not import preview-only wire types; repo-wide grep is clean for `GenerateRoomPreview*`, API `generateRoomPreview`, preview `ConversationStep` helpers, and related guards (remaining references are in `packages/mtw-interfaces` only). Next: client surface, helpers, tests, consumers. |
| 1 | `ephemera.ts` API surface | **Complete.** Dropped `GenerateRoomPreviewAPIMessage` (and mark-state aliases), removed from `EphemeraAPIMessage` union, deleted `isGenerateRoomPreviewAPIMessage`, removed `generateRoomPreview` branch from `isEphemeraAPIMessage`, removed `ephemeraMeta` import used only for that guard. |
| 2 | `ephemera.ts` client surface | **Pending.** Remove preview `ConversationStep` types (today `ConversationStepPipeline` is only `'generateRoomPreview'`; if no pipeline remains, remove `EphemeraClientMessageConversationStep` from [`EphemeraClientMessage`](../../../packages/mtw-interfaces/ts/ephemera.ts) until a new pipeline is added). Remove legacy `EphemeraClientMessageGenerateRoomPreview` and its guard; update `isEphemeraClientMessage` accordingly. |
| 3 | Helpers | **Pending.** Update [`isTerminalConversationStep`](../../../packages/mtw-interfaces/ts/ephemera.ts) so default terminal behavior matches remaining message shapes (typically `Error` and any future `ConversationStep` pipelines). Remove or repurpose preview-only exports (`isConversationStepGenerateRoomPreview`, etc.). |
| 4 | Tests | **Pending.** Update [`ephemera.test.ts`](../../../packages/mtw-interfaces/ts/ephemera.test.ts). **`dist/`** is not tracked (`.gitignore` `**/dist/*`) and is not part of the deliverable; optional local `npx tsc` output can be deleted anytime. |
| 5 | Monorepo consumers | **Pending.** Fix imports in any package that still referenced removed symbols (often discovered by `tsc` at repo root or in dependents). |

## Recommended order

Use `- [ ]` while work is pending and `- [X]` when the line is complete.

1. [X] **Confirm prerequisites** --- Verify `lambda/ephemera` no longer depends on preview-only wire types (see [`renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md)). Run repo-wide search for `GenerateRoomPreview`, `generateRoomPreview` (message and pipeline strings), `isGenerateRoomPreviewAPIMessage`, `isConversationStepGenerateRoomPreview`, etc., and fix any stragglers outside this package **before** editing exports here, unless you are doing one coordinated PR.

2. [X] **Edit `ephemera.ts` (API first)** --- Remove preview API types and guards; shrink unions and `switch` cases so `tsc` passes inside `mtw-interfaces`.

3. [ ] **Edit `ephemera.ts` (client and helpers)** --- Remove preview client message variants; simplify `ConversationStep` / `EphemeraClientMessage` / `isTerminalConversationStep` as needed. If no `ConversationStep` pipelines remain, the union may drop `EphemeraClientMessageConversationStep` entirely (document that extension point for future pipelines).

4. [ ] **Tests** --- Update [`ephemera.test.ts`](../../../packages/mtw-interfaces/ts/ephemera.test.ts); keep coverage for remaining guards.

5. [ ] **Consumers** --- Resolve any remaining compile errors in `lambda/ephemera`, `charcoal-client`, or other packages that imported removed symbols.

**`dist/`:** Removed from the working tree for this package; gitignored and unused by imports (monorepo uses `ts/` paths). Regenerate with `npx tsc` in [`packages/mtw-interfaces`](../../../packages/mtw-interfaces) only if an external workflow needs compiled output---not required for this initiative.

## Verification

- `cd packages/mtw-interfaces && npm test` --- all tests pass.
- `cd packages/mtw-interfaces && npx tsc --noEmit -p tsconfig.ref.json` --- clean (use [`tsconfig.ref.json`](../../../packages/mtw-interfaces/tsconfig.ref.json); bare `tsc --noEmit` can error because the base [`tsconfig.json`](../../../packages/mtw-interfaces/tsconfig.json) has no `include` and may pull in `jest.config.js`).
- Repo-wide `grep` (or IDE references) for removed symbol names --- no stale imports.
- Optional: run dependent packages' `tsc` / tests if your workflow validates the monorepo after interface changes.

## Relationship to other plans

| Document | Role |
| --- | --- |
| Charcoal-client remove-preview task | **Completed** (retired task plan). Client UI and dispatch work shipped; durable notes in [`charcoal-client/src/slices/lifeLine/AGENT.md`](../../../charcoal-client/src/slices/lifeLine/AGENT.md). Interface deletion is **this** plan. |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md), [`lambda/ephemera/conversations/AGENT.md`](../../../lambda/ephemera/conversations/AGENT.md) | Durable server behavior after preview removal; `mtw-interfaces` edits should align with these contracts. |

When this initiative is complete, archive or delete this plan per [`taskPlanning/AGENT.md`](../../AGENT.md); move any lasting protocol notes into [`packages/mtw-interfaces/AGENT.md`](../../../packages/mtw-interfaces/AGENT.md) if still useful after merge.
