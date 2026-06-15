# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through slice **3**. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance (`publisherStrategy: 'busOnly'`); `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved` with **`froms[]`** + **`to`**) + stream helpers |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect (membership API + orchestrate) / disconnect handlers |
| [`index.ts`](index.ts) `receiveEvents` | `Character Navigate` -> [`executeCharacterNavigate`](../../moveCharacter/executeCharacterNavigate.ts) |

### `membership/` (slice 2 graph persist + fact emit)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipDiff`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/positionGraphMerge.ts`](membership/positionGraphMerge.ts) | Pure graph merge helpers (add/remove character nodes, seed from roster) |
| [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) | Ladder maintenance on navigate (asset-chain extend / rewrite-tail / fork) |
| [`membership/trimEvictionLadder.ts`](membership/trimEvictionLadder.ts) | Pure trim + normalize helpers --- legal placement resolution (connect, asset visibility) |
| [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) | Trim ladder to accessible assets; persist trim-only when shape changes |
| [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) | Connect: resolve legal `targetRoomId` from trimmed ladder |
| [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) | Asset visibility: trim + membership apply when in play and endpoint differs |
| [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) | Occupancy drift repair: graph-forward room scan + session gate (**S2-6-DR**) |
| [`membership/syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) | Adjacency-only sync when graph correct but reverse index lags |
| [`membership/updatePositionGraphs.ts`](membership/updatePositionGraphs.ts) | **Graph persist engine** (S2-4 end-state apply, adjacency only; **S2-6**) |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: graph persist, `changed` gate, S1-11 bundle (fact stream first) |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | Graph-diff fact payload from **`MembershipDiff`** (F1-8) |
| [`membership/streamMembershipFact.ts`](membership/streamMembershipFact.ts) | `Character Moved` `streamEvent` at persistence apply |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection (connections + actions navigate + diagnostics drift finding) |
| [`publishedEvents.test.ts`](publishedEvents.test.ts) | `Character Moved` **`froms[]`** payload guard + stream helpers |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect membership apply + orchestrate; disconnect routes through coordinator |
| [`receivePaths.integration.test.ts`](receivePaths.integration.test.ts) | Cross-layer `receiveEvents` routing (connect / disconnect / navigate / drift finding) |
| [`membership/membershipRoomStack.test.ts`](membership/membershipRoomStack.test.ts) | Extend / rewrite-tail / fork + circus-style trim |
| [`membership/resolveConnectTargetRoom.test.ts`](membership/resolveConnectTargetRoom.test.ts) | Connect target resolution + trim-only persist |
| [`membership/repairCharacterLegalPlacement.test.ts`](membership/repairCharacterLegalPlacement.test.ts) | Asset visibility legal placement repair |
| [`membership/repairRoomOccupancyDrift.test.ts`](membership/repairRoomOccupancyDrift.test.ts) | Occupancy drift repair (ghost purge, adjacency sync, idempotency) |
| [`membership/syncMembershipAdjacency.test.ts`](membership/syncMembershipAdjacency.test.ts) | Adjacency-only sync transact + memo |
| [`membership/positionGraphMerge.test.ts`](membership/positionGraphMerge.test.ts) | Pure graph merge helpers |
| [`membership/updatePositionGraphs.test.ts`](membership/updatePositionGraphs.test.ts) | Graph persist transact, drift scrub, adjacency |
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
| Post-persist presentation (targeting-only `characterMove` header, render kicks, `MapUpdate`) | [`../../moveCharacter/orchestrateNavigate.ts`](../../moveCharacter/orchestrateNavigate.ts) --- args **`froms[]`**, **`to`** (singular bridge: **`froms[0]`** for `MapUpdate.previousRoomId`) |
| Player navigate ingress (stream only) | [`../actions/index.ts`](../actions/index.ts) emits `Character Navigate`; positions executes |
| Leave/arrive world copy (navigate + disconnect + connect) | [`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts) via membership fan-in |

---

## Eviction ladder (`RoomStack` storage)

