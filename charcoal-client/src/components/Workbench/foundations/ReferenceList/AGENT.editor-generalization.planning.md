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
  - `onAddClick` → expand/create new component (via Add row → generic component selector in Phase 5)
  - `onImportClick` → open `ImportComponentDialog`
- Remove direct use of `ComponentRow`, `AddComponent`, `AddImport` from the Components section. `ImportComponentDialog` stays (it uses different data: external assets).

**Reference**: [`WorkbenchAssetEditForm.tsx`](../../WorkbenchAssetEditForm.tsx), [`referenceListAdapter.ts`](./referenceListAdapter.ts)

---

## Phase 4: Deprecate orphaned code

**Goal**: Remove or deprecate components and patterns that were replaced by the generalized ReferenceListEditor.

**Planned work**:
- Identify and deprecate/remove:
  - `WorkbenchComponentRow` (replaced by ReferenceListEditor table variant)
  - `WorkbenchAddComponent` (replaced by ReferenceList add row + generic selector)
  - `WorkbenchAddImport` (replaced by ReferenceListEditor Import row)
- After Phase 5, deprecate selector dialogs that are superseded by the generic component selector:
  - `FeatureSelectorDialog` (if fully replaced)
  - `LensSelectorDialog` (if fully replaced)
- Do **not** deprecate `ImportComponentDialog` — it serves cross-asset import and depends on different data sources.

**Reference**: [`WorkbenchComponentRow.tsx`](../../WorkbenchComponentRow.tsx), [`WorkbenchAddComponent.tsx`](../../WorkbenchAddComponent.tsx), [`WorkbenchAddImport.tsx`](../../WorkbenchAddImport.tsx), [`FeatureSelectorDialog.tsx`](../../FeatureSelectorDialog.tsx), [`LensSelectorDialog.tsx`](../../LensSelectorDialog.tsx)

---

## Phase 5: Generic component selector

**Goal**: Create a single, generic component selector dialog that can replace ad-hoc solutions like `FeatureSelectorDialog`, `LensSelectorDialog`, etc. It should support "create new" and "select existing" for components of a given tag within the current workbench asset.

**Planned work**:
- Define a generic `ComponentSelectorDialog` (or similar name) with props:
  - `open`, `onClose`
  - `tag: ComponentTag` (e.g., `'Feature'`, `'Lens'`, `'Room'`, …)
  - `onSelectExisting: (universalKey: ComponentUUID) => void`
  - `onCreateNew: () => void`
- Implement shared UX:
  - List of existing components of the given tag (from `standardForm`) with shortName / key display.
  - "Create new" action (or inline affordance).
  - Optional filtering, search, or grouping if needed.
- Migrate `WorkbenchRoomFeatureEditor` to use the generic selector instead of `FeatureSelectorDialog`.
- Migrate `RoomLensEditor` to use the generic selector instead of `LensSelectorDialog`.
- **Out of scope**: `ImportComponentDialog` — it operates on cross-asset imports and different data (inherited forms, external assets). Keep it separate.

**Reference**: [`FeatureSelectorDialog.tsx`](../../FeatureSelectorDialog.tsx), [`LensSelectorDialog.tsx`](../../LensSelectorDialog.tsx), [`ImportComponentDialog.tsx`](../../ImportComponentDialog.tsx)

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
| 3     | Planned | Refactor asset edit view to use ReferenceListEditor     |
| 4     | Planned | Deprecate orphaned components                           |
| 5     | Planned | Generic component selector (replace Feature/Lens dialogs)|
| 6     | Planned | "Reference existing (X)" option in ReferenceListEditor  |
