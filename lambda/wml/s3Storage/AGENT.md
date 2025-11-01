# S3 Storage System - Current Architecture

**Status**: Phase 2 Complete ✅  
**Last Updated**: October 26, 2025

This document describes the current S3 storage architecture after the migration from "zones as subdirectories" to flat UUID-based storage with chunk-based snapshots.

## Overview

The S3 storage system provides immutable, versioned asset storage using a chunk-based snapshot architecture. Assets are stored using flat UUID-based paths with zone information encoded as S3 tags and metadata.

## Core Architecture

### Storage Pattern

**Current Structure** (Phase 2 Complete):
```
s3://bucket/
  {uuid}.wml/                    # Content prefix
    manifest-latest.ndjson        # Event log
    chunks/
      {timestamp}-{uuid}.wml      # Delta chunks
    snapshots/
      {timestamp}.wml             # Full snapshots
  {uuid}.wml                      # Materialized current content
  {uuid}.ndjson                   # Materialized NDJSON (Phase 1 compat)
  {uuid}.auth.wml/                # Authorization prefix (parallel structure)
    manifest-latest.ndjson        # Event log (same format)
    chunks/
      {timestamp}-{uuid}.wml      # Delta chunks (same structure)
    snapshots/
      {timestamp}.wml             # Full snapshots (same structure)
  {uuid}.auth.wml                 # Materialized current auth
  {uuid}.auth.ndjson              # Materialized NDJSON (Phase 1 compat)
```

**Key Characteristics**:
- Zone stored as S3 tags (`Zone=Canon`, `Zone=Library`, etc.)
- Player ownership stored as S3 metadata (`x-amz-meta-player=alice`)
- Zone transitions are metadata updates (no file moves)
- Single source of truth for zone information

### Core Concepts

#### 1. Immutable Chunks
- Each edit produces a standalone chunk file
- Stored under `{uuid}.wml/chunks/{timestamp}-{uuid}.wml`
- WML edit schemas using Replace/Remove tags
- Never overwritten once written
- S3 metadata for immutable provenance (player, requestId, timestamp)
- Lifecycle policies can archive old chunks to Glacier

#### 2. Snapshots
- Full materialized WML content at specific points in time
- Stored at `{uuid}.wml/snapshots/{timestamp}.wml`
- Created on-demand via manual trigger
- Enables efficient point-in-time reconstruction
- Used for recovery, rollback, or historical access
- **Decision**: Only WML snapshots needed (NDJSON reconstructible from WML)

#### 3. Manifests
- NDJSON event log tracking asset history
- Events include: chunks, snapshots, zone changes
- Describes how to reconstruct current state
- Stored at stable key: `{uuid}.wml/manifest-latest.ndjson`
- Frequently overwritten (not versioned to avoid storage expansion)
- Protected by `singleFlight` pattern (sequential mode) to prevent concurrent update conflicts

#### 4. Materialized Current Object
- Always-updated assembled object at: `{uuid}.wml` (and `.ndjson`)
- Represents current merged WML for direct client access
- Rebuilt from manifest on every write
- Maintains backward compatibility with Phase 1 read patterns

#### 5. Authorization History (Parallel Structure)
- `.auth.wml` files use identical structure under `{uuid}.auth.wml/` prefix
- Same operations, different prefix
- No special-case code required

## Design Decisions

### Phase 1 Decisions (October 14-16, 2025)
- **Flat S3 Structure**: All objects stored at bucket root with UUID-based naming
- **Zone as S3 Tags**: Zone information stored as mutable S3 tags
- **Player as S3 Metadata**: Player ownership stored as immutable S3 metadata
- **Zone Transitions**: Use `PutObjectTagging` instead of CopyObject + DeleteObject
- **AssetWorkspaceAddress Removal**: Eliminated dual source of truth complexity
- **UUID Keys**: Assets use `AssetUUID` instead of human-readable keys

