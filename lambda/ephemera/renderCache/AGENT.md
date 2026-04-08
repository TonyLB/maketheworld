# Ephemera Render Cache - AGENT

This document describes how Ephemera caches rendered descriptions in the Ephemera DynamoDB table. The `renderCache/` module provides **types** (`baseClasses.ts`) and **mark-state helpers** (`markStateUtils.ts`). Import DataSource persistence primitives from `dataSource/renderCache/` (e.g. `putCacheRecord`, `deleteCacheRecord`). LLM generation lives in `generateExample/`; cache-miss generation lives in `dataSource/renderOrchestration/generateRoomPreview.ts`.

It is the concrete realization of the schema and flow outlined in:

- `lambda/ephemera/AGENT.caching.planning.md`
- `lambda/ephemera/AGENT.caching.firstMVP.planning.md`

The cache is designed for **Room/Feature/Knowledge** components whose content depends on Mark state and asset-layer perspective.

---

## Goals

- Support **exact-match** lookup from a proposed Mark state and perspective (asset stack) to a previously rendered Example.
- Keep Ephemera’s cache as the **runtime source of truth** for rendered descriptions; Ephemera does not reach back into Assets during orchestration lookup.
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
  - Receives events with `perspectiveMatcher` and `assetStack`, enqueues **`Put Cache Record`** / **`Delete Cache Records`** on **`api.ephemera`** via **`sendPutCacheRecord`** / **`sendDeleteCacheRecords`**. No separate **`flush()`** in this module: the in-progress **`messageBus.flush()`** that invoked the DataSource recurses until nested **`send()`** traffic (including **`mtw.ephemera.renderCache`**) is drained (including `perspectiveMatcher`; `perspectiveId` is still computed and stored but not used for matching).
- **Authoring Preview (RoomPreviewEditor)**:
  - On the client, `assetStack` is built from `useWorkbenchAsset()`:
    - `assetStack = [...inheritedByAssetId.map(({ assetId }) => assetId), AssetId]`
  - This mirrors the same “base-first, current-asset-last” ordering.

Preview request sends `assetStack`; Ephemera builds `perspective = { assetStack }` and filters records with `perspectiveMatches(record.perspectiveMatcher, perspective)`.

---

## Persistence Primitives

[`lambda/ephemera/dataSource/renderCache/putCacheRecord.ts`](../dataSource/renderCache/putCacheRecord.ts) and [`deleteCacheRecord.ts`](../dataSource/renderCache/deleteCacheRecord.ts) provide low-level write primitives (put/delete) over the Ephemera table. They operate strictly in terms of component ids and cache records (no knowledge of Events or WebSockets). `mtw.ephemera.renderCache` is the production entry that calls them after `api.ephemera` commands.

### DataSource-owned `queryCacheRecordsForComponent(componentId)`

[`lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.ts`](../dataSource/renderCache/queryCacheRecordsForComponent.ts) provides the Dynamo query used by request-scoped read memoization.

- Query Ephemera table where:
  - `EphemeraId = componentId`
  - `DataCategory begins_with 'CACHE#'`
- Map the resulting items into `EphemeraCacheRecord` instances.
- Returns **all** records (authored and generated) for that component.

### Request-scoped read memo: `internalCache.RenderCache`

[`lambda/ephemera/internalCache/renderCache.ts`](../internalCache/renderCache.ts) provides **`InternalCache.RenderCache`** (cleared with [`InternalCache.clear()`](../internalCache/index.ts) each handler run):

