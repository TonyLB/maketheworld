# `mtw.ephemera.positions`

Ephemera lane for **positions in play** --- runtime truth about where entities are and how they relate in the game world. `dataSourceKey: 'mtw.ephemera.positions'`, registered from [`../../app.ts`](../../app.ts).

Play membership authority is **`Meta::Room.ludicGraph`** + adjacency index --- the legacy **`activeCharacters`** / **`RoomId`** projections are not truth and are no longer written. Roster display hydrates at read time; occupancy drift is repaired by a diagnostics sweep. See [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index).

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.concepts.md**](AGENT.concepts.md) | Mental models: room membership, **eviction ladder**, fractal graphs, [**graph roles**](AGENT.concepts.md#graph-roles-shared-shape-different-authority) (manipulation vs presentation) |
| [**AGENT.contract.md**](AGENT.contract.md) | Normative rules enforced **today** |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Code map for this folder |
| [**manipulation/AGENT.md**](manipulation/AGENT.md) | Manipulation kernel + shared adapter spec (membership transfer persist) |
| [**AGENT.navigation.md**](AGENT.navigation.md) | Cross-area links (topology, actions, objects, perception) |

## Non-goals (this package entry)

- Area **authored** exit topology and `projectRoomExits` (see [**AGENT.navigation.md**](AGENT.navigation.md)).
- Session-scoped RoomHeader bootstrap (`Character Registered` path in [`../../AGENT.md`](../../AGENT.md)).
- WML map **Position facet** x/y authoring ([`taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md`](../../../../taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)).
