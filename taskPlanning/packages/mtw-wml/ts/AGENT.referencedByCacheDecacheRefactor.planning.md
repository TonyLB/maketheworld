# `referencedBy` cache / decache refactor (single-pass persistence)

**Status:** Phase 2 complete. **Next:** Phase 3 --- **disable** (not delete yet) the inverse second pass; EventBridge proof.

This plan is task-scoped. Archive or delete it after the work ships; move lasting norms into package `AGENT.md` files next to code.

**Framework:** [`taskPlanning/AGENT.md`](../../AGENT.md)

**Sibling / unblocker for:** [`AGENT.topologyRelationsRefactor.planning.md`](./AGENT.topologyRelationsRefactor.planning.md) Phase 4 smoke-test (Coyote exits). Do **not** resume that smoke-test until this plan's **Verification (end-to-end)** slice is complete --- the smoke failure traced to thin `ROOM#*` rows and clobbered component bodies from the inverse pass.

---

## Purpose

Align persisted **`referencedBy`** (inverse index on `(targetUniversalKey, ASSET#assetId)` rows) with how the rest of the system handles references and cache writes:

1. **Fix Area exit endpoint reference extraction** so `referencedKeys()` / `assureComponents` treat Remove and Replace endpoints like ReferenceList-backed refs elsewhere (Room -> Feature Remove is already tested).
2. **Write `referencedBy` in the first `cacheAsset` pass** alongside `fileComponent.toJSON()` (same transaction intent as `Meta::${tag}.cached` updates), using authoritative **`fileAsset`** forward state --- not a second Dynamo sweep.
3. **Disable calls** to `applyReferencedByPatchesForAsset` / `clearReferencedByForDecache` **before** deleting the second-pass module, and prove via tests that behavior is unchanged (or strictly better --- no body clobber).
4. **Then** remove dead second-pass code and update durable docs.

---

## Background (current behavior and bugs)

### What `referencedBy` is

- **Not** WML component body. Colocated Dynamo metadata on target rows; stripped before `StandardComponent` construction at read time ([`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)).
- **Computed** from `fileAsset` forward references via `StandardForm.referencedBy()` / `buildReferencedByPatchesForAsset` ([`referencedBy.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts)).
- **Consumed** at read time for room exit projection: `referencedByUnion` -> `filterAreaEdgeReferrers` -> load Areas -> `projectRoomExits` ([`assemble.ts`](../../../packages/mtw-gateways/ts/assets/components/componentTopology/assemble.ts)).

### Second pass today (D10)

