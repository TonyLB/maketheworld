*Status: HISTORICAL PLANNING DOCUMENT - v1 world state system (Room-focused prototype).*

## Historical status note

This document is retained as the historical planning/decision record for v1.

- It remains useful for understanding v1 assumptions, delivered foundations, and unresolved v1-era gaps.
- It is no longer the active planning document for ongoing architecture work.

For active planning moving forward, see:

- `lambda/ephemera/state/AGENT.v2.planning.md`

## Domain boundaries (current architecture)

The v1 sections below were written while **state**, **perception**, and **orchestration** were still being teased apart. They sometimes describe **cache pointer invalidation** and **render selection** as responsibilities of the state layer. **Current** split:

- **`lambda/ephemera/state`**: runtime world-state on `Meta::Room` (`state.marks`, etc.), default marks, merge helpers. See `AGENT.md` in this directory.
- **`lambda/ephemera/dataSource/renderOrchestration`**: `Meta::Room` **pointer** fields (`currentCacheId` / `currentCacheByPerspective`), validation against current marks, exact match, generation, **`RenderInvalidate`**, and related lifecycle.

Early v1 language often assumed **eager** invalidation (clear pointers whenever `state` changes). **Orchestration** instead **re-validates** hinted cache rows on each resolve and clears or updates pointers as needed (`findRender`). Optional eager clears on write remain a product choice, not a requirement of the state module.

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
  - Introduces an explicit model for **current world state**, separate from blueprints and cached renders (`Meta::Room.state`, default marks, merge helpers).
  - **Selecting** the cached render and maintaining pointer fields is **render orchestration**; perception **enriches** and **delivers** outcomes once orchestration has resolved a cache row.

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
     - A `currentCacheId` field on `Meta::Room` can point at the most recently used cache entry (e.g., `DataCategory` for a `CACHE#...` row). **Historical v1 assumption:** clear this pointer on every `state` change (eager invalidation). **Current:** pointer validity is enforced during **render orchestration** resolve, not as a separate state-layer invalidation step; see `findRender` under `dataSource/renderOrchestration`.
     - Future iterations can extend the same pattern to other components (e.g., `Meta::Feature`, `Meta::Map`) without changing the basic representation.
   - **Shared type definition:** The Ephemera-table `Meta::Room` record shape (including `state` and `currentCacheId`) is defined in `packages/mtw-interfaces/ts/ephemeraMeta.ts` as `EphemeraMetaRoom`.
     - This is intentionally distinct from `assetDB`'s `Meta::Room` record shape (used for cross-asset indexing, e.g. the `cached` asset list).
   - Open follow-up questions (explicitly **out of v1 scope**, and possibly unnecessary long-term):
     - Do we ever need per-character or per-session overrides in addition to the global Room state, and if so, where would those live if we decide to add them?
2. **APIs between state and perception**
   - **Note:** The concrete pipeline is now **`renderOrchestration`** (`intakeRenderRequested`, `findRender`, etc.), not ad hoc logic in `state` or perception. The bullets below describe the intended **data flow** at a high level.
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
       - Writes the proposed state into `Meta::Room.state` for that Room. (Early contract also cleared `currentCacheId` to force re-resolve; orchestration can also rely on **lazy** pointer validation without an eager clear.)
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
            - `{ status: 'generating' }` when an LLM round-trip has been started and no ready record exists yet.
       2. Perception reacts to the helper’s status:
          - **Case (a) `status: 'ready'`:**
            - Call `componentRender.get(...)` as a synchronous enrichment step around the chosen cache record (exits, characters, short name, etc.).
            - Send a normal `PerceptionRoomMessage` (with `header: true` and/or full description as appropriate) whose resulting `PerceptionMessage` room header reflects the new cached render.
            - Return success on the original WebSocket `RequestId` once that perception has been sent.
          - **Case (b) `status: 'generating'`:**
            - Immediately send a **placeholder room header** via `PerceptionRoomMessage` with `header: true`, whose WML and metadata clearly indicate a transient "Generating..." state for that Room (e.g., a header description that renders as a centered "Generating..." summary, and the usual `PerceptionRoomMetaData` for the Room).
            - Treat this as just another header for the same Room: on the client, `getMessagesByRoom` will treat the newest header as the current sticky header, so the placeholder naturally replaces any prior header for that Room without needing message overwrites.
            - Resolve the WebSocket request as success as soon as this placeholder header perception is sent (the author sees that something is happening).
            - Allow the generation function, owned by the state+cache helper, to continue asynchronously. When generation completes and the helper has written the new cache row and updated `Meta::Room.currentCacheId`:
              - Invalidate the relevant `componentRender` cache entry for that `(characterId, RoomId, header?)`.
              - Call `componentRender.get(...)` to rebuild the enriched `StandardForm`.
              - Send a follow-up `PerceptionRoomMessage` (again with `header: true`) whose header content reflects the final rendered description. On the client, this new header will simply replace the placeholder header as the current sticky room context for that Room.
    - In this design, `componentRender` remains a single-shot, synchronous enrichment step, while the **two-phase UX and LLM orchestration** live in the state+cache helper and perception layer. We rely on the existing Perception header semantics (newest header per Room becomes the sticky header) rather than adding any new "overwrite by MessageId" behavior.
