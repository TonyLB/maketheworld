# Spawn object refactor (two-step existence + placement)

**Status:** Phase 0 complete (**S1**--**S3** decided). **Next:** Phase 1 coordinator refactor.

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability ladder, open decisions, recommended-order checkboxes). **Dispose** after the initiative ships and lasting rules live in [`lambda/ephemera/dataSource/objects/`](../../../../../lambda/ephemera/dataSource/objects/) and [`lambda/ephemera/dataSource/positions/`](../../../../../lambda/ephemera/dataSource/positions/) `AGENT*.md` siblings.

---

## Purpose

Replace the **spawn + place bundle** --- one Dynamo `transactWrite` spanning objects-lane rows and positions-lane graph/adjacency --- with a **two-step** coordinator:

1. **Existence (objects lane):** atomically create `(OBJECT#, ASSET#IMPROVISATION)` pair + `(OBJECT#, Meta::Object)` via [`persistSpawnImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts).
2. **Placement (positions lane):** atomically add the object to the target room via [`applyObjectRoomMembership`](../../../../../lambda/ephemera/dataSource/positions/membership/applyObjectRoomMembership.ts) -> shared adapter -> [`applyHostEffects`](../../../../../lambda/ephemera/dataSource/positions/manipulation/applyHostEffects.ts).

**Why now:** Phase 4c shipped the manipulation kernel + adapter for all membership-transfer ingress. [`spawnAndPlaceImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/spawnAndPlaceImprovisationObject.ts) remains the sole documented exception; it bypasses the kernel and maintains a parallel cache path ([`postApplyGraphProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/postApplyGraphProjection.ts)). Splitting existence and placement lets spawn use the **same** positions coordinator as place/remove without a kernel transact-composition extension.

**Non-goals for this initiative:**

- Changing the **remove** path (already two-step: graph via `applyObjectRoomMembership`, then row delete).
- Relational in-room edges (slice 5+).
- Deferred **`drop`** operator ([`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md)).

---

## Problem statement

