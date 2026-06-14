# Positions --- contracts (slice 1d)

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Graph-shaped storage is **not** normative here until slice 2 lands. **`Character Moved`** fact streaming is normative (TEMP slice 1 emit; slice 2 replaces with graph-diff). Fact bus shape uses plural **`froms[]`** (slice **1d** / fan-in **F2-2**).

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- **`publisherStrategy`** is `busOnly` (outbound **`Character Moved`** on internal bus).
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Membership persistence API (slice 1a--1b)

All character **room-membership** mutations for **disconnect** and **navigate** **must** go through [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts).

### Public apply shape

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` --- `null` = out of play (disconnect).
- **Result:** `{ from, to, changed }` where `changed` is true iff room endpoints differ after apply (`from !== to`).
- **Flat persist engine:** [`applyCharacterMembershipFlat`](membership/applyCharacterMembershipFlat.ts) (slice 2 swaps to `updatePositionGraphs` behind the same coordinator).

### Membership-changed bundle (S1-11)

When **`changed`** is true, the coordinator **must** run (together or not at all):

1. **`streamMembershipFact`** --- **`Character Moved`** on `mtw.ephemera.positions` (slice 1b; TEMP slice 1 fact builder).
2. Cache memo for each non-null endpoint among `from` / `to` (`ComponentEphemeraMeta.invalidate`, `AffordanceRoomDeliverable.invalidate`, `Positions.set` / `Positions.invalidate` when roster snapshot available).
3. `CharacterMeta.invalidate(characterId)`.
4. `RoomUpdate` for each non-null endpoint.
5. `EphemeraUpdate` `CharacterInPlay` room projection.
6. Record `beatAnchorTime` at apply (Model A / fan-in **F1-4**).

When **`changed`** is false: **must** skip the entire bundle (no fact stream, no cache, no `RoomUpdate`, no `EphemeraUpdate`).

### `Character Moved` fact (slice 1d; S1-14 TEMP)

- **Must** stream only when **`changed`** (`from !== to`; S1-8).
- **`froms: EphemeraRoomId[]`** = authoritative pre-read membership endpoint(s) at emit (`[]` = out of play). Flat persist maps singular apply **`from`** to **`froms: from ? [from] : []`** --- **must not** emit **`froms.length > 1`** from real persist until slice 2 graph-diff.
- **`to`** = successful apply target (`null` on disconnect).
- **`beatAnchorTime`** = recorded time at persistence apply.
- **Must not** populate **`legalExits`** on emitted facts (slice 1; S1-10).
- **Must not** branch **`streamEvent`** on ingress type (navigate vs disconnect); emission is descriptive at the membership boundary only.
- **`streamEvent`** is a **required** coordinator dependency (no in-module fallback). **`receiveEvents`** passes the DataSource instance `streamEvent`; legacy **`moveCharacter`** bus paths obtain it from **`ephemeraPositionsDataSource`** via lazy require (avoids messageBus load cycle).
- Payload contract: [`publishedEvents.ts`](publishedEvents.ts). Fan-in consumer: [`../perception/membershipPresentationFanIn.ts`](../perception/membershipPresentationFanIn.ts) (**F2-2**). Fact builder marked **`TEMP slice 1`** until slice 2 graph-diff cutover.

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

### `Character Connected` (bridge)

- **Must** publish exactly one `CheckLocation` message with `forceMove: true`, `arriveMessage: ' has connected.'`, `suppressArrival: false`.
- **Must not** perform membership Dynamo writes directly in positions for connect (delegated to `moveCharacter` via `CheckLocation` until slice 3).

### `Character Disconnected` (positions-owned)

- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: null })`.
- **Must not** perform inline `ephemeraDB.optimisticUpdate` on `activeCharacters` in the disconnect handler.
- **Idempotency:** duplicate disconnect when already out of play (`from === to === null`) **must** be a no-op (no bundle).
- World-line copy for disconnect is owned by fan-in emission ([`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts)); no imperative `PublishMessage` in the handler.

### `Character Navigate` (positions-owned)

- **Must** trust actions-validated `toRoomId` at apply (S1-1 --- no topology re-check in positions).
- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: content.toRoomId })` then post-persist orchestration when `changed`.
- **Must not** rely on imperative `MoveCharacter` from actions for parse-based navigation.
- Leave/arrive world copy for navigate is owned by fan-in emission; navigate orchestration **must** suppress imperative leave/arrive (`suppressDeparture` / `suppressArrival` defaults in [`executeCharacterNavigate`](../../moveCharacter/executeCharacterNavigate.ts)).

---

## Read surface (S1-5, S1-15 slice 1c)

- Steady-state roster reads for **affordance compose** **must** use **`internalCache.Positions`** (`getRoomRoster` / room `getPositionGraph`), not raw `ephemeraDB` `activeCharacters` in the compose path.
- **Character `getPositionGraph`** is a forward **inventory stub** (empty graph today) --- **must not** be used for room-membership / reverse reads.
- **Reverse membership reads** (navigate parse endpoint in [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts), membership pre-read in [`membership/applyCharacterMembershipFlat.ts`](membership/applyCharacterMembershipFlat.ts)) **must** use **`internalCache.Positions.getMembershipContainers`**, not raw `Meta::Character.RoomId`, `CharacterMeta.RoomId`, or `getPositionGraph(characterId).roomEndpoint`.
- **Authoritative writer** for play position state remains the membership persistence API; gateway memo runs from the coordinator when `changed`: forward **`set`** / **`invalidate`** for endpoint rooms; **`setMembershipContainers`** for the character (`invalidateMembershipContainers` available but not required before `set`).

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate `Meta::Room.objects` (owned by [`../objects/`](../objects/)).
- **Must not** write `Meta::Room.activeCharacters` or `Meta::Character.RoomId` outside [`membership/`](membership/) except documented legacy:
  - [`../../disconnectMessage/index.ts`](../../disconnectMessage/index.ts) (retire slice 4)
  - [`../selfHealing/roomOccupancyDriftFinding.ts`](../selfHealing/roomOccupancyDriftFinding.ts) (diagnostics self-healing rebuild)

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `Positions` memo and affordance invalidation reflect the updated roster for affected endpoint rooms. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
