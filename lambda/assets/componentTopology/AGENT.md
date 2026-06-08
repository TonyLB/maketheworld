# mtw.assets.componentTopology

Non-replayable derived **Assets** DataSource that publishes skinny **`TopologyInvalidated`** events (no projected exit body on the bus).

## Purpose

Notify downstream consumers when room topology may have changed (**`mtw.ephemera.affordanceCache`** catalog bump + orchestration fan-out, shipped M4):

- **Area** `positionGraph` **nodes** / **edges** edits
- **`referencedBy`** target patches from **`cacheAsset`** (**D10**) on **`ROOM#`** endpoints

## Invalidation sources

| Source | Mechanism |
| --- | --- |
| `mtw.assets` **Component Updated / Removed** | Subscribe; `detectTopologyInvalidations` on **Area** **`positionGraph`** |
| `cacheAsset` first pass | `emitTopologyInvalidatedForRoomTargets` when Edge-type **`referencedBy`** changes on **`ROOM#`** targets in **`diff._components`** |
| `cacheAsset` inverse index (temporary) | Second-pass `emitTopologyInvalidatedForRoomTargets` after **`referencedBy`** writes --- retained until Phase 3 disables the inverse pass |

## Event shape

See [`packages/mtw-interfaces/ts/eventBridge/assets/componentTopology.ts`](../../../packages/mtw-interfaces/ts/eventBridge/assets/componentTopology.ts).

**v1:** Coarse invalidation --- list affected **`roomIds`**; optional **`areaId`** hint. No **`ExitFacetList`** on the bus.

## Gateways pull (M3)

Steady-state exit projection at a perspective is assembled by **`@tonylb/mtw-gateways/ts/assets/components/componentTopology`**: **`createComponentTopologyCacheHandler({ ComponentAggregate })`** (primary) composes **`ComponentAggregate.get`** + **`projectRoomExits`** in **`mtw-wml`**. Ephemera registered the handler on **`internalCache.ComponentTopology`**; **`mtw.ephemera.affordanceCache`** hydrates via **`ComponentTopology.get`** on **stale read** (**`ensureAffordanceTopology`**, not in the invalidation handler). See [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**Component topology read surfaces**) and [`lambda/ephemera/dataSource/affordanceCache/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md).

## Related

- Steady-state topology docs: [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md), [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) (**Area topology and affordance exits**)
- Persisted inverse index: [`../dataSource/caching/AGENT.diff.md`](../dataSource/caching/AGENT.diff.md) (**D10** `referencedBy` pass)
- Precedent: [`../componentExamples/AGENT.md`](../componentExamples/AGENT.md)
- Downstream consumer: [`lambda/ephemera/dataSource/affordanceCache/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md)
