# MTW Gateways (`@tonylb/mtw-gateways`)

## Purpose

`mtw-gateways` is the shared home for **cross-lambda read surfaces** (and shared cache-handler implementations) that **multiple lambdas** import when they need on-demand access to materialized data in DynamoDB rows that are written and owned by **another** lambda's DataSource.

A "gateway" here is the small, deliberate surface that bridges:

- **Authoritative writer** (a `lambda/<owner>/dataSource/...` projection that maintains the rows; for example [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/AGENT.md) for `Meta::Import::...` rows).
- **Reader lambdas** (any number; for example ephemera reading the same rows during render / merge).

What lives in this package:

- **Pure read helpers**: `Query` / `GetItem` / `BatchGetItem` compositions, stable projection types, and DynamoDB row normalization.
- **Key and prefix builders**: shared `AssetId` / `DataCategory` constructors so reader and writer agree on encoding (for example, mirroring the `Meta::Import::${parentStripped}::${childStripped}` encoding documented under [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md)).
- **Cache-backed gateway factories**: `createXCacheHandler(...)` returning a handler that lambdas register on their per-invocation `InternalCache`.
  - Any direct Dynamo reads are blackboxed inside the handler's `promiseFactory`.
  - Handlers may also expose **`set*` / `delete*` / `invalidate`** that mutate **invocation-scoped memo only** (see [**Dynamo writes vs invocation memo**](#dynamo-writes-vs-invocation-memo)); they do **not** write Dynamo.
  - Any additional data dependencies arrive through the same `InternalCache`-consistent injection story (narrow deps, cache-backed loaders).
- **Compute-only gateways** (see [**Projection-read vs compute-only gateways**](#projection-read-vs-compute-only-gateways)): deterministic composition over **injected ports** (narrow structural interfaces, not coupled to `InternalCache` internals). They do not own Dynamo row shapes; add `keys.ts` / `fetch.ts` only if a gateway later grows direct I/O.
- **Shared pure helpers for diagnostics and healing** (optional per gateway): deterministic functions---for example expected **`Meta::Import`** hop descriptors from **`StandardComponent`** state---so diagnostics sweeps, **`api.assets`** heal paths, and the live projector do not fork semantic rules. Co-locate under the same `ts/<area>/<name>/` tree as the read surface; see [**Shared helpers for diagnostics and healing**](#shared-helpers-for-diagnostics-and-healing).

What stays out (see **Non-goals** below): cache singletons, `clear()` / `flush()` orchestration on the lambda `InternalCache`, and **Dynamo write paths** owned by DataSources.

## Non-goals

- **No cross-lambda cache coherence.** Each lambda keeps its own per-invocation `InternalCache` singleton. Reading via a shared gateway does not synchronize state across lambdas; if two lambdas need consistent values they coordinate via events, not via this package.
- **No DataSource write logic (no write-through).** All **Dynamo** mutating helpers (puts, deletes, projection maintenance, orchestrating heals) stay in the authoritative `lambda/<owner>/dataSource/...` location. Gateway cache **`set*` / `delete*` / `invalidate`** methods must **not** call `putItem` / `deleteItem` / orchestrate heals---they only update the **per-invocation** in-memory view after the lambda has already persisted (or when dropping stale memo). See [**Dynamo writes vs invocation memo**](#dynamo-writes-vs-invocation-memo). **Pure** projection helpers used *before* writes (expected hops, diff inputs) may still live here---see [**Shared helpers for diagnostics and healing**](#shared-helpers-for-diagnostics-and-healing).
- **No `DeferredCache` redefinition.** `mtw-gateways` **composes** with the `DeferredCache` and surrounding patterns in [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md); it does not fork or replace them.
- **No replacement for area `AGENT.md` files.** Gateway docs in this package describe the **gateway surface**. Steady-state architecture for the underlying projection still lives next to the writer (e.g. assets verticals `AGENT.md`).
- **No cross-lambda cache orchestration or shared cache instances exported from here.** Gateways may export cache handler bundles/factories for per-invocation `InternalCache` registration, but they must not coordinate cache coherence across lambdas or implement global subscription/streaming orchestration.

## Ownership table

Each gateway in this package must have a row here. Add a row when a new gateway lands; update it whenever a reader is added or the writer moves.

| Gateway | Authoritative writer | Readers | Notes |
| --- | --- | --- | --- |
| **Component data (pair-addressed reads)** | [`lambda/assets/dataSource/caching/`](../../lambda/assets/dataSource/caching/) ([`cacheAsset`](../../lambda/assets/dataSource/caching/cacheAsset.ts) maintains universal-key component rows in `assetDB`). | Ephemera, assets, and diagnostics: **`internalCache.ComponentData`** via **`createComponentDataCacheHandler`**. | **Normative:** [`componentData/`](ts/assets/components/componentData/index.ts) --- **`createComponentDataCacheHandler`** (pair **`getItems`**), **`authoritativeFromParticipationOrder`**. **Maintenance-only partition scan:** subpath [`componentData/exhaustiveScan`](ts/assets/components/componentData/exhaustiveScan.ts) + [`exhaustiveScanCache`](ts/assets/components/componentData/exhaustiveScanCache.ts) (not barrel-exported). Deep import: `@tonylb/mtw-gateways/ts/assets/components/componentData`. |
| **Component import vertical (`Meta::Import`)** | [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/) (`mtw.assets.components.verticals`). | [`lambda/assets/internalCache/index.ts`](../../lambda/assets/internalCache/index.ts) (**`createImportVerticalMetaCacheHandler`**); [`lambda/diagnostics/internalCache/index.ts`](../../lambda/diagnostics/internalCache/index.ts) (**same** tier-1 **`ComponentData`** / **`ComponentVerticals`** handlers); [`lambda/diagnostics/componentVerticalMisalignmentSweep`](../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts) (asset-level rollup + findings); aggregate assembly consumes vertical reads ([`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts)). | Key builders, `Query` envelope, **`ImportVerticalMetaCache`**, normalized hop types, **`ImportVerticalConsistencyAnalyzer`**, classification helpers per [**Shared helpers for diagnostics and healing**](#shared-helpers-for-diagnostics-and-healing). Tier-1 cache: [`importVerticalMetaCache.ts`](ts/assets/components/verticals/importVerticalMetaCache.ts). Deep import: `@tonylb/mtw-gateways/ts/assets/components/verticals`. Discoverability: [`readModel.ts`](../../lambda/assets/dataSource/components/verticals/readModel.ts). |
| **Component aggregate (merge assembly)** | Composed on read from authoritative rows in [`lambda/assets/dataSource/caching/`](../../lambda/assets/dataSource/caching/) (per-asset component bodies) and [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/) (`Meta::Import` hops). No separate Dynamo projection for merged blobs in v1. | Package **`ComponentAggregateMergedCache`** / **`createComponentAggregateCacheHandler(slice)`** (same `DeferredCache` + **`get`/`clear`/`flush`/`invalidate`** shape as other handlers); lambdas register an instance on **`InternalCache`** and wire lifecycle (assets [`internalCache` AGENT](../../lambda/assets/internalCache/AGENT.md)). Slice **`ComponentData`** must be participation-scoped (**`ComponentDataParticipationLoader`**, pair **`getAcrossAssets`**); merge batch calls **`authoritativeFromParticipationOrder`** (no partition enumerate). Future [`fetchImportDefaults`](../../lambda/assets/fetchImportDefaults/index.ts). | [**Aggregate read surfaces**](#aggregate-read-surfaces-primary-vs-secondary) below: **`createComponentAggregateCacheHandler`** is the **primary** runtime pattern; **`createComponentAggregateGateway`** / **`createAggregateGateway`** are **secondary**. **`aggregatePerspectiveCacheKey`**, **`mergedComponentFromAuthoritative`**. Pure merge in [`assemble.ts`](ts/assets/components/aggregate/assemble.ts). Initiative: [`AGENT.componentAggregate.planning.md`](../../taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md). Deep import: `@tonylb/mtw-gateways/ts/assets/components/aggregate`. |
| **Component examples (authored slices assembly)** | N/A (compute-only; composes **`ComponentAggregateMergedCache`** + enrichment). Steady-state invalidations from [`lambda/assets/componentExamples/`](../../lambda/assets/componentExamples/). | **Primary (lambda wiring):** register **`createComponentExamplesCacheHandler({ ComponentAggregate })`** on **`internalCache.ComponentExamples`** (Ephemera + diagnostics), same pattern as aggregate. **Consumers:** [`lambda/ephemera/dataSource/renderCache/`](../../lambda/ephemera/dataSource/renderCache/) hydrate via **`internalCache.ComponentExamples.get(...)`**; [`lambda/diagnostics/`](../../lambda/diagnostics/) blueprint diff ([`renderCacheDriftSweep`](../../lambda/diagnostics/renderCacheDriftSweep/index.ts)). | [**Component examples read surfaces**](#component-examples-read-surfaces-primary-vs-secondary) below. **`AuthoredExample`** / **`AuthoredExampleSet`**; **`assetStackIncludesEditAssetId`**. Steady-state: [`renderCache/AGENT.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.md). Deep import: `@tonylb/mtw-gateways/ts/assets/components/componentExamples`. |
| **Component topology (room exit projection)** | N/A (compute-only; composes **`ComponentAggregateMergedCache`** + **`projectRoomExits`** in **`mtw-wml`**). Steady-state invalidations from [`lambda/assets/componentTopology/`](../../lambda/assets/componentTopology/) (`mtw.assets.componentTopology`). | **Primary (M4 wiring):** **`createComponentTopologyCacheHandler({ ComponentAggregate })`** registered on Ephemera **`internalCache.ComponentTopology`**. **Consumers:** **`mtw.ephemera.affordanceCache`** hydrate via **`internalCache.ComponentTopology.get(...)`** (not on invalidation receive). | [**Component topology read surfaces**](#component-topology-read-surfaces-primary-vs-secondary) below. **`ProjectedRoomTopology`**; **`filterAreaEdgeReferrers`**. Steady-state: [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md). Deep import: `@tonylb/mtw-gateways/ts/assets/components/componentTopology`. |
| **Affordance cache (`Affordance::` colocated topology rows)** | [`lambda/ephemera/dataSource/affordanceCache/`](../../lambda/ephemera/dataSource/affordanceCache/) (**`mtw.ephemera.affordanceCache`** DataSource). | **Primary:** **`createAffordanceCacheCacheHandler(ephemeraDB)`** on **`internalCache.AffordanceCache`** (Ephemera via **`AffordanceCacheData`**). **Consumers:** **`AffordanceRoomDeliverable.get`**; nav (**D34**) via **`getRoomExitTargetsForCharacter`**. | [**Affordance cache read surfaces**](#affordance-cache-read-surfaces-primary-vs-secondary) below. Module doc: [`ts/ephemera/affordanceCache/AGENT.md`](ts/ephemera/affordanceCache/AGENT.md). Deep import: `@tonylb/mtw-gateways/ts/ephemera/affordanceCache`. |
| **Thinking schedule + results (Ephemera thinking rows)** | [`lambda/ephemera/dataSource/thinking/`](../../lambda/ephemera/dataSource/thinking/) (writes: **`EphemeraDataSource`** and persistence modules). | [`lambda/ephemera/internalCache/index.ts`](../../lambda/ephemera/internalCache/index.ts) (**`createThinkingResultReadCacheHandler`**, **`createThinkingScheduleReadCacheHandler`**, **`createThinkingJobReadCacheHandler`** on **`internalCache.ThinkingResults`**, **`ThinkingSchedules`**, **`ThinkingJobs`**). | [`ts/ephemera/thinking`](ts/ephemera/thinking/index.ts): **`JOB#`** adjacency **`Query`**; **`listThinkingSchedulesForJob`**; **`TASK#${workItemId}`** + **`Meta::Result`** / **`Meta::Schedule`** **`GetItem`**; **`getJobMetaItem`** / **`fetchThinkingJobSnapshot`** (consistent job-partition reads); **`queryCompletedJobGenerationIds`** / **`buildThinkingCompletedJobsSnapshot`** for subscribe snapshots; **`thinkingJobReadSnapshotToCompletedEvent`**; **`ThinkingResultEvent`** / **`ThinkingScheduleEvent`** / job meta normalization; **`ThinkingResultReadCache`**, **`ThinkingScheduleReadCache`** (key = **`workItemId`**), **`ThinkingJobReadCache`** (key = **`generationId`**). Tests: [`index.test.ts`](ts/ephemera/thinking/index.test.ts). Deep import: `@tonylb/mtw-gateways/ts/ephemera/thinking`. Steady-state keys: [`lambda/ephemera/dataSource/thinking/AGENT.md`](../../lambda/ephemera/dataSource/thinking/AGENT.md). |
| **Render cache (`CACHE#` + `Cache::` catalog rows)** | [`lambda/ephemera/dataSource/renderCache/`](../../lambda/ephemera/dataSource/renderCache/) (**`mtw.ephemera.renderCache`** DataSource). | **Primary:** **`createRenderCacheCacheHandler(ephemeraDB)`** on **`internalCache.RenderCache`** (Ephemera via **`RenderCacheData`** + **`getExactMatch`**; diagnostics get-only). | [`ts/ephemera/renderCache`](ts/ephemera/renderCache/index.ts): **`queryCacheRowsForComponent`**, **`queryCatalogRowsForComponent`**, **`fetchCatalogRow`**; catalog guards; **`classifyAuthoredCatalogDrift`** (used by [`renderCacheDriftSweep`](../../lambda/diagnostics/renderCacheDriftSweep/index.ts)); **`RenderCacheCacheHandler`** with **`getCacheRows`**, **`getCatalogRows`**, **`getCatalogRow`**, memo **`set`** / **`deleteCacheRecords`** / **`invalidate`** (no Dynamo in memo APIs). Steady-state: [`renderCache/AGENT.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.md). Deep import: `@tonylb/mtw-gateways/ts/ephemera/renderCache`. |

**Ownership rules:**

1. The **Authoritative writer** column must point at a `lambda/<owner>/dataSource/...` directory (or a specific file inside it). If it points anywhere else, that is a bug or this package owns code it should not.
2. Readers may include lambdas (`lambda/<reader>/...`) or other packages that compose a gateway into a richer surface. Each reader should also have a re-export barrel or import line that grep-finds back to the gateway.
3. **Discoverability:** writers are encouraged to expose a thin re-export barrel next to their DataSource (for example `lambda/assets/dataSource/components/verticals/readModel.ts`) so engineers grepping from the writer's directory find the read surface immediately.

## Dynamo writes vs invocation memo

Gateways often need **two different kinds of "write"**, and the docs must not conflate them:

| Kind | Who does it | Allowed in `mtw-gateways`? |
| --- | --- | --- |
| **Dynamo write (authoritative)** | Owning lambda DataSource (`putCacheRecord`, `putCatalogRow`, heal, etc.) | **No** --- stays in `lambda/<owner>/dataSource/...` |
| **Write-through cache** | `cache.set(...)` also persists to Dynamo inside the package | **No** --- same as DataSource write logic |
| **Invocation memo patch** | DataSource writes Dynamo, then `internalCache.X.set(...)` / `delete*` / `invalidate` so **same-handler** `get*` sees fresh data without re-query | **Yes** --- implement on the **shared cache handler** when multiple lambdas need the same read+memo semantics |

**Blessed writer pattern (projection-read gateways with memo):**

1. DataSource (or lambda module) performs the **Dynamo** put/delete/update.
2. Same invocation calls **`internalCache.<Handler>.set(...)`** (or **`deleteCacheRecords`**, **`invalidate`**) on the **registered gateway handler instance**.
3. Later **`get*`** in that invocation returns the patched memo (often the **same array reference** `get*` already returned).

**Read-only consumers** (for example diagnostics sweeps) register the **same handler class** but only call **`get*`** --- they never call memo **`set*`**.

**Invalidate-only variant:** some handlers expose only **`get`** + **`invalidate(workItemId)`** after a writer persists (for example [`ts/ephemera/thinking`](ts/ephemera/thinking/index.ts) --- writers drop memo and the next `get` re-fetches). **Memo patch variant:** handlers expose **`set`** / **`delete*`** when same-invocation readers must see new rows immediately without a second Dynamo query (for example Ephemera **`RenderCache`** --- see [`renderCache/AGENT.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.md)). Prefer **one package-owned implementation** of the memo patch variant rather than duplicating `set` logic in each lambda wrapper.

**Lambda-only additions:** thin compose helpers that are not needed cross-lambda (for example Ephemera **`getExactMatch`** combining `getCacheRows` + `getCatalogRow` + guards) may stay on the lambda `InternalCache` wrapper or a small ephemera module; the gateway still owns shared **`get*` / memo `set*`** and Dynamo **`fetch`**.

## How to add a gateway

1. **Place pure helpers** under `ts/<area>/<name>/` (for example `ts/assets/components/componentData/`). Co-locate types, key builders, query helpers, and an optional `createXGateway(deps)` factory.
2. **Per-gateway `index.ts`** is the public surface. Export key builders, projection types, and the factory. Top-level [`ts/index.ts`](ts/index.ts) re-exports nothing by default; **consumers use deep imports** (`@tonylb/mtw-gateways/ts/<area>/<name>`), matching how `@tonylb/mtw-base` and `@tonylb/mtw-lambda-patterns` are consumed today.
3. **Inject the data store (projection-read gateways).** The factory receives the narrow store interface it needs (typically `assetDB` or a slice of it). **Compute-only** gateways inject **structural loader `deps`** instead (see [**Projection-read vs compute-only gateways**](#projection-read-vs-compute-only-gateways)); do not import singletons from consumer lambdas.
4. **No Dynamo mutation in the package.** All **Dynamo** writes stay in the owning DataSource. The gateway may surface validators or normalizers shared between read and write paths, and cache handlers may expose **memo-only** **`set*` / `delete*` / `invalidate`** per [**Dynamo writes vs invocation memo**](#dynamo-writes-vs-invocation-memo).
5. **Update the ownership table** in this file in the same change that adds the gateway.
6. **Document the reader's wiring** in the reader's `internalCache/AGENT.md` (or equivalent) rather than duplicating it here. This file describes the gateway; the reader's docs describe its `InternalCache` instance.
7. **Tests** for the gateway live in this package and exercise the helpers in isolation (mock **`assetDB`** for projection-read gateways, or mock **`deps`** / loader ports / **`InternalCache`**-shaped slices and harnesses for compute-only gateways). Integration tests stay in the consuming lambda.

## Projection-read vs compute-only gateways

**Projection-read gateways** (for example [`ts/assets/components/componentData`](ts/assets/components/componentData/index.ts), [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts)) align file names with **Dynamo and I/O** concerns: `keys.ts`, `fetch.ts`, row normalizers, optional `consistency/` analyzers. **Tier-1 `DeferredCache` handlers** (package-owned batching) are the default for these trees: **`createComponentDataCacheHandler`** ([`componentDataCache.ts`](ts/assets/components/componentData/componentDataCache.ts)) for normative pair-addressed reads, **`createImportVerticalMetaCacheHandler`** ([`importVerticalMetaCache.ts`](ts/assets/components/verticals/importVerticalMetaCache.ts)), and **`createExhaustiveScanCacheHandler`** ([`exhaustiveScanCache.ts`](ts/assets/components/componentData/exhaustiveScanCache.ts)) **only** on maintenance/diagnostics whitelist paths (subpath import; not on lambda hot paths). Lambdas inject **`assetDB`** and assign instances on **`InternalCache`**.

**Compute-only gateways** orchestrate **in-memory** work over **injected ports** (structural interfaces satisfied by `DeferredCache` handlers, `assetDB` wrappers used only inside the lambda's loader implementation, or in-memory test doubles). They do not introduce new materialized row types and **do not** take `assetDB` on the **`create*Gateway`** factory in this package---callers satisfy a narrow slice or **`deps`** at composition time (for example aggregate **`ComponentAggregateInternalCacheSlice`** backed by assets **`internalCache.ComponentData`** + **`internalCache.ComponentVerticals`**).

**Lambda reads (normative):** "Not coupled to **`InternalCache` internals**" means the **package** must not import a lambda's **`InternalCache`** class. It does **not** mean lambdas should call exported **`assemble*`** helpers directly in steady-state code. **Primary** integration for compute-only gateways is still **`create*CacheHandler(slice)`** registered on the lambda **`InternalCache`** singleton (see [**Wrapping gateways in InternalCache**](#wrapping-gateways-in-internalcache-playbook)). **`assemble.ts`** exports are **secondary** (tests, package golden tests, parity) unless explicitly documented otherwise.

Reuse this **file-role** layout when adding another compute-only tree:

| File | Role |
| --- | --- |
| **`ports.ts`** | Narrow composition contracts. Aggregate **`ComponentAggregateInternalCacheSlice`**: **`ComponentData`** = **`ComponentDataParticipationLoader`** (**`getAcrossAssets`** only); **`ComponentVerticals`** = vertical projection loader. **`AggregateParticipationAssemblyDeps`** for secondary uncached gateways. **`AggregateGatewayDeps`** remains analyzer partition deps only. |
| **`input.ts`** | Computation **inputs**, validation, and pure normalizers for call parameters. |
| **`result.ts`** | Stable **output** DTOs returned to callers or caches. |
| **`keys.ts`** | **`aggregatePerspectiveCacheKey`** for **`DeferredCache`** entries ( **`universalKey` + `computePerspectiveKey(mergeParticipationOrder)`** ). |
| **`factory.ts`** | **Primary:** **`ComponentAggregateMergedCache`**, **`createComponentAggregateCacheHandler(slice)`**, **`mergedComponentFromAuthoritative`** --- **`DeferredCache`** batching; per-perspective **`authoritativeFromParticipationOrder`** + batched **`ComponentVerticals.get`**. |
| **`uncached.ts`** | **Secondary:** **`createComponentAggregateGateway`**, **`createAggregateGateway`**, **`AggregateGateway`**, **`ComponentAggregateGatewayBundle`** ([**Aggregate read surfaces**](#aggregate-read-surfaces-primary-vs-secondary)). |

Split large orchestration into **`compute.ts`** / **`assemble.ts`** when needed. If a gateway later gains **owned** Dynamo reads or SK helpers, add **`fetch.ts`** at that time (it becomes a hybrid).

### Aggregate read surfaces (primary vs secondary)

This package is opinionated that **aggregate-level** read orchestration (**`DeferredCache`**, **`aggregatePerspectiveCacheKey`**, batching merged perspectives, **`clear`/`flush`/`invalidate`**) lives in **`ComponentAggregateMergedCache`** / **`createComponentAggregateCacheHandler`** ([`factory.ts`](ts/assets/components/aggregate/factory.ts)) --- same idea as other gateway-supplied cache handlers: lambdas **instantiate and register**; they do **not** re-hand-roll that layer.

**`createComponentAggregateGateway`** and **`createAggregateGateway`** (implemented in [`uncached.ts`](ts/assets/components/aggregate/uncached.ts)) remain **secondary**, not a competing blessed integration:

- They expose **`assembleMergedComponent`** that invokes **`authoritativeFromParticipationOrder`** + vertical projection **per call** with **no** aggregate `DeferredCache`. That **sidesteps** the package-owned merge-cache story (while still routing bodies through pair **`getAcrossAssets`**, not partition enumerate).
- **Intended uses:** package tests, golden or parity checks against the cache handler, tooling, and call sites using **`AggregateParticipationAssemblyDeps`** (analyzer field names, participation loader shape). Legacy **`merge*AcrossStack`** parity against **`mergeAuthoritativeAcrossParticipationOrder`** is asserted from **`lambda/assets/componentAggregate.mergeParity.test.ts`** (assets lambda depends on this package). **Do not** treat them as evidence that new lambda code should prefer uncached gateway factories over **`createComponentAggregateCacheHandler`** ([`factory.ts`](ts/assets/components/aggregate/factory.ts)) --- that would dilute the opinionated model.

The first shipped instance is [`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts).

### Component examples read surfaces (primary vs secondary)

Same model as [**Aggregate read surfaces**](#aggregate-read-surfaces-primary-vs-secondary): lambdas **register** a package-owned **`DeferredCache`** handler; they do **not** treat **`assembleComponentExamplesAtPerspective`** as the steady-state read path.

**Primary (shipped):** **`ComponentExamplesMergedCache`** / **`createComponentExamplesCacheHandler({ ComponentAggregate })`** in [`ts/assets/components/componentExamples/factory.ts`](ts/assets/components/componentExamples/factory.ts). Keyed by **cache-host `universalKey` + `computePerspectiveKey(mergeParticipationOrder)` + lens-default flag** (see **`componentExamplesPerspectiveCacheKey`** in [`keys.ts`](ts/assets/components/componentExamples/keys.ts)). Ephemera and diagnostics register on **`internalCache.ComponentExamples`**; hydrate and blueprint diff call **`get(...)`**.

**Secondary (shipped today):** **`assembleComponentExamplesAtPerspective`** in [`assemble.ts`](ts/assets/components/componentExamples/assemble.ts) --- **no** examples-level `DeferredCache`; invokes **`aggregate.get`** per call. **Intended uses:** package unit tests, golden/parity fixtures, tooling. **Do not** wire new lambda hydrate/diagnostics paths to call **`assemble`** directly when **`internalCache.ComponentExamples`** is available.

**Composition slice:** **`{ ComponentAggregate: internalCache.ComponentAggregate }`** on each lambda that registers examples. **Ephemera:** aggregate slice **`{ ComponentData: internalCache.ComponentData, ... }`** --- stack-scoped **`getAcrossAssets`** at caller canon order (same pair handler as assets; no partition enumerate on hot paths). **Diagnostics:** tier-1 **`ComponentData`** + **`ComponentVerticals`** then aggregate. Steady-state wiring: [`renderCache/AGENT.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.md).

### Component topology read surfaces (primary vs secondary)

Same model as [**Component examples read surfaces**](#component-examples-read-surfaces-primary-vs-secondary): lambdas **register** a package-owned **`DeferredCache`** handler; they do **not** treat **`assembleRoomTopologyAtPerspective`** as the steady-state read path.

**Primary (shipped):** **`ComponentTopologyMergedCache`** / **`createComponentTopologyCacheHandler({ ComponentAggregate })`** in [`ts/assets/components/componentTopology/factory.ts`](ts/assets/components/componentTopology/factory.ts). Keyed by **`roomUniversalKey` + `computePerspectiveKey(mergeParticipationOrder)`** (see **`componentTopologyPerspectiveCacheKey`** in [`keys.ts`](ts/assets/components/componentTopology/keys.ts)). Ephemera registered on **`internalCache.ComponentTopology`**; **`mtw.ephemera.affordanceCache`** calls **`get(...)`** inside **`ensureAffordanceTopology`** preflight (not on **`TopologyInvalidated`** receive).

**Secondary (shipped today):** **`assembleRoomTopologyAtPerspective`** in [`assemble.ts`](ts/assets/components/componentTopology/assemble.ts) --- **no** topology-level `DeferredCache`; invokes **`aggregate.get`** in two batches (room **`referencedByUnion`**, then Area **`merged`**). **Intended uses:** package unit tests, golden/parity fixtures, tooling. **Do not** wire new lambda hydrate paths to call **`assemble`** directly when **`internalCache.ComponentTopology`** is available.

**Assembly pipeline:** **`ComponentAggregate.get(ROOM#)`** -> **`.referencedByUnion`** -> **`filterAreaEdgeReferrers`** (**D14**) -> batch Area **`get`** at same **`mergeParticipationOrder`** -> **`projectRoomExits`** (**D16**, **`mtw-wml`**). Pure projection: [`packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts`](../../packages/mtw-wml/ts/standardize/projection/projectRoomExits.ts).

**Composition slice:** **`{ ComponentAggregate: internalCache.ComponentAggregate }`**. Invalidation bus: [`lambda/assets/componentTopology/AGENT.md`](../../lambda/assets/componentTopology/AGENT.md). Steady-state: [`lambda/ephemera/internalCache/AGENT.md`](../../lambda/ephemera/internalCache/AGENT.md) (**Area topology and affordance exits**).

### Affordance cache read surfaces (primary vs secondary)

Colocated **`Affordance::${perspectiveKey}`** rows under **`ROOM#`** (catalog version metadata + embedded **`ProjectedRoomTopology.exits`**, **D33**). Mirror render-cache handler discipline.

**Primary (shipped):** **`AffordanceCacheCacheHandler`** / **`createAffordanceCacheCacheHandler(ephemeraDB)`** in [`ts/ephemera/affordanceCache/factory.ts`](ts/ephemera/affordanceCache/factory.ts). Ephemera via **`AffordanceCacheData`** on **`internalCache.AffordanceCache`**. **`getAffordanceRow(roomId, perspectiveKey)`** returns hydrated rows only (**`hydratedCatalogVersion === catalogVersion`**). Memo **`set`** / **`invalidate`** --- no Dynamo write-through (writes in [`lambda/ephemera/dataSource/affordanceCache/`](../../lambda/ephemera/dataSource/affordanceCache/)).

**Secondary (tests / tooling):** **`getAffordanceRowFromDynamo`**, **`queryAffordanceRowsForRoom`** in [`fetch.ts`](ts/ephemera/affordanceCache/fetch.ts).

**Consumers:** **`ensureAffordanceTopology`** (hydrate preflight); **`AffordanceRoomDeliverable.get`** (compose **`exits`**); nav (**D34**) via **`getRoomExitTargetsForCharacter`**. Steady-state: [`affordanceCache/AGENT.md`](../../lambda/ephemera/dataSource/affordanceCache/AGENT.md). Module doc: [`ts/ephemera/affordanceCache/AGENT.md`](ts/ephemera/affordanceCache/AGENT.md). Deep import: `@tonylb/mtw-gateways/ts/ephemera/affordanceCache`.

## Shared helpers for diagnostics and healing

Some consumers need **the same rules as the writer** without issuing Dynamo writes: compare authoritative component state to **`Meta::Import`** rows, drive **`HealComponentVertical`** on **`api.assets`**, or align diagnostics findings with repair actions (**insert** / **update** / **delete**).

This package may expose **pure, deterministic** helpers next to the relevant gateway module (same directory as [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts), etc.):

- **Inputs / outputs only** (typically **`StandardComponent`** or stored component JSON in memory, plus derived hop keys). No **`assetDB`** calls inside these helpers unless they are clearly part of an existing **`query`** helper.
- **No heal orchestration** (no **`api.assets`** invokes, no EventBridge publish). Lambdas and DataSources own side effects.
- **Tests** in this package mirror gateway tests: unit-test the pure functions in isolation.

The authoritative writer remains the single owner of **what gets written**; shared helpers are the single owner of **how to derive expected vertical facts from component state** when that logic must be reused.

When imports imply a **directed cycle**, pure helpers may also encode **deterministic index salvage** (e.g. omit one expected hop so projection stays acyclic)---same semantics as [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md) (**Cycles**); index may temporarily diverge from **`_from`**.

**Implementation:** Salvage belongs in this package's **pure** helpers (writer, heal, and diagnostics call the same pipeline). For **detecting** cycles before applying the omission rule, prefer **`@tonylb/mtw-utilities`** **`Graph`** + **`topologicalSort`** ([`packages/mtw-utilities/ts/graphStorage/utils/graph/topologicalSort.ts`](../mtw-utilities/ts/graphStorage/utils/graph/topologicalSort.ts))---Tarjan SCCs; multi-node components indicate cycles (see tests in the same directory). Avoid duplicating Tarjan or ad-hoc DFS unless there is a hard dependency boundary.

**Shipped exports — shared Dynamo to `StandardComponent` (component rows):** **`AuthoritativeComponentData`**, **`authoritativeComponentDataFromUniversalPartitionRows`**, **`componentRowsFromAuthoritativeComponentData`**, **`componentRowsFromUniversalPartitionLines`**, **`standardComponentPairFromAssetDbGetItemsRow`** ([`ts/assets/components/componentData/dynamoStandardComponents.ts`](ts/assets/components/componentData/dynamoStandardComponents.ts)). The verticals barrel re-exports the partition helpers and **`ImportVerticalAuthoritativeComponentData`** (alias) for convenience; prefer **`componentData`** for non-vertical call sites. Partition enumerate for maintenance: **`exhaustiveComponentPartitionScan`** ([`exhaustiveScan.ts`](ts/assets/components/componentData/exhaustiveScan.ts)).

**Shipped exports** (component verticals module): the verticals barrel publishes **key helpers** (**`META_IMPORT_PREFIX`**, **`metaImportDataCategory`**, **`parseMetaImportDataCategory`**, **`stripAssetIdForSortKey`**, **`prefixedAssetIdsFromHop`**, **`metaImportSortKeyEndsWithChild`** in [`keys.ts`](ts/assets/components/verticals/keys.ts)), **`queryImportVerticalMeta`** + **`ImportVerticalHop`** ([`fetch.ts`](ts/assets/components/verticals/fetch.ts)), and the consistency analyzer surface (see below). Pure pipeline helpers used **inside** the analyzer (**`deriveRawImportVerticalHopsFromComponents`**, **`salvageImportVerticalHops`**, **`RawImportVerticalHop`**) live next to it under [`consistency/salvage.ts`](ts/assets/components/verticals/consistency/salvage.ts) and are **not** barrel-exported---they are analyzer-internal.

**Consistency analyzer (import vertical prototype):** **`ImportVerticalConsistencyAnalyzer`** ([`consistency/index.ts`](ts/assets/components/verticals/consistency/index.ts)) exposes **`async check(universalKey)`** and getters reading stored **findings** (classification, expected vs existing category sets, **`categoriesToAdd`** / **`metaRowsToDelete`** repair intent). Dependencies are **two narrow structural interfaces** only---**`ExhaustivePartitionLoader`** (**`get(ComponentIds)`** via **`exhaustiveScanCache`** subpath; **not** pair-addressed **`internalCache.ComponentData`**) and **`ImportVerticalMetaImportProjectionLoader`** (**`get(universalKeys)`** returning **`{ universalKey, hops }`** entries, same contract as assets **`internalCache.ComponentVerticals`**). Each lambda passes implementations that match those shapes (module-local exhaustive loader + tier-1 vertical projection, tests). The class runs the same **derive / salvage / `metaImportDataCategory`** pipeline as heal and diagnostics; it does **not** call Dynamo or mutate caches. Per-partition classification (`aligned` / `missing` / `orphan` / `stale`) is computed inside `check()`; the asset-level rollup over partition statuses is owned by the diagnostics consumer (see [`lambda/diagnostics/componentVerticalMisalignmentSweep/classification.ts`](../../lambda/diagnostics/componentVerticalMisalignmentSweep/classification.ts)).

### Consistency analyzers: contract vs composition

- **In this package (contract):** analyzer class, **`ImportVerticalConsistencyAnalyzerDeps`** / loader interfaces, findings types, and **pure** helpers (derive, salvage, classification, keys). These define **what** data is needed and **how** it is interpreted---not **where** it is loaded from or **how** the lambda caches it.
- **In each lambda (composition):** constructing **`ImportVerticalConsistencyAnalyzerDeps`** using the lambda's cache-backed loaders (via the `InternalCache` handlers) and/or `assetDB` wrappers, and any memoization so **`check()`** (which awaits **both** loaders in parallel) does not accidentally duplicate work unless that is an explicit, documented trade. Reader-facing **`internalCache` / `AGENT.md`** files describe those choices per lambda.
- **Blessed wiring sites for `ImportVerticalConsistencyAnalyzer`:** (**1**) Assets [**`syncImportVerticalPartition`**](../../lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts) --- module-local [**`exhaustivePartitionLoader`**](../../lambda/assets/dataSource/components/verticals/exhaustivePartitionLoader.ts) (`createExhaustiveScanCacheHandler` subpath) + **`internalCache.ComponentVerticals`**. (**2**) Diagnostics [**`componentVerticalMisalignmentSweep`**](../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts) --- [**`exhaustivePartitionLoader`**](../../lambda/diagnostics/componentVerticalMisalignmentSweep/exhaustivePartitionLoader.ts) + **`internalCache.ComponentVerticals`**; universal-key discovery for the asset still **`Query`**s **`DataCategoryIndex`** outside those handlers. (**3**) Package and lambda tests --- mocks implementing **`ImportVerticalConsistencyAnalyzerDeps`**. **`cacheAsset`** invalidates the assets exhaustive loader alongside **`internalCache.ComponentData`** when component rows change.
- **Anti-pattern:** passing **`internalCache.ComponentData`** into **`ImportVerticalConsistencyAnalyzer`** (pair-addressed reads only). Use the documented **`exhaustivePartitionLoader`** modules instead.

## Wrapping gateways in InternalCache (playbook)

Gateways export cache-backed handler factories. The gateway owns the read/normalize/compute logic; direct Dynamo reads are blackboxed inside the handler's `promiseFactory`. **`DeferredCache`** and **`InternalCache`** live in each lambda and own **per-invocation** policy: batching, **`clear()`**, **`flush()`**, and **when to invalidate**.

**Checklist**

1. **Choose the cache key** (pair keys for component bodies: **`componentPairCacheKey`**; merged assembly at a perspective: **`aggregatePerspectiveCacheKey`** from [`ts/assets/components/aggregate/keys.ts`](ts/assets/components/aggregate/keys.ts)).
2. **Implement `get`** using package **`create...CacheHandler(assetDB)`** factories where they exist (**`createComponentDataCacheHandler`**, **`createImportVerticalMetaCacheHandler`**); otherwise use gateway exports + **`DeferredCache.add`** with **`promiseFactory`** / **`transform`** following [`componentDataCache.ts`](ts/assets/components/componentData/componentDataCache.ts) as the template for pair-addressed reads.
3. **After Dynamo writes, refresh memo:** either (**a**) **`invalidate(cacheKey)`** on the handler so the next **`get`** re-queries Dynamo (thinking-style), or (**b**) **`set` / `delete*`** on the handler to patch the in-memory structure **without** a second query when same-invocation readers need immediate consistency (render-cache-style). See [**Dynamo writes vs invocation memo**](#dynamo-writes-vs-invocation-memo). Writers call these on the **registered handler instance**, not on a parallel lambda-only duplicate cache.
4. **Register** the handler on the lambda **`InternalCache`** singleton and include **`clear()`** on **`InternalCache.clear()`**.

**Mechanics:** See [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md) for **`DeferredCache`** behavior.

**Canonical examples**

| Lambda | Cache handler | Gateway |
| --- | --- | --- |
| Ephemera | [`index.ts`](../../lambda/ephemera/internalCache/index.ts) assigns **`createComponentDataCacheHandler(assetDB)`** on **`ComponentData`** | [`ts/assets/components/componentData`](ts/assets/components/componentData/index.ts) (**`ComponentDataCache`**) |
| Ephemera | Same [`index.ts`](../../lambda/ephemera/internalCache/index.ts): **`createThinkingResultReadCacheHandler`**, **`createThinkingScheduleReadCacheHandler`**, **`createThinkingJobReadCacheHandler`** on **`ThinkingResults`**, **`ThinkingSchedules`**, **`ThinkingJobs`** | [`ts/ephemera/thinking`](ts/ephemera/thinking/index.ts) (**`ThinkingResultReadCache`**, **`ThinkingScheduleReadCache`**, **`ThinkingJobReadCache`**) |
| Ephemera | Same [`index.ts`](../../lambda/ephemera/internalCache/index.ts): **`RenderCacheData`** (extends **`createRenderCacheCacheHandler(ephemeraDB)`** + **`getExactMatch`**) | [`ts/ephemera/renderCache`](ts/ephemera/renderCache/index.ts) (**`RenderCacheCacheHandler`**) |
| Assets | [`index.ts`](../../lambda/assets/internalCache/index.ts) assigns **`createComponentDataCacheHandler`**, **`createImportVerticalMetaCacheHandler`** | [`ts/assets/components/componentData`](ts/assets/components/componentData/index.ts), [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts) |
| Diagnostics | [`index.ts`](../../lambda/diagnostics/internalCache/index.ts) assigns the **same** tier-1 **`ComponentData`** / **`ComponentVerticals`** factories on **`assetDB`** | [`ts/assets/components/componentData`](ts/assets/components/componentData/index.ts), [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts) |
| Package (aggregate; lambda registers instance) | **`ComponentAggregateMergedCache`** via [`factory.ts`](ts/assets/components/aggregate/factory.ts) | [`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts) (**`createComponentAggregateCacheHandler`**, **`aggregatePerspectiveCacheKey`**) |
| Ephemera (wiring) | **`ComponentAggregate`** + **`ComponentExamples`** (A1); slice **`ComponentData: internalCache.ComponentData`**. See [**Component data reads: ephemera vs assets**](#component-data-reads-ephemera-vs-assets). | [`componentData`](ts/assets/components/componentData/index.ts), [`aggregate`](ts/assets/components/aggregate/index.ts), [`componentExamples`](ts/assets/components/componentExamples/index.ts) |
| Diagnostics (wiring) | Same blueprint stack on [`internalCache`](../../lambda/diagnostics/internalCache/index.ts) | Same gateway modules as Ephemera for aggregate + examples reads |
| Diagnostics (wiring) | **`createRenderCacheCacheHandler(ephemeraDB)`** on **`internalCache.RenderCache`** (get-only) | [`ts/ephemera/renderCache`](ts/ephemera/renderCache/index.ts) |

## Component data reads: ephemera vs assets

Ephemera and the assets lambda both read the **same** **assetDB** component rows via the **same** normative tier-1 handler: **`createComponentDataCacheHandler`** ([`componentData/`](ts/assets/components/componentData/index.ts)), registered as **`internalCache.ComponentData`** on each lambda. Shared normalization lives in **`dynamoStandardComponents.ts`** (**`standardComponentPairFromAssetDbGetItemsRow`**, **`authoritativeFromParticipationOrder`**, etc.).

| | **Ephemera `ComponentData`** | **Assets `ComponentData`** |
| --- | --- | --- |
| **Handler** | **`ComponentDataCache`** (pair-addressed) | Same |
| **Cache key** | `${assetId}::${universalKey}` per pair | Same |
| **Primary hot-path API** | **`getAcrossAssets(universalKey, explicitAssetStack)`** --- stack from **`RoomAssets`**, character viewpoint, or canon participation order | **`authoritativeFromParticipationOrder`** via aggregate slice; pair **`get`** / **`getAcrossAssets`** for hydrate assembly and bounded reads |
| **Partition enumerate** | **Forbidden** on render/merge/hydrate paths | **Forbidden** on hot paths; whitelist **`exhaustiveScan`** subpath only (vertical sync / diagnostics analyzer) |

**What differs is call pattern, not cache identity:** Ephemera supplies an explicit asset list per request; assets often derives participation order from **`ComponentVerticals`** + anchor before batching pair reads. **Do not** use partition **`Query`** on universal id from either lambda's steady-state **`internalCache.ComponentData`** reads.

**Persisted `referencedBy` (area topology, D31):** Forward Dynamo rows may include **`referencedBy`** (inverse index, written by **`cacheAsset`**). **`standardComponentPairFromAssetDbGetItemsRow`** strips it before **`StandardComponent`** construction; **`getAcrossAssets`** returns **`{ component, referencedBy? }`** per asset. **`ComponentAggregate.get`** exposes **`referencedByUnion`** on **`MergedComponentResult`** (union across **`mergeParticipationOrder`**, not **`merge()`**). See [`referencedBy.ts`](ts/assets/components/componentData/referencedBy.ts), [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../lambda/assets/dataSource/caching/AGENT.diff.md), and [`lambda/assets/componentTopology/AGENT.md`](../../lambda/assets/componentTopology/AGENT.md).

**Ephemera runtime state** (e.g. **`Meta::Room`**) remains **`internalCache.ComponentEphemeraMeta`** on **ephemeraDB** --- not this handler.

## Test runner

Tests use Jest + `ts-jest` with the ESM preset (`ts-jest/presets/js-with-ts-esm`), matching [`packages/mtw-sessions`](../mtw-sessions/jest.config.js) and [`packages/mtw-base`](../mtw-base/jest.config.js). Run from the package root:

```sh
npm test
```

Run from the repo root for a workspace-aware build check:

```sh
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

Add real tests alongside each gateway under `ts/<area>/<name>/index.test.ts`.

### Consumer regression (ephemera)

After changing shared helpers under [`ts/assets/components/componentData`](ts/assets/components/componentData/index.ts), run ephemera's `ComponentData` integration tests:

```sh
cd lambda/ephemera && npm test -- --testPathPattern componentData
```

**Advisory hygiene (manual; not CI):** partition-handler names must not reappear outside **`componentData/`** / **`exhaustiveScan`**:

```sh
rg "createAuthoritativeComponentDataCacheHandler|authoritativeComponentDataCache" \
  --glob '!**/componentData/**' --glob '!**/*.planning.md'
```

## Cross-references

- [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md) - the `DeferredCache` and `InternalCache` patterns this package composes with.
- [`lambda/ephemera/internalCache/componentData.AGENT.md`](../../lambda/ephemera/internalCache/componentData.AGENT.md) - Ephemera pair-addressed blueprint reads.
- [`lambda/assets/internalCache/index.ts`](../../lambda/assets/internalCache/index.ts) - assets lambda **`InternalCache`** (**`createComponentDataCacheHandler`**, **`createImportVerticalMetaCacheHandler`**, **`createComponentAggregateCacheHandler`**).
- [`lambda/assets/internalCache/AGENT.md`](../../lambda/assets/internalCache/AGENT.md) - assets lambda **`internalCache`** handlers; future shared universal-key partition fetch.
- [`lambda/diagnostics/internalCache/AGENT.md`](../../lambda/diagnostics/internalCache/AGENT.md) - diagnostics lambda **`internalCache`** (**`ComponentData`** / **`ComponentVerticals`** only).
- [`ts/assets/components/componentData/componentDataCache.ts`](ts/assets/components/componentData/componentDataCache.ts), [`ts/assets/components/componentData/exhaustiveScanCache.ts`](ts/assets/components/componentData/exhaustiveScanCache.ts), [`ts/assets/components/verticals/importVerticalMetaCache.ts`](ts/assets/components/verticals/importVerticalMetaCache.ts) - tier-1 **`DeferredCache`** handlers.
- [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md) - authoritative writer for **`Meta::Import::...`**; shared read helpers in [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts).
- [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md) - merged component assembly initiative; [`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts) (**`createComponentAggregateCacheHandler`** primary; secondary uncached **`createComponentAggregateGateway`** per [**Aggregate read surfaces**](#aggregate-read-surfaces-primary-vs-secondary)).
