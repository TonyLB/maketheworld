---
---

# Asset Manager Lambda

## Overview

The Assets Lambda manages the storage, caching, and retrieval of long-duration Assets that define the structure of the game world. It serves as the primary content management system for the Make The World platform, handling asset metadata, component data, and S3 file coordination.

### Core Purpose

The Assets Lambda is responsible for:
- **Asset Storage Management**: Coordinating between DynamoDB metadata and S3 file storage
- **Caching System**: Maintaining denormalized component data for efficient queries
- **Content Distribution**: Managing asset access across Personal, Library, and Canon zones
- **Secure Passthrough**: Acting as a gatekeeper for other microservices

### Key Concepts

- **Asset**: A WML-formatted content unit containing components, maps, and other game elements
- **Component**: Individual game elements (rooms, features, characters) within an asset
- **AssetUUID**: Unique identifier for an asset (format: `ASSET#${string}`)
- **ComponentUUID**: Unique identifier for a component (format: `ROOM#${string}`, `FEATURE#${string}`, etc.)
- **DataCategory**: Determines the semantic level of data storage in DynamoDB

## DynamoDB Table Structure

The assets table uses a compound key system with `AssetId` and `DataCategory` fields to organize data at different semantic levels:

### Meta::Asset Records (Root Level)
- **AssetId**: `ASSET#${string}` (AssetUUID)
- **DataCategory**: `Meta::Asset`
- **Purpose**: Root metadata for an asset containing S3 address information
- **Key Data**:
  - `address`: S3 location information for the asset's source files (resolved by the Assets Lambda and WML Lambda using zone metadata and **Asset Workspace** utilities; see [Asset Workspace](../../packages/mtw-asset-workspace/) and WML S3 storage)
  - `fileName`: Base filename for WML and JSON files
  - `zone`: Access zone ('Personal', 'Library', 'Canon', 'Draft', 'Archive')
  - `player`: Owner player ID (for personal assets)
  - `subFolder`: Optional subfolder path
  - `namespaceMap`: WML namespace mapping data

### Component Records (Asset-Specific Level)
- **AssetId**: `ROOM#${string}`, `FEATURE#${string}`, etc. (ComponentUUID)
- **DataCategory**: `ASSET#${string}` (AssetUUID)
- **Purpose**: Component data as expressed within a specific asset
- **Key Data**:
  - Component-specific attributes and properties
  - Inherited values and overrides
  - Component metadata and relationships

### Component Meta Records (Cross-Asset Level)
- **AssetId**: `ROOM#${string}`, `FEATURE#${string}`, etc. (ComponentUUID)
- **DataCategory**: `Meta::${componentType}` (e.g., `Meta::Room`, `Meta::Feature`)
- **Purpose**: Cross-asset component metadata for efficient range queries
- **Key Data**:
  - `cached`: Array of asset IDs where this component appears
  - Component type metadata
  - Inheritance chain information

## Core Functions

### cacheAsset
The primary caching function that synchronizes asset data between S3 files and DynamoDB:

```typescript
export const cacheAssetMessage = async ({ 
    payloads, 
    messageBus 
}: { 
    payloads: CacheAssetMessage[], 
    messageBus: MessageBus 
}): Promise<void>
```

**Process**:
1. **Dual Source Loading**: Retrieves asset data from both DynamoDB cache and S3 files
2. **Diff Analysis**: Compares cached data with file data to identify changes
3. **Component Updates**: Updates individual component records in DynamoDB
4. **Meta Updates**: Updates cross-asset component metadata
5. **Character Integration**: Handles character-specific caching for Ephemera system

**Key Features**:
- **Optimistic Updates**: Uses optimistic locking for concurrent access
- **Incremental Updates**: Only updates changed components
- **Cross-Reference Maintenance**: Updates component meta records for efficient queries
- **Character Event Integration**: Triggers Ephemera system updates for character changes

### decacheAsset
Removes asset data from the caching system:

```typescript
export const decacheAssetMessage = async ({ 
    payloads, 
    messageBus 
}: { 
    payloads: DecacheAssetMessage[], 
    messageBus: MessageBus 
}): Promise<void>
```

**Process**:
1. **Component Removal**: Deletes all component records for the asset
2. **Meta Cleanup**: Removes asset references from component meta records
3. **Cache Invalidation**: Clears internal cache entries

## Internal Cache System

The lambda uses a sophisticated caching system with multiple specialized caches:

### AssetData Cache
- **Purpose**: Caches parsed StandardForm representations of assets
- **Key**: `ASSET#${string}`
- **Data**: StandardForm objects containing asset structure

