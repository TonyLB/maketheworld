# WML Lambda - MoveAsset Functionality

## Overview

**Purpose**: The `moveAsset` functionality handles the movement of asset files between different zones within the WML system, managing S3 file operations and zone transitions.

**Context**: This component is part of the WML lambda's dataSource system, responsible for processing internal `moveAssets` events and coordinating file operations across zone boundaries.

**Key Concepts**: Asset zones define access and visibility boundaries for content, with different zones serving different purposes (Canon, Library, Personal, Draft, Archive).

## Core Purpose

**Primary Function**: Move asset files between zones while maintaining data integrity and proper file organization.

**Key Responsibilities**:
- Validate asset state before moving
- Handle S3 file operations (copy/delete)
- Manage zone-specific transitions
- Provide appropriate success/error responses

## Technical Details

**Data Structures**:
- `MoveAssetRequest`: Input parameters for asset movement
- `MoveAssetResponse`: Result of the move operation
- `AssetWorkspaceAddress`: Zone and file location information

**Core Methods**:
- `moveAsset()`: Main orchestration function
- `buildAssetWorkspaceAddress()`: Constructs workspace addresses for different zones
- `performS3Move()`: Handles S3 file operations and zone-specific logic
- `isMoveAssetRequest()`: Type guard for request validation

**Configuration**:
- S3 bucket operations via `internalCache.Connection.get('s3Client')`
- Zone-specific file path generation
- Asset state validation requirements

## Integration Points

**Dependencies**:
- `@tonylb/mtw-asset-workspace/ts/readOnly`: Asset workspace management
- `@aws-sdk/client-s3`: S3 file operations
- `../../internalCache`: S3 client caching

**Cross-References**:
- [`../../AGENT.s3Storage.md`](../AGENT.s3Storage.md): S3 storage architecture
- [`../../AGENT.event.md`](../AGENT.event.md): Event streaming patterns
- [`../../../assets/moveAsset/`](../../../assets/moveAsset/): Original implementation reference

**API Contracts**:
- Processes internal `moveAssets` events via `receiveEvents`
- Returns structured responses for success/failure cases
- Integrates with WML dataSource event handling

**System Relationships**:
- Part of WML lambda's dataSource system
- Handles zone transitions independently of assets lambda
- Prepares for future event streaming to assets lambda

## Usage Patterns

**Common Scenarios**:
```typescript
// Move asset between zones
const request: MoveAssetRequest = {
    assetId: 'test-asset',
    fromZone: 'Library',
    toZone: 'Canon'
}
const result = await moveAsset(request)
```

**Best Practices**:
- Always validate asset state before moving
- Handle zone-specific logic appropriately
- Use proper error handling and logging
- Follow S3 operation patterns from assets lambda

**Error Handling**:
- Validates asset state (must be 'Clean')
- Handles S3 operation failures gracefully
- Provides meaningful error messages
- Logs errors for debugging

## Navigation Tips

**Getting Started**:
- Begin with `index.ts` to understand the main flow
- Review `MoveAssetRequest` and `MoveAssetResponse` interfaces
- Study `performS3Move()` for S3 operation patterns

**Key Files**:
- `index.ts`: Main implementation and orchestration
- `index.test.ts`: Comprehensive test coverage
- `AGENT.development.md`: Development priorities and known issues

**Related Documentation**:
- [`../AGENT.s3Storage.md`](../AGENT.s3Storage.md): S3 storage patterns
- [`../AGENT.event.md`](../AGENT.event.md): Event handling architecture
- [`../../../AGENT.zones.md`](../../../AGENT.zones.md): Zone system overview

## Development Notes

**Current State**: Fully implemented with comprehensive test coverage. Successfully replicates S3 file management from assets lambda while maintaining domain separation.

**Future Plans**: 
- Implement event streaming to inform assets lambda of zone changes
- Migrate zone authority completely to WML lambda
- Enhance error handling and monitoring

**Technical Debt**: See [`AGENT.development.md`](AGENT.development.md) for specific issues and priorities.
