# Implicit Parent Resolution System - Planning Document

**Date**: November 18, 2025  
**Status**: Planning Phase  
**Related**: [`AGENT.md`](./AGENT.md) - StandardForm operations and component hierarchy

---

## Overview

This document plans the refactoring of the `leastCommonContext` system to a more robust `implicitParent` resolution system that can handle complex scenarios where components appear in multiple contexts with conflicting parent relationships.

### Core Problem

The current `leastCommonContext` system uses simple array intersection to determine component hierarchy, which fails when:
- Parent components appear in multiple contexts (e.g., Room-2 appears both in Map-3 and at Asset level)
- Child components appear in different parent contexts (e.g., Feature-1 appears in Room-2 and Room-4)
- Parent context changes during merge operations cause information loss

### Proposed Solution

Replace array-based context intersection with a graph-based topological resolution system that:
1. Collects all parent→child edges from all component appearances
2. Uses topological sort to determine resolution order
3. Resolves parent contexts before child contexts
4. Handles conflicting parent relationships correctly

---

## Getting Started

This is a complex refactoring that touches core StandardForm operations. Follow this structured approach to understand the context before implementation.

### 1. Understand Project Foundations

**Read these documents in order:**

- **[`../../AGENT.md`](../../AGENT.md)** - WML Language Overview
  - **Why**: Understand the WML format and how components are represented in schema
  - **Focus**: Component nesting, context representation, and StandardComponent format
  - **Key Insight**: Components can appear multiple times in different contexts within a single asset

- **[`./AGENT.md`](./AGENT.md)** - StandardForm Operations
  - **Why**: StandardForm orchestrates all component operations including merge and diff
  - **Focus**: How `finalize()` currently rebuilds contexts, how `merge()` combines components
  - **Key Insight**: The current context rebuilding in `finalize()` is fragile and loses information

- **[`./components/AGENT.md`](./components/AGENT.md)** - StandardComponent System
  - **Why**: Components store context in `StandardKey.context` and have `explicitParent` support
  - **Focus**: How `withLeastCommonContext()` works, how `explicitParent` differs from context
  - **Key Insight**: `explicitParent` is manually set, while context is system-calculated

### 2. Read Current Document

**Recommended reading order:**

1. **Problem Statement** (below) - Understand why the current system fails
2. **Edge Case Analysis** - See the concrete scenario that breaks current logic
3. **Proposed Solution** - Graph-based topological resolution approach
4. **Implementation Plan** - Step-by-step refactoring strategy

### 3. Understand Core Integration Points

**Primary code to modify:**

- **`./index.ts`** - `StandardForm` class
  - `finalize()` method (lines 817-862) - Currently rebuilds contexts with simple lookup
  - `merge()` method (lines 450-476) - Combines components but loses context information
  - Constructor - Processes schema into components via `processComponents()`

- **`./processComponents.ts`** - Component extraction from schema
  - **Current**: Sets `context` based on `componentContext` array during recursive processing
  - **Future**: Also collect parent→child edges for graph construction

- **`./components/component.ts`** - Component base class
  - `withLeastCommonContext()` method (line 382) - Sets context array
  - `merge()` method (line 275) - Merges contexts via `StandardKey.merge()` which intersects arrays
  - `diff()` method (line 328) - Calculates `leastCommonContext` via intersection

- **`./components/reference.ts`** - `StandardKey` class
  - `merge()` method (line 95) - **Critical**: Intersects context arrays, losing information
  - `context` property - Array of `StandardKey[]` representing parent chain

**Key insight**: The intersection logic in `StandardKey.merge()` (line 106) is the root cause of information loss.

### 4. Review Implemented Code

**Study these patterns:**

- **Graph utilities**: `packages/mtw-utilities/ts/graphStorage/utils/graph/`
  - `Graph` class - Directed graph with nodes and edges
  - `topologicalSort()` - Tarjan's algorithm for dependency resolution
  - `generationOrder()` - Groups by dependency generations

- **Explicit parent system**: `./explicit/parent.ts`
  - Shows how explicit parent relationships are stored and merged
  - Demonstrates the pattern we want for implicit parents

- **Current context usage**: `./index.ts` lines 827-839
  - See how `finalize()` currently rebuilds contexts
  - Understand the lookup-based approach we're replacing

### 5. Check Testing Patterns

**Review test files:**

