# withS3SelfRepair() Usage Example

This document shows how the `withS3SelfRepair()` wrapper would be used to refactor existing operations.

## Current Pattern (applyEdit - scattered repair logic)

```typescript
// Current: Manual repair checks scattered throughout
export const applyEdit = async (args: ApplyEditArguments): Promise<ApplyEditResult> => {
    // Manual asset loading with error handling
    let assetWorkspace = await AssetWorkspace.fromUUID(args.AssetId)
    
    if (!assetWorkspace) {
        if (args.createIfNeeded && args.zone) {
            assetWorkspace = new AssetWorkspace(args.AssetId, args.zone)
        } else {
            return { success: false, error: 'Asset not found' }
        }
    }
    
    await assetWorkspace.loadJSON()
    
    let existingStandard = assetWorkspace.standard
    
    if (!existingStandard || existingStandard._components.length === 0) {
        if (args.createIfNeeded) {
            existingStandard = new StandardForm(args.AssetId)
        } else {
            return { success: false, error: 'Asset not found' }
        }
    }
    
    // Merge edit logic...
    const editStandard = new StandardForm(args.schema)
    const merged = existingStandard.merge(editStandard)
    
    // Manual lazy migration check
    await appendManifestEventsWithLazyMigration(prefix, workspace, timestamp, [chunkEvent])
    
    // Write operations...
    await assetWorkspace.pushJSON()
    await assetWorkspace.pushWML()
    
    return { success: true, schema: merged }
}
```

**Issues:**
- Manual error handling for missing assets
- Scattered repair logic (`createIfNeeded` checks)
- `appendManifestEventsWithLazyMigration` helper does implicit repairs
- Hard to see separation between "fetch", "repair", and "action"

---

## With withS3SelfRepair() Wrapper

```typescript
export const applyEdit = async (args: ApplyEditArguments): Promise<ApplyEditResult> => {
    return await withS3SelfRepair({
        assetId: args.AssetId,
        suffix: 'wml',
        
        // Fetch: Load required data and assess state
        fetch: async () => {
            const workspace = await AssetWorkspace.fromUUID(args.AssetId) 
                || new AssetWorkspace(args.AssetId, args.zone || 'Library')
            
            await workspace.loadJSON()
            
            const prefix = buildPrefix(args.AssetId, 'wml')
            const manifest = await loadManifest(prefix)
            
            return {
                data: { workspace },
                state: {
                    manifestMissing: manifest.length === 0,
                    materializedViewMissing: workspace.status.s3Missing === true
                }
            }
        },
        
        // Action: Normal operation when data is complete
        action: async ({ workspace }) => {
            const editStandard = new StandardForm(args.schema)
            
            let existingStandard = workspace.standard || new StandardForm(args.AssetId)
            const merged = existingStandard.merge(editStandard)
            
            if (!merged.success) {
                return { success: false, error: 'Merge conflict' }
            }
            
            // Write chunk
            const chunkRef = await writeChunk({
                prefix: buildPrefix(args.AssetId, 'wml'),
                timestamp: now(),
                chunkWML: schemaToWML({ tag: 'Asset', items: editStandard.schema }),
                zone: workspace.zone,
                player: await getAuthoringPlayer()
            })
            
            // Append chunk event to manifest
            await appendManifestEvents(buildPrefix(args.AssetId, 'wml'), [
                { type: 'chunk', ...chunkRef, timestamp: new Date().toISOString(), eventId: uuidv4() }
            ])
            
            // Write materialized views
            await workspace.setJSON(merged.value)
            await workspace.pushJSON()
            await workspace.pushWML()
            
            return { success: true, schema: merged.value }
        },
        
        // Repair metadata: What operation is being performed
        repairOperation: {
            type: 'applyEdit',
            data: {
                editWML: args.schema,
                zone: args.zone || 'Library',
                createIfNeeded: args.createIfNeeded || false
            }
        },
        
        timestamp: now()
    })
}
```