5. **Extensibility to Features and Maps**
   - **Intentionally generic patterns (expected to carry over):**
     - `Meta::<ComponentType>.state` with:
       - `marks` (canonical Mark/Match pairs for that component’s Lens/Marks/Situations).
       - Optional `situationId` for introspection.
     - `Meta::<ComponentType>.currentCacheId` (or perspective-scoped pointers) pointing at cache rows --- **maintenance** is an **orchestration** concern; see domain note at top of this file.
     - Perception flow of:
       - Read `Meta::<ComponentType>` → get `state` and `currentCacheId`.
       - Try fast cache hit via `currentCacheId`; on failure, search/generate via `state.marks` + perspective and update `currentCacheId`.
       - Emit a component-specific perception/update message (`RoomUpdate`, `FeatureUpdate`, `MapUpdate`, etc.) using the resulting cached render.
     - Cache-required policy plus the two-phase “generating” feedback pattern (with a first-class `kind: 'Generating'` variant and overwrite by `MessageId`) apply equally well to Features and Maps.
   - **Room-only shortcuts in v1 (to be unrolled later if needed):**
     - The only concrete meta record we plan to touch initially is `Meta::Room`; `Meta::Feature` and `Meta::Map` will not yet have `state`/`currentCacheId` fields wired into perception.
     - The bespoke authoring WebSocket contract is **Room-specific** (Room State Dashboard) rather than a fully generic “SetComponentState” API.
     - Perception entrypoints and update message types we are touching in v1 are `PerceptionRoomMessage` and `RoomUpdate`; Feature/Map perception will continue using existing flows until we explicitly migrate them onto this pattern.

6. **Default state when none is specified**
   - **Rooms, v1:** When no explicit `Meta::Room.state` has been set, Ephemera should still treat the Room as having a well-defined **default world state**, rather than falling back to legacy `componentRender` room handling.
   - **Helper function:** Introduce a `computeDefaultMarksForRoom(roomId, perspective)` helper in the Ephemera lambda that:
     - Reads the Room's Lens/Marks/Situations from the **Assets/WML dataSource** (using the same standardization/lookup pathways as existing `componentRender` behavior).
     - Computes the canonical `markState` corresponding to the Room's default Lens configuration for the given perspective.
     - Returns that `markState` so it can be written into `Meta::Room.state.marks` and used as the lookup key for cache search/generation.
   - **Coupling note (intentional, to be revisited):**
     - This helper **explicitly couples Ephemera state logic to the internals of the Assets dataSource** in a read-only way.
     - For v1, this is acceptable and mirrors existing read-only uses of Assets/WML in `componentRender`, but we expect to **migrate away from this coupling over time** as more state-related data flows are pushed into Assets-to-Ephemera pipelines.
     - The helper and its call sites should be clearly documented as such, to make future decoupling and refactors straightforward.

## v1 First Iteration (what is already implemented)

v1 implemented the core foundations for a cache-backed, state-driven Room description selection flow. This includes:

