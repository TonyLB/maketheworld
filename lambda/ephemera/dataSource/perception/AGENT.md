# mtw.ephemera.perception

**Status:** Stub. Bus-only, non-replayable `EphemeraDataSource` with placeholder ingress guard and no-op `receiveEvents` until aggregation and real ingress land.

**Task plan:** [`AGENT.perceptionRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md) under `taskPlanning/lambda/ephemera/dataSource/perception/`.

**Related:** Imperative perception today remains in [`lambda/ephemera/perception/`](../../perception/) (`perceptionMessage`); this DataSource is the new fan-in boundary.
