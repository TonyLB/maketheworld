# Manifest System Self-Repair - Design Document

**Status**: 🚧 **DESIGN IN PROGRESS**

**Created**: October 23, 2025

**Purpose**: Define self-repair strategies for manifest-based storage to handle file absence and corruption scenarios.

---

## Overview

The manifest-based storage system must handle various failure modes where expected files are missing or corrupted. This document categorizes repair scenarios and defines strategies for each.

## Core Concepts

### Two Types of Repair

The system distinguishes between two repair approaches based on urgency and context:

#### 1. On-the-Spot Repair

**Definition**: Issues that must be corrected immediately as part of normal write operations to maintain system consistency.

**Characteristics**:
- Encountered during regular write operations (`applyEdit`, `moveAsset`, etc.)
- Blocking - operation cannot proceed until resolved
- Synchronous resolution (within the same request/operation)
- Typically involve missing files that can be recreated from available data

**Architectural Approach**:
Rather than scattering repair logic across all operations, use a **centralized self-repair function** that:
- Accepts current state (which files are missing)
- Accepts requested operation (what the caller was trying to do)
- Determines optimal path to both repair AND complete the operation
- Returns result or error if repair impossible

**Benefits**:
- Single source of truth for repair logic
- Avoids repetitive defensive code in each operation
- Can optimize repair path based on context
- Treats repair as a first-class architectural concern

**Examples**:
- Missing manifest when appending events → Create manifest with those events folded in
- Missing materialized view when snapshotting → Reconstruct view, then snapshot
- Both missing when editing with `createIfNeeded` → Create both from edit operation

#### 2. Asynchronous Repair

**Definition**: Issues detected through validation that trigger diagnostic events and delayed healing workflows.

**Characteristics**:
- Detected through periodic validation or background checks
- Non-blocking - system continues operating
- Asynchronous resolution (separate diagnostic/healing workflow)
- May require complex reconstruction or external intervention

**Examples**:
- Corrupted manifest events (invalid JSON, missing fields)
- Missing chunks referenced in manifest
- Manifest inconsistencies (out-of-order events, duplicate IDs)
- Snapshot file corruption

**Future Phase**: Asynchronous repair deferred to later development

---

## Centralized Self-Repair Architecture

### The `immediateSelfRepair` Function

**Purpose**: Single entry point for all on-the-spot file absence repairs

**Interface Concept**:
```
immediateSelfRepair({
    prefix: string,              // Which asset/prefix to repair
    state: {                     // What's currently missing
        manifestMissing: boolean,
        materializedViewMissing: boolean
    },
    operation: {                 // What operation was requested
        type: 'appendManifest' | 'writeSnapshot' | 'applyEdit' | 'moveZone',
        data: <operation-specific-data>
    }
})
```

**Responsibilities**:
1. **Assess** the current state (what files exist/missing)
2. **Determine** the optimal repair path based on:
   - Which files are missing
   - What operation was requested
   - What data is available from the operation
3. **Execute** repair steps efficiently (combining with requested operation when possible)
4. **Complete** the original operation as part of repair
5. **Report** what repairs were performed (for logging/diagnostics)

**Key Design Principle**: 
The repair function doesn't just "fix and retry" - it **completes the operation as part of the repair**, avoiding redundant S3 operations.

### Repair Path Examples

**Example 1**: Manifest missing, trying to append events
- State: `{ manifestMissing: true, materializedViewMissing: false }`
- Operation: `{ type: 'appendManifest', data: { events: [...] } }`
- Path: Create new manifest with initial ZoneChange + snapshot + provided events
- Result: Manifest created AND events appended in single logical operation

**Example 2**: Materialized view missing, trying to create snapshot
- State: `{ manifestMissing: false, materializedViewMissing: true }`
- Operation: `{ type: 'writeSnapshot', data: { zone, timestamp } }`
- Path: Reconstruct view from manifest → write materialized files → create snapshot
- Result: View repaired AND snapshot created

