# updateStandard batch extension (layered editing / session flush)

**Status:** **In progress** (active 2026-06-04). **Phase 0 (2026-06-04):** body retention at flush **PASS** (2b); merged shortName gate **SKIP** until Phase 3 (`it.skip` in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) --- receives `LobbyLobby in the pitch-black`). **Phase 1 (2026-06-04): complete** --- orphan GC at flush is **misaligned** with import/overlay storage (predicate vs schema tree); see [Phase 1 findings](#phase-1-findings-2026-06-04). **Phase 2 (in progress):** **2a-2b complete** (Purge helper; flush assign-only); **next 2c** --- delete orphan stack, wire Purge UX, then 2d (see [migration](#phase-2-migration-purge-in-normalize-out)). **Phase 3+:** layered flush persist (batch or helper).

This plan is task-scoped. Archive or delete it after the initiative ships; move lasting norms into [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) and [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md).

**Framework:** [`taskPlanning/AGENT.md`](../../../AGENT.md)

**Related (shipped 2026-06):** Workbench consistency migration cleanup --- call sites use **`materializeComponentInAsset`**, **`onAssociateReference`**, and session associate; norms in [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md) and [`foundations/consistency/AGENT.md`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md). That work does **not** fix layered flush semantics by itself.

---

## Purpose

Record and eventually fix a **structural mismatch** between:

1. **Component / asset-meta editing sessions** --- `working` is cloned from **`getStandardForm`** (merged **inherited + local** view: what the author sees).
2. **`updateStandard` reducer paths** --- each dispatch uses **one** diff baseline: either **merged** (`type: 'update'`) or **edit-layer only** (`type: 'updateLocal'`).
3. **Session flush today** --- a **single** `updateLocal` callback runs **`applyWorkbenchFlush`** (assign merged-shaped `working` onto a **local** draft clone, then **`normalizeWorkbenchDraft`**).

That bundles **display-shaped persist** and **edit-layer normalize** into one operation, but only **`updateLocal`**'s baseline is available in the callback. Neither opcode alone models both perspectives cleanly; swapping flush to `update` would break running **normalize** on the correct draft (local only, per [consistency AGENT.md](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md)).

**Risk if unfixed:** layered imports + local overlays (e.g. Room `shortName`) can produce **wrong merged display** after flush (e.g. plain literal **concat** across inherited and local --- `"Lobby"` + `"Lobby in the pitch-black"`). See [Failure mode](#failure-mode-why-this-matters).

Workbench consistency migration cleanup shipped first (2026-06); that migration is **complete** and this plan is **active** again. Flush correctness under inheritance is a **first-class** goal, not an edge case.

---

## Terminology (avoid overloaded "local")

| Term | Meaning |
| --- | --- |
| **Edit-layer** | `getLocalStandardForm` / `updateLocal` baseline: `base + pendingEdits + edit` for **this asset only** (no `inherited` folded in). |
| **Merged view** | `getStandardForm`: `inherited.merge(localStandardForm)` --- **display** and session **`committed` / `working`**. |
| **Consistency layer** | Pure ops on **edit-layer** draft (`materializeComponent`, flush assign; **normalize slated for removal**). Correctly uses **`updateLocal`** today. |

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

**Note:** Whether production code hits this today depends on whether `localStandardForm.diff(modified)` after wholesale `applyWorkingComponentToDraft` preserves **Replace/With** overlay semantics. **There is no Workbench test** with non-empty `inherited` + session flush on `shortName` --- treat as **unknown until tested**.

---

## Proposed direction: batch / multi-step `updateStandard`

### Goal

Allow **one** `updateStandard(assetId)(...)` dispatch (one debounced save, one `fetchImports` check) to run **ordered steps**, each with an explicit **perspective**:

| Perspective | Maps to today | Use for |
| --- | --- | --- |
| **`merged`** | `type: 'update'` | Mutations authored against **display / merged** shape (session persist delta). |
| **`local`** | `type: 'updateLocal'` | Mutations on **edit-layer** only (`normalizeWorkbenchDraft`, materialize side effects already on local draft, etc.). |

### Normative reducer behavior (sketch)

Payload shape (name TBD), e.g.:

```typescript
type UpdateStandardPayloadBatch = {
  type: 'batch'
  steps: Array<{
    perspective: 'merged' | 'local'
    update: (draft: StandardForm) => StandardForm
  }>
  options?: ScopedInstrumentationOptions
}
```

**Per step (in order):**

1. Recompute **`localStandardForm`** and **`standardForm`** from current `state` (after any prior step's `mergeToEdit`).
2. Choose baseline clone per `perspective`.
3. `modified = step.update(baseline.clone())`.
4. `diff = baseline.diff(modified)`; if non-empty, `mergeToEdit(diff)`.

**Example: component session flush (two steps):**

1. **`merged`:** apply session edit relative to merged view (alternative to assigning full `working` onto local draft) --- e.g. derive `lastReceived.diff(working)` and merge into draft, or patch `byUniversalId[id]` in merged-safe form.
2. **`local`:** `normalizeWorkbenchDraft(draft)` on **updated** edit-layer draft (no inherited in clone).

Exact step bodies are **design deliverables** in Phase 3; the batch mechanism is the enabler.

### Alternative (smaller scope)

**Flush-only pure helper** inside a single `updateLocal` step: compute persist diff in merged space, apply to local clone, then normalize --- **no** new payload type. Phase 0 regression + Phase 1 normalize investigation inform whether a normalize-only fix suffices; if not, choose batch vs helper in Phase 2.

---

## What this is not

| Item | Notes |
| --- | --- |
| Replacing **`updateLocal`** for consistency layer | **materializeComponentInAsset**, orphan normalize, asset-meta flush stay **edit-layer** / single-step **`updateLocal`**. |
| Flipping session flush to **`update` only** | Would run normalize on **merged** clone --- wrong for orphan predicate and [consistency AGENT.md](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md). |
| Same work as consistency migration cleanup (shipped) | Migration fixed **call-site** patterns (materialize, `onAssociateReference`); this plan fixes **persist semantics under inheritance**. |

---

## Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Failing (or passing) regression: inherited + Room shortName + session flush | [X] FAIL (2026-06-04) |
| 1 | Investigate **normalize** / orphan GC on flush (Phase 0 diagnostics) | [X] (2026-06-04) |
| 2 | **Purge migration** + authoring UX (display union, pin/unpin, list confirms) | [ ] in progress (2a-2b done) |
| 3 | Design decision: **batch API** vs **flush-only helper** (layered flush persist) | [ ] |
| 4 | Implement reducer + types + thunk passthrough | [ ] |
| 5 | Rewire `useWorkbenchComponent` / `useWorkbenchAssetMeta` flush | [ ] |
| 6 | Durable docs + dispose this plan | [ ] |

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Test commands:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) --- run from `charcoal-client/`; authority: [`charcoal-client/AGENT.testing.md`](../../../../charcoal-client/AGENT.testing.md)
3. **Reducer:** [`personalAssets/reducers.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.ts), [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) (local vs merged)
4. **Session flush:** [`useWorkbenchComponent.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx), [`applyWorkbenchFlush.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts), [`workbenchMutations.ts`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts) (`reconcileCommittedComponent`)
5. **WML merge / shortName:** [`shortNameField.ts`](../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts), [`standardForm.assetMeta.test.ts`](../../../../packages/mtw-wml/ts/standardize/integration/standardForm.assetMeta.test.ts)
6. **Phase 1 normalize:** [`normalizeWorkbenchDraft.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/normalizeWorkbenchDraft.ts), [`isReferencedInAssetLayer.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/isReferencedInAssetLayer.ts); Phase 0 diagnostics in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts)
7. **Phase 2 top-level UX:** [`TopLevelEditor.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx), [`referenceListAdapter.ts`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/referenceListAdapter.ts), [`schemaOrganization.ts`](../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) (`getChildrenOfParent`)

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
- [ ] **Phase 2 --- Authoring UX + Purge migration** (implement [migration order](#phase-2-migration-purge-in-normalize-out) first)
  - [X] **2a Purge helper (consistency layer)** (2026-06-04) --- [`previewPurgeClosure`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/previewPurgeClosure.ts), [`confirmPurgeBeforeRemove`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmPurgeBeforeRemove.ts), [`purgeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/purgeComponentInAsset.ts); reducer `removeComponent` accepts **`cascade?: boolean`** (default `true`). See [Purge API sketch](#purge-api-sketch-consistency-layer).
  - [X] **2b Remove normalize from flush** (2026-06-04) --- **`normalizeWorkbenchDraft`** removed from [`applyWorkbenchFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts) / [`applyAssetMetaFlush`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyAssetMetaFlush.ts); Phase 0 body retention test green; merged shortName gate skipped until Phase 3. Orphan stack deletion deferred to **2c** per [evaluation](#normalize-removal-evaluation-phase-2)
  - [ ] **2c Wire Purge UX** --- mount explicit Purge actions; replace [`confirmOrphanClosure*`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmOrphanClosureBeforeLocalEdit.ts) on list rows with site-local copy only
  - [ ] **2d Display union + pin/unpin + import** --- product model in [`AGENT.reference-lists.md`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) / [`consistency/AGENT.md`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md): **`_topLevel` `ref={1}` = roster pin only**; structural = nested **`referencedBy`**; schema **`ref={0}`** = display/organization
  - [ ] **Import / Add at top-level:** [`materializeComponentInAsset`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/materializeComponentInAsset.ts) -> **`_components` only**; do **not** auto-`assureItem` on [`working.topLevel`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx)
  - [ ] **Components list display:** union pins + **`SchemaOrganization.getChildrenOfParent(asset)`** via adapter; **pinned** vs **display-only** rows
  - [ ] **Pin / Unpin:** explicit **`ref={1}`** on `_topLevel` only
  - [ ] **List row remove:** site-local disassociate; copy lists **remaining `referencedBy`** (no normalize simulation)
  - [ ] Tests: `previewPurgeClosure` / `confirmPurge*`; flush assign-only; purge rehome vs cascade; TopLevel import; display union; Phase 0 import body not deleted at flush
- [ ] **Phase 3 --- Design decision (layered flush persist)**
  - [ ] Phase 0 still fails until persist fixed; choose **batch payload** vs **flush-only helper** (`lastReceived.diff(working)` / merge-on-local overlay, not merged wholesale assign). Document tradeoffs (`lastUpdateDiff`, asset-meta parity).
  - [ ] Define step order for component flush and asset-meta flush; flush steps are **assign/persist only** (normalize removed in Phase 2).
  - [ ] Re-run Phase 0 test green as gate after Phase 4-5.
- [ ] **Phase 4 --- Implement (reducer / flush)**
  - [ ] Extend `UpdateStandardPayload` + reducer loop with baseline refresh between steps (if Phase 3 selects batch).
  - [ ] Thunk in [`index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) unchanged except accepting new payload (still one dispatch).
  - [ ] Unit tests: two-step batch (merged then local), empty second step, order sensitivity.
- [ ] **Phase 5 --- Wire Workbench (session flush)**
  - [ ] `dispatchFlush` in `useWorkbenchComponent` uses batch (or approved helper).
  - [ ] `useWorkbenchAssetMeta` flush if same bug class applies to `_shortName` / `_summary` under inheritance.
  - [ ] Re-run Phase 0 test green.
- [ ] **Phase 6 --- Docs and cleanup**
  - [ ] Update `personalAssets/AGENT.md` (batch API and/or flush rules; Purge vs `removeComponent`; when to use perspectives).
  - [ ] Update Workbench AGENT (session flush, top-level pin vs display union, deletion intents).
  - [ ] Update consistency AGENT (retire normalize-as-deletion norm; Purge path).
  - [X] Consistency migration cleanup shipped; norms in Workbench `AGENT.md` (no separate task plan).
  - [ ] Archive or delete this plan.

---

## Verification

When implementation starts, from `charcoal-client/`:

```bash
cd charcoal-client

# Phase 0+ gate (stdout: Phase 0 flush diagnostics)
npm run test:single -- src/slices/personalAssets/reducers.test.ts -t "inherited shortName"
npm run test:single -- src/components/Workbench/foundations/consistency/normalizeWorkbenchDraft.test.ts
npm run test:single -- src/components/Workbench/foundations/consistency/isReferencedInAssetLayer.test.ts
npm run test:single -- src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts

# Phase 2 (purge migration, top-level UX, reference list)
npm run test:single -- src/components/Workbench/foundations/consistency/previewPurgeClosure.test.ts
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

- [ ] Remove **`normalizeWorkbenchDraft`** (+ `findOrphanComponents`, `scrubReferences`, `normalizeSinglePass` exports used only by preview).
- [ ] Remove **`previewOrphanClosure`** and **`confirmOrphanClosureBeforeLocalEdit.ts`**; update TopLevel / Lens / Situations list removes.
- [ ] Remove **`isReferencedInAssetLayer`** unless a thin helper is needed for Purge copy (prefer inline **`localForm.referencedBy`** + `_topLevel` pin check).
- [ ] Trim [`consistency/index.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/index.ts) exports and delete or rewrite tests: `normalizeWorkbenchDraft.test.ts`, `previewOrphanClosure.test.ts`, `isReferencedInAssetLayer.test.ts` (predicate tests optional if helper kept).
- [ ] Update [`applyWorkbenchFlush.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.test.ts) (e.g. "normalizes orphans" example -> assign-only); [`AGENT.md`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md) policy tables (WML vs Workbench orphan row goes away).
- [ ] **`reducers.test.ts`** Phase 0 diagnostics may keep **`findOrphanComponents`** imports temporarily or drop once flush no longer deletes bodies.

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

### Phase 2 (authoring UX)

1. Display union on **merged** or **local** `StandardForm` for `getChildrenOfParent`?
2. **Rehome** confirm: is asset-scoped visibility (display union) enough, or should rehome also **auto-pin** `ref={1}` on `_topLevel`?
3. Row actions when **display-only** vs **pinned** (Unpin visible only when `ref={1}` present)?
4. After normalize removal, any **empty** orphan bodies worth a passive UI hint before Purge?
5. Purge entry points: component header only, TopLevel row, or both?

### Phase 3 (layered flush persist, after Phase 2)

1. Should **`merged`** step use **`incoming.merge(lastReceived.diff(working))`** at **form** scope instead of component wholesale assign?
2. Is **asset-meta** flush (`applyAssetMetaFlush`) affected for inherited asset `ShortName` / `Summary`?
3. Should **`lastUpdateDiff`** reflect composite diff, last step only, or remain diagnostic-only?
4. Can **`assureDefaultSituationFromPrimitives`** stay in **local** step only (no normalize GC)?

---

## When the task finishes

1. Move API and perspective rules into [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md).
2. Document session flush + terminology in [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md).
3. Delete or archive this file; keep git history.