### Phase 2 Decisions (October 18-26, 2025)
- **Materialized Views**: Maintain updated `{uuid}.wml` on every write for backward compatibility
- **NDJSON Snapshots**: Not needed (WML is source of truth, NDJSON reconstructible)
- **Authorization History**: Parallel structure under `{uuid}.auth.wml/` prefix
- **Snapshot Frequency**: Manual capability in Phase 2, automatic triggers deferred to Phase 3
- **Manifest Format**: NDJSON event log for extensibility
- **Reconstruction Strategy**: Write path maintains materialized views directly; reconstruction only for recovery
- **Read Path Strategy**: Load from materialized views (no reconstruction on normal reads)
- **Concurrency**: Use `singleFlight` pattern (sequential mode) for manifest updates
- **Archive Zone**: Freezes asset in place (no new edits allowed)
- **Generic Operations**: Chunk/manifest/snapshot operations accept prefix parameter for reusability

## Core Operations

### Storage Operations

#### `appendChunk(args: AppendChunkArgs)`
- Applies WML edits by writing chunks and updating manifests
- Maintains materialized views for direct client access
- Handles lazy migration for legacy assets
- **Archive Zone**: Rejects edits to Archive zone (frozen state)

#### `changeZone(args: ChangeZoneArgs)`
- Updates asset zone by modifying S3 tags
- Appends ZoneChangeEvent to manifests
- Optimized for tag-only updates (no content changes)
- Supports all zone transitions including Archive

### Self-Repair Infrastructure

#### Generic Pipeline Pattern
- **`applyStorageOperation()`**: Centralized orchestration function
- **`fetchAndDecideRepair()`**: Common repair decision logic
- **Execution Strategies**: Operation-specific implementations (`executeAppendChunkStrategy`, `executeChangeZoneStrategy`)

#### Repair Scenarios
- **Lazy Migration**: Create initial manifest for legacy assets
- **Reconstruction**: Rebuild materialized views from manifest
- **Empty Placeholder**: Handle missing files gracefully

#### Design Principles
- **Linear Flow**: Separate decision logic from execution logic
- **Operation-Specific Optimizations**: Strategies can optimize for their specific needs
- **Centralized Self-Repair**: Common repair logic shared across operations
- **Type Safety**: Generic operations work with both content and auth prefixes

## Integration Points

### DataSource Integration
- **`applyEdit`**: Delegates to `appendChunk()` for content writes
- **`moveAsset`**: Delegates to `changeZone()` for zone transitions
- Both operations significantly simplified (70% and 58% code reduction respectively)

### Testing Patterns
- **Unit Tests**: Mock `applyStorageOperation` pipeline for strategy testing
- **Integration Tests**: End-to-end testing of storage operations
- **214 Tests**: Comprehensive coverage across 15 test files

### AssetWorkspace Integration
- **`AssetWorkspace`**: Provides S3 operations and metadata management
- **S3 Client**: Extended with tag/metadata operations
- **Atomic Locking**: Prevents concurrent manifest updates

## Benefits Over Previous Architecture

### Phase 1 Benefits
- **Simplified Zone Transitions**: Metadata updates instead of file moves
- **Single Source of Truth**: Zone information in S3 tags only
- **Improved Queryability**: Efficient zone-based queries via DynamoDB
- **Reduced Complexity**: Eliminated dual metadata synchronization

### Phase 2 Benefits
- **Reduced Storage Amplification**: Chunk-based storage vs repeated large object overwrites
- **Object-Level Provenance**: Complete history without secondary database
- **Efficient Snapshots**: Point-in-time access and recovery
- **Natural Lifecycle Integration**: Archive older chunks to Glacier
- **Queryable via S3 Inventory**: Analytics and reporting capabilities

## Zone System

### Supported Zones
- **Canon**: Published, immutable content
- **Library**: Published, editable content
- **Personal**: Player-owned content
- **Draft**: Player draft content
- **Archive**: Frozen content (no new edits, can be moved to/from)

