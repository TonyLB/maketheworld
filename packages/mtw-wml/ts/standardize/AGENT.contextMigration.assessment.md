# Context Migration Assessment

**Date**: November 22, 2025  
**Goal**: Assess all usages of `StandardKey.context` outside of `StandardKey` itself and determine if they can be replaced with `implicitParent`

---

## Summary

After analyzing the codebase, here are the key findings:

### ✅ Can be replaced with `implicitParent`:
1. **Getting direct parent**: `context.slice(-1)[0]` → `component.implicitParent`
2. **Checking if has parent**: `context?.length > 0` → `component.implicitParent !== undefined`
3. **Sorting by depth**: `context.length` → Need helper to compute depth from `implicitParent`
4. **Finding nested components**: Check if component is parent of others → Use `implicitParent` lookup

### ⚠️ Need helper functions:
1. **Ancestry chain computation**: Need helper to build chain from `implicitParent` using lookup
2. **Depth computation**: Need helper to compute depth from `implicitParent`
3. **Context array for serialization**: May need to compute from `implicitParent` for backward compatibility

### ❌ Cannot be directly replaced (need different approach):
1. **`withLeastCommonContext()`**: This method sets context array - needs redesign
2. **Context intersection in `diff()`**: Array intersection logic - needs different algorithm
3. **Legacy context rebuilding in `finalize()`**: Should be removed entirely

---

## Detailed Analysis by File

### `index.ts` - StandardForm Operations

#### Usage 1: Legacy Context Rebuilding in `finalize()` (Lines 1126-1140)
```typescript
const rebuiltContextComponents = componentsWithImplicitParents
    .sort(({ _key: keyA }, { _key: keyB }) => ((keyA.context ?? []).length - (keyB.context ?? []).length))
    .reduce<StandardComponent[]>((previous, component) => {
        if (component._key.context && component._key.context.length > 0) {
            const directParentKey = component._key.context.slice(-1)[0]
            const directParent = lookupInComponentList(previous, directParentKey)
            if (directParent) {
                const newContext = [...(directParent._key.context ?? []), directParent._key.plain.toFormat('universal')]
                return [...previous, component.withLeastCommonContext(newContext)]
            }
        }
        return [...previous, component]
    }, [])
```

**Analysis**: This is the legacy context rebuilding logic that should be **removed entirely**. We now have `implicitParent` computed via topological resolution, so this rebuilding step is unnecessary.

**Action**: ❌ **Remove this code** - it's redundant with `_resolveImplicitParents()`

---

#### Usage 2: Hierarchy Assurance in `finalize()` (Lines 1141-1147)
```typescript
const hierarchyAssuredStandardForm = returnValue._components
    .reduce<StandardForm>((previous, component) => {
        const parentComponent = component._key.context?.slice(-1)[0]?.withContext(component._key.context?.slice(0, -1) ?? [])
        if (parentComponent) {
            const assuredComponent = previous.assureComponent(parentComponent)
```

**Analysis**: This gets the direct parent from context. Can be replaced with `implicitParent`.

**Replacement**:
```typescript
const parentComponent = component.implicitParent 
    ? this._lookup(component.implicitParent) 
    : undefined
```

**Action**: ✅ **Replace with `implicitParent` lookup**

---

#### Usage 3: Filtering Top-Level Components (Line 695)
```typescript
.filter(({ _key }) => ((_key.context ?? []).length === 0))
```

**Analysis**: Filters for components at Asset level (no context). Can use `implicitParent === undefined`.

**Replacement**:
```typescript
.filter((component) => component.implicitParent === undefined)
```

**Action**: ✅ **Replace with `implicitParent` check**

---

#### Usage 4: Finding Nested Components in `diff()` (Line 1251)
```typescript
.filter(({ _key }) => (Boolean((_key.context ?? []).find((contextKey) => (contextKey.equals(component._key.plain))))))
```

**Analysis**: Finds components that have the current component in their context (i.e., are children of this component). Can use reverse lookup via `implicitParent`.

**Replacement**:
```typescript
.filter((childComponent) => childComponent.implicitParent === component.universalKey)
```

**Action**: ✅ **Replace with `implicitParent` check**

---

#### Usage 5: Creating Component from Reference (Lines 1086, 1091-1093)
```typescript
const newComponent = standardComponentFactory(...)?.withLeastCommonContext(reference.context ?? [])
const parentContext = reference.context?.slice(-1) ?? []
if (parentContext.length > 0) {
    const parentComponent = parentContext[0].withContext(reference.context?.slice(0, -1) ?? [])
```

