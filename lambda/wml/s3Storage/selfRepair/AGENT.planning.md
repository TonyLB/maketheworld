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

### Implementation Phases

**Phase 1**: Foundation utilities (Decisions 1 & 2)
**Phase 2**: Refactor repair system (Decision 3)
**Phase 3**: Integration and testing

---

### Phase 1: Foundation Utilities

#### Task 1.0: Reorganize `s3Storage/` Directory Structure

**Purpose**: Align directory structure with conceptual architecture (subsystems + orchestration)

**Current Structure** (grown by accretion):
```
s3Storage/
├── AssetWorkspace.ts
├── manifest/
│   ├── baseClasses.ts
│   ├── chunks.ts              ❌ Not manifest-specific
│   ├── operations.ts
│   ├── orchestration.ts
│   ├── reconstruction.ts
│   ├── snapshots.ts           ❌ Not manifest-specific
│   ├── selfRepair/
│   │   ├── index.ts
│   │   ├── wrapper.ts
│   │   └── ...
│   └── AGENT.selfRepair.md    ❌ Should be in selfRepair/
```

**Proposed Structure** (organized by subsystem):
```
s3Storage/
├── AssetWorkspace.ts          # Workspace/path utilities
├── index.ts                   # NEW: Top-level operations (appendChunk, etc.)
├── S3StorageAction.ts         # FUTURE: Builder/transaction class
│
├── manifest/                  # Manifest subsystem
│   ├── baseClasses.ts        # Manifest types/classes
│   ├── index.ts              # RENAMED from operations.ts - core manifest operations
│   ├── orchestration.ts      # Manifest coordination (appendManifestEvents, etc.)
│   └── AGENT.md              # Manifest documentation
│
├── chunks/                    # Chunks subsystem (NEW directory)
│   ├── index.ts              # MOVED from manifest/chunks.ts
│   └── index.test.ts         # MOVED from manifest/chunks.test.ts
│
├── snapshots/                 # Snapshots subsystem (NEW directory)
│   ├── index.ts              # MOVED from manifest/snapshots.ts
│   └── index.test.ts         # MOVED from manifest/snapshots.test.ts
│
├── materializedView/          # Materialized view subsystem (NEW directory)
│   ├── index.ts              # NEW: updateContentByChunk, etc. (Task 1.1)
│   └── reconstruction.ts     # MOVED from manifest/reconstruction.ts
│
└── selfRepair/                # Self-repair coordination (MOVED from manifest/)
    ├── index.ts              # MOVED from manifest/selfRepair/index.ts
    ├── wrapper.ts            # MOVED from manifest/selfRepair/wrapper.ts
    ├── AGENT.md              # MOVED from manifest/AGENT.selfRepair.md
    ├── AGENT.planning.md     # MOVED from manifest/selfRepair/AGENT.planning.md
    └── ...tests...
```

**Subtasks**:

1. **Create new directories**:
   - [ ] Create `s3Storage/chunks/`
   - [ ] Create `s3Storage/snapshots/`
   - [ ] Create `s3Storage/materializedView/`

2. **Move chunks subsystem**:
   - [ ] Move `manifest/chunks.ts` → `chunks/index.ts`
   - [ ] Move `manifest/chunks.test.ts` → `chunks/index.test.ts`
   - [ ] Update imports in moved files
   - [ ] Update imports in files that reference chunks (now just `'./chunks'` instead of `'./chunks/operations'`)

3. **Move snapshots subsystem**:
   - [ ] Move `manifest/snapshots.ts` → `snapshots/index.ts`
   - [ ] Move `manifest/snapshots.test.ts` → `snapshots/index.test.ts`
   - [ ] Update imports in moved files
   - [ ] Update imports in files that reference snapshots (now just `'./snapshots'`)

3b. **Move reconstruction to materializedView**:
   - [ ] Move `manifest/reconstruction.ts` → `materializedView/reconstruction.ts`
   - [ ] Move `manifest/reconstruction.test.ts` → `materializedView/reconstruction.test.ts`
   - [ ] Update imports in moved files
   - [ ] Update imports in files that reference reconstruction

