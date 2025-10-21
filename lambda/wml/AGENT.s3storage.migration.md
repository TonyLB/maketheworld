# WML S3 Storage Migration - Architectural Planning

> **🤖 AI Agent?** Jump to [Getting Started](#-ai-agent-getting-started) section below for onboarding instructions.

**Status: PHASE 1 IN PROGRESS**

**Last Updated: October 16, 2025**

This document tracks the migration away from the "zones as subdirectories" storage pattern to a more flexible and maintainable architecture.

---

## 🤖 AI Agent: Getting Started

**New to this migration? Follow these steps to get oriented:**

### Step 1: Understand Project Foundations
Read these foundational documents first (essential context):

1. **`AGENT.md`** (project root)
   - **Why**: Project documentation standards and testing patterns
   - **Key Info**: How to write documentation, naming conventions, testing guidelines
   
2. **`packages/mtw-wml/`** - WML Format Documentation
   - **Why**: Understanding WML is essential - we're storing/parsing WML chunks
   - **Key Files**: Look for README, schema documentation, examples
   - **Focus**: How WML represents assets, what Replace/Remove operations look like
   
3. **`lambda/wml/AGENT.s3Storage.md`** - Current S3 Storage Patterns  
   - **Why**: Understand existing storage architecture we're building on
   - **Key Info**: How S3 storage currently works, what patterns exist
   - **Note**: This describes pre-chunk architecture (Phase 1 complete)

### Step 2: Read This Migration Document
You're here! Read the following sections in order:
1. **Current Architecture** (below) - Understanding what we're migrating from
2. **Migration Objectives** - Why we're doing this
3. **Phase 2: Chunk-Based Snapshot Architecture** - Current work focus
4. **Progress tracking** - See what's complete and what's next
5. **Detailed Task Breakdown** - Find your specific task

### Step 3: Understand applyEdit Pattern
**Critical**: This is the core write path we're modifying in Phase 2.

- **`lambda/wml/dataSource/applyEdit/index.ts`** - Core edit application logic
  - **Current State**: Writes directly to materialized `.wml` and `.ndjson` files
  - **Phase 2 Goal**: Will write chunks + update manifests + rebuild materialized views
  - **Pattern**: Load current state, merge edits, write result
  
- **`lambda/wml/dataSource/applyEdit/index.test.ts`** - Usage patterns and examples
  - **Review**: See how edits are applied, what success/conflict responses look like
  - **Important**: This is the primary integration point for Phase 2.3

### Step 4: Review Implemented Phase 2.1 Code
After understanding the foundations, review what's been implemented:
- **`lambda/wml/s3Storage/manifest/baseClasses.ts`** - Manifest event types and schemas
- **`lambda/wml/s3Storage/manifest/operations.ts`** - Manifest read/write operations
- **`lambda/wml/s3Storage/manifest/chunks.ts`** - Chunk writing operations
- **`lambda/wml/s3Storage/manifest/AGENT.md`** - Manifest subsystem documentation
- **`lambda/wml/s3Storage/AssetWorkspace.ts`** - Writable AssetWorkspace implementation

### Step 5: Check Testing Patterns
Review test files to understand usage patterns:
- **`lambda/wml/s3Storage/manifest/*.test.ts`** - See how operations are used
- Note: All prefixes should NOT include `ASSET#` (e.g., use `uuid.wml/` not `ASSET#uuid.wml/`)

### Step 6: Identify Next Task
Look at the **Detailed Task Breakdown** section below:
- Find tasks marked with `[ ]` (not yet complete)
- Check **Progress** percentages to see current phase
- Review **Recent Completions** to understand what was just finished
- Read the specific task description for implementation details

### Step 7: Run Tests Before Starting
```bash
cd lambda/wml
npm test -- --watchAll=false
```
All tests should pass before beginning new work (currently 124 tests).

### Key Conventions
- **S3 Prefixes**: Strip `ASSET#` from UUIDs (use `uuid.wml/` not `ASSET#uuid.wml/`)
- **Functional Style**: Prefer `map`/`filter`/`findIndex` over imperative loops
- **Batch Operations**: Design for efficiency (e.g., `appendManifestEvents` accepts arrays)
- **Generic Design**: Operations work with both content and auth prefixes
- **Immutability**: Chunks and snapshots are immutable once written

---

## Temporary Documents (For Cleanup)

**Active - Need Cleanup After Phase 1B**:
- None - all temporary documents cleaned up

**Completed - Already Deleted**:
- ~~`lambda/wml/AGENT.refactoring.md`~~ - moveAsset analysis (deleted after Phase 1A)
- ~~`lambda/addressLookup/AGENT.deprecation-analysis.md`~~ - addressLookup analysis (deleted after Phase 1B item 1)
- ~~`lambda/wml/AGENT.dbRegister.analysis.md`~~ - dbRegister analysis (deleted after Phase 1B item 2)
- ~~`lambda/assets/AGENT.dbRegister-continuation.md`~~ - dbRegister continuation notes (deleted after Phase 1B item 2)
- ~~`lambda/wml/AGENT.assetworkspace.simplification.md`~~ - Getter usage analysis (deleted after Phase 1B completion)
- ~~`lambda/assets/AGENT.assetworkspaceaddress-remaining.md`~~ - AssetWorkspaceAddress cleanup analysis (deleted after Phase 1B completion)
- ~~`lambda/assets/PHASE1B-COMPLETE.md`~~ - dbRegister working notes (deleted after Phase 1B completion)
- ~~`lambda/wml/dataSource/moveAsset/AGENT.development.md`~~ - moveAsset development priorities (deleted - issues resolved by Phase 1 refactor)
- ~~`lambda/wml/AGENT.s3storage.migration.catalog.md`~~ - Detailed write operations catalog (deleted after Phase 1 completion)

**Permanent Documentation** (Keep):
- `lambda/wml/AGENT.s3storage.migration.md` - Main migration plan (this file)
- `lambda/wml/AGENT.s3storage.publishing.plan.md` - Publishing strategy design
- `lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md` - Import graph future design

---

## Current Architecture

### Zone-as-Subdirectory Pattern

The current WML S3 storage architecture organizes assets by placing them in subdirectories based on their zone:

```
s3://bucket/
  Canon/
    {assetId}.wml
    {assetId}.ndjson
  Library/
    {assetId}.wml
    {assetId}.ndjson
  Personal/
    {player}/
      {assetId}.wml
      {assetId}.ndjson
  Draft/
    {player}/
      draft.wml
      draft.ndjson
  Archive/
    {assetId}.wml
    {assetId}.ndjson
```

**Key Characteristics**:
- Zone is encoded in the S3 object path/key
- Zone transitions require S3 copy + delete operations (physical file moves)
- Zone information is implicit from the file location
- Each asset exists in exactly one zone at a time

## Limitations Encountered

### 1. **Zone Transitions Require File Operations**

Moving an asset between zones requires:
- S3 CopyObject operation (creates new file)
- S3 DeleteObject operation (removes old file)
- Multiple network round-trips
- Potential for inconsistency if operations fail mid-transition

**Impact**: Zone transitions are slow, expensive, and error-prone.

### 2. **Path-Based Zone Encoding is Brittle**

Zone information is encoded in the S3 key, requiring:
- String parsing to determine zone from path
- Complex path construction logic scattered throughout codebase
- Difficulty in querying "what zone is this asset in?"
- Zone changes invalidate all existing references to the file path

**Impact**: Zone logic is scattered and error-prone; hard to maintain consistency.

### 3. **Limited Query Capabilities**

Finding assets in a specific zone requires:
- S3 ListObjects with prefix filtering
- DynamoDB lookups that duplicate S3 path information
- No efficient way to query "all assets a player can access across zones"

**Impact**: Poor query performance; reliance on redundant metadata storage.

### 4. **Complications with Multi-Zone Access**

Some use cases require understanding assets across zones:
- Player needs to see their Personal + Draft + accessible Library items
- Canonization workflows need to understand Library → Canon transitions
- Backup/restore operations need zone-aware handling

**Impact**: Complex logic to coordinate cross-zone operations.

### 5. **Metadata Synchronization Burden**

DynamoDB must store zone information to enable queries:
- Zone is stored in `AssetWorkspaceAddress` in DynamoDB
- Zone in DynamoDB must stay synchronized with S3 path
- Inconsistencies lead to "file not found" or "wrong zone" errors

**Impact**: Dual source of truth creates synchronization complexity.

### 6. **Versioning and History Challenges**

Current structure makes it difficult to:
- Track zone transition history (when did asset move to Canon?)
- Implement undo/rollback of zone changes
- Audit trail of asset lifecycle

**Impact**: Limited observability and difficulty implementing advanced features.

## Migration Objectives

The migration aims to address these limitations by:

1. **Decoupling zone from storage location** - Store zone as metadata, not path
2. **Simplifying zone transitions** - Make zone changes metadata updates, not file moves
3. **Improving queryability** - Enable efficient zone-based queries
4. **Reducing complexity** - Single source of truth for zone information
5. **Enabling future features** - Support for versioning, history, multi-zone access

## Migration Phases

### Phase 1: Flat UUID-Based Storage

**Status**: ✅ **COMPLETE** (October 16, 2025)

**Goal**: Replace zone-as-subdirectory with flat UUID-based storage using S3 tags/metadata for organizational information.

#### Implementation Status:

✅ **Completed:**
1. **Asset Tag UUID Refactoring** (October 14, 2025)
   - Removed `key` attribute from `Asset` tag in WML
   - Added required `uuid` attribute to `Asset` tag (stored as `AssetUUID` in schema)
   - Updated WML serialization to strip `ASSET#` prefix (e.g., `<Asset uuid=(MyAsset)>` stores as `ASSET#MyAsset` internally)
   - Updated `StandardForm` to use `_universalKey` internally and expose as `universalKey` in header/NDJSON
   - Updated `StandardAuthorizationCollection` similarly to use `_universalKey`
   - Updated all test files across packages and lambdas (700+ tests updated)
   - All tests passing in: `mtw-base`, `mtw-interfaces`, `mtw-wml`, `mtw-asset-workspace`, `lambda/wml`, `lambda/ephemera`, `lambda/assets`
   - Updated `copyWML` function to use `uuid` parameter instead of `key`
   
   **Breaking Changes:**
   - WML format: `<Asset key=(name)>` is now `<Asset uuid=(name)>`
   - NDJSON format: Asset header line changed from `{ tag: 'Asset', key: 'name' }` to `{ tag: 'Asset', universalKey: 'ASSET#name' }`
   - `copyWML` lambda event: Parameter changed from `key` to `uuid`
   - Any external systems reading/writing WML or NDJSON must be updated
   
   **Technical Details:**
   - Modified `packages/mtw-base/ts/schema/asset.ts`: Changed `SchemaAssetBase` from `key?: string` to `uuid: AssetUUID`
   - Modified `packages/mtw-wml/ts/schema/converters/index.ts`: Updated Asset converter to use `enforceTypedKey('ASSET')` and `stripTypedKey('ASSET')`
   - Modified `packages/mtw-wml/ts/standardize/index.ts`: Changed `StandardForm._key` to `_universalKey: AssetUUID`
   - Modified `packages/mtw-wml/ts/standardize/authorization/index.ts`: Changed `StandardAuthorizationCollection._key` to `_universalKey: AssetUUID`
   - Modified `packages/mtw-wml/ts/tagTree/schema.ts`: Updated comparison logic to handle Asset and Story tags by uuid
   - Modified `lambda/assets/characters/index.ts`: Updated character snapshot generation to use universalKey
   - Modified `lambda/wml/copyWML/index.ts`: Changed parameter from `key: string` to `uuid: string`
   - All WML test files and strings in TypeScript updated systematically (64 files)

🔄 **In Progress:**
- None currently

✅ **Recently Completed:**
2. **Flat S3 Object Structure** (October 14, 2025)
   - ✅ Modified `AssetWorkspace` path construction for flat UUID-based naming
   - ✅ Removed obsolete `parseAssetWorkspaceAddress` function
   - ✅ All tests passing (22/22)

3. **Zone as S3 Tags & Player Metadata** (October 14, 2025)
   - ✅ Extended `s3Client` wrapper with `putWithTags()`, `getTags()`, `updateTags()`
   - ✅ Updated all `AssetWorkspace.push*` methods to write Zone tags
   - ✅ Added Player metadata for Personal/Draft zones
   - ✅ All tests passing with tag/metadata verification

✅ **More Recently Completed:**
4. **Zone Change Operations Refactor** (October 15, 2025)
   - ✅ Refactored `moveAsset` to use `s3Client.updateTags()` instead of copy+delete
   - ✅ Added validation for immutable metadata constraints (Canon/Library → Personal/Draft blocked)
   - ✅ Simplified from ~190 lines to ~80 lines
   - ✅ All tests passing (12/12)
   - Valid transitions: Personal/Draft → Library/Canon (publishing), Library ↔ Canon (canonization)

✅ **Also Completed:**
5. **Initialize Primitives** (October 15, 2025)
   - ✅ Updated `lambda/initialize/app.ts` to use flat path (`primitives.wml`) with Zone tag

6. **Read Operations** (October 14, 2025)
   - ✅ Implicitly completed by path construction changes
   - ✅ All load methods automatically use UUID-based paths via `fileNameBase` getter

✅ **More Recently Completed:**
7. **Remove `addressLookup` Lambda** (October 15, 2025)
   - ✅ Removed `lambda/addressLookup/` directory completely
   - ✅ Updated `applyWMLEdit.asl.yaml` - removed 4 address-related steps
   - ✅ Updated `cacheAssets.asl.yaml` - removed address lookup steps
   - ✅ Updated `template.yaml` - removed `AddressLookupFunction` definition and references
   - ✅ Verified consumer lambdas work with cache fallbacks

✅ **Phase 1B & 1C Complete** (October 16, 2025):
8. **Complete Address Resolution Updates & AssetWorkspaceAddress Removal (Phase 1B)**
   - ✅ Updated `dbRegister` functions - integrated into `cacheAsset` flow
   - ✅ Removed `assetWorkspaceFromAssetId` utilities entirely
   - ✅ Added `AssetWorkspace.fromUUID()` with DynamoDB/S3 fallback
   - ✅ Refactored `AssetMetaData` cache to use `zone`/`player` directly
   - ✅ Removed all dead code (WML Meta cache, ephemera AssetAddress cache, etc.)
   - ✅ Updated backup stubs to use `AssetId` instead of `AssetWorkspaceAddress`
   - ✅ **Removed `AssetWorkspaceAddress` type entirely**
   - ✅ Simplified `AssetWorkspace` to single constructor: `(assetId: AssetUUID, zone, player?)`
   - ✅ **Full getter simplification (Option 3)**:
     - Added `s3Key` getter and `s3KeyFor(type)` method
     - Removed `fileName`, `filePath`, and `fileNameBase` getters
     - All S3 key construction now type-safe and self-documenting
   - ✅ Proper typing: `assetId` is `AssetUUID`, removed `CHARACTER#` dead code
   - ✅ All tests passing (193 total across 3 lambdas + package)

9. **Read Operations Verification (Phase 1C)** - ✅ Complete
   - ✅ S3 tag/metadata reading implemented in `fromUUID()` and `moveAsset()`
   - ✅ Cache invalidation already UUID-based (no changes needed)
   - ✅ All load operations use UUID-based paths

#### Core Changes:

1. **StandardForm UUID Keys for Assets**
   - ✅ Enable assets to use `AssetUUID` instead of human-readable keys
   - ✅ Eliminate the distinction between "local key" and "UUID" at asset level
   - ✅ UUID becomes the primary identifier for file naming

2. **Flat S3 Object Structure** ✅
   - ✅ All objects stored at bucket root: `{uuid}.wml`, `{uuid}.ndjson`
   - ✅ Authorization files: `{uuid}.auth.wml`, `{uuid}.auth.ndjson`
   - ✅ No subdirectories - `filePath` always returns `''`
   - ✅ `s3KeyFor(type)` method generates flat paths

3. **Zone as S3 Tags** (Mutable Attributes) ✅
   - ✅ Zone stored in S3 object tags (`Zone=Canon`)
   - ✅ All `push*` methods write Zone tags (Phase 1A)
   - ✅ Zone transitions use tag updates, no file moves
   - ✅ `fromUUID()` reads Zone tags as fallback (Phase 1B)
   - ✅ Atomic zone changes via `moveAsset()` (Phase 1A)

4. **Player/Owner as S3 Metadata** (Immutable Attributes) ✅
   - ✅ Player stored in S3 metadata (`x-amz-meta-player=alice`)
   - ✅ All `push*` methods write player metadata for Personal/Draft zones
   - ✅ Set once on object creation, immutable
   - ✅ `fromUUID()` reads player metadata as fallback (Phase 1B)

5. **Zone Change Operations Refactor** ✅
   - ✅ Replaced CopyObject + DeleteObject with PutObjectTagging (Phase 1A)
   - ✅ `moveAsset()` uses `s3Client.updateTags()` (Phase 1A)
   - ✅ Maintains same event emission (Zone Changed)
   - ✅ Simplified from ~190 lines to ~80 lines

6. **Access Pattern Updates** ✅
   - ✅ Removed `AssetWorkspaceAddress` entirely (Phase 1B)
   - ✅ All code uses `AssetUUID` consistently (typed properly)
   - ✅ S3 key construction via `s3KeyFor(type)` - type-safe
   - ✅ Removed all path parsing (no longer needed with flat storage)

#### Key Decisions:

**Character Assets**: Characters are components within assets (not separate S3 objects). Eliminate the `Assets/` vs `Characters/` subfolder distinction entirely.

**Draft Assets**: Use rotating v4 UUIDs for draft assets. Track current draft UUID per player in DynamoDB Player metadata. On publish, use `moveAsset` to change Zone tag, then create new draft with fresh UUID. See [Publishing Strategy](AGENT.s3storage.publishing.plan.md) for details.

**Archive & Backup**: Defer to Phase 2. Remove all archiving and backup functionality in Phase 1 to simplify.

**Zone Queries**: Use DynamoDB `assets` table as primary query layer for zone-based lookups (not S3 ListObjects).

**DynamoDB Schema**: Store `AssetUUID` as the primary key. No separate address storage needed - zone information lives in S3 tags.

**AssetWorkspace API**: Refactor constructors and methods as part of broader AssetWorkspace library changes (covered in implementation tasks).

**Migration Strategy**: No migration needed - current production only has `ASSET#primitives` which will be treated as a reserved ID.

**Authorization Files**: Use same UUID prefix as content files, differentiated by `.auth.wml` and `.auth.ndjson` postfixes (same as current pattern). Mirror the same S3 tags.

**Zone Change Events**: Zone change handlers in `mtw.wml` DataSource will determine `fromZone` and `toZone` before performing S3 tag updates (maintains domain authority).

**Concurrency**: Existing `atomicLock` function handles concurrent updates to S3 objects (no additional work needed).

### Phase 2: Chunk-Based Snapshot Architecture

**Status**: 🚧 **IN PROGRESS** (Started October 18, 2025)

**Progress**: 7/28 tasks complete (25.0%)
- ✅ Phase 2.0: Prerequisites (1/1 complete)
- ✅ Phase 2.1: Foundation - Manifest Infrastructure (3/3 complete)
- ✅ Phase 2.2: Foundation - Reconstruction (3/3 complete)

**Recent Completions**:
- **October 21, 2025**: Task 2.2.3 - Manual snapshot creation capability
  - Implemented `createManualSnapshot(prefix, zone)` orchestration function
  - Coordinates manifest loading, snapshot writing, and manifest updating
  - Added WMLSnapshotEvent type ("Snapshot Created") to event schema
  - Added CreateSnapshotRequest coordination event type
  - DataSource handler creates snapshots for both content and auth in parallel
  - Returns chunksBeforeSnapshot count and total snapshot size
  - Generic operation works with any prefix (content or auth)
  - Caller holds atomicLock for concurrency protection
  - 10 comprehensive tests, all passing (164 total tests in lambda/wml)
  - Created `lambda/wml/s3Storage/manifest/orchestration.ts` and tests
- **October 20, 2025**: Task 2.2.2 - Manifest reconstruction logic implementation
  - Implemented `reconstructFromManifest(prefix)` - Rebuild current state from manifest
  - Algorithm: Load manifest → Find snapshot → Load baseline → Apply chunks → Return result
  - Type-aware: Returns StandardForm for content, StandardAuthorizationCollection for auth
  - Generic operation works with any prefix (content or auth)
  - Resilient error handling: gracefully handles missing snapshots/chunks, corrupt WML
  - Returns metadata (snapshotUsed, chunksApplied) for observability
  - 15 comprehensive tests, all passing (154 total tests in lambda/wml)
  - Created `lambda/wml/s3Storage/manifest/reconstruction.ts` and tests
  - Optimized: Parallel S3 downloads with sequential merge using async reduce pattern
- **October 20, 2025**: Task 2.2.1 - Snapshot writing operations implementation
  - Implemented `writeSnapshot(options)` - Write full WML snapshots to S3
  - S3 key format: `{prefix}/snapshots/{timestamp}.wml`
  - Uses S3 CopyObject to efficiently copy materialized view (no data through Lambda)
  - Parallel HeadObject on source to get size without sequential latency
  - Returns SnapshotReference with s3Key and snapshotSize for manifest tracking
  - Zone tags for lifecycle management (archival policies)
  - Immutable S3 metadata: timestamp, snapshotType (manual/automatic), chunksBeforeSnapshot
  - Generic operation works with any prefix (content or auth)
  - Extended s3Client with `copyWithTags()` and `getSize()` methods
  - 15 comprehensive tests, all passing (139 total tests in lambda/wml)
  - Created `lambda/wml/s3Storage/manifest/snapshots.ts` and tests
  - Updated `packages/mtw-asset-workspace/ts/clients.ts` with new methods
- **October 19, 2025**: Task 2.1.3 - Chunk writing operations implementation
  - Implemented `writeChunk(options)` - Write immutable chunks to S3
  - S3 key format: `{prefix}/chunks/{timestamp}-{uuid}.wml`
  - UUID prevents collision on concurrent edits at same millisecond
  - Zone tags for lifecycle management (archival policies)
  - Player metadata for authorship tracking (immutable)
  - Returns ChunkReference with s3Key and chunkSize for manifest tracking
  - Generic operation works with any prefix (content or auth)
  - 12 comprehensive tests, all passing (124 total tests in lambda/wml)
  - Created `lambda/wml/s3Storage/manifest/chunks.ts` and tests
- **October 19, 2025**: Task 2.1.2 - Manifest operations implementation
  - Implemented `loadManifest(prefix)` - Read and parse manifest NDJSON
  - Implemented `appendManifestEvents(prefix, events)` - Batch append events to manifest
  - Both operations are generic (work with any prefix)
  - Graceful handling of non-existent manifests (returns empty array)
  - Robust error handling (skips invalid events, continues processing)
  - Batch support for efficient multi-event operations (minimizes S3 writes)
  - Functional programming style (map/filter, findIndex)
  - 19 comprehensive tests, all passing
  - Created `lambda/wml/s3Storage/manifest/operations.ts` and tests
- **October 18, 2025**: Task 2.1.1 - Manifest event schema design
  - Defined ChunkEvent, SnapshotEvent, ZoneChangeEvent types
  - Documented NDJSON format and reconstruction pattern
  - Created comprehensive type guards and tests (15 tests)
  - Organized into `s3Storage/` subsystem (co-located AssetWorkspace + manifest code)
- **October 18, 2025**: Task 2.0.1 - Initialize primitives refactor
  - Eliminated direct S3 writes from initialize lambda
  - All writes now use `applyEdit` pattern (Phase 2 ready)
  - Created proper `mtw.diagnostics` event schema
  - 31 new tests, all passing

**Goal**: Replace monolithic versioned objects with chunk-based, manifest-driven snapshots for immutable history and efficient storage.

#### Core Concepts:

1. **Immutable Chunks**
   - Each change produces a new, standalone chunk file
   - Chunks stored under predictable prefix: `{uuid}.wml/chunks/{timestamp}.wml`
   - WML edit schemas (using Replace/Remove tags) representing the change
   - Never overwritten once written
   - S3 metadata for immutable provenance (player, requestId, timestamp)
   - Lifecycle policies can archive old chunks to Glacier based on prefix and age

2. **Snapshots**
   - Full materialized WML content at specific points in time
   - Stored at: `{uuid}.wml/snapshots/{timestamp}.wml`
   - Created on-demand via manual trigger (automatic triggers deferred to Phase 3)
   - Enables efficient point-in-time reconstruction (start from snapshot, apply chunks forward)
   - Can be used for recovery, rollback, or historical access
   - **Decision**: Only WML snapshots needed (NDJSON reconstructible from WML)

3. **Manifests**
   - NDJSON event log tracking asset history
   - Events include: chunks, snapshots, zone changes, potential future merges
   - Describes how to reconstruct current state (latest snapshot + subsequent chunks)
   - Stored at stable key: `{uuid}.wml/manifest-latest.ndjson`
   - Frequently overwritten (not versioned to avoid storage expansion)
   - Protected by `atomicLock` to prevent concurrent update conflicts
   - **Reconstructible**: Can be rebuilt from chunk/snapshot metadata if lost (Phase 3 feature)

4. **Materialized Current Object**
   - Always-updated assembled object at: `{uuid}.wml` (and `.ndjson`)
   - Represents current merged WML for direct client access
   - Can be served via presigned URLs
   - Rebuilt from manifest on every write (latency acceptable for our update frequency)
   - Maintains backward compatibility with Phase 1 read patterns

5. **Authorization History** (Parallel Structure)
   - `.auth.wml` files use identical structure under `{uuid}.auth.wml/` prefix
   - Manifest: `{uuid}.auth.wml/manifest-latest.ndjson`
   - Chunks: `{uuid}.auth.wml/chunks/{timestamp}.wml`
   - Snapshots: `{uuid}.auth.wml/snapshots/{timestamp}.wml`
   - Materialized view: `{uuid}.auth.wml` (and `.auth.ndjson`)
   - **Benefit**: No special-case code - same operations, different prefix

#### Benefits Over Phase 1:

- **Reduces storage amplification** from repeated large object overwrites
- **Enables object-level provenance and history** without secondary database
- **Supports efficient snapshot rebuilds** and point-in-time access
- **Natural lifecycle integration** for archiving older chunks to Glacier
- **Queryable via S3 Inventory** and Athena for analytics

#### Design Decisions (October 18, 2025):

- ✅ **Materialized Views**: Maintain updated `{uuid}.wml` on every write for backward compatibility
- ✅ **NDJSON Snapshots**: Not needed (WML is source of truth, NDJSON reconstructible)
- ✅ **Authorization History**: Parallel structure under `{uuid}.auth.wml/` prefix (no special-case code)
- ✅ **Snapshot Frequency**: Manual capability in Phase 2, automatic triggers in Phase 3
- ✅ **Manifest Format**: NDJSON event log (not JSON array) for extensibility
- ✅ **Reconstruction Strategy**: Rebuild materialized view on every write
- ✅ **Concurrency**: Use `atomicLock` for manifest updates (no elaborate merge conflict resolution)
- ✅ **Archive Zone**: Freezes asset in place (simpler than Phase 1 backup complexity)
- ✅ **Manifest Loss Recovery**: Phase 3 feature (pattern supports it, not implementing yet)
- ✅ **Generic Operations**: Chunk/manifest/snapshot operations accept prefix parameter for reusability

#### Storage Structure:

**Content Files** (under `{uuid}.wml/` prefix):
```
{uuid}.wml/
  manifest-latest.ndjson          # Event log
  chunks/
    {timestamp}.wml               # Delta chunks
  snapshots/
    {timestamp}.wml               # Full snapshots
{uuid}.wml                        # Materialized current content
{uuid}.ndjson                     # Materialized NDJSON (Phase 1 compat)
```

**Authorization Files** (parallel structure under `{uuid}.auth.wml/` prefix):
```
{uuid}.auth.wml/
  manifest-latest.ndjson          # Event log (same format)
  chunks/
    {timestamp}.wml               # Delta chunks (same structure)
  snapshots/
    {timestamp}.wml               # Full snapshots (same structure)
{uuid}.auth.wml                   # Materialized current auth
{uuid}.auth.ndjson                # Materialized NDJSON (Phase 1 compat)
```

**Key Design**: Content and auth use identical structure with different prefixes. This enables:
- Generic chunk/snapshot/manifest operations (pass prefix as parameter)
- No special-case code for authorization
- Parallel processing of content and auth updates
- Independent lifecycle policies per file type

#### Scope:

- Refactor `initialize` lambda to use `applyEdit` pattern (prerequisite)
- Implement chunk-based storage for all edits (content and authorization)
- Create snapshots on-demand via manual trigger
- Build manifest management (NDJSON event log pattern)
- Maintain materialized views on every write
- Update `moveAsset` to handle chunk-based assets (add zone change events to manifest)
- **Reintroduce Archive zone** as frozen state (Zone=Archive tag)
- S3 lifecycle policies transition archived content to cold storage
- Support point-in-time recovery by replaying chunks from snapshots (read-only initially)

#### Implementation Plan Overview:

The Phase 2 migration consists of **28 discrete tasks** organized into **10 phases**:

| Phase | Task Count | Focus Area |
|-------|-----------|------------|
| 2.0 | 1 | Prerequisites (initialize refactor) |
| 2.1 | 3 | Manifest Infrastructure |
| 2.2 | 3 | Reconstruction Logic |
| 2.3 | 3 | Content Write Path Integration |
| 2.4 | 1 | Zone Change Integration |
| 2.5 | 2 | Authorization History |
| 2.6 | 2 | Read Path Updates |
| 2.7 | 2 | Archive Zone |
| 2.8 | 4 | Testing |
| 2.9 | 3 | Documentation |

**Estimated Complexity**: Medium-High
- Foundation phases (2.1-2.2): ~5-7 days
- Integration phases (2.3-2.7): ~7-10 days  
- Testing & Documentation (2.8-2.9): ~3-5 days
- **Total**: ~15-22 working days

**Dependencies**:
- All tasks depend on Phase 1 completion ✅
- Phase 2.1-2.2 (Foundation) must complete before integration phases
- Phase 2.3-2.7 (Integration) can partially overlap after foundation is stable
- Phase 2.8 (Testing) should run in parallel with integration phases
- Phase 2.9 (Documentation) can start early, complete at end

#### Detailed Task Breakdown:

**Phase 2.0: Prerequisites** (Simplification)
- [x] **Task 2.0.1**: Refactor `initialize` lambda primitives initialization ✅ **COMPLETE** (October 18, 2025)
  
  **Implementation Details**:
  - ✅ Removed direct S3 `PutObject` for `primitives.wml` from initialize lambda
  - ✅ Created `lambda/wml/dataSource/initializePrimitives/index.ts` - Idempotent handler
    - Checks for VORTEX room and knowledgeRoot knowledge using `StandardForm.byUniversalId`
    - Skips if both components present (truly idempotent - no chunk created)
    - Creates via `applyEdit` if asset missing or empty
    - Repairs with targeted edits if components missing
  - ✅ Extended `applyEdit` with `createIfNeeded` flag (opt-in, backward compatible)
    - Allows creation of new assets when explicitly requested
    - Handles empty StandardForm initialization
  - ✅ Initialize lambda emits `mtw.diagnostics` / `S3 Structure Finding` event
    - Event describes finding (status: 'missing'), not command
    - Includes diagnosticRunId for correlation
  - ✅ WML lambda (`mtw.wml` DataSource) subscribes to `mtw.diagnostics` events
    - Responds to `source: 'primitives.wml', status: 'missing'`
    - Uses proper DataSource subscription pattern (not special-case handler)
  - ✅ Created event schema in `packages/mtw-interfaces/ts/eventBridge/diagnostics`
    - `DiagnosticsEventSerializer` with serialize/deserialize
    - Type guards and event types
  - ✅ Created planning document `lambda/diagnostics/AGENT.schema.planning.md`
    - Documents move from imperative to descriptive events
    - Defines S3 Structure Finding event pattern
  
  **Testing**:
  - ✅ 31 new tests added (48 total in WML lambda, up from 33)
  - ✅ `applyEdit/index.test.ts`: 7 tests for `createIfNeeded` functionality
  - ✅ `initializePrimitives/index.test.ts`: 9 tests for all initialization scenarios
  - ✅ `mtw-wml.test.ts`: 4 tests for diagnostics event handling
  - ✅ `diagnostics/index.test.ts` (mtw-interfaces): 11 tests for serializer
  
  **Files Modified**:
  - `lambda/initialize/app.ts` - Event emission instead of direct S3 write
  - `lambda/initialize/package.json` - Added EventBridge & uuid dependencies
  - `lambda/wml/dataSource/applyEdit/index.ts` - Added `createIfNeeded` flag
  - `lambda/wml/dataSource/mtw-wml.ts` - Subscribe to diagnostics events
  - `lambda/wml/app.ts` - Added DiagnosticsEventSerializer
  - `template.yaml` - EventBridge permissions, EVENT_BUS_NAME, event subscription
  
  **Result**: All primitives writes now go through `applyEdit` pattern (will naturally use chunks in Phase 2)

**Phase 2.1: Foundation - Manifest Infrastructure**
- [x] **Task 2.1.1**: Design manifest event schema ✅ **COMPLETE** (October 18, 2025)
  - ✅ Defined TypeScript types: `ManifestChunkEvent`, `ManifestSnapshotEvent`, `ManifestZoneChangeEvent`
  - ✅ Documented NDJSON format (one event per line, chronological order)
  - ✅ Event metadata fields: timestamp, eventId, authoringPlayer, s3Key, etc.
  - ✅ Created `lambda/wml/s3Storage/manifest/baseClasses.ts` with type guards
  - ✅ Created `lambda/wml/s3Storage/manifest/baseClasses.test.ts` - 15 tests, all passing
  - ✅ Created `lambda/wml/s3Storage/manifest/AGENT.md` - Documentation with examples
  - ✅ Defined `ManifestReconstructionState` helper type for efficient state building
  - ✅ Organized into `s3Storage/` subsystem (co-located with AssetWorkspace)
  - **Location**: `lambda/wml/s3Storage/manifest/` (domain authority in WML lambda)
  - **Result**: Schema ready for implementation in Tasks 2.1.2-2.1.3
  
- [x] **Task 2.1.2**: Implement manifest operations in WML lambda ✅ **COMPLETE** (October 19, 2025)
  - ✅ Created `lambda/wml/s3Storage/manifest/operations.ts`
  - ✅ `loadManifest(prefix)` - Read and parse manifest NDJSON
    - Returns array of ManifestEvent objects in chronological order
    - Returns empty array if manifest doesn't exist (graceful handling)
    - Skips invalid events and unparseable lines (continues processing)
    - Works with both content (`{uuid}.wml/`) and auth (`{uuid}.auth.wml/`) prefixes
  - ✅ `appendManifestEvents(prefix, events)` - Append batch of events to manifest
    - Accepts array of events for efficient batch operations (minimizes S3 writes)
    - Handles non-existent manifest gracefully (creates new manifest)
    - Atomically reads current manifest, appends events, writes back
    - Works for both initialization and subsequent appends
    - Validates all events using type guards before appending
    - Handles empty array as no-op
  - ✅ Created `lambda/wml/s3Storage/manifest/operations.test.ts` - 19 tests, all passing
  - **Implementation Details**:
    - Generic operations work with any prefix for content/auth reusability
    - Caller (applyEdit) holds atomicLock on materialized file (covers all operations)
    - Robust error handling with graceful degradation
    - Batch support enables efficient multi-event operations
    - No separate `writeManifest` needed - `appendManifestEvents` handles initialization
  - **Result**: Manifest read/write operations ready for use in Task 2.1.3
  
- [x] **Task 2.1.3**: Implement chunk writing operations in WML lambda ✅ **COMPLETE** (October 19, 2025)
  - ✅ Created `lambda/wml/s3Storage/manifest/chunks.ts`
  - ✅ `writeChunk(options)` - Write immutable chunk to S3
    - S3 key pattern: `{prefix}/chunks/{timestamp}-{uuid}.wml`
    - UUID generated with uuidv4() prevents collision on concurrent edits
    - Returns `ChunkReference` with s3Key and chunkSize for manifest tracking
  - ✅ Zone tags for lifecycle management (enables archival policies)
  - ✅ Immutable S3 metadata: timestamp, player (optional)
  - ✅ Calculated chunk size using `Buffer.byteLength()` for accurate byte count
  - ✅ Created `lambda/wml/s3Storage/manifest/chunks.test.ts` - 12 tests, all passing
  - **Implementation Details**:
    - Generic operation accepts prefix parameter (works with any prefix)
    - Proper handling of multi-byte characters in size calculation
    - Comprehensive test coverage: concurrent writes, all zones, auth prefix, empty content
    - Timestamp precision preserved in metadata
  - **Result**: Chunk writing ready for integration in Phase 2.3 (applyEdit)

**Phase 2.2: Foundation - Reconstruction**
- [x] **Task 2.2.1**: Implement snapshot operations ✅ **COMPLETE** (October 20, 2025)
  - ✅ Created `lambda/wml/s3Storage/manifest/snapshots.ts`
  - ✅ `writeSnapshot(options)` - Write full WML snapshot using S3 CopyObject
  - ✅ S3 key pattern: `{prefix}/snapshots/{timestamp}.wml`
  - ✅ S3 metadata: timestamp, snapshotType (manual/automatic), chunksBeforeSnapshot
  - ✅ Return SnapshotReference with s3Key and snapshotSize
  - ✅ Generic operation accepts prefix parameter (content or auth)
  - ✅ Extended s3Client with `copyWithTags()` and `getSize()` methods
  - ✅ 15 comprehensive tests, all passing
  - **Implementation**: Uses CopyObject + parallel HeadObject for efficiency
  
- [x] **Task 2.2.2**: Implement manifest reconstruction logic ✅ **COMPLETE** (October 20, 2025)
  - ✅ Created `lambda/wml/s3Storage/manifest/reconstruction.ts`
  - ✅ `reconstructFromManifest(prefix)` - Build current state from manifest
  - ✅ Algorithm: Load manifest → Find latest snapshot → Load baseline → Apply chunks
  - ✅ Type-aware: Returns `ContentReconstructionResult` or `AuthReconstructionResult`
  - ✅ Returns StandardForm for content, StandardAuthorizationCollection for auth
  - ✅ Generic operation works with any prefix (content or auth)
  - ✅ Comprehensive error handling (missing snapshots, missing chunks, corrupt WML)
  - ✅ Returns metadata (snapshotUsed, chunksApplied) for observability
  - ✅ 15 comprehensive tests, all passing (154 total tests in lambda/wml)
  - ✅ Updated manifest AGENT.md with reconstruction documentation
  - **Implementation**: Parallel S3 downloads with sequential merge processing (async reduce pattern)
  
- [x] **Task 2.2.3**: Add manual snapshot creation capability ✅ **COMPLETE** (October 21, 2025)
  - ✅ Created `lambda/wml/s3Storage/manifest/orchestration.ts`
  - ✅ `createManualSnapshot(prefix, zone)` - Orchestrates snapshot creation workflow
  - ✅ Loads manifest to count chunks since last snapshot
  - ✅ Writes snapshot using existing `writeSnapshot()` (copies materialized view)
  - ✅ Appends SnapshotEvent to manifest
  - ✅ Added WML event types: WMLSnapshotEvent (Snapshot Created)
  - ✅ Added coordination event: CreateSnapshotRequest
  - ✅ DataSource handler creates snapshots for both content and auth prefixes
  - ✅ Emits `Snapshot Created` event via DataSource
  - ✅ 10 comprehensive tests, all passing (164 total tests in lambda/wml)
  - **Design**: Works for both content (`{uuid}.wml/`) and auth (`{uuid}.auth.wml/`) prefixes

**Phase 2.3: Integration - Content Write Path**
- [ ] **Task 2.3.1**: Update `applyEdit` to write chunks
  - Add chunk-based history tracking alongside existing materialized view writes
  - Write delta as chunk: `writeChunk('{uuid}.wml/', timestamp, editStandard.schema)`
  - Append chunk event to manifest at `{uuid}.wml/manifest-latest.ndjson`
  - Continue writing materialized views with `pushJSON()` and `pushWML()` (covered in 2.3.2)
  - Add lazy migration: If no manifest exists, create initial snapshot from current content
  
- [ ] **Task 2.3.2**: Update `applyEdit` to maintain materialized views
  - After writing chunk and updating manifest, write merged result directly to materialized views
  - Continue using existing `pushJSON()` and `pushWML()` to write `{uuid}.wml` and `{uuid}.ndjson`
  - Materialized view is kept up-to-date by direct write (not reconstruction)
  - Maintain Phase 1 materialized view locations for backward compatibility
  - Note: Reconstruction (`reconstructFromManifest`) is only for diagnostic/recovery scenarios
  
- [ ] **Task 2.3.3**: Handle chunk-based asset detection
  - Add `AssetWorkspace.isChunkBased(prefix)` - Check for manifest existence at given prefix
  - Update all write paths to detect and handle both patterns
  - Ensure lazy migration on first edit to legacy assets

**Phase 2.4: Integration - Zone Changes**
- [ ] **Task 2.4.1**: Update `moveAsset` for chunk-based assets
  - Detect if asset is chunk-based (has manifest at `{uuid}.wml/` or `{uuid}.auth.wml/`)
  - For chunk-based: Append ZoneChangeEvent to both content and auth manifests
  - For chunk-based: Update Zone tags on manifest, chunks, snapshots (both prefixes)
  - For legacy: Keep existing tag-update behavior
  - Maintain same event emission pattern

**Phase 2.5: Authorization History**
- [ ] **Task 2.5.1**: Refactor chunk/manifest operations to accept prefix parameter
  - Modify manifest operations to work with any prefix (e.g., `{uuid}.wml/` or `{uuid}.auth.wml/`)
  - Modify chunk operations to accept prefix parameter
  - Modify snapshot operations to accept prefix parameter
  - Modify reconstruction logic to accept prefix parameter
  - **Benefit**: No auth-specific code needed - same operations, different prefix
  
- [ ] **Task 2.5.2**: Update authorization write operations
  - Modify `pushAuthorizationWML()` to use chunk-based pattern with `{uuid}.auth.wml/` prefix
  - Reuse generic chunk/manifest operations (just pass different prefix)
  - Rebuild materialized `{uuid}.auth.wml` from manifest using generic reconstruction
  - Maintain backward compatibility with Phase 1 auth files

**Phase 2.6: Read Path Updates**
- [ ] **Task 2.6.1**: Update `loadJSON()` for chunk-based assets
  - Check for manifest existence at `{uuid}.wml/manifest-latest.ndjson`
  - If present: Use `reconstructFromManifest('{uuid}.wml/')` instead of loading flat file
  - If absent: Fall back to Phase 1 pattern (lazy migration on next write)
  - Cache reconstructed state in memory (already done)
  
- [ ] **Task 2.6.2**: Update `loadAuthorizationJSON()` for chunk-based assets
  - Check for manifest existence at `{uuid}.auth.wml/manifest-latest.ndjson`
  - If present: Use `reconstructFromManifest('{uuid}.auth.wml/')` (reusing same generic function)
  - If absent: Fall back to flat auth files if no manifest

**Phase 2.7: Archive Zone Reintroduction**
- [ ] **Task 2.7.1**: Remove Archive zone restrictions
  - Remove "Archive not supported" error from `AssetWorkspace` constructor
  - Allow `moveAsset` to Archive zone (adds ZoneChangeEvent to manifest)
  - Archive = frozen state (no further edits allowed)
  
- [ ] **Task 2.7.2**: Add S3 lifecycle policies for archived content
  - Transition `Zone=Archive` objects to Glacier after N days
  - Apply to chunks, snapshots, manifests, materialized views
  - Document lifecycle policy configuration

**Phase 2.8: Testing**
- [ ] **Task 2.8.1**: Unit tests for manifest operations
  - Test manifest NDJSON parsing and writing
  - Test `appendManifestEvent` with `atomicLock`
  - Test event schema validation
  
- [ ] **Task 2.8.2**: Unit tests for chunk/snapshot operations
  - Test chunk writing with metadata
  - Test snapshot creation
  - Test reconstruction from manifest (snapshot + chunks)
  
- [ ] **Task 2.8.3**: Integration tests for edit flow
  - Test full cycle: edit → chunk → manifest → reconstruct → materialized view
  - Test lazy migration from Phase 1 flat files
  - Test concurrent edit handling with `atomicLock`
  - Test zone changes with chunk-based assets
  
- [ ] **Task 2.8.4**: Integration tests for authorization history
  - Test auth chunk writing and manifest management
  - Test auth reconstruction from manifest
  - Test auth zone changes

**Phase 2.9: Documentation**
- [ ] **Task 2.9.1**: Document manifest event schema
  - Add `AGENT.manifest.md` with event format specifications
  - Include examples of each event type
  - Document reconstruction algorithm
  
- [ ] **Task 2.9.2**: Update AssetWorkspace documentation
  - Document new chunk/snapshot/manifest operations
  - Update usage examples for Phase 2 pattern
  - Document lazy migration behavior
  
- [ ] **Task 2.9.3**: Update migration document
  - Mark Phase 2 tasks as complete
  - Document any deviations from plan
  - Add lessons learned section

#### GitHub Issue Templates:

Each task above should be created as a GitHub issue with the following template:

```markdown
**Phase**: 2.[X] [Phase Name]
**Task**: 2.[X].[Y] [Task Name]

**Description**:
[Copy task description from implementation plan]

**Acceptance Criteria**:
- [ ] [Specific deliverable 1]
- [ ] [Specific deliverable 2]
- [ ] All existing tests continue to pass
- [ ] New functionality has test coverage

**Dependencies**:
- Depends on: [List task IDs]
- Blocks: [List task IDs]

**Files to Modify**:
- [List primary files]

**Related Documentation**:
- `lambda/wml/AGENT.s3storage.migration.md`
- [Other relevant AGENT.md files]

**Labels**: `enhancement`, `phase-2-chunk-storage`, `[specific-area]`
```

**Suggested Issue Grouping**:

1. **Milestone: Phase 2 Foundation** (Tasks 2.0.1, 2.1.1-2.1.3, 2.2.1-2.2.3)
   - Core infrastructure that must complete first
   
2. **Milestone: Phase 2 Integration** (Tasks 2.3.1-2.3.3, 2.4.1, 2.5.1-2.5.2, 2.6.1-2.6.2)
   - Integration with existing write/read paths
   
3. **Milestone: Phase 2 Completion** (Tasks 2.7.1-2.7.2, 2.8.1-2.8.4, 2.9.1-2.9.3)
   - Archive zone, testing, documentation

### Phase 3: Advanced Features
*Future enhancements to be planned:*
- Automatic snapshot triggers (time/count/size-based)
- Manifest archival and pagination for long-lived assets
- Manifest loss recovery from chunk metadata
- Point-in-time queries and rollback UI
- Asset merge history tracking
- Performance optimization (parallel chunk loading, caching strategies)
- Investigation: Manifest growth patterns and archival strategies
- **WML Lambda Self-Diagnostics**: 
  - Create `lambda/wml/diagnostics/` directory for self-validation
  - Listen for `Diagnostic Run Started` events from mtw.diagnostics
  - Validate manifests using WML's own reconstruction code
  - Emit findings back to diagnostics for aggregation
  - Maintains domain authority (WML validates WML storage)
- **Manifest Corruption Detection and Self-Healing**:
  - **Current State (Phase 2)**: `loadManifest()` silently skips invalid/unparseable events with console warnings
  - **Future Enhancement**: Detect corruption and trigger diagnostic run
  - When invalid events detected during load:
    - Emit diagnostic event describing corruption (invalid line numbers, event types)
    - Trigger self-healing workflow to reconstruct manifest from S3 metadata
    - Use chunk/snapshot object metadata to rebuild authoritative manifest
    - Compare reconstructed vs corrupted manifest and emit comprehensive finding
  - **Pattern**: Transform silent failures into observable, self-repairing system
  - **Note**: Maintains backward compatibility - Phase 2 gracefully degrades, Phase 3 actively heals

## Architectural Considerations

*To be documented: Key architectural principles and patterns to guide the migration*

### Backward Compatibility
*How to maintain compatibility during migration*

### Data Migration Strategy
*How to migrate existing assets to new structure*

### Testing Strategy
*How to validate migration success*

### Rollback Plan
*How to revert if issues are discovered*

## Related Documentation

- **[Asset Zones](AGENT.zones.md)**: Zone system concepts and access patterns
- **[Current S3 Storage](AGENT.s3Storage.md)**: Documentation of current storage patterns
- **[Publishing Strategy](AGENT.s3storage.publishing.plan.md)**: Draft management and publishing workflow using Phase 1 architecture
- **[Event Architecture](../../AGENT.architecture.events.md)**: Event-driven patterns and coordination
- **[WML DataSource](dataSource/)**: DataSource pattern and event handling
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: File operations and abstractions
- **[Import Graph Redesign](../../lambda/assets/fetchImportDefaults/AGENT.graph-redesign.md)**: Component-level graph architecture (Phase 2)

---

## 📊 Evaluation: "Getting Started" Pattern Effectiveness

**Pattern Introduced**: October 20, 2025 (added to this document)

**Purpose**: Evaluate whether structured AI agent onboarding should be adopted project-wide.

### What We're Testing
The "Getting Started" section (above) provides a 7-step onboarding process for AI agents:
1. Understand project foundations (AGENT.md, WML docs, S3 storage)
2. Read migration plan
3. Understand applyEdit pattern
4. Review implemented code
5. Check testing patterns
6. Identify next task
7. Run tests before starting

### Evaluation Criteria
Record observations for each new AI chat session:

**Effectiveness Metrics:**
- ✅ Did the AI gather all necessary context without additional prompting?
- ✅ Did the AI understand conventions (S3 prefix format, functional style, etc.)?
- ✅ Did the AI identify the correct next task to work on?
- ✅ Were there any knowledge gaps despite following the guide?
- ✅ How much additional context was needed beyond the guide?

**Efficiency Metrics:**
- Time to orient (measured by number of initial file reads)
- Questions asked before starting implementation
- Context-related errors during implementation

### Observations Log

**Session 1** - October 20, 2025 (Task 2.2.1 - Snapshot Operations):
- **Context gathering**: ✅ Successfully gathered all necessary context by following the 7-step guide. Read foundational documents (AGENT.md, S3 storage patterns, applyEdit), reviewed implemented Phase 2.1 code (manifest infrastructure, chunks), and understood conventions.
- **Understanding of task**: ✅ Correctly identified task 2.2.1 requirements (snapshot writing operations). Understood the architectural context (materialized views as source, S3 CopyObject pattern) and how snapshots fit into the broader chunk-based architecture.
- **Issues encountered**: None. The guide provided clear direction on what to read and in what order. Conventions section was particularly helpful (S3 prefix format, functional style, generic design patterns).
- **Additional context needed**: Minimal. One clarification question about content source (materialized view) which was anticipated and quickly resolved. No surprise knowledge gaps or missing documentation.
- **Overall effectiveness**: ⭐⭐⭐⭐⭐ (5/5 stars)
- **Notes**: The structured approach worked excellently. Having explicit steps with "Why" explanations made it easy to understand not just what to read, but why each piece mattered. The progression from foundations → current implementation → next task felt natural and efficient.

**Session 2** - October 20, 2025 (Task 2.2.2 - Reconstruction Logic):
- **Context gathering**: ✅ Followed 7-step guide systematically. Read AGENT.md, manifest AGENT.md, baseClasses.ts, operations.ts, chunks.ts, snapshots.ts, and applyEdit/index.ts. All necessary context gathered upfront without additional prompting.
- **Understanding of task**: ✅ Correctly identified task 2.2.2 requirements immediately. Understood the reconstruction algorithm (load manifest → find snapshot → load baseline → apply chunks), type-awareness needs (StandardForm vs StandardAuthorizationCollection), and error handling strategy.
- **Issues encountered**: None blocking. Minor test adjustments needed for authorization WML format (Grant tags require `player` and `actions` attributes, components need `key` not just `uuid`), but these were domain knowledge issues, not gaps in the guide.
- **Additional context needed**: Zero. The guide's Step 4 (Review Implemented Phase 2.1 Code) was particularly effective - seeing snapshots.ts implementation patterns made reconstruction implementation straightforward. The conventions section (functional style, generic design, error handling) set clear expectations.
- **Overall effectiveness**: ⭐⭐⭐⭐⭐ (5/5 stars)
- **Notes**: The guide's progressive structure (foundations → current implementation → next task) worked excellently. Having explicit "Why" explanations for each reading made context gathering efficient. The user then requested performance optimization (parallel downloads) and functional refactoring (eliminate mutations) - both implemented successfully using patterns established in the codebase. The guide prepared me well for both the primary task and iterative improvements.

**Session 3** - October 21, 2025 (Task 2.2.3 - Manual Snapshot Creation):
- **Context gathering**: ✅ Followed 7-step guide systematically. Read AGENT.md, manifest subsystem docs (baseClasses, operations, chunks, snapshots, reconstruction), applyEdit pattern, and mtw-wml DataSource. All necessary context gathered without prompting.
- **Understanding of task**: ✅ Correctly identified task 2.2.3 requirements and immediately questioned the design document where it seemed inconsistent with existing code patterns.
- **Issues encountered**: None blocking. **Key insight**: The "issues" we addressed were actually *improvements to the design document*, not gaps in understanding:
  1. **"Reconstruct current state"** - Correctly identified that snapshots should copy materialized views (not reconstruct), catching outdated assumption in planning doc
  2. **"Clear old chunks"** - Correctly identified this as premature for Phase 2, refining the design
  3. **Materialized view architecture** - Clarified that reconstruction is for diagnostics/recovery, not normal operations
- **Additional context needed**: Zero. The guide provided sufficient context to not only implement the task but also *iterate on and improve* the design document itself.
- **Overall effectiveness**: ⭐⭐⭐⭐⭐ (5/5 stars)
- **Notes**: **Critical observation**: The context corrections made were design refinements, not comprehension failures. This demonstrates that the Getting Started pattern provides enough context for the AI to:
  - Understand the existing codebase deeply
  - Question inconsistencies in planning documents
  - Propose architectural improvements
  - Distinguish between "what the doc says" vs. "what the code actually does"
  
  This is a **higher level of success** than simply following instructions - it shows the guide enables critical thinking about the design itself.

*(Add more sessions as needed)*

### Key Findings (So Far)

**Consistent Success Pattern (3/3 sessions)**:
- All three sessions achieved 5/5 star effectiveness
- Zero knowledge gaps requiring user intervention
- AI successfully completed primary tasks AND iterative improvements
- Progressive structure (foundations → implementation → next task) works well
- **New finding (Session 3)**: Pattern enables not just implementation but *design critique*

**Critical Innovation Identified**:
The key differentiator is making the **reasoning** behind each step explicit ("Why read this?") rather than just listing files. This helps AI agents:
1. Understand the PURPOSE of each context piece
2. Make connections between related systems
3. Prioritize information appropriately
4. Know when they have sufficient context vs need more
5. **Critical thinking** - Distinguish between outdated documentation and current reality

**Unexpected Success (Session 3)**:
The guide doesn't just enable implementation - it enables **design iteration**. The AI gathered enough architectural understanding to:
- Identify inconsistencies between planning docs and existing code
- Question premature design decisions
- Propose architectural refinements
- Correct outdated assumptions in the migration plan

This is evidence that the pattern provides **deep** understanding, not just surface-level task completion.

**Observation**: If subsequent sessions continue this pattern, we may conclude evaluation early rather than waiting for full Phase 2 completion. Consistent 5-star results across diverse tasks would be strong evidence for project-wide adoption.

### Decision Point
**After 5+ sessions OR clear pattern emergence:**

- [ ] **Adopt project-wide** - Pattern is effective, add to `AGENT.md` as recommended practice
- [ ] **Revise and retry** - Pattern needs refinement before broader adoption
- [ ] **Context-specific only** - Pattern works for complex migrations but not general use
- [ ] **Abandon** - Pattern doesn't provide sufficient value

**Rationale for decision**:
*(Record reasons here once decision is made)*

**If adopting project-wide, include in `AGENT.md`:**
- Template for "Getting Started" sections
- When to use structured onboarding (complexity threshold)
- Best practices for step-by-step context gathering
- Examples from this migration document

---

**Document Status**: Phase 1 migration complete (October 16, 2025). This document now serves as permanent record of the migration and planning document for future phases (Phase 2: chunk-based architecture).

