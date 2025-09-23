# WML S3 Storage Architecture - Agent Navigation Guide

## Overview

The WML Lambda manages S3 storage for all asset content files, including WML source files, NDJSON parsed representations, and associated metadata. The storage architecture currently uses zone-based folder organization but is evolving toward a metadata-driven approach that separates domain concepts from storage implementation.

### Core Purpose

The WML Lambda is responsible for:
- **Content Storage Management**: Organizing and storing WML files, NDJSON representations, and authorization data in S3
- **Zone-Based Organization**: Managing asset placement based on access zones (Canon, Library, Personal, Draft, Archive)
- **File Lifecycle Management**: Handling asset creation, updates, moves, and archival operations
- **Storage Abstraction**: Providing consistent interfaces for asset file operations regardless of underlying organization

### Key Concepts

- **Asset Workspace**: Unified interface for managing asset files across different zones and storage patterns
- **Zone-Based Storage**: Current folder organization that maps zone concepts to S3 directory structure
- **Metadata-Driven Storage**: Future approach using S3 object metadata to encode zone and organizational information
- **File Pairs**: Each asset consists of paired WML source and NDJSON parsed representations
- **Authorization Separation**: Separate storage for content vs. authorization data to enable independent updates

## Current S3 Storage Schema

### Zone-Based Folder Organization

The current storage system organizes files using zone-based folder structures:

```
S3 Bucket Structure:
├── Canon/
│   ├── primitives.wml
│   ├── primitives.ndjson
│   ├── primitives.auth.wml
│   ├── primitives.auth.ndjson
│   └── [other-canon-assets]/
│       ├── asset.wml
│       ├── asset.ndjson
│       ├── asset.auth.wml
│       └── asset.auth.ndjson
├── Library/
│   ├── [asset-name].wml
│   ├── [asset-name].ndjson
│   ├── [asset-name].auth.wml
│   └── [asset-name].auth.ndjson
└── Personal/
    └── [player-name]/
        ├── Assets/
        │   ├── [asset-name].wml
        │   ├── [asset-name].ndjson
        │   ├── [asset-name].auth.wml
        │   └── [asset-name].auth.ndjson
        └── Characters/
            ├── [character-name].wml
            ├── [character-name].ndjson
            ├── [character-name].auth.wml
            └── [character-name].auth.ndjson
```

### File Naming Conventions

#### Standard Assets
- **WML Source**: `{asset-name}.wml`
- **NDJSON Parsed**: `{asset-name}.ndjson`
- **Authorization WML**: `{asset-name}.auth.wml`
- **Authorization NDJSON**: `{asset-name}.auth.ndjson`

#### Special Cases
- **Draft Assets**: Always named `draft.wml`, `draft.ndjson`, etc.
- **Archive Assets**: No files stored (metadata only in DynamoDB)
- **Global Assets**: Special handling for system-wide assets like `primitives`

### Zone-Specific Path Generation

The `AssetWorkspace` class generates S3 paths based on zone and organizational metadata:

```typescript
// Canon Zone: Canon/{subFolder}/asset.wml
// Library Zone: Library/{subFolder}/asset.wml  
// Personal Zone: Personal/{player}/{subFolder}/asset.wml
// Draft Zone: Personal/{player}/Assets/draft.wml
// Archive Zone: (no S3 files, metadata only)
```

## File Types and Formats

### WML Source Files
- **Format**: Human-readable XML markup language
- **Purpose**: Original source content for assets
- **Encoding**: UTF-8 text
- **Validation**: Must conform to WML schema and syntax rules

### NDJSON Parsed Files
- **Format**: Newline-delimited JSON (one JSON object per line)
- **Purpose**: Machine-readable parsed representation of WML content
- **Encoding**: UTF-8 text
- **Usage**: Direct consumption by caching systems and database operations

### Authorization Files
- **WML Format**: `{asset-name}.auth.wml` - Human-readable authorization rules
- **NDJSON Format**: `{asset-name}.auth.ndjson` - Machine-readable authorization data
- **Purpose**: Separate storage for access control and permission information
- **Update Frequency**: Independent of content files, updated separately

## Current Implementation Details

### AssetWorkspace File Operations

The `AssetWorkspace` class provides unified file operations:

