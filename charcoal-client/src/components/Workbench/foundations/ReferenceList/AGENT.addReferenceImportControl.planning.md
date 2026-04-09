# AddReferenceImportControl – planning

**Note:** The old Redux `addImport` thunk was removed from `personalAssets`. Imports use `addImportToDraft` plus `updateStandard` and association (see `AddReferenceImportControl.tsx`). Mentions of `addImport` below are historical; read them as that pattern.

Single shared component for the "Add / Reference existing / Import" pattern used for component references and (where applicable) facets. This doc is an anchoring point for refining the plan and open questions.

---

## Goal

- **One component** that renders the three action rows (Add, Reference existing, Import) and wires the two dialogs (`ComponentSelectorDialog`, `ImportComponentDialog`).
- Call sites pass a **strategy** (or small set of callbacks) that encodes how to update the model; the component owns UI, dialog state, and labels.
- Reduce parallel code in: `ReferenceListEditor`, `LensHeader`, `RoomEditor` (Situations), and **`FacetListEditorGeneric`**. Figuring out how one control can handle both ReferenceList and FacetList structures is an important step at this stage of UI development. **TopLevelEditor is out of scope for now**: its UI (e.g. "Add Component" row with a list of tag options) is sufficiently divergent from the Add/Reference/Import list pattern that we keep parallel code there while migrating the more closely aligned call sites.

---

## Current state: where the pattern appears

