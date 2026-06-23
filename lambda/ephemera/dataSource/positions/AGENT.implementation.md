# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through slice **4** (object membership). Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance (`publisherStrategy: 'busOnly'`); `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved` + **`Object Moved`** with **`froms[]`** + **`to`**) + stream helpers |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect (membership API + orchestrate) / disconnect handlers |
| [`index.ts`](index.ts) `receiveEvents` | `Character Navigate` / `Character Home` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts); `Object Take Hold` -> [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts) (stub) |

### `manipulation/membership/` (object manipulation ingress --- stub Phase 3)

| File | Role |
| --- | --- |
| [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts) | **`Object Take Hold`** execution entry (no-op stub until Phase 4 graph apply) |

### `navigate/` (shared execution + post-persist orchestration)

| File | Role |
| --- | --- |
| [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) | Shared navigate execution (membership apply + orchestrate when `changed`) |
| [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) | Post-persist presentation (`characterMove` header, render kicks) |

### `membership/` (slice 2 graph persist + fact emit)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipDiff`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/positionGraphMerge.ts`](membership/positionGraphMerge.ts) | Pure graph merge helpers (add/remove character and object nodes, seed from roster) |
| [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) | Ladder maintenance on navigate (asset-chain extend / rewrite-tail / fork) |
| [`membership/trimEvictionLadder.ts`](membership/trimEvictionLadder.ts) | Pure trim + normalize helpers --- legal placement resolution (connect, asset visibility) |
| [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) | Trim ladder to accessible assets; persist trim-only when shape changes |
| [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) | Connect: resolve legal `targetRoomId` from trimmed ladder |
| [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) | Asset visibility: trim + membership apply when in play and endpoint differs |
| [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) | Occupancy drift repair: graph-forward room scan + session gate (**S2-6-DR**) |
| [`membership/syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) | Adjacency-only sync when graph correct but reverse index lags |
| [`membership/updatePositionGraphs.ts`](membership/updatePositionGraphs.ts) | **Character graph persist engine** (S2-4 end-state apply, adjacency only; **S2-6**) |
| [`membership/updateObjectPositionGraphs.ts`](membership/updateObjectPositionGraphs.ts) | **Object graph persist engine** (Phase 4; end-state apply, adjacency only) |
| [`membership/objectPlacementTransactItems.ts`](membership/objectPlacementTransactItems.ts) | Shared transact item builders for object graph + adjacency |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: character graph persist, `changed` gate, S1-11 bundle (fact stream first) |
| [`membership/applyObjectRoomMembership.ts`](membership/applyObjectRoomMembership.ts) | Coordinator: object graph persist, `Object Moved` fact, cache seed, `RoomUpdate` |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | Graph-diff fact payload from **`MembershipDiff`** (F1-8) |
| [`membership/buildObjectMovedFact.ts`](membership/buildObjectMovedFact.ts) | **`Object Moved`** graph-diff fact payload (I4) |
| [`membership/streamMembershipFact.ts`](membership/streamMembershipFact.ts) | `Character Moved` `streamEvent` at persistence apply |
| [`membership/streamObjectMembershipFact.ts`](membership/streamObjectMembershipFact.ts) | `Object Moved` `streamEvent` at persistence apply |
| [`membership/syncObjectMembershipAdjacency.ts`](membership/syncObjectMembershipAdjacency.ts) | Object adjacency-only sync when graph correct but index lags |
| [`membership/repairObjectPlacementDrift.ts`](membership/repairObjectPlacementDrift.ts) | Object placement drift repair (graph-forward room scan) |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection (connections + actions navigate + diagnostics drift finding) |
| [`publishedEvents.test.ts`](publishedEvents.test.ts) | `Character Moved` **`froms[]`** payload guard + stream helpers |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect membership apply + orchestrate; disconnect routes through coordinator |
| [`receivePaths.integration.test.ts`](receivePaths.integration.test.ts) | Cross-layer `receiveEvents` routing (connect / disconnect / navigate / home / drift finding) |
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
| [`navigate/executeCharacterNavigate.test.ts`](navigate/executeCharacterNavigate.test.ts) | Apply + orchestrate routing on `changed` |
| [`navigate/orchestrateNavigate.test.ts`](navigate/orchestrateNavigate.test.ts) | Post-persist `characterMove` registration (no `MapUpdate`) |

---

## Registration

- Side-effect import: [`../../app.ts`](../../app.ts) --- `import './dataSource/positions'`.
- EventBridge deserialization for `mtw.connections.characters` is configured in `app.ts` (`eventDeserializers`).

---

## Navigate orchestration (not in `membership/`)

| Concern | Location |
| --- | --- |
| Shared navigate execution (persist + orchestrate) | [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| Post-persist presentation (targeting-only `characterMove` header, render kicks) | [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) --- args **`froms[]`**, **`to`** |
| Player navigate ingress (stream only) | [`../actions/index.ts`](../actions/index.ts) emits `Character Navigate`; positions executes |
| Leave/arrive world copy (navigate + disconnect + connect) | [`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts) via membership fan-in |

