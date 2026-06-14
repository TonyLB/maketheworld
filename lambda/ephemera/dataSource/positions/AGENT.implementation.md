# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through slice **1d**. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance (`publisherStrategy: 'busOnly'`); `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved` with **`froms[]`** + **`to`**) + stream helpers |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect/disconnect handlers |
| [`index.ts`](index.ts) `receiveEvents` | `Character Navigate` -> [`executeCharacterNavigate`](../../moveCharacter/executeCharacterNavigate.ts) |

### `membership/` (slice 1a--1b persistence + fact emit)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/applyCharacterMembershipFlat.ts`](membership/applyCharacterMembershipFlat.ts) | Flat-field `transactWrite` (navigate + disconnect); slice 2 swaps engine |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: persist, `changed` gate, S1-11 bundle (fact stream first) |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | TEMP slice 1 fact payload: maps apply **`from`** -> **`froms[]`** (S1-14 / slice **1d**) |
| [`membership/streamMembershipFact.ts`](membership/streamMembershipFact.ts) | `Character Moved` `streamEvent` at persistence apply |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection (connections + actions navigate) |
| [`publishedEvents.test.ts`](publishedEvents.test.ts) | `Character Moved` **`froms[]`** payload guard + stream helpers |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect `CheckLocation` publish; disconnect routes through coordinator |
| [`membership/applyCharacterMembershipFlat.test.ts`](membership/applyCharacterMembershipFlat.test.ts) | Flat persist transact + `changed` gate |
| [`membership/membershipContainersSharedMemo.test.ts`](membership/membershipContainersSharedMemo.test.ts) | Parse + apply share `getMembershipContainers` memo (slice 1c) |
| [`membership/applyCharacterRoomMembership.test.ts`](membership/applyCharacterRoomMembership.test.ts) | Coordinator bundle on `changed` (fact stream before side effects) |
| [`membership/buildCharacterMovedFact.test.ts`](membership/buildCharacterMovedFact.test.ts) | TEMP fact builder (`froms[]` mapping; 0-1 elements from flat persist) |
| [`membership/streamMembershipFact.test.ts`](membership/streamMembershipFact.test.ts) | Fact stream helper |

---

## Registration

- Side-effect import: [`../../app.ts`](../../app.ts) --- `import './dataSource/positions'`.
- EventBridge deserialization for `mtw.connections.characters` is configured in `app.ts` (`eventDeserializers`).

---

## Navigate orchestration (not in `membership/`)

| Concern | Location |
| --- | --- |
| Shared navigate execution (persist + orchestrate) | [`../../moveCharacter/executeCharacterNavigate.ts`](../../moveCharacter/executeCharacterNavigate.ts) |
| `moveCharacter` bus entry (connect / legacy bridge) | [`../../moveCharacter/index.ts`](../../moveCharacter/index.ts) |
| Post-persist presentation (PerceptionThreads, render kicks, `MapUpdate`) | [`../../moveCharacter/orchestrateNavigate.ts`](../../moveCharacter/orchestrateNavigate.ts) |
| Player navigate ingress (stream only) | [`../actions/index.ts`](../actions/index.ts) emits `Character Navigate`; positions executes |
| Leave/arrive world copy (navigate + disconnect) | [`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts) via membership fan-in |

---

## Legacy paths (retire in later slices)

| Concern | Location |
| --- | --- |
| Connect execution (`CheckLocation`) | [`../../checkLocation/index.ts`](../../checkLocation/index.ts) |
| Legacy disconnect bus handlers | [`../../disconnectMessage/index.ts`](../../disconnectMessage/index.ts) (slice 4) |
| Legacy API move/home | [`../../parse/executeAction.ts`](../../parse/executeAction.ts) (imperative `MoveCharacter`) |

---

## Storage and cache touchpoints (membership coordinator)

| System | Use |
| --- | --- |
| `ephemeraDB.transactWrite` | `Meta::Character` `RoomId` / `RoomStack`; `Meta::Room.activeCharacters` (flat persist) |
| `internalCache.CharacterMeta` | Full meta for transact; `invalidate` after apply |
| `internalCache.ComponentEphemeraMeta.invalidate` | Room meta after roster change |
| `internalCache.AffordanceRoomDeliverable.invalidate` | Affordance compose memo |
| `internalCache.Positions.set` / `invalidate` | Room forward position graph memo (S1-5) |
| `internalCache.Positions.setMembershipContainers` | Character reverse containers memo (S1-15 slice 1c) |
| `messageBus.publish` | `RoomUpdate`, `EphemeraUpdate` when `changed` |
| `streamEvent` (required; from DataSource `receiveEvents` or `ephemeraPositionsDataSource` on legacy bus paths) | `Character Moved` when `changed` |

---

## Downstream read paths

| System | Role |
| --- | --- |
| [`../../internalCache/positions.ts`](../../internalCache/positions.ts) | **`Positions`** gateway handler on `internalCache` |
| [`../../../../packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/) | Room `getPositionGraph`, `getRoomRoster`; character inventory stub + `getMembershipContainers` (slice 1c) |
| [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts) | Navigate parse --- reverse via **`Positions.getMembershipContainers`** |
| [`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts) | Affordance WML compose --- roster via **`Positions.getRoomRoster`** |
| [`../../internalCache/roomCharacterLists.ts`](../../internalCache/roomCharacterLists.ts) | Legacy roster read (other callers; migrate in slice 2) |
| [`../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) | Exits projection (gateway + `internalCache`) |
| [`../perception/membershipPresentationLegAdapters.ts`](../perception/membershipPresentationLegAdapters.ts) | Fan-in fact leg consumer for **`Character Moved`** |

Slice 2 swaps room forward + reverse backing to stored `Meta::Room.positionGraph` + adjacency --- task plan [**Migration strategy**](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md#migration-strategy-routing-first).

---

## Verification

From repo root:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/ \
  dataSource/perception/ \
  dataSource/actions/index.test.ts \
  moveCharacter/index.test.ts

npm --prefix packages/mtw-gateways run test -- --watchAll=false ts/ephemera/positions/
```
