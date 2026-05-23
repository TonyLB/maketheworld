# On-demand authored examples (invalidate + hydrate) - planning

**Status:** Design pass complete; **contracts**, **catalog + adjacency**, **gateway (A3)**, **lambda wiring (A1)**, **invalidation handler slice**, **Assets invalidation-only emitter**, **hydration step (`ensureAuthoredCatalog`)**, and **Tests** slice landed. **Next:** **Diagnostics renderCache sweep** per [**Recommended order**](#recommended-order).

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability, what belongs here vs in package docs). **Dispose** after the initiative ships and lasting notes live under [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md), [`lambda/assets/componentExamples/AGENT.md`](../../../../../lambda/assets/componentExamples/AGENT.md), and related steady-state docs.

**Anchor for discussion:** use this file to record answers as we narrow toward an implementable spec. Do not treat partial decisions here as shipped behavior until **Recommended order** items are checked and verification passes.

---

## Problem statement

Today, **`mtw.assets.componentExamples`** **proactively** publishes **`ExampleUpdated`** / **`ExampleRemoved`** with full cache-shaped payloads whenever Room / Feature / Knowledge / Situation components change in Assets. Ephemera **`mtw.ephemera.examples`** writes **`CACHE#...`** rows **before** anyone needs them.

That made sense for the first caching MVP (warm cache for Workbench preview and exact match). It is a poor fit now that:

- **`renderOrchestration`** resolves renders **reactively** (`findRender`, state fan-out, generation on miss).
- Blueprint edits are **unbounded** (many facets, many perspectives) while perception needs are **bounded** (specific room state + asset stack).
- **`ComponentAggregate`** in **`mtw-gateways`** is becoming the authoritative **merged view** read surface (see [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md)).

**Conceptual rule (unchanged):** when Situation / Room authored content changes, Ephemera must not serve stale perception for affected perspectives.

**Practical rule (new direction):** *when* Ephemera materializes cache rows should align with **resolve-time need**, not with every Assets component event.

### Invalidation fan-out: blueprint vs materialized cache

**Historical framing:** Today's **`mtw.assets.componentExamples`** mirroring is a **first-iteration prototype**, not a requirements-authoritative spec. It did important work proving we could keep Ephemera **renderCache** roughly aligned with a changing blueprint (push enriched payloads, wire **`Example*`** events, exercise perspective matchers). The overcount/undercount gaps below are the sort of issues first prototypes often surface once the concept is viable. Treat the current code as a **first-swing draft that was good enough to validate the idea** --- not as the shape the steady-state system must preserve. This initiative replaces that draft with invalidate-on-change + hydrate-on-demand and Situation adjacency ([**S1**](#situation-adjacency-invalidation-fan-out)--[**S5**](#situation-adjacency-invalidation-fan-out)).

The prototype's Situation branch uses **`getParentIdsForSituation`** ([`exampleEnrichment.ts`](../../../../../lambda/assets/componentExamples/exampleEnrichment.ts)) to scan blueprint in a small set of assets, then emits **one event per cache-host component** (prototype docs called this "parent") with a single **`assetStack`** derived from that component's **`ComponentData`**. That pattern **both overcounts and undercounts** relative to what Ephemera actually stores:

