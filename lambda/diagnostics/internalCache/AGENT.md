# Diagnostics lambda `internalCache`

## Role

The diagnostics lambda exposes a per-invocation **[`InternalCache`](./index.ts)** singleton (`export default internalCache`) with **`DeferredCache`**-backed read handlers shared with the assets lambda for import-vertical consistency. See [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) for **`DeferredCache`** behavior.

**Handler entry:** [`lambda/diagnostics/app.ts`](../app.ts) calls **`internalCache.clear()`** before **`messageBus.clear()`**, matching other lambdas so each invoke starts with empty caches.

## Handlers

| Property | Source | Notes |
| --- | --- | --- |
| **`ComponentData`** | **`createAuthoritativeComponentDataCacheHandler(assetDB)`** from [`authoritativeComponentDataCache.ts`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/authoritativeComponentDataCache.ts) | Same as assets **`internalCache.ComponentData`**. |
| **`ComponentVerticals`** | **`createImportVerticalMetaCacheHandler(assetDB)`** from [`importVerticalMetaCache.ts`](../../../packages/mtw-gateways/ts/assets/components/verticals/importVerticalMetaCache.ts) | Same as assets **`internalCache.ComponentVerticals`**. |

**Consumers:** [`componentVerticalMisalignmentSweep`](../componentVerticalMisalignmentSweep/index.ts) wires **`ImportVerticalConsistencyAnalyzer`** deps from these two entries.

## Scope

This slice is intentionally small (no **`ComponentAggregate`**, graph, or connection caches). Extend here when other diagnostics paths need the same gateway-backed read surfaces.
