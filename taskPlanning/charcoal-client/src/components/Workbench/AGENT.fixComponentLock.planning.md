# Workbench component navigation freeze (Area -> Room)

**Status:** Phase 1 complete (bisect + interim E3). **Next: Phase 2** --- document client sync **invariants** and add **regression tests** that encode them. Phase 3 implements fixes as invariant satisfaction (not ad hoc patches). E3 (`debounce={true}`) remains interim mitigation until Phase 3 acceptance (restore `debounce={false}`).

This document is task-scoped and follows [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability, checkbox conventions, and when to delete this plan.
2. Read area dev notes: [`taskPlanning/charcoal-client/AGENT.development.md`](../../../AGENT.development.md) (Vitest commands).
3. Read subsystem context (steady-state architecture; link from Phase 2 docs, do not duplicate long-term):
   - [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) --- `useWorkbenchComponent` session model
   - [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md) --- effective pending overlay, `getLocalStandardForm`
   - [`charcoal-client/src/slices/wmlDataSource/AGENT.md`](../../../../../charcoal-client/src/slices/wmlDataSource/AGENT.md) --- `confirmedRequestIds`, `afterProcessEnvelope`
   - [`charcoal-client/src/slices/dataSource/AGENT.implementation.md`](../../../../../charcoal-client/src/slices/dataSource/AGENT.implementation.md) --- selector-time TTL, requestIdTracking

**Baseline verification** (should pass before Phase 2 edits):

```bash
cd charcoal-client
npm run test:single -- src/slices/personalAssets/selectors.test.ts
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
```

**Manual repro (symptom):** Workbench on a Draft asset with an Area listing Rooms in Participants. Navigate Area -> Room (e.g. `ROOM#CLIFFTOP`). Without E3, tab freezes; with E3, navigation succeeds.

---

## Problem statement

### Symptom

After refactoring **personalAssets** `pendingEdits` to use **effective** pending (excluding rows in **wmlDataSource** `confirmedRequestIds`, plus pending TTL at selector read time), navigating **Area -> Room** in the Workbench **freezes the tab**.

Phase 1 bisect (**E1**, **E3**) localized the infinite loop to **`DefaultRenderEditor`** / **`StandardRenderEditor`** with `debounce={false}` when derived `standardForm` references churn every render. **E3** (`debounce={true}`) is interim mitigation only.

### Underlying problem (why this task continues)

Collaborative editing and client/backend sync have been brittle across the app's history. This incident is another case where:

- The codebase **already depends on implicit invariants** (see below) for editors and sessions to behave.
- A new derived layer (effective pending + `confirmedRequestIds` injection) **violated those invariants** without documentation or regression tests catching it.
- The **update loop is a symptom**; the **process gap** is insufficient **documented requirements** and **automated guards** so the next derived selector or editor cannot reintroduce the same class of failure.

Phase 1 answered *where* the loop lives. Phase 2 answers *what we guarantee* and *how we test it*. Phase 3 implements code that satisfies those guarantees.

---

## Client sync invariants (to document and test in Phase 2)

These are **system requirements**, not Room-specific hacks. Promote into durable docs when stable (likely `personalAssets/AGENT.md`, `Workbench/AGENT.md`, and/or a short cross-cutting note linked from both).

| ID | Invariant | Rationale |
| --- | --- | --- |
| **I1** | **Derived-view referential stability:** `getLocalStandardForm`, `getStandardForm`, and cross-slice inputs to their Reselect chain (e.g. effective confirmed id lists) return the **same reference** when store semantics are unchanged. | Unstable merges force new `StandardForm` instances and break editor guards. Selector-time TTL (`Date.now()`) is an intentional carve-out --- document where impurity is allowed and how stability is preserved around it. |
| **I2** | **Churn vs collaboration:** Session `committed` / reconcile react to **semantic** asset changes (flush, stream, import), not referential noise from selector recompute. | Reconcile exists for collaborative external updates; it must not be triggered (and downstream must not react) to identity-only churn. |
| **I3** | **Session editor boundary:** Under `useWorkbenchComponent`, field editors mutate **`working`**; **`committed`** is for reconcile. Consumers of `useWorkbenchAsset().standardForm` on session screens treat it as display/link context unless using **domain** equality. | Workbench AGENT documents Slate buffering against stale Redux; props feeding Slate must not change reference when domain is unchanged. |
| **I4** | **Layer ordering (collaboration path):** stream -> `wmlDataSource` base -> effective pending filter -> local form -> merged display -> session `committed` -> reconcile -> `working`. Each hop documents what constitutes a change and what must be idempotent. | Makes it obvious when a new derived field belongs in which layer. |
| **I5** | **Bounded mount under session editors:** Mounting session field editors (e.g. `DefaultRenderEditor` with `debounce={false}`) with an **unchanged** store must produce **bounded** render/update work (no infinite loop). | Encodes the Area -> Room failure mode as a regression class, not a one-off manual check. |

### Known violations (Phase 1; do not re-prove)

| Invariant | Violation (current code) |
| --- | --- |
| **I1** | `getWMLConfirmedRequestIds` allocates a new `string[]` each read -> `getEffectivePendingEdits` may recompute -> new `StandardFormData` from `toJSON()` every read. |
| **I3** | `useStandardRenderEditorHook` uses `standard === lastStandardRef` (reference), not domain stability, for Slate resync; with `debounce={false}`, resync drives immediate `updateComponent`. |
| **I5** | Area -> Room with `debounce={false}` freezes tab (infinite render loop). E3 breaks the feedback edge only. |

We do **not** need Phase 2 console instrumentation to confirm these are bad --- bisect and code review already did. Phase 2 encodes them so the codebase cannot regress silently.

---

## Phase 1 findings (complete)

### Session instrumentation (pre-freeze)

With `workbench-component-session` enabled (including CPU throttle):

1. `performFlushSkipped` --- `AREA#WORLD`, `workingMatchesLastReceived`
2. `sessionReset` --- `ROOM#CLIFFTOP`, `componentIdChange`
3. `committedSyncSkipped` --- `ROOM#CLIFFTOP`, `initialOrComponentIdChange`

**Not seen:** `reconcileStart`, `reconcileDone`, `performFlushDispatch` (Room).

**Ruled out:** Unmount flush dispatch storm; session flush/reconcile loop on this path.

**Confirmed:** H1 --- loop in `DefaultRenderEditor` / Slate + immediate persist under unstable `standardForm` (E1 remove editor -> OK; E3 debounce -> OK).

---

## Progress

| Step | Description | Status |
| --- | --- | --- |
| 1 | Reproduce, bisect, interim mitigation (Phase 1) | Done |
| 2 | Document invariants + regression tests (Phase 2) | **Next** |
| 3 | Implement invariant satisfaction (Phase 3) | Not started |
| 4 | Tests/docs/cleanup, restore `debounce={false}`, close out (Phase 4-5) | Not started |

---

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark each nested line as progress is made.

- [X] **Phase 1 --- Bisect symptom; interim mitigation**
  - [X] CPU throttle + session logs; confirm no flush/reconcile storm after initial Room mount.
  - [X] E1: bypass `DefaultRenderEditor` (H1 confirmed).
  - [X] E2: skipped (E3 succeeded).
  - [X] E3: `debounce={true}` interim mitigation; Area -> Room navigates.

- [ ] **Phase 2 --- Invariants, documentation, regression tests** *(before implementation patches)*
  - [ ] Draft invariant section for durable docs (I1-I5 above); link from this plan; decide target files (`personalAssets/AGENT.md`, `Workbench/AGENT.md`, or new short cross-cutting doc).
  - [ ] **I1 test:** same store, two selector reads, unchanged semantics -> same `getLocalStandardForm` / `getStandardForm` reference (fixed `now` where TTL applies).
  - [ ] **I1 test:** effective confirmed ids stable when `confirmedRequestIds` storage unchanged (may fail until Phase 3 --- documents expected behavior).
  - [ ] **I3/I5 test:** `StandardRenderEditor` or `DefaultRenderEditor` mount with stable mock store -> bounded renders / no runaway `updateComponent` (may use `@testing-library/react` + render count or act guard).
  - [ ] Optional: document collaboration path **I4** as a diagram or numbered list in durable docs (no code change required for pass).
  - [ ] Skip ad hoc console instrumentation unless a **new** hypothesis appears; prefer tests over `[slate-sync]` logs.

- [ ] **Phase 3 --- Implement invariant satisfaction** *(each change maps to I1-I5; record in **Experiment inventory**)*
  - [ ] E5 / I1: Stabilize `confirmedRequestIds` for Reselect (memoized selector or equivalent).
  - [ ] E6 / I1: Structural sharing or `deepEqual` at `useWorkbenchAsset` selector boundary if still needed after E5.
  - [ ] I3: Domain-stable `standard` guard in `useStandardRenderEditorHook` (mirror render `.equals()` pattern).
  - [ ] Run Phase 2 tests --- should pass.
  - [ ] **Acceptance:** restore `debounce={false}` on `DefaultRenderEditor`; manual Area -> Room + Phase 2 I5-style test still bounded.
  - [ ] E4 only if effective-overlay semantic bug suspected (unlikely).

- [ ] **Phase 4 --- Promote docs, retire interim mitigation**
  - [ ] Merge invariant text from Phase 2 draft into durable docs; remove duplication from this plan.
  - [ ] Mark E3 **Superseded** if `debounce={false}` restored; else document why `debounce={true}` remains with invariant reference.
  - [ ] Extend verification commands below with new test paths from Phase 2.

- [ ] **Phase 5 --- Close out**
  - [ ] Manual: Area -> Room without freeze; edit-save-confirm path without doubled overlay.
  - [ ] Run full verification suite.
  - [ ] Delete this task plan (git retains history).

---

## Experiment inventory

| ID | Date | Change summary | Files / location | Rollback steps | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | 2026-06-05 | Bypass `DefaultRenderEditor` in `RoomEditor.tsx` | [`RoomEditor.tsx`](../../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx) | N/A (reverted) | **Confirmed H1; reverted** | Bisect only. |
| E3 | 2026-06-05 | `debounce={true}` on situation render fields | [`DefaultRenderEditor.tsx`](../../../../../charcoal-client/src/components/Workbench/foundations/DefaultRenderEditor.tsx) | Restore `debounce={false}` | **Kept (interim)** | Symptom mitigation until Phase 3 acceptance. |

### Experiment templates (Phase 3)

| ID | Invariant | Change | Rollback |
| --- | --- | --- | --- |
| E5 | I1 | Stabilize confirmed ids for Reselect | Revert selector change |
| E6 | I1 | `deepEqual` or equivalent on `useWorkbenchAsset` selectors | Remove equality fn |
| *(Slate guard)* | I3 | Domain-stable `standard` in `useStandardRenderEditorHook` | Revert guard |
| E4 | overlay | Bypass `getEffectivePendingEdits` bisect | Restore effective pending |

---

## Verification

**Current (Phase 1 + interim E3):**

```bash
cd charcoal-client
npm run test:single -- src/slices/personalAssets/selectors.test.ts
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
```

**After Phase 2 (add paths as tests land):**

```bash
# Example placeholders --- update when files exist:
npm run test:single -- src/slices/personalAssets/selectors.test.ts
npm run test:single -- src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx
```

**After Phase 3:**

```bash
npm run test:single -- src/slices/personalAssets/pendingHygiene.test.ts
# + all Phase 2 invariant tests
```

**Manual:**

- [X] Area -> Room does not freeze (with E3 interim).
- [ ] Area -> Room does not freeze with `debounce={false}` after Phase 3.
- [ ] No doubled shortName / overlay on edit-save-confirm path.
- [ ] Invariants I1-I5 documented in durable docs outside this plan.

---

## Coordination / scope

- **In scope:** Client sync invariants, Workbench session + derived selectors, effective pending / `confirmedRequestIds`, regression tests for referential stability and editor mount bounds.
- **Out of scope:** Lambda/WML stream protocol changes unless invariant **I4** doc exposes a server-side gap.
- **Interim:** Ship with E3 in tree until Phase 3 acceptance; do not treat E3 as architectural resolution.

---

## When this task finishes

1. Invariants **I1-I5** live in durable package docs (not only this plan).
2. Regression tests fail if referential churn or unbounded session-editor mount returns.
3. E3 reverted or explicitly justified in docs.
4. Delete this file.
