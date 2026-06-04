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
| **`ReferenceListSessionEditor` (asset-meta)** | On **`WorkbenchAssetMetaProvider`** screens; **`listAccessor`** on asset-meta **`working.topLevel`**. Session tests: [`WorkbenchAssetMeta/testing/harness.tsx`](../WorkbenchAssetMeta/testing/harness.tsx). |
| **`ReferenceListEditor`** | Asset-mode adapter: `listContext` + `updateStandard` (non-provider or legacy). |
| **`ReferenceListControlled` directly** | Custom persistence (e.g. tests, new list hosts). |

List-only helper: [`referenceListMutations.ts`](referenceListMutations.ts) (`removeReferenceFromListById` via `sameKey`). Add uses `ReferenceList.assureItem` at call sites.

---

## Typical reference list: `ReferenceListEditor` / `ReferenceListSessionEditor`

For lists where each item is **navigated to** or **selected via dialog** (e.g. Room Features, Guidance). No per-item data editing in the list itself. Both delegate to **`ReferenceListControlled`**.

- **Structure**: `ReferenceListEditorGeneric` inside `MakeTheWorldAccordion`. Each item: card with `ListItemButton` (title, optional subtitle/icon), optional delete `IconButton`. Optional Add / Reference existing / Import rows.
- **Session usage**: Room Guidance/Features ([`roomReferenceListAccessors.ts`](../../RoomEdit/roomReferenceListAccessors.ts)), Area position-graph participants per tag ([`areaPositionGraphNodesAccessors.ts`](../../AreaEdit/areaPositionGraphNodesAccessors.ts)).
- **Asset usage**: `ReferenceListEditor` with `listContext` when no parent session (reserved for future non-provider call sites). **[`TopLevelEditor`](TopLevelEditor.tsx)** uses the asset-meta session pattern on **`working.topLevel`**; see [Asset root / `_topLevel`](#asset-root--_toplevel).

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
| Facet list with inline reference field | Facet list on parent (e.g. Lens marks) | Referenced Mark shortName + facet payload on same row | Mark shortName: **`MarkInlineEditorWithSession`**; facet payload and list add/remove: **`FacetListSessionEditor`** -> **`updateComponent`** on parent **`working`**; mark create/import/reference: **`materializeComponentInAsset`** + **`onAssociateReference`** (see [`LensMarkFacetsEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx), [AGENT.facet-list.md](../FacetList/AGENT.facet-list.md)) |

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
- **Asset-mode** **`ReferenceListEditor`** (`listContext` + `updateStandard`) is a thin adapter over **`ReferenceListControlled`** for screens without a parent component session.

Domain-specific list accessors belong next to the editor that owns the parent component (or asset root), not in [`workbenchMutations.ts`](../workbenchMutations.ts).

---

## Asset root / `_topLevel`

The asset top-level component list ([`TopLevelEditor`](TopLevelEditor.tsx) on [`WorkbenchAssetEditForm`](../../WorkbenchAssetEditForm.tsx)) uses the **same session list pattern** as component-parent lists, backed by **`useWorkbenchAssetMeta`** instead of **`useWorkbenchComponent`**. Normative: [Workbench AGENT.md](../../AGENT.md#asset-meta-editing-session).

- **`AssetEditForm`** wraps **`WorkbenchAssetMetaProvider`**.
- **`TopLevelEditor`** keeps TopLevel-specific UI (multi-tag add grid, **`ImageHeader`** rows, table variant) but persists like **`ReferenceListSessionEditor`**: list on asset-meta **`working.topLevel`**, mutations via **`updateAssetMeta`**, debounced flush via **`applyAssetMetaFlush`**.

| Operation | Persist path |
| --- | --- |
| **List display** | **Display union** via [`topLevelDisplayAdapter.ts`](topLevelDisplayAdapter.ts): merged **`standardForm._getSchemaOrganization().getChildrenOfParent(undefined)`** plus **`working.topLevel`** entries with **`ref >= 1`** (roster pins). Rows are **pinned** or **display-only** (visible in asset, not pinned). |
| Pin | Add **`ref={1}`** on **`working.topLevel`** ([`pinReferenceOnTopLevel`](referenceListMutations.ts)); debounced flush. |
| Unpin | **`_topLevel` site only** --- disassociate on **`working.topLevel`** (does **not** clear other parents); body **remains** until Purge; row may stay as **display-only** if still asset-visible. **`confirmSiteDisassociateBeforeAssetMetaDisassociate`**. |
| Purge | **TopLevel only** --- **`purgeComponentFromAssetFlow`** (`removeComponent` with rehome/cascade confirm). Available on pinned and display-only rows. |
| Reference existing | **`await materializeComponentInAsset`**, then **pin** on **`working.topLevel`** (`assureItem`, roster intent) |
| Create / import | **`await materializeComponentInAsset`**, then **pin** on **`working.topLevel`** (`assureItem`, roster intent) |

List accessor: [`topLevelAssetMetaListAccessor.ts`](topLevelAssetMetaListAccessor.ts) (`getReferenceList` / `setReferenceList` on **`WorkbenchAssetMetaWorking`**).

**Semantics:** **`_topLevel` `ref={1}`** = roster pin only. Structural placement uses nested **`referencedBy`** on other parents. Component/schema **`ref={0}`** is display organization; discoverability without a pin comes from the display union (e.g. import stub at asset level, rehomed descendants).

### Room `_lens` (SingleReference)

[`LensHeader`](../LensEdit/LensHeader.tsx) on the Room component session uses the same session pattern as **`ReferenceListSessionEditor`**, with a single **`SingleReference`** slot on **`working._lens`** instead of a list accessor.

| Operation | Persist path |
| --- | --- |
| Remove | **`_lens` site only** --- disassociate on **`working._lens`** (does **not** clear other parents); body **remains** until Purge elsewhere. **`confirmSiteDisassociateBeforeComponentDisassociate`** with site-local copy. |
| Reference existing | **`onAssociateReference`** on **`working._lens`** via **`updateComponent`** (selector ref; fast-path materialize when body already on local draft is unchanged) |
| Create | **`requestCreate`** -> **`await materializeComponentInAsset({ universalKey })`**, then **`onAssociateReference`** / **`updateComponent`** |
| Import | **`await materializeComponentInAsset({ universalKey, fromAsset })`**, then **`onAssociateReference`** --- **not** asset-mode `addImportToDraft` in one merged **`update`** |

---

## Related components

- **`MarkInlineEditor`**: Context-only Mark **shortName** field; requires **`WorkbenchComponentProvider`** for the Mark id. Use via **`MarkInlineEditorWithSession`** in list edit slots and facet rows.
- **`MarkInlineEditorWithSession`**: Per-row Mark session wrapper (`componentId={markId}` + `MarkInlineEditor`). Used in **`InlineReferenceList`** edit slots and **`LensMarkFacetPayloadEditor`**.
- **`MarkEditor`**: Full Mark editor (shortName + description). Shown when navigating to a Mark via the inline list gap or Lens row link icon. Add/remove Marks remains in the list.
