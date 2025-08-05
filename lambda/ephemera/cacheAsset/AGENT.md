# Ephemera Cache Asset Function

## Overview

The Ephemera Cache Asset function is responsible for caching asset data into the `ephemera` DynamoDB table as part of a transitional architecture. It operates in parallel with the Assets lambda's cacheAsset function, where both systems currently populate their respective tables with similar information during the migration from the legacy ephemera-based system to the new asset-based system.

### Core Purpose

The Ephemera Cache Asset function is responsible for:
- **Legacy Support**: Maintaining ephemera table population for existing functionality
- **Transitional Caching**: Storing asset data in ephemera table during migration
- **Graph Structure**: Building dependency graphs between assets and components
- **Perception Updates**: Triggering real-time perception updates for rooms
- **Character Integration**: Handling character-specific ephemera data

### Key Concepts

- **Parallel Execution**: Runs concurrently with Assets lambda cacheAsset
- **Transitional State**: Both tables populated with similar information during migration
- **Legacy Support**: Maintains ephemera table for existing functionality
- **Graph Dependencies**: Tracks relationships between assets and components
- **Perception System**: Triggers real-time updates for character experiences
- **Address Pre-population**: Requires addresses to be loaded in cache first

## Technical Details

### Core Function

```typescript
export const cacheAsset = async ({ 
    assetId, 
    messageBus, 
    check = false, 
    updateOnly = false 
}: CacheAssetArguments): Promise<void>
```

**Process Flow**:
1. **Address Lookup**: Retrieves pre-populated address from internal cache
2. **File Loading**: Loads asset data from S3 using AssetWorkspace
3. **Graph Updates**: Builds dependency relationships between assets
4. **Perception Triggers**: Sends room header updates for real-time display
5. **State Management**: Caches data for dynamic game interactions

### Transitional Architecture

The function operates as part of a transitional caching system:

#### Historical Context
- **Legacy System**: Previously, all asset data was cached exclusively in the ephemera table
- **Migration Goal**: Moving toward asset table as the primary content store
- **Transitional State**: Currently populating both tables with similar information
- **Legacy Support**: Maintaining ephemera table for existing functionality

#### Current State
- **Assets Lambda**: Populates asset table with component data and metadata
- **Ephemera Lambda**: Populates ephemera table with similar component data for legacy support
- **Dual Population**: Both systems cache the same asset information during transition
- **Graph Dependencies**: Ephemera system maintains dependency relationships

### Address Pre-population

The function requires addresses to be pre-populated in the internal cache:

```typescript
const address = await internalCache.AssetAddress.get(assetId)
if (typeof address === 'undefined') {
    return
}
```

**Address Loading**: Addresses are loaded by the step function before parallel execution

### Graph Structure Management

The function builds dependency graphs between assets:

```typescript
const graphUpdate = new GraphUpdate({ 
    internalCache: internalCache._graphCache as any, 
    dbHandler: graphStorageDB 
})

const assets = unique(
    (assetWorkspace.standard?._components ?? [])
        .map((component) => (component._from))
        .filter(excludeUndefined)
)

graphUpdate.setEdges([{
    itemId: AssetKey(assetId),
    edges: assets
        .map((from) => ({ target: from, context: '' })),
    options: { direction: 'back' }
}])
```

**Purpose**:
- **Dependency Tracking**: Maps which assets depend on others
- **Efficient Queries**: Enables fast dependency lookups
- **Update Propagation**: Tracks what needs updating when dependencies change

### Perception System Integration

The function triggers real-time perception updates for rooms:

```typescript
const components = assetWorkspace.standard?._components || []
components
    .filter((item) => (item instanceof StandardRoom))
    .map((room) => (room.universalKey))
    .filter((value): value is EphemeraRoomId => (Boolean(value)))
    .forEach((roomId) => {
        messageBus.send({
            type: 'Perception',
            ephemeraId: roomId,
            header: true
        })
    })
```

**Perception Updates**:
- **Room Headers**: Updates room information for characters
- **Real-Time Display**: Triggers immediate UI updates
- **Character Experience**: Ensures characters see current state

## Transitional Execution Architecture

### Step Function Orchestration

The `cacheAssets` step function orchestrates parallel execution during the transitional period:

```yaml
"Cache All":
    Type: Parallel
    Branches:
        - StartAt: Cache Assets
          States:
              "Cache Assets":
                  Type: Task
                  Resource: "${AssetsFunctionArn}"
                  Parameters:
                      "message": "cacheAsset"
                      "assetId.$": "$.args.assetIds[0]"
        - StartAt: Cache Ephemera
          States:
              "Cache Ephemera":
                  Type: Task
                  Resource: "${EphemeraFunctionArn}"
                  Parameters:
                      "message": "cacheAssets"
                      "assetIds.$": "$.args.assetIds"
                      "addresses.$": "$.args.addresses"
                      "options.$": "$.args.options"
```

**Transitional Execution**:
- **Assets Lambda**: Populates asset table with component data and metadata
- **Ephemera Lambda**: Populates ephemera table with similar data for legacy support
- **Address Resolution**: Shared address lookup for both systems
- **Error Handling**: Decache on failure to maintain consistency

