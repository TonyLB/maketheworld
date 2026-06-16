# mtw.ephemera.renderCache (DataSource)

This directory implements the **`mtw.ephemera.renderCache`** DataSource: `api.ephemera` commands (**`Put Cache Record`**, **`Delete Cache Records`**) and **subscription** to **`mtw.ephemera.renderOrchestration`** for the pass-through pipeline.

**This file is the canonical home** for both DataSource behavior and **render-cache domain** documentation: Dynamo schema, `internalCache.RenderCache`, persistence primitives ([`putCacheRecord.ts`](putCacheRecord.ts), [`deleteCacheRecord.ts`](deleteCacheRecord.ts), [`queryCacheRecordsForComponent.ts`](queryCacheRecordsForComponent.ts)), exact-match lookup, and orchestration interaction. **Domain** cache record types and outbound payload guards live in [`baseClasses.ts`](baseClasses.ts). **Mark-state** normalization and equality (`normalizeMarkState`, `markStatesEqual`) live in [`utils/markState.ts`](utils/markState.ts).

**Canonical pass-through semantics** (durable readiness, routing identity, six orchestration outbounds): [AGENT.passThrough.contract.planning.md](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

## Getting Started

1. **Contract** --- Skim the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) for **`Render Pertains`** / **`Cache Updated`**, hit vs generate paths, and **routing identity** (why orchestration sends IDs only on hits). This file covers **how** the DataSource implements those rules.
2. **Producer side** --- Read [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) so you know what arrives on **`mtw.ephemera.renderOrchestration`** and what orchestration does **not** do (no **`Put Cache Record`** on generation success).
3. **Domain cache** --- Read **DynamoDB schema**, **Persistence primitives**, and **Exact-match lookup** below for cache rows, `internalCache.RenderCache`, and matcher behavior. **Boundary invariants** for writes vs lookups are under **Boundary invariants** (also skim **Regression / equivalence checks**).
4. **Code path** --- Entry: [`index.ts`](index.ts). Orchestration subscription: [`subscribedEvents.ts`](subscribedEvents.ts) -> [`handleRenderOrchestrationInbound.ts`](handleRenderOrchestrationInbound.ts). Command path: **`Put Cache Record`** / **`Delete Cache Records`** handlers in the same folder.
5. **Tests** --- Run from [`lambda/ephemera/`](../../): `npm test`. Contract-focused: [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts); cross-layer: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts).
6. **DataSource pattern** --- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**publishedEvents.ts** / **subscribedEvents.ts**).

## CloudWatch instrumentation

Catalog hydrate preflight logs structured lines filterable as **`[mtw.ephemera.renderCache] catalogHydrate`** (see [`ensureAuthoredCatalog.ts`](ensureAuthoredCatalog.ts), [`hydrateAuthoredCatalogDiff.ts`](hydrateAuthoredCatalogDiff.ts), shared [`../catalogHydrateInstrumentation.ts`](../catalogHydrateInstrumentation.ts)). Key **`event`** values: `start`, `catalog_row_loaded`, `skip_ready`, `single_flight_hydrate_start`, `computation_skip_row_missing`, `computation_skip_already_fresh`, `stale_path_*`, `diff_complete`, `mark_hydrated_catalog_ok` / `mark_hydrated_catalog_no_write`, `retrieval_not_ready`, `complete`, `complete_catalog_not_ready`, `failed`.

## Responsibilities

- **Commands:** Validate `api.ephemera` envelopes, persist cache rows or delete them, update **`internalCache.RenderCache`**, publish **`Cache Updated`**, **`Cache Deleted`**, or **`Cache Error`** as appropriate (`index.ts`, `putCacheRecord.ts`, `deleteCacheRecord.ts`). Outbounds use **`outboundBusDelivery: 'publish'`** on the DataSource; boundary **`flushAndSettle`** at lambda exit quiesces concurrent subscribers (no producer-side scoped flush).
- **Pass-through:** On orchestration stream events, apply contract rules in [`handleRenderOrchestrationInbound.ts`](handleRenderOrchestrationInbound.ts):
  - **`Current Cache Valid`** / **`Exact Match Found`**: orchestration sends **IDs only** + routing; this DataSource **refetches** via **`internalCache.RenderCache.get`**, then emits **`Render Pertains`** only (no Dynamo write).
  - **`Render Generated`**: orchestration signals generation-complete with **full** content and **no** durability promise; this DataSource performs the **single** `putCacheRecord`, then emits **`Render Pertains`** then **`Cache Updated`** (same pairing as the direct **`Put Cache Record`** command path).