- **`./components/feature.test.ts`** - Tests for `leastCommonContext` merging (lines 99-135)
- **`./components/room.test.ts`** - Tests for `explicitParent` (lines 438-656)
- **`./index.test.ts`** (if exists) - StandardForm merge and diff tests

**Testing approach**: Create tests for the edge case scenario before refactoring to ensure the new system handles it correctly.

### 6. Identify Next Task

**Current phase**: Planning and design

**Task breakdown**: See [Implementation Plan](#implementation-plan) section below for the complete 6-phase implementation strategy.

**To begin implementation**:
1. Review the Implementation Plan section to understand all phases
2. Start with Phase 1: Edge Collection Infrastructure
3. Follow the phase-by-phase approach, ensuring tests pass after each phase

### 7. Run Tests Before Starting

**Baseline verification:**

```bash
cd packages/mtw-wml
npm run test -- --watchAll=false
```

**Expected**: All existing tests pass. Note the current test count and any failures to establish baseline.

---

## Problem Statement

### Current System: `leastCommonContext`

The current system represents component hierarchy using `StandardKey.context`, which is an array of `StandardKey[]` representing the chain of parent components where a component was defined. For example:

- A Feature defined inside a Room inside a Map has `context = [Room-key, Map-key]`
- The system calculates the "least common context" by intersecting context arrays when merging components

**Current Implementation:**

```typescript
// In StandardKey.merge() - line 106
const newContext = (this.context ?? []).filter((reference) => 
    ((other.context ?? []).some((otherReference) => 
        ((otherReference.equals(new StandardKey(reference)))))))
returnValue.context = newContext.length > 0 ? newContext : undefined
```

This simple intersection works when all appearances share the same parent chain, but fails when parent contexts conflict.

### Why Array Intersection Fails

**The Core Issue**: Array intersection assumes all appearances of a component share the same parent chain. When a parent component appears in multiple contexts, the intersection loses critical information.

**Example Scenario**:
1. Feature-1 appears in Room-2 (which is in Map-3) → Feature-1 gets `context = [Room-2-key, Map-3-key]`
2. Room-2 appears a second time at Asset level (editing other fields) → Room-2 gets `context = []`
3. Feature-1 appears a second time in Room-4 (also in Map-3) → Feature-1 gets `context = [Room-4-key, Map-3-key]`

**What Happens During Merge**:

1. **Room-2 merge**:
   - Base: `context = [Map-3-key]`
   - Incoming: `context = []`
   - Intersection: `[]` → becomes `undefined`
   - **Result**: Room-2 loses its Map-3 relationship

2. **Feature-1 merge**:
   - Base: `context = [Room-2-key, Map-3-key]`
   - Incoming: `context = [Room-4-key, Map-3-key]`
   - Intersection: `[Map-3-key]`
   - **Result**: Feature-1 gets `context = [Map-3-key]`, losing the Room-2 relationship

**The Semantic Mismatch**: After merging, Feature-1 has `context = [Map-3-key]`, but Room-2 (where Feature-1 originally appeared) now has `context = undefined` (Asset level). The system has lost the information that Feature-1 was originally nested in Room-2.

**Why `finalize()` Doesn't Fix It**: The `finalize()` method (lines 827-839) tries to rebuild contexts by looking up parents, but it only works with the context information that survived the merge. If Room-2's context was lost during merge, `finalize()` can't restore the Feature-1 → Room-2 relationship.

### Information Loss Analysis

The array-based representation is **efficient for intersection** but **brittle when**:
- Parent components appear in multiple contexts
- Parent contexts change during merging
- The system needs to track "this child appeared in this parent" relationships that can be lost during intersection

The array representation assumes all appearances share the same context chain, which breaks when parents appear in different contexts.

---

## Proposed Solution: Graph-Based Topological Resolution

### Algorithm Overview

1. **Edge Collection Phase**: During `processComponents` and merge, collect all parent→child edges from:
   - Implicit nesting (from `componentContext` chains)
   - Explicit `Parent` tags
   - All appearances of each component

2. **Graph Construction**: Build a directed graph where:
   - Nodes = components (by universalKey)
   - Edges = parent→child relationships from all appearances

3. **Topological Resolution**: Use `topologicalSort` to determine resolution order, ensuring parents are resolved before children.

4. **Context Resolution**: For each component in topological order:
   - Collect all context arrays from all its appearances
   - For each context array, resolve it by looking up the already-resolved parent contexts
   - Find the intersection of all resolved context arrays
   - Set that as the component's `implicitParent` (or `context`)

### Edge Case Resolution

For the problematic scenario:

**Edges collected**:
- `Feature-1 → Room-2` (from appearance 1)
- `Feature-1 → Room-4` (from appearance 2)
- `Room-2 → Map-3` (from appearance 1)
- `Room-2 → Asset` (from appearance 2)
- `Room-4 → Map-3` (from appearance 2)

**Topological order**: `Map-3`, `Room-2`, `Room-4`, `Feature-1`

**Resolution**:
1. **Map-3**: No parent → Asset level
2. **Room-2**: Two appearances with different parents → resolves to Asset level (no common parent)
3. **Room-4**: Resolves to `Map-3`
4. **Feature-1**: 
   - Appearance 1 context: `[Room-2, Map-3]` → resolved: `[Asset, Room-2]` (Room-2 resolved to Asset)
   - Appearance 2 context: `[Room-4, Map-3]` → resolved: `[Map-3, Room-4]` (Room-4 resolved to Map-3)
   - Intersection: `[]` → Asset level ✓

**Result**: Feature-1 correctly resolves to Asset level because it has no common context across its appearances.

### Benefits

1. **Preserves all relationships**: All parent-child edges from all appearances are stored
2. **Handles context changes**: When parents appear in multiple contexts, the system tracks all relationships
3. **Uses existing utilities**: Leverages `topologicalSort` from `mtw-utilities`
4. **Correctly resolves edge cases**: The scenario above is handled correctly

---

## Implementation Plan

### Phase 1: Data Representation Migration

**Goal**: Migrate from `context` array to `parent` reference

**Tasks**:
1. Add `parent?: StandardKey | ComponentUUID` field to `StandardKey`
2. Create basic helper methods: `hasParent()`, `getDirectParent()`
3. Create `getAncestryChain()` helper method (without caching - will add caching in Phase 4)
4. Update `StandardKey` to support both `context` and `parent` during transition
5. Write tests for helper methods

**Files to modify**:
- `./components/reference.ts` - Add `parent` field and basic helper methods
- `./components/baseClasses.ts` - Update type definitions
- Create helper utilities for ancestry chain computation (simple traversal, no caching yet)

**Note**: Caching mechanism deferred to Phase 4 (Topological Resolution) to avoid circular dependency issues. Without topological sorting, caching on an unsorted graph could lead to infinite loops.

### Phase 2: Edge Collection Infrastructure

**Goal**: Collect parent→child edges during component processing

**Tasks**:
1. Create `ParentChildEdge` type to represent edges
2. Modify `processComponents()` to collect edges from `componentContext` chains
3. Store edges in a new field on `StandardForm` (or compute on-demand)
4. Handle explicit `Parent` tags as edges
5. Set `parent` field on components during processing (from edges)
6. Write tests for edge collection

**Files to modify**:
- `./processComponents.ts` - Add edge collection logic and set `parent` field
- `./index.ts` - Add edge storage/retrieval
- `./components/component.ts` - Extract edges from explicitParent

### Phase 3: Graph Construction

**Goal**: Build directed graph from collected edges

**Tasks**:
1. Import `Graph` class from `mtw-utilities`
2. Create graph construction function in `finalize()` or separate method
3. Map components to graph nodes (by universalKey)
4. Add all collected edges to graph
5. Write tests for graph construction

**Files to modify**:
- `./index.ts` - Graph construction in `finalize()`
- Add graph utilities import

### Phase 4: Topological Resolution

**Goal**: Resolve parent references in dependency order

**Tasks**:
1. Use `topologicalSort()` to get resolution order
2. Implement resolution algorithm that:
   - Processes components in topological order
   - For each component, collects all parent edges from all appearances
   - Resolves parent by looking up already-resolved parents
   - Handles multiple appearances with different parents (finds common parent or Asset level)
   - Sets `parent` field on component
3. **Add caching mechanism for ancestry chain computation**:
   - Now safe because topological sort ensures no circular dependencies
   - Cache computed ancestry chains during resolution
   - Update `getAncestryChain()` to use cache
   - Add `getDepth()` helper that uses cached chains
4. Replace current `finalize()` context rebuilding with topological parent resolution
5. Use `getAncestryChain()` helper when full chain is needed (e.g., for sorting)
6. Write comprehensive tests including edge case

**Files to modify**:
- `./index.ts` - Replace context rebuilding in `finalize()` with parent resolution
- Add resolution algorithm using parent references
- `./components/reference.ts` - Add caching to `getAncestryChain()` and `getDepth()` helpers

### Phase 5: Merge Integration

**Goal**: Preserve edges and parent references during merge operations

**Tasks**:
1. Combine edge lists from both StandardForms during merge
2. Update `StandardKey.merge()` to handle `parent` field (not array intersection)
3. Merge parent references: if both have same parent, keep it; if different, resolve via graph
4. Ensure edges survive merge operations
5. Update merge tests to verify edge and parent preservation
6. Handle edge conflicts (same edge from different sources)

**Files to modify**:
- `./index.ts` - `merge()` method
- `./mergeToComponentList.ts` - Preserve edge information
- `./components/reference.ts` - Update `StandardKey.merge()` for `parent` field

### Phase 6: Complete Migration and Cleanup

**Goal**: Remove `context` array, complete migration to `parent` reference

**Tasks**:
1. Update all remaining `context` array usages to use `parent` + helpers
2. Remove `context` field from `StandardKey` (breaking change)
3. Rename `withLeastCommonContext()` → `withImplicitParent()` (or `withParent()`)
4. Update all call sites and interface definitions
5. Update documentation
6. Remove temporary compatibility code

**Files to modify**:
- `./components/reference.ts` - Remove `context` field
- `./components/baseClasses.ts` - Interface definitions
- `./components/component.ts` - Method implementations
- `./components/edits.ts` - Edit component methods
- `./index.ts` - All context usages
- `./processComponents.ts` - All context usages
- `./sortOrder.ts` - Use `getAncestryChain()` helper
- All component classes and call sites

### Phase 7: Testing and Validation

**Goal**: Comprehensive test coverage

**Tasks**:
1. Create edge case test (the problematic scenario)
2. Test topological resolution with various graph structures
3. Test merge with conflicting parent references
4. Test explicitParent + implicitParent interaction
5. Test ancestry chain computation and caching
6. Integration tests for full StandardForm operations
7. Performance tests for large assets

**Test files**:
- New: `./implicitParent.test.ts` - Comprehensive test suite
- Update: Existing component tests
- Update: All tests that used `context` array

---

## Data Representation: Context Array vs Single Parent

### Current Approach: Full Context Chain Array

**Current representation**: `StandardKey.context?: StandardKey[]` - Full chain of parents
- Example: `context = [Room-key, Map-key]` for a Feature in Room in Map
- Stores complete ancestry chain in each component

**Usage patterns observed**:
- `context.slice(-1)[0]` - Get direct parent (most common)
- `context?.length > 0` - Check if has parents
- `[...parentContext, currentKey]` - Rebuild chain from parent
- `context.length` - Sort by depth

### Proposed Approach: Single Parent Reference

**Proposed representation**: `StandardKey.parent?: StandardKey | ComponentUUID` - Direct parent only
- Example: `parent = Room-key` for a Feature in Room
- Ancestry chain computed on-demand via parent traversal

**Benefits**:
1. **Aligns with graph structure**: Graph edges are parent→child, matching the data model
2. **Eliminates redundancy**: No need to store full chain when we can compute it
3. **Simpler merge logic**: Merge just needs to handle parent (not array intersection)
4. **Matches actual usage**: Most code only needs direct parent anyway
5. **Graph resolution computes chain**: During topological resolution, we traverse parent links anyway

**Implementation considerations**:
- **Ancestry chain computation**: Traverse parent links up to Asset level
- **Caching**: Use dynamic programming to cache computed chains (avoid repeated traversals)
- **Lookup helper**: `getAncestryChain(component)` function with memoization
- **Depth computation**: Compute depth via traversal (cacheable)

**Example resolution algorithm**:
```typescript
// During topological resolution
const resolvedContexts = new Map<ComponentUUID, StandardKey[]>()

function getAncestryChain(component: StandardComponent, lookup: Map): StandardKey[] {
    if (resolvedContexts.has(component.universalKey)) {
        return resolvedContexts.get(component.universalKey)!
    }
    
    if (!component._key.parent) {
        // Asset level
        resolvedContexts.set(component.universalKey, [])
        return []
    }
    
    const parent = lookup.get(component._key.parent)
    if (!parent) {
        // Parent not found, treat as Asset level
        resolvedContexts.set(component.universalKey, [])
        return []
    }
    
    // Recursively get parent's chain, then append parent
    const parentChain = getAncestryChain(parent, lookup)
    const chain = [...parentChain, new StandardKey(parent._key.plain)]
    resolvedContexts.set(component.universalKey, chain)
    return chain
}
```

**Migration impact**:
- **Breaking change**: `context` array → `parent` single reference
- **Helper methods needed**: `getAncestryChain()`, `getDepth()`, `hasParent()`
- **Update all call sites**: Replace `context.slice(-1)[0]` with `parent`, `context?.length` with `parent !== undefined`

### Decision: Single Parent Reference

**Decision**: Replace `context?: StandardKey[]` with `parent?: StandardKey | ComponentUUID`

**Rationale**:
1. Graph edges naturally represent parent→child relationships
2. Most code only needs direct parent (current usage patterns confirm this)
3. Full chain can be computed on-demand with caching
4. Eliminates array intersection problems (merge just handles parent)
5. Aligns with graph-based resolution approach

**Implementation strategy**:
- Add `parent` field to `StandardKey`
- Add helper methods for ancestry chain computation (with caching)
- Update all `context` usages to use `parent` + helpers
- Remove `context` array after migration complete

**Alternative considered**: Keep `context` array, compute from `parent` when needed
- **Rejected**: Would maintain redundant data and complexity

---

## Design Decisions

### Edge Storage

**Decision**: Store edges as a field on `StandardForm` rather than computing on-demand

**Rationale**: 
- Edges need to survive merge operations
- Computing on-demand would require re-parsing schema
- Storage is minimal (just parent→child pairs)

**Alternative considered**: Compute edges in `finalize()` only
- **Rejected**: Would lose edge information during merge

### Graph Node Identity

**Decision**: Use `universalKey` as graph node identifier

**Rationale**:
- Components are identified by universalKey in StandardForm
- Multiple appearances of same component share same universalKey
- Matches existing component lookup patterns

### Resolution Algorithm

**Decision**: Resolve parent by looking up already-resolved parents, compute ancestry chain on-demand

**Rationale**:
- Topological order ensures parents are resolved first
- Allows handling of parent context changes
- Single parent reference simplifies merge logic
- Ancestry chain computed with caching when needed

**Alternative considered**: Use array intersection on raw contexts
- **Rejected**: Would have same information loss problem

**Alternative considered**: Store full context array
- **Rejected**: Redundant with graph structure, adds complexity

### Backward Compatibility

**Decision**: Replace `context` array with `parent` reference (breaking change)

**Rationale**:
- The single parent model aligns with graph structure
- Eliminates array intersection problems
- Most code only needs direct parent anyway
- This is internal API, not external

**Mitigation**: 
- Add helper methods for common operations (getAncestryChain, getDepth)
- Update all call sites in same refactoring phase
- Comprehensive test coverage to catch migration issues

---

## Open Questions

1. **Edge storage format**: Should edges include metadata (which appearance, source, etc.) or just parent→child pairs?
   - **Leaning toward**: Just parent→child pairs for simplicity

2. **Explicit vs Implicit priority**: If a component has both `explicitParent` and implicit parent from context, which takes precedence?
   - **Leaning toward**: `explicitParent` takes precedence (it's explicit user intent)

3. **Empty context handling**: How should we represent "no parent" (Asset level)?
   - **Current**: `context = undefined` or `context = []`
   - **Proposed**: Keep same representation for consistency

4. **Performance**: Will graph construction and topological sort be fast enough for large assets?
   - **Note**: Topological sort is O(V+E), should be fine for typical asset sizes
   - **Mitigation**: Can cache graph if needed

---

## Success Criteria

1. ✅ Edge case scenario resolves correctly (Feature-1 → Asset level)
2. ✅ All existing tests pass
3. ✅ New tests for edge cases pass
4. ✅ `explicitParent` and `implicitParent` work together correctly
5. ✅ Merge operations preserve all parent-child relationships
6. ✅ `finalize()` correctly rebuilds contexts using topological resolution
7. ✅ Code is clear and maintainable

---

## Related Documentation

- [`./AGENT.md`](./AGENT.md) - StandardForm operations
- [`./components/AGENT.md`](./components/AGENT.md) - StandardComponent system
- [`./explicit/parent.ts`](./explicit/parent.ts) - Explicit parent implementation
- [`../../AGENT.md`](../../AGENT.md) - WML language overview
- Graph utilities: `packages/mtw-utilities/ts/graphStorage/utils/graph/`

---

## Notes

- This refactoring is a prerequisite for properly handling `explicitParent` in merge/diff operations
- The topological resolution approach is more general and can handle future hierarchy requirements
- Consider this a foundation for more sophisticated parent-child relationship management