1. **Room state shape in Ephemera table (type-level)**
   - Shared Ephemera-table `Meta::Room` record shape is defined as `EphemeraMetaRoom` in `packages/mtw-interfaces/ts/ephemeraMeta.ts`.
   - It includes `state.marks` (stored as `EphemeraCacheMarkState`), optional `state.situationId`, and optional `currentCacheId` (a `CACHE#...` `DataCategory` pointer).
   - **Historical:** we documented eager clearing of `currentCacheId` on any `state` change. **Pointer lifecycle** is now owned by **render orchestration** (lazy validation on resolve); see `AGENT.md` and `AGENT.v2.planning.md`.

2. **Default mark derivation**
   - Implemented `computeDefaultMarksForRoom(roomId, perspective)` in `lambda/ephemera/state/computeDefaultMarksForRoom.ts`.

3. **renderCache exact-match primitives**
   - Exact-match semantics (normalized Mark-state equality + perspective matcher filtering) are implemented and tested via `internalCache.RenderCache.getExactMatch` and `generateRoomPreview` in `lambda/ephemera/renderCache/`.

4. **Room state -> cache selection helper (fast path only)**
   - Added a DI-friendly orchestration entrypoint `getOrStartRoomRenderForState(roomId, perspective, options)` in `lambda/ephemera/state/getOrStartRoomRenderForState.ts`.
   - Implemented and test-driven the `currentCacheId` fast path:
     - load pointed cache record
     - validate it matches `state.marks` and the requested perspective
     - on mismatch, clear `Meta::Room.currentCacheId` (best-effort).
   - The slow-path orchestration (exact-match search after a fast-path miss, and optional generation lifecycle) remains pending in the helper itself.

Perception wiring and `componentRender` enrichment around a chosen cache record are also still pending in v1.

## v1 Remaining Work Checklist: migrate Room perception onto renderCache (state-driven)

This section is a concrete checklist for the "state-driven Room render selection via renderCache" refactor described above.

It intentionally **excludes** the later task of "Create any way in which Room State can be updated" (authoring/gameplay APIs). The goal here is to make perception capable of selecting a Room render via:

`Meta::Room` (state + currentCacheId) -> renderCache lookup/generation -> componentRender enrichment -> PerceptionRoomMessage.

### Phased Tasks (linear progression)

#### Phase 1: Data model + cache primitives (foundations)

- [x] **Define/confirm `Meta::Room` schema additions (type-level)**
  - [x] Confirm shared type: `EphemeraMetaRoom` in `packages/mtw-interfaces/ts/ephemeraMeta.ts`
  - [x] Define `Meta::Room.state` with:
    - [x] `marks` (canonical markState used for cache lookup, stored as `EphemeraCacheMarkState`)
    - [x] optional `situationId` (introspection/debug)
  - [x] Define `Meta::Room.currentCacheId` (points at `DataCategory` of active `CACHE#...` row)
  - [x] Document relationship of `state` to `currentCacheId` (historical: eager clear on state change; **current:** orchestration maintains pointers --- see `AGENT.md`)

- [x] **Default marks primitive exists**
  - [x] `computeDefaultMarksForRoom(roomId, perspective)` implemented

- [x] **Exact-match cache primitive exists**
  - [x] `internalCache.RenderCache.getExactMatch` and `generateRoomPreview` semantics implemented and tested (preview branch + renderCache tests)

#### Phase 2: Room state -> renderCache selection helper

- [x] **Create helper**
  - [x] `getOrStartRoomRenderForState(roomId, perspective, options)` exists (DI-friendly)

- [x] **Fast path (implemented)**
  - [x] If `currentCacheId` exists:
    - [x] fetch cache record
    - [x] validate record existence
    - [x] validate `record.markState` matches `state.marks`
    - [x] validate perspective match (`perspectiveMatches(record.perspectiveMatcher, perspective)`)
    - [x] on mismatch, clear `Meta::Room.currentCacheId` (best-effort)

