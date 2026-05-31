# mtw.assets.componentTopology

Non-replayable derived **Assets** DataSource that publishes skinny **`TopologyInvalidated`** events (no projected exit body on the bus).

## Purpose

Notify downstream consumers (planned: **`mtw.ephemera.affordanceCache`**, Milestone 4) when room topology may have changed:

- **Area** `positionGraph` **nodes** / **edges** edits
- **Room** blueprint **`exits`** during **D6** dual-read
- **`referencedBy`** target patches from **`cacheAsset`** (**D10**) on **`ROOM#`** endpoints

## Invalidation sources

| Source | Mechanism |
| --- | --- |
| `mtw.assets` **Component Updated / Removed** | Subscribe; `detectTopologyInvalidations` on **Area** / **Room** |
| `cacheAsset` inverse index | `emitTopologyInvalidatedForRoomTargets` after **`referencedBy`** writes |

## Event shape

See [`packages/mtw-interfaces/ts/eventBridge/assets/componentTopology.ts`](../../../packages/mtw-interfaces/ts/eventBridge/assets/componentTopology.ts).

**v1:** Coarse invalidation --- list affected **`roomIds`**; optional **`areaId`** hint. No **`ExitFacetList`** on the bus.

## Gateways pull (M3)

Steady-state exit projection at a perspective is assembled by **`@tonylb/mtw-gateways/ts/assets/components/componentTopology`**: **`createComponentTopologyCacheHandler({ ComponentAggregate })`** (primary) composes **`ComponentAggregate.get`** + **`projectRoomExits`** in **`mtw-wml`**. Ephemera registers the handler on **`internalCache.ComponentTopology`** in Milestone 4; **`mtw.ephemera.affordanceCache`** hydrates via **`ComponentTopology.get`** on **stale read** ( **`ensureAffordanceTopology`**, not in the invalidation handler). See [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**Component topology read surfaces**) and [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../../taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md).

## Related

- Parent initiative: [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../../../taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md)
- Assets child plan: [`taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md`](../../../taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md)
- Precedent: [`../componentExamples/AGENT.md`](../componentExamples/AGENT.md)
- Persisted inverse index: [`../dataSource/caching/AGENT.diff.md`](../dataSource/caching/AGENT.diff.md)
