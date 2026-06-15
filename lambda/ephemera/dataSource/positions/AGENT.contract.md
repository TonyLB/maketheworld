# Positions --- contracts (slice 2)

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Play membership persistence uses **`Meta::Room.positionGraph`** (forward) + **adjacency index** (reverse, **S2-5**) only (**S2-6** shipped). **`Character Moved`** is graph-diff descriptive emission (**F1-8** / **S2-4**). Fact bus shape uses plural **`froms[]`** (fan-in **F2-2**).

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`** on internal bus).
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Scope of authority (manipulation vs presentation)

Mental model: [**Graph roles**](AGENT.concepts.md#graph-roles-shared-shape-different-authority). This section states normative boundaries only.

**Positions must own (play manipulation truth):**

- Membership persist (`Meta::Room.positionGraph`, adjacency index) and eviction ladder (`RoomStack`) bundled with apply per membership sections below.
- **`Character Moved`** descriptive fact stream from graph-diff at persistence apply.
- Gateway topology read backing for stored membership graph and adjacency (see [Read surface](#read-surface-s1-5-s1-15-slice-2)).

**Positions must not own (presentation truth):**

- Roster **display** fields (`DisplayName`, `SessionIds`, `Color`, `fileURL`) as steady-state authority --- hydrate at read time per [Read surface](#read-surface-s1-5-s1-15-slice-2).
- Affordance wire compose (`AffordanceRoomDeliverable`) or exit topology (`projectRoomExits`, `ComponentTopology`, `AffordanceCache`).

**Gateway read envelope:**

- Forward **`getPositionGraph`** **must** return topology only on Dynamo load.
- Optional **`characterRosterMeta`** on **`PlayPositionGraph`** and **`projectRoomGraphFromRosterEntries`** **must** be treated as invocation memo / compose only --- **must not** be written to Dynamo as membership authority.

---

## Membership persistence API (slice 2)

All character **room-membership** mutations for **disconnect**, **navigate**, and **connect** **must** go through [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts).

### Public apply shape (S1-7)

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` --- `null` = out of play (disconnect). **Must not** consume stream / intent `fromRoomId` for persist (**S2-4**).
- **Result:** `{ froms, to, changed }` where `changed` is true iff prior container set differs from end state (`{ targetRoomId }` or `{}` when out of play). **`froms`** is required (same semantics as **`MembershipDiff`** / bus fact).
- **Navigate orchestration bridge (temporary):** [`orchestrateCharacterNavigate`](navigate/orchestrateNavigate.ts) receives full **`froms[]`** from the apply result; **`MapUpdate.previousRoomId`** uses **`froms[0]`** until Phase **3** slims remaining beat fields. Multi-departure leave is fan-in's job (**F2-2**). Leave/arrive world lines are **not** emitted from navigate orchestration (membership fan-in owns them).
- **Graph persist engine:** [`updatePositionGraphs`](membership/updatePositionGraphs.ts) --- end-state apply: pre-read full **`getMembershipContainers`**, remove from every prior container `!== target`, ensure at target; holistic **`MembershipDiff`**.

### Graph apply (S2-4)

- **Must** use pure end-state apply on **`targetRoomId`** only.
- **Must** derive **`MembershipDiff.froms`** from observed prior containers removed (may be **`length > 1`** on drift repair).
- **Must** maintain **`positionGraph`** + adjacency in the same **`transactWrite`** bundle (**S2-6** --- no legacy **`activeCharacters`** / **`RoomId`** membership projection writes).
- On conflict between graph and adjacency, **`positionGraph` wins** (diagnostics repair from graph).

### Membership-changed bundle (S1-11)

When **`MembershipDiff.changed`** is true and persist succeeds, the coordinator **must** run (together or not at all):

1. **`streamMembershipFact`** --- **`Character Moved`** on `mtw.ephemera.positions` (graph-diff **F1-8**).
2. Cache memo for **every** room in **`froms`** and non-null **`to`** (`ComponentEphemeraMeta.invalidate`, `AffordanceRoomDeliverable.invalidate`, `Positions.set` / `Positions.invalidate` when roster snapshot available).
3. `CharacterMeta.invalidate(characterId)`.
4. `RoomUpdate` for each room in **`froms`** and non-null **`to`**.
5. `EphemeraUpdate` `CharacterInPlay` room projection.
6. Record `beatAnchorTime` at apply (Model A / fan-in **F1-4**).

When **`changed`** is false: **must** skip the entire bundle (no fact stream, no cache, no `RoomUpdate`, no `EphemeraUpdate`). This includes eviction-ladder-only updates where room membership endpoint is unchanged (**S1-9**).

