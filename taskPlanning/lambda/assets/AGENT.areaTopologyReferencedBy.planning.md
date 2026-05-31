# Area topology persisted `referencedBy` (assets lambda) - planning

**Status:** Milestone 2 complete (persistence + assets invalidation DataSource). Milestone 3 gateways pull module complete. Milestone 4 Ephemera consumer not started.

**Parent initiative:** [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (normative **D8-D11**, **D31**, M3 gateway naming --- do not re-decide here).

**Framework:** [`taskPlanning/AGENT.md`](../../AGENT.md)

**Dispose** after M2-M4 assets topology work ships; move steady-state norms into [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md), [`lambda/assets/componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md), and [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

---

## Purpose

**Milestone 2 (done):** assets-lambda persistence and invalidation:

1. **`cacheAsset` / `decacheAsset`** maintain **`referencedBy`** on forward rows **`(targetUniversalKey, ASSET#assetId)`** (**D9 B**, **D10**).
2. **`mtw.assets.componentTopology`** ([`lambda/assets/componentTopology/index.ts`](../../../lambda/assets/componentTopology/index.ts)) publishes skinny **`TopologyInvalidated`** (**D11**, **D18** assets invalidation).
3. **`mtw-gateways`** strip/carry + **`referencedByUnion`** (**D31**) coordinated with parent M2 checklist.

**Milestone 3 (this child plan tracks gateways only):** add compute-only pull assembly under [`packages/mtw-gateways/ts/assets/components/componentTopology/`](../../../packages/mtw-gateways/ts/assets/components/componentTopology/) --- mirror **`componentExamples`** naming ([parent M3 section](../packages/mtw-wml/AGENT.areaTopologyExits.planning.md#gateways-componenttopology-module-m3)).

**Out of scope:** **`projectRoomExits`** implementation home is **`mtw-wml`** (parent M3). Ephemera **`affordanceCache`**, **`internalCache.ComponentTopology`** registration, affordance publish, **D30** (parent M4); [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../ephemera/AGENT.areaTopologyExits.planning.md) (create in M4).

---

## Getting Started

1. [`taskPlanning/AGENT.md`](../../AGENT.md) --- task plan conventions.
2. Parent decisions + M3 gateway layout: [`AGENT.areaTopologyExits.planning.md`](../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (**Persisted referencedBy**, **Caching architecture**, **Gateways componentTopology module (M3)**).
3. [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) --- diff-driven writes.
4. [`lambda/assets/componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md) --- derived DataSource + gateways pull precedent.
5. [`lambda/assets/componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md) --- invalidation DataSource (M2).
6. [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) --- gateway + InternalCache playbook; **Component examples read surfaces** as template for M3 topology module docs.
7. In-memory inverse semantics: [`packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts`](../../../packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts).

**Test command authority:** [`lambda/assets/AGENT.development.md`](../../../lambda/assets/AGENT.development.md) if present; else `cd lambda/assets && npm test`. Gateways: `cd packages/mtw-gateways && npm test`.

---

## Persisted shape (D8-D9)

```typescript
type PersistedReferencedByEntry = {
  referrerUniversalKey: ComponentUUID;
  referenceType?: StandardComponentReferenceKey['referenceType'];
}
```

- Dynamo / JSON field name: **`referencedBy`** (not `referrers`).
- **`assetId` omitted** on entries (colocated on **`(target, ASSET#)`** row).
- **Not** on **`StandardComponent`** / WML (**D31**).

---

## Write algorithm (D10)

**Owner:** **`cacheAsset`** only (v1).

On each cache pass with a component **`diff`**:

1. Run existing **`diff._components`** forward body writes.
2. **Inverse pass:** For every target **`ComponentUUID`** referenced by any component in **`fileAsset`** (union with **`dbAsset`** targets when referrers were removed), recompute:
   - `entries = fileAsset.referencedBy(targetRef)` mapped to **`PersistedReferencedByEntry`** (include **`referenceType`** from referrer **`referencedKeys()`**, e.g. **`Edge`** for Area topology).
3. **`putItem`** onto **`(target, ASSET#)`**:
   - If row exists: merge **`referencedBy`** (replace per-asset list).
   - If row missing and **`entries.length > 0`**: write **minimal stub** forward row (`tag` + **`universalKey`** + **`referencedBy`**) and update **`Meta::${tag}.cached`** (**spike decision: stub required for edge-only targets**).

**`decacheAsset`:** Recompute **`referencedBy`** as **`[]`** for all targets that **`dbAsset`** referenced (full asset decache).

**Invalidation:** Patch targets drive **`ComponentData.invalidate`** and **`emitTopologyInvalidatedForRoomTargets`** for **`ROOM#`** ids (**D11** third path).

---

## Milestone 3 --- gateways `componentTopology/` (naming normative)

Ship under **`packages/mtw-gateways/ts/assets/components/componentTopology/`** (deep import: `@tonylb/mtw-gateways/ts/assets/components/componentTopology`). **Do not** add topology assembly beside **`referencedBy.ts`** in **`componentData`** --- M2 plumbing stays there; M3 only composes **`ComponentAggregate`**.

| Role | Name | Notes |
| --- | --- | --- |
| Cache key | **`componentTopologyPerspectiveCacheKey`** | Same **`computePerspectiveKey(mergeParticipationOrder)`** encoding as aggregate / examples |
| Primary factory | **`createComponentTopologyCacheHandler({ ComponentAggregate })`** | **`ComponentTopologyMergedCache`** in **`factory.ts`** |
| Secondary assemble | **`assembleRoomTopologyAtPerspective`** | **`assemble.ts`** --- tests / parity only |
| Pure projection | **`projectRoomExits`** | **`mtw-wml`** only (parent M3) |
| Result DTO | e.g. projected **`ExitFacetList`** + metadata in **`result.ts`** | Stable output for M4 **`affordanceCache`** hydrate |

**Assembly (no new pair fetch):** **`ComponentAggregate.get(ROOM#)`** -> **`.referencedByUnion`** -> filter **`AREA#`** (**D14**) -> batch Area **`get`** -> **`projectRoomExits`** (**D16**).

**Same PR / milestone:** update **`packages/mtw-gateways/AGENT.md`** ownership table + **Component topology read surfaces (primary vs secondary)** subsection.

---

## Recommended order

Mark pending `[ ]` and completed `[X]` as each line lands.

### Milestone 2 (done)

- [X] **Child plan** (this file).
- [X] **`PersistedReferencedByEntry`** + **`buildReferencedByPatchesForAsset`** ([`packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts)).
- [X] **`cacheAsset` / `decacheAsset`** inverse writer + tests.
- [X] **`mtw.assets.componentTopology`** in [`lambda/assets/componentTopology/index.ts`](../../../lambda/assets/componentTopology/index.ts) + **`cacheAsset`** emit hook.
- [X] **Gateways D31:** strip in **`fetch.ts`**, **`ComponentPairRow`**, **`getAcrossAssets`**, **`referencedByUnion`** on **`MergedComponentResult`** + tests.

### Milestone 3 (gateways pull)

- [X] **`mtw-wml` `projectRoomExits`** + goldens (parent checklist; coordinate test commands).
- [X] Scaffold **`componentTopology/`** module (`ports`, `input`, `result`, `keys`, `assemble`, `factory`, `index`).
- [X] **`assembleRoomTopologyAtPerspective`** + package tests (secondary path).
- [X] **`createComponentTopologyCacheHandler`** + **`componentTopologyPerspectiveCacheKey`** + factory tests (primary path).
- [X] **`packages/mtw-gateways/AGENT.md`** ownership row + read-surfaces subsection.

### Milestone 4 (Ephemera; parent + ephemera child plan)

- [ ] Ephemera register **`internalCache.ComponentTopology`**; **`affordanceCache`** hydrates via **`ComponentTopology.get`** (not uncached **`assemble*`**).
- [ ] Re-run assets **`componentTopology/`** tests if Ephemera wiring exposes integration gaps.

---

## Verification

**M2 (regression):**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/integration/standardForm.referencedBy.test.ts

cd lambda/assets
npm test -- --watchAll=false dataSource/caching/cacheAsset.test.ts dataSource/caching/decacheAsset.test.ts componentTopology/

cd packages/mtw-gateways
npm test -- --watchAll=false ts/assets/components/componentData/
npm test -- --watchAll=false ts/assets/components/aggregate/
```

**M3:**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/projection/projectRoomExits.test.ts

cd packages/mtw-gateways
npm test -- --watchAll=false ts/assets/components/componentTopology/
```

---

## Progress

| Step | Status |
| --- | --- |
| Child plan | Done |
| referencedBy helper + cacheAsset writer | Done |
| Assets `mtw.assets.componentTopology` DataSource | Done |
| Gateways D31 plumbing | Done |
| Gateways `componentTopology/` pull module (M3) | Done |
| Ephemera `ComponentTopology` + `affordanceCache` (M4) | Not started |
