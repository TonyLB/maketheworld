# Layered Context UI Patterns

**Context**: Features are edited in isolation with breadcrumbs; they have independent meaning. Examples are different—each is meaningful on its own but best viewed in the context of its sibling Examples (like Photoshop layers). We need a **component pattern** that (a) demonstrates that layered/sibling context and (b) allows easy navigation between sibling components.

**Scope**: Reusable pattern for "layer-like" sibling groups. **Room** layered tabs use **Situation** facets (non-DEFAULT) and **Guidance** (`layeredContextUtils`). **Feature** and **Knowledge** do **not** use layered tabs in v1; DEFAULT prose is edited inline on the parent via **`DefaultRenderEditor`**. The **`<Example>`** component and **`ExampleEditor`** were removed (Phase 4, 2026-05-19). Prose uses **Situation** facets and ephemera **`render`** (see [`packages/mtw-wml/ts/AGENT.md`](../../../../../../packages/mtw-wml/ts/AGENT.md)). The pattern should be generic enough to apply elsewhere (e.g. Lenses, Marks) if we add similar sibling-in-context editing.

**Feature/Knowledge (v1, shipped 2026-05-19):** No SituationFacet layered tabs and no non-DEFAULT situation lists. **`DefaultRenderEditor`** on **`FeatureEditor`** / **`KnowledgeEditor`** only. **`layeredContextUtils`** no longer includes **Example** as a layered child tag. Task plan: [`taskPlanning/packages/mtw-wml/standardize/AGENT.featureKnowledgeExamples.planning.md`](../../../../../../taskPlanning/packages/mtw-wml/standardize/AGENT.featureKnowledgeExamples.planning.md).

---

## Proposed Patterns

### 1. **Layer strip + focus panel** (Photoshop-style)

**Layout**  
A compact **layer strip** (vertical list, always visible) lists all sibling items. The main area shows the **focused** item's full editor only.

- **Strip**: Narrow sidebar (e.g. left) or collapsible panel. Each row = one Example (or layer): name, optional 1-line summary, selected state.
- **Focus panel**: Full `ExampleEditor` (or equivalent) for the **current** sibling only.

**Layered context**  
The strip is the persistent "layer stack." You always see **all** siblings; the selected one is clearly highlighted. Optional: small preview (name + truncated summary) per row so you can distinguish layers at a glance.

**Sibling navigation**  
- Click a strip row → focus that layer; panel content switches.  
- Optional: prev/next arrows or keyboard shortcuts (e.g. ↑/↓) to move focus within the strip.

**Pros**  
- Strong "layers" metaphor; familiar to users who know layer panels.  
- Clean focus: one layer in detail, others summarized.  
- Scales to many siblings (scrollable strip).

**Cons**  
- Two-pane layout uses more horizontal space; strip may need collapse on narrow viewports.  
- No inline editing of non-focused layers; you must switch focus to edit.

**Implementation notes**  
- Reuse a list primitive similar to `ReferenceListEditor` for the strip: `items` = siblings, `onItemClick` = set "current" layer (local state or a small `layeredContext` slice).  
- Main area renders the layer editor only when `currentId` matches.  
- Works within existing Workbench: breadcrumbs stay **Asset → Parent** (Room/Feature/Knowledge); the strip+panel live inside RoomEditor/FeatureEditor/KnowledgeEditor as the "Examples" section.

---

### 2. **Stacked layers with sibling index bar**

**Layout**  
Keep siblings **stacked** (e.g. accordions) as today, but add a **sibling index bar** above the stack.

- **Index bar**: Horizontal row of chips (or tab-like pills), one per Example. Each chip shows layer name (or "Example 1", "Example 2" if no name). Current layer highlighted.
- **Stack**: Existing `MakeTheWorldAccordion` + per-Example editor. Only the **current** Example's accordion is expanded; others are collapsed (or show a single-line "peek" in the header via `summary`).

**Layered context**  
The index bar answers "which layer am I on?" and "how many siblings are there?" at a glance. The stack still shows all layers in order; collapsed siblings reinforce "these are the other layers."

**Sibling navigation**  
- Click a chip → scroll to that Example's block and expand it; optionally collapse the previously expanded one.  
- Optional prev/next in the index bar (or keyboard) to move "current" and sync scroll + expansion.

