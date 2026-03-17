*Status: ACTIVE PLANNING DOCUMENT - v1 world state system (Room-focused prototype).*

## Purpose and Scope of v1

### Goal

Design and implement the **first iteration of a world-state system** in Ephemera that:

- Provides a clear, queryable representation of **current world state**.
- Integrates with the **render cache** system so that Room descriptions are selected based on that state.
- Routes those state-aware Room renders through the **perception** system into the chat spine.

### Strict v1 Scope (Room-focused)

For v1, we deliberately constrain behavior to **Rooms only**:

- **World-state inputs**:
  - Room-level state expressed as Mark/Match combinations and/or Situation identifiers.
  - Authoring-side controls (from the Workbench) that can update this Room state in a controlled way.
- **Render outputs**:
  - Room descriptions (full and header) that are selected from `renderCache` based on the current Room state.
  - No behavior changes yet for Features, Knowledge, Maps, or Characters.

This version is targeted at a **State Dashboard** experience in the Room editor: authors can adjust Room world state and see the results appear through the normal perception/message pipeline, rather than in a detached preview pane.

### Future Reach (beyond v1)

While v1 behavior is strictly Room-focused, we want the **state model and APIs** to be usable by other component types without major redesign:

- **Intended consumers over time**:
  - Rooms (v1 prototype and beyond).
  - Features (component-level state, interactions).
  - Maps (which Rooms are highlighted, overlays, etc.).
  - Possibly other components, but **probably not Knowledge**, which is more static and cognition-focused than stateful.
- **Design requirement**:
  - Model and API design should be **component-agnostic where practical**, even if only the Room path is exercised in this iteration.

The v1 plan should call out where we are intentionally specializing for Rooms vs. where we are setting up abstractions that later Room/Feature/Map flows can share.

## Architectural Context

### Relationship to Existing Systems

- **Assets / WML**:
  - Own the blueprint definitions (Lens, Marks, Situations, Examples, Guidance).
  - Continue to be the place where authors define *possible* world states and descriptions.
- **Ephemera `renderCache`**:
  - Already stores one row per distinct render, keyed by component id and `CACHE#uuid`, with `markState`, `perspectiveMatcher`, and `provenance`.
  - Is the **runtime source of truth for cached descriptions**; Ephemera should not reach back into Assets when deciding what to show now.
- **Perception**:
  - Owns routing descriptions into the chat spine for characters.
  - Currently uses `internalCache.ComponentRender` to build WML directly; v1 world state should begin shifting Room description selection toward the cache-backed flow.
- **State system (this directory)**:
  - Introduces an explicit model for **current world state**, separate from blueprints and cached renders.
  - Provides APIs so perception can ask "What is the current state for this component (and character)?" and then select the appropriate cached render.

### Authoring vs Playing

The state system must respect the existing **dual-mode** architecture:

- **Authoring mode**:
  - State updates may be driven directly from Workbench tools (e.g., a Room State Dashboard).
  - It is acceptable to generate new cache entries on demand when authors explore new states.
- **Playing mode**:
  - State transitions come from in-world events (character actions, scripted events).
  - We may choose to treat cache as read-only here (initially), or allow carefully controlled generation.

v1 will primarily exercise the authoring path: an author using the Room State Dashboard causes state changes that then surface in Room perception. We should leave seams for later introduction of live, in-world state transitions.

## v1 Design Questions and Decisions (to be filled in)

This section will capture concrete decisions as they are made. Initial placeholders (to be refined and filled as we design and implement):

1. **State representation**
   - What is the durable Ephemera representation of world state per component?
   - For Rooms in v1:
     - Do we store state as a canonical `markState` (Mark/Match pairs), a `situationId`, or both?
     - Is state global per Room, per character, or per session?
2. **APIs between state and perception**
   - How does perception query the current state for a Room when generating a perception event?
   - How does it translate that state into a cache lookup (or generation) for renders?
3. **Authoring integration**
   - What WebSocket/API contracts allow a Room State Dashboard to:
     - Propose a new state.
     - Commit that state as "current" for the Room.
     - Observe the resulting perception messages in the chat spine.
4. **Cache usage policy**
   - In v1, are Room perceptions:
     - Cache-first with fallback to `ComponentRender`?
     - Cache-required (and we surface "no state render exists" errors)?
   - When and where is LLM-based generation allowed to write new cache rows?
5. **Extensibility to Features and Maps**
   - What parts of the data model and APIs are intentionally generic (component-agnostic)?
   - What Room-only shortcuts do we accept in v1, and how will we unroll them later?

As v1 design solidifies, we will convert these bullets into concrete decisions, diagrams, and type signatures, and mirror the results into `AGENT.md` as implementation lands.

