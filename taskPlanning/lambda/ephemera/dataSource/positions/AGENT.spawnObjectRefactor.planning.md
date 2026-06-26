# Spawn object refactor (two-step existence + placement)

**Status:** Phase 4 complete (durable docs). **Next:** Phase 5 close.

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability ladder, open decisions, recommended-order checkboxes). **Dispose** after the initiative ships and lasting rules live in [`lambda/ephemera/dataSource/objects/`](../../../../../lambda/ephemera/dataSource/objects/) and [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) `AGENT*.md` siblings.

---

## Purpose

Replace the **spawn + place bundle** --- one Dynamo `transactWrite` spanning objects-lane rows and positions-lane graph/adjacency --- with a **two-step** coordinator:

1. **Existence (objects lane):** atomically create `(OBJECT#, ASSET#IMPROVISATION)` pair + `(OBJECT#, Meta::Object)` via [`persistSpawnImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts).
2. **Placement (positions lane):** atomically add the object to the target room via [`applyObjectRoomMembership`](../../../../../lambda/ephemera/dataSource/positions/membership/applyObjectRoomMembership.ts) -> shared adapter -> [`applyHostEffects`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts).

**Why now:** Phase 4c shipped the manipulation kernel + adapter for all membership-transfer ingress. The legacy spawn bundle bypassed the kernel via a single cross-lane transact and [`postApplyGraphProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/postApplyGraphProjection.ts) for cache seeding. Splitting existence and placement lets spawn use the **same** positions coordinator as place/remove without a kernel transact-composition extension.

**Non-goals for this initiative:**

