# Assets Data Source Caching Functions

## Overview

The Assets Data Source Caching module provides the core synchronization mechanism that bridges asset content between S3 files and DynamoDB storage. These functions are now integrated into the `mtw.assets` data source and are triggered by incoming `mtw.wml` events, replacing the legacy Step Function orchestration approach.

### Core Purpose

The caching functions are responsible for:
- **Asset Table Caching**: Synchronizing component data to the asset table as the new primary store
- **Diff-Based Updates**: Identifying and applying only changed components
- **Character Integration**: Special handling for character components with Ephemera system
- **Cross-Reference Maintenance**: Updating component meta records for efficient queries
- **Event Notification**: Triggering Ephemera system updates for character changes
- **Asset Removal**: Cleaning up cached data when assets are removed

### Key Concepts

- **Event-Driven Architecture**: Functions are triggered by `mtw.wml` events from the WML data source
- **Asset Table Focus**: Handles component data and metadata storage as the new primary store
- **Dual Source Loading**: Retrieves data from both DynamoDB cache and S3 files
- **Diff Analysis**: Compares cached and file data to identify changes
- **Character Events**: Special handling for character components with Ephemera integration
- **Optimistic Updates**: Uses optimistic locking for concurrent access

## Technical Details

### Core Functions

#### `cacheAsset(assetId: string): Promise<void>`

**Process Flow**:
1. **Dual Source Loading**: Retrieves asset data from both DynamoDB cache and S3 files
2. **Diff Analysis**: Compares cached data with file data to identify changes
3. **Component Updates**: Updates individual component records in DynamoDB
4. **Meta Updates**: Updates cross-asset component metadata
5. **Character Integration**: Handles character-specific caching for Ephemera system

#### `decacheAsset(assetId: string): Promise<void>`

**Process Flow**:
1. **Component Discovery**: Queries for all components associated with the asset
2. **Component Removal**: Deletes component records from DynamoDB
3. **Meta Updates**: Removes asset from component metadata cached lists
4. **Cleanup**: Removes empty meta records when no assets remain

### Data Source Integration

The caching functions are integrated into the `mtw.assets` data source and are triggered by:

#### Event Triggers
- **Content Update Events**: From `mtw.wml` data source when assets are modified
- **Content Removed Events**: From `mtw.wml` data source when assets are removed or deleted
- **Legacy Step Function Calls**: For backward compatibility during transition

#### Event Processing
```typescript
// In dataSource/index.ts receiveEvents method
if (eventData.source === 'mtw.wml' && eventData.detailType === 'Content Update') {
    const { AssetId } = eventData.detail
    await cacheAsset(AssetId.replace('ASSET#', ''))
    // Stream event for real-time subscribers
    await streamEvent({
        update: { type: 'CacheAsset', assetId: AssetId.replace('ASSET#', '') },
        streamKey: AssetId,
        detailType: 'Asset Cached'
    })
}

if (eventData.source === 'mtw.wml' && eventData.detailType === 'Content Removed') {
    const { AssetId } = eventData.detail
    await decacheAsset(AssetId.replace('ASSET#', ''))
    // Stream event for real-time subscribers
    await streamEvent({
        update: { type: 'DecacheAsset', assetId: AssetId.replace('ASSET#', '') },
        streamKey: AssetId,
        detailType: 'Asset Decached'
    })
}
```

### Transitional Architecture

The functions operate as part of a transitional caching system:

#### Historical Context
- **Legacy System**: Previously, all asset data was cached exclusively in the ephemera table
- **Migration Goal**: Moving toward asset table as the primary content store
- **Transitional State**: Currently populating both tables with similar information
- **Legacy Support**: Ephemera system maintains existing functionality

#### Current State
- **Assets Lambda**: Populates asset table with component data and metadata (new primary store)
- **Ephemera Lambda**: Populates ephemera table with similar component data for legacy support
- **Dual Population**: Both systems cache the same asset information during transition
- **Event-Driven**: Functions now triggered by WML events instead of Step Functions

### Diff Analysis Process

