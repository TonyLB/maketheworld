# S3 Storage System - Development Roadmap

**Status**: Phase 3 Planning  
**Last Updated**: October 26, 2025

This document outlines future enhancements and development priorities for the S3 storage system after the completion of Phase 2 (chunk-based snapshot architecture).

## Current Status

**Phase 1**: ✅ Complete (October 16, 2025) - Flat UUID-based storage  
**Phase 2**: ✅ Complete (October 26, 2025) - Chunk-based snapshots  
**Phase 3**: 📋 Planned - Advanced features and optimizations

## Phase 3: Advanced Features

### High Priority Features

#### Authorization Edit Integration
**Status**: Infrastructure Complete, Dual Transmission Capability Identified

The infrastructure for authorization edits is already in place and tested. The system supports two approaches:

**Approach 1: Separate Authorization Chunks** (Current Implementation Path)
- **Parse Grant tags** from incoming WML (when sent separately)
- **Write authorization chunks** using existing generic operations
- **Update authorization manifests** with chunk events
- **Maintain materialized views** for authorization files

**Approach 2: Dual Transmission Format** (Future Enhancement)
- **Combined WML Format**: Single WML structure containing both content components and authorization grants
- **Duplex Parsing**: Parse incoming WML once, extract both content and authorization separately
- **Non-Semantic References**: Use `ref={0}` for authorization component references to avoid interfering with semantic content structure
- **Parallel Application**: Apply content edits to `StandardForm` and authorization edits to `StandardAuthorizationCollection` simultaneously

**Current State** (December 2025):
- ✅ **Infrastructure exists**: Both `StandardForm` and `StandardAuthorizationCollection` can parse WML containing both types
- ✅ **Reference system ready**: `ref={0}` capability enables non-semantic references for organizational purposes
- ❌ **Not yet sending**: Front-end only sends content (grants are ignored by `StandardForm.schema`)
- ❌ **Not yet parsing**: Backend `executeAppendChunkStrategy` explicitly rejects authorization chunks with "Authorization chunk application not yet implemented"

**Implementation Requirements** (for Dual Transmission):

1. **Backend Parsing** (`lambda/wml/s3Storage/index.ts` - `executeAppendChunkStrategy`):
   - Parse incoming WML once to get schema tree
   - Extract content components → `StandardForm` (already works, ignores grants)
   - Extract authorization grants → `StandardAuthorizationCollection` (via `processAuthorizations`)
   - Apply both edits separately to their respective baselines
   - Ensure authorization component references use `ref={0}` when creating `StandardAuthorizationResource` instances

2. **Reference Handling** (`packages/mtw-wml/ts/standardize/authorization/processAuthorizations.ts`):
   - When `processAuthorizations` creates component references for authorization grants, ensure they use `ref={0}`
   - This prevents authorization component references from interfering with semantic references in content

3. **Front-End Support** (Future):
   - Optionally include authorization grants in edit WML when both content and authorization are being modified
   - Use `StandardForm.schema` with authorization parameter (if implemented) or construct combined WML manually

**Benefits of Dual Transmission**:
- ✅ **Atomic Operations**: Content and authorization edits can be applied together
- ✅ **Reduced Round-Trips**: Single edit operation for combined changes
- ✅ **Simplified Merging**: Combined storage/transmission format for `StandardAuthorizationCollection` into content-ful `StandardForm`
- ✅ **Safe Separation**: `ref={0}` ensures authorization references don't affect semantic content structure

**Implementation**: All chunk/manifest/snapshot operations already accept prefix parameter for authorization files. The key addition is dual parsing logic in the execution strategy and ensuring `ref={0}` for authorization component references.

#### S3 Lifecycle Policies
**Status**: Deferred from Phase 2 (premature during active development)

Implement cost optimization through intelligent archival:

- **Transition archived chunks** to Glacier based on age and zone
- **Snapshot archival policies** for long-term storage
- **Manifest lifecycle management** for storage efficiency
- **Zone-based policies** (Archive zone → Glacier faster)

**Benefits**: Significant cost reduction for long-lived assets with infrequent access.

#### Automatic Snapshot Triggers
**Status**: Manual capability exists, automatic triggers needed

Implement intelligent snapshot creation:

- **Time-based triggers** (daily/weekly snapshots)
- **Count-based triggers** (snapshot after N chunks)
- **Size-based triggers** (snapshot when chunks exceed threshold)
- **Event-based triggers** (snapshot on zone changes, major edits)

**Implementation**: Extend existing `createManualSnapshot()` with trigger logic.

