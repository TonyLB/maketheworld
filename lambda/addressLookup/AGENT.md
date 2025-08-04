# Address Lookup Lambda

## Overview

The Address Lookup Lambda is a specialized service that translates AssetUUIDs and CharacterUUIDs into S3 storage addresses. It serves as the central address resolution system for the Make The World platform, handling the complex mapping between asset identifiers and their physical storage locations across different zones.

### Core Purpose

The Address Lookup Lambda is responsible for:
- **Asset Address Resolution**: Converting asset IDs to S3 storage addresses
- **Zone Management**: Handling different storage zones (Personal, Library, Canon, Draft, Archive)
- **Draft Asset Handling**: Special processing for player draft assets
- **Address Creation**: Generating new addresses for assets that don't exist yet

### Key Concepts

- **AssetUUID**: Unique identifier for an asset (format: `ASSET#${string}`)
- **CharacterUUID**: Unique identifier for a character (format: `CHARACTER#${string}`)
- **AssetWorkspaceAddress**: Complete S3 storage location information
- **Zone**: Storage location category (Personal, Library, Canon, Draft, Archive)
- **Draft Assets**: Special temporary assets with format `ASSET#draft[${player}]`

## Technical Details

### Address Structure

The lambda returns `AssetWorkspaceAddress` objects with the following structure:

```typescript
type AssetWorkspaceAddress = 
  | AssetWorkspaceConstructorCanon
  | AssetWorkspaceConstructorLibrary  
  | AssetWorkspaceConstructorPersonal
  | AssetWorkspaceConstructorDraft
  | AssetWorkspaceConstructorArchive

type AssetWorkspaceConstructorBase = {
    fileName: string;
    subFolder?: string;
}

type AssetWorkspaceConstructorCanon = {
    zone: 'Canon';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorLibrary = {
    zone: 'Library';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorPersonal = {
    zone: 'Personal';
    player: string;
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorDraft = {
    zone: 'Draft';
    player: string;
}

type AssetWorkspaceConstructorArchive = {
    zone: 'Archive';
    backupId: `BACKUP#${string}`;
}
```

### Core Function

```typescript
export const handler = async (event) => {
    const { assetIds, player, tag, create } = event
    // ... address resolution logic
}
```

**Parameters**:
- `assetIds`: Array of asset/character IDs to resolve
- `player`: Player ID for personal asset creation
- `tag`: Asset type tag ('Asset' or 'Character')
- `create`: Boolean flag to create new addresses if not found

**Returns**: Array of `{ AssetId, address }` objects

## Address Resolution Process

### 1. Draft Asset Detection
The lambda first identifies draft assets using a special pattern:

```typescript
const isDraftAssetId = (assetId: string): assetId is `ASSET#draft[${string}]` => (
    assetId.startsWith('ASSET#draft[') && assetId.endsWith(']')
)
```

**Draft Asset Handling**:
- **Pattern**: `ASSET#draft[${player}]`
- **Zone**: Always 'Draft'
- **Player**: Extracted from the asset ID
- **No fileName**: Draft assets don't have physical files yet

### 2. Database Lookup
For non-draft assets, the lambda queries DynamoDB:

```typescript
const addressfetches = await assetDB.getItems<MetaCache>({
    Keys: nonDraftAssetIds.map((AssetId) => ({
        AssetId,
        DataCategory: `Meta::${tag ?? (AssetId.split('#')[0] === 'CHARACTER' ? 'Character' : 'Asset')}`
    })),
    ProjectionFields: ['AssetId', 'address']
})
```

**DataCategory Logic**:
- **Characters**: Uses `Meta::Character`
- **Assets**: Uses `Meta::Asset` (or custom tag if provided)

### 3. Address Creation (Optional)
If no addresses are found and `create` is true:

```typescript
return assetIds.map((assetId) => ({
    AssetId: assetId,
    address: {
        zone: 'Personal',
        player,
        fileName: assetId.split('#').slice(1)[0],
        subFolder: `${tag}s`
    }
}))
```

**Creation Rules**:
- **Zone**: Always 'Personal' for new assets
- **fileName**: Extracted from asset ID
- **subFolder**: Uses tag with 's' suffix (e.g., 'Assets', 'Characters')
- **player**: Required parameter

## Zone Management

### Personal Zone
- **Purpose**: Player-owned assets
- **Structure**: `Personal/${player}/${subFolder}/${fileName}`
- **Access**: Private to the player
- **Example**: `Personal/johndoe/Assets/my-room.wml`

### Library Zone  
- **Purpose**: Shared community assets
- **Structure**: `Library/${subFolder}/${fileName}`
- **Access**: Available to all players, but not automatically applied for all players
- **Example**: `Library/Rooms/tavern.wml`

