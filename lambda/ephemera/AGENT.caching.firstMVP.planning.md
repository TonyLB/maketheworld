# Ephemera Caching - First MVP Implementation Plan

**Status: PLANNING**

This document lays out concrete steps from the current state (no caching code in Ephemera) to a working first MVP that:

- Accomplishes exact matches (proposed Mark state -> matching Example)
- Sends an error when no exact match occurs
- Provides a Preview pane in the Room authoring UI to exercise the flow

Prerequisite reading: [AGENT.caching.planning.md](./AGENT.caching.planning.md).

---

## Current State

- **Ephemera**: No code for the description caching system. `internalCache/ExamplesData` fetches authored Examples from the Assets table (assetDB) for perception; it does not read or write the new Ephemera cache (CACHE#) records.
- **Ephemera DynamoDB** (ephemeraDB): Uses `EphemeraId` and `DataCategory` as keys. No `ROOM#...` / `CACHE#...` records yet.
- **WebSocket**: Ephemera handles `EphemeraAPIMessage` types (fetchEphemera, registercharacter, action, link, etc.). No `generateRoomPreview` (or equivalent) message.
- **Client**: Room editor has LensEditor, Example editors, Guidance editors. No Preview section. No WebSocket dispatch for preview generation.
- **Example data**: Authored Examples live in the Assets table. StandardExample has marks (MarkFacets) for world-state; Assets query may need extension to include marks for comparison.

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
   - `queryCacheRecordsForComponent(componentId)`: Query ephemeraDB where `EphemeraId = componentId` and `DataCategory begins_with 'CACHE#'`. Return array of records (markState, renderedContent, provenance, perspectiveId, DataCategory for delete). No lookup by Example ID.
   - `putCacheRecord(componentId, record)`: Generate a new UUID, put a single record with `DataCategory = 'CACHE#' + uuid`. Record must include perspectiveId (hash of ordered asset stack). For records from the mirror (authored), include `authoredExampleId` (blueprint Example UUID) so we can target delete on ExampleRemoved.
   - `deleteCacheRecord(componentId, dataCategory)`: Delete the record with the given DataCategory (e.g. `CACHE#uuid`). For mirror "ExampleRemoved": query by componentId, filter by `authoredExampleId`, delete matching record(s).
3. **Unit tests** for query, put, and delete, with mocked ephemeraDB.

*Deliverable*: Ephemera can store and retrieve cache records by component; each record has a synthetic CACHE#uuid and a perspectiveId.

---

### Phase 2: Mirroring Pipeline

**Goal**: Authored Examples are mirrored from Assets into the Ephemera cache via event-driven sync. Each mirrored record uses `CACHE#${newUuid}` and includes **perspectiveId** (hash of the ordered asset stack for that resolved example). Ephemera treats authored and generated records identically (except for provenance).

#### Phase 2a: mtw.assets.componentExamples

A new data source in the Assets hierarchy that publishes Example lifecycle events for any component that can have Example references (Room, Feature, Knowledge). It has access to the Assets table and **enriches** each event with parent `componentId` and asset stack before publishing.

1. **Subscribe to mtw.assets** Component Updated / Component Removed events.
2. **Detect Example-associated changes**:
   - (a) Example reference **added** to a parent component
   - (b) Example reference **removed** from a parent component
   - (c) Example **content changed** (displayName, summary, description, marks)
3. **Enrich in this data source** (using the Assets table): For each change, the parent component(s) (Rooms/Features/Knowledge) and the ordered **asset stack** are not guaranteed to be in the asset where the edit occurred (the Example may be inherited; the parent reference may live in an earlier asset). So we (a) reconstruct the Example's inheritance chain via `from` links across the Assets table to get the ordered asset stack, and (b) for each asset in that chain, search **all possible parent components** (Rooms, Features, Knowledge) to find which ones reference this Example. Inefficient (scan candidates per asset in the chain), but acceptable for first MVP.
4. **Publish events** with `parentIds` (array of parent componentIds: Room, Feature, or Knowledge), `exampleId`, Example data, and **asset stack** (ordered list of asset IDs; merge order is significant):
   - `ExampleAdded`: { parentIds, exampleId, assetStack, example: { markState, renderedContent, provenance: { type: 'authored' } } }
   - `ExampleRemoved`: { parentIds, exampleId }
   - `ExampleUpdated`: { parentIds, exampleId, assetStack, example: { markState, renderedContent, provenance: { type: 'authored' } } }
5. **Stream key**: Use `exampleId` (or assetId) as the streamKey; `parentIds` labels which parents this Example event affects.

*Deliverable*: mtw.assets.componentExamples publishes Example lifecycle events enriched with parentIds and asset stack for perspectiveId computation.

#### Phase 2b: mtw.ephemera.examples

A data source (or receive handler) in Ephemera that subscribes to `mtw.assets.componentExamples` and keeps the Ephemera cache in sync.

1. **Subscribe to mtw.assets.componentExamples** (via EventBridge subscription and deserializer).
2. **On ExampleAdded / ExampleUpdated**: Compute `perspectiveId = hash(ordered assetStack)`. For each `parentId` in `parentIds`, call `putCacheRecord(parentId, { ...record, perspectiveId, authoredExampleId: exampleId })` to write a new cache record (CACHE#uuid) for that parent component. Store `authoredExampleId` so ExampleRemoved can target the right record(s).
3. **On ExampleRemoved**: For each `parentId` in `parentIds`, query cache by `componentId = parentId`, filter by `authoredExampleId === exampleId`, delete matching record(s).
4. **No parent resolution in Ephemera**: The componentExamples payload provides parentIds and assetStack; Ephemera only reads/writes.

*Deliverable*: Authored Examples are mirrored into the Ephemera cache with perspectiveId for each parent component; Ephemera has a single source of truth for cache at render time.

---

### Phase 3: Example Comparison

**Goal**: Ephemera can obtain all relevant cache records for a component and compare Mark state for exact match, optionally scoped by perspective.

1. **Fetch cache records from Ephemera only**: Call `queryCacheRecordsForComponent(componentId)`. Authored (mirrored) and generated records are both in the cache; provenance differentiates when needed.
2. **Implement exact-match logic**:
   - `findExactMatch(componentId, proposedMarkState, records, perspectiveId?)`: Normalize proposed state and each record's markState (e.g. sorted Mark UUID + value pairs), compare. If `perspectiveId` is provided (from the request's asset stack), filter candidates to that perspective first. Return matching record or null.
3. **Normalize markState format** for comparison: canonical form (e.g. `[{ mark, value }]` sorted by mark) so that ordering does not affect match.

*Deliverable*: Given componentId + proposed markState + optional assetStack (for perspectiveId), we can deterministically find an exact match among cache records, or conclude none exists.

---

### Phase 4: WebSocket Handler and API Contract

**Goal**: Ephemera responds to a new WebSocket message with either success (rendered content) or error (no match).

1. **Define API message** in `mtw-interfaces`:
   - `GenerateRoomPreviewAPIMessage`: `{ message: 'generateRoomPreview'; RoomId: EphemeraRoomId; markState: { markValue: Array<{ mark: string; value: string }> }; assetStack: AssetUUID[] }` (assetStack = ordered list of asset IDs for resolution context; client sends workbench's current asset + inherited assets in order).
   - Add to `EphemeraAPIMessage` union and `isEphemeraAPIMessage` (or add `isGenerateRoomPreviewAPIMessage`).
2. **Wire handler in `app.ts`**:
   - When `isGenerateRoomPreviewAPIMessage(request)`:
     - Call `generateRoomPreview({ roomId, markState, assetStack })`
     - On match: `messageBus.send({ type: 'ReturnValue', body: { generateRoomPreview: { success: true, renderedContent } } })`
     - On no match: `messageBus.send({ type: 'ReturnValue', body: { generateRoomPreview: { success: false, error: 'No exact match for proposed state' } } })`
3. **Implement `generateRoomPreview`**:
   - Compute `perspectiveId = hash(ordered assetStack)` (same canonical form as when writing records).
   - Fetch cache records for Room via `queryCacheRecordsForComponent(roomId)`.
   - Find exact match via `findExactMatch(roomId, markState, records, perspectiveId)` (filter by perspectiveId so only records for this asset stack are considered).
   - If match: return record's renderedContent (displayName, summary, description).
   - If no match: return error.

*Deliverable*: Client can send `generateRoomPreview` with roomId, markState, and assetStack and receive a structured response (success + content, or error).

---

### Phase 5: Preview UI in Room Workbench

**Goal**: Authors can propose a state, trigger generation, and see the result or error in the Room editor.

1. **Add Preview section** to Room editor (e.g. new accordion or section below Lens/Examples):
   - One input per Mark in the Room's Lens (Mark shortName/label + text input for Match value).
   - "Generate" button.
   - Result area: display rendered content (DisplayName, Summary, Description) or error message.
2. **Wire to WebSocket**:
   - On Generate: build `markState` from current inputs; build **assetStack** from workbench context (current asset + inherited assets in order, e.g. from `useWorkbenchAsset().inheritedByAssetId` and currentAssetId). Send `generateRoomPreview` with roomId, markState, and assetStack to Ephemera (using the client's existing WebSocket/lifeline API).
   - Handle response: update UI with result or error. Match response shape to `{ generateRoomPreview: { success, renderedContent?, error? } }`.
3. **Edge cases**:
   - Room has no Lens / no Marks: disable Preview or show "Add a Lens with Marks to use Preview."
   - Loading state while waiting for Ephemera response.
   - RequestId correlation if client sends multiple requests.

*Deliverable*: Full authoring flow: propose state -> Generate -> see exact match or "no exact match" error in Preview pane.

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
- **Asset stack in mirroring (resolved)**: mtw.assets.componentExamples obtains the ordered asset stack by reconstructing the **inheritance chain of the Example component** from the place in the assets store where the change occurred. Use the `from` link in the data to walk backward (or through) the component's ancestry; that walk over the Assets DynamoDB table yields the ordered context stack for perspectiveId. Expected to be a straightforward DynamoDB traversal.
- **ExampleRemoved and delete (resolved)**: Store an optional attribute on each cache record (e.g. `authoredExampleId`) that links the record back to the blueprint Example that generated it. When mirroring sends ExampleRemoved(componentId, exampleId), Ephemera queries by componentId, filters by that attribute, and deletes the matching record(s). Without this attribute we could not reasonably maintain the link from example to cache items for removal.

---

## Future: referencedBy denormalization

When enriching Example events we currently search **all possible parent components** (Rooms, Features, Knowledge) in each asset in the inheritance chain to find who references the Example. A useful future optimization: **denormalize `referencedBy` (backlinks) into Example records** (still within the individual asset). When caching or publishing Example lifecycle events, each Example record could store a set of parent component IDs that reference it. Then parent resolution becomes "check the `referencedBy` set we store" instead of "scan every candidate parent." This would reduce cost and complexity in mtw.assets.componentExamples and could be maintained on write (when a Room/Feature/Knowledge's examples list changes, update the referenced Example's `referencedBy`).

---

## Related Documentation

- [AGENT.caching.planning.md](./AGENT.caching.planning.md) - Schema, key design, future direction
- [AGENT.event.md](./AGENT.event.md) - WebSocket events and message bus
- [internalCache/examples.AGENT.md](./internalCache/examples.AGENT.md) - Current ExamplesData and storage
- [packages/mtw-interfaces/ts/ephemera.ts](../../packages/mtw-interfaces/ts/ephemera.ts) - EphemeraAPIMessage types
- [lambda/assets/AGENT.event.md](../assets/AGENT.event.md) - Assets data sources (pattern for mtw.assets.componentExamples)
