# Ephemera Caching - First MVP Implementation Plan

**Status: PLANNING**

This document lays out concrete steps from the current state (no caching code in Ephemera) to a working first MVP that:

- Accomplishes exact matches (proposed Mark state -> matching Example)
- Sends an error when no exact match occurs
- Provides a Preview pane in the Room authoring UI to exercise the flow

Prerequisite reading: [AGENT.caching.planning.md](./AGENT.caching.planning.md).

---

## Current State

- **Ephemera**: No code for the description caching system. `internalCache/ExamplesData` fetches authored Examples from the Assets table (assetDB) for perception; it does not read or write the new Ephemera EXAMPLE cache records.
- **Ephemera DynamoDB** (ephemeraDB): Uses `EphemeraId` and `DataCategory` as keys. No `ROOM#...` / `EXAMPLE#...` records yet.
- **WebSocket**: Ephemera handles `EphemeraAPIMessage` types (fetchEphemera, registercharacter, action, link, etc.). No `generateRoomPreview` (or equivalent) message.
- **Client**: Room editor has LensEditor, Example editors, Guidance editors. No Preview section. No WebSocket dispatch for preview generation.
- **Example data**: Authored Examples live in the Assets table. StandardExample has marks (MarkFacets) for world-state; Assets query may need extension to include marks for comparison.

---

## Target State (MVP)

1. **Backend**: Ephemera accepts a `generateRoomPreview` WebSocket message with `roomId` and `markState`. Fetches cached Examples from Ephemera (authored Examples mirrored via pipeline; generated Examples written at render time). Compares markState. On exact match: returns rendered content via ReturnValue. On no match: returns error via ReturnValue.
2. **Ephemera DynamoDB**: New module/handler that reads and writes EXAMPLE records (EphemeraId: `componentId` - e.g. `ROOM#...`, `FEATURE#...`, `KNOWLEDGE#...`; DataCategory: `EXAMPLE#${exampleId}`) with markState, renderedContent, provenance.
3. **Mirroring Pipeline**: `mtw.assets.componentExamples` publishes Example lifecycle events; `mtw.ephemera.examples` subscribes and keeps the Ephemera EXAMPLE cache in sync with the blueprint.
4. **Client**: Room editor has a Preview section: Mark value inputs per Mark in the Room's Lens, Generate button, result/error display.

---

## High-Level Phases

### Phase 1: Ephemera Storage and Data Access

**Goal**: Ephemera can read and write EXAMPLE cache records.

1. **Define types and constants** for the cache record shape (markState, renderedContent, provenance) per [AGENT.caching.planning.md](./AGENT.caching.planning.md).
2. **Implement Ephemera EXAMPLE access layer** (use `componentId` throughout - Room, Feature, or Knowledge):
   - `queryExamplesForComponent(componentId)`: Query ephemeraDB where `EphemeraId = componentId` (e.g. `ROOM#...`, `FEATURE#...`, `KNOWLEDGE#...`) and `DataCategory begins_with 'EXAMPLE#'`. Return array of records (markState, renderedContent, provenance, exampleId).
   - `putExample(componentId, exampleId, record)`: Put/update a single EXAMPLE record.
   - `deleteExample(componentId, exampleId)`: Delete a single EXAMPLE record (for mirror removals).
3. **Unit tests** for query, put, and delete, with mocked ephemeraDB.

*Deliverable*: Ephemera can store and retrieve cached Example records by component (Room, Feature, or Knowledge).

---

### Phase 2: Mirroring Pipeline

**Goal**: Authored Examples are mirrored from Assets into the Ephemera EXAMPLE cache via event-driven sync. Ephemera treats authored and generated Examples identically (except for provenance).

#### Phase 2a: mtw.assets.componentExamples

A new data source in the Assets hierarchy that publishes Example lifecycle events for any component that can have Example references (Room, Feature, Knowledge).

1. **Subscribe to mtw.assets** Component Updated / Component Removed events.
2. **Detect Example-associated changes**:
   - (a) Example reference **added** to a parent component
   - (b) Example reference **removed** from a parent component
   - (c) Example **content changed** (displayName, summary, description, marks)
3. **Publish events** with `componentId` (parent: Room, Feature, or Knowledge), `exampleId`, and Example data:
   - `ExampleAdded`: { componentId, exampleId, example: { markState, renderedContent, provenance: { type: 'authored' } } }
   - `ExampleRemoved`: { componentId, exampleId }
   - `ExampleUpdated`: { componentId, exampleId, example: { markState, renderedContent, provenance: { type: 'authored' } } }
4. **Stream key**: Use `componentId` so subscribers can filter by parent component.

*Deliverable*: mtw.assets.componentExamples publishes Example lifecycle events for any component type with Example references.

