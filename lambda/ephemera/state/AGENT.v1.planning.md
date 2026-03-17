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
   - **Decision (Rooms, v1):** World state is **global per Room** and represented as a canonical `markState` (Mark/Match pairs) derived from the Room's Lens/Marks/Situations.
   - **Storage target:** A `state` property on the existing or new `Meta::Room` record in the Ephemera table (`EphemeraId: ROOM#...`, `DataCategory: 'Meta::Room'`), so that:
     - Each Room has a single authoritative world-state snapshot.
     - The `state` object can hold:
       - `marks`: the canonical `markState` (Mark/Match pairs) used for cache lookup and generation.
       - Optional `situationId`: for debugging and author-facing introspection, indicating which Situation (if any) this state is most closely associated with.
     - A `currentCacheId` field on `Meta::Room` can point at the most recently used cache entry (e.g., `DataCategory` for a `CACHE#...` row), and is **invalidated whenever `state` changes**.
     - Future iterations can extend the same pattern to other components (e.g., `Meta::Feature`, `Meta::Map`) without changing the basic representation.
   - Open follow-up questions (explicitly **out of v1 scope**, and possibly unnecessary long-term):
     - Do we ever need per-character or per-session overrides in addition to the global Room state, and if so, where would those live if we decide to add them?
2. **APIs between state and perception**
   - **High-level contract (Rooms, v1):**
     - Perception, when preparing a Room perception event, first reads `Meta::Room` for that Room to obtain:
       - `state.marks` (canonical markState) and optional `state.situationId`.
       - `currentCacheId`, if present.
     - If `currentCacheId` is present:
       - Attempt a fast read of that specific cache record (validate that its `markState` still matches `state.marks` and that it is otherwise valid); if valid, use it directly for the render.
       - If invalid (state mismatch, missing record, etc.), clear `currentCacheId` and fall through to the search/generation path.
     - If `currentCacheId` is not present or was invalidated:
       - Use `state.marks` plus the current perspective (asset stack) to:
         - Search `renderCache` for an exact match.
         - If none exists and generation is allowed in this context, invoke the existing generate-and-cache flow (same semantics as `generateRoomPreview`), then update `Meta::Room.currentCacheId` and use that result.
   - This answers question 2 for Rooms in v1: perception always goes through `Meta::Room` → (optional fast cache hit by `currentCacheId`) → cache search/generation by `state.marks` and perspective to obtain a render.
3. **Authoring integration**
   - **v1 contract:** Introduce a **bespoke, temporary/development WebSocket API** for the Room State Dashboard, parallel in spirit to `generateRoomPreview`:
     - Request shape (conceptual):
       - Message type specific to authoring (e.g., `SetRoomStateForPreview`), clearly documented as **authoring-only** and **non-gameplay**.
       - Includes `RoomId`, proposed `state.marks` (and optional `state.situationId`), and any authoring context needed to validate permissions.
     - Behavior:
       - Writes the proposed state into `Meta::Room.state` for that Room and clears `currentCacheId`.
       - Optionally triggers an immediate Room-perception event for the author’s session/character so they see the updated state reflected in the chat spine.
     - Response:
       - Returns a simple success/failure result over the authoring WebSocket flow (similar to Preview), with clear documentation that this contract is **experimental and subject to change** as we converge on a more general state API.
4. **Cache usage policy**
   - **Rooms, v1:** Room perceptions are **cache-required** for state-driven renders; we do not silently fall back to `ComponentRender` for stateful Room descriptions.
   - **Two-phase user feedback pattern (authoring, Room State Dashboard):**
     - When a state change or perception request comes in over WebSocket (with a `RequestId`):
       1. Call a **state+cache orchestration helper** (conceptual name: `getOrStartRoomRenderForState(roomId, perspective, options)`), which:
          - Reads `Meta::Room` to obtain `state.marks`, optional `state.situationId`, and `currentCacheId`.
          - Attempts a cache lookup via `currentCacheId` and, if needed, a search/generation path using `state.marks` + perspective.
          - Returns either:
            - `{ status: 'ready', cacheRecord }` when a matching cache record exists (either from prior work or immediate generation), or
            - `{ status: 'generating', placeholderMessageId }` when an LLM round-trip has been started and no ready record exists yet.
       2. Perception reacts to the helper’s status:
          - **Case (a) `status: 'ready'`:**
            - Call `componentRender.get(...)` as a synchronous enrichment step around the chosen cache record (exits, characters, short name, etc.).
            - Send a `RoomUpdate` message for the Room (with a new `MessageId`) carrying the final description.
            - Return success on the original WebSocket `RequestId` once that `RoomUpdate` has been sent.
          - **Case (b) `status: 'generating'`:**
            - Immediately send a `RoomUpdate` message with:
              - A dedicated `MessageId` (from `placeholderMessageId`).
              - A **first-class "generating" variant** in the `RoomUpdate` payload (e.g., a discriminated union branch such as `{ kind: 'Generating', RoomId, meta: ... }`), rather than a string like "Generating..." that a naive client might render directly.
            - Resolve the WebSocket request as success as soon as this placeholder `RoomUpdate` is sent (the author sees that something is happening).
            - Allow the generation function, owned by the state+cache helper, to continue asynchronously. When generation completes and the helper has written the new cache row and updated `Meta::Room.currentCacheId`:
              - Invalidate the relevant `componentRender` cache entry for that `(characterId, RoomId, header?)`.
              - Call `componentRender.get(...)` to rebuild the enriched `StandardForm`.
              - Send a follow-up `RoomUpdate` that **overwrites** the previous one by reusing the same `MessageId`, replacing the "Generating" variant with the final description from cache.
    - In this design, `componentRender` remains a single-shot, synchronous enrichment step, while the **two-phase UX and LLM orchestration** live in the state+cache helper and perception layer. This preserves a cache-required model while giving the author immediate feedback and a clean overwrite mechanism once generation finishes.
5. **Extensibility to Features and Maps**
   - **Intentionally generic patterns (expected to carry over):**
     - `Meta::<ComponentType>.state` with:
       - `marks` (canonical Mark/Match pairs for that component’s Lens/Marks/Situations).
       - Optional `situationId` for introspection.
     - `Meta::<ComponentType>.currentCacheId` pointing at the active `CACHE#...` record for that component, invalidated whenever `state` changes.
     - Perception flow of:
       - Read `Meta::<ComponentType>` → get `state` and `currentCacheId`.
       - Try fast cache hit via `currentCacheId`; on failure, search/generate via `state.marks` + perspective and update `currentCacheId`.
       - Emit a component-specific perception/update message (`RoomUpdate`, `FeatureUpdate`, `MapUpdate`, etc.) using the resulting cached render.
     - Cache-required policy plus the two-phase “generating” feedback pattern (with a first-class `kind: 'Generating'` variant and overwrite by `MessageId`) apply equally well to Features and Maps.
   - **Room-only shortcuts in v1 (to be unrolled later if needed):**
     - The only concrete meta record we plan to touch initially is `Meta::Room`; `Meta::Feature` and `Meta::Map` will not yet have `state`/`currentCacheId` fields wired into perception.
     - The bespoke authoring WebSocket contract is **Room-specific** (Room State Dashboard) rather than a fully generic “SetComponentState” API.
     - Perception entrypoints and update message types we are touching in v1 are `PerceptionRoomMessage` and `RoomUpdate`; Feature/Map perception will continue using existing flows until we explicitly migrate them onto this pattern.

As v1 design solidifies, we will convert these bullets into concrete decisions, diagrams, and type signatures, and mirror the results into `AGENT.md` as implementation lands.

