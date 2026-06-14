# Positions read surfaces (`ts/ephemera/positions`)

Play position graph read handler for ephemera. **Authoritative writer:** [`lambda/ephemera/dataSource/positions/membership/`](../../../../lambda/ephemera/dataSource/positions/membership/) membership persistence API.

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createPositionsCacheHandler(ephemeraDB)`** / **`PositionsCacheHandler`** --- register on Ephemera **`internalCache.Positions`**. |
| **Secondary** | **`getRoomActiveCharactersFromDynamo`**, **`projectRoomGraphFromActiveCharacters`** in [`fetch.ts`](fetch.ts) / [`project.ts`](project.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.Positions`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/positions`.

## Slice 1 adapter (flat fields)

- **Room:** `Meta::Room.activeCharacters` -> character **nodes** + `characterRosterMeta`.
- **Character:** `Meta::Character.RoomId` -> single character node + `roomEndpoint`.
- **Slice 2:** swap Dynamo backing to stored `Meta::Room.positionGraph` without changing handler API.

## Handler API ([`factory.ts`](factory.ts))

- **`getPositionGraph(componentId)`** --- Room or Character play graph.
- **`getRoomRoster(roomId)`** --- roster projection for affordance compose.
- **Memo `set`** / **`invalidate`** --- patch in-memory state only; **no Dynamo write-through**.

After membership apply in positions, call memo **`set`** or **`invalidate`** on the same **`internalCache.Positions`** instance.

## Consumers

| Consumer | Read path |
| --- | --- |
| **`AffordanceRoomDeliverable.get`** | Roster via **`getRoomRoster`** (not raw `ephemeraDB.activeCharacters`) |
