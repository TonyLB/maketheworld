# `mtw.ephemera.positions`

Ephemera lane for **positions in play** --- runtime truth about where entities are and how they relate in the game world. `dataSourceKey: 'mtw.ephemera.positions'`, registered from [`../../app.ts`](../../app.ts).

**Status:** Slice 0 shipped. Slice **1a** (membership persistence boundary), slice **1b** (`Character Moved` fact stream), slice **1c** (gateway forward/reverse reads, **S1-15**), and slice **1d** (`froms[]` fact contract + fan-in **F2-2**) shipped. Next: slice **2** graph storage swap --- see task plan [**Migration strategy**](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#migration-strategy-routing-first).

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.concepts.md**](AGENT.concepts.md) | Mental models: fractal position graphs, authored vs play, projections (shipped vs target) |
| [**AGENT.contract.md**](AGENT.contract.md) | Normative rules enforced **today** (slice 1d) |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Code map for this folder |
| [**AGENT.navigation.md**](AGENT.navigation.md) | Cross-area links (topology, actions, objects, perception) |

## Task planning

Active initiative: [`taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) (dispose when the initiative completes).

## Non-goals (this package entry)

- Area **authored** exit topology and `projectRoomExits` (see [**AGENT.navigation.md**](AGENT.navigation.md)).
- Session-scoped RoomHeader bootstrap (`Character Registered` path in [`../../AGENT.md`](../../AGENT.md)).
- WML map **Position facet** x/y authoring ([`taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md`](../../../../taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)).
