# Component examples pipeline (`mtw.assets.componentExamples`)

## Role

Non-replayable Assets data source **[`index.ts`](./index.ts)** subscribes to **`mtw.assets`** **Component Updated** / **Component Removed**, enriches Example-related payloads, and publishes **ExampleAdded** / **ExampleUpdated** / **ExampleRemoved** for Ephemera render-cache mirroring. Event **names** still say **Example** for historical wire compatibility; payloads may carry situation-derived shapes where Room (and Feature/Knowledge) facets participate.

*Feature/Knowledge migration in progress.* Task plan: [`taskPlanning/packages/mtw-wml/standardize/AGENT.featureKnowledgeExamples.planning.md`](../../../taskPlanning/packages/mtw-wml/standardize/AGENT.featureKnowledgeExamples.planning.md).

## Entry filter (`isExampleAssociatedComponent`)

Implemented in **[`exampleAssociatedFilter.ts`](./exampleAssociatedFilter.ts)**:

- **`Example`**: only tag that passes this gate (standalone **`enrichExampleEvent`** path).
- **`Room`** / **`Feature`** / **`Knowledge`** / **`Situation`**: **do not** pass the filter. Situation-facet mirror events are emitted on early branches in **`index.ts`** before the filter runs.

The filter name and **`EXAMPLE_ASSOCIATED_TAGS`** reflect legacy Example-centric wiring. WML now uses **`situations`** facets on parents; a future refactor should redefine what **`componentExamples`** tracks (see file header comment in **`exampleAssociatedFilter.ts`**).

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

**Situation component branch (shipped 2026-05-19):**

- On **Component Updated** / **Removed** for **`tag === 'Situation'`**, **`getParentIdsForSituation`** finds Room / Feature / Knowledge parents with a facet for that **`SITUATION#`**, then emits one event per parent (same payload shape as the parent branch).
- Uses **`mergeSituationAcrossStack`** for merged mark state on the Situation entity.

**Standalone Example path (marks-only interim):**

- **`enrichExampleEvent`** does not perform parent discovery (**`parentIds`** always empty in production).
- **`index.ts`** publishes Example lifecycle events only when **`parentIds`** is non-empty (Ephemera already no-ops otherwise). No F/K prose parent discovery on this path.

## Parent discovery

**[`exampleEnrichment.ts`](./exampleEnrichment.ts)**:

- **`getParentIdsForSituation`**: scans Room / Feature / Knowledge for facets referencing a **`SITUATION#`** id (wired from the Situation branch in **`index.ts`**).
- **`enrichExampleEvent`**: standalone **`EXAMPLE#`** only; does not set **`parentIds`**.

## Related docs

- Assets event mesh overview: **[`../AGENT.event.md`](../AGENT.event.md)** (**mtw.assets.componentExamples**).
- WML model (Room vs Feature/Knowledge): **[`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)**.
- Ephemera render cache: **[`lambda/ephemera/internalCache/componentRender.AGENT.md`](../../ephemera/internalCache/componentRender.AGENT.md)**.