- **Imports:** Inbound orchestration payloads use types from [`../renderOrchestration/publishedEvents.ts`](../renderOrchestration/publishedEvents.ts) (ephemera-local; not **`mtw-interfaces`**). Outbound **`Render Pertains`** / **`Cache Updated`** shapes are defined with this DataSource (`baseClasses.ts`); optional future split: local `publishedEvents.ts` for cache-only outbounds per DataSource pattern.

## Boundary invariants

Cross-cutting rules for cache I/O (social + technical):

- **Orchestration and policy** must not call Dynamo or cache persistence helpers directly. Route writes through **`mtw.ephemera.renderCache`** (this DataSource): **`Put Cache Record`** / **`Delete Cache Records`**, or the pass-through path from [`handleRenderOrchestrationInbound.ts`](handleRenderOrchestrationInbound.ts) as defined in the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).
- **`internalCache.RenderCache`** is the only surface that should expose **exact-match** lookup to callers (`getExactMatch`). Do not call `get` and reimplement matcher / markState logic at orchestration or policy call sites.
- **`mtw.ephemera.renderCache`** is the only place that should expose **cache persistence writes** to the rest of the system.

Persistence primitives (`putCacheRecord`, `deleteCacheRecord`, `queryCacheRecordsForComponent`) and **domain / Dynamo types** (`EphemeraCacheDynamoItem`, etc.) live in this directory ([`baseClasses.ts`](baseClasses.ts)). Longer-form schema and flow notes are in the sections below.

## Regression / equivalence checks

When changing matching or persistence behavior, validate:

- **Exact-match:** matcher and perspective filtering behavior unchanged; markState normalization and equality unchanged.
- **Bus ordering:** this DataSource still publishes **`Cache Updated`** or **`Cache Error`** as appropriate; **`internalCache.RenderCache.set`** runs after successful persistence and before any subsequent read in the same invocation that depends on the new row.

## Goals

- Support **exact-match** lookup from a proposed Mark state and perspective (asset stack) to a previously rendered Example.
- Keep Ephemera's cache as the **runtime source of truth** for rendered descriptions; Ephemera does not reach back into Assets during orchestration lookup.
- Preserve enough metadata (markState, perspectiveId, provenance) so that future features (LLM generation, constellation search, richer invalidation) can build on the same schema.

It is the concrete realization of the schema and flow outlined in:

- [`lambda/ephemera/AGENT.caching.planning.md`](../../AGENT.caching.planning.md)
- [`lambda/ephemera/AGENT.caching.firstMVP.planning.md`](../../AGENT.caching.firstMVP.planning.md)

The cache is designed for **Room/Feature/Knowledge** components whose content depends on Mark state and asset-layer perspective.

## DynamoDB schema

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

There is no "cache per Example ID" or "RoomId + Mark state" key; this keeps the schema compatible with future semantic / constellation search.

### Authored cache (invalidate + hydrate)

Steady-state model: Assets pushes skinny invalidations; Ephemera bumps catalog versions and hydrates materialized rows on orchestration resolve; lookup is version-gated.

**End-to-end flow:**

1. **Invalidate on blueprint change:** [`mtw.assets.componentExamples`](../../../assets/componentExamples/index.ts) publishes **`ExampleInvalidated`** (no **`example`** body). This DataSource bumps **`catalogVersion`** on existing **`Cache::${perspectiveKey}`** rows only (no catalog row creation on invalidation).
2. **Hydrate on resolve:** [`ensureAuthoredCatalog.ts`](ensureAuthoredCatalog.ts) runs from [`orchestrationHandler.ts`](../renderOrchestration/orchestrationHandler.ts) after intake, before **`findRender`**, when the catalog is stale. Desired set from **`internalCache.ComponentExamples.get`**; diff writes version-stamped authored **`CACHE#`** rows.
3. **Lookup:** **`getExactMatch`** and pointer fast-path consider only **`CACHE#`** rows at the current **`catalogVersion`** on the perspective's catalog row.