| Call site | Data model | Actions shown | Notes |
|-----------|------------|----------------|-------|
| **ReferenceListEditor** | Reference list via `listContext` | Add, Reference, Import (configurable via `ReferenceListAffordance`) | Already uses `ReferenceListEditorGeneric` + builds `actionAffordances` + both dialogs |
| **LensHeader** | Single reference (Room's Lens, `SingleReference`) | Create New, Reference Existing, Import | Same three rows + same dialogs; custom `addToReferenceListForRoom` for import |
| **RoomEditor** (Situations) | Reference list (Situations) via generic | Reference existing, Create new only | No Import; custom `actionAffordances` + manual `ComponentSelectorDialog` |
| **TopLevelEditor** | Top-level component list | Add (with tag picker), Reference, Import | **Out of scope for this refactor.** Divergent UI (card-style, tag picker) justifies parallel code. |
| **FacetListEditorGeneric** | Facet list | Add only (opens selector) | **In scope.** Today "Add" = open selector, add facet referencing selected component; we want one abstraction that supports both reference lists and facet lists. |

Shared elements everywhere: `AddIcon`, `LinkIcon`, `ImportExportIcon`; same two dialogs; same "which actions are enabled" and label conventions.

---

## Proposed abstraction: `AddReferenceImportControl`

### Conceptual model: same endpoint, then association

Create new, Reference existing, and Import are **three paths to the same end-point**: a `StandardReference` addressing a component of the appropriate type.

- **Create new** – create a new component in the draft; its reference is the end-point.
- **Reference existing** – the component already exists in the asset; we already have (or build) its reference.
- **Import** – create an empty component with a `from` field (i.e. import from another asset); that component's reference is the end-point. So Import is effectively "newly created, but with import metadata."

**After** we have that reference, we need a **customized handler** to update StandardForm and **associate** the reference in the right place: into a ReferenceList, a FacetList, a SingleReference slot (e.g. Room's Lens), or other structures. The strategy can therefore be thought of as: (1) how to obtain the reference for each path, and (2) how to associate that reference once we have it.

This aligns with the current code: e.g. in `ReferenceListEditor`, all three handlers end up calling `setReferenceList(refList.assureItem(reference))` with a `StandardReference`; the only difference is how that reference is produced. In `addImport`, the same pattern holds: the thunk creates/updates the component (with import), then uses `addToReferenceList(draft)` to get the association descriptor and pushes the component's reference into it.

### Reference existing and Import: generic functionality

We **already have** partial strategy frameworks for obtaining the reference for two of the three paths:

- **Reference existing**: `ComponentSelectorDialog` is generic. We need `tag` (to filter) and `isExcluded` (already planned). The dialog returns `universalKey`; building `StandardReference({ universalKey, tag })` is the same everywhere. So there is no need for a distinct per-call-site *strategy* for obtaining the ref—only the right filter config and, after selection, **association** of that ref.

- **Import**: Similarly, `ImportComponentDialog` plus `addImport` are generic. The dialog gives us `(fromAsset, uuid, tag)`; we have `assetId` from context. `addImport` takes `addToReferenceList(draft)` to know *where* to put the imported component's reference. So again, the only per-call-site piece is **association** (the descriptor or equivalent), not a custom "how to obtain" strategy.

So for Reference existing and Import, **generic functionality applies across the board**. The control opens the right dialog with `tag` and `isExcluded`; on result, either build `StandardReference` and call **associate** (Reference existing), or call `addImport(..., addToReferenceList)` where `addToReferenceList` is the association (Import). We do not need a distinct strategy type for those two paths—we need **tag**, **isExcluded**, and **association** (and for Import, whether it's enabled and optional `importTag`). The only path that needs call-site-specific behavior is **Create new** (see below).

### Create new: delegate to a creating pattern that calls back with the reference

`onCreateNew` as a name suggests the callback itself is responsible for "creating and adding" end-to-end. We want the opposite: the **control** owns **association** (same as for Reference existing and Import). What the call site supplies is a way to **refer** the control to a **creating pattern** that, when run, eventually **returns** the new `StandardReference` via a callback the control provides. So the control says: "When the user clicks Create new, run the creating pattern; when it has a new reference, call `onCreated(ref)` and I will associate it."

The creating pattern is delegated to the call site and can do anything that ends in "call back with the new ref":

- **Simple (reference list / single ref)**: Create component in draft (e.g. `standardComponentFactory(tag, uuid)` or `new StandardLens(...)`), then call `onCreated(ref)` synchronously. The control then runs **association(ref, context)**.
- **Situation facets**: The creating pattern might create a new Situation **and navigate to its edit page**, then (e.g. when the user returns or when the editor mounts) call `onCreated(ref)` with the new Situation's reference. So "create" is create + navigate; the control still only runs **association(ref, context)** when it receives the ref.
- **Mark facets**: The creating pattern might **raise a dialog** where the user specifies the Mark's shortName inline, create a Mark with that name, then call `onCreated(ref)` with the new Mark's reference. Again the control just runs **association(ref, context)** once it has the ref.

So the API is: call site supplies something like **requestCreate**(**onCreated**: `(ref: StandardReference) => void`). When the user clicks "Create new", the control invokes `requestCreate(ref => association(ref, context))`. The creating pattern (whatever UX it uses—inline create, navigate-to-editor, dialog) is responsible for eventually calling `onCreated(ref)` with the new reference; the control does not "add" the reference itself—it only runs **association(ref, context)** when the creating pattern returns the ref. Naming that avoids implying the callback does association: e.g. **requestCreate**(**onCreated**) or **createNew**(**onCreated**).

- **Renders**: The list of action rows (Add, Reference existing, Import) with configurable visibility and labels.
- **Owns**: Open/close state for `ComponentSelectorDialog` and `ImportComponentDialog`; renders both dialogs; wires Reference existing and Import via tag + isExcluded + association (generic).
- **Accepts**: For **Reference existing** and **Import** we do not need a distinct strategy—generic functionality applies (see subsection below). Call site supplies **tag**, **isExcluded**, and **association**(ref, context) with `context = { updateStandard, addImport }`; for Import we keep **addImport**'s current signature so the call site also supplies **addToReferenceList**(draft) when Import is enabled. For **Create new**, call site supplies **requestCreate**(**onCreated**). When the user clicks Create new, the control calls `requestCreate(ref => association(ref, context))`; the creating pattern runs its UX and eventually calls `onCreated(ref)` so the control can call **association(ref, context)**. Optional **importTag**; **enableReferenceExisting** / **enableImport** / **disabled**; **labels**.

Ways to supply **association** (and optionally **Create new**); Reference existing and Import use the same generic dialogs in all cases:

1. **Reference list** – association(ref, context) uses `context.updateStandard` with an update that gets `listContext(draft)` and does `setReferenceList(refList.assureItem(ref))`; Create new = `requestCreate(onCreated)` (creating pattern creates in draft, calls `onCreated(ref)`); Import = control calls `addImport(..., addToReferenceList: (draft) => listContext(draft))` (unchanged signature).
2. **Single reference** (e.g. Room lens) – association(ref, context) uses `context.updateStandard` to set the room's `_lens = SingleReference.fromValue(ref)`; Create new = `requestCreate(onCreated)` (e.g. create `StandardLens`, call `onCreated(ref)`); Import = `addImport(..., addToReferenceList: addToReferenceListForRoom)` (unchanged).
3. **Custom** (e.g. Situations) – association(ref, context) as needed; Create new = `requestCreate(onCreated)` (e.g. create Situation and navigate, then call `onCreated(ref)`); Import can be disabled.
4. **Facet list** – Facet lists are stored in the parent component (in the draft), just as reference lists are, so they are inherently connected with StandardForm rather than any other React/Redux state. association(ref, context) uses `context.updateStandard` to mutate the draft and add a facet for ref to the parent's facet list (e.g. Lens marks, Situation facets). Create new = `requestCreate(onCreated)` (dialog or navigate, then `onCreated(ref)`); Import optional per facet type. Same abstraction as reference lists.

---

## Props / API (draft)

Because Reference existing and Import are generic (dialog + tag + isExcluded + association), the API can center on **association** and **Create new**, not separate strategy types per path.

- `tag`: ComponentTag (for selector and default import). Used by both dialogs for filtering.
- `isExcluded`: `(universalKey: ComponentUUID) => boolean` for both dialogs.
- **Association**: `(ref: StandardReference, context: { updateStandard, addImport }) => void`. The call site supplies a single function that, given a reference and the tools to mutate state, associates that ref in the right place. We do **not** assume association runs purely inside an `updateStandard` draft; it can use `context.updateStandard` (e.g. dispatch an update that mutates the draft to add ref to a list or set a single ref), or use `context.addImport` if the association logic ever needs to trigger an import. So the various patterns (reference list, single ref, facet list) are just different functions created at the call site and passed to the control. For **Reference existing** and **Create new**, the control has the ref and calls `association(ref, context)`.

  **Import path**: We do **not** change the `addImport` signature. So for Import, the control still calls `addImport(assetId, fromAsset, uuid, tag, addToReferenceList)` with the existing `addToReferenceList: (draft) => ReferenceListDescriptor | null` shape. The call site provides `addToReferenceList` separately (e.g. derived from the same "where to put ref" idea—e.g. `(draft) => listContext(draft)`). So today we have two call-site supplies for "where the ref goes": **association(ref, context)** for Reference existing and Create new, and **addToReferenceList(draft)** for Import. A future refactor could unify these (e.g. addImport could accept association), but we are not committing to that.

- **Create new**: call site supplies **requestCreate**(**onCreated**: `(ref: StandardReference) => void`). The control invokes `requestCreate(ref => association(ref, context))` when the user clicks "Create new". The creating pattern runs its UX and eventually calls `onCreated(ref)`; the control then calls **association(ref, context)**. No naming that implies the callback does association (avoid `onCreateNew`).
- `labels`: `{ add?: string, referenceExisting?: string, import?: string }` (defaults: "Add {tag}", "Reference existing {tag}", "Import").
- `enableReferenceExisting` / `enableImport` / `disabled`; optional `importTag` when import tag differs from `tag`.
- No `variant` for card-style in scope; control is list-only (TopLevelEditor keeps its own UI).

Open: whether the control also needs `assetId` (for `addImport` / `ImportComponentDialog`) or gets it from context (e.g. `useWorkbenchAsset()`).

---

## Call sites to migrate (priority)

1. **ReferenceListEditor** – Replace inline action rows + dialog wiring with `<AddReferenceImportControl strategy={referenceListStrategy} ... />` and pass the returned node as `actionAffordances` (or have the control render inside the generic's slot). Keeps `ReferenceListAffordance` for labels/enable flags.
2. **LensHeader** – Replace the three `ListItemButton`s and both dialogs with `<AddReferenceImportControl strategy={singleReferenceStrategy} tag="Lens" ... />` in the empty state.
3. **RoomEditor** (Situations) – Replace custom `actionAffordances` + `ComponentSelectorDialog` with `<AddReferenceImportControl strategy={customStrategy} enableImport={false} ... />`.
4. **FacetListEditorGeneric** – Replace the single "Add" row + `ComponentSelectorDialog` with the control using a facet-list strategy (Add = reference existing; Create new and Import optional depending on facet type). Keeps one abstraction for both reference lists and facet lists.

**Not in scope:** TopLevelEditor – keep its current implementation; no migration to AddReferenceImportControl planned for now.

---

## Open questions

- **Strategy shape**: Single union type vs separate props (`listContext` vs `requestCreate`/association) for different modes. Union keeps one clear "mode" per use and makes it obvious which capabilities are present.
- **Where does the control live?** Same file as `ReferenceListEditor`? New file `AddReferenceImportControl.tsx` in `foundations/ReferenceList/` (or `foundations/`)?
- **AssetId / workbench context**: Should the control call `useWorkbenchAsset()` and `useDispatch()` internally for `addImport` and assetId, or receive them via strategy/props? Internal keeps call sites simpler; injecting can help testing and reuse outside Workbench.
- **Import tag vs tag**: For Lens we use `tag="Lens"` for the selector and for import. Some lists use a list tag (e.g. Guidance) that might differ from the importable schema tag. Allow `importTag?: ComponentTag` override?
- **(Resolved)** **Facet list strategy**: Facet lists are stored in the parent (in the draft), like reference lists, so they are inherently tied to StandardForm. association(ref, context) for facets uses `context.updateStandard` to add a facet to the parent's list in the draft. We expose "Reference existing" (selector → add facet via association), and optionally "Create new" and Import per facet type. Same abstraction as reference lists; no separate React/Redux association.
- **(Resolved for now)** TopLevelEditor: not in scope; divergent UI justifies parallel code. Revisit only if we later want to unify the pattern there.

---

## Implementation notes (for when we build it)

- **Association** is `(ref, context) => void` with `context = { updateStandard, addImport }`; used for Reference existing and Create new. Call sites implement it by e.g. calling `context.updateStandard` with an update that mutates the draft to add the ref. We do not assume it runs purely inside a draft; the function chooses how to use context.
- **Import**: Keep `addImport` signature unchanged. The control calls `addImport(assetId, fromAsset, uuid, tag, addToReferenceList)`; the call site supplies `addToReferenceList(draft) => ReferenceListDescriptor | null` (e.g. from `listContext`). So we have two supplies for "where the ref goes"—association for Ref/Create new, addToReferenceList for Import—without changing personalAssets.
- Reuse `ComponentSelectorDialog` and `ImportComponentDialog` as-is; the control only owns their open state and passes the right props.
- Keep `ReferenceListAffordance` (or fold its fields into the control's `labels` and `enable*` props) so existing `ReferenceListEditor` callers do not need to change much.
- A small **hook** `useAddReferenceImport(strategy, options)` is optional: useful if we ever want to reuse dialog state/handlers in a custom layout without the control's list UI (e.g. for future TopLevel or other variants).
