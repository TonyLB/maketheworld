# Assets lambda `internalCache`

## Role

The assets lambda exposes a per-invocation **[`InternalCache`](./index.ts)** singleton (`export default internalCache`) that composes multiple **DeferredCache**-backed handlers. Each handler owns a **coherent** read model for one concern (player settings, component rows, import verticals, etc.). See [`packages/mtw-lambda-patterns/ts/internalCache/AGENT.md`](../../../packages/mtw-lambda-patterns/ts/internalCache/AGENT.md) for **`DeferredCache`** behavior and invalidation rules.

**This folder is the right place** to document how those handlers are composed and what they **invalidate** after writes. It is **not** a substitute for [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md), which describes **shared** gateway contracts (including [**Consistency analyzers: contract vs composition**](../../../packages/mtw-gateways/AGENT.md#consistency-analyzers-contract-vs-composition)).

## Handlers (index)

| Property | Module | Notes |
| --- | --- | --- |
| **`ComponentData`** | [`index.ts`](./index.ts) (field initializer) | **`createAuthoritativeComponentDataCacheHandler(assetDB)`** from [`authoritativeComponentDataCache.ts`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/authoritativeComponentDataCache.ts). Universal-key partition reads for component authoring / `byAssets` views. Satisfies **`ImportVerticalAuthoritativeComponentDataLoader`**. |
| **`ComponentVerticals`** | [`index.ts`](./index.ts) (field initializer) | **`createImportVerticalMetaCacheHandler(assetDB)`** from [`importVerticalMetaCache.ts`](../../../packages/mtw-gateways/ts/assets/components/verticals/importVerticalMetaCache.ts). `Meta::Import` hop envelope keyed by universal component id. Satisfies **`ImportVerticalMetaImportProjectionLoader`**. |
| **`ComponentAggregate`** | [`index.ts`](./index.ts) (**`InternalCache`** constructor) | **`createComponentAggregateCacheHandler`** from **`mtw-gateways`** [`ts/assets/components/aggregate`](../../../packages/mtw-gateways/ts/assets/components/aggregate/index.ts) with slice **`{ ComponentData: internalCache.ComponentData, ComponentVerticals: internalCache.ComponentVerticals }`**. **`ComponentAggregateMergedCache`** batches merged reads (`DeferredCache`) over those sibling handlers; **`clear`** / **`flush`** run with **`InternalCache`**. Secondary uncached **`createComponentAggregateGateway`** / **`createAggregateGateway`** remain for tests and tooling only---see [**Aggregate read surfaces (primary vs secondary)**](../../../packages/mtw-gateways/AGENT.md#aggregate-read-surfaces-primary-vs-secondary). Initiative context: [**InternalCache composition (Phase 1)**](../../../taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md#internalcache-composition-phase-1), [**Wrapping gateways in InternalCache**](../../../packages/mtw-gateways/AGENT.md#wrapping-gateways-in-internalcache-playbook). |
| (others) | [`index.ts`](./index.ts) | Connection, asset meta, graph, library, sessions, etc. |

### Invalidation notes (`ComponentAggregate`)

**Per-invocation:** [`lambda/assets/app.ts`](../app.ts) calls **`internalCache.clear()`** at handler entry, so aggregate entries reset each API-shaped invocation alongside other handlers.

**Same invocation after writes:** Paths that **`invalidate`** **`ComponentData`** or **`ComponentVerticals`** (for example [`cacheAsset`](../dataSource/caching/cacheAsset.ts), [`syncImportVerticalPartition`](../dataSource/components/verticals/syncImportVerticalPartition.ts)) do **not** automatically invalidate **`ComponentAggregate`** merge entries; a cached merged result can stay stale until **`clear`**, **`ComponentAggregate.invalidate`** with **`aggregatePerspectiveCacheKey(...)`**, or a coarse **`ComponentAggregate.clear()`**. Tighten incrementally when call sites need same-invocation parity after sibling mutations.

Writer-side behavior for **`Meta::Import::...`** remains in [`lambda/assets/dataSource/components/verticals/AGENT.md`](../dataSource/components/verticals/AGENT.md).

## Future: shared universal-key partition fetch (dedupe)

**Today:** **`ComponentData`** and **`ComponentVerticals`** (see [`index.ts`](./index.ts)) can each cause Dynamo access against the **same** `AssetId` (universal component id) partition. Call paths that use **both** in one invocation may **double-query** the partition (or issue overlapping `Query` patterns). That is an **acceptable** interim cost; each handler remains **authoritative for its own** domain types.

**Planned direction:** add a **lower-level** internal handler (or private module) that:

- Is keyed by **universal component id** (`EphemeraId`).
- Memoizes **one** deferred **`Promise`** for a **canonical** partition `Query` (the same snapshot used to derive both NDJSON component lines and `Meta::Import` material).
- Is registered on **`InternalCache`**, **`clear()`**'d with the rest, and **invalidated** when **any** row in that partition changes (same policy scope writers already use for the relevant keys).

**`ComponentData`** and **`ComponentVerticals`** (and any future reader of that partition) would **depend on** that shared fetch and **project** in memory (filter / parse) instead of each owning a separate top-level partition read where overlap exists.

**Out of scope here:** how [`ImportVerticalConsistencyAnalyzer`](../../../packages/mtw-gateways/ts/assets/components/verticals/consistency/index.ts) is wired at call sites---that stays **lambda composition**; see gateway **AGENT** above.

