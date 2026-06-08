# Connections Data Sources

## `mtw.connections`

**Source:** `mtw.connections`

**Stream key:** Session-wide events use `global` where applicable. Character-scoped events use `CHARACTER#${characterId}` (same convention as `mtw.connections.characters`).

Events:

- Session Connect [To Be Implemented]
- Session Disconnect
- Character Registered
- Session Disconnect Problem (and related problem-report events)

Notes:

- `Session Disconnect` carries an optional `characterIds` field: the teardown-time candidate set of characters adjacently attached to the dropped session; the derived `mtw.connections.characters` lane uses this field to perform its final connected/disconnected judgment.
- Registration ingress authority is now in `connections`: websocket `service: connections` with `message: registercharacter` writes adjacency/session membership and emits `Character Registered`.
- Ephemera registration bridge paths are removed; `service: ephemera` is no longer a valid registration ingress target.
- Client request contract for websocket `service: connections` is now isolated as `ConnectionsAPIMessage` in `packages/mtw-interfaces/ts/connections.ts` (no longer piggybacked on ephemera request typings).

## `mtw.connections.characters`

**Source:** `mtw.connections.characters` (derived character-presence lane)

**Stream key:** `CHARACTER#${characterId}` for each event.

**Subscribed lifecycle inputs (derived from `mtw.connections`):**

- Character Registered
- Session Disconnect

Events:

- Character Connected
- Character Disconnected

These presence transitions are emitted with **at least once** delivery; consumers must tolerate duplicates for user-visible effects. See [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md#connections-character-presence-delivery-semantics) for delivery semantics and for how to interpret `sessionId` (boundary-correlation, not sole authority).

Producer boundary semantics:

- Emit intent is aggregate-session boundary crossing for a character: connect (`0 -> 1`) and disconnect (`1 -> 0`).
- **Connect (`0 -> 1`):** registration reads pre-mutation `prior.sessions` via the `Meta::Character` `transactWrite` Update `successCallback` and passes `isFirstSessionForCharacter` on the in-process `Character Registered` envelope; the derived `mtw.connections.characters` lane emits `Character Connected` when that flag is `true`.
- **Disconnect (`1 -> 0`):** teardown removes the session first; the derived lane reads post-teardown `Meta::Character.sessions` and emits `Character Disconnected` when the list is empty.
- Registration and teardown state mutation is still applied even when a corresponding presence event is not emitted.
- No cross-writer lock is used to suppress same-window duplicates; duplicate presence events are acceptable under at-least-once + concurrency semantics.

Consumers:

- **Ephemera projection (`mtw.ephemera.positions`)** at [`lambda/ephemera/dataSource/positions/`](../../../lambda/ephemera/dataSource/positions/) is the projection owner: `Character Connected` triggers `CheckLocation`/`MoveCharacter` (room arrival, `Meta::Room.activeCharacters` add); `Character Disconnected` runs a conditional `Meta::Room.activeCharacters` projection that gates departure `WorldMessage`/`RoomUpdate` on actual change. See [`lambda/ephemera/AGENT.md`](../../../lambda/ephemera/AGENT.md) and [`lambda/ephemera/AGENT.event.md`](../../../lambda/ephemera/AGENT.event.md).
- **Ephemera session orientation (`mtw.connections` / `Character Registered`)** at [`lambda/ephemera/dataSource/renderOrchestration/`](../../../lambda/ephemera/dataSource/renderOrchestration/) and [`lambda/ephemera/dataSource/affordanceOrchestration/`](../../../lambda/ephemera/dataSource/affordanceOrchestration/) (guards in [`connectionsCharacterRegistered/subscribedEvents.ts`](../../../lambda/ephemera/dataSource/connectionsCharacterRegistered/subscribedEvents.ts)): distinct from the positions/world path; delivers render + affordance RoomHeader material to `SESSION#${sessionId}` (orientation handler Phase 3).

Operational guardrails:

- Keep EventBridge wiring for `mtw.connections.characters` consumer delivery enabled.
- Prevent dual-write/dual-consume behavior by keeping registration ingress only on `service: connections`.
- As an ongoing health check, confirm zero `registercharacter` traffic on `service: ephemera` over representative production windows.