After `diff._components` main writes, [`cacheAsset.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.ts) calls [`applyReferencedByPatchesForAsset`](../../../lambda/assets/dataSource/caching/referencedByPersistence.ts) with `targetsNeedingInverseReconcile(dbAsset, fileAsset)` --- a **broader** target set than `diff._components`.

[`decacheAsset.ts`](../../../lambda/assets/dataSource/caching/decacheAsset.ts) calls [`clearReferencedByForDecache`](../../../lambda/assets/dataSource/caching/referencedByPersistence.ts) similarly.

### Known bugs (motivation)

| Bug | Effect |
| --- | --- |
| **`getItem` default projection** in inverse pass | `assetDB.getItem` without `getAllFields: true` returns only `AssetId`; existing-row branch does full `putItem` replace -> **clobbers** `tag`, `universalKey`, `_from`, render, etc. |
| **Exit `reference()` skips Remove / Replace match** | Diffed Area with removed edges does not emit endpoint rooms via `referencedKeys()` -> `assureComponents` does not stub those targets (asymmetric vs Room `<Remove><Feature>`). |
| **Second pass ordering** | Can overwrite a full room body written milliseconds earlier in the same `cacheAsset` run. |
| **Main loop conflates two "missing fileComponent" cases** | `fileAsset._lookup` undefined currently always -> `deleteItem`, even when the target is still referenced in the file forward graph (edge-only participation) and only appears in `diff._components` as an `assureComponents` stub. |

### Architectural decision (this initiative)

| Layer | Responsibility |
| --- | --- |
| **`StandardForm.diff` + `assureComponents`** | Ensure every target whose **`referencedBy`** may change appears in `diff._components` (via fixed `referencedKeys()` on diffed components). |
| **Main `cacheAsset` loop** | Per `diff._components` entry: three-way write (full put / stub put / delete) + `referencedBy` from `fileAsset` patches. |
| **`fileAsset`** | Authoritative source for **`referencedBy` values** (forward graph after edits --- removes are simply absent). |
| **Inverse second pass** | **Retire** after verification (disable calls first). |

**Not in scope for "diff drives coverage":** `referencedBy` **values** are never derived from Remove envelopes in the diff; Remove in diff only drives **which rows get touched**.

---

## Scope

### In scope

- [`endpointReference.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/endpointReference.ts): `reference()` (and any shared helper) emits refs from **Plain**, **Remove match**, **Replace match**, and **Replace payload**.
- Tests: exit endpoint + Area `referencedKeys()` + `StandardForm.diff` + `assureComponents` for add/remove/replace edge endpoint cases.
- [`cacheAsset.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.ts): merge `referencedBy` into first-pass `putItem`; **three-way branch** on `fileComponent` presence vs forward references (see [Main loop: `fileComponent` missing is not one meaning](#main-loop-filecomponent-missing-is-not-one-meaning)).
- [`decacheAsset.ts`](../../../lambda/assets/dataSource/caching/decacheAsset.ts): equivalent single-pass `referencedBy` clear / update (or disable second call with same proof bar).
- **Disable** (comment or feature flag) `applyReferencedByPatchesForAsset` / `clearReferencedByForDecache` **calls**; extend tests to prove first pass alone is sufficient.
- Re-home **`TopologyInvalidated`** emission (`emitTopologyInvalidatedForRoomTargets`) to first-pass logic when room `referencedBy` edge entries change.
- Durable doc updates: [`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md), [`componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md) (after code lands).

### Out of scope (link only)

- Coyote play-mode smoke-test (topology plan Phase 4) --- **after** this plan verification.
- Changing `StandardForm.referencedBy()` semantics on live `fileAsset` (already correct).
- Separate Dynamo item type for inverse index (colocated field stays).
- Ephemera affordance pipeline changes beyond confirming `TopologyInvalidated` still fires.

### Phased deletion rule

1. Implement first pass + fix `reference()`.
2. **Disable** second-pass **calls** (keep module in tree).
3. Tests + manual Dynamo checks on overlay asset.
4. **Delete** [`referencedByPersistence.ts`](../../../lambda/assets/dataSource/caching/referencedByPersistence.ts) second-pass-only paths / file if nothing else imports them.

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../AGENT.md)
2. **Topology context (smoke-test blocked on this work):** [`AGENT.topologyRelationsRefactor.planning.md`](./AGENT.topologyRelationsRefactor.planning.md)
3. **WML Area + edges:** [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md), [`AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (StandardArea `referencedKeys`)
4. **Cache diff flow:** [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md)
5. **Inverse index + topology read path:** [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md), [`lambda/assets/componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md)
6. **Implementation files:** [`cacheAsset.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.ts), [`referencedByPersistence.ts`](../../../lambda/assets/dataSource/caching/referencedByPersistence.ts), [`referencedBy.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts)
7. **Phase 3 verification (EventBridge):** [`lambda/assets/AGENT.event.md`](../../../lambda/assets/AGENT.event.md) (`Cache Consistency Finding` -> `cacheAsset`), [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts)

**Test command authority:**

- `mtw-wml`: [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md)
- `lambda/assets`: `cd lambda/assets && npm test` (Jest; scope with `--testPathPattern=`)

**Baseline (before edits):**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/keys/edges/ ts/standardize/components/area.test.ts
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit

cd ../../lambda/assets
npm test -- --testPathPattern="cacheAsset|referencedBy|decacheAsset" --watchAll=false
```

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| **1** | Exit endpoint `reference()` + diff / `assureComponents` coverage | Complete |
| **2** | First-pass `referencedBy` in `cacheAsset` | Complete |
| **3** | Disable second pass; EventBridge proof (`mtw.diagnostics`) | Not started |
| **4** | `decacheAsset` alignment + disable second call | Not started |
| **5** | Delete dead code + durable docs | Not started |
| **6** | Resume topology Phase 4 smoke-test | Blocked on Phases 1-5 |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]`. Mark nested bullets `[X]` as each sub-task finishes.

### Phase 1 --- Exit endpoint references (mtw-wml)

- [X] **Implement `references()`** in [`endpointReference.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/endpointReference.ts) (+ export **`referencesFromExitEndpoint`**; **`reference()`** unchanged for effective/plain unwrap):
  - [X] **Plain** endpoint -> `StandardReference` (unchanged).
  - [X] **Remove** endpoint -> ref from **match** (mirror Room Feature Remove in [`room.test.ts`](../../../packages/mtw-wml/ts/standardize/components/room.test.ts)).
  - [X] **Replace** endpoint -> refs from **both** match and payload (two refs when both resolve).
