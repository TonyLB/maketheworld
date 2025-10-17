# Remaining AssetWorkspaceAddress Usage Analysis

**Date**: October 16, 2025  
**Context**: Phase 1B - Pre-final cleanup assessment  
**Purpose**: Identify unusual uses before final AssetWorkspaceAddress removal

---

## Summary

After refactoring `AssetMetaData` cache, most `AssetWorkspaceAddress` usage is now:
- ✅ **Legacy constructor signatures** (backward compatibility during transition)
- ✅ **Stubbed backup functions** (preserved for Phase 2)
- ✅ **Dead code parameters** (never actually passed/used)
- ⚠️ **Duplicate type definitions** (need cleanup)

---

## Category 1: ✅ Normal "Asset Address Passing" (Safe to Remove)

These are straightforward address-passing patterns that can be removed by eliminating optional parameters:

### A. **applyEdit coordination event**
**Files**: 
- `lambda/wml/dataSource/coordinationSerializer.ts` (lines 24, 51)
- `lambda/wml/dataSource/applyEdit/index.ts` (line 9)
- `lambda/wml/dataSource/mtw-wml.ts` (line 50)
- `lambda/wml/app.ts` (line 97)

**Status**: ✅ Dead code - `address` parameter is never passed by Step Function (removed in Phase 1A)

**Current Flow**:
```
Step Function → lambda handler (event.address = undefined)
                      ↓
                messageBus (payload.address = undefined)
                      ↓
                applyEdit({ address: undefined, ... })
                      ↓
                (Ignored - uses fromUUID() instead)
```

**Refactor**: Simply remove the `address?` parameter from all 4 files.

---

### B. **Stubbed backup functions**
**Files**:
- `lambda/wml/backupWML/index.ts` (lines 4, 40 - in stub + commented code)
- `lambda/assets/backups/index.ts` (line 19 - in stub return type)

**Status**: ✅ Already stubbed - preserved for Phase 2 reference

**Action**: No changes needed now. Phase 2 will redesign backup entirely.

---

## Category 2: ⚠️ Duplicate Type Definitions (Need Cleanup)

### A. **packages/mtw-interfaces duplicate**
**Files**:
- `packages/mtw-interfaces/ts/baseClasses.ts` (line 41) - Full duplicate
- `packages/mtw-interfaces/ts/eventBridge/index.ts` (line 22) - Partial duplicate (Canon/Library/Personal only)

**Usage**: These type definitions are **UNUSED** - defined but never referenced in any field or variable.

**Investigation**: Check if these were intended for EventBridge event payloads but never actually used.

**Refactor**: 
1. Search for any uses of these duplicate types
2. If unused, delete the duplicate definitions
3. If used, replace with import from `@tonylb/mtw-asset-workspace`

---

## Category 3: 🔍 Internal Cache (WML Lambda)

### **lambda/wml/internalCache/meta.ts**

**Status**: Similar to `lambda/assets` AssetMetaData - stores `address?` but may be unused

**Usage Check Needed**:
```bash
grep "internalCache\.Meta\.(get|set)" lambda/wml
```

**Current Result**: Only found in documentation - **NO ACTIVE USAGE**!

**Likely Verdict**: Dead code - the WML lambda's internal cache Meta type is never actually used.

**Refactor**: Likely can delete entire `lambda/wml/internalCache/meta.ts` file.

---

## Category 4: ✅ Constructor Signatures (Backward Compatibility)

**Files**:
- `packages/mtw-asset-workspace/ts/readOnly.ts` (lines 104, 121)
- `packages/mtw-asset-workspace/ts/index.ts` (line 15)

**Status**: ✅ Intentional - provides backward compatibility during transition

**Action**: Keep during Phase 1B, remove in Phase 2.

---

## Recommendations

### **Immediate (Before Final Refactor)**:

1. ✅ **Remove dead `address?` parameter** from applyEdit chain (4 files)
2. 🔍 **Investigate WML Meta cache** - likely unused, can delete
3. ⚠️ **Remove duplicate types** in `mtw-interfaces` package

### **After Addressing Above**:

Then proceed with final Phase 2 refactor:
- Remove `AssetWorkspaceAddress` type from `mtw-asset-workspace`
- Remove legacy constructor overloads
- Simplify internal storage to `assetId`/`zone`/`player`

---

## Files Requiring Individual Assessment

### 1. **lambda/wml/internalCache/meta.ts** 🔍 HIGH PRIORITY
- **Type**: `MetaCache` with `address?: AssetWorkspaceAddress`
- **Question**: Is this cache ever actually used?
- **Search**: `grep "internalCache.Meta" lambda/wml`
- **Verdict**: Appears UNUSED - no active .get() or .set() calls found

### 2. **packages/mtw-interfaces duplicates** ⚠️ MEDIUM PRIORITY
- **File 1**: `ts/baseClasses.ts` (full duplicate)
- **File 2**: `ts/eventBridge/index.ts` (partial duplicate)
- **Question**: Are these used anywhere, or can they be deleted?
- **Action**: Search for references, likely delete

### 3. **ApplyEditRequest.address** ✅ LOW PRIORITY (Simple)
- **Files**: 4 files in coordination chain
- **Status**: Dead code - never passed, always undefined
- **Action**: Remove optional parameter

---

## Next Steps

**Recommended order**:
1. Investigate and likely delete `lambda/wml/internalCache/meta.ts`
2. Remove `address?` from ApplyEditRequest chain
3. Clean up duplicate type definitions in `mtw-interfaces`
4. Proceed with final Phase 2 refactor

All three of these appear to be simple cleanups, not complex refactors!

