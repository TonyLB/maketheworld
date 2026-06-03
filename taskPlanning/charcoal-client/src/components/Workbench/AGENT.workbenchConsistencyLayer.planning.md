# Workbench consistency layer (authoring client)

**Status:** In progress (M0 partial). **Next step:** Resolve **D2** (reachability predicate), then **M1** --- pure module at [`foundations/consistency/`](../../../../../charcoal-client/src/components/Workbench/foundations/consistency/).

This plan is task-scoped. Archive or delete it after the initiative ships; move lasting norms into [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md), [`foundations/ReferenceList/AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md), and [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md).

**Framework:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)

---

## Purpose

Introduce a **Workbench-owned consistency layer** in the Charcoal Client that **centralizes global asset-graph operations** during authoring, so UI code stops embedding ad hoc `updateStandard` draft surgery (`byUniversalId` writes, `removeComponent`, import helpers) beside **local** list and field edits.

**Problem today:** The seam between "change a reference list on a working copy" and "keep the asset consistent with that change" is muddled. Examples:

- [`ReferenceListSessionEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.tsx): local **disassociate** on `working`, but create/import uses **`commitAssetScopedUpdate`** (global bridge on the component session).
- [`TopLevelEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx): row remove calls **`removeComponent`** with reducer **`cascade: true`** --- treating `_topLevel` unlike every other reference list.
- [`WMLComponentHeader`](../../../../../charcoal-client/src/components/Workbench/WMLComponentHeader.tsx): header delete is **`removeComponent`**, not list disassociate + normalize.
- [`AssetEditForm`](../../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx): asset ShortName/Summary use mixed debounce paths without a shared asset working session.

**Goal:** One place owns **materialize**, **normalize** (workbench policy), and orchestration timing. Editors own **associate** / **disassociate** on working state and call the layer at flush boundaries.

**Non-goals (this initiative):**

- Changing WML / `StandardForm.merge` orphan-with-content behavior ( **`ref={0}`** editing remains valid in the format).
- Replacing engine **`removeComponent({ cascade })`** in mtw-wml for non-workbench tooling; **Workbench authoring** uses **fixpoint normalize** for transitive removal instead of reducer **`cascade: true`** (**D7**).
- **Area "cascade" UX** (e.g. clearer confirm when removing an Area would GC many Rooms) --- future UI; **v1** accepts fixpoint orphan closure when Area is disassociated and Rooms become unreferenced (**D8**). Coordinate with [`taskPlanning/packages/mtw-wml/AGENT.areaTopologyExits.planning.md`](../../../../packages/mtw-wml/AGENT.areaTopologyExits.planning.md) but do not block Milestones 1-3.

---

## Architectural model (normative for this plan)

### Local vs global

| Layer | Operations | Mutates (typical) |
| --- | --- | --- |
| **Local** (sessions / list shells) | **Associate**, **disassociate** | `ReferenceList` (or facet slot) on **working** component or asset-meta projection; scalar fields on **working** |
| **Global** (consistency layer) | **Materialize**, **normalize** | `StandardForm` draft: `byUniversalId`, ref scrubbing, workbench orphan GC |

**Associate / disassociate are local.** They mean: "this **site** (room.features, asset._topLevel, area position-graph participants, etc.) now does or does not list this key." They do **not** mean "delete component from asset."

**Materialize** means: ensure `draft.byUniversalId` contains the component (create, import via [`addImportToDraft`](../../../../../charcoal-client/src/slices/personalAssets/addImportToDraft.ts), or stub) **before** a reference is meaningful. Runs on create/import completion or inside the flush pipeline when pending materializations are queued.

**Normalize** (workbench) means: enforce **authoring-surface** invariants on a draft **after** local edits are applied --- distinct from generic WML merge GC (which only drops **unreferenced and empty** components; see [`StandardForm._mergeInternal`](../../../../../packages/mtw-wml/ts/standardize/index.ts)).

### WML vs Workbench orphan policy

| Context | Unreferenced component with content |
| --- | --- |
| **WML / generic merge** | Retained (supports **`ref={0}`** / inline orphan editing) |
| **Authoring Workbench** | Treated as nonsensical --- no UI to edit "invisible" components; should not survive normalize |

Workbench normalize may remove **non-empty** orphans when they have no positive reference under the **workbench reachability** predicate (see **D2**). Empty orphans may be removed silently.

### User-facing removal (no separate "Delete" for list rows)

- **List row remove:** **disassociate** at the site + flush + **normalize** (fixpoint).
- **Confirm when:** preview shows disassociation would orphan a component with **`!isEmpty()`** content --- e.g. "Removing this reference will also remove the component and all its contents."
- **Header / intentional subtree removal:** same pipeline after local ref clears; confirm using **preview closure** (counts of keys removed across fixpoint iterations), not one dialog per normalize pass.

### Workbench transitive removal (fixpoint, not reducer cascade)

**Normative for Workbench UI (D7, D8):** transitive "cascade" delete behavior is **`normalizeWorkbenchDraft` fixpoint** --- reference orphan closure under **D2**, not [`removeComponent({ cascade: true })`](../../../../../packages/mtw-wml/ts/standardize/index.ts) on the [`updateStandard`](../../../../../charcoal-client/src/slices/personalAssets/reducers.ts) path.

| Mechanism | Used in Workbench authoring? | Closure rule |
| --- | --- | --- |
| **Workbench normalize fixpoint** | **Yes** | Drop keys where `!isReferenced` under **D2**; scrub refs; repeat until no-op |
| **`removeComponent({ cascade: true })`** | **No** (legacy call sites to migrate) | **`implicitDescendantsOfAncestor`** (hosting tree) --- engine semantics, not the workbench default |

Examples:

- Removing an Area's participant refs then normalizing may GC Rooms that have no remaining refs --- **accepted for v1** (**D8**); richer confirm copy is future UI.
- Removing an Area's links to Rooms while those Rooms remain on **`_topLevel`** --- Rooms stay referenced; fixpoint does **not** remove them.

**Fixpoint normalize (required for transitive GC):** One pass is insufficient when A references B and both become orphans only after A is removed. Loop: compute unreferenced keys -> remove from `_components` -> scrub refs from survivors -> repeat until a pass removes zero keys (cap iterations, e.g. 50).

### Association sites

Local associate/disassociate needs a typed **site** descriptor (generalize [`getTopLevelAddToReferenceList`](../../../../../charcoal-client/src/slices/personalAssets/index.ts), [`ReferenceListSessionAccessor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.tsx), facet list hosts). The consistency layer does **not** own site-specific list accessors; editors keep domain accessors next to owning screens per [AGENT.reference-lists.md](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md).

