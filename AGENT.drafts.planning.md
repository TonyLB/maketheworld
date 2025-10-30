# Multi-Draft Asset System - Planning Document

**Date**: October 29, 2025
**Status**: Planning / Design Phase
**Scope**: Cross-cutting feature affecting client UI, backend API, and data model

## Overview

This document outlines the design and implementation plan for transitioning from a single hard-coded draft asset per player to a flexible multi-draft system that allows players to maintain multiple independent draft assets for organizing thoughts and proposing changes.

### Current State

The existing draft system has significant limitations:
- **Single draft only**: Each player can have exactly one draft asset
- **Hard-coded ID**: The draft uses a special hard-coded identifier rather than standard `ASSET#${uuid}` format
- **Special handling burden**: Code must treat the draft as a special case throughout the system
- **Limited use cases**: Players cannot organize multiple independent proposals or thought processes

### Vision

A multi-draft system that enables:
- **Multiple drafts per player**: Each with its own `ASSET#${uuid}` universal key
- **Standard asset handling**: Drafts use the same data model and processing as other assets
- **Organizational flexibility**: Players can use drafts to separate different projects, proposals, or experimental work
- **Clear lifecycle management**: Creation, editing, promotion (to published), and deletion of drafts

---

## Getting Started

This section guides AI agents and human collaborators through the context needed to work on the multi-draft system. Follow these steps in order to build comprehensive understanding before making changes.

### 1. Understand Project Foundations

Read the root [`AGENT.md`](AGENT.md) to understand the overall architecture:

- **Why**: The multi-draft system touches multiple core systems (Client, Asset, WML) and you need to understand how they interact
- **Focus on**:
  - Project Overview and Core Architecture (lines 10-20)
  - Client System documentation link (line 131-133) - Authoring vs playing mode distinction is critical
  - Asset System concepts (line 17)
  - Documentation standards for maintaining consistency
- **Key Insight**: This is a cross-cutting feature, not a simple client-only or backend-only change

Read [`charcoal-client/AGENT.md`](charcoal-client/AGENT.md) for client architecture:

- **Why**: Understanding authoring vs playing mode is essential for draft management UX
- **Focus on**: How the client currently distinguishes between authoring and playing contexts
- **Key Insight**: Drafts should be authoring-mode features and not interfere with playing experience

Review [`AGENT.architecture.philosophy.md`](AGENT.architecture.philosophy.md) if it exists:

- **Why**: Understanding architectural principles helps make design decisions consistent with project philosophy
- **Focus on**: Data model patterns, state management, and separation of concerns

### 2. Read This Planning Document

Orient yourself within this document:

- **Start here**: Overview section (current state vs vision)
- **Then**: User Experience & Design Goals - understand the user-facing intent before technical details
- **Key Questions**: Review the "Key Questions to Resolve" section - these are the critical design decisions
- **Open Questions**: Check what's still being discussed
- **Structure**: Note that implementation details are deliberately deferred until design is solidified

### 3. Understand Current Hard-Coded Draft Implementation

**Client-side draft handling**:

Search for the current draft implementation in the client:
- **Why**: You need to understand what special handling exists for the single hard-coded draft
- **Look for**:
  - Hard-coded draft IDs or constants
  - Draft-specific UI components
  - State management for the current draft
  - How draft editing is triggered and managed
- **Search strategy**: `grep -r "draft" charcoal-client/src/` and look for patterns like hard-coded IDs, special constants, or draft-specific components

**Backend draft handling**:

Explore draft asset management in the backend:
- **Why**: Understanding how the current draft is stored, retrieved, and managed informs the new multi-draft data model
- **Look in**: `lambda/assets/` directory
- **Search strategy**: `grep -r "draft" lambda/assets/` to find draft-specific code paths
- **Key questions**:
  - How is the draft asset identified/keyed?
  - What special permissions or authorization apply?
  - How does the backend serve draft data to the client?

### 4. Review Asset Management Patterns

Study how regular (non-draft) assets work:

- **Why**: The goal is to make drafts use standard asset patterns, so understanding those patterns is essential
- **Focus on**:
  - How assets are created (asset creation flow)
  - How assets use `ASSET#${uuid}` keys
  - How assets are listed/discovered per player
  - Asset metadata structure
