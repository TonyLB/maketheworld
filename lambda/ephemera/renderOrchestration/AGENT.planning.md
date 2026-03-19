*Status: ACTIVE PLANNING DOCUMENT - renderOrchestration (v2).*

## Purpose

This document tracks the local implementation plan for `lambda/ephemera/renderOrchestration/`.

It implements the v2 architecture described in:

- `lambda/ephemera/state/AGENT.v2.planning.md`

## Goals (v2)

1. Implement a messageBus-based event cascade for render lifecycle orchestration.
2. Publish early feedback events so clients see "Generating..." immediately when generation starts.
3. Publish final ready events only after cache write + pointer updates complete.
4. Keep responsibilities cleanly split across:
   - `state` (world-state storage/invariants)
   - `renderCache` (cache primitives)
   - `renderOrchestration` (policy + lifecycle cascade)
   - `perception` (enrichment + delivery)

## Proposed internal message contracts (draft)

These are internal messageBus messages (not EventBridge contracts).

All messages use `componentId` so the same lifecycle can extend beyond Rooms later.

### 1) RenderRequested

- **When**: a render lifecycle should begin (direct request or update-driven trigger).
- **Payload** (draft):
  - `componentId`
  - `perspective` (asset stack)
  - request-scoped `characterId` (optional)
  - update-scoped explicit targets (optional; otherwise perception derives from presence/subscriptions)
  - `messageGroupId` / request correlation (optional)
  - `allowGeneration` + `generationContextWml` (optional; authoring-only in v2)

### 2) RenderGenerationStarted

- **When**: the system has committed to generating content and wants immediate UI feedback.
- **Payload**:
  - `componentId`
  - request-scoped `characterId` (optional)
  - update-scoped targets (optional)
  - `messageGroupId` (optional)
  - minimal metadata for placeholder rendering (e.g. `status: 'generating'`)

### 3) RenderReady

- **When**: a cache-backed render is available (cache hit or generation completion).
- **Payload**:
  - `componentId`
  - `cacheId` (first-cut default for compact payloads)
  - optional `cacheRecord` (allowed fast-path to avoid immediate fetch when producer already has the full record)
  - request-scoped `characterId` (optional)
  - update-scoped targets (optional)
  - `messageGroupId` (optional)

### 4) RenderGenerationCompleted / RenderGenerationFailed

- Optional explicit lifecycle events, depending on whether we want `RenderReady` to be the only completion signal.

## Handler plan (messageBus cascade)

### Handler A: Request intake

- Input: `RenderRequested`
- Responsibilities:
  - For Rooms:
    - read `Meta::Room`
    - derive perspective key/fingerprint from request perspective
    - attempt fast-path pointer lookup in `currentCacheByPerspective`
    - if valid -> publish `RenderReady`
    - if invalid -> clear pointer and fall through to slow path

### Handler B: Exact-match lookup

- Input: `RenderRequested` (or a derived internal message such as `RenderLookupRequested`)
- Responsibilities:
  - ensure markState (use `Meta::Room.state.marks` or compute defaults)
  - call renderCache exact-match lookup
  - on hit -> publish `RenderReady`
  - on miss + generation allowed -> publish `RenderGenerationStarted` and enqueue generation work

### Handler C: Generation worker + completion publish

- Input: generation work message (implementation detail)
- Responsibilities:
  - call renderCache generation primitive
  - update `Meta::Room.currentCacheByPerspective[perspectiveKey]` to point to the newly written `CACHE#...` row
  - publish `RenderReady` (and optionally `RenderGenerationCompleted`)

### Handler D: Perception integration

Owned by `perception`, but must be planned here for contract clarity:

- On `RenderGenerationStarted`: send placeholder header (Rooms first).
- On `RenderReady`: enrich chosen cache record and send final header/full description.
- Ensure cache invalidation happens so placeholder is replaced by final header.

## Testing plan

1. Unit tests for handler A/B:
   - fast-path cache pointer hit -> RenderReady
   - pointer miss -> clears pointer then continues to lookup
   - exact-match hit -> RenderReady
2. Unit tests for generation lifecycle:
   - RenderGenerationStarted published before generation completion
   - RenderReady only after cache row write + pointer update
3. Perception integration tests:
   - placeholder header then final header (ordering)

## Integration with `state` (state change triggers)

**Intent**: `state` owns world-state changes; `renderOrchestration` reacts when those changes matter for someone.

### State-side behavior

- When a relevant state change occurs (e.g. Room-level markState change):
  - `state` publishes a **state change message** onto the messageBus (exact contract to be defined in the state planning docs).
  - Payload should include at least:
    - `componentId` (Room)
    - old/new state snapshot or a diff sufficient for downstream decisions

### renderOrchestration subscription

- `renderOrchestration` subscribes to these state change messages and:
  - checks whether there are characters currently present / subscribed who would passively perceive the change
    - mirrors existing patterns used by `perception` / map subscription today
  - if **no passive observers**:
    - invalidate any cached render state as needed (clear `Meta::Room.currentCacheByPerspective` or equivalent)
    - do **not** request a new render yet
  - if **there are passive observers**:
    - treat this as a render-needed event
    - derive perspective from each relevant character viewpoint (or consolidated policy)
    - publish `RenderRequested` message(s) with:
      - `componentId`
      - perspective (derived from character)
      - request-scoped `characterId` when appropriate
      - update-scoped targets when appropriate

