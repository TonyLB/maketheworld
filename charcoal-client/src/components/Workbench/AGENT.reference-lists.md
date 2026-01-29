# Workbench reference list patterns

Reference lists in the Workbench (WML `ReferenceList` on a component—e.g. `examples`, `features`, `lenses`, `marks`) are rendered as accordion lists with add/remove affordances. Two UI patterns exist: **typical** (list-only, click navigates or opens a dialog) and **inline** (list plus a per-item editing pane for small, lightweight fields, with optional navigation to a detailed editor).

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

## Inline reference list: `WorkbenchInlineReferenceList` (v2)

For reference lists whose items are **small components** with lightweight inline editing (e.g. Marks in a Lens). The list owns row layout; the inline editor receives only a constrained **edit slot**. Heavier editing (e.g. description) lives in a **detailed editor**, reachable by clicking a dedicated **gap** between the edit slot and affordances.

- **Structure**: Accordion, list of cards, add row. When `renderItemEditor` is provided, each card uses a **list-owned** layout: `[ edit slot | gap | affordances ]`.
  - **Edit slot**: `renderItemEditor(id)` returns only the inline-edit UI (e.g. shortName field). The editor must not render delete or other list-owned controls. The slot is constrained (`flex: 1; minWidth: 0`) so it cannot grow into the gap.
  - **Gap**: Fixed `minWidth` (e.g. 28px). When `onItemClick` is provided, the gap is clickable and serves as the “navigate to detailed editor” target. Cursor `pointer`; `aria-label="Open detailed editor"`.
  - **Affordances**: Rendered by the list (e.g. delete `IconButton`), always to the right of the gap.
- **Props**: Same as typical, plus:
  - **`renderItemEditor?: (id: string) => ReactNode`** — Renders only the inline-edit content for each item. No affordances are passed in.
  - **`onItemClick?: (id: string) => void`** — When provided, the gap is clickable; click dispatches navigation to the detailed editor for that item.
- **Fallback**: When `renderItemEditor` is omitted, each card falls back to a simple title + delete row. No gap, no `onItemClick`.
- **Use case**: **Marks** in the Workbench Room Lens editor. `renderItemEditor(id)` resolves the Mark and returns `MarkInlineEditor` (shortName only). `onItemClick(id)` navigates to `WorkbenchMarkEditor` (shortName + description). Delete stays in the list affordances.

---

## Related components

- **`MarkInlineEditor`**: Inline editor for a Mark’s **shortName only**. Used in `WorkbenchInlineReferenceList` edit slots. No affordances; no description. Description and remove are handled by the detail view and the list respectively.
- **`WorkbenchMarkEditor`**: Full Mark editor (shortName + description). Shown when navigating to a Mark via the inline list gap (e.g. from Lens Marks). Add/remove Marks remains in the list.
