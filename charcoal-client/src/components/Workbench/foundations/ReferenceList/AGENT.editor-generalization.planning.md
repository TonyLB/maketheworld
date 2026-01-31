# ReferenceList Editor Generalization — Planning

This document tracks the phased consolidation of reference-list UI patterns across the Workbench, moving from ad-hoc components toward a unified `ReferenceListEditor` with consistent affordances.

---

## Phase 1: ReferenceListEditor variant prop — DONE

**Goal**: Add a `variant` property to `ReferenceListEditor` so the same component can render either contained (card-style) or table (flat list) rows.

**Completed**:
- Added `variant?: "contained" | "table"` to `ReferenceListEditorProps` (default: `"contained"`).
- `contained`: Bordered cards with `sectionHeaderBackground`, `sectionBorder`, rounded corners (existing behavior).
- `table`: Flat `ListItem` + `ListItemButton` with `secondaryAction` for delete, matching the AssetDataHeader / ComponentRow style.
- No changes to existing callers; default preserves current UX.

**Reference**: [`ReferenceListEditor.tsx`](./ReferenceListEditor.tsx)

---

## Phase 2: Add Import entry to both ReferenceList variants — DONE

**Goal**: Add an "Import" row/entry to both `contained` and `table` variants of `ReferenceListEditor`, following the pattern in AssetEditForm (where `AddImport` appears after `AddComponent` and opens `ImportComponentDialog`).

**Completed**:
- Added `onImportClick?: () => void` and `importLabel?: string` (default: `"Import"`) to `ReferenceListEditorProps`.
- When `onImportClick` is provided, an Import row renders after the Add row (or on its own when only import is needed).
- Import row uses the same `ListItem` + `ListItemButton` structure as the Add row; styling matches both variants.
- Uses `ImportExportIcon` and `aria-label="Import component from another asset"`.
- No changes to existing callers; wiring `onImportClick` in callers deferred to Phase 3 and beyond.

**Reference**: [`ReferenceListEditor.tsx`](./ReferenceListEditor.tsx), [`WorkbenchAddImport.tsx`](../../WorkbenchAddImport.tsx)

---

## Phase 3: Refactor asset edit view to use ReferenceListEditor

**Goal**: Replace the custom Components accordion in `WorkbenchAssetEditForm` with `ReferenceListEditor` using `variant="table"`.

**Planned work**:
- Use `referenceListToItems` with `standardForm._topLevel` and no `tag` filter to get all top-level component references.
- Map items to add per-type icons (Character, Map, Room, Feature, Knowledge) — extend adapter or do mapping at call site.
- Handle Images separately or extend the list/adapter if Images can be represented as reference-list items.
- Use `ReferenceListEditor` with `variant="table"`, wiring:
  - `onItemClick` → navigate to component
  - `onItemRemove` → remove from `_topLevel`
  - `onAddClick` → create new component (Add row); "Reference existing (X)" is a separate affordance (Phase 6, opens generic selector from Phase 5)
  - `onImportClick` → open `ImportComponentDialog`
- Remove direct use of `ComponentRow`, `AddComponent`, `AddImport` from the Components section. `ImportComponentDialog` stays (it uses different data: external assets).

**Reference**: [`WorkbenchAssetEditForm.tsx`](../../WorkbenchAssetEditForm.tsx), [`referenceListAdapter.ts`](./referenceListAdapter.ts)

---

## Phase 4: Deprecate orphaned code — DONE (partial)

**Goal**: Remove or deprecate components and patterns that were replaced by the generalized ReferenceListEditor.

**Completed**:
- Removed `WorkbenchComponentRow`, `WorkbenchAddComponent`, `WorkbenchAddImport` (inlined into TopLevelEditor).
- Removed `FeatureSelectorDialog` — simplified ReferenceListEditor to "create" only for now. Phase 5/6 will add "Reference existing (X)" in a unified way.
- Simplified ReferenceListEditor affordances: removed `addAffordance` prop (always renders create affordance); derived `addLabel` from `tag` (`Add {tag}`); removed `emptyStateText` option — `ReferenceListEditorGeneric` now uses fixed copy "No items yet." in all cases.

**Remaining**:
- After Phase 5, deprecate `LensSelectorDialog` (if superseded by generic selector).
- Do **not** deprecate `ImportComponentDialog` — it serves cross-asset import and depends on different data sources.