### Design consequences

- `state` remains responsible for recording and publishing changes, not for deciding render policy.
- `renderOrchestration` centralizes:
  - presence-aware render decisions
  - cache invalidation policy vs immediate regeneration
  - fan-out into one-or-more `RenderRequested` messages per change.

## Perspective-scoped cache pointers (schema decision)

`currentCacheId` is not sufficient for passive observation because cache records are perspective-constrained.

Planned shape for Room metadata:

- `currentCacheByPerspective: Record<string, string>`
  - key: normalized perspective identifier/fingerprint
  - value: `CACHE#...` id

Why map over list pairs:

- O(1)-style lookup by perspective key
- easier atomic update of a single perspective pointer
- simpler invalidation (clear map) on state mutations

Transition note:

- During migration, handlers may read legacy `currentCacheId` as fallback.
- New writes should target `currentCacheByPerspective`.

## Next task list (near-term clear -> longer-term foggy)

### Tier 1: Clear, immediate tasks (implement now)

1. [x] **Type shape update (early priority)**
   - Update shared metadata types to include:
     - `Meta::Room.currentCacheByPerspective: Record<string, string>`
   - Keep `currentCacheId` as temporary optional fallback during migration.
2. [x] **Perspective key utility**
   - Define one shared, versioned function for deriving a stable perspective key/fingerprint from perspective input.
   - Reuse existing perspective-id semantics where valid, but move toward a shared package utility used across lambdas.
   - Add a canonicalization step before keying to keep semantics stable across call sites:
     - preserve base->leaf order
     - remove exact duplicate asset ids while preserving first occurrence
     - validate all ids as `ASSET#...`
   - Encode version in the key (`PERSPECTIVE#v1#...`) so future ordering/canonicalization changes can ship as `v2` without ambiguous collisions.
   - Document that v1 canonicalization is intentionally conservative (mostly no-op on well-formed stacks) and exists to prevent accidental key fragmentation.
   - Migration compatibility:
     - keep legacy perspective id readers during transition
     - switch all new writes to shared `computePerspectiveKey` output
     - if/when key semantics change, dual-read legacy + new keys until backfill completes
3. [x] **Event contract file**
   - Create `renderOrchestration/events.ts` with `RenderRequested`, `RenderGenerationStarted`, `RenderReady`, and optional completion/failure message types + type guards.
4. **Request intake handler (fast path)**
   - Implement handler A to read `Meta::Room`, resolve perspective key, validate `currentCacheByPerspective[perspectiveKey]`, and publish `RenderReady` on hit.
   - On invalid pointer, clear that pointer entry and continue.
5. **Exact-match handler (slow path)**
   - Implement handler B to ensure marks, perform exact-match lookup, and publish `RenderReady` on hit.

### Tier 2: Mostly clear tasks (some implementation choices open)

6. **Generation path + completion updates**
   - Emit `RenderGenerationStarted` on miss when generation is allowed.
   - Run generation worker, persist cache row, update `currentCacheByPerspective[perspectiveKey]`, then emit `RenderReady`.
   - Decide whether to also emit `RenderGenerationCompleted`.
7. **State-change subscription wiring**
   - Subscribe renderOrchestration to state change messages.
   - Implement passive-observer check (presence/subscription aware).
   - If no observers: invalidate perspective cache pointers only; defer rerender.
   - If observers: publish one-or-more `RenderRequested` messages with derived perspective(s).
8. **Perception handler refactor for clean DAG**
   - Split current perception responsibilities into at least two handler roles:
     - intake/request handlers (translate user/system intents into `RenderRequested`)
     - delivery handlers (consume `RenderGenerationStarted`/`RenderReady` and publish user-facing messages)
   - Remove direct room render execution from monolithic Perception handling path, so `renderOrchestration` is the explicit middle layer.
   - Preserve existing behavior for non-render-orchestration perception paths during migration.
9. **Foundational test coverage**
   - Add unit tests for fast-path hit/miss/invalid-pointer behavior.
   - Add ordering tests (`RenderGenerationStarted` before `RenderReady`).
   - Add state-triggered tests for observer/no-observer branching.

### Tier 3: Intentionally foggy tasks (documented unknowns)

10. **Perspective fan-out policy**
   - Unknown: one render per observing perspective vs consolidation heuristics.
   - Unknown: cap/batching strategy when many distinct passive perspectives exist.
11. **Ready payload strategy**
   - Unknown: `RenderReady` carries full `cacheRecord` vs `(componentId, cacheId)` fetch-on-consumer.
   - Trade-off: larger bus payloads vs extra DB/cache reads downstream.
12. **Cross-domain subscription boundaries with `perception`**
   - Unknown: how much targeting logic remains in `renderOrchestration` vs deferred to `perception`.
   - Need explicit contract for request-scoped vs update-scoped ownership.
13. **Generalization beyond Rooms**
   - Unknown: whether Maps/Features can share identical invalidation + passive-observer rules.
   - Expect contract reuse, but policy likely diverges by component type.

## Integration follow-up after event contracts land

- Add render orchestration event types to `lambda/ephemera/messageBus/baseClasses.ts` union types.
- Register `renderOrchestration` subscriptions in `lambda/ephemera/messageBus/index.ts`.
- Add perception-side lifecycle consumers for `RenderGenerationStarted` and `RenderReady`.

