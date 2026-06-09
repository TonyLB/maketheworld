# Affordance cache read surfaces (`ts/ephemera/affordanceCache`)

Colocated **`Affordance::${perspectiveKey}`** Dynamo rows under **`ROOM#`**: catalog version metadata + embedded **`ProjectedRoomTopology.exits`** (**D33**). Mirror render-cache handler discipline.

**Authoritative writer:** [`lambda/ephemera/dataSource/affordanceCache/`](../../../../lambda/ephemera/dataSource/affordanceCache/) (**`mtw.ephemera.affordanceCache`** DataSource).

**Steady-state lambda doc:** [`lambda/ephemera/dataSource/affordanceCache/AGENT.md`](../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md).

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md) (**Affordance cache read surfaces**).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createAffordanceCacheCacheHandler(ephemeraDB)`** / **`AffordanceCacheCacheHandler`** --- register on Ephemera **`internalCache.AffordanceCache`** via **`AffordanceCacheData`**. |
| **Secondary** | **`getAffordanceRowFromDynamo`**, **`queryAffordanceRowsForRoom`** in [`fetch.ts`](fetch.ts) --- package tests, tooling, diagnostics. **Do not** wire new lambda steady-state reads to **`fetch`** when **`internalCache.AffordanceCache`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/affordanceCache`.

## Row shape (D33)

One Dynamo item per **`(ROOM#, perspectiveKey)`**:

| Field | Role |
| --- | --- |
| `EphemeraId` | `EphemeraRoomId` |
| `DataCategory` | `Affordance::${perspectiveKey}` (see [`keys.ts`](keys.ts)) |
| `assetStack` | Participation order at hydrate time |
| `catalogVersion` / `hydratedCatalogVersion` | Stale gate (mirror render **`Cache::`**) |
| `topology` | Embedded **`ProjectedRoomTopology`** (`exits` JSON) |

Type guard: **`isAffordanceCacheRow`**. Test factory: **`createAffordanceCacheRow`**.

## Guard semantics ([`guards.ts`](guards.ts))

| Guard | Role |
| --- | --- |
| **`isCatalogRowStale`** | `hydratedCatalogVersion !== catalogVersion` --- hydrate required |
| **`isCatalogRowHydrated`** | Row ready for read/publish |
| **`catalogRowMatchesEditAssetId`** | Invalidation participation (**D35**) --- bump only when **`assetStack`** includes **`editAssetId`** |
| **`shouldPersistAffordanceTopologyAtHydrate`** | Colocated topology write when stale at current epoch (or catalog lags incoming) |
| **`canUpsertAffordanceRowAtHydrate`** | Version-only check (render CACHE# parity); **not** for colocated Affordance:: hydrate |
| **`shouldIncrementCatalogVersionOnInvalidation`** | Catalog bump on **`TopologyInvalidated`** |

## Handler API ([`factory.ts`](factory.ts))

- **`getAffordanceRow(roomId, perspectiveKey)`** --- returns hydrated rows only (`hydratedCatalogVersion === catalogVersion`).
- **`queryAffordanceRows(roomId)`** --- all perspective rows for a room (invalidation queries).
- **Memo `set`** / **`invalidate`** --- patch in-memory state only; **no Dynamo write-through** (writes in lambda DataSource).

After local Dynamo writes in **`mtw.ephemera.affordanceCache`**, call memo **`set`** or **`invalidate`** on the same **`internalCache.AffordanceCache`** instance.

## Consumers

| Consumer | Read path |
| --- | --- |
| **`ensureAffordanceTopology`** | Hydrate preflight; persists rows via DataSource modules |
| **`AffordanceRoomDeliverable.get`** | Compose **`exits`** into ephemeraWire on **`Affordances Pertain`** terminal publish (**D38**) |
| **Nav (D34)** | **`getRoomExitTargetsForCharacter`** --- **`ensureAffordanceTopology`** + **`getAffordanceRow`** (sync bypass; no bus orchestration) |

## Related

- Topology assembly: [`ts/assets/components/componentTopology/`](../assets/components/componentTopology/)
- Steady-state: [`lambda/ephemera/dataSource/affordanceCache/AGENT.md`](../../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md), [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)
