# updateStandard batch extension (layered editing / session flush)

**Status:** **In progress** (active 2026-06-04). **Phase 0 (2026-06-04):** body retention at flush **PASS** (2b); merged shortName gate **SKIP** until fix lands (`it.skip` in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) --- confirmed **`LobbyLobby in the pitch-black`** when un-skipped). **Phase 1-2:** complete. **Phase 3 (2026-06-04): spec complete** --- see [Phase 3 decision](#phase-3-decision-layered-flush-persist-2026-06-04). **Next:** **spike** component flush with **`type: 'update'`** (same `applyWorkbenchFlush`); implement **`type: 'batch'`** only if spike fails. Asset-meta flush: **N/A** (stay **`updateLocal`**).

This plan is task-scoped. Archive or delete it after the initiative ships; move lasting norms into [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) and [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md).

**Framework:** [`taskPlanning/AGENT.md`](../../../AGENT.md)

**Related (shipped 2026-06):** Workbench consistency migration cleanup --- call sites use **`materializeComponentInAsset`**, **`onAssociateReference`**, and session associate; norms in [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md) and [`foundations/consistency/AGENT.md`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md). That work does **not** fix layered flush semantics by itself.

---

## Purpose

Record and eventually fix a **structural mismatch** between:

1. **Component editing sessions** --- `working` / `committed` come from **`getStandardForm`** (merged **inherited + local**).
2. **Asset-meta sessions** --- `working` / `committed` come from **`getLocalStandardForm`** only ([`useWorkbenchAssetMeta`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx)); asset `ShortName` / `Summary` / `_topLevel` are not layered through import inheritance the way component bodies are.
3. **`updateStandard` reducer paths** --- each dispatch uses **one** diff baseline: **merged** (`type: 'update'`) or **edit-layer** (`type: 'updateLocal'`).
4. **Component session flush today** --- **`updateLocal`** runs **`applyWorkbenchFlush`** (assign merged-shaped `working` onto a **local** clone). **Baseline mismatch** vs merged-shaped `working` causes the `LobbyLobby` bug. Normalize at flush was removed in Phase 2b; the old objection to **`update`** flush (normalize on merged clone) no longer applies.

**Preferred fix (spike first):** rewire component flush to **`type: 'update'`** so `standardForm.diff(modified)` matches author display. **`type: 'batch'`** remains the fallback if the spike fails or multi-step baselines are required later.

**Risk if unfixed:** layered imports + local overlays (e.g. Room `shortName`) can produce **wrong merged display** after flush (e.g. plain literal **concat** across inherited and local --- `"Lobby"` + `"Lobby in the pitch-black"`). See [Failure mode](#failure-mode-why-this-matters).

Workbench consistency migration cleanup shipped first (2026-06); that migration is **complete** and this plan is **active** again. Flush correctness under inheritance is a **first-class** goal, not an edge case.

---

## Terminology (avoid overloaded "local")

| Term | Meaning |
| --- | --- |
| **Edit-layer** | `getLocalStandardForm` / `updateLocal` baseline: `base + pendingEdits + edit` for **this asset only** (no `inherited` folded in). |
| **Merged view** | `getStandardForm`: `inherited.merge(localStandardForm)` --- **display** and session **`committed` / `working`**. |
| **Consistency layer** | Pure ops on **edit-layer** draft (`materializeComponent`, flush assign). Uses **`updateLocal`** for eager materialize; component flush persist TBD (`update` spike). |

Session "local working copy" in UI docs means **in-memory `working`**, not edit-layer --- easy to confuse with **`updateLocal`**.

---

## Current reducer behavior (baseline)

From [`reducers.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.ts):

| Payload | Callback receives | Diff baseline | Merged into `state.edit` |
| --- | --- | --- | --- |
| `update` | Clone of **merged** `standardForm` | `standardForm.diff(modified)` | Yes |
| `updateLocal` | Clone of **localStandardForm** | `localStandardForm.diff(modified)` | Yes |
| `removeComponent` | (no callback) | vs **localStandardForm** | Yes |

Both **`update`** and **`updateLocal`** persist via the **same** `mergeToEdit` --- the difference is **which draft the diff is computed against**, not a separate storage target.

Session flush ([`useWorkbenchComponent.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx)):

```typescript
updateStandard({
  type: 'updateLocal',
  update: (draft) => {
    applyWorkbenchFlush(draft, { componentId, working }) // working from merged committed
    return draft
  }
})
```

**Reconcile** (external Redux changes) already uses merged component algebra: `incoming.merge(lastReceived.diff(working))` in [`reconcileCommittedComponent`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts) --- a different pattern than flush assign.

---

## Failure mode (why this matters)

### Acceptance scenario (inherited Room shortName)

1. **Asset A** sets Room B `shortName` to `"Lobby"` (in inherited ancestry for Asset C).
2. **Asset C** imports Room B and edits so **merged** shortName is `"Lobby in the dark"` (overlay on edit layer).
3. Author opens Room on Asset C in Workbench; **`working.shortName`** reflects merged text.
4. Author changes to `"Lobby in the pitch-black"`; session **flush** runs.
5. **Bug class:** `getStandardForm` shows **`"LobbyLobby in the pitch-black"`** (or repeated prefix on subsequent flushes) if edit layer stores a **plain absolute** string while **inherited** still has plain `"Lobby"`, because WML **`StandardLiteral.merge`** on two plain strings **concatenates** (see [`standardForm.assetMeta.test.ts`](../../../../packages/mtw-wml/ts/standardize/integration/standardForm.assetMeta.test.ts)).

**Note:** Confirmed via reducer integration test (Phase 0 gate): `localStandardForm.diff(modified)` after wholesale assign does **not** preserve overlay semantics under inheritance; **`update`**-baseline diff is the first fix to try.

---

## Proposed direction: batch / multi-step `updateStandard`

### Goal

Allow **one** `updateStandard(assetId)(...)` dispatch (one debounced save, one `fetchImports` check) to run **ordered steps**, each with an explicit **perspective**:

| Perspective | Maps to today | Use for |
| --- | --- | --- |
| **`merged`** | `type: 'update'` | Mutations authored against **display / merged** shape (session persist delta). |
| **`local`** | `type: 'updateLocal'` | Mutations on **edit-layer** only (`normalizeWorkbenchDraft`, materialize side effects already on local draft, etc.). |

### Phase 3 decision (layered flush persist, 2026-06-04)

**Root cause:** component `working` is **merged-shaped** but flush diffs against **local** (`updateLocal` + wholesale assign) -> plain literal on edit + inherited concat.

**Preferred fix (try first):** component **`dispatchFlush`** uses existing **`type: 'update'`** --- same callback (`assureDefaultSituationFromPrimitives` when needed, then `applyWorkbenchFlush` on the **merged** clone). One dispatch, `standardForm.diff(modified)` -> `mergeToEdit`. No new payload type if Phase 0 gate passes.

**Fallback:** extend **`UpdateStandardPayload`** with **`type: 'batch'`** (ordered `steps`, baseline refresh between steps) if the **`update`** spike fails or a second committed baseline is required mid-dispatch.

| Option | Verdict |
| --- | --- |
| **Component flush -> `type: 'update'`** | **Try first** (post-2b; normalize no longer blocks) |
| **`type: 'batch'`** on the union | **Fallback** --- explicit multi-step / `lastReceived.diff(working)` persist if `update` assign is insufficient |
| Always-array top-level payload | **Defer** |
| Flush-only helper inside one `updateLocal` | **Reject** |
| **Asset-meta flush** | **N/A** for this bug --- session uses **local** form only; keep **`updateLocal`** + [`applyAssetMetaFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyAssetMetaFlush.ts) |

**Normative payload shape:**

```typescript
type UpdateStandardPayloadBatch = {
  type: 'batch'
  steps: Array<{
    perspective: 'merged' | 'local'
    update: (draft: StandardForm) => StandardForm
  }>
  base?: StandardFormData
  options?: ScopedInstrumentationOptions
}
```

**`lastUpdateDiff` (initial):** last step that produced a non-empty diff (same as today's single-step overwrite); document in Phase 4 if composite diff is needed for `fetchImports`.

### Normative reducer behavior

**Per step (in order):**

1. Recompute **`localStandardForm`** and **`standardForm`** from current `state` (after any prior step's `mergeToEdit`).
2. Choose baseline clone per `perspective`.
3. `modified = step.update(baseline.clone())`.
4. `diff = baseline.diff(modified)`; if non-empty, `mergeToEdit(diff)`.

**Component session flush (implement Phase 4-5):**

**Spike path (`type: 'update'` --- one callback, merged baseline):**

```typescript
updateStandard({
  type: 'update',
  update: (draft) => {
    if (hasDefaultFacet) {
      needsFetch = assureDefaultSituationFromPrimitives(draft)
    }
    applyWorkbenchFlush(draft, { componentId, working })
    return draft
  },
})
```

Run Phase 0 gate with this opcode in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts). D11: [`prepareComponentForFlush`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts) on **`working`** in `performFlush` before dispatch (unchanged).

**Fallback batch path** (only if spike fails) --- two steps on union `type: 'batch'`:

| Order | Perspective | Body |
| --- | --- | --- |
| 1 (when needed) | **`local`** | `assureDefaultSituationFromPrimitives` |
| 2 | **`merged`** | Persist via `lastReceived.diff(working)` on merged baseline --- **not** wholesale assign as persist |

No normalize step (retired Phase 2).

**Asset-meta flush:** **out of scope** --- [`useWorkbenchAssetMeta`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) already uses **local** `committed` / **`updateLocal`**; no inherited overlay on asset title/summary.

### Alternative (smaller scope) --- rejected 2026-06-04

**Flush-only pure helper** inside a single `updateLocal` step was considered when normalize caused annihilation; after 2b, the confirmed bug is **baseline mismatch** (`LobbyLobby`). **`type: 'update'`** may suffice without batch; batch is the fallback for explicit multi-step merged persist.

---

## What this is not

| Item | Notes |
| --- | --- |
| Replacing **`updateLocal`** for consistency layer | **materializeComponentInAsset** and **asset-meta** flush stay **`updateLocal`**. |
| **Component** flush -> **`update`** | **Preferred** post-2b (normalize removed from flush). Assign on **merged** clone so diff baseline matches `working`. |
| **`type: 'batch'`** for every flush | **Only if** `update` spike fails or multi-step baseline refresh is required. |
| Same work as consistency migration cleanup (shipped) | Migration fixed **call-site** patterns (materialize, `onAssociateReference`); this plan fixes **persist semantics under inheritance**. |

---

## Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Failing (or passing) regression: inherited + Room shortName + session flush | [X] FAIL (2026-06-04) |
| 1 | Investigate **normalize** / orphan GC on flush (Phase 0 diagnostics) | [X] (2026-06-04) |
| 2 | **Purge migration** + authoring UX (display union, pin/unpin, list confirms) | [X] (2026-06-04) |
| 3 | Flush persist spec (`update` spike, batch fallback; asset-meta N/A) | [X] (2026-06-04) |
| 4 | Fix component flush (`update` spike; batch if needed) | [ ] |
| 5 | Wire Workbench component flush; confirm asset-meta unchanged | [ ] |
| 6 | Durable docs + dispose this plan | [ ] |

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Test commands:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) --- run from `charcoal-client/`; authority: [`charcoal-client/AGENT.testing.md`](../../../../charcoal-client/AGENT.testing.md)
3. **Reducer:** [`personalAssets/reducers.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.ts), [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) (local vs merged)
4. **Session flush:** [`useWorkbenchComponent.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx), [`applyWorkbenchFlush.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts), [`workbenchMutations.ts`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts) (`reconcileCommittedComponent`)
5. **WML merge / shortName:** [`shortNameField.ts`](../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts), [`standardForm.assetMeta.test.ts`](../../../../packages/mtw-wml/ts/standardize/integration/standardForm.assetMeta.test.ts)
6. **Phase 1 normalize:** [`normalizeWorkbenchDraft.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/normalizeWorkbenchDraft.ts), [`isReferencedInAssetLayer.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/isReferencedInAssetLayer.ts); Phase 0 diagnostics in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts)
7. **Phase 2 top-level UX:** [`TopLevelEditor.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx), [`topLevelDisplayAdapter.ts`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/topLevelDisplayAdapter.ts), [`schemaOrganization.ts`](../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) (`getChildrenOfParent`)

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/slices/personalAssets/reducers.test.ts
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
npm run test:single -- src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts
```

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets) as each slice lands.

