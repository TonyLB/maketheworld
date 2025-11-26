# Context Migration Status

**Date**: January 2025  
**Goal**: Remove `StandardKey.context` property and migrate all usages to `implicitParent`

---

## Executive Summary

**Overall Progress**: ~60% Complete

The migration infrastructure is in place (helper functions implemented), and sorting logic has been successfully migrated. Context dependencies have been removed from `diff()` and nested component finding, though these methods are marked for future refactoring to use graph-based logic. The `context` property is still actively used in several areas (primarily `withLeastCommonContext()` and `StandardKey.merge()`) and cannot be safely removed yet.

---

## ✅ Completed Work

### Phase 1: Helper Functions ✅ COMPLETE
1. ✅ `_getAncestryChainFromImplicitParent()` - Implemented in `index.ts` (line 451)
2. ✅ `_isAncestorOf()` - Implemented in `index.ts` (line 492)
3. ✅ `_extractParentFromContext()` - Implemented in `index.ts` (line 511)
4. ✅ `findFirstDifferingAncestor()` - **NOT NEEDED** - Sorting logic simplified to use ancestry chain comparison directly

---

## ❌ Remaining Work

### Critical: Core Usages Still Using `context`

#### 1. `withLeastCommonContext()` Method - **STILL EXISTS EVERYWHERE**
**Status**: ❌ Not removed - still in use across codebase

**Locations**:
- `components/baseClasses.ts` line 59 - Interface definition
- `components/component.ts` line 393 - Base implementation
- `components/edits.ts` lines 157, 239 - Edit component implementations
- All component subclasses (Feature, Message, Knowledge, Room, Moment, Character, Map, Image, Example) - Override methods
- `processComponents.ts` lines 126-127 - Active usage
- `components/component.ts` line 366 - Used in `diff()` method

**Action Required**: Remove all implementations and replace call sites with `withImplicitParent()` or `withExplicitParent()`.

---

#### 4. Context Intersection in `StandardKey.merge()` - **STILL USING CONTEXT** (temporary)
**Status**: ❌ Still uses context, temporary compatibility measure

**Location**: `components/reference.ts` lines 220-221

**Current Behavior**: Performs context array intersection to find common ancestors when merging two `StandardKey` instances.

**Changes Made**: Added TODO comment noting this is temporary and will be removed when context property is removed.

**Future Work**: Remove context intersection entirely when `context` property is removed from `StandardKey`. Hierarchical connections are handled at the component level (via `implicitParent`), not at the key level.

---

#### 2. Context Intersection in `diff()` - ✅ **CONTEXT DEPENDENCY REMOVED** (needs revisit)
**Status**: ✅ Context dependency removed, but logic needs future refactor

**Location**: `components/component.ts` line 366

**Changes Made**:
- Removed context intersection logic (lines 360-364)
- Now passes empty array `[]` to `withLeastCommonContext()` (sets context to undefined)
- Added TODO comment noting that `diff()` should use `buildComponentGraph` for cascade-delete decisions

**Future Work**: Refactor `diff()` to use graph structure to determine whether nested components should be removed based on whether they appear with other parents that still have connections.

---

#### 3. Finding Nested Components - ✅ **MIGRATED** (needs revisit)
**Status**: ✅ Context dependency removed, but logic needs future refactor

**Location**: `index.ts` line 1346

**Changes Made**:
- Replaced context-based lookup with `implicitParent` check
- Now uses: `.filter((childComponent) => childComponent.implicitParent?.equals(component._key))`
- Added TODO comment noting that this should use `buildComponentGraph` for cascade-delete decisions

**Future Work**: Refactor to use graph structure to determine whether nested components should be included in diff based on whether they appear with other parents that still have connections.

---

#### 4. Setting Context on Edit Components - **STILL SETTING CONTEXT**
**Status**: ❌ Not migrated

**Locations**: 
- `components/edits.ts` line 159 - `StandardRemove`
- `components/edits.ts` lines 241-242 - `StandardReplace`