**Analysis**: This is creating a component from a `StandardReference` that has `context`. The reference comes from external data (e.g., user input). We need to:
1. Create component without context
2. Look up parent from `reference.context` and set `implicitParent` after creation

**Replacement Strategy**:
- Remove `withLeastCommonContext()` call
- Extract parent from `reference.context` and look it up
- Set `implicitParent` on the new component

**Action**: ⚠️ **Need to redesign** - requires helper to extract parent from reference context

---

### `component.ts` - StandardComponent Operations

#### Usage 1: Serialization in `toJSON()` (Line 200)
```typescript
context: (this._key?.context ?? []).length > 0 ? (this._key.context ?? []).map((context) => context.toJSON()) : undefined,
```

**Analysis**: Serializes context array.

**Decision**: ✅ **Remove entirely** - No backward compatibility needed. We're revamping the storage structure, serialization should stay in sync.

**Action**: ✅ **Remove `context` from `toJSON()` output**

---

#### Usage 2: `withLeastCommonContext()` Check (Lines 238-241)
```typescript
const inLeastCommonContext = context?.length > 0
    ? Boolean(
        (this._key?.context ?? []).length > 0 &&
        (this._key?.context ?? []).slice(-1)[0].equals(context.slice(-1)[0])
    )
    : Boolean((this._key?.context?.length ?? 0) === 0)
```

**Analysis**: Checks if component is in the given least common context. This is used by `withLeastCommonContext()` which sets context.

**Decision**: ✅ **Remove `withLeastCommonContext()` entirely** - We now have `withExplicitParent()` and `withImplicitParent()` to fill the gap. No real need for this method.

**Action**: ✅ **Remove `withLeastCommonContext()` method and all call sites**

---

#### Usage 3: Context Intersection in `diff()` (Lines 358-362)
```typescript
const leastCommonContext = (this._key?.context ?? []).filter((reference) => (
    (incoming._key?.context ?? []).some((incomingReference) => (
        reference.equals(incomingReference)
    ))
))
```

**Analysis**: Computes least common context via array intersection. This is used to create a `StandardReplace` with the common context.

**Decision**: ✅ **Simplify `diff()` method** - The current algorithm is an organic first-iteration and may not be the final approach. Better to remove most of this logic and leave a TODO for future implementation.

**Action**: ✅ **Remove context intersection logic, add TODO comment for future implementation**

---

#### Usage 4: `withLeastCommonContext()` Implementation (Lines 391-395)
```typescript
withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
    const returnValue = new GeneratedComponentClass(this)
    const newContext = leastCommonContext.map((context) => (context.clone()))
    returnValue._key.context = newContext.length > 0 ? newContext : undefined
    return returnValue
}
```

**Analysis**: This method sets the context array.

**Decision**: ✅ **Remove method entirely** - We have `withExplicitParent()` and `withImplicitParent()` to fill the gap. No real need for this method.

**Action**: ✅ **Remove `withLeastCommonContext()` method entirely**

---

### `edits.ts` - Edit Component Operations

#### Usage: Setting Context in Edit Components (Lines 159, 240-241)
```typescript
returnValue._match._key.context = leastCommonContext
// or
returnValue._match._key.context = leastCommonContext
returnValue._payload._key.context = leastCommonContext
```

**Analysis**: Sets context on match/payload components in `StandardRemove`/`StandardReplace`. These components need `implicitParent` set instead.

**Replacement Strategy**:
- Extract parent from `leastCommonContext` (last item)
- Look up parent to get `universalKey`
- Set `implicitParent` on match/payload components

**Action**: ⚠️ **Need to update edit components to use `implicitParent`**

---

### `sortOrder.ts` - Component Sorting Logic

#### Usage: Context-Based Sorting (Lines 14-21)
```typescript
if ((baseA.context ?? []).some(baseB.equals.bind(baseB))) {
    return 1  // A is ancestor of B, A comes first
}
if ((baseB.context ?? []).some(baseA.equals.bind(baseA))) {
    return -1  // B is ancestor of A, B comes first
}
const differingA = (referenceA.context ?? []).find((reference) => (!referenceB.context?.some(reference.equals.bind(reference))))
const differingB = (referenceB.context ?? []).find((reference) => (!referenceA.context?.some(reference.equals.bind(reference))))
```

