## LensEdit: SingleReference Lens header and detail

### Goals

- **Align with SingleReference semantics**: Treat `Room.lenses` as a 0-or-1 relationship, using the `SingleReference` envelope and avoiding implicit multi-list UI affordances.
- **Split responsibilities**: Move from the current inline `LensEditor` inside Room edit to a 2-layer pattern:
  - **LensHeader**: Compact summary and entry point, living inside Room edit.
  - **LensDetail**: Full-screen-ish editor, navigated-to child of Room with breadcrumb `.. > (Room Name) > (Lens Name)`.
- **Reuse existing foundations**: Continue to use `useWorkbenchAsset`, `StandardForm` update patterns, and existing literal/render/facet editors (`StandardLiteralEditor`, `StandardRenderEditor`, `LensMarkFacetsEditor`, etc.).

### Implementation status

- **Done**
  - **LensHeader** ([LensHeader.tsx](LensHeader.tsx)): Implemented. Handles no-Lens state (Create New, Reference Existing, Import Lens) and Lens-present state (summary with ShortName/description excerpt/marks count, Edit and Delete). Uses `SingleReference.fromValue` / payload for derive; `ComponentSelectorDialog` and `ImportComponentDialog` wired with `tag="Lens"` and Room-specific `addToReferenceList` for import.
  - **Import Lens**: Lens added to `SchemaImportMapping` (mtw-base) and to `ImportComponentDialog` (componentToImportTag, SECTION_ORDER, handleImport); LensHeader opens the dialog and sets the Room's SingleReference after import via `addImport` with a custom `addToReferenceList` descriptor.
  - **Room edit integration**: RoomEditor uses LensHeader in place of LensEditor; `onEditLens` dispatches `pushBreadcrumb` so the workbench navigates to the Lens. WorkbenchAssetEditor routes `StandardLens` to LensDetail.
  - **LensDetail** ([LensDetail.tsx](LensDetail.tsx)): Full editor implemented. Derives lens from `getCurrentComponentId` and `standardForm.byUniversalId`. Provides ShortName (`StandardLiteralEditor`), Mark facets (`LensMarkFacetsEditor`), and Description (`StandardRenderEditor`), with Back button and title (ShortName or fallback). Uses same `updateStandard` mutation style as LensEditor; all callbacks respect `readonly`. "Lens not found" + Back when lens missing. No props; optional `RoomId`/`LensId` for breadcrumb context left for later.
- **Not done (planned)**
  - Deprecation/removal of `LensEditor` now that LensDetail is complete (LensEditor remains in codebase but is no longer used in RoomEditor).
  - "Referenced By" and last-reference deletion behavior (explicitly out of scope; see Orphaned Lens clean-up below).

### Shape overview

- **Directory**: `components/Workbench/LensEdit`
- **Planned components**:
  - `LensHeader`
    - Shown in RoomEdit, inside the Room-level panel stack.
    - Handles presence/absence of a Lens reference via `SingleReference`.
    - When no Lens defined, surfaces:
      - Create New Lens
      - Reference Existing Lens
      - Import Lens
    - When Lens present, shows:
      - ShortName (or fallback label)
      - Small marks summary (e.g. chips or count)
      - Optional description excerpt
      - Buttons/links:
        - Edit (navigates to `LensDetail`)
        - Delete (clears `SingleReference` and may orphan or delete the Lens, depending on strategy).
  - `LensDetail` (implemented)
    - Routed as a nested Workbench view under Room.
    - Breadcrumb: `.. > (Room Name) > (Lens ShortName or Lens ID)` (shell).
    - Fields: Lens ShortName (literal), Lens Mark facet list, Description (StandardRenderEditor). Back button at top.
    - Uses same `updateStandard` mutation style as the existing inline `LensEditor`.

### Data model and SingleReference integration

- **Existing state shape**
  - `Room.lenses` is now a `SingleReference` over `StandardReference` items, which still exposes a list-shaped payload but enforces:
    - 0 or 1 positive ref.
    - At most one negative ref, and cancellation semantics when both match.
  - The existing inline `LensEditor` relies on:
    - `room._payload._lenses` as a `SingleReference` instance.
    - `lensReferences = room.lenses.payload`.
    - `singleLens` computed via `StandardForm.byUniversalId` lookup when `lensCount === 1`.
