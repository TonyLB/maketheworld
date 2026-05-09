# Component Asset Meta Cache - Agent Navigation Guide

## Overview

The `ComponentAssetMetaData` class is a specialized cache handler that manages **component metadata** from the `assetDB` DynamoDB table. It provides cross-asset component lookup capabilities and integrates with the WML StandardComponent system.

**Shared read helpers:** Cache key format, DynamoDB query shaping for `getItems` / `getItem`, `Meta::${Type}` meta-row discovery, row normalization, and default `StandardComponent` synthesis for cache misses live in **`@tonylb/mtw-gateways/ts/assets/components/assetMeta`** (see [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)). This file documents ephemera's **`DeferredCache`** adapter and `internalCache` integration only.

> **Note**: This handler follows the standard `internalCache` patterns documented in [`AGENT.md`](./AGENT.md). See that file for common patterns like DeferredCache usage, dual storage, and core methods.

## Unique Features

### **Cross-Asset Component Lookup**
Unlike other cache handlers, `ComponentAssetMeta` specializes in finding the same component across multiple assets:

```typescript
// Get mainHall room across multiple assets
const results = await componentAssetMeta.getAcrossAssets('ROOM#mainHall-uuid', [
    'ASSET#marketSquare-uuid',
    'ASSET#downtown-uuid',
    'ASSET#suburbs-uuid'
])
// Returns: Record<AssetUUID, StandardComponent>
```

### **Complete Asset Discovery**
Can find ALL assets containing a specific component:

```typescript
// Find all assets containing the mainHall room
const allAssets = await componentAssetMeta.getAcrossAllAssets('ROOM#mainHall-uuid')
// Returns: Record<AssetUUID, StandardComponent>
```

### **Default Component Creation**
When a component doesn't exist in the database, creates a default component:
- Uses `tagFromEphemeraWrappedId()` to determine component type
- Calls `defaultComponentFromTag()` to create base data
- Uses `standardComponentFactory()` to instantiate the component

## Cache Key Format

Components are cached using a compound key: `{assetId}::{EphemeraId}`
- **`assetId`**: The asset containing the component (AssetUUID)
- **`EphemeraId`**: The component's unique identifier (ComponentUUID)

## Data Structure

Each cached item contains:
```typescript
{
    assetId: AssetUUID;
    component: StandardComponent;
}
```

## Core Methods

### **`get(EphemeraId, assetId)`**
Retrieves a single component from a specific asset:

```typescript
const result = await componentAssetMeta.get('ROOM#mainHall-uuid', 'ASSET#marketSquare-uuid')
// Returns: { assetId: 'ASSET#marketSquare-uuid', component: StandardRoom }
```

### **`getAcrossAssets(EphemeraId, assetList)`**
Retrieves the same component across multiple assets efficiently:

```typescript
const results = await componentAssetMeta.getAcrossAssets('ROOM#mainHall-uuid', [
    'ASSET#marketSquare-uuid',
    'ASSET#downtown-uuid',
    'ASSET#suburbs-uuid'
])
// Returns: Record<AssetUUID, StandardComponent>
```

### **`getAcrossAllAssets(EphemeraId)`**
Retrieves a component across ALL assets where it appears:

```typescript
const allAssets = await componentAssetMeta.getAcrossAllAssets('ROOM#mainHall-uuid')
// Returns: Record<AssetUUID, StandardComponent>
```

## DynamoDB Integration

### **Database Schema**
Components are stored in `assetDB` with this structure:
```typescript
{
    AssetId: ComponentUUID,        // The component's UUID
    DataCategory: AssetUUID,       // The asset containing the component
    // ... component-specific fields from StandardComponentData
}
```

### **Query Patterns**

#### **Single Component Lookup**
```typescript
const result = await assetDB.getItems({
    Keys: [{
        AssetId: 'ROOM#mainHall-uuid',
        DataCategory: 'ASSET#marketSquare-uuid'
    }]
})
```

#### **Meta Lookup for Cross-Asset Discovery**
```typescript
const metaResult = await assetDB.getItem({
    Key: {
        AssetId: 'ROOM#mainHall-uuid',
        DataCategory: 'Meta::Room'  // Component type metadata
    },
    ProjectionFields: ['cached']    // List of asset keys
})
```

## Integration Points

### **WML StandardComponent System**
- Uses `standardComponentFactory()` for component creation
- Validates data with `isStandardComponentData()`
- Integrates with `defaultComponentFromTag()` for defaults

### **AssetDB DynamoDB Table**
- Queries component data by compound key
- Retrieves metadata for cross-asset lookups
- Handles missing components gracefully

## Usage Patterns

### **Single Component Lookup**
```typescript
// Get specific component from specific asset
const room = await componentAssetMeta.get('ROOM#mainHall-uuid', 'ASSET#marketSquare-uuid')
console.log(room.component.name) // "Main Hall"
```

### **Cross-Asset Component Analysis**
```typescript
// Find how a component appears across multiple assets
const appearances = await componentAssetMeta.getAcrossAssets('FEATURE#fountain-uuid', [
    'ASSET#marketSquare-uuid',
    'ASSET#park-uuid'
])
// Aggregate edits to the fountain Feature component across all the ASSETS to which
// a viewpoint has access (to create the overall sense of the fountain as a whole)
```

### **Complete Component Discovery**
```typescript
// Find all assets containing a specific component
const allAssets = await componentAssetMeta.getAcrossAllAssets('ROOM#mainHall-uuid')
// Useful for understanding component aggregate across the system
```

## Navigation Tips

1. **Start with `get()`**: Understand single component retrieval
2. **Read the gateway module**: DynamoDB key lists and row mapping are in `@tonylb/mtw-gateways/ts/assets/components/assetMeta` (`fetchComponentsForAssets`, `fetchCachedAssetIdsForComponent`)
3. **Review cache key format**: Understand the `assetId::EphemeraId` pattern (`generateCacheKey` / `cacheKeyComponents` in the same package)
4. **Examine error handling**: See validation patterns for data integrity
5. **Look at batching**: Understand how multiple requests are optimized

## Development Notes

- **Cache Key Format**: Use `generateCacheKey()` and `cacheKeyComponents()` from `@tonylb/mtw-gateways/ts/assets/components/assetMeta` (or via ephemera's class, which delegates to them).
- **Validation**: Always validate both assetId and EphemeraId before database calls
- **Default Components**: Missing components get default instances, not null
- **Batching**: Multiple requests for same component share single database call
