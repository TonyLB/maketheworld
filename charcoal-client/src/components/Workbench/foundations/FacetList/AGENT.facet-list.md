# Workbench facet list pattern

Facet lists in the Workbench (WML facet lists such as `marks` on Guidance) are rendered as accordion lists with add (component selector) and per-row payload editing. The pattern uses **handlers** for affordances (onRemove, onChangePayload), not injected components, so the payload editor (or a layout wrapper) can render and place affordances for full UI control.

## Structure

- **FacetListEditorGeneric**: Owns the list, add flow (opens ComponentSelectorDialog), and for each facet calls `renderFacetRow(facet, index, handlers)`. Handlers are `onRemove`, `onChangePayload`, `readonly`. The generic does not own row layout; the consumer supplies the row renderer.
- **Layout wrappers** (e.g. SingleLineFacetRow): Receive a payload slot (ReactNode) and affordance handlers (e.g. onRemove). Their job is to place affordances in a fixed pattern (e.g. single line: payload slot | remove) while remaining agnostic to what the payload slot contains. Wrappers render affordance UI (e.g. remove button) using shared primitives and the passed handlers.
- **Affordance primitives**: Small components (e.g. FacetListAffordance.Remove) that render a single affordance and call the passed handler. Used by wrappers so remove look/behavior is consistent; wrappers control placement.
- **Payload editor**: Renders only the payload content (e.g. reference label + Match field for Mark facets). No remove, no row border; just the content that goes inside the wrapper’s payload slot.

## Usage

Consumer (e.g. MarkFacetsEditor) wires FacetListEditorGeneric with:

- `facets`, `onFacetsChange`, `createEmptyFacet`, `createFacetWithPayload`, `tag`, `renderFacetRow`, `readonly`, `isExcluded`, etc.
- `renderFacetRow` returns a layout wrapper (e.g. SingleLineFacetRow) with `payloadSlot={<PayloadEditor facet={...} onChange={handlers.onChangePayload} readonly={handlers.readonly} />}` and `onRemove={handlers.onRemove}`.

Out of scope for v1: Exits, Positions, multi-line wrapper, adapter for collapsed summary.