### Asset-meta as local (follow-on)

After Milestones 1-4, an optional **`useWorkbenchAssetMeta`** (or asset-root provider) can hold working **`_shortName`**, **`_summary`**, and **`_topLevel`** with the same flush/reconcile pattern as [`useWorkbenchComponent`](../../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx). Top-level list row remove must **not** call **`removeComponent`** once the layer exists.

### Flush pipeline (target shape)

```text
working local edits (associate / disassociate / scalars)
  -> apply to draft clone
  -> materialize (pending keys)
  -> normalizeWorkbenchDraft (fixpoint: orphan GC + ref scrub per pass)
  -> standardForm.diff -> mergeToEdit (existing reducer path)
```

[`commitAssetScopedUpdate`](../../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx) should shrink to: apply working + **materialize** + **normalize** + assign, or delegate to the layer entirely.

---

## Related documentation (link; do not duplicate)

| Doc | Role |
| --- | --- |
| [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) | Workbench composition, component session, asset-level exceptions |
| [`foundations/ReferenceList/AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) | List shells, session vs asset-mode |
| [`foundations/ReferenceList/AGENT.addReferenceImportControl.planning.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.addReferenceImportControl.planning.md) | Obtain ref vs associate |
| [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md) | `updateStandard`, merge, diff |
| [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) | Reference vs hosting |
| [`packages/mtw-wml/ts/standardize/schemaOrganization.ts`](../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | `isReferenced`, `implicitDescendantsOfAncestor` |

**Prior design conversation:** component session (`useWorkbenchComponent`), asset-meta locality, diff guards, TopLevel legacy, fixpoint normalize --- captured here as normative plan text.

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../../AGENT.md)
2. **Workbench architecture:** [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md)
3. **Reference list patterns:** [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md)
4. **personalAssets / updateStandard:** [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md)
5. **StandardForm merge / diff / removeComponent:** [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md), [`integration/standardForm.removeComponent.test.ts`](../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.removeComponent.test.ts)

