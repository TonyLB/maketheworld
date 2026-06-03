# Workbench reference list patterns

Reference lists in the Workbench (WML `ReferenceList` on a component—e.g. `examples`, `features`, `lens`, `marks`) are rendered as accordion lists with add/remove affordances. Two UI patterns exist: **typical** (list-only, click navigates or opens a dialog) and **inline** (list plus a per-item editing pane for small, lightweight fields, with optional navigation to a detailed editor).

---

## Shared item type and adapter

- **`ReferenceListItem`**: `{ id: string, title: string, subtitle?: string, icon?: ReactNode }`. Used by both list components.
- **`referenceListToItems`** (`referenceListAdapter.ts`): Converts a WML `ReferenceList` + `StandardForm` + optional `tag` into `ReferenceListItem[]`. Resolves each referenced component via **`standardForm._lookup(ref.standardKey.toJSON())`** (key or universalKey). **`id` is `ref.universalKey` only** (ComponentUUID); references without `universalKey` throw. List remove uses [`referenceListMutations.ts`](referenceListMutations.ts) **`sameKey`** matching---never `universalKey ?? local key`.

---

## Composable shell: `ReferenceListControlled`

Facet-list-style composition: **`referenceList`** + **`onReferenceListChange`** (`(mutate: (list: ReferenceList) => void) => void`). Renders accordion UI, add/reference/import rows (`useAddReferenceImport`), and remove via [`referenceListMutations.ts`](referenceListMutations.ts). **Does not** call `updateStandard` or `useWorkbenchComponent` internally---the parent wires persistence.

| Wrapper | When to use |
| --- | --- |
| **`ReferenceListSessionEditor`** | On **`WorkbenchComponentProvider`** screens; pass **`listAccessor`** (`getReferenceList` / `setReferenceList` on parent `working`). |
| **`ReferenceListEditor`** | Asset-mode adapter: `listContext` + `updateStandard` (non-provider or legacy). |
| **`ReferenceListControlled` directly** | Custom persistence (e.g. tests, new list hosts). |

List-only helper: [`referenceListMutations.ts`](referenceListMutations.ts) (`removeReferenceFromListById` via `sameKey`). Add uses `ReferenceList.assureItem` at call sites.

---

## Typical reference list: `ReferenceListEditor` / `ReferenceListSessionEditor`

For lists where each item is **navigated to** or **selected via dialog** (e.g. Room Features, Guidance). No per-item data editing in the list itself. Both delegate to **`ReferenceListControlled`**.

- **Structure**: `ReferenceListEditorGeneric` inside `MakeTheWorldAccordion`. Each item: card with `ListItemButton` (title, optional subtitle/icon), optional delete `IconButton`. Optional Add / Reference existing / Import rows.
- **Session usage**: Room Guidance/Features ([`roomReferenceListAccessors.ts`](../../RoomEdit/roomReferenceListAccessors.ts)), Area position-graph participants per tag ([`areaPositionGraphNodesAccessors.ts`](../../AreaEdit/areaPositionGraphNodesAccessors.ts)).
- **Asset usage**: `ReferenceListEditor` with `listContext` when no parent session (reserved for future non-provider call sites; **`TopLevelEditor`** uses `ReferenceListEditorGeneric` directly).

---

## Inline reference list: `InlineReferenceList` (v2)

For reference lists whose items are **small components** with lightweight inline editing (e.g. Marks in a Lens). The list owns row layout; the inline editor receives only a constrained **edit slot**. Heavier editing (e.g. description) lives in a **detailed editor**, reachable by clicking a dedicated **gap** between the edit slot and affordances.

- **Structure**: Accordion, list of cards, add row. When `renderItemEditor` is provided, each card uses a **list-owned** layout: `[ edit slot | gap | affordances ]`.
  - **Edit slot**: `renderItemEditor(id)` returns only the inline-edit UI (e.g. shortName field). The editor must not render delete or other list-owned controls. The slot is constrained (`flex: 1; minWidth: 0`) so it cannot grow into the gap.
  - **Gap**: Fixed `minWidth` (e.g. 28px). When `onItemClick` is provided, the gap is clickable and serves as the "navigate to detailed editor" target. Cursor `pointer`; `aria-label="Open detailed editor"`.
  - **Affordances**: Rendered by the list (e.g. delete `IconButton`), always to the right of the gap.
- **Props**: Same as typical, plus:
  - **`renderItemEditor?: (id: string) => ReactNode`** — Renders only the inline-edit content for each item. No affordances are passed in.
  - **`onItemClick?: (id: string) => void`** — When provided, the gap is clickable; click dispatches navigation to the detailed editor for that item.