- Changing the **remove** path (already two-step: graph via `applyObjectRoomMembership`, then row delete).
- Relational in-room edges (slice 5+).
- Deferred **`drop`** operator ([`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md)).

---

## Problem statement (historical)

Before Phase 1, the spawn bundle inlined pair + `Meta::Object` puts, direct `buildObjectPlacementTransactItems`, hand-built `MembershipDiff`, `computePostApplyObjectRoomGraphs` for cache seeding (kernel bypass), and duplicated `Object Moved` / cache / `RoomUpdate` bundle logic in a single cross-lane transact.

The contract required a **single transact** across both lanes (**I1** / **I5** in [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md)). That cross-domain atomicity was a **policy choice**, not a read-model requirement: manipulation catalog, Coyote `stableKey` occupancy, and affordance compose all key off **graph placement**, not existence rows alone. **Remove** already accepted two atomic steps in the opposite order.

---

## Target steady state (after merge)

| Concern | Owner | Entry |
| --- | --- | --- |
| Pair + `Meta::Object` create | Objects lane | `persistSpawnImprovisationObject` |
| Room graph + adjacency | Positions lane | `applyObjectRoomMembership` (adapter + kernel) |
| Ingress sequencing | Objects coordinator | [`applyObjectsChange`](../../../../../lambda/ephemera/dataSource/objects/applyObjectsChange.ts) / [`handleApiObjectsChange`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) |
| Outbound existence fact | Objects lane | `Objects Changed` (`createdIds`) --- only ids where **both** steps succeeded (**S2**); partial batches allowed (**S3**) |
| Outbound placement fact | Positions lane | `Object Moved` --- from `applyObjectRoomMembership` membership-changed bundle |
| Batch `add` failures | Objects coordinator | **Per-object isolation** (**S3**): continue remaining rows; aggregate `createdIds` + per-failure error reporting |

**Removed:** `spawnAndPlaceImprovisationObject.ts`, `postApplyGraphProjection.ts` (deleted in Phase 2).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for checkbox and verification conventions.
2. Read durable three-way split and ingress:
   - [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) (**Three-way split**, **Spawn + place**)
   - [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#object-room-placement-phase-4-nodes-only)
3. Read manipulation layering (shipped Phase 4c):
   - [`lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) (Phase 4c ingress audit)
   - [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#object-room-membership-phase-4-nodes-only)
4. Read existing primitives (no new graph reducers expected):
   - [`persistSpawnImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts)
   - [`applyObjectRoomMembership`](../../../../../lambda/ephemera/dataSource/positions/membership/applyObjectRoomMembership.ts)
5. **Command authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- Jest, `npm run test` from `lambda/ephemera/`.

**Baseline before edits:**

```bash
cd lambda/ephemera
npm run test -- --watchAll=false \
  dataSource/objects/spawnImprovisationObjectsBatch.test.ts \
  dataSource/objects/applyObjectsChange.test.ts \
  dataSource/objects/handleApiObjectsChange.test.ts \
  dataSource/positions/membership/applyObjectRoomMembership.test.ts \
  dataSource/positions/membership/planMembershipTransfer.objectPersist.test.ts
```

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark each nested line `[X]` as it is done.

- [X] **Phase 0 --- Decide**
  - [X] Resolve **S1** (compensating delete + deferred orphan finding/scan).
  - [X] Resolve **S2** (`Objects Changed` only after both steps succeed).
  - [X] Resolve **S3** (per-object batch isolation + partial `createdIds`).

- [X] **Phase 1 --- Coordinator refactor**
  - [X] Replace `spawnAndPlaceImprovisationObject` body with: `persistSpawnImprovisationObject` -> `applyObjectRoomMembership` (same deps: `messageBus`, positions `streamEvent`).
  - [X] Implement **S1**: on placement failure, `persistDeleteImprovisationObject`; on compensation failure, structured `console.error` (hook for future orphan finding).
  - [X] Implement **S3**: per-object loop isolation; extend `ApplyObjectsChangeResult` with failure reporting; update `handleAcmeOrderAddObjects` to match.
  - [X] Wire `applyObjectsChange` / `handleApiObjectsChange` to the refactored entry (or inline two-step in coordinator module).
  - [X] Ensure improvisation cache memo (`invalidateImprovisationObjectCaches` with `pairComponent` / `metaRow`) still runs after existence create; invalidate after successful compensation delete.
  - [X] Remove duplicate fact/cache/`RoomUpdate` logic from spawn module (placement bundle owned by `applyObjectRoomMembership` only).

  **Note:** [`postApplyGraphProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/postApplyGraphProjection.ts) is now dead code from spawn's perspective (Phase 2 deletes it).

- [X] **Phase 2 --- Delete parallel paths**
  - [X] Remove [`postApplyGraphProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/postApplyGraphProjection.ts) and tests if any.
  - [X] Remove or thin [`spawnAndPlaceImprovisationObject.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnAndPlaceImprovisationObject.ts) (deleted; per-object coordinator inlined into [`spawnImprovisationObjectsBatch.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts) as `spawnOneImprovisationObject`).

- [X] **Phase 3 --- Tests**
  - [X] Extend `spawnImprovisationObjectsBatch.test.ts` with integration-style two-step transact expectations if gaps remain (S1/S3 unit coverage already present; no extra block needed --- `spawnOneImprovisationObject` + `applyObjectsChange` cover wiring).
  - [X] Add test: existence succeeds, placement fails -> compensation delete called; placement + delete both fail -> error logged, not in `createdIds` (`spawnImprovisationObjectsBatch.test.ts` S1; `applyObjectsChange.test.ts` excludes failed id from `createdIds`).
  - [X] Add test: batch partial success (**S3**) --- first `add` succeeds, second fails -> `createdIds` length 1, outbound includes only success (`spawnImprovisationObjectsBatch.test.ts`, `applyObjectsChange.test.ts`, `handleApiObjectsChange.test.ts` API + Acme paths).
  - [X] Regression: `applyObjectRoomMembership.test.ts`, `planMembershipTransfer.objectPersist.test.ts`, Acme/handleApiObjectsChange tests (37 baseline + 154 broader scope pass).

- [X] **Phase 4 --- Durable docs**
  - [X] Update [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md): two-step spawn+place; remove single-transact bundle language; **S3** partial batch / `createdIds` semantics.
  - [X] Update [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md): replace spawn bundle exception with two-step norm; record **S1** compensating delete + compensation-failure logging.
  - [X] Update [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) and [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) Phase 4c exceptions table (remove spawn/kernel bypass).
  - [X] Remove resolved rows from **Open decisions** above.

- [ ] **Phase 5 --- Close**
  - [ ] Run verification commands below.
  - [ ] Delete this planning file (git retains history).

---

## Follow-up (deferred --- not Phase 1--4)

- [ ] **Orphaned improvised object** diagnostics finding + scan (pair + `Meta::Object` present, no graph placement / empty `getMembershipContainers`). Triggered operationally when **S1** compensation delete fails; no implementation required for initial refactor beyond logging.
- [ ] Optional repair coordinator: delete orphan rows or attempt placement retry (product decision).

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| **S1** / **S2** / **S3** decided | Done |
| Phase 1 coordinator refactor | Done |
| Parallel paths removed | Done |
| Phase 3 tests | Done |
| Durable docs updated | Done |

---

## Verification

After Phase 1--3:

```bash
cd lambda/ephemera
npm run test -- --watchAll=false \
  dataSource/objects/ \
  dataSource/positions/membership/ \
  dataSource/positions/manipulation/
```

**No spawn bypass of kernel (after Phase 2):**

```bash
rg -n "computePostApplyObjectRoomGraphs|postApplyGraphProjection|spawnAndPlaceImprovisationObject" \
  lambda/ephemera/
```

Expect **no** matches under `lambda/ephemera/`.

**Ingress audit grep (spawn uses kernel path):**

```bash
rg -n "applyObjectRoomMembership|persistSpawnImprovisationObject" \
  lambda/ephemera/dataSource/objects/applyObjectsChange.ts \
  lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts
```

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) | Jest commands |
| [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) | Objects lane steady state |
| [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) | Normative placement rules |
| [`lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) | Kernel + adapter map (Phase 4c) |
| [`lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md`](../../../../../lambda/ephemera/diegeticLogic/AGENT.unknowns.concepts.md) | Fiction: spawn asserts existence + placement (coordinator can still sequence two applies) |
