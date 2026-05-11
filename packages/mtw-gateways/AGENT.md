# MTW Gateways (`@tonylb/mtw-gateways`)

## Purpose

`mtw-gateways` is the shared home for **read-only** gateway code that **multiple lambdas** import when they need on-demand access to materialized data in DynamoDB rows that are written and owned by **another** lambda's DataSource.

A "gateway" here is the small, deliberate surface that bridges:

- **Authoritative writer** (a `lambda/<owner>/dataSource/...` projection that maintains the rows; for example [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/AGENT.md) for `Meta::Import::...` rows).
- **Reader lambdas** (any number; for example ephemera reading the same rows during render / merge).

What lives in this package:

- **Pure read helpers**: `Query` / `GetItem` / `BatchGetItem` compositions, stable projection types, and DynamoDB row normalization.
- **Key and prefix builders**: shared `AssetId` / `DataCategory` constructors so reader and writer agree on encoding (for example, mirroring the `Meta::Import::${parentStripped}::${childStripped}` encoding documented under [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md)).
- **Cache-backed gateway factories**: `createXGateway(...)` returning a cache handler bundle (or component) that lambdas register on their per-invocation `InternalCache`.
  - Any direct Dynamo reads are blackboxed inside the handler's `promiseFactory`.
  - Any additional data dependencies arrive through the same `InternalCache`-consistent injection story (narrow deps, cache-backed loaders).