```typescript
// Loading operations
await assetWorkspace.loadWML()        // Load WML source
await assetWorkspace.loadJSON()       // Load NDJSON parsed data
await assetWorkspace.loadAuthorizationWML()  // Load auth WML
await assetWorkspace.loadAuthorizationJSON() // Load auth NDJSON

// Saving operations  
await assetWorkspace.pushWML()        // Save WML source
await assetWorkspace.pushJSON()       // Save NDJSON parsed data
await assetWorkspace.pushAuthorizationWML()  // Save auth WML
await assetWorkspace.pushAuthorizationJSON() // Save auth NDJSON
```

### Zone-Specific Behavior

#### Draft Zone
- **File Names**: Always `draft.wml`, `draft.ndjson`
- **Path**: `Personal/{player}/Assets/`
- **Purpose**: Temporary workspace for content under development
- **Lifecycle**: Converted to proper asset names when promoted

#### Archive Zone
- **S3 Files**: None stored (content removed from S3)
- **Metadata**: Preserved in DynamoDB with backup references
- **Purpose**: Long-term storage for deprecated assets
- **Recovery**: Content can be restored from backup references

#### Personal Zone
- **Organization**: `Personal/{player}/{subFolder}/`
- **Access**: Player-specific content and shared story assets
- **Subfolders**: `Assets/`, `Characters/`, custom organizational folders

#### Library Zone
- **Organization**: `Library/{subFolder}/`
- **Access**: Community-shared content requiring explicit access
- **Subfolders**: Organizational structure for community content

#### Canon Zone
- **Organization**: `Canon/{subFolder}/`
- **Access**: Universally available system content
- **Special Assets**: System primitives and core game elements

## Future S3 Storage Schema

### Metadata-Driven Organization

The planned evolution moves from folder-based zones to metadata-driven organization:

```
S3 Bucket Structure (Future):
├── assets/
│   ├── asset-001.wml (metadata: zone=Canon, subFolder=primitives)
│   ├── asset-001.ndjson (metadata: zone=Canon, subFolder=primitives)
│   ├── asset-001.auth.wml (metadata: zone=Canon, subFolder=primitives)
│   ├── asset-001.auth.ndjson (metadata: zone=Canon, subFolder=primitives)
│   ├── asset-002.wml (metadata: zone=Library, subFolder=adventures)
│   ├── asset-002.ndjson (metadata: zone=Library, subFolder=adventures)
│   ├── asset-003.wml (metadata: zone=Personal, player=bob, subFolder=characters)
│   └── asset-003.ndjson (metadata: zone=Personal, player=bob, subFolder=characters)
└── backups/
    ├── backup-001.tar.gz (metadata: originalAsset=asset-003, archivedDate=2024-01-01)
    └── backup-002.tar.gz (metadata: originalAsset=asset-002, archivedDate=2024-01-02)
```

### Benefits of Metadata-Driven Approach

#### Implementation Flexibility
- **Zone Evolution**: Zone concepts can evolve without changing file organization
- **Storage Optimization**: Files can be organized for performance rather than business logic
- **Multi-Zone Assets**: Assets can exist in multiple zones simultaneously
- **Conditional Access**: Time-based or context-dependent zone membership

#### Domain Separation
- **Clean Boundaries**: Zone concepts separated from storage implementation
- **Event-Driven Changes**: Zone transitions handled through metadata updates
- **Independent Evolution**: Storage and business logic can evolve separately
- **Testing Isolation**: Zone logic can be tested independently of file operations

#### Operational Benefits
- **Atomic Operations**: Zone changes become metadata updates rather than file moves
- **Audit Trail**: Metadata changes provide clear history of zone transitions
- **Backup Simplification**: Consistent file organization simplifies backup strategies
- **Performance Optimization**: Flat structure improves S3 operation performance

## Integration Points

### Dependencies
- **Asset Workspace Package**: Core file operations and zone-aware path generation
- **S3 Client**: Direct S3 operations for file storage and retrieval
- **WML Parser**: Content validation and transformation between WML and NDJSON
- **Authorization System**: Separate storage and management of access control data

### Cross-References
- **[Asset Zones Documentation](../AGENT.zones.md)**: Zone concepts and access control patterns
- **[Assets Lambda](../assets/README.md)**: Integration with asset caching and metadata management
- **[Event Architecture](../../AGENT.architecture.events.md)**: Event-driven zone transition patterns

### API Contracts

The WML Lambda provides file storage and zone management operations through the AssetWorkspace interface and event-driven communication with other system components. Specific API implementations will be designed during the migration to metadata-driven storage architecture.

## Usage Patterns

### Common Scenarios