**Post-move presentation split (F3-2):** step 4 **`RoomUpdate`** (affordance refresh for all occupants in **`froms`** / **`to`**) is **separate** from mover-only arrival header render (**`characterMove`** PerceptionThread in navigate orchestration). Positions **must not** conflate affordance refresh with header render on the membership API. **Deferred:** positions-stream consumer for generalized **`Object Moved`** affordance refresh.

### Eviction ladder (`RoomStack` storage)

Mental model: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder-shipped). Code map: [`AGENT.implementation.md` --- Eviction ladder](AGENT.implementation.md#eviction-ladder-roomstack-storage).

- **Must not** expose eviction ladder edits on **`MembershipApplyArgs`** --- public apply remains `{ characterId, targetRoomId | null }` only (**S1-9**). Ladder shape is internal to persist / resolution helpers.
- **Legal placement resolution:** trim `RoomStack` to accessible assets; surviving top frame is the proposed `targetRoomId`. **Connect** --- place from nowhere (`froms: []`). **Asset visibility loss** --- relocate from an illegal occupancy when top frame differs from current membership.
- On successful **navigate** membership persist, **`updatePositionGraphs`** **must** update `Meta::Character.RoomStack` in the same character-row transact (ladder maintenance bundled with membership apply).
- On **disconnect**, **`updatePositionGraphs`** **must** purge play membership (`positionGraph`, adjacency) and **must preserve** `RoomStack` (connect resolves legal placement from the retained stack).
- **Must not** emit **`Character Moved`** or run the membership-changed bundle when **only** the eviction ladder changes and the room membership endpoint is unchanged (**S1-9**).
- When asset loss **trim** changes the membership endpoint for an **in-play** character, relocation **must** go through [`repairCharacterLegalPlacement`](membership/repairCharacterLegalPlacement.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts). **Out-of-play** characters (**`getMembershipContainers`** empty): trim **`RoomStack` only** --- **must not** re-insert into play.

### `Character Moved` fact (F1-8 steady state)

- **Must** stream only when **`MembershipDiff.changed`** after successful graph persist (**S1-8**).
- **`froms: EphemeraRoomId[]`** = distinct prior in-play containers removed at apply (`[]` = out of play). **May** emit **`froms.length > 1`** when drift repair scrubs multiple hosts.
- **`to`** = successful apply target (`null` on disconnect).
- **`beatAnchorTime`** = recorded time at persistence apply.
- **Must not** populate **`legalExits`** on emitted facts (**S1-10**).
- **Must not** branch **`streamEvent`** on ingress type (navigate vs disconnect); emission is descriptive from **`MembershipDiff`** only.
- **`streamEvent`** is a **required** coordinator dependency (no in-module fallback). **`receiveEvents`** passes the DataSource instance `streamEvent`.
- Payload contract: [`publishedEvents.ts`](publishedEvents.ts). Fan-in consumer: [`../perception/membershipPresentationFanIn.ts`](../perception/membershipPresentationFanIn.ts) (**F2-2**).

---

## Ingress

### `mtw.connections.characters`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Connected` | [`handleCharacterConnected`](handleConnectionsCharactersPresence.ts) |
| `Character Disconnected` | [`handleCharacterDisconnected`](handleConnectionsCharactersPresence.ts) |

Positions **must not** subscribe to `Character Registered` (session orientation is render + affordance orchestration; see [`../../AGENT.md`](../../AGENT.md)).

### `mtw.ephemera.actions`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Navigate` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| `Character Home` | [`index.ts`](index.ts) `receiveEvents` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |

### `Character Home` (positions-owned)

- **Ingress:** typed **`home`** / **`HomeIntent`** via actions **`Parse Requested`**, trusted home via actions **`Action Assessed`** **`Home`** (`source: 'uiHome'`).
- **Must** trust actions-resolved `toRoomId` (`CharacterMeta.HomeId`) at apply --- no exit topology re-check in positions.
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for home (retired).
- Leave/arrive world copy for home is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); orchestration registers perception threads and map updates only.

### `Character Connected` (positions-owned)

- **Must** resolve `targetRoomId` via [`resolveConnectTargetRoom`](membership/resolveConnectTargetRoom.ts) --- legal placement from nowhere: trim ladder to accessible assets, then top surviving frame (default VORTEX when stack normalizes empty).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId })` then post-persist orchestration when `changed`.
- **Must not** publish `CheckLocation` or perform inline membership Dynamo writes outside [`membership/`](membership/).
- **Idempotency:** duplicate connect when already in target room (`changed: false`) **must** be a no-op (no bundle, no orchestration).
- Arrive world-line copy for connect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); connect orchestration does not publish imperative leave/arrive world lines.

### `Character Disconnected` (positions-owned)

- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: null })` --- purges play membership; **must not** clear `RoomStack` (connect re-resolves legal placement from retained ladder).
- **Must not** perform inline membership writes outside [`membership/`](membership/).
- **Idempotency:** duplicate disconnect when already out of play (`changed: false`) **must** be a no-op (no bundle).
- World-line copy for disconnect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); no imperative `PublishMessage` in the handler.

