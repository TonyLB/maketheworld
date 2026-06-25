# `mtw.ephemera.positions`

Ephemera lane for **positions in play** --- runtime truth about where entities are and how they relate in the game world. `dataSourceKey: 'mtw.ephemera.positions'`, registered from [`../../app.ts`](../../app.ts).

**Status:** Shipped through slices **0--4** (including Phase 4 **`Object`** graph nodes), initiative **Close** (**S2-6-H** roster hydration, **S2-6** legacy projection storage retirement, **S2-6-DR** occupancy drift repair). Play membership authority: **`Meta::Room.positionGraph`** + adjacency index; roster display hydrates at read time.

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
