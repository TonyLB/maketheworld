# Room LensEditor refactor – planning

## Purpose

This document sketches a **high-level refactor plan** for the Workbench `LensEditor` used in the Room editor. The goal is to:

- Make Lens editing semantics clearer and more composable.
- Introduce **Lens Mark defaults** (per-Lens default values for Marks) without locking in the wrong UI pattern.
- Align Lens editing with existing **Guidance** and **facet** editing patterns where that makes sense, and diverge where it does not.

This file is intentionally **pre-plan**: we expect to revise it together before converting it into a formal implementation plan.

## Current state – Room + Lens editing

- **Entry point**: `RoomEditor` renders `LensEditor` inside the Room form.
- **Lens cardinality**:
  - Zero lenses: accordion shows **Add Lens** / **Reference existing Lens** actions.
  - One lens: accordion shows a **single Lens editor** with:
    - `shortName` editor (`StandardLiteralEditor`).
    - `Marks` list using `InlineReferenceList` + `MarkInlineEditor` (shortName only).
    - `Description` editor (`StandardRenderEditor`).
  - Multiple lenses: warning state; list of lenses with summary text and delete affordance, but no full editing.
- **Data model**:
  - `StandardRoom` holds a `ReferenceList` of Lens references.
  - `StandardLens` (from `worldState.ts`) holds:
    - `shortName?: StandardLiteral`
    - `description?: StandardRender`
    - `marks: LensMarkFacetList` (homogeneous lens-mark facets)
  - `LensMarkFacetList` stores `StandardLensMarkFacet` with `LensMarkFacetPayload`:
    - Payload currently supports an optional `default: StandardLiteral` (Lens-specific default for that Mark).

Today, the Workbench only exposes **Lens → Marks as references**, not the Lens Mark **facet payload** (`default`), and `LensEditor` currently has TypeScript errors where it still treats `_marks` as a plain `ReferenceList` (see the write at `LensEditor.tsx:264-265`), i.e. it is not yet aligned with the updated `StandardLens` facet-list pattern.

## Related patterns – Guidance and facet editors

### Guidance + Mark facets

- **GuidanceEditor**:
  - Edits simple fields on `StandardGuidance` (`shortName`, `instructions`).
  - Uses `MarkFacetsEditor` to edit **Mark facets and their payloads** directly on the Guidance component.
- **MarkFacetsEditor**:
  - Built on top of `FacetListEditorGeneric`.
  - Owns a **facet-first** UX:
    - Facet list items come from a `MarkFacetList`.
    - Each row has a `MarkFacetPayloadEditor` in the payload slot.
    - Add / remove semantics operate on the facet list itself.
- Conceptually, Guidance and Lens are the **same pattern** here: each owns a homogeneous list of Mark facets whose **payload is the main thing you are editing** (match values for Guidance, defaults for Lens). The real design question is not whether Lens marks are “facet-first,” but whether the Lens UI should surface those facets with an explicit facet editor (like `MarkFacetsEditor`) or keep the current reference-list–flavored wrapper (`InlineReferenceList`) while still treating the Lens Mark facet payload as the source of truth.

### Situation facet payload editor

- `SituationFacetPayloadEditor` is layered-context based:
  - Room → Situation facet is chosen by the breadcrumb stack.
  - Editor finds the right facet (`room.situations.items.find`).
  - Payload is edited through a focused editor (`SituationRoomFacetPayload`) and written back as a new facet instance.
- This reinforces the idea that **facet payloads are first-class** and edited via explicit helpers that replace the facet in its list.

## Lens Mark defaults – conceptual intent

From `AGENT.rendering.md` and `lensMark.ts`:

- A **Lens** can specify **Marks with Defaults**:
  - Each `Mark` facet on the Lens can carry a `<Default>` literal.
  - The default is **scoped to the Lens**: it represents the Mark’s default value when viewing world state through this Lens.
- The default is:
  - Conceptually **payload on the Lens → Mark relationship**, not an intrinsic property of the Mark itself.
  - Simple (single literal) but still part of the **facet algebra** (merge, diff, invert, render).

This pushes us toward treating the **Lens Mark list as facets**, not just references, while still respecting the “Lens owns a list of Marks” mental model in the Room editor.

## UI pattern options for Lens Marks

We have two primary patterns available; the data model now clearly favors the **facet-first** approach.

### Option A – Prior reference-list behavior (pre-defaults)

This describes the **old implementation shape before Lens Mark defaults existed**, not something we want to extend or generalize to the new facet-based data model.