| Shape | SK / stream | Role |
| --- | --- | --- |
| **`EphemeraCacheCatalogRow`** | `Cache::${perspectiveKey}` under host `EphemeraId` | Per-perspective catalog: `catalogVersion`, `hydratedCatalogVersion`, canon **`assetStack`**, optional **`currentCacheId`** (fast pointer on catalog row). |
| **`SituationCacheAdjacencyRow`** | `Link::${host}::Cache::${perspectiveKey}` under `SITUATION#` | Inverse index for Situation-scoped invalidation fan-out. |
| **`ExampleInvalidated`** | `mtw.assets.componentExamples` | Skinny invalidation-only push from Assets; handled in [`handleExampleInvalidated.ts`](handleExampleInvalidated.ts). |
| **`Ephemera RenderCache Finding`** | `mtw.diagnostics` | Lazy catalog bump; handled in [`handleRenderCacheFinding.ts`](handleRenderCacheFinding.ts). |
| **`AuthoredExample`** | `mtw-gateways` assembly | Blueprint desired set for hydrate (`internalCache.ComponentExamples.get`). |

#### Layer participation rule (invalidation)

A catalog or adjacency row is a **bump target** for an invalidation with **`editAssetId`** iff `row.assetStack.includes(editAssetId)` after stack canonicalization (same input shape as [`computePerspectiveKey`](../../../../packages/mtw-interfaces/ts/perspective.ts)). An edit in overlay asset **B** stales perspectives whose participation stack includes **B** (e.g. `[A,B]`, `[A,B,C]`) but not **`[A]`** alone.

Implementation: [`assetStackIncludesEditAssetId`](../../../../packages/mtw-gateways/ts/assets/components/componentExamples/membership.ts) in **`mtw-gateways`**; used from [`packages/mtw-gateways/ts/ephemera/renderCache/guards.ts`](../../../../packages/mtw-gateways/ts/ephemera/renderCache/guards.ts). Applies to **component-scoped** (`Cache::` row filter) and **Situation-scoped** (adjacency link filter, then bump host catalog) paths in [`handleExampleInvalidated.ts`](handleExampleInvalidated.ts).

**Catalog rows:** [`catalogRow.ts`](catalogRow.ts) (`queryCatalogRowsForComponent`, `getCatalogRow`, `putCatalogRow`, `conditionalInvalidateCatalogRow`, `createCatalogRowForHydrate`, `markCatalogHydratedAtVersion`). Guards: [`catalogGuards.ts`](catalogGuards.ts).

**Hydrate (orchestration preflight):** [`ensureAuthoredCatalog.ts`](ensureAuthoredCatalog.ts) --- create-on-first-hydrate `Cache::` row, `internalCache.ComponentExamples.get` when stale, [`hydrateAuthoredCatalogDiff.ts`](hydrateAuthoredCatalogDiff.ts) (version-guarded put/delete `CACHE#` + adjacency), conditional catalog ready write. Coalescing: [`singleFlightAuthoredCatalogHydrate.ts`](singleFlightAuthoredCatalogHydrate.ts) (`EPHEMERA_AUTHORED_CATALOG_HYDRATE_CATEGORY`, cohort `componentId::perspectiveKey`). Mapping: [`authoredExampleToCacheRecord.ts`](authoredExampleToCacheRecord.ts). **Does not** run on raw cache reads in v1.

**Situation adjacency:** [`situationAdjacency.ts`](situationAdjacency.ts) (partition query/put/delete; `upsertAdjacencyForAuthoredSlice`, `deleteAdjacencyForRemovedSlice` for hydrate diff).

**Perspective pointers:** [`perspectivePointer.ts`](perspectivePointer.ts) reads/writes `currentCacheId` on catalog rows; dual-reads legacy `Meta::Room.currentCacheByPerspective` during migration.

**Invalidation:** [`handleExampleInvalidated.ts`](handleExampleInvalidated.ts) wired from [`index.ts`](index.ts) on `ExampleInvalidated`. Component path: query `Cache::` rows, layer-participation filter, conditional bump when catalog was ready. Situation path: adjacency fan-out; `entityRemoved: true` bumps all links and deletes the partition.

**Diagnostics heal:** [`handleRenderCacheFinding.ts`](handleRenderCacheFinding.ts) on `Ephemera RenderCache Finding`. Iterates `finding.targetCatalogs` (`{ ephemeraId, perspectiveKey }`); bumps existing `Cache::${perspectiveKey}` rows only; empty array is a no-op; no blueprint scan on receive; no eager hydrate. Publisher: diagnostics [`renderCacheDriftSweep`](../../../diagnostics/renderCacheDriftSweep/index.ts) (caller-supplied `roomIds`, v1).

