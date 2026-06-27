# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through object membership and cross-host manipulation apply. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance (`publisherStrategy: 'busOnly'`); `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved` + **`Object Moved`** with **`froms[]`** + **`to`**) + stream helpers |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect (membership API + orchestrate) / disconnect handlers |
| [`index.ts`](index.ts) `receiveEvents` | `Character Navigate` / `Character Home` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts); `Object Take Hold` -> [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts) |

### `manipulation/` (adapter + kernel shipped Phase 4a--4c)

Normative layering: [`AGENT.contract.md` --- Manipulation persist layering](AGENT.contract.md#manipulation-persist-layering). Kernel + shared adapter: [`manipulation/AGENT.md`](manipulation/AGENT.md), [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md) (Phase 4c **Done** 2026-06-26). Ingress audit: [`manipulation/AGENT.implementation.md` --- Phase 4c](manipulation/AGENT.implementation.md#phase-4c-ingress-audit-shipped-2026-06-26).

| Path | Role |
| --- | --- |
| [`manipulation/types.ts`](manipulation/types.ts) | `HostEffect`, `MembershipTransferPlan` |
| [`manipulation/adapters/`](manipulation/adapters/) | Shared transfer planner (**M8**): `planMembershipTransfer`, `planObjectTakeHoldTransfer`, `computeEndStateRoomDiff`, `computeTakeHoldDiff` |
| [`manipulation/applyHostEffects.ts`](manipulation/applyHostEffects.ts) | Manipulation kernel (**M5**, **M4**) |
| [`manipulation/membership/`](manipulation/membership/) | Cross-host coordinators (`takeHold`; future `drop`) |
| [`membership/characterRoomMembershipTransactItems.ts`](membership/characterRoomMembershipTransactItems.ts) | Character-on-room graph + adjacency transact builders (kernel reuse) |

#### Relational patch (slice 5+ stub)

| Path | Role |
| --- | --- |
| [`manipulation/applyHostRelationalPatch.ts`](manipulation/applyHostRelationalPatch.ts) | Second kernel primitive: host-local edge add/remove *(file does not exist yet)* |
| [`manipulation/relational/`](manipulation/relational/) | Future per-operator relational coordinators *(directory does not exist yet)* |

Spec: [`manipulation/AGENT.implementation.md` --- Future: host-local relational patch](manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5). Relational operators will follow a **separate** coordinator playbook (to be written at slice 5) --- do not extend the membership coordinator checklist below.

#### `manipulation/membership/` (cross-host object manipulation apply)

| File | Role |
| --- | --- |
| [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts) | **`Object Take Hold`** ingress entry; delegates to coordinator |
| [`manipulation/membership/applyObjectTakeHold.ts`](manipulation/membership/applyObjectTakeHold.ts) | Cross-host membership-changed bundle (fact, cache memo, **`RoomUpdate`**) |
| [`manipulation/membership/types.ts`](manipulation/membership/types.ts) | Cross-host diff + apply result types |
| [`manipulation/membership/characterInventoryTransactItems.ts`](manipulation/membership/characterInventoryTransactItems.ts) | Character-host **`Meta::Character.positionGraph`** + adjacency transact item builders (D16) |

#### Adding a cross-host manipulation apply coordinator

Use when an atomic operator transfers an **`Object`** node between **membership hosts** (v1: room <-> character inventory). Cross-lane hub: [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md). Actions egress playbook: [**Adding an atomic position-manipulation operator**](../actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator).

1. **Authority** --- cross-host membership transfers live under **`positions/manipulation/membership/`**, **not** [`membership/applyObjectRoomMembership.ts`](membership/applyObjectRoomMembership.ts) (room-host-only). Import shared primitives (**`positionGraphMerge`**, **`buildObjectMovedFact`**, transact item builders) --- do not extend room-only entry points.

2. **Ingress** --- register envelope guard in [`subscribedEvents.ts`](subscribedEvents.ts); route in [`index.ts`](index.ts) to **`executeObject*`** entry (pattern: [`executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts)).

3. **Coordinator bundle** --- on **`changed: true`**: stream **`Object Moved`** fact first, memo **`internalCache.Positions`**, invalidate affordance deliverable, publish **`RoomUpdate`** (same register as object room membership). Reference: [`applyObjectTakeHold.ts`](manipulation/membership/applyObjectTakeHold.ts). Contract: [Cross-host object membership-changed bundle](AGENT.contract.md#cross-host-object-membership-changed-bundle-v1-takehold).

4. **Graph transact** --- coordinator -> shared adapter -> **`applyHostEffects`** only. **Must not** add `update*PositionGraphs` forks. Character inventory transact builders: [`characterInventoryTransactItems.ts`](manipulation/membership/characterInventoryTransactItems.ts). Room side reuses room membership transact patterns from [`membership/`](membership/) via kernel.

5. **Fact shape** --- extend [`buildObjectMovedFact.ts`](membership/buildObjectMovedFact.ts) for eligible host ids; **must not** introduce a parallel fact type for membership-only moves.

6. **Per-operator checklist**

| Operator | Host direction | Intent payload | Adapter + kernel | `RoomUpdate` / affordance scope |
| --- | --- | --- | --- | --- |
| **`takeHold`** (shipped) | room -> character | `objectId`, `roomId`, `characterId` | `planObjectTakeHoldTransfer` -> `applyHostEffects` | **`froms`** rooms only |
| **`drop`** (deferred) | character -> room | `objectId`, `roomId`, `characterId` | `planObjectDropTransfer` (future) -> `applyHostEffects` | destination room (+ rooms in **`froms`** if any) |

7. **Tests** --- coordinator unit tests under **`manipulation/membership/*.test.ts`**; routing in [`receivePaths.integration.test.ts`](receivePaths.integration.test.ts) **`Object Take Hold`** describe block.

### `navigate/` (shared execution + post-persist orchestration)

| File | Role |
| --- | --- |
| [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) | Shared navigate execution (membership apply + parallel navigate tail) |
| [`navigate/afterCharacterMembershipNavigateChanged.ts`](navigate/afterCharacterMembershipNavigateChanged.ts) | Parallel tail: `persistRoomStackNavigate` + `orchestrateCharacterNavigate` when `changed && to !== null` |
| [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) | Post-persist presentation (`characterMove` header, render kicks) |

### `membership/` (slice 2 graph persist + fact emit)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipDiff`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/positionGraphMerge.ts`](membership/positionGraphMerge.ts) | Pure graph merge helpers (add/remove character and object nodes, seed from roster; **`effectiveCharacterPositionGraph`**) |
| [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) | Ladder maintenance on navigate (asset-chain extend / rewrite-tail / fork) |
| [`membership/persistRoomStackNavigate.ts`](membership/persistRoomStackNavigate.ts) | Navigate follow-up: `optimisticUpdate` + `mergeRoomStack` at `beatAnchorTime` |
| [`membership/mergeRoomStack.ts`](membership/mergeRoomStack.ts) | Pure timestamp merge for navigate ladder races |
| [`membership/trimEvictionLadder.ts`](membership/trimEvictionLadder.ts) | Pure trim + normalize helpers --- legal placement resolution (connect, asset visibility) |
| [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) | Trim ladder to accessible assets; RS-4 filter-only persist (reducer filters `draft.RoomStack`, preserves survivor `timeWritten`; no merge) |
| [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) | Connect: resolve legal `targetRoomId` from trimmed ladder |
| [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) | Asset visibility: trim + membership apply when in play and endpoint differs |
| [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) | Occupancy drift repair: graph-forward room scan + session gate (**S2-6-DR**) |
| [`membership/syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) | Adjacency-only sync when graph correct but reverse index lags |
| [`membership/objectPlacementTransactItems.ts`](membership/objectPlacementTransactItems.ts) | Shared transact item builders for object graph + adjacency |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: character graph persist, `changed` gate, S1-11 bundle (fact stream first) |
| [`membership/applyObjectRoomMembership.ts`](membership/applyObjectRoomMembership.ts) | Coordinator: object graph persist, `Object Moved` fact, cache seed, `RoomUpdate` |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | Membership host transfer fact payload from **`MembershipDiff`** (F1-8) |
| [`membership/buildObjectMovedFact.ts`](membership/buildObjectMovedFact.ts) | **`Object Moved`** membership host transfer fact payload (I4) |
| [`membership/streamMembershipFact.ts`](membership/streamMembershipFact.ts) | `Character Moved` `streamEvent` at persistence apply |
| [`membership/streamObjectMembershipFact.ts`](membership/streamObjectMembershipFact.ts) | `Object Moved` `streamEvent` at persistence apply |
| [`membership/syncObjectMembershipAdjacency.ts`](membership/syncObjectMembershipAdjacency.ts) | Object adjacency-only sync when graph correct but index lags |
| [`membership/repairObjectPlacementDrift.ts`](membership/repairObjectPlacementDrift.ts) | Object placement drift repair (graph-forward room scan) |

#### Cross-lane ingress (objects lane -> positions coordinator)

Objects lane callers use **`applyObjectRoomMembership`** for graph placement; they do **not** register on positions **`receiveEvents`**. Coordinator semantics (**S1** compensating delete, **S3** batch isolation): [`../objects/spawnImprovisationObjectsBatch.ts`](../objects/spawnImprovisationObjectsBatch.ts), [`../objects/AGENT.md`](../objects/AGENT.md).

| Caller | Entry | Positions coordinator |
| --- | --- | --- |
| Objects spawn (`spawnOneImprovisationObject`) | After `persistSpawnImprovisationObject` | `applyObjectRoomMembership` |
| Objects remove (`applyObjectsChange`) | Graph removal first | `applyObjectRoomMembership` then row delete |

### Tests

| File | Covers |
| --- | --- |
| [`subscribedEvents.test.ts`](subscribedEvents.test.ts) | Guard acceptance/rejection (connections + actions navigate + diagnostics drift finding) |
| [`publishedEvents.test.ts`](publishedEvents.test.ts) | `Character Moved` **`froms[]`** payload guard + stream helpers |
| [`handleConnectionsCharactersPresence.test.ts`](handleConnectionsCharactersPresence.test.ts) | Connect membership apply + navigate tail; disconnect routes through coordinator |
| [`receivePaths.integration.test.ts`](receivePaths.integration.test.ts) | Cross-layer `receiveEvents` routing (connect / disconnect / navigate / home / **`Object Take Hold`** / drift finding) |
| [`manipulation/membership/applyObjectTakeHold.test.ts`](manipulation/membership/applyObjectTakeHold.test.ts) | Cross-host coordinator bundle on `changed` (fact, cache memo, `RoomUpdate`) |
| [`manipulation/membership/executeObjectTakeHold.test.ts`](manipulation/membership/executeObjectTakeHold.test.ts) | **`Object Take Hold`** ingress entry delegates to coordinator |
| [`manipulation/applyHostEffects.test.ts`](manipulation/applyHostEffects.test.ts) | Kernel transact, validation, takeHold-shaped effects |
| [`manipulation/membership/characterInventoryTransactItems.test.ts`](manipulation/membership/characterInventoryTransactItems.test.ts) | Character-host graph + adjacency transact item builders |
| [`membership/membershipRoomStack.test.ts`](membership/membershipRoomStack.test.ts) | Extend / rewrite-tail / fork + circus-style trim |
| [`membership/resolveConnectTargetRoom.test.ts`](membership/resolveConnectTargetRoom.test.ts) | Connect target resolution + trim-only persist |
| [`membership/repairCharacterLegalPlacement.test.ts`](membership/repairCharacterLegalPlacement.test.ts) | Asset visibility legal placement repair |
| [`membership/repairRoomOccupancyDrift.test.ts`](membership/repairRoomOccupancyDrift.test.ts) | Occupancy drift repair (ghost purge, adjacency sync, idempotency) |
| [`membership/syncMembershipAdjacency.test.ts`](membership/syncMembershipAdjacency.test.ts) | Adjacency-only sync transact + memo |
| [`membership/positionGraphMerge.test.ts`](membership/positionGraphMerge.test.ts) | Pure graph merge helpers |
| [`membership/planMembershipTransfer.characterPersist.test.ts`](membership/planMembershipTransfer.characterPersist.test.ts) | Character navigate persist: adapter + kernel transact (graph + adjacency only) |
| [`membership/planMembershipTransfer.objectPersist.test.ts`](membership/planMembershipTransfer.objectPersist.test.ts) | Object room placement persist: adapter + kernel transact |
| [`membership/membershipContainersSharedMemo.test.ts`](membership/membershipContainersSharedMemo.test.ts) | Parse + apply share `getMembershipContainers` memo (slice 1c) |
| [`membership/applyCharacterRoomMembership.test.ts`](membership/applyCharacterRoomMembership.test.ts) | Coordinator bundle on `changed` (fact stream before side effects; multi-from) |
| [`membership/buildCharacterMovedFact.test.ts`](membership/buildCharacterMovedFact.test.ts) | Membership host transfer fact builder (including multi-from) |
| [`membership/persistRoomStackNavigate.test.ts`](membership/persistRoomStackNavigate.test.ts) | Navigate ladder persist + merge reducer |
| [`navigate/afterCharacterMembershipNavigateChanged.test.ts`](navigate/afterCharacterMembershipNavigateChanged.test.ts) | Parallel navigate tail (persist + orchestrate) |
| [`navigate/executeCharacterNavigate.test.ts`](navigate/executeCharacterNavigate.test.ts) | Apply + navigate tail routing |
| [`navigate/orchestrateNavigate.test.ts`](navigate/orchestrateNavigate.test.ts) | Post-persist `characterMove` registration (no `MapUpdate`) |

---

## Registration

- Side-effect import: [`../../app.ts`](../../app.ts) --- `import './dataSource/positions'`.
- EventBridge deserialization for `mtw.connections.characters` is configured in `app.ts` (`eventDeserializers`).

---

## Navigate orchestration (not in `membership/`)

| Concern | Location |
| --- | --- |
| Shared navigate execution (apply + parallel tail) | [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) |
| Parallel navigate tail (ladder persist + orchestrate) | [`navigate/afterCharacterMembershipNavigateChanged.ts`](navigate/afterCharacterMembershipNavigateChanged.ts) |
| Post-persist presentation (targeting-only `characterMove` header, render kicks) | [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) --- args **`froms[]`**, **`to`** |
| Player navigate ingress (stream only) | [`../actions/index.ts`](../actions/index.ts) emits `Character Navigate`; positions executes |
| Leave/arrive world copy (navigate + disconnect + connect) | [`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts) via membership fan-in |

---

## Eviction ladder (`RoomStack` storage)

Concept: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder-shipped) --- character-local state for **legal placement** under asset access. Contract: [`AGENT.contract.md` --- Eviction ladder](AGENT.contract.md#eviction-ladder-roomstack-storage).

| Concern | Location |
| --- | --- |
| **Storage** | `Meta::Character.RoomStack` --- array of `{ asset, RoomId, timeWritten? }` ([`membership/types.ts`](membership/types.ts) `RoomStackItem`; `timeWritten` = epoch ms from navigate `beatAnchorTime`, omitted/0 = legacy) |
| **Legal placement: connect (from nowhere)** | [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) + [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts) |
| **Legal placement: asset visibility (from illegal room)** | [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) when in play (future asset-visibility ingress; **`CheckLocation` bus retired S2-6-DR**) |
| **Occupancy drift repair** | [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) --- consumes **`Room Occupancy Drift Finding`**; ghost disconnect via coordinator; adjacency-only via [`syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) |
| **Ladder maintenance on navigate** | [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) algorithm + [`membership/persistRoomStackNavigate.ts`](membership/persistRoomStackNavigate.ts) async persist via [`navigate/afterCharacterMembershipNavigateChanged.ts`](navigate/afterCharacterMembershipNavigateChanged.ts) parallel tail (not kernel transact) |
| **Navigate ladder merge (timestamp races)** | [`membership/mergeRoomStack.ts`](membership/mergeRoomStack.ts) --- consumed by `persistRoomStackNavigate` |
| **Disconnect: purge membership, retain ladder** | Coordinator + kernel --- graph/adjacency only; no navigate ladder persist |
| **Default root frame** | [`membership/trimEvictionLadder.ts`](membership/trimEvictionLadder.ts) `DEFAULT_ROOM_STACK` --- shared by guest character, `CharacterMeta` cache fallback, and `normalizeRoomStack` (omits `timeWritten` = legacy 0) |

**Not the eviction ladder:** [`../state/resolveAssetStackForRoom.ts`](../state/resolveAssetStackForRoom.ts) `resolveRoomAssetStackForRoom` --- room **render participation** order for WML merge (see concepts **Room asset stack**).

**Navigate algorithm:** `membershipRoomStack` compares destination **asset chain** (shallowest accessible room participant, skipping sibling overlays not on the current ladder) to the stored ladder --- **extend** / **rewrite tail** / **fork** per [`AGENT.concepts.md`](AGENT.concepts.md#eviction-ladder-shipped).

**Navigate persist:** after successful graph persist, callers run [`afterCharacterMembershipNavigateChanged`](navigate/afterCharacterMembershipNavigateChanged.ts) --- `Promise.all([persistRoomStackNavigate, orchestrateCharacterNavigate])`. Ladder writes use standalone `optimisticUpdate` with `mergeRoomStack` at `beatAnchorTime`; failures log and resolve (RS-3). **Trim persist:** filter-only `optimisticUpdate` on `draft.RoomStack` (RS-4); no merge. Normative contract update deferred to Phase 4 ([`AGENT.roomStackRefactor.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.roomStackRefactor.planning.md)).

### Navigate ladder persist locking

Navigate ladder `optimisticUpdate` fetches prior `RoomStack` from Dynamo inside the reducer (not `CharacterMeta` cache --- apply invalidates cache before the parallel tail). `CharacterMeta` remains valid for presentation fields on the pre-apply snapshot passed to orchestrate.

### Tests (eviction ladder)

| File | Covers |
| --- | --- |
| [`membership/membershipRoomStack.test.ts`](membership/membershipRoomStack.test.ts) | Extend, rewrite-tail, fork, circus-style overlay trim (incl. `timeWritten` preservation), `buildProposedRoomStackForNavigate` |
| [`membership/mergeRoomStack.test.ts`](membership/mergeRoomStack.test.ts) | Timestamp merge: out-of-order navigate, fork truncate, stale resurrection block, legacy rows |
| [`membership/persistRoomStackNavigate.test.ts`](membership/persistRoomStackNavigate.test.ts) | Navigate ladder persist reducer + merge + failure tolerance |
| [`membership/trimPersistCharacterRoomStack.test.ts`](membership/trimPersistCharacterRoomStack.test.ts) | RS-4 trim persist: survivor `timeWritten`, filter-only reducer, draft-at-write-time |
| [`membership/planMembershipTransfer.characterPersist.test.ts`](membership/planMembershipTransfer.characterPersist.test.ts) | Graph + adjacency kernel transact (no RoomStack bundle) |
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
| `ephemeraDB.transactWrite` | `Meta::Room.positionGraph`; adjacency rows |
| `ephemeraDB.optimisticUpdate` | `Meta::Character.RoomStack` on navigate (parallel tail) and trim-only connect paths |
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
| [`../../../../packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/) | Room + character `getPositionGraph` (stored topology); `getMembershipContainers` (adjacency only) |
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