**Reference**: [`LensSelectorDialog.tsx`](../../LensSelectorDialog.tsx)

---

## Phase 5: Generic component selector — DONE (partial)

**Goal**: Facilitate **separate affordances** for "Add (X)" (create new) and "Reference existing (X)" within the current workbench asset. Create a single, generic component selector dialog used when the user explicitly chooses "Reference existing (X)" (or when a full picker is needed). It is **not** an extension of the "Click Add, then choose new vs reference" pattern — callers surface distinct actions for add vs reference-existing. This dialog is for **selecting existing** components only; "Add (X)" remains a separate affordance elsewhere.

**Generic component selector design**:

- **Optional `tag` argument**:
  - If **present**: Filter the list to components of that tag only; show a **flat list with no section headers** by type.
  - If **absent**: Replicate `ImportComponentDialog`-style appearance: show **all** possible references in the current asset, **grouped and headered by type** (e.g. Features, Lenses, Rooms, …).
- **Exclusion callback**: Accept a callback that, per component, indicates whether it should be **excluded** from the list (e.g. because it is already in the reference list being added to). The dialog omits any component for which the callback returns true.

**Completed**:
- Created `ComponentSelectorDialog` in [`foundations/ComponentSelector/`](../ComponentSelector/) with props:
  - `open`, `onClose`
  - `tag?: DialogComponentTag` (optional; includes ReferenceListEditor `ComponentTag` plus `"Image"`)
    - If set: filter to that tag only; flat list; no type headers.
    - If omitted: all component types in the current asset, grouped and headered by type (ImportComponentDialog-like).
  - `onSelect: (universalKey: ComponentUUID) => void`
  - `isExcluded?: (universalKey: ComponentUUID) => boolean` — when true, that component is omitted from the list.
- Implemented UX: flat list when `tag` set; grouped list with section headers and optional icons when `tag` absent; empty state "No components to show."; data from `useWorkbenchAsset().standardForm`.
- Not yet wired from any caller (Phase 6 and migration will add usage).

**Remaining**:
- Migrate `RoomEdit/LensEditor` to use the generic selector instead of `LensSelectorDialog`.
- Phase 6 will add the "Reference existing (X)" row in ReferenceListEditor that opens this dialog (with `tag` set and `isExcluded` wired from the current reference list).
- **Out of scope**: `ImportComponentDialog` — it operates on cross-asset imports and different data (inherited forms, external assets). Keep it separate.

**Reference**: [`ComponentSelector/ComponentSelectorDialog.tsx`](../ComponentSelector/ComponentSelectorDialog.tsx), [`LensSelectorDialog.tsx`](../../LensSelectorDialog.tsx), [`ImportComponentDialog.tsx`](../../ImportComponentDialog.tsx)

---

## Phase 6: "Reference existing (X)" option in ReferenceListEditor

**Goal**: Add a "Reference existing (X)" option to `ReferenceListEditor` that lets users reference components already present in the workbench asset but not yet in the current reference list (e.g., "Reference existing Feature", "Reference existing Lens").

**Planned work**:
- Add `onReferenceExistingClick?: () => void` (or a config object) so the list can show a "Reference existing (X)" row when appropriate.
- Alternative: Pass a `referenceExistingLabel?: string` and `onReferenceExistingClick`; when both are set, render an additional row.
- When clicked, open the generic component selector (Phase 5) filtered to the relevant tag, then add the selected component to the reference list.
- Distinguish from "Add" (create new) and "Import" (from another asset): "Reference existing" = pick from components already in this asset.
- Consider which reference lists support this: Features, Lenses, Exits, etc. — not all may need it (e.g., Examples might only support Add).

**Reference**: [`referenceListAdapter.ts`](./referenceListAdapter.ts), [`AGENT.reference-lists.md`](./AGENT.reference-lists.md)

---

## Summary

| Phase | Status  | Description                                             |
| ----- | ------- | ------------------------------------------------------- |
| 1     | Done    | ReferenceListEditor `variant` prop (contained / table)   |
| 2     | Done    | Add Import row to both ReferenceList variants           |
| 3     | Done    | Refactor asset edit view to use TopLevelEditor           |
| 4     | Done    | Deprecate orphaned components (incl. FeatureSelectorDialog) |
| 5     | Done (partial) | Generic component selector created; migration in Phase 6 |
| 6     | Planned | "Reference existing (X)" option in ReferenceListEditor  |