- **Target usage in LensHeader**
  - Prefer the `SingleReference.value` getter for clarity when feasible:
    - `const lensRef = room.lenses.value` (or equivalent wrapping, depending on where we introduce it).
  - Fallback shape-aware logic if we need to retain payload-centric operations:
    - Treat `payload.length === 0` as "no Lens".
    - Treat `payload.length === 1 && ref > 0` as "one Lens".
    - Handle any other shapes as "unexpected state" (alert in UI plus logging).
  - `LensHeader` should not be responsible for bulk merging or diffing; it issues small, focused updates:
    - "Set value to reference X".
    - "Unset value" (clear).
    - "Convert room.lenses payload into SingleReference.fromValue(...)` style semantics in update blocks.

### LensHeader: behavior and UI states

#### Inputs and dependencies

- **Props (tentative)**
  - `RoomId: ComponentUUID`
  - Optional callbacks for navigation:
    - `onEditLens?(lensId: ComponentUUID): void` (preferred) or
    - Access to a Workbench-level router hook inside the component if consistent with existing patterns.
- **Hooks**
  - `useWorkbenchAsset()`:
    - `standardForm`
    - `updateStandard`
    - `readonly`
  - Look up `room` from `standardForm.byUniversalId[RoomId]` and assert `instanceof StandardRoom`.

#### State: derived and local

- **Derived from standardForm**
  - `room`
  - `singleLensRef` (either via `room.lenses.value` or current `lensReferences` calculation).
  - `singleLensComponent` via `StandardLens` lookup when `singleLensRef` has a universalKey.
- **Local UI state**
  - `lensSelectorOpen: boolean` (for "Reference Existing Lens" flow, reusing `ComponentSelectorDialog`).
  - Optional `importDialogOpen: boolean` or similar if Import becomes more than a simple action.

#### View states

- **No Lens defined**
  - Layout:
    - Probably keep `MakeTheWorldAccordion title="Lens"` to stay consistent with existing Room edit accordion structure.
    - Inside, a list of actions:
      - `Create New Lens` (primary action button).
      - `Reference Existing Lens` (secondary button, uses `ComponentSelectorDialog` with `tag="Lens"`).
      - `Import Lens` (either disabled stub for phase 1 or delegated to existing import path if one exists).
  - Actions:
    - **Create New Lens**
      - Generate new Lens universalKey similar to `createAndAddLens` in `LensEditor`:
        - Use `LensKey`, `uuidv4`, `StandardLens`, `StandardReference`.
      - Mutate `StandardForm`:
        - Add the new `StandardLens` to `byUniversalId`.
        - Set `room._payload._lenses` to a `SingleReference` whose `value` is a positive ref to this Lens.
      - After creation:
        - Option A (minimal): stay on Room edit, header now shows summary with "Edit" button.
        - Option B (more assertive): immediately navigate to `LensDetail` for the new lens via `onEditLens`.
        - For this prototype, prefer Option A for predictability, with a "Go to detail" explicit action.
    - **Reference Existing Lens**
      - Open `ComponentSelectorDialog`:
        - `tag="Lens"`
        - `onSelect` sets the `SingleReference` value to the chosen Lens key.
        - `isExcluded` should ensure we cannot select the already-selected Lens (if any).
    - **Import Lens**
      - Planning only:
        - Likely shares the same shape as "Reference Existing Lens" but with source data coming from outside the current asset.
        - For this iteration, we can document this as a future hook, not implemented.