- [ ] **Slow path orchestration (still missing in helper)**
  - [ ] When `currentCacheId` is missing/invalidated:
    - [ ] ensure a well-defined markState (use `Meta::Room.state.marks` or compute defaults)
    - [ ] search `renderCache` for an exact match on (`state.marks`, perspective)
    - [ ] return `{ status: 'ready', cacheRecord }` when found
  - [ ] When no exact match exists:
    - [ ] if `allowGeneration` is true, start generate-and-cache (same semantics as `generateRoomPreview`)
    - [ ] return `{ status: 'generating' }` (helper-side initiation)
    - [ ] update `Meta::Room.currentCacheId` on success

- [ ] **Return status contract**
  - [ ] Implement discriminated returns:
    - [ ] `{ status: 'ready', cacheRecord }`
    - [ ] `{ status: 'generating' }`
    - [ ] `{ status: 'error', ... }`

#### Phase 3: Enrichment + perception wiring

- [ ] **Update `componentRender` to enrich a chosen cache record**
  - [ ] Provide an entrypoint that accepts the selected cache record payload (or renderedContent/situation facet), instead of selecting an arbitrary cache row internally
  - [ ] Keep enrichment synchronous: exits, characters, shortName, header/full selection

- [ ] **Wire `perception` Room branch**
  - [ ] Replace direct `ComponentRender.get(characterId, roomId, ...)` selection with:
    - [ ] call orchestration helper
    - [ ] on `{ status: 'ready' }`: enrich around chosen cache record and send `PerceptionRoomMessage`
    - [ ] on `{ status: 'generating' }`: send placeholder header (`sendRoomGeneratingHeader`) and arrange async follow-up
  - [ ] Refresh perception / `componentRender` caches after generation completes (orchestration updates Meta pointers; perception drops stale enriched views)

#### Phase 4: Tests

- [ ] **Unit tests for helper orchestration**
  - [ ] default marks when `Meta::Room.state` missing
  - [x] `currentCacheId` fast path + mismatch pointer clear (already test-driven)
  - [ ] exact-match search path via helper (not just preview)
  - [ ] generation-start and follow-up behavior (mock generation)

- [ ] **Perception wiring tests**
  - [ ] placeholder header while generating
  - [ ] final header when ready
  - [ ] full description when requested and ready

As v1 design solidifies, we will convert these bullets into concrete decisions, diagrams, and type signatures, and mirror the results into `AGENT.md` as implementation lands.

## v2 Second Iteration (messageBus-based event-cascade + early feedback)

v2 is the migration from an imperative "helper returns next step" orchestration into an event-cascade that better matches the asynchronous lifecycle we need for authoring and generation UX.

### v2 motivation

Generation is not a single synchronous decision; it is a multi-step lifecycle:

- decide which cached render to use (or decide to generate)
- publish immediate feedback to the author ("something is happening")
- publish final feedback when generation completes ("ready" header/content replacement)

The `messageBus` cascade already provides the mechanism for this sort of lifecycle without forcing everything through a single return value.

### v2 high-level task-list

1. **Define messageBus event contracts for the cascade**
   - Room render request
   - Room render ready (cache hit)
   - Room render generation started (early feedback)
   - Room render generation completed (final ready feedback)

2. **Implement cascade handlers in messageBus priority order**
   - Orchestration handler (not a separate `state` package): reads `Meta::Room`, validates pointer fast path, exact match, generation; see `dataSource/renderOrchestration`.
   - Cache selection handler: performs exact-match lookup; on miss, starts generation.
   - Generation handler: kicks off the existing render-cache generation flow and publishes generation-start feedback immediately.
   - Completion handler: writes/upgrades cache rows and `Meta::Room.currentCacheId`, then emits "ready".
   - Perception handler: subscribes to "generation started" and "ready" events, sending:
     - placeholder room header when generation starts
     - final header/full description when ready.

3. **Publish "generated" early during generation**
   - In v2, the feedback event that drives the UI should be emitted when generation starts (not only after it completes).
   - This ensures that the client sees the "generated" (or placeholder) state while the LLM round-trip is still running.

4. **Update tests to validate feedback timeline**
   - Ensure "generation started" events are published before generation completes.
   - Ensure "ready" events are published after cache row write + `currentCacheId` update.

