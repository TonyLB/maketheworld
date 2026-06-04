# Workbench consistency migration cleanup (client)

**Status:** Phase 4 complete. **Next step:** Phase 5 --- optional `FacetListSessionEditor` / shared facet-list shell ([`FacetListEditorGeneric`](../../../../charcoal-client/src/components/Workbench/foundations/FacetList/FacetListEditorGeneric.tsx)).

This plan is task-scoped. Archive or delete it after the initiative ships; move any lasting norms into Workbench `AGENT.md` files next to code.

**Framework:** [`taskPlanning/AGENT.md`](../../../AGENT.md)

**Deferred follow-up (layered editing / flush):** [`AGENT.updateStandardExtension.planning.md`](AGENT.updateStandardExtension.planning.md) --- session flush couples merged-shaped `working` with edit-layer `updateLocal` + normalize; can corrupt inherited overlays (e.g. Room `shortName` concat). **Out of scope** for this cleanup; do not block migration on it.

---

## Purpose

The Workbench **consistency layer** and **component / asset-meta editing sessions** are in place (`materializeComponentInAsset`, `applyWorkbenchFlush`, `applyAssetMetaFlush`, orphan preview/confirm). Several editors were wrapped in [`WorkbenchComponentProvider`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.tsx) **before** those norms were applied everywhere. They still call **`updateStandard({ type: 'update' })`** for operations that should use:

1. **Eager global materialize** --- `await materializeComponentInAsset(...)` on the **local** draft (`updateLocal`), not inline `byUniversalId` surgery in a merged-draft `update`.
2. **Local associate / disassociate** --- `updateComponent` (or `updateAssetMeta`) on **`working`**, with debounced flush (`updateLocal` + `applyWorkbenchFlush` / `applyAssetMetaFlush`) for normalize.
3. **Orphan confirm at disassociate boundaries** --- `previewOrphanClosure` + confirm helpers where non-empty closure is possible.

This initiative finishes that wiring on **provider screens** and consolidates duplicate facet-list / single-ref patterns. It does **not** replace documented **asset-level exceptions** (Room/Area exits, layered situation facet editor, Map/Character editors).

---

## Background (what is already correct)

| Area | Pattern |
| --- | --- |
| Reference lists on component session | [`ReferenceListSessionEditor`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.tsx) |
| Asset `_topLevel` | [`TopLevelEditor`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/TopLevelEditor.tsx) + [`useWorkbenchAssetMeta`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta.tsx) |
| Room `_lens` (SingleReference) | [`LensHeader`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensHeader.tsx): create/import/reference via **`materializeComponentInAsset`** + **`onAssociateReference`** on **`working._lens`**; disassociate via `clearLensReference` + [`confirmOrphanClosureBeforeComponentDisassociate`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/confirmOrphanClosureBeforeLocalEdit.ts) |
| Lens mark facets | [`LensMarkFacetsEditor`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx): create/import/reference via **`materializeComponentInAsset`** + **`onAssociateReference`** -> **`onChange`** / **`updateComponent`** in [`LensDetail`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensDetail.tsx); remove/payload via **`onFacetsChange`** only |
| Guidance mark facets | [`MarkFacetsEditor`](../../../../charcoal-client/src/components/Workbench/MarkFacetsEditor/MarkFacetsEditor.tsx): create/import/reference via **`materializeComponentInAsset`** + **`onAssociateReference`** -> **`onChange`** / **`updateComponent`** in [`GuidanceEditorBody`](../../../../charcoal-client/src/components/Workbench/GuidanceEdit/GuidanceEditor.tsx); remove/payload via **`onFacetsChange`** only |
| Room non-DEFAULT situations list | [`RoomSituationsListEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomSituationsListEditor.tsx): create/reference via **`materializeComponentInAsset`** + **`onAssociateReference`** on **`working.situations`**; remove via **`confirmOrphanClosureBeforeComponentDisassociate`** + **`updateComponent`** ([`roomSituationsFacetAccessor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/roomReferenceListAccessors.ts)) |
| DEFAULT situation prose on session screens | [`DefaultRenderEditor`](../../../../charcoal-client/src/components/Workbench/foundations/DefaultRenderEditor.tsx) |
| Feature / Knowledge / Area shortName + session lists | [`FeatureEditor`](../../../../charcoal-client/src/components/Workbench/FeatureEdit/FeatureEditor.tsx), [`KnowledgeEditor`](../../../../charcoal-client/src/components/Workbench/KnowledgeEdit/KnowledgeEditor.tsx), [`AreaEditor`](../../../../charcoal-client/src/components/Workbench/AreaEdit/AreaEditor.tsx) |