Concept: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder-shipped) --- character-local state for **legal placement** under asset access. Contract: [`AGENT.contract.md` --- Eviction ladder](AGENT.contract.md#eviction-ladder-roomstack-storage).

| Concern | Location |
| --- | --- |
| **Storage** | `Meta::Character.RoomStack` --- array of `{ asset, RoomId }` ([`membership/types.ts`](membership/types.ts) `RoomStackItem`) |
| **Legal placement: connect (from nowhere)** | [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) + [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts) |
| **Legal placement: asset visibility (from illegal room)** | [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) -> [`executeCharacterNavigate`](../../moveCharacter/executeCharacterNavigate.ts) when in play (future asset-visibility ingress; **`CheckLocation` bus retired S2-6-DR**) |
| **Occupancy drift repair** | [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) --- consumes **`Room Occupancy Drift Finding`**; ghost disconnect via coordinator; adjacency-only via [`syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) |
| **Ladder maintenance on navigate** | [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) --- asset-chain extend / rewrite-tail / fork; called from [`updatePositionGraphs.ts`](membership/updatePositionGraphs.ts) when `targetRoomId` non-null |
| **Disconnect: purge membership, retain ladder** | [`membership/updatePositionGraphs.ts`](membership/updatePositionGraphs.ts) --- removes graph/adjacency; does **not** update `RoomStack` |
| **Default root frame** | [`../../internalCache/characterMeta.ts`](../../internalCache/characterMeta.ts) --- `[{ asset: 'primitives', RoomId: 'VORTEX' }]` when absent |

**Not the eviction ladder:** [`../state/resolveAssetStackForRoom.ts`](../state/resolveAssetStackForRoom.ts) `resolveRoomAssetStackForRoom` --- room **render participation** order for WML merge (see concepts **Room asset stack**).

**Navigate algorithm:** `membershipRoomStack` compares destination **asset chain** (shallowest accessible room participant, skipping sibling overlays not on the current ladder) to the stored ladder --- **extend** / **rewrite tail** / **fork** per [`AGENT.concepts.md`](AGENT.concepts.md#eviction-ladder-shipped).

### `updatePositionGraphs` transact locking

Character-row and room-row `Update` items inside `transactWrite` use the same `_optimisticUpdateFactory` / `updateReducer` pattern as standalone `optimisticUpdate` (fetch prior state, run immer reducer, conditional write).

- **No explicit `priorFetch` on Update items.** `transactWrite` batch-fetches each row before running reducers; each retry rebuilds transact items so reducers see fresh Dynamo state.
- Ladder maintenance runs in the character-row reducer: `computeRoomStackUpdate` reads `draft.RoomStack` (the fetched prior ladder), not `CharacterMeta` cache.
- `CharacterMeta` remains valid for presentation fields (`Name`, `Color`, `assets`); `invalidate` after apply --- not transact lock snapshots.

### Tests (eviction ladder)

| File | Covers |
| --- | --- |
| [`membership/membershipRoomStack.test.ts`](membership/membershipRoomStack.test.ts) | Extend, rewrite-tail, fork, circus-style overlay trim |
| [`membership/updatePositionGraphs.test.ts`](membership/updatePositionGraphs.test.ts) | `RoomStack` shape on graph persist transact |
| [`../../moveCharacter/index.test.ts`](../../moveCharacter/index.test.ts) | Same-asset replace, child push, parent truncate on navigate |
| [`membership/repairCharacterLegalPlacement.test.ts`](membership/repairCharacterLegalPlacement.test.ts) | Asset visibility trim, relocate, trim-only, forceMove, out-of-play trim-only |
| [`membership/resolveConnectTargetRoom.test.ts`](membership/resolveConnectTargetRoom.test.ts) | Connect target resolution + trim-only persist |

---

## Legacy paths

| Concern | Location |
| --- | --- |
| Legacy API move/home | [`../../parse/executeAction.ts`](../../parse/executeAction.ts) (imperative `MoveCharacter`) |

---

## Storage and cache touchpoints (membership coordinator)

| System | Use |
| --- | --- |
| `ephemeraDB.transactWrite` | `Meta::Room.positionGraph`; adjacency rows; `Meta::Character` `RoomStack` on navigate |
| `internalCache.CharacterMeta` | Presentation fields for roster hydrate; `invalidate` after apply --- not transact lock snapshots |
| `internalCache.ComponentEphemeraMeta.invalidate` | Room meta after roster change |
| `internalCache.AffordanceRoomDeliverable.invalidate` | Affordance compose memo |
| `internalCache.Positions.set` / `invalidate` | Room forward position graph memo (S1-5) |
| `internalCache.RoomCharacterList.set` | Per-room roster memo from coordinator post-apply **`getRoomRoster`** (**S2-6-H**) |
| `internalCache.Positions.setMembershipContainers` | Character reverse containers memo (S1-15) |
| `messageBus.publish` | `RoomUpdate`, `EphemeraUpdate` when `changed` |
| `streamEvent` (required; from DataSource `receiveEvents` or `ephemeraPositionsDataSource` on legacy bus paths) | `Character Moved` when `changed` |

---

## Downstream read paths

| System | Role |
| --- | --- |
| [`../../internalCache/positions.ts`](../../internalCache/positions.ts) | **`Positions`** gateway handler on `internalCache`; **`getRoomRoster`** override hydrates roster |
| [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts) | **`hydrateRoomRosterFromCharacterIds`** --- `CharacterMeta` + `CharacterSessions` compose (**S2-6-H**) |
| [`../../../../packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/) | Room `getPositionGraph` (stored topology); `getMembershipContainers` (adjacency only) |
| [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts) | Navigate parse --- reverse via **`Positions.getMembershipContainers`** |
| [`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts) | Affordance WML compose --- roster via **`Positions.getRoomRoster`** |
| [`../../internalCache/roomCharacterLists.ts`](../../internalCache/roomCharacterLists.ts) | Per-invocation roster memo; **`get`** delegates to **`Positions.getRoomRoster`**; coordinator **`set`** after apply (**S2-6-H**) |
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
