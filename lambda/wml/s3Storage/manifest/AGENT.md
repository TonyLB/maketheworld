# Manifest System - Agent Navigation Guide

## Overview

The manifest system provides immutable history tracking for WML assets through an append-only NDJSON event log. Each asset has a manifest that records all changes (chunks), snapshots, and zone transitions in chronological order.

### Core Purpose

The manifest enables:
- **Immutable History**: Complete audit trail of all asset changes
- **Efficient Reconstruction**: Build current state from snapshot + chunks
- **Point-in-Time Recovery**: Reconstruct asset at any historical moment
- **Storage Optimization**: Avoid repeated large file overwrites

## Manifest Structure

### Storage Location

Manifests are stored as NDJSON files in S3:
- **Content manifest**: `{uuid}.wml/manifest-latest.ndjson`
- **Auth manifest**: `{uuid}.auth.wml/manifest-latest.ndjson`

Each line in the file is a JSON-serialized `ManifestEvent`.

### Event Types

#### 1. Chunk Event
Records an incremental edit to the asset:
```typescript
{
  type: 'chunk',
  timestamp: '2025-10-18T12:00:00.000Z',
  eventId: 'uuid',
  s3Key: '{uuid}.wml/chunks/1729252800000-abc123.wml',  // timestamp-uuid format
  authoringPlayer: 'alice',  // Optional - player who authored this edit
  chunkSize: 1024            // Optional (bytes)
}
```

The chunk file contains WML with Replace/Remove operations.

**S3 Key Format**: `{timestamp}-{uuid}.wml`
- Timestamp ensures chronological ordering
- UUID prevents collisions on concurrent edits at same millisecond

**Note**: No requestId - that's ephemeral WebSocket correlation, not historical data

#### 2. Snapshot Event
Records a full content snapshot:
```typescript
{
  type: 'snapshot',
  timestamp: '2025-10-18T12:00:00.000Z',
  eventId: 'uuid',
  s3Key: '{uuid}.wml/snapshots/1729256400000.wml',
  snapshotType: 'manual' | 'automatic',
  chunksBeforeSnapshot: 50,
  snapshotSize: 50000      // Optional (bytes)
}
```

Snapshots enable efficient reconstruction by providing a baseline.

#### 3. Zone Change Event
Records a zone transition:
```typescript
{
  type: 'zoneChange',
  timestamp: '2025-10-18T12:00:00.000Z',
  eventId: 'uuid',
  fromZone: 'Library',
  toZone: 'Canon'
}
```

Zone changes are metadata-only (no content change).

## Reconstruction

To reconstruct current state from manifest:

1. **Parse manifest** - Read NDJSON, parse each line as ManifestEvent
2. **Find latest snapshot** - Get most recent snapshot event (if any)
3. **Collect chunks** - Get all chunk events after snapshot
4. **Load snapshot** - Read snapshot WML from S3 (or start with empty)
5. **Apply chunks** - Merge each chunk in chronological order
6. **Result** - Current asset state

### Example Manifest

```ndjson
{"type":"chunk","timestamp":"2025-10-18T10:00:00.000Z","eventId":"e1","s3Key":"test.wml/chunks/1729249200000-a1b2c3.wml","authoringPlayer":"alice"}
{"type":"chunk","timestamp":"2025-10-18T11:00:00.000Z","eventId":"e2","s3Key":"test.wml/chunks/1729252800000-d4e5f6.wml"}
{"type":"snapshot","timestamp":"2025-10-18T12:00:00.000Z","eventId":"e3","s3Key":"test.wml/snapshots/1729256400000.wml","snapshotType":"manual","chunksBeforeSnapshot":2}
{"type":"chunk","timestamp":"2025-10-18T13:00:00.000Z","eventId":"e4","s3Key":"test.wml/chunks/1729260000000-g7h8i9.wml"}
{"type":"zoneChange","timestamp":"2025-10-18T14:00:00.000Z","eventId":"e5","fromZone":"Library","toZone":"Canon"}
```

**Reconstruction**: Load snapshot e3, apply chunk e4 → Current state

## Integration Points

### Dependencies
- **@tonylb/mtw-base/ts/schema**: AssetUUID type
- **@tonylb/mtw-asset-workspace/ts/readOnly**: Zone type
- **atomicLock**: Concurrent manifest update protection