**Example 3**: Both missing, trying to apply edit with `createIfNeeded`
- State: `{ manifestMissing: true, materializedViewMissing: true }`
- Operation: `{ type: 'applyEdit', data: { edit, zone, createIfNeeded: true } }`
- Path: Create empty StandardForm → apply edit → write materialized views → create manifest with snapshot
- Result: New asset created AND edit applied

**Example 4**: Both missing, trying to move zones
- State: `{ manifestMissing: true, materializedViewMissing: true }`
- Operation: `{ type: 'moveZone', data: { fromZone, toZone } }`
- Path: Create empty materialized views → create manifest with initial ZoneChange (null → fromZone) + zone move (fromZone → toZone)
- Result: Empty asset placeholder created with zone history preserved

### Integration Pattern with `withS3SelfRepair()`

Rather than having operations directly detect missing files and call `immediateSelfRepair`, we provide a higher-level wrapper that encapsulates the fetch-check-repair pattern.

**Arguments**:

- **`prefix`**: S3 prefix for the asset (e.g., `{uuid}.wml/` or `{uuid}.auth.wml/`)
  
- **`fetch`**: Function that attempts to load required data
  - Returns: Fetched data + state assessment (what's missing)
  - Purpose: Isolates data loading logic, identifies what's present vs absent
  
- **`action`**: Function that executes when data is complete
  - Input: Fetched data
  - Returns: Operation result
  - Purpose: Normal operation logic when no repair needed
  
- **`repairOperation`**: Metadata describing the requested operation
  - Type: Operation identifier (`applyEdit`, `moveZone`, etc.)
  - Data: Operation-specific information needed for repair
  - Purpose: Tells `immediateSelfRepair` what the caller was trying to do

**Execution Flow**:
1. **Execute fetch** - Runs the provided fetch function to load required data
2. **Assess state** - Examines what's present vs missing from fetch results
3. **Choose path**:
   - If data is complete → Call `action` with fetched data
   - If data is incomplete → Call `immediateSelfRepair` with state + repairOperation
4. **Return result** - Unified return value from either path

**Benefits**:
- **No boilerplate**: Operations don't need `if (missing) { repair } else { normal }` logic
- **Clear separation**: Fetch logic, action logic, and repair metadata are distinct
- **Consistent handling**: All operations use same detection and repair flow
- **Easy testing**: Can test fetch, action, and repair paths independently

**Location**: `lambda/wml/s3Storage/manifest/selfRepair.ts` (manifest subsystem)
- Lives alongside `immediateSelfRepair` 
- Manifest-specific expectations (materialized views, manifests, chunks)
- Future: Higher-level `lambda/wml/selfRepair` may reference this for S3-specific repairs

---

## On-the-Spot Repair Scenarios

**Note**: The following scenarios describe the repair strategies that `immediateSelfRepair` uses internally. Operations don't implement these directly - they call the centralized function.

### Scenario 1: Manifest Missing, Materialized View Exists

**When**: Operating on an asset created with unexpected legacy code, or after manifest loss

**Current State**:
- Materialized view files exist: `{uuid}.wml`, `{uuid}.ndjson`
- No manifest exists: `{uuid}.wml/manifest-latest.ndjson` missing
- System has current content but no history

**Resolution Strategy** (Lazy Migration):
1. Create initial `ZoneChange` event (fromZone: null → current zone)
2. Create snapshot from existing materialized view
3. Append both events to new manifest
4. Continue with original operation

**Implementation Status**: ✅ **IMPLEMENTED**
- Function: `appendManifestEventsWithLazyMigration()`
- Location: `lambda/wml/dataSource/utilities/appendManifestEventsWithLazyMigration.ts`
- Used by: `applyEdit`, `moveAsset`

**Example Manifest Created**:
```ndjson
{"type":"zoneChange","timestamp":"2025-10-23T10:00:00.000Z","eventId":"e1","fromZone":null,"toZone":"Library"}
{"type":"snapshot","timestamp":"2025-10-23T10:00:00.000Z","eventId":"e2","s3Key":"uuid.wml/snapshots/1729677600000.wml","snapshotType":"manual","chunksBeforeSnapshot":0}
```

**Edge Cases**:
- ✅ Empty content: Creates manifest with empty snapshot
- ✅ Authorization file: Works with both `.wml` and `.auth.wml` prefixes
- ✅ Zone recovery: Uses current zone from AssetWorkspace

---

### Scenario 2: Materialized View Missing, Manifest Exists

**When**: Materialized view deleted but manifest/chunks intact

**Current State**:
- Manifest exists: `{uuid}.wml/manifest-latest.ndjson` present
- Chunks/snapshots referenced in manifest exist
- Materialized view missing: `{uuid}.wml`, `{uuid}.ndjson` absent

**Resolution Strategy** (Reconstruction):
1. Load manifest events
2. Reconstruct current state from snapshot + chunks
3. Write reconstructed content to materialized views
4. Continue with original operation

**Implementation Status**: 🔄 **PARTIALLY IMPLEMENTED**
- Reconstruction: ✅ `reconstructFromManifest()` exists
- Write-back: ❌ **NOT YET IMPLEMENTED**
- Integration: ❌ **NOT YET INTEGRATED** into write paths

**Required Work**:
- Add detection of missing materialized view in write operations
- Call `reconstructFromManifest()` when detected
- Write reconstructed content to materialized views
- Continue with original operation (edit, zone change, etc.)

**Usage Locations** (need updates):
- `applyEdit`: Check for materialized view before loading
- `moveAsset`: Check before zone tag updates
- Snapshot creation: Check source file exists before copy

**Open Questions**:
- Should we emit a diagnostic event when this occurs?
- Should we track "repair count" metrics?
- How do we handle partial absence (`.wml` exists but `.ndjson` missing)?

---

### Scenario 3: Both Manifest and Materialized View Missing

**When**: First write to an asset, or complete data loss

**Current State**:
- No manifest: `{uuid}.wml/manifest-latest.ndjson` missing
- No materialized views: `{uuid}.wml`, `{uuid}.ndjson` missing
- Possible: Chunks/snapshots exist in S3 but no references (orphaned data)

**Resolution Strategy** (Empty Placeholder Creation):
When the requesting operation provides sufficient initialization data:
1. Create empty StandardForm/StandardAuthorizationCollection
2. Apply operation's data (edit, zone change, etc.)
3. Write materialized views
4. Create manifest with initialization events

**Works For**:
- `applyEdit` with `createIfNeeded`: Creates asset with edit content
- `moveAsset`: Creates empty asset with zone transition history
- Any operation that provides meaningful initialization data

**Doesn't Work For**:
- `writeSnapshot`: No content to snapshot → Error
- `applyEdit` without `createIfNeeded`: Intentional prevention of auto-creation → Error
- Operations that assume existing content

**Implementation Status**: ✅ **PARTIALLY IMPLEMENTED**
- `applyEdit` with `createIfNeeded`: ✅ Working
- `moveAsset` empty placeholder: ❌ Not yet implemented
- Centralized `immediateSelfRepair`: ❌ Not yet implemented

**Edge Case - Orphaned Chunks** (Deferred to Phase 3):
If chunks/snapshots exist in S3 but both manifest and materialized views missing:
- Requires S3 ListObjects to discover orphaned files
- Reconstruct manifest from S3 object metadata
- Complex recovery logic
- Should be asynchronous repair, not on-the-spot

---

## Scenario Comparison Matrix

| Scenario | Manifest | Materialized View | Repair Strategy |
|----------|----------|-------------------|-----------------|
| 1. Legacy Asset | ❌ Missing | ✅ Exists | Create manifest from current state |
| 2. View Loss | ✅ Exists | ❌ Missing | Reconstruct from manifest |
| 3. Both Missing | ❌ Missing | ❌ Missing | Create empty placeholder (if operation provides initialization data) |

**Note on Scenario 3**: "Both missing" is repairable when the requesting operation provides sufficient data to initialize:
- `applyEdit` with `createIfNeeded`: Provides edit content + zone → Create asset with content
- `moveAsset`: Provides fromZone + toZone → Create empty asset with zone history
- `writeSnapshot`: Provides nothing meaningful → **Error** (cannot snapshot nothing)
- Future operations: May provide other initialization data

---

## Design Challenges for `immediateSelfRepair`

### Challenge 1: Reconstruction Strategy When View Missing

**Context**: When materialized view is missing but manifest exists (Scenario 2)

**Questions**:
- Should we **always** reconstruct and write back to materialized view location?
- Or should we **sometimes** skip materialized view and write directly to destination?
- How to handle cases where reconstruction might fail (missing chunks)?

**Example Case**: `writeSnapshot` operation with missing source
- **Option A**: Reconstruct → Write materialized view → CopyObject to snapshot
  - Pro: Repairs materialized view for future operations
  - Con: Extra S3 write if view not needed again soon
- **Option B**: Reconstruct → Write directly to snapshot location
  - Pro: Efficiency - one less S3 write
  - Con: Leaves materialized view missing (inconsistent state)

**Leaning toward**: Option A (always repair materialized views) for consistency
- Materialized views are source of truth for Phase 1 compatibility
- Better to have complete repair than partial optimization

---

### Challenge 2: Empty Authorization Files

**Context**: Assets may have content but no authorization file (Gap 3)

**Questions**:
- Should `immediateSelfRepair` create empty auth manifests/snapshots?
- Or should it treat "no auth file" as a valid state (skip repair)?
- How to distinguish "empty by design" from "accidental deletion"?

**Example Case**: `moveAsset` on asset with content but no auth file
- **Option A**: Create empty auth manifest + snapshot during repair
  - Pro: Structural consistency (all assets have both prefixes)
  - Pro: Zone change tracked in auth manifest
  - Con: Creates potentially unnecessary files
- **Option B**: Skip auth repair entirely (only repair content)
  - Pro: Storage efficiency
  - Con: Missing zone history for auth prefix
  - Con: Inconsistent behavior (some assets have auth manifests, some don't)
- **Option C**: Create auth manifest only (no snapshot until auth content exists)
  - Pro: Tracks zone changes without full file structure
  - Con: Incomplete repair (manifest without corresponding snapshot)

**Leaning toward**: Option B (skip auth when absent) for pragmatism
- Auth files are optional (not all assets have authorization)
- Creating empty structures is premature
- Can lazy-init auth manifest when auth content is actually created

---

### Challenge 3: Operation-Specific Data Requirements

**Context**: Different operations provide different data to `immediateSelfRepair`

**Questions**:
- What's the minimal data each operation type must provide?
- How to handle operations that can't complete repair (insufficient data)?
- Should repair fail gracefully or error?

**Example Cases**:

**`applyEdit` with `createIfNeeded`**:
- Provides: Edit delta, zone, assetId
- Can repair: Yes - create empty asset + apply edit + create manifest
- Complete: Yes

**`moveAsset`**:
- Provides: Zone change (fromZone, toZone)
- Can repair manifest missing: Yes - create manifest with ZoneChange event
- Can repair both missing: **Yes** - create empty asset with zone history
- Complete: Yes - preserves zone transition information

**`writeSnapshot`**:
- Provides: Zone, timestamp
- Can repair view missing: Yes - reconstruct from manifest
- Can repair both missing: **Questionable** - can snapshot empty content, but is it useful?
- Should: Probably error (snapshots imply existing content to preserve)

**Design Principles**: 
- Operations that track **metadata** (zone changes, edits) can create empty placeholders
- Empty asset placeholders are valid initialization points (consistent with first-write scenario)
- Operations purely for **preservation** (snapshots) should error if nothing exists to preserve

---

## Design Principles

### 1. Fail-Safe Defaults

Operations should degrade gracefully and attempt repair before failing completely.

### 2. Observability

All repair actions should be logged with clear context:
```typescript
console.log(`Self-repair: Reconstructing materialized view from manifest (prefix: ${prefix}, reason: source file missing)`)
```

### 3. Idempotency

Repair operations should be safe to retry and produce consistent results.

### 4. Minimal Scope

On-the-spot repair should only fix immediate blockers, not perform comprehensive validation.

### 5. Diagnostic Integration

Repair actions should emit diagnostic events for monitoring and alerting (Phase 3).

---

## Integration Points

### Operations Using Self-Repair

All write operations integrate via the `withS3SelfRepair()` wrapper:

1. **Edit Operations** (`applyEdit`)
   - Fetch: AssetWorkspace, manifest, materialized view
   - Action: Merge edit, write chunk, update manifest
   - Repair: Create empty asset if `createIfNeeded`, or error

2. **Zone Changes** (`moveAsset`)
   - Fetch: AssetWorkspace, manifest, materialized views (both content and auth)
   - Action: Append ZoneChange events, update S3 tags
   - Repair: Create empty asset with zone history

3. **Snapshot Creation** (`writeSnapshot`)
   - Fetch: Manifest, materialized view (source for copy)
   - Action: CopyObject to snapshot location, append SnapshotEvent
   - Repair: Reconstruct view then snapshot, or error if both missing

4. **Manual Snapshots** (`createManualSnapshot`)
   - Inherits: All repair needs from `writeSnapshot`
   - Called by: DataSource handlers for snapshot requests

### The `withS3SelfRepair()` Wrapper Provides

- **Detection**: Fetch function identifies what's present/missing
- **Routing**: Automatically chooses repair vs normal action path
- **Reconstruction**: Delegates to `immediateSelfRepair` when needed
- **Consistency**: All operations use same repair logic
- **Logging**: Centralized observable repair actions

---

## Next Steps

### Phase 2 Completion (On-the-Spot Repair)

#### 1. Design Decisions

**Challenge 1 - Reconstruction Strategy**:
- Decision: Always repair materialized views (Option A) vs selective repair
- Impact: Consistency vs efficiency trade-off
- Recommendation: Option A for Phase 2 (optimize in Phase 3 if needed)

**Challenge 2 - Empty Auth Files**:
- Decision: Skip auth repair when no auth file (Option B) vs always create
- Impact: Storage efficiency vs structural consistency
- Recommendation: Option B for Phase 2 (auth is optional)

**Challenge 3 - Operation Error Handling**:
- Decision: Which operations can repair "both missing" vs which should error
- Rule: Operations providing initialization data can create empty placeholders
- Examples: `applyEdit` (with `createIfNeeded`), `moveAsset` → Success
- Counter-examples: `writeSnapshot`, `applyEdit` (without flag) → Error

#### 2. Design Interfaces

**`immediateSelfRepair` Interface**:
- Input: prefix, state (what's missing), operation (type + data)
- Return: success/error, what was repaired
- Error conditions for impossible repairs
- Logging/diagnostic event emission

**`withS3SelfRepair` Wrapper**:
- Input: prefix, fetch function, action function, repairOperation
- Return: unified result from action or repair
- Handles fetch → assess → repair-or-act flow
- Provides clean operation integration point

#### 3. Implementation

Create self-repair module:
- File: `lambda/wml/s3Storage/manifest/selfRepair.ts`
- Exports: `withS3SelfRepair()`, `immediateSelfRepair()`
- Implements all repair paths from scenarios
- Tests: Cover all scenario combinations × operation types

#### 4. Integration

Update each operation to use `withS3SelfRepair()`:
- Wrap operation in self-repair pattern
- Define fetch logic (load manifest, views)
- Define action logic (normal operation when data complete)
- Provide repairOperation metadata
- Remove scattered defensive code and detection logic

#### 5. Testing Strategy

Comprehensive coverage:
- Each scenario (1, 2, 3A, 3B) × each operation type
- Content vs authorization prefixes
- Empty vs populated content
- Error cases (both missing for move/snapshot operations)

### Phase 3 (Asynchronous Repair)

Deferred - see Phase 3 planning in main migration document.

---

## Related Documentation

- **[Manifest System](AGENT.md)**: Manifest format and operations
- **[S3 Storage Migration](../../AGENT.s3storage.migration.md)**: Overall migration plan
- **[Phase 3 Planning](../../AGENT.s3storage.migration.md#phase-3-advanced-features)**: Async corruption detection

---

**Document Status**: Initial draft created October 23, 2025 as design foundation for Phase 2 completion.

