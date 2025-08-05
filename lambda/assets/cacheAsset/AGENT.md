# Cache Asset Function

## Overview

The Cache Asset function is the core synchronization mechanism that bridges asset content between S3 files and DynamoDB storage. It operates in parallel with the Ephemera lambda's cacheAsset function during a transitional period where both systems populate their respective tables with similar information as part of the migration from the legacy ephemera-based system to the new asset-based system.

### Core Purpose

The Cache Asset function is responsible for:
- **Asset Table Caching**: Synchronizing component data to the asset table as the new primary store
- **Diff-Based Updates**: Identifying and applying only changed components
- **Character Integration**: Special handling for character components with Ephemera system
- **Cross-Reference Maintenance**: Updating component meta records for efficient queries
- **Event Notification**: Triggering Ephemera system updates for character changes

### Key Concepts

- **Parallel Execution**: Runs concurrently with Ephemera lambda cacheAsset during transition
- **Asset Table Focus**: Handles component data and metadata storage as the new primary store
- **Dual Source Loading**: Retrieves data from both DynamoDB cache and S3 files
- **Diff Analysis**: Compares cached and file data to identify changes
- **Character Events**: Special handling for character components with Ephemera integration
- **Optimistic Updates**: Uses optimistic locking for concurrent access

## Technical Details

### Core Function

```typescript
export const cacheAssetMessage = async ({ 
    payloads, 
    messageBus 
}: { 
    payloads: CacheAssetMessage[], 
    messageBus: MessageBus 
}): Promise<void>
```

**Process Flow**:
1. **Dual Source Loading**: Retrieves asset data from both DynamoDB cache and S3 files
2. **Diff Analysis**: Compares cached data with file data to identify changes
3. **Component Updates**: Updates individual component records in DynamoDB
4. **Meta Updates**: Updates cross-asset component metadata
5. **Character Integration**: Handles character-specific caching for Ephemera system

### Transitional Architecture

The function operates as part of a transitional caching system:

#### Historical Context
- **Legacy System**: Previously, all asset data was cached exclusively in the ephemera table
- **Migration Goal**: Moving toward asset table as the primary content store
- **Transitional State**: Currently populating both tables with similar information
- **Legacy Support**: Ephemera system maintains existing functionality

#### Current State
- **Assets Lambda**: Populates asset table with component data and metadata (new primary store)
- **Ephemera Lambda**: Populates ephemera table with similar component data for legacy support
- **Dual Population**: Both systems cache the same asset information during transition
- **Address Information**: S3 file locations and zone management

### Diff Analysis Process

The function uses a sophisticated diff analysis system to identify only the components that have changed, enabling efficient incremental updates. For detailed information about the diff analysis process, component types, and debugging, see **[AGENT.diff.md](./AGENT.diff.md)**.

**Key Concepts**:
- **Change Detection**: Identifies modified, added, or removed components
- **Incremental Updates**: Applies only necessary changes
- **Component Classification**: Categorizes changes by type
- **Optimization**: Minimizes database operations

### Character Integration

Character components receive special treatment due to their integration with the Ephemera system:

```typescript
const characterChanges = diff._components
    .filter((component): component is StandardRemove | StandardReplace | StandardCharacter => {
        // Filter for character components
    })
```

**Character Events**:
- **Character Removed**: Published when characters are removed from assets
- **Character Updated**: Published when character data changes
- **Ephemera Integration**: Triggers real-time state updates

## Transitional Execution Architecture

### Step Function Orchestration

The `cacheAssets` step function orchestrates parallel execution of both cacheAsset functions during the transitional period:

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
- **Assets Lambda**: Populates asset table with component data and metadata (new primary store)
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

### Current Responsibilities

#### Assets Lambda (New Primary Store)
- **Component Data**: Component definitions and properties
- **Cross-Reference Queries**: Component lookup across assets
- **Meta Records**: Component type metadata and inheritance
- **Address Information**: S3 file locations and zone management

#### Ephemera Lambda (Legacy Support)
- **Legacy Data**: Similar component data for existing functionality
- **Graph Dependencies**: Asset relationship tracking
- **Perception Updates**: Real-time character experience updates
- **Transitional Support**: Maintaining ephemera table during migration

## Integration Points

### Dependencies
- **S3**: File storage for WML and JSON assets
- **DynamoDB**: Asset and ephemera table storage
- **EventBridge**: Character event notifications
- **Internal Cache**: Asset data and component caching
- **Asset Workspace**: S3 file loading and parsing

