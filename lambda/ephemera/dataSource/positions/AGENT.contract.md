# Positions --- contracts (slice 0)

This file records **falsifiable rules** for `mtw.ephemera.positions` **as implemented today**. Mental models: [`AGENT.concepts.md`](AGENT.concepts.md). Code map: [`AGENT.implementation.md`](AGENT.implementation.md).

Target-model obligations (graph-shaped storage, navigate ownership, atomic character across rooms) are **not** normative here until a slice lands and this file is updated.

---

## DataSource identity

- **`dataSourceKey`** must be `mtw.ephemera.positions`.
- **`replayable`** is `false` for v1.
- Subscription guards live in [`subscribedEvents.ts`](subscribedEvents.ts); new ingress types must register a header guard there (not a separate DataSource module).

---

## Ingress (slice 0)

### `mtw.connections.characters`

Positions **must** subscribe to:

| Event | Handler |
| --- | --- |
| `Character Connected` | [`handleCharacterConnected`](handleConnectionsCharactersPresence.ts) |
| `Character Disconnected` | [`handleCharacterDisconnected`](handleConnectionsCharactersPresence.ts) |

Positions **must not** subscribe to `Character Registered` (session orientation is render + affordance orchestration; see [`../../AGENT.md`](../../AGENT.md)).

---

## `Character Connected` (bridge)

- **Must** publish exactly one `CheckLocation` message with `forceMove: true`, `arriveMessage: ' has connected.'`, `suppressArrival: false`.
- **Must not** perform `Meta::Room.activeCharacters` mutation directly in positions for connect (delegated to `moveCharacter` via `CheckLocation`).

---

## `Character Disconnected` (positions-owned)

- **Must** read current room from `internalCache.CharacterMeta.get(characterId)`; if `RoomId` is absent, **must** return without Dynamo or bus side effects.
- **Must** remove the character from `Meta::Room.activeCharacters` via `ephemeraDB.optimisticUpdate` on `DataCategory: 'Meta::Room'`.
- **Idempotency:** **Must** treat duplicate disconnect deliveries as no-ops for **user-visible** departure: publish `PublishMessage` (departure `WorldMessage`) and `RoomUpdate` **only** when the optimistic update **actually removed** the character from the roster.
- **Must** on success callback (whether or not removal occurred): invalidate `ComponentEphemeraMeta` and `AffordanceRoomDeliverable` for the room; refresh `RoomCharacterList` for the room.
- Bus delivery for published messages: **`messageBus.publish`**; quiescence at lambda boundary only ([`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md)).

---

## Explicit non-ownership (slice 0)

- **Must not** implement `projectRoomExits`, `ensureAffordanceTopology`, or exit validation (owned by topology + [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts)).
- **Must not** own player-initiated navigation execution (`Character Navigate` / `MoveCharacter` remain actions + `moveCharacter` until a later slice updates this file).
- **Must not** mutate `Meta::Room.objects` (owned by [`../objects/`](../objects/)).

---

## Consumer expectations

Downstream code **may** assume that after a **successful** disconnect projection that removed a character, `RoomCharacterList` and affordance invalidation reflect the updated roster. Downstream **must** remain idempotent under at-least-once ingress (see [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md) consumer guidance).
