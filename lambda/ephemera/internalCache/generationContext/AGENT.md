# `internalCache/generationContext`

## Purpose

Define and cache **generation-oriented** room context for description generation, keyed by **`roomId`**
plus **perspective `assetStack`** (see [`index.ts`](index.ts) cache keys), without treating WML as the
canonical meaning.

This cache holds **grounding inputs** (today: merged room `shortName` from asset-ordered room metadata),
not RoomDescription delivery payloads or legacy merged room render output.

## Why this exists

`RenderRequested` may still carry optional **`generationContextWml`** for callers that assemble a WML
subset (for example authoring flows). Passive paths often **omit** that field. Slow-path generation
therefore must not depend on legacy render-delivery shapes for context; this cache
is the structured source keyed by room and perspective stack.

## Contract (current MVP)

The in-process cache value today is a minimal record (see [`index.ts`](index.ts)):

- `componentId`: room id
- `shortName`: merged literal for prompting

**Target expansion** (when product needs it): same keying, richer fields such as marks, guidance, and
provenance metadata. Add fields explicitly as generation inputs, not as copies of render output.

## Explicit non-goals

- Not a clone of merged room render output
- Not a container for delivery triplets (`displayName`, `summary`, `description`) from cached renders
- Not a generic replacement for `AffordanceRoomDeliverable` or other rendering caches
- Not "WML-first" semantics; WML on ingress is an optional parse path, not canonical meaning

## Relationship to neighboring systems

- [`../affordanceRoomDeliverable.ts`](../affordanceRoomDeliverable.ts): affordance-channel room deliverable compose (perception terminal only)
- [`../roomWireMergeHelpers.ts`](../roomWireMergeHelpers.ts): shared WML merge helpers used by **`GenerationContext`** and **`AffordanceRoomDeliverable`**
- [`../../dataSource/renderOrchestration/generateRoomPreview.ts`](../../dataSource/renderOrchestration/generateRoomPreview.ts):
  **owns** passive slow-path context resolution: parses optional ingress `generationContextWml` when
  present and valid; otherwise loads this cache via `GenerationContext.get(roomId, assetStack)` and
  builds a `StandardForm` for the LLM step. Intake (`requestIntake.ts`) does **not** thread
  `generationContextWml` into `RenderResolveInputSuccess` (field **`componentId`**); `findRender` does not pass it into
  `generateRoomPreview`.
- [`../../generateExample/buildRoomDescriptionPrompt.ts`](../../generateExample/buildRoomDescriptionPrompt.ts):
  prompt builder that consumes the `StandardForm` passed from `generateRoomPreview`

## Implementation

- **Lookup:** `GenerationContext.get(roomId, assetStack)` merges `StandardRoom` metadata across assets in
  **`assetStack` order** (not `Object.values` order). See unit tests in [`index.test.ts`](index.test.ts).
- **Invalidation:** `invalidate(roomId)` clears keys for that room; align with room asset / meta changes as
  the surface grows.
- **Ingress WML:** Optional `generationContextWml` on `RenderRequested` remains a **compat** path when a
  caller supplies a parseable subset; it is not assembled by passive look orchestration before enqueue.

## Verification expectations

- Same `roomId` with different `assetStack` / perspective keys can yield different cache entries (and
  thus different merged short names when metadata differs by asset).
- Passive generation succeeds when `generationContextWml` is omitted but this cache can derive a short
  name; `CONTEXT_REQUIRED` when neither ingress WML nor cache yields usable context.
- Prompt path does not assume render-delivery triplets for grounding on the passive orchestration path.