### Coordination Points

#### Address Sharing
- **Step Function**: Resolves addresses before parallel execution
- **Internal Cache**: Pre-populates addresses for both lambdas
- **Consistency**: Ensures both systems use same address data

#### Error Handling
- **Failure Detection**: Step function monitors both branches
- **Decache Strategy**: Removes ephemera data on failure
- **Rollback**: Maintains data consistency across tables

## Integration Points

### Dependencies
- **S3**: File storage for asset data
- **DynamoDB**: Ephemera table storage
- **Internal Cache**: Address and asset data caching
- **Graph Storage**: Dependency relationship management
- **Message Bus**: Perception and event system

### Cross-References
- **[Assets Cache Asset](../assets/cacheAsset/)**: Parallel caching function
- **[Cache Assets Step Function](../../stepFunctions/cacheAssets.asl.yaml)**: Orchestration
- **[Perception System](../perception/)**: Real-time display updates
- **[Graph Storage](../../packages/mtw-utilities/ts/graphStorage/)**: Dependency management

### API Contracts
- **CacheAssetArguments**: Function parameters and options
- **MessageBus**: Perception and event messaging
- **GraphUpdate**: Dependency relationship updates
- **AssetWorkspace**: S3 file loading and parsing

## Usage Patterns

### Common Scenarios

#### Parallel Caching
```typescript
// Called by step function in parallel with Assets lambda
await cacheAsset({
    assetId: 'ASSET#my-room',
    messageBus,
    check: false,
    updateOnly: false
})
```

#### Graph Dependency Updates
```typescript
// Build dependency relationships
const graphUpdate = new GraphUpdate({ 
    internalCache: internalCache._graphCache, 
    dbHandler: graphStorageDB 
})
graphUpdate.setEdges([{
    itemId: AssetKey(assetId),
    edges: assets.map((from) => ({ target: from, context: '' })),
    options: { direction: 'back' }
}])
```

#### Perception Triggers
```typescript
// Trigger real-time room updates
messageBus.send({
    type: 'Perception',
    ephemeraId: roomId,
    header: true
})
```

### Best Practices
1. **Address Pre-population**: Ensure addresses are loaded before execution
2. **Graph Consistency**: Maintain dependency relationships accurately
3. **Perception Updates**: Trigger updates for all affected rooms
4. **Error Handling**: Handle missing addresses gracefully

## Error Handling

### Common Issues
- **Missing Addresses**: Address not pre-populated in cache
- **File Loading Errors**: S3 file access issues
- **Graph Update Failures**: Dependency relationship errors
- **Perception Failures**: Message bus delivery issues

### Recovery Strategies
- **Graceful Degradation**: Skip processing if address missing
- **Retry Logic**: Retry graph updates on failure
- **Message Bus Recovery**: Handle perception message failures
- **Consistency Checks**: Verify data integrity after updates

## Development Notes

### Current State
- **Transitional Architecture**: Both tables populated during migration
- **Legacy Support**: Maintaining ephemera table for existing functionality
- **Graph Management**: Complete dependency tracking
- **Perception Integration**: Real-time update system
- **Address Coordination**: Shared address resolution

### Known Limitations
- **Address Dependency**: Requires pre-populated addresses
- **Transitional Complexity**: Coordination between two systems during migration
- **Data Redundancy**: Both tables contain similar information during transition
- **Performance**: Dual processing overhead during migration
- **Legacy Dependencies**: Still required for existing functionality

### Future Development Paths

#### Phase 1: Migration Completion
1. **Legacy Removal**: Complete migration from ephemera table to asset table
2. **Functionality Transfer**: Move all asset caching to asset table
3. **Dependency Cleanup**: Remove ephemera table dependencies
4. **Performance Optimization**: Eliminate dual processing overhead

#### Phase 2: Ephemera System Refocus
1. **State-Only Focus**: Concentrate ephemera on real-time state only
2. **Render Caching**: Establish database caching in the Ephemera lambda
3. **Perception Enhancement**: Advanced perception system features
4. **Graph Optimization**: Optimize dependency tracking

#### Phase 3: Architecture Simplification
1. **Clear Boundaries**: Distinct responsibilities between systems
2. **Single Source**: Asset table as primary content store
3. **Event Streaming**: Proper event streaming architecture
4. **Monitoring**: Comprehensive system monitoring

## Navigation Tips

### Getting Started
1. **Understand Transitional State**: Learn about the migration from ephemera to asset table
2. **Study Step Function**: See how parallel execution is orchestrated during transition
3. **Review Graph System**: Understand dependency tracking
4. **Check Perception**: See how real-time updates work

### Key Files
- `index.ts`: Main caching implementation
- `mergeIntoEphemera.ts`: Data merging logic
- Step function: Parallel execution orchestration
- Internal cache: Address and data caching

### Related Documentation
- **[Assets Cache Asset](../assets/cacheAsset/)**: Parallel caching function
- **[Cache Assets Step Function](../../stepFunctions/cacheAssets.asl.yaml)**: Orchestration
- **[Perception System](../perception/)**: Real-time display updates
- **[Graph Storage](../../packages/mtw-utilities/ts/graphStorage/)**: Dependency management 