#### Phase 2b: mtw.ephemera.examples

A data source (or receive handler) in Ephemera that subscribes to `mtw.assets.componentExamples` and keeps the Ephemera EXAMPLE cache in sync.

1. **Subscribe to mtw.assets.componentExamples** (via EventBridge subscription and deserializer).
2. **On ExampleAdded / ExampleUpdated**: Call `putExample(componentId, exampleId, record)` to write the mirrored Example to ephemeraDB.
3. **On ExampleRemoved**: Call `deleteExample(componentId, exampleId)` to remove the record from ephemeraDB.
4. **No parent resolution in Ephemera**: The componentExamples payload provides `componentId`; Ephemera only reads/writes.

*Deliverable*: Authored Examples are mirrored into the Ephemera cache; Ephemera has a single source of truth for Examples at render time.

---

### Phase 3: Example Comparison

**Goal**: Ephemera can obtain all relevant Examples from its cache and compare Mark state for exact match.

1. **Fetch Examples from Ephemera only**: Call `queryExamplesForComponent(componentId)`. Authored Examples (mirrored) and generated Examples (written at render time) are both in the cache; provenance differentiates them when needed.
2. **Implement exact-match logic**:
   - `findExactMatch(componentId, proposedMarkState, examples)`: Normalize proposed state and each Example's markState (e.g. sorted Mark UUID + value pairs), compare. Return matching Example or null.
3. **Normalize markState format** for comparison: canonical form (e.g. `[{ mark, value }]` sorted by mark) so that ordering does not affect match.

*Deliverable*: Given componentId + proposed markState, we can deterministically find an exact match among cached Examples (authored or generated), or conclude none exists.

---

### Phase 4: WebSocket Handler and API Contract

**Goal**: Ephemera responds to a new WebSocket message with either success (rendered content) or error (no match).

1. **Define API message** in `mtw-interfaces`:
   - `GenerateRoomPreviewAPIMessage`: `{ message: 'generateRoomPreview'; RoomId: EphemeraRoomId; markState: { markValue: Array<{ mark: string; value: string }> } }`
   - Add to `EphemeraAPIMessage` union and `isEphemeraAPIMessage` (or add `isGenerateRoomPreviewAPIMessage`).
2. **Wire handler in `app.ts`**:
   - When `isGenerateRoomPreviewAPIMessage(request)`:
     - Call `generateRoomPreview({ roomId, markState })`
     - On match: `messageBus.send({ type: 'ReturnValue', body: { generateRoomPreview: { success: true, renderedContent } } })`
     - On no match: `messageBus.send({ type: 'ReturnValue', body: { generateRoomPreview: { success: false, error: 'No exact match for proposed state' } } })`
3. **Implement `generateRoomPreview`**:
   - Fetch cached Examples for Room via `queryExamplesForComponent(roomId)`. Authored Examples are mirrored (Phase 2); generated Examples are written at render time (future).
   - Find exact match via `findExactMatch(roomId, markState, examples)`.
   - If match: return Example content (displayName, summary, description).
   - If no match: return error.

*Deliverable*: Client can send `generateRoomPreview` and receive a structured response (success + content, or error).

---

### Phase 5: Preview UI in Room Workbench

**Goal**: Authors can propose a state, trigger generation, and see the result or error in the Room editor.

1. **Add Preview section** to Room editor (e.g. new accordion or section below Lens/Examples):
   - One input per Mark in the Room's Lens (Mark shortName/label + text input for Match value).
   - "Generate" button.
   - Result area: display rendered content (DisplayName, Summary, Description) or error message.
2. **Wire to WebSocket**:
   - On Generate: build `markState` from current inputs, send `generateRoomPreview` to Ephemera (using the client's existing WebSocket/lifeline API).
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

- **Authoring session context**: Does `generateRoomPreview` require a character/session (e.g. for permissions), or is it sufficient to pass RoomId + markState for any Room the client can access?
- **Parent resolution in componentExamples**: When an Example content changes, how does the componentExamples source derive the parent `componentId` (Room/Feature/Knowledge)? Options: enrich event at cache time, load asset structure in handler, or maintain a reverse index.

---

## Related Documentation

- [AGENT.caching.planning.md](./AGENT.caching.planning.md) - Schema, key design, future direction
- [AGENT.event.md](./AGENT.event.md) - WebSocket events and message bus
- [internalCache/examples.AGENT.md](./internalCache/examples.AGENT.md) - Current ExamplesData and storage
- [packages/mtw-interfaces/ts/ephemera.ts](../../packages/mtw-interfaces/ts/ephemera.ts) - EphemeraAPIMessage types
- [lambda/assets/AGENT.event.md](../assets/AGENT.event.md) - Assets data sources (pattern for mtw.assets.componentExamples)