4. **Move selfRepair subsystem**:
   - [ ] Move `manifest/selfRepair/` → `selfRepair/` (entire directory up one level)
   - [ ] Move `manifest/AGENT.selfRepair.md` → `selfRepair/AGENT.md`
   - [ ] Update imports in selfRepair files (one less `../`)
   - [ ] Update imports in files that reference selfRepair

5. **Rename and update remaining manifest/ files**:
   - [ ] Rename `manifest/operations.ts` → `manifest/index.ts`
   - [ ] Update imports in `manifest/index.ts` (was operations.ts)
   - [ ] Update imports in `manifest/orchestration.ts`
   - [ ] Update imports in `manifest/baseClasses.ts`
   - [ ] Update files that imported from `manifest/operations` to import from `manifest` (index.ts)

6. **Update top-level files**:
   - [ ] Update imports in `AssetWorkspace.ts`
   - [ ] Update imports in any other top-level s3Storage files

7. **Update external references**:
   - [ ] Find all imports of s3Storage files outside of s3Storage/
   - [ ] Update paths to match new structure
   - [ ] Check `dataSource/` files especially (likely import chunks, snapshots, etc.)

8. **Testing**:
   - [ ] Run all s3Storage tests: `npm test -- s3Storage`
   - [ ] Verify all tests still pass
   - [ ] Check for any missed import updates (look for test failures)

9. **Documentation**:
   - [ ] Update `s3Storage/manifest/AGENT.md` to reflect new structure
   - [ ] Update this planning doc's file paths to match new structure
   - [ ] Update any diagrams showing directory structure

**Dependencies**: None - this is foundational

**Success Criteria**:
- All files moved to new locations
- All imports updated correctly
- All tests pass
- Directory structure matches conceptual architecture
- Clear separation: orchestration (top) vs subsystems (directories)

**Risk Mitigation**:
- Do this in a clean git state so rollback is easy
- Move one subsystem at a time, test after each
- Use IDE refactoring tools if available (rename/move with import updates)

**Notes**:
- This sets foundation for Task 1.1 (create `materializedView/index.ts`)
- This clarifies where Task 2.2's `appendChunk()` lives (top-level `s3Storage/index.ts`)
- Future: `S3StorageAction` class also lives at top level
- Using `index.ts` convention enables cleaner imports: `from './chunks'` instead of `from './chunks/operations'`
- `reconstruction.ts` correctly lives in `materializedView/` since it reconstructs materialized views

**Status**: ✅ **COMPLETED**

**Implementation Summary**:
- Created directories: `chunks/`, `snapshots/`, `materializedView/`
- Moved chunks: `manifest/chunks.ts` → `chunks/index.ts`
- Moved snapshots: `manifest/snapshots.ts` → `snapshots/index.ts`
- Moved reconstruction: `manifest/reconstruction.ts` → `materializedView/reconstruction.ts`
- Moved selfRepair: `manifest/selfRepair/` → `selfRepair/` (up one level)
- Moved documentation: `manifest/AGENT.selfRepair.md` → `selfRepair/AGENT.md`
- Renamed manifest core: `manifest/operations.ts` → `manifest/index.ts`
- Updated all imports across codebase (internal and external)
- Verified with tests: All s3Storage tests pass (136 tests)
- **Result**: Clean, scalable directory structure aligned with conceptual architecture

---

#### Task 1.1: Create `materializedView/index.ts` (Content Reducer)

**Purpose**: Centralize materialized view content management

**Subtasks**:
- [ ] Create new file `s3Storage/materializedView/index.ts` (after Task 1.0 creates directory)
- [ ] Implement `updateContentByChunk()` content reducer:
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
- [ ] Add unit tests for `updateContentByChunk()`:
  - Test successful merge
  - Test merge conflict (should throw)
  - Test with empty baseline
  - Test with empty chunk
  - Test with complex nested structures
- [ ] Add JSDoc documentation with examples

**Dependencies**: Task 1.0 (directory structure must be in place)

**Success Criteria**: 
- All tests pass
- Function is pure (no side effects)
- Clear error messages on failure

**Status**: ✅ **COMPLETED**