**Analysis**: Sorting logic that:
1. Checks if one key is in another's context (ancestor check)
2. Finds first differing ancestor for comparison

**Replacement Strategy**:
- Need helper to check if one component is ancestor of another (using `implicitParent` chain)
- Need helper to find first differing ancestor (compare ancestry chains)
- Requires lookup function to traverse `implicitParent` chains

**Action**: ⚠️ **Need helper functions for ancestry chain operations**

---

### `utils/references.ts` - Utility Functions

#### Usage: Context Mapping (Line 87)
```typescript
context: key.context?.map(mapKeyToFormat(format)).map(k => k.toJSON())
```

**Analysis**: Maps context array to a different format. If we remove context, this becomes unnecessary.

**Action**: ⚠️ **Remove or replace based on final context removal decision**

---

## Required Helper Functions

To replace `context` usages with `implicitParent`, we need these helper functions:

### 1. `getAncestryChainFromImplicitParent(component, lookup): ComponentUUID[]`
- Traverses `implicitParent` chain up to Asset level
- Returns array of `ComponentUUID[]` (similar to old `context` but as UUIDs)
- Uses lookup function to get parent components
- Caches results to avoid repeated traversals

### 2. `getDepthFromImplicitParent(component, lookup): number`
- Computes depth (number of ancestors) from `implicitParent`
- Returns 0 for Asset-level components
- Uses cached ancestry chain if available

### 3. `isAncestorOf(child, ancestor, lookup): boolean`
- Checks if `ancestor` is an ancestor of `child`
- Uses ancestry chain traversal
- For sorting logic

### 4. `findFirstDifferingAncestor(componentA, componentB, lookup): ComponentUUID | undefined`
- Finds the first ancestor where the two components' ancestry chains differ
- Returns the differing ancestor UUID
- For sorting logic

### 5. `extractParentFromContext(context: StandardKey[]): StandardKey | undefined`
- Helper to extract direct parent from context array (for migration/backward compatibility)
- Returns last item in context array
- Used when converting from old context-based code

---

## Migration Strategy

### Phase 1: Add Helper Functions
1. Add `getAncestryChainFromImplicitParent()` to `StandardForm` or utility module
2. Add `getDepthFromImplicitParent()` helper
3. Add `isAncestorOf()` helper
4. Add `findFirstDifferingAncestor()` helper

### Phase 2: Replace Simple Usages
1. Replace `context.slice(-1)[0]` → `implicitParent` lookup
2. Replace `context?.length > 0` → `implicitParent !== undefined`
3. Replace `context.length` → `getDepthFromImplicitParent()`
4. Replace nested component filtering → `implicitParent` check

### Phase 3: Redesign Complex Methods
1. Remove legacy context rebuilding in `finalize()`
2. Redesign `withLeastCommonContext()` or replace with `withImplicitParent()`
3. Update `diff()` to use ancestry chain helpers
4. Update `sortOrder.ts` to use ancestry chain helpers

### Phase 4: Update Serialization
1. ✅ **Decision made**: Remove `context` from serialization entirely (no backward compatibility)
2. ⏳ Remove `context` field from `toJSON()` output
3. ⏳ Update all consumers of serialized data (breaking change)

### Phase 5: Remove Context Field
1. Remove `context` field from `StandardKey`
2. Remove all `withLeastCommonContext()` methods
3. Update all tests

---

## Recommendations

1. **Start with helper functions**: Add the ancestry chain helpers first
2. **Remove legacy code**: The context rebuilding in `finalize()` should be removed immediately
3. **Remove `withLeastCommonContext()`**: No longer needed - we have `withExplicitParent()` and `withImplicitParent()`
4. **Simplify `diff()`**: Remove context intersection logic, add TODO for future implementation
5. **Remove context from serialization**: No backward compatibility - clean break is better
6. **Gradual migration**: Replace usages one file at a time, starting with simple cases
7. **Test coverage**: Add tests for helper functions before migrating

## Key Decisions Documented

1. ✅ **`withLeastCommonContext()`**: Remove entirely - replaced by `withExplicitParent()` and `withImplicitParent()`
2. ✅ **`diff()` method**: Simplify - remove context intersection logic, add TODO for future implementation
3. ✅ **Serialization**: Remove `context` from `toJSON()` - no backward compatibility needed

