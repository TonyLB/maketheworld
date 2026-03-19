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
  - either `cacheRecord` or `cacheId` (decision pending)
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
    - attempt fast-path `currentCacheId` validation
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
  - update `Meta::Room.currentCacheId` to point to the newly written `CACHE#...` row
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

## Implementation steps (suggested order)

1. Create `events.ts` with message types and type guards.
2. Implement handler A (request intake + fast path).
3. Implement handler B (exact match).
4. Add generation worker message + handler C.
5. Add perception subscriptions/handlers for the lifecycle events.
6. Expand tests to cover timeline ordering and targeting.