**Pros**  
- Preserves current stacked structure; smaller change.  
- All siblings remain visible (as collapsed blocks), so context is clear.  
- Index bar is compact and works on smaller screens.

**Cons**  
- Less "layer panel" feel than pattern 1.  
- Long lists of siblings can make the index bar crowded (consider wrapping or overflow + scroll).

**Implementation notes**  
- Add a `LayeredContextIndexBar` (or similar) above the Example list: `siblings: { id, label }[]`, `currentId`, `onSelect(id)`.  
- RoomEditor/FeatureEditor/KnowledgeEditor derive sibling list from `component.examples` (for **Feature**/**Knowledge** this is the canonical Examples UX; for **Room** treat as legacy-only sibling editing). ExamplesView tracks `currentExampleId` (local state or slice).  
- Accordions: `expanded` only for `currentExampleId`; `summary` prop can show name/summary when collapsed.  
- Use `scroll-margin` / `scrollIntoView` when selecting a chip so the chosen accordion comes into view.

---

### 3. **Split-pane: layer list + editor**

**Layout**  
Explicit **split**: one pane for the **layer list**, one for the **editor**.

- **List pane**: Always-visible list of siblings (names, order). Can be vertical (left) or horizontal (top) depending on layout. Optionally include reorder handles, "Add layer," etc.
- **Editor pane**: Full editor for the **selected** layer only.

**Layered context**  
The list pane is the dedicated "layers" context. It's always on screen, so you constantly see the full set of siblings and which one is selected.

**Sibling navigation**  
- Click a list item → selection changes; editor pane shows that layer.  
- Optional prev/next in the list or toolbar.  
- If we support reorder, drag-and-drop in the list updates order and maintains selection.

**Pros**  
- Clear separation: "list of layers" vs "editor for this layer."  
- Good fit for "one of N" mental model.  
- List pane can host extra controls (add, remove, reorder) without cluttering the editor.

**Cons**  
- Similar to pattern 1 but with a stronger "two-pane" layout; same tradeoffs around horizontal space and collapse on narrow viewports.

**Implementation notes**  
- Use a resizable split (e.g. MUI `Grid`, or a small split-pane utility) if we adopt this.  
- List pane: `ReferenceListEditor`-style component, or a dedicated `LayeredContextList`, with `onItemClick` to set selection.  
- Editor pane: same as pattern 1—render the layer editor only for the selected id.  
- Works inside RoomEditor/FeatureEditor/KnowledgeEditor (Examples section); breadcrumbs remain Asset → Parent.

---

### 4. **Scrollable horizontal tabs** (MUI Tabs)

**Layout**  
A **top horizontal scrollable row of tabs**, one per sibling (Example). The selected tab is highlighted; the main area below shows **only** the selected layer's editor.

- **Tabs**: MUI [`Tabs`](https://mui.com/material-ui/react-tabs/) + [`Tab`](https://mui.com/material-ui/api/tab/) with `variant="scrollable"` and `scrollButtons="auto"`. Each tab label is the *Example's* label: use `shortName` when present; otherwise fall back to "Example 1", "Example 2", etc. Do **not** use `name` for the Example's tab label (that is the exemplified item's name).
- **Panel**: Single content area showing `ExampleEditor` (or equivalent) for the **current** tab's id only.

**Layered context**  
The tab bar is the persistent "layer stack." You always see **all** siblings in order; the selected tab is visually distinct (MUI's default indicator + selected styling). Overflowing tabs scroll horizontally (desktop: optional scroll buttons; mobile: swipe).

**Sibling navigation**  
- Click a tab → switch selection; panel content updates.  
- Keyboard: MUI Tabs implements arrow-key navigation between tabs by default.  
- `value` + `onChange` drive which layer is "current."

**Pros**  
- **Off-the-shelf**: MUI Tabs give scrollable tabs, selected highlight, keyboard nav, and aria wiring with no custom UI.  
- Familiar tab metaphor; compact horizontal strip.  
- `scrollButtons="auto"` shows left/right arrows only when needed; `scrollButtons={false}` uses native scroll (e.g. swipe).  

**Cons**  
- Tab bar can feel crowded with many siblings (same as index bar); scrollable design mitigates this.  
- Only one panel visible at a time (no stacked peek like pattern 2).

**Implementation notes**  
- Use `@mui/material` `Tabs` and `Tab` (already in the project), wrapped in a `LayeredTabs` helper under `Workbench/foundations/LayeredContext`.  
- `variant="scrollable"` — horizontal scroll when tabs overflow.  
- `scrollButtons="auto"` — show scroll buttons on desktop when needed; hide on mobile. Use `scrollButtons={true}` + `allowScrollButtonsMobile` if you want arrows on mobile too.  
- `value` = current Example id; `onChange` updates local state within the Examples view (or a `layeredContext` slice keyed by parent id).  
- Render one `ExampleEditor` for the active tab's id; no need for accordions.  
- Works inside `ExamplesView`, which is selected from the main workbench router when the mode is in the Examples (component-layer) state.

**Minimal code sketch**  
```tsx
import { Tabs, Tab, Box } from '@mui/material'

// siblings: { id: ComponentUUID, label: string }[]
const [currentId, setCurrentId] = useState(siblings[0]?.id ?? null)

<Box>
  <Tabs
    value={currentId ?? false}
    onChange={(_, v) => setCurrentId(v)}
    variant="scrollable"
    scrollButtons="auto"
    aria-label="Example layers"
  >
    {siblings.map(({ id, label }) => (
      <Tab key={id} value={id} label={label || 'Untitled'} />
    ))}
  </Tabs>
  {currentId && <ExampleEditor componentId={currentId} />}
</Box>
```

---

## Comparison

| Pattern | Context | Navigation | Layout change | Best for |
|--------|--------|------------|----------------|----------|
| **1. Layer strip + focus** | Strip = layer stack, always visible | Click strip row; optional prev/next | New strip + single focus panel | Strong layer metaphor, many siblings |
| **2. Stack + index bar** | Index bar + collapsed stack | Click chip → scroll + expand | Add index bar above current stack | Minimal change, keep stacked UX |
| **3. Split-pane** | Dedicated list pane | Click list item; optional reorder | Explicit list + editor split | "One of N" emphasis, list-centric |
| **4. Scrollable horizontal tabs (MUI)** | Tab bar = layer stack; selected highlighted | Click tab; keyboard arrows | Tabs above single panel | Off-the-shelf MUI, familiar tabs |

---

## Recommendation

- **Pattern 4 (scrollable horizontal MUI Tabs)** is a strong default: MUI already provides scrollable tabs, selected highlight, keyboard nav, and aria. One tab per Example; panel below shows the selected editor. No custom index bar or strip—just `Tabs` + `Tab` + `variant="scrollable"` and `scrollButtons="auto"`.  
- **Pattern 2** is the lowest-friction alternative if we prefer to keep the stacked accordions and add a compact index bar above (chips or similar) instead of switching to a tabbed layout.  
- **Pattern 1** is the best long-term "layer" UX if we want a clearer Photoshop-like model and are willing to adopt a strip + focus panel.  
- **Pattern 3** is a good alternative if we prefer a more formal split between "layer list" and "editor" and plan to support reorder/add/remove in the list.

---

## Integration with Workbench

- **Component section vs LayeredContextView**: Example and Guidance can appear in two ways. (1) **Layered context**: navigated from a parent (Room/Feature/Knowledge) so the stack has parent then child; `getLayeredContext` is set, `currentView === 'componentLayer'`, and `LayeredContextView` renders (tabs + editor). (2) **Top-level**: Example or Guidance is the only component on the stack (e.g. navigated to as a top-level asset element); `currentView === 'component'`, and `WorkbenchAssetEditor` renders `ExampleEditor` or `GuidanceEditor` directly in the component section—no tabs, single editor.
- **Breadcrumbs**: When we are in a layered view, breadcrumbs read **Asset → Parent → Child** (e.g. **Asset → Room → Example** or **Asset → Room → Guidance**). The stack uses uniform `kind: 'component'` entries; layered context is derived when the top component is in the second-from-top’s reference list. Clicking the parent crumb exits the layered view. Example/Guidance can also be top-level (stack has only that component); then breadcrumbs are **Asset → Example** (or Guidance) and the component section shows the single editor.  
- **Navigation model**: Redux navigation is a stack of breadcrumb entries (`breadcrumbStack`), all `kind: 'component'`. The asset is implied (currentAssetId); the stack holds component ids. When the top component is a child of the second-from-top’s reference list (examples/guidance), `getLayeredContext` returns context and `currentView === 'componentLayer'`; otherwise `currentView === 'component'`. `currentView`, current component id, and layered layer id are **derived selectors** over this stack.  
- **Examples/Guidance management vs. layered view**: The set of Example/Guidance items is managed via `ReferenceListEditor` under the parent (Room/Feature/Knowledge). Entering the layered view pushes the child’s component id onto the stack (so stack is e.g. [parent, child]); `LayeredContextView` then shows tabs and editor. Switching tabs uses `replaceTopBreadcrumb(childId)`.  
- **Data**: Sibling list for the layered view comes from `component.examples` (or the equivalent reference list). For **Room**, this path is **legacy**; prefer Situation / render for prose (see WML package `AGENT.md`). Use `shortName` for the Example's tab/list label; do **not** use `name` (that is the exemplified item's name). Fall back to "Untitled" when `shortName` is missing.

---

## Payload-only principle

LayeredContext components present **payload editing only**. Add/remove/list management stays at the parent editor (ReferenceListEditor). The Examples flow is the canonical implementation: Room/Feature/Knowledge editors host the Examples ReferenceListEditor (add, delete, click-to-navigate); LayeredContextView hosts LayeredTabs + ExampleEditor or GuidanceEditor (payload fields only, no accordion wrapper, no list-management actions).

---

## ReferenceList vs FacetList: LayeredContext is payload-agnostic

**Does LayeredContext accept a referenceList (or similar) as the payload?** No. LayeredContext accepts:

- **`siblings`**: `{ id, label }[]` — the list of layer ids and labels. In Examples, this is *derived from* the parent's ReferenceList (e.g. `parentComponent.examples.payload`). In Guidance, it would be derived from `parentComponent.guidance` (also a ReferenceList).
- **`currentId`**, **`onChange`**, and **`children`** — the tab content is whatever component you pass (ExampleEditor, GuidanceEditor, etc.).

The **payload** being edited is entirely owned by the child (ExampleEditor, GuidanceEditor). LayeredContext never sees "referenceList" or "FacetList" as the payload — it only sees sibling ids/labels and renders the child for the current id.

**Is LayeredContext general enough to handle a FacetList?** Yes. The *list of layers* (tabs) comes from a ReferenceList on the parent (examples, guidance). The *content* of each layer is the component's payload — for Example that includes marks (a FacetList); for Guidance it is shortName, instructions, and marks (FacetList). The child editor (GuidanceEditor) is what knows about and edits the FacetList. LayeredContext does not need to "handle" FacetList; it is payload-agnostic.

**Guidance today**: Guidance does not currently use a LayeredContext wrapper. When you navigate to a Guidance layer, we render `GuidanceEditor(componentId)` directly (single edit pane). If we added `LayeredGuidanceTabs`, we would derive siblings from `parentComponent.guidance` (ReferenceList) and render `GuidanceEditor(componentId)` as the tab content — the payload (including marks FacetList) would still be edited only in GuidanceEditor. Persistence issues when editing Guidance are therefore unlikely to be caused by LayeredContext not handling FacetList; they point to reducer/selector or state-keying behavior.

---

## Future development: Unlock for editing

The "Unlock for editing" affordance is rendered in ExampleEditor when an Example is inherited but is **unimplemented** (no-op button). To implement it:

- **fetchImportDefaults and Examples**: The `fetchImportDefaults` process has not been carefully thought through in the context of Examples. A conceptual refactor is likely needed: how do we determine the origin asset for an inherited Example so we can import it correctly?
- **Implementation path**: Use `origin={}` data from back-end import-defaults to identify the source asset; use `addImportToDraft` (or equivalent) inside `updateStandard` with `fromAsset` derived from that origin; add the Example to the local asset with proper `_from` so it becomes editable while preserving the import chain.
- **Reference**: Map editor uses "unlock for editing" semantics; that UI is currently the most obfuscated, but the metaphor aligns.

---

## Next steps

1. Choose one pattern (or a hybrid) for Examples.  
2. Implement a small **`LayeredContext*`** component set (e.g. index bar, strip, or split list) and wire it into RoomEditor/FeatureEditor/KnowledgeEditor for the Examples section.  
3. Add sibling navigation (click-to-select, optional prev/next) and ensure accessibility (keyboard, focus management, aria).  
4. Document the pattern in this file and reuse for future "layer-like" sibling groups (e.g. Lenses, Marks) as needed.