- **Lens present**
  - Layout:
    - Accordion titled "Lens" with a compact summary card:
      - Primary line:
        - Lens ShortName (literal) or fallback label (e.g. `Lens (no short name)`).
      - Secondary text:
        - Optional description preview:
          - Use a simple plain-text projection from `StandardRender` (similar to `renderTreeToPlainText` helper).
        - Optional marks summary:
          - Count of marks, or a chip-like list of key markers if easy to surface.
    - Actions:
      - **Edit**:
        - Triggers `onEditLens(lensUniversalKey)` to navigate to `LensDetail`.
      - **Delete**:
        - Clears the SingleReference (and possibly deletes the Lens component).
        - Needs explicit behavioral choice (see below).
      - **Reassign / Change** (later):
        - Open selector to swap to a different Lens, without clearing first.
  - Behavioral considerations:
    - **Delete reference vs delete Lens component**
      - Option A: Only clear the reference (leave Lens component in asset).
        - Pros:
          - Fewer destructive side effects.
          - Easier to undo via history/merge flows.
        - Cons:
          - Might accumulate unused Lens components.
      - Option B: If Lens is only referenced from this Room, delete the Lens component as well.
        - Requires a cross-asset reference check.
      - For this prototype plan:
        - Default to Option A: clear the `SingleReference` but leave the Lens intact.
        - Document the future enhancement to add a "Also delete Lens" confirmation path backed by reference-counting.

### LensDetail: behavior and navigation

#### Current implementation: full editor

- **LensDetail** is implemented as a full editor. Rendered when the workbench top component is a `StandardLens` (WorkbenchAssetEditor returns `<LensDetail />` with no props).
- Behavior:
  - Derives `lensId` from `getCurrentComponentId` and resolves `lens` via `standardForm.byUniversalId`; shows "Lens not found." plus Back if missing.
  - Back button calls `navigateViaBreadcrumbIndex(stack.length - 1)` to return to the previous breadcrumb (e.g. Room).
  - Title: lens ShortName or fallback "Lens (no short name)".
  - Editors: `StandardLiteralEditor` (Short Name), `LensMarkFacetsEditor` (marks), `StandardRenderEditor` (Description). All use `updateStandard` with draft mutations; ShortName and Description short-circuit no-op; readonly is respected.
- Optional `RoomId`/`LensId` props for breadcrumb context are left for a later revision; the component currently relies entirely on workbench state.

#### Route and entry points

- **Entry from LensHeader**
  - `LensHeader` calls `onEditLens(lensId)` when the user clicks "Edit".
  - The containing Workbench flow:
    - Maps `onEditLens` to something like `navigateToLensDetail(RoomId, LensId)` using existing navigation primitives.
    - Ensures breadcrumbs awareness: `.. > Room > Lens`.
- **Route shape (conceptual)**
  - Likely something like:
    - `room/:roomId/lens/:lensId`
  - Not part of this planning document to define concretely, but:
    - `LensDetail` should not own routing concerns beyond expecting `RoomId` and `LensId` props.

#### Inputs and dependencies

- **Props (tentative)**
  - `RoomId: ComponentUUID`
  - `LensId: ComponentUUID`
  - Optional `onBack?(): void` to return to Room edit context if not handled globally.
- **Hooks and lookups**
  - Use `useWorkbenchAsset` again for:
    - `standardForm`, `updateStandard`, `readonly`.
  - Derive:
    - `room` via `StandardRoom` lookup for context/breadcrumb label.
    - `lens` via `StandardLens` lookup using `LensId`.
  - If either lookup fails:
    - Present an inline error (`Alert`) with safe fallback navigation.

#### Editing responsibilities

- **ShortName**
  - Use `StandardLiteralEditor`:
    - Value: `lens.shortName ?? new StandardLiteral("")`.
    - `onChange`:
      - Similar to `updateLensShortName` in existing `LensEditor`:
        - Normalize empty values to `undefined`.
        - Short-circuit no-op updates.
      - Wrap in `updateStandard` with `StandardForm` mutation.
- **Mark facets**
  - Use `LensMarkFacetsEditor`:
    - Value: `lens.marks`.
    - `onChange` updates `lens._payload._marks` via `updateStandard`.
    - Maintain existing semantics for lens mark editing.
- **Description (optional)**
  - Use `StandardRenderEditor`:
    - Value: `lens.description ?? new StandardRender([])`.
    - `onChange`:
      - Compare JSON forms to avoid redundant writes.
      - Set to `undefined` when empty.
  - For this prototype, we can:
    - Either include description editing in `LensDetail` (mirroring existing inline editor).
    - Or explicitly scope `LensDetail` to ShortName and marks and leave description for a later revision.
  - Plan assumption:
    - Include description editing in `LensDetail`, since the existing editor already supports it and it aligns with the idea of a "full" editor.

