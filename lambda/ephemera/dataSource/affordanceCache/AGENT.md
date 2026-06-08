# mtw.ephemera.affordanceCache

## Status

**M4 slice (landed).** Colocated **`Affordance::${perspectiveKey}`** rows, **`ensureAffordanceTopology`** hydrate preflight, **`TopologyInvalidated`** catalog bump, orchestration **`Slice Ready`** -> **`Affordances Pertain`** outbound.

**Steady-state docs:** [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md), [`packages/mtw-gateways/ts/assets/components/componentTopology/`](../../../../packages/mtw-gateways/ts/assets/components/componentTopology/), [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md). **Precedent:** [`../renderCache/AGENT.md`](../renderCache/AGENT.md).

## Getting Started

1. **Child plan** --- affordance pipeline diagram and **D33** row shape.
2. **Gateway module** --- [`packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) ([`AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/AGENT.md)).
3. **InternalCache** --- [`internalCache/affordanceCache.ts`](../../internalCache/affordanceCache.ts).
4. **Tests** --- `npm test -- --watchAll=false dataSource/affordanceCache/`.

## Row shape (D33)

One Dynamo item per **`(ROOM#, perspectiveKey)`**:

| Field | Role |
| --- | --- |
| `DataCategory` | `Affordance::${perspectiveKey}` |
| `assetStack` | Participation order at hydrate time |
| `catalogVersion` / `hydratedCatalogVersion` | Stale gate (mirror render **`Cache::`**) |
| `topology` | Embedded **`ProjectedRoomTopology`** --- **`exits`** as **`ExitFacetList`** JSON from **`projectRoomExits`** over merged Area **`positionGraph.edges`** at participation order (via **`ComponentTopology.get`** during hydrate) |

## CloudWatch instrumentation

Catalog hydrate preflight logs structured lines filterable as **`[mtw.ephemera.affordanceCache] catalogHydrate`** (see [`ensureAffordanceTopology.ts`](ensureAffordanceTopology.ts), [`hydrateAffordanceTopology.ts`](hydrateAffordanceTopology.ts), shared [`../catalogHydrateInstrumentation.ts`](../catalogHydrateInstrumentation.ts)). Key **`event`** values: `start`, `catalog_row_loaded`, `skip_ready`, `single_flight_hydrate_start`, `computation_skip_row_missing`, `computation_skip_already_fresh`, `stale_path_*`, `hydrate_row_skip_version_guard`, `hydrate_row_wrote`, `mark_hydrated_catalog_ok` / `mark_hydrated_catalog_no_write`, `retrieval_not_ready`, `complete`, `complete_catalog_not_ready`, `failed`.

## Layer responsibilities

| Concern | Owner |
| --- | --- |
| Hydrate preflight | **`ensureAffordanceTopology`** (orchestration + nav **D34**) |
| Pull assembly | **`internalCache.ComponentTopology.get`** inside hydrate leader only |
| Invalidation receive | **`handleTopologyInvalidated`** --- catalog bump only (**D35**); no hydrate |
| Compose reads | **`ComponentStackMerge.get`** via **`internalCache.AffordanceCache.getAffordanceRow`** |
| Terminal publish | **`perception`** on **`Affordances Pertain`** via [`handleAffordancesPertain`](../perception/handleAffordancesPertain.ts) (**D38**, shipped) |

## Subscriptions

- **`mtw.assets.componentTopology` `TopologyInvalidated`** --- **`subscriptionPriority: 4`** (catalog bump before orchestration topology fan-out at priority 5)
- **`mtw.ephemera.affordanceOrchestration`** stream outbounds (**`Slice Ready`**, etc.)

## Outbounds

- **`Affordances Pertain`** --- lean routing + full **`affordanceRow`** / **`topology`** for perception terminal compose
- **`Cache Error`** --- slice not ready after orchestration handoff

## Navigation sync (D34, shipped)

[`getRoomExitTargetsForCharacter`](../../dataSource/actions/roomExitTargetsForCharacter.ts) calls exported **`ensureAffordanceTopology`**, then reads projected **`exits`** via **`internalCache.AffordanceCache.getAffordanceRow`** --- no **`Affordances Requested`** / publish. Perspective resolution uses **`resolveCharacterRoomPerspectiveForRoom`** (canon-filtered stack, same as orchestration fan-out).

**Accepted v1 limitations:**

1. **Synchronous command path** --- may await hydrate and single-flight (**D36**) in-process.
2. **No affordance publish** --- resolving navigation does not refresh other occupants' affordance headers.
3. **Deterministic slice only** --- future LLM enrichment rows are not consulted for nav.