### AssetMetaData Cache
- **Purpose**: Caches asset metadata and zone information
- **Key**: `ASSET#${string}` (AssetUUID)
- **Data**: AssetId, zone ('Canon' | 'Library' | 'Personal'), player (for Personal zone), cached status
- **Phase 1B**: Simplified from AssetWorkspaceAddress to direct zone/player storage

### ComponentData Cache
- **Purpose**: Caches individual component data for efficient retrieval
- **Key**: ComponentUUID
- **Data**: Component-specific attributes and properties

## Integration Points

### Dependencies
- **S3**: File storage for WML and JSON assets
- **DynamoDB**: Metadata and component data storage
- **EventBridge**: System event notifications
- **WML Lambda**: Content parsing and validation
- **Ephemera Lambda**: Real-time game state updates
- **Asset address resolution**: S3 paths and zone-based addressing are resolved within the Assets Lambda and WML Lambda using DynamoDB Meta::Asset records and the **Asset Workspace** package; there is no separate address-lookup service

### Cross-References
- **[WML System](../wml/)**: Content parsing and standardization (and S3 storage layout)
- **[Ephemera System](../ephemera/)**: Real-time state management
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: File management and S3 address resolution (ReadOnlyAssetWorkspace, etc.)

### API Contracts
- **CacheAssetMessage**: Triggers asset caching process
- **DecacheAssetMessage**: Triggers asset removal process
- **AssetAPIMessage**: Direct API calls for asset operations

## Usage Patterns

### Common Scenarios

#### Asset Upload and Caching
```typescript
// Upload asset to S3
const uploadResult = await s3Client.upload(file)

// Trigger caching
messageBus.send({
    type: 'CacheAsset',
    assetId: 'my-asset-id'
})
```

**Note**: Asset addresses (S3 paths, zone, and file layout) are resolved using DynamoDB Meta::Asset records and the **Asset Workspace** utilities within this lambda and the WML lambda; zone and draft metadata are stored in the assets table and used when loading or writing asset files.

#### Component Range Queries
```typescript
// Query all appearances of a component across assets
const componentRecords = await assetDB.query({
    Key: { DataCategory: 'ASSET#asset-id' },
    IndexName: 'DataCategoryIndex'
})
```

#### Cross-Asset Component Lookup
```typescript
// Find all assets containing a specific component
const metaRecord = await assetDB.getItem({
    Key: {
        AssetId: 'ROOM#room-id',
        DataCategory: 'Meta::Room'
    }
})
```

### Best Practices
1. **Always Cache After Upload**: Ensure new assets are cached immediately
2. **Use Optimistic Updates**: Leverage the optimistic locking system for concurrent access
3. **Monitor Cache Performance**: Watch for cache invalidation patterns
4. **Handle Character Changes**: Ensure character updates trigger Ephemera events

## Error Handling

### Common Issues
- **S3 File Not Found**: Graceful fallback to empty StandardForm
- **DynamoDB Consistency**: Use eventually consistent reads with fallback
- **Cache Invalidation**: Automatic cleanup of stale cache entries
- **Concurrent Updates**: Optimistic locking prevents conflicts

### Recovery Strategies
- **Self-Healing**: Assets can be reconstructed from S3 files
- **Cache Refresh**: Force cache invalidation for problematic assets
- **Backup Restoration**: Use backup entries for data recovery

## Development Notes

### Current State
- **Cache System**: Fully functional with optimistic updates
- **Character Integration**: Complete integration with Ephemera system
- **S3 Coordination**: Robust file management with WML/JSON pairs
- **Cross-Reference Queries**: Efficient component lookup across assets

### Known Limitations
- **Cache Size**: Large assets may impact memory usage
- **Concurrent Access**: High concurrency may require cache tuning
- **S3 Latency**: File operations can introduce delays

### Future Improvements
1. **Cache Optimization**: Implement more sophisticated cache eviction
2. **Batch Operations**: Improve performance for bulk operations
3. **Monitoring**: Add comprehensive metrics and alerting
4. **Compression**: Implement data compression for large assets

## Navigation Tips

### Getting Started
1. **Start with cacheAsset**: Understand the core caching logic
2. **Review Internal Cache**: Study the caching system architecture
3. **Examine Table Structure**: Understand the DynamoDB schema
4. **Check Integration**: See how assets connect to other systems

### Key Files
- `cacheAsset/index.ts`: Core caching implementation
- `internalCache/`: Caching system architecture
- `app.ts`: Main lambda handler
- `messageBus/`: Event system integration

### Related Documentation
- **[Asset Zones](../wml/AGENT.zones.md)**: Zone system concepts and access patterns (WML lambda is zone authority)
- **[WML System](../wml/)**: Content format and parsing
- **[Ephemera System](../ephemera/)**: Real-time state management
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: File utilities
- **[Event Flow Documentation](AGENT.event.md)**: Event processing patterns and flow analysis (planned documentation)
