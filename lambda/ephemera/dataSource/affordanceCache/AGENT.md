# mtw.ephemera.affordanceCache

## Status

**M4 D30 slice (landed).** Colocated **`Affordance::${perspectiveKey}`** rows, **`ensureAffordanceTopology`** hydrate preflight, **`TopologyInvalidated`** catalog bump, orchestration **`Slice Ready`** -> **`Affordances Pertain`** outbound.

**Initiative:** [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../../../taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md). **Precedent:** [`../renderCache/AGENT.md`](../renderCache/AGENT.md).

## Getting Started

1. **Child plan** --- affordance pipeline diagram and **D33** row shape.
2. **Gateway module** --- [`packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/).
3. **InternalCache** --- [`internalCache/affordanceCache.ts`](../../internalCache/affordanceCache.ts).
4. **Tests** --- `npm test -- --watchAll=false dataSource/affordanceCache/`.

## Row shape (D33)

One Dynamo item per **`(ROOM#, perspectiveKey)`**:

| Field | Role |
| --- | --- |
| `DataCategory` | `Affordance::${perspectiveKey}` |
| `assetStack` | Participation order at hydrate time |
| `catalogVersion` / `hydratedCatalogVersion` | Stale gate (mirror render **`Cache::`**) |
| `topology` | Embedded **`ProjectedRoomTopology`** (`exits` JSON) |

## Layer responsibilities

| Concern | Owner |
| --- | --- |
| Hydrate preflight | **`ensureAffordanceTopology`** (orchestration + future nav **D34**) |
| Pull assembly | **`internalCache.ComponentTopology.get`** inside hydrate leader only |
| Invalidation receive | **`handleTopologyInvalidated`** --- catalog bump only (**D35**); no hydrate |
| Compose reads | **`ComponentStackMerge.get`** via **`internalCache.AffordanceCache.getAffordanceRow`** |
| Terminal publish | **`perception`** on **`Affordances Pertain`** (next slice, **D38**) |

## Subscriptions

- **`mtw.assets.componentTopology` `TopologyInvalidated`**
- **`mtw.ephemera.affordanceOrchestration`** stream outbounds (**`Slice Ready`**, etc.)

## Outbounds

- **`Affordances Pertain`** --- lean routing + full **`affordanceRow`** / **`topology`** for perception terminal compose
- **`Cache Error`** --- slice not ready after orchestration handoff

## Navigation sync (D34, not yet wired)

[`getRoomExitTargetsForCharacter`](../../dataSource/actions/roomExitTargetsForCharacter.ts) will call exported **`ensureAffordanceTopology`**, then read **`exits`** via **`internalCache.AffordanceCache`** --- no **`Affordances Requested`** / publish. Documented limitations: synchronous hydrate, no occupant fan-out, deterministic slice only.
