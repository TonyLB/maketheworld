# Cache Asset Diff Analysis

## Overview

The diff analysis process is the core mechanism that determines what changes need to be applied when caching assets. It compares the current cached data with the file data to identify only the components that have changed, enabling efficient incremental updates.

### Core Purpose

The diff analysis is responsible for:
- **Change Detection**: Identifying which components have been modified, added, or removed
- **Incremental Updates**: Applying only the necessary changes to avoid full rewrites
- **Component Classification**: Categorizing changes where needed for DB operations (remove vs update)
- **Optimization**: Minimizing database operations and processing time

## Technical Details

### Diff Analysis Process

```typescript
const diff = dbAsset.diff(fileAsset)
if (diff) {
    await Promise.all(diff._components.map(async (component) => {
        // Process component changes
    }))
}
```

**Process Flow**:
1. **Load Sources**: Retrieve cached data from DynamoDB and file data from S3
2. **Generate Diff**: Compare the two StandardForm objects to identify differences
3. **Classify Changes**: Categorize changes where needed for DB operations (removals vs updates)
4. **Apply Updates**: Process each change type with appropriate database operations
5. **`referencedBy` on main loop**: Each **`diff._components`** entry uses a three-way branch (full put / stub put / delete) and includes authoritative **`referencedBy`** from **`buildReferencedByPatchesForAsset(fileAsset)`**. See [`cacheAsset.ts`](./cacheAsset.ts). [`decacheAsset.ts`](./decacheAsset.ts) uses the same branch structure with **`emptyAsset`** (always branch C **`deleteItem`**; no **`referencedBy`** writes --- row deletion is sufficient).
6. **Stream Events (Unified)**: Stream all component changes as `"Component Updated"` events, and emit `"Component Removed"` events when components are deleted from the asset (branch C only --- edge-only stubs do not emit Component Removed)

### Diff Types

The diff analysis identifies two main categories of component changes for DB operations:

#### Remove
Components that have been removed from the asset:

```typescript
if (!incoming._lookup(component._key.toJSON())) {
    await assetDB.deleteItem({
        AssetId: component.universalKey,
        DataCategory: `ASSET#${assetId}`
    })
}
```

**Characteristics**:
- **Action**: Removes component from database
- **Trigger**: Component no longer exists in file
- **Database**: DELETE operation on component record
- **Meta**: May require cleanup of cross-reference records

#### Updated Component
Components that have been modified:

```typescript
const fileComponent = fileAsset._lookup(component._key)
if (!fileComponent) {
    console.warn(`Component ${component.universalKey} not found in file asset`)
    return
}
await assetDB.putItem({
    ...(fileComponent.toJSON()),
    AssetId: component.universalKey,
    DataCategory: `ASSET#${assetId}`,
})
```

**Characteristics**:
- **Action**: Updates existing component with new data
- **Trigger**: Component properties or structure changed
- **Database**: PUT operation with new component data
- **Validation**: Ensures component exists in file before updating

> Note: Characters are no longer treated specially in this flow. They follow the same unified streaming and cache invalidation rules as all components.

### Component Processing

#### Universal Key Validation
All components must have a valid universalKey to be processed:

```typescript
if (!component.universalKey) {
    return
}
```

**Purpose**:
- **Identification**: Ensures component can be uniquely identified
- **Database**: Required for proper record management
- **Cross-Reference**: Needed for meta record updates
- **Error Prevention**: Skips invalid components gracefully

#### File Component Lookup
For replacement operations, the system looks up the new component data:

```typescript
const fileComponent = fileAsset._lookup(component._key)
if (!fileComponent) {
    console.warn(`Component ${component.universalKey} not found in file asset`)
    return
}
```

**Process**:
- **Lookup**: Searches file asset for component by key
- **Validation**: Ensures component exists before updating
- **Error Handling**: Logs warning and skips if not found
- **Data Extraction**: Gets component data for database update

### Meta Record Updates

For each component change, the system also updates cross-reference meta records:

```typescript
await assetDB.optimisticUpdate({
    Key: {
        AssetId: component.universalKey,
        DataCategory: `Meta::${component.tag}`,    
    },
    updateKeys: ['cached'],
    updateReducer: (draft) => {
        if (!('cached' in draft)) {
            draft.cached = []
        }
        if (!draft.cached.includes(assetId)) {
            draft.cached = [...draft.cached, assetId]
        }
    },
})
```

**Purpose**:
- **Cross-Reference**: Maintains list of assets containing each component
- **Efficient Queries**: Enables fast component lookup across assets
- **Optimistic Updates**: Uses optimistic locking for concurrent access
- **Array Management**: Maintains cached asset list without duplicates

### Unified Streaming and Cache Invalidation

All component changes (including removals) are streamed as `"Component Updated"` events. Component cache is invalidated for all changed components.

```typescript
// Stream all component diffs uniformly
const componentsUpdated = diff._components
    .filter((component) => (!!component.universalKey))
    .map((component) => ({
        type: 'Component Updated' as const,
        assetId,
        component
    }))