### Medium Priority Features

#### Manifest Corruption Detection and Self-Healing
**Status**: Current graceful degradation, future active healing

Transform silent failures into observable, self-repairing system:

**Current State (Phase 2)**:
- `loadManifest()` silently skips invalid/unparseable events with console warnings
- Graceful degradation maintains system operation

**Future Enhancement**:
- **Detect corruption** and trigger diagnostic run
- **Emit diagnostic events** describing corruption (invalid line numbers, event types)
- **Trigger self-healing workflow** to reconstruct manifest from S3 metadata
- **Use chunk/snapshot object metadata** to rebuild authoritative manifest
- **Compare reconstructed vs corrupted manifest** and emit comprehensive finding

**Pattern**: Maintains backward compatibility - Phase 2 gracefully degrades, Phase 3 actively heals.

#### WML Lambda Self-Diagnostics
**Status**: First slice shipped (manual trigger); periodic sweep still open

**Shipped**: A manually-triggerable `WML Materialized View Finding` diagnostic event (source `mtw.diagnostics`) that resyncs a stale `.ndjson` materialized view from a fresh `.wml` parse and propagates the fix to `lambda/assets`/DynamoDB via a chained `Content Update` publish. See [`AGENT.selfRepair.md`](AGENT.selfRepair.md)'s Scenario 4 for repair mechanics and [`../AGENT.event.md`](../AGENT.event.md) for the event contract and manual trigger command.

**Still open**: Detection is entirely manual --- no periodic/automatic sweep exists yet to find `.ndjson`/`.wml` drift across all assets and emit findings on its own. A future slice can add that sweep as a separate initiative once the manual primitive above has been exercised in practice:

- **Create `lambda/wml/diagnostics/`** directory for self-validation
- **Listen for `Diagnostic Run Started`** events from mtw.diagnostics
- **Validate manifests** using WML's own reconstruction code
- **Emit findings** back to diagnostics for aggregation
- **Maintains domain authority** (WML validates WML storage)

**Benefits**: Proactive issue detection and resolution.

#### Manifest Archival and Pagination
**Status**: Current single manifest, future pagination needed

Handle long-lived assets with extensive history:

- **Manifest pagination** for assets with thousands of events
- **Archival strategies** for old manifest pages
- **Efficient reconstruction** from paginated manifests
- **Query optimization** for historical data

### Lower Priority Features

#### Point-in-Time Queries and Rollback UI
**Status**: Infrastructure exists, UI needed

Enable user-facing historical access:

- **Point-in-time queries** using snapshot + chunk replay
- **Rollback UI** for reverting to previous states
- **Historical browsing** of asset evolution
- **Diff visualization** between versions

#### Asset Merge History Tracking
**Status**: Individual asset history exists, merge tracking needed

Track complex asset relationships:

- **Merge event tracking** when assets are combined
- **Dependency graphs** for asset relationships
- **Merge conflict resolution** history
- **Cross-asset provenance** tracking

#### Performance Optimization
**Status**: Current performance adequate, future optimizations

Advanced performance enhancements:

- **Parallel chunk loading** for reconstruction
- **Caching strategies** for frequently accessed assets
- **Batch operations** for multiple asset updates
- **Connection pooling** for S3 operations

### Advanced Architecture Patterns

#### SAGA Pattern for Rollback Safety
**Status**: Future enhancement - prerequisite for transaction/builder pattern

**Problem**: Current implementation executes writes sequentially for safety, but partial failures can leave inconsistent state.

**Current Design** (Phase 2):
```typescript
// If any step fails, we may be in inconsistent state
await writeChunkFile()      // Succeeds
await writeMaterializedView() // Succeeds  
await appendManifest()       // FAILS!
// Problem: Chunk and view written, but no manifest entry
```

**Future Evolution** (SAGA pattern):
```typescript
const saga = new StorageSaga()
try {
    await saga.do(() => writeChunkFile(params), 
                  () => deleteChunkFile(params))  // Compensating action

    await saga.do(() => writeMaterializedView(content),
                  () => restorePreviousView(previousContent))

    await saga.do(() => appendManifest(events),
                  () => removeManifestEvents(events))

    await saga.commit()  // All succeeded
} catch (error) {
    await saga.rollback()  // Execute compensating actions in reverse
    throw error
}
```

**How it would work:**
1. Each operation registers a "forward action" and "compensating action"
2. Forward actions execute sequentially (or in parallel with SAGA!)
3. On success: commit and clear compensation queue
4. On failure: execute compensating actions in reverse order (LIFO)
5. System returns to consistent state even after partial execution

