# S3 File Write Operations Catalog

**Purpose**: Document all locations where WML/NDJSON files are written to S3, to guide Phase 1 refactoring.

**Date**: October 14, 2025

---

## Overview

This catalog identifies all code paths that write asset files to S3. These locations will need refactoring to:
1. Use flat UUID-based storage (no zone subdirectories)
2. Add S3 object tags for Zone information
3. Add S3 object metadata for Player/Owner information

---

## Primary Write Interface: `AssetWorkspace`

**Location**: `packages/mtw-asset-workspace/ts/index.ts`

### Write Methods

All S3 writes for asset content go through these four methods:

1. **`pushWML()`** - Writes WML source file
   - Path: `${this.fileNameBase}.wml`
   - Current implementation: Lines 145-152

2. **`pushJSON()`** - Writes both `.json` and `.ndjson` files
   - Paths: `${this.fileNameBase}.json` and `${this.fileNameBase}.ndjson`
   - Current implementation: Lines 113-131

3. **`pushAuthorizationWML()`** - Writes authorization WML
   - Path: `${this.fileNameBase}.auth.wml`
   - Current implementation: Lines 154-165

4. **`pushAuthorizationJSON()`** - Writes authorization NDJSON
   - Path: `${this.fileNameBase}.auth.ndjson`
   - Current implementation: Lines 133-143

### Path Construction Logic

**Location**: `packages/mtw-asset-workspace/ts/readOnly.ts`

**Key Methods**:
- `get filePath()` (Lines 148-162): Constructs zone-based subdirectory path
- `get fileName()` (Line 168-170): Returns fileName or 'draft' for Draft zone
- `get fileNameBase()` (Line 164-166): Combines `filePath` + `fileName`

**Current Path Structure**:
```typescript
// Canon/Library zones
`${zone}/${subFolder}/${fileName}`
// Example: "Canon/Assets/primitives"

// Personal zone
`Personal/${player}/${subFolder}/${fileName}`
// Example: "Personal/alice/Assets/myAdventure"

// Draft zone (special case)
`Personal/${player}/Assets/draft`

// Archive zone
`${backupId}` (just the backup ID, no zone prefix)
```

**Refactoring Impact**: All of these path construction methods must be replaced with flat UUID-based naming.

---

## Lambda Functions That Write Asset Files

### 1. `lambda/wml` - WML Management Lambda

**Handler**: `lambda/wml/app.ts`

#### Write Operations:

**a) `applyEdit` (Edit Application)**
- **Location**: `lambda/wml/dataSource/applyEdit/index.ts`
- **Lines**: 84-85
- **Operations**: `pushJSON()`, `pushWML()`
- **Purpose**: Apply user edits to asset content
- **Address Source**: From `args.address` or fetched from DynamoDB via `internalCache.Meta.get()`
- **Refactoring Need**: Address lookup must return UUID; path construction changes

**b) ~~`copyWML` (Asset Duplication)~~ - DEPRECATED**
- **Location**: `lambda/wml/copyWML/index.ts`
- **Status**: ⚠️ **TO BE REMOVED** - Not used in production, predates Phase 1 architecture
- **Replacement Strategy**: See [Publishing Strategy](AGENT.s3storage.publishing.plan.md)
- **Reason**: Publishing workflow will use `moveAsset` (zone tag update) + create new draft (v4 UUID) instead of copy+reset pattern

**c) ~~`resetWML` (Clear Asset Content)~~ - DEPRECATED**
- **Location**: `lambda/wml/resetWML/index.ts`
- **Status**: ⚠️ **TO BE REMOVED** - Not used in production, predates Phase 1 architecture
- **Replacement Strategy**: See [Publishing Strategy](AGENT.s3storage.publishing.plan.md)
- **Reason**: Replaced by creating new empty draft asset with fresh UUID