- **Look in**: `lambda/assets/` for asset CRUD operations
- **Key Insight**: We want drafts to follow these patterns, not be special cases

Read [`lambda/wml/s3Storage/AGENT.md`](lambda/wml/s3Storage/AGENT.md) to understand the storage layer:

- **Why**: **Critical discovery** - The storage layer already has a "Draft" zone concept and supports multiple draft assets
- **Focus on**:
  - **Supported Zones** section (line ~169-176) - Draft is already a first-class zone
  - **Storage Pattern** section (line ~14-42) - Assets use flat UUID-based paths (`{uuid}.wml`)
  - **Zone as S3 Tags** (line 38-40, 84) - Zone is metadata (S3 tags), not part of file structure
  - **Zone Transitions** section (line ~177-179) - How Draft assets can be "published" to Library/Canon
- **Key Insights**:
  - The storage layer **already supports multiple draft assets** with distinct `ASSET#${uuid}` keys
  - There's no structural limitation preventing multiple drafts per player
  - Current single-draft limitation is likely in **discovery/listing** logic, not storage
  - Publishing a draft means calling `changeZone` to move from Draft → Library/Canon
- **Design Impact**: This significantly simplifies the storage model - we don't need to change S3 structure, just how we query/list Draft zone assets per player

Study the `personalAssets` slice to understand the edit/save loop:

Read [`charcoal-client/src/slices/personalAssets/index.ts`](charcoal-client/src/slices/personalAssets/index.ts):

- **Why**: **Critical** - This reveals how draft editing currently works and where the hard-coded special cases exist
- **Focus on**:
  - **`saveEdit` function** (line ~258-276) - The save loop that sends edits to backend
  - **Hard-coded draft handling** (line 263-264) - Special case: `key === 'ASSET#draft'` converts to `ASSET#draft[${player}]`
  - **`updateStandard` function** (line ~242-256) - How user edits trigger autosave (5 second debounce)
  - **State management** in `baseClasses.ts` - `base`, `edit`, `pendingEdits`, `inherited` structure
- **Key Insights**:
  - The personalAssets slice is **already keyed by asset ID** - multiple entries can coexist
  - Current limitation is the **hard-coded `'ASSET#draft'` string** used throughout the client
  - The special-case handling (converting draft key for backend) is **exactly what we want to eliminate**
  - Save flow: User edit → `updateStandard` → debounced autosave → `saveEdit` → WebSocket `applyEdit` message
  - Backend subscription is to `ASSET#draft[${PlayerName}]`, receiving updates via `receiveWMLEvent`
- **Design Impact**:
  - Multi-draft means using real `ASSET#${uuid}` keys instead of the magic `'ASSET#draft'` string
  - The personalAssets SSM (State Seeking Machine) structure already supports multiple concurrent assets
  - Need to update all places that reference `'ASSET#draft'` to work with dynamic draft IDs
  - The save loop itself doesn't need to change - just remove the special-case conversion logic

Search for other hard-coded draft references:

- **Why**: Find all places that assume a single hard-coded draft ID
- **Command**: `grep -r "ASSET#draft" charcoal-client/src/`
- **Look for**: UI components, routing, navigation, initialization
- **Key question**: How pervasive is the hard-coded `'ASSET#draft'` assumption?

Investigate the player-asset discovery mechanism:

Read [`lambda/assets/internalCache/playerLibrary.ts`](lambda/assets/internalCache/playerLibrary.ts):

- **Why**: Understand what asset information the client currently receives and what's missing
- **Focus on**:
  - **`get` method** (line ~42-77) - PlayerIndex query that fetches player assets
  - **ProjectionFields** (line 58) - Notice `zone` is NOT included
  - **Asset mapping** (line 66-69) - What fields are returned to client
- **Key Discovery**:
  - Backend CAN query both Personal and Draft zone assets (any asset with the player field set)
  - But response does NOT include zone information
  - Client receives all assets in one undifferentiated `Assets` array without zone
- **Client Requirement Identified**:
  - Client needs zone field to distinguish Draft assets from Personal assets
  - Without zone, client cannot filter drafts for draft management UI
  - See "Client Requirements: Asset Zone Information" section for detailed analysis