await Promise.all(
    componentsUpdated.map((update) => streamEvent({
        update,
        streamKey: assetId,
        detailType: 'Component Updated'
    }))
)

// Invalidate cache for all affected components
diff._components
    .filter((component) => (!!component.universalKey))
    .forEach(({ universalKey }) => {
        if (universalKey) {
            internalCache.ComponentData.invalidate(universalKey)
        }
    })
```

## Error Handling

### Common Issues

#### Missing Universal Keys
Components without universalKey are skipped:

```typescript
if (!component.universalKey) {
    return
}
```

**Recovery**: Graceful skip with no error propagation

#### File Component Not Found
When file component lookup fails:

```typescript
if (!fileComponent) {
    console.warn(`Component ${component.universalKey} not found in file asset`)
    return
}
```

**Recovery**: Log warning and skip component update

#### Database Errors
Optimistic update conflicts and retries:

```typescript
await assetDB.optimisticUpdate({
    // ... update configuration
})
```

**Recovery**: Optimistic locking handles concurrent access

### Recovery Strategies

#### Graceful Degradation
- **Skip Invalid Components**: Continue processing other components
- **Log Warnings**: Provide debugging information
- **No Error Propagation**: Prevent cascade failures

#### Cache Invalidation
- **Clear Stale Data**: Invalidate cached character data
- **Force Refresh**: Trigger reload of problematic components
- **Consistency**: Ensure cache matches database state

## Performance Considerations

### Optimization Strategies

#### Incremental Processing
- **Diff-Based**: Only process changed components
- **Parallel Execution**: Process multiple components concurrently
- **Batch Operations**: Group related database operations

#### Database Efficiency
- **Optimistic Updates**: Reduce lock contention
- **Projection Fields**: Only retrieve needed data
- **Index Usage**: Leverage efficient query patterns

#### Memory Management
- **Streaming**: Process large assets without loading everything
- **Cache Management**: Clear invalidated cache entries
- **Garbage Collection**: Allow cleanup of temporary objects

## Debugging

### Common Debugging Scenarios

#### Component Not Updating
1. **Check Universal Key**: Ensure component has valid universalKey
2. **Verify File Component**: Confirm component exists in file
3. **Check Diff**: Verify diff detects the change
4. **Database Logs**: Review database operation logs

#### Component Events Not Firing
1. **Verify Universal Key**: Ensure components have `universalKey`
2. **Check EventBridge**: Verify event publishing
3. **Review Cache**: Check `ComponentData` invalidation
4. **Upstream Diff**: Confirm the diff contains expected components

#### Performance Issues
1. **Diff Analysis**: Check if diff is processing too many components
2. **Database Operations**: Review database operation patterns
3. **Cache Efficiency**: Verify cache hit rates
4. **Concurrency**: Check for lock contention

### Debugging Tools

#### Logging
- **Component Processing**: Log each component being processed
- **Diff Results**: Log diff analysis results
- **Database Operations**: Log all database operations
- **Event Publishing**: Log EventBridge events

#### Monitoring
- **Processing Time**: Monitor diff analysis duration
- **Database Operations**: Track database operation counts
- **Cache Performance**: Monitor cache hit/miss rates
- **Error Rates**: Track component processing errors

## Component tags and `Meta::` records

**`cacheAsset`** persists each changed component with `AssetId = <universalKey>` (e.g. `AREA#...`, `ROOM#...`) and updates cross-reference meta with `DataCategory: Meta::${component.tag}` (e.g. `Meta::Area`, `Meta::Room`). There is **no** separate registry for **Area** — it follows the same diff/put/delete path as Room, Map, and other `StandardComponent` tags once present in a `StandardForm`.

**Not Area-aware today (intentional):** `lambda/assets/componentExamples` branches on Room/Feature/Knowledge/Situation only; ephemera render and dependency tag unions exclude Area until play/UI work lands. **`SchemaImportMapping`** includes `Area`; charcoal-client import UI lists and imports Area components. **`fetchImports`** subset cascade for Area topology edges is still out of scope until topology milestone work lands.

## Related Documentation

- **[Cache Asset AGENT.md](./AGENT.md)**: Main cache asset documentation
- **[Assets Lambda README](../README.md)**: Overview of assets system
- **[Ephemera System](../../ephemera/)**: Real-time state management
- **[Internal Cache](../internalCache/)**: Caching system architecture 