# Positions read surfaces (`ts/ephemera/positions`)

Play ludic graph read handler for ephemera. **Authoritative writers:** positions membership coordinators ([`membership/`](../../../../lambda/ephemera/dataSource/positions/membership/), [`manipulation/membership/`](../../../../lambda/ephemera/dataSource/positions/manipulation/membership/)) via **`applyHostEffects`**; relational edge writers via [`applyHostRelationalPatch`](../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostRelationalPatch.ts) per [Manipulation persist layering](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#manipulation-persist-layering).

**Package index:** [`packages/mtw-gateways/AGENT.md`](../../AGENT.md).

## Primary vs secondary

| Surface | Use |
| --- | --- |
| **Primary** | **`createPositionsCacheHandler(ephemeraDB)`** / **`PositionsCacheHandler`** --- register on Ephemera **`internalCache.Positions`**. |
| **Secondary** | **`getRoomActiveCharactersFromDynamo`**, **`getRoomLudicGraphFromDynamo`**, **`getCharacterLudicGraphFromDynamo`**, **`queryMembershipContainersFromDynamo`**, **`projectComponentGraphFromStoredLudicGraph`** in [`fetch.ts`](fetch.ts) / [`project.ts`](project.ts) / [`adjacency.ts`](adjacency.ts) --- package tests, tooling. **Do not** wire new lambda steady-state reads to raw **`fetch`** when **`internalCache.Positions`** is available. |

Deep import: `@tonylb/mtw-gateways/ts/ephemera/positions`.

## Scope (topology read, not presentation authority)

Mental model: [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority).

| | |
| --- | --- |
| **Is** | Dynamo read + invocation memo for stored membership **topology** and **adjacency**; structural projection to `StandardLudicGraphData` |
| **Is not** | Roster display authority, affordance wire compose, or exit topology (`ComponentTopology` / `AffordanceCache`) |

**`PlayLudicGraph`** is a topology-only type (alias of `StandardLudicGraphData`); see type boundary in [`AGENT.concepts.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#type-boundary-storage-vs-gateway-read-envelope). Normative read rules: [`AGENT.contract.md`](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#read-surface-forward-graph-vs-reverse-containers).

This package owns **read projection** (`PlayLudicGraph`, [`project.ts`](project.ts)); it does **not** own play manipulation simulation. After cache read, ephemera manipulation uses **`EphemeraLudicGraph`** --- see [`lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md`](../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md).

Production roster: ephemera **`getRoomCharacterList`** ([`lambda/ephemera/internalCache/hydrateRoomRoster.ts`](../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts)) --- topology from **`internalCache.Positions.getLudicGraph`**, display fields from **`CharacterMeta`** + **`CharacterSessions`**.

## Stored-graph backing (topology + adjacency)

| Operation | Question | Backing |
| --- | --- | --- |
| **`getLudicGraph(roomId)`** | What does this room **contain**? | Stored `Meta::Room.ludicGraph` topology only; empty graph when absent |
| **`getLudicGraph(characterId)`** | What does this character **contain**? (inventory) | Stored `Meta::Character.ludicGraph` topology only; empty graph when absent |
| **`getLudicGraph(objectId)`** | What does this object **contain**? (MK2, storage only --- no route produces one yet) | Stored `Meta::Object.ludicGraph` topology only; empty graph when absent |
| **`getLudicGraph(featureId)`** | What does this feature **contain**? (MK3, storage only --- no route produces one yet) | Stored `Meta::Feature.ludicGraph` topology only; empty graph when absent |
| **`getMembershipContainers(characterId)`** | Which room hosts **contain** this character? | Adjacency index only; room hosts only at steady state. **Transfer-planning observation** --- manipulation kernel persist **must not** use this for prior discovery ([M1](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#manipulation-persist-layering)). |
| **`getMembershipContainers(objectId)`** | Which hosts **contain** this object? | Adjacency index only --- `ROOM#` or `CHARACTER#` hosts (**D16** / **I5**). Same transfer-planning role as character reverse reads. |

Handler API unchanged from slice 1c.

## Storage schema

Play membership persistence converges on two authoritative structures. **Conflict policy:** stored **`ludicGraph` wins**; adjacency is kept in sync at persist and repaired from graph on mismatch. Persist writers route through [Manipulation persist layering](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#manipulation-persist-layering) (adapter plans membership host transfer; kernel applies graph-grounded **`HostEffect[]`**).

### Forward: host `ludicGraph` (`Meta::Room`, `Meta::Character`, `Meta::Object`, `Meta::Feature`, ...)

| Field | Shape |
| --- | --- |
| **`ludicGraph.nodes`** | Membership nodes on the host graph. Room: Character + Object. Character inventory (D16) / Object hosting (MK2) / Feature hosting (MK3): **Object** only in v1. Character: `{ tag: 'Character', universalKey }`. Object: `{ tag: 'Object', universalKey }` --- play identity only; no asset-local `key`. |
| **`ludicGraph.edges`** | In-host relational edges on room host graphs (`tag: 'Relational'`, BD-2/BD-3); projected on gateway read. Exit edges remain out of scope for v1 room graphs. |

**Types:** [`EphemeraLudicGraphFieldPayload`](../../../../mtw-interfaces/ts/ephemeraMeta.ts) on [`EphemeraMetaRoom`](../../../../mtw-interfaces/ts/ephemeraMeta.ts), [`EphemeraMetaCharacter`](../../../../mtw-interfaces/ts/ephemeraMeta.ts), [`EphemeraMetaObject`](../../../../mtw-interfaces/ts/ephemeraMeta.ts), and [`EphemeraMetaFeature`](../../../../mtw-interfaces/ts/ephemeraMeta.ts). Host-bound manipulation JSON: [`EphemeraLudicGraphData`](../../../../mtw-interfaces/ts/ephemeraMeta.ts).

**Topology only on stored graph:** roster display fields (`DisplayName`, `SessionIds`, ...) are **not** merged on gateway forward load. Roster compose is ephemera-only: **`getRoomCharacterList`** hydrates from **`CharacterMeta`** + **`CharacterSessions`** at read time ([`lambda/ephemera/internalCache/hydrateRoomRoster.ts`](../../../../lambda/ephemera/internalCache/hydrateRoomRoster.ts)). The package handler exposes topology + adjacency only.

**Read helpers:** **`getRoomLudicGraphFromDynamo`**, **`getCharacterLudicGraphFromDynamo`**, **`getObjectLudicGraphFromDynamo`**, **`getFeatureLudicGraphFromDynamo`** in [`fetch.ts`](fetch.ts). Forward load projects via **`projectComponentGraphFromStoredLudicGraph`** ([`project.ts`](project.ts)).

### Reverse: membership adjacency index

| Key | Value |
| --- | --- |
| **PK (`EphemeraId`)** | Contained component --- `CHARACTER#...` or `OBJECT#...` |
| **SK (`DataCategory`)** | `POSITION#${hostEphemeraId}` --- e.g. `POSITION#ROOM#cafe`, `POSITION#CHARACTER#Alpha` (v1 eligible hosts: **`ROOM#`**, **`CHARACTER#`**) |

One row per host container. Multi-container drift (character in rooms A and C) yields two rows under the same PK.

**Types + key builders:** [`ephemeraPositionAdjacency.ts`](../../../../mtw-interfaces/ts/ephemeraPositionAdjacency.ts).

**Query helper:** **`queryMembershipContainersFromDynamo`** in [`adjacency.ts`](adjacency.ts) --- `begins_with(DataCategory, 'POSITION#')` on contained component PK; parse SK to **`EphemeraMembershipHostId[]`**.

Reverse membership reads use **`getMembershipContainers`** only (no `roomEndpoint` on `PlayLudicGraph`; legacy endpoint encoding removed). **Role:** reverse membership and **transfer-planning observation** on coordinator / adapter paths --- not kernel prior discovery ([`AGENT.contract.md` --- Manipulation persist layering](../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#manipulation-persist-layering)).

## Handler API ([`factory.ts`](factory.ts))

- **`getLudicGraph(componentId)`** --- forward **topology** graph for room, character, or object hosts (Dynamo load + memo).
- **`getMembershipContainers(componentId)`** --- reverse membership for **`CHARACTER#`** or **`OBJECT#`** (**array** of eligible host ids --- **`ROOM#`** and/or **`CHARACTER#`** in v1). Transfer-planning / reverse reads only; kernel graph-grounded persist **must not** call this to discover priors.
- **Forward memo:** **`set`** / **`invalidate`** on ludic graphs for room, character, or object hosts (`ludicGraphCacheKey`).
- **Reverse memo:** **`setMembershipContainers`** / **`invalidateMembershipContainers`** (`membershipContainersCacheKey`).

All memo APIs patch in-memory state only; **no Dynamo write-through**.

After membership apply in positions, call forward **`set`** / **`invalidate`** for affected rooms and character hosts (cross-host **`takeHold`** apply seeds both room and character forward memo) and **`setMembershipContainers`** for the character or object on the same **`internalCache.Positions`** instance.

## Consumers

| Consumer | Read path |
| --- | --- |
| **`AffordanceRoomDeliverable.get`** | Roster via ephemera **`getRoomCharacterList`** (hydrated compose; not raw `ephemeraDB.activeCharacters`) |
| **`getRoomExitTargetsForCharacter`** | Reverse via **`getMembershipContainers`** (not `CharacterMeta.RoomId`) |
