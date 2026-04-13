# Component stack merge cache (`componentStackMerge.ts`)

**Status:** Active --- public API defined; implementation not started.

**Framework:** Executable task plan per [`taskPlanning/AGENT.md`](../../../AGENT.md) (status, **Getting Started**, **Progress**, **Recommended order** checkboxes, **Verification**).

**Naming:** Code identifier **`ComponentStackMerge`** (file **`lambda/ephemera/internalCache/componentStackMerge.ts`**). This is **render-agnostic** merge of asset-layer **`Standard*`** components for a room (and, in later slices, other component kinds if needed): same **stack resolution** idea as [`ComponentRender`](../../../../../lambda/ephemera/internalCache/componentRender.ts), **without** **`RenderCache`**, **`Examples`**, or perception **prose** / **`<Render>`** assembly. Aligns with multi-channel **affordance** facts (see [`AGENT.multiChannel.plan.md`](../dataSource/perception/AGENT.multiChannel.plan.md) **WML composition (recipe)**).

---

## Purpose

Introduce a dedicated **internalCache** handler that caches **merged asset-stack room data** derived from:

- **Global** + **character** asset lists (same union pattern as **`ComponentRender`**),
- **`ComponentAssetMeta.getAcrossAssets`** (appearances of the room per asset),
- **`RoomCharacterList`** (or equivalent) for **who is present**,

and applies the **same merge rules** **`ComponentRender`** uses for **exits** (**`ExitFacetList`**), **shortName** merge, and **character id** wiring---**but does not** read **`RenderCache`**, call **`Examples`**, or build **`StandardRoomData.render`** / situation prose.

**Downstream:** Multi-channel **room-affordances** **`PerceptionMessage`** WML and other callers can depend on this cache instead of **`ComponentRender.get`** when they need **structural** room truth only. **`ComponentRender`** may later **delegate** its room **non-prose** assembly to this module to avoid duplication (optional follow-on).

---

## Goals

