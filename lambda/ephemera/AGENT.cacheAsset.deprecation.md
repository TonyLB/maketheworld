# Cache Asset Deprecation Plan

## Overview

This document outlines the systematic removal of legacy functions in the `ephemera` lambda that cached Asset structure data in the `ephemera` DynamoDB table. The goal is to refactor the codebase so that all asset-related data access properly uses the dedicated `assets` table instead of relying on cached asset structures in the `ephemera` table.

## Purpose

This document will serve as our working design and assessment tool for:
- Identifying legacy cache asset functions that need to be removed
- Cataloging code that expects to find asset data in the `ephemera` table
- Planning the migration path from `ephemera` table to `assets` table
- Ensuring no functionality is lost during the deprecation process
- Creating a step-by-step implementation plan

## InternalCache Class Categorization

Based on analysis of the complete `internalCache` implementation, here is the comprehensive categorization of all cache classes:

### ✅ Concerns Asset data, is already migrated to use `assets` Dynamo table
- **`ComponentMetaData`** - Already uses `assetDB` instead of `ephemeraDB` (lines 87-90 in componentMeta.ts)

### ❌ Concerns Asset data, needs to be migrated
- **`CacheAssetMetaData`** - Uses `ephemeraDB` to check if assets exist (DataCategory: 'Meta::Asset')
- **`CacheAssetRoomsData`** - Uses `ephemeraDB` to find rooms associated with assets
- **`CacheRoomAssetsData`** - Uses `ephemeraDB` to get cached asset lists for rooms (DataCategory: 'Meta::Room')
- **`ExamplesData`** - Uses `ephemeraDB` to query for EXAMPLE# data categories (lines 39-46 in examples.ts)
- **`GraphCacheType`** - **ASSET DEPENDENCY GRAPH**: Stores relationships between Assets, Variables, Computed, Rooms, Features, and Maps in ephemeraDB with DataCategory 'Graph::Forward' and 'Graph::Back'. Used for:
  - Finding descendant rooms from assets (checkLocation)
  - Determining possible maps from room positions (characterPossibleMaps) 
  - Canon update dependency resolution (canonUpdate)
  - **CRITICAL**: This stores asset dependency relationships that should be migrated to assets table

### ✅ Concerns Ephemera data (state of the world, not design)
- **`CacheCharacterMetaData`** - Character state (location, room stack, etc.) from ephemeraDB
- **`CacheRoomCharacterListsData`** - Active characters in rooms from ephemeraDB
- **`CacheCharacterPossibleMapsData`** - Derived from character state and graph relationships

### ✅ Concerns clearly internal/support functionality
- **`CachePlayerMetaData`** - Player connection metadata from ephemeraDB
- **`CachePlayerSessionsData`** - Player session tracking from connectionDB
- **`CacheCharacterSessionsData`** - Character session tracking from connectionDB
- **`CacheSessionConnectionsData`** - Session connection management (from mtw-sessions package)
- **`CacheGlobalData`** - Global state management (connections, assets list, etc.)
- **`CacheAssetAddressData`** - In-memory workspace address mapping (no DB calls)
- **`OrchestrateMessagesData`** - Message ordering logic (no DB calls)
- **`ComponentRenderData`** - Component rendering orchestration (depends on other caches, no direct DB calls)

## Legacy Functions Analysis

### Functions That Don't Belong in Ephemera Domain (Should Be Removed)

These functions deal with **structural Asset information** rather than ephemeral world-state and should be removed from the ephemera lambda:

#### ❌ `cacheAsset` - **REMOVE FROM EPHEMERA**
- **Purpose**: Reads asset data from S3 data lake and caches it in ephemeraDB
- **What it does**: 
  - Takes asset/character IDs and caches their structural data in ephemeraDB
  - Updates graph dependencies for asset relationships
  - Sends perception messages for room updates
- **Why it doesn't belong**: This is **asset structure management**, not ephemeral state
- **Should go to**: Assets lambda or dedicated asset management service

#### ❌ `decacheAsset` - **REMOVE FROM EPHEMERA** 
- **Purpose**: Removes cached asset data from ephemeraDB
- **What it does**:
  - Removes asset metadata from ephemeraDB (DataCategory: 'Meta::Asset' or 'Meta::Character')
  - Updates graph dependencies by clearing edges
- **Why it doesn't belong**: This is **asset structure management**, not ephemeral state
- **Should go to**: Assets lambda or dedicated asset management service

#### ❌ `canonUpdate` - **REMOVE FROM EPHEMERA**
- **Purpose**: Manages the canonical asset list and dependency ordering
- **What it does**:
  - Updates global asset list in ephemeraDB (DataCategory: 'Assets')
  - Performs topological sort of asset dependencies using graph data
  - Sends perception/checkLocation messages for asset changes
- **Why it doesn't belong**: This is **asset dependency management**, not ephemeral state
- **Should go to**: Assets lambda or dedicated asset management service

#### ❌ `dependentMessages` - **REMOVE FROM EPHEMERA**
- **Current state**: Only contains `graphCache.ts` - graph storage database handler
- **Purpose**: Provides graph storage infrastructure for asset dependency tracking
- **What it does**:
  - Creates `graphStorageDB` - a database handler for graph operations on ephemeraDB
  - Exports `graphCache` - graph cache instance for dependency management
  - **Used by**: `cacheAsset` and `decacheAsset` for updating graph dependencies