- [X] **Unit tests** for `references()` / `referencesFromExitEndpoint` and `reference()` / `referenceFromExitEndpoint` on Plain, Remove, Replace shapes ([`endpointReference.test.ts`](../../../packages/mtw-wml/ts/standardize/keys/edges/endpointReference.test.ts)).
- [X] **Area `referencedKeys()` tests:** edge add, edge remove (inverted / Remove envelope), endpoint Replace -> `referenceType: 'Edge'` entries include expected room ids.
- [X] **`StandardForm.diff` integration test:** removing an edge assures endpoint room stub(s) in `diff._components` via `assureComponents` (regression for the pushback case in planning discussion).
- [X] Document in [`AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md): coverage vs effective `reference()` split (no new `D*` ids).

### Phase 2 --- First-pass `referencedBy` in `cacheAsset` (lambda/assets)

- [X] **Helper** (inline or extracted): given `fileAsset`, precompute `buildReferencedByPatchesForAsset(fileAsset)` once per cache run (reuse [`referencedBy.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/referencedBy.ts) --- do not reimplement). Per `universalKey`: `patches.get(universalKey) ?? []`.
- [X] **Main loop** ([`cacheAsset.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.ts) `diff._components` map) --- replace today's binary `fileComponent ? put : delete` with the [three-way branch](#main-loop-three-way-write-branch):
  - [X] **(A) `fileComponent` present:** `putItem({ ...fileComponent.toJSON(), referencedBy, AssetId, DataCategory })` + `Meta::${tag}.cached` bump (usual case: local body, import + render, etc.).
  - [X] **(B) `fileComponent` missing, still referenced in `fileAsset`:** `referencedBy` patch non-empty (or equivalent forward-ref check) -> **stub** `putItem` (`tag`, `universalKey`, `referencedBy`, keys) + `Meta::${tag}.cached` bump --- **not** `deleteItem`. Edge-only topology overlay pattern.
  - [X] **(C) `fileComponent` missing, not referenced in `fileAsset`:** `referencedBy` patch empty -> **`deleteItem`** (component removed from this asset partition). This is the usual meaning of "missing from file" for inverted / removed diff entries.
  - [X] Do **not** use `fileComponent` missing alone as the delete signal; assured empty stubs and true removals both fail `_lookup` today.
- [X] **`TopologyInvalidated`:** emit when first pass writes / clears room `referencedBy` with `referenceType: 'Edge'` (parity with today's `roomIdsForTopology`).
- [X] **Unit tests (Phase 2, optional but recommended):** thin extensions to [`cacheAsset.test.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.test.ts) for three-way branch logic only --- not the Phase 3 sufficiency proof (see Phase 3 EventBridge).

### Phase 3 --- Disable second pass; prove sufficiency (EventBridge)

**Verification preference:** exercise the **deployed** assets pipeline via **`mtw.diagnostics`** on EventBridge (`Source: mtw.diagnostics`), not direct Lambda test invokes of `cacheAsset`. Unit tests in Phase 2 may cover branch logic; Phase 3 **proof** is bus -> handler -> Dynamo (and downstream topology signals).

- [ ] **Disable call** to `applyReferencedByPatchesForAsset` in [`cacheAsset.ts`](../../../lambda/assets/dataSource/caching/cacheAsset.ts) (comment + TODO pointing at this plan Phase 5).
- [ ] **Grep guard:** no remaining production `applyReferencedByPatchesForAsset` from `cacheAsset` while disabled.
- [ ] **EventBridge: re-cache overlay** --- publish **`Cache Consistency Finding`** on `{TablePrefix}-bus` ([`lambda/assets/AGENT.event.md`](../../../lambda/assets/AGENT.event.md), contract in [`packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts`](../../../packages/mtw-interfaces/ts/eventBridge/diagnostics/index.ts)):
  - [ ] `Source`: `mtw.diagnostics`
  - [ ] `DetailType`: `Cache Consistency Finding`
  - [ ] `Detail.assetId`: overlay uuid (`ASSET#280e2f0c-1840-451f-a2ce-8742e86350c1` or current Coyote overlay id); short form (`280e2f0c-...`) also accepted per handler normalization.
  - [ ] Confirm assets lambda receives finding and runs `cacheAsset` (CloudWatch / handler logs).
- [ ] **Dynamo checks after finding** (first pass only; second pass disabled):
  - [ ] **Branch A (imported room):** `ROOM#STRAIGHTAWAY` (and other authored imports) under overlay partition: full body (`tag`, `universalKey`, `_from`, render if present) **and** `referencedBy` with `AREA#WORLD` / `referenceType: Edge` when edges exist --- not thin/clobbered rows.
  - [ ] **Branch B (edge-only room):** if testing topology-only overlay variant: stub row + `referencedBy`, not `deleteItem` residue.
  - [ ] `Meta::Room.cached` on affected rooms includes overlay (+ primitives where expected).
- [ ] **Downstream chain (optional same session):** after cache settles, publish follow-on findings if needed for smoke path:
  - [ ] `Component Vertical Misaligned Finding` -> vertical heal ([`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md))
  - [ ] Confirm `TopologyInvalidated` / affordance topology path still reacts (room rows with Edge `referencedBy` changed) --- see [`componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md)
- [ ] **Edge-removal scenario (EventBridge):** after editing overlay S3/WML to remove an edge, publish another `Cache Consistency Finding` for overlay; confirm former endpoint room `referencedBy` cleared for this asset partition (branch C / empty patch) without requiring second pass.
- [ ] **Record** exact `aws events put-events` command(s) used (bus name, region) in this plan's Verification section or operator notes for Phase 6 repeatability.

### Phase 4 --- `decacheAsset` alignment

- [ ] **First-pass or per-target clear:** when decaching, mirror [three-way branch](#main-loop-three-way-write-branch) semantics in the component-removal loop --- empty `fileAsset` -> branch (C) `deleteItem` for rows that had been materialized in this partition; do not recreate stubs on decache.
- [ ] **Disable** `clearReferencedByForDecache` call; extend [`decacheAsset.test.ts`](../../../lambda/assets/dataSource/caching/decacheAsset.test.ts).
- [ ] Confirm `TopologyInvalidated` / cache invalidation parity.

### Phase 5 --- Delete dead code + durable docs

- [ ] Remove [`referencedByPersistence.ts`](../../../lambda/assets/dataSource/caching/referencedByPersistence.ts) and tests **only if** no callers remain; otherwise slim to shared helpers (`buildReferencedByPatchesForAsset` import stays in gateways).
- [ ] Update [`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md): single-pass `referencedBy` on `diff._components`; remove "step 5 inverse pass" wording.
- [ ] Update [`componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md) invalidation source table.
- [ ] Update **Recommended order** checkboxes in this file; set **Status** to done.

### Phase 6 --- Resume topology smoke-test (sibling plan)

- [ ] Return to [`AGENT.topologyRelationsRefactor.planning.md`](./AGENT.topologyRelationsRefactor.planning.md) Phase 4: re-cache overlay asset, run Coyote exit inventory smoke-test, durable docs cleanup there.

---

## Design notes

### Main loop: `fileComponent` missing is not one meaning

`fileAsset._lookup(universalKey)` answers: **"Is there a component line for this id in the file?"** It does **not** answer: **"Should this asset partition row be deleted?"**

Both **removals** and **`assureComponents` stubs** can place a `universalKey` in `diff._components` while `_lookup` returns undefined:

| Situation | In `diff._components`? | `fileComponent` | Still referenced in `fileAsset` forward graph? | Correct action |
| --- | --- | --- | --- | --- |
| **Removal from asset** | Yes (inverted prior component) | Missing | **No** (`referencedBy` patch `[]`) | **(C) `deleteItem`** |
| **Edge-only participation** | Yes (`assureComponents` empty stub) | Missing | **Yes** (Area edge, etc.) | **(B) stub `putItem` + `referencedBy`** |
| **Local / imported body** | Yes | **Present** | Yes or no | **(A) full `putItem` + `referencedBy`** |

Today's main loop treats the first two rows identically (`deleteItem`), then the inverse pass recreates a thin row for edge-only targets --- the Coyote smoke-test failure mode.

**Coyote overlay nuance:** once a room is **imported** with render in overlay WML, case **(A)** applies (`fileComponent` present). Case **(B)** is for topology-only overlays that reference primitives rooms by universal key without a local `<Room>` line.

### Main loop: three-way write branch

Phase 2 implementation sketch (per `diff._components` entry with `universalKey`):

```typescript
const referencedBy = patches.get(universalKey) ?? []
const fileComponent = fileAsset._lookup(universalKey)

if (fileComponent) {
  // (A) Full body + inverse index
  await putItem({ ...fileComponent.toJSON(), referencedBy, AssetId, DataCategory })
  await bumpMetaCached(...)
} else if (referencedBy.length > 0) {
  // (B) Referenced but not materialized in file --- participation stub
  await putItem({ tag, universalKey, referencedBy, AssetId, DataCategory })
  await bumpMetaCached(...)
} else {
  // (C) Gone from file and no forward references --- removal
  await deleteItem({ AssetId, DataCategory })
}
```

`referencedBy` **values** always come from `patches` / `fileAsset` authoritative forward state, not from parsing Remove envelopes in the diff component.

### Why one pass is enough (target coverage)

- **Add / change edge:** Diffed Area includes plain endpoints -> `referencedKeys()` -> `assureComponents` -> room in `diff._components` (already worked).
- **Remove edge:** With Phase 1 fix, diffed Area includes Remove / inverted endpoints -> same `assureComponents` path (currently broken).
- **Replace endpoint (`ROOM#a` -> `ROOM#b`):** Both endpoints should appear in `diff._components` when Phase 1 emits both Replace sides.
- **`referencedBy` value:** Always from **`fileAsset`** after edit, not from diff Remove envelopes.

### What the retired second pass did that we must preserve

| Behavior | First-pass owner |
| --- | --- |
| Set / clear `referencedBy` on targets | Main loop per `diff._components` |
| Stub row for edge-only room | Main loop **branch (B)** |
| `deleteItem` on true removal | Main loop **branch (C)** --- must not fire for branch (B) |
| `Meta::Room.cached` bump for stubs | Same `Promise.all` as branch (A) / (B) |
| `internalCache` / partition invalidation | Keep union of `diff._components` universal keys |
| `TopologyInvalidated` for room targets | Explicit check on edge-type `referencedBy` changes |

### `targetsNeedingInverseReconcile(dbAsset, fileAsset)` retirement

The db-side union existed to clear stale inverse entries when targets fell outside `diff._components`. After Phase 1, removal cases should pull targets into diff via Remove-aware `referencedKeys()`. **Proof:** Phase 3 EventBridge re-cache + Dynamo inspection (Phase 6 smoke-test is additional). If a gap appears, fix `referencedKeys()` coverage rather than reintroducing a second pass.

---

## Verification

### Automated (Phases 1-2, optional Phase 2 cache unit tests)

```bash
# Phase 1
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/keys/edges/ ts/standardize/components/area.test.ts
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit

# Phase 2 (branch logic only --- not Phase 3 sufficiency proof)
cd lambda/assets
npm test -- --testPathPattern="cacheAsset|decacheAsset|referencedBy" --watchAll=false
```

### Phase 3 --- EventBridge (`mtw.diagnostics`) proof

**Authority:** deployed bus -> assets handler -> `cacheAsset` (second pass disabled). Do **not** use direct Lambda test invokes as the Phase 3 acceptance gate.

**Handler path:** [`lambda/assets/dataSource/index.ts`](../../../lambda/assets/dataSource/index.ts) subscribes to `mtw.diagnostics` / `Cache Consistency Finding` -> `cacheAsset({ assetId, streamEvent })` ([`AGENT.event.md`](../../../lambda/assets/AGENT.event.md)).

**Emit re-cache** (replace `YOUR_TABLE_PREFIX` and region; bus is typically `{TablePrefix}-bus`):

```bash
aws events put-events --entries '[
  {
    "Source": "mtw.diagnostics",
    "DetailType": "Cache Consistency Finding",
    "Detail": "{\"assetId\": \"ASSET#280e2f0c-1840-451f-a2ce-8742e86350c1\", \"status\": \"stale\", \"diagnosticRunId\": \"referencedBy-refactor-phase3\", \"timestamp\": \"2026-06-08T12:00:00.000Z\"}"
  }
]' --event-bus-name YOUR_TABLE_PREFIX-bus --region us-east-1
```

**After event (Dynamo / logs):**

1. Assets lambda logs show `cacheAsset` for overlay asset id.
2. `ROOM#STRAIGHTAWAY` (and other Coyote rooms) under overlay `DataCategory`: **branch A** full body + non-empty `referencedBy` (`AREA#WORLD`, `referenceType: Edge`) when edges exist --- not thin/clobbered rows.
3. `Meta::Room.cached` includes overlay + primitives as expected.
4. (Optional) Publish `Component Vertical Misaligned Finding` for import follow-up; confirm vertical heal runs.
5. (Edge removal retest) Edit overlay WML to remove an edge, re-publish `Cache Consistency Finding`, confirm `referencedBy` cleared on former endpoint for this partition.

See also [`lambda/diagnostics/AGENT.schema.planning.md`](../../../lambda/diagnostics/AGENT.schema.planning.md) (**Cache Consistency Finding** manual emission).

### End-to-end (Phase 6 --- sibling plan)

Coyote exit inventory smoke-test per [`AGENT.topologyRelationsRefactor.planning.md`](./AGENT.topologyRelationsRefactor.planning.md#coyote-exit-inventory-smoke-test).

---

## Inventory (grep helpers)

```bash
# Second-pass call sites (should be zero after Phase 3/4 disable)
rg "applyReferencedByPatchesForAsset|clearReferencedByForDecache|targetsNeedingInverseReconcile" lambda/assets

# Exit reference helper
rg "referenceFromExitEndpoint|reference\(\)" packages/mtw-wml/ts/standardize/keys/edges/endpointReference.ts

# D10 docs to update in Phase 5
rg "inverse pass|D10|referencedByPersistence" lambda/assets packages/mtw-gateways --glob "*.md"
```

---

## Decision log

| Date | Decision |
| --- | --- |
| 2026-06-08 | Treat exit `reference()` omitting Remove / Replace match as **bug**, not intentional (contradicts Room Remove-in-`referencedKeys` precedent). |
| 2026-06-08 | Persist `referencedBy` in **first** `cacheAsset` pass; **disable** second pass before deleting code. |
| 2026-06-08 | `referencedBy` **values** always from `fileAsset`; diff Remove refs only affect **which rows** are in `diff._components`. |
| 2026-06-08 | Defer topology Phase 4 smoke-test until this plan completes Phase 3 verification minimum. |
| 2026-06-08 | Main loop uses **three-way branch**: `fileComponent` present -> full put; missing + still referenced -> stub put; missing + not referenced -> delete. Do not treat missing `fileComponent` alone as removal. |
| 2026-06-08 | Phase 3 sufficiency proof via **EventBridge** `mtw.diagnostics` / `Cache Consistency Finding`, not direct Lambda test invokes. Unit tests optional for branch logic in Phase 2 only. |
