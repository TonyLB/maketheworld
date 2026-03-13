# Room edit refactor – planned future directions

This document captures **planned future directions** for the Room editor UI. It was extracted from the superseded LensEditor refactor plan; the Lens editing flow is now implemented as LensHeader + LensDetail in `LensEdit/`. The items below are mostly about refactoring or extending **RoomEdit** (modes, simple vs complex Rooms, transition affordances).

## Planned future directions

These are out of scope for current work but part of the longer-term design we should not preclude.

- **Room modes: simple vs complex vs lens-editing**
  - Treat Rooms as either:
    - "Simple": no Lens; the Room directly exposes display name, summary, and description.
    - "Complex": a Lens is present; the Room view focuses on Lens-driven dynamic rendering (Guidance + Situations).
    - "Lens-editing": a dedicated mode where editing the Lens (marks, defaults, description) temporarily takes over the Room editor.
- **Simple Rooms and `SITUATION#DEFAULT`**
  - For simple Rooms (no Lens), the UI should allow direct editing of display name, summary, and description.
  - Behind the scenes, those fields are stored via a Situation facet on a well-known `SITUATION#DEFAULT` component in the primitives asset: a Situation with no marks that describes the default state.
  - This keeps "description lives in Situations" as the consistent story, even when no Lens is present.
- **Transition affordance: "Add dynamic rendering"**
  - Provide a clear affordance (for example "Add dynamic rendering") that:
    - Switches the Room from simple mode into the lens-editing mode.
    - Shifts UI focus to "Specify the Lens" while temporarily de-emphasizing the existing description (summarized, read-only).
- **Lens-editing focus, then back to rich Room editing**
  - In lens-editing mode, the main task is to choose/configure the Lens (including Lens Mark defaults and Lens description).
  - Once the Lens is complete, the UI:
    - Pushes the Lens panel into a summarized, non-editing state with an affordance to "Edit Lens" again.
    - Promotes the richer Room editing tools: Guidance, multiple Situations, and mark-driven behavior.
- **Single-option Lens reference pattern in WML**
  - Longer term, we expect to introduce a "single-option reference" pattern in the WML layer, so that "Room has one Lens" is modeled directly rather than as a degenerate reference list.
  - That work will need careful handling of merge and diff semantics and should be planned separately.
- **Cross-Lens Situation semantics**
  - Situations should be able to describe room state in a way that works across different Lenses:
    - When applying a Situation, use only the marks that intersect with the current Lens.
    - Treat non-overlapping Situation marks as locally irrelevant.
    - Default any Lens marks the Situation does not mention, using the Lens Mark defaults.
  - This decouples Situations from any specific Lens while still allowing Lens-specific defaults to matter.

## Open questions

- **Navigation and layering**: Should Lens Mark defaults stay strictly in the Room editor's Lens section (LensHeader / LensDetail), or do we eventually want a Lens-specific layered-context view (similar to Examples / Guidance / Situation facet payloads)?
- **Multiple lenses**: Today the model allows at most one Lens per Room (SingleReference). If we ever support multiple Lenses per Room again, should the facet editing approach change (e.g. a facet-first list per Lens, or a layered context across Lenses)?