- **`get(componentId)`** – First call in an invocation runs the underlying Dynamo `queryCacheRecordsForComponent` and stores the result; later calls return the **same array reference** for that `componentId`. **Ephemera production paths** (`generateRoomPreview`, `ComponentRender` for Rooms, `mtw.ephemera.examples` handlers) should use **`internalCache.RenderCache.get`** instead of calling `queryCacheRecordsForComponent` directly so reads dedupe within a handler.
- **`set(...)`** – **No-op** until `get` has run for that `componentId`. Upserts into the in-memory array: with optional **`cacheId`** (`DataCategory`), replace matching row or append; without `cacheId`, replace first row whose **`markState` matches** via `markStatesEqual` from [`markStateUtils.ts`](markStateUtils.ts), else append (new `CACHE#` uuid).
- **Consistency**: After successful DataSource-owned persistence writes (e.g. **`mtw.ephemera.renderCache`** after `putCacheRecord`), call **`RenderCache.set`** so same-invocation readers see the new row without re-querying.
- **Boundary aspiration (read-only coupling)**: `internalCache` should couple to DataSource materialized state in a read-only way, and memo updates should come from DataSource write outcomes (stream/bus), not from performing persistence writes inside `internalCache` (which would effectively create a shadow data-source). This is currently prototyped in `ephemera`; if it proves valuable across more lambdas, we plan to promote the invariant to [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md).

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
   - Calls `internalCache.RenderCache.get(parentId)`.
   - Filters to records where `situationId === exampleId` or `authoredExampleId === exampleId` (Room path uses situationId/SITUATION#; Feature/Knowledge use authoredExampleId/EXAMPLE#).
   - Calls `deleteCacheRecord(parentId, DataCategory)` for each match.

This pattern keeps cache rows in sync with blueprint lifecycles without needing Example or Situation IDs in the primary key.

---

## Exact-match Lookup: `internalCache.RenderCache.getExactMatch`

Exact-match lookup is implemented in `lambda/ephemera/internalCache/renderCache.ts` via `internalCache.RenderCache.getExactMatch`.

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

- `internalCache.RenderCache.getExactMatch({ componentId, proposedMarkState, perspective })`
  - Memoizes Dynamo rows via `get(componentId)`.
  - Filters records by `perspectiveMatches(record.perspectiveMatcher, perspective)` (records without `perspectiveMatcher` are skipped).
  - Matches by Mark-state equality semantics (`markStatesEqual` over normalized markState).
  - Returns the first matching record, or `null` when none match.

This is the canonical “does this state exist in cache?” check. Passive render orchestration (`orchestrateRenderRequest` / `findRender`) calls it before the slow path; `generateRoomPreview` assumes exact-match was already tried.

---

## Passive render orchestration and cache-miss generation

Single-item orchestration lives in [`dataSource/renderOrchestration/orchestrationHandler.ts`](../dataSource/renderOrchestration/orchestrationHandler.ts). For a **`Render Requested`** ingress, the handler runs **`intakeRenderRequested`**, then **`findRender`**, then **`generateRoomPreview`** on cache miss when policy allows. **Outcomes are published on `mtw.ephemera.renderOrchestration`** (`streamEvent`); the passive path does **not** register **`roomStateRender`** or deliver terminals via **`conversation.sendMessage`**.

1. Builds perspective from the passive request.
2. Calls `internalCache.RenderCache.getExactMatch` (and pointer validation) as policy dictates.
3. On hit: orchestration emits **`Current Cache Valid`** or **`Exact Match Found`** (IDs only); the **`mtw.ephemera.renderCache`** DataSource refetches and emits **`Render Pertains`** (see [`dataSource/renderCache/AGENT.md`](../dataSource/renderCache/AGENT.md)).
4. On miss (when generation is allowed): **`generateRoomPreview`** publishes **`Generation Started`** / **`Render Generated`** (or errors); **`renderCache`** performs the durable **`putCacheRecord`** and emits **`Render Pertains`** / **`Cache Updated`**.

Durable behavior and types: [`dataSource/renderOrchestration/AGENT.md`](../dataSource/renderOrchestration/AGENT.md), [`dataSource/renderCache/AGENT.md`](../dataSource/renderCache/AGENT.md), and the [pass-through contract](../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

### `generateRoomPreview` (`dataSource/renderOrchestration`)

[`generateRoomPreview.ts`](../dataSource/renderOrchestration/generateRoomPreview.ts) implements **generation on cache miss** (parse WML context, Bedrock `generateRoomDescription`, **`publishOrchestration`** stream outbounds only). It does **not** perform exact-match; orchestration must run that first. It does **not** enqueue **`Put Cache Record`** on success; the **`mtw.ephemera.renderCache`** DataSource writes on **`Render Generated`**.

- Input: `roomId`, `markState`, `assetStack`, optional `generationContextWml`.
- Required: `publishOrchestration` for streaming outbounds; tests inject mocks. **`runWithSingleFlight`** can be overridden for unit tests (`passThroughSingleFlight`).

### Authoring preview (removed)

The former **workbench preview** path (dedicated API message, `Render Preview Requested` ingress, preview conversation type, and preview-only `ConversationStep` streaming to one client) has been **removed** from lambda and charcoal-client. Preview-only **wire types** were removed from **`@tonylb/mtw-interfaces`**; a generic **`ConversationStep`** envelope remains for future correlated streams (see [`packages/mtw-interfaces/AGENT.md`](../../../packages/mtw-interfaces/AGENT.md), [`ts/ephemera.ts`](../../../packages/mtw-interfaces/ts/ephemera.ts)).

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
  - Runtime lookup (orchestration / passive render) reads from the cache and exact-match helpers.
  - This separation lets you change mirroring strategies without touching orchestration lookup logic.

For broader architectural context, see:

- `lambda/ephemera/AGENT.caching.planning.md` – overall caching and generation design.
- `lambda/ephemera/AGENT.caching.firstMVP.planning.md` – MVP phase breakdown and status.
- `lambda/ephemera/AGENT.event.md` – Ephemera events and WebSocket contracts.