Understand the complete save loop via `mtw.assets` DataSource:

Read [`lambda/assets/dataSource/index.ts`](lambda/assets/dataSource/index.ts) and [`lambda/assets/dataSource/caching/AGENT.md`](lambda/assets/dataSource/caching/AGENT.md):

- **Why**: **Critical for save loop** - This bridges WML storage to the subscription system that completes the optimistic-update cycle
- **The complete flow**:
  1. Client: `saveEdit` → WebSocket `applyEdit(requestId)` → adds edit to `pendingEdits` (optimistic)
  2. WML lambda: Receives applyEdit → writes to S3 via `appendChunk`
  3. WML DataSource: Publishes `mtw.wml` EventBridge event ("Content Update" with WML and requestId)
  4. **Assets DataSource**: Subscribes to `mtw.wml` events → triggers `cacheAsset` → syncs S3 changes to DynamoDB
  5. Subscriptions: Assets publishes updated data to subscribers of that asset stream
  6. Client: `receiveWMLEvent` receives subscription update → matches `requestId` → removes from `pendingEdits` → merges into `base`
- **Focus on**:
  - **`receiveEvents` handler** (line ~65-80 in dataSource/index.ts) - How it processes `mtw.wml` Content Update events
  - **`cacheAsset` function** (dataSource/caching/) - Syncs S3 asset data to DynamoDB for queries
  - **Event streaming** - How updates flow back to subscribers
- **Key Insights**:
  - The mtw.assets DataSource is the **bridge** between storage (S3) and queries/subscriptions (DynamoDB)
  - Without this bridge, optimistic edits would never be confirmed (pendingEdits would accumulate)
  - Multi-draft doesn't change this flow - each draft asset follows the same subscription pattern
  - The subscription is keyed by asset ID (`ASSET#draft[${player}]` currently, `ASSET#${uuid}` for multi-draft)
- **Design Impact**:
  - Each draft needs its own subscription to receive save confirmations
  - Client must subscribe to each draft asset it's editing
  - The backend already supports multiple concurrent subscriptions per player

### 5. Check Testing Patterns

**Client testing** (see [`charcoal-client/AGENT.testing.md`](charcoal-client/AGENT.testing.md)):

- **Why**: Understanding test patterns ensures new draft features are properly tested
- **Command**: `npm test` (watch mode) or `npm test -- --run` (single run)
- **Focus on**: React component testing patterns, user interaction testing
- **Look for examples**: Existing tests for authoring mode or asset editing components

**Backend testing**:

- **Why**: Backend draft operations need comprehensive test coverage
- **Command**: `npm run test` (watch mode) or `npm run test -- --watchAll=false` (single run)
- **Focus on**: Asset operation tests, permission/authorization tests
- **Look in**: `lambda/assets/` for test files

### 6. Identify Current Planning Phase

**We are in**: Design and planning phase

- **Current task**: Refining the user experience vision and resolving key design questions
- **Not yet started**: Implementation phases are outlined but marked as "detailed planning deferred"
- **Decision points**: Review "Key Questions to Resolve" and "Open Questions & Discussion" sections
- **Next milestone**: Complete design decisions and data model before starting implementation

**Track progress**:

- Design decisions are documented in the "Open Questions & Discussion" section
- As decisions are made, update the relevant sections and remove from open questions
- Implementation phases will be detailed once design is solidified

### 7. Establish Baseline Before Changes

**Client tests**:
```bash
cd charcoal-client
npm test -- --run
```
- **Expected**: All existing tests should pass (note the count)
- **Why**: Ensures you're starting from a clean state before making changes

**Backend tests** (if working on asset system):
```bash
cd lambda/assets
npm run test -- --watchAll=false
```
- **Expected**: All existing tests should pass
- **Why**: Baseline to verify changes don't break existing functionality

**Key principle**: Always verify the test baseline before starting work, then maintain or improve that baseline with your changes.

---

## User Experience & Design Goals

### Core User Interactions

