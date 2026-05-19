# Component examples pipeline (`mtw.assets.componentExamples`)

## Role

Non-replayable Assets data source **[`index.ts`](./index.ts)** subscribes to **`mtw.assets`** **Component Updated** / **Component Removed**, enriches Example-related payloads, and publishes **ExampleAdded** / **ExampleUpdated** / **ExampleRemoved** for Ephemera render-cache mirroring. Event **names** still say **Example** for historical wire compatibility; payloads may carry situation-derived shapes where Room (and eventually Feature/Knowledge) facets participate.

*Feature/Knowledge migration in progress.* Task plan: [`taskPlanning/packages/mtw-wml/standardize/AGENT.featureKnowledgeExamples.planning.md`](../../../taskPlanning/packages/mtw-wml/standardize/AGENT.featureKnowledgeExamples.planning.md).

## Entry filter (`isExampleAssociatedComponent`)

Implemented in **[`exampleAssociatedFilter.ts`](./exampleAssociatedFilter.ts)**:

- **`Example`**: always associated.
- **`Feature`** / **`Knowledge`** (current): associated only when **`examples.payload`** is non-empty.
- **`Feature`** / **`Knowledge`** (target, Phase 2): associated when parent has non-empty **`situations`** facet list (mirror Room gate).
- **`Room`**: **not** Example-associated at this gate. Room display prose is **Situation** facets and ephemera **`render`**, not Room-owned **`examples`** lists. **`Room`** **Component Updated** events do **not** pass **`isExampleAssociatedComponent`** (see **[`index.test.ts`](./index.test.ts)**).

## Room branch (shipped)

**[`index.ts`](./index.ts)** handles **`tag === 'Room'`** before the Example-associated filter:

- On **Component Updated** / **Removed** with non-empty **`situations`**, emits one **ExampleUpdated** / **ExampleRemoved** per facet.
- **`exampleId`** = Situation uuid (not Example uuid).
- Payload from **`situationFacetToCacheShape`** in **[`exampleEnrichment.ts`](./exampleEnrichment.ts)**.

Room events never call **`enrichExampleEvent`** (Example-component path).

## Feature / Knowledge

**Parent branch (shipped 2026-05-18):**

- Early branch in **`index.ts`** (shared **`emitParentSituationFacetEvents`**) for **`tag === 'Feature'`** / **`Knowledge`** before **`isExampleAssociatedComponent`**, same as Room.
- On **Component Updated** / **Removed** with non-empty **`situations`**, emits **ExampleUpdated** / **ExampleRemoved** per facet; **`exampleId`** = Situation uuid; payload via **`situationFacetToCacheShape`** (no lens marks on F/K).
- Perspective matcher: **`computePerspectiveMatcherForParentSituation`** in **`exampleEnrichment.ts`**.

**Still Phase 2 (not this slice):**

- **`exampleAssociatedFilter`** still gates F/K on legacy **`examples.payload`** (parent branch bypasses the filter, like Room).
- **`getExamplesReferenceList`** / **`getParentIdsForExample`** still scan F/K **`examples`** for standalone **Example** component events.
- Retire standalone Example-component discovery for F/K prose once facets own display content (Phase 4).

## Parent discovery (`enrichExampleEvent`)

**[`exampleEnrichment.ts`](./exampleEnrichment.ts)** resolves **`parentIds`** for **Example** components by scanning parent **`examples`** reference lists on **Feature** and **Knowledge** only. It does **not** infer room parents from **`Room.examples`** (removed from the standardized model).

## Related docs

- Assets event mesh overview: **[`../AGENT.event.md`](../AGENT.event.md)** (**mtw.assets.componentExamples**).
- WML model (Room vs Feature/Knowledge): **[`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)**.
- Ephemera render cache: **[`lambda/ephemera/internalCache/componentRender.AGENT.md`](../../ephemera/internalCache/componentRender.AGENT.md)**.