**d) `moveAsset` (Zone Transitions)** - ✅ **COMPLETED**
- **Location**: `lambda/wml/dataSource/moveAsset/index.ts`
- **Operations**: S3 `PutObjectTaggingCommand` (updates Zone tag)
- **Purpose**: Move assets between zones via atomic tag updates
- **Implementation**: Updates Zone tag on 4 files (.wml, .ndjson, .auth.wml, .auth.ndjson)
- **Critical Limitation**: Due to immutable S3 metadata, certain transitions are not allowed:
  
  **Valid Zone Transitions**:
  - ✅ Personal → Library (Publishing)
  - ✅ Personal → Canon (Publishing)
  - ✅ Draft → Personal (Publishing)
  - ✅ Draft → Library (Publishing)
  - ✅ Draft → Canon (Publishing)
  - ✅ Library → Canon (Canonization)
  - ✅ Canon → Library (Decanonization)
  
  **Invalid Transitions** (rejected with error):
  - ❌ Canon → Personal (no player metadata)
  - ❌ Canon → Draft (no player metadata)
  - ❌ Library → Personal (no player metadata)
  - ❌ Library → Draft (no player metadata)
  
  **Rationale**: Personal/Draft assets have player metadata (set at creation). Canon/Library assets don't. Since S3 metadata is immutable, moving Canon/Library assets to Personal/Draft is impossible. To get a Canon asset into Personal, use a copy operation that creates a new object with player metadata.

**e) ~~`addressLookup` Lambda~~ - ✅ REMOVED** (Phase 1B, October 15, 2025)
- **Location**: `lambda/addressLookup/` (deleted)
- **Status**: ✅ **REMOVED** - Was redundant with flat UUID-based storage
- **Replacement**: Lambdas fetch from cache directly (already had fallbacks)
- **Changes Made**: 
  - ✅ Updated `stepFunctions/applyWMLEdit.asl.yaml` - Removed 4 address-related steps
  - ✅ Updated `stepFunctions/cacheAssets.asl.yaml` - Removed address lookup and check steps
  - ✅ Removed `AddressLookupFunction` from `template.yaml`
  - ✅ Deleted `lambda/addressLookup/` directory and all source files
  - ✅ Verified no remaining references (only historical migration docs)
- **Impact**: 
  - Reduced step function latency (one less lambda invocation)
  - Simplified architecture (one less failure mode)
  - With flat storage, UUID alone provides S3 key

**f) `backupWML` (Asset Backup to tar.gz)**
- **Location**: `lambda/wml/backupWML/index.ts`
- **Operations**: Reads from S3, writes tar.gz archive (not WML files)
- **Purpose**: Create compressed backups of assets
- **Note**: Phase 1 defers backup functionality (line 152 of migration plan)

**g) ~~`publishWML` Step Function~~ - DEPRECATED**
- **Location**: `stepFunctions/publishWML.asl.yaml`
- **Status**: ⚠️ **TO BE REMOVED** - Infrastructure deployed but not used in client
- **Current Workflow**: copyWML (Draft → Target) + resetWML (clear Draft)
- **Replacement Strategy**: New step function using `moveAsset` + `createNewDraft`
- **Reason**: Predates Phase 1 architecture; rebuild with zone tagging when implementing publishing UI

---

### 2. `lambda/assets` - Asset Data Lambda

**Handler**: `lambda/assets/app.ts`

#### Write Operations:

**a) `cacheAsset` (DynamoDB Cache Sync)**
- **Location**: `lambda/assets/cacheAsset/index.ts`
- **Operations**: No direct file writes (reads from S3, writes to DynamoDB)
- **Purpose**: Sync S3 content to DynamoDB cache
- **Refactoring Need**: Minimal - just update path reading

**b) Read-Only Operations**
- Most operations in `lambda/assets` are read-only or DynamoDB-focused
- Uses `ReadOnlyAssetWorkspace` for file access
- No direct S3 writes for WML/NDJSON files