#### Creating Drafts
- **Intent**: Players should be able to create a new draft asset as easily as they create other content
- **Discovery**: The UI should make it clear that multiple drafts are possible and encouraged for organization
- **Context**: Players might create drafts for:
  - Experimental room layouts before committing them
  - Proposing new features or items for collaboration
  - Organizing personal notes and world-building ideas
  - Preparing multiple alternative versions of content

#### Working with Multiple Drafts
- **Navigation**: Players need to see all their drafts and switch between them
- **Identification**: Each draft should have a clear name/title to distinguish it from others
- **Organization**: Players should be able to organize, rename, or describe their drafts

#### Draft Lifecycle
- **Editing**: Working on draft content should feel the same as current draft editing
- **Publishing/Promoting**: Clear path to "promote" a draft to a published asset
- **Archiving/Deletion**: Ability to clean up old or unwanted drafts
- **Persistence**: Drafts should be durable across sessions

#### Authoring vs Playing Mode
- **Authoring Mode**: Full access to draft management (create, edit, delete, organize)
- **Playing Mode**: Drafts should not interfere with gameplay experience
- **Mode Switching**: Transitioning between modes should preserve draft state

### Key Design Principles

- **Familiarity**: Draft editing should build on existing patterns players already know
- **Discoverability**: New players should understand that drafts are available
- **Non-intrusive**: The multi-draft system shouldn't complicate simple use cases

---

## Client Requirements: Asset Zone Information

**Discovered Need**: The client requires zone information to distinguish between draft and published personal assets.

### Current State

**What the client receives** (from `lambda/assets/internalCache/playerLibrary.ts`):
```typescript
type PlayerAssetInfo = {
    AssetId: string;
    scopedId: string;
    Story?: string;
    instance?: string;
    // NOTE: 'zone' is NOT included in current response
}
```

**What the client needs for multi-draft**:
- Ability to identify which player-owned assets are drafts (zone='Draft')
- Ability to distinguish drafts from published personal assets (zone='Personal')
- Store this zone information in the `personalAssets` slice alongside other asset metadata

### Why This Matters

**Current single-draft system**: The hard-coded `'ASSET#draft'` string serves as an implicit zone marker
- Client "knows" that `'ASSET#draft'` is a draft (by convention)
- All other player assets are implicitly Personal zone
- No need for explicit zone field

**Multi-draft system**: Assets use standard `ASSET#${uuid}` keys
- Multiple drafts and multiple personal assets share the same ID format
- Client cannot distinguish by ID alone
- **Explicit zone field required** to differentiate asset purpose

### Client-Side Storage Requirements

The `personalAssets` slice needs to store zone alongside each asset:
- **Use case 1**: Draft management UI needs to filter/display only Draft zone assets
- **Use case 2**: Published asset UI needs to exclude Draft zone assets
- **Use case 3**: Asset routing/navigation needs to know which editing context to use
- **Use case 4**: "Publish draft" action needs to identify that an asset is currently a draft

### Design Principle

Zone is a **first-class attribute** of player-owned assets, not a derived or implicit property.

**Implementation Note**: How the backend provides this zone information (included in existing API response, separate API endpoint, etc.) is a backend implementation detail to be resolved in implementation planning phase.

---

## Technical Architecture (High-Level)

### System Components Affected

#### Client (`charcoal-client/`)
- Draft list/management UI component
- Draft selection and switching
- Draft creation and deletion flows
- Integration with existing asset editing components
- State management for active draft

#### Backend (`lambda/assets/`)
- API endpoints for draft operations (list, create, delete)
- Draft asset storage and retrieval
- Permission/authorization for draft operations
- Draft metadata management

#### Data Model
- Draft assets use standard `ASSET#${uuid}` keys
- Distinguish drafts from published assets (metadata flag? naming convention? separate partition?)
- Player-to-drafts relationship tracking
- Draft metadata (name, created date, last modified, etc.)

### Key Questions to Resolve

1. **Draft Identification**: How do we distinguish draft assets from published assets?
   - ✅ **ANSWERED**: Draft assets use zone='Draft' in DynamoDB Meta::Asset records
   - ✅ **ANSWERED**: Personal assets use zone='Personal'
   - Both have the same `player` field and `ASSET#${uuid}` keys
   - Zone is stored in DynamoDB but not currently returned to client

