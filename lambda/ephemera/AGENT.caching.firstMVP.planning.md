# Ephemera Caching - First MVP Implementation Plan

**Status: IN PROGRESS** (Phase 1 complete; Phase 2a Task 1–5 complete; Phase 2b complete; Phase 3 complete; Phase 4 complete)

This document lays out concrete steps from the current state (no caching code in Ephemera) to a working first MVP that:

- Accomplishes exact matches (proposed Mark state -> matching Example)
- Sends an error when no exact match occurs
- Provides a Preview pane in the Room authoring UI to exercise the flow

Prerequisite reading: [AGENT.caching.planning.md](./AGENT.caching.planning.md).

---

## Current State

- **Ephemera**: Phase 1 complete. `renderCache/` provides types (baseClasses.ts), cache access layer (cacheAccess.ts: queryCacheRecordsForComponent, putCacheRecord, deleteCacheRecord), and unit tests. `internalCache/ExamplesData` still fetches authored Examples from the Assets table (assetDB) for perception; it does not yet read or write the Ephemera cache (CACHE#) records.
- **Ephemera DynamoDB** (ephemeraDB): Uses `EphemeraId` and `DataCategory` as keys. Cache access layer is ready to read/write `CACHE#uuid` records; authored records can now be mirrored in via Phase 2b (below), and preview writes will add additional generated records.
- **WebSocket**: Ephemera handles `EphemeraAPIMessage` types (fetchEphemera, registercharacter, action, link, etc.). No `generateRoomPreview` (or equivalent) message.
- **Client**: Room editor has LensEditor, Example editors, Guidance editors. No Preview section. No WebSocket dispatch for preview generation.
- **Example data**: Authored Examples live in the Assets table. StandardExample has marks (MarkFacets) for world-state; Assets query may need extension to include marks for comparison.
- **Assets Lambda**: `mtw.assets.componentExamples` data source exists: non-replayable, subscribed to `mtw.assets` Component Updated / Component Removed. **Task 2 complete**: receiveEvents filters to Example-associated events only—Example (always) and Room/Feature/Knowledge when `examples` has non-zero length (diff or current state). **Task 3 complete**: Example-tagged events are enriched in-place with full parentage (parent componentIds for Rooms/Features/Knowledge) and ordered asset stack, plus fully merged Example payload (markState and renderedContent) suitable for cache mirroring. **Tasks 4–5 complete**: enriched Example lifecycle events (ExampleUpdated, ExampleRemoved; ExampleAdded deferred) are now published from `mtw.assets.componentExamples` with `exampleId` as streamKey and payloads matching the Ephemera cache shape for mirroring. Implementation: `lambda/assets/componentExamples/` (exampleAssociatedFilter.ts, exampleEnrichment.ts, events.ts, index.ts and tests).

---

## Target State (MVP)

1. **Backend**: Ephemera accepts a `generateRoomPreview` WebSocket message with `roomId`, `markState`, and `assetStack` (ordered list of asset IDs for the resolution context). Fetches cached records from Ephemera (authored content mirrored via pipeline; generated content written at render time). Compares markState; optionally filters by perspectiveId (hash of assetStack). On exact match: returns rendered content via ReturnValue. On no match: returns error via ReturnValue.
2. **Ephemera DynamoDB**: New module/handler that reads and writes cache records (EphemeraId: `componentId` - e.g. `ROOM#...`, `FEATURE#...`, `KNOWLEDGE#...`; DataCategory: `CACHE#${uuid}` with a new UUID per record). Each record includes markState, renderedContent, provenance, and **perspectiveId** (deterministic hash of the ordered asset stack for which the content was resolved). No key by Example ID; lookup is by component then filter in memory.
3. **Mirroring Pipeline**: `mtw.assets.componentExamples` publishes Example lifecycle events (with asset stack / perspective context where available); `mtw.ephemera.examples` subscribes and writes cache records with perspectiveId, keeping the Ephemera cache in sync with the blueprint.
4. **Client**: Room editor has a Preview section: Mark value inputs per Mark in the Room's Lens, Generate button, result/error display. On Generate, client sends the resolved asset stack (current workbench asset + inherited assets in order) so Ephemera can compute perspectiveId for match and store.

---

## High-Level Phases

### Phase 1: Ephemera Storage and Data Access

**Goal**: Ephemera can read and write cache records (CACHE#uuid, with perspectiveId).

1. **Define types and constants** for the cache record shape (markState, renderedContent, provenance, **perspectiveId**) per [AGENT.caching.planning.md](./AGENT.caching.planning.md).
   - **Status**: Implemented in `lambda/ephemera/renderCache/baseClasses.ts`.
2. **Implement Ephemera cache access layer** (use `componentId` throughout - Room, Feature, or Knowledge):
   - **Status**: Implemented in `lambda/ephemera/renderCache/cacheAccess.ts`. Exported via `lambda/ephemera/renderCache/index.ts`.
   - `queryCacheRecordsForComponent(componentId)`: Query ephemeraDB where `EphemeraId = componentId` and `DataCategory begins_with 'CACHE#'`. Return array of records (markState, renderedContent, provenance, perspectiveId, DataCategory for delete). No lookup by Example ID.
   - `putCacheRecord(componentId, record)`: Generate a new UUID, put a single record with `DataCategory = 'CACHE#' + uuid`. Record must include perspectiveId (hash of ordered asset stack). For records from the mirror (authored), include `authoredExampleId` (blueprint Example UUID) so we can target delete on ExampleRemoved.
   - `deleteCacheRecord(componentId, dataCategory)`: Delete the record with the given DataCategory (e.g. `CACHE#uuid`). For mirror "ExampleRemoved": query by componentId, filter by `authoredExampleId`, delete matching record(s).
3. **Unit tests** for query, put, and delete, with mocked ephemeraDB.
   - **Status**: Implemented in `lambda/ephemera/renderCache/cacheAccess.test.ts`.

*Deliverable*: Ephemera can store and retrieve cache records by component; each record has a synthetic CACHE#uuid and a perspectiveId.

---

### Phase 2: Mirroring Pipeline

**Goal**: Authored Examples are mirrored from Assets into the Ephemera cache via event-driven sync. Each mirrored record uses `CACHE#${newUuid}` and includes **perspectiveId** (hash of the ordered asset stack for that resolved example). Ephemera treats authored and generated records identically (except for provenance).

#### Phase 2a: mtw.assets.componentExamples

A new data source in the Assets hierarchy that publishes Example lifecycle events for any component that can have Example references (Room, Feature, Knowledge). It has access to the Assets table and **enriches** each event with parent `componentId` and asset stack before publishing.

1. **Subscribe to mtw.assets** Component Updated / Component Removed events.
   - **Status**: Implemented in `lambda/assets/componentExamples/` (subscribedEvents.ts, index.ts). Data source is non-replayable; receiveEvents filters then no-op. Wired in Assets app and documented in `lambda/assets/AGENT.event.md`.
2. **Detect Example-associated changes** (Task 2 complete: filter to example-related only; (a)/(b)/(c) detection and enrichment are Task 3+):
   - **Filter (done)**: Example always passes; Room/Feature/Knowledge pass only when `component.examples?.payload?.length > 0` (accurately indicates example-related change on diff or removed component). See exampleAssociatedFilter.ts.
   - (a) Example reference **added** to a parent component
   - (b) Example reference **removed** from a parent component
   - (c) Example **content changed** (displayName, summary, description, marks)
3. **Enrich in this data source** (using the Assets table): For each Example-associated change, the parent component(s) (Rooms/Features/Knowledge) and the ordered **asset stack** are not guaranteed to be in the asset where the edit occurred (the Example may be inherited; the parent reference may live in an earlier asset). So we (a) reconstruct the Example's inheritance chain via `from` links across the Assets table to get the ordered asset stack, and (b) for each asset in that chain, search **all possible parent components** (Rooms, Features, Knowledge) to find which ones reference this Example. Inefficient (scan candidates per asset in the chain), but acceptable for first MVP.
   - **Status (Task 3 complete)**: Implemented in `lambda/assets/componentExamples/exampleEnrichment.ts` and wired into `index.ts`. For Example-tagged Component Updated / Component Removed events, we now:
     - Compute the ordered asset stack for the Example by combining `ComponentData.byAssets` with each component's `_from` links (base-first, event asset last).
     - Resolve `parentIds` by loading each asset's `StandardForm` via `internalCache.AssetData` and scanning all Room/Feature/Knowledge components whose `examples` reference the Example.
     - For Component Updated, merge the Example across the asset stack and convert it into a cache-shaped payload `{ markState, renderedContent, provenance: { type: 'authored' } }` that matches the Ephemera cache schema (mark UUID + Match string pairs, RenderTree description).
     - For Component Removed, compute `assetStack` and `parentIds` without writing a new example payload.
4. **Publish events** with `parentIds` (array of parent componentIds: Room, Feature, or Knowledge), `exampleId`, Example data, and **asset stack** (ordered list of asset IDs; merge order is significant):
   - `ExampleAdded`: { type: 'ExampleAdded'; parentIds, exampleId, assetStack, example: { markState, renderedContent, provenance: { type: 'authored' } } } (**planned**, not yet emitted in first MVP)
   - `ExampleRemoved`: { type: 'ExampleRemoved'; parentIds, exampleId, assetStack } (**implemented**)
   - `ExampleUpdated`: { type: 'ExampleUpdated'; parentIds, exampleId, assetStack, example: { markState, renderedContent, provenance: { type: 'authored' } } } (**implemented**)
5. **Stream key**: Use `exampleId` as the streamKey for mtw.assets.componentExamples; `parentIds` labels which parents this Example event affects. (**implemented**)

*Deliverable*: mtw.assets.componentExamples publishes Example lifecycle events enriched with parentIds, asset stack, and full Example payload for perspectiveId computation and cache mirroring.

**Component Updated event semantics (for Example-changed derivation)**  
When subscribing to `Component Updated` from mtw.assets, the payload is a **component-level diff** (edit-mode representation), not the new state. The event carries the result of `previousComponent.diff(incomingComponent)` from StandardForm.diff(): a `StandardComponent` whose fields encode the *change* (e.g. ReferenceList with inverted refs for removals, new refs for adds). For **Room, Feature, and Knowledge**, the `examples` field on that diff is the change to the examples list. Checking that `examples` exists and has **non-zero length** (`component.examples?.payload?.length > 0`) accurately filters for updates that have example-related change (add and/or remove of example refs). Use this when adding (a)/(b)/(c) detection and deriving ExampleAdded/ExampleRemoved/ExampleUpdated. For **Example** components, any Component Updated is by definition example-related. See packages/mtw-wml standardize/edit algebra docs for diff semantics.

#### Phase 2b: mtw.ephemera.examples

A data source (or receive handler) in Ephemera that subscribes to `mtw.assets.componentExamples` and keeps the Ephemera cache in sync.

1. **Subscribe to mtw.assets.componentExamples** (via EventBridge subscription and deserializer).
   - **Status**: Implemented. `template.yaml` wires `EphemeraFunction` to the `mtw.assets.componentExamples` source with a CloudWatchEvent pattern on `detail-type` = `ExampleUpdated` / `ExampleRemoved`. `lambda/ephemera/app.ts` adds an `eventDeserializers` entry for `mtw.assets.componentExamples` using `ComponentExamplesEventSerializer` from `packages/mtw-interfaces/ts/eventBridge/assets`.
2. **On ExampleAdded / ExampleUpdated**: Compute `perspectiveId = hash(ordered assetStack)`. For each `parentId` in `parentIds`, call `putCacheRecord(parentId, { ...record, perspectiveId, authoredExampleId: exampleId })` to write a new cache record (CACHE#uuid) for that parent component. Store `authoredExampleId` so ExampleRemoved can target the right record(s).
   - **Status**: Implemented for `ExampleUpdated` in `lambda/ephemera/dataSource/componentExamples.ts` via `handleComponentExamplesEvent`. Perspective hashing is provided by `lambda/ephemera/internalUtils/perspectiveId.ts` (`computePerspectiveId`), and writes use `putCacheRecord` from `lambda/ephemera/renderCache/`. Support for `ExampleAdded` can be enabled when Phase 2a begins emitting that event.
3. **On ExampleRemoved**: For each `parentId` in `parentIds`, query cache by `componentId = parentId`, filter by `authoredExampleId === exampleId`, delete matching record(s).
   - **Status**: Implemented in `handleComponentExamplesEvent` by calling `queryCacheRecordsForComponent` and `deleteCacheRecord` for each parent, filtering by `authoredExampleId`.
4. **No parent resolution in Ephemera**: The componentExamples payload provides parentIds and assetStack; Ephemera only reads/writes.
   - **Status**: Implemented as designed; Ephemera never queries Assets for parentIds or asset stacks and treats componentExamples events as authoritative.

*Deliverable*: Authored Examples are mirrored into the Ephemera cache with perspectiveId for each parent component; Ephemera has a single source of truth for cache at render time.
  - **Status**: Achieved for `ExampleUpdated` and `ExampleRemoved`. Example lifecycle contracts are shared via `packages/mtw-interfaces/ts/eventBridge/assets/componentExamples.ts`, and the `mtw.ephemera.examples` DataSource (`lambda/ephemera/dataSource/componentExamples.ts`) subscribes and mirrors records into the Ephemera cache.

---

### Phase 3: Example Comparison

**Goal**: Ephemera can obtain all relevant cache records for a component and compare Mark state for exact match, optionally scoped by perspective.

1. **Fetch cache records from Ephemera only**: Call `queryCacheRecordsForComponent(componentId)`. Authored (mirrored) and generated records are both in the cache; provenance differentiates when needed.
2. **Implement exact-match logic**:
   - `findExactMatch(componentId, proposedMarkState, records, perspectiveId?)`: Normalize proposed state and each record's markState (e.g. sorted Mark UUID + value pairs), compare. If `perspectiveId` is provided (from the request's asset stack), filter candidates to that perspective first. Return matching record or null.
3. **Normalize markState format** for comparison: canonical form (e.g. `[{ mark, value }]` sorted by mark) so that ordering does not affect match.

- **Status**: Implemented in `lambda/ephemera/renderCache/exampleComparison.ts` and exported via `lambda/ephemera/renderCache/index.ts`. Normalization, equality, and exact-match behavior (including perspective-aware filtering and the `findExactMatchForComponent` wrapper) are covered by unit tests in `lambda/ephemera/renderCache/exampleComparison.test.ts`.

*Deliverable*: Given componentId + proposed markState + optional assetStack (for perspectiveId), we can deterministically find an exact match among cache records, or conclude none exists.

---

### Phase 4: WebSocket Handler and API Contract

**Goal**: Ephemera responds to a new WebSocket message with either success (rendered content) or error (no match).

1. **Define API message** in `mtw-interfaces`:
   - **Status**: Implemented in `packages/mtw-interfaces/ts/ephemera.ts` as `GenerateRoomPreviewAPIMessage` (`message: 'generateRoomPreview'; RoomId: EphemeraRoomId; markState: { markValue: Array<{ mark: string; value: string }> }; assetStack: string[]`), with runtime validation via the new `isGenerateRoomPreviewAPIMessage` and an added `generateRoomPreview` branch in `isEphemeraAPIMessage`.
2. **Wire handler in `app.ts`**:
   - **Status**: Implemented in `lambda/ephemera/app.ts`. When `isGenerateRoomPreviewAPIMessage(request)` is true, the handler calls `generateRoomPreview({ roomId: request.RoomId, markState: request.markState, assetStack: request.assetStack })` from `lambda/ephemera/renderCache/`, then sends a `ReturnValue` payload of the form `{ generateRoomPreview: { success: true, renderedContent } }` or `{ generateRoomPreview: { success: false, errorCode: 'NO_EXACT_MATCH', errorMessage: 'No exact match for proposed state' } }`.
3. **Implement `generateRoomPreview`**:
   - **Status**: Implemented in `lambda/ephemera/renderCache/generateRoomPreview.ts` and exported via `lambda/ephemera/renderCache/index.ts`. The helper:
     - Computes `perspectiveId = computePerspectiveId(assetStack)` using `lambda/ephemera/internalUtils/perspectiveId.ts`.
     - Delegates to `findExactMatchForComponent({ componentId: roomId, proposedMarkState: markState, perspectiveId })` from `lambda/ephemera/renderCache/exampleComparison.ts`.
     - Returns `{ success: true, renderedContent }` when an exact cache record match is found, or `{ success: false, errorCode: 'NO_EXACT_MATCH', errorMessage: 'No exact match for proposed state' }` when no match exists.
   - **Tests**: Covered by `lambda/ephemera/renderCache/generateRoomPreview.test.ts` (perspectiveId wiring, success/failure paths) and `lambda/ephemera/app.generateRoomPreview.test.ts` (WebSocket handler integration and ReturnValue shape).
4. **Document WebSocket contract**:
   - **Status**: Implemented. `lambda/ephemera/AGENT.event.md` now lists `generateRoomPreview` under Character Interaction Events and describes it as an authoring/development WebSocket message that returns either cached rendered content or a structured "no exact match" error wrapped in a `ReturnValue`.

*Deliverable*: Client can send `generateRoomPreview` with roomId, markState, and assetStack and receive a structured response (success + content, or error). Phase 4 is complete on the backend; Phase 5 will add the corresponding Room editor Preview UI and client-side WebSocket wiring.

---

### Phase 5: Preview UI in Room Workbench

**Goal**: Authors can propose a state, trigger generation, and see the result or error. Preview is a **separate section that authors navigate down into from the Room** (not an inline accordion inside the Room editor).

1. **Preview as a navigable view**:
   - From the Room editor, provide an entry point (e.g. "Preview" link or button) that **navigates** to a dedicated Preview view. The workbench breadcrumb becomes e.g. Asset > Room > Preview, so the Preview is a full content view the user has navigated into, consistent with how Examples and Guidance are reached by navigating from the Room.
   - In the Preview view: one input per Mark in the Room's Lens (Mark shortName/label + text input for Match value), a "Generate" button, and a result area (display rendered content or error). Room context (which Room, which Lens/Marks) is derived from the navigation context (e.g. the Room is the previous breadcrumb or encoded in the Preview entry).
2. **Wire to WebSocket**:
   - On Generate: build `markState` from current inputs; build **assetStack** from workbench context (current asset + inherited assets in order, e.g. from `useWorkbenchAsset().inheritedByAssetId` and currentAssetId). Send `generateRoomPreview` with roomId, markState, and assetStack to Ephemera (using the client's existing WebSocket/lifeline API).
   - Handle response: update UI with result or error. Match response shape to `{ generateRoomPreview: { success, renderedContent?, error? } }`.
3. **Edge cases**:
   - Room has no Lens / no Marks: in the Room, disable or hide the Preview entry point; in the Preview view, show "Add a Lens with Marks to use Preview" if reached without a valid Lens.
   - Loading state while waiting for Ephemera response.
   - RequestId correlation if client sends multiple requests.

*Deliverable*: Full authoring flow: Room -> navigate to Preview -> propose state -> Generate -> see exact match or "no exact match" error in the Preview pane.

---

### Phase 6: Integration and Polish

**Goal**: End-to-end flow works reliably; error handling and UX are acceptable.

1. **End-to-end test**: Room with Lens + Marks + Examples; propose exact state -> success; propose non-matching state -> error.
2. **Error message clarity**: Ensure "no exact match" message is actionable (e.g. suggests adding an Example for that state).
3. **Update AGENT.event.md**: Document `generateRoomPreview` in Content Integration or a new "Authoring Preview" section.

*Deliverable*: MVP is complete, documented, and ready for iteration (LLM generation, constellation search, etc.).

---

## Dependencies and Ordering

- **Phase 1** is independent; start here.
- **Phase 2a** (componentExamples) depends on understanding Assets component structure and Example lifecycle. Lives in Assets lambda.
- **Phase 2b** (ephemera.examples) depends on Phase 1 (Ephemera storage) and Phase 2a (componentExamples events).
- **Phase 3** depends on Phases 1 and 2 (cached Examples populated by mirror).
- **Phase 4** depends on Phase 3.
- **Phase 5** depends on Phase 4 (API contract).
- **Phase 6** depends on Phases 1-5.

**Suggested implementation order**: 1 -> 2a -> 2b -> 3 -> 4 -> 5 -> 6.

---

## Open Questions

- **Authoring session context**: For this first MVP, `generateRoomPreview` is a pure development/authoring tool; we assume it does not require character/session context for permissions, and that RoomId + markState + assetStack is sufficient for any Room the client can access.
- **Parent resolution in componentExamples (resolved)**: We enrich in **mtw.assets.componentExamples**, which has access to the Assets table. Reconstruct the Example's inheritance chain via `from` links; then for each asset in that chain, search all possible parent components (Room/Feature/Knowledge) to see which reference this Example. Inefficient but acceptable for first MVP. See Phase 2a and "Future: referencedBy denormalization" below.
- **Asset stack in mirroring (resolved)**: mtw.assets.componentExamples obtains the ordered asset stack by reconstructing the **inheritance chain of the Example component** from the place in the assets store where the change occurred. Use the `from` link in the data (via `ComponentData.byAssets` and each Example instance's `_from`) to walk backward (or through) the component's ancestry; that walk over the Assets DynamoDB table yields the ordered context stack for perspectiveId. For this MVP we derive ordering from component-level `_from` links and avoid depending on the global asset graph.
- **ExampleRemoved and delete (resolved)**: Store an optional attribute on each cache record (e.g. `authoredExampleId`) that links the record back to the blueprint Example that generated it. When mirroring sends ExampleRemoved(componentId, exampleId), Ephemera queries by componentId, filters by that attribute, and deletes the matching record(s). Without this attribute we could not reasonably maintain the link from example to cache items for removal.

---

## Future: referencedBy denormalization

When enriching Example events we currently search **all possible parent components** (Rooms, Features, Knowledge) in each asset in the inheritance chain to find who references the Example. A useful future optimization: **denormalize `referencedBy` (backlinks) into Example records** (still within the individual asset). When caching or publishing Example lifecycle events, each Example record could store a set of parent component IDs that reference it. Then parent resolution becomes "check the `referencedBy` set we store" instead of "scan every candidate parent." This would reduce cost and complexity in mtw.assets.componentExamples and could be maintained on write (when a Room/Feature/Knowledge's examples list changes, update the referenced Example's `referencedBy`).

---

## Related Documentation

- [AGENT.caching.planning.md](./AGENT.caching.planning.md) - Schema, key design, future direction
- [AGENT.event.md](./AGENT.event.md) - WebSocket events and message bus
- [renderCache/](./renderCache/) - Cache types, access layer (query/put/delete), comparison helpers (Phase 3), and tests
- [internalCache/examples.AGENT.md](./internalCache/examples.AGENT.md) - Current ExamplesData and storage
- [packages/mtw-interfaces/ts/ephemera.ts](../../packages/mtw-interfaces/ts/ephemera.ts) - EphemeraAPIMessage types
- [lambda/assets/AGENT.event.md](../assets/AGENT.event.md) - Assets data sources (pattern for mtw.assets.componentExamples)
- [lambda/assets/componentExamples/](../assets/componentExamples/) - mtw.assets.componentExamples (Phase 2a Tasks 1–3: filter + enrichment helpers and tests)