1. **`internalCache/componentStackMerge.ts`:** A **`ComponentStackMergeData`** (or equivalent) class following existing cache patterns in [`internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) (**DeferredCache**, **`clear`**, **`flush`** as appropriate).
2. **v1 scope:** **Rooms** (`ROOM#...`) only; **cache key** includes **`CharacterId`** (and **`header`** if the merged shape must differ for header vs full---match **`ComponentRender`** key semantics unless analysis shows a simpler key).
3. **Explicit non-dependencies:** Implementation **must not** import or call **`RenderCache`**, **`Examples`**, or the **rendered-content / example-to-`render` payload** path documented in [`componentRender.AGENT.md`](../../../../../lambda/ephemera/internalCache/componentRender.AGENT.md).
4. **Wiring:** Register on [`internalCache`](../../../../../lambda/ephemera/internalCache/index.ts) (**`internalCache.ComponentStackMerge`**), **`InternalCache.clear()`**, and **`flush()`** if the handler uses **`DeferredCache`** async paths.
5. **Tests:** **`componentStackMerge.test.ts`** (or co-located pattern) with mocks per [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); assert merged **exits** / **shortName** / **characters** behavior **matches** the room branch of **`ComponentRender`** for equivalent inputs (golden or shared fixtures where practical).

---

## Non-goals (this task plan)

- **Refactoring** **`ComponentRender`** to call **`ComponentStackMerge`** internally (optional **follow-on** PR; note in **Progress** if done early).
- **Client** or **`PublishMessage`** changes (multi-channel Phase B uses this cache **after** it exists).
- **Non-room** component kinds (Feature, Map, ...) unless a clear v1 requirement appears; document extension points in **`AGENT.md`** when shipped.

---

## Getting Started

Read in order:

1. [`taskPlanning/AGENT.md`](../../../AGENT.md) --- checkbox and durability conventions.
2. [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) --- cache patterns, **`DeferredCache`**, **`clear`** / **`flush`**.
3. [`lambda/ephemera/internalCache/componentRender.ts`](../../../../../lambda/ephemera/internalCache/componentRender.ts) --- room branch of **`_getPromiseFactory`** (asset union, **`ExitFacetList`**, **`StandardRoomData`** fields **before** **`renderPayload`**).
4. [`lambda/ephemera/internalCache/componentAssetMeta.ts`](../../../../../lambda/ephemera/internalCache/componentAssetMeta.ts) --- **`getAcrossAssets`**.
5. [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- Jest, **`internalCache`** injection / mocking.
6. [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../dataSource/perception/AGENT.multiChannel.plan.md) --- **WML composition** and **de-duplication** context (consumer of this cache).

---

## Trace (room, no `renderPayload`)

Source: [`componentRender.ts`](../../../../../lambda/ephemera/internalCache/componentRender.ts) `ComponentRenderData._getPromiseFactory` branch `isEphemeraRoomId(EphemeraId)`. Omit everything that assigns **`renderPayload`** / **`roomRow.render`** (lines using **`RenderCache`**, **`Examples`**, **`cacheRenderedContentToRenderPayload`**, **`standardExampleToRenderPayload`**, **`SituationRoomFacetPayload`**).

1. `Promise.all([ _getAssets(), isEphemeraCharacterId(CharacterId) ? _characterMeta(CharacterId) : { assets: [] } ])` -> `globalAssets`, `{ assets: characterAssets }`.
2. `allAssets = unique(globalAssets || [], characterAssets).map(AssetKey)` (type **`AssetUUID[]`**).
3. `appearancesByAsset = await _componentAssetMeta(EphemeraId, allAssets)` i.e. **`ComponentAssetMetaData.getAcrossAssets(EphemeraId, allAssets)`** -> `Record<AssetUUID, StandardComponent>`.
4. `assetData = allAssets.flatMap((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : []))` cast to **`StandardRoom[]`** (preserves **`allAssets`** order; missing assets contribute nothing).
5. **Stop here for component stack merge** (skip **`_renderCache.get`**, **`_examples`**, **`renderPayload`**, **`SituationRoomFacetPayload.isEmpty`**).
6. `Promise.all([ _roomCharacterList(EphemeraId), exitsSync, shortNameSync ])` where:
   - **exits:** `allExitFacets = assetData.map((asset) => asset.exits.items || []).flat(1)`; `exits = new ExitFacetList(allExitFacets).toJSON()`.
   - **shortName:** `assetData.map((c) => c.shortName).filter(excludeUndefined).reduce<StandardLiteral | undefined>((previous, current) => (previous ? previous.merge(current) : current), undefined)`; use **`shortName?.toJSON()`** on the result for **`StandardRoomData.shortName`**.
7. Build **`StandardRoomData`**: `{ tag: 'Room', universalKey: EphemeraId, ...(exits.length ? { exits } : {}), characters: roomCharacterList.map((char) => char.EphemeraId), shortName: shortName?.toJSON() }` --- **no** **`render`** key.
8. **`characterComponents`:** `roomCharacterList.map` -> **`StandardCharacterData`** per item: `tag: 'Character'`, `universalKey: char.EphemeraId`, `displayName: char.DisplayName ?? undefined`, optional `image` from `char.fileURL` (same shape as existing branch).
9. `return new StandardForm([{ tag: 'Asset', universalKey: 'ASSET#render', key: 'render' }, roomRow, ...characterComponents])`.

Cache key for parity with **`ComponentRender.get`** (room): **`${CharacterId}::${EphemeraId}::${header ? 'true' : 'false'}`** (`generateCacheKey`).

---

## Public API (`ComponentStackMergeData`)

**Module:** [`componentStackMerge.ts`](../../../../../lambda/ephemera/internalCache/componentStackMerge.ts) (to be added).

### `ComponentStackMergeGetOptions`

```ts
type ComponentStackMergeGetOptions = {
    /** Same meaning as `ComponentRender`: included in the cache key only. Room merge output does not depend on this flag today (see `componentRender.ts` room branch). */
    header?: boolean;
};
```

**Not** included: **`priorRenderChain`** --- that exists on **`ComponentRender`** for render-related call paths; the room **`_getPromiseFactory`** does not read it. Component stack merge does not take it.

### `get`

```ts
async get(
    CharacterId: EphemeraCharacterId | 'ANONYMOUS',
    EphemeraRoomId: EphemeraRoomId,
    options?: ComponentStackMergeGetOptions
): Promise<StandardForm>
```

- **Return type:** **`StandardForm`**, same **shape** as **`ComponentRender.get`** for a room: one **`Asset`** root row, one **`StandardRoomData`** row (**no** **`render`** property), then **`StandardCharacterData`** rows for present characters (see **Trace** steps 7--9). Callers may narrow by reading the **`Room`** component from the form if they do not need the wrapper.
- **Cache key:** **`${CharacterId}::${EphemeraRoomId}::${options?.header ? 'true' : 'false'}`** --- identical string format to **`ComponentRender`** [`generateCacheKey`](../../../../../lambda/ephemera/internalCache/componentRender.ts) so keys align for invalidation and mental parity (implementation may **share** a small exported helper or duplicate the one-line template; avoid drift).

### Lifecycle (match sibling **`DeferredCache`** handlers)

- **`clear(): void`** --- drop all entries; wired from **`InternalCache.clear()`**.
- **`async flush(): Promise<void>`** --- await pending **`DeferredCache`** work; wired from **`InternalCache.flush()`** if other handlers flush.

### Constructor (dependency injection)

Same **room** inputs as the trace, **no** **`Examples`** or **`RenderCache`**:

- **`ComponentAssetMetaData`** (for **`getAcrossAssets`**),
- **`CacheRoomCharacterListsData`**,
- **`CacheGlobalData`** (for **`get('assets')`**),
- **`CacheCharacterMetaData`**.

Optional v1 follow-on: **`invalidate(CharacterId, EphemeraRoomId, options?)`** mirroring **`ComponentRender.invalidate`** if tests or callers need targeted eviction; not required for first ship if **`clear()`** is sufficient.

---

## Architecture notes (normative for this slice)

| Topic | Direction |
| --- | --- |
| **Inputs** | Same as **`ComponentRender`** room path: **`Global.get('assets')`**, **`CharacterMeta.get`**, **`ComponentAssetMeta.getAcrossAssets`**, **`RoomCharacterList.get`**. |
| **Out of scope** | **`RenderCache.get`**, **`Examples.get`**, **`cacheRenderedContentToRenderPayload`**, **`standardExampleToRenderPayload`**. |
| **Output shape** | A **`StandardForm`** or **`StandardRoom`** / **`StandardRoomData`**-level structure sufficient for **`schemaToWML`** + **`ephemeraWire`** at call sites---decide in implementation; document return type in **`internalCache/AGENT.md`** when stable. |
| **Invalidation** | Same invalidation story as **`ComponentRender`** for the same key dimensions (room + character); call **`clear()`** from **`InternalCache.clear()`**; document any **narrow** invalidation hooks if added later. |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Design and extraction**

- [X] Trace **`ComponentRender`** room **`_getPromiseFactory`** and list exact steps to replicate **without** prose (**`renderPayload`**). See **Trace (room, no `renderPayload`)** below.
- [X] Define **public API** for **`ComponentStackMergeData`** (**`get(CharacterId, EphemeraRoomId, options?)`**, return type, cache key format). See **Public API (`ComponentStackMergeData`)** above.

**Implementation**

- [ ] Add **`lambda/ephemera/internalCache/componentStackMerge.ts`** implementing **`ComponentStackMergeData`** (or chosen name) with shared merge logic (extract **pure helpers** from **`componentRender.ts`** where duplication would otherwise diverge).
- [ ] Wire **`internalCache/index.ts`**: construct with **`Examples`/`RenderCache` omitted**; **`internalCache.ComponentStackMerge`**; **`clear()`** / **`flush()`**.

**Tests and docs**

- [ ] Add **`componentStackMerge.test.ts`**; parity or regression checks vs **`ComponentRender`** for room merge behavior on controlled mocks.
- [ ] Update **`lambda/ephemera/internalCache/AGENT.md`** with a **Component stack merge** subsection (role, keys, **not** render prose).
- [ ] Link this plan from [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../dataSource/perception/AGENT.multiChannel.plan.md) **WML composition (recipe)** or **Links** when the cache is usable (optional one-line).

**Closeout**

- [ ] Update **Progress** and **Recommended order** in this file; note optional **`ComponentRender`** refactor follow-up.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan (this file) | Done |
| **`componentStackMerge.ts`** + **`InternalCache`** wiring | Not started |
| Tests | Not started |
| **`internalCache/AGENT.md`** | Not started |
| Optional: **`ComponentRender`** delegates to **`ComponentStackMerge`** | Not started |

---

## Verification

From [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md):

```bash
cd lambda/ephemera
npm run test -- --watchAll=false
# Scope while iterating:
# npm run test internalCache/componentStackMerge
```

**Manual / grep checks:**

- **`grep -n ComponentStackMerge lambda/ephemera/internalCache/index.ts`** --- singleton wired.
- **`grep -n RenderCache lambda/ephemera/internalCache/componentStackMerge.ts`** --- should be **empty** (no render-cache coupling).

---

## Links

| Doc / code | Role |
| --- | --- |
| [`internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) | Steady-state cache patterns (update when **`ComponentStackMerge`** ships) |
| [`componentRender.ts`](../../../../../lambda/ephemera/internalCache/componentRender.ts) | Reference merge behavior to match or delegate |
| [`AGENT.multiChannel.plan.md`](../dataSource/perception/AGENT.multiChannel.plan.md) | Multi-channel consumer context |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| File / export | **`componentStackMerge.ts`**, **`ComponentStackMergeData`** (or align name in code to single export style used by sibling caches). |
| **v1** | **Room**-only **`ComponentStackMerge`**; extend kinds later if needed. |
| **Render exclusion** | **No** **`RenderCache`**, **no** **`Examples`**, **no** **`render`** facet assembly in this cache. |
| **`get` return type** | **`Promise<StandardForm>`** (room **`Asset`** + **`StandardRoomData`** without **`render`** + character rows). |
| **Options** | **`ComponentStackMergeGetOptions`**: **`header?: boolean`** only; **no** **`priorRenderChain`**. |
| **Cache key** | **`${CharacterId}::${EphemeraRoomId}::${header ? 'true' : 'false'}`** (same as **`ComponentRender`**). |

---

## When this task plan can retire

After **`ComponentStackMerge`** is merged, tested, documented in **`internalCache/AGENT.md`**, and multi-channel work can cite it: **archive or delete** this plan per [`taskPlanning/AGENT.md`](../../../AGENT.md). If **`ComponentRender`** refactor is deferred, leave a pointer in **`componentRender.AGENT.md`** or a one-line **Related** in **`internalCache/AGENT.md`**.