2. **Discovery/Listing**: How does the client discover and manage the player's drafts?
   - ⚠️ **REQUIREMENT IDENTIFIED**: Client needs zone information for each player-owned asset
   - Currently: Backend returns assets without zone field
   - Needed: Client must be able to differentiate Draft vs. Personal zone assets
   - See "Client Requirements: Asset Zone Information" section for detailed analysis
   - Backend implementation approach to be determined in implementation phase

3. **Permissions**: What permissions model applies to drafts?
   - Drafts are always private to the creating player?
   - Can drafts be shared for collaboration?
   - How do permissions change when promoting to published?

4. **Naming/Metadata**: What metadata do drafts need?
   - Player-provided name/title?
   - Auto-generated names?
   - Creation and modification timestamps?
   - Brief description or tags?
   - **ShortName and Summary as Standard Metadata**: ShortName and Summary are implemented as standard fields for all assets and are canonical for asset naming and description. See:
      - `packages/mtw-wml/ts/standardize/AGENT.md`
      - `lambda/assets/dataSource/caching/AGENT.md`
      - `lambda/assets/contentHeaders/AGENT.md`
     Going forward, asset discovery, listing, and reporting endpoints should, whenever practical, include these fields as top-level properties for each asset (to enable best-UX labeling and description). For most user-facing and administrative endpoints, their inclusion is strongly encouraged; exceptions may be justified for minimal/caching endpoints where metadata can be elided for performance or payload reasons. Backends and clients should collaborate to preserve and pass through ShortName/Summary wherever practical.

---

## Subordinate Planning Documents

The following subordinate documents track sub-tasks that are architecturally independent but support the multi-draft system:

- Asset-level ShortName/Summary tags: Implemented (Phase 1–5 complete). See implementation notes in:
  - `packages/mtw-wml/ts/standardize/AGENT.md` (StandardForm metadata and diff behavior)
  - `packages/mtw-interfaces/ts/eventBridge/assets/index.ts` (Asset Updated contracts/serializer)
  - `lambda/assets/dataSource/caching/AGENT.md` (metadata emission)
  - `lambda/assets/contentHeaders/AGENT.md` (Asset Updated handling)

---

## Implementation Planning

### Phase 1: Foundation & Data Model
**Goal**: Establish a multi-draft-capable foundation without changing user-facing UI flows. Focus on data model, discovery, and removal of single-draft special cases. Leverage existing ShortName and Summary metadata already implemented.

- **Data model and storage (no structural S3 changes)**
  - Use existing `ASSET#${uuid}` keys for all drafts (no magic IDs).
  - Keep current flat S3 paths (`{uuid}.wml`) and zone as S3 tags; no bucket/key change.
  - Continue using zone values: **Draft** (drafts), **Personal** (published personal), and existing others (Library/Canon) unchanged.
  - Ensure `cacheAsset` persists `zone` to DynamoDB Meta::Asset and preserves ShortName/Summary.

- **Zone surfaced to client (discovery enablement)**
  - Update backend player-asset listing to include `zone` in results returned to the client.
  - Maintain existing fields (`AssetId`, `scopedId`, `Story`, `instance`) and add `zone` without breaking shape of other consumers.
  - Pagination/limits unchanged; zone is purely additive to enable client filtering.

- **Draft metadata schema (Phase 1 scope)**
  - Rely on existing Asset metadata: **ShortName** (display name), **Summary** (brief description).
  - Do not add new metadata fields in Phase 1; defer templates/tags to later phases.
  - UX label: For drafts, display ShortName prominently; fallback to generated label if absent (client responsibility in Phase 3).

- **Client: remove hard-coded `'ASSET#draft'` special cases**
  - Replace all usages of the magic `'ASSET#draft'` key with real `ASSET#${uuid}` handling.
  - In `personalAssets` save loop, delete the conversion of `ASSET#draft` to `ASSET#draft[${player}]`.
  - Ensure subscriptions use actual asset IDs for each draft; multiple concurrent draft edits are supported by existing infra.
  - Keep state model unchanged (entries keyed by asset ID already supported multiple items).

