# Workbench consistency layer (authoring client)

**Status:** In progress (M0 complete; M1 pure layer complete). **Next step:** **M2** --- `applyWorkbenchEdit` / flush pipeline wiring in [`commitAssetScopedUpdate`](../../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx).

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
| **Global** (consistency layer) | **Materialize**, **normalize** | `StandardForm` draft: `byUniversalId`, workbench orphan GC (**D2**); defensive ref scrub (see below) |

**Associate / disassociate are local.** They mean: "this **site** (room.features, asset._topLevel, area position-graph participants, etc.) now does or does not list this key." They do **not** mean "delete component from asset."

**Materialize** means: ensure `draft.byUniversalId` contains the component (create, import via [`addImportToDraft`](../../../../../charcoal-client/src/slices/personalAssets/addImportToDraft.ts), or stub) **before** a reference is meaningful. Runs on create/import completion or inside the flush pipeline when pending materializations are queued.

**Normative (`materializeComponent`, M1):** Callers pass **`universalKey`** (and optional **`fromAsset`** for import). **Do not** require a separate **`tag`** --- derive component type from the `ComponentUUID` prefix (`componentTagFromUpperCase`, same rule as [`StandardReference`](../../../../../packages/mtw-wml/ts/standardize/keys/reference.ts)) before [`standardComponentFactory`](../../../../../packages/mtw-wml/ts/standardize/componentFactory.ts) / `addImportToDraft`. Optional explicit `tag` only for dev-time assert (`tag === derived`) if ever needed; not part of the public Workbench API.

**Normalize** (workbench) means: enforce **authoring-surface** invariants on a **local** draft **after** local edits are applied --- distinct from generic WML merge GC (which only drops **unreferenced and empty** components; see [`StandardForm._mergeInternal`](../../../../../packages/mtw-wml/ts/standardize/index.ts)). Use **`getLocalStandardForm`](../../../../../charcoal-client/src/slices/personalAssets/selectors.ts) semantics (base + edit + pendingEdits), **not** merged [`getStandardForm`](../../../../../charcoal-client/src/slices/personalAssets/selectors.ts) (inherited + local).

### Asset-layer reference predicate (D2)

**Question:** Is this component still **linked in this asset's edit data** (any ref sign), not "where does it appear in the schema tree?"

