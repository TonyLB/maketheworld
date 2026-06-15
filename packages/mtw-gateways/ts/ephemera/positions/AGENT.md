# Positions read surfaces (`ts/ephemera/positions`)

Play position graph read handler for ephemera. **Authoritative writer:** [`lambda/ephemera/dataSource/positions/membership/`](../../../../lambda/ephemera/dataSource/positions/membership/) membership persistence API.

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createPositionsCacheHandler(ephemeraDB)`** / **`PositionsCacheHandler`** --- register on Ephemera **`internalCache.Positions`**. |
| **Secondary** | **`getRoomActiveCharactersFromDynamo`**, **`getRoomPositionGraphFromDynamo`**, **`queryMembershipContainersFromDynamo`**, **`projectRoomGraphFromStoredPositionGraph`** in [`fetch.ts`](fetch.ts) / [`project.ts`](project.ts) / [`adjacency.ts`](adjacency.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.Positions`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/positions`.

## Scope (topology read, not presentation authority)

Mental model: [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority).

| | |
| --- | --- |
| **Is** | Dynamo read + invocation memo for stored membership **topology** and **adjacency**; structural projection to `StandardPositionGraphData` |
| **Is not** | Roster display authority, affordance wire compose, or exit topology (`ComponentTopology` / `AffordanceCache`) |

Production roster: ephemera **`PositionsData.getRoomRoster`** ([`lambda/ephemera/internalCache/positions.ts`](../../../../lambda/ephemera/internalCache/positions.ts)) --- topology from **`getPositionGraph`**, display fields from [`hydrateRoomRoster.ts`](../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts).

## Slice 2 backing (shipped; **S2-6** storage retirement)

| Operation | Question | Backing |
| --- | --- | --- |
| **`getPositionGraph(roomId)`** | What does this room **contain**? | Stored `Meta::Room.positionGraph` topology only; empty graph when absent |
| **`getPositionGraph(characterId)`** | What does this character **contain**? (inventory) | **Stub:** empty `{ nodes: [], edges: [] }` --- no Dynamo read |
| **`getMembershipContainers(characterId)`** | Which room hosts **contain** this character? | Adjacency index only (**S2-5** / **S2-6**) |

Handler API unchanged from slice 1c.

## Storage schema (slice 2; types landed)

Play membership persistence converges on two authoritative structures (**S2-5**). **Conflict policy:** stored **`positionGraph` wins**; adjacency is kept in sync at persist and repaired from graph on mismatch.

### Forward: `Meta::Room.positionGraph`

| Field | Shape |
| --- | --- |
| **`positionGraph.nodes`** | Character membership nodes only (slice 2 v1). Each node: `{ tag: 'Character', universalKey: EphemeraCharacterId }` --- play identity only; no asset-local `key`. |
| **`positionGraph.edges`** | Absent or `[]` until in-room edges land (slice 5+). |

**Types:** [`EphemeraPlayPositionGraph`](../../../../mtw-interfaces/ts/ephemeraMeta.ts) on [`EphemeraMetaRoom`](../../../../mtw-interfaces/ts/ephemeraMeta.ts).

**Topology only on stored graph:** roster display fields (`DisplayName`, `SessionIds`, ...) are **not** merged on gateway forward load (**S2-6-H**). Roster compose is ephemera-only: **`PositionsData.getRoomRoster`** (scheduled for retirement in favor of **`getRoomCharacterList`**) hydrates from **`CharacterMeta`** + **`CharacterSessions`** at read time ([`lambda/ephemera/internalCache/hydrateRoomRoster.ts`](../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts)). The package handler exposes topology + adjacency only.

**Read helper:** **`getRoomPositionGraphFromDynamo`** in [`fetch.ts`](fetch.ts).

### Reverse: membership adjacency index

| Key | Value |
| --- | --- |
| **PK (`EphemeraId`)** | Contained component --- slice 2 v1: `CHARACTER#...` |
| **SK (`DataCategory`)** | `POSITION#${hostEphemeraId}` --- e.g. `POSITION#ROOM#cafe` |

One row per host container. Multi-container drift (character in rooms A and C) yields two rows under the same PK.

**Types + key builders:** [`ephemeraPositionAdjacency.ts`](../../../../mtw-interfaces/ts/ephemeraPositionAdjacency.ts).

**Query helper:** **`queryMembershipContainersFromDynamo`** in [`adjacency.ts`](adjacency.ts) --- `begins_with(DataCategory, 'POSITION#')` on character PK; parse SK to `EphemeraRoomId[]`.

Reverse membership reads use **`getMembershipContainers`** only (no `roomEndpoint` on `PlayPositionGraph`; legacy endpoint encoding removed).

## Handler API ([`factory.ts`](factory.ts))

- **`getPositionGraph(componentId)`** --- Room forward **topology** graph; Character forward **inventory stub** (empty graph today).
- **`getMembershipContainers(componentId)`** --- reverse membership (**array**; always `EphemeraRoomId[]`).
- **Forward memo:** **`set`** / **`invalidate`** on room position graphs (`positionGraphCacheKey`).
- **Reverse memo:** **`setMembershipContainers`** / **`invalidateMembershipContainers`** (`membershipContainersCacheKey`).

All memo APIs patch in-memory state only; **no Dynamo write-through**.

After membership apply in positions, call forward **`set`** / **`invalidate`** for affected rooms and **`setMembershipContainers`** for the character on the same **`internalCache.Positions`** instance.

## Consumers

| Consumer | Read path |
| --- | --- |
| **`AffordanceRoomDeliverable.get`** | Roster via ephemera **`internalCache.Positions.getRoomRoster`** (hydrated compose; not raw `ephemeraDB.activeCharacters`) |
| **`getRoomExitTargetsForCharacter`** | Reverse via **`getMembershipContainers`** (not `CharacterMeta.RoomId`) |
