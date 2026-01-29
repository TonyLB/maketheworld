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

- **Structure**: Accordion, list of cards, add row. There is **no separate header row** per item. When `renderItemEditor` is provided, each card contains only the editor’s content; the list passes **affordances** (`InlineReferenceListAffordances`: `onRemove`, `disabled`) into the editor, and the **editor decides where and how to render them** (e.g. delete on the same row as the first field) for a compact layout. When `renderItemEditor` is omitted, each card falls back to a simple title + delete row.
- **Props**: Same as typical except **no `onItemClick`**. New: `renderItemEditor?: (id: string, affordances: InlineReferenceListAffordances) => ReactNode`.
- **Use case**: **Marks** in the Workbench Room Lens editor. `renderItemEditor(id, affordances)` resolves the Mark and returns `MarkInlineEditor` with `affordances`; the editor renders Short Name and the delete button on one row, then Description below, avoiding duplicate “Short Name” header + field.

---

## Related components

- **`MarkInlineEditor`**: Inline editor for a single Mark. Accepts optional `affordances`; when provided, renders the remove button on the same row as the Short Name field, then Description below. Used by the Marks section in `WorkbenchRoomLensEditor` via `WorkbenchInlineReferenceList`’s `renderItemEditor`.
