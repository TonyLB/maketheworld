# Positions read surfaces (`ts/ephemera/positions`)

Play position graph read handler for ephemera. **Authoritative writer:** [`lambda/ephemera/dataSource/positions/membership/`](../../../../lambda/ephemera/dataSource/positions/membership/) membership persistence API.

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createPositionsCacheHandler(ephemeraDB)`** / **`PositionsCacheHandler`** --- register on Ephemera **`internalCache.Positions`**. |
| **Secondary** | **`getRoomActiveCharactersFromDynamo`**, **`projectRoomGraphFromActiveCharacters`**, **`projectCharacterGraphFromRoomEndpoint`** in [`fetch.ts`](fetch.ts) / [`project.ts`](project.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.Positions`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/positions`.

## Slice 1 adapter (flat fields; slice 1c forward/reverse split)

| Operation | Question | Slice 1 backing |
| --- | --- | --- |
| **`getPositionGraph(roomId)`** | What does this room **contain**? | `Meta::Room.activeCharacters` -> character nodes + `characterRosterMeta` |
| **`getPositionGraph(characterId)`** | What does this character **contain**? (inventory) | **Stub:** empty `{ nodes: [], edges: [] }` --- no Dynamo read |
| **`getMembershipContainers(characterId)`** | Which room hosts **contain** this character? | `Meta::Character.RoomId` -> `[]` or `[roomId]` |

**Slice 2:** forward room graph from stored `Meta::Room.positionGraph`; reverse from adjacency index (**S2-5**). Handler API unchanged.

## Handler API ([`factory.ts`](factory.ts))

- **`getPositionGraph(componentId)`** --- Room forward roster graph; Character forward **inventory stub** (empty graph today).
- **`getMembershipContainers(componentId)`** --- reverse membership (**array**; always `EphemeraRoomId[]`).
- **`getRoomRoster(roomId)`** --- roster projection for affordance compose.
- **Forward memo:** **`set`** / **`invalidate`** on room position graphs (`positionGraphCacheKey`).
- **Reverse memo:** **`setMembershipContainers`** / **`invalidateMembershipContainers`** (`membershipContainersCacheKey`).

All memo APIs patch in-memory state only; **no Dynamo write-through**.

After membership apply in positions, call forward **`set`** / **`invalidate`** for affected rooms and **`setMembershipContainers`** for the character on the same **`internalCache.Positions`** instance.

## Consumers

| Consumer | Read path |
| --- | --- |
| **`AffordanceRoomDeliverable.get`** | Roster via **`getRoomRoster`** (not raw `ephemeraDB.activeCharacters`) |
| **`getRoomExitTargetsForCharacter`** | Reverse via **`getMembershipContainers`** (not `CharacterMeta.RoomId`) |
| **`applyCharacterMembershipFlat`** pre-read | Reverse via **`getMembershipContainers`** |