- [X] **Phase 0 --- Characterize current behavior**
  - [X] Add integration test: `inherited` Room `shortName` `"Lobby"`, local edit overlay `" in the dark"` (additive `<Space />`), session edit + `updateLocal` flush, assert merged `getStandardForm` shortName is **`"Lobby in the pitch-black"`** (not doubled prefix).
  - [X] Place test in `personalAssets/reducers.test.ts` and/or `useWorkbenchComponent.test.tsx` with harness `inherited` populated (not empty default).
  - [X] Record pass/fail in this doc **Status** line when run.
  - [X] Add test instrumentation (`logPhase0FlushDiagnostics`, `logPhase0LocalDraft`) for local draft after `applyWorkbenchFlush` and post-flush layers.
- [X] **Phase 1 --- Investigate normalize on flush (Phase 0 finding)**
  - [X] Reproduce with diagnostics: split assign vs normalize in Phase 0 test (`logPhase0LocalDraft` logs `_topLevel`, `isReferencedInAssetLayer`, `findOrphanComponents`). Room orphan **before assign**; removed on **normalize**; empty local draft before reducer `mergeToEdit`.
  - [X] Trace normalize + predicate: [`applyWorkbenchFlush.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts) (`imported Room shortName` describe). Import `ref={0}` on Room tag does **not** populate `_topLevel` or `referencedBy`; wholesale assign does not add linkage.
  - [X] Fix locus: **Phase 2** authoring UX (deletion intents, display union, no normalize-as-deletion); **Phase 3-5** flush persist (batch or helper, overlay shape).
  - [X] Record conclusion in **Status** and Progress table.
- [X] **Phase 2 --- Authoring UX + Purge migration** (implement [migration order](#phase-2-migration-purge-in-normalize-out) first)
  - [X] **2a Purge helper (consistency layer)** (2026-06-04) --- [`previewPurgeClosure`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/previewPurgeClosure.ts), [`confirmPurgeBeforeRemove`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmPurgeBeforeRemove.ts), [`purgeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/purgeComponentInAsset.ts); reducer `removeComponent` accepts **`cascade?: boolean`** (default `true`). See [Purge API sketch](#purge-api-sketch-consistency-layer).
  - [X] **2b Remove normalize from flush** (2026-06-04) --- **`normalizeWorkbenchDraft`** removed from [`applyWorkbenchFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts) / [`applyAssetMetaFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyAssetMetaFlush.ts); Phase 0 body retention test green; merged shortName gate skipped until Phase 3. Orphan stack deletion deferred to **2c** per [evaluation](#normalize-removal-evaluation-phase-2)
  - [X] **2c Wire Purge UX** (2026-06-04) --- TopLevel **Purge** via [`purgeComponentFromAssetFlow`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/purgeComponentFromAssetFlow.ts); [`confirmSiteDisassociateBeforeLocalEdit`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmSiteDisassociateBeforeLocalEdit.ts) on list rows; orphan stack deleted
  - [X] **2d Display union + pin/unpin** (2026-06-04) --- [`topLevelDisplayAdapter.ts`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/topLevelDisplayAdapter.ts); merged-form **`getChildrenOfParent(undefined)`** + **`working.topLevel` `ref>=1`** pins; Pin/Unpin row actions in [`TopLevelEditor`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx) / [`ReferenceListEditorGeneric`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListEditorGeneric.tsx)
  - [X] **Top-level Add / Import / Reference existing:** [`materializeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/materializeComponentInAsset.ts) then **`assureItem` on `working.topLevel`** (roster pin / `ref={1}`) --- explicit author intent at the Components list site
  - [X] **Components list display:** union via adapter; **pinned** vs **display-only** subtitles and row actions
  - [X] **Pin / Unpin:** Pin adds **`ref={1}`** on `_topLevel`; Unpin = site-local disassociate (2c confirm)
  - [X] **List row remove (2c):** site-local disassociate; copy lists **remaining `referencedBy`**
  - [X] **Tests (2d):** [`topLevelDisplayAdapter.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/topLevelDisplayAdapter.test.ts), [`TopLevelEditor.test.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.test.tsx); Phase 0 import body retained in [`applyWorkbenchFlush.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts)
- [X] **Phase 3 --- Layered flush persist (spec)** (implementation in Phase 4-5)
  - [X] **Regression gate:** `LobbyLobby in the pitch-black` when un-skipped; remains `it.skip` until fix lands.
  - [X] **Asset-meta flush:** **N/A** --- local-only session; keep **`updateLocal`** (no batch / merged persist).
  - [X] **Component fix strategy:** **`type: 'update'`** spike first (merged baseline + same flush callback); **`type: 'batch'`** fallback only if spike fails. See [Phase 3 decision](#phase-3-decision-layered-flush-persist-2026-06-04).
  - [X] **Not chosen:** always-array payload; flush-only `updateLocal` helper as primary path.
- [ ] **Phase 4 --- Fix component flush persist**
  - [ ] **Spike:** Phase 0 harness with `type: 'update'` instead of `updateLocal` (same `applyWorkbenchFlush`); un-skip gate when green.
  - [ ] **If spike passes:** no `type: 'batch'` reducer work required for this bug class (document flush rule: component session -> `update`).
  - [ ] **If spike fails:** implement `type: 'batch'` + merged persist helper (`lastReceived.diff(working)` or form-equivalent); unit tests (two-step batch, order sensitivity).
- [ ] **Phase 5 --- Wire Workbench**
  - [ ] `useWorkbenchComponent` `dispatchFlush` uses spike-approved opcode (`update` expected).
  - [ ] **Asset-meta:** no change (`updateLocal`).
  - [ ] Re-run Phase 0 test green; update Workbench / personalAssets AGENT flush tables.
- [ ] **Phase 6 --- Docs and cleanup**
  - [ ] Update `personalAssets/AGENT.md` (component flush -> `update` or batch fallback; Purge vs `removeComponent`; when to use perspectives).
  - [ ] Update Workbench AGENT (session flush, top-level pin vs display union, deletion intents).
  - [ ] Update consistency AGENT (retire normalize-as-deletion norm; Purge path).
  - [X] Consistency migration cleanup shipped; norms in Workbench `AGENT.md` (no separate task plan).
  - [ ] Archive or delete this plan.

---

## Verification

When implementation starts, from `charcoal-client/`:

```bash
cd charcoal-client

# Phase 4 spike: change Phase 0 flush payload to type: 'update', then un-skip merged shortName gate
npm run test:single -- src/slices/personalAssets/reducers.test.ts -t "inherited shortName"
npm run test:single -- src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts

# Phase 2 (purge migration, top-level UX, reference list)
npm run test:single -- src/components/Workbench/foundations/consistency/confirmSiteDisassociateBeforeLocalEdit.test.ts
npm run test:single -- src/components/Workbench/foundations/consistency/previewPurgeClosure.test.ts
npm run test:single -- src/components/Workbench/foundations/consistency/confirmPurgeBeforeRemove.test.ts
npm run test:single -- src/components/Workbench/foundations/ReferenceList
npm run test:single -- src/components/Workbench/foundations/consistency

# After reducer change (Phase 4)
npm run test:single -- src/slices/personalAssets

# After session flush wire-up (Phase 5)
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent
npm run test:single -- src/components/Workbench/foundations/WorkbenchAssetMeta
```

**Manual smoke (Draft asset with import):** edit imported Room `shortName` in Workbench, flush, reload view --- merged label matches author intent, no prefix duplication.

---

## Phase 1 findings (2026-06-04)

| Stage | `isReferencedInAssetLayer` | `findOrphanComponents` | `ROOM#lobby` body |
| --- | --- | --- | --- |
| Local draft before assign | false | `[ROOM#lobby]` | present (additive overlay) |
| After assign only | false | `[ROOM#lobby]` | present (plain merged shortName) |
| After normalize | n/a | `[]` | **removed** |

| Finding | Fix locus (phases) |
| --- | --- |
| `_topLevel` empty; `referencedBy` empty on fixture | **Phase 2:** display union for discoverability; pin optional; **do not** treat as orphan for deletion |
| Normalize removes room (expected D3) | **Phase 2b (done):** flush assign-only (no body GC at flush); **2c:** retire normalize-as-deletion in preview/confirm; **Phase 3-5:** overlay persist |
| `prepareComponentForFlush` writes plain merged string | **Phase 3-5:** overlay persist (`lastReceived.diff(working)` / batch or helper) |
| Annihilation + wrong literal shape | **Phase 2** Purge vs disassociate + **Phase 3-5** flush persist |

---

## Normalize removal evaluation (Phase 2)

**Question:** Do we still need **`normalizeWorkbenchDraft`** after the Phase 2 authoring model (site disassociate, explicit Purge, display union)?

**Conclusion: No for product behavior.** Remove the orphan-GC stack in Phase 2. Leave consistency layer as **materialize** (+ **flush assign**). Deletion is **explicit** (Purge / engine **`removeComponent`**), not flush side effect.

### What normalize does today (only these call sites)

| Piece | Role | Production callers |
| --- | --- | --- |
| [`normalizeWorkbenchDraft`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/normalizeWorkbenchDraft.ts) | Fixpoint: delete `byUniversalId` bodies where **`!isReferencedInAssetLayer`**, then **`scrubReferences`** | [`applyWorkbenchFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts), [`applyAssetMetaFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyAssetMetaFlush.ts) |
| [`isReferencedInAssetLayer`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/isReferencedInAssetLayer.ts) | Orphan predicate (`_topLevel` union `referencedBy`) | Used only by normalize |
| [`previewOrphanClosure`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/previewOrphanClosure.ts) | Simulate normalize on clone | [`confirmOrphanClosure*`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmOrphanClosureBeforeLocalEdit.ts) |
| **`confirmOrphanClosure*`** | Dialog: "Removing this reference will also remove the component..." | [`TopLevelEditor`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx), [`LensHeader`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensHeader.tsx), [`RoomSituationsListEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomSituationsListEditor.tsx) |

**Not used:** [`materializeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/materializeComponentInAsset.ts) (tests assert normalize is not called). Reducer **`removeComponent`** is separate (Workbench list rows avoid it today).

### Why removal is safe under the new model

| Former normalize job | Replacement |
| --- | --- |
| Delete body after last list disassociate | **Do not** auto-delete; body remains until **Purge** (or WML-empty + explicit purge policy later). Matches **StandardForm merge** tolerance for unreferenced non-empty bodies. |
| Transitive GC (e.g. unpin Room -> drop nested Feature) | **Reject** as implicit behavior; author **Purges** each key or disassociates at each site. Old D4 tests document retired policy. |
| Confirm before disassociate | **Replace** with site-local copy ("still referenced from Area X") or no confirm; **never** simulate normalize. |
| Defensive **`scrubReferences`** after body removal | **`removeComponent`** already runs **`removeReferences`** + strips **`_topLevel`**. No scrub needed on assign-only flush. |
| Phase 0 import bug (flush deletes Room) | Fixed by **removing normalize from flush**, not by tuning predicate. |

### What we keep (thinner consistency layer)

- [`materializeComponent`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/materializeComponent.ts) / [`materializeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/materializeComponentInAsset.ts) (asset-level entry)
- [`applyWorkbenchFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts) / [`applyAssetMetaFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyAssetMetaFlush.ts) **without** normalize call (assign + optional `beforeAssign` only)
- **Purge** helpers (preview + confirm + dispatch) --- see [migration](#phase-2-migration-purge-in-normalize-out)

### Removal scope (Phase 2 sub-task; after 2a/2b)

- [X] Remove **`normalizeWorkbenchDraft`** (+ `findOrphanComponents`, `scrubReferences`, `normalizeSinglePass` exports used only by preview).
- [X] Remove **`previewOrphanClosure`** and **`confirmOrphanClosureBeforeLocalEdit.ts`**; update TopLevel / Lens / Situations list removes.
- [X] Remove **`isReferencedInAssetLayer`** (site-local confirm uses **`localForm.referencedBy`**).
- [X] Trim [`consistency/index.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/index.ts) exports; delete orphan tests; add [`confirmSiteDisassociateBeforeLocalEdit.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmSiteDisassociateBeforeLocalEdit.test.ts).
- [X] Update [`applyWorkbenchFlush.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts); [`AGENT.md`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md) policy tables.
- [X] **`reducers.test.ts`** Phase 0 diagnostics use **`referencedBy`** only (no **`findOrphanComponents`**).

### Residual risks (acceptable)

- **Empty unreferenced bodies** may linger in `byUniversalId` until Purge (clutter in **Reference existing** / selectors). Acceptable; optional future "empty component" indicator.
- **Dangling refs** only if something deletes a body without **`removeComponent`**; Purge path must use engine API.

---

## Phase 2 migration: Purge in, normalize out

**Treat as one migration:** retire implicit deletion (normalize + orphan confirm) and ship explicit **Purge** with real guard-rails. Do **not** delete normalize until Purge preview/confirm exists for flows that today rely on **`includesNonEmpty`** dialogs.

### Recommended implementation order

| Step | Work | Why first |
| --- | --- | --- |
| **2a** | Add **`previewPurgeClosure`** + **`confirmPurgeBeforeRemove`** (+ optional **`purgeComponentInAsset`** thunk) in [`foundations/consistency/`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/) | New guard-rail before removing old one |
| **2b** | Remove **`normalizeWorkbenchDraft`** from flush pipelines only | Fixes Phase 0 flush deleting import overlay; keeps orphan preview until 2c |
| **2c** | Delete orphan stack; swap list-row confirms to site-local copy; wire Purge buttons | Complete migration off normalize semantics |
| **2d** | Display union, pin/unpin, import-without-auto-pin | Independent UX; can parallelize after 2b |

### Purge vs normalize (replacement map)

| Old (broken guard-rail) | New |
| --- | --- |
| Flush **`normalizeWorkbenchDraft`** drops unreferenced bodies | Flush **assign only**; bodies stay until Purge |
| **`previewOrphanClosure`** + "will remove component" on **disassociate** | **No** body deletion on disassociate; optional "still in Area X" from **`referencedBy`** |
| Implicit transitive GC via normalize fixpoint | Author **Purge** with explicit **rehome vs cascade** when descendants exist |

### Rehome vs cascade (Purge confirm)

When purging **X**, any **implicit descendant** ([`implicitDescendantsOfAncestor`](../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts)) with a body on the **local** draft must be called out in the dialog.

| Choice | Engine | Author sees |
| --- | --- | --- |
| **Rehome** | [`removeComponent`](../../../../packages/mtw-wml/ts/standardize/index.ts) with **`{ cascade: false }`** | Descendant bodies **remain** in `_components` (hoisted stubs per integration tests). They become **asset-scoped** in organization / **display union** (`getChildrenOfParent(asset)`). Does **not** auto-**pin** (`ref={1}` on `_topLevel`) unless product adds that later. |
| **Cascade delete** | **`{ cascade: true }`** (today's reducer default) | All descendant bodies removed; refs scrubbed from survivors and `_topLevel`. |

**Dialog copy (when `descendantKeys.length > 0`):** e.g. "Removing **Room Lobby** would **rehome** **Feature Clock** and **Situation Dark** to the asset top level, or **delete** them with the Room. Choose **Rehome** / **Cascade delete** / **Cancel**."

**When no descendants:** single confirm (non-empty body and/or **`referencedBy`** / pins) listing **bodies removed** and **reference scrub** on parents; no rehome branch.

**Reducer (shipped 2a):** [`removeComponent`](../../../../charcoal-client/src/slices/personalAssets/reducers.ts) payload includes **`cascade?: boolean`** (default **`true`** for non-Workbench callers). Purge dispatches the author's choice via [`purgeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/purgeComponentInAsset.ts).

### Purge API sketch (consistency layer)

Pure preview on **edit-layer** clone (optional **`applyLocal`** if unflushed session edits must be included):

```ts
// previewPurgeClosure.ts (names tentative)
type PurgeDescendantDisposition = 'rehome' | 'cascade'

type PreviewPurgeClosureResult = {
  targetKey: ComponentUUID
  /** Bodies removed from _components when simulating purge of target */
  bodiesRemoved: ComponentUUID[]
  /** Descendants that would remain after rehome (cascade: false) */
  bodiesRehomed: ComponentUUID[]
  /** Descendants removed only under cascade */
  bodiesCascadeDeleted: ComponentUUID[]
  includesNonEmpty: boolean
  needsDescendantChoice: boolean
}

function previewPurgeClosure(
  localDraft: StandardForm,
  reference: StandardReference,
  options?: { applyLocal?: (draft: StandardForm) => void }
): PreviewPurgeClosureResult
```

**Simulation rules:**

1. `const before = localDraft._clone()`; `options?.applyLocal?.(before)`.
2. `descendants = before._getSchemaOrganization().implicitDescendantsOfAncestor(target.standardKey)` filtered to keys with a local body.
3. `afterRehome = before.removeComponent(reference, { cascade: false })` -> **`bodiesRehomed`** = descendant universalKeys still in `afterRehome._components`.
4. `afterCascade = before.removeComponent(reference, { cascade: true })` -> **`bodiesRemoved`** / **`bodiesCascadeDeleted`** via key-set diff on `_components` (same approach as discussed for dialog bullet lists).
5. **`includesNonEmpty`:** any removed/rehomed body was non-empty on **`before`**.
6. **`needsDescendantChoice`:** `bodiesRehomed.length > 0` (equivalently: any local implicit descendant).

**Confirm + dispatch:**

- **`confirmPurgeBeforeRemove({ dispatch, localStandardForm, reference, preview })`** -> `'cancel' | 'rehome' | 'cascade'` using **`pushChoice`** (three-option dialog when `needsDescendantChoice`).
- **`purgeComponentInAsset({ assetKey, reference, disposition })`** --- awaitable thunk: **`updateStandard({ type: 'removeComponent', componentKey, cascade: disposition === 'cascade' })`** once reducer accepts **`cascade`**.

**Tests:** parity with [`standardForm.removeComponent.test.ts`](../../../../packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts) fixtures; clone non-mutation; rehome vs cascade key sets.

---

## Authoring operations model (Phase 2 target)

**`_topLevel` positive `ref={1}`** means **pinned to the asset Components roster** (organizational authoring), not in-fiction placement. **Area->Room** and similar refs carry structural meaning in this asset.

| Author intent | Operation |
| --- | --- |
| Create / import local body | **Materialize** to `_components` only; associate at chosen **site** (e.g. Area list) |
| See at asset root | **Display union** (`SchemaOrganization` + optional pins) |
| List on asset roster | **Pin** (`ref={1}` on `_topLevel`) |
| Stop roster listing | **Unpin** (remove `ref={1}` from `_topLevel` only) |
| Remove one parent's link | **Disassociate** at that site (list row remove) |
| Remove from this asset's edit data | **Purge** (`removeComponent` on local draft; confirm lists impact; **rehome** or **cascade** descendants) |

**Example:** Room in two Areas, visible at asset via union -> remove from both Areas -> still in union until **Purge** removes body and all local refs.

---

## Open questions

### Phase 1 (normalize investigation) --- answered 2026-06-04

1. **Why empty local draft?** `normalizeWorkbenchDraft` removes `ROOM#lobby` because `!isReferencedInAssetLayer` on the **pre-flush** local draft (and still after assign). The edit-layer Room body with additive shortName is a **non-empty orphan** per D3.
2. **Predicate false after assign?** Yes, but also **before assign**. `_topLevel` is `[]` on base, edit, and `base.merge(edit)`; `referencedBy(room)` is `[]`. Inline import `ref={0}` on the Room WML does not count toward the predicate (self-ref excluded).
3. **Preserve stub vs skip normalize?** **Phase 2:** do not use normalize as deletion; optional pin/`ref={0}` for roster. **Phase 3-5:** fix **persist shape** on flush.

**Evidence:** Phase 0 test split logging; [`applyWorkbenchFlush.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts) `imported Room shortName` describe.

### Phase 2 (authoring UX) --- answered 2026-06-04 (2d)

1. **Display union form:** **Merged** `standardForm` for `getChildrenOfParent`; pins on **`working.topLevel`** (session -> local `_topLevel` on flush).
2. **Rehome auto-pin:** Deferred; display union is enough for visibility.
3. **Row actions:** **Pinned** = Unpin + Purge; **display-only** = Pin + Purge (no Unpin).
4. **Empty orphan hint:** Deferred.
5. **Purge entry points:** TopLevel row (shipped 2c); component header TBD.
6. **Top-level Add/Import/Reference existing:** Auto-pin on `working.topLevel` (roster intent at that site).

### Phase 3 (layered flush persist) --- answered 2026-06-04

1. **Component flush opcode?** Try **`type: 'update'`** first (post-2b: normalize no longer blocks). **`type: 'batch'`** only if spike fails.
2. **Batch vs always-array vs helper?** Batch union member is **fallback**, not mandatory first ship; defer always-array.
3. **`lastUpdateDiff`?** Last non-empty diff (single `update` step or last batch step).
4. **Asset-meta under inheritance?** **N/A** --- [`useWorkbenchAssetMeta`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) uses **local** `committed`; keep **`updateLocal`**.
5. **If batch needed:** optional **`local`** `assureDefaultSituationFromPrimitives` then **`merged`** persist via `lastReceived.diff(working)` --- not wholesale assign.

**Open for Phase 4 spike only:** does `applyWorkbenchFlush` on a **merged** clone (via `update`) produce a correct `mergeToEdit` diff for the Phase 0 fixture?

---

## When the task finishes

1. Move API and perspective rules into [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md).
2. Document session flush + terminology in [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md).
3. Delete or archive this file; keep git history.
