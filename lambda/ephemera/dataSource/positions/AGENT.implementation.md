# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` slice 0. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance; `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect/disconnect handlers |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect `CheckLocation` publish; disconnect roster + idempotency |

---

## Registration

- Side-effect import: [`../../app.ts`](../../app.ts) --- `import './dataSource/positions'`.
- EventBridge deserialization for `mtw.connections.characters` is configured in `app.ts` (`eventDeserializers`).

---

## Legacy paths (not in this folder; slice 0 bridges)

| Concern | Location |
| --- | --- |
| Connect execution (`CheckLocation`, `moveCharacter`) | [`../../checkLocation/index.ts`](../../checkLocation/index.ts), [`../../moveCharacter/index.ts`](../../moveCharacter/index.ts), [`../../messageBus/index.ts`](../../messageBus/index.ts) |
| Player navigate (`Character Navigate`, imperative `MoveCharacter`) | [`../actions/index.ts`](../actions/index.ts) |
| Legacy disconnect bus handlers | [`../../disconnectMessage/index.ts`](../../disconnectMessage/index.ts) (retire in a later slice) |

---

## Storage and cache touchpoints (disconnect path)

| System | Use |
| --- | --- |
| `ephemeraDB.optimisticUpdate` | `Meta::Room.activeCharacters` |
| `internalCache.CharacterMeta` | Read `RoomId` / `Name` on disconnect |
| `internalCache.ComponentEphemeraMeta.invalidate` | Room meta after roster change |
| `internalCache.AffordanceRoomDeliverable.invalidate` | Affordance compose memo |
| `internalCache.RoomCharacterList.set` | Per-invocation roster memo |

---

## Verification

From repo root:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false dataSource/positions/
```
