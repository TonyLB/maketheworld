# `mtw.ephemera.positions`

Ephemera lane for **positions in play** --- runtime truth about where entities are and how they relate in the game world. `dataSourceKey: 'mtw.ephemera.positions'`, registered from [`../../app.ts`](../../app.ts).

**Status:** Slice 0 shipped (connections presence ingress). Movement cutover and graph-shaped storage are in progress; see task plan below.

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.concepts.md**](AGENT.concepts.md) | Mental models: fractal position graphs, authored vs play, projections (shipped vs target) |
| [**AGENT.contract.md**](AGENT.contract.md) | Normative rules enforced **today** (slice 0) |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Code map for this folder |
| [**AGENT.navigation.md**](AGENT.navigation.md) | Cross-area links (topology, actions, objects, perception) |

## Task planning

Active initiative: [`taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) (dispose when the initiative completes).

## Non-goals (this package entry)

- Area **authored** exit topology and `projectRoomExits` (see [**AGENT.navigation.md**](AGENT.navigation.md)).
- Session-scoped RoomHeader bootstrap (`Character Registered` path in [`../../AGENT.md`](../../AGENT.md)).
- WML map **Position facet** x/y authoring ([`taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md`](../../../../taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)).
