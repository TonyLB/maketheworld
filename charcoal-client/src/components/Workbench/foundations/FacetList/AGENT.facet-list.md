# Workbench facet list pattern

Facet lists in the Workbench (WML facet lists such as `marks` on Guidance) are rendered as accordion lists with per-row payload editing. The pattern uses **handlers** for affordances (onRemove, onChangePayload), not injected components, so the payload editor (or a layout wrapper) can render and place affordances for full UI control.

Reference lists use the parallel **`ReferenceListControlled`** / **`ReferenceListSessionEditor`** shells; see [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md).

## Structure

- **FacetListEditorGeneric**: Owns the list and the add flow via **`useAddReferenceImport`** ([AddReferenceImportControl.tsx](../ReferenceList/AddReferenceImportControl.tsx)): Create new, Reference existing, and optional Import. The consumer supplies **`association(ref, draft)`** and **`requestCreate(onCreated)`** so new references are written into the correct facet list on `StandardForm`. Optional **`onAssociateReference`** skips merged-draft `persistAssociation` on session paths. For each facet, the generic calls `renderFacetRow(facet, index, handlers)`. Handlers are `onRemove`, `onChangePayload`, `readonly`.
- **FacetListSessionEditor**: Context-only wrapper for **`WorkbenchComponentProvider`** sessions (mirrors **`ReferenceListSessionEditor`**). Reads facets from parent **`working`** via **`facetListAccessor`** (`getFacetList`, `setFacetList`, `appendReferenceIfNew`); wires **`onFacetsChange`**, **`association`**, **`requestCreate`**, and **`onAssociateReference`** through **`updateComponent`** + **`materializeComponentInAsset`**. Consumer passes **`rebuildFacetList(items)`** to reconstruct the typed facet list after remove/payload edits, plus **`renderFacetRow`** and other presentation props.
- **Layout wrappers** (e.g. SingleLineFacetRow): Receive a payload slot (ReactNode) and affordance handlers (e.g. onRemove). Wrappers render affordance UI using shared primitives; they do not own persistence.
- **Affordance primitives**: Small components (e.g. FacetListAffordance.Remove) for consistent remove look/behavior.
- **Payload editor**: Renders only the payload content (e.g. reference label + Match field for Mark facets).
- **Tests**: [`FacetListSessionEditor.test.tsx`](./FacetListSessionEditor.test.tsx) --- create/import/reference session wiring (mock `materializeComponentInAsset`; flush via `updateLocal`).

## Usage

### Component session (preferred on provider screens)

Use **`FacetListSessionEditor`** with a **`FacetListSessionAccessor`** and row renderer only in the consumer:

- Lens marks: [`LensMarkFacetsEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx) + [`lensMarkFacetAccessor`](../../LensEdit/LensMarkFacetsEditor/lensMarkFacetAccessors.ts) inside [`LensDetail`](../../LensEdit/LensDetail.tsx).
- Guidance marks: [`MarkFacetsEditor`](../../MarkFacetsEditor/MarkFacetsEditor.tsx) session path (no `marks`/`onChange` props) + [`guidanceMarkFacetAccessor`](../../MarkFacetsEditor/markFacetAccessors.ts) in [`GuidanceEditorBody`](../../GuidanceEdit/GuidanceEditor.tsx).

### Controlled / asset-mode

Wire **`FacetListEditorGeneric`** directly with `facets`, `onFacetsChange`, **`association`**, **`requestCreate`**, and optional **`onAssociateReference`**. Example: [`MarkFacetsEditor`](../../MarkFacetsEditor/MarkFacetsEditor.tsx) controlled props used by asset-mode [`SituationEditor`](../../SituationEdit/SituationEditor.tsx) (reuses [`appendMarkFacetIfNew`](../../MarkFacetsEditor/markFacetAccessors.ts)).

`renderFacetRow` returns a layout wrapper (e.g. SingleLineFacetRow) with `payloadSlot={<PayloadEditor ... />}` and `onRemove={handlers.onRemove}`.

## Hybrid: inline referenced-component fields (Lens marks)

When a facet row edits both **referenced component data** (Mark `shortName`) and **facet payload** (Lens mark default) on the same row, split persistence:

- **Mark shortName**: [`MarkInlineEditorWithSession`](../../MarkEdit/InlineEditor.tsx) in the payload slot (per-row Mark session; debounced flush per Mark). See [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md) (inline edit slot persistence).
- **Facet list mutations** (add/remove, payload change): **`FacetListSessionEditor`** -> **`updateComponent`** on parent **`working`** (Lens or Guidance).
- **Mark create / reference / import** (via **`FacetListSessionEditor`** + **`useAddReferenceImport`**):
  - **Create:** `requestCreate` -> **`await materializeComponentInAsset({ universalKey })`**, then **`onAssociateReference`** / **`updateComponent`** on parent facet list.
  - **Reference existing:** **`onAssociateReference`** only (no merged-draft `persistAssociation`).
  - **Import:** **`await materializeComponentInAsset({ universalKey, fromAsset })`**, then associate on parent **`working`** (session branch in [`AddReferenceImportControl.tsx`](../ReferenceList/AddReferenceImportControl.tsx)).
  - Not asset-level **`updateStandard`** on provider screens.

Live example: [`LensMarkFacetPayloadEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetPayloadEditor.tsx) in [`LensMarkFacetsEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx).

Out of scope for v1: Exits, Positions, multi-line wrapper, adapter for collapsed summary. Room non-DEFAULT situations use a bespoke list editor ([`RoomSituationsListEditor`](../../RoomEdit/RoomSituationsListEditor.tsx)), not `FacetListSessionEditor`.