**Implementation Summary**:
- Created `s3Storage/materializedView/index.ts` with `updateContentByChunk()` function
- **Key insight**: Function is a thin wrapper around `StandardForm.merge()` - no need for complex logic
- **Final implementation** (14 lines):
  ```typescript
  export function updateContentByChunk(
      baseline: StandardForm,
      chunkWML: string
  ): StandardForm {
      const chunkStandard = new StandardForm(chunkWML)
      const merged = baseline.merge(chunkStandard)
      return merged
  }
  ```
- Created `s3Storage/materializedView/index.test.ts` with **6 focused tests**:
  - Basic functionality: merge into baseline, empty baseline, Replace/With pattern
  - Error propagation: invalid WML, empty WML
  - Immutability: baseline not mutated
- **Design decision**: Keep tests focused on wrapper functionality, not re-testing StandardForm.merge()
- All tests pass (6/6)
- **Result**: Simple, reusable content reducer ready for use in repair and orchestration

---

#### Task 1.2: Extend `writeSnapshot()` Function

**Purpose**: Enable direct content writing to snapshots (avoid copy-then-overwrite pattern)

**Subtasks**:
- [ ] Locate current `writeSnapshot()` implementation (will be in `snapshots/index.ts` after Task 1.0)
- [ ] Add optional `content?: string` parameter to function signature
- [ ] Update implementation logic:
  ```typescript
  if (content !== undefined) {
      // NEW: Direct write of provided content
      await s3Client.send(new PutObjectCommand({
          Bucket: workspace.bucket,
          Key: snapshotKey,
          Body: content,
          ContentType: 'text/plain',
          Tagging: buildTagString({ zone, /* ... */ })
      }))
  } else {
      // EXISTING: Copy from materialized view
      await s3Client.send(new CopyObjectCommand({ /* ... */ }))
  }
  ```
- [ ] Update function JSDoc to document new parameter
- [ ] Add unit tests for new behavior:
  - Test with content provided (direct write)
  - Test without content (copy behavior, existing)
  - Test that tags are applied correctly in both cases
  - Test error handling for both paths
- [ ] Verify backward compatibility (existing callers still work)

**Dependencies**: Task 1.0 (snapshots moved to snapshots/index.ts)

**Success Criteria**:
- Backward compatible (no breaking changes)
- Both code paths tested and working
- Tags correctly applied in both scenarios

**Status**: ✅ **COMPLETED**

**Implementation Summary**:
- Extended `WriteSnapshotOptions` interface with optional `content?: string` parameter
- Updated `writeSnapshot()` function to support two modes:
  - **Copy mode** (existing, when `content` not provided): Uses S3 CopyObject from materialized view
  - **Direct write mode** (new, when `content` provided): Uses S3 PutObject with provided content
- Added 5 new tests for direct write mode + 1 backward compatibility test
- All tests pass (21/21 total, including 15 existing + 6 new)
- **Key optimization enabled**: Can now write snapshot with baseline content, then write materialized view with different content (avoids copy-then-overwrite pattern)
- **Result**: Fully backward compatible extension ready for use in repair orchestration

---

### Phase 2: Refactor Repair System (Decision 3)

#### Task 2.1: Design `appendChunk()` Operation Interface

**Purpose**: Define the encapsulated operation signature for appending chunks

**Subtasks**:
- [x] Define interface/type for `appendChunk()` parameters
- [x] Define return type (success/failure with merged content and metadata)
- [x] Document the operation contract
- [x] Review with existing `dataSource/applyEdit` to ensure it covers all use cases

**Dependencies**: Task 1.0, Task 1.1, Task 1.2

**Success Criteria**:
- Clear, well-documented interface ✅
- Covers all current use cases ✅
- Aligns with encapsulation philosophy ✅

**Status**: ✅ **COMPLETED**

**Implementation Summary**:
- Created `s3Storage/index.ts` as top-level operations API
- Defined `AppendChunkArgs` interface with all necessary parameters:
  - `assetId`, `chunkWML`, `timestamp`, `zone` (required)
  - `authoringPlayer` (optional, for provenance)
  - `createIfNeeded` (optional, for asset creation)
  - `suffix` (optional, defaults to 'wml')
