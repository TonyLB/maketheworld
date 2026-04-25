# Render Orchestration Code Bloat Cleanup Plan

**Status:** In progress. Inventory is underway; one bloat pattern is identified in render-orchestration `look`, and additional pattern discovery remains open.

## Purpose

Track focused cleanup of hallucinatory or untethered code introduced during the `look room` affordance work, starting with a grounded inventory in render orchestration and then expanding into concrete cleanup tasks as findings emerge.

This is a task-scoped planning document and should be retired when cleanup is complete.

## Getting started

1. Review task-plan conventions in [`taskPlanning/AGENT.md`](../../../../../AGENT.md).
2. Review local implementation context in [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md).
3. Start inventory in [`lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts`](../../../../../../lambda/ephemera/dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts).

## Recommended order

Use `[ ]` for pending and `[X]` for complete. Mark nested lines as you finish each sub-step.

- [ ] Inventory bloat patterns in `handleLookCommandRequestedForRenderOrchestration`.
- [ ] Replace deterministic `lookCommandPerceptionThreadLaneId(...)` usage with run-scoped unique lane IDs in `handleLookCommandRequestedForRenderOrchestration`.
  - [ ] Generate lane with `uuidv4()` at point-of-use (only to bind `sendPerceptionThreadRegistered(...)` to `flush(laneId)`).
  - [ ] Remove `lookCommandPerceptionThreadLaneId(...)` helper from `renderOrchestration/subscribedEvents.ts` and update docs/comments referencing "named" look lane semantics.
  - [ ] Update/add tests to assert ordering behavior without depending on roomId/characterId-derived lane strings.
- [ ] Remove `generationContextWml` semantic drift from `prepareFullRoomDescriptionRenderForCharacter` default behavior.
  - [ ] Stop populating `renderCommand.generationContextWml` from `internalCache.ComponentRender.get(...)` in `requestFullRoomDescriptionForCharacter.ts`.
  - [ ] Define and use a generation-oriented context source (structured model or minimal provisional subset) for room look generation, rather than render-delivery-shaped `ComponentRender` output.
  - [ ] Make provisional generation-context merge deterministic by iterating room metadata in `assetStack` order (not `Object.values(...)` order) in `handleLookCommandRequestedForRenderOrchestration.ts`.
  - [ ] Update tests/docs that currently assume `ComponentRender`-derived generation context on this path.
- [ ] Follow-up cleanup pass: check other lane+flush call sites for unnecessary semantic coupling as adjacent work is touched.
  - [ ] Keep `coyoteGame` run-scoped lane pattern (`uuidv4`-derived `hypothesisId`/`outcomeId`) unless a concrete requirement calls for different shape.

## Inventory: `await messageBus.flush(...)` in `lambda/ephemera`

Scope: production code paths (tests excluded), focusing on the pattern "send on intermediate lane, then flush that lane while default-lane work may still be in flight."

This inventory section is intentionally incremental. Keep adding findings as additional bloat patterns are discovered.

- `renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts`
  - Pattern: `lookCommandPerceptionThreadLaneId({ roomId, characterId })` -> `sendPerceptionThreadRegistered(..., lane)` -> `await messageBus.flush(lane)`.
  - Finding: **Bloat / risk present.** Lane identity is deterministically tied to room+character, which is not required for correctness in this cascade; lane only needs per-run linkage between send and flush.
  - Cleanup direction: replace with local run-scoped unique lane (for example `uuidv4()`), remove deterministic helper.

- `coyoteGame/handleObjectsChangedForHypothesis.ts`
  - Pattern: `hypothesisId` uses `uuidv4()`, lane is `hypothesisLane:${hypothesisId}`, then `await Promise.all([flush(lane), remainder()])`.
  - Finding: **No equivalent bloat found.** Lane is run-scoped and unique; semantic prefix is descriptive only.

- `coyoteGame/handleAwaitRoadRunnerForPlanOutcome.ts`
  - Pattern: `outcomeId` uses `uuidv4()`, lane is `outcomeLane:${outcomeId}`, then `await Promise.all([flush(lane), remainder()])`.
  - Finding: **No equivalent bloat found.** Lane is run-scoped and unique; no deterministic entity coupling.

- `coyoteGame/runCoyoteEngineTestHarness.ts`
  - Pattern: local `laneId = uuidv4()`, `send(..., laneId)`, then `await flush(laneId)` per fixture.
  - Finding: **No equivalent bloat found.** Already the minimal run-scoped pattern.

## Inventory: `generationContextWml` semantic drift

Scope: identify places where generation context is sourced from render-delivery shapes (`ComponentRender`) rather than generation-oriented context data.

- `actions/requestFullRoomDescriptionForCharacter.ts`
  - Pattern: default path sets `renderCommand.generationContextWml = schemaToWML([ComponentRender.get(...).schema])`.
  - Finding: **Bloat / semantic drift present.** Generation context is populated from a broad room render/structure shape (legacy one-channel gravity), not a generation-specific context model.
  - Cleanup direction: decouple generation context assembly from `ComponentRender`; use generation-oriented context source and keep `renderCommand` focused on render orchestration inputs.

- `renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts` (`provisionalGenerationContextWmlFromRoomShortName`)
  - Pattern: merges `StandardRoom` values via `Object.values(roomMetaByAsset)` rather than explicit `assetStack` sequencing.
  - Finding: **Bloat / correctness risk present.** Effective merge precedence is object-iteration-driven rather than semantic ordering.
  - Cleanup direction: build the merge input list by walking `assetStack` and selecting room metadata in that order.

## Verification

- Keep this document updated as inventory findings are completed and as new cleanup tasks are added.
- For each completed cleanup item added from the inventory, link the touched code paths and record verification commands/results inline.
