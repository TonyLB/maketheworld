# Area topology persisted `referencedBy` (assets lambda) - planning

**Status:** Milestone 2 assets + gateways slice complete. M4 Ephemera consumer not started.

**Parent initiative:** [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (normative **D8-D11**, **D31** --- do not re-decide here).

**Framework:** [`taskPlanning/AGENT.md`](../../AGENT.md)

**Dispose** after M2-M4 assets topology work ships; move steady-state norms into [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md), [`lambda/assets/componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md), and [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md).

---

## Purpose

Deliver the **assets-lambda** half of Milestone 2:

1. **`cacheAsset` / `decacheAsset`** maintain **`referencedBy`** on forward rows **`(targetUniversalKey, ASSET#assetId)`** (**D9 B**, **D10**).
2. **`mtw.assets.componentTopology`** publishes skinny **`TopologyInvalidated`** (**D11**, **D18** assets invalidation).
3. Coordinate **`mtw-gateways`** strip/carry + **`referencedByUnion`** (**D31**) with parent checklist lines 224-227.

**Out of scope (other milestones):** `projectRoomExits` (M3), Ephemera **`affordanceCache`** / **`internalCache.ComponentTopology`** (M4), [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../ephemera/AGENT.areaTopologyExits.planning.md).

---

## Getting Started

1. [`taskPlanning/AGENT.md`](../../AGENT.md) --- task plan conventions.
2. Parent decisions: [`AGENT.areaTopologyExits.planning.md`](../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) (**Persisted referencedBy**, **Caching architecture**).
3. [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) --- diff-driven writes today.
4. [`lambda/assets/componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md) --- derived DataSource invalidation precedent.
5. [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) --- gateway + InternalCache playbook.
6. In-memory inverse semantics: [`packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts`](../../../packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts).

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

## Recommended order

Mark pending `[ ]` and completed `[X]` as each line lands.

- [X] **Child plan** (this file).
- [X] **`PersistedReferencedByEntry`** + **`buildReferencedByPatchesForAsset`** ([`packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts)).
- [X] **`cacheAsset` / `decacheAsset`** inverse writer + tests.
- [X] **`mtw.assets.componentTopology`** scaffold + **`cacheAsset`** emit hook.
- [X] **Gateways D31:** strip in **`fetch.ts`**, **`ComponentPairRow`**, **`getAcrossAssets`**, **`referencedByUnion`** on **`MergedComponentResult`** + tests.
- [ ] **M4 follow-up:** Ephemera **`affordanceCache`** subscribes to **`TopologyInvalidated`**; extend this plan for **`componentTopology`** + M3 pull integration.

---

## Verification

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/integration/standardForm.referencedBy.test.ts

cd lambda/assets
npm test -- --watchAll=false dataSource/caching/cacheAsset.test.ts dataSource/caching/decacheAsset.test.ts
npm test -- --watchAll=false componentTopology/

cd packages/mtw-gateways
npm test -- --watchAll=false ts/assets/components/componentData/
npm test -- --watchAll=false ts/assets/components/aggregate/
```

---

## Progress

| Step | Status |
| --- | --- |
| Child plan | Done |
| referencedBy helper + cacheAsset writer | Done |
| componentTopology DataSource | Done |
| Gateways D31 plumbing | Done |
| Ephemera affordanceCache consumer (M4) | Not started |
