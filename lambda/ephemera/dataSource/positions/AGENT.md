# `mtw.ephemera.positions`

Ephemera lane for **positions in play** --- runtime truth about where entities are and how they relate in the game world. `dataSourceKey: 'mtw.ephemera.positions'`, registered from [`../../app.ts`](../../app.ts).

Play membership authority is **`Meta::Room.ludicGraph`** + adjacency index --- the legacy **`activeCharacters`** / **`RoomId`** projections are not truth and are no longer written. Roster display hydrates at read time; occupancy drift is repaired by a diagnostics sweep. See [Room play graph + adjacency reverse index](AGENT.concepts.md#room-play-graph--adjacency-reverse-index).

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.ludicNetwork.md**](AGENT.ludicNetwork.md) | **Read first.** One-pass orientation to the play-time world model --- per-host sharding, ports and external addressing, multi-host containment, presence as a cover, `ludicCache` --- in present tense with one running example |
| [**AGENT.concepts.md**](AGENT.concepts.md) | Mental models, with their reasoning and history: room membership, **eviction ladder**, [**wholes, parts, and ports**](AGENT.concepts.md#wholes-parts-and-ports), [**presence as a cover**](AGENT.concepts.md#presence-as-a-cover), [**graph roles**](AGENT.concepts.md#graph-roles-shared-shape-different-authority) (manipulation vs presentation) |
| [**AGENT.contract.md**](AGENT.contract.md) | Normative rules enforced **today** |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Code map for this folder |
| [**manipulation/AGENT.md**](manipulation/AGENT.md) | Manipulation kernel + shared adapter spec (membership transfer persist) |
| [**AGENT.navigation.md**](AGENT.navigation.md) | Cross-area links (topology, actions, objects, perception) |

## Non-goals (this package entry)

- Area **authored** exit topology and `projectRoomExits` (see [**AGENT.navigation.md**](AGENT.navigation.md)).
- Session-scoped RoomHeader bootstrap (`Character Registered` path in [`../../AGENT.md`](../../AGENT.md)).
- WML map **Position facet** x/y authoring ([`taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md`](../../../../taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)).
