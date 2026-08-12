# Self-Repair in the s3Storage Pipeline

**Status**: ✅ **IMPLEMENTED**

**Created**: October 26, 2025 (extracted from prototype documentation)

**Purpose**: Document how the s3Storage pipeline handles file absence and self-repair scenarios.

---

## Overview

The s3Storage system must handle various scenarios where expected files are missing or corrupted. Rather than scattering defensive code across operations, **self-repair is a first-class architectural concern** integrated into the generic pipeline.

---

## Core Architecture: Linear Flow Pattern

The pipeline separates **decision logic** from **execution logic**, enabling centralized repair detection and operation-specific repair execution.

### The Pipeline Flow

```typescript
async function applyStorageOperation<TArgs, TResult>(
    fetchArgs: FetchArgs,
    operationArgs: TArgs,
    strategy: ExecutionStrategy<TArgs, TResult>
): Promise<TResult | OperationFailure>
```

**Phase 1: Fetch and Decide** (`fetchAndDecideRepair`)
1. Load manifest
2. Create workspace and load materialized view
3. Assess repair state (what's missing)
4. Build baseline with repair decision
5. Return baseline + repair decision to strategy

**Phase 2: Execute Strategy** (operation-specific)
- Receives: baseline, repair decision, fetch result, operation args
- Can optimize based on repair decision
- Performs content transformation (if any)
- Executes writes (coordinated single write, not duplicate)

**Key Principle**: Repair is decided centrally, executed by strategies. Each operation can optimize based on repair needs.

---

## Repair Scenarios

The system handles three primary scenarios where files may be missing:

### Scenario 1: Manifest Missing, Materialized View Exists

**When**: Operating on legacy assets or after manifest loss

**Current State**:
- Materialized view files exist: `{uuid}.wml`, `{uuid}.ndjson`
- No manifest exists: `{uuid}.wml/manifest-latest.ndjson` missing
- System has current content but no history

**Detection** (in `fetchAndDecideRepair`):
```typescript
const manifestMissing = manifest.length === 0
const materializedViewMissing = workspace.status.s3Missing === true
// State: { manifestMissing: true, materializedViewMissing: false }
```

**Resolution Strategy** (Lazy Migration):
1. Use existing materialized view as baseline
2. Create initial snapshot from baseline
3. Create manifest with:
   - Initial `ZoneChange` event (fromZone: null → current zone)
   - Initial `Snapshot` event
4. Let strategy append operation's events

**Implementation** (in `decideAndBuildBaseline`):
```typescript
if (state.manifestMissing && !state.materializedViewMissing) {
    const baseline = isAuth ? workspace.authorizations : workspace.standard
    const snapshot = await writeSnapshot({ ... })
    
    return {
        success: true,
        baseline,
        repairDecision: {
            repairNeeded: true,
            repairActions: {
                createdSnapshot: true,
                reconstructedView: false,
                synthesizedEmpty: false
            },
            repairEvents: [
                { type: 'zoneChange', fromZone: null, toZone: zone, ... },
                { type: 'snapshot', s3Key: snapshot.s3Key, ... }
            ]
        }
    }
}
```

**Used By**: All operations when encountering legacy assets

---

### Scenario 2: Materialized View Missing, Manifest Exists

**When**: Materialized view deleted but manifest/chunks intact

**Current State**:
- Manifest exists: `{uuid}.wml/manifest-latest.ndjson` present
- Chunks/snapshots referenced in manifest exist
- Materialized view missing: `{uuid}.wml`, `{uuid}.ndjson` absent

**Detection** (in `fetchAndDecideRepair`):
```typescript
const manifestMissing = manifest.length === 0
const materializedViewMissing = workspace.status.s3Missing === true
// State: { manifestMissing: false, materializedViewMissing: true }
```

**Resolution Strategy** (Reconstruction):
1. Load manifest events
2. Reconstruct current state from snapshot + chunks
3. Use reconstructed content as baseline
4. Let strategy write to materialized views

**Implementation** (in `decideAndBuildBaseline`):
```typescript
if (!state.manifestMissing && state.materializedViewMissing) {
    const reconstruction = await reconstructFromManifest({ ... })
    
    return {
        success: true,
        baseline: reconstruction.standardForm,
        repairDecision: {
            repairNeeded: true,
            repairActions: {
                createdSnapshot: false,
                reconstructedView: true,
                synthesizedEmpty: false
            },
            repairEvents: [] // No new events, just repair
        }
    }
}
```

**Used By**: All operations when materialized view is lost

---

### Scenario 3: Both Manifest and Materialized View Missing

**When**: First write to an asset, or complete data loss

**Current State**:
- No manifest: `{uuid}.wml/manifest-latest.ndjson` missing
- No materialized views: `{uuid}.wml`, `{uuid}.ndjson` missing

**Detection** (in `fetchAndDecideRepair`):
```typescript
const manifestMissing = manifest.length === 0
const materializedViewMissing = workspace.status.s3Missing === true
// State: { manifestMissing: true, materializedViewMissing: true }
```

**Resolution Strategy** (depends on `createIfNeeded` flag):

#### 3A: Creation Allowed (`createIfNeeded: true`)

1. Create empty StandardForm/StandardAuthorizationCollection
2. Use as baseline
3. Let strategy apply operation's content
4. Create manifest with initialization events

**Implementation** (in `decideAndBuildBaseline`):
```typescript
if (state.manifestMissing && state.materializedViewMissing) {
    if (createIfNeeded) {
        const baseline = synthesizeEmpty(assetId, isAuth)
        
        return {
            success: true,
            baseline,
            repairDecision: {
                repairNeeded: true,
                repairActions: {
                    createdSnapshot: false,
                    reconstructedView: false,
                    synthesizedEmpty: true
                },
                repairEvents: [
                    { type: 'zoneChange', fromZone: null, toZone: zone, ... }
                ]
            }
        }
    }
}
```

**Used By**: 
- `appendChunk` with `createIfNeeded: true` (creates asset with edit content)
- `changeZone` (creates empty asset with zone history)

#### 3B: Creation Not Allowed (`createIfNeeded: false`)

Return error - cannot operate on non-existent asset.

**Implementation**:
```typescript
if (state.manifestMissing && state.materializedViewMissing) {
    if (!createIfNeeded) {
        return {
            success: false,
            error: 'Asset not found (both manifest and view missing)',
            errorType: 'not-found'
        }
    }
}
```

---

### Scenario 4: Materialized View Present but Stale

**When**: `.ndjson` exists but was serialized by an older `StandardComponent.toJSON()`/`fromJSON()` shape than the current `.wml` parser produces (for example after a field rename). Not detected by `workspace.status.s3Missing` --- the file is present, just stale --- so this scenario falls entirely outside the `fetchAndDecideRepair`/`applyStorageOperation` pipeline that Scenarios 1-3 share.

**Detection**: Not automatic yet. No periodic sweep exists (deferred; see [`AGENT.development.md`](AGENT.development.md)'s "WML Lambda Self-Diagnostics"). Detected today by manual inspection or suspicion after a schema-shape change.

**Trigger**: Manual `WML Materialized View Finding` diagnostic event (`mtw.diagnostics` source, `lambda/wml` DataSource). See [`AGENT.event.md`](../AGENT.event.md) for the event contract and manual trigger command.

**Resolution** (`processWMLMaterializedViewFinding`, `lambda/wml/dataSource/mtw-wml.ts`):
1. `AssetWorkspace.fromUUID` loads the workspace.
2. `workspace.loadWML()` re-parses `.wml` fresh into a new `StandardForm`.
3. If `workspace.standard` is set after that (i.e. the parse succeeded), `workspace.pushJSON()` rewrites `.ndjson` with the fresh content, then `streamEvent({ header: { type: 'Content Update' } })` publishes so `lambda/assets`/DynamoDB also resync.
4. If `loadWML()` failed, `workspace.standard` stays unset and the handler skips `pushJSON()`/`streamEvent()` entirely --- otherwise an unconditional `pushJSON()` would overwrite a healthy `.ndjson` with an empty `StandardForm`.

**Idempotent**: safe to re-trigger on an asset whose `.ndjson` is already fresh (confirmed by test).

---

## Scenario Comparison Matrix

| Scenario | Manifest | Materialized View | Repair Strategy | Baseline Source |
|----------|----------|-------------------|-----------------|-----------------|
| 1. Legacy Asset | ❌ Missing | ✅ Exists | Lazy Migration | Existing view |
| 2. View Loss | ✅ Exists | ❌ Missing | Reconstruction | Reconstructed from manifest |
| 3A. First Write | ❌ Missing | ❌ Missing | Synthesize Empty | Created empty form |
| 3B. Not Found | ❌ Missing | ❌ Missing | Error | N/A |
| 4. View Stale | ✅ Exists | ✅ Exists (stale) | Manual diagnostic resync | Fresh `.wml` parse |

---

## Design Decisions Made

### Decision 1: Always Repair Materialized Views

**Challenge**: When materialized view is missing, should we repair it or skip it?

**Decision**: Always reconstruct and write materialized views when missing (Scenario 2)

**Rationale**:
- Materialized views are source of truth for Phase 1 compatibility
- Better to have complete repair than partial optimization
- Ensures consistent state for future operations

**Implementation**: Reconstruction happens in `decideAndBuildBaseline`, writing happens in execution strategies

---

### Decision 2: Skip Auth Repair When Absent

**Challenge**: Should we create empty auth manifests/snapshots for assets that have no auth?

**Decision**: Skip auth repair when no auth file exists (auth is optional)

**Rationale**:
- Auth files are optional (not all assets have authorization)
- Creating empty structures is premature
- Can lazy-init auth manifest when auth content is actually created

**Implementation**: Each operation (e.g., `appendChunk`, `changeZone`) processes both content and auth separately; auth operations naturally create auth structures when needed

---

### Decision 3: Operation-Specific Empty Placeholder Rules

**Challenge**: Which operations can create empty placeholders when both files missing?

**Decision**: Operations providing initialization data can create empty placeholders

**Rule**:
- Operations that track **metadata** (zone changes, edits) → Can create empty placeholders ✅
- Operations purely for **preservation** (snapshots) → Should error if nothing exists ❌

**Examples**:
- `appendChunk` with `createIfNeeded`: ✅ Creates asset with edit content
- `changeZone`: ✅ Creates empty asset with zone history
- Hypothetical `writeSnapshot` alone: ❌ Cannot snapshot nothing

**Implementation**: The `createIfNeeded` flag controls this behavior in `decideAndBuildBaseline`

---

## Operation Integration Examples

### Example 1: `appendChunk` Operation

**Scenario**: Edit an existing asset (Scenario 1 or 2 possible)

**Flow**:
1. **Fetch Phase**: Load manifest, workspace, detect state
2. **Decide Phase**: 
   - If manifest missing → Lazy migration (use existing view, create snapshot)
   - If view missing → Reconstruction (from manifest)
   - Return baseline + repair decision
3. **Execute Phase**:
   - Apply chunk to baseline (in-memory merge)
   - Write chunk file
   - Write merged content to materialized views
   - Append events (repair events + chunk event) to manifest
   - **Single coordinated write** - no duplicate S3 operations

**Key Optimization**: Repair and operation happen in-memory, single write phase

---

### Example 2: `changeZone` Operation

**Scenario**: Move asset from Personal to Library

**Flow**:
1. **Fetch Phase**: Load manifest, workspace, detect state
2. **Decide Phase**: Determine repair needs, return baseline + decision
3. **Execute Phase**:
   - **Optimization branch** based on repair decision:
     - If NO repair needed → Fast path: Update S3 tags only (4 updateTags calls)
     - If repair needed → Full path: Write content + manifest + update tags
   - **Key insight**: Operation can optimize differently based on repair state

**Key Optimization**: Tag-only updates preserved when no repair needed, showing how strategies can optimize based on repair decision

---

## Integration with Testing

### Unit Testing Pattern

Operations are tested by mocking the pipeline, not its internals:

```typescript
mockApplyStorageOperation.mockImplementation(async (fetchArgs, operationArgs, strategy) => {
    const baseline = new StandardForm(existingContent)
    const repairDecision = {
        repairNeeded: false,
        repairActions: undefined,
        repairEvents: []
    }
    const workspace = createMockWorkspace({ standard: baseline })
    const fetchResult = { baseline, repairDecision, workspace, manifest: [] }
    
    return await strategy(baseline, repairDecision, fetchResult, operationArgs)
})
```

This allows testing each repair scenario independently by controlling the repair decision.

---

## Design Principles

### 1. Fail-Safe Defaults

Operations should degrade gracefully and attempt repair before failing completely.

**Implementation**: `fetchAndDecideRepair` tries all repair strategies before returning error

---

### 2. Observability

All repair actions are logged with clear context:

```typescript
console.log(`Self-repair: Creating snapshot for lazy migration (assetId: ${assetId}, zone: ${zone})`)
console.log(`Self-repair: Reconstructing view from manifest (${chunksApplied} chunks applied)`)
console.log(`Self-repair: Synthesizing empty baseline (createIfNeeded: ${createIfNeeded})`)
```

---

### 3. Idempotency

Repair operations produce consistent results when retried:
- Lazy migration always creates same initial events
- Reconstruction always produces same content from same manifest
- Empty synthesis always produces same empty structure

---

### 4. Minimal Scope

On-the-spot repair only fixes immediate blockers:
- Missing manifest → Create it
- Missing view → Reconstruct it
- Both missing + createIfNeeded → Initialize it
- Complex scenarios (orphaned chunks, corruption) → Deferred to async repair (Phase 3)

---

### 5. Single Write Coordination

**Critical Optimization**: Repair and operation happen in-memory, then single coordinated write

**Old Pattern** (withS3SelfRepair wrapper):
1. Detect missing files
2. Repair → Write to S3
3. Re-fetch
4. Operation → Write to S3 (duplicate write!)

**New Pattern** (pipeline):
1. Fetch and decide repair in-memory
2. Execute strategy with baseline + repair decision
3. Single coordinated write (repair + operation together)

**Result**: Eliminates duplicate S3 writes, improves performance

---

## Future: Asynchronous Repair (Phase 3)

**Deferred Scenarios**:
- Corrupted manifest events (invalid JSON, missing fields)
- Missing chunks referenced in manifest
- Manifest inconsistencies (out-of-order events, duplicate IDs)
- Snapshot file corruption
- Orphaned chunks (chunks exist but no manifest)

**Approach**:
- Periodic validation scans
- Diagnostic event emission
- Background healing workflows
- Complex reconstruction requiring S3 ListObjects

---

## Related Documentation

- **[Pipeline Architecture](./pipeline.ts)**: Generic pipeline implementation
- **[Operation Implementations](./index.ts)**: `appendChunk`, `changeZone` implementations
- **[Manifest System](./manifest/AGENT.md)**: Manifest format and operations
- **[S3 Storage Architecture](AGENT.md)**: Current architecture and core concepts
- **[Development Roadmap](AGENT.development.md)**: Future enhancements including SAGA and transaction patterns

---

**Document Status**: Created October 26, 2025 to preserve conceptual insights from prototype while documenting current implementation.