- **Fallback**: When `renderItemEditor` is omitted, each card falls back to a simple title + delete row. No gap, no `onItemClick`.
- **Use case**: Pure **`ReferenceList`** of Marks when list membership is the only parent concern. `renderItemEditor(id)` returns **`MarkInlineEditorWithSession`** (shortName only). `onItemClick(id)` navigates to **`MarkEditor`** (shortName + description). Delete stays in the list affordances. **Lens marks today** use a **facet list** hybrid instead (see [Inline edit slot persistence](#inline-edit-slot-persistence) and [AGENT.facet-list.md](../FacetList/AGENT.facet-list.md)).

---

## Inline edit slot persistence

When a list row edits a **referenced component field** (e.g. Mark `shortName`) that lives on `draft.byUniversalId[refId]`---not on the parent component's `working` copy---use a **per-row `WorkbenchComponentProvider`** scoped to the referenced component id. Do **not** call `updateStandard` per keystroke from the inline editor.

| List pattern | List data | Inline field target | Persist path |
| --- | --- | --- | --- |
| Typical / session reference list | `ReferenceList` on parent | None (navigate only) | Parent **`updateComponent`** via [`ReferenceListControlled`](ReferenceListControlled.tsx) / [`ReferenceListSessionEditor`](ReferenceListSessionEditor.tsx) |
| Inline reference list | `ReferenceList` on parent | Referenced component field (e.g. Mark shortName) | **Per-row** `WorkbenchComponentProvider` + context-only inline editor; `renderItemEditor(id)` wraps **`MarkInlineEditorWithSession`** |
| Facet list with inline reference field | Facet list on parent (e.g. Lens marks) | Referenced Mark shortName + facet payload on same row | Mark shortName: **`MarkInlineEditorWithSession`**; facet payload: parent **`onFacetsChange`** / **`updateComponent`** when parent has a session (Lens detail); mark create still asset-level **`updateStandard`** |

### `renderItemEditor` contract

- Receives **`id`** (referenced component universal key).
- Returns **edit-slot UI only** (no delete, no navigation).
- Call site (or **`MarkInlineEditorWithSession`**) owns provider scope and debounced flush.
- Gap / **`onItemClick`** navigates to the full editor ([`MarkEditor`](../../MarkEdit/MarkEditor.tsx)).

Example for a future pure reference-list call site:

```tsx
renderItemEditor={(id) => <MarkInlineEditorWithSession markId={id as ComponentUUID} />}
onItemClick={(id) => dispatch(pushBreadcrumb({ id, kind: 'component', componentId: id }))}
```

---

## Parent-session lists: `ReferenceListSessionEditor`

On screens wrapped in **`WorkbenchComponentProvider`** (e.g. Room Guidance, Room Features, Area position-graph participants), use **`ReferenceListSessionEditor`**. Thin wrapper over **`ReferenceListControlled`**: maps **`listAccessor`** to `referenceList` + `onReferenceListChange` on parent **`working`**. Item titles resolve from live **`standardForm`**.

| Operation | Persist path |
| --- | --- |
| Remove, reference existing | **`updateComponent`** on parent `working` + session debounced flush |
| Create new, import | **`await materializeComponentInAsset`** on Redux local draft, then **`updateComponent`** (associate on parent **`working`**) + session debounced flush (**`applyWorkbenchFlush`**) |

- **Requires** `WorkbenchComponentProvider`. Call site passes **`listAccessor`** (`getReferenceList` / `setReferenceList` on the parent working copy).
- **Asset-mode** **`ReferenceListEditor`** (`listContext` + `updateStandard`) is a thin adapter over **`ReferenceListControlled`** for screens without a parent session.
- **`TopLevelEditor`** remains asset-level and out of scope for this pattern.

Domain-specific list accessors belong next to the editor that owns the parent component, not in [`workbenchMutations.ts`](../workbenchMutations.ts).

---

## Related components

- **`MarkInlineEditor`**: Context-only Mark **shortName** field; requires **`WorkbenchComponentProvider`** for the Mark id. Use via **`MarkInlineEditorWithSession`** in list edit slots and facet rows.
- **`MarkInlineEditorWithSession`**: Per-row Mark session wrapper (`componentId={markId}` + `MarkInlineEditor`). Used in **`InlineReferenceList`** edit slots and **`LensMarkFacetPayloadEditor`**.
- **`MarkEditor`**: Full Mark editor (shortName + description). Shown when navigating to a Mark via the inline list gap or Lens row link icon. Add/remove Marks remains in the list.