The `cacheAsset` function uses a sophisticated diff analysis system to identify only the components that have changed, enabling efficient incremental updates. For detailed information about the diff analysis process, component types, and debugging, see **[AGENT.diff.md](./AGENT.diff.md)**.

**Key Concepts**:
- **Change Detection**: Identifies modified, added, or removed components
- **Incremental Updates**: Applies only necessary changes
- **Component Classification**: Categorizes changes by type
- **Optimization**: Minimizes database operations

### Character Integration

Character components receive special treatment due to their integration with the Ephemera system:

**Character Events**:
- **Character Removed**: Published when characters are removed from assets
- **Character Updated**: Published when character data changes
- **Ephemera Integration**: Triggers real-time state updates

## Integration Points

### Dependencies
- **S3**: File storage for WML and JSON assets
- **DynamoDB**: Asset and ephemera table storage
- **EventBridge**: Character event notifications
- **Internal Cache**: Asset data and component caching
- **Asset Workspace**: S3 file loading and parsing
- **WML Data Source**: Event triggers for content updates

### Cross-References
- **[Assets Data Source](../index.ts)**: Main data source integration
- **[Ephemera Cache Asset](../../../ephemera/cacheAsset/)**: Parallel caching function
- **[Cache Assets Step Function](../../../../stepFunctions/cacheAssets.asl.yaml)**: Legacy orchestration
- **[Ephemera System](../../../ephemera/)**: Real-time state management
- **[Internal Cache](../../internalCache/)**: Caching system architecture
- **[Message Bus](../../messageBus/)**: Event system integration

### API Contracts
- **EventBridge Events**: Character removed/updated notifications
- **DynamoDB Operations**: Put, delete, and optimistic updates
- **WML Events**: Content update triggers

## Usage Patterns

### Common Scenarios

#### Event-Driven Asset Caching
```typescript
// Triggered automatically by mtw.wml Content Update events
// No direct calls needed - handled by data source
```

#### Legacy Step Function Support
```typescript
// For backward compatibility during transition
messageBus.send({
    type: 'StreamingEvent',
    dataSourceKey: 'mtw.assets',
    event: {
        source: 'mtw.wml',
        detailType: 'Content Update',
        detail: { AssetId: `ASSET#${assetId}` }
    }
})
```

#### Character Component Handling
```typescript
// Character changes trigger Ephemera events automatically
const characterChanges = diff._components
    .filter((component) => component instanceof StandardCharacter)
// Triggers Character Updated/Removed events
```

### Best Practices
1. **Event-Driven**: Let the data source handle event processing
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
- **Event-Driven Architecture**: Functions triggered by WML events
- **Asset Table**: New primary store for component data and metadata
- **Character Integration**: Complete Ephemera system integration
- **Diff Processing**: Efficient change detection and application
- **Event System**: Robust character event notifications

### Known Limitations
- **Transitional Complexity**: Coordination between two systems during migration
- **Data Redundancy**: Both tables contain similar information during transition
- **Legacy Support**: Still supporting Step Function calls during transition
- **Error Propagation**: Failures can affect both tables

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
1. **Understand Event-Driven Flow**: Learn how WML events trigger caching
2. **Study Diff Process**: Understand how changes are detected
3. **Review Character Integration**: See how characters are handled
4. **Check Event System**: Understand EventBridge notifications

### Key Files
- `cacheAsset.ts`: Main caching implementation
- `decacheAsset.ts`: Asset removal implementation
- `index.ts`: Module exports
- `AGENT.diff.md`: Detailed diff analysis documentation

### Related Documentation
- **[Assets Lambda README](../../README.md)**: Overview of assets system
- **[Assets Data Source](../index.ts)**: Data source integration
- **[Ephemera Cache Asset](../../../ephemera/cacheAsset/)**: Parallel caching function
- **[Cache Assets Step Function](../../../../stepFunctions/cacheAssets.asl.yaml)**: Legacy orchestration
- **[Ephemera System](../../../ephemera/)**: Real-time state management
- **[Internal Cache](../../internalCache/)**: Caching system architecture
- **[Message Bus](../../messageBus/)**: Event system integration
