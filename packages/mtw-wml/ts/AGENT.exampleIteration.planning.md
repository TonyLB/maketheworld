 # Example / Situation Iteration - Conceptual Notes

 **Status: CONCEPT ONLY (no implementation work started)**

 This document captures a possible **second-iteration** direction for how Examples and world-state dependent descriptions might be modeled in WML and the standardization system. It is intentionally conceptual only:

 - It does **not** describe committed schema changes.
 - It does **not** prescribe specific migration steps or timelines.
 - It exists so that first-MVP work (especially ephemera caching and componentExamples enrichment) can proceed without fear of painting the system into a corner.

 Future iterations can refine this document into a full planning artifact when we are ready to implement the pattern.

 ## Current Approach (Pre-Iteration)

 Today, the WML / StandardComponent model treats `Example` as a first-class component:

 - `Example` has its own `uuid` and can appear multiple times in an asset.
 - Rooms, Features, Knowledge, etc. reference Examples via `examples: ReferenceList`.
 - Each Example both:
   - defines a **world-state slice** (via Mark facets), and
   - stores the **render content** (DisplayName / Summary / Description via StandardRender).

 This has several architectural advantages:

 - Fits the general component pattern: globally identifiable, additively merged, referenceable from multiple places.
 - Integrates with edit algebra and diff/merge at the component level.
 - Works with layered assets and imports: Example content can be refined across assets.

 But it also creates a semantic mismatch:

 - Conceptually, Example prose usually belongs to a specific parent component and a specific world-state point, not as a reusable blob.
 - The model encourages the idea of "an Example that just happens to look exactly like this Room," rather than "how this Room looks in this situation."
 - Cross-parent sharing of an Example (for instance, between a Tavern and a Desk Lamp) is allowed by the model but rarely makes semantic sense.

 At the same time, ephemera caching is already treating Examples primarily as **state slices plus render content**:

 - The ephemera cache schema stores:
   - `componentId` (e.g. `ROOM#...`),
   - `markState` (Mark / Match pairs),
   - `renderedContent` (DisplayName / Summary / Description as RenderTree),
   - `provenance` and `perspectiveId`.
 - The cache key is deliberately **synthetic** (one row per distinct render, per perspective), not `RoomId + ExampleId`.
 - Lookup in v1 is by component and Mark pattern, not by Example id.

 That design already nudges the system toward "this component, in this world-state, looks like this," rather than "there exists a free-floating Example that multiple components share verbatim."

 ## Conceptual Second Iteration: Situations and Facets

 The conceptual direction in this document is to **separate "world-state" from "component-specific prose"**:

 - Introduce a `Situation` component that represents **only** a world-state slice.
 - Move parent-specific prose into **facets** on the parent component.

 ### Situations as World-State Components

 In this model, we would:

 - Replace the current `Example` tag with a `Situation` tag (or otherwise introduce `Situation` as a first-class component).
 - Treat `Situation` as an independent component that:
   - Carries a **MarkFacetList** describing a particular combination of Mark values (illumination: bright, mood: somber, etc.).
   - Does **not** store DisplayName / Summary / Description fields.
 - Allow `Situation` to be referenced by many parents (Rooms, Features, Maps, etc.) as a reusable definition of "what state we are talking about."

 Semantically, this shifts the question from:

 - "Should we share this Example between a Tavern and a Desk Lamp?"

 to:

 - "Can we share the **Situation** 'illumination: bright, mood: somber' between a Tavern and a Desk Lamp?"

 The answer to the second question is usually "yes" (shared world-state), even when the prose for each component in that state is entirely different.

 This aligns well with:

 - The Mark / Guidance / Example rendering docs (world-state as a point in Mark space).
 - The future "Guidance-constellation" search direction (cluster and compare states, not prose blobs).

 ### Parent-Specific Descriptions as Situation Facets

 Once `Situation` is responsible for the world-state, the **parent component** becomes responsible for how it looks in that state.

 Conceptually:

 - Each parent component would gain a homogeneous facet list of "situation facets."
 - Each facet references a `Situation` and carries a payload describing how that parent renders in that Situation.

 Examples of possible facet lists and payloads:

 - Rooms:
   - `examples: SituationRoomFacetList`
   - Payload type: something like `{ name?: StandardRender, summary?: StandardRender, description?: StandardRender }`
 - Features:
   - `examples: SituationFeatureFacetList`
   - Payload type: something like `{ description?: StandardRender }` (no summary needed for many UI flows)
 - Maps (future):
   - `examples: SituationMapFacetList`
   - Payload type: a map-specific structure, potentially very different from Rooms and Features.

 These lists:

 - Are **homogeneous** (one facet type per list), matching existing FacetList design.
 - Use the existing facet pattern:
   - `StandardFacet<TPayload>` = reference to a `Situation` + payload.
   - Facets support Replace operations over payloads and integrate with edit algebra.

 Under this approach:

 - `Situation` defines "which world-state are we in?"
 - Each parent facet payload defines "how does this particular thing look in that state?"
 - Sharing is now about reusing **state** (Situation), not reusing **prose**.

 ### Typical Editing Patterns

 With this split in place, edits naturally fall into two categories:

 - **Global state edits** (rare, more expensive):
   - Editing a `Situation` (changing its MarkFacetList) is a global change.
   - The system may need to walk layered assets and inheritance graphs to find all components that reference that Situation.
   - This is appropriate for "big" changes that intentionally affect many parents.

 - **Local rendering edits** (common, cheaper):
   - Editing a Room's description for a given Situation is a facet-payload edit on that specific Room.
   - No need to rediscover which parents reference the Situation; the edit is anchored to a known parent.
   - Enrichment and event logic can treat this as a local change: "Room R, Situation S, payload changed."

 This mirrors how ephemera caching and `componentExamples` enrichment already think about changes, but makes the distinction explicit in the data model.

 ## Relationship to Ephemera Caching

 The first MVP ephemera cache schema already avoids committing to Examples as the unit of reuse:

 - Cache keys use a **synthetic** `CACHE#uuid` per record.
 - Each record stores:
   - `componentId` (e.g. `ROOM#...`),
   - `markState` (Mark / Match pairs),
   - `renderedContent`,
   - `provenance`,
   - `perspectiveId`.
 - Lookup is by component and Mark pattern (and optionally perspective), not by Example id.

 This leaves room for a future where:

 - `markState` is derived from referenced `Situation` components.
 - The cache record optionally records a `situationId` to identify which Situation the render corresponds to.
 - The "one cache record per distinct render per perspective" rule stays the same.

 Because the cache already avoids keying by Example or canonical Mark state, it is **not** painting the system into a corner for this iteration:

 - The second iteration can introduce Situations and situation facets.
 - The cache can be extended to understand Situations without changing its core strategy.

 ## Impact on Existing Patterns (High-Level)

 This conceptual iteration would, if implemented, have several likely effects:

 - **Authoring semantics**:
   - Authors would define Situations (Mark combinations) early.
   - They would then describe how each component looks in those Situations via facet payloads on the component.
   - The notion of "sharing prose" between semantically unrelated components would recede; sharing state would become the norm.

 - **Standardization and components**:
   - The core component patterns (StandardForm, StandardComponent, StandardRender, References, Facets) remain intact.
   - `Example` as "state + prose" could be decomposed into:
     - `Situation` for state (Marks),
     - situation facet lists for prose (component-specific payloads).

 - **Search and enrichment**:
   - Global, inheritance-aware searches ("find all parents referencing this Situation") would be reserved for truly global changes.
   - Typical edits would be facet payload changes on a specific parent, which are computationally simpler to reason about and process.
   - `componentExamples` enrichment logic could eventually be simplified to work over situation facets rather than full Example components.

 ## Scope and Non-Commitments

 This document is intentionally limited in scope:

 - It does **not** define final WML syntax for `Situation` or situation facet tags.
 - It does **not** specify exact TypeScript types for payloads or facet lists.
 - It does **not** commit to a particular migration strategy from existing `Example` components.
 - It does **not** schedule or prioritize this work relative to other roadmap items.

 Instead, its purpose is to:

 - Capture the main semantic fault-line in the current Example model.
 - Outline a direction (Situation + situation facets) that aligns with existing architecture:
   - StandardForm and StandardComponent patterns.
   - Reference vs Facet separation.
   - Mark / Guidance / rendering design.
   - Ephemera caching and future Guidance-constellation search.
 - Provide enough clarity that first-MVP work (especially ephemera caching) can proceed without concern that it will block or complicate this possible second iteration.

 As we approach an iteration where we want to implement this pattern, this file should be revisited and expanded into a full planning document with:

 - Concrete schema and WML syntax proposals.
 - Migration strategies for existing assets and Examples.
 - Detailed changes to componentExamples enrichment, StandardComponent implementations, and ephemera caching.
 - UI and authoring flows for editing Situations and situation facets.