---

### 3. `lambda/initialize` - System Initialization

**Handler**: `lambda/initialize/app.ts`

#### Write Operations:

**a) `initializePrimitivesData` (Bootstrap)** - ✅ **COMPLETED**
- **Location**: `lambda/initialize/app.ts`
- **Lines**: 60-70
- **Operations**: Direct `PutObjectCommand` with Zone tag
- **Path**: `primitives.wml` (flat storage)
- **Content**: Defined in `lambda/initialize/primitives.ts`
- **Purpose**: Create initial system primitives asset
- **Implementation**: 
  - ✅ Changed path from `Canon/Assets/primitives.wml` to `primitives.wml`
  - ✅ Added S3 tag: `Zone=Canon`
  - ✅ No player metadata (Canon system asset)

---

### 4. `lambda/imageProcessor` - Image Upload Processing

**Location**: `lambda/imageProcessor/app.ts`

- **Operations**: Image processing and upload (not WML files)
- **Refactoring Need**: None for WML storage

---

### 5. `lambda/addressLookup` - Address Resolution

**Location**: `lambda/addressLookup/app.ts`

**Current Function**: 
- Looks up `AssetWorkspaceAddress` from DynamoDB for given AssetUUIDs
- Returns zone/player/fileName/subFolder structure
- Special handling for Draft assets (lines 27-36)

**Refactoring Need**: 
- Phase 1: This lambda becomes simpler - just returns UUID
- Zone information will come from S3 tags instead
- Player information from S3 metadata
- May eventually become obsolete if we query S3 directly

---

## Helper Functions

### `forceDefault()` - Draft Asset Initialization

**Location**: `packages/mtw-asset-workspace/ts/readOnly.ts`
- **Lines**: 176-194
- **Operations**: Direct `s3Client.put()` calls
- **Paths**: 
  - `${this.fileNameBase}.wml`
  - `${this.fileNameBase}.ndjson`
- **Content**: Creates default empty draft asset
- **Refactoring Need**: Update to flat UUID-based paths with tags/metadata

### `dbRegister()` - DynamoDB Registration - ⚠️ **OBSOLETE PATTERN, REPLACED**

**Status**: Functions deleted, responsibilities redistributed (Phase 1B, October 15, 2025)

**Historical Locations**: 
- `lambda/wml/serialize/dbRegister.ts` (deleted)
- `lambda/assets/serialize/dbRegister.ts` (deleted)

**Why Deprecated**:
1. **Never called**: Neither function was integrated into application code
2. **Asset-level import graph is wrong pattern**:
   - `fetchImportDefaults` operates at component-level (universalKey-based)
   - Import ancestry should be per-component (`Meta::Room`, etc.), not per-asset
   - Asset-level graph doesn't match actual usage pattern
3. **Mixed responsibilities**: Conflated metadata, graph maintenance, events, cache updates

**Replacement Strategy (Phase 1B)**:

**1. `Meta::Asset` Records** - ✅ Added to `cacheAsset`:
- **Location**: `lambda/assets/dataSource/caching/cacheAsset.ts`
- **Timing**: When asset is cached after Content Update
- **Data Stored**: Minimal metadata (AssetId, zone, player if Personal)
- **No full address**: Flat storage makes complex address obsolete
- **Purpose**: Enable cache fallback in `applyEdit`, support zone queries

**2. "Asset Added" Events** - ✅ Published from assets DataSource:
- **Location**: `lambda/assets/dataSource/index.ts`
- **Timing**: When new asset first cached (no prior `Meta::Asset` record)
- **Consumer**: `mtw.assets.library` DataSource
- **Purpose**: Automatic Library cache updates on publication

**3. Import Graph** - ⚠️ **DEFERRED TO PHASE 2**:
- **Current State**: Asset-level graph exists but is not maintained (broken)
- **Problem**: `fetchImportDefaults` likely failing silently
- **Future Design**: Component-level graph stored in `Meta::${componentTag}` records
- **Benefits**: Subscribe to `Component Updated` events, true component-level ancestry
- **See**: `lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md`

