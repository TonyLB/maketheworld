# Ephemera Render Cache - AGENT

This document describes how Ephemera caches rendered descriptions in the Ephemera DynamoDB table, centered around the `renderCache/` module (`baseClasses.ts`, `cacheAccess.ts`, `exampleComparison.ts`, `generateRoomPreview.ts` and tests).

It is the concrete realization of the schema and flow outlined in:

- `lambda/ephemera/AGENT.caching.planning.md`
- `lambda/ephemera/AGENT.caching.firstMVP.planning.md`

The cache is designed for **Room/Feature/Knowledge** components whose content depends on Mark state and asset-layer perspective.

---

## Goals

- Support **exact-match** lookup from a proposed Mark state and perspective (asset stack) to a previously rendered Example.
- Keep Ephemera’s cache as the **runtime source of truth** for rendered descriptions; Ephemera does not reach back into Assets during preview/lookup.
- Preserve enough metadata (markState, perspectiveId, provenance) so that future features (LLM generation, constellation search, richer invalidation) can build on the same schema.

---

## DynamoDB Schema

Render cache records live in the **Ephemera table**, sharing the same primary key structure (`EphemeraId`, `DataCategory`) as other Ephemera records.

### Keys

- **Partition key**: `EphemeraId` = component id
  - Examples: `ROOM#...`, `FEATURE#...`, `KNOWLEDGE#...`
  - Any component that can have Example references may host cache records.
- **Sort key**: `DataCategory` = `CACHE#${uuid}`
  - Synthetic UUID per cache record.
  - We **never** use Example IDs or Mark state in the key.

Implications:

- All cache records for a given component are colocated under its `EphemeraId`.
- Lookup is always:
  1. Query by component id.
  2. Filter in memory by Mark state and (optionally) perspectiveId.

There is no “cache per Example ID” or “RoomId + Mark state” key; this keeps the schema compatible with future semantic / constellation search.

### Record shape

`renderCache/baseClasses.ts` defines the core types.

#### EphemeraCacheRecord (domain model)

- `componentId`: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId
- `markState`: `{ markValue: Array<{ mark: string; value: string }> }`
  - `mark`: Mark UUID (from WML/Assets).
  - `value`: Match string associated with that Mark for this state.
  - Ordering is not semantically meaningful; code normalizes for comparison.
- `renderedContent`:
  - `displayName?: RenderTree`
  - `summary?: RenderTree`
  - `description: RenderTree`
  - Mirrors `StandardExample` fields and format from Assets.
- `provenance`:
  - `{ type: 'authored' | 'generated' }`
  - Distinguishes mirrored authored Examples from future generated renders.
- `perspectiveId`: string
  - **Known inactive** (not used for matching). Kept on the record pending possible later use for search optimization.
- `perspectiveMatcher`: PerspectiveMatcher
  - Required and forbidden asset ids for matcher-based matching. Used by `perspectiveMatches(matcher, requestPerspective)` at lookup time.
- `situationId?: string`
  - Optional link to the Situation UUID for **Room** cache records (Phase 4). Used to target delete on ExampleRemoved when `exampleId` is SITUATION#.