### Zone Transitions
- **Valid**: Personal/Draft → Library/Canon (publishing), Library ↔ Canon (canonization), any → Archive (archiving), Archive → any (restoring)
- **Invalid**: Canon/Library → Personal/Draft (requires player metadata that doesn't exist)

### Archive Zone Behavior
- **Frozen State**: No new chunks can be appended (`appendChunk` validation)
- **Movable**: Assets can be moved to/from Archive zone (`moveAsset` support)
- **Purpose**: Long-term storage without active editing

## File Organization

### Core Files
- **`index.ts`**: Main storage operations (`appendChunk`, `changeZone`)
- **`pipeline.ts`**: Generic pipeline orchestration (`applyStorageOperation`)
- **`tools.ts`**: Shared utilities (`fetchAndDecideRepair`)
- **`AGENT.selfRepair.md`**: Self-repair design documentation

### Manifest System
- **`manifest/baseClasses.ts`**: Event types and schemas
- **`manifest/operations.ts`**: Manifest read/write operations
- **`manifest/chunks.ts`**: Chunk writing operations
- **`manifest/snapshots.ts`**: Snapshot operations
- **`manifest/reconstruction.ts`**: Reconstruction logic
- **`manifest/orchestration.ts`**: Manual snapshot creation

## Development Notes

### Current Status
- **Phase 1**: Complete (flat UUID-based storage)
- **Phase 2**: Complete (chunk-based snapshots)
- **Phase 3**: Planned (advanced features)

### Testing Coverage
- **214 Tests**: All passing across 15 test files
- **Unit Tests**: Strategy-focused with mocked pipeline
- **Integration Tests**: End-to-end storage operations
- **Test Patterns**: Comprehensive coverage of all scenarios

### Performance Characteristics
- **Write Operations**: Single coordinated write per operation
- **Read Operations**: Direct materialized view access
- **Zone Transitions**: Tag-only updates (no content changes)
- **Self-Repair**: On-demand reconstruction when needed

## Permissions Needed

The `wml` lambda requires the following S3 permissions on the assets bucket:

### Required S3 Actions

- **`s3:ListBucket`**: Required for listing bucket contents (used by AWS SDK for some operations)
- **`s3:GetObject`**: Read asset files (`.wml`, `.ndjson`, `.auth.wml`, `.auth.ndjson`), manifest files, chunks, and snapshots
- **`s3:PutObject`**: Write asset files, manifest files, chunks, and snapshots
- **`s3:HeadObject`**: Check object existence and retrieve metadata (used by `s3Client.check()` and `s3Client.getMetadata()`)
- **`s3:CopyObject`**: Copy materialized views to snapshot locations (efficient S3-to-S3 operations)
- **`s3:GetObjectTagging`**: Read zone tags and other object tags (used by `ReadOnlyAssetWorkspace.fromUUID()` S3 fallback and zone detection)
- **`s3:PutObjectTagging`**: Update zone tags during zone transitions (used by `changeZone()` operations)

### S3 Resources

All permissions should be granted for:
- **Bucket**: `arn:aws:s3:::${TablePrefix}-assets` (or the configured `S3_BUCKET` environment variable)
- **Objects**: `arn:aws:s3:::${TablePrefix}-assets/*` (all objects in the bucket)

### Context

These permissions support:
- **Asset Content Management**: Reading/writing asset files, chunks, manifests, and snapshots
- **Zone Detection**: Reading S3 tags to determine asset zones when DynamoDB lookup fails
- **Zone Transitions**: Updating S3 tags during `moveAsset` operations
- **Snapshot Operations**: Copying materialized views to snapshot locations
- **Self-Repair**: Reconstructing missing materialized views from manifests

## Related Documentation

- **[Self-Repair Design](AGENT.selfRepair.md)**: Detailed self-repair patterns and scenarios
- **[Development Roadmap](AGENT.development.md)**: Future enhancements and Phase 3 planning
- **[WML Language](../packages/mtw-wml/ts/AGENT.md)**: WML format and concepts
- **[AssetWorkspace](../packages/mtw-asset-workspace/ts/AGENT.md)**: AssetWorkspace library documentation