#### Layout and UX

- **Overall layout**
  - Top section:
    - Breadcrumb line (driven by Workbench shell, not `LensDetail` itself).
    - Title: Lens ShortName or fallback label.
  - Main body:
    - ShortName editor.
    - Lens mark facets editor.
    - Description editor.
  - Footer:
    - Back or Close action handled by parent route/shell (not duplicated inside component unless existing patterns expect it).

### Interaction with existing LensEditor

- **Current component**: `RoomEdit/LensEditor.tsx`
  - Inlines:
    - "no Lens" state management.
    - Lens creation, reference addition, mark editing, description editing.
  - Uses `MakeTheWorldAccordion` to present inline within Room edit.
- **Migration strategy**
  - Phase 1 (prototype): **Done.** `LensHeader` and full `LensDetail` are implemented. RoomEditor uses LensHeader; Edit navigates to LensDetail, which provides ShortName, Marks, and Description editing. `LensEditor` remains in the codebase but is no longer rendered from RoomEditor.
  - Phase 2:
    - Deprecate and remove `LensEditor` now that LensHeader plus LensDetail cover all needed behavior.
    - Consolidate any shared helpers (e.g. `renderTreeToPlainText`) into a small utility module under `LensEdit` or a shared `foundations` folder.

### Open questions and future enhancements

- **Import Lens behavior**
  - Reuse the existing `ImportComponentDialog` pattern that is already used by the main asset editor and other import flows.
  - Source options come from filtered `contentHeaders` data (via selectors like `getContentHeadersByZone` / `getComponentsForAsset`) and are presented in an import dialog with tabs (RecentlyVisited / Canon / Library / Personal).
  - `LensHeader` should open an `ImportComponentDialog` (or a Lens-focused wrapper) configured with:
    - `tag="Lens"` once Lens is a supported import type in `SchemaImportMapping` (or the nearest appropriate tag if Lenses share an existing import category).
    - `assetId` of the current workbench asset.
    - `isExcluded` that filters out any Lens already referenced by this Room (consistent with other reference UIs).
    - `onImportSelect(fromAsset, universalKey, tag)` that dispatches the appropriate "import Lens and add to SingleReference" mutation (importing the Lens from `fromAsset` into the current `StandardForm` and then setting `room.lenses` to reference the imported `universalKey`).
  - Conflict handling (IDs, marks, other fields) is delegated to the shared import machinery; LensEdit only needs to wire the selected Lens into the Room’s `SingleReference` after a successful import.
- **Orphaned Lens clean-up**
  - Future enhancement (explicitly out of scope for this plan):
    - Add a `StandardForm`-wide `referencedKeys` style analysis so we can compute reference counts for each `StandardLens`.
    - Use that to power a "Referenced By" display in `LensDetail` (listing Rooms and other components that point at this Lens).
    - When a delete/unlink action in `LensHeader` removes the last reference, offer an option (or default behavior) to delete the Lens content itself.
  - For the first pass, delete in `LensHeader` only unlinks from the Room and does not attempt any automatic Lens deletion.
- **Multiple Room references to a single Lens**
  - The model allows many Rooms pointing at the same Lens.
  - For breadcrumbs and context, we will:
    - Treat `RoomId` as the entry context for `LensDetail`.
    - Accept that a Lens may have multiple contextual parents; the Workbench route determines which one we show in the breadcrumb.

### Implementation notes

- **Type safety and SingleReference getter**
  - If we adopt `room.lenses.value` more broadly, favor a small wrapper helper so call sites do not need to remember payload semantics:
    - Example helper (conceptual): `getSingleReferenceValue(room.lenses)` returning either the `StandardReference` or `undefined`.
  - When mutating:
    - Use factory methods like `SingleReference.fromValue` or the `value` setter to avoid accidentally constructing illegal payload shapes.
- **Read-only handling**
  - Both `LensHeader` and `LensDetail` must respect `readonly`:
    - Disable action buttons.
    - Render editors in disabled mode where applicable.
  - Ensure that navigation to `LensDetail` is still allowed in readonly mode so that users can inspect Lens content even when editing is locked.