- `authoredExampleId?: string`
  - Optional link back to the blueprint Example UUID for **Feature/Knowledge** cache records. Used to precisely delete cache entries when Examples are removed (exampleId is EXAMPLE#).

#### EphemeraCacheDynamoItem (storage model)

Stored directly in DynamoDB:

- `EphemeraId`: component id (Room/Feature/Knowledge).
- `DataCategory`: `CACHE#${uuid}`.
- `markState`, `renderedContent`, `provenance`, `perspectiveId`, `perspectiveMatcher`, `situationId?`, `authoredExampleId?`.

`isEphemeraCacheDynamoItem` in `baseClasses.ts` enforces the expected shape at read time.

---

## Perspective and Asset Stacks

### Perspective and matcher-based matching (Phase 5.7)

Examples are authored against a **stack of assets** (inheritance chain). The same logical Example can render differently depending on which assets are in the stack and in what order. We treat each **distinct render** as a separate cache record and identify the context by a **perspective**:

- `assetStack`: ordered list of asset ids that produced the render.
- `perspectiveMatcher`: `{ requiredAssetIds, forbiddenAssetIds? }` published by the Assets lambda with each mirroring event. Lookup uses `perspectiveMatches(matcher, requestPerspective)` so a cache record matches when the request's asset stack contains all required and none of the forbidden assets.
- `perspectiveId`: stored on every record but **not used for matching** (known inactive); kept pending possible later use for search optimization.

### Asset stack sources

- **Mirroring pipeline (`mtw.assets.componentExamples`)**:
  - Reconstructs `assetStack` by following Example `_from` links across Assets (base-first, event asset last).
  - Emits events with `assetStack` in payload.
- **Ephemera DataSource (`mtw.ephemera.examples`)**:
  - Receives events with `perspectiveMatcher` and `assetStack`, writes cache records via `putCacheRecord` (including `perspectiveMatcher`; `perspectiveId` is still computed and stored but not used for matching).
- **Authoring Preview (RoomPreviewEditor)**:
  - On the client, `assetStack` is built from `useWorkbenchAsset()`:
    - `assetStack = [...inheritedByAssetId.map(({ assetId }) => assetId), AssetId]`
  - This mirrors the same “base-first, current-asset-last” ordering.

Preview request sends `assetStack`; Ephemera builds `perspective = { assetStack }` and filters records with `perspectiveMatches(record.perspectiveMatcher, perspective)`.

---

## Access Layer: `cacheAccess.ts`

`renderCache/cacheAccess.ts` provides low-level operations over the Ephemera table. It operates strictly in terms of component ids and cache records (no knowledge of Events or WebSockets).

### `queryCacheRecordsForComponent(componentId)`

- Query Ephemera table where:
  - `EphemeraId = componentId`
  - `DataCategory begins_with 'CACHE#'`
- Map the resulting items into `EphemeraCacheRecord` instances.
- Returns **all** records (authored and generated) for that component.

### `putCacheRecord(componentId, record, existingDataCategory?)`

- If `existingDataCategory` is provided and starts with `CACHE#`, use it as `DataCategory` (overwrite in place). Otherwise generate a new UUID and use `DataCategory = 'CACHE#' + uuid`.
- Write a single Dynamo item with:
  - `EphemeraId = componentId`
  - `DataCategory` as above
  - `record.markState`, `record.renderedContent`, `record.provenance`, `record.perspectiveId`, `record.perspectiveMatcher`, `record.situationId?`, `record.authoredExampleId?`
- Returns the `DataCategory` used.
- Used by:
  - `mtw.ephemera.examples` DataSource when mirroring authored Examples.
  - Future generation flows (e.g. LLM-based renders) to store generated content under `provenance.type = 'generated'`.

### `deleteCacheRecord(componentId, dataCategory)`

- Delete the item with:
  - `EphemeraId = componentId`
  - `DataCategory = dataCategory`
- Typically used after an in-memory filter step to select the correct records to delete (e.g. by `situationId` or `authoredExampleId`).

### ExampleRemoved handling

For Example/Situation removal, Ephemera:

1. Receives an `ExampleRemoved` event from `mtw.assets.componentExamples` with `parentIds` and `exampleId`.
2. For each parent:
   - Calls `queryCacheRecordsForComponent(parentId)`.
   - Filters to records where `situationId === exampleId` or `authoredExampleId === exampleId` (Room path uses situationId/SITUATION#; Feature/Knowledge use authoredExampleId/EXAMPLE#).
   - Calls `deleteCacheRecord(parentId, DataCategory)` for each match.

This pattern keeps cache rows in sync with blueprint lifecycles without needing Example or Situation IDs in the primary key.

---

## Comparison Logic: `exampleComparison.ts`

All exact-match semantics are implemented in `renderCache/exampleComparison.ts`.

### Normalization

To avoid ordering bugs, comparison normalizes markState:

- Sort `markValue` by `mark` (Mark UUID).
- Compare normalized arrays for equality.

The proposed mark state and each record’s markState are normalized before comparison. This ensures:

- `{ mark: 'MARK#a', value: 'one' }, { mark: 'MARK#b', value: 'two' }`
  is equal to
- `{ mark: 'MARK#b', value: 'two' }, { mark: 'MARK#a', value: 'one' }`

### Exact match API

Core helper (conceptually):

- `findExactMatchForComponent({ componentId, proposedMarkState, perspective })`
  - Calls `queryCacheRecordsForComponent(componentId)`.
  - Filters records by `perspectiveMatches(record.perspectiveMatcher, perspective)` (records without `perspectiveMatcher` are skipped).
  - Normalizes both proposed and stored markState.
  - Returns the first record whose normalized markState equals the proposed one and whose matcher matches the request perspective, or `null` when none match.

This is the canonical “does this state exist in cache?” check, used by `generateRoomPreview` and ready for reuse in future flows.

---

## Preview Flow: `generateRoomPreview.ts` and WebSocket handler

### `generateRoomPreview` (renderCache)

`renderCache/generateRoomPreview.ts` packages the comparison logic for the Room Preview use case:

- Input:
  - `roomId: EphemeraRoomId`
  - `markState: EphemeraCacheMarkState`
  - `assetStack: string[]`
- Steps:
  1. Build `perspective = { assetStack }`.
  2. Call `findExactMatchForComponent({ componentId: roomId, proposedMarkState: markState, perspective })`.
  3. If a match exists:
     - Return `{ success: true, renderedContent }`.
  4. If no match exists:
     - Return `{ success: false, errorCode: 'NO_EXACT_MATCH', errorMessage: 'No exact match for proposed state' }`.

### WebSocket integration (`app.ts`)

The Ephemera Lambda handler (`lambda/ephemera/app.ts`) wires `generateRoomPreview` into the WebSocket API:

- Validated request type:
  - `GenerateRoomPreviewAPIMessage` in `packages/mtw-interfaces/ts/ephemera.ts`.
- Handler branch:
  - When `isGenerateRoomPreviewAPIMessage(request)`:
    - Call `generateRoomPreview({ roomId: request.RoomId, markState: request.markState, assetStack: request.assetStack })`.
    - Send a `ReturnValue` message with body:
      - `{ generateRoomPreview: result, ...(request.RequestId && { RequestId: request.RequestId }) }`.

The Lambda return value is `{ statusCode: 200, body: JSON.stringify(mergedBodies) }`. On the client, the lifeLine WebSocket layer:

- Detects Lambda-style responses (`{ statusCode, body: string }`).
- Parses `body` and publishes the parsed object as `LifeLinePubSubData`, so `socketDispatchPromise` can match by `RequestId`.

### Client Preview UI (high level)

On the client (Authoring Workbench):

- `RoomEditor` exposes an “Open Preview” entry when:
  - The Room has exactly one Lens and that Lens has at least one Mark.
- Clicking “Open Preview”:
  - Pushes a synthetic breadcrumb entry `preview:${roomId}`.
  - `WorkbenchAssetEditor` detects `currentComponentId.startsWith('preview:')` and renders `RoomPreviewEditor`.
- `RoomPreviewEditor`:
  - Resolves Room, Lens, and Marks from `useWorkbenchAsset().standardForm`.
  - Lets the author enter Match values per Mark.
  - Builds `markState` and `assetStack` (inherited assets + current asset).
  - Dispatches `socketDispatchPromise({ message: 'generateRoomPreview', RoomId, markState, assetStack }, { service: 'ephemera' })`.
  - Displays:
    - Cached `renderedContent` (displayName/summary/description) on success.
    - A clear “no exact match” or failure message on error.

The UI layer is intentionally thin; all state semantics and matching live in the render cache and comparison helpers described above.

---

## Design Notes and Future Direction

- **One row per distinct render**:
  - The schema is explicitly “one cache row per distinct render” (component + markState + perspective), not “one row per Example id.” This keeps the door open for:
    - Generated content.
    - Future Situation/facet-based models.
    - Guidance-constellation search.

- **Exact match first, extensible later**:
  - v1 only uses exact Mark-state equality.
  - The same record shape (markState, renderedContent, perspectiveId, perspectiveMatcher, provenance) is intended to support:
    - Later fuzzy/semantic search (constellation by Guidance).
    - LLM-based generation pipelines that treat existing records as prompts or neighbors.

- **Mirroring vs runtime lookup**:
  - Authored Examples enter the cache solely via the mirroring pipeline.
  - Runtime lookup (including Preview) reads only from the cache.
  - This separation lets you:
    - Change mirroring strategies without touching Preview logic.
    - Experiment with new generation/invalidation strategies while keeping the runtime contract stable.

For broader architectural context, see:

- `lambda/ephemera/AGENT.caching.planning.md` – overall caching and generation design.
- `lambda/ephemera/AGENT.caching.firstMVP.planning.md` – MVP phase breakdown and status.
- `lambda/ephemera/AGENT.event.md` – Ephemera events and WebSocket contracts.

