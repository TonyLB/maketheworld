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
- **manifest/operations.ts**: Manifest read/write operations
- **manifest/chunks.ts**: Chunk writing operations  
- **manifest/snapshots.ts**: Snapshot operations
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

## Related Documentation

- **[S3 Storage Migration](../AGENT.s3storage.migration.md)**: Overall Phase 2 migration plan
- **[Asset Workspace Package](../../../packages/mtw-asset-workspace/)**: Read-only utilities
- **[Apply Edit](../dataSource/applyEdit/)**: Primary chunk writer

---

**Document Status**: Created October 18, 2025 as part of Phase 2.1 (Task 2.1.1)