```157:162:packages/mtw-wml/ts/standardize/components/edits.ts
    withLeastCommonContext(leastCommonContext: StandardKey[]): StandardComponent {
        const returnValue = this.clone()
        returnValue._match._key.context = leastCommonContext
        returnValue._key = new StandardKey(this._match._key)
        return returnValue
    }
```

**Action Required**: Extract parent from `leastCommonContext` and set `implicitParent` instead.

---

#### 5. Sorting Logic - ✅ **MIGRATED**
**Status**: ✅ Complete - No longer uses `context`

**Location**: `sortOrder.ts` entire file

**Implementation**: Now uses `getAncestryChain` function to:
- Build ancestry chains from `implicitParent` (reconstructs context-like behavior)
- Compare chains to find first differing ancestor
- Sort based on differing ancestors or fallback to tag/key comparison

**Note**: All call sites updated to provide `getAncestryChain` helper function.

---

#### 6. Context Serialization - **STILL SERIALIZING CONTEXT**
**Status**: ❌ Not removed

**Locations**:
- `components/reference.ts` lines 80-81 - `StandardKey.toJSON()`
- `components/utils/references.ts` line 87 - Reference mapping

```80:82:packages/mtw-wml/ts/standardize/components/reference.ts
        if (this.context) {
            result.context = this.context.map((item) => (item.toJSON()))
        }
```

**Action Required**: Remove `context` from `toJSON()` output (breaking change, but decision made to remove entirely).

---

#### 7. Context Property Definition - **STILL EXISTS**
**Status**: ❌ Not removed

**Locations**:
- `components/reference.ts` line 14 - `StandardKey` class property
- `components/dataTypes/abstract.ts` line 15 - `StandardBaseData` type

```14:14:packages/mtw-wml/ts/standardize/components/reference.ts
    context?: StandardKey[];
```

**Action Required**: Remove property definition after all usages are migrated.

---

#### 8. Tests - **STILL CHECKING CONTEXT**
**Status**: ❌ Not updated

**Locations**:
- `processComponents.test.ts` lines 518, 542-543
- `components/feature.test.ts` lines 100, 101, 114, 118, 119, 132, 136, 150
- `components/room.test.ts` line 180

**Action Required**: Update all tests to use `implicitParent` instead of `context`.

---

## Migration Checklist

### Phase 2: Replace Simple Usages
- [x] ✅ Replace nested component filtering in `index.ts` line 1346 - **COMPLETE** (needs future refactor)
- [ ] Update any remaining `context.slice(-1)[0]` → `implicitParent` lookups
- [ ] Update any remaining `context?.length > 0` → `implicitParent !== undefined` checks

### Phase 3: Redesign Complex Methods
- [ ] Remove `withLeastCommonContext()` from all component classes
- [ ] Remove `withLeastCommonContext()` from interface (`baseClasses.ts`)
- [ ] Update `processComponents.ts` to use `withImplicitParent()` instead
- [x] ✅ Simplify `diff()` method - remove context intersection, add TODO - **COMPLETE** (needs future refactor)
- [ ] Update edit components (`edits.ts`) to set `implicitParent` instead of `context`
- [x] ✅ Update `sortOrder.ts` to use ancestry chain helpers - **COMPLETE**
- [x] ✅ Replace nested component filtering in `diff()` - **COMPLETE** (needs future refactor)

### Phase 4: Update Serialization
- [ ] Remove `context` from `StandardKey.toJSON()`
- [ ] Remove `context` from `components/utils/references.ts` mapping
- [ ] Update `StandardBaseData` type to remove `context` field

### Phase 5: Remove Context Field
- [ ] Remove `context` property from `StandardKey` class
- [ ] Remove `context` from `StandardKey` constructor
- [ ] Remove `withContext()` method from `StandardKey` (if no longer needed)
- [ ] Update all tests to remove context assertions

---

## Blockers

