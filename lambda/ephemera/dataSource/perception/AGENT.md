# mtw.ephemera.perception

**Status:** Bus-only, non-replayable `EphemeraDataSource`. Subscribes to **`api.ephemera`** ingress **`Character Perception Requested`** (see [`subscribedEvents.ts`](subscribedEvents.ts) `sendCharacterPerceptionRequested`). **`streamKey`** is the **viewed** character id (`CHARACTER#...`, i.e. `ephemeraId` on the command). `receiveEvents` loads `Meta::Character` and emits **`PublishMessage`** (`characterPerception.ts`); no outbound `mtw.ephemera.perception` stream events yet.

**Task plan:** [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) under `taskPlanning/lambda/ephemera/dataSource/perception/`.

**Related:** Imperative [`perceptionMessage`](../../perception/index.ts) bridges the Character branch through `sendCharacterPerceptionRequested` into this DataSource.