**Compensating Actions by Operation:**
- **Write chunk file** → Delete chunk file
- **Write materialized view** → Restore previous version (keep shadow copy or reconstruct from manifest)
- **Append manifest** → Remove appended events (truncate or write corrected version)
- **Write snapshot** → Delete snapshot file

**Benefits:**
- ✅ Guaranteed consistency even on partial failure
- ✅ No "orphaned" files or inconsistent state
- ✅ Clear error recovery semantics
- ✅ Foundation for transaction/builder pattern
- ✅ **Enables parallel S3 writes** (key performance unlock!)

**Parallel Write Optimization:**

SAGA pattern unlocks a critical performance improvement: **optimistic parallel writes**

**Current approach** (sequential for safety):
```typescript
await writeChunkFile()         // Write 1, wait
await writeMaterializedView()  // Write 2, wait
await appendManifest()         // Write 3, wait
// Total time: T1 + T2 + T3 (sequential)
```

**With SAGA** (parallel with rollback safety):
```typescript
// Compose everything in memory first
const chunkContent = prepareChunk()
const viewContent = applyChunkToBaseline(baseline, chunkContent)
const manifestEvents = buildEvents([...repairEvents, chunkEvent])

// Start ALL writes in parallel
const saga = new StorageSaga()
await Promise.all([
    saga.do(() => writeChunkFile(chunkContent), () => deleteChunk()),
    saga.do(() => writeMaterializedView(viewContent), () => restoreView()),
    saga.do(() => appendManifest(manifestEvents), () => rollbackManifest())
])

// If ANY fail, rollback ALL
// If all succeed, commit
// Total time: max(T1, T2, T3) (parallel!)
```

**Performance impact**: 
- Sequential: ~600ms (3 × 200ms S3 writes)
- Parallel: ~200ms (max of concurrent writes)
- **3x speedup** for typical operation

**Why this is safe with SAGA but not without**:
- Without rollback: If manifest write fails after chunk succeeds, we have orphaned chunk (inconsistent)
- With SAGA: If manifest fails, compensating action deletes chunk (consistent)
- SAGA removes the dependency that forced sequential writes

**Implementation Approaches:**

1. **Best-effort compensation** (simpler):
   - Delete newly written files on error
   - Accept that manifest is append-only (add "rollback" event?)
   - Document eventual consistency window

2. **Full compensation** (complex):
   - Keep shadow copies before writes
   - Implement manifest event reversal/correction
   - More storage overhead, stronger guarantees

**Challenges:**
- S3 doesn't support transactions natively
- Some compensating actions are complex (manifest is append-only)
- Need to handle compensation failures
- Performance cost of tracking previous state

**Feasibility**: Medium - S3's lack of transactions makes full ACID guarantees difficult, but best-effort compensation is achievable

#### Transaction/Builder Pattern for Batched Operations
**Status**: Future enhancement - natural extension of Phase 2 encapsulation

**Problem**: Current implementation executes each operation immediately, missing optimization opportunities for batched workflows.

**Current Design** (Phase 2):
```typescript
// Each operation executes immediately
await storage.appendChunk({ assetId, chunkWML: chunk1, timestamp })
await storage.appendChunk({ assetId, chunkWML: chunk2, timestamp })
await storage.appendChunk({ assetId, chunkWML: chunk3, timestamp })
await storage.createSnapshot({ assetId, timestamp, snapshotType: 'manual' })
// Result: 3 view writes + 3 manifest appends + 3 chunk writes + 1 snapshot
```

**Future Evolution** (builder pattern):
```typescript
// Queue operations, execute as optimized batch
const storage = new S3Storage(assetId)
await storage
    .appendChunk(chunk1)
    .appendChunk(chunk2)
    .appendChunk(chunk3)
    .createSnapshot()
    .execute()
// Result: 1 view write + 1 manifest append + 3 chunk writes + 1 snapshot
```

**How it would work:**
1. Operations return builder object instead of executing
2. `.execute()` analyzes queue and optimizes:
   - Apply all chunks to in-memory `StandardForm` sequentially
   - Write materialized view **once** with final state
   - Write all chunk files in parallel (with SAGA rollback safety)
   - Append **one** manifest entry: `[Chunk, Chunk, Chunk, Snapshot]`
   - Write final snapshot