**Version-gated lookup:** [`internalCache/renderCache.ts`](../../internalCache/renderCache.ts) `getExactMatch` uses `isAuthoritativeCacheRow` when a `Cache::` catalog row exists; legacy unversioned match when no catalog row yet. [`findRender.ts`](../renderOrchestration/findRender.ts) pointer fast-path requires authoritative row + catalog.

**Retired:** `mtw.ephemera.examples` mirror DataSource (was [`../componentExamples.ts`](../componentExamples.ts)). Steady-state invalidation and diagnostics heal run in this package only.

### Record shape

[`baseClasses.ts`](baseClasses.ts) defines the core types.

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
  - Mirrors Situation facet prose (`displayName`, `summary`, `description`) from Assets.
- `provenance`:
  - `{ type: 'authored' | 'generated' }`
  - Distinguishes authored situation facets (hydrate) from LLM-generated renders.
- `perspectiveId`: string
  - **Known inactive** (not used for matching). Kept on the record pending possible later use for search optimization.
- `perspectiveMatcher`: PerspectiveMatcher
  - Required and forbidden asset ids for matcher-based matching. Used by `perspectiveMatches(matcher, requestPerspective)` at lookup time.
- `situationId?: string`
  - Optional link to the Situation UUID for authored slices. Hydrate diff keys upsert/delete and adjacency maintenance by **`situationId`**.
- `authoredExampleId?: string`
  - Optional legacy link for **Feature/Knowledge** rows when a distinct blueprint Example id was stored on the row.

#### EphemeraCacheDynamoItem (storage model)

Stored directly in DynamoDB:

- `EphemeraId`: component id (Room/Feature/Knowledge).
- `DataCategory`: `CACHE#${uuid}`.
- `markState`, `renderedContent`, `provenance`, `perspectiveId`, `perspectiveMatcher`, `situationId?`, `authoredExampleId?`.
- `catalogVersion?` (optional; missing treated as **0** for version-gated lookup once catalog rows ship).

`isEphemeraCacheDynamoItem` in [`baseClasses.ts`](baseClasses.ts) enforces the expected shape at read time.

## Perspective and asset stacks

### Perspective and matcher-based matching (Phase 5.7)

Examples are authored against a **stack of assets** (inheritance chain). The same logical Example can render differently depending on which assets are in the stack and in what order. We treat each **distinct render** as a separate cache record and identify the context by a **perspective**:

- `assetStack`: ordered list of asset ids that produced the render (canon participation at hydrate).
- `perspectiveMatcher`: `{ requiredAssetIds, forbiddenAssetIds? }` written on each **`CACHE#`** row at hydrate from canon **`assetStack`**. Lookup uses `perspectiveMatches(matcher, requestPerspective)` so a cache record matches when the request's asset stack contains all required and none of the forbidden assets.
- `perspectiveId`: stored on every record but **not used for matching** (known inactive); kept pending possible later use for search optimization.

### Asset stack sources

- **Catalog rows and hydrate:** canon **`assetStack`** on `Cache::${perspectiveKey}` rows is written at hydrate from state/orchestration participation order.
- **Assets invalidation:** **`ExampleInvalidated`** with **`editAssetId`** only (no footprint stack on the wire); see **Layer participation rule** above.
- **Authoring Preview (RoomPreviewEditor)**:
  - On the client, `assetStack` is built from `useWorkbenchAsset()`:
    - `assetStack = [...inheritedByAssetId.map(({ assetId }) => assetId), AssetId]`
  - This mirrors the same "base-first, current-asset-last" ordering.

Preview request sends `assetStack`; Ephemera builds `perspective = { assetStack }` and filters records with `perspectiveMatches(record.perspectiveMatcher, perspective)`.

## Persistence primitives

[`putCacheRecord.ts`](putCacheRecord.ts) and [`deleteCacheRecord.ts`](deleteCacheRecord.ts) provide low-level write primitives (put/delete) over the Ephemera table. They operate strictly in terms of component ids and cache records (no knowledge of Events or WebSockets). `mtw.ephemera.renderCache` is the production entry that calls them after `api.ephemera` commands.

Catalog and adjacency primitives are listed under **Authored cache (invalidate + hydrate)** above.

### DataSource-owned `queryCacheRecordsForComponent(componentId)`

