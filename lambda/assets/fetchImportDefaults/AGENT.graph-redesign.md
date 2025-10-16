# Import Graph Redesign - Component-Level Architecture

**Date**: October 16, 2025  
**Context**: Phase 1B S3 Storage Migration - dbRegister deprecation  
**Status**: Gap documentation and future design

## Current State: BROKEN

### The Problem

**Asset-level import graph is not maintained**:
- Old `dbRegister` functions maintained asset → asset edges
- Neither `dbRegister` was ever called in application code
- Graph data exists in DynamoDB but is stale/empty
- **`fetchImportDefaults` likely failing silently**

### How fetchImportDefaults Works (Incorrectly)

**Current Implementation** (`lambda/assets/fetchImportDefaults/index.ts`):

```typescript
// Line 23 - Fetches asset-level graph
const ancestry = await internalCache.Graph.get(
    importsFromAsset.map(({ assetId }) => (assetId)), 
    'back', 
    { fetchEdges: true }
)

// Line 33 - But operates on component keys!
const standard = await recursiveFetchImports({ 
    assetId, 
    jsonHelper, 
    fullKeys: keys,  // component keys (ROOM#xyz)
    stubKeys: [] 
})
```

**The Mismatch**:
1. Queries for **asset-level** ancestry (`ASSET#abc → ASSET#def`)
2. But needs **component-level** ancestry (`ROOM#xyz → ROOM#abc → ROOM#def`)
3. Asset graph doesn't tell you component inheritance chain
4. With universalKeys, components can be imported cross-asset directly

### Why It Used to "Work"

**Historical Context**:
- Before universalKeys: Components addressed via local keys within asset namespace
- Import: `<Room from=(OtherAsset) key=(MyRoom)>` meant "get from OtherAsset"
- Asset-level graph was sufficient (find asset, remap local key)

**After universalKeys**:
- Components addressable directly: `<Room from=(ROOM#xyz)>`
- Import: `<Room from=(ROOM#xyz)>` means "get this specific component"
- Component ancestry independent of asset boundaries
- **Asset-level graph is architecturally wrong**

## Future Design: Component-Level Graph

### Core Concept

**Store import edges per-component, not per-asset:**

Components don't import *different* components; they import the *same* component as it appears in *different* assets. For example:
- `ROOM#tavern` in `ASSET#DEF` imports from `ROOM#tavern` in `ASSET#ABC`
- This is an asset-pair relationship for component inheritance

```typescript
// Store child→parent asset relationships for each component
{
    AssetId: 'ROOM#tavern',
    DataCategory: 'Meta::Room',
    imports: ['ASSET#DEF::ASSET#ABC', 'ASSET#XYZ::ASSET#ABC'],  // Child asset → Parent asset pairs
    cached: ['ASSET#DEF', 'ASSET#XYZ', 'ASSET#ABC'],  // Which assets contain this component
    // ... other metadata
}
```

**Interpretation:**
- `'ASSET#DEF::ASSET#ABC'` means: `ROOM#tavern` in DEF inherits from `ROOM#tavern` in ABC
- `'ASSET#XYZ::ASSET#ABC'` means: `ROOM#tavern` in XYZ also inherits from `ROOM#tavern` in ABC
- This creates a tree of inheritance relationships for each component universalKey

### Benefits

1. **Accurate ancestry**: Tracks actual component → component imports
2. **Cross-asset imports**: Works naturally with universalKeys
3. **Event-driven updates**: Subscribe to `Component Updated` events
4. **Efficient queries**: Direct component ancestry lookup
5. **Incremental**: Build graph as components are cached

### Implementation Strategy (Phase 2)

**1. Update Component Caching** (`lambda/assets/dataSource/caching/cacheAsset.ts`):

