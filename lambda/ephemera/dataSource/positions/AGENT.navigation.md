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
| [`../../internalCache/AGENT.md`](../../internalCache/AGENT.md) | **Area topology and affordance exits**, `RoomCharacterList` |
| [`../affordanceCache/AGENT.md`](../affordanceCache/AGENT.md) | Hydrated `Affordance::` rows, `topology.exits` |
| [`../actions/AGENT.md`](../actions/AGENT.md) | Parse, `Character Navigate`, movement bridge |
| [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts) | Nav exit resolution (D34 sync) |
| [`../objects/AGENT.md`](../objects/AGENT.md) | `Meta::Room.objects` (flat list v1) |
| [`../perception/AGENT.md`](../perception/AGENT.md) | Terminal `PublishMessage` |
| [`../../moveCharacter/index.ts`](../../moveCharacter/index.ts) | Movement executor (legacy owner) |
| [`../../AGENT.md`](../../AGENT.md) | Lambda overview, session orientation vs presence |

---

## Connections

| Doc | Role |
| --- | --- |
| [`lambda/connections/AGENT.md`](../../../connections/AGENT.md) | Session adjacency authority |
| [`packages/mtw-interfaces/ts/eventBridge/connections/characters`](../../../../packages/mtw-interfaces/ts/eventBridge/connections/characters/index.ts) | `Character Connected` / `Disconnected` payloads |

---

## Task planning

| Doc | Role |
| --- | --- |
| [`taskPlanning/.../AGENT.positionsDataSource.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) | Active initiative checklist |