- **Discovery/listing mechanism (client-facing data contract)**
  - Client will filter player-owned assets by `zone === 'Draft'` to build the draft list.
  - Published personal items identified by `zone === 'Personal'`.
  - No client routing changes in Phase 1; only data availability to enable later UI work.

- **Backward-compatibility and transition**
  - If legacy clients reference `'ASSET#draft'`, continue to tolerate reads server-side by resolving to the player’s last-used draft if present; log warnings. This shim is temporary and can be removed after client rollout (Phase 4).
  - No data migration required; drafts are already first-class in storage; we are exposing zone and removing client special-casing.

- **Observability**
  - Add structured logs around: player-asset listing with `zone`, `cacheAsset` writes that include zone and metadata, and any legacy-draft alias resolutions.
  - Dashboard counters for number of Draft vs Personal assets per player (cardinality-safe sampling acceptable in Phase 1).

Deliverables
- Backend: player-asset listing includes `zone` for each asset owned by the player.
- Backend: `cacheAsset` guarantees zone and metadata (ShortName/Summary) correctness in Dynamo.
- Client (foundational refactor): removal of `'ASSET#draft'` special-casing in save/subscription paths while maintaining current UX.

Acceptance criteria
- Listing endpoint returns assets with accurate `zone` values for Draft and Personal items.
- Editing a draft identified by a real `ASSET#${uuid}` round-trips edits through the existing save → event → subscription flow without regressions.
- No reliance on `'ASSET#draft'` remains in the client save loop or subscription keys.
- ShortName/Summary for drafts are preserved from storage through to emitted events and cached records.

Risks and mitigations
- Risk: Client still references `'ASSET#draft'` in hidden paths.
  - Mitigation: Grep-based audit and runtime warning logs when aliasing is triggered; add test coverage.
- Risk: Zone not included in some cached projections.
  - Mitigation: Expand `cacheAsset` and player-asset projection tests; add canary assertions in listing code.
- Risk: Subscription mismatch if any code derives asset IDs from legacy patterns.
  - Mitigation: Centralize asset ID handling in client selectors/utilities and add unit tests.

### Implementation Checklist (Phase 1)

Backend
- Update player-asset listing to include `zone`:
  - Target: `lambda/assets/internalCache/playerLibrary.ts`
  - Actions:
    - Add `zone`, `ShortName`, and `Summary` to player asset query projection and returned asset shape.
    - Ensure mapping maintains all fields: `AssetId`, `Story`, `instance`, `zone`, `ShortName`, `Summary`.
    - Add unit tests for Draft vs Personal zones and for presence of ShortName/Summary when present.
  - Acceptance: Each asset in returned list includes `zone, AssetId, Story, instance, ShortName, Summary` (with ShortName/Summary present if defined in asset metadata). Client receives these for all player-owned assets.
  - Status: Completed (October 30, 2025)

- Event handling path sanity checks: Assessed; requestId correlation and zone/metadata propagation already correct. No code changes required.

Client
- Remove `'ASSET#draft'` special cases in save/subscription loop:
  - Target: `charcoal-client/src/slices/personalAssets/index.ts`
  - Actions:
    - Delete conversion logic for `key === 'ASSET#draft'` → `ASSET#draft[${player}]`.
    - Ensure autosave and subscription use real `ASSET#${uuid}`.
    - Add unit tests covering multiple concurrent drafts.
  - Acceptance: Edits to drafts identified by real IDs save and confirm normally.
  - Status: Completed (October 30, 2025). Unit tests for multi-draft behavior to be added in upcoming client test pass.

- Add zone awareness to client state where assets are stored:
  - Targets: `charcoal-client/src/slices/personalAssets/` (state and selectors)
  - Actions:
    - Store `zone` per asset in slice state.
    - Provide selector(s) for `Draft` vs `Personal` filtering (used later by UI).
    - Tests for selectors and state hydration from listing response.
  - Acceptance: State contains accurate `zone`; selectors return correct subsets.
  - Status: Completed (October 30, 2025). Zone hydrated via Player slice; selectors `getMyDraftAssets`/`getMyPersonalAssets` and tests added.

