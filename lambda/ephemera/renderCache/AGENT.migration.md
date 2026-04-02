# Ephemera RenderCache Migration (Strangler, v2 boundary)

## Purpose
This document captures the long-term migration plan for breaking the legacy monolith shaped implementation in `lambda/ephemera/renderCache/`.

Goal: make it hard (by design) for orchestration/policy and other systems to couple to legacy persistence functions, and instead route:
1. Writes through the migration target DataSource: `mtw.ephemera.renderCache`
2. Reads/lookups through the bounded, invocation-scoped memo: `internalCache.RenderCache`

## Current coupling (known)
1. `mtw.ephemera.renderCache` writes via `lambda/ephemera/dataSource/renderCache/putCacheRecord.ts` and `deleteCacheRecord.ts` (invoked from the DataSource subscriber).
2. `internalCache.RenderCache` instantiates its memo by importing `queryCacheRecordsForComponent` from `lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.ts`.
3. Exact-match logic currently lives in `lambda/ephemera/internalCache/renderCache.ts` (via `internalCache.RenderCache.getExactMatch`).

These couplings can create self-reinforcing migration lock-in: the legacy module keeps being treated as the only "objectively correct" source of truth.

## Target boundaries (long-term)
### Persistence primitives live in the DataSource layer
`lambda/ephemera/dataSource/renderCache/*` becomes responsible for:
- `queryCacheRecordsForComponent` (read model, potentially invocation-safe)
- `putCacheRecord` (write model + bus publication: `Cache Updated` / `Cache Error`)
- `deleteCacheRecord` (eventual)

The legacy `renderCache/cacheAccess.ts` module has been removed; persistence primitives live under `lambda/ephemera/dataSource/renderCache/`.

### Lookup (exact-match) lives inside `internalCache.RenderCache`
Instead of call-sites performing "memo fetch + matching computations" or calling legacy comparison helpers, the bounded API becomes the only way to query exact-match state.

Component-scoped API (the form we want):
- `await internalCache.RenderCache.getExactMatch({ componentId, proposedMarkState, perspective })`
  - Returns an `EphemeraCacheDynamoItem` (cache record) or `null`
  - Internally fetches `RenderCache.get(componentId)` as needed
  - Applies matcher-based perspective filtering + markState equality semantics

## Migration sequence (recommended, low-regret)
### Step 1: Put the lookup computation behind an internal method
- Status: COMPLETED
- Add `internalCache.RenderCache.getExactMatch(...)` as the component-scoped lookup API.
- Internally it may, temporarily, reuse legacy comparison helpers (or duplicate their pure logic) as long as call-sites no longer depend on legacy modules for lookup.

Acceptance gate:
- No orchestration/policy code performs exact-match by calling `await internalCache.RenderCache.get(componentId)` and then doing separate matcher/mark computations; it should call `internalCache.RenderCache.getExactMatch(...)` instead.

### Step 2: Move the exact-match helper out of call-sites
- Status: COMPLETED
- Update any remaining callers to use `internalCache.RenderCache.getExactMatch(...)`.
- Keep the matching semantics stable (same markState normalization + same matcher/perspective behavior).

Acceptance gate:
- Exact-match behavior changes only through `getExactMatch` so we can test and reason locally.

### Step 3: Make the DataSource own persistence primitives
- Add DataSource-owned equivalents of:
  - `queryCacheRecordsForComponent`
  - `putCacheRecord`
- Switch:
  - `mtw.ephemera.renderCache` to call the DataSource-owned `putCacheRecord`
  - `internalCache.RenderCache` to obtain its initial memo via DataSource-owned query
- Status: COMPLETED (query side)

Acceptance gate:
- Production dependencies no longer use a monolithic `cacheAccess.ts`; reads/writes are DataSource-owned modules under `lambda/ephemera/dataSource/renderCache/`.

**Call-site alignment (examples mirroring)**: `mtw.ephemera.examples` ([`lambda/ephemera/dataSource/componentExamples.ts`](../dataSource/componentExamples.ts)) routes cache puts and deletes through **`api.ephemera`** (`sendPutCacheRecord`, `sendDeleteCacheRecords`) instead of calling Dynamo helpers directly, so **`Cache Updated`**, **`Cache Deleted`**, and **`Cache Error`** stay unified with **`mtw.ephemera.renderCache`** (nested bus traffic is drained by the active **`flush()`** recursion).

### Step 4: Remove or isolate legacy modules
- Once no production code imports legacy persistence modules, either:
  - delete them, or
  - keep them only as compatibility/test helpers with a clear temporary label.

Acceptance gate:
- A repo-wide search for `cacheAccess` shows no stale imports (docs may mention history only).

### Step 5: Domain lift (generate-centric code)
- Status: COMPLETED
- Move LLM room-description generation into `lambda/ephemera/generateExample/`:
  - `generateRoomDescription.ts`, `buildRoomDescriptionPrompt.ts`, `invokeBedrockRoomDescription.ts` (and tests).
- Move `generateRoomPreview` orchestration into `lambda/ephemera/dataSource/renderOrchestration/` (done).
- Slim `renderCache/` to types (`baseClasses`), mark helpers (`markStateUtils`), and barrel re-exporting DataSource primitives.

Acceptance gate:
- `renderCache` no longer contains generate-centric code; orchestration and generation live in `dataSource/renderOrchestration` and `generateExample` respectively.

## Testing / equivalence checks
For any behavior change, validate equivalence between old and new paths:
- Exact-match correctness:
  - matcher/perspective filtering behavior is identical
  - markState normalization/equality behavior is identical
- Bus outcome ordering:
  - `mtw.ephemera.renderCache` still publishes `Cache Updated` or `Cache Error`
  - `internalCache.RenderCache.set` is applied after successful persistence and before any subsequent read in the same invocation that relies on it

## Migration invariants (social + technical)
- Orchestration/policy never directly calls legacy persistence functions.
- `internalCache.RenderCache` is the only place that should expose exact-match lookup behavior to callers.
- `mtw.ephemera.renderCache` is the only place that should expose persistence writes to the rest of the system.

