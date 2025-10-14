# WML S3 Storage Migration - Architectural Planning

**Status: PHASE 1 IN PROGRESS**

**Last Updated: October 14, 2025**

This document tracks the migration away from the "zones as subdirectories" storage pattern to a more flexible and maintainable architecture.

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

**Status**: IN PROGRESS

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

⏳ **Remaining:**
2. **Flat S3 Object Structure** - Store objects at bucket root with UUID-based naming
   - Files to modify: `packages/mtw-asset-workspace/ts/readOnly.ts` (path construction)
   - See [Write Operations Catalog](AGENT.s3storage.migration.catalog.md) for complete scope
3. **Zone as S3 Tags** - Implement mutable zone storage in object tags
   - Extend `s3Client` wrapper with tagging support
   - Update `AssetWorkspace.push*` methods to write tags
   - Update `moveAsset` to use `PutObjectTagging` instead of copy+delete
4. **Player/Owner as S3 Metadata** - Implement immutable ownership in object metadata
   - Update `AssetWorkspace.push*` methods to write metadata
5. **Zone Change Operations Refactor** - Replace copy+delete with tag updates
   - Primary target: `lambda/wml/dataSource/moveAsset/index.ts`
6. **Access Pattern Updates** - Refactor `AssetWorkspaceAddress` usage
   - Simplify/update `addressLookup` lambda
   - Update `dbRegister` functions to store simplified metadata

#### Core Changes:

1. **StandardForm UUID Keys for Assets**
   - ✅ Enable assets to use `AssetUUID` instead of human-readable keys
   - ✅ Eliminate the distinction between "local key" and "UUID" at asset level
   - ✅ UUID becomes the primary identifier for file naming

2. **Flat S3 Object Structure**
   - Store all objects at bucket root level: `{uuid}.wml`, `{uuid}.ndjson`
   - Authorization files: `{uuid}.auth.wml`, `{uuid}.auth.ndjson`
   - No subdirectories for zones or players

3. **Zone as S3 Tags** (Mutable Attributes)
   - Zone stored in S3 object tags (e.g., `Zone=Canon`)
   - Zone transitions = tag updates (no file moves)
   - Enables atomic zone changes

4. **Player/Owner as S3 Metadata** (Immutable Attributes)
   - Player stored in S3 user-defined metadata (e.g., `x-amz-meta-player=alice`)
   - Set once on object creation
   - Cannot change (appropriate for ownership)

5. **Zone Change Operations Refactor**
   - Replace S3 CopyObject + DeleteObject with S3 PutObjectTagging
   - Update `moveAsset` to use tagging API
   - Maintain same event emission (Zone Changed)

6. **Access Pattern Updates**
   - Refactor code using `AssetWorkspaceAddress` to use `AssetUUID` consistently
   - Update S3 key construction logic
   - Simplify path parsing/generation

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

**Goal**: Replace monolithic versioned objects with chunk-based, manifest-driven snapshots for immutable history and efficient storage.

#### Core Concepts:

1. **Immutable Chunks**
   - Each change produces a new, standalone chunk file
   - Chunks stored under predictable prefix: `{objectId}.wml/chunks/{timestamp}.wml`
   - WML edit schemas (using Replace/Remove tags) representing the change
   - Never overwritten once written
   - S3 metadata for immutable provenance (player, requestId, timestamp)
   - Lifecycle policies can archive old chunks to Glacier based on prefix and age

2. **Snapshots**
   - Full materialized WML content at specific points in time
   - Stored at: `{objectId}.wml/snapshots/{timestamp}.wml`
   - Created on-demand (replaces legacy `Backup` functionality)
   - Enables efficient point-in-time reconstruction (start from snapshot, apply chunks forward)
   - Can be used for recovery, rollback, or historical access

3. **Manifests**
   - Small JSON files listing chunks and snapshots in chronological order
   - Describes how to reconstruct current state (latest snapshot + subsequent chunks)
   - Stored at stable key: `{objectId}.wml/manifest-latest.json`
   - Frequently overwritten (not versioned to avoid storage expansion)
   - **Reconstructible**: Can be rebuilt from chunk/snapshot metadata if lost (list objects, sort by timestamp)

4. **Materialized Current Object**
   - Optional assembled object at: `{objectId}.wml`
   - Represents current merged WML for direct client access
   - Can be served via presigned URLs
   - Rebuilt from manifest when needed

#### Benefits Over Phase 1:

- **Reduces storage amplification** from repeated large object overwrites
- **Enables object-level provenance and history** without secondary database
- **Supports efficient snapshot rebuilds** and point-in-time access
- **Natural lifecycle integration** for archiving older chunks to Glacier
- **Queryable via S3 Inventory** and Athena for analytics

#### Scope:

- Implement chunk-based storage for all edits
- Create snapshots on-demand (replaces backup functionality from Phase 1)
- Build manifest management for efficient current-state access
- **Reintroduce Archive zone** as a normal zone (Zone=Archive tag)
- S3 lifecycle policies transition archived content to cold storage
- Add versioning and history capabilities via chunk replay
- Support point-in-time recovery by replaying chunks from snapshots

### Phase 3: [TBD]
*Details to be added - potential future enhancements beyond chunk-based architecture*

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

- **[Current S3 Storage](AGENT.s3Storage.md)**: Documentation of current storage patterns
- **[Write Operations Catalog](AGENT.s3storage.migration.catalog.md)**: Complete catalog of all S3 write locations for refactoring
- **[Publishing Strategy](AGENT.s3storage.publishing.plan.md)**: Draft management and publishing workflow using Phase 1 architecture
- **[Event Architecture](../../AGENT.architecture.events.md)**: Event-driven patterns and coordination
- **[WML DataSource](dataSource/)**: DataSource pattern and event handling
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: File operations and abstractions

---

**Document Status**: This is a planning document for a multi-phase architectural migration. It will be updated as design decisions are made and implementation progresses.