**Gold-standard control flow:** [`useAddReferenceImport`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AddReferenceImportControl.tsx) with **`onAssociateReference`** + **`requestCreate`** that calls **`materializeComponentInAsset`** then associates on parent **`working`** (see `ReferenceListSessionEditor`).

---

## Anti-patterns to eliminate (on provider screens)

| ID | Anti-pattern | Why it is wrong | Target fix |
| --- | --- | --- | --- |
| **P1** | `requestCreate` inlines `standardComponentFactory` + `updateStandard({ type: 'update' })` | Bypasses `materializeComponentInAsset`; diffs merged form | `await materializeComponentInAsset({ universalKey })` then local associate |
| **P2** | `useAddReferenceImport` without **`onAssociateReference`** | `persistAssociation` uses merged-draft `update` | Pass `onAssociateReference` -> `updateComponent` / `updateAssetMeta` |
| **P3** | List/facet **remove** via immediate `updateStandard({ type: 'update' })` | Skips `working`, skips flush normalize, skips orphan confirm | `updateComponent` on site + optional confirm + debounced flush |
| **P4** | Session UI reads **`standardForm`** for list state while handlers mutate Redux | Stale UI; bypasses two-tier model | Read **`working`** from `useWorkbenchComponent` for list/facet display |
| **P5** | Import path uses bundled `addImportToDraft` in one `update` on session screens | Session path should use `materializeComponentInAsset({ fromAsset })` + local associate | Same as `ReferenceListSessionEditor` import branch |

**Note:** `updateStandard({ type: 'updateLocal' })` is correct **only** inside consistency flush/materialize thunks and session **`dispatchFlush`** --- not for per-action authoring on provider screens.

---

## Progress

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Baseline tests green | [X] |
| 1 | [`LensHeader`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensHeader.tsx) create / reference / import | [X] |
| 2 | [`LensMarkFacetsEditor`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx) (Lens session) | [X] |
| 3 | [`MarkFacetsEditor`](../../../../charcoal-client/src/components/Workbench/MarkFacetsEditor/MarkFacetsEditor.tsx) (Guidance session) | [X] |
| 4 | [`RoomEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx) non-DEFAULT **Situations** list | [X] |
| 5 | Optional: `FacetListSessionEditor` or `onAssociateReference` on [`FacetListEditorGeneric`](../../../../charcoal-client/src/components/Workbench/foundations/FacetList/FacetListEditorGeneric.tsx) | [ ] (partial: `onAssociateReference` passthrough added in Phase 2) |
| 6 | Durable doc trim (exceptions table, facet-list AGENT) | [ ] |

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../../AGENT.md)
2. **Client test commands:** [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) --- **command authority** for Vitest; run from `charcoal-client/`.
3. **Workbench composition + sessions:** [`charcoal-client/src/components/Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md) (component session, asset-meta session, asset-level exceptions)
4. **Consistency layer (normative):** [`foundations/consistency/AGENT.md`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/AGENT.md)
5. **Reference lists:** [`foundations/ReferenceList/AGENT.reference-lists.md`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md)
6. **Facet lists:** [`foundations/FacetList/AGENT.facet-list.md`](../../../../charcoal-client/src/components/Workbench/foundations/FacetList/AGENT.facet-list.md)
7. **`updateStandard` / local vs merged:** [`charcoal-client/src/slices/personalAssets/AGENT.md`](../../../../charcoal-client/src/slices/personalAssets/AGENT.md)

**Baseline (before edits):**

```bash
cd charcoal-client
npm run test:single -- src/components/Workbench/foundations/consistency
npm run test:single -- src/components/Workbench/LensEdit/LensHeader.test.tsx
npm run test:single -- src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.test.tsx
```

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets) as each slice lands.

- [X] **Phase 0 --- Baseline**
  - [X] Run baseline commands above; fix any pre-existing failures before Phase 1.
- [X] **Phase 1 --- LensHeader (Room `_lens`)**
  - [X] **`requestCreate`:** replace inline `StandardLens` + `update({ type: 'update' })` with `await materializeComponentInAsset({ universalKey })`, then associate on Room **`working._lens`** via `updateComponent` (after `onCreated(ref)`).
  - [X] **Reference existing / import:** pass **`onAssociateReference`** into `useAddReferenceImport` (set `SingleReference.fromValue(ref)` on `working`); remove reliance on merged-draft `persistAssociation` for session path.
  - [X] Keep **`clearLensReference`** as-is (already uses `confirmOrphanClosureBeforeComponentDisassociate` + `updateComponent`).
  - [X] Update [`LensHeader.test.tsx`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensHeader.test.tsx): create/import expect `materializeComponentInAsset` + session associate; flush still `updateLocal`.