**Test command authority:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) and [`charcoal-client/AGENT.testing.md`](../../../../../charcoal-client/AGENT.testing.md). Run tests from **`charcoal-client/`** with **`npm run test:single`**.

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/components/Workbench/foundations/ReferenceList/referenceListMutations.test.ts
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
npm run test:single -- src/slices/personalAssets/addImportToDraft.test.ts
```

---

## Decisions register

Mark **Status** `[X]` when normative for implementation.

| ID | Status | Decision | Notes |
| --- | --- | --- | --- |
| **D1** | [X] | **Module home** | [`charcoal-client/src/components/Workbench/foundations/consistency/`](../../../../../charcoal-client/src/components/Workbench/foundations/consistency/). Redux [`updateStandard`](../../../../../charcoal-client/src/slices/personalAssets/reducers.ts) calls into the layer; layer does not import React. |
| **D2** | [ ] | **Workbench `isReferenced` predicate** | Start from [`SchemaOrganization.isReferenced`](../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) (topLevel + direct graph edges). Document whether import/inherited visibility affects "orphan" for confirm copy. Refine when asset-meta session lands. |
| **D3** | [X] | **Normalize removes non-empty orphans** | Workbench-only; WML merge unchanged. Each pass: drop keys where `!isReferenced(key)` under **D2**, then scrub those keys from all lists/facets/topLevel on survivors. |
| **D4** | [X] | **Fixpoint until no-op** | Required for transitive orphan closure (**D7**); max iteration cap with dev throw / prod log. |
| **D5** | [X] | **Preview API** | `previewOrphanClosure(draft, edits?) => { keys, hasNonEmpty }` drives confirm dialog; simulate fixpoint on clone without persisting. |
| **D6** | [X] | **TopLevel row remove** | Disassociate from `_topLevel` only; never `removeComponent` for list row. Align [`TopLevelEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx). |
| **D7** | [X] | **No workbench `removeComponent` / reducer cascade** | Workbench UI stops calling `type: 'removeComponent'` for list/header deletes; migrate legacy/maps call sites over time. **Transitive removal = fixpoint normalize**, not `cascade: true` on the reducer. Keep reducer branch only for non-workbench callers until fully migrated. |
| **D8** | [X] | **Area + orphan closure (v1)** | **First iteration:** disassociating an Area such that Rooms (etc.) become unreferenced and are removed by fixpoint normalize is **acceptable**. Separate Area-specific confirm/UX polish is **out of scope** (likely future UI issue). |

---

## Progress

| Milestone | Scope | Status |
| --- | --- | --- |
| **M0** | Decisions **D1-D8** + API sketch in this doc | In progress (**D1**, **D3-D8** decided; **D2** open) |
| **M1** | Pure **`materialize`**, **`normalizeWorkbenchDraft`** (fixpoint), **`previewOrphanClosure`** + unit tests | Not started |
| **M2** | Wire flush pipeline helper used by **`commitAssetScopedUpdate`** and one session list create/import path | Not started |
| **M3** | Migrate **TopLevelEditor** list remove + import/create association; drop row-level **`removeComponent`** | Not started |
| **M4** | Migrate **`WMLComponentHeader`** delete + confirm via preview closure | Not started |
| **M5** | Optional **asset-meta session** (`_shortName`, `_summary`, `_topLevel`); [`AssetEditForm`](../../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) | Not started |
| **M6** | Durable doc updates + delete/archive this plan | Not started |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets) as you finish each slice.

- [ ] **M0 --- Decisions**
  - [X] **D1** module path: `foundations/consistency/`
  - [ ] Resolve **D2** (reachability predicate) in this doc
  - [X] **D3-D8** normative (fixpoint = workbench cascade; Area v1 orphan GC OK)
  - [ ] Confirm **D3-D5** behavior with a minimal worked example in tests (**M1**)
- [ ] **M1 --- Pure layer**
  - [ ] Add `materializeComponent(draft, { tag, universalKey, fromAsset? })` (wrap factory + `addImportToDraft`)
  - [ ] Add `normalizeWorkbenchDraft(draft)` fixpoint per **D3**, **D4**
  - [ ] Add `previewOrphanClosure(draft, simulateDisassociate?)` per **D5**
  - [ ] Unit tests: top-level ref-only diff shells; transitive Feature after Room removed; empty orphan silent
