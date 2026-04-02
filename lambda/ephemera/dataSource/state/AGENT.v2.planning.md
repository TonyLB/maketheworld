*Status: ACTIVE PLANNING DOCUMENT - v2 Ephemera orchestration for state-driven Room renders.*

## Relationship to v1

This document picks up where v1 left off.

- v1 planning and implementation status remain tracked in:
  - `lambda/ephemera/dataSource/state/AGENT.v1.planning.md`
- v1 established core foundations:
- `Meta::Room` state shape foundations (`state.marks`, optional `situationId`)
  - default mark derivation (`computeDefaultMarksForRoom`)
  - renderCache exact-match primitives
  - initial helper with fast-path cache validation

v2 focuses on architecture and orchestration, not re-defining those foundations.

## Why v2 exists

The v1 direction exposed an architectural mismatch:

- The pipeline is asynchronous and multi-step (cache decision, possible generation start, generation completion, perception updates).
- A single synchronous helper return value is not a natural fit for "early feedback now, final update later".

v2 addresses this by moving orchestration into a messageBus event-cascade.

## v2 architectural split

v2 formalizes these subsystem responsibilities:

1. `renderCache`
   - Lookup/generation primitives and cache row persistence.
   - No event delivery ownership.

2. `state` (this directory)
   - Lookup and mutation of **world-state** (`Meta::Room.state`: marks, optional situation, etc.).
   - Helpers for default marks and stack merge; **does not** own cache pointer lifecycle or invalidation semantics.

3. `renderOrchestration`
   - Policy and lifecycle orchestration:
     - "Given this Room state and perspective, choose cache hit/miss path"
     - Pointer **validation** and **repair** (`currentCacheId` / `currentCacheByPerspective`), exact match, generation, and **`RenderInvalidate`** when resolve cannot proceed
     - "On miss, start generation and publish early feedback"
     - "On generation completion, publish ready event"
   - Owns cascade steps and status transitions.

4. `perception`
   - Enrich chosen cache data into message-ready content.
   - Deliver placeholder/final Room messages to characters.

## v2 goals

1. Introduce messageBus-driven orchestration for Room render lifecycle.
2. Publish early generation feedback so clients can show "Generating..." immediately.
3. Publish final ready feedback after cache write + pointer update.
4. Keep `renderCache` as data/cache primitive layer and `perception` as delivery layer.
5. Preserve a migration path to broader DataSource adoption later, if replay/subscription needs justify it.

## v2 event-cascade plan (high-level)

### Phase A: Event contracts

Define internal messageBus contracts for orchestration events:

- `RenderRequested`
- `RenderReady`
- `RenderGenerationStarted`
- `RenderGenerationCompleted`
- `RenderGenerationFailed` (optional but recommended)

Each event should include enough context to avoid hidden coupling:

- `componentId` (Room/Feature/Map; component type derivable from id tag)
- relevant target context, explicitly separated into:
  - **request-scoped target**: `characterId` (when a specific character/session initiated the render request and should receive direct response-style feedback)
  - **update-scoped targets**: optional target set for passive updates; if omitted, downstream perception derives targets from room presence/subscriptions at publish time
- `perspective` (asset stack)
- optional `messageGroupId` / request correlation
- for ready events: `cacheRecord` or pointer to it

### Phase B: Orchestrator handlers

Implement handlers in ordered cascade:

1. Request handler
   - Reads `Meta::Room`, derives perspective key, validates fast-path pointer in `currentCacheByPerspective`, and branches.

2. Slow-path lookup handler
   - Ensures markState (`state.marks` or computed default).
   - Performs exact-match search in renderCache.
   - Emits `RenderReady` on hit.

3. Generation-start handler
   - On miss + allowed generation, emits `RenderGenerationStarted` immediately.
   - Starts generation workflow asynchronously.

4. Generation-completion handler
   - Persists cache row/pointer updates.
   - Emits `RenderGenerationCompleted` then `RenderReady` (or a single ready event with completion metadata).

### Phase C: Perception integration

Perception subscribes to orchestrator lifecycle events:

- On `RenderGenerationStarted`: send placeholder header/message appropriate to component type (Room first in v2).
- On `RenderReady` (hit or completion): enrich + send final description/update for component type.
- Drop stale **perception** / `componentRender` caches when completion replaces placeholder content (distinct from **Meta::Room** pointer maintenance, which lives in orchestration).

### Phase D: Tests

Add targeted tests for lifecycle ordering and UX semantics:

1. Emits generation-start before generation completion.
2. Emits ready only after cache row write + `Meta::Room.currentCacheByPerspective` update.
3. Sends placeholder then final header in correct order.
4. Handles generation failure with deterministic fallback messaging.

## Open decisions for v2

1. Event payload shape:
   - pass full `cacheRecord` vs pass `(componentId, cacheId)` and let consumers fetch.

2. Failure semantics:
   - dedicated failure event vs reuse ready/error event variants.

3. Scope boundaries:
   - Rooms-only in v2 implementation; Maps as first candidate extension.

4. Perspective pointer storage shape:
   - prefer `Meta::Room.currentCacheByPerspective: Record<string, cacheId>` over list pairs for deterministic lookup/update.

## Out of scope for v2

- Generic component-state API for all component types.
- Full DataSource migration for these lifecycle events.
- Feature/Knowledge passive update semantics.

## Migration note

v2 should be implemented incrementally:

1. Keep existing paths working.
2. Introduce event contracts and handlers behind the same entrypoints.
3. Move call sites from direct helper returns to cascade events.
4. Remove legacy direct orchestration only after parity tests pass.

## Data-model update note (v2 decision)

`currentCacheId` is insufficient because cache rows are perspective-constrained.

v2 planning assumes perspective-scoped pointers on `Meta::Room`, e.g.:

- `currentCacheByPerspective: Record<string, string>`
  - key: normalized perspective identifier/fingerprint
  - value: `CACHE#...` data category id

**Pointer staleness** is handled in **render orchestration** on each resolve: validate hinted rows against current `state.marks` and perspective; clear a perspective entry or fall through to exact match / generation as implemented in `findRender`. **Optional eager clears** of the whole map on state write (if ever desired for performance or UX) are a product choice, not part of the **state** module's domain --- correctness does not require blanket invalidation at write time.

Migration guidance:

1. Add `currentCacheByPerspective` as additive schema.
2. Treat legacy `currentCacheId` as optional backward-compatible fallback while call sites migrate.
3. Remove `currentCacheId` once orchestration and tests are fully perspective-scoped.
4. Use shared, versioned perspective keys (`PERSPECTIVE#v1#...`) for pointer-map keys.
5. During perspective-key rollout, keep legacy reads where needed and dual-read until writers are fully migrated.

