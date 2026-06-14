# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through slice **2**. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance (`publisherStrategy: 'busOnly'`); `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved` with **`froms[]`** + **`to`**) + stream helpers |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect/disconnect handlers |
| [`index.ts`](index.ts) `receiveEvents` | `Character Navigate` -> [`executeCharacterNavigate`](../../moveCharacter/executeCharacterNavigate.ts) |

### `membership/` (slice 2 graph persist + fact emit)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipDiff`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/positionGraphMerge.ts`](membership/positionGraphMerge.ts) | Pure graph merge helpers (add/remove character nodes, seed from roster) |
| [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) | Shared `RoomStack` update logic |
| [`membership/updatePositionGraphs.ts`](membership/updatePositionGraphs.ts) | **Graph persist engine** (S2-4 end-state apply, adjacency + S2-2 dual-write) |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: graph persist, `changed` gate, S1-11 bundle (fact stream first) |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | Graph-diff fact payload from **`MembershipDiff`** (F1-8) |
| [`membership/streamMembershipFact.ts`](membership/streamMembershipFact.ts) | `Character Moved` `streamEvent` at persistence apply |
| [`membership/applyCharacterMembershipFlat.ts`](membership/applyCharacterMembershipFlat.ts) | Legacy flat-field persist (retained for unit tests; not called by coordinator) |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection (connections + actions navigate) |
| [`publishedEvents.test.ts`](publishedEvents.test.ts) | `Character Moved` **`froms[]`** payload guard + stream helpers |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect `CheckLocation` publish; disconnect routes through coordinator |
| [`membership/positionGraphMerge.test.ts`](membership/positionGraphMerge.test.ts) | Pure graph merge helpers |
| [`membership/updatePositionGraphs.test.ts`](membership/updatePositionGraphs.test.ts) | Graph persist transact, drift scrub, adjacency |
| [`membership/applyCharacterMembershipFlat.test.ts`](membership/applyCharacterMembershipFlat.test.ts) | Legacy flat persist (reference) |
| [`membership/membershipContainersSharedMemo.test.ts`](membership/membershipContainersSharedMemo.test.ts) | Parse + apply share `getMembershipContainers` memo (slice 1c) |
| [`membership/applyCharacterRoomMembership.test.ts`](membership/applyCharacterRoomMembership.test.ts) | Coordinator bundle on `changed` (fact stream before side effects; multi-from) |
| [`membership/buildCharacterMovedFact.test.ts`](membership/buildCharacterMovedFact.test.ts) | Graph-diff fact builder (including multi-from) |
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
| `ephemeraDB.transactWrite` | `Meta::Room.positionGraph` + `activeCharacters`; adjacency rows; `Meta::Character` `RoomId` / `RoomStack` |
| `internalCache.CharacterMeta` | Full meta for transact; `invalidate` after apply |
| `internalCache.ComponentEphemeraMeta.invalidate` | Room meta after roster change |
| `internalCache.AffordanceRoomDeliverable.invalidate` | Affordance compose memo |
| `internalCache.Positions.set` / `invalidate` | Room forward position graph memo (S1-5) |
| `internalCache.Positions.setMembershipContainers` | Character reverse containers memo (S1-15) |
| `messageBus.publish` | `RoomUpdate`, `EphemeraUpdate` when `changed` |
| `streamEvent` (required; from DataSource `receiveEvents` or `ephemeraPositionsDataSource` on legacy bus paths) | `Character Moved` when `changed` |

---

## Downstream read paths

| System | Role |
| --- | --- |
| [`../../internalCache/positions.ts`](../../internalCache/positions.ts) | **`Positions`** gateway handler on `internalCache` |
| [`../../../../packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/) | Room `getPositionGraph` (stored graph + roster meta); `getMembershipContainers` (adjacency + RoomId fallback) |
| [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts) | Navigate parse --- reverse via **`Positions.getMembershipContainers`** |
| [`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts) | Affordance WML compose --- roster via **`Positions.getRoomRoster`** |
| [`../../internalCache/roomCharacterLists.ts`](../../internalCache/roomCharacterLists.ts) | Legacy roster read (other callers; migrate at initiative close) |
| [`../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) | Exits projection (gateway + `internalCache`) |
| [`../perception/membershipPresentationLegAdapters.ts`](../perception/membershipPresentationLegAdapters.ts) | Fan-in fact leg consumer for **`Character Moved`** |

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