- Audit residual `'ASSET#draft'` references (defer removal to Phase 3.5):
  - Command guidance: `grep -r "ASSET#draft" charcoal-client/src/`
  - Targets: Routing, initialization, UI components identified.
  - Actions: Document location for future cleanup; defer removal until Phase 3 provides replacement UI.
  - Acceptance: All Phase 1 paths use real AssetUUID; legacy key usage documented for Phase 3.5 removal.

Observability
- Structured logs and counters:
  - Targets: Listing code, `cacheAsset`, and any alias path.
  - Actions:
    - Log asset counts by zone for player listings.
    - Emit warnings when aliasing legacy draft ID.
    - Add minimal metrics (if available) for Draft vs Personal counts.
  - Acceptance: Logs/metrics confirm zone flow without excessive noise.

Testing
- Backend tests:
  - `lambda/assets/internalCache/__tests__/playerLibrary.test.ts` (or nearest):
    - Asserts `zone` presence and correctness for mixed assets.
  - `lambda/assets/dataSource/caching/__tests__/cacheAsset.test.ts`:
    - Asserts zone and ShortName/Summary persistence.
  - Event flow tests in `lambda/assets/dataSource/__tests__/`:
    - Asserts Draft edits round-trip and update cache entries.

- Client tests:
  - `charcoal-client/src/slices/personalAssets/__tests__/index.test.ts`:
    - Removes reliance on `'ASSET#draft'` and verifies multi-draft save/subscription.
  - `charcoal-client/src/slices/personalAssets/__tests__/selectors.test.ts`:
    - Verifies zone-based selectors return correct asset lists.

Sign-off checks
- Grep shows remaining `'ASSET#draft'` usages documented (to be removed in Phase 3.5).
- Player listing returns `zone` for all assets; Draft and Personal correctly differentiated.
- Draft edits with real IDs save and confirm via subscription with pendingEdits cleared.

### Phase 2: Backend API (Reassessed)
**Goal**: Provide a minimal, additive API surface for multi-draft workflows, leveraging Phase 1 changes (zone surfaced; storage/event flow already generic for `ASSET#${uuid}`). Avoid reintroducing magic IDs or special-casing.

- What Phase 1 already enabled
  - Player-asset listing includes `zone`, `ShortName`, `Summary` for client-side filtering and labeling.
  - Storage and subscriptions already work for any asset ID; no S3 structural changes required.
  - Implication: A dedicated “List Drafts” endpoint is optional; the client can filter `zone === 'Draft'` from the general listing.

- API surface (minimal, additive)
  - Create Draft
    - Auth: owner (authenticated player).
    - Request: new `AssetId` (v4 UUID) or server-generated; optional seed WML; optional `ShortName`, `Summary`.
    - Response: `AssetId`, `zone: 'Draft'`, `ShortName?`, `Summary?`, timestamps.
    - Behavior: Use existing `applyEdit` with `createIfNeeded: true` and `zone: 'Draft'` to create the asset and write initial content/metadata; emit standard Asset Updated events.
  - Metadata updates via WML edits (no separate endpoint)
    - Use existing `applyEdit` to modify ShortName/Summary tags in the Asset’s StandardForm.
    - Phase 1 ensures `cacheAsset` persists these and listings include them.
  - Delete Draft (archive)
    - Auth: owner; only for `zone='Draft'` assets.
    - Request: path `AssetId`.
    - Response: archived asset summary with `zone: 'Archive'`.
    - Behavior: Use `moveAsset`/`changeZone` to move Draft → Archive (soft delete); emit events so clients update listings.
  - Publish Draft (changeZone)
    - Auth: owner for `targetZone='Personal'`; elevated roles as per existing rules for `Library`/`Canon`.
    - Request: `targetZone` in {`Personal`,`Library`,`Canon`}; optional `retainDraft=true|false` (copy vs move).
    - Response: target asset summary (same or new `AssetId` depending on retain policy) with `zone`/metadata.
    - Behavior: Use existing WML lambda `moveAsset`/storage `changeZone`; emit events for source and/or target as applicable.
  - Optional filtered listing
    - If desired for ergonomics/perf: `GET /player/assets?zone=Draft` returning the same shape as general listing, server-side filtered.

