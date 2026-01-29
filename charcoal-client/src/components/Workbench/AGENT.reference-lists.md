# Workbench reference list patterns

Reference lists in the Workbench (WML `ReferenceList` on a component—e.g. `examples`, `features`, `lenses`, `marks`) are rendered as accordion lists with add/remove affordances. Two UI patterns exist: **typical** (list-only, click navigates or opens a dialog) and **inline** (list plus a per-item editing pane for small components).

---

## Shared item type and adapter

- **`WorkbenchReferenceListItem`**: `{ id: string, title: string, subtitle?: string, icon?: ReactNode }`. Used by both list components.
- **`referenceListToWorkbenchItems`** (`referenceListAdapter.ts`): Converts a WML `ReferenceList` + `StandardForm` + optional `tag` into `WorkbenchReferenceListItem[]`. Resolves each reference’s component and uses `shortName` for `title` when present; `id` is the reference’s `universalKey` (or fallback). Use for Examples, Features, Lenses, Marks, etc.

---

## Typical reference list: `WorkbenchReferenceList`

For lists where each item is **navigated to** (e.g. Examples) or **selected via dialog** (e.g. Features). No per-item data editing in the list itself.

- **Structure**: `MakeTheWorldAccordion` wrapping a list. Each item: card with `ListItemButton` (title, optional subtitle/icon), optional delete `IconButton`. Optional “Add” row at the bottom.
- **Props**: `title`, `items`, `summary`, `defaultExpanded`, `disabled`, `onItemClick`, `onItemRemove`, `onAddClick`, `addLabel`, `emptyStateText`.
- **Usage**: Examples (click → navigate to Example layer), Features (Add → open feature selector dialog; click item could navigate to Feature). Exits and Lenses use similar list UI but are wired separately (e.g. Lens selector dialog, single-lens vs multi-lens).

---

## Inline reference list: `WorkbenchInlineReferenceList`

For reference lists whose items are **small components** that can be edited in place (e.g. Marks in a Lens), without navigating away.

- **Structure**: Same as typical (accordion, list, add row, delete per item) plus a **per-item editor pane**. Each list item has:
  1. **Header row**: title (and optional subtitle/icon), delete button. No row-level click (no navigation).
  2. **Editor pane** (optional): when `renderItemEditor(id)` is provided, its return value is rendered below the header inside the same card.
- **Props**: Same as typical except **no `onItemClick`**. New: `renderItemEditor?: (id: string) => ReactNode`.
- **Use case**: **Marks** in the Workbench Room Lens editor. Items from `referenceListToWorkbenchItems({ referenceList: singleLens.marks, standardForm, tag: 'Mark' })`. `renderItemEditor(id)` resolves the Mark and returns `MarkInlineEditor` (Short Name + Description). Add/remove via the list’s add row and delete. The pattern is generic so other small inline-editable reference lists can reuse `WorkbenchInlineReferenceList`.

---

## Related components

- **`MarkInlineEditor`**: Inline editor for a single Mark (shortName, description). Used by the Marks section in `WorkbenchRoomLensEditor` via `WorkbenchInlineReferenceList`’s `renderItemEditor`.