1. **`withLeastCommonContext()` is deeply integrated** - Used in 10+ files, needs systematic replacement
2. ~~**Sorting logic requires new helper**~~ - ✅ **RESOLVED** - Sorting logic successfully migrated
3. **Edit components need redesign** - Must extract parent from context array and set `implicitParent`
4. **Tests need comprehensive update** - Many tests assert on `context` values

---

## Methods Marked for Future Refactoring

The following methods have had their context dependencies removed or minimized, but are marked with TODO comments indicating they need a more comprehensive refactor to use `buildComponentGraph` for proper cascade-delete and parent relationship logic:

1. **`StandardComponent.diff()`** (`components/component.ts` line 366)
   - Context intersection removed, now passes empty array to `withLeastCommonContext()`
   - Should use graph to determine cascade-delete behavior

2. **`StandardForm.diff()` nested component finding** (`index.ts` line 1346)
   - Replaced context lookup with `implicitParent` check
   - Should use graph to determine whether nested components should be included based on other parent connections

3. **`StandardComponent.merge()`** (`components/component.ts` line 285)
   - Currently delegates to `StandardKey.merge()` which uses context intersection
   - Should use graph to resolve parent relationships when components appear in multiple contexts

4. **`StandardForm.merge()`** (`index.ts` line 869)
   - Currently delegates to component-level merge which uses context intersection
   - Should use graph to resolve parent relationships

5. **`StandardKey.merge()`** (`components/reference.ts` line 220)
   - Still uses context intersection (temporary compatibility measure)
   - Will be removed when `context` property is removed from `StandardKey`
   - Note: Hierarchical connections are handled at component level, not key level

---

## Recommended Next Steps

1. ~~**Implement `findFirstDifferingAncestor()` helper**~~ - ✅ **NOT NEEDED** - Sorting simplified
2. ~~**Update `sortOrder.ts`**~~ - ✅ **COMPLETE** - Now uses `getAncestryChain` instead of context
3. ~~**Simplify `diff()` method**~~ - ✅ **COMPLETE** - Context dependency removed (needs future refactor)
4. ~~**Replace nested component filtering in `diff()`**~~ - ✅ **COMPLETE** - Now uses `implicitParent` (needs future refactor)
5. **Remove `withLeastCommonContext()` systematically**:
   - Start with removing from interface
   - Update all call sites to use `withImplicitParent()` or `withExplicitParent()`
   - Remove implementations from all component classes
6. **Update edit components** - Set `implicitParent` instead of `context`
7. **Remove context from serialization** - Update `toJSON()` methods
8. **Update tests** - Replace all context assertions with `implicitParent` checks
9. **Remove context property** - Final cleanup after all usages removed
10. **Future work**: Refactor `diff()` and `merge()` methods to use `buildComponentGraph` for proper cascade-delete and parent relationship logic

---

## Risk Assessment

**Current Risk**: ⚠️ **HIGH** - `context` is still actively used throughout the codebase. Removing it now would break many features.

**After Phase 3**: ⚠️ **MEDIUM** - Once complex methods are migrated, risk decreases significantly.

**After Phase 4**: ✅ **LOW** - Once serialization is updated and tests pass, safe to remove property.

---

## Notes

- The assessment document indicates that legacy context rebuilding in `finalize()` should be removed, but I did not find this code in the current codebase (may have already been removed).
- Helper functions are well-implemented and ready to use.
- The migration strategy is clear, but requires systematic work across many files.
- ✅ **Sorting logic migration complete** - `sortOrder.ts` now uses `getAncestryChain` exclusively, no context dependencies.
- ✅ **`diff()` and nested component finding** - Context dependencies removed, but marked for future refactor to use `buildComponentGraph` for proper cascade-delete logic.
- ⚠️ **`merge()` and `StandardKey.merge()`** - Still use context intersection, but marked with TODO for future refactor. Context intersection in `StandardKey.merge()` is temporary and will be removed.
- ⚠️ **Note**: `sortOrder.ts` contains debug `console.log` statements that should be removed before finalizing.