**4. PlayerLibrary Updates** - Handled by existing cache/DataSource patterns

---

## S3 Path Construction Summary

### Current Implementation

**Canon/Library Assets**:
```
{zone}/{subFolder}/{fileName}.wml
{zone}/{subFolder}/{fileName}.ndjson
{zone}/{subFolder}/{fileName}.auth.wml
{zone}/{subFolder}/{fileName}.auth.ndjson
```

**Personal Assets**:
```
Personal/{player}/{subFolder}/{fileName}.wml
Personal/{player}/{subFolder}/{fileName}.ndjson
Personal/{player}/{subFolder}/{fileName}.auth.wml
Personal/{player}/{subFolder}/{fileName}.auth.ndjson
```

**Draft Assets** (Special Case):
```
Personal/{player}/Assets/draft.wml
Personal/{player}/Assets/draft.ndjson
```

### Target Implementation (Phase 1)

**All Assets** (Flat Structure):
```
{uuid}.wml              # S3 Tags: Zone={zone}; S3 Metadata: player={player}
{uuid}.ndjson           # S3 Tags: Zone={zone}; S3 Metadata: player={player}
{uuid}.auth.wml         # S3 Tags: Zone={zone}; S3 Metadata: player={player}
{uuid}.auth.ndjson      # S3 Tags: Zone={zone}; S3 Metadata: player={player}
```

**Example**:
- Old: `Personal/alice/Assets/myAdventure.wml`
- New: `myAdventure.wml` with tags `{Zone: Personal}` and metadata `{player: alice}`

---

## Refactoring Scope

### Critical Path Changes

1. **`AssetWorkspace.filePath` getter** - Must return empty string (no subdirectories)
2. **`AssetWorkspace.fileName` getter** - Must return UUID without `ASSET#` prefix
3. **`AssetWorkspace.pushWML/pushJSON`** - Must add S3 tags and metadata on writes
4. **`moveAsset` function** - Must use `PutObjectTagging` instead of copy+delete
5. **`addressLookup` lambda** - Simplified or potentially deprecated
6. **`dbRegister` functions** - Update metadata schema

### Files Requiring Changes

**Core Infrastructure**:
- `packages/mtw-asset-workspace/ts/readOnly.ts` - Path construction
- `packages/mtw-asset-workspace/ts/index.ts` - Write operations with tags/metadata

**Lambda Write Operations**:
- `lambda/wml/dataSource/applyEdit/index.ts` - Uses workspace.push methods ✅ Active
- ~~`lambda/wml/copyWML/index.ts`~~ - ⚠️ **TO BE DEPRECATED** (not used in production)
- ~~`lambda/wml/resetWML/index.ts`~~ - ⚠️ **TO BE DEPRECATED** (not used in production)
- `lambda/wml/dataSource/moveAsset/index.ts` - **Primary refactoring target** ✅ Active
- `lambda/initialize/app.ts` - Direct primitives write ✅ Active

**Supporting Functions**:
- `lambda/wml/serialize/dbRegister.ts` - Metadata registration
- `lambda/assets/serialize/dbRegister.ts` - Metadata registration
- `lambda/addressLookup/app.ts` - Address resolution (simplify/deprecate)

### Read Operations (Indirect Impact)

Functions that read files will need to:
- Look up UUID-based paths instead of zone-based paths
- Query S3 tags for zone information when needed
- Read S3 metadata for player/owner information

**Primary Read Locations**:
- `AssetWorkspace.loadWML()` - `packages/mtw-asset-workspace/ts/readOnly.ts`
- `AssetWorkspace.loadJSON()` - `packages/mtw-asset-workspace/ts/readOnly.ts`
- `cacheAsset` - `lambda/assets/dataSource/caching/cacheAsset.ts`

