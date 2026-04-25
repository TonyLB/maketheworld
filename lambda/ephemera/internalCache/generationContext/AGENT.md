# `internalCache/generationContext`

## Purpose

Define and cache a **structured generation context** for room-description generation, keyed by
**`roomId` + `perspectiveKey`**, without coupling semantic meaning to a WML wire-transfer shape.

This cache is intended for generation grounding inputs (for example room `shortName`, lens/mark labels,
guidance text, and other perspective-scoped blueprint facts), not for RoomDescription delivery payloads
or `ComponentRender` convenience output.

## Why this exists

`generationContextWml` currently acts as a transport field and can be populated from sources whose
semantics were designed for rendering/correlation rather than generation grounding. This package defines
the generation-context contract in data terms first, then allows optional serialization to WML only as
a transfer format.

## Contract (target shape)

At minimum, generated context for a `(roomId, perspectiveKey)` should expose:

- `room`: room identity + human-readable `shortName` (and any other generation-relevant room labels)
- `marks`: mark dimensions with stable id plus human-readable label for prompting
- `guidance`: normalized guidance lines/instructions relevant to generation
- `provenance`: enough metadata to reason about source freshness and debugging

Optional fields can be added as needed, but should remain explicitly generation-oriented.

## Explicit non-goals

- Not a clone of `ComponentRender` room output
- Not a container for delivery triplets (`displayName`, `summary`, `description`) from cached renders
- Not a generic replacement for `ComponentStackMerge` or other rendering caches
- Not "WML-first" semantics; WML is optional encoding, not canonical meaning

## Relationship to neighboring systems

- [`../componentRender.ts`](../componentRender.ts): renderer-facing merged room view
- [`../componentStackMerge.ts`](../componentStackMerge.ts): structural room merge cache
- [`../../dataSource/renderOrchestration/generateRoomPreview.ts`](../../dataSource/renderOrchestration/generateRoomPreview.ts):
  current consumer of generation context
- [`../../generateExample/buildRoomDescriptionPrompt.ts`](../../generateExample/buildRoomDescriptionPrompt.ts):
  prompt builder that reads generation context semantics

## Implementation notes (for follow-up task)

- Prefer a typed in-memory object model as canonical cache value.
- If a wire payload is needed (`generationContextWml`), derive it from the structured model at the
  orchestration boundary.
- Cache identity should use both `roomId` and `perspectiveKey`.
- Invalidation should align with source-of-truth changes (room assets/lens/guidance/mark schema updates).

## Verification expectations

When implemented, verify:

- For same `roomId`, different `perspectiveKey` values can resolve distinct cache entries.
- Prompt builder receives mark labels + guidance from structured context (not implicit render payloads).
- Slow-path generation works with structured context-derived payload and does not depend on
  `ComponentRender` triplet-like artifacts.