**Benefits:**
- ✅ Maximum S3 I/O optimization (batch operations)
- ✅ Natural extension of current encapsulation model
- ✅ Backward compatible (current single-operation calls still work)
- ✅ Enables complex workflows (e.g., "apply these edits, then snapshot")
- ✅ Reduces S3 operations from O(n) to O(1) for materialized views
- ✅ Enables parallel chunk writes with SAGA rollback safety

**Challenges:**
- Transaction semantics (all-or-nothing vs partial success?)
- Error handling mid-batch (rollback strategy - requires SAGA pattern)
- Implementation complexity (operation queue management)
- Requires instantiable S3Storage class (current design uses functions)

**Feasibility**: High - current design already encapsulates operation effects, making them easy to queue and optimize

**Dependencies**: 
- SAGA pattern provides rollback safety for parallel operations
- Current Phase 2 implementation provides foundation for batching

**Implementation Order**:
1. Phase 1: Implement SAGA pattern for rollback safety
2. Phase 2: Convert functional API to class-based builder pattern
3. Phase 3: Optimize execution with batch analysis

#### Investigation: Manifest Growth Patterns
**Status**: Monitoring needed, strategies to be determined

Understand and optimize storage patterns:

- **Monitor manifest growth** over time
- **Analyze chunk frequency** patterns
- **Optimize snapshot timing** based on usage
- **Storage cost analysis** and optimization

## Implementation Priorities

### Immediate (Next 1-2 months)
1. **Authorization Edit Integration** - When edit flows are implemented
2. **S3 Lifecycle Policies** - Cost optimization for production
3. **Automatic Snapshot Triggers** - Reduce manual maintenance

### Medium Term (3-6 months)
1. **Manifest Corruption Detection** - Improve system reliability
2. **WML Lambda Self-Diagnostics** - Proactive issue detection
3. **Manifest Archival** - Handle long-lived assets

### Long Term (6+ months)
1. **SAGA Pattern** - Rollback safety and parallel write optimization (3x speedup)
2. **Transaction/Builder Pattern** - Batched operations with fluent API
3. **Point-in-Time Queries UI** - User-facing historical access
4. **Asset Merge History** - Complex relationship tracking
5. **Performance Optimization** - Advanced caching and connection pooling

## Technical Considerations

### Backward Compatibility
- All Phase 3 features must maintain compatibility with Phase 2
- Graceful degradation for missing features
- No breaking changes to existing APIs

### Testing Strategy
- Comprehensive test coverage for all new features
- Integration tests with existing Phase 2 infrastructure
- Performance testing for optimization features

### Migration Strategy
- Incremental rollout of new features
- Feature flags for gradual enablement
- Rollback capabilities for each enhancement

## Dependencies

### External Dependencies
- **Authorization Edit Flows**: Required for authorization edit integration
- **UI Development**: Required for point-in-time queries and rollback UI
- **Cost Analysis**: Required for S3 lifecycle policy optimization

### Internal Dependencies
- **Diagnostics System**: Required for self-validation features
- **Event System**: Required for automatic triggers
- **Monitoring**: Required for manifest growth analysis

## Success Metrics

### Performance Metrics
- **Storage Cost Reduction**: 30-50% reduction through lifecycle policies
- **Reconstruction Speed**: <2 seconds for typical assets
- **Snapshot Creation Time**: <5 seconds for manual snapshots
- **SAGA Pattern Speedup**: 3x improvement through parallel writes (~200ms vs ~600ms)
- **Batched Operations**: 70%+ reduction in S3 operations for multi-chunk workflows
- **Transaction Throughput**: Support for 10+ operations in single batch execution

### Reliability Metrics
- **Corruption Detection**: 100% detection rate for manifest issues
- **Self-Healing Success**: 95%+ success rate for automatic repairs
- **System Uptime**: 99.9%+ availability
- **SAGA Rollback Success**: 99%+ successful compensating actions on failure
- **Transaction Consistency**: Zero orphaned files after rollback

### User Experience Metrics
- **Historical Access**: <3 seconds for point-in-time queries
- **Rollback Operations**: <10 seconds for asset rollbacks
- **UI Responsiveness**: <1 second for historical browsing

## Related Documentation

- **[Current Architecture](AGENT.md)**: Phase 2 implementation details
- **[Self-Repair Design](AGENT.selfRepair.md)**: Self-repair patterns and scenarios
- **[WML Language](../packages/mtw-wml/ts/AGENT.md)**: WML format and concepts
- **[AssetWorkspace](../packages/mtw-asset-workspace/ts/AGENT.md)**: AssetWorkspace library documentation