#### Asset Creation
```typescript
// Create new asset in Personal zone
const workspace = new AssetWorkspace({
    zone: 'Personal',
    player: 'alice',
    fileName: 'my-adventure',
    subFolder: 'adventures'
})
await workspace.setWML('<Asset key="my-adventure">...</Asset>')
await workspace.pushWML()
await workspace.pushJSON()
```

#### Zone Promotion
```typescript
// Move asset from Personal to Library zone
const fromAddress = { zone: 'Personal', player: 'alice', fileName: 'my-adventure' }
const toAddress = { zone: 'Library', fileName: 'my-adventure', subFolder: 'community' }
await moveAsset(fromAddress, toAddress)
```

#### Asset Archival
```typescript
// Archive asset and create backup
const backupId = await createBackup(assetAddress)
await archiveAsset(assetAddress, backupId)
// Files removed from S3, metadata preserved in DynamoDB
```

### Best Practices

#### File Organization
- **Consistent Naming**: Use descriptive, URL-safe asset names
- **Subfolder Structure**: Organize related assets in logical subfolders
- **Authorization Separation**: Keep content and authorization files synchronized
- **Backup Strategy**: Regular backups before major zone transitions

#### Zone Management
- **Atomic Transitions**: Ensure zone changes complete fully or not at all
- **Event Publishing**: Always publish events when zone changes occur
- **Metadata Consistency**: Keep S3 metadata and DynamoDB records synchronized
- **Access Validation**: Verify zone transitions don't violate access control rules

#### Error Handling
- **Graceful Degradation**: Handle missing files with appropriate fallbacks
- **Conflict Resolution**: Detect and resolve concurrent modification conflicts
- **Recovery Procedures**: Implement rollback mechanisms for failed operations
- **Monitoring**: Track file operations and zone transitions for debugging

## Navigation Tips

### Getting Started
1. **Understand Zones**: Review [Asset Zones Documentation](../AGENT.zones.md) for zone concepts
2. **Explore AssetWorkspace**: Start with `packages/mtw-asset-workspace/ts/readOnly.ts` for core file operations
3. **Study Current Implementation**: Examine `lambda/wml/parseWML.ts` for typical usage patterns
4. **Review Event Flow**: Check [Event Architecture](../../AGENT.architecture.events.md) for integration patterns

### Key Files
- **Core Implementation**: `packages/mtw-asset-workspace/ts/readOnly.ts` - AssetWorkspace class and file operations
- **WML Operations**: `lambda/wml/parseWML.ts` - Main WML processing and file management
- **Zone Transitions**: `lambda/wml/copyWML/index.ts` - Asset copying and zone movement
- **Backup Operations**: `lambda/wml/backupWML/index.ts` - Asset archival and backup creation

### Related Documentation
- **[WML Language System](../../packages/mtw-wml/ts/AGENT.md)**: WML syntax and parsing details
- **[Assets System](../assets/README.md)**: Integration with asset caching and metadata
- **[System Architecture](../../AGENT.architecture.events.md)**: Overall event-driven architecture

## Development Notes

### Current State
- **Zone-Based Organization**: Fully implemented and operational
- **File Pair Management**: WML/NDJSON pairs working correctly
- **Authorization Separation**: Auth files stored and managed independently
- **Backup System**: Archive zone with backup references functional

### Future Plans
- **Metadata-Driven Storage**: Migration from folder-based to metadata-driven organization
- **Enhanced Zone Support**: More sophisticated zone concepts (time-based, conditional)
- **Performance Optimization**: Flat file structure for improved S3 operations
- **Multi-Zone Assets**: Support for assets existing in multiple zones simultaneously

### Technical Debt
- **Shared Zone Authority**: Both WML and Assets lambdas currently manage zone information
- **Folder-Dependent Logic**: Zone concepts tightly coupled to S3 folder structure
- **Migration Complexity**: Moving to metadata-driven approach requires careful coordination
- **Testing Coverage**: Zone transition scenarios need more comprehensive testing

### Known Issues
- **Content Removed Events**: Missing implementation for asset deletion events
- **Concurrent Modifications**: Limited conflict resolution for simultaneous updates
- **Backup Recovery**: Archive zone restoration process needs improvement
- **Zone Validation**: Insufficient validation of zone transition rules

The S3 storage architecture is evolving from a zone-based folder organization toward a more flexible metadata-driven approach that separates domain concepts from storage implementation, enabling cleaner domain boundaries and more sophisticated zone management capabilities.