**Benefits:**
- **Clear separation**: Fetch logic, action logic, repair metadata are distinct
- **No manual repair checks**: Wrapper handles detection and routing
- **Consistent error handling**: All repair errors handled by wrapper
- **Better testability**: Can test fetch, action, and repair paths independently
- **Observability**: Automatic logging of repair actions

---

## Example: moveAsset Refactor

### Current (with helper):
```typescript
export async function moveAsset(assetId: AssetUUID, request: MoveAssetRequest) {
    const timestamp = now()
    const contentPrefix = `${fileName}.wml/`
    
    const assetWorkspace = new AssetWorkspace(assetId, fromZone)
    await assetWorkspace.loadJSON()
    
    // Helper does implicit repair
    await appendManifestEventsWithLazyMigration(contentPrefix, assetWorkspace, timestamp, [zoneChangeEvent])
    
    // Update tags...
    await s3Client.updateTags({ Key: `${fileName}.wml`, Tags: { Zone: toZone } })
}
```

### With wrapper:
```typescript
export async function moveAsset(assetId: AssetUUID, request: MoveAssetRequest) {
    return await withS3SelfRepair({
        assetId,
        suffix: 'wml',
        
        fetch: async () => {
            const workspace = new AssetWorkspace(assetId, fromZone)
            await workspace.loadJSON()
            
            const manifest = await loadManifest(buildPrefix(assetId, 'wml'))
            
            return {
                data: { workspace },
                state: {
                    manifestMissing: manifest.length === 0,
                    materializedViewMissing: workspace.status.s3Missing === true
                }
            }
        },
        
        action: async ({ workspace }) => {
            // Append zone change to manifest
            await appendManifestEvents(buildPrefix(assetId, 'wml'), [zoneChangeEvent])
            
            // Update S3 tags
            await s3Client.updateTags({ Key: `${fileName}.wml`, Tags: { Zone: toZone } })
            
            return { success: true }
        },
        
        repairOperation: {
            type: 'moveZone',
            data: { fromZone, toZone }
        },
        
        timestamp: now()
    })
}
```

---

## Logging Output Examples

The wrapper provides automatic observability:

```
# Normal operation (no repair)
# (no log output)

# Manifest missing scenario
Self-repair triggered: manifest missing (ASSET#test-asset, wml)
Self-repair completed: Appended 2 events to manifest

# View missing scenario
Self-repair triggered: materialized view missing (ASSET#test-asset, wml)
# (no events to append - view reconstructed from manifest)

# Both missing scenario (createIfNeeded)
Self-repair triggered: both manifest and materialized view missing (ASSET#test-asset, wml)
Self-repair completed: Appended 2 events to manifest

# Repair failure
Self-repair triggered: both manifest and materialized view missing (ASSET#test-asset, wml)
Error: Self-repair failed: Cannot snapshot empty content (both manifest and view missing)
```

---

## Key Design Points for Evaluation

1. **Generic Types**: `TData` and `TResult` allow different operations to use different data structures
   - `applyEdit` might return `{ success: boolean, schema: StandardForm }`
   - `moveAsset` might return `{ success: boolean, message?: string }`

2. **State Assessment**: Operations decide what to check (manifest, view, both)
   - Some operations might only need manifest
   - Others might need both
   - Wrapper handles unknowns via `assessAndCheckState()` in `immediateSelfRepair`

3. **Re-fetch After Repair**: Wrapper automatically re-fetches after repair
   - Ensures action always works with repaired state
   - No manual cache invalidation needed

4. **Error Propagation**: Wrapper propagates errors from:
   - Fetch function (S3 access denied, etc.)
   - Repair function (cannot repair empty asset, etc.)
   - Action function (merge conflict, etc.)

5. **Manifest Event Handling**: Wrapper handles event appending
   - No need for `appendManifestEventsWithLazyMigration` helper
   - Cleaner separation of concerns

---

## Questions for Evaluation

1. Is the fetch/action separation clear and useful?
2. Does the `RepairOperation` metadata provide enough context?
3. Should we provide helper functions for common fetch patterns?
4. Is the automatic re-fetch after repair the right design?
5. Should operations be responsible for loading manifest in fetch, or should wrapper handle it?

