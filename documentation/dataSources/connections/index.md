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

## `mtw.connections.characters`

**Source:** `mtw.connections.characters` (derived character-presence lane)

**Stream key:** `CHARACTER#${characterId}` for each event.

Events:

- Character Connected
- Character Disconnected

These presence transitions are emitted with **at least once** delivery; consumers must tolerate duplicates for user-visible effects. See [`packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md`](../../../packages/mtw-interfaces/ts/eventBridge/AGENT.implementation.md#connections-character-presence-delivery-semantics) for delivery semantics and for how to interpret `sessionId` (boundary-correlation, not sole authority).
