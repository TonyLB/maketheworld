# Positions --- implementation map

This file records **where behavior lives** for `mtw.ephemera.positions` through object membership and cross-host manipulation apply. Contracts: [`AGENT.contract.md`](AGENT.contract.md). Concepts: [`AGENT.concepts.md`](AGENT.concepts.md).

---

## This folder

| File | Role |
| --- | --- |
| [`index.ts`](index.ts) | `EphemeraDataSource` instance (`publisherStrategy: 'busOnly'`); `receiveEvents` dispatches by envelope type |
| [`subscribedEvents.ts`](subscribedEvents.ts) | Header/envelope guards for external ingress |
| [`publishedEvents.ts`](publishedEvents.ts) | Outbound stream contract (`Character Moved` + **`Object Moved`** + **`Object Relation Changed`**) + stream helpers |
| [`handleConnectionsCharactersPresence.ts`](handleConnectionsCharactersPresence.ts) | Connect (membership API + orchestrate) / disconnect handlers |
| [`index.ts`](index.ts) `receiveEvents` | `Character Navigate` / `Character Home` -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts); `Object Take Hold` -> [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts); `Object Drop` -> [`manipulation/membership/executeObjectDrop.ts`](manipulation/membership/executeObjectDrop.ts); `Object Establish Relation` / `Object Dissolve Relation` -> [`manipulation/relational/`](manipulation/relational/) |

### `manipulation/` (planning adapters + kernel)

