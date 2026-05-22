# Component data gateway consolidation - planning

**Status:** Assets lambda `internalCache.ComponentData` uses pair-addressed **`createComponentDataCacheHandler`**. **Next:** Ephemera / diagnostics `internalCache` swap (Recommended order 267+).

This document follows [`taskPlanning/AGENT.md`](../../AGENT.md) (durability, what belongs here vs in package docs). **Dispose** after the initiative ships and lasting norms live in [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**Component data read surfaces**, ownership table) and lambda **`internalCache`** AGENT files.

**Anchor for discussion:** use this file to record decisions as we consolidate reads. Do not treat partial refactors as finished until [**Recommended order**](#recommended-order) items are checked and verification passes.

**Sibling initiatives (coordinate, do not fork parallel loaders):**

| Initiative | Relationship |
| --- | --- |
| [`taskPlanning/lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md) | **Lambda wiring (A1)** must use the **normative pair-addressed** loader for Ephemera aggregate slice --- not partition enumerate. Land **this** gateway refactor **before or as part of** that wiring slice so hydrate does not cement the wrong loader. |
| [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md) | Aggregate factory must call **pair batching** for bodies at **`mergeParticipationOrder`**, not **`exhaustiveScan`**. Vertical hops remain **`ComponentVerticals`**. |
| [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) | **`exhaustiveScan`** is the blessed cache for **vertical sync / heal** maintenance --- not a player hot path. |

---

## Problem statement

Today, **two gateway modules** under [`assetMeta/`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/) serve overlapping Dynamo rows with **incompatible cache identities and fetch shapes**:

| Module | Fetch | Cache key | Typical caller mental model |
| --- | --- | --- | --- |
| **`EphemeraComponentAssetMetaCache`** | `getItems` for explicit **`(ComponentId, AssetId)`** pairs | `assetId::ComponentId` | "Layers in **this** participation stack" |
| **`AuthoritativeComponentDataCache`** | Partition **`Query`** on universal id | `ComponentId` only | "Every asset that ever wrote this component" |

The second path was reused as the default **authoritative loader** for **`ComponentAggregate`**, **`ImportVerticalConsistencyAnalyzer`**, legacy **`componentExamples`** mirroring, and diagnostics --- even when the caller only needed a **bounded stack** of layers.

### Core product requirement (non-negotiable)

An **asset** is a **blueprint layer** that may be composed into a **participation stack** when the world needs that view. Layers a player imagined but that are **not** in the current stack must have **negligible** impact on runtime performance.

Therefore:

- **Normative runtime reads** address **`(universalComponentId, assetId)`** pairs (batch `getItems`), scoped to a **known participation order** supplied by the caller or derived from **`ComponentVerticals`** + anchor rules --- **not** by scanning the full universal partition.
- **Full-partition enumerate** is allowed only for **async maintenance / diagnostics** paths that intentionally pay the cost once and cache it --- principally **vertical projection sync** and **diagnostics of that projection**.

Accidental partition scans on resolve, mirror, merge, or hydrate paths are **bugs relative to requirements**, not acceptable tradeoffs.

---

## Goal

1. Create **`packages/mtw-gateways/ts/assets/components/componentData/`** as the **single** home for component-body read helpers and tier-1 cache handlers.
2. **Move** (not duplicate) shared normalization from [`assetMeta/`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/) into **`componentData/`**; leave **`assetMeta/`** as a **temporary re-export shim** until call sites migrate, then remove the shim.
3. Establish a **normative** public surface: **pair-addressed** reads + **`DeferredCache`** keyed by **`(ComponentId, AssetId)`**.
4. Add **`exhaustiveScan`** (name TBD at implement time; working title below) --- **sternly documented**, callable only from:
   - **Assets vertical sync / heal** ([`syncImportVerticalPartition`](../../../lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts), [`healComponentVertical`](../../../lambda/assets/dataSource/components/verticals/healComponentVertical.ts))
   - **Diagnostics** vertical misalignment ([`componentVerticalMisalignmentSweep`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts)) and **`ImportVerticalConsistencyAnalyzer`** when checking a universal partition
5. **Refactor all other consumers** to pair-addressed reads; obtain **cross-layer structure** from **`ComponentVerticals`** (and caller **`mergeParticipationOrder`**) instead of partition enumerate.

**Non-goals:**

- Replacing **`AssetData`** (asset-scoped `DataCategoryIndex` scans --- different axis).
- Changing vertical **write** semantics or Dynamo SK encoding.
- Renaming lambda **`internalCache.ComponentData`** (same field; new pair-addressed implementation). **`exhaustiveScan`** is not a second **`internalCache`** handler.

---

## Target gateway layout (`componentData/`)

Mirror [**compute-only file roles**](../../../packages/mtw-gateways/AGENT.md#projection-read-vs-compute-only-gateways) where they apply; this tree is **projection-read** (Dynamo I/O inside `promiseFactory`).

| File | Role |
| --- | --- |
| **`keys.ts`** | **`componentPairCacheKey(universalKey, assetId)`**, parse helpers; stable pair type **`ComponentAssetPair`**. |
| **`fetch.ts`** | Narrow **`assetDB`** slice: **`getItems`** batch for pairs only (removed orphaned **`fetchCachedAssetIdsForComponent`** / **`getAcrossAllAssets`**; stack discovery stays **`RoomAssets`** or caller order). |
| **`dynamoStandardComponents.ts`** | Row normalization (**moved** from **`assetMeta/dynamoStandardComponents.ts`**): **`standardComponentPairFromAssetDbGetItemsRow`**, **`AuthoritativeComponentData`** envelope builders used **after** pair fetch or exhaustive scan. |
| **`componentDataCache.ts`** | **`ComponentDataCache`**, **`createComponentDataCacheHandler(assetDB)`** --- **primary** tier-1 handler (pair-addressed; replaces partition **`AuthoritativeComponentDataCache`**). |
| **`exhaustiveScan.ts`** | Pure partition **`Query`** + map to **`AuthoritativeComponentData`**; **module-level warning comment block**; **not** exported from barrel; **not** registered on lambda **`internalCache`**. |
| **`exhaustiveScanCache.ts`** | Optional module-local **`DeferredCache`** over **`exhaustiveScan`** for whitelist call sites only (vertical sync / diagnostics import subpath --- not **`internalCache`**). |
| **`participationBatch.ts`** | **`authoritativeFromParticipationOrder`** --- builds **`AuthoritativeComponentData`** via **`ComponentDataCache`** pair reads only (aggregate slice adapter). |
| **`defaults.ts`**, **`metaCategory.ts`** | Moved from **`assetMeta/`** if still needed for pair misses / ephemera meta discovery. |
| **`index.ts`** | Public exports: pair cache factory, participation batch helper, types; **do not** re-export **`exhaustiveScan`** from top-level barrel (deep import path only). |
| **`index.test.ts`**, **`exhaustiveScan.test.ts`**, etc. | Package tests. |

### Normative read contract (pair-addressed)

**Primary API:**

```typescript
// Addressing primitive
type ComponentAssetPair = {
    universalKey: ComponentUUID; // ROOM#..., SITUATION#..., etc.
    assetId: AssetUUID;
};

// Tier-1 cache (DeferredCache per pair) --- lambda field: internalCache.ComponentData
type ComponentDataCache = {
    get(pairs: readonly ComponentAssetPair[]): Promise<readonly ComponentPairRow[]>;
    // ComponentPairRow: { universalKey, assetId, component: StandardComponent }
    getAcrossAssets(
        universalKey: ComponentUUID,
        assetIds: readonly AssetUUID[]
    ): Promise<Record<AssetUUID, StandardComponent>>; // ephemera ergonomics; batch pair get
    clear(): void;
    flush(): Promise<void>;
    invalidate(pairKey: string): void;
};

// Convenience for merge callers that already have mergeParticipationOrder
function authoritativeFromParticipationOrder(
    universalKey: ComponentUUID,
    mergeParticipationOrder: readonly AssetUUID[],
    componentData: ComponentDataCache
): Promise<AuthoritativeComponentData>;
```

**Rules:**

- Hot paths call **`get(pairs)`** or **`authoritativeFromParticipationOrder`** --- never partition **`Query`** on the universal id.
- **`mergeParticipationOrder`** is **caller-owned** (Ephemera canon stack) or **derived** from **`ComponentVerticals`** + anchor (FetchImports-style) --- not inferred by scanning all partition rows.
- Default synthesis for pair misses uses existing **`defaultComponentFromTag`** behavior (today in **`assetMeta/defaults.ts`**).

### `exhaustiveScan` (maintenance-only exception)

**Working export:** `exhaustiveComponentPartitionScan(assetDB, universalKey)` (final name at implement time).

**Documentation requirements (must be in source, not only this plan):**

- Block comment at top of **`exhaustiveScan.ts`**: **NEVER** use on Ephemera resolve/hydrate/render, **`ComponentAggregate`** steady-state merge, **`componentExamples`** mirroring, or API hot paths.
- **Allowed call sites (whitelist):**
  - [`syncImportVerticalPartition`](../../../lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts)
  - [`healComponentVertical`](../../../lambda/assets/dataSource/components/verticals/healComponentVertical.ts)
  - [`componentVerticalMisalignmentSweep`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts) / **`ImportVerticalConsistencyAnalyzer`**
- **Rationale:** vertical index maintenance must see **every** `(childAssetId, _from)` on the universal partition to derive **`Meta::Import`** hops; that cost is **amortized** on write/async heal so merge paths stay bounded later.

**Enforcement (D1):** subpath-only export; no barrel. No CI import guard ([**D5**](#decisions-resolved)); deliberate import path + review is sufficient.

### `assetMeta/` transition

| Phase | `assetMeta/` |
| --- | --- |
| During migration | Thin re-exports pointing at **`componentData/`** with **`@deprecated`** JSDoc on old handler names |
| After migration | Delete directory; update deep imports repo-wide |

Rename guidance for lambdas:

| Old lambda field / import | Target |
| --- | --- |
| **`createEphemeraComponentAssetMetaCacheHandler`** | **`createComponentDataCacheHandler`** from **`componentData/`** (pair-addressed; same role) |
| **`createAuthoritativeComponentDataCacheHandler`** (partition) | **Remove**; superseded by **`createComponentDataCacheHandler`** |
| **`internalCache.ComponentData`** on assets / diagnostics | **Keep the name**; swap implementation to pair-addressed **`ComponentDataCache`** |
| **`internalCache.ComponentAssetMeta`** on Ephemera | **Hard switchover** to **`internalCache.ComponentData`** (no alias); update all call sites in the same initiative |
| Partition enumerate on hot paths | **Forbidden**; whitelist uses **`exhaustiveScan`** subpath only (no second **`internalCache`** field) |

---

## Consumer migration inventory

Refactor **in this initiative** (grep-backed; re-grep before each slice):

### Must move to pair-addressed + verticals / explicit order

| Consumer | Today | Target |
| --- | --- | --- |
| [`aggregate/factory.ts`](../../../packages/mtw-gateways/ts/assets/components/aggregate/factory.ts) | `slice.ComponentData.get(universalKeys)` | **`authoritativeFromParticipationOrder`** per perspective in batch (or slice adapter with participation keyed batch) |
| [`aggregate/uncached.ts`](../../../packages/mtw-gateways/ts/assets/components/aggregate/uncached.ts) | Same | Same |
| [`lambda/assets/componentExamples/index.ts`](../../../lambda/assets/componentExamples/index.ts) | Partition **`ComponentData.get`** | **Retire** with on-demand examples initiative OR interim pair reads at known stack only |
| [`lambda/ephemera/internalCache`](../../../lambda/ephemera/internalCache/index.ts) | **`ComponentAssetMeta`** | **`internalCache.ComponentData`** (pair cache); aggregate adapter uses participation batch |
| Ephemera **`ComponentRender`**, **`ComponentStackMerge`**, **`computeDefaultMarksForRoom`**, **`GenerationContext`** | **`getAcrossAssets`** | **`internalCache.ComponentData.getAcrossAssets`** (behavior unchanged, unified module) |

### Must use `exhaustiveScan` (whitelist only)

| Consumer | Notes |
| --- | --- |
| [`syncImportVerticalPartition.ts`](../../../lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts) | Wire analyzer to **`exhaustiveScanCache`** or pure scan helper |
| [`healComponentVertical.ts`](../../../lambda/assets/dataSource/components/verticals/healComponentVertical.ts) | Same |
| [`componentVerticalMisalignmentSweep`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts) | Diagnostics partition check per UK |
| [`verticals/consistency/ImportVerticalConsistencyAnalyzer`](../../../packages/mtw-gateways/ts/assets/components/verticals/consistency/index.ts) | **`ImportVerticalConsistencyAnalyzerDeps.authoritativeComponentData`** becomes **`ExhaustivePartitionLoader`** only ([**D3**](#decisions-resolved)); **do not** conflate with participation-scoped **`ComponentDataLoader`** |

### Invalidate-only / no read path change

| Consumer | Notes |
| --- | --- |
| [`cacheAsset.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.ts) | **`ComponentData.invalidate`** -> invalidate pair keys + exhaustive cache key for that UK |

### Out of scope (different read axis)

| Consumer | Notes |
| --- | --- |
| **`getParentIdsForSituation`** | Uses **`AssetData.get`** on explicit asset list --- not partition component scan; retires with examples mirroring |
| **`AssetData`**, **`contentHeaders`**, **`characters`**, asset-level diagnostics index | Not this initiative |

---

## Relationship to `ComponentVerticals`

| Need | Source |
| --- | --- |
| Import graph / hop edges for **U** | **`ComponentVerticals.get([U])`** |
| Ordered assets for merge (when not caller-supplied) | Derive from hops + anchor per [aggregate planning](../../lambda/assets/AGENT.componentAggregate.planning.md) (**Participation order from graph**) |
| Component **bodies** at each layer | **`internalCache.ComponentData.get`** (pairs) / **`getAcrossAssets(U, order)`** |

**Anti-pattern after this initiative:** using partition enumerate to discover which assets exist for **U** on a hot path. Discovery belongs in **vertical index** or **explicit caller list**.

---

## Decisions (resolved)

All rows decided at planning time. Reopen only if implementation discovers a gap.

| # | Question | Decision |
| --- | --- | --- |
| D1 | **`exhaustiveScan` export path** | **Subpath only** --- e.g. `@tonylb/mtw-gateways/ts/assets/components/componentData/exhaustiveScan` (and optional **`exhaustiveScanCache`** alongside it). **Not** re-exported from **`componentData/index.ts`** or package root. Intentional friction: every call site must import a path that reads as maintenance/diagnostics-only. |
| D2 | Assets / diagnostics / Ephemera: how many **`internalCache`** fields? | One normative **`internalCache.ComponentData`** per lambda (pair-addressed **`createComponentDataCacheHandler`**). **`exhaustiveScan`** is a **package subpath** for whitelist maintenance/diagnostics only --- **not** a sibling **`internalCache`** registration. |
| D3 | **`ImportVerticalAuthoritativeComponentDataLoader`** contract | Split loader interfaces --- participation-scoped **`ComponentDataLoader`** (pair / **`authoritativeFromParticipationOrder`**) for merge and aggregate slice; **`ExhaustivePartitionLoader`** (partition enumerate via **`exhaustiveScan`**) for **`ImportVerticalConsistencyAnalyzer`** only. Keep **`aggregate/ports.ts`** slice field **`ComponentData`**; inject the participation-scoped implementation (behavior change in place). **`ImportVerticalConsistencyAnalyzerDeps`** uses **`ExhaustivePartitionLoader`** for **`authoritativeComponentData`**. |
| D4 | Ephemera **`ComponentAssetMeta`** field name | Rename to **`internalCache.ComponentData`**; **hard switchover** in one initiative (update ephemera call sites, tests, AGENT files). **No** deprecated alias on **`internalCache`**. |
| D5 | CI guard blocking **`exhaustiveScan`** imports | **Not required.** Subpath-only export (D1) + stern module docs + whitelist discipline is enough; do **not** add grep/ESLint/commit-blocking architecture tests for this. |

---

## Progress

| Milestone | Status |
| --- | --- |
| Requirements + migration inventory captured | Done |
| Design pass (D1--D5) | Done |
| `componentData/` scaffold + pair cache | Done |
| `exhaustiveScan` + stern docs + whitelist | Done |
| `assetMeta/` shim + deprecations | Done |
| Aggregate factory uses participation batch | Done |
| Verticals + diagnostics exhaustive whitelist wiring | Done |
| Lambda **`internalCache.ComponentData`** swap (assets) | Done |
| Lambda **`internalCache.ComponentData`** swap (ephemera, diagnostics) | Not started |
| Legacy mirroring / reseed off partition reads | Assets interim pair + participation order (full retirement with on-demand examples) |
| `mtw-gateways/AGENT.md` ownership table + remove `assetMeta/` | Not started |

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) once for task-plan conventions.
2. Read gateway norms: [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**Component asset reads: ephemera vs assets**, **Wrapping gateways in InternalCache**).
3. Read current implementation to move:
   - [`packages/mtw-gateways/ts/assets/components/assetMeta/`](../../../packages/mtw-gateways/ts/assets/components/assetMeta/)
   - [`packages/mtw-gateways/ts/assets/components/aggregate/factory.ts`](../../../packages/mtw-gateways/ts/assets/components/aggregate/factory.ts)