- [X] **Phase 2 --- Lens mark facets (LensDetail session)**
  - [X] **`LensMarkFacetsEditor.requestCreate`:** `materializeComponentInAsset` for Mark body only; associate facet on Lens via existing **`onFacetsChange`** -> `updateComponent` in [`LensDetail`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensDetail.tsx) (do not bundle create+associate in one `update`).
  - [X] **Reference existing / import:** thread **`onAssociateReference`** (or facet-session equivalent) so `FacetListEditorGeneric` / `useAddReferenceImport` does not call merged `update`.
  - [X] Facet remove/payload: confirm still routed through `onFacetsChange` only (no new `updateStandard` on edit path).
  - [X] Add or extend tests under `LensMarkFacetsEditor/` or LensDetail session harness ([`LensMarkFacetsEditor.test.tsx`](../../../../charcoal-client/src/components/Workbench/LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.test.tsx)).
- [X] **Phase 3 --- Guidance mark facets (GuidanceEditor session)**
  - [X] Same as Phase 2 for [`MarkFacetsEditor`](../../../../charcoal-client/src/components/Workbench/MarkFacetsEditor/MarkFacetsEditor.tsx) when parent supplies `onChange` -> `updateComponent` ([`GuidanceEditorBody`](../../../../charcoal-client/src/components/Workbench/GuidanceEdit/GuidanceEditor.tsx)).
  - [X] Tests: Guidance session + mark create does not call `updateStandard` before flush ([`MarkFacetsEditor.test.tsx`](../../../../charcoal-client/src/components/Workbench/MarkFacetsEditor/MarkFacetsEditor.test.tsx)).
- [X] **Phase 4 --- Room non-DEFAULT Situations list**
  - [X] Move situation handlers inside **`WorkbenchComponentProvider`** scope; build list items from **`working.situations`**, not committed `room` from `standardForm` (**P4**). [`RoomSituationsListEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomSituationsListEditor.tsx).
  - [X] **Remove:** `updateComponent` disassociate at `room.situations` site only; add **`confirmOrphanClosureBeforeComponentDisassociate`** when removing a Situation ref may orphan a non-empty body (**P3**).
  - [X] **Create:** `materializeComponentInAsset` for Situation body; `updateComponent` to add `StandardSituationRoomFacet` on **`working`**.
  - [X] **`_topLevel` on create:** **Option B** --- new Situations are nested under Room only until author adds via TopLevel; no eager `_topLevel` on Room create path.
  - [X] **Reference existing:** `onAssociateReference` pattern (facet associate on `working`), not `updateStandard`.
  - [X] **`roomSituationsFacetAccessor`** + thin wrapper in [`roomReferenceListAccessors.ts`](../../../../charcoal-client/src/components/Workbench/RoomEdit/roomReferenceListAccessors.ts).
  - [X] Tests: [`RoomSituationsListEditor.test.tsx`](../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomSituationsListEditor.test.tsx).
- [ ] **Phase 5 --- Facet list infrastructure (optional but reduces duplication)**
  - [ ] Add **`onAssociateReference`** (and session-aware **`requestCreate`**) to [`FacetListEditorGeneric`](../../../../charcoal-client/src/components/Workbench/foundations/FacetList/FacetListEditorGeneric.tsx), **or** introduce **`FacetListSessionEditor`** mirroring `ReferenceListSessionEditor`.
  - [ ] Refactor Lens/Guidance mark editors to use shared shell; delete duplicated `association` / `requestCreate` blocks if fully subsumed.
- [ ] **Phase 6 --- Durable docs**
  - [ ] Update [`Workbench/AGENT.md`](../../../../charcoal-client/src/components/Workbench/AGENT.md) **Asset-level `updateStandard` (exceptions)** --- remove Lens mark create, Room situations, Room lens create once migrated.
  - [ ] Update [`AGENT.facet-list.md`](../../../../charcoal-client/src/components/Workbench/foundations/FacetList/AGENT.facet-list.md) mark-create bullet.
  - [ ] Update [`AGENT.reference-lists.md`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/AGENT.reference-lists.md) Room `_lens` row if LensHeader import path changes.

---

## Verification

Run from `charcoal-client/` after each phase (at minimum before closing the initiative):

```bash
cd charcoal-client

# Consistency layer (orphan, materialize, flush)
npm run test:single -- src/components/Workbench/foundations/consistency

# Phase 1
npm run test:single -- src/components/Workbench/LensEdit/LensHeader.test.tsx

# Phase 2-3 (adjust paths if new tests added)
npm run test:single -- src/components/Workbench/LensEdit
npm run test:single -- src/components/Workbench/GuidanceEdit/GuidanceEditor.test.tsx
npm run test:single -- src/components/Workbench/MarkFacetsEditor

# Phase 4
npm run test:single -- src/components/Workbench/RoomEdit

# Reference list session regression
npm run test:single -- src/components/Workbench/foundations/ReferenceList/ReferenceListSessionEditor.test.tsx
npm run test:single -- src/components/Workbench/foundations/ReferenceList/TopLevelEditor.test.tsx

# Component session regression
npm run test:single -- src/components/Workbench/foundations/WorkbenchComponent/useWorkbenchComponent.test.tsx
```

**Grep guardrails (no new merged-draft authoring on migrated paths):**

```bash
# From repo root; expect hits only in asset-mode / exception files after migration
rg "type:\s*['\"]update['\"]" charcoal-client/src/components/Workbench/LensEdit/LensHeader.tsx
rg "type:\s*['\"]update['\"]" charcoal-client/src/components/Workbench/LensEdit/LensMarkFacetsEditor
rg "type:\s*['\"]update['\"]" charcoal-client/src/components/Workbench/MarkFacetsEditor
rg "type:\s*['\"]update['\"]" charcoal-client/src/components/Workbench/RoomEdit/RoomEditor.tsx
```

After Phase 1-4, the four paths above should have **no** `type: 'update'` except comments/tests. Legitimate remaining `update` call sites include [`ExitEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/ExitEditor.tsx), [`ExitEdgeListEditor`](../../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeListEditor.tsx), [`SituationFacetRenderFieldsEditor`](../../../../charcoal-client/src/components/Workbench/foundations/SituationFacetRenderFieldsEditor.tsx), [`ReferenceListEditor`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListEditor.tsx), Map/Character/Situation editors.