---

## Implementation Strategy

### Phase 1A: Update Write Operations

1. ✅ **COMPLETED** (October 14, 2025) - Modify `AssetWorkspace` path construction (filePath, fileName, fileNameBase)
   - Implemented flat UUID-based paths (no zone subdirectories)
   - Removed obsolete `parseAssetWorkspaceAddress` function and tests
   - Updated `forceDefault()` for UUID-based naming
   - All tests passing (22/22)

2. ✅ **COMPLETED** (October 14, 2025) - Add S3 tagging and metadata to all push methods
   - Extended `s3Client` wrapper with `putWithTags()`, `getTags()`, `updateTags()` methods
   - Updated `pushWML()`, `pushJSON()`, `pushAuthorizationWML()`, `pushAuthorizationJSON()` to include Zone tags
   - Added Player metadata for Personal/Draft zones
   - Updated `forceDefault()` to use tags and metadata
   - All tests passing (22/22)
   - **Files Modified**:
     - `packages/mtw-asset-workspace/ts/clients.ts` - Added tagging/metadata methods
     - `packages/mtw-asset-workspace/ts/index.ts` - All push methods now use `putWithTags()`
     - `packages/mtw-asset-workspace/ts/readOnly.ts` - Updated `forceDefault()`
     - `packages/mtw-asset-workspace/ts/index.test.ts` - Updated all test expectations

3. ✅ **COMPLETED** (October 15, 2025) - Update `moveAsset` to use tagging instead of copy+delete
   - Refactored to use `s3Client.updateTags()` instead of CopyObject + DeleteObject
   - Reduced from ~190 lines to ~80 lines (much simpler!)
   - Added validation for invalid zone transitions (Canon/Library → Personal/Draft)
   - Marked `player` and `subFolder` parameters as deprecated (no longer used)
   - All tests passing (12/12) with comprehensive coverage
   - **Files Modified**:
     - `lambda/wml/dataSource/moveAsset/index.ts` - Complete rewrite using tag updates
     - `lambda/wml/dataSource/moveAsset/index.test.ts` - Rewritten for tag-based behavior
     - `lambda/wml/dataSource/coordinationSerializer.ts` - Marked deprecated parameters

4. ✅ **COMPLETED** (October 15, 2025) - Update `initializePrimitivesData` to use flat path with tags
   - Changed path from `Canon/Assets/primitives.wml` to `primitives.wml`
   - Added `Tagging: 'Zone=Canon'` to PutObjectCommand
   - Single-line change, no tests to update
   - **File Modified**: `lambda/initialize/app.ts`

5. ✅ **COMPLETED** (October 14, 2025) - Update read operations to handle UUID-based paths
   - Implicitly completed as part of item 1 (path construction refactoring)
   - All read methods (`loadWML`, `loadJSON`, `loadAuthorizationWML`, `loadAuthorizationJSON`) use `this.fileNameBase` getter
   - No hardcoded zone-based paths remain in `mtw-asset-workspace` package
   - No additional code changes required
   - **Analysis**: Read operations automatically adopted UUID-based paths when getters were updated

### Phase 1B: Update Address Resolution

1. ✅ **COMPLETED** (October 15, 2025) - Remove `addressLookup` lambda
   - Removed `lambda/addressLookup/` directory and all source files
   - Updated Step Functions:
     - `applyWMLEdit.asl.yaml` - Removed "Assign Address", "Check Address", "Extract First Address", "Merge Address" steps
     - `cacheAssets.asl.yaml` - Removed "Assign Addresses" and "Check for Addresses" steps
   - Removed `AddressLookupFunction` from `template.yaml`
   - Lambdas now fetch addresses from cache directly (already had fallbacks)

