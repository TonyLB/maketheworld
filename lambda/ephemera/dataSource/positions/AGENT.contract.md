# Positions --- contracts (slice 1a)

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Graph-shaped storage and `Character Moved` fact streaming are **not** normative here until slice 1b / slice 2 land.

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Membership persistence API (slice 1a)

All character **room-membership** mutations for **disconnect** (and navigate via the `moveCharacter` bridge) **must** go through [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts).

### Public apply shape

- **Args:** `{ characterId, targetRoomId: EphemeraRoomId | null }` --- `null` = out of play (disconnect).
- **Result:** `{ from, to, changed }` where `changed` is true iff room endpoints differ after apply (`from !== to`).
- **Flat persist engine:** [`applyCharacterMembershipFlat`](membership/applyCharacterMembershipFlat.ts) (slice 2 swaps to `updatePositionGraphs` behind the same coordinator).

### Membership-changed bundle (S1-11)

When **`changed`** is true, the coordinator **must** run (together or not at all):

1. Cache memo for each non-null endpoint among `from` / `to` (`ComponentEphemeraMeta.invalidate`, `AffordanceRoomDeliverable.invalidate`, `RoomCharacterList.set` when roster snapshot available).
2. `CharacterMeta.invalidate(characterId)`.
3. `RoomUpdate` for each non-null endpoint.
4. `EphemeraUpdate` `CharacterInPlay` room projection.
5. Record `beatAnchorTime` at apply (Model A prep for slice 1b / fan-in).

When **`changed`** is false: **must** skip the entire bundle (no cache, no `RoomUpdate`, no `EphemeraUpdate`).

**Must not** stream `Character Moved` in slice 1a (slice 1b).

---

## Ingress

### `mtw.connections.characters`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Connected` | [`handleCharacterConnected`](handleConnectionsCharactersPresence.ts) |
| `Character Disconnected` | [`handleCharacterDisconnected`](handleConnectionsCharactersPresence.ts) |

Positions **must not** subscribe to `Character Registered` (session orientation is render + affordance orchestration; see [`../../AGENT.md`](../../AGENT.md)).

### `Character Connected` (bridge)

- **Must** publish exactly one `CheckLocation` message with `forceMove: true`, `arriveMessage: ' has connected.'`, `suppressArrival: false`.
- **Must not** perform membership Dynamo writes directly in positions for connect (delegated to `moveCharacter` via `CheckLocation` until slice 3).

### `Character Disconnected` (positions-owned)

- **Must** call `applyCharacterRoomMembership({ characterId, targetRoomId: null })`.
- **Must not** perform inline `ephemeraDB.optimisticUpdate` on `activeCharacters` in the disconnect handler.
- **Idempotency:** duplicate disconnect when already out of play (`from === to === null`) **must** be a no-op (no bundle).
- World-line copy for disconnect is deferred to slice 1b fan-in emission (no imperative `PublishMessage` in the handler).

### Navigate (bridge via `moveCharacter`)

- Player-initiated navigation still enters through [`../../moveCharacter/index.ts`](../../moveCharacter/index.ts) (`MoveCharacter` bus) until positions subscribes to `Character Navigate` (slice 1 follow-on).
- `moveCharacter` **must** call `applyCharacterRoomMembership` for persistence; presentation (PerceptionThreads, render kicks, `MapUpdate`) lives in [`../../moveCharacter/orchestrateNavigate.ts`](../../moveCharacter/orchestrateNavigate.ts).

---

## Explicit non-ownership

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** mutate `Meta::Room.objects` (owned by [`../objects/`](../objects/)).
- **Must not** write `Meta::Room.activeCharacters` or `Meta::Character.RoomId` outside [`membership/`](membership/) except documented legacy [`../../disconnectMessage/index.ts`](../../disconnectMessage/index.ts) (retire slice 4).

---

## Consumer expectations

Downstream code **may** assume that after a **successful** membership apply with `changed: true`, `RoomCharacterList` and affordance invalidation reflect the updated roster for affected endpoint rooms. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
