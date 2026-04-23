# Component examples pipeline (`mtw.assets.componentExamples`)

## Role

Non-replayable Assets data source **[`index.ts`](./index.ts)** subscribes to **`mtw.assets`** **Component Updated** / **Component Removed**, enriches Example-related payloads, and publishes **ExampleAdded** / **ExampleUpdated** / **ExampleRemoved** for Ephemera render-cache mirroring. Event **names** still say **Example** for historical wire compatibility; payloads may carry situation-derived shapes where Room facets participate in separate flows.

## Entry filter (`isExampleAssociatedComponent`)

Implemented in **[`exampleAssociatedFilter.ts`](./exampleAssociatedFilter.ts)**:

- **`Example`**: always associated.
- **`Feature`** / **`Knowledge`**: associated only when **`examples.payload`** is non-empty.
- **`Room`**: **not** Example-associated at this gate. Room display prose is **Situation** facets and ephemera **`render`**, not Room-owned **`examples`** lists. **`Room`** **Component Updated** events do **not** enter this pipeline (see **[`index.test.ts`](./index.test.ts)**).

## Parent discovery (`enrichExampleEvent`)

**[`exampleEnrichment.ts`](./exampleEnrichment.ts)** resolves **`parentIds`** for Example components by scanning parent **`examples`** reference lists on **Feature** and **Knowledge** only. It does **not** infer room parents from **`Room.examples`** (removed from the standardized model). **`index.ts`** may still contain situation-related branches for future or alternate entry points; with the current filter, **`Room`** **`Component Updated`** events do not pass **`isExampleAssociatedComponent`** (see **[`index.test.ts`](./index.test.ts)**), so they do not enter this data source or call **`enrichExampleEvent`**.

## Related docs

- Assets event mesh overview: **[`../AGENT.event.md`](../AGENT.event.md)** (**mtw.assets.componentExamples**).
- WML model (Room vs Feature/Knowledge Examples): **[`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)**.
