# Context Migration Status

**Date**: January 2025  
**Goal**: Remove `StandardKey.context` property and migrate all usages to `implicitParent`

---

## Executive Summary

**Overall Progress**: ~50% Complete

The migration infrastructure is in place (helper functions implemented), and sorting logic has been successfully migrated. The `context` property is still actively used in several areas and cannot be safely removed yet.

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

#### 2. Context Intersection in `diff()` - **STILL USING CONTEXT**
**Status**: ❌ Not migrated

**Location**: `components/component.ts` lines 360-366

```360:366:packages/mtw-wml/ts/standardize/components/component.ts
            const leastCommonContext = (this._key?.context ?? []).filter((reference) => (
                (incoming._key?.context ?? []).some((incomingReference) => (
                    reference.equals(incomingReference)
                ))
            ))

            const diffComponent = new StandardReplace(this, incoming).withLeastCommonContext(leastCommonContext)
```

**Action Required**: Simplify `diff()` method - remove context intersection logic, add TODO for future implementation (per assessment decision).

---

#### 3. Finding Nested Components - **STILL USING CONTEXT**
**Status**: ❌ Not migrated

**Location**: `index.ts` line 1317

```1317:1317:packages/mtw-wml/ts/standardize/index.ts
                    .filter(({ _key }) => (Boolean((_key.context ?? []).find((contextKey) => (contextKey.equals(component._key.plain)))))
```

**Action Required**: Replace with `implicitParent` check:
```typescript
.filter((childComponent) => childComponent.implicitParent?.equals(component._key))
```

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
- [ ] Replace nested component filtering in `index.ts` line 1317
- [ ] Update any remaining `context.slice(-1)[0]` → `implicitParent` lookups
- [ ] Update any remaining `context?.length > 0` → `implicitParent !== undefined` checks

### Phase 3: Redesign Complex Methods
- [ ] Remove `withLeastCommonContext()` from all component classes
- [ ] Remove `withLeastCommonContext()` from interface (`baseClasses.ts`)
- [ ] Update `processComponents.ts` to use `withImplicitParent()` instead
- [ ] Simplify `diff()` method - remove context intersection, add TODO
- [ ] Update edit components (`edits.ts`) to set `implicitParent` instead of `context`
- [x] ✅ Update `sortOrder.ts` to use ancestry chain helpers - **COMPLETE**

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

## Recommended Next Steps

1. ~~**Implement `findFirstDifferingAncestor()` helper**~~ - ✅ **NOT NEEDED** - Sorting simplified
2. ~~**Update `sortOrder.ts`**~~ - ✅ **COMPLETE** - Now uses `getAncestryChain` instead of context
3. **Remove `withLeastCommonContext()` systematically**:
   - Start with removing from interface
   - Update all call sites to use `withImplicitParent()` or `withExplicitParent()`
   - Remove implementations from all component classes
4. **Simplify `diff()` method** - Remove context intersection, add TODO
5. **Update edit components** - Set `implicitParent` instead of `context`
6. **Remove context from serialization** - Update `toJSON()` methods
7. **Update tests** - Replace all context assertions with `implicitParent` checks
8. **Remove context property** - Final cleanup after all usages removed

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
- ⚠️ **Note**: `sortOrder.ts` contains debug `console.log` statements that should be removed before finalizing.


