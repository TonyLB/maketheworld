# Positions --- contracts (slice 2)

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Play membership persistence uses **`Meta::Room.positionGraph`** (forward) + **adjacency index** (reverse, **S2-5**), with transitional dual-write to **`activeCharacters`** / **`RoomId`** (**S2-2** until initiative close **S2-6**). **`Character Moved`** is graph-diff descriptive emission (**F1-8** / **S2-4**). Fact bus shape uses plural **`froms[]`** (fan-in **F2-2**).

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`** on internal bus).
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Membership persistence API (slice 2)

All character **room-membership** mutations for **disconnect**, **navigate**, and **connect** **must** go through [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts).

### Public apply shape (S1-7)

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` --- `null` = out of play (disconnect). **Must not** consume stream / intent `fromRoomId` for persist (**S2-4**).
- **Result:** `{ froms, to, changed }` where `changed` is true iff prior container set differs from end state (`{ targetRoomId }` or `{}` when out of play). **`froms`** is required (same semantics as **`MembershipDiff`** / bus fact).
- **Navigate orchestration bridge (temporary):** [`orchestrateCharacterNavigate`](../../moveCharacter/orchestrateNavigate.ts) receives full **`froms[]`** from the apply result; **`MapUpdate.previousRoomId`** uses **`froms[0]`** until Phase **3** slims remaining beat fields. Multi-departure leave is fan-in's job (**F2-2**). Leave/arrive world lines are **not** emitted from navigate orchestration (membership fan-in owns them).
- **Graph persist engine:** [`updatePositionGraphs`](membership/updatePositionGraphs.ts) --- end-state apply: pre-read full **`getMembershipContainers`**, remove from every prior container `!== target`, ensure at target; holistic **`MembershipDiff`**.

### Graph apply (S2-4)

- **Must** use pure end-state apply on **`targetRoomId`** only.
- **Must** derive **`MembershipDiff.froms`** from observed prior containers removed (may be **`length > 1`** on drift repair).
- **Must** maintain **`positionGraph`** + adjacency in the same **`transactWrite`** bundle; **must** transitional dual-write **`activeCharacters`** / **`RoomId`** (**S2-2**).
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

- **Must not** expose eviction ladder edits on **`MembershipApplyArgs`** --- public apply remains `{ characterId, targetRoomId | null }` only (**S1-9**).
- On successful navigate/disconnect membership persist, **`updatePositionGraphs`** **must** update `Meta::Character.RoomStack` in the same character-row transact when the membership endpoint changes (ladder maintenance bundled with membership apply).
- **Must not** emit **`Character Moved`** or run the membership-changed bundle when **only** the eviction ladder changes and the room membership endpoint is unchanged (**S1-9**).
- When asset loss **trim** changes the membership endpoint, relocation **must** go through membership apply (today: [`checkLocation`](../../checkLocation/index.ts) filters the ladder then publishes `MoveCharacter`).

### `Character Moved` fact (F1-8 steady state)

- **Must** stream only when **`MembershipDiff.changed`** after successful graph persist (**S1-8**).
- **`froms: EphemeraRoomId[]`** = distinct prior in-play containers removed at apply (`[]` = out of play). **May** emit **`froms.length > 1`** when drift repair scrubs multiple hosts.
- **`to`** = successful apply target (`null` on disconnect).
- **`beatAnchorTime`** = recorded time at persistence apply.
- **Must not** populate **`legalExits`** on emitted facts (**S1-10**).
- **Must not** branch **`streamEvent`** on ingress type (navigate vs disconnect); emission is descriptive from **`MembershipDiff`** only.
- **`streamEvent`** is a **required** coordinator dependency (no in-module fallback). **`receiveEvents`** passes the DataSource instance `streamEvent`; legacy **`moveCharacter`** bus paths obtain it from **`ephemeraPositionsDataSource`** via lazy require (avoids messageBus load cycle).
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
| `Character Navigate` | [`index.ts`](index.ts) `receiveEvents` -> [`executeCharacterNavigate`](../../moveCharacter/executeCharacterNavigate.ts) |

### `Character Connected` (positions-owned)

- **Must** resolve `targetRoomId` via [`resolveConnectTargetRoom`](membership/resolveConnectTargetRoom.ts) (trim eviction ladder to accessible assets, then top surviving frame).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId })` then post-persist orchestration when `changed`.
- **Must not** publish `CheckLocation` or perform inline membership Dynamo writes outside [`membership/`](membership/).
- **Idempotency:** duplicate connect when already in target room (`changed: false`) **must** be a no-op (no bundle, no orchestration).
- Arrive world-line copy for connect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); connect orchestration does not publish imperative leave/arrive world lines.

### `Character Disconnected` (positions-owned)

- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: null })`.
- **Must not** perform inline membership writes outside [`membership/`](membership/).
- **Idempotency:** duplicate disconnect when already out of play (`changed: false`) **must** be a no-op (no bundle).
- World-line copy for disconnect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); no imperative `PublishMessage` in the handler.

### `Character Navigate` (positions-owned)

- **Ingress:** typed commands via actions **`Parse Requested`**, UI exit clicks via actions **`Action Assessed`** **`Navigation`** (same execution contract).
- **Must** trust actions-validated `toRoomId` at apply (S1-1 --- no topology re-check in positions).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` from actions for parse-based or UI-exit navigation.
- Leave/arrive world copy for navigate is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); orchestration registers perception threads and map updates only.

---

## Read surface (S1-5, S1-15 slice 2)

- Steady-state roster reads for **affordance compose** **must** use **`internalCache.Positions`** (`getRoomRoster` / room `getPositionGraph`), not raw `ephemeraDB` `activeCharacters` in the compose path.
- **Character `getPositionGraph`** is a forward **inventory stub** (empty graph today) --- **must not** be used for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in [`membership/updatePositionGraphs.ts`](membership/updatePositionGraphs.ts)) **must** use **`internalCache.Positions.getMembershipContainers`**, not raw `Meta::Character.RoomId`, `CharacterMeta.RoomId`, or `getPositionGraph(characterId).roomEndpoint`.
- **Forward room graph** **must** read stored **`Meta::Room.positionGraph`** (bootstrap from **`activeCharacters`** when graph absent); roster display merges transitional **`activeCharacters`** (**S2-2**).
- **Reverse membership** **must** read adjacency rows; **may** fall back to **`RoomId`** when adjacency empty (transitional bootstrap until **S2-6**).
- **Authoritative writer** for play position state remains the membership persistence API; gateway memo runs from the coordinator when `changed`: forward **`set`** / **`invalidate`** for all rooms in **`froms`** + **`to`**; **`setMembershipContainers`** for the character.

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate `Meta::Room.objects` (owned by [`../objects/`](../objects/)).
- **Must not** write play membership fields outside [`membership/`](membership/) except documented diagnostics:
  - [`../selfHealing/roomOccupancyDriftFinding.ts`](../selfHealing/roomOccupancyDriftFinding.ts) (diagnostics self-healing rebuild)

### Disconnect ingress (slice 4)

- **Must** consume disconnect only via **`mtw.connections.characters`** / **`Character Disconnected`** (not legacy `Disconnect Character` EventBridge or ephemera `disconnectMessage`).
- **`unregistercharacter`** WebSocket ingress is **connections-owned** (`service: connections`); ephemera does not handle it.

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `Positions` memo and affordance invalidation reflect the updated roster for all affected rooms in **`froms`** and **`to`**. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