4. Read vertical maintenance whitelist call sites:
   - [`lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts`](../../../lambda/assets/dataSource/components/verticals/syncImportVerticalPartition.ts)
   - [`lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts`](../../../lambda/diagnostics/componentVerticalMisalignmentSweep/index.ts)
5. Read sibling plans for sequencing:
   - [`AGENT.onDemandAuthoredExamples.planning.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md) (**Lambda wiring A1**)
   - [`AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md)
6. **Command authority:** gateway tests --- `cd packages/mtw-gateways && npm test`. After lambda touches: `cd lambda/assets && npm test`, `cd lambda/ephemera && npm test -- --testPathPattern=componentAssetMeta`, `cd lambda/diagnostics && npm test`.
7. **Baseline before edits:**

```bash
cd packages/mtw-gateways && npm test
cd packages/mtw-gateways && npm test -- --testPathPattern=assetMeta
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` when done.

- [X] **Design pass:** [**Decisions (resolved)**](#decisions-resolved) D1--D5
- [X] **Scaffold `componentData/`:** `keys`, `fetch`, moved `dynamoStandardComponents`, **`componentDataCache`** + tests (parity with today **`EphemeraComponentAssetMetaCache`** behavior)
- [X] **`participationBatch` helper:** build **`AuthoritativeComponentData`** from pair cache + **`mergeParticipationOrder`**; package tests
- [X] **`exhaustiveScan` + `exhaustiveScanCache`:** stern module docs; move partition **`Query`** logic out of **`authoritativeComponentDataCache.ts`**; whitelist tests documenting allowed importers
- [X] **`assetMeta/` shim:** re-export from **`componentData/`**; deprecate old factory names; keep tests green via shim imports
- [X] **Aggregate gateway:** refactor **`factory.ts`** / **`uncached.ts`** so slice **`ComponentData`** uses participation batch (no partition get in merge batch); update **`cacheHandler.test.ts`**, **`testHarness`**
- [X] **Verticals + diagnostics:** wire **`ImportVerticalConsistencyAnalyzer`** and sweep to **`exhaustiveScan`** path only; **`syncImportVerticalPartition`** / heal unchanged semantically, new import paths
- [X] **Assets `internalCache`:** replace partition **`ComponentData`** implementation with pair-addressed **`createComponentDataCacheHandler`**; keep field name **`ComponentData`**; update [`lambda/assets/internalCache/AGENT.md`](../../../lambda/assets/internalCache/AGENT.md)
- [ ] **Ephemera `internalCache`:** hard switchover **`ComponentAssetMeta` -> `ComponentData`** (all call sites, tests, docs); fold or replace [`componentAssetMeta.ts`](../../../lambda/ephemera/internalCache/componentAssetMeta.ts) barrel
- [ ] **Diagnostics `internalCache`:** keep **`ComponentData`** field; pair handler for any bounded reads; sweep/analyzer use **`exhaustiveScan`** subpath only; update [`lambda/diagnostics/internalCache/AGENT.md`](../../../lambda/diagnostics/internalCache/AGENT.md)
- [ ] **Retire hot-path partition reads:** **`componentExamples`** mirroring + reseed (coordinate [**on-demand examples**](../../lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md)); grep repo for **`createAuthoritativeComponentDataCacheHandler`** outside whitelist
- [ ] **Remove `assetMeta/` shim:** delete directory; fix deep imports; update [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) ownership table (**Component data** row replaces **Component Asset Meta**)
- [ ] **Dispose this plan** per [`taskPlanning/AGENT.md`](../../AGENT.md)

**Sequencing note:** Complete **aggregate factory + participation batch** before Ephemera **on-demand examples Lambda wiring (A1)** so new handlers do not encode the partition-loader mistake.

---

## Verification

Record exact commands as slices land.

**Baseline (before implementation):**

```bash
cd packages/mtw-gateways && npm test
cd packages/mtw-gateways && npm test -- --testPathPattern=assetMeta
cd packages/mtw-gateways && npm test -- --testPathPattern=aggregate
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

**After `componentData/` pair cache slice (2026-05-22):**

```bash
cd packages/mtw-gateways && npm test -- --testPathPattern=componentData   # 7 suites, 21 tests
cd packages/mtw-gateways && npm test -- --testPathPattern=assetMeta       # 3 suites, 15 tests (shim)
cd packages/mtw-gateways && npm test                                      # 22 suites, 141 tests
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

Lambda tests deferred until **`internalCache`** swap slices (265+).

**After aggregate refactor (2026-05-22):**

```bash
cd packages/mtw-gateways && npm test -- --testPathPattern=aggregate      # 2 suites, 27 tests
cd packages/mtw-gateways && npm test -- --testPathPattern=componentExamples  # 5 suites, 20 tests
cd packages/mtw-gateways && npm test -- --testPathPattern=componentData  # 7 suites, 22 tests
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

**After assets lambda `internalCache` swap (2026-05-22):**

```bash
cd lambda/assets && npm test -- --testPathPattern='internalCache|componentAggregate|cacheAsset|componentExamples'  # 13 suites, 74 tests
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

**After ephemera / diagnostics `internalCache` swap (pending):**

```bash
cd lambda/assets && npm test -- --testPathPattern=componentAggregate
```

**After exhaustive whitelist migration (2026-05-22):**

```bash
cd packages/mtw-gateways && npm test -- --testPathPattern='exhaustiveScan|verticals/consistency'  # 5 suites, 17 tests
cd lambda/assets && npm test -- --testPathPattern=dataSource/components/verticals              # 1 suite, 11 tests
cd lambda/diagnostics && npm test -- --testPathPattern=componentVerticalMisalignmentSweep       # 1 suite, 2 tests
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

**Repo hygiene (manual; not CI per D5):**

```bash
# Advisory during migration: should trend to zero outside componentData/exhaustiveScan and tests
rg "createAuthoritativeComponentDataCacheHandler|authoritativeComponentDataCache" --glob '!**/componentData/**' --glob '!**/*.planning.md'
```

---

## Related docs

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task planning framework |
| [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) | Gateway ownership + InternalCache playbook |
| [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../lambda/assets/AGENT.componentAggregate.planning.md) | Merge at participation order |
| [`taskPlanning/lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md`](../../lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md) | Hydrate wiring depends on pair loader |
| [`lambda/assets/dataSource/components/verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) | Vertical writer; exhaustive scan exception |
| [`.cursor/rules/gateways-internal-cache.mdc`](../../../.cursor/rules/gateways-internal-cache.mdc) | Lambda normative read path rule |