| Failure mode | What happens |
| --- | --- |
| **Overcount** | Many rooms (or F/K components) reference a Situation in blueprint, but only a few were ever resolved/hydrated. Assets still emits one invalidation per blueprint component reference; Ephemera may no-op (V1: no catalog row yet), but bus and handler work scale with **blueprint references**, not **cached examples**. |
| **Undercount** | The same cache-host component + Situation can exist at **multiple materialized perspectives** (e.g. canon `[A]` vs `[A,B]`). Prototype **`perspectiveMatcher`** / footprint **`assetStack`** on the wire did not align invalidation with **which layers participate** in each materialized perspective (see [**layer participation rule**](#layer-participation-rule-invalidation)). |

**Target:** for **Situation entity** edits, stop blueprint-driven parent fan-out on Assets. Publish a **Situation-scoped** invalidation with **`editAssetId`** only (the asset layer where the Situation component changed). Ephemera **fans out at materialized granularity** via **Situation adjacency** ([**S2**](#situation-adjacency-invalidation-fan-out)--[**S4**](#situation-adjacency-invalidation-fan-out)) using the [**layer participation rule**](#layer-participation-rule-invalidation). **Component-scoped** invalidations ([**S5**](#situation-adjacency-invalidation-fan-out)) cover **facet data on the component itself** (Room / Feature / Knowledge **Component Updated** / **Removed**) --- not a separate Example entity; legacy "parent" wording in old docs meant "component that hosts situation facets."

### Simplification vs deliberate complexity

**How we got here (observation only --- not a build sequence).** The list below describes the **historical** arc that produced today's mirror pipeline. It is **not** instructions to implement phases in order, and **not** a mandate to ship another "simple wire + complicated processing" system first. That stage **already exists** in production code ([**Problem statement**](#problem-statement) / [`componentExamples`](../../../../../lambda/assets/componentExamples/)); this initiative **replaces** it.

| Stage | What it was | Status for this plan |
| --- | --- | --- |
| 1. Simple wire + complicated processing | Mirror full payloads; Assets footprint stacks + **`perspectiveMatcher`**; blueprint **`getParentIdsForSituation`**; Ephemera **`putCacheRecord`** on every event | **Legacy --- retire**, do not extend or recreate |
| 2. Richer structures | Ephemera **`Cache::`** + adjacency; **`mtw-gateways`** **`componentExamples`** gateway (batch **`AuthoredExample`** assembly) | **Build now** |
| 3. Simpler processing | Skinny **`ExampleInvalidated`** + **`editAssetId`**; membership invalidation; gateway desired set + Ephemera hydrate orchestration (catalog diff + **`CACHE#`** writes only) | **Build now** |

**Going forward:** implement **rows 2 and 3** of the table. Do **not** add new mirror payloads, footprint **`editAssetStack`**, or blueprint fan-out as a stepping stone.

| Simplified (drop or retire) | Deliberate complexity (keep) |
| --- | --- |
| Full **`example`** bodies on every Assets change | **`catalogVersion`** / **`hydratedCatalogVersion`** per **`Cache::${perspectiveKey}`** |
| Assets **`editAssetStack`** / **`editParticipationStackFromFootprint`** (mirror-era footprint ordering) | Ephemera **`assetStack`** on catalog + adjacency (canon participation at hydrate; not an "edit" stack) |
| **`perspectiveMatcher`** on invalidation wire | **Situation adjacency** partition + link rows |
| Blueprint **`getParentIdsForSituation`** fan-out | **Hydrate diff** (desired set vs materialized **`CACHE#`** rows) |
| Bump **all** `Cache::` rows under a component on any facet edit | **Layer participation rule:** bump only rows whose stored **`assetStack`** **contains** event **`editAssetId`** |
| Prefix / "inheriting perspective" rules (**S3**, retired) on **`editAssetStack`** vs cached stack | **`ComponentAggregate`** + **`componentExamples`** gateway (**A1**--**A4**) |
| Eager mirror writes before resolve | **`ensureAuthoredCatalog`** only on orchestration resolve (**H1**, **H1b**) |

**Naming (do not conflate):**

- **`assetStack`** (Ephemera only): canonical ordered participation stack for a **materialized** perspective --- written at hydrate on **`Cache::`** catalog rows and Situation **adjacency** links. Used for merge at resolve and for invalidation membership tests. **`perspectiveKey`** is a hash of this stack; the stack itself must be stored because the hash is not reversible.
- **`editAssetId`** (Assets invalidation wire): the single **`ASSET#...`** where the **Component Updated** / **Removed** occurred (same as today's event **`assetId`**). Blast radius = "cached participation includes this layer." **No** ordered footprint stack on the wire.

---

## Proposed direction (working model)

Hybrid **invalidate on blueprint change, hydrate on demand** (Option B extended).

### 1. Assets: wildcard invalidations (not full payloads)

**`mtw.assets.componentExamples`** stops pushing enriched **`example`** bodies on every update. Instead it emits **`ExampleInvalidated`** (no **`example`** body) on two paths:

**Terminology:** **Component-scoped** = invalidation keyed by the **cache-host component** (`ROOM#` / `FEATURE#` / `KNOWLEDGE#`) whose **situation facets** changed. **Situation-scoped** = invalidation keyed by the **`SITUATION#`** entity. Avoid "parent-scoped" in new specs --- it reflects the old independent-**Example** model, not facet-on-component storage.

| Trigger | Scope | Payload emphasis |
| --- | --- | --- |
| **Component** (`Room` / `Feature` / `Knowledge` **Component Updated** / **Removed** --- facet data on that component) | That component (one event per component) | **`componentIds`**: `[componentId]`; **`editAssetId`**: asset where the edit occurred ([**P1**](#contract-gaps-resolved-at-planning)); optional **`affectedSituationIds`** (debug only). **No** **`editAssetStack`**. Ephemera bump: [**layer participation rule**](#layer-participation-rule-invalidation). |
| **Situation** (`Situation` **Component Updated** / **Removed**) | Situation entity only | **`situationId`**: `SITUATION#...`; **`editAssetId`**; **no `componentIds`**; **no `exampleId`** ([**Terminology**](#terminology-note)); **no** **`getParentIdsForSituation`** ([**S1**](#situation-adjacency-invalidation-fan-out)). Removed: adjacency cleanup [**P5**](#contract-gaps-resolved-at-planning). |

Keep historical **Example\*** names for **`ExampleUpdated`** / **`ExampleRemoved`** only where legacy consumers still exist during migration; steady-state Assets path is invalidation-only.

**Ephemera** resolves Situation invalidations via adjacency + [**layer participation rule**](#layer-participation-rule-invalidation), not by iterating **`componentIds`** from Assets.

### 2. Ephemera: catalog version (component + perspective) and optional row cleanup

On invalidation, Ephemera via **`mtw.ephemera.renderCache`** subscriber to **`mtw.assets.componentExamples`** ([**P3**](#contract-gaps-resolved-at-planning)):

**Leading idea:** maintain catalog state per **`(componentId, perspectiveKey)`** on a dedicated Ephemera row (not on **`Meta::Room`** or other **`Meta::\***`** blobs):

- **`EphemeraId`:** cache-capable component (`ROOM#...` first; later `FEATURE#...`, `KNOWLEDGE#...` when they use the same render-cache path)
- **`DataCategory`:** **`Cache::${perspectiveKey}`** (same pattern for every component type; **`perspectiveKey`** from [`computePerspectiveKey`](../../../../../packages/mtw-interfaces/ts/perspective.ts) already fingerprints the ordered asset stack)

**Naming clarity:** **`Cache::`** = per-perspective **catalog** (versions, hydration, optional fast pointer). **`Meta::Room`** = world-state / presence / objects. **`CACHE#${uuid}`** = one materialized render. The component kind is carried by **`EphemeraId`**, not embedded again in **`DataCategory`**.

Each **`Cache::${perspectiveKey}`** row holds at least monotonic **`catalogVersion`** (initial slice: **>= 1** when the row is created) and **`hydratedCatalogVersion`**. Every **`CACHE#...`** render row is stamped with the **`catalogVersion`** active at write time; rows missing the field are treated as **`catalogVersion === 0`** for guards and matching ([**V2**](#catalog-rows-cacheperspectivekey)). Lookup and pointers treat only **`CACHE#`** rows whose version **equals** the current **`catalogVersion`** on that perspective's catalog row as authoritative for display/exact-match.

**Stale / ready:** **stale** means `hydratedCatalogVersion < catalogVersion`. **Ready** means `hydratedCatalogVersion === catalogVersion`. Multiple invalidations do not make a row "more stale" --- if it is already stale, leave **`catalogVersion`** unchanged ([**M4**](#catalog-rows-cacheperspectivekey)).

On invalidation (owned by **`mtw.ephemera.renderCache`** --- [**M3**](#catalog-rows-cacheperspectivekey)):

**Component-scoped event** ([**P1**](#contract-gaps-resolved-at-planning)): facet (or facet list) changed on a Room / Feature / Knowledge component. For each **`componentId`** in the event, **`Query`** existing **`Cache::...`** rows under that **`EphemeraId`**; bump only rows whose stored **`assetStack`** satisfies the [**layer participation rule**](#layer-participation-rule-invalidation) for event **`editAssetId`** (e.g. facet edit in overlay Asset B stales **`[A,B]`** and **`[A,B,C]`** but not **`[A]`** alone --- see thought experiment in [**Simplification vs deliberate complexity**](#simplification-vs-deliberate-complexity)).

**Situation-scoped event** ([**S2**](#situation-adjacency-invalidation-fan-out)--[**S4**](#situation-adjacency-invalidation-fan-out)): **`Query`** adjacency partition **`EphemeraId = SITUATION#...`**; for each link whose **`assetStack`** satisfies the layer participation rule for **`editAssetId`**, bump **`Cache::${perspectiveKey}`** on the link's **host** **`EphemeraId`**. No blueprint component discovery on Ephemera for this path.

For each bump target:

- **(a) Conditional bump:** Only if the **`Cache::${perspectiveKey}`** row **already exists** ([**V1**](#catalog-rows-cacheperspectivekey) --- do **not** create catalog rows on invalidation). If `hydratedCatalogVersion === catalogVersion`, increment **`catalogVersion`**. If `hydratedCatalogVersion < catalogVersion` already, **no-op** (already invalid).
- **(b) Clear fast pointer** on the **`Cache::...`** catalog row (**`currentCacheId`**, [**M2**](#catalog-rows-cacheperspectivekey)); drop legacy **`Meta::Room.currentCacheByPerspective`** entries for that key as they are migrated off.
- **(c) No eager delete / GC** of old-version rows for now ([**I2**](#invalidation-events-assets---ephemera)): one lingering **`CACHE#`** row per markState until re-rendered is acceptable; version gate + hydrate diff handle correctness.

**Version gate (correctness, short-term):** Load **`Cache::${perspectiveKey}`** under the resolve component's **`EphemeraId`**; extend [`getExactMatch`](../../../../../lambda/ephemera/internalCache/renderCache.ts) (and pointer validation in [`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts)) to consider only **`CACHE#`** rows where `record.catalogVersion === catalogRow.catalogVersion`. Orphan rows from prior versions remain in Dynamo but are ignored for authoritative resolve.

**Hydration (sync, not append-only):** When `hydratedCatalogVersion < catalogVersion` on that catalog row:

1. **Desired set:** aggregate assembly for the cache-host component at this **`assetStack`** --- **all** situation facets on the merged component at this perspective ([**H2**](#hydration-scope-and-timing)), one authored slice per **`situationId`**. Target stamp: **`incomingCatalogVersion`** = **`catalogVersion`** on the **`Cache::${perspectiveKey}`** row at hydrate start.
2. **Existing set (for diff):** all **`CACHE#...`** rows for this component with **`provenance.type: 'authored'`** and **`perspectiveMatches`** this resolve perspective --- **not** filtered to `catalogVersion === hydratedCatalogVersion`. In practice most rows will be at or below the last hydrated version, but any **out-of-date** authored row for this perspective should be reconciled. Rows at **`catalogVersion >= incomingCatalogVersion`** are **out of scope** for overwrite/delete (see guards below).
3. **Diff:**
   - **`deleteCacheRecords`:** authored rows whose **`situationId`** is **absent** from the desired set **and** `(row.catalogVersion ?? 0) < incomingCatalogVersion` ([**H5**](#hydration-scope-and-timing) --- slice identity is **`situationId`**; each Situation has a unique markState). **Delete** matching **Situation adjacency** links for removed slices ([**S4**](#situation-adjacency-invalidation-fan-out)).
   - **`putCacheRecord` (upsert) every slice in the desired set** at **`incomingCatalogVersion`**, even when content is unchanged (version stamp must advance). When reusing an **`existingDataCategory`**, put only if `(existing.catalogVersion ?? 0) < incomingCatalogVersion`; otherwise skip that upsert (lost race to a concurrent hydrator or writer). **Put/update** adjacency for each upserted **`situationId`** ([**S4**](#situation-adjacency-invalidation-fan-out)).
4. Set **`hydratedCatalogVersion = catalogVersion`** on the **`Cache::${perspectiveKey}`** row only if **`catalogVersion`** still equals **`incomingCatalogVersion`** read at hydrate start; otherwise abort or retry ([**H6**](#hydration-scope-and-timing) --- per-row and catalog guards cover mid-hydrate invalidation).

This keeps the materialized authored catalog aligned with Assets without relying on invalidation-time deletes. The diff is **delete-by-absence (version-guarded) + upsert-all-desired (version-guarded)**. Older **`catalogVersion`** rows that are not touched remain for versioning / future improvisation policy. **Generated** rows are out of scope for this diff unless a separate policy says otherwise (H4).

**Invalidation-side memo:** Call **`internalCache.RenderCache.invalidate(componentId)`** when bumping version so memo does not hide version filtering.

#### Generated rows (`provenance.type: 'generated'`)

Same **version stamp** at generation time as the perspective's **`catalogVersion`** when the row is written.

| Phase | Policy |
| --- | --- |
| **Short-term (v1)** | Exact-match and pointer paths use **current catalog version only**. **Ignore** older-version **generated** rows entirely ([**V3**](#catalog-rows-cacheperspectivekey)). Document in code comments + durable docs that old generated rows may later feed **narrative consistency** after blueprint change. |
| **Longer-term (deferred)** | Optional LLM context from prior-version **generated** rows ("improvisation history") --- not in the first implementation slice. |

That split supports (a) ignoring stale cache without Dynamo deletes and (b) a documented path for **consistency-aware** generation later without conflating old blueprint prose with current authored truth.

**Schema sketch (TBD in M1 / V\* decisions):**

```typescript
// Ephemera table — catalog row per (componentId, perspective)
// PK: EphemeraId = ROOM#... | FEATURE#... | KNOWLEDGE#...  (cache-capable components)
// SK:  DataCategory = `Cache::${perspectiveKey}`  (from computePerspectiveKey)
type EphemeraCacheCatalogRow = {
    EphemeraId: EphemeraCacheComponentId;
    DataCategory: `Cache::${string}`; // perspectiveKey from computePerspectiveKey, e.g. PERSPECTIVE#v1#<hex>
    assetStack: AssetUUID[]; // canon participation at hydrate; used for editAssetId membership on invalidation
    catalogVersion: number; // initial slice: >= 1 when row is created (hydrate path)
    hydratedCatalogVersion: number; // 0 until first successful hydrate at this catalogVersion
    currentCacheId?: EphemeraCacheId; // fast pointer (M2)
};

// Ephemera table — render row (existing)
// PK: EphemeraId = componentId ; SK: CACHE#${uuid}
type EphemeraCacheDynamoItem = {
    // ... existing fields ...
    catalogVersion?: number; // blueprint epoch at write time (matches host Cache::${perspectiveKey} row)
};
```

**`Meta::Room`** remains home for **`state`**, **`activeCharacters`**, **`objects`**, etc. ([`EphemeraMetaRoom`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)). Avoid per-perspective catalog maps on **`Meta::\***`** rows; **`Cache::${perspectiveKey}`** under each component **`EphemeraId`** is the shared pattern for Room now and Feature/Knowledge later.

#### Situation adjacency (invalidation fan-out authority)

Adjacency is the **inverse index** from a Situation to **materialized** `(hostComponentId, perspective)` slots --- not blueprint facet references. Pattern aligns with thinking job membership ([`lambda/ephemera/dataSource/thinking/AGENT.md`](../../../../../lambda/ephemera/dataSource/thinking/AGENT.md)): lightweight rows on a dedicated partition, authoritative body elsewhere.

| Role | Key |
| --- | --- |
| **Partition** | `EphemeraId = SITUATION#${uuid}` |
| **Sort key** | `Link::${hostEphemeraId}::Cache::${perspectiveKey}` where **`hostEphemeraId`** is the cache-host `ROOM#` / `FEATURE#` / `KNOWLEDGE#` (explicit prefix --- do not reuse bare **`Cache::...`** SK under the Situation PK) |
| **Payload** | At minimum store **`assetStack`** (canonical ordered participation at hydrate time). **`perspectiveKey`** alone is not reversible from the hash; invalidation membership tests need the stack ([**layer participation rule**](#layer-participation-rule-invalidation)). |

**Maintain (S4, M3):** only **`mtw.ephemera.renderCache`** hydrate diff (and coordinated deletes). Put/update link when an authored slice for **`situationId`** is upserted at **`(componentId, perspectiveKey)`**; delete link when hydrate delete-by-absence removes that slice. No adjacency writes from legacy mirroring after migration.

**Situation invalidation handler:** load all links for **`SITUATION#...`**; filter by [**layer participation rule**](#layer-participation-rule-invalidation) for event **`editAssetId`**; conditional catalog bump + pointer clear per link. On **Situation Removed**, bump **all** links in the partition (entity gone), then **delete entire adjacency partition** ([**P5**](#contract-gaps-resolved-at-planning)). **Empty adjacency** (Situation edited before any resolve hydrated it) is a no-op --- consistent with on-demand cache.

```typescript
// Ephemera table — Situation adjacency (membership only)
// PK: EphemeraId = SITUATION#...
// SK:  DataCategory = `Link::${hostEphemeraId}::Cache::${perspectiveKey}`
type SituationCacheAdjacencyRow = {
    EphemeraId: `SITUATION#${string}`;
    DataCategory: `Link::${string}::Cache::${string}`;
    assetStack: AssetUUID[]; // canon order at hydrate; used for editAssetId membership on invalidation
};
```

#### Layer participation rule (invalidation)

After canonicalizing stored stacks the same way as [`computePerspectiveKey`](../../../../../packages/mtw-interfaces/ts/perspective.ts) input, a catalog or adjacency row is a **bump target** for an invalidation with **`editAssetId`** iff:

```text
row.assetStack.includes(editAssetId)
```

**Layer semantics:** an edit in asset layer **B** affects merged authored output only for perspectives whose participation stack **includes B** (e.g. **`[A,B]`**, **`[A,B,C]`**), not for **`[A]`** alone when B is an optional overlay. Same rule for **component-scoped** (filter **`Cache::`** rows) and **Situation-scoped** (filter adjacency links, then bump host **`Cache::`**).

**Retired:** ordered **prefix** / "inheriting perspective" rules on Assets **`editAssetStack`** (former **S3**). They conflated mirror-era **footprint** ordering with **canon participation** and could stale **`[A]`** when the edit occurred only in **B**. **Retired:** bump **all** `Cache::` rows under a component on any facet edit (former **P1** v1 wording).

**Do not** use prototype **`perspectiveMatcher`** / sole **`required: [A,B]`** on the wire --- that both over- and under-counted materialized perspectives ([**undercount**](#invalidation-fan-out-blueprint-vs-materialized-cache) table).

### 3. Read surface: blueprint assembly (gateway) + cache materialization (Ephemera)

**Domain split:**

| Layer | Owns | Does not own |
| --- | --- | --- |
| **`mtw-gateways`** (assets / blueprint read model) | Merged components at a participation order; **`componentExamples`** gateway assembles **`AuthoredExample`** set at that perspective ([**A3**](#aggregate-read-surface-cross-lambda)) | Dynamo **`CACHE#`** rows, catalog versions, adjacency, invalidation |
| **`mtw.ephemera.renderCache`** | **`ensureAuthoredCatalog`**, hydrate **diff**, **`putCacheRecord`**, catalog/adjacency CRUD | Merge across assets; blueprint facet discovery |

**Merge primitive:** register **`ComponentAggregateMergedCache`** on each lambda **`InternalCache`** that needs reads ([**A1**](#aggregate-read-surface-cross-lambda)). Callers pass **`mergeParticipationOrder`** (= canon **`assetStack`** from [**A2**](#aggregate-read-surface-cross-lambda)).

**`componentExamples` gateway (read/assembly, not the DataSource class):** **compute-only** module at **`packages/mtw-gateways/ts/assets/components/componentExamples/`** that composes **`ComponentAggregateMergedCache`** and returns the **desired set of `AuthoredExample`** values for a cache-host at one perspective. **Pull** surface for the same **domain** as **`mtw.assets.componentExamples`** **push** invalidations. **Lambda normative read path:** register **`createComponentExamplesCacheHandler({ ComponentAggregate })`** on **`internalCache.ComponentExamples`** (Ephemera + diagnostics); hydrate/diagnostics call **`get`**, not direct **`assemble`** in steady-state code ([`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) [**Component examples read surfaces**](../../../../../packages/mtw-gateways/AGENT.md#component-examples-read-surfaces-primary-vs-secondary)). **`renderCache/`** owns catalog diff + **`CACHE#`** materialization only. Package layout: **`ports.ts`**, **`input.ts`**, **`result.ts`**, **`keys.ts`**, **`factory.ts`**, **`assemble.ts`** (secondary).

This replaces **`exampleEnrichment.ts`** merge-at-push-time. Participation order is **explicit** at the call site (canon stack from state/orchestration for Ephemera; caller-supplied order for diagnostics). That order is **normative** --- a known product change from legacy **`getOrderedAssetStack`** mirroring ([**L2**](#legacy-mirroring-cleanup), [`AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md)).

#### `componentExamples` gateway --- algorithm (A3)

**Purpose:** answer "what **`AuthoredExample`** rows exist for this **cache-host** at this **participation order**?" in one batched read. An **`AuthoredExample`** is a **situation facet on that host**, merged at the stack (see [**Terminology**](#terminology-note)) --- not a standalone entity with its own id. Output is the **hydrate desired set** keyed by **`situationId`** (before Ephemera stamps **`catalogVersion`** on **`CACHE#`** rows).

**Entry points:** **Primary (lambda):** **`internalCache.ComponentExamples.get({ hostUniversalKey, mergeParticipationOrder, options? })`** via **`createComponentExamplesCacheHandler`**. **Secondary (package/tests):** **`assembleComponentExamplesAtPerspective({ input, aggregate })`** returning **`AuthoredExampleSet`**.

**Inputs:**

- **`hostUniversalKey`:** `ROOM#` / `FEATURE#` / `KNOWLEDGE#` (cache-capable host).
- **`mergeParticipationOrder`:** readonly `AssetUUID[]` (canon stack; same validation as [`aggregatePerspectiveExplicit`](../../../../../packages/mtw-gateways/ts/assets/components/aggregate/input.ts)).
- **`aggregate`:** **`ComponentAggregateMergedCache`** (or narrow port with **`get(perspectives: AggregatePerspective[]): Promise<MergedComponentResult[]>`**).
- **`options` (v1):** `{ resolveRoomLensMarkDefaults?: boolean }` --- default **true** for **`ROOM#`**, **false** for F/K ([**A4**](#aggregate-read-surface-cross-lambda)).

**Output (stable DTO in gateway `result.ts`):**

```typescript
// Public: one AuthoredExample per situation facet on the merged host at this participation order.
type AuthoredExample = {
    situationId: ComponentUUID; // SITUATION#... (facet target; not an "example id" for the row)
    markState: { markValue: { mark: string; value: string }[] };
    renderedContent: { displayName?: RenderTree; summary?: RenderTree; description: RenderTree };
    provenance: { type: 'authored' };
};

// Keyed by situationId (host + situationId + mergeParticipationOrder identify the example)
type AuthoredExampleSet = Map<ComponentUUID, AuthoredExample>;
```

Ephemera maps each **`AuthoredExample`** to **`putCacheRecord`** / **`EphemeraCacheDynamoItem`** fields. The gateway DTO stays **lambda-neutral** so diagnostics can diff against blueprint without depending on Ephemera types. Align body shapes with existing **`ComponentExamplesPayload`** in [`componentExamples.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/assets/componentExamples.ts) where practical.

**Steps:**

1. **Merge host.** **`aggregate.get([hostPerspective])`** -> **`mergedHost`**. If **no situation facets** on **`mergedHost`**, return **empty** **`AuthoredExampleSet`** (hydrate diff delete-by-absence per [**H5**](#hydration-scope-and-timing)).
2. **Discover dependents from merged host.** Enumerate situation facet **`situationId`**s on **`mergedHost.situations`**; for **`ROOM#`**, lens **`universalKey`** from **`mergedHost.lens`** when **`resolveRoomLensMarkDefaults`** (default true for Room). Build **`AggregatePerspective`** for each dependent (same **`mergeParticipationOrder`**).
3. **Merge dependents.** **`aggregate.get([...situationPerspectives, lensPerspective?])`** in a **second** batch --- **do not** include host again (host entry is already cached on the aggregate handler). Batching stays inside the aggregate handler's authoritative loader (Ephemera/assets/diagnostics: **`internalCache.ComponentData`** / **`getAcrossAssets`** at canon stack); do **not** loop per situation in application code.
4. **Room lens marks (optional).** When lens was merged: **`getLensMarksWithDefaults(mergedLens)`** ([`lensMarks`](../../../../../packages/mtw-wml/ts/standardize/worldState/lensMarks.ts)). Gateway uses **`ComponentAggregate`** for merged room + lens, not legacy **`merge*AcrossStack`**.
5. **Per facet: build `AuthoredExample`.** For each facet on **`mergedHost`**: look up merged **`StandardSituation`** for that **`situationId`** in the dependent batch; **`situationFacetToCacheShape(...)`**; insert into **`AuthoredExampleSet`**.

**Call site (lambda):** **`ensureAuthoredCatalog`** reads via **`internalCache.ComponentExamples.get(...)`** (handler composes **`internalCache.ComponentAggregate`**). Do **not** call **`assembleComponentExamplesAtPerspective`** directly at the hydrate boundary. **Ephemera:** aggregate slice **`{ ComponentData: internalCache.ComponentData, ... }`** --- pair **`getAcrossAssets`** at caller canon stack ([**A1**](#aggregate-read-surface-cross-lambda)). **Diagnostics:** same tier-1 **`ComponentData`** + **`ComponentVerticals`** inside the slice.

**Parity baseline:** behavioral reference is **`emitParentSituationFacetEvents`** + per-facet mirror in [`componentExamples/index.ts`](../../../../../lambda/assets/componentExamples/index.ts), with merge source swapped to **`ComponentAggregate`** ([**L2**](#legacy-mirroring-cleanup)). Golden tests in **`packages/mtw-gateways`** (fixture stacks); Ephemera integration tests assert hydrate diff + catalog, not byte-identical legacy merge order.

**Ephemera hydrate orchestration (catalog + `CACHE#` only):** [`ensureAuthoredCatalog`](#4-ephemera-lazy-hydration-before-exact-match--generation) calls **`internalCache.ComponentExamples.get`** -> **`AuthoredExampleSet`** -> version-guarded put/delete **`CACHE#`** + adjacency ([**H2**](#hydration-scope-and-timing), [**H5**](#hydration-scope-and-timing), [**S4**](#situation-adjacency-invalidation-fan-out)). "Thin" here means **no** blueprint merge in renderCache --- not "skip **`InternalCache`**."

### 4. Ephemera: lazy hydration before exact match / generation

**When (H1):** hydrate **only** on **orchestration resolve** (look, state fan-out, passive **`Render Requested`** --- not a separate authoring "warm catalog" API in v1).

When **`renderOrchestration`** needs authored candidates for a resolve, call **`ensureAuthoredCatalog`** ([**O1**](#orchestration-integration), [**H1b**](#contract-gaps-resolved-at-planning)) from [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) (and any other resolve entry points, e.g. state fan-out) **before** **`findRender`** --- not embedded inside **`findRender`**.

**`ensureAuthoredCatalog`** (renderCache module):

1. Load **`Cache::${perspectiveKey}`** under the resolve component's **`EphemeraId`** (**create-on-first-hydrate** if missing: **`catalogVersion` >= 1**, **`hydratedCatalogVersion = 0`**, **`assetStack`** = canon stack for this resolve).
2. If **`hydratedCatalogVersion < catalogVersion`**: **`internalCache.ComponentExamples.get`** ([**A3**](#aggregate-read-surface-cross-lambda), H2) -> **`AuthoredExampleSet`** -> **diff** by **`situationId`** (H5) -> version-guarded put/delete -> conditional catalog ready (H6).

Then **`findRender`** proceeds with **version-aware** **`getExactMatch`** / generation / pointer paths ([`renderCache` AGENT.md](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md), [pass-through contract](../AGENT.passThrough.contract.planning.md)). Hydration is a **silent** preflight ([**O2**](#orchestration-integration)); no new orchestration outbound.

**Coalesce** hydration with a **separate `singleFlight` cohort key** from generation ([**H3**](#hydration-scope-and-timing)) so concurrent resolves for one component + perspective do not stampede Assets reads.

### End-to-end sketch

```mermaid
sequenceDiagram
    participant Assets
    participant CE as mtw.assets.componentExamples
    participant RC as mtw.ephemera.renderCache
    participant Adj as SITUATION adjacency
    participant Cat as Cache::perspectiveKey row
    participant Orch as renderOrchestration
    participant Agg as ComponentAggregate
    participant CEgw as internalCache.ComponentExamples

    alt Component facet edit
        Assets->>CE: Component Updated / Removed (Room/F/K)
        CE->>RC: ExampleInvalidated (componentIds, editAssetId)
        RC->>Cat: bump Cache:: rows where assetStack contains editAssetId
    else Situation entity edit
        Assets->>CE: Component Updated / Removed (Situation)
        CE->>RC: ExampleInvalidated (situationId, editAssetId, no componentIds)
        RC->>Adj: Query links; filter assetStack contains editAssetId
        RC->>Cat: bump Cache:: per link (host component + perspectiveKey)
    end

    Orch->>RC: ensureAuthoredCatalog (silent preflight)
    RC->>Cat: read Cache::perspectiveKey
    alt hydratedVersion less than catalogVersion
        RC->>CEgw: get(host, mergeParticipationOrder)
        CEgw->>Agg: get(host perspective)
        Agg-->>CEgw: mergedHost
        CEgw->>Agg: get(situation + lens perspectives)
        Agg-->>CEgw: merged dependents
        CEgw-->>RC: AuthoredExampleSet
        RC->>RC: diff put/delete CACHE rows; maintain adjacency (S4)
        RC->>Cat: hydratedCatalogVersion=N
    end
    Orch->>RC: findRender getExactMatch (version=N only) / generate
```

---

## Relationship to today's pipeline

| Piece | Today | Target |
| --- | --- | --- |
| [`lambda/assets/componentExamples/`](../../../../../lambda/assets/componentExamples/) | **`ExampleUpdated`** with full **`example`**; **`getParentIdsForSituation`** per-component fan-out | **Invalidation-only**; Situation path emits **one** Situation-scoped event (**no** blueprint scan); component path **one event per cache-host component** ([**S1**](#situation-adjacency-invalidation-fan-out), [**P1**](#contract-gaps-resolved-at-planning)) |
| [`lambda/ephemera/dataSource/componentExamples.ts`](../../../../../lambda/ephemera/dataSource/componentExamples.ts) | **`putCacheRecord`** on Added/Updated | **Retire** mirror writes; invalidation moves to **`mtw.ephemera.renderCache`** ([**M3**](#catalog-rows-cacheperspectivekey), [**S2**](#situation-adjacency-invalidation-fan-out)) |
| [`renderOrchestration/orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) | intake -> **`findRender`** | **`ensureAuthoredCatalog`** after intake, before **`findRender`** ([**O1**](#orchestration-integration)) |
| [`renderOrchestration/findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) | Pointer validate -> exact match -> generate | Unchanged sequencing; relies on catalog already hydrated |
| [`packages/mtw-gateways/.../aggregate/`](../../../../../packages/mtw-gateways/ts/assets/components/aggregate/) | Assets **`InternalCache.ComponentAggregate`**; parity vs **`merge*AcrossStack`** | Ephemera-callable read surface for hydration (wiring TBD) |
| Diagnostics reseed | Synthetic **`Component Republished`** -> mirroring path | **Remove** Assets reseed; Ephemera handles finding via **`Cache::`** version bump + hydrate on resolve |

**Supersedes (intent):** old GitHub-issue thrust of "more mirroring" / "tighten **`exampleEnrichment`** for push" / blueprint **`getParentIdsForSituation`** fan-out as **primary** delivery---Situation edits become **one** invalidation + Ephemera adjacency fan-out ([**S1**](#situation-adjacency-invalidation-fan-out)).

**Does not replace:** LLM **generated** rows (`provenance.type: 'generated'`), orchestration pass-through for **`Render Generated`**, or state-driven **`fanOutStateChangedToPassiveRenders`**.

---

## Consolidation handoff (mirroring / reseed retirement)

**Component data gateway consolidation shipped:** pair-addressed **`internalCache.ComponentData`**, **`authoritativeFromParticipationOrder`**, and **`assetMeta/`** removal are documented in [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) (**Component data reads: ephemera vs assets**). **`componentExamples`** mirroring and diagnostics reseed load bodies via that read path ([`loadAuthoritativeForMirroring`](../../../../../lambda/assets/componentExamples/loadAuthoritativeForMirroring.ts)), not partition enumerate. **This initiative owns** retiring the remaining mirror/reseed **pipelines**.

| Consolidation item | Status | On-demand [**Recommended order**](#recommended-order) items |
| --- | --- | --- |
| Partition **`ComponentData`** reads on mirroring/reseed | **Done** (pair loader) | N/A |
| Retire **`ExampleUpdated`** / **`ExampleRemoved`** mirror payloads | **This plan** | **Assets emitter**; **Invalidation handler** (partial); retire [`componentExamples.ts`](../../../../../lambda/ephemera/dataSource/componentExamples.ts) |
| Retire **`reseedComponentExamplesFromDiagnostics`** | **Done** | **P7** on Ephemera **`renderCache`**; Assets routing removed |
| Remove **`loadAuthoritativeForMirroring`**, legacy **`exampleEnrichment`** merge-at-push | **Done** (Assets emitter slice) | **`internalCache.ComponentExamples`** replaces push-time merge at hydrate boundary (next slice) |
| Grep cleanup of **`createAuthoritativeComponentDataCacheHandler`** outside **`componentData/`** | **Done** (shim removed) | Do **not** reintroduce partition handler on lambdas; see [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) |

Deploy sequence remains [**P6**](#contract-gaps-resolved-at-planning): Ephemera catalog + invalidation + **`ensureAuthoredCatalog`** first; then Assets invalidation-only; then drop **`mtw.ephemera.examples`** mirror subscriber.

---

## Terminology note

### Example (domain term, reclaimed)

An **Example** (implement as **`AuthoredExample`** in gateways) means: **a situation facet on a cache-host component** (`ROOM#` / `FEATURE#` / `KNOWLEDGE#`), **aggregated** at a **participation order** (`mergeParticipationOrder` / canon **`assetStack`**). It is identified by **(host, `situationId`, perspective)** --- **not** by a single universal "example id."

- **Not** the retired **`EXAMPLE#`** WML component type. Legacy **`authoredExampleId`** on some **`CACHE#`** rows (F/K) is historical; do not use **`EXAMPLE#`** in new wire contracts.
- **Not** the Situation entity alone: a Situation can appear in many hosts; each host facet at a stack is its own Example.

### Assets vs gateways naming

| Name | Meaning |
| --- | --- |
| **`mtw.assets.componentExamples`** (DataSource) | **Push:** invalidations when blueprint examples change. Does **not** publish merged **`AuthoredExample`** bodies. |
| **`componentExamples`** (gateways module) | **Pull:** **`internalCache.ComponentExamples`** (**`createComponentExamplesCacheHandler`**) --- normative lambda read surface. **`assembleComponentExamplesAtPerspective`** is **secondary** (package tests). **Not** the DataSource class. |

### Invalidation wire (**`ExampleInvalidated`**)

| Variant | Fields | Notes |
| --- | --- | --- |
| **Component-scoped** | **`componentIds`**, **`editAssetId`** | Optional **`affectedSituationIds`** (debug only). |
| **Situation-scoped** | **`situationId`**, **`editAssetId`** | **`situationId`** = `SITUATION#...`. **No `exampleId`** --- Examples are not a single-id entity. **No `componentIds`**. |

Event **names** keep historical **`Example*`** prefix for stream compatibility; payload semantics are situation-facet-based.

### Sample vs constellation (generation / search vocabulary)

Do **not** overload **constellation** for v1 exact-match or hydrate --- reserve it for the Guidance-distance model in [`lambda/ephemera/AGENT.caching.planning.md`](../../../../../lambda/ephemera/AGENT.caching.planning.md).

| Term | Meaning |
| --- | --- |
| **`AuthoredExample` / `AuthoredExampleSet`** | Blueprint-side truth from the **`componentExamples`** gateway: situation facets on a host at a **`mergeParticipationOrder`**. Input to hydrate. |
| **Materialized examples** | Authored **`CACHE#`** rows under a host at a perspective, stamped with **`catalogVersion`**. |
| **Sample** | A **presumed-complete-enough set of Examples** (usually authored **`CACHE#`** rows at the active catalog version for that perspective) used to **ground generation** --- e.g. LLM context when there is no exact markState match. v1 prototype may use "all hydrated authored rows for component + perspective" as the sample ([`AGENT.caching.planning.md`](../../../../../lambda/ephemera/AGENT.caching.planning.md) generation notes). A sample is a **chosen subset** of candidates, not a search geometry. |
| **Constellation** | **Normative (future):** the **Guidance landmark space** for a component --- relevance/proximity of a state (proposed or on an Example) to each Guidance axis. Comparing constellation vectors (and bucket membership) is how we estimate **which Examples are nearby** when **assembling a sample**. Not synonymous with "all cache rows at a perspective." |

**This initiative:** hydrate builds **`AuthoredExampleSet`** then materializes **`CACHE#`** rows; **exact match** picks one row by markState equality. **Sample** selection for generation and **constellation** search are **out of scope** here except naming discipline above.

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for task-plan conventions.
2. Read steady-state cache + orchestration (do not duplicate here):
   - [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md)
   - [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md)
   - [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md)
3. Read today's mirroring pipeline:
   - [`lambda/assets/componentExamples/AGENT.md`](../../../../../lambda/assets/componentExamples/AGENT.md)
   - [`lambda/assets/componentExamples/exampleEnrichment.ts`](../../../../../lambda/assets/componentExamples/exampleEnrichment.ts)
4. Read aggregate + authored-slices gateway (hydration read surface):
   - [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md)
   - [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) (**Aggregate read surfaces**, compute-only layout)
   - This plan [**section 3**](#3-read-surface-blueprint-assembly-gateway--cache-materialization-ephemera) (**`componentExamples` gateway** / **`AuthoredExample`**)
5. **Tests (command authority):** from [`lambda/ephemera/`](../../../../../lambda/ephemera/): `npm test`. Baseline before edits: `npm test -- --testPathPattern=renderCache` and `npm test -- --testPathPattern=componentExamples` (assets: `cd lambda/assets && npm test -- --testPathPattern=componentExamples`).

---

## Progress

| Milestone | Status |
| --- | --- |
| Problem + hybrid direction captured | Done |
| Open decisions listed (incl. S1--S5, P1--P7; layer invalidation + A3 gateway) | Done |
| `componentExamples` gateway + **`AuthoredExample`** naming (algorithm + implementation) | Done |
| Invalidation event contract drafted | Done |
| Catalog rows + adjacency CRUD + invalidation handler (M2/S2--S4) | Done |
| Invalidation handler slice (P7, reseed + mirror retirement) | Done |
| Meta freshness fields + writers | Partial (catalog `currentCacheId`; legacy Meta fallback) |
| Ephemera aggregate read wiring | Done |
| Hydration step in orchestration | Done |
| Assets componentExamples emit invalidations only | Done |
| Tests (gateway parity, invalidation, hydrate diff, hydrate-then-exact-match) | Done |
| Steady-state AGENT.md updates | Partial (renderCache + dataSource + assets event docs updated) |

---

## Open decisions

All rows below are **decided** for the initial slice (recorded inline), including [**Contract gaps (P1--P7)**](#contract-gaps-resolved-at-planning) closed at planning time. **P2 (`editAssetStack` on Assets)** and **S3 (prefix expansion)** are **retired** in favor of **`editAssetId`** + [**layer participation rule**](#layer-participation-rule-invalidation). Reopen only if implementation discovers a gap.

### Invalidation events (Assets -> Ephemera)

| # | Question | Decision |
| --- | --- | --- |
| I1 | **Wire shape:** new **`ExampleInvalidated`** vs overload **`ExampleRemoved`** / **`ExampleUpdated`** without **`example`**? | **Decided:** new **`ExampleInvalidated`** (no **`example`** body). Variants: **component-scoped** ([**P1**](#contract-gaps-resolved-at-planning); **`componentIds`**, **`editAssetId`**); **Situation-scoped** (**`situationId`**, **`editAssetId`**; no **`componentIds`** --- [**S1**](#situation-adjacency-invalidation-fan-out)). **No `exampleId`** on invalidation wire ([**Terminology**](#terminology-note)). **No** **`editAssetStack`**, **no** **`perspectiveMatcher`** in v1. |
| I2 | **Physical delete timing:** eager delete / GC of old **`catalogVersion`** rows? | **Decided:** defer --- no eager delete or TTL for now; lingering rows per state are fine until a new render at that state updates them. Hydrate diff + version gate suffice. |
| I2b | **If eager delete:** wildcard delete scope on **`CACHE#`** rows? | **N/A** while I2 defers eager delete. |
| I3 | **Feature / Knowledge cache-host components:** Room-only first vs generalize from day one? | **Decided:** generalize from day one (`ROOM#` / `FEATURE#` / `KNOWLEDGE#`, shared **`Cache::${perspectiveKey}`** under each **`EphemeraId`**) to avoid a second sync pipeline later. |
| I4 | **Component Republished** and diagnostics **reseed:** same invalidation as Updated, or special-case full heal? | **Decided (reseed path):** handle **`Ephemera RenderCache Finding`** in **Ephemera** via catalog invalidation + on-demand hydrate; **drop** Assets **`reseedComponentExamplesFromDiagnostics`** and synthetic **`Component Republished`** for cache heal. See [I4 explained](#i4-explained-component-republished-and-diagnostics-reseed). |

#### I4 explained (Component Republished and diagnostics reseed)

Two separate mechanisms today both end up in **`mtw.assets.componentExamples`**; under the new design they should converge on **`ExampleInvalidated`** (version bump), not full Example payloads.

**`Component Republished` (Assets mesh header)**

- **What it is:** An **`mtw.assets`** stream header type (alongside **`Component Updated`** / **`Component Removed`**). Payload is still a component body (same shape as an update).
- **Who emits it today:** Most often **[`reseedFromDiagnostics.ts`](../../../../../lambda/assets/componentExamples/reseedFromDiagnostics.ts)** --- it does **not** mean "this asset was republished in the CMS sense" exclusively; it is reused as a **synthetic** header when re-entering the examples pipeline.
- **What componentExamples does today:** **[`index.ts`](../../../../../lambda/assets/componentExamples/index.ts)** branches on Room / Feature / Knowledge / Situation the same way for **`Component Updated`** and **`Component Republished`** (only **`Component Removed`** is special). So Republished currently triggers the same **full Example mirror** path as Updated.
- **Target behavior:** Treat **`Component Republished`** like **`Component Updated`** for invalidation --- emit **`ExampleInvalidated`** with **`editAssetId`** (layer participation bump on Ephemera). No separate "republish" payload path.

**Diagnostics reseed (`Ephemera RenderCache Finding`)**

- **What it is:** **`mtw.diagnostics`** emits **`Ephemera RenderCache Finding`** when a check decides Ephemera catalog rows are **`missing`** or **`corrupted`** relative to blueprint. Wire shape: **`targetCatalogs`** --- `{ ephemeraId, perspectiveKey }[]` (may be empty = no-op). Publisher owns discovery; Ephemera only bumps listed catalogs. See [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts).
- **Who handles it:** **`mtw.assets`** main data source ([`lambda/assets/dataSource/index.ts`](../../../../../lambda/assets/dataSource/index.ts)) calls **`reseedComponentExamplesFromDiagnostics`**, which loads each target Room from **`ComponentData`**, then **synthesizes** an internal **`mtw.assets`** event: content **`Component Updated`**, header **`Component Republished`**, so the **old** mirroring pipeline rebuilds cache rows.
- **Why it existed:** Steady-state docs describe reseed as "re-use the same authored payload construction as normal updates" rather than a one-off heal API ([`lambda/assets/AGENT.event.md`](../../../../../lambda/assets/AGENT.event.md) **Diagnostics reseed integration**).
- **Under on-demand authored examples:** A finding means "these materialized catalogs are wrong." With hydrate-on-demand, Ephemera fixes that **locally**: for each **`targetCatalogs`** entry, bump **`catalogVersion`** on **`Cache::${perspectiveKey}`** if the row exists (V1), clear pointers, **`RenderCache.invalidate`**. The next resolve (or optional eager hydrate) rebuilds from Assets aggregate --- **no Assets round-trip**.

**Decision (reseed + synthetic Republished):** **[`reseedFromDiagnostics.ts`](../../../../../lambda/assets/componentExamples/reseedFromDiagnostics.ts)** and the Assets handler that calls it become **obsolete for cache heal**. Do **not** remap findings to **`ExampleInvalidated`** on Assets unless we intentionally keep a cross-lambda path. Prefer **`mtw.ephemera.*`** (or **`mtw.ephemera.renderCache`**) subscribing to **`Ephemera RenderCache Finding`** (today Ephemera does **not** --- see [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md)).

**`Component Republished` is not globally dead:** **`mtw.assets`** may still emit it for other subscribers (e.g. **`mtw.assets.components.verticals`** treats Updated / Republished / Removed alike per [`verticals/AGENT.md`](../../../../../lambda/assets/dataSource/components/verticals/AGENT.md)). For **`mtw.assets.componentExamples`**, once reseed is gone, **drop `Component Republished` from the subscription** if nothing else needs a distinct examples invalidation --- **`Component Updated`** / **Removed** (component-scoped + Situation-scoped paths per [**S5**](#situation-adjacency-invalidation-fan-out) / [**S1**](#situation-adjacency-invalidation-fan-out)) suffice.

**Lazy vs eager heal on finding:** **lazy** in v1 ([**P7**](#contract-gaps-resolved-at-planning)) --- invalidation-only; optional eager hydrate deferred unless diagnostics product requires it.

### Situation adjacency (invalidation fan-out)

| # | Question | Decision |
| --- | --- | --- |
| S1 | **Assets Situation path:** keep **`getParentIdsForSituation`** blueprint fan-out? | **Decided:** **remove** for Situation **Component Updated** / **Removed**. Emit **one** **`ExampleInvalidated`** per Situation change with **`situationId`** + **`editAssetId`**. **No `componentIds`**, **no `exampleId`**. |
| S2 | **Ephemera Situation invalidation:** who fans out to host components / perspectives? | **Decided:** **`mtw.ephemera.renderCache`** invalidation handler. **`Query`** **`SITUATION#`** adjacency partition; apply [**layer participation rule**](#layer-participation-rule-invalidation); bump **`Cache::`** under each matching link's host **`EphemeraId`**. Subscriber may move off **`mtw.ephemera.examples`** ([**M3**](#catalog-rows-cacheperspectivekey)). |
| S3 | **Which adjacency rows does one Situation edit invalidate?** | **Decided (revised):** links where **`link.assetStack.includes(editAssetId)`** after canonicalization --- same [**layer participation rule**](#layer-participation-rule-invalidation) as component path. **Retired:** prefix / "inheriting perspective" rules on Assets **`editAssetStack`**. |
| S4 | **When are adjacency rows written/deleted?** | **Decided:** **hydrate diff only** ([**M3**](#catalog-rows-cacheperspectivekey)): put/update on authored slice upsert; delete on delete-by-absence for that **`situationId`** at **`(componentId, perspectiveKey)`**. Store **`assetStack`** on the link. |
| S5 | **Facet-on-component edits:** still component-scoped invalidation? | **Decided:** **yes**. Room / Feature / Knowledge **Component Updated** / **Removed** (situation facet data on that component) emit **one** component-scoped **`ExampleInvalidated`** per **`componentId`** with **`editAssetId`** ([**P1**](#contract-gaps-resolved-at-planning)). Ephemera bumps only matching **`Cache::`** rows ([**layer participation rule**](#layer-participation-rule-invalidation)). Adjacency for Situation slices updates on hydrate only. Situation-entity edits use the Situation path ([**S1**](#situation-adjacency-invalidation-fan-out)). |

### Contract gaps (resolved at planning)

Closed before the contracts implementation slice so component/Situation emitters and Ephemera handlers do not improvise.

| # | Question | Decision |
| --- | --- | --- |
| P1 | **Component-scoped `ExampleInvalidated`:** one event per component vs per facet? Ephemera bump rule? | **Decided (revised):** **One event per cache-host component** per **Component Updated** / **Removed** when facet data on that component changed (not one per facet). Wire: **`componentIds`**, **`editAssetId`** (= event asset id). Optional **`affectedSituationIds`** for logging only. **Ephemera:** **`Query`** `Cache::` rows on that **`EphemeraId`**; **conditional bump** only where **`catalogRow.assetStack.includes(editAssetId)`** ([**layer participation rule**](#layer-participation-rule-invalidation), V1/M4). |
| P2 | **`editAssetStack` on Assets** (component and Situation): which algorithm? | **Retired:** do **not** emit or compute Assets **`editAssetStack`** / **`editParticipationStackFromFootprint`** for invalidation. Participation stacks live on Ephemera catalog + adjacency rows only ([**Simplification vs deliberate complexity**](#simplification-vs-deliberate-complexity)). |
| P3 | **Who subscribes to `mtw.assets.componentExamples` invalidations?** | **Decided:** **`mtw.ephemera.renderCache`** DataSource gains a subscribed envelope for **`ExampleInvalidated`** (EventBridge from Assets). **`mtw.ephemera.examples`** mirror handler (**`putCacheRecord`** on Example\*) is **removed** in the same migration slice (no long-lived forwarder). Invalidation + catalog/hydrate/adjacency stay in **`renderCache/`** per [**M3**](#catalog-rows-cacheperspectivekey). |
| H1b | **Non-orchestration readers** (`ComponentRender`, raw **`RenderCache.get`):** call **`ensureAuthoredCatalog`?** | **Decided (v1):** **No.** **`ensureAuthoredCatalog`** runs only on **orchestration resolve** entry points: **`orchestrateRenderRequest`** after successful intake (including **`fanOutStateChangedToPassiveRenders`**). **`ComponentRender`** / perception paths that read cache directly may serve **version-gated** rows that are stale until the next resolve hydrates --- acceptable in v1; gameplay **look** and passive **`Render Requested`** are normative for freshness. Revisit if Workbench preview needs eager hydrate without orchestration. |
| P5 | **Situation `Component Removed`:** adjacency partition cleanup? | **Decided:** after Situation-scoped invalidation bump **all** adjacency links ([**S2**](#situation-adjacency-invalidation-fan-out); entity removed), **delete all rows** under **`EphemeraId = SITUATION#...`** (paginated **`Query`** on partition). Idempotent; empty partition is fine. Do not leave orphan **`Link::...`** rows. |
| P6 | **Migration / deploy order / dual-write?** | **Decided:** **No dual-write** of authored bodies after cutover. **Order:** (1) Ship Ephemera **catalog rows + invalidation handler + adjacency + `ensureAuthoredCatalog`** (tolerates legacy **`CACHE#`** without **`catalogVersion`** per [**V2**](#catalog-rows-cacheperspectivekey)); (2) Switch Assets to **`ExampleInvalidated`**-only and drop mirror puts; (3) Remove **`mtw.ephemera.examples`** subscriber. Brief overlap where Assets emits invalidations before Ephemera handler is live is OK (bumps no-op on missing **`Cache::`**). **No** byte-parity gate vs mirrored payloads ([**L2**](#legacy-mirroring-cleanup)). |
| P7 | **Diagnostics `Ephemera RenderCache Finding`:** handler home; eager vs lazy heal? | **Decided:** **`mtw.ephemera.renderCache`** (same module as invalidation) subscribes on Ephemera; **drop** Assets **`reseedComponentExamplesFromDiagnostics`** ([**I4**](#i4-explained-component-republished-and-diagnostics-reseed)). **Heal targets:** **`finding.targetCatalogs`** --- `{ ephemeraId, perspectiveKey }[]` (empty = no-op). Ephemera handler is **receive-only bump**: **`getCatalogRow`** + **`conditionalInvalidateCatalogRow`** per entry; **no** blueprint scan on receive. Bump **only if** **`Cache::${perspectiveKey}`** exists (V1). **Lazy heal** --- no eager **`ensureAuthoredCatalog`** on finding. **Publisher** (future diagnostics sweep) owns enumeration and materialized-catalog checks; emits **`targetCatalogs`** only. F/K hosts deferred until sweep includes them (room-first v1). |

#### Participation `assetStack` vs `editAssetId` (context)

**Ephemera `assetStack`** on **`Cache::`** and adjacency rows is the **canon participation stack** at hydrate/resolve ([**resolveCanonAssetStackForRoom**](../../../../../lambda/ephemera/dataSource/state/resolveAssetStackForRoom.ts), [**A2**](#aggregate-read-surface-cross-lambda)). It is **not** tied to where an edit occurred.

**`editAssetId`** on **`ExampleInvalidated`** is only the Assets event asset. Invalidation compares **`editAssetId`** to stored **`assetStack`** via [**layer participation rule**](#layer-participation-rule-invalidation). Do **not** reintroduce mirror-era footprint **`editAssetStack`** on the wire.

### Catalog rows (`Cache::${perspectiveKey}`)

| # | Question | Decision |
| --- | --- | --- |
| M1 | **`DataCategory` encoding:** **`Cache::${perspectiveKey}`** cross-component; safe as SK? | **Decided:** yes. **`perspectiveKey`** is **`PERSPECTIVE#v1#<hex>`** from [`computePerspectiveKey`](../../../../../packages/mtw-interfaces/ts/perspective.ts) --- bounded, ASCII-safe. Catalog row also stores **`assetStack`** (participation at hydrate) for invalidation membership. Document types in renderCache **`baseClasses.ts`** (and shared interfaces as needed). |
| M2 | **`currentCacheByPerspective`:** on **`Cache::...`** row vs **`Meta::Room`** map? | **Decided:** **`currentCacheId`** (and version validation) on **`Cache::${perspectiveKey}`** catalog row; migrate off **`Meta::Room.currentCacheByPerspective`**. Same shape for F/K. |
| M3 | **Who writes catalog rows?** | **Decided:** **`mtw.ephemera.renderCache`** DataSource owns catalog row CRUD (primitives + handler wiring). Invalidation and hydrate paths call into renderCache; not ad hoc writes from **`mtw.ephemera.examples`** mirror handler. |
| M4 | **When to bump `catalogVersion` on invalidation?** | **Decided:** bump **only if** `hydratedCatalogVersion === catalogVersion` (catalog was ready). If already stale (`hydrated < catalog`), **no-op** --- repeated invalidations do not increase the gap. |
| V1 | **Wildcard bump scope:** all matcher-matching perspectives vs only those previously hydrated? | **Decided:** only **`Cache::${perspectiveKey}`** rows that **already exist** for that **`EphemeraId`** (previously hydrated at least once). No catalog row creation on invalidation. |
| V2 | **`catalogVersion` on `CACHE#` rows; backfill?** | **Decided:** treat missing field as **0**; new **`Cache::...`** rows start at **`catalogVersion >= 1`**. Legacy rows at 0 are ignored by version gate until hydrate refreshes them. No backfill required for initial slice. |
| V3 | **Generated history / narrative consistency?** | **Decided (v1):** ignore old versions in lookup and generation. Add **comments + durable doc** noting future use of prior-version **generated** rows for narrative consistency after blueprint change. |
| V4 | **GC/TTL of old versions?** | **Decided (with I2):** no physical delete / GC in initial slice. |

### Hydration scope and timing

| # | Question | Decision |
| --- | --- | --- |
| H1 | **When to hydrate?** | **Decided:** **only** on orchestration resolve ([**H1b**](#contract-gaps-resolved-at-planning) --- not **`ComponentRender`** / raw cache reads in v1). |
| H2 | **What to materialize?** | **Decided (v1):** **all** situation facets on the merged cache-host component at this **`assetStack`** / perspective (catalog is component x perspective; hydrate the full facet catalog per slice). |
| H3 | **Coalescing?** | **Decided:** **separate** **`singleFlight`** cohort key from generation. |
| H4 | **Delete generated rows on version bump?** | **Decided:** **no** --- leave old-version generated rows; v1 ignores them ([**V3**](#catalog-rows-cacheperspectivekey)). |
| H5 | **Hydrate diff identity?** | **Decided:** **`situationId`** only (each Situation has a unique **markState**). **Delete-by-absence** and upsert keys use **`situationId`**. |
| H6 | **Catalog row race mid-hydrate?** | **Decided:** addressed by existing design --- per-row **`catalogVersion < incoming`** guards, conditional catalog **`hydratedCatalogVersion`** write, and **M4** no-op when already stale. No extra mechanism in v1. |

### Aggregate read surface (cross-lambda)

| # | Question | Decision / notes |
| --- | --- | --- |
| A1 | **Lambda access to merge:** how do Ephemera / diagnostics call **`ComponentAggregate`?** | **Decided (pattern):** follow [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) **compute-only** playbook --- **not** a synchronous Assets Lambda API and **not** importing Assets **`internalCache`**. Each lambda registers **`createComponentAggregateCacheHandler(slice)`** on its **`InternalCache`**. **Diagnostics** --- tier-1 **`ComponentData`** + **`ComponentVerticals`** (`createComponentDataCacheHandler`, `createImportVerticalMetaCacheHandler`) like assets. **Ephemera** --- **`internalCache.ComponentData`** ([`lambda/ephemera/internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts)) with **`getAcrossAssets`** for the **caller-supplied** canon **`mergeParticipationOrder`**; aggregate slice **`{ ComponentData: internalCache.ComponentData, ... }`**. Stub **`ComponentVerticals`** if needed for slice shape. Participation-scoped authoritative loads via **`authoritativeFromParticipationOrder`** / slice adapter --- **not** partition enumerate on hot paths. **`ComponentVerticals`:** required on the slice type today; v1 merge uses explicit participation order only (`void` vertical rows in aggregate factory) --- Ephemera may wire a stub/empty vertical loader until graph-derived order is needed. **Secondary** **`createComponentAggregateGateway`** is for tests/parity only. |
| A2 | **Participation order:** always caller-supplied canon stack ([`resolveCanonAssetStackForRoom`](../../../../../lambda/ephemera/dataSource/state/resolveAssetStackForRoom.ts) / state helpers) vs ever graph-derived order from verticals? | **Decided (v1):** keep caller-supplied canon stack via **`resolveCanonAssetStackForRoom`** (and existing state helpers) for Ephemera **`assetStack`** / gateway **`mergeParticipationOrder`**. Diagnostics passes the perspective under test explicitly. **Defer** deriving order from **`ComponentVerticals`** only. |
| A3 | **Facet assembly API:** batch **"all authored slices for component at stack"**; **`mtw-gateways`** or renderCache-local? | **Decided (revised):** **compute-only** gateway **`packages/mtw-gateways/ts/assets/components/componentExamples/`** (not the Assets DataSource class). **Batch** assembly per [algorithm](#componentexamples-gateway---algorithm-a3). Types **`AuthoredExample`** / **`AuthoredExampleSet`**. **Lambda wiring:** **`createComponentExamplesCacheHandler({ ComponentAggregate })`** on **`internalCache.ComponentExamples`**; steady-state callers use **`get`**, not direct **`assemble`**. **`renderCache/`** only maps to **`CACHE#`** + diff. Lifts **`situationFacetToCacheShape`** (+ Room lens path) from [`exampleEnrichment.ts`](../../../../../lambda/assets/componentExamples/exampleEnrichment.ts). **Consumers:** Ephemera hydrate, **`lambda/diagnostics`**. |
| A4 | **Lens marks on Room:** where does lens-default resolution run? | **Decided (revised):** inside [**`componentExamples` gateway**](#componentexamples-gateway---algorithm-a3) (algorithm step 4), **not** on core **`ComponentAggregate`** and **not** duplicated in Ephemera hydrate. **v1 Room-only:** merged room lens ref -> merged **`StandardLens`** at same **`mergeParticipationOrder`** -> **`getLensMarksWithDefaults`** -> input to **`situationFacetToCacheShape`**. Feature/Knowledge: **`resolveRoomLensMarkDefaults: false`** until needed. |

### Orchestration integration

| # | Question | Decision / notes |
| --- | --- | --- |
| O1 | **Placement:** hydrate inside **`findRender`** before **`getExactMatch`**, or separate **`ensureAuthoredCatalog`**? | **Decided:** separate **`ensureAuthoredCatalog`** in **`renderCache/`**, invoked from [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) (and other resolve entry points such as state fan-out) **after** successful intake, **before** **`findRender`**. Keeps **`findRender`** focused on pointer / exact-match / generation policy. |
| O2 | **Pass-through contract:** new orchestration outbound for "catalog hydrated", or silent side effect? | **Decided:** **silent** side effect --- no new **`mtw.ephemera.renderOrchestration`** outbound. Existing terminals (**`Exact Match Found`**, **`Current Cache Valid`**, generation events) unchanged; subscribers observe hydrated rows only via subsequent cache reads. |
| O3 | **Feature/Knowledge perception:** still DEFAULT-only resolve; hydrate scope? | **Decided:** **no change** to v1 perception resolve semantics --- Feature/Knowledge (and primitive rooms without lens marks) still select the **`SITUATION#DEFAULT`** authored row via [`selectDefaultSituationCacheRecord`](../../../../../lambda/ephemera/dataSource/renderCache/selectDefaultSituationCacheRecord.ts) for exact match / generation. **Hydrate still runs first** and materializes the **full** facet catalog per component at stack ([**H2**](#hydration-scope-and-timing), [**I3**](#invalidation-events-assets---ephemera)) so non-DEFAULT situations are in Dynamo when Room-scale perception needs them; DEFAULT-only **resolve** does not imply DEFAULT-only **hydrate**. Broader F/K perception (non-DEFAULT situations) remains out of scope for this initiative. |

### Legacy mirroring cleanup

| # | Question | Decision / notes |
| --- | --- | --- |
| L1 | **`exampleEnrichment.ts`:** delete after parity, or keep matchers-only for invalidation emission? | **Decided:** **delete** the module after hydrate + invalidation parity. **Do not** retain **`getParentIdsForSituation`**, **`getOrderedAssetStack`**, **`merge*AcrossStack`**, or **`computePerspectiveMatcherForParentSituation`**. Lift **`situationFacetToCacheShape`** (and Room lens-default helper) into **`mtw-gateways`** [**`componentExamples`**](#componentexamples-gateway---algorithm-a3) ([**A3**](#aggregate-read-surface-cross-lambda)), producing **`AuthoredExample`**. |
| L2 | **Merge order:** legacy **`getOrderedAssetStack`** vs new aggregate / canon stack --- does order matter for players? | **Decided:** **known, intentional product change** --- already analyzed when **`ComponentAggregate`** and canon-stack perception were defined ([`AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md)). **Normative** order for hydrate and resolve: caller-supplied **`mergeParticipationOrder`** / canon stack ([**A2**](#aggregate-read-surface-cross-lambda)), **not** **`getOrderedAssetStack`**. Do **not** treat row diffs vs old mirrored payloads as regressions; parity work validates invalidation + hydrate mechanics, not byte-identical legacy merge order. |
| L3 | **`ExampleAdded`:** ever emitted, or remove from types when mirroring ends? | **Decided:** **remove** from EventBridge / handler types when mirroring ends. Production assets code today emits only **`ExampleUpdated`** / **`ExampleRemoved`**; **`ExampleAdded`** exists for wire compatibility only. |

#### L2 merge order (context)

Legacy mirroring used **`getOrderedAssetStack`** in [`exampleEnrichment.ts`](../../../../../lambda/assets/componentExamples/exampleEnrichment.ts): depth sort on **`_from`** links, with the **event asset** winning equal-depth ties. Perception and **`ComponentAggregate`** instead use an **explicit participation order** --- for rooms, **`resolveCanonAssetStackForRoom`** ([**A2**](#aggregate-read-surface-cross-lambda)). On branched imports those orders **can differ**; that was **decided and analyzed** at aggregate / canon-stack design time ([`AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md)). **Canon stack + aggregate merge is normative** for this initiative. **`getOrderedAssetStack`** is not carried forward; invalidation matchers do not need it after mirroring ends.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets `[X]` when done.

- [X] **Design pass:** resolve [**Open decisions**](#open-decisions) I1--L3, S1--S5, P1--P7
- [X] **Contracts:** draft **`ExampleInvalidated`** per I1/P1 (component-scoped vs Situation-scoped; Situation path uses **`situationId`** not **`exampleId`**); **`AuthoredExample`** / **`AuthoredExampleSet`** in gateways; catalog + adjacency types (**`assetStack`**); invalidation guards; diagnostics finding types (P7)
- [X] **Catalog row schema:** define **`Cache::${perspectiveKey}`** / **`EphemeraCacheCatalogRow`** (incl. **`assetStack`**) in **`mtw.ephemera.renderCache`** (CRUD + conditional bump per M4/V1); migrate **`currentCacheId`** off **`Meta::Room`** (M2)
- [X] **Situation adjacency:** CRUD helpers + hydrate diff maintenance (S4); Situation invalidation handler with layer participation filter (S2/S3)
- [X] **`componentExamples` gateway (`mtw-gateways`):** per [**A3 algorithm**](#componentexamples-gateway---algorithm-a3); **`AuthoredExample`** types; lift helpers from **`exampleEnrichment.ts`**; package tests + parity; [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) ownership row. **`assemble.ts`** shipped (**secondary**); **`factory.ts`** + **`createComponentExamplesCacheHandler`** land with [**Lambda wiring**](#recommended-order) (not a separate public API shape).
- [X] **Lambda wiring (**A1**):** **Diagnostics:** tier-1 **`ComponentData`** + **`ComponentVerticals`**; **`ComponentAggregate`**; **`ComponentExamples`**. **Ephemera:** **`ComponentAggregate`** + **`ComponentExamples`** with slice **`{ ComponentData: internalCache.ComponentData, ... }`** (pair **`getAcrossAssets`** at canon stack); stub **`ComponentVerticals`** if needed for slice shape. Hydrate: **`internalCache.ComponentExamples.get`** only (no **`assembleComponentExamplesAtPerspective`**, no partition enumerate at boundary).
- [X] **Invalidation handler:** in **`mtw.ephemera.renderCache`** (P3) --- component-scoped path (P1 + layer participation); Situation path (S2/S3, P5 cleanup on Removed); diagnostics finding (P7); retire [`componentExamples.ts`](../../../../../lambda/ephemera/dataSource/componentExamples.ts) mirror + Assets reseed
- [X] **Assets emitter:** refactor [`componentExamples/index.ts`](../../../../../lambda/assets/componentExamples/index.ts) to invalidations-only (P1: **`editAssetId`** from event asset); Situation path per S1; drop **`emitSituationComponentFacetEvents`** / **`getParentIdsForSituation`**
- [X] **Hydration step:** **`ensureAuthoredCatalog`** (O1/O2) calls **`internalCache.ComponentExamples.get`** + **diff** put/delete authored rows + catalog ready + coalescing; wire from **`orchestrationHandler`** before **`findRender`**
- [X] **Tests:** gateway golden/parity (**`componentExamples`**); layer participation invalidation (A/B/C overlay); Situation invalidation uses **`situationId`**; adjacency + filter; hydrate diff; hydrate-then-exact-match; diagnostics via gateway
- [ ] **Diagnostics renderCache sweep:** in **`lambda/diagnostics/`** (new module, pattern: **`roomOccupancyDriftSweep`**) --- compare blueprint desired set (**`internalCache.ComponentExamples.get`**) vs Ephemera materialized state (**`ephemeraDB`** catalog + version-gated **`CACHE#`** where needed); emit **`Ephemera RenderCache Finding`** with **`targetCatalogs`** only (no **`perspective`** / **`roomIds`**). Manual emission docs for sandbox until scheduled.
- [ ] **Docs:** update [`renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) (**Mirroring vs runtime**), [`componentExamples/AGENT.md`](../../../../../lambda/assets/componentExamples/AGENT.md), [`AGENT.event.md`](../../../../../lambda/assets/AGENT.event.md); trim stale Example-filter prose
- [ ] **Dispose this plan** per [`taskPlanning/AGENT.md`](../../../../AGENT.md)

---

## Verification

Record exact commands as slices land. Baseline (before implementation):

```bash
cd lambda/ephemera && npm test -- --testPathPattern=renderCache
cd lambda/ephemera && npm test -- --testPathPattern=componentExamples
cd lambda/assets && npm test -- --testPathPattern=componentExamples
cd packages/mtw-gateways && npm test -- --testPathPattern=aggregate
cd packages/mtw-gateways && npm test -- --testPathPattern=componentExamples
```

**Contracts slice (landed):**

```bash
cd packages/mtw-interfaces && npm test -- --testPathPattern=componentExamples
cd packages/mtw-gateways && npm test -- --testPathPattern=componentExamples
cd lambda/ephemera && npm test -- --testPathPattern='renderCache/(baseClasses|catalogGuards|subscribedEvents)'
```

**Catalog + adjacency slice (landed):**

```bash
cd lambda/ephemera && npm test -- --testPathPattern='renderCache/(catalogRow|situationAdjacency|handleExampleInvalidated|perspectivePointer|catalogGuards)'
cd lambda/ephemera && npm test -- --testPathPattern='requestIntake|fanOutStateChangedToPassiveRenders'
```

**componentExamples gateway slice (landed):**

```bash
cd packages/mtw-gateways && npm test -- --testPathPattern=componentExamples
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
```

Gateway slice files: [`enrichment.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/enrichment.ts), [`perspectives.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/perspectives.ts), [`assemble.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/assemble.ts).

**Gateway correction (aggregate-only discovery):** An initial implementation used unmerged **`getAuthoritative`** / partition pre-scan to build one **`aggregate.get`** batch. Corrected to A3: merged-host discovery via **`aggregate.get([host])`**, then **`aggregate.get([situations, lens?])`** without repeating host. Tests: same **`componentExamples`** pattern as above.

Contract files: [`packages/mtw-interfaces/ts/eventBridge/assets/componentExamples.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/assets/componentExamples.ts); [`packages/mtw-gateways/ts/assets/components/componentExamples/`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/); [`lambda/ephemera/dataSource/renderCache/baseClasses.ts`](../../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts), [`catalogGuards.ts`](../../../../../lambda/ephemera/dataSource/renderCache/catalogGuards.ts), [`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/renderCache/subscribedEvents.ts); diagnostics finding: [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts).

Catalog/adjacency slice files: [`catalogRow.ts`](../../../../../lambda/ephemera/dataSource/renderCache/catalogRow.ts), [`situationAdjacency.ts`](../../../../../lambda/ephemera/dataSource/renderCache/situationAdjacency.ts), [`perspectivePointer.ts`](../../../../../lambda/ephemera/dataSource/renderCache/perspectivePointer.ts), [`handleExampleInvalidated.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts). P7: [`handleRenderCacheFinding.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderCacheFinding.ts).

**Lambda wiring slice (A1, landed):**

```bash
cd packages/mtw-gateways && npm test -- --testPathPattern=componentExamples
npx tsc --build packages/mtw-gateways/tsconfig.ref.json
cd lambda/ephemera && npm test -- --testPathPattern=internalCache
cd lambda/diagnostics && npm test -- --testPathPattern=internalCache
cd lambda/assets && npm test -- --testPathPattern=componentAggregate
```

A1 files: [`factory.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/factory.ts), [`keys.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/keys.ts); [`lambda/ephemera/internalCache/index.ts`](../../../../../lambda/ephemera/internalCache/index.ts), [`lambda/diagnostics/internalCache/index.ts`](../../../../../lambda/diagnostics/internalCache/index.ts).

**Invalidation handler slice (landed):** P7 contract tightened in follow-up --- **`targetCatalogs`** on wire; Ephemera receive-only bump (no blueprint scan).

```bash
cd packages/mtw-interfaces && npm test -- --testPathPattern=diagnostics
cd lambda/ephemera && npm test -- --testPathPattern='renderCache/(handleRenderCacheFinding|handleExampleInvalidated|index|subscribedEvents)'
cd lambda/assets && npm test -- --testPathPattern='dataSource/index'
```

Slice files: [`handleRenderCacheFinding.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderCacheFinding.ts); removed [`lambda/ephemera/dataSource/componentExamples.ts`](../../../../../lambda/ephemera/dataSource/componentExamples.ts), [`lambda/assets/componentExamples/reseedFromDiagnostics.ts`](../../../../../lambda/assets/componentExamples/reseedFromDiagnostics.ts), [`resolveDiagnosticTargetRooms.ts`](../../../../../lambda/ephemera/dataSource/renderCache/resolveDiagnosticTargetRooms.ts) (superseded by publisher-owned **`targetCatalogs`**).

**Assets invalidation-only emitter slice (landed):**

```bash
cd lambda/assets && npm test -- --testPathPattern=componentExamples
cd lambda/assets && npm test -- --testPathPattern=componentAggregate.mergeParity
cd packages/mtw-interfaces && npm test -- --testPathPattern=componentExamples
cd lambda/ephemera && npm test -- --testPathPattern='renderCache/(handleExampleInvalidated|index|subscribedEvents)'
```

Slice files: [`lambda/assets/componentExamples/index.ts`](../../../../../lambda/assets/componentExamples/index.ts) (invalidation-only); removed [`exampleEnrichment.ts`](../../../../../lambda/assets/componentExamples/exampleEnrichment.ts), [`loadAuthoritativeForMirroring.ts`](../../../../../lambda/assets/componentExamples/loadAuthoritativeForMirroring.ts); [`legacyMergeAcrossStack.ts`](../../../../../lambda/assets/componentExamples/legacyMergeAcrossStack.ts) (parity tests only). Dropped **Component Republished** subscription (I4).

**Hydration step slice (landed):**

```bash
cd lambda/ephemera && npm test -- --testPathPattern='renderCache/(ensureAuthoredCatalog|hydrateAuthoredCatalog|catalogRow|putCacheRecord)|internalCache/renderCache|orchestrationHandler|findRender'
cd lambda/ephemera && npm test -- --testPathPattern=renderCache
```

Slice files: [`ensureAuthoredCatalog.ts`](../../../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts), [`hydrateAuthoredCatalogDiff.ts`](../../../../../lambda/ephemera/dataSource/renderCache/hydrateAuthoredCatalogDiff.ts), [`authoredExampleToCacheRecord.ts`](../../../../../lambda/ephemera/dataSource/renderCache/authoredExampleToCacheRecord.ts), [`singleFlightAuthoredCatalogHydrate.ts`](../../../../../lambda/ephemera/dataSource/renderCache/singleFlightAuthoredCatalogHydrate.ts); [`catalogRow.ts`](../../../../../lambda/ephemera/dataSource/renderCache/catalogRow.ts) (`markCatalogHydratedAtVersion`); [`putCacheRecord.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.ts) (`catalogVersion`); version-gated [`internalCache/renderCache.ts`](../../../../../lambda/ephemera/internalCache/renderCache.ts) `getExactMatch`; [`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) pointer gate; [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) preflight wire.

**Tests slice (landed):**

```bash
cd packages/mtw-gateways && npm test -- --testPathPattern=componentExamples
cd packages/mtw-interfaces && npm test -- --testPathPattern=componentExamples
cd lambda/assets && npm test -- --testPathPattern=componentExamples
cd lambda/ephemera && npm test -- --testPathPattern='renderCache/(handleExampleInvalidated|hydrateAuthoredCatalogDiff|authoredCatalogHydrateExactMatch|index)'
cd lambda/ephemera && npm test -- --testPathPattern='internalCache/(renderCache|componentAggregate)'
cd lambda/diagnostics && npm test -- --testPathPattern=internalCache
cd lambda/ephemera && npm test -- --testPathPattern=renderCache
```

Coverage highlights:

- **Gateway parity:** [`factory.test.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/factory.test.ts) (`handler.get` vs `assemble`); shared fixture [`fixtures/twoLayerRoom.ts`](../../../../../packages/mtw-gateways/ts/assets/components/componentExamples/fixtures/twoLayerRoom.ts).
- **Layer participation (A/B/C):** [`handleExampleInvalidated.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.test.ts) component-scoped + Situation adjacency three-link filter.
- **`situationId` wire:** [`componentExamples.test.ts`](../../../../../packages/mtw-interfaces/ts/eventBridge/assets/componentExamples.test.ts); [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts) situation-scoped dispatch.
- **Hydrate diff:** extended [`hydrateAuthoredCatalogDiff.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/hydrateAuthoredCatalogDiff.test.ts) (perspective isolation, version-guard delete skip, multi-slice adjacency).
- **Hydrate-then-exact-match:** [`authoredCatalogHydrateExactMatch.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/authoredCatalogHydrateExactMatch.test.ts) (`ensureAuthoredCatalog` -> versioned `CACHE#` -> `RenderCacheData.getExactMatch`).
- **Diagnostics via gateway:** [`lambda/diagnostics/internalCache/internalCache.test.ts`](../../../../../lambda/diagnostics/internalCache/internalCache.test.ts) (`ComponentExamples.get` assembles from blueprint).

---

## Related docs

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | Steady-state render cache DataSource |
| [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | Orchestration <-> renderCache contract |
| [`lambda/ephemera/AGENT.caching.planning.md`](../../../../../lambda/ephemera/AGENT.caching.planning.md) | Caching system narrative |
| [`taskPlanning/lambda/assets/AGENT.componentAggregate.planning.md`](../../../assets/AGENT.componentAggregate.planning.md) | Merged component assembly initiative |
| [`packages/mtw-gateways/AGENT.md`](../../../../../packages/mtw-gateways/AGENT.md) | Gateway layout; add **`componentExamples`** ( **`AuthoredExample`** assembly) to ownership table when shipped |
| [`lambda/assets/componentExamples/AGENT.md`](../../../../../lambda/assets/componentExamples/AGENT.md) | Current mirroring data source |

---

## Out of scope (unless explicitly pulled in)

- **Constellation** search (Guidance-distance vectors) and **sample** assembly policy for generation (future; see [**Sample vs constellation**](#sample-vs-constellation-generation--search-vocabulary)).
- Renaming **`mtw.assets.componentExamples`** or **`mtw.ephemera.examples`** (naming cleanup is separate).
- Phase 2 **`mtw.assets.components.aggregate`** streaming DataSource (invalidation mesh from aggregate initiative).
- Replacing LLM generation or pass-through **`Render Generated`** ownership.
