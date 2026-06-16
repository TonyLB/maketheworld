# Server map runtime (stub)

## Status

**Runtime stub** --- not a DataSource. Server-side map **delivery** is intentionally empty pending a full redesign aligned with area topology and client D3 graph tooling.

**Stub helpers:** [`stub.ts`](stub.ts) (`MAP_SERVER_RENDER_RETIRED`, `emptyMapSnapshotForCharacter`).

## What works today

| Path | Behavior |
| --- | --- |
| **`SubscribeToMaps`** | [`mapSubscription/index.ts`](../../mapSubscription/index.ts) validates session/character and returns `maps: []` per character via `emptyMapSnapshotForCharacter` |
| **`UnsubscribeFromMaps`** | Ack only; no map bookkeeping writes |

## What is retired

| Retired path | Notes |
| --- | --- |
| **`ComponentRender` map branch** | `MAP#` calls throw `MAP_SERVER_RENDER_RETIRED` |
| **`CharacterPossibleMaps`** | Graph-based map discovery removed |
| **Perception `MAP#` -> `EphemeraUpdate` MapUpdate** | No map fanout from imperative perception |
| **Navigate `MapUpdate` publish** | `orchestrateCharacterNavigate` does not emit move-time map updates |

## Intentional no-ops (wire shape preserved)

| Handler | Role |
| --- | --- |
| [`mapUpdate/index.ts`](../../mapUpdate/index.ts) | Bus subscriber retained; handler is a no-op during redesign |
| [`ephemeraUpdate/index.ts`](../../ephemeraUpdate/index.ts) | `MapUpdate` / `MapClear` shape handling retained; character-target map fanout disabled (`mapFanoutSessionsByCharacterId = {}`) |

## What is preserved (out of scope for this stub)

- Wire types in `@tonylb/mtw-interfaces` (`MapDescribeData`, `MapUpdate`, subscribe ack shapes)
- Client MapDThree / workbench map authoring
- Authored `StandardMap` components in WML/assets

## Future redesign

Reactivation requires a new server module (likely a future `mtw.ephemera.maps` DataSource), not restoring deleted `ComponentRender` merge logic or `CharacterPossibleMaps` graph descent. Expect area-topology-aligned projections and explicit perspective handling, similar to affordance cache patterns.

## Related

| Doc | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | DataSource index |
| [`../../internalCache/componentRender.AGENT.md`](../../internalCache/componentRender.AGENT.md) | Room/Message render only |
| [`../../dataSource/positions/AGENT.implementation.md`](../positions/AGENT.implementation.md) | Navigate presentation (no MapUpdate) |
