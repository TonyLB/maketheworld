# updateStandard batch extension (layered editing / session flush)

**Status:** **Deferred** (discovered 2026-06; not scheduled). **Phase 0 (2026-06-04): FAIL** --- reducer integration test `merged shortName after updateLocal flush does not double inherited Lobby prefix` in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) (`describe` inherited shortName and updateLocal flush). Pre-flush merged shortName correct (`Lobby in the dark`); post-flush `getStandardForm` Room shortName is **`Lobby`** (inherited only). Phase 0 diagnostics (test `logPhase0FlushDiagnostics`): after `applyWorkbenchFlush`, local draft loses `ROOM#lobby`; `lastUpdateDiff` is **Remove** of additive `<ShortName><Space />in the dark</ShortName>`, not doubled-prefix concat --- suspect **`normalizeWorkbenchDraft`** / **`isReferencedInAssetLayer`** on import `ref={0}` stub. **Next step when picked up:** Phase 1 --- investigate normalize on flush.

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

This initiative is **intentionally deferred** so Workbench consistency migration cleanup could land without blocking on reducer design (that migration is **complete**). **Do not forget:** flush correctness under inheritance is a **first-class** follow-up, not an edge case.

---

## Terminology (avoid overloaded "local")

| Term | Meaning |
| --- | --- |
| **Edit-layer** | `getLocalStandardForm` / `updateLocal` baseline: `base + pendingEdits + edit` for **this asset only** (no `inherited` folded in). |
| **Merged view** | `getStandardForm`: `inherited.merge(localStandardForm)` --- **display** and session **`committed` / `working`**. |
| **Consistency layer** | Pure ops on **edit-layer** draft (`materializeComponent`, `normalizeWorkbenchDraft`, etc.). Correctly uses **`updateLocal`** today. |

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
| 1 | Investigate **normalize** / orphan GC on flush (Phase 0 diagnostics) | [ ] |
| 2 | Design decision: **batch API** vs **flush-only helper** (informed by Phase 1) | [ ] |
| 3 | Implement reducer + types + thunk passthrough | [ ] |
| 4 | Rewire `useWorkbenchComponent` / `useWorkbenchAssetMeta` flush | [ ] |
| 5 | Durable docs + dispose this plan | [ ] |

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Test commands:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) --- run from `charcoal-client/`; authority: [`charcoal-client/AGENT.testing.md`](../../../../charcoal-client/AGENT.testing.md)
3. **Reducer:** [`personalAssets/reducers.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.ts), [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md) (local vs merged)
4. **Session flush:** [`useWorkbenchComponent.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx), [`applyWorkbenchFlush.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/applyWorkbenchFlush.ts), [`workbenchMutations.ts`](../../../../charcoal-client/src/components/Workbench/foundations/workbenchMutations.ts) (`reconcileCommittedComponent`)
5. **WML merge / shortName:** [`shortNameField.ts`](../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts), [`standardForm.assetMeta.test.ts`](../../../../packages/mtw-wml/ts/standardize/integration/standardForm.assetMeta.test.ts)
6. **Phase 1 normalize:** [`normalizeWorkbenchDraft.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/normalizeWorkbenchDraft.ts), [`isReferencedInAssetLayer.ts`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/isReferencedInAssetLayer.ts); Phase 0 test diagnostics in [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) (`logPhase0FlushDiagnostics`)

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
- [ ] **Phase 1 --- Investigate normalize on flush (Phase 0 finding)**
  - [ ] Reproduce with diagnostics: local draft **after** `applyWorkbenchFlush` is empty `<Asset />`; room gone before reducer `mergeToEdit`.
  - [ ] Trace [`normalizeWorkbenchDraft`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/normalizeWorkbenchDraft.ts) and [`isReferencedInAssetLayer`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/isReferencedInAssetLayer.ts): does wholesale assign of merged-shaped `working` drop import `ref={0}` reference, so orphan GC removes room body and additive shortName?
  - [ ] Decide fix locus: flush assign shape, normalize predicate for imported components, skip normalize on session flush, materialize/topLevel association, or batch step order --- **before** batch API design.
  - [ ] Record conclusion in **Status** and narrow Phase 2 options (normalize-only fix vs still need merged/local batch).
- [ ] **Phase 2 --- Design decision**
  - [ ] If Phase 0 passes (regression green after Phase 1 fix): document safe flush path in `personalAssets/AGENT.md` + Workbench AGENT; close or narrow scope.
  - [ ] If layered persist still wrong after normalize fix: choose **batch payload** vs **flush-only helper**; document tradeoffs (`lastUpdateDiff`, instrumentation, asset-meta parity).
  - [ ] Define step order for component flush and asset-meta flush (if meta has same merged/local split).
- [ ] **Phase 3 --- Implement**
  - [ ] Extend `UpdateStandardPayload` + reducer loop with baseline refresh between steps (if Phase 2 selects batch).
  - [ ] Thunk in [`index.ts`](../../../../charcoal-client/src/slices/personalAssets/index.ts) unchanged except accepting new payload (still one dispatch).
  - [ ] Unit tests: two-step batch (merged then local), empty second step, order sensitivity; re-run Phase 0 test green.
- [ ] **Phase 4 --- Wire Workbench**
  - [ ] `dispatchFlush` in `useWorkbenchComponent` uses batch (or approved helper).
  - [ ] `useWorkbenchAssetMeta` flush if same bug class applies to `_shortName` / `_summary` under inheritance.
  - [ ] Re-run Phase 0 test green.
- [ ] **Phase 5 --- Docs and cleanup**
  - [ ] Update `personalAssets/AGENT.md` (batch API and/or normalize flush rules; when to use perspectives).
  - [ ] Update Workbench AGENT session section (edit-layer vs merged working; flush pipeline).
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

# After reducer change (Phase 3)
npm run test:single -- src/slices/personalAssets

# After Workbench wire-up (Phase 4)
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent
npm run test:single -- src/components/Workbench/foundations/WorkbenchAssetMeta
npm run test:single -- src/components/Workbench/foundations/consistency
```

**Manual smoke (Draft asset with import):** edit imported Room `shortName` in Workbench, flush, reload view --- merged label matches author intent, no prefix duplication.

---

## Open questions

### Phase 1 (normalize investigation)

1. Why does `applyWorkingComponentToDraft` + `normalizeWorkbenchDraft` leave local draft with **no** `ROOM#lobby` while pre-flush local had `ref={0}` + additive shortName?
2. Is **`isReferencedInAssetLayer`** false for the room after assign because merged-shaped `working` lacks the import stub reference?
3. Should session flush **preserve** `ref={0}` / topLevel association before normalize, or should normalize **not** GC bodies for components open in Workbench?

### Phase 2 (design decision, after Phase 1)

1. Should **`merged`** step use **`incoming.merge(lastReceived.diff(working))`** at **form** scope instead of component wholesale assign?
2. Is **asset-meta** flush (`applyAssetMetaFlush`) affected for inherited asset `ShortName` / `Summary`?
3. Should **`lastUpdateDiff`** reflect composite diff, last step only, or remain diagnostic-only?
4. Can **`assureDefaultSituationFromPrimitives`** stay in **local** step only before normalize?

---

## When the task finishes

1. Move API and perspective rules into [`personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md).
2. Document session flush + terminology in [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md).
3. Delete or archive this file; keep git history.
