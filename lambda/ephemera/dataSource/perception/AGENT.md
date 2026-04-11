# mtw.ephemera.perception

**Status:** Bus-only, non-replayable `EphemeraDataSource`. Subscribes to **`api.ephemera`** ingress **`Character Perception Requested`** and **`Perception Thread Registered`** (see [`subscribedEvents.ts`](subscribedEvents.ts): `sendCharacterPerceptionRequested`, `sendPerceptionThreadRegistered`). Character path: **`streamKey`** = viewed character id (`CHARACTER#...`); thread registration: **`streamKey`** = **`componentId`**. `receiveEvents` handles Character via `Meta::Character` and **`PublishMessage`** (`characterPerception.ts`); thread registration **`set`**s **`internalCache.PerceptionThreads`** only (no **`PublishMessage`**). No outbound `mtw.ephemera.perception` stream events yet.

**Fan-in aggregation:** In-memory state on **`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](../../internalCache/perceptionThreads.ts); [`InternalCache.clear()`](../../internalCache/index.ts) only, no **`flush()`**). Step 3 foundation shipped; merge/delivery in later task-plan steps. Rationale: [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) **Decisions**.

**Task plan:** [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) under `taskPlanning/lambda/ephemera/dataSource/perception/`.

**Related:** Imperative [`perceptionMessage`](../../perception/index.ts) bridges the Character branch through `sendCharacterPerceptionRequested` into this DataSource.