Normative layering: [`AGENT.contract.md` --- Manipulation persist layering](AGENT.contract.md#manipulation-persist-layering). Kernel + shared adapter: [`manipulation/AGENT.md`](manipulation/AGENT.md), [`manipulation/AGENT.implementation.md`](manipulation/AGENT.implementation.md). Shared play graph primitive: [`positionGraph/`](#positiongraph-play-manipulation-model) below. Per-route ingress map: [`manipulation/AGENT.implementation.md` --- Per-route ingress map](manipulation/AGENT.implementation.md#per-route-ingress-map).

| Path | Role |
| --- | --- |
| [`manipulation/types.ts`](manipulation/types.ts) | `MembershipTransferProjection`, `MembershipTransferPlan`, `HostRelationalEdge`, `HostRelationalPatch` |
| [`manipulation/adapters/`](manipulation/adapters/) | Shared room-host transfer planner: `planMembershipTransfer`, `computeEndStateRoomDiff`, `planObjectClearFromAllHosts` |
| [`manipulation/kernel/`](manipulation/kernel/) | The one persist kernel --- `commitStepSequence`, `applyStepSequenceCore`, `kernelStep`, `computeStepSequenceFootprint`, `factsForStep`, plus the read-only `perceiveStepSequence` |
| [`manipulation/membership/`](manipulation/membership/) | Cross-host ingress (`takeHold`, `drop`) + destroy/edit clear |

#### Relational patch

| Path | Role |
| --- | --- |
| [`manipulation/relational/`](manipulation/relational/) | Relational coordinators (`establish` / `dissolve`) |
| [`manipulation/relational/applyObjectRelationalChange.ts`](manipulation/relational/applyObjectRelationalChange.ts) | Builds the relational step sequence (including repair carries) and commits it |

Spec: [`manipulation/AGENT.implementation.md` --- Host-local relational patch](manipulation/AGENT.implementation.md#host-local-relational-patch).

#### `manipulation/membership/` (cross-host object manipulation apply)

| File | Role |
| --- | --- |
| [`manipulation/membership/executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts) | **`Object Take Hold`**: runs the Synthesize executor at execute time, commits the step sequence |
| [`manipulation/membership/executeObjectDrop.ts`](manipulation/membership/executeObjectDrop.ts) | **`Object Drop`**: the same, character -> room |
| [`manipulation/membership/applyObjectClearMembership.ts`](manipulation/membership/applyObjectClearMembership.ts) | Destroy/edit clear: explicit boundary sweep + `dissolveRelation` + end-state-to-null transfer |
| [`manipulation/membership/types.ts`](manipulation/membership/types.ts) | `ObjectMembershipDiff` + clear-membership apply result |

#### Adding a cross-host manipulation apply coordinator

Use when an atomic operator transfers an **`Object`** node between **membership hosts** (v1: room <-> character inventory). Cross-lane hub: [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md). Actions egress playbook: [**Adding an atomic position-manipulation operator**](../actions/AGENT.implementation.md#adding-an-atomic-position-manipulation-operator).

1. **Authority** --- cross-host membership transfers live under **`positions/manipulation/membership/`**, **not** [`membership/applyObjectRoomMembership.ts`](membership/applyObjectRoomMembership.ts) (room-host-only). Import shared primitives (**[`positionGraph/`](positionGraph/)**, **`buildObjectMovedFact`**, transact item builders) --- do not extend room-only entry points.

2. **Ingress** --- register envelope guard in [`subscribedEvents.ts`](subscribedEvents.ts); route in [`index.ts`](index.ts) to **`executeObject*`** entry (pattern: [`executeObjectTakeHold.ts`](manipulation/membership/executeObjectTakeHold.ts)).

3. **Post-persist bundle** --- do **not** write one. The kernel already streams **`Object Moved`** first, seeds **`internalCache.Positions`** on every committed graph, invalidates the affordance deliverable for Room hosts, and publishes **`RoomUpdate`**. Add only what is genuinely verb-specific. Contract: [Cross-host object membership-changed bundle (`takeHold`)](AGENT.contract.md#cross-host-object-membership-changed-bundle-takehold), [Cross-host object membership-changed bundle (`drop`)](AGENT.contract.md#cross-host-object-membership-changed-bundle-drop).

4. **Graph transact** --- plan (shared adapter, or the Synthesize executor when the operator needs live grounding), then **`commitStepSequence`** only. **Must not** add `update*PositionGraphs` forks or a route-specific wrapper over the kernel.

5. **Fact shape** --- extend [`buildObjectMovedFact.ts`](membership/buildObjectMovedFact.ts) for eligible host ids; **must not** introduce a parallel fact type for membership-only moves.

6. **Per-operator checklist**

| Operator | Host direction | Intent payload | Planning + kernel | `RoomUpdate` / affordance scope |
| --- | --- | --- | --- | --- |
| **`takeHold`** | room -> character | `objectIds`, `roomId`, `characterId` | Synthesize executor -> `commitStepSequence` | Room hosts only |
| **`drop`** | character -> room | `objectIds`, `roomId`, `characterId` | Synthesize executor -> `commitStepSequence` | destination room |

7. **Tests** --- ingress unit tests under **`manipulation/membership/*.test.ts`**; routing in [`receivePaths.integration.test.ts`](receivePaths.integration.test.ts) **`Object Take Hold`** and **`Object Drop`** describe blocks.

### `positionGraph/` (play manipulation model)

Host-bound **`EphemeraPositionGraph`** class --- membership + relational simulation; sole in-memory primitive for kernel, transact reducers, and read-only actions observation. Spec: [`positionGraph/AGENT.md`](positionGraph/AGENT.md).

| File | Role |
| --- | --- |
| [`positionGraph/index.ts`](positionGraph/index.ts) | **`EphemeraPositionGraph` class** + factories (`fromRoomMeta`, `fromCharacterMeta`, `seedFromActiveCharacters`) |
| [`positionGraph/baseClasses.ts`](positionGraph/baseClasses.ts) | **`HostRelationalEdge`** parsed view; relational parse/match/serialize helpers |
| [`positionGraph/index.test.ts`](positionGraph/index.test.ts) | Unit tests |

**Import map:**

```text
positionGraph/  <-- shared primitive
  ^-- manipulation/kernel/ (applyStepSequenceCore simulation; graphFromMeta + toStored at the Dynamo boundary)
  ^-- manipulation/relational/ (edge helpers, edgesMatch)
  ^-- actions/enrich/objectManipulation/evaluateRelationalLegality, compileRelationalFromSkeleton (read-only)
  ^-- actions/enrich/objectManipulation/synthesize/ (selection-time sandbox; shares applyTransferSet with the kernel)
```

### `navigate/` (shared execution + post-persist orchestration)

| File | Role |
| --- | --- |
| [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) | Shared navigate execution (membership apply + parallel navigate tail) |
| [`navigate/afterCharacterMembershipNavigateChanged.ts`](navigate/afterCharacterMembershipNavigateChanged.ts) | Parallel tail: `persistRoomStackNavigate` + `orchestrateCharacterNavigate` when `changed && to !== null` |
| [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) | Post-persist presentation (arrival-room header slot, render kicks) |

### `membership/` (graph persist + fact emit)

| File | Role |
| --- | --- |
| [`membership/types.ts`](membership/types.ts) | `MembershipApplyArgs`, `MembershipDiff`, `MembershipApplyResult`, `RoomStackItem` |
| [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) | Ladder maintenance on navigate (asset-chain extend / rewrite-tail / fork) |
| [`membership/persistRoomStackNavigate.ts`](membership/persistRoomStackNavigate.ts) | Navigate follow-up: `optimisticUpdate` + `mergeRoomStack` at `beatAnchorTime` |
| [`membership/mergeRoomStack.ts`](membership/mergeRoomStack.ts) | Pure timestamp merge for navigate ladder races |
| [`membership/trimEvictionLadder.ts`](membership/trimEvictionLadder.ts) | Pure trim + normalize helpers --- legal placement resolution (connect, asset visibility) |
| [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) | Trim ladder to accessible assets; Filter-only persist (reducer filters `draft.RoomStack`, preserves survivor `timeWritten`; no merge) |
| [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) | Connect: resolve legal `targetRoomId` from trimmed ladder |
| [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) | Asset visibility: trim + membership apply when in play and endpoint differs |
| [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) | Occupancy drift repair: graph-forward room scan + session gate |
| [`membership/syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) | Adjacency-only sync when graph correct but reverse index lags |
| [`membership/applyCharacterRoomMembership.ts`](membership/applyCharacterRoomMembership.ts) | Coordinator: character graph persist, `changed` gate, membership-changed bundle (fact stream first) |
| [`membership/applyObjectRoomMembership.ts`](membership/applyObjectRoomMembership.ts) | Coordinator: object graph persist, `Object Moved` fact, cache seed, `RoomUpdate` |
| [`membership/buildCharacterMovedFact.ts`](membership/buildCharacterMovedFact.ts) | Membership host transfer fact payload from **`MembershipDiff`** |
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
| [`receivePaths.integration.test.ts`](receivePaths.integration.test.ts) | Cross-layer `receiveEvents` routing (connect / disconnect / navigate / home / **`Object Take Hold`** / **`Object Drop`** / drift finding) |
| [`manipulation/membership/executeObjectTakeHold.test.ts`](manipulation/membership/executeObjectTakeHold.test.ts) | **`Object Take Hold`**: executor grounding + committed step sequence |
| [`manipulation/membership/executeObjectDrop.test.ts`](manipulation/membership/executeObjectDrop.test.ts) | **`Object Drop`**: the same, character -> room |
| [`manipulation/membership/applyObjectClearMembership.test.ts`](manipulation/membership/applyObjectClearMembership.test.ts) | Destroy/edit clear: boundary sweep, dissolve steps, end-state-to-null transfer |
| [`manipulation/kernel/applyStepSequenceCore.test.ts`](manipulation/kernel/applyStepSequenceCore.test.ts), [`manipulation/kernel/commitStepSequence.test.ts`](manipulation/kernel/commitStepSequence.test.ts) | Kernel transact, validation, entity-kind-general (object + character) transfer/dissolve/establish shapes |
| [`membership/membershipRoomStack.test.ts`](membership/membershipRoomStack.test.ts) | Extend / rewrite-tail / fork + circus-style trim |
| [`membership/resolveConnectTargetRoom.test.ts`](membership/resolveConnectTargetRoom.test.ts) | Connect target resolution + trim-only persist |
| [`membership/repairCharacterLegalPlacement.test.ts`](membership/repairCharacterLegalPlacement.test.ts) | Asset visibility legal placement repair |
| [`membership/repairRoomOccupancyDrift.test.ts`](membership/repairRoomOccupancyDrift.test.ts) | Occupancy drift repair (ghost purge, adjacency sync, idempotency) |
| [`membership/syncMembershipAdjacency.test.ts`](membership/syncMembershipAdjacency.test.ts) | Adjacency-only sync transact + memo |
| [`positionGraph/index.test.ts`](positionGraph/index.test.ts) | **`EphemeraPositionGraph`** class: membership nodes, relational edges, factories, serialization |
| [`membership/membershipContainersSharedMemo.test.ts`](membership/membershipContainersSharedMemo.test.ts) | Parse + apply share `getMembershipContainers` memo (slice 1c) |
| [`membership/applyCharacterRoomMembership.test.ts`](membership/applyCharacterRoomMembership.test.ts) | Coordinator bundle on `changed` (bare `transferMembership` step, no dissolve; multi-from); `Character Moved` fact-stream-before-`RoomUpdate` ordering is verified at the kernel layer, `commitStepSequence.test.ts` |
| [`membership/buildCharacterMovedFact.test.ts`](membership/buildCharacterMovedFact.test.ts) | Membership host transfer fact builder (including multi-from) |
| [`membership/persistRoomStackNavigate.test.ts`](membership/persistRoomStackNavigate.test.ts) | Navigate ladder persist + merge reducer |
| [`navigate/afterCharacterMembershipNavigateChanged.test.ts`](navigate/afterCharacterMembershipNavigateChanged.test.ts) | Parallel navigate tail (persist + orchestrate) |
| [`navigate/executeCharacterNavigate.test.ts`](navigate/executeCharacterNavigate.test.ts) | Apply + navigate tail routing |
| [`navigate/orchestrateNavigate.test.ts`](navigate/orchestrateNavigate.test.ts) | Post-persist bundle declare + header slot registration (no `MapUpdate`) |

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
| Post-persist presentation (arrival-room header slot, render kicks) | [`navigate/orchestrateNavigate.ts`](navigate/orchestrateNavigate.ts) --- args **`froms[]`**, **`to`** |
| Player navigate ingress (stream only) | [`../actions/index.ts`](../actions/index.ts) emits `Character Navigate`; positions executes |
| Leave/arrive world copy (navigate + disconnect + connect) | [`../perception/publishMembershipPresentation.ts`](../perception/publishMembershipPresentation.ts) via membership fan-in |

---

## Eviction ladder (`RoomStack` storage)

Concept: [**Eviction ladder**](AGENT.concepts.md#eviction-ladder) --- character-local state for **legal placement** under asset access. Contract: [`AGENT.contract.md` --- Eviction ladder](AGENT.contract.md#eviction-ladder-roomstack-storage).

| Concern | Location |
| --- | --- |
| **Storage** | `Meta::Character.RoomStack` --- array of `{ asset, RoomId, timeWritten? }` ([`membership/types.ts`](membership/types.ts) `RoomStackItem`; `timeWritten` = epoch ms from navigate `beatAnchorTime`, omitted/0 = legacy) |
| **Legal placement: connect (from nowhere)** | [`membership/trimPersistCharacterRoomStack.ts`](membership/trimPersistCharacterRoomStack.ts) + [`membership/resolveConnectTargetRoom.ts`](membership/resolveConnectTargetRoom.ts) -> [`applyCharacterRoomMembership`](membership/applyCharacterRoomMembership.ts) |
| **Legal placement: asset visibility (from illegal room)** | [`membership/repairCharacterLegalPlacement.ts`](membership/repairCharacterLegalPlacement.ts) -> [`navigate/executeCharacterNavigate.ts`](navigate/executeCharacterNavigate.ts) when in play (future asset-visibility ingress; **`CheckLocation`** bus retired) |
| **Occupancy drift repair** | [`membership/repairRoomOccupancyDrift.ts`](membership/repairRoomOccupancyDrift.ts) --- consumes **`Room Occupancy Drift Finding`**; ghost disconnect via coordinator; adjacency-only via [`syncMembershipAdjacency.ts`](membership/syncMembershipAdjacency.ts) |
| **Ladder maintenance on navigate** | [`membership/membershipRoomStack.ts`](membership/membershipRoomStack.ts) algorithm + [`membership/persistRoomStackNavigate.ts`](membership/persistRoomStackNavigate.ts) async persist via [`navigate/afterCharacterMembershipNavigateChanged.ts`](navigate/afterCharacterMembershipNavigateChanged.ts) parallel tail (not kernel transact) |
| **Navigate ladder merge (timestamp races)** | [`membership/mergeRoomStack.ts`](membership/mergeRoomStack.ts) --- consumed by `persistRoomStackNavigate` |
| **Disconnect: purge membership, retain ladder** | Coordinator + kernel --- graph/adjacency only; no navigate ladder persist |
| **Default root frame** | [`membership/trimEvictionLadder.ts`](membership/trimEvictionLadder.ts) `DEFAULT_ROOM_STACK` --- shared by guest character, `CharacterMeta` cache fallback, and `normalizeRoomStack` (omits `timeWritten` = legacy 0) |

**Not the eviction ladder:** [`../state/resolveAssetStackForRoom.ts`](../state/resolveAssetStackForRoom.ts) `resolveRoomAssetStackForRoom` --- room **render participation** order for WML merge (see concepts **Room asset stack**).

**Navigate algorithm:** `membershipRoomStack` compares destination **asset chain** (shallowest accessible room participant, skipping sibling overlays not on the current ladder) to the stored ladder --- **extend** / **rewrite tail** / **fork** per [`AGENT.concepts.md`](AGENT.concepts.md#eviction-ladder).

**Navigate persist:** after successful graph persist, callers run [`afterCharacterMembershipNavigateChanged`](navigate/afterCharacterMembershipNavigateChanged.ts) --- `Promise.all([persistRoomStackNavigate, orchestrateCharacterNavigate])`. Ladder writes use standalone `optimisticUpdate` with `mergeRoomStack` at `beatAnchorTime`; failures log and resolve. **Trim persist:** filter-only `optimisticUpdate` on `draft.RoomStack`; no merge. Normative rules: [`AGENT.contract.md` --- Eviction ladder](AGENT.contract.md#eviction-ladder-roomstack-storage).

### Navigate ladder persist locking

Navigate ladder `optimisticUpdate` fetches prior `RoomStack` from Dynamo inside the reducer (not `CharacterMeta` cache --- apply invalidates cache before the parallel tail). `CharacterMeta` remains valid for presentation fields on the pre-apply snapshot passed to orchestrate.

### Tests (eviction ladder)

| File | Covers |
| --- | --- |
| [`membership/membershipRoomStack.test.ts`](membership/membershipRoomStack.test.ts) | Extend, rewrite-tail, fork, circus-style overlay trim (incl. `timeWritten` preservation), `buildProposedRoomStackForNavigate` |
| [`membership/mergeRoomStack.test.ts`](membership/mergeRoomStack.test.ts) | Timestamp merge: out-of-order navigate, fork truncate, stale resurrection block, legacy rows |
| [`membership/persistRoomStackNavigate.test.ts`](membership/persistRoomStackNavigate.test.ts) | Navigate ladder persist reducer + merge + failure tolerance |
| [`membership/trimPersistCharacterRoomStack.test.ts`](membership/trimPersistCharacterRoomStack.test.ts) | Trim persist: survivor `timeWritten`, filter-only reducer, draft-at-write-time |
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
| `internalCache.Positions.set` | Forward position graph memo from **`postApplyGraphs`** (**`EphemeraPositionGraph`**) |
| `internalCache.Positions.setMembershipContainers` | Character reverse containers memo |
| `messageBus.publish` | `RoomUpdate`, `EphemeraUpdate` when `changed` |
| `streamEvent` (required; from DataSource `receiveEvents`) | `Character Moved` when `changed` |

---

## Downstream read paths

Manipulation truth (`positionGraph`, adjacency) vs presentation compose (hydrated roster, affordance wire): [`AGENT.concepts.md`](AGENT.concepts.md#graph-roles-shared-shape-different-authority).

| System | Role |
| --- | --- |
| [`../../internalCache/index.ts`](../../internalCache/index.ts) | **`internalCache.Positions`** via **`EphemeraPositionsCacheData`** ([`../../internalCache/positionsCache.ts`](../../internalCache/positionsCache.ts)) --- class in/out memo over gateway handler |
| [`../../internalCache/hydrateRoomRoster.ts`](../../internalCache/hydrateRoomRoster.ts) | **`hydrateRoomRosterFromCharacterIds`**, **`getRoomCharacterList`** --- derive-on-call roster assembler |
| [`../../../../packages/mtw-gateways/ts/ephemera/positions/`](../../../../packages/mtw-gateways/ts/ephemera/positions/) | Underlying **`PlayPositionGraph`** load/persist; ephemera callers use wrapper only |
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