- **Legacy references**: Documentation mentions `dependencyCascade.ts` which no longer exists (was removed)
- **Why it doesn't belong**: This is **asset dependency infrastructure**, not ephemeral state
- **Should go to**: Assets lambda or dedicated asset management service

### Functions That Belong in Ephemera Domain (Keep)

These functions deal with **ephemeral world-state** and should remain in the ephemera lambda:
- `characterEvents`, `checkLocation`, `ephemeraUpdate`, `fetchEphemera`
- `guestCharacter`, `moveCharacter`, `parse`, `perception`, `publishMessage`
- `registerCharacter`, `returnValue`, `roomUpdate`, `mapSubscription`, `mapUpdate`
- `disconnectMessage`, `messageBus`

## Cache Class Usage Analysis

**❌ Cache Classes That Can Be REMOVED (Only Used by Removable Functions):**
- **`CacheAssetMetaData`** - Only used by `cacheAsset` (which we're removing)

**✅ Cache Classes That Need Migration to Assets Table (Read-Only Access):**
- **`CacheAssetRoomsData`** - Used by `perception` (should remain in ephemera)
- **`CacheRoomAssetsData`** - Used by `moveCharacter` (should remain in ephemera)  
- **`ExamplesData`** - Used by `ComponentRenderData` (should remain in ephemera)
- **`GraphCacheType`** - Used by `CharacterPossibleMapsData` (should remain in ephemera)

**Key Architectural Insight**: These cache classes need to be **migrated to read from the assets table** instead of the ephemera table, but the ephemera lambda will retain **read-only access** to asset data. The ephemera lambda needs to read asset information to perform its world-state functions, but it won't have authority to modify asset data.

## Event Bridging and Ephemera Responses

To preserve ephemera side-effects when removing `cacheAsset`, `decacheAsset`, `canonUpdate`, and graph writes from ephemera, we will consume the concrete events already emitted by WML and Assets, and trigger existing ephemera flows (`Perception`, `CheckLocation`) without managing asset structures directly.

- 'Component Updated' (source: `mtw.assets`)
  - Emitted by Assets for component-level diffs (including removals via `StandardRemove`).
  - Ephemera action: target only impacted components. For rooms: send `Perception { header: true }` for each updated room. For features/knowledge/maps/messages: send appropriate `Perception` updates for those components.
  - Rationale: Provides precise scoping, avoiding broad re-renders while preserving prior `cacheAsset` side-effects.

- Removals (source: `mtw.assets`)
  - Component-level removals are emitted as `'Component Updated'` events carrying `StandardRemove` payloads. Ephemera action: send `Perception` updates for impacted components; if removals affect player-visible locations or maps, issue `CheckLocation { forceRender: true }` as appropriate.
  - Asset-level removals are emitted as `'Asset Removed'`. Ephemera action: send `CheckLocation { forceRender: true }` and perform any needed invalidations.
  - Note: We currently subscribe to both events for redundancy. This is intentional until we evaluate the role and wiring of the `removeAsset` handler in the assets lambda. A tech-debt ticket has been filed to revisit and potentially consolidate this.

- 'Canon Updated' (source: `mtw.assets`)
  - Emitted by Assets when the global canon ordering/contents change.
  - Ephemera action: update `Global.assets` via the existing CanonUpdate path; send `Perception` for added assets; send `CheckLocation { forceRender: true }` for removed assets. Preserves prior `canonUpdate` side-effects.

- 'Zone Changed' (source: `mtw.assets`)
  - Emitted when an asset moves between zones (e.g., Personal → Canon, Canon → Personal/Library/Archive).
  - Ephemera action: if zone transitions into Canon, treat as add (CanonAdd); if zone transitions out of Canon, treat as remove (CanonRemove). Both flow through the CanonUpdate path to update `Global.assets` and trigger `Perception` for additions and `CheckLocation { forceRender: true }` for removals.

- 'Asset Added' (source: `mtw.assets`)
  - Emitted by Assets when an asset is newly registered.
  - Ephemera action: treat as a blueprint change for that asset; optionally send `Perception` with `header: true` for rooms in the asset to refresh headers for present characters.

- 'Asset Removed' (source: `mtw.assets`)
  - Emitted by Assets when an asset is removed.
  - Ephemera action: send `CheckLocation { forceRender: true }` to reevaluate character visibility, maps, and renders that may have depended on the removed asset. Replaces `decacheAsset` downstream effects.

Notes:
- `ComponentRenderData` remains in ephemera (no direct DB writes). It is invoked by `perception`, `parse`, and `mapUpdate`.
- `ExamplesData` remains in ephemera but must be migrated to read from the assets table.
- Ephemera continues to have read-only access to asset data; write operations (including graph edges) are owned by the assets system.

## Structure

This document will be populated systematically with the following sections:
- [x] InternalCache Class Categorization
- [x] Legacy Functions Analysis
- [x] Cache Class Usage Analysis
- [ ] Data Dependencies Assessment  
- [ ] Migration Strategy
- [ ] Implementation Plan
- [ ] Testing Strategy
- [ ] Rollback Plan

---

*This document is a work in progress and will be updated as we analyze the codebase and plan the migration.*
