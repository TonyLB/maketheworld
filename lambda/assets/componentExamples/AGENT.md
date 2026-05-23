# Component examples pipeline (`mtw.assets.componentExamples`)

## Role

Non-replayable Assets data source **[`index.ts`](./index.ts)** subscribes to **`mtw.assets`** **Component Updated** / **Component Removed** and publishes **`ExampleInvalidated`** (no **`example`** body) for Ephemera **`mtw.ephemera.renderCache`** catalog bumps. Event **names** still say **Example** for historical wire compatibility; invalidation payloads use **`situationId`** or **`componentIds`**, not **`EXAMPLE#`**.

**2026-05-19:** Standalone **`Example`** component handling was removed. The pipeline is **Situation-facet-only** (Room / Feature / Knowledge hosts + Situation entity).

**Push (this DataSource):** invalidation-only --- no blueprint merge, no **`internalCache`** reads on the hot path.

**Pull (hydrate / diagnostics):** **`AuthoredExample`** batch assembly lives in **`@tonylb/mtw-gateways/ts/assets/components/componentExamples`**. Lambdas read via **`internalCache.ComponentExamples`** (**`createComponentExamplesCacheHandler({ ComponentAggregate })`** on Ephemera and diagnostics). See [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) and [`renderCache` planning](../../../taskPlanning/lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md).

## Component-scoped invalidation (Room / Feature / Knowledge)

On **Component Updated** or **Component Removed** for a cache-host component:

- One **`ExampleInvalidated`** per event with **`componentIds: [hostId]`** and **`editAssetId`** (= event asset id / `streamKey`).
- Optional **`affectedSituationIds`** from facet refs on the event component (debug/logging only).
- Ephemera bumps existing **`Cache::${perspectiveKey}`** rows whose **`assetStack`** includes **`editAssetId`** ([layer participation rule](../../../taskPlanning/lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md)).

## Situation-scoped invalidation (Situation entity)

On **Component Updated** or **Component Removed** for **`tag === 'Situation'`**:

- One **`ExampleInvalidated`** with **`situationId`** + **`editAssetId`** (no **`componentIds`**, no blueprint parent scan).
- **Removed:** **`entityRemoved: true`** --- Ephemera bumps all adjacency links and deletes the **`SITUATION#`** partition.
- Orphan Situations (no facet parents in blueprint) still publish; Ephemera no-ops until adjacency exists from hydrate.

## Subscription

**Component Updated** and **Component Removed** only. **`Component Republished`** is not subscribed (diagnostics reseed retired; invalidation matches **Updated** semantics).

## Legacy merge (tests only)

**[`legacyMergeAcrossStack.ts`](./legacyMergeAcrossStack.ts)** retains **`mergeRoomAcrossStack`** for aggregate gateway parity tests only. Do not use in production paths.

## Related docs

- Assets event mesh: **[`../AGENT.event.md`](../AGENT.event.md)** (**mtw.assets.componentExamples**).
- Ephemera render cache: **[`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../ephemera/dataSource/renderCache/AGENT.md)**.
