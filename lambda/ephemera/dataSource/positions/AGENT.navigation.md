# Positions --- cross-area navigation

Dense links for how `mtw.ephemera.positions` relates to other systems. Local code map: [`AGENT.implementation.md`](AGENT.implementation.md).

---

## WML / assets (authored topology)

| Doc | Role |
| --- | --- |
| [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md) | Area `positionGraph.edges`, Exit edges, `projectRoomExits` |
| [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) | **StandardArea**, **StandardRoom** |
| [`lambda/assets/componentTopology/AGENT.md`](../../../assets/componentTopology/AGENT.md) | `TopologyInvalidated` publisher |

---

## Ephemera (runtime consumers)

| Doc / path | Role |
| --- | --- |
| [`../AGENT.md`](../AGENT.md) | DataSource index |
| [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md) | **`Positions`** read handler, affordance compose |
| [`../../internalCache/index.ts`](../../internalCache/index.ts) | **`internalCache.Positions`** via **`createPositionsCacheHandler(ephemeraDB)`** (topology + adjacency read) |
| [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts) | Roster **presentation** compose --- see [graph roles](AGENT.concepts.md#graph-roles-shared-shape-different-authority) |
| [`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts) | Affordance WML compose (roster via **`Positions`**, exits via affordance cache) |
| [`../affordanceCache/AGENT.md`](../affordanceCache/AGENT.md) | Hydrated `Affordance::` rows, `topology.exits` |
| [`../actions/AGENT.md`](../actions/AGENT.md) | Parse, `Character Navigate` stream (execution in positions) |
| [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts) | Nav exit resolution (D34 sync) |
| [`../objects/AGENT.md`](../objects/AGENT.md) | `Meta::Room.objects` (flat list v1) |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Terminal `PublishMessage`, membership fan-in intent legs |
| [`index.ts`](index.ts) | Navigate / home execution ingress (`Character Navigate`, `Character Home` -> `executeCharacterNavigate`) |
| [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) | Shared persist + orchestrate helper |
| [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) | Post-persist navigate presentation (S1-13) |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Membership persistence coordinator (slice 1a) |
| [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) | Occupancy drift repair on **`Room Occupancy Drift Finding`** (**S2-6-DR**) |
| [`../../../diagnostics/roomOccupancyDriftSweep/`](../../../diagnostics/roomOccupancyDriftSweep/) | Read-only graph-forward occupancy drift classification; emits **`Room Occupancy Drift Finding`** |
| [`../state/resolveAssetStackForRoom.ts`](../state/resolveAssetStackForRoom.ts) | Room **render** asset stack (not eviction ladder --- see [`AGENT.concepts.md`](AGENT.concepts.md)) |
| [`../../AGENT.md`](../../AGENT.md) | Lambda overview, session orientation vs presence |

---

## Gateways

| Doc / path | Role |
| --- | --- |
| [`packages/mtw-gateways/AGENT.md`](../../../../packages/mtw-gateways/AGENT.md) | Handler factory norms |
| [`packages/mtw-gateways/ts/ephemera/positions/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/positions/AGENT.md) | Membership topology + adjacency read ([graph roles](AGENT.concepts.md#graph-roles-shared-shape-different-authority)) |
| [`packages/mtw-gateways/ts/ephemera/affordanceCache/AGENT.md`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/AGENT.md) | Exits projection on `Affordance::` rows |

## Connections

| Doc | Role |
| --- | --- |
| [`lambda/connections/AGENT.md`](../../../connections/AGENT.md) | Session adjacency authority |
| [`packages/mtw-interfaces/ts/eventBridge/connections/characters`](../../../../packages/mtw-interfaces/ts/eventBridge/connections/characters/index.ts) | `Character Connected` / `Disconnected` payloads |