| API | Answers |
| --- | --- |
| [`SchemaOrganization.isReferenced`](../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | **No** for **D2** --- schema-tree / graph-tier semantics; can miss nested `ref={0}` Direct refs. |
| [`StandardForm.referencedBy`](../../../../../packages/mtw-wml/ts/standardize/index.ts) alone | **No** --- scans component `referencedKeys()` only; **misses `_topLevel`** (e.g. import side-effect `ref={0}` stubs). |
| **`isReferencedInAssetLayer` (D2)** | **Yes** --- **`_topLevel` ∪ referencedBy** on the **local** `StandardForm`. |

**Normative (D2):**

```typescript
// Any ref sign (positive, negative, zero) counts. Match by sameKey on StandardReference.
function isReferencedInAssetLayer(
  localForm: StandardForm,
  target: StandardReference
): boolean {
  const inTopLevel =
    localForm._topLevel?.payload.some((r) => r.sameKey(target)) ?? false
  if (inTopLevel) return true
  return localForm.referencedBy(target).length > 0
}
```

- **Stored WML vs displayed UI:** Local form holds asset-layer edits (`ref={0}` top-level import stubs, negative refs, etc.). Merged **standardForm** (inherited + local) is for **display** only --- inherited ancestry does **not** count as a local reference for orphan GC or preview.
- **Orphan (workbench):** `byUniversalId` entry with **`!isReferencedInAssetLayer(localForm, ref)`** after disassociations (fixpoint may remove many keys).
- **Precedent:** [`LensHeader.tsx`](../../../../../charcoal-client/src/components/Workbench/LensEdit/LensHeader.tsx) already combines `referencedBy` + `_topLevel` when deciding whether clearing a lens removes the component.

Do **not** confuse with persisted **`referencedBy`** on blueprint rows (Area topology / lambda); **D2** uses in-memory **`StandardForm.referencedBy()`** only.

### WML vs Workbench orphan policy

| Context | Unreferenced component with content |
| --- | --- |
| **WML / generic merge** | Retained (supports **`ref={0}`** / inline orphan editing) |
| **Authoring Workbench** | Treated as nonsensical --- no UI to edit "invisible" components; should not survive normalize |

Workbench normalize may remove **non-empty** orphans when **`!isReferencedInAssetLayer`** on the **local** form (**D2**). Empty orphans may be removed silently.

### User-facing removal (no separate "Delete" for list rows)

- **List row remove:** **disassociate** at the site + flush + **normalize** (fixpoint).
- **Confirm when:** preview shows disassociation would orphan a component with **`!isEmpty()`** content --- e.g. "Removing this reference will also remove the component and all its contents."
- **Header / intentional subtree removal:** same pipeline after local ref clears; confirm using **preview closure** (counts of keys removed across fixpoint iterations), not one dialog per normalize pass.

### Workbench transitive removal (fixpoint, not reducer cascade)

**Normative for Workbench UI (D7, D8):** transitive "cascade" delete behavior is **`normalizeWorkbenchDraft` fixpoint** --- reference orphan closure under **D2**, not [`removeComponent({ cascade: true })`](../../../../../packages/mtw-wml/ts/standardize/index.ts) on the [`updateStandard`](../../../../../charcoal-client/src/slices/personalAssets/reducers.ts) path.

| Mechanism | Used in Workbench authoring? | Closure rule |
| --- | --- | --- |
| **Workbench normalize fixpoint** | **Yes** | Orphan closure via **`!isReferencedInAssetLayer`** (**D2**); repeat until no-op |
| **`removeComponent({ cascade: true })`** | **No** (legacy call sites to migrate) | **`implicitDescendantsOfAncestor`** (hosting tree) --- engine semantics, not the workbench default |

Examples:

- Removing an Area's participant refs then normalizing may GC Rooms that have no remaining refs --- **accepted for v1** (**D8**); richer confirm copy is future UI.
- Removing an Area's links to Rooms while those Rooms remain on **`_topLevel`** --- Rooms stay referenced; fixpoint does **not** remove them.

**Fixpoint normalize (required for transitive GC):** One pass is insufficient when A references B and B only becomes an orphan after A is removed. Loop until a pass removes zero keys (cap iterations, e.g. 50):

1. **Orphan detection (load-bearing):** keys where **`!isReferencedInAssetLayer`** (**D2**) on the current local draft.
2. **Body removal (load-bearing):** drop those keys from `_components`.
3. **Ref scrub (defensive):** `removeReferences` on survivors + strip matching keys from `_topLevel` --- see below.
4. If step 2 removed any keys, go to 1; else done.

#### Ref scrub: belt-and-suspenders (not an expected edit path)

After **D2**, any key `K` removed in step 2 was **not** on `_topLevel` and had **empty** [`referencedBy(K)`](../../../../../packages/mtw-wml/ts/standardize/index.ts) --- so no surviving component's `referencedKeys()` and no asset top-level slot should still mention `K`. In a correct disassociate-then-normalize flow, step 3 should be a **no-op**.

**Keep step 3 anyway** (mirror hygiene in [`removeComponent`](../../../../../packages/mtw-wml/ts/standardize/index.ts), cheap invariant enforcement). **Do not** read its presence as proof that authors routinely leave dangling list slots after disassociate; transitive GC comes from **step 1 on the next iteration**, not from scrub "finding" new orphans.

| Situation | Scrub role |
| --- | --- |
| Happy path (local disassociate + **D2** + normalize) | Expected **no-op** |
| Legacy/broken draft (e.g. body removed without disassociate, flush ordering bugs) | Repairs inconsistency; log/dev assert optional |
| [`removeComponent`](../../../../../packages/mtw-wml/ts/standardize/index.ts) (engine) | Scrub is **load-bearing** there --- different API, not workbench normalize |

**M1 tests:** assert scrub no-op on a draft that already satisfies **D2** before removal; separate test that scrub fixes an intentionally inconsistent clone (defensive path only).

### Association sites

Local associate/disassociate needs a typed **site** descriptor (generalize [`getTopLevelAddToReferenceList`](../../../../../charcoal-client/src/slices/personalAssets/index.ts), [`ReferenceListSessionAccessor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.tsx), facet list hosts). The consistency layer does **not** own site-specific list accessors; editors keep domain accessors next to owning screens per [AGENT.reference-lists.md](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md).

### Asset-meta as local (follow-on)

After Milestones 1-4, an optional **`useWorkbenchAssetMeta`** (or asset-root provider) can hold working **`_shortName`**, **`_summary`**, and **`_topLevel`** with the same flush/reconcile pattern as [`useWorkbenchComponent`](../../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx). Top-level list row remove must **not** call **`removeComponent`** once the layer exists.

### Flush pipeline (target shape)

```text
working local edits (associate / disassociate / scalars)
  -> apply to draft clone
  -> materialize (pending keys)
  -> normalizeWorkbenchDraft (fixpoint: **D2** orphan GC; defensive ref scrub per pass)
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
| [`packages/mtw-wml/ts/standardize/index.ts`](../../../../../packages/mtw-wml/ts/standardize/index.ts) | **`referencedBy()`** (**D2**); diff/merge |
| [`integration/standardForm.referencedBy.test.ts`](../../../../../packages/mtw-wml/ts/standardize/integration/standardForm.referencedBy.test.ts) | **D2** examples (nested refs, Area topology) |
| [`LensHeader.tsx`](../../../../../charcoal-client/src/components/Workbench/LensEdit/LensHeader.tsx) | **`referencedBy` + `_topLevel`** precedent |
| [`packages/mtw-wml/ts/standardize/schemaOrganization.ts`](../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts) | Schema tree / `implicitDescendantsOfAncestor` --- **not** **D2** |

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
| **D2** | [X] | **`isReferencedInAssetLayer` = `_topLevel` ∪ `referencedBy`** | On **local** `StandardForm` only (not merged inherited view). Any **ref** sign on `_topLevel` counts. Component mentions via [`referencedBy()`](../../../../../packages/mtw-wml/ts/standardize/index.ts) (all `referencedKeys()` payloads). **Not** [`SchemaOrganization.isReferenced`](../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.ts). Export from `foundations/consistency/`. |
| **D3** | [X] | **Normalize removes non-empty orphans** | Workbench-only; WML merge unchanged. Each pass: drop bodies where **`!isReferencedInAssetLayer`** (**D2**), then **defensive** ref scrub (expected no-op on happy path; see **Ref scrub** above). |
| **D4** | [X] | **Fixpoint until no-op** | Required for transitive orphan closure (**D7**); max iteration cap with dev throw / prod log. |
| **D5** | [X] | **Preview API** | `previewOrphanClosure(localDraft, edits?) => { keys, hasNonEmpty }` on **local** clone; uses **D2** + fixpoint simulate; drives confirm dialog. |
| **D6** | [X] | **TopLevel row remove** | Disassociate from `_topLevel` only; never `removeComponent` for list row. Align [`TopLevelEditor`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx). |
| **D7** | [X] | **No workbench `removeComponent` / reducer cascade** | Workbench UI stops calling `type: 'removeComponent'` for list/header deletes; migrate legacy/maps call sites over time. **Transitive removal = fixpoint normalize**, not `cascade: true` on the reducer. Keep reducer branch only for non-workbench callers until fully migrated. |
| **D8** | [X] | **Area + orphan closure (v1)** | **First iteration:** disassociating an Area such that Rooms (etc.) become unreferenced and are removed by fixpoint normalize is **acceptable**. Separate Area-specific confirm/UX polish is **out of scope** (likely future UI issue). |
| **D9** | [X] | **`materializeComponent` spec = `universalKey` (+ optional `fromAsset`)** | Derive **`tag`** from `ComponentUUID` prefix internally; do not require callers to pass `tag`. Wrap `standardComponentFactory` (create/stub) and `addImportToDraft` (import). |

---

## Progress

| Milestone | Scope | Status |
| --- | --- | --- |
| **M0** | Decisions **D1-D8** + API sketch in this doc | Complete |
| **M1** | Pure **`materialize`**, **`normalizeWorkbenchDraft`** (fixpoint), **`previewOrphanClosure`** + unit tests | Complete |
| **M2** | Wire flush pipeline helper used by **`commitAssetScopedUpdate`** and one session list create/import path | Not started |
| **M3** | Migrate **TopLevelEditor** list remove + import/create association; drop row-level **`removeComponent`** | Not started |
| **M4** | Migrate **`WMLComponentHeader`** delete + confirm via preview closure | Not started |
| **M5** | Optional **asset-meta session** (`_shortName`, `_summary`, `_topLevel`); [`AssetEditForm`](../../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) | Not started |
| **M6** | Durable doc updates (**close-out checklist**) + delete/archive this plan | Not started |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets) as you finish each slice.

- [X] **M0 --- Decisions**
  - [X] **D1** module path: `foundations/consistency/`
  - [X] **D2** `isReferencedInAssetLayer` = `_topLevel` ∪ `referencedBy` on **local** form
  - [X] **D3-D8** normative (fixpoint = workbench cascade; Area v1 orphan GC OK)
- [X] **M1 --- Pure layer**
  - [X] Stub [`foundations/consistency/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md) with **D2** + **Ref scrub (belt-and-suspenders)** sections (expand in **M6**)
  - [X] Add `isReferencedInAssetLayer(localForm, ref)` per **D2**
  - [X] Add `materializeComponent(draft, { universalKey, fromAsset? })` per **D9** (derive `tag` from prefix; wrap factory + `addImportToDraft`)
  - [X] Add `normalizeWorkbenchDraft(draft)` fixpoint per **D3**, **D4** (uses **D2** on local draft)
  - [X] Add `previewOrphanClosure(localDraft, ...)` per **D5** (`applyLocal` on clone; `includesNonEmpty` for confirm)
  - [X] Unit tests (**D2**): top-level-only (`referencedBy` empty, still referenced); `ref={0}` stub; nested list ref; transitive GC after Room removed; inherited-only not counted
  - [X] Unit tests (scrub): no-op after valid disassociate + **D2** removal; separate fixture proving scrub repairs a deliberately broken draft only
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
- [ ] **M6 --- Close out (durable docs required before deleting this plan)**
  - [ ] Add [`foundations/consistency/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md) (or module header in `index` + link from Workbench **AGENT.md**) --- normative API + **D2-D8** summaries; **do not** rely on this task-plan after archive
  - [ ] Persist **close-out checklist** below into Workbench / reference-list / personalAssets **AGENT.md** (not only here)
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
// Illustrative --- module: foundations/consistency/ (D1). All GC/preview on local StandardForm.

function isReferencedInAssetLayer(
  localForm: StandardForm,
  target: StandardReference
): boolean

type AssociationSite =
  | { kind: 'topLevel' }
  | { kind: 'componentList'; parentId: ComponentUUID; accessor: ReferenceListSessionAccessor<StandardComponent> }
  // facet slots, lens, area graph: extend as migrated

type MaterializeSpec = {
  universalKey: ComponentUUID
  /** When set, import path (`addImportToDraft`); otherwise create/stub via factory. */
  fromAsset?: AssetUUID
}

function materializeComponent(draft: StandardForm, spec: MaterializeSpec): StandardReference
// Derives tag from universalKey prefix (D9); no separate tag param on public API.

function disassociateAtSite(working: ..., site: AssociationSite, ref: StandardReference): void

function normalizeWorkbenchDraft(draft: StandardForm): StandardForm

function previewOrphanClosure(
  localDraft: StandardForm,
  options?: { applyLocal?: (draft: StandardForm) => void }
): { removedKeys: ComponentUUID[]; includesNonEmpty: boolean }
// Typed afterDisassociate: { site; ref }[] deferred until AssociationSite exists (M2+).

function applyWorkbenchEdit(
  base: StandardForm,
  edit: { applyLocal: (draft: StandardForm) => void }
): StandardForm
```

---

## Open questions

1. **`updateStandard` reducer:** Should normalize run inside every `type: 'update'` payload before `diff`, or only via explicit layer entry points (fewer surprises for non-workbench callers of the thunk)?
2. **Maps / Library legacy:** [`Maps/View`](../../../../../charcoal-client/src/components/Maps/View/index.tsx) and other non-workbench `updateStandard` call sites --- migrate in this initiative or document as out of scope?

**Resolved for v1:**

- **D2** --- **`isReferencedInAssetLayer`** on **local** form only; **`_topLevel` ∪ referencedBy**; any ref sign; not merged inherited view; not `SchemaOrganization`.
- **D8** --- Area-driven GC of now-unreferenced Rooms via fixpoint is fine; dedicated Area remove UX is deferred.
- **D9** --- **`materializeComponent({ universalKey, fromAsset? })`**; derive **`tag`** from UUID prefix; callers do not pass `tag`.

---

## When this task finishes

**Gate:** Do **not** delete this task-plan until the items below are in **durable** docs (per [`taskPlanning/AGENT.md`](../../../../AGENT.md)). Implementation milestones should add or update those docs **as behavior lands** (especially **M1** for normalize semantics), not only at **M6**.

### Close-out checklist (copy into durable documentation)

| Topic | Where to persist | What to say |
| --- | --- | --- |
| **Consistency module** | [`foundations/consistency/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md) + link from [`Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) | Local vs global ops; flush pipeline; public APIs |
| **D2 orphan predicate** | Same module doc + short pointer in Workbench **AGENT.md** | **`isReferencedInAssetLayer`** = **`_topLevel` ∪ referencedBy`** on **local** `StandardForm` only; any ref sign; **not** `SchemaOrganization`; **not** merged `getStandardForm` |
| **Stored WML vs UI** | Same (or personalAssets **AGENT.md**) | Local = asset-layer edits (`ref={0}` stubs, etc.); merged form = display / import ancestry --- not orphan GC |
| **Ref scrub** | Same module doc (comment on `normalizeWorkbenchDraft`) | **Belt-and-suspenders:** expected **no-op** on happy path after **D2**; keep for draft hygiene; **not** why transitive GC happens; contrast engine **`removeComponent`** scrub |
| **Fixpoint normalize** | Same | Transitive removal = repeated **D2** passes; **not** reducer `cascade: true` |
| **List / TopLevel** | [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) | Disassociate + normalize; TopLevel in scope; no row **`removeComponent`** |
| **personalAssets** | [`personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md) | Workbench normalize on **local** edit path; WML merge orphan-with-content unchanged |

### Steps

1. Complete checklist rows (module **AGENT.md** is the canonical home for normalize/scrub/**D2** detail).
2. Update [`Workbench/AGENT.md`](../../../../../charcoal-client/src/components/Workbench/AGENT.md) and [`AGENT.reference-lists.md`](../../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) with links --- avoid duplicating full normalize prose.
3. Note workbench vs WML orphan policy in [`personalAssets/AGENT.md`](../../../../../charcoal-client/src/slices/personalAssets/AGENT.md) if reducer behavior changes.
4. Mark **M6** checklist `[X]`; then archive/delete this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