### Cross-References
- **[Ephemera Cache Asset](../../ephemera/cacheAsset/)**: Parallel caching function
- **[Cache Assets Step Function](../../stepFunctions/cacheAssets.asl.yaml)**: Orchestration
- **[Ephemera System](../../ephemera/)**: Real-time state management
- **[Internal Cache](../internalCache/)**: Caching system architecture
- **[Message Bus](../messageBus/)**: Event system integration

### API Contracts
- **CacheAssetMessage**: Triggers asset caching process
- **EventBridge Events**: Character removed/updated notifications
- **DynamoDB Operations**: Put, delete, and optimistic updates

## Usage Patterns

### Common Scenarios

#### Standard Asset Caching
```typescript
// Trigger caching for an asset
messageBus.send({
    type: 'CacheAsset',
    assetId: 'my-asset-id'
})
```

#### Character Component Handling
```typescript
// Character changes trigger Ephemera events
const characterChanges = diff._components
    .filter((component) => component instanceof StandardCharacter)
// Triggers Character Updated/Removed events
```

#### Cross-Reference Updates
```typescript
// Update component meta records
await assetDB.optimisticUpdate({
    Key: {
        AssetId: component.universalKey,
        DataCategory: `Meta::${component.tag}`
    },
    updateKeys: ['cached'],
    updateReducer: (draft) => {
        // Add asset to cached list
    }
})
```

### Best Practices
1. **Always Check Diff**: Only update when changes are detected
2. **Handle Character Events**: Ensure proper Ephemera integration
3. **Use Optimistic Updates**: Leverage optimistic locking for concurrency
4. **Validate Components**: Check for universalKey before processing

## Error Handling

### Common Issues
- **Missing Universal Keys**: Components without universalKey are skipped
- **File Loading Errors**: Graceful fallback to empty StandardForm
- **Database Errors**: Optimistic update conflicts and retries
- **Character Validation**: Invalid character ID handling

### Recovery Strategies
- **Graceful Degradation**: Skip problematic components
- **Cache Invalidation**: Clear stale cache entries
- **Event Retry**: Retry failed EventBridge notifications
- **Logging**: Comprehensive error logging for debugging

## Development Notes

### Current State
- **Transitional Architecture**: Both tables populated during migration
- **Asset Table**: New primary store for component data and metadata
- **Character Integration**: Complete Ephemera system integration
- **Diff Processing**: Efficient change detection and application
- **Event System**: Robust character event notifications

### Known Limitations
- **Transitional Complexity**: Coordination between two systems during migration
- **Data Redundancy**: Both tables contain similar information during transition
- **Address Dependency**: Requires pre-populated addresses from step function
- **Error Propagation**: Failures can affect both tables
- **Performance**: Dual processing overhead during migration

### Future Development Paths

#### Phase 1: Migration Completion
1. **Legacy Removal**: Complete migration from ephemera table to asset table
2. **Functionality Transfer**: Move all asset caching to asset table
3. **Dependency Cleanup**: Remove ephemera table dependencies
4. **Performance Optimization**: Eliminate dual processing overhead

#### Phase 2: Ephemera System Refocus
1. **State-Only Focus**: Concentrate ephemera on real-time state only
2. **Render Caching**: Establish database caching in the Ephemera lambda
3. **Event Streams**: Implement further event streaming architecture
4. **Performance Optimization**: Optimize for real-time operations

#### Phase 3: Architecture Simplification
1. **Single Source**: Asset table as single source of truth for content
2. **Clear Boundaries**: Distinct responsibilities between systems
3. **Monitoring**: Comprehensive monitoring and alerting

### Migration Strategy
1. **Gradual Transition**: Incremental migration of responsibilities
2. **Backward Compatibility**: Maintain existing functionality
3. **Testing**: Comprehensive testing at each phase
4. **Rollback Plan**: Ability to rollback changes if needed

## Navigation Tips

### Getting Started
1. **Understand Transitional State**: Learn about the migration from ephemera to asset table
2. **Study Diff Process**: Understand how changes are detected, if diff might be relevant to your issue
3. **Review Character Integration**: See how characters are handled
4. **Check Event System**: Understand EventBridge notifications

### Key Files
- `index.ts`: Main caching implementation
- `index.test.ts`: Comprehensive test coverage
- Internal cache files: Caching system integration

### Related Documentation
- **[Assets Lambda README](../README.md)**: Overview of assets system
- **[Ephemera Cache Asset](../../ephemera/cacheAsset/)**: Parallel caching function
- **[Cache Assets Step Function](../../stepFunctions/cacheAssets.asl.yaml)**: Orchestration
- **[Ephemera System](../../ephemera/)**: Real-time state management
- **[Internal Cache](../internalCache/)**: Caching system architecture
- **[Message Bus](../messageBus/)**: Event system integration 