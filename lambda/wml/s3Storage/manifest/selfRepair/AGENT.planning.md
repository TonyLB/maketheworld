# Self-Repair Orchestration Refactoring - Planning Document

**Status**: ⚠️ **TEMPORARY PLANNING DOCUMENT** - Delete after completion

**Created**: October 25, 2025

**Purpose**: Design and implement elegant composition of repair + operation through decomposition of effects on storage subsystems.

**Tracked in**: `lambda/wml/AGENT.s3storage.migration.md` - Phase 2.7 Self-Repair Infrastructure

---

## 🤖 AI Agent: Getting Started

**New to this refactoring? Follow these steps to get oriented:**

### Step 1: Understand the Problem Context

1. **Read Phase 2.7 context** in `lambda/wml/AGENT.s3storage.migration.md`
   - **Why**: Understand self-repair infrastructure goals and current state
   - **Focus**: Task 2.7.1 (completed), Task 2.7.2 (completed), what comes next
   
2. **Review self-repair design** in `s3Storage/manifest/AGENT.selfRepair.md`
   - **Why**: Understand current repair scenarios and strategies
   - **Focus**: Three repair scenarios, operation types, centralized repair function

3. **Examine implemented code**:
   - `selfRepair/index.ts` - `immediateSelfRepair()` core function
   - `selfRepair/wrapper.ts` - `withS3SelfRepair()` wrapper
   - `selfRepair/USAGE_EXAMPLE.md` - Usage patterns
   - **Why**: See what we built and understand the inefficiency

### Step 2: Understand the Core Problem

**The Inefficiency**: Current wrapper does "repair, then re-fetch, then action"