[`queryCacheRecordsForComponent.ts`](queryCacheRecordsForComponent.ts) provides the Dynamo query used by request-scoped read memoization.

- Query Ephemera table where:
  - `EphemeraId = componentId`
  - `DataCategory begins_with 'CACHE#'`
- Map the resulting items into `EphemeraCacheRecord` instances.
- Returns **all** records (authored and generated) for that component.

### Request-scoped read memo: `internalCache.RenderCache`

[`../../internalCache/renderCache.ts`](../../internalCache/renderCache.ts) extends **`RenderCacheCacheHandler`** from [`@tonylb/mtw-gateways/ts/ephemera/renderCache`](../../../../packages/mtw-gateways/ts/ephemera/renderCache/index.ts) (cleared with [`InternalCache.clear()`](../../internalCache/index.ts) each handler run). **Normative read path:** steady-state code calls **`internalCache.RenderCache.get*`** (not direct **`ephemeraDB`** or DataSource fetch helpers). Dynamo **`fetch`** and shared guards live in the gateway package; this DataSource owns **Dynamo writes** only.

- **`getCacheRows(componentId)`** / **`get(componentId)`** – Read-through memo over **`CACHE#`** rows; same array reference per component per invocation.
- **`getCatalogRows(componentId)`** / **`getCatalogRow(componentId, perspectiveKey)`** – Catalog row reads (also memoized in the package handler).
- **`flush()`** – Lifecycle hook; `InternalCache.flush()` awaits **`RenderCache.flush()`**.

**Memo write APIs** (no Dynamo; call after DataSource persistence):

| API | Memo target | Typical caller |
| --- | --- | --- |
| **`set(...)`** | **`CACHE#`** rows | **`putCacheRecord`**, pass-through **`Render Generated`** |
| **`setCatalogRow({ row })`** | **`Cache::`** catalog row (+ per-component catalog list) | **`putCatalogRow`**, **`createCatalogRowForHydrate`**, **`markCatalogHydratedAtVersion`** success |
| **`deleteCacheRecords`** | Remove **`CACHE#`** entries in memo | Hydrate diff, deletes |
| **`invalidate(componentId)`** | All **`CACHE#`** and **`Cache::`** memo for the component | Catalog invalidation bump |

**`setCatalogRow`** fixes create-on-first-resolve when an earlier **`getCatalogRow`** memoized **`undefined`**, without evicting materialized **`CACHE#`** memo. **`invalidate`** remains appropriate when the catalog epoch changes and readers need a full refetch.

### `putCacheRecord(componentId, record, existingDataCategory?)`

- If `existingDataCategory` is provided and starts with `CACHE#`, use it as `DataCategory` (overwrite in place). Otherwise generate a new UUID and use `DataCategory = 'CACHE#' + uuid`.
- Write a single Dynamo item with:
  - `EphemeraId = componentId`
  - `DataCategory` as above
  - `record.markState`, `record.renderedContent`, `record.provenance`, `record.perspectiveId`, `record.perspectiveMatcher`, `record.situationId?`, `record.authoredExampleId?`
- Returns the `DataCategory` used.
- Used by:
  - Hydrate diff and orchestration **`Render Generated`** pass-through (authored and generated rows).
  - Future generation flows (e.g. LLM-based renders) to store generated content under `provenance.type = 'generated'`.

### `deleteCacheRecord(componentId, dataCategory)`

- Delete the item with:
  - `EphemeraId = componentId`
  - `DataCategory = dataCategory`
- Typically used after an in-memory filter step to select the correct records to delete (e.g. by `situationId` or `authoredExampleId`).

### Legacy mirror path (retired)

Historical push-mirror path (`ExampleUpdated` / `ExampleRemoved` with full payloads, `mtw.ephemera.examples` forwarder) is removed. Steady-state authored row removal is via hydrate diff (delete-by-absence) after catalog invalidation.

## Exact-match lookup: `internalCache.RenderCache.getExactMatch`

Exact-match lookup is implemented in [`../../internalCache/renderCache.ts`](../../internalCache/renderCache.ts) via `internalCache.RenderCache.getExactMatch`.

### Normalization

To avoid ordering bugs, comparison normalizes markState:

- Sort `markValue` by `mark` (Mark UUID).
- Compare normalized arrays for equality.

The proposed mark state and each record's markState are normalized before comparison. This ensures:

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