### `Character Navigate` (positions-owned)

- **Ingress:** typed commands via actions **`Parse Requested`**, UI exit clicks via actions **`Action Assessed`** **`Navigation`** (same execution contract).
- **Must** trust actions-validated `toRoomId` at apply (S1-1 --- no topology re-check in positions).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` bus messages from actions for parse-based or UI-exit navigation (retired).
- Leave/arrive world copy for navigate is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); orchestration registers perception threads and map updates only.

### `mtw.diagnostics` --- occupancy drift repair (S2-6-DR)

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Room Occupancy Drift Finding` | [`index.ts`](index.ts) `receiveEvents` -> [`repairRoomOccupancyDrift`](membership/repairRoomOccupancyDrift.ts) |

**Repair model (graph-forward):**

- Enumerate character nodes on the room **`positionGraph`**; **must not** use **`Meta::Character.RoomId`** or **`Meta::Room.activeCharacters`** as authority.
- **Sessions gate:** no live sessions -> **`applyCharacterRoomMembership({ characterId, targetRoomId: null })`** (full graph purge; S1-11 when `changed`).
- **In-play, adjacency lag:** graph correct but **`getMembershipContainers`** omits this room -> [`syncMembershipAdjacencyToRoom`](membership/syncMembershipAdjacency.ts) only (**must not** run S1-11 bundle).
- **Idempotency:** at-least-once finding delivery **must** be safe (no-op when already repaired).
- **Explicit gap:** stale adjacency without a graph node is out of scope for this room-forward scan.

Sweep (read-only classification): [`../../../diagnostics/roomOccupancyDriftSweep/`](../../../diagnostics/roomOccupancyDriftSweep/).

---

## Read surface (S1-5, S1-15 slice 2)

- Steady-state roster reads for **affordance compose** **must** use **`internalCache.Positions.getRoomRoster`**, not raw `ephemeraDB` `activeCharacters` in the compose path.
- **`getRoomCharacterList`** ([`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts)) **must** derive on each call from **`internalCache.Positions.getRoomRoster`** (hydrated); **must not** read stored **`activeCharacters`** from Dynamo on the steady path.
- After membership apply when **`changed`**, **`updatePositionGraphs`** **must** return **`postApplyRoomGraphs`**; the coordinator **must** seed **`Positions.set`** from that output (topology only via **`projectRoomGraphFromStoredPositionGraph`**); **`roomRosterSnapshots`** on the apply result **must** come from **`getRoomCharacterList`** after graph memo seed; **must not** use transact **`successCallback`** on **`activeCharacters`** for snapshot capture.
- **Roster display** **must** hydrate at read time from **`CharacterMeta`** (`Name` -> `DisplayName`, `Color`, `fileURL`) + **`CharacterSessions`** (`SessionIds`) via [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts); membership topology from stored **`positionGraph`** nodes only (**S2-6-H**).
- **Character `getPositionGraph`** is a forward **inventory stub** (empty graph today) --- **must not** be used for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in [`membership/updatePositionGraphs.ts`](membership/updatePositionGraphs.ts)) **must** use **`internalCache.Positions.getMembershipContainers`**, not raw `Meta::Character.RoomId`, `CharacterMeta.RoomId`, or `getPositionGraph(characterId).roomEndpoint`.
- **Forward room graph** **must** read stored **`Meta::Room.positionGraph`** topology only; when graph absent, return empty topology (**S2-6**); **must not** merge stored **`activeCharacters`** on gateway forward load for roster display.
- **Reverse membership** **must** read adjacency rows only (**S2-6**); empty adjacency means out of play (`[]`).
- **Authoritative writer** for play position state remains the membership persistence API; gateway memo runs from the coordinator when `changed`: forward **`Positions.set`** from **`postApplyRoomGraphs`** for all rooms in **`froms`** + **`to`**; **`setMembershipContainers`** for the character.

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate `Meta::Room.objects` (owned by [`../objects/`](../objects/)).
- **Must not** write play membership fields outside [`membership/`](membership/).
- **Must not** publish **`CheckLocation`** (retired at Close **S2-6-DR**).

### Disconnect ingress (slice 4)

- **Must** consume disconnect only via **`mtw.connections.characters`** / **`Character Disconnected`** (not legacy `Disconnect Character` EventBridge or ephemera `disconnectMessage`).
- **`unregistercharacter`** WebSocket ingress is **connections-owned** (`service: connections`); ephemera does not handle it.

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `Positions` memo and affordance invalidation reflect the updated roster for all affected rooms in **`froms`** and **`to`**. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
