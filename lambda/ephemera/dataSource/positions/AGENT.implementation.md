# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through slice **1a**. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance; `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved`; emit pending slice 1b) |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect/disconnect handlers |

### `membership/` (slice 1a persistence boundary)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/applyCharacterMembershipFlat.ts`](membership/applyCharacterMembershipFlat.ts) | Flat-field `transactWrite` (navigate + disconnect); slice 2 swaps engine |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: pre-read, persist, `changed` gate, S1-11 bundle |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | TEMP slice 1 fact builder stub (slice 1b) |
| [`membership/streamMembershipFact.ts`](membership/streamMembershipFact.ts) | `Character Moved` stream stub (slice 1b) |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection |
| [`publishedEvents.test.ts`](publishedEvents.test.ts) | `Character Moved` payload guard |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect `CheckLocation` publish; disconnect routes through coordinator |
| [`membership/applyCharacterMembershipFlat.test.ts`](membership/applyCharacterMembershipFlat.test.ts) | Flat persist transact + `changed` gate |
| [`membership/applyCharacterRoomMembership.test.ts`](membership/applyCharacterRoomMembership.test.ts) | Coordinator bundle on `changed` |

---

## Registration

- Side-effect import: [`../../app.ts`](../../app.ts) --- `import './dataSource/positions'`.
- EventBridge deserialization for `mtw.connections.characters` is configured in `app.ts` (`eventDeserializers`).

---

## Navigate orchestration (not in `membership/`)

| Concern | Location |
| --- | --- |
| `moveCharacter` bus entry (bridge) | [`../../moveCharacter/index.ts`](../../moveCharacter/index.ts) |
| Post-persist presentation (PerceptionThreads, render kicks, `MapUpdate`) | [`../../moveCharacter/orchestrateNavigate.ts`](../../moveCharacter/orchestrateNavigate.ts) |
| Player navigate ingress (`Character Navigate` -> `MoveCharacter`) | [`../actions/index.ts`](../actions/index.ts) |

---

## Legacy paths (retire in later slices)

| Concern | Location |
| --- | --- |
| Connect execution (`CheckLocation`) | [`../../checkLocation/index.ts`](../../checkLocation/index.ts) |
| Legacy disconnect bus handlers | [`../../disconnectMessage/index.ts`](../../disconnectMessage/index.ts) (slice 4) |

---

## Storage and cache touchpoints (membership coordinator)

| System | Use |
| --- | --- |
| `ephemeraDB.transactWrite` | `Meta::Character` `RoomId` / `RoomStack`; `Meta::Room.activeCharacters` (flat persist) |
| `internalCache.CharacterMeta` | Pre-read membership endpoint; `invalidate` after apply |
| `internalCache.ComponentEphemeraMeta.invalidate` | Room meta after roster change |
| `internalCache.AffordanceRoomDeliverable.invalidate` | Affordance compose memo |
| `internalCache.RoomCharacterList.set` | Per-invocation roster memo |
| `messageBus.publish` | `RoomUpdate`, `EphemeraUpdate` when `changed` |

---

## Downstream read paths (roster projection today)

Affordance compose needs a room **roster** alongside exit topology. Today that read path is **not** graph-shaped:

| System | Role |
| --- | --- |
| [`../../internalCache/roomCharacterLists.ts`](../../internalCache/roomCharacterLists.ts) | `RoomCharacterList` --- memo + direct `ephemeraDB` read of `Meta::Room.activeCharacters` on miss |
| [`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts) | Composes affordance WML (roster + exits + objects) |
| [`../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) | Exits projection precedent (gateway + `internalCache`; not used for roster yet) |

Planned: `mtw-gateways` positions read handler (S1-5) and slice 2 `positionGraph` storage swap --- task plan [**Migration strategy**](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#migration-strategy-routing-first).

---

## Verification

From repo root:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/ \
  moveCharacter/index.test.ts
```
