# AssetWorkspace Simplification Analysis

**Date**: October 16, 2025  
**Context**: Phase 1B S3 Storage Migration - Post-`assetWorkspaceFromAssetId` removal  
**Status**: ⚠️ TEMPORARY DOCUMENT - Ready for getter consolidation (Option 2)  
**Tracked in**: `lambda/wml/AGENT.s3storage.migration.md` (Temporary Documents section)

## ✅ **Recent Updates** (October 16, 2025)

- **`assetWorkspaceFromAssetId` REMOVED** (not refactored - fully deleted)
- `AssetWorkspace.fromUUID()` now ensures `assetId` is always set
- All prerequisites for Option 2 (getter consolidation) are now met

## Current Getter Structure

```typescript
class ReadOnlyAssetWorkspace {
    get filePath(): string {
        // Phase 1: Flat UUID-based storage - no subdirectories
        return ''
    }

    get fileName(): string {
        // Phase 1: Use UUID (without ASSET# prefix) as the filename
        if (this.assetId) {
            return this.assetId.replace('ASSET#', '')
        }
        // Fallback to address.fileName for backward compatibility
        if ('fileName' in this.address) {
            return this.address.fileName || ''
        }
        return ''
    }

    get fileNameBase(): string {
        return this.fileName
    }
}
```

## Usage Analysis

### Internal Usage (within mtw-asset-workspace package)

All internal methods use `fileNameBase`:

**ReadOnly Operations** (`readOnly.ts`):
- `forceDefault()` - Line 149: `${this.fileNameBase}.wml`
- `presignedURL()` - Line 185: `${this.fileNameBase}.wml`
- `loadJSON()` - Line 202: `${this.fileNameBase}.ndjson`
- `loadAuthorizationJSON()` - Line 228: `${this.fileNameBase}.auth.ndjson`

**Write Operations** (`index.ts`):
- `loadWML()` - Line 54: `${this.fileNameBase}.wml`
- `loadAuthorizationWML()` - Line 73: `${this.fileNameBase}.auth.wml`
- `pushJSON()` - Lines 114, 135: `${this.fileNameBase}.json`, `${this.fileNameBase}.ndjson`
- `pushAuthorizationJSON()` - Line 145: `${this.fileNameBase}.auth.ndjson`
- `pushWML()` - Line 165: `${this.fileNameBase}.wml`
- `pushAuthorizationWML()` - Line 185: `${this.fileNameBase}.auth.wml`

### External Usage (outside mtw-asset-workspace package)

**Only one external consumer:**

`lambda/wml/backupWML/index.ts`:
- Line 33: `${fromWorkspace.filePath}${fromWorkspace.fileName}.wml` (for S3 read)
- Lines 57, 60: `${fromWorkspace.fileName}.wml` (for tar entry name)

**Note**: `backupWML` is marked as deferred to Phase 2 in migration plan.

## Redundancy Analysis

### Current Redundancy

1. **`filePath` getter**: Always returns `''` (empty string)
   - Originally returned zone-based subdirectories
   - Now obsolete with flat storage
   - Only used in `backupWML` (Phase 2 feature)

2. **`fileNameBase` getter**: Simply delegates to `fileName`
   - Adds no value
   - Historical artifact from when `fileNameBase` = `filePath + fileName`
   - All internal code uses `fileNameBase`, never `fileName` directly

3. **`fileName` getter**: The actual implementation
   - Returns UUID without `ASSET#` prefix
   - Has fallback logic for `address.fileName`

## Simplification Options

### Option 1: Minimal Change (Recommended for Phase 1)

**Keep current structure, document clearly:**
- ✅ No breaking changes
- ✅ Works with existing code
- ✅ Can defer further simplification to Phase 1B/1C

**Action**: None required right now

### Option 2: Consolidate getters

**Eliminate `fileNameBase`, use `fileName` directly:**

```typescript
// Remove fileNameBase getter entirely
// Update all internal uses: this.fileNameBase → this.fileName
```

**Impact**:
- ✅ Reduces cognitive load (one less concept)
- ✅ More direct/clear naming
- ❌ Requires updating 12+ internal method calls
- ❌ Breaking change for `backupWML` (though it's Phase 2)

### Option 3: Full Simplification (Phase 1B/1C)

**Eliminate address-based path construction entirely:**

```typescript
class ReadOnlyAssetWorkspace {
    assetId: AssetUUID  // Required, not optional
    
    // Single source of truth
    get s3Key(): string {
        return this.assetId.replace('ASSET#', '')
    }
    
    // Helper for different file types
    s3KeyFor(type: 'wml' | 'ndjson' | 'auth.wml' | 'auth.ndjson'): string {
        return `${this.s3Key}.${type}`
    }
}
```

**Benefits**:
- ✅ Crystal clear semantics
- ✅ Eliminates `AssetWorkspaceAddress` complexity
- ✅ Natural API: `workspace.s3KeyFor('wml')`
- ✅ Forces `assetId` to be set (no fallbacks)

**Challenges**:
- ❌ Requires Phase 1B work (`assetWorkspaceFromAssetId` must set `assetId`)
- ❌ Breaking change for any external consumers
- ❌ Requires constructor API changes

## Recommendations

### Immediate (Phase 1A Complete)

**Do nothing.** Current implementation works correctly and all tests pass.

### ✅ Phase 1B Complete (October 16, 2025)

~~When refactoring `assetWorkspaceFromAssetId`:~~
1. ✅ ~~Ensure `assetId` is always set on workspace~~ - Done via `fromUUID()`
2. ✅ `assetWorkspaceFromAssetId` **REMOVED** (entire file deleted)
3. **Ready for Option 2**: Eliminate `fileNameBase`, use `fileName` directly
4. **Next**: Update `backupWML` to use `fileName` only (remove `filePath` usage)
5. **Next**: Mark `filePath` getter as deprecated

### Phase 1C / Phase 2

When simplifying `AssetWorkspaceAddress`:
1. Consider **Option 3**: Full simplification with `s3Key` API
2. Remove backward compatibility fallbacks
3. Make `assetId` required in constructor
4. Potentially replace `AssetWorkspaceAddress` with simpler metadata structure

## Dependency Tree

```
backupWML (Phase 2)
    ↓
filePath (always '') + fileName (UUID)
    ↓
fileNameBase (= fileName)
    ↓
All internal load/push methods
```

**Critical Path**: `backupWML` is the only blocker for getter simplification. Once deferred to Phase 2, we can refactor freely.

## Conclusion

**Current Status** (October 16, 2025): ✅ Phase 1B prerequisites complete
- `assetWorkspaceFromAssetId` removed
- `assetId` always set via `fromUUID()`
- System working correctly with redundant getters

**Next Action**: **READY TO PROCEED** with Option 2 (consolidate `fileNameBase → fileName`)
1. Update `backupWML` first (only external consumer)
2. Replace all internal `this.fileNameBase` → `this.fileName`
3. Remove `fileNameBase` getter
4. Deprecate `filePath` getter

**Future Action**: Phase 2 is natural time for full simplification to `s3Key` API (Option 3)

