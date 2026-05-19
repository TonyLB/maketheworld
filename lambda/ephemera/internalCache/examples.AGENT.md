# Examples cache (retired)

**Status:** **`ExamplesData`** and **[`examples.ts`](./examples.ts)** were removed (2026-05-19).

Feature and Knowledge display prose is served only through **`renderCache`** and **`ComponentRender`** (see **[`componentRender.AGENT.md`](./componentRender.AGENT.md)**). Wire event names **`ExampleAdded`** / **`ExampleUpdated`** / **`ExampleRemoved`** on **`mtw.assets.componentExamples`** are unchanged for compatibility; payloads use **`situationId`**, not **`EXAMPLE#`**.
