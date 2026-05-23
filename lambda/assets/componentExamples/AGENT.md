# Component examples pipeline (`mtw.assets.componentExamples`)

## Role

Non-replayable Assets data source **[`index.ts`](./index.ts)** subscribes to **`mtw.assets`** **Component Updated** / **Component Removed**, enriches situation-facet payloads, and publishes **ExampleAdded** / **ExampleUpdated** / **ExampleRemoved** for Ephemera **renderCache** mirroring. Event **names** still say **Example** for historical wire compatibility; payloads use **`situationId`** (Situation uuid), not **`EXAMPLE#`**.

**2026-05-19:** Standalone **`Example`** component handling, **`enrichExampleEvent`**, and **`exampleAssociatedFilter.ts`** were removed. The pipeline is **Situation-facet-only** (Room / Feature / Knowledge parent branches + Situation fan-out).

**Component body reads (partition retirement, done):** Mirroring loads bodies via **[`loadAuthoritativeForMirroring.ts`](./loadAuthoritativeForMirroring.ts)** --- **`authoritativeFromParticipationOrder`** + pair **`internalCache.ComponentData`** at explicit or vertical-derived participation order. **No** partition **`ComponentData.get([universalKey])`** and **no** **`exhaustiveScan`** on these paths. Diagnostics reseed on Ephemera findings is **retired** (handled on **`mtw.ephemera.renderCache`**).

**Pull assembly (on-demand hydrate, target):** Steady-state **`AuthoredExample`** batch assembly lives in **`@tonylb/mtw-gateways/ts/assets/components/componentExamples`**. Lambdas read via **`internalCache.ComponentExamples`** (**`createComponentExamplesCacheHandler({ ComponentAggregate })`** on Ephemera and diagnostics) --- not direct **`assembleComponentExamplesAtPerspective`** in production paths. See [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) and [`renderCache` planning](../../../taskPlanning/lambda/ephemera/dataSource/renderCache/AGENT.onDemandAuthoredExamples.planning.md) (**Consolidation handoff**).

**Mirror pipeline (on-demand retirement, pending):** This DataSource still publishes **`ExampleUpdated`** / **`ExampleRemoved`** with enriched payloads via **[`exampleEnrichment.ts`](./exampleEnrichment.ts)** until the **Assets invalidation-only emitter** slice ships. Ephemera mirror forwarder and diagnostics reseed are **retired**; see on-demand planning.

## Parent branches (Room / Feature / Knowledge)

**[`index.ts`](./index.ts)** **`emitParentSituationFacetEvents`**:

- On **Component Updated** / **Removed** with non-empty **`situations`**, emits one **ExampleUpdated** / **ExampleRemoved** per facet.
- **`exampleId`** = Situation uuid.
- Payload from **`situationFacetToCacheShape`** in **[`exampleEnrichment.ts`](./exampleEnrichment.ts)**.
- F/K perspective matcher: **`computePerspectiveMatcherForParentSituation`**.

## Situation component branch

On **Component Updated** / **Removed** for **`tag === 'Situation'`**, **`getParentIdsForSituation`** finds Room / Feature / Knowledge parents with a facet for that **`SITUATION#`**, then emits one event per parent. Uses **`mergeSituationAcrossStack`** for merged mark state on the Situation entity.

## Parent discovery

**[`exampleEnrichment.ts`](./exampleEnrichment.ts)**:

- **`getParentIdsForSituation`**: scans Room / Feature / Knowledge for facets referencing a **`SITUATION#`** id.
- **`situationFacetToCacheShape`**: maps facet prose to cache **`renderedContent`**.

## Related docs

- Assets event mesh overview: **[`../AGENT.event.md`](../AGENT.event.md)** (**mtw.assets.componentExamples**).
- WML model: **[`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)**.
- Ephemera render cache: **[`lambda/ephemera/internalCache/componentRender.AGENT.md`](../../ephemera/internalCache/componentRender.AGENT.md)**.