This is the canonical "does this state exist in cache?" check. Passive render orchestration (`orchestrateRenderRequest` / `findRender`) calls it before the slow path; `generateRoomPreview` assumes exact-match was already tried.

## Passive render orchestration and cache-miss generation

Single-item orchestration lives in [`../renderOrchestration/orchestrationHandler.ts`](../renderOrchestration/orchestrationHandler.ts). For a **`Render Requested`** ingress, the handler runs **`intakeRenderRequested`**, then **`ensureAuthoredCatalog`**, then **`findRender`**, then **`generateRoomPreview`** on cache miss when policy allows. **Outcomes are published on `mtw.ephemera.renderOrchestration`** (`streamEvent`); the passive path does **not** register **`roomStateRender`** or deliver terminals via **`conversation.sendMessage`**.

1. Builds perspective from the passive request.
2. Hydrates authored catalog when stale (`ensureAuthoredCatalog`).
3. Calls `internalCache.RenderCache.getExactMatch` (and pointer validation) as policy dictates.
4. On hit: orchestration emits **`Current Cache Valid`** or **`Exact Match Found`** (IDs only); this DataSource refetches and emits **`Render Pertains`** (see **Pass-through** under **Responsibilities** and **Correlation vs routing** below).
5. On miss (when generation is allowed): **`generateRoomPreview`** publishes **`Generation Started`** / **`Render Generated`** (or errors); this DataSource performs the durable **`putCacheRecord`** on **`Render Generated`** and emits **`Render Pertains`** / **`Cache Updated`**.

Durable behavior and types: [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md), this file, and the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).

### `generateRoomPreview` (`dataSource/renderOrchestration`)

[`../renderOrchestration/generateRoomPreview.ts`](../renderOrchestration/generateRoomPreview.ts) implements **generation on cache miss** (parse WML context, Bedrock `generateRoomDescription`, **`publishOrchestration`** stream outbounds only). It does **not** perform exact-match; orchestration must run that first. It does **not** enqueue **`Put Cache Record`** on success; this DataSource writes on **`Render Generated`**.

- Input: `roomId`, `markState`, `assetStack`, optional `generationContextWml`.
- Passive publishers often **omit** `generationContextWml`. In that case [`generateRoomPreview.ts`](../renderOrchestration/generateRoomPreview.ts) resolves grounding context from **`internalCache.GenerationContext`** for the same `roomId` and `assetStack`. Optional ingress WML remains a **compat** parse path when callers supply it. See [`../../internalCache/generationContext/AGENT.md`](../../internalCache/generationContext/AGENT.md).
- Required: `publishOrchestration` for streaming outbounds; tests inject mocks. **`runWithSingleFlight`** can be overridden for unit tests (`passThroughSingleFlight`).

### Authoring preview (removed)

The former **workbench preview** path (dedicated API message, `Render Preview Requested` ingress, preview conversation type, and preview-only `ConversationStep` streaming to one client) has been **removed** from lambda and charcoal-client. Preview-only **wire types** were removed from **`@tonylb/mtw-interfaces`**; a generic **`ConversationStep`** envelope remains for future correlated streams (see [`packages/mtw-interfaces/AGENT.md`](../../../../packages/mtw-interfaces/AGENT.md), [`ts/ephemera.ts`](../../../../packages/mtw-interfaces/ts/ephemera.ts)).

## Ingress and wiring

- **`receiveEvents`:** Same path for **`api.ephemera`** and subscribed bus envelopes; orchestration events are recognized by [`subscribedEvents.ts`](subscribedEvents.ts) (`isRenderCacheSubscribedEnvelope`) and dispatched in [`index.ts`](index.ts).
- **No indirect invoke:** Orchestration does not call this DataSource as a function; subscription only (contract uncertainty 2).

## Correlation vs routing

**`Render Pertains`** carries lean routing (**`componentId`**, **`perspectiveKey`**, **`cacheId`**, **`cacheRecord`**) for indexing; it does **not** rely on a synthetic **`conversationId`** on the wire for Perception (see **Routing identity on producer streams** in the contract doc). How **`mtw.ephemera.perception`** uses that routing to **correlate** internal signals to audience delivery is documented in [`../perception/AGENT.md`](../perception/AGENT.md).

## Refetch edge cases