### Usage Locations
- **s3Storage/manifest/operations.ts**: Manifest read/write operations
- **s3Storage/manifest/chunks.ts**: Chunk writing operations  
- **s3Storage/manifest/snapshots.ts**: Snapshot operations ✅
- **s3Storage/AssetWorkspace.ts**: Local writable AssetWorkspace extension
- **dataSource/applyEdit**: Writes chunks, updates manifest
- **dataSource/moveAsset**: Appends zone change events
- Future: **diagnostics/**: Self-validation of manifest integrity

## Design Decisions

### NDJSON vs JSON Array
- **Chosen**: NDJSON (newline-delimited JSON)
- **Rationale**: Append-only operations, easier parsing, streaming-friendly

### Event Granularity
- **Chosen**: One event per change (chunk, snapshot, zone change)
- **Rationale**: Precise history, enables detailed audit trails

### Snapshot Strategy  
- **Phase 2**: Manual snapshots only
- **Phase 3**: Automatic triggers (time/count/size-based)

### Manifest Persistence
- **Chosen**: Single `manifest-latest.ndjson` file
- **Phase 3**: May archive old sections for long-lived assets

## Snapshot Operations

Snapshots represent full materialized content at specific points in time. They enable efficient reconstruction by providing a baseline.

### Writing Snapshots

```typescript
import { writeSnapshot } from './snapshots'

const snapshotRef = await writeSnapshot({
    prefix: 'test.wml/',              // Or 'test.auth.wml/' for auth
    timestamp: Date.now(),            // Milliseconds since epoch
    zone: 'Library',                  // For lifecycle management
    snapshotType: 'manual',           // Or 'automatic' (Phase 3)
    chunksBeforeSnapshot: 25          // Number of chunks this replaces
})

// Returns: { s3Key: 'test.wml/snapshots/1729252800000.wml', snapshotSize: 50000 }
```

**Implementation Details:**
- Uses S3 `CopyObject` to efficiently copy materialized view to snapshot location
- Parallel `HeadObject` on source to get size without sequential latency
- S3 key pattern: `{prefix}/snapshots/{timestamp}.wml`
- No UUID needed (snapshots are coordinated operations under atomicLock)
- Metadata: timestamp, snapshotType, chunksBeforeSnapshot
- Tags: Zone (for lifecycle policies)

**Efficiency:**
- No data transfer through Lambda (S3-to-S3 copy)
- Parallel operations minimize latency
- Size from source is reliable (snapshot = exact copy of materialized view)

## File Organization

This manifest system is part of the S3 storage subsystem:

```
lambda/wml/s3Storage/
  AssetWorkspace.ts         # Local writable AssetWorkspace (extends package read-only version)
  AssetWorkspace.test.ts    # AssetWorkspace tests
  manifest/
    baseClasses.ts          # Event types and type guards
    baseClasses.test.ts     # Type guard tests
    operations.ts           # Manifest read/write ✅
    operations.test.ts      # Manifest operations tests ✅
    chunks.ts               # Chunk operations ✅
    chunks.test.ts          # Chunk operations tests ✅
    snapshots.ts            # Snapshot operations ✅ (Task 2.2.1 - Oct 20, 2025)
    snapshots.test.ts       # Snapshot operations tests ✅
    reconstruction.ts       # Reconstruction operations ✅ (Task 2.2.2 - Oct 20, 2025)
    reconstruction.test.ts  # Reconstruction operations tests ✅
    AGENT.md                # This file
```

## Reconstruction

Reconstruction rebuilds current state from manifest events. This is the core read operation for chunk-based storage.

### Usage

```typescript
import { reconstructFromManifest } from './reconstruction'

// Reconstruct content
const contentResult = await reconstructFromManifest('test.wml/')
if (contentResult.type === 'content') {
    const standard = contentResult.standard  // StandardForm
    console.log(`Used snapshot: ${contentResult.metadata.snapshotUsed}`)
    console.log(`Applied ${contentResult.metadata.chunksApplied} chunks`)
}

// Reconstruct authorization
const authResult = await reconstructFromManifest('test.auth.wml/')
if (authResult.type === 'auth') {
    const authorization = authResult.authorization  // StandardAuthorizationCollection
}
```

**Algorithm:**
1. Load manifest events from `{prefix}/manifest-latest.ndjson`
2. Find latest snapshot (if any)
3. Load baseline from snapshot or start with empty
4. Apply all chunks after snapshot in chronological order
5. Return type-specific result with metadata

**Error Handling:**
- Missing snapshot → Falls back to empty baseline, continues with chunks
- Missing chunk → Logs warning, continues with remaining chunks
- Corrupt WML → Logs warning, skips that chunk
- No manifest → Returns empty content

**Performance:** 
- Parallel S3 downloads: All chunk GET requests kick off immediately
- Sequential merge processing: Chunks merge in order as they arrive
- Uses async reduce pattern for optimal latency with correctness guarantee

## Related Documentation

- **[S3 Storage Migration](../../AGENT.s3storage.migration.md)**: Overall Phase 2 migration plan
- **[Asset Workspace Package](../../../../packages/mtw-asset-workspace/)**: Read-only utilities
- **[Apply Edit](../../dataSource/applyEdit/)**: Primary chunk writer
- **[S3 Storage Subsystem](../AssetWorkspace.ts)**: Local writable AssetWorkspace

---

**Document Status**: 
- Created October 18, 2025 as part of Phase 2.1 (Task 2.1.1)
- Updated October 20, 2025 with snapshot operations (Task 2.2.1)
- Updated October 20, 2025 with reconstruction operations (Task 2.2.2)