- **What it did before defaults**:
  - Treated Lens → Marks purely as a **reference list** stored in the WML schema.
  - Used `InlineReferenceList` for add/remove Marks and navigation to full Mark editors.
  - The inline editor slot only showed the Mark shortName (via `MarkInlineEditor`); there was no facet payload.
- **Why it no longer fits**:
  - The schema now models Lens → Marks as a `LensMarkFacetList` with `LensMarkFacetPayload.default`, not as a bare `ReferenceList`.
  - Continuing to pretend this is a reference list would make facet semantics **implicit and fragile**: the list would look like references while writes would silently depend on facet algebra.
  - The current TypeScript issues in `LensEditor` (for example `_marks` still treated as `ReferenceList`) are symptoms of this mismatch.
- **How it informs the refactor**:
  - It explains the legacy UI and data shape we are moving away from.
  - It is **not** a candidate pattern for editing Lens Mark defaults; the canonical direction for the new shape is the facet-first approach in Option B.

### Option B – Adopt a facet-first list for Lens Marks (proposed direction, canonical for facets)

- Replace the existing Marks list in `LensEditor` with a **FacetListEditorGeneric-based** UI:
  - Similar to `MarkFacetsEditor`, but over `LensMarkFacetList` instead of `MarkFacetList`.
  - Rows are explicitly facet rows, with payload slots dedicated to editing `default` values.
- Add a `LensMarkFacetsEditor` abstraction:
  - Takes `LensMarkFacetList` and emits updated lists.
  - Uses a payload editor component that knows about the Lens context and default semantics.
- Preserve key affordances from the current UI:
  - Keep add/remove of Lens Mark facets simple and prominent.
  - Provide a clear way to **navigate to the full Mark editor** from each row (e.g. dedicated icon/button or gap-region).
- Pros:
  - Makes the facet nature of **Lens → Mark relationships** explicit and consistent with Guidance and Situation facet editors.
  - Fully aligned with the updated `StandardLens` data model (`LensMarkFacetList` + `LensMarkFacetPayload`).
  - Reuses existing facet infrastructure (including merge/diff/invert semantics) instead of re-implementing it around a reference list.
  - Reinforces a **single canonical pattern** for facet-list editing (`FacetListEditorGeneric`-based), instead of introducing a second, ad-hoc pattern that inlines facet payload editing into `InlineReferenceList`.
- Cons / considerations:
  - Slightly heavier-feeling UI inside an already-busy Room editor; we should design the row layout to stay compact.
  - Requires reworking the single-Lens branch of `LensEditor` rather than a purely incremental tweak.

In particular, we **do not** want to establish "facet payload editor in a `ReferenceList` row" as a new reusable pattern. The intent is that any homogeneous facet list (including Lens Marks) is ultimately edited through a FacetList-style editor; any use of `InlineReferenceList` for Lens Marks in early iterations is treated as a temporary compatibility bridge, not a model for future facet UX.

## Scope for first iteration (implementation)

This first implementation pass adopts the **facet-first approach (Option B)**. We do not jury-rig a default editor into the old ReferenceList-based UI; we transition the Lens Marks section to the canonical FacetList pattern.

- **Replace the Marks section with a facet-first list** in the single-Lens branch:
  - Introduce a `LensMarkFacetsEditor` (or equivalent) built on `FacetListEditorGeneric`, over `LensMarkFacetList`, consistent with Guidance and Situation facet editors.
  - Remove the existing `InlineReferenceList`-based Marks UI from the single-Lens branch; the list is edited as a facet list, not as a reference list.
- **One-dimensional default editing within the facet list**:
  - Each facet row has a payload slot that edits `LensMarkFacetPayload.default` only (single-line text field; no multi-line or rich literal for now).
  - Add/remove and navigation to the full Mark editor remain clear affordances from each row.
- **Data and types**:
  - `LensEditor` consumes and updates `LensMarkFacetList` directly; no `ReferenceList` typing or mapping. Merge/diff/invert stay in the facet classes; the editor replaces facets with updated payloads.
- **Constrain behavior to the single-Lens case**:
  - Show the facet-list Marks editor only when there is exactly one Lens.
  - Leave the multiple-Lens warning behavior unchanged for now.