---

## Eviction ladder (`RoomStack` storage)

Concept: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder-shipped) --- character-local state for **legal placement** under asset access. Contract: [`AGENT.contract.md` --- Eviction ladder](AGENT.contract.md#eviction-ladder-roomstack-storage).

| Concern | Location |
| --- | --- |
| **Storage** | `Meta::Character.RoomStack` --- array of `{ asset, RoomId }` ([`membership/types.ts`](membership/types.ts) `RoomStackItem`) |
| **Legal placement: connect (from nowhere)** | [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) + [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts) |
| **Legal placement: asset visibility (from illegal room)** | [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) when in play (future asset-visibility ingress; **`CheckLocation` bus retired S2-6-DR**) |
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
| [`membership/updatePositionGraphs.test.ts`](membership/updatePositionGraphs.test.ts) | `RoomStack` shape on graph persist transact (same-asset replace, child push, parent truncate) |
| [`membership/repairCharacterLegalPlacement.test.ts`](membership/repairCharacterLegalPlacement.test.ts) | Asset visibility trim, relocate, trim-only, forceMove, out-of-play trim-only |
| [`membership/resolveConnectTargetRoom.test.ts`](membership/resolveConnectTargetRoom.test.ts) | Connect target resolution + trim-only persist |

---

## Legacy paths

| Concern | Location |
| --- | --- |
| Legacy API move | [`../routeTrustedUiAction.ts`](../routeTrustedUiAction.ts) (`Action Assessed` **`Navigation`** for UI exits) |
| Legacy API home | [`../routeTrustedUiAction.ts`](../routeTrustedUiAction.ts) (`Action Assessed` **`Home`**, `source: 'uiHome'`) |

---

## Storage and cache touchpoints (membership coordinator)

| System | Use |
| --- | --- |
| `ephemeraDB.transactWrite` | `Meta::Room.positionGraph`; adjacency rows; `Meta::Character` `RoomStack` on navigate |
| `internalCache.CharacterMeta` | Presentation fields for roster hydrate; `invalidate` after apply --- not transact lock snapshots |
| `internalCache.ComponentEphemeraMeta.invalidate` | Room meta after roster change |
| `internalCache.AffordanceRoomDeliverable.invalidate` | Affordance compose memo |
| `internalCache.Positions.set` | Room forward position graph memo from **`postApplyRoomGraphs`** (**S2-6-H**) |
| `internalCache.Positions.setMembershipContainers` | Character reverse containers memo (S1-15) |
| `messageBus.publish` | `RoomUpdate`, `EphemeraUpdate` when `changed` |
| `streamEvent` (required; from DataSource `receiveEvents`) | `Character Moved` when `changed` |

---

## Downstream read paths

Manipulation truth (`positionGraph`, adjacency) vs presentation compose (hydrated roster, affordance wire): [`AGENT.concepts.md`](AGENT.concepts.md#graph-roles-shared-shape-different-authority).

| System | Role |
| --- | --- |
| [`../../internalCache/index.ts`](../../internalCache/index.ts) | **`internalCache.Positions`** via **`createPositionsCacheHandler(ephemeraDB)`** (topology + adjacency memo) |
| [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts) | **`hydrateRoomRosterFromCharacterIds`**, **`getRoomCharacterList`** --- derive-on-call roster assembler (**S2-6-H**) |
| [`../../../../packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/) | Room `getPositionGraph` (stored topology); `getMembershipContainers` (adjacency only) |
| [`../actions/roomExitTargetsForCharacter.ts`](../actions/roomExitTargetsForCharacter.ts) | Navigate parse --- reverse via **`Positions.getMembershipContainers`** |
| [`../../internalCache/affordanceRoomDeliverable.ts`](../../internalCache/affordanceRoomDeliverable.ts) | Affordance WML compose --- roster via **`getRoomCharacterList`** |
| [`../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) | Exits projection (gateway + `internalCache`) |
| [`../perception/membershipPresentationLegAdapters.ts`](../perception/membershipPresentationLegAdapters.ts) | Fan-in fact leg consumer for **`Character Moved`** |

---

## Verification

From repo root:

```bash
npm --prefix lambda/ephemera run test -- --watchAll=false \
  dataSource/positions/ \
  dataSource/perception/ \
  dataSource/actions/index.test.ts

npm --prefix packages/mtw-gateways run test -- --watchAll=false ts/ephemera/positions/
```