2. ✅ Update `dbRegister` to store simplified metadata
   - Removed both `dbRegister` implementations (wml & assets)
   - Integrated `Meta::Asset` write into `cacheAsset`
   - Moved `Asset Added` event emission to DataSource
   - Deferred import graph redesign to Phase 2
   - See: `lambda/assets/PHASE1B-COMPLETE.md`

3. ✅ REMOVED `assetWorkspaceFromAssetId` utilities entirely (October 16, 2025)
   - Deleted `lambda/assets/utilities/assets.ts` and `lambda/wml/utilities/assets.ts`
   - Replaced all usages with `AssetWorkspace.fromUUID()` static method
   - Added DynamoDB/S3 fallback logic to `fromUUID()`

4. ✅ REFACTORED `AssetMetaData` internal cache (October 16, 2025)
   - Changed from `address: AssetWorkspaceAddress` to direct `zone`/`player` fields
   - Fixed filter bug where new assets would be rejected
   - Updated all consumers (`cacheAsset`, `dataSource/index`, `app.ts`, `fetchImportDefaults`, `contentHeaders`)

5. ✅ REMOVED dead code (October 16, 2025)
   - `lambda/wml/internalCache/meta.ts` - Entire Meta cache (instantiated but never used)
   - `lambda/ephemera/internalCache/assetAddress.ts` - AssetAddress cache (never used)
   - `AssetWorkspace.changeAddress()` method (never called)
   - `address?` parameter from ApplyEditRequest chain (always undefined)
   - Duplicate `AssetWorkspaceAddress` types in `mtw-interfaces` package

6. ✅ UPDATED backup stubs to use AssetId (October 16, 2025)
   - `lambda/assets/backups/index.ts` - Return type changed to `assetId` instead of `address`
   - `lambda/wml/backupWML/index.ts` - Arguments changed to `assetId` instead of `from: AssetWorkspaceAddress`
   - `stepFunctions/backupAsset.asl.yaml` - Updated to pass `assetId`
   - Original implementations preserved as comments for Phase 2 reference

7. ✅ **REMOVED `AssetWorkspaceAddress` TYPE ENTIRELY** (October 16, 2025 - Phase 2 Start)
   - Removed all type definitions and constructor types from `readOnly.ts`
   - Removed `isAssetWorkspaceAddress()` type guard
   - Replaced internal `address` property with direct `assetId`, `zone`, `player` fields
   - Removed legacy constructor overload - single signature: `(assetId: string, zone: Zone, player?: string)`
   - Updated all internal methods (`forceDefault`, `presignedURL`, `loadJSON`, etc.) to use new properties
   - Updated all `push*` methods in `AssetWorkspace` to use new properties
   - Updated all tests to use new constructor signature
   - **Result**: Clean, simplified API with no backward compatibility overhead

8. **Temporary documents tracking**:
   - `lambda/wml/AGENT.assetworkspace.simplification.md` - ✅ COMPLETE (getter consolidation done)
   - `lambda/assets/AGENT.assetworkspaceaddress-remaining.md` - ✅ COMPLETE (all items addressed)
   - `lambda/assets/PHASE1B-COMPLETE.md` - ✅ COMPLETE (dbRegister work complete)

9. ✅ CONSOLIDATED & SIMPLIFIED AssetWorkspace getters - Option 3 Complete (October 16, 2025)
   - **Step 1**: Removed `fileNameBase` getter, replaced 12 uses with `this.fileName`
   - **Step 2**: Implemented Option 3 full simplification:
     - Added `s3Key` getter (returns UUID without prefix)
     - Added `s3KeyFor(type)` method with type-safe extensions ('wml' | 'ndjson' | 'json' | 'auth.wml' | 'auth.ndjson')
     - Removed `fileName` getter entirely (no external usage)
     - Removed `filePath` getter entirely (always returned `''`)
     - Replaced all 12 string templates with `s3KeyFor()` calls
   - **Step 3**: Proper typing and cleanup:
     - Typed `assetId` as `AssetUUID` (was `string`)
     - Removed unnecessary `CHARACTER#` handling (dead code)
   - All tests passing (193/193)
   - **Result**: Clean, type-safe, self-documenting API

