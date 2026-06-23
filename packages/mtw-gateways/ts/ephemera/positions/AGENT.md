# Positions read surfaces (`ts/ephemera/positions`)

Play position graph read handler for ephemera. **Authoritative writer:** [`lambda/ephemera/dataSource/positions/membership/`](../../../../lambda/ephemera/dataSource/positions/membership/) membership persistence API.

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createPositionsCacheHandler(ephemeraDB)`** / **`PositionsCacheHandler`** --- register on Ephemera **`internalCache.Positions`**. |
| **Secondary** | **`getRoomActiveCharactersFromDynamo`**, **`getRoomPositionGraphFromDynamo`**, **`getCharacterPositionGraphFromDynamo`**, **`queryMembershipContainersFromDynamo`**, **`projectComponentGraphFromStoredPositionGraph`** in [`fetch.ts`](fetch.ts) / [`project.ts`](project.ts) / [`adjacency.ts`](adjacency.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.Positions`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/positions`.

## Scope (topology read, not presentation authority)

Mental model: [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority).

| | |
| --- | --- |
| **Is** | Dynamo read + invocation memo for stored membership **topology** and **adjacency**; structural projection to `StandardPositionGraphData` |
| **Is not** | Roster display authority, affordance wire compose, or exit topology (`ComponentTopology` / `AffordanceCache`) |

**`PlayPositionGraph`** is a topology-only type (alias of `StandardPositionGraphData`); see type boundary in [`AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope). Normative read rules: [`AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#read-surface-s1-5-s1-15-slice-2).

Production roster: ephemera **`getRoomCharacterList`** ([`lambda/ephemera/internalCache/hydrateRoomRoster.ts`](../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts)) --- topology from **`internalCache.Positions.getPositionGraph`**, display fields from **`CharacterMeta`** + **`CharacterSessions`**.

## Slice 2 backing (shipped; **S2-6** storage retirement)

| Operation | Question | Backing |
| --- | --- | --- |
| **`getPositionGraph(roomId)`** | What does this room **contain**? | Stored `Meta::Room.positionGraph` topology only; empty graph when absent |
| **`getPositionGraph(characterId)`** | What does this character **contain**? (inventory) | Stored `Meta::Character.positionGraph` topology only; empty graph when absent |
| **`getMembershipContainers(characterId)`** | Which room hosts **contain** this character? | Adjacency index only (**S2-5** / **S2-6**); room hosts only at steady state |
| **`getMembershipContainers(objectId)`** | Which hosts **contain** this object? | Adjacency index only --- `ROOM#` or `CHARACTER#` hosts (**D16** / **I5**) |

Handler API unchanged from slice 1c.

## Storage schema (slice 2; types landed)

Play membership persistence converges on two authoritative structures (**S2-5**). **Conflict policy:** stored **`positionGraph` wins**; adjacency is kept in sync at persist and repaired from graph on mismatch.

### Forward: host `positionGraph` (`Meta::Room`, `Meta::Character`, ...)

| Field | Shape |
| --- | --- |
| **`positionGraph.nodes`** | Membership nodes on the host graph. Room: Character + Object. Character inventory (D16): **Object** only in v1. Character: `{ tag: 'Character', universalKey }`. Object: `{ tag: 'Object', universalKey }` --- play identity only; no asset-local `key`. |
| **`positionGraph.edges`** | Absent or `[]` until in-host / in-room edges land (slice 5+). |

**Types:** [`EphemeraPlayPositionGraph`](../../../../mtw-interfaces/ts/ephemeraMeta.ts) on [`EphemeraMetaRoom`](../../../../mtw-interfaces/ts/ephemeraMeta.ts) and [`EphemeraMetaCharacter`](../../../../mtw-interfaces/ts/ephemeraMeta.ts).

**Topology only on stored graph:** roster display fields (`DisplayName`, `SessionIds`, ...) are **not** merged on gateway forward load (**S2-6-H**). Roster compose is ephemera-only: **`getRoomCharacterList`** hydrates from **`CharacterMeta`** + **`CharacterSessions`** at read time ([`lambda/ephemera/internalCache/hydrateRoomRoster.ts`](../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts)). The package handler exposes topology + adjacency only.

**Read helpers:** **`getRoomPositionGraphFromDynamo`**, **`getCharacterPositionGraphFromDynamo`** in [`fetch.ts`](fetch.ts). Forward load projects via **`projectComponentGraphFromStoredPositionGraph`** ([`project.ts`](project.ts)).

### Reverse: membership adjacency index

| Key | Value |
| --- | --- |
| **PK (`EphemeraId`)** | Contained component --- `CHARACTER#...` or `OBJECT#...` |
| **SK (`DataCategory`)** | `POSITION#${hostEphemeraId}` --- e.g. `POSITION#ROOM#cafe`, `POSITION#CHARACTER#Alpha` (v1 eligible hosts: **`ROOM#`**, **`CHARACTER#`**) |

One row per host container. Multi-container drift (character in rooms A and C) yields two rows under the same PK.

**Types + key builders:** [`ephemeraPositionAdjacency.ts`](../../../../mtw-interfaces/ts/ephemeraPositionAdjacency.ts).

**Query helper:** **`queryMembershipContainersFromDynamo`** in [`adjacency.ts`](adjacency.ts) --- `begins_with(DataCategory, 'POSITION#')` on contained component PK; parse SK to **`EphemeraMembershipHostId[]`**.

Reverse membership reads use **`getMembershipContainers`** only (no `roomEndpoint` on `PlayPositionGraph`; legacy endpoint encoding removed).

## Handler API ([`factory.ts`](factory.ts))

- **`getPositionGraph(componentId)`** --- forward **topology** graph for room or character hosts (Dynamo load + memo).
- **`getMembershipContainers(componentId)`** --- reverse membership for **`CHARACTER#`** or **`OBJECT#`** (**array** of eligible host ids --- **`ROOM#`** and/or **`CHARACTER#`** in v1).
- **Forward memo:** **`set`** / **`invalidate`** on position graphs for room or character hosts (`positionGraphCacheKey`).
- **Reverse memo:** **`setMembershipContainers`** / **`invalidateMembershipContainers`** (`membershipContainersCacheKey`).

All memo APIs patch in-memory state only; **no Dynamo write-through**.

After membership apply in positions, call forward **`set`** / **`invalidate`** for affected rooms and **`setMembershipContainers`** for the character or object on the same **`internalCache.Positions`** instance.

## Consumers

| Consumer | Read path |
| --- | --- |
| **`AffordanceRoomDeliverable.get`** | Roster via ephemera **`getRoomCharacterList`** (hydrated compose; not raw `ephemeraDB.activeCharacters`) |
| **`getRoomExitTargetsForCharacter`** | Reverse via **`getMembershipContainers`** (not `CharacterMeta.RoomId`) |