- [ ] **M2 --- Session integration**
  - [ ] `applyWorkbenchEdit(draft, { working, componentId?, materialize?, siteMutations? })` used from `commitAssetScopedUpdate`
  - [ ] [`ReferenceListSessionEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.tsx) create/import uses layer materialize + normalize (remove inline `byUniversalId` in callback)
  - [ ] Update **Recommended order** checkboxes and run baseline Workbench + personalAssets tests
- [ ] **M3 --- TopLevel**
  - [ ] **D6:** TopLevel row remove -> disassociate + flush + normalize
  - [ ] Create/import: materialize then local associate on `_topLevel`
  - [ ] Confirm dialog when preview reports non-empty orphan closure
- [ ] **M4 --- Header delete**
  - [ ] Replace [`WMLComponentHeader`](../../../../../charcoal-client/src/components/Workbench/WMLComponentHeader.tsx) `removeComponent` with disassociate-at-all-sites + fixpoint normalize + preview confirm (**D7**)
- [ ] **M5 --- Asset meta (optional)**
  - [ ] Asset-root provider + debounced flush for ShortName/Summary
  - [ ] `_topLevel` via same list patterns as **M3**
- [ ] **M6 --- Close out**
  - [ ] Move steady-state consistency rules into Workbench + personalAssets **AGENT.md**
  - [ ] Archive/delete this planning file

---

## Verification

After each milestone, from **`charcoal-client/`**:

```bash
# Consistency module (D1)
npm run test:single -- src/components/Workbench/foundations/consistency

# Regression
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
npm run test:single -- src/components/Workbench/foundations/ReferenceList
npm run test:single -- src/slices/personalAssets/addImportToDraft.test.ts
npm run test:single -- src/slices/personalAssets/reducers.test.ts
```

**Manual (M3+):** Draft asset -> add Room at top level -> remove row -> Room absent from Components list and `byUniversalId` after save path; Feature only on that Room -> confirm dialog mentions component removal.

**Grep hygiene (no new list-row removeComponent):**

```bash
rg "removeComponent" charcoal-client/src/components/Workbench --glob '*.tsx'
```

Expect **`removeComponent`** only in intentional purge/header paths until **M4** completes, not in **TopLevelEditor** list handlers.

---

## API sketch (refine in M1)

```typescript
// Illustrative --- module: foundations/consistency/ (D1).

type AssociationSite =
  | { kind: 'topLevel' }
  | { kind: 'componentList'; parentId: ComponentUUID; accessor: ReferenceListSessionAccessor<StandardComponent> }
  // facet slots, lens, area graph: extend as migrated

function materializeComponent(draft: StandardForm, spec: MaterializeSpec): StandardReference

function disassociateAtSite(working: ..., site: AssociationSite, ref: StandardReference): void

function normalizeWorkbenchDraft(draft: StandardForm): StandardForm

function previewOrphanClosure(
  draft: StandardForm,
  options?: { afterDisassociate?: { site; ref }[] }
): { removedKeys: ComponentUUID[]; includesNonEmpty: boolean }

function applyWorkbenchEdit(
  base: StandardForm,
  edit: { applyLocal: (draft: StandardForm) => void }
): StandardForm
```

---

## Open questions

1. **Inherited-only components (**D2**):** Does the reachability predicate treat inherited materialization as "referenced" for orphan purposes, or only local draft + merged authoring view?
2. **`updateStandard` reducer:** Should normalize run inside every `type: 'update'` payload before `diff`, or only via explicit layer entry points (fewer surprises for non-workbench callers of the thunk)?
3. **Maps / Library legacy:** [`Maps/View`](../../../../../charcoal-client/src/components/Maps/View/index.tsx) and other non-workbench `updateStandard` call sites --- migrate in this initiative or document as out of scope?

**Resolved for v1:** **D8** --- Area-driven GC of now-unreferenced Rooms via fixpoint is fine; dedicated Area remove UX is deferred.

---

## When this task finishes

1. Document **local associate/disassociate**, **materialize**, **normalize (fixpoint)**, and **preview confirm** in [`Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) (short; link to module).
2. Update [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md): TopLevel in scope; remove "out of scope" for session pattern where applicable.
3. Note workbench vs WML orphan policy in [`personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md) if reducer behavior changes.
4. Delete or archive this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