If **`Current Cache Valid`** / **`Exact Match Found`** include a **`cacheId`** but refetch misses (stale ID, rare races), the handler logs and emits nothing until product rules tighten (overlaps contract uncertainties 6 and 11).

## Design notes and future direction

- **One row per distinct render**:
  - The schema is explicitly "one cache row per distinct render" (component + markState + perspective), not "one row per Example id." This keeps the door open for:
    - Generated content.
    - Future Situation/facet-based models.
    - Guidance-constellation search.

- **Exact match first, extensible later**:
  - v1 only uses exact Mark-state equality.
  - The same record shape (markState, renderedContent, perspectiveId, perspectiveMatcher, provenance) is intended to support:
    - Later fuzzy/semantic search (constellation by Guidance).
    - LLM-based generation pipelines that treat existing records as prompts or neighbors.

- **Invalidate + hydrate vs runtime lookup**:
  - Authored **`CACHE#`** rows materialize via **`ensureAuthoredCatalog`** / hydrate diff when orchestration resolves (or when catalog is already stale from invalidation). Assets only pushes **`ExampleInvalidated`**; no full example bodies on the wire.
  - Runtime lookup (orchestration / passive render) reads version-gated rows via **`getExactMatch`** and pointer helpers without reaching back into Assets during lookup.
  - Invalidation, hydrate, and catalog/adjacency CRUD live in **`mtw.ephemera.renderCache`**; orchestration calls **`ensureAuthoredCatalog`** then **`findRender`**.

For broader architectural context, see:

- [`lambda/ephemera/AGENT.caching.planning.md`](../../AGENT.caching.planning.md) – overall caching and generation design.
- [`lambda/ephemera/AGENT.caching.firstMVP.planning.md`](../../AGENT.caching.firstMVP.planning.md) – MVP phase breakdown and status.
- [`lambda/ephemera/AGENT.event.md`](../../AGENT.event.md) – Ephemera events and WebSocket contracts.

## Tests

- Package: [`index.test.ts`](index.test.ts), [`putCacheRecord.test.ts`](putCacheRecord.test.ts), [`deleteCacheRecord.test.ts`](deleteCacheRecord.test.ts), [`queryCacheRecordsForComponent.test.ts`](queryCacheRecordsForComponent.test.ts), [`catalogRow.test.ts`](catalogRow.test.ts), [`catalogGuards.test.ts`](catalogGuards.test.ts), [`situationAdjacency.test.ts`](situationAdjacency.test.ts), [`handleExampleInvalidated.test.ts`](handleExampleInvalidated.test.ts), [`handleRenderCacheFinding.test.ts`](handleRenderCacheFinding.test.ts), [`ensureAuthoredCatalog.test.ts`](ensureAuthoredCatalog.test.ts), [`hydrateAuthoredCatalogDiff.test.ts`](hydrateAuthoredCatalogDiff.test.ts), [`authoredCatalogHydrateExactMatch.test.ts`](authoredCatalogHydrateExactMatch.test.ts), [`perspectivePointer.test.ts`](perspectivePointer.test.ts).
- **Authored catalog hydrate:** [`authoredCatalogHydrateExactMatch.test.ts`](authoredCatalogHydrateExactMatch.test.ts) chains **`ensureAuthoredCatalog`** -> version-stamped **`CACHE#`** rows -> **`internalCache.RenderCache.getExactMatch`** (only rows at the current **`catalogVersion`** on the perspective's **`Cache::`** row are authoritative).
- Contract: [`passThroughContract.scaffold.test.ts`](passThroughContract.scaffold.test.ts), shared [`../passThroughContractFixtures.ts`](../passThroughContractFixtures.ts).
- Cross-layer: [`../passThroughOrchestrationToCache.integration.test.ts`](../passThroughOrchestrationToCache.integration.test.ts).
- **`internalCache`:** [`../../internalCache/renderCache.test.ts`](../../internalCache/renderCache.test.ts) (`getExactMatch` version gate).

From [`lambda/ephemera/`](../../): `npm test -- --testPathPattern=renderCache` (Jest).

## Related docs

- [`../renderOrchestration/AGENT.md`](../renderOrchestration/AGENT.md) --- orchestration stream, single-flight, emission map.
- [`../perception/AGENT.md`](../perception/AGENT.md) --- **`mtw.ephemera.perception`**: consumer of **`Render Pertains`** / **`Cache Updated`** semantics for audience delivery.
- [Pass-through contract (draft)](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md).
- [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md).