This delivers a working **Lens Mark defaults editor** that matches our chosen pattern and does not create a second, inline-ReferenceList facet-editing path. Broader Room/Lens/Situation UX (modes, SITUATION#DEFAULT, etc.) remains planned future work.

## Planned future directions (not in this iteration)

These items are explicitly **out of scope for the first implementation**, but are part of the longer-term design the current work should not preclude.

- **Room modes: simple vs complex vs lens-editing**:
  - Treat Rooms as either:
    - "Simple": no Lens; the Room directly exposes display name, summary, and description.
    - "Complex": a Lens is present; the Room view focuses on Lens-driven dynamic rendering (Guidance + Situations).
    - "Lens-editing": a dedicated mode where editing the Lens (marks, defaults, description) temporarily takes over the Room editor.
- **Simple Rooms and `SITUATION#DEFAULT`**:
  - For simple Rooms (no Lens), the UI should allow direct editing of display name, summary, and description.
  - Behind the scenes, those fields are stored via a Situation facet on a well-known `SITUATION#DEFAULT` component in the primitives asset: a Situation with no marks that describes the default state.
  - This keeps "description lives in Situations" as the consistent story, even when no Lens is present.
- **Transition affordance: "Add dynamic rendering"**:
  - Provide a clear affordance (for example "Add dynamic rendering") that:
    - Switches the Room from simple mode into the lens-editing mode.
    - Shifts UI focus to "Specify the Lens" while temporarily de-emphasizing the existing description (summarized, read-only).
- **Lens-editing focus, then back to rich Room editing**:
  - In lens-editing mode, the main task is to choose/configure the Lens (including Lens Mark defaults and Lens description).
  - Once the Lens is complete, the UI:
    - Pushes the Lens panel into a summarized, non-editing state with an affordance to "Edit Lens" again.
    - Promotes the richer Room editing tools: Guidance, multiple Situations, and mark-driven behavior.
- **Single-option Lens reference pattern in WML**:
  - Longer term, we expect to introduce a "single-option reference" pattern in the WML layer, so that "Room has one Lens" is modeled directly rather than as a degenerate reference list.
  - That work will need careful handling of merge and diff semantics and should be planned separately.
- **Cross-Lens Situation semantics**:
  - Situations should be able to describe room state in a way that works across different Lenses:
    - When applying a Situation, use only the marks that intersect with the current Lens.
    - Treat non-overlapping Situation marks as locally irrelevant.
    - Default any Lens marks the Situation does not mention, using the Lens Mark defaults.
  - This decouples Situations from any specific Lens while still allowing Lens-specific defaults to matter.

## Open questions and points to discuss

These are intentionally unresolved and should be revisited before we move to a formal plan (beyond the first iteration described above):

- **Facet-first vs reference-first (RESOLVED for first iteration)**:
  - First iteration uses the facet-first pattern (`LensMarkFacetsEditor`). Longer-term UI may still evolve (e.g. layout density, lens-editing mode) but we are not keeping a reference-list-like presentation for Lens Marks.
- **Default editor shape (RESOLVED)**:
  - For the first iteration, a single-line text field is sufficient. Defaults are expected to be short labels (for example, `dark` in an `Illumination` Mark), so we do not need multi-line or rich literal editing here.
- **Navigation and layering**:
  - Should Lens Mark defaults stay strictly in the Room editor’s Lens section, or do we eventually want a Lens-specific layered-context view (similar to Examples / Guidance / Situation facet payloads)?
- **Multiple lenses**:
  - Today multiple Lenses show a warning and no full editing. When we revisit this, should the facet editing approach change (e.g. a facet-first list per Lens, or a layered context across Lenses)?

---

## Tactical implementation plan (first iteration)

The following is an executable, step-by-step plan for the first iteration. It assumes the context above (Option B, facet-first; future Room modes and SITUATION#DEFAULT are out of scope).

### 1. Add `LensMarkFacetPayloadEditor` component

- **Location**: New file under `charcoal-client/src/components/Workbench/` (e.g. `LensMarkFacetsEditor/LensMarkFacetPayloadEditor.tsx`, or colocated with a new `LensMarkFacetsEditor` folder).
- **Responsibility**: Edit only `LensMarkFacetPayload.default` (single-line text). Input: facet (`StandardLensMarkFacet`), `onChange: (payload: LensMarkFacetPayload) => void`, `readonly`. Use the facet’s payload `.default` (e.g. `facet.payload.default?.toJSON()` for display) and on change build a new `LensMarkFacetPayload` and call `onChange`.
- **Reference display**: Accept an optional `referenceDisplayName` (Mark shortName) for the row label; can be resolved from `standardForm` in the parent.

### 2. Add `LensMarkFacetsEditor` component

- **Location**: New file(s) in same area as `MarkFacetsEditor` (e.g. `LensMarkFacetsEditor/LensMarkFacetsEditor.tsx`).
- **Pattern**: Mirror `MarkFacetsEditor` but for `LensMarkFacetList` and `StandardLensMarkFacet`:
  - Props: `marks: LensMarkFacetList`, `onChange: (marks: LensMarkFacetList) => void`, `readonly?`.
  - Use `FacetListEditorGeneric<StandardLensMarkFacet>` with:
    - `facets={marks.items}`
    - `onFacetsChange={(newItems) => onChange?.(new LensMarkFacetList(newItems))}`
    - `createEmptyFacet={(universalKey) => new StandardLensMarkFacet({ reference: new StandardReference({ tag: "Mark", universalKey }), payload: new LensMarkFacetPayload({}) })}`
    - `createFacetWithPayload={(facet, newPayload) => new StandardLensMarkFacet({ reference: facet.reference, payload: newPayload as LensMarkFacetPayload })}`
    - `tag="Mark"`
    - `renderFacetRow`: use `SingleLineFacetRow` (or equivalent) with payload slot = `LensMarkFacetPayloadEditor`, plus a clear affordance to navigate to the full Mark (e.g. link/button that dispatches `pushBreadcrumb` with the Mark’s `universalKey`).
  - `emptyStateText` and `isExcluded` (for Add-Mark selector) analogous to `MarkFacetsEditor` (e.g. exclude Marks already in the list).

### 3. Refactor single-Lens branch in `LensEditor.tsx`

- **Remove**: All use of `InlineReferenceList` for Marks. Remove `referenceListToItems`, `markItems`, `handleMarkRemove`, `renderMarkEditor`, `handleMarkClick` (for Marks), `addMarkToLens` (current implementation), `removeMarkFromLens` (current implementation) in so far as they serve the Marks list. Remove any imports that become unused (`ReferenceList`, `referenceListToItems`, `MarkInlineEditor` if only used there).
- **Add**: Import and render `LensMarkFacetsEditor` in the single-Lens branch. Pass `singleLens.marks` (the `LensMarkFacetList`) and an `onChange` that calls `updateStandard` to replace the lens’s `_payload._marks` with the new `LensMarkFacetList` (same pattern as Guidance: get draft lens, set `lens._payload._marks = newMarks`, ensure draft is updated).
- **Add-mark / remove-mark**: Handled entirely inside `LensMarkFacetsEditor` via `FacetListEditorGeneric` (add = selector + `createEmptyFacet`; remove = row handler). No separate `addMarkToLens` / `removeMarkFromLens` that touch `ReferenceList`.
- **Navigation to Mark**: Implement in the facet row (e.g. in `LensMarkFacetsEditor`’s `renderFacetRow`) by dispatching `pushBreadcrumb` when the user clicks a “go to Mark” link/button for that row’s `facet.reference.universalKey`.

### 4. Types and data consistency

- **LensEditor**: All references to `singleLens.marks` treat it as `LensMarkFacetList` (e.g. `singleLens.marks.items` for facets). Remove any casting or use of `ReferenceList`, `singleLens.marks.payload` for list operations, or `lens._payload._marks` as `ReferenceList` in updates.
- **StandardLens**: No schema changes; `StandardLens` already exposes `marks: LensMarkFacetList`. Ensure `updateStandard` updates `draft.byUniversalId[lensId]._payload._marks` with a new `LensMarkFacetList` instance when the user changes defaults or add/removes Marks.

### 5. Acceptance criteria

- With exactly one Lens, the Room editor shows a facet-list “Marks” section with one row per Lens Mark facet. Each row shows a label (Mark shortName or key) and a single-line “Default” field. Changing the default updates the facet payload and persists via `updateStandard`.
- Add Mark: “Add Mark” opens the Mark selector; choosing a Mark adds a new facet (reference + empty payload) to the list and persists.
- Remove Mark: Each row has a remove affordance; removing a row deletes that facet and persists.
- Navigate to Mark: Each row has an affordance (e.g. link) that pushes the Mark onto the breadcrumb so the user can edit the Mark component.
- Zero and multiple Lenses: Unchanged (zero = Add Lens / Reference existing Lens; multiple = warning + list without full Marks editing). No regressions.

### 6. Out of scope for this plan

- Room modes (simple / complex / lens-editing), SITUATION#DEFAULT, “Add dynamic rendering” flow.
- Multi-line or rich editing for default values.
- Multiple-Lens editing or layered-context view for Lens.
- WML-level “single-option reference” for Room → Lens.

---

Once this plan is executed, we can revisit existing `AGENT.md` docs to keep them aligned.