- Contracts and compatibility
  - Asset summary shape should include: `AssetId`, `zone`, `ShortName?`, `Summary?`, `Story?`, `instance?`, timestamps.
  - Backward compatibility: only additive fields; no breaking changes to existing consumers.

- Idempotency and errors
  - Create/Publish: support idempotency keys to avoid duplicates on retries.
  - 400 invalid `targetZone` or wrong zone for draft-only ops; 403 non-owner; 404 not found/not owned; 409 publish conflicts when applicable.

- Events and subscriptions
  - Reuse existing Asset Updated/Delete events so client optimistic/subscription flows remain unchanged.
  - For publish with copy, emit for both assets to keep caches consistent.

- Permissions (Phase 2 scope)
  - Drafts are private to the owner.
  - Publishing to Personal: owner allowed. Library/Canon: existing admin/editor roles.
  - No draft sharing yet (future phase).

- Observability
  - Structured logs: create/delete/publish with `playerId`, `AssetId`, `zone`, `targetZone`.
  - Counters: Draft vs Personal per player, consistent with Phase 1 metrics.

### Phase 3: Client UI
*Detailed planning deferred*

- Draft management interface
- Draft selection/switching
- Integration with existing editor
- State management updates

### Phase 3.5: Remove Legacy Draft Key Special-Casing
*Detailed planning deferred*

After Phases 2 and 3 provide working multi-draft functionality, remove remaining references to the legacy `'ASSET#draft'` magic key throughout the codebase:

- Remove `fetchDraftAsset` auto-subscription to magic draft key (player/index.api.ts)
- Update map import flow to use real draft AssetUUID instead of `ASSET#draft`
- Update navigation/routing that assumes single draft
- Remove any UI that assumes `assetKey === 'draft'` pattern
- Clean up backend shims that provide backward compatibility for legacy draft ID

**Prerequisite**: Phase 3 must be complete (UI for creating/selecting drafts must exist)

### Phase 4: Testing & Polish
*Detailed planning deferred*

- Comprehensive testing across client and backend
- Remove any remaining hard-coded draft assumptions
- UI/UX refinement
- Documentation updates

---

## Related Documentation

- **Client Architecture**: [`charcoal-client/AGENT.md`](charcoal-client/AGENT.md) - Frontend system with authoring vs playing mode distinction
- **Asset System**: [`lambda/assets/`](lambda/assets/) - Backend asset management
- **Development Roadmap**: [`AGENT.development.md`](AGENT.development.md) - Master planning for major migrations

---

## Open Questions & Discussion

*This section will evolve as we explore the design*

### Questions for Discussion

1. **Draft Limits**: Should there be a maximum number of drafts per player?
2. **Draft Size**: Should drafts have size limitations different from published assets?
3. **Draft Sharing**: Future consideration for collaborative drafts?
4. **Auto-save**: How frequently should draft changes persist?
5. **Draft Templates**: Would pre-configured draft templates be useful?

### Design Decisions Needed

- Draft identification strategy (see "Key Questions" above)
- Draft metadata schema
- UI patterns for draft management
- Approach for providing zone information to client

---

## Next Steps

1. **Read & Review**: Review this planning document and refine the user experience vision
2. **Explore Current Implementation**: Understand how the current hard-coded draft works
3. **Design Data Model**: Make key decisions about draft storage and identification
4. **Prototype UI Mockups**: Sketch the draft management interface
5. **Plan Backend Changes**: Design the API surface for draft operations
6. **Create Implementation Checklist**: Break down into concrete, actionable tasks

---

## Notes

*Track important insights, decisions, and context as the planning evolves*

- **Initial Motivation**: Moving from hard-coded single draft to flexible multi-draft system
- **Core Benefit**: Allows players to organize thoughts and proposals into independent blocks
- **Key Complexity**: Cross-cutting change affecting client, backend, and data model

---

## Ongoing Development Issues

- scopedId Removed from General Assets:
    - scopedId is no longer present in the LibraryAsset type or general asset APIs.
    - It is reserved for Character-related flows (e.g., friendly URL routing for characters in the client) until all migration is complete.
    - TODO: Plan and execute full removal from codebase and database (including indexes and projection fields) after all dependencies are migrated off scopedId.

