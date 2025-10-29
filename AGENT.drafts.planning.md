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

---

## Implementation Planning

### Phase 1: Foundation & Data Model
*Detailed planning deferred*

- Define draft asset storage pattern
- Design draft metadata schema
- Remove hard-coded `'ASSET#draft'` special cases
- Design draft listing/discovery mechanism

### Phase 2: Backend API
*Detailed planning deferred*

- Implement draft CRUD operations
- Add authorization/permissions
- Create draft listing endpoint
- Provide zone information to client

### Phase 3: Client UI
*Detailed planning deferred*

- Draft management interface
- Draft selection/switching
- Integration with existing editor
- State management updates

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

