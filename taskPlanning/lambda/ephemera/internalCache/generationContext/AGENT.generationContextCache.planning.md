# Generation context cache (`internalCache/generationContext`)

**Status:** In progress. MVP short-name stub is landed. Next step: lock the canonical structured shape and `(roomId, perspectiveKey)` cache keys.

Skim [`taskPlanning/AGENT.md`](../../../../../AGENT.md) once for durability expectations, what belongs
in task plans vs durable package docs, and recommended-order checkbox conventions.

## Purpose

Create a new internal cache for generation context so room-description generation is grounded in a
**structured semantic model** (room/lens/guidance/marks) keyed by **`roomId` + `perspectiveKey`**,
rather than relying on WML built from renderer-oriented `ComponentRender` output.

## Relationship to existing code

- Current generation entrypoint accepts optional `generationContextWml`:
  [`generateRoomPreview.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts)
- Prompt builder reads specific semantics from parsed context:
  [`buildRoomDescriptionPrompt.ts`](../../../../../lambda/ephemera/generateExample/buildRoomDescriptionPrompt.ts)
- Existing renderer-oriented source often used for context:
  [`componentRender.ts`](../../../../../lambda/ephemera/internalCache/componentRender.ts)
- Structural room merge baseline:
  [`componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts)
- Durable contract home for the new cache:
  [`lambda/ephemera/internalCache/generationContext/AGENT.md`](../../../../../lambda/ephemera/internalCache/generationContext/AGENT.md)

## Getting started

1. **Durability framework** --- [`taskPlanning/AGENT.md`](../../../../../taskPlanning/AGENT.md)
2. **Prompt consumer semantics** --- [`buildRoomDescriptionPrompt.ts`](../../../../../lambda/ephemera/generateExample/buildRoomDescriptionPrompt.ts)
3. **Render orchestration handoff** --- [`generateRoomPreview.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts)
4. **Current context source** --- [`requestFullRoomDescriptionForCharacter.ts`](../../../../../lambda/ephemera/dataSource/actions/requestFullRoomDescriptionForCharacter.ts)
5. **Internal cache conventions** --- [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md)

## Material decisions to lock

| Topic | Decision target |
| --- | --- |
| Canonical data model | Typed object schema first; WML optional derived encoding |
| Cache key | `roomId + perspectiveKey` |
| Required fields | room shortName, mark dimensions/labels, guidance blocks (and explicit extensibility points) |
| Provenance | Include metadata for debug/freshness (source and timestamps/version hints) |
| Boundary use | Orchestration reads structured context, then emits existing wire field as needed |
| Backward compatibility | Keep current generation path working while migration lands |

## Progress

| Area | State |
| --- | --- |
| Durable contract doc created under `internalCache/generationContext` | Done |
| Task-plan scaffold with status/progress/recommended order | Done |
| Canonical TypeScript shape for generation-context cache value | MVP short-name shape done |
| Cache implementation (`internalCache/generationContext/index.ts`) | MVP stub done |
| InternalCache wiring (`internalCache/index.ts`) | MVP wiring done |
| Source extraction logic (room + marks + guidance by perspective) | |
| Orchestration integration (replace `ComponentRender` dependency) | |
| Tests (unit + integration) | MVP-targeted tests done |
| Durable docs touch-up outside task plan | |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] First-draft MVP: add stub `internalCache.GenerationContext` that derives room short-name context from `ComponentData` (without introducing significant standalone cache storage yet).
  - [X] Return the minimal typed shape needed for current look orchestration context, e.g. `{ componentId: ComponentUUID; shortName: StandardLiteral }`.
  - [X] Implement it using standard `internalCache` construction patterns (new handler wired through `internalCache/index.ts`), with `ComponentData` as its primary dependency/input source.
  - [X] Keep this MVP focused on derivation and API shape; defer broader room/lens/guidance/marks caching behavior to follow-on items below.
- [ ] Define second-iteration data shape by expanding the current minimal cache value to include additional structured fields (for example `lens` and `guidance`) under [`lambda/ephemera/internalCache/generationContext/`](../../../../../lambda/ephemera/internalCache/generationContext/).
- [ ] Implement cache key helper for `(roomId, perspectiveKey)` and clear/invalidate behavior aligned to `DeferredCache` patterns in [`internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md).
- [ ] Implement source assembly for structured context:
- [ ] Derive room-level labels (`shortName`, etc.) from stack/room metadata sources.
- [ ] Derive mark dimensions/labels from world-state/lens sources so prompt labels are human-readable.
- [ ] Derive guidance blocks as normalized plain text.
- [X] Wire new cache into [`internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts) with `clear()`/`flush()` integration.
- [ ] Add orchestration-side consumer helper that requests structured context by `(roomId, perspectiveKey)` and encodes to `generationContextWml` only at boundary.
- [ ] Update look/room generation path to use structured context instead of direct `ComponentRender` export.
- [ ] Add tests:
- [X] Unit tests for cache keying, source extraction, and serialization boundary (MVP short-name scope).
- [X] Orchestration tests that cover slow-path generation with new cache data (MVP no-regression coverage on look orchestration path).
- [ ] Regression test ensuring no dependency on render triplet (`displayName`/`summary`/`description`) for context semantics.
- [ ] Update durable docs:
- [ ] [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) with new cache handler summary.
- [ ] [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) with generation-context source contract.
- [ ] Update this task plan progress rows and checkboxes after verification.

## Verification

From [`lambda/ephemera/`](../../../../../lambda/ephemera/):

```bash
cd lambda/ephemera && npx jest dataSource/renderOrchestration/generateRoomPreview.test.ts --runInBand
cd lambda/ephemera && npx jest dataSource/renderOrchestration/orchestrationHandler.test.ts --runInBand
cd lambda/ephemera && npm run build
```

Suggested grep spot-checks after implementation:

- `generationContext` usage no longer sourced from `ComponentRender.get(...)` in look/generation wiring
- new cache key helper references both `roomId` and `perspectiveKey`
- prompt builder receives mark labels + guidance from structured generation-context fields

## When this task finishes

- Move lasting architectural guidance into:
- [`lambda/ephemera/internalCache/generationContext/AGENT.md`](../../../../../lambda/ephemera/internalCache/generationContext/AGENT.md)
- [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md)
- [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md)
- Archive or delete this task plan per [`taskPlanning/AGENT.md`](../../../../../taskPlanning/AGENT.md#when-the-task-finishes).