- Defined discriminated union return type:
  - `AppendChunkSuccess`: includes `mergedContent` (StandardForm) and `metadata`
  - `AppendChunkFailure`: includes `error` message and `errorType` category
- Metadata includes repair information (what was repaired, if anything)
- Comprehensive JSDoc with usage examples
- Design allows caller to get merged content without re-fetching
- Covers all `applyEdit` use cases plus future needs (authorization, snapshots)

---

#### Task 2.2: Implement `appendChunk()` Core Logic

**Purpose**: Create the unified operation that handles repair + chunk application

**Subtasks**:
- [x] Create new function `appendChunk()` in `s3Storage/index.ts` (top-level orchestration)
- [x] Implement orchestration logic:
  ```typescript
  export async function appendChunk(args: AppendChunkArgs): Promise<...> {
      const workspace = new AssetWorkspace(args.assetId)
      
      // 1. Fetch current state (manifest + materialized view)
      const state = await fetchCurrentState(workspace)
      
      // 2. Determine repair needs
      const repairNeeded = detectRepairNeeds(state)
      
      // 3. Build baseline content (with repair if needed)
      const baseline = await buildBaseline(state, repairNeeded, args.zone)
      
      // 4. Apply chunk to baseline
      const updatedContent = updateContentByChunk(baseline, args.chunkWML)
      
      // 5. Prepare all events (repair + chunk)
      const events = buildEvents(repairNeeded, args)
      
      // 6. Execute all writes
      await Promise.all([
          writeChunkFile(workspace, args.chunkWML, args.timestamp),
          writeMaterializedView(workspace, updatedContent),
          // If repair needed snapshot, write it with baseline content
          ...(repairNeeded.snapshot ? [writeSnapshot({ content: baseline.serialize(), ... })] : [])
      ])
      
      // 7. Update manifest (batched: repair events + chunk event)
      await appendManifestEvents(workspace, events)
      
      return { success: true, /* ... */ }
  }
  ```
- [x] Implement helper functions:
  - `fetchCurrentState()` - Get manifest + view
  - `buildBaseline()` - Reconstruct/synthesize baseline IN-MEMORY (key optimization)
  - `applyChunkToBaseline()` - Merge chunk with baseline in-memory
  - `prepareWrites()` - Build all write operations
  - `executeWrites()` - Execute coordinated writes
- [x] Add error handling at each step (returns AppendChunkFailure on errors)
- [x] Implemented in-memory repair (no intermediate writes during repair)

**Dependencies**: Task 2.1

**Success Criteria**:
- Single entry point for chunk append operations ✅
- Handles all repair scenarios correctly ✅
- All writes coordinated and batched optimally ✅

**Status**: ✅ **COMPLETED**

**Implementation Summary**:

Created `s3Storage/index.ts` with complete `appendChunk()` implementation:

**Key Optimization Achieved**: In-memory repair eliminates duplicate writes
- **Old pattern** (withS3SelfRepair): Repair writes → re-fetch → action writes = 2 writes per file
- **New pattern** (appendChunk): Repair in-memory → merge in-memory → single coordinated write = 1 write per file

**Helper Functions Implemented**:
1. **`fetchCurrentState()`** - Loads manifest + materialized view, assesses what's missing
2. **`buildBaseline()`** - Four-case handler (all in-memory):
   - Nothing missing → use existing content
   - View missing, manifest exists → reconstruct from manifest (in-memory)
   - Manifest missing, view exists → use existing, prepare snapshot for lazy migration
   - Both missing → synthesize empty (in-memory), prepare snapshot