Today [`spawnAndPlaceImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/spawnAndPlaceImprovisationObject.ts) inlines:

- Pair + `Meta::Object` puts
- `buildObjectPlacementTransactItems` (same builder the kernel uses, but called directly)
- Hand-built `MembershipDiff` (`froms: []`, `to: targetRoom`)
- `computePostApplyObjectRoomGraphs` for cache seeding (kernel bypass)
- Duplicated `Object Moved` / cache / `RoomUpdate` bundle logic

The contract currently requires a **single transact** across both lanes (**I1** / **I5** in [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md)). That cross-domain atomicity is a **policy choice**, not a read-model requirement: manipulation catalog, Coyote `stableKey` occupancy, and affordance compose all key off **graph placement**, not existence rows alone. **Remove** already accepts two atomic steps in the opposite order.

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

**Removed:** `spawnAndPlaceImprovisationObject.ts`, `postApplyGraphProjection.ts` (sole caller today is spawn).

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for checkbox and verification conventions.
2. Read durable three-way split and ingress:
   - [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) (**Three-way split**, **Spawn + place**)
   - [`lambda/ephemera/dataSource/positions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#object-room-placement-phase-4-nodes-only)
3. Read manipulation layering (shipped Phase 4c):
   - [`lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) (Phase 4c exceptions table; spawn listed as documented exception)
   - [`lambda/ephemera/dataSource/positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md#object-room-membership-phase-4-nodes-only)
4. Read existing primitives (no new graph reducers expected):
   - [`persistSpawnImprovisationObject`](../../../../../lambda/ephemera/dataSource/objects/persistImprovisationObject.ts)
   - [`applyObjectRoomMembership`](../../../../../lambda/ephemera/dataSource/positions/membership/applyObjectRoomMembership.ts)
5. **Command authority:** [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- Jest, `npm run test` from `lambda/ephemera/`.

**Baseline before edits:**

```bash
cd lambda/ephemera
npm run test -- --watchAll=false \
  dataSource/objects/spawnAndPlaceImprovisationObject.test.ts \
  dataSource/objects/applyObjectsChange.test.ts \
  dataSource/objects/handleApiObjectsChange.test.ts \
  dataSource/positions/membership/applyObjectRoomMembership.test.ts \
  dataSource/positions/membership/planMembershipTransfer.objectPersist.test.ts
```

---

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). Do not copy into package `AGENT.concepts.md`. When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| **S1** | Compensating delete on placement failure; log when compensation also fails | Phase 1 coordinator + error semantics | **Decided** |
| **S2** | Emit `Objects Changed` `createdIds` only for objects where existence + placement both succeeded | Phase 1 outbound timing | **Decided** |
| **S3** | Per-object batch isolation: partial `createdIds`, continue loop, report per-failure errors | `applyObjectsChange`, `handleAcmeOrderAddObjects` | **Decided** |

### Decided policies (S1--S3)

**S1 --- Compensating delete (SAGA undo):**

- After `persistSpawnImprovisationObject` succeeds and `applyObjectRoomMembership` fails, call `persistDeleteImprovisationObject` for the same `objectId` before treating that `add` row as failed.
- If compensation delete **also** fails: `console.error` with enough context (`objectId`, placement error, delete error) for operations follow-up. The row is a durable **orphaned improvised object** (existence rows, no graph placement).
- **Follow-up (deferred, not Phase 1):** add an **orphaned improvised object** diagnostics **finding** type and a **scan** that detects `OBJECT#` rows with pair + `Meta::Object` but no membership-container / graph placement. Document the finding id in durable diagnostics docs when that slice lands; Phase 1 only reserves the failure path and logging hook.

**S2 --- `Objects Changed` timing:**

- Include an `objectId` in `createdIds` only when **both** existence create and room placement succeeded for that row.
- Do **not** stream `Objects Changed` for objects that failed placement (even if existence briefly existed before compensation).
- Handlers emit one `Objects Changed` when `createdIds.length > 0` and/or `destroyedIds.length > 0` after the batch loop (**S3**).

**S3 --- Per-object batch isolation:**

- **`add` loops** (`applyObjectsChange`, `handleAcmeOrderAddObjects`): failure on one row does **not** abort earlier successes or skip remaining rows.
- **`createdIds`:** append only fully successful spawns (both steps, or compensated clean failure with no durable rows --- failed rows do not appear).
- **Error reporting:** extend `ApplyObjectsChangeResult` (and Acme handler behavior) so callers can log **per-failure** detail (e.g. ingress `uuid` / minted `objectId`, `stableKey` where known, `errorMessage`) while still returning `{ ok: true, persisted: true, createdIds, ... }` when at least one row succeeded. When **every** `add` fails, `{ ok: false, errorMessage }` (aggregate or first failure --- pick one in implementation; prefer a summary plus structured log lines for each failure).
- **`handleApiObjectsChangeCommand`:** stream partial `createdIds` when `persisted: true` even if some adds failed; log failures without suppressing the outbound fact for successes.

**Remove path:** unchanged (still per-object loop; align error-reporting shape with `add` if useful).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark each nested line `[X]` as it is done.

- [X] **Phase 0 --- Decide**
  - [X] Resolve **S1** (compensating delete + deferred orphan finding/scan).
  - [X] Resolve **S2** (`Objects Changed` only after both steps succeed).
  - [X] Resolve **S3** (per-object batch isolation + partial `createdIds`).

- [ ] **Phase 1 --- Coordinator refactor**
  - [ ] Replace `spawnAndPlaceImprovisationObject` body with: `persistSpawnImprovisationObject` -> `applyObjectRoomMembership` (same deps: `messageBus`, positions `streamEvent`).
  - [ ] Implement **S1**: on placement failure, `persistDeleteImprovisationObject`; on compensation failure, structured `console.error` (hook for future orphan finding).
  - [ ] Implement **S3**: per-object loop isolation; extend `ApplyObjectsChangeResult` with failure reporting; update `handleAcmeOrderAddObjects` to match.
  - [ ] Wire `applyObjectsChange` / `handleApiObjectsChange` to the refactored entry (or inline two-step in coordinator module).
  - [ ] Ensure improvisation cache memo (`invalidateImprovisationObjectCaches` with `pairComponent` / `metaRow`) still runs after existence create; invalidate after successful compensation delete.
  - [ ] Remove duplicate fact/cache/`RoomUpdate` logic from spawn module (placement bundle owned by `applyObjectRoomMembership` only).

- [ ] **Phase 2 --- Delete parallel paths**
  - [ ] Remove [`postApplyGraphProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/membership/postApplyGraphProjection.ts) and tests if any.
  - [ ] Remove or thin [`spawnAndPlaceImprovisationObject.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnAndPlaceImprovisationObject.ts) (delete if coordinator moves to `applyObjectsChange` only).

- [ ] **Phase 3 --- Tests**
  - [ ] Update `spawnAndPlaceImprovisationObject.test.ts` -> two-step transact expectations (two `transactWrite` calls, or mock coordinators).
  - [ ] Add test: existence succeeds, placement fails -> compensation delete called; placement + delete both fail -> error logged, not in `createdIds`.
  - [ ] Add test: batch partial success (**S3**) --- first `add` succeeds, second fails -> `createdIds` length 1, outbound includes only success.
  - [ ] Regression: `applyObjectRoomMembership.test.ts`, `planMembershipTransfer.objectPersist.test.ts`, Acme/handleApiObjectsChange tests.

- [ ] **Phase 4 --- Durable docs**
  - [ ] Update [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md): two-step spawn+place; remove single-transact bundle language; **S3** partial batch / `createdIds` semantics.
  - [ ] Update [`positions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md): replace spawn bundle exception with two-step norm; record **S1** compensating delete + compensation-failure logging.
  - [ ] Update [`positions/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md) and [`manipulation/AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/manipulation/AGENT.implementation.md) Phase 4c exceptions table (remove spawn/kernel bypass).
  - [ ] Remove resolved rows from **Open decisions** above.

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
| Phase 1 coordinator refactor | Not started |
| Parallel paths removed | Not started |
| Durable docs updated | Not started |

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
rg -n "computePostApplyObjectRoomGraphs|spawnAndPlaceImprovisationObject" \
  lambda/ephemera/dataSource/positions/
```

Expect **no** matches under `positions/` (spawn coordinator may remain under `objects/` until removed).

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