### Phase 1C: Update Read Operations (Deprecated - mostly complete)

**Status**: Most work already completed by Phase 1A item 1
1. ✅ `AssetWorkspace.load*` methods already use UUID-based paths via `fileNameBase` getter
2. ⏳ Ensure S3 tag/metadata reading where needed (Phase 1B dependency)
3. ⏳ Update cache invalidation logic (Phase 1B dependency)

---

## Testing Strategy

After each change:
1. Unit tests for path construction
2. Integration tests for write operations with tag verification
3. Round-trip tests (write then read)
4. Zone transition tests
5. Multi-zone query tests

---

## S3 Client Extensions Needed

**Location**: `packages/mtw-asset-workspace/ts/clients.ts`

The current `s3Client` wrapper provides:
- `check({ Key })` - HeadObjectCommand
- `get({ Key, upload? })` - GetObjectCommand  
- `put({ Key, Body })` - PutObjectCommand
- `internalClient` - Direct S3Client access

**Extensions needed for Phase 1**:

```typescript
// Add to s3Client wrapper:
async putWithTags({ Key, Body, Tags, Metadata }: {
    Key: string;
    Body: string;
    Tags?: Record<string, string>;      // e.g., { Zone: 'Canon' }
    Metadata?: Record<string, string>;  // e.g., { player: 'alice' }
}): Promise<void>

async getTags({ Key }: { Key: string }): Promise<Record<string, string>>

async updateTags({ Key, Tags }: {
    Key: string;
    Tags: Record<string, string>;
}): Promise<void>  // For zone transitions

async getMetadata({ Key }: { Key: string }): Promise<Record<string, string>>
```

**Reference Implementation**: `lambda/imageProcessor/app.ts` (lines 64-80) already uses `GetObjectTaggingCommand`

---

## Deprecation Strategy

### Functions to Remove

These functions are **infrastructure that was deployed but never used in the client UI**:

1. **`lambda/wml/copyWML/`** - Entire directory including `index.ts` and `index.test.ts`
2. **`lambda/wml/resetWML/`** - Entire directory including `index.ts`
3. **`stepFunctions/publishWML.asl.yaml`** - Step function definition
4. **Handler cases in `lambda/wml/app.ts`** - Lines 80-92 (copyWML, resetWML cases)
5. **CloudFormation resources in `template.yaml`**:
   - `PublishWMLStateMachine` (lines ~1755-1770)
   - `PublishWMLStateMachineLogs` (line ~1753)

**Rationale**: These functions predate Phase 1 architecture and implement workflows using path-based zone storage. The publishing feature will be rebuilt using `moveAsset` (zone tag updates) + rotating v4 draft UUIDs when client UI is implemented. See [Publishing Strategy](AGENT.s3storage.publishing.plan.md).

**Benefits of Deprecation**:
- Removes migration burden (don't need to update path construction for unused code)
- Clean slate for implementing publishing with Phase 1 architecture
- Eliminates complex copy+delete pattern in favor of atomic zone tag updates

---

## Notes

- **Draft Assets**: Use rotating v4 UUIDs (from `uuid` package) for draft assets. Track current draft UUID in Player metadata (`currentDraftAssetId` field). See [Publishing Strategy](AGENT.s3storage.publishing.plan.md).
- **Archive Zone**: Phase 1 defers archiving. May remove Archive zone handling temporarily.
- **Backup Operations**: `backupWML` deferred to Phase 2 (chunk-based architecture)
- **S3 Tags vs Metadata**: Tags are mutable (good for Zone), Metadata is set-once (good for Player/Owner)
- **Tag Query**: S3 doesn't natively support tag-based queries. DynamoDB remains the primary query layer for zone-based lookups