```typescript
// When caching components, extract their imports
await Promise.all(diff._components.map(async (component) => {
    const fileComponent = fileAsset._lookup(component._key)
    
    // Extract component-level imports
    const componentImports = extractImports(fileComponent) // ['ROOM#xyz', 'FEATURE#abc']
    
    await assetDB.optimisticUpdate({
        Key: {
            AssetId: component.universalKey,
            DataCategory: `Meta::${component.tag}`
        },
        updateKeys: ['cached', 'imports'],
        updateReducer: (draft) => {
            // Update cached assets list
            if (!draft.cached.includes(assetId)) {
                draft.cached.push(assetId)
            }
            // Update imports list
            draft.imports = componentImports
        }
    })
}))
```

**2. Update `fetchImportDefaults`**:

```typescript
// Query component-level graph directly
const ancestry = await internalCache.ComponentGraph.get(
    keys,  // ['ROOM#xyz', 'FEATURE#abc']
    'back',
    { fetchEdges: true }
)

// ancestry now contains actual component → component edges
// No asset-level indirection needed
```

**3. Subscribe to Component Updates**:

```typescript
// In mtw.assets DataSource or new graph maintenance service
if (event.type === 'Component Updated') {
    const { component } = event
    const imports = extractImports(component)
    
    // Update graph edges
    await graphUpdate.setEdges([{
        itemId: component.universalKey,
        edges: imports.map(target => ({ target, context: '' })),
        options: { direction: 'back' }
    }])
}
```

### Migration Path

**Phase 1B** (Current):
- ❌ Don't maintain asset-level graph (deprecated pattern)
- ✅ Document that `fetchImportDefaults` is broken
- ✅ Warn that import resolution needs redesign

**Phase 2**:
1. Design component import extraction (from StandardComponent)
2. Add `imports` field to `Meta::${componentTag}` records
3. Update caching flow to maintain component-level edges
4. Rebuild component graph from existing cached components
5. Update `fetchImportDefaults` to use component graph
6. Test import resolution thoroughly

### Temporary Workaround

**If import resolution is critical before Phase 2**:

```typescript
// Naive fallback: Direct component queries (no graph)
async function fetchComponentDefaults(componentId: string): Promise<StandardComponent> {
    const component = await assetDB.getItem({
        Key: { AssetId: componentId, DataCategory: `Meta::${componentId.split('#')[0]}` }
    })
    
    // If component has 'from' field, recursively fetch parent
    if (component.from) {
        const parent = await fetchComponentDefaults(component.from)
        return component.mergeWith(parent)  // Apply inheritance
    }
    
    return component
}
```

**Drawbacks**: No cycle detection, inefficient (N queries), doesn't use graph

## Architectural Notes

### Why Component-Level Is Correct

**Components are the atomic unit of reuse**:
- Players import specific rooms, not entire assets
- `<Room from=(ROOM#tavern)>` - direct component reference
- Component inheritance is component → component
- Assets are just convenient groupings for authoring

**UniversalKeys enable this**:
- Before: Components only addressable within asset namespace
- After: Components globally addressable
- Graph should match the actual dependency structure

### Comparison

```typescript
// WRONG (Asset-level)
ASSET#myDungeon → imports → ASSET#medievalPack
// Doesn't tell you which rooms import which

// RIGHT (Component-level)  
ROOM#myTavern → imports → ROOM#genericTavern
ROOM#myTavern → imports → FEATURE#medievalDecor
// Precise component ancestry
```

## Action Items

**Immediate** (Phase 1B):
- ✅ Document this gap (this file)
- ✅ Add warning comment in `fetchImportDefaults/index.ts`
- ✅ Remove asset-level graph maintenance from `dbRegister`
- ❌ Don't attempt to fix (architectural redesign needed)

**Future** (Phase 2):
- Design component import extraction
- Implement component-level graph storage
- Update `fetchImportDefaults` to use new graph
- Test inheritance resolution
- Remove this documentation after completion

## Related Files

- `lambda/assets/fetchImportDefaults/index.ts` - Current (broken) implementation
- `lambda/assets/dataSource/caching/cacheAsset.ts` - Where components are cached
- `lambda/wml/AGENT.dbRegister.analysis.md` - Analysis of dbRegister deprecation
- `lambda/wml/AGENT.s3storage.migration.catalog.md` - Migration tracking

