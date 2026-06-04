# Workbench facet list pattern

Facet lists in the Workbench (WML facet lists such as `marks` on Guidance) are rendered as accordion lists with per-row payload editing. The pattern uses **handlers** for affordances (onRemove, onChangePayload), not injected components, so the payload editor (or a layout wrapper) can render and place affordances for full UI control.

Reference lists use the parallel **`ReferenceListControlled`** shell (`referenceList` + `onReferenceListChange`); see [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md).

## Structure

- **FacetListEditorGeneric**: Owns the list and the add flow via **`useAddReferenceImport`** ([AddReferenceImportControl.tsx](../ReferenceList/AddReferenceImportControl.tsx)): Create new, Reference existing, and optional Import. The consumer supplies **`association(ref, draft)`** and **`requestCreate(onCreated)`** so new references are written into the correct facet list on `StandardForm`. For each facet, the generic calls `renderFacetRow(facet, index, handlers)`. Handlers are `onRemove`, `onChangePayload`, `readonly`. The generic does not own row layout; the consumer supplies the row renderer.
- **Layout wrappers** (e.g. SingleLineFacetRow): Receive a payload slot (ReactNode) and affordance handlers (e.g. onRemove). Their job is to place affordances in a fixed pattern (e.g. single line: payload slot | remove) while remaining agnostic to what the payload slot contains. Wrappers render affordance UI (e.g. remove button) using shared primitives and the passed handlers.
- **Affordance primitives**: Small components (e.g. FacetListAffordance.Remove) that render a single affordance and call the passed handler. Used by wrappers so remove look/behavior is consistent; wrappers control placement.
- **Payload editor**: Renders only the payload content (e.g. reference label + Match field for Mark facets). No remove, no row border; just the content that goes inside the wrapper's payload slot.

## Usage

Consumer (e.g. MarkFacetsEditor) wires FacetListEditorGeneric with:

- `facets`, `onFacetsChange`, `createFacetWithPayload`, `tag`, `renderFacetRow`, `readonly`, `isExcluded`, **`association`**, **`requestCreate`**, optional **`onAssociateReference`** (session path; skips merged-draft `persistAssociation`), optional **`affordance`** (labels and enable flags for reference/import rows).
- `renderFacetRow` returns a layout wrapper (e.g. SingleLineFacetRow) with `payloadSlot={<PayloadEditor facet={...} onChange={handlers.onChangePayload} readonly={handlers.readonly} />}` and `onRemove={handlers.onRemove}`.

## Hybrid: inline referenced-component fields (Lens marks)

When a facet row edits both **referenced component data** (Mark `shortName`) and **facet payload** (Lens mark default) on the same row, split persistence:

- **Mark shortName**: [`MarkInlineEditorWithSession`](../../MarkEdit/InlineEditor.tsx) in the payload slot (per-row Mark session; debounced flush per Mark). See [AGENT.reference-lists.md](../ReferenceList/AGENT.reference-lists.md) (inline edit slot persistence).
- **Facet list mutations** (add/remove, payload change): parent **`onFacetsChange`** wired to **`updateComponent`** on Lens **`working`** when [`LensDetail`](../../LensEdit/LensDetail.tsx) provides a session.
- **Mark create/associate**: [`LensMarkFacetsEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx) uses **`materializeComponentInAsset`** + **`onAssociateReference`** -> parent **`onChange`** / **`updateComponent`** (via optional **`onAssociateReference`** on [`FacetListEditorGeneric`](FacetListEditorGeneric.tsx)); not asset-level **`updateStandard`** on the session path.

Live example: [`LensMarkFacetPayloadEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetPayloadEditor.tsx) in [`LensMarkFacetsEditor`](../../LensEdit/LensMarkFacetsEditor/LensMarkFacetsEditor.tsx).

Out of scope for v1: Exits, Positions, multi-line wrapper, adapter for collapsed summary.
