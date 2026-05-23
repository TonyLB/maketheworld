# Diagnostics lambda `internalCache`

## Role

The diagnostics lambda exposes a per-invocation **[`InternalCache`](./index.ts)** singleton (`export default internalCache`) with **`DeferredCache`**-backed read handlers shared with the assets lambda for import-vertical consistency. See [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) for **`DeferredCache`** behavior.

**Handler entry:** [`lambda/diagnostics/app.ts`](../app.ts) calls **`internalCache.clear()`** before **`messageBus.clear()`**, matching other lambdas so each invoke starts with empty caches.

## Handlers

| Property | Source | Notes |
| --- | --- | --- |
| **`ComponentData`** | **`createComponentDataCacheHandler(assetDB)`** from [`componentData`](../../../packages/mtw-gateways/ts/assets/components/componentData/index.ts) | Pair-addressed **`get`** / **`getAcrossAssets`** (`getItems` batching). Same normative handler as assets/ephemera **`internalCache.ComponentData`**. **Not** partition enumerate. |
| **`ComponentVerticals`** | **`createImportVerticalMetaCacheHandler(assetDB)`** from [`importVerticalMetaCache.ts`](../../../packages/mtw-gateways/ts/assets/components/verticals/importVerticalMetaCache.ts) | Same as assets **`internalCache.ComponentVerticals`**. |
| **`ComponentAggregate`** | **`createComponentAggregateCacheHandler({ ComponentData, ComponentVerticals })`** from [`aggregate`](../../../packages/mtw-gateways/ts/assets/components/aggregate/index.ts) | Registered in **`InternalCache`** constructor (same pattern as assets). **`clear`** / **`flush`** with **`InternalCache`**. |
| **`ComponentExamples`** | **`createComponentExamplesCacheHandler({ ComponentAggregate })`** from [`componentExamples`](../../../packages/mtw-gateways/ts/assets/components/componentExamples/index.ts) | Blueprint **`AuthoredExampleSet`** reads; call **`get`**, not **`assembleComponentExamplesAtPerspective`**, in steady-state code. |
| **`RenderCache`** | **`createRenderCacheCacheHandler(ephemeraDB)`** from [`renderCache`](../../../packages/mtw-gateways/ts/ephemera/renderCache/index.ts) | **`getCatalogRows`**, **`getCacheRows`**, **`getCatalogRow`** only (report-only; no memo **`set*`**). Consumed by [`renderCacheDriftSweep`](../renderCacheDriftSweep/index.ts) with package **`classifyAuthoredCatalogDrift`**. |

**Consumers:** [`componentVerticalMisalignmentSweep`](../componentVerticalMisalignmentSweep/index.ts) wires analyzer partition reads from [**`exhaustivePartitionLoader`**](../componentVerticalMisalignmentSweep/exhaustivePartitionLoader.ts) (`exhaustiveScanCache` subpath), **not** **`internalCache.ComponentData`**. **`ComponentVerticals`** remains tier-1. [`renderCacheDriftSweep`](../renderCacheDriftSweep/index.ts) uses **`ComponentExamples.get`** + **`RenderCache.get*`** + **`classifyAuthoredCatalogDrift`** ([`renderCache/AGENT.md`](../../ephemera/dataSource/renderCache/AGENT.md); [`diagnostics/AGENT.md`](../AGENT.md)).

## Scope

This slice stays smaller than assets/ephemera (no graph or connection caches). **Gateway normative rule:** register **`mtw-gateways`** read handlers on **`InternalCache`**; see [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) and [`lambda/ephemera/internalCache/AGENT.md`](../../ephemera/internalCache/AGENT.md) (**Gateway reads**).