**Manual smoke (Draft asset):**

1. Room: create lens, reference existing lens, import lens, delete lens reference (confirm when non-empty closure).
2. Lens detail: create mark, reference/import mark, remove mark row; inline mark shortName still flushes per-row session.
3. Room (with lens): add/remove non-DEFAULT situation; create situation navigates to new component.
4. Guidance (layered or top-level): mark facet create/reference/remove.

---

## Out of scope (this initiative)

| Item | Rationale |
| --- | --- |
| [`ExitEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/ExitEditor.tsx), [`ExitEdgeListEditor`](../../../../charcoal-client/src/components/Workbench/AreaEdit/ExitEdgeListEditor.tsx) | Documented topology exceptions in Workbench AGENT |
| [`SituationFacetRenderFieldsEditor`](../../../../charcoal-client/src/components/Workbench/foundations/SituationFacetRenderFieldsEditor.tsx) | Layered Room non-DEFAULT situations; asset-mode per change until layered session design |
| [`SituationEditor`](../../../../charcoal-client/src/components/Workbench/SituationEdit/SituationEditor.tsx) full session wrap | Separate migration (shortName + marks on `WorkbenchComponentProvider`); can follow Phase 4 |
| Map / Character editors | Not on component session |
| [`ReferenceListEditor`](../../../../charcoal-client/src/components/Workbench/foundations/ReferenceList/ReferenceListEditor.tsx) asset-mode | Intentional non-provider adapter |
| Changing `AddReferenceImportControl` asset-mode fallback globally | Session call sites fixed first; asset-mode `update` debt remains for non-provider screens |

---

## Implementation notes (task-specific)

### `materializeComponent` vs `_topLevel`

[`materializeComponent`](../../../../charcoal-client/src/components/Workbench/foundations/consistency/materializeComponent.ts) ensures **`byUniversalId`** only. It does **not** add `_topLevel`. **Phase 4 (Option B):** Room Situation create via [`RoomSituationsListEditor`](../../../../charcoal-client/src/components/Workbench/RoomEdit/RoomSituationsListEditor.tsx) does **not** register `_topLevel`; authors add to TopLevel from the asset root when desired (same as referencing an existing Situation not on `_topLevel`).

### Facet list vs reference list

Facet **remove** and **payload** edits already go through parent `onFacetsChange` on Lens/Guidance when wired from session parents. Only **create / reference / import** paths still hit **P1** / **P2**.

### Tests and harnesses

- Component session: [`foundations/WorkbenchComponent/testing/harness.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchComponent/testing/harness.tsx)
- Asset-meta session: [`foundations/WorkbenchAssetMeta/testing/harness.tsx`](../../../../charcoal-client/src/components/Workbench/foundations/WorkbenchAssetMeta/testing/harness.tsx)
- Mock `materializeComponentInAsset` where ReferenceListSessionEditor tests already do.

---

## When the task finishes

1. Move any remaining steady-state guidance into Workbench `AGENT.md` / consistency `AGENT.md` (not duplicated here).
2. Delete or archive this file.
3. Ensure `taskPlanning/charcoal-client/src/components/Workbench/` does not accumulate stale plans.