3. **`applyChunkToBaseline()`** - Uses `updateContentByChunk()` utility (Task 1.1)
4. **`prepareWrites()`** - Builds all write operations and manifest events
   - Writes chunk file (to get S3 key for manifest)
   - Writes snapshot if needed (uses Task 1.2's `content` parameter)
   - Builds batched manifest events (repair + chunk in one array)
5. **`executeWrites()`** - Executes coordinated writes
   - Writes materialized views (.wml + .ndjson) once with merged content
   - Appends all manifest events in single operation

**Write Optimization Examples**:
- **Lazy migration** (manifest missing): snapshot write + materialized view write + manifest append = 3 operations (vs old: 5)
- **Reconstruction** (view missing): materialized view write + manifest append = 2 operations (vs old: 4)
- **Empty synthesis** (both missing): snapshot write + materialized view write + manifest append = 3 operations (vs old: 6)

**Error Handling**:
- Discriminated union return type (`AppendChunkSuccess | AppendChunkFailure`)
- Structured error categories: validation, merge-conflict, not-found, s3-error, repair-failed
- Early returns at each validation point

**All s3Storage tests passing** (148 tests, 10 suites)

---

#### ✅ Implemented `changeZone()` Operation (October 26, 2025)

**Purpose**: Validate the pattern with a second concrete operation before abstracting

**What We Built**:
- Created `changeZone()` operation at `s3Storage/index.ts`
- Processes both content and auth files in parallel
- **Key optimization**: Tag-only updates when no repair needed (preserves Phase 1 speedup!)
- Full content write only when repair is needed (reconstruction/synthesis)
- 6 comprehensive tests covering all scenarios

**Critical Discovery**:
Built `changeZone()` with operation-specific optimization (tag-only updates for non-repair case), which revealed that:
- Different operations have different optimization opportunities
- Linear flow pattern can support this via decision/execution separation
- Generic pipeline is possible WITHOUT losing operation-specific optimizations
- See "Critical Design Insight" section above for full analysis

**Test Results**: All 162 tests passing (14 tests for index.ts: 8 appendChunk + 6 changeZone)

**Key Test**: "should use fast tag-update path when no repair needed" verifies the optimization works

---

#### Task 2.3: Add Comprehensive Tests for `appendChunk()`

**Purpose**: Ensure operation works correctly in all scenarios

**Subtasks**:
- [x] Test normal operation (no repair needed)
- [x] Test manifest missing (lazy migration)
- [x] Test view missing (reconstruction)
- [x] Test both missing (synthesize empty)
- [x] Test error scenarios (not-found, merge conflict)
- [x] Test zone/player metadata correctness
- [x] Test authorization prefix handling (error case for unimplemented feature)

**Dependencies**: Task 2.2

**Success Criteria**:
- All scenarios covered ✅
- Tests verify optimal write patterns (no duplicates) ✅
- Clear test names document behavior ✅

**Status**: ✅ **COMPLETED**

**Implementation Summary**:
- Created `s3Storage/index.test.ts` with 8 comprehensive tests
- Tests cover all 4 repair scenarios + error cases
- Key verifications:
  - **Single writes verified**: Tests confirm materialized views written ONCE (not twice)
  - **Batched manifest events**: Tests verify repair + operation events batched in single append
  - **Zone metadata**: Tests verify workspace zone is used for S3 tags
  - **Error handling**: Tests verify structured error types and appropriate failure modes
- Test patterns follow `selfRepair/index.test.ts` style:
  - Comprehensive mocking of all dependencies
  - Clear test structure with nested describes
  - Explicit expectations (what was/wasn't called)
  - Predictable UUID mocking for event IDs
- All s3Storage tests passing: 156 tests (up from 148)

**Test Coverage**:
1. **Normal operation** - No repair, append to existing content
2. **Lazy migration** - Create snapshot from existing view, batch 3 events
3. **Reconstruction** - Rebuild view in-memory, no intermediate write
4. **Empty synthesis** - Create empty + apply chunk, single write
5. **Error cases** - Not-found, merge conflicts with proper error types
6. **Zone metadata** - Verify workspace zone used for S3 tags
7. **Authorization** - Error for unimplemented auth chunk merging
8. All tests verify the **optimization** (no duplicate writes)

---

## 💡 Critical Design Insight: Linear Flow Enables Generic Pipeline (October 26, 2025)

### The Discovery

After implementing both `appendChunk()` and `changeZone()`, we discovered a powerful abstraction opportunity using the linear flow pattern from `immediateSelfRepair`.

### Initial Assumption (WRONG)

"A generic `applyOperation` abstraction would lose operation-specific optimizations like `changeZone`'s tag-only update path."

**Why this seemed true**: `changeZone` can skip content writes when no repair is needed (fast tag updates), while `appendChunk` must always write (new content). A shared abstraction seemed like it would force both through the same path.

### The Insight (CORRECT)

The **linear flow pattern separates decisions from executions**:

```typescript
// From immediateSelfRepair:

// Step 3: DECIDE what to do (pure logic, no I/O)
const viewAction = decideMaterializedViewAction(state, operation)

// Step 6: EXECUTE the decision (I/O based on decision)
await executeMaterializedViewAction({ viewAction, ... })
```

This separation means we can build a **generic pipeline** where:
- **Decision logic is shared** (what repair is needed?)
- **Execution strategy is operation-specific** (how to execute given the repair decision?)

### Proposed Pattern

```typescript
type ExecutionStrategy<TArgs, TResult> = (
    baseline: StandardForm | StandardAuthorizationCollection,
    repairDecision: {
        repairActions?: RepairActions,
        snapshotToCreate?: { content: string }
    },
    args: TArgs
) => Promise<TResult>

async function applyStorageOperation<TArgs, TResult>(
    fetchArgs: { assetId, suffix, zone },
    operationArgs: TArgs,
    strategy: ExecutionStrategy<TArgs, TResult>
): Promise<TResult> {
    // Shared: Fetch and decide repair
    const { baseline, repairDecision } = await fetchAndDecideRepair(fetchArgs)
    
    // Operation-specific: Execute with knowledge of repair decision
    return await strategy(baseline, repairDecision, operationArgs)
}
```

### How This Enables Both Optimizations

**`changeZone` execution strategy:**
```typescript
async function executeChangeZone(baseline, repairDecision, args) {
    if (!repairDecision.repairActions) {
        // FAST PATH: No repair - just update tags!
        await s3Client.updateTags({ Key: jsonKey, Tags: { Zone: args.toZone } })
        await s3Client.updateTags({ Key: wmlKey, Tags: { Zone: args.toZone } })
    } else {
        // REPAIR PATH: Need to write content anyway
        workspace.zone = args.toZone
        await workspace.setJSON(baseline)
        await workspace.pushJSON()
        await workspace.pushWML()
    }
    await appendZoneChangeEvent(...)
}
```

**`appendChunk` execution strategy:**
```typescript
async function executeAppendChunk(baseline, repairDecision, args) {
    // ALWAYS writes (that's the point!)
    const merged = updateContentByChunk(baseline, args.chunkWML)
    
    // Write chunk file
    await writeChunk(...)
    
    // Write merged content
    await workspace.setJSON(merged)
    await workspace.pushJSON()
    await workspace.pushWML()
    
    // Append events (repair events already prepared in repairDecision)
    await appendManifestEvents(...)
}
```

### Key Advantages

1. **Shared decision logic** - "What repair is needed?" answered once, used by all operations
2. **Operation-specific optimizations** - Each operation can branch on `repairDecision` however it wants
3. **Explicit contracts** - Repair decision is a **value** passed to execution, not hidden in control flow
4. **Easier testing** - Can test decision logic separately from execution logic
5. **Preserves Phase 1 optimizations** - `changeZone` keeps tag-only updates for common case

### What Gets Abstracted

**Generic pipeline handles:**
- Fetching current state (manifest + view)
- Assessing what's missing (repair state)
- Deciding repair strategy (reconstruct vs synthesize vs use-existing)
- Preparing repair data (snapshots to create, events to append)
- Returning structured repair decision to operation

**Operation-specific execution handles:**
- Content transformation (if any)
- Write optimization choices (tags-only vs full-write)
- File-specific logic (chunk files, zone tag updates, etc.)
- Building operation-specific manifest events

### Next Steps

**Task 2.4**: Refactor toward this pattern
1. Extract `fetchAndDecideRepair()` from current implementations
2. Refactor `changeZone` to use execution strategy pattern
3. Refactor `appendChunk` to use execution strategy pattern
4. Validate that both optimizations are preserved (tests verify tag-only updates still happen)

**Benefits of refactoring now:**
- Third operation (`createSnapshot`) will be trivial to add
- Pattern is proven (two working implementations)
- Tests already validate the optimizations

**Status**: Design insight captured, ready for implementation in Task 2.4+

---

#### Task 2.4: Extract Generic Pipeline (Linear Flow Pattern)

**Purpose**: Refactor operations to use shared fetch-and-decide logic with operation-specific execution strategies

**UPDATED** based on design insight above - this is now about extracting the generic pipeline, not deprecating `withS3SelfRepair()`.

**Subtasks**:
- [x] Extract `fetchAndDecideRepair()` function from current implementations
- [x] Define `ExecutionStrategy<TArgs, TResult>` type
- [x] Create generic `applyStorageOperation()` pipeline
- [x] Refactor `changeZone` to use pipeline pattern
- [x] Refactor `appendChunk` to use pipeline pattern
- [x] Organize into clean file structure (tools.ts, pipeline.ts, index.ts)

**Dependencies**: Tasks 2.1-2.3 (both operations implemented)

**Success Criteria**:
- ✅ Both operations use generic pipeline
- ✅ All existing tests pass (162 tests)
- ✅ `changeZone` tag-only optimization preserved
- ✅ `appendChunk` in-memory repair preserved
- ✅ Code is simpler and more maintainable
- ✅ Third operation (`createSnapshot`) will be easier to add

**Status**: ✅ **COMPLETED**

**Implementation Summary**:

Created clean three-file structure:

**1. `s3Storage/tools.ts`** - Shared utilities
- `buildPrefix()` - S3 prefix construction
- `ManifestSuffix` type export
- Low-level helpers with no operation opinions

**2. `s3Storage/pipeline.ts`** - Generic orchestration framework
- `fetchAndDecideRepair()` - Core fetch-assess-decide logic
  - Loads manifest + view
  - Assesses repair state
  - Builds baseline in-memory (reconstruct/synthesize/use-existing)
  - Returns `RepairDecision` as explicit value
- `ExecutionStrategy<TArgs, TResult>` type
  - Receives: baseline, repairDecision, fetchResult, args
  - Can optimize based on `repairDecision.repairActions`
- `applyStorageOperation()` - Generic pipeline
  - Phase 1: Fetch and decide (shared)
  - Phase 2: Execute strategy (operation-specific)
- Exported types: `RepairState`, `RepairActions`, `RepairDecision`, `OperationFailure`

**3. `s3Storage/index.ts`** - Public API operations
- `appendChunk()` - Now just 12 lines (calls pipeline with strategy)
- `executeAppendChunkStrategy` - Execution logic (~115 lines)
  - Always writes chunk + merged content (that's the point!)
  - Uses repair decision to batch manifest events
- `changeZone()` - Unchanged public interface
- `executeChangeZoneForPrefixStrategy` - Execution logic (~105 lines)
  - **Optimization**: Branches on `repairDecision.repairActions`
  - No repair → fast tag-only updates (4 updateTags calls)
  - Repair needed → full content write
- `changeZoneForPrefix()` - Helper using pipeline

**Key Achievement**: Linear flow pattern successfully extracted!
- **Decision logic**: Centralized in `pipeline.ts` (used by all operations)
- **Execution logic**: Operation-specific strategies in `index.ts`
- **Optimization preserved**: Tests verify tag-only updates still work

**Code Metrics**:
- `appendChunk()` public function: ~170 lines → 12 lines (93% reduction!)
- `changeZoneForPrefix()`: ~140 lines → 12 lines (91% reduction!)
- Shared pipeline code: ~200 lines in `pipeline.ts` (used by all operations)
- No duplication between operations

**Test Results**: All 162 tests passing, no changes needed (validates refactoring correctness)

---

### Phase 3: Integration and Refactoring

#### Task 3.1: Refactor `dataSource/applyEdit` to Use `appendChunk()`

**Purpose**: Demonstrate new pattern, simplify business logic

**Subtasks**:
- [ ] Review current `dataSource/applyEdit` implementation
- [ ] Identify what can be delegated to `appendChunk()`
- [ ] Refactor to use new API:
  ```typescript
  // Before: ~100 lines of storage orchestration
  // After:
  export async function applyEdit(...) {
      // Business logic validation
      await validateEdit(...)
      
      // Delegate to storage system
      const result = await appendChunk({
          assetId,
          chunkWML,
          timestamp,
          zone: playerZone
      })
      
      return result
  }
  ```
- [ ] Update tests for `applyEdit`
- [ ] Verify all existing callers still work

**Dependencies**: Task 2.2, Task 2.3

**Success Criteria**:
- `applyEdit` is dramatically simplified
- All existing tests still pass
- Clear separation: business logic vs storage orchestration

---

#### Task 3.2: Integration Testing

**Purpose**: Verify end-to-end workflows

**Subtasks**:
- [ ] Test complete edit flow: API → `applyEdit` → `appendChunk` → S3
- [ ] Test repair scenarios trigger correctly in real workflow
- [ ] Verify manifest batching in real operations
- [ ] Performance testing: Compare old vs new approach
  - Measure S3 operation count
  - Measure latency
  - Verify optimizations are realized
- [ ] Test with real WML assets (not just mocks)

**Dependencies**: Task 3.1

**Success Criteria**:
- End-to-end workflows work correctly
- Performance improvements measurable
- No regressions in functionality

---

### Implementation Notes

**Order of Execution**:
1. **Task 1.0 FIRST** - Directory reorganization is foundational
2. Tasks 1.1 and 1.2 can be done in parallel (both depend on 1.0)
3. Task 2.1 should be reviewed before implementing 2.2
4. Task 2.2 and 2.3 should be done together (test-driven development)
5. Phase 3 only after Phase 2 is complete and tested

**Open Questions**:
- [x] ~~Where should `appendChunk()` live?~~ **ANSWERED**: Top-level `s3Storage/index.ts` (Task 1.0 establishes this structure)
- [x] ~~How do we handle `singleFlight` with new architecture?~~ **ANSWERED**: External handlers (e.g. `dataSource/applyEdit`) remain responsible for acquiring `singleFlight` lock before calling s3Storage operations. Future consideration: fold `singleFlight` into s3Storage once we implement queued operations (transaction/builder pattern).
- [ ] What should `appendChunk()` return? Just success status, or also content/metadata?
- [ ] Should we implement other operations (`changeZone()`, `createSnapshot()`) now or later?

**Risk Areas**:
- Breaking existing callers during refactoring
- Missing edge cases in repair scenarios
- Performance regression if batching doesn't work as expected

---

## 🧹 Cleanup Tasks

Track temporary artifacts and final cleanup:

### Temporary Files Created

- [ ] `selfRepair/USAGE_EXAMPLE.md` - Usage examples (to be integrated into selfRepair/AGENT.md, then removed)
- [ ] `selfRepair/AGENT.planning.md` - This planning document (to be deleted after integration)
- [ ] Any prototype/experimental files created during design

### Documentation Reorganization

- [ ] **Move** `manifest/AGENT.selfRepair.md` → `selfRepair/AGENT.md`
  - Note: This will happen as part of Task 1.0 (directory reorganization)
  - Rationale: Co-locate documentation with implementation code
  - New location matches directory structure (`selfRepair/` at s3Storage top level)
  
- [ ] **Update** `selfRepair/AGENT.md` with:
  - Design decisions from this planning document
  - Implementation details from completed work
  - Future evolution patterns (SAGA, transaction/builder)
  - Updated architecture diagrams reflecting encapsulated operations and new directory structure
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

- **[Self-Repair Design](AGENT.md)**: Design document (will be AGENT.selfRepair.md until Task 1.0 completes)
- **[Migration Planning](../AGENT.s3storage.migration.md)**: Phase 2.7 tasks (path after Task 1.0)
- **[Manifest System](../manifest/AGENT.md)**: Manifest operations and format (path after Task 1.0)
- **[Current Implementation](./index.ts)**: `immediateSelfRepair()` function
- **[Wrapper Implementation](./wrapper.ts)**: `withS3SelfRepair()` wrapper

**Note**: File paths above assume Task 1.0 (directory reorganization) is complete. Current paths may differ.

---

**Document Status**: Planning in progress - design phase

