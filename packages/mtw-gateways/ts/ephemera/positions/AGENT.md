# Positions read surfaces (`ts/ephemera/positions`)

Play position graph read handler for ephemera. **Authoritative writer:** [`lambda/ephemera/dataSource/positions/membership/`](../../../../lambda/ephemera/dataSource/positions/membership/) membership persistence API.

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createPositionsCacheHandler(ephemeraDB)`** / **`PositionsCacheHandler`** --- register on Ephemera **`internalCache.Positions`**. |
| **Secondary** | **`getRoomActiveCharactersFromDynamo`**, **`getRoomPositionGraphFromDynamo`**, **`queryMembershipContainersFromDynamo`**, **`projectRoomGraphFromActiveCharacters`**, **`projectRoomGraphFromStoredPositionGraph`**, **`projectCharacterGraphFromRoomEndpoint`** in [`fetch.ts`](fetch.ts) / [`project.ts`](project.ts) / [`adjacency.ts`](adjacency.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.Positions`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/positions`.

## Slice 2 backing (shipped)

| Operation | Question | Backing |
| --- | --- | --- |
| **`getPositionGraph(roomId)`** | What does this room **contain**? | Stored `Meta::Room.positionGraph` + transitional `activeCharacters` roster meta; bootstrap from `activeCharacters` when graph absent |
| **`getPositionGraph(characterId)`** | What does this character **contain**? (inventory) | **Stub:** empty `{ nodes: [], edges: [] }` --- no Dynamo read |
| **`getMembershipContainers(characterId)`** | Which room hosts **contain** this character? | Adjacency index (**S2-5**); transitional fallback to `Meta::Character.RoomId` when adjacency empty (**S2-2** until **S2-6**) |

Handler API unchanged from slice 1c. Read fallbacks retire at initiative close (**S2-6**).

## Storage schema (slice 2; types landed)

Play membership persistence converges on two authoritative structures (**S2-5**). **Conflict policy:** stored **`positionGraph` wins**; adjacency is kept in sync at persist and repaired from graph on mismatch.

### Forward: `Meta::Room.positionGraph`

| Field | Shape |
| --- | --- |
| **`positionGraph.nodes`** | Character membership nodes only (slice 2 v1). Each node: `{ tag: 'Character', universalKey: EphemeraCharacterId }` --- play identity only; no asset-local `key`. |
| **`positionGraph.edges`** | Absent or `[]` until in-room edges land (slice 5+). |

**Types:** [`EphemeraPlayPositionGraph`](../../../../mtw-interfaces/ts/ephemeraMeta.ts) on [`EphemeraMetaRoom`](../../../../mtw-interfaces/ts/ephemeraMeta.ts).

**Topology only:** roster display fields (`DisplayName`, `SessionIds`, ...) stay on **`activeCharacters`** during transitional dual-write (**S2-2** until **S2-6**). Gateway compose: **`projectRoomGraphFromStoredPositionGraph(stored, activeCharacters?)`** merges stored nodes + legacy roster meta for **`getRoomRoster`**.

**Read helper:** **`getRoomPositionGraphFromDynamo`** in [`fetch.ts`](fetch.ts).

### Reverse: membership adjacency index

| Key | Value |
| --- | --- |
| **PK (`EphemeraId`)** | Contained component --- slice 2 v1: `CHARACTER#...` |
| **SK (`DataCategory`)** | `POSITION#${hostEphemeraId}` --- e.g. `POSITION#ROOM#cafe` |

One row per host container. Multi-container drift (character in rooms A and C) yields two rows under the same PK.

**Types + key builders:** [`ephemeraPositionAdjacency.ts`](../../../../mtw-interfaces/ts/ephemeraPositionAdjacency.ts).

**Query helper:** **`queryMembershipContainersFromDynamo`** in [`adjacency.ts`](adjacency.ts) --- `begins_with(DataCategory, 'POSITION#')` on character PK; parse SK to `EphemeraRoomId[]`.

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