- **Compute-only gateways** (see [**Projection-read vs compute-only gateways**](#projection-read-vs-compute-only-gateways)): deterministic composition over **injected ports** (narrow structural interfaces, not coupled to `InternalCache` internals). They do not own Dynamo row shapes; add `keys.ts` / `fetch.ts` only if a gateway later grows direct I/O.
- **Shared pure helpers for diagnostics and healing** (optional per gateway): deterministic functions---for example expected **`Meta::Import`** hop descriptors from **`StandardComponent`** state---so diagnostics sweeps, **`api.assets`** heal paths, and the live projector do not fork semantic rules. Co-locate under the same `ts/<area>/<name>/` tree as the read surface; see [**Shared helpers for diagnostics and healing**](#shared-helpers-for-diagnostics-and-healing).

What stays out (see **Non-goals** below): cache singletons, `clear()` / `flush()` orchestration, and **any** write paths.

## Non-goals

- **No cross-lambda cache coherence.** Each lambda keeps its own per-invocation `InternalCache` singleton. Reading via a shared gateway does not synchronize state across lambdas; if two lambdas need consistent values they coordinate via events, not via this package.
- **No DataSource write logic.** All mutating helpers (puts, deletes, projection maintenance, orchestrating heals) stay in the authoritative `lambda/<owner>/dataSource/...` location. A gateway is a **read alias only** for Dynamo I/O; **pure** projection helpers used *before* writes (expected hops, diff inputs) may still live here---see [**Shared helpers for diagnostics and healing**](#shared-helpers-for-diagnostics-and-healing).
- **No `DeferredCache` redefinition.** `mtw-gateways` **composes** with the `DeferredCache` and surrounding patterns in [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md); it does not fork or replace them.
- **No replacement for area `AGENT.md` files.** Gateway docs in this package describe the **gateway surface**. Steady-state architecture for the underlying projection still lives next to the writer (e.g. assets verticals `AGENT.md`).
- **No cross-lambda cache orchestration or shared cache instances exported from here.** Gateways may export cache handler bundles/factories for per-invocation `InternalCache` registration, but they must not coordinate cache coherence across lambdas or implement global subscription/streaming orchestration.

## Ownership table

Each gateway in this package must have a row here. Add a row when a new gateway lands; update it whenever a reader is added or the writer moves.

| Gateway | Authoritative writer | Readers | Notes |
| --- | --- | --- | --- |
| **Component Asset Meta** | [`lambda/assets/dataSource/caching/`](../../lambda/assets/dataSource/caching/) ([`cacheAsset`](../../lambda/assets/dataSource/caching/cacheAsset.ts) maintains universal-key component rows in `assetDB`). | [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../lambda/ephemera/internalCache/componentAssetMeta.ts); assets [`componentData.ts`](../../lambda/assets/internalCache/componentData.ts) (partition parse). | [`dynamoStandardComponents.ts`](ts/assets/components/assetMeta/dynamoStandardComponents.ts): Dynamo component rows to **`StandardComponent`** (**`getItems`** rows vs partition **`Query`**). Deep import: `@tonylb/mtw-gateways/ts/assets/components/assetMeta`. |
| **Component import vertical (`Meta::Import`)** | [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/) (`mtw.assets.components.verticals`). | [`lambda/assets/internalCache/componentVerticals.ts`](../../lambda/assets/internalCache/componentVerticals.ts); [`lambda/diagnostics/componentVerticalMisalignmentSweep`](../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts); aggregate assembly consumes vertical reads ([`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts)). | Key builders, `Query` envelope, normalized hop types, **`ImportVerticalConsistencyAnalyzer`**, classification helpers per [**Shared helpers for diagnostics and healing**](#shared-helpers-for-diagnostics-and-healing). Deep import: `@tonylb/mtw-gateways/ts/assets/components/verticals`. Discoverability: [`readModel.ts`](../../lambda/assets/dataSource/components/verticals/readModel.ts). |
| **Component aggregate (merge assembly)** | Composed on read from authoritative rows in [`lambda/assets/dataSource/caching/`](../../lambda/assets/dataSource/caching/) (per-asset component bodies) and [`lambda/assets/dataSource/components/verticals/`](../../lambda/assets/dataSource/components/verticals/) (`Meta::Import` hops). No separate Dynamo projection for merged blobs in v1. | (Planned) assets [`internalCache` aggregate handler](../../lambda/assets/internalCache/AGENT.md); future [`fetchImportDefaults`](../../lambda/assets/fetchImportDefaults/index.ts). | **Compute-only** [`aggregate/`](ts/assets/components/aggregate/index.ts): **`assembleMergedComponent`**, pure merge in [`assemble.ts`](ts/assets/components/aggregate/assemble.ts), **`createAggregateGateway(deps)`** with **`AggregateGatewayDeps`** (same loader shapes as **`ImportVerticalConsistencyAnalyzerDeps`**---no `assetDB` in-package). Initiative: [`AGENT.componentAggregate.planning.md`](../../taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md). Deep import: `@tonylb/mtw-gateways/ts/assets/components/aggregate`. |

**Ownership rules:**

1. The **Authoritative writer** column must point at a `lambda/<owner>/dataSource/...` directory (or a specific file inside it). If it points anywhere else, that is a bug or this package owns code it should not.
2. Readers may include lambdas (`lambda/<reader>/...`) or other packages that compose a gateway into a richer surface. Each reader should also have a re-export barrel or import line that grep-finds back to the gateway.
3. **Discoverability:** writers are encouraged to expose a thin re-export barrel next to their DataSource (for example `lambda/assets/dataSource/components/verticals/readModel.ts`) so engineers grepping from the writer's directory find the read surface immediately.

## How to add a gateway

1. **Place pure helpers** under `ts/<area>/<name>/` (for example `ts/assets/components/assetMeta/`). Co-locate types, key builders, query helpers, and an optional `createXGateway(deps)` factory.
2. **Per-gateway `index.ts`** is the public surface. Export key builders, projection types, and the factory. Top-level [`ts/index.ts`](ts/index.ts) re-exports nothing by default; **consumers use deep imports** (`@tonylb/mtw-gateways/ts/<area>/<name>`), matching how `@tonylb/mtw-base` and `@tonylb/mtw-lambda-patterns` are consumed today.
3. **Inject the data store (projection-read gateways).** The factory receives the narrow store interface it needs (typically `assetDB` or a slice of it). **Compute-only** gateways inject **structural loader `deps`** instead (see [**Projection-read vs compute-only gateways**](#projection-read-vs-compute-only-gateways)); do not import singletons from consumer lambdas.
4. **No mutation.** All writes stay in the owning DataSource. The gateway may surface validators or normalizers shared between read and write paths, but the act of writing must remain in the owner.
5. **Update the ownership table** in this file in the same change that adds the gateway.
6. **Document the reader's wiring** in the reader's `internalCache/AGENT.md` (or equivalent) rather than duplicating it here. This file describes the gateway; the reader's docs describe its `InternalCache` instance.
7. **Tests** for the gateway live in this package and exercise the helpers in isolation (mock **`assetDB`** for projection-read gateways, or mock **`deps`** / loader ports for compute-only gateways). Integration tests stay in the consuming lambda.

## Projection-read vs compute-only gateways

**Projection-read gateways** (for example [`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts), [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts)) align file names with **Dynamo and I/O** concerns: `keys.ts`, `fetch.ts`, row normalizers, optional `consistency/` analyzers.

**Compute-only gateways** orchestrate **in-memory** work over **injected ports** (structural interfaces satisfied by `DeferredCache` handlers, `assetDB` wrappers used only inside the lambda's loader implementation, or in-memory test doubles). They do not introduce new materialized row types and **do not** take `assetDB` on the **`create*Gateway`** factory in this package---callers satisfy **`deps`** at composition time (for example assets **`internalCache.ComponentVerticals`** + **`ComponentData`**). Reuse this **file-role** layout when adding another compute-only tree:

| File | Role |
| --- | --- |
| **`ports.ts`** | Narrow **`deps`** / loader contracts (no `InternalCache` types). Often aliases types from projection gateways (for example aggregate **`AggregateGatewayDeps`** matches **`ImportVerticalConsistencyAnalyzerDeps`**). |
| **`input.ts`** | Computation **inputs**, validation, and pure normalizers for call parameters. |
| **`result.ts`** | Stable **output** DTOs returned to callers or caches. |
| **`factory.ts`** | **`create*Gateway(deps)`** and the object whose methods close over `deps`. |

Split large orchestration into **`compute.ts`** / **`assemble.ts`** when needed. If a gateway later gains **owned** Dynamo reads or SK helpers, add **`fetch.ts` / `keys.ts`** at that time (it becomes a hybrid).

The first shipped instance is [`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts).

## Shared helpers for diagnostics and healing

Some consumers need **the same rules as the writer** without issuing Dynamo writes: compare authoritative component state to **`Meta::Import`** rows, drive **`HealComponentVertical`** on **`api.assets`**, or align diagnostics findings with repair actions (**insert** / **update** / **delete**).

This package may expose **pure, deterministic** helpers next to the relevant gateway module (same directory as [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts), etc.):

- **Inputs / outputs only** (typically **`StandardComponent`** or stored component JSON in memory, plus derived hop keys). No **`assetDB`** calls inside these helpers unless they are clearly part of an existing **`query`** helper.
- **No heal orchestration** (no **`api.assets`** invokes, no EventBridge publish). Lambdas and DataSources own side effects.
- **Tests** in this package mirror gateway tests: unit-test the pure functions in isolation.

The authoritative writer remains the single owner of **what gets written**; shared helpers are the single owner of **how to derive expected vertical facts from component state** when that logic must be reused.

When imports imply a **directed cycle**, pure helpers may also encode **deterministic index salvage** (e.g. omit one expected hop so projection stays acyclic)---same semantics as [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md) (**Cycles**); index may temporarily diverge from **`_from`**.

**Implementation:** Salvage belongs in this package's **pure** helpers (writer, heal, and diagnostics call the same pipeline). For **detecting** cycles before applying the omission rule, prefer **`@tonylb/mtw-utilities`** **`Graph`** + **`topologicalSort`** ([`packages/mtw-utilities/ts/graphStorage/utils/graph/topologicalSort.ts`](../mtw-utilities/ts/graphStorage/utils/graph/topologicalSort.ts))---Tarjan SCCs; multi-node components indicate cycles (see tests in the same directory). Avoid duplicating Tarjan or ad-hoc DFS unless there is a hard dependency boundary.

**Shipped exports — shared Dynamo to `StandardComponent` (component rows):** **`AuthoritativeComponentData`**, **`authoritativeComponentDataFromUniversalPartitionRows`**, **`componentRowsFromAuthoritativeComponentData`**, **`componentRowsFromUniversalPartitionLines`**, **`standardComponentPairFromAssetDbGetItemsRow`** ([`ts/assets/components/assetMeta/dynamoStandardComponents.ts`](ts/assets/components/assetMeta/dynamoStandardComponents.ts)). The verticals barrel re-exports the partition helpers and **`ImportVerticalAuthoritativeComponentData`** (alias) for convenience; prefer **`assetMeta`** for non-vertical call sites (e.g. assets **`ComponentData`**).

**Shipped exports** (component verticals module): the verticals barrel publishes **key helpers** (**`META_IMPORT_PREFIX`**, **`metaImportDataCategory`**, **`parseMetaImportDataCategory`**, **`stripAssetIdForSortKey`**, **`prefixedAssetIdsFromHop`**, **`metaImportSortKeyEndsWithChild`** in [`keys.ts`](ts/assets/components/verticals/keys.ts)), **`queryImportVerticalMeta`** + **`ImportVerticalHop`** ([`fetch.ts`](ts/assets/components/verticals/fetch.ts)), and the consistency analyzer surface (see below). Pure pipeline helpers used **inside** the analyzer (**`deriveRawImportVerticalHopsFromComponents`**, **`salvageImportVerticalHops`**, **`RawImportVerticalHop`**) live next to it under [`consistency/salvage.ts`](ts/assets/components/verticals/consistency/salvage.ts) and are **not** barrel-exported---they are analyzer-internal.

**Consistency analyzer (import vertical prototype):** **`ImportVerticalConsistencyAnalyzer`** ([`consistency/index.ts`](ts/assets/components/verticals/consistency/index.ts)) exposes **`async check(universalKey)`** and getters reading stored **findings** (classification, expected vs existing category sets, **`categoriesToAdd`** / **`metaRowsToDelete`** repair intent). Dependencies are **two narrow structural interfaces** only---**`ImportVerticalAuthoritativeComponentDataLoader`** (**`get(ComponentIds)`** returning **`ImportVerticalAuthoritativeComponentData`**, same contract as assets **`internalCache.ComponentData`**) and **`ImportVerticalMetaImportProjectionLoader`** (**`get(universalKeys)`** returning **`{ universalKey, hops }`** entries, same contract as assets **`internalCache.ComponentVerticals`**). Each lambda passes implementations that match those shapes (**`InternalCache`** handlers directly, **`assetDB`** wrappers, tests). The class runs the same **derive / salvage / `metaImportDataCategory`** pipeline as heal and diagnostics; it does **not** call Dynamo or mutate caches. Per-partition classification (`aligned` / `missing` / `orphan` / `stale`) is computed inside `check()`; the asset-level rollup over partition statuses is owned by the diagnostics consumer (see [`lambda/diagnostics/componentVerticalMisalignmentSweep/classification.ts`](../../lambda/diagnostics/componentVerticalMisalignmentSweep/classification.ts)).

### Consistency analyzers: contract vs composition

- **In this package (contract):** analyzer class, **`ImportVerticalConsistencyAnalyzerDeps`** / loader interfaces, findings types, and **pure** helpers (derive, salvage, classification, keys). These define **what** data is needed and **how** it is interpreted---not **where** it is loaded from or **how** the lambda caches it.
- **In each lambda (composition):** constructing **`ImportVerticalConsistencyAnalyzerDeps`** using the lambda's cache-backed loaders (via the `InternalCache` handlers) and/or `assetDB` wrappers, and any memoization so **`check()`** (which awaits **both** loaders in parallel) does not accidentally duplicate work unless that is an explicit, documented trade. Reader-facing **`internalCache` / `AGENT.md`** files describe those choices per lambda.
- **Anti-pattern:** implementing a nonstandard cache lifecycle (global singletons, bypassing per-invocation `InternalCache` registration) behind a gateway helper. Instead, use the shared cache-backed gateway factories/handlers so lifecycle semantics stay consistent.

## Wrapping gateways in InternalCache (playbook)

Gateways export cache-backed handler factories. The gateway owns the read/normalize/compute logic; direct Dynamo reads are blackboxed inside the handler's `promiseFactory`. **`DeferredCache`** and **`InternalCache`** live in each lambda and own **per-invocation** policy: batching, **`clear()`**, **`flush()`**, and **when to invalidate**.

**Checklist**

1. **Choose the cache key** (one partition / one logical envelope per key is ideal; see **`ComponentData`** vs **`ComponentAssetMeta`** for contrasting shapes).
2. **Implement `get`** using gateway exports + **`DeferredCache.add`** with **`promiseFactory`** / **`transform`** (mirror [`lambda/assets/internalCache/componentData.ts`](../../lambda/assets/internalCache/componentData.ts) or [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../lambda/ephemera/internalCache/componentAssetMeta.ts)).
3. **Invalidate** when authoritative rows change: same lambda writers should call **`this._Cache.invalidate(cacheKey)`** on the **`DeferredCache` instance** after Dynamo writes (not `key in _Cache`, which does not apply to **`DeferredCache`**). Alternative heal paths that bypass the writer must invalidate explicitly.
4. **Register** the handler on the lambda **`InternalCache`** singleton and include **`clear()`** on **`InternalCache.clear()`**.

**Mechanics:** See [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md) for **`DeferredCache`** behavior.

**Canonical examples**

| Lambda | Cache handler | Gateway |
| --- | --- | --- |
| Ephemera | [`componentAssetMeta.ts`](../../lambda/ephemera/internalCache/componentAssetMeta.ts) | [`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts) |
| Assets | [`componentData.ts`](../../lambda/assets/internalCache/componentData.ts) | [`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts) (**`authoritativeComponentDataFromUniversalPartitionRows`**, etc.) |
| Assets | [`componentVerticals.ts`](../../lambda/assets/internalCache/componentVerticals.ts) | [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts) |

## Component asset reads: ephemera vs assets

Ephemera and the assets lambda both read the **same** DynamoDB component rows (universal component id partition, NDJSON-ish lines keyed by asset), but with **different access patterns**. The **Component Asset Meta** gateway ([`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts)) owns shared normalization (**[`dynamoStandardComponents.ts`](ts/assets/components/assetMeta/dynamoStandardComponents.ts)**): **`standardComponentPairFromAssetDbGetItemsRow`** for **`getItems`** (ephemera's **`fetchComponentsForAssets`**) and **`authoritativeComponentDataFromUniversalPartitionRows`** for partition **`Query`** (assets **`ComponentData`**). The gateway must **not** collapse the two consumers into a single cache identity in v1; document the distinction so future contributors do not "dedupe" them blindly.

| | **Ephemera `ComponentAssetMeta`** | **Assets `ComponentData`** |
| --- | --- | --- |
| **Source** | [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../lambda/ephemera/internalCache/componentAssetMeta.ts) | [`lambda/assets/internalCache/componentData.ts`](../../lambda/assets/internalCache/componentData.ts) |
| **Primary use** | Merge / render paths over an **explicit asset stack** | Authoring-side enumerate **all** assets that contain a component |
| **Cache key** | `${assetId}::${EphemeraId}` (per-asset entry) | `${EphemeraId}` (one entry, `byAssets` array) |
| **Fetch shape** | `assetDB.getItems` over chosen `(EphemeraId, assetId)` keys; `getAcrossAllAssets` first reads `Meta::Room` (etc.) `cached` to discover the asset list, then batches | `assetDB.query` on the universal-id partition; filters NDJSON lines via `isStandardNDJSONLine` |
| **Default value** | Synthesizes `defaultComponentFromTag` + `standardComponentFactory` for misses | Empty `byAssets` array for misses |

**Overlap (gateway-eligible):** both consumers run [`standardComponentFactory`](../mtw-wml/ts/standardize/componentFactory.ts) over the same row shape, both use [`assetDB`](../mtw-utilities/ts/dynamoDB/index.ts), and both share the universal-key partition convention. Row normalization, batch key construction, and projection types are the natural first set of shared helpers.

**Deliberate non-goal for v1 of the gateway:** replacing `ComponentData` with the ephemera wrapper, or collapsing the two callers into a single cache entry. The cache strategies differ for good reasons (per-asset render keys vs whole-component authoring views); shared helpers are valuable, shared cache identity is not.

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

After changing shared helpers under [`ts/assets/components/assetMeta`](ts/assets/components/assetMeta/index.ts), run ephemera's `ComponentAssetMeta` integration tests:

```sh
cd lambda/ephemera && npm test -- --testPathPattern componentAssetMeta
```

## Cross-references

- [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../mtw-lambda-patterns/ts/internalCache/AGENT.md) - the `DeferredCache` and `InternalCache` patterns this package composes with.
- [`lambda/ephemera/internalCache/componentAssetMeta.AGENT.md`](../../lambda/ephemera/internalCache/componentAssetMeta.AGENT.md) - prototype reader's current shape.
- [`lambda/assets/internalCache/componentData.ts`](../../lambda/assets/internalCache/componentData.ts) - sibling reader on the assets lambda.
- [`lambda/assets/internalCache/AGENT.md`](../../lambda/assets/internalCache/AGENT.md) - assets lambda **`internalCache`** handlers; future shared universal-key partition fetch.
- [`lambda/assets/internalCache/componentVerticals.ts`](../../lambda/assets/internalCache/componentVerticals.ts) - **`Meta::Import`** envelope cache (`DeferredCache` + [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts)).
- [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../lambda/assets/dataSource/components/verticals/AGENT.md) - authoritative writer for **`Meta::Import::...`**; shared read helpers in [`ts/assets/components/verticals`](ts/assets/components/verticals/index.ts).
- [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md) - merged component assembly initiative; compute-only [`ts/assets/components/aggregate`](ts/assets/components/aggregate/index.ts).