Example with missing materialized view during `applyEdit`:
1. Fetch → detects view missing
2. Repair → reconstructs view, **writes to S3** (write #1)
3. Re-fetch → loads view again
4. Action → merges edit, **writes to S3** (write #2)

**Result**: 2 S3 writes when we could do 1 (repair + edit in single write)

**The Insight**: Both repair and operation transform the same files:
- Materialized view (`.wml`, `.ndjson`)
- Manifest (`manifest-latest.ndjson`)
- Chunks (`chunks/*.wml`)
- Snapshots (`snapshots/*.wml`)

If we can decompose operations into their **effects on each file type**, we can **compose** repair + operation efficiently.

### Step 3: Review Existing Merge Capabilities

1. **StandardForm merge operations** in `packages/mtw-wml/ts/standardize/index.ts`
   - **Why**: Understand how WML content merging works
   - **Focus**: `merge()` method, Replace/Remove tag handling
   
2. **Reconstruction logic** in `s3Storage/manifest/reconstruction.ts`
   - **Why**: See how we already apply chunks to base content
   - **Focus**: Sequential merge pattern, chunk application

### Step 4: Key Files for This Refactoring

- **Planning**: This document (you are here)
- **Current implementation**: `selfRepair/index.ts`, `selfRepair/wrapper.ts`
- **Operations to refactor**: `dataSource/applyEdit/index.ts`, `dataSource/moveAsset/index.ts`
- **Merge capabilities**: `packages/mtw-wml/ts/standardize/index.ts`

### Step 5: Run Tests Before Starting

```bash
cd lambda/wml
npm test -- --watchAll=false
```

All 234 tests should pass before beginning design work.

---

## 🎯 Design Planning: Decomposition Approach

### Problem Statement

**Current Pipeline** (inefficient):
```
Operation with repair needed:
1. Fetch data
2. Detect missing files
3. immediateSelfRepair (complete workflow, writes to S3)
4. Re-fetch data
5. Execute action (may write same files again to S3)
```

**Inefficiency**: Duplicate S3 operations when repair and action affect the same files.

**Goal**: Compose repair + operation into single coordinated write per file.

---

### Storage Subsystems Decomposition

Operations and repairs affect these file types:

| File Type | Purpose | Write Frequency | Current Handling | Optimization Strategy |
|-----------|---------|-----------------|------------------|----------------------|
| **Materialized View** | `.wml`, `.ndjson` - Current content | Every edit, every repair | Written separately by repair, then by action | ✅ **Decision 1**: Use `updateContentByChunk()` reducer to compose in-memory before single write |
| **Manifest** | `manifest-latest.ndjson` - Event log | Every edit, zone change, snapshot | Appended separately | Batch all events (snapshot + chunk) in single append |
| **Chunks** | `chunks/*.wml` - Immutable deltas | Every edit | Written once (operation only) | No optimization needed - already single write |
| **Snapshots** | `snapshots/*.wml` - Point-in-time copies | Manual/automatic triggers | Written by repair (lazy migration) or explicit snapshot requests | ✅ **Decision 2**: Accept optional `content` parameter to write directly instead of CopyObject |

**Key Observations**: 
- Materialized view and manifest are the hot paths that need optimization
- Snapshots can be optimized by allowing direct content write (avoids copy + overwrite pattern)

---

### Chosen Approach: Separate Materialized View Utilities

**Decision**: Create `s3Storage/manifest/materialized.ts` with content management functions.

**Key Functions**:

1. **`updateContentByChunk`** - Content reducer for applying chunks
```typescript
export function updateContentByChunk(
    baseline: StandardForm,
    chunkWML: string
): StandardForm {
    const chunkStandard = new StandardForm(chunkWML)
    const merged = baseline.merge(chunkStandard)
    if (!merged.success) {
        throw new Error('Merge conflict during chunk application')
    }
    return merged.value
}
```

2. **Happy-path update function** - Handles normal edit flow without repair
   - Relocates pattern currently in `dataSource/applyEdit`
   - Coordinates: load content → apply chunk → write materialized views → write chunk file → update manifest
   - Used when no repair is needed

**Benefits**:
- **Single Responsibility**: Merge logic separated from orchestration
- **Reusable**: Can be used by repair, reconstruction, normal operations
- **Testable**: Pure content transformation easy to test
- **Clear Separation**: Repair orchestrates, merge utility merges

---

### Central Coordination Question

**The Core Trade-off**: Who completes the operation after repair?

**Option 1: Repair Returns Intermediate State**
- **Repair does**: Reconstruct/synthesize baseline, write snapshot (if needed)
- **Returns**: Intermediate state (e.g., `StandardForm` baseline)
- **Operation does**: Apply its changes, write materialized views, write chunks, update manifest
- **Pros**:
  - Clear separation of concerns: repair "fixes foundation", operation "does its work"
  - Repair stays focused on file presence/absence
  - Operations retain control of their own logic
- **Cons**:
  - Repair needs to know what intermediate state to return
  - Operation needs to handle "repaired" vs "normal" state
  - Coordination logic spread between repair and operation

**Option 2: Repair Takes Full Responsibility**
- **Repair does**: Everything - reconstruct/synthesize + apply operation changes + all writes
- **Operation provides**: Metadata about desired changes (e.g., chunk WML, zone change)
- **Repair returns**: Complete result (operation is done)
- **Pros**:
  - Single coordinated write path - all optimization in one place
  - Operations become simple: "describe what you want, repair handles it"
  - Eliminates re-fetch entirely
- **Cons**:
  - Repair becomes complex - needs to understand all operation types
  - Harder to test (more responsibility = more complexity)
  - Repair couples to operation semantics

---

### Architectural Boundary Implications

**The Data Contract Question**: Where do we draw the boundary between `s3Storage` and the rest of the lambda?

**Option 1: Granular Black Boxes**
- **Contract**: Individual sub-tools (chunks, manifest, materialized view) are separate black boxes
- **Responsibility**: Systems outside `s3Storage` orchestrate the black boxes correctly
- **Interface**: `writeChunk()`, `appendManifest()`, `writeMaterializedView()` etc.
- **Philosophy**: "Storage provides primitives, business logic composes them"

**Option 2: Unified Storage Black Box**
- **Contract**: `s3Storage` system itself is the black box
- **Responsibility**: Storage system handles all coordination internally
- **Interface**: `appendChunk({ chunkWML, ... })` → complete result
- **Philosophy**: "Storage provides complete operations, business logic describes intent"
- **Note**: Operations are descriptively named (not hidden), just encapsulated to prevent misuse

**Implications**:
- **Option 1**: More modular, but requires callers to understand storage internals
- **Option 2**: Simpler callers, but storage becomes a monolith with complex responsibilities

---

### Additional Design Questions

1. **Generalization**: How do we handle operations that don't produce chunks?
   - Zone changes: No chunk, just manifest event
   - Manual snapshots: No content change, just snapshot creation
   - Should these bypass composition entirely?

2. **Manifest effects**: How do we compose manifest updates?
   - Repair may add: initial ZoneChange + snapshot events
   - Operation may add: chunk events, zone change events
   - Should these be batched in a single `appendManifestEvents` call?

3. **Error handling**: How do we handle partial failures in composition?
   - What if baseline loads but chunk merge fails?
   - Rollback strategy?

---

### Decision Log

_(Record decisions as we make them)_

**Decision 1**: Separate Materialized View Utilities (Option 3)
- **Date**: October 25, 2025
- **Decision**: Create `s3Storage/manifest/materialized.ts` with:
  - `updateContentByChunk(baseline, chunkWML)` - Content reducer for applying chunks
  - Happy-path update function - Orchestrates normal edit flow (relocates logic from `applyEdit`)
- **Rationale**: 
  - Single responsibility: merge logic separated from orchestration
  - Reusable across repair, reconstruction, and normal operations
  - Testable: pure content transformation
  - Clear separation of concerns

**Decision 2**: Snapshot Function Accepts Optional Content
- **Date**: October 25, 2025
- **Decision**: Extend `writeSnapshot()` to accept optional `content` parameter:
  ```typescript
  writeSnapshot({
      prefix: string,
      timestamp: number,
      zone: Zone,
      snapshotType: 'manual' | 'automatic' | 'initializeManifest',
      chunksBeforeSnapshot: number,
      content?: string  // NEW: If provided, write this content instead of copying materialized view
  })
  ```
- **Flow Changes**:
  - **Without content** (existing): Use S3 CopyObject from materialized view (current behavior)
  - **With content** (new): Direct write of provided content to snapshot location
- **Rationale**:
  - Avoids duplicate writes during synthesize-empty scenario
  - Example flow for `applyEdit` with both missing:
    1. Create empty StandardForm (in-memory)
    2. Write snapshot directly from empty content (write #1)
    3. Apply edit to empty form (in-memory) 
    4. Write materialized view with edited content (write #2)
    5. Update manifest with both snapshot and chunk events
  - Eliminates: write empty → copy to snapshot → update manifest → write edited (4 ops)
  - Becomes: write empty snapshot → update manifest → write edited view (3 ops)
  - Allows composition without re-fetch 

**Decision 3**: Unified Storage Service Boundary (Option 2)
- **Date**: October 25, 2025
- **Decision**: Storage system takes full responsibility for operation coordination
  - **Repair does**: Everything - reconstruct/synthesize + apply operation changes + all writes
  - **Operations provide**: Declarative intent (chunk WML, zone changes, snapshot requests)
  - **Repair returns**: Complete result (operation is done)
- **Architectural Philosophy**: "Storage is a black box service that handles complete operations"
- **Rationale**:
  - Storage components are inherently interdependent (manifests reference chunks, snapshots derive from views)
  - More maintainable: Business logic describes *what* to do, storage handles *how*
  - Single coordinated write path enables optimal S3 I/O patterns
  - Simpler caller interface: operations don't need to understand storage internals
  - Natural boundary: storage system orchestrates its own subsystems
- **Trade-off**: Storage becomes more complex, but callers become simpler
- **Naming Philosophy**: Operations are descriptively named, not hidden
  - Use honest names: `appendChunk()`, `changeZone()`, `createSnapshot()`
  - Avoid opaque wrappers: Not "applyEdit" or "doOperation"
  - Goal: Encapsulation (prevent misuse), not obfuscation (hide implementation)
- **Implications**:
  - Repair/wrapper functions will orchestrate complete operation lifecycle
  - Operations like `dataSource/applyEdit` become thin wrappers around `appendChunk()`
  - Storage interface becomes operation-oriented rather than primitive-oriented

**How This Solves Manifest Composition**:

Decision 3 naturally resolves the manifest batching question from "Additional Design Questions":

- **Current fragmented approach**:
  ```typescript
  // Repair adds initialization events
  await appendManifestEvents([zoneChangeEvent, snapshotEvent])
  // Then operation adds its events  
  await appendManifestEvents([chunkEvent])
  // Result: Two separate S3 appends!
  ```

- **With encapsulated operations**:
  ```typescript
  // Business logic just says:
  await storage.appendChunk({ assetId, chunkWML, timestamp })
  
  // Storage internally handles:
  // 1. Detect manifest needs repair → queue [ZoneChange, Snapshot] events
  // 2. Add chunk event for this operation
  // 3. Batch ALL events into single append: [ZoneChange, Snapshot, Chunk]
  ```

- **Key insight**: Business logic should **never** directly touch the manifest
  - Manifest is purely an internal audit log of the storage system
  - Operations map to events (`appendChunk()` → `ChunkEvent`, `changeZone()` → `ZoneChangeEvent`)
  - Storage decides **when** and **how** to write manifest
  
- **Benefits**:
  - ✅ Automatic batching (repair events + operation events in one append)
  - ✅ Guaranteed consistency (can't forget to update manifest)
  - ✅ Business logic abstracted from manifest details

---

## 🔮 Future Evolution

### Phase 1: SAGA Pattern for Rollback Safety

**Concept**: Implement compensating actions for partial failure recovery

**Current Design** (this implementation):
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
2. Forward actions execute sequentially
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

**Challenges:**
- S3 doesn't support transactions natively
- Some compensating actions are complex (manifest is append-only)
- Need to handle compensation failures
- Performance cost of tracking previous state

**Implementation Approaches:**

1. **Best-effort compensation** (simpler):
   - Delete newly written files on error
   - Accept that manifest is append-only (add "rollback" event?)
   - Document eventual consistency window

2. **Full compensation** (complex):
   - Keep shadow copies before writes
   - Implement manifest event reversal/correction
   - More storage overhead, stronger guarantees

**Parallel Write Optimization:**

SAGA pattern unlocks a critical performance improvement: **optimistic parallel writes**

- **Current approach** (sequential for safety):
  ```typescript
  await writeChunkFile()         // Write 1, wait
  await writeMaterializedView()  // Write 2, wait
  await appendManifest()         // Write 3, wait
  // Total time: T1 + T2 + T3 (sequential)
  ```

- **With SAGA** (parallel with rollback safety):
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

- **Performance impact**: 
  - Sequential: ~600ms (3 × 200ms S3 writes)
  - Parallel: ~200ms (max of concurrent writes)
  - **3x speedup** for typical operation

- **Why this is safe with SAGA but not without**:
  - Without rollback: If manifest write fails after chunk succeeds, we have orphaned chunk (inconsistent)
  - With SAGA: If manifest fails, compensating action deletes chunk (consistent)
  - SAGA removes the dependency that forced sequential writes

**Feasibility**: Medium - S3's lack of transactions makes full ACID guarantees difficult, but best-effort compensation is achievable

**Status**: Future enhancement - prerequisite for transaction/builder pattern. Current implementation prioritizes correctness on happy path.

---

### Phase 2: Transaction/Builder Pattern

**Concept**: Batch multiple operations for optimal execution

**Current Design** (this implementation):
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
   - Write all chunk files in parallel
   - Append **one** manifest entry: `[Chunk, Chunk, Chunk, Snapshot]`
   - Write final snapshot

**Benefits:**
- ✅ Maximum S3 I/O optimization (batch operations)
- ✅ Natural extension of current encapsulation model
- ✅ Backward compatible (current single-operation calls still work)
- ✅ Enables complex workflows (e.g., "apply these edits, then snapshot")

**Challenges:**
- Transaction semantics (all-or-nothing vs partial success?)
- Error handling mid-batch (rollback strategy?)
- Implementation complexity (operation queue management)

**Feasibility**: High - current design already encapsulates operation effects, making them easy to queue and optimize

**Status**: Future enhancement - not part of current implementation. Document this pattern in final documentation for future reference.

---

## 📋 Implementation Tracking

_(Empty until design is finalized)_

### Implementation Tasks

_(Will be populated once we agree on design approach)_

---

## 🧹 Cleanup Tasks

Track temporary artifacts and final cleanup:

### Temporary Files Created

- [ ] `selfRepair/USAGE_EXAMPLE.md` - Usage examples (to be integrated into selfRepair/AGENT.md, then removed)
- [ ] `selfRepair/AGENT.planning.md` - This planning document (to be deleted after integration)
- [ ] Any prototype/experimental files created during design

### Documentation Reorganization

- [ ] **Move** `manifest/AGENT.selfRepair.md` → `manifest/selfRepair/AGENT.md`
  - Rationale: Co-locate documentation with implementation code
  - New location matches directory structure (`selfRepair/` subdirectory)
  
- [ ] **Update** `manifest/selfRepair/AGENT.md` with:
  - Design decisions from this planning document
  - Implementation details from completed work
  - Future evolution patterns (SAGA, transaction/builder)
  - Updated architecture diagrams reflecting encapsulated operations
  - New API surface (`appendChunk`, `changeZone`, `createSnapshot`)
  - Any still-valuable content from `USAGE_EXAMPLE.md` (before/after examples, usage patterns)

- [ ] **Extract and integrate** `selfRepair/USAGE_EXAMPLE.md`:
  - Review USAGE_EXAMPLE.md for valuable examples post-implementation
  - Extract relevant before/after comparisons into `selfRepair/AGENT.md`
  - Extract usage patterns that demonstrate the new encapsulated API
  - Remove USAGE_EXAMPLE.md after integration

### Integration Work

- [ ] Update operation documentation with new patterns (e.g., `dataSource/applyEdit`)
- [ ] Update `AGENT.s3storage.migration.md` with completion notes
- [ ] Update related documentation referencing old API patterns

### Final Cleanup

- [ ] Delete `selfRepair/USAGE_EXAMPLE.md` (after integration into AGENT.md)
- [ ] Delete `selfRepair/AGENT.planning.md` (this document, after integration)
- [ ] Update Phase 2.7 task status in migration doc
- [ ] Verify all references to `AGENT.selfRepair.md` point to new location `selfRepair/AGENT.md`
- [ ] Remove any other prototype/experimental files created during design

---

## Related Documentation

- **[Self-Repair Design](AGENT.selfRepair.md)**: Original design document
- **[Migration Planning](../../AGENT.s3storage.migration.md)**: Phase 2.7 tasks
- **[Manifest System](../AGENT.md)**: Manifest operations and format
- **[Current Implementation](./index.ts)**: `immediateSelfRepair()` function
- **[Wrapper Implementation](./wrapper.ts)**: `withS3SelfRepair()` wrapper

---

**Document Status**: Planning in progress - design phase