### Canon Zone
- **Purpose**: Official game content
- **Structure**: `Canon/${subFolder}/${fileName}`
- **Access**: Available to and automatically applied for all players
- **Example**: `Canon/Characters/hero.wml`

### Draft Zone
- **Purpose**: Temporary player work
- **Structure**: No physical files
- **Access**: Private to the player
- **Example**: `ASSET#draft[johndoe]`

### Archive Zone
- **Purpose**: Backup and historical assets
- **Structure**: `Archive/${backupId}/${fileName}`
- **Access**: Read-only, requires backup ID
- **Example**: `Archive/BACKUP#2023-12-01/old-room.wml`

## Integration Points

### Dependencies
- **DynamoDB**: Asset metadata storage
- **Asset Workspace**: Address validation and parsing
- **Step Functions**: Orchestration of address resolution

### Cross-References
- **[Assets Lambda](../assets/)**: Primary consumer of address resolution
- **[WML Lambda](../wml/)**: Uses addresses for file operations
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: Address validation utilities

### API Contracts
- **Step Function Integration**: Called by various step functions for address resolution
- **Direct Lambda Calls**: Used by other lambdas for address lookup
- **Asset Creation**: Supports automatic address generation for new assets

## Usage Patterns

### Common Scenarios

#### Standard Address Lookup
```typescript
// Called by step functions
const result = await addressLookupHandler({
    assetIds: ['ASSET#my-room', 'CHARACTER#hero'],
    tag: 'Asset'
})
// Returns: [{ AssetId: 'ASSET#my-room', address: {...} }, ...]
```

#### Draft Asset Resolution
```typescript
// Special handling for draft assets
const result = await addressLookupHandler({
    assetIds: ['ASSET#draft[johndoe]']
})
// Returns: [{ AssetId: 'ASSET#draft[johndoe]', address: { zone: 'Draft', player: 'johndoe' } }]
```

#### New Asset Creation
```typescript
// Create address for new asset
const result = await addressLookupHandler({
    assetIds: ['ASSET#new-room'],
    player: 'johndoe',
    tag: 'Asset',
    create: true
})
// Returns: [{ AssetId: 'ASSET#new-room', address: { zone: 'Personal', player: 'johndoe', fileName: 'new-room', subFolder: 'Assets' } }]
```

### Best Practices
1. **Always Check Results**: Verify returned addresses are valid
2. **Handle Draft Assets**: Account for special draft asset handling
3. **Use Appropriate Tags**: Specify correct tag for characters vs assets
4. **Validate Creation**: Ensure required parameters when creating addresses

## Error Handling

### Common Issues
- **Missing Player**: Required for personal asset creation
- **Invalid Asset IDs**: Malformed asset identifiers
- **Database Errors**: DynamoDB connection issues
- **Address Validation**: Invalid address structures

### Recovery Strategies
- **Graceful Degradation**: Return empty results for missing assets
- **Validation**: Use `isAssetWorkspaceAddress` for address validation
- **Retry Logic**: Step functions include retry mechanisms
- **Error Propagation**: Clear error messages for debugging

## Development Notes

### Current State
- **Draft Support**: Fully functional draft asset handling
- **Zone Support**: Complete support for all storage zones
- **Step Function Integration**: Well-integrated with orchestration
- **Address Validation**: Robust address structure validation

### Known Limitations
- **Creation Zones**: Can only create new addresses in Personal and Draft zones (existing addresses in other zones are returned from database)
  - **Canon Zone**: Populated by `canonize` function in Assets lambda (moves assets from Library to Canon)
  - **Archive Zone**: Populated by `archive` function in Assets lambda (moves assets to backup storage)
- **No File Validation**: Doesn't verify S3 file existence
- **Limited Metadata**: Only returns address information

### Future Improvements
1. **Multi-Zone Creation**: Support creating addresses in other zones
2. **File Validation**: Check S3 file existence
3. **Caching**: Implement address caching for performance
4. **Bulk Operations**: Optimize for large address lookups

## Navigation Tips

### Getting Started
1. **Understand Zones**: Learn the different storage zones and their purposes
2. **Study Draft Assets**: Understand the special draft asset handling
3. **Review Step Functions**: See how address lookup is used in orchestration
4. **Check Integration**: Understand how other systems use address resolution

### Key Files
- `app.ts`: Main lambda handler with address resolution logic
- `package.json`: Dependencies and build configuration
- Step function files: Integration examples

### Related Documentation
- **[Assets Lambda](../assets/)**: Primary consumer of address resolution
- **[WML Lambda](../wml/)**: File operations using addresses
- **[Asset Workspace](../../packages/mtw-asset-workspace/)**: Address utilities and validation 