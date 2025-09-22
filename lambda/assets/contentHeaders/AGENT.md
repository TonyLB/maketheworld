# Content Headers Data Source - Agent Navigation Guide

## Overview

The Content Headers data source provides filtered asset and component metadata for the content authoring UI, enabling content discovery and import workflows especially during the Bootstrapping phase. This data source aggregates asset information by zone and publishes real-time updates as assets are created, modified, or moved between zones.

## Core Purpose

The Content Headers data source serves as a specialized view of the assets system, providing:

- **Zone-based Asset Discovery**: Organized view of assets across Canon, Library, and Personal zones
- **Component Metadata**: Essential information (shortName, type) for Import Navigator display
- **Real-time Updates**: Live synchronization with asset changes and zone movements
- **Import Navigator Support**: Structured data format optimized for tabular UI display

## Technical Details

### Data Source Configuration
- **DataSource Key**: `mtw.assets.contentHeaders`
- **Type**: Replayable DataSource with single `global` stream
- **Event Subscription**: Subscribes to `mtw.assets` events (`Component Updated` including `StandardRemove` components)
- **Event Publishing**: Publishes filtered metadata events for Import Navigator consumption

### Event Types

#### Snapshot Events
Initial state delivery for new subscribers:
```typescript
{
  type: 'ContentHeadersSnapshot',
  assets: Array<{
    assetId: `ASSET#${string}`,
    zone: 'Canon' | 'Library' | 'Personal',
    wml: string // StandardForm serialized to WML
  }>
}
```

#### Update Events
Incremental changes for existing subscribers:
```typescript
{
  type: 'ContentHeadersUpdate',
  assetId: `ASSET#${string}`,
  zone: 'Canon' | 'Library' | 'Personal',
  wml: string // StandardForm diff serialized to WML
}
```

### Data Format
- **Asset Identification**: Uses AssetId for unique identification
- **Zone Information**: Current zone for client-side tab routing
- **WML Serialization**: StandardForm objects serialized to WML strings for component metadata
- **Diff Strategy**: Update events provide incremental changes to be merged client-side

## Integration Points

### Dependencies
- **Assets Lambda**: Primary data source for asset and component information
- **AssetDB**: DynamoDB table containing asset metadata and component data
- **EventBridge**: Event streaming infrastructure
- **Subscriptions Lambda**: WebSocket client connection management

### Cross-References
- **[Assets Data Source](../dataSource/AGENT.md)**: Primary asset data source
- **[Import Navigator UI](../../../charcoal-client/src/components/Library/ImportNavigator/)**: Frontend consumer
- **[Subscriptions Lambda](../../../lambda/subscriptions/AGENT.md)**: WebSocket integration
- **[Header Extraction Utilities](./extractHeader.ts)**: Data extraction logic

## Usage Patterns

### Client Subscription
```typescript
// Subscribe to content headers through subscriptions lambda
const subscription = await subscriptionsClient.subscribe({
  dataSourceKey: 'mtw.assets.contentHeaders',
  streamKey: 'global'
})
```

### Event Processing
```typescript
// Handle snapshot events for initial state
if (event.type === 'ContentHeadersSnapshot') {
  // Initialize Import Navigator with all assets
  event.assets.forEach(asset => {
    updateAssetInZone(asset.zone, asset.assetId, asset.wml)
  })
}

// Handle update events for real-time changes
if (event.type === 'ContentHeadersUpdate') {
  // Apply incremental changes
  updateAssetInZone(event.zone, event.assetId, event.wml)
}
```

## Navigation Tips

### Getting Started
1. **Review Planning Document**: See [`AGENT.planning.md`](./AGENT.planning.md) for implementation details
2. **Understand Data Flow**: Assets → Content Headers → Subscriptions → Client
3. **Check Integration Points**: Ensure EventBridge rules and subscription handlers are configured

### Key Files
- **Data Source Implementation**: `./index.ts` - Main DataSource configuration
- **Event Serialization**: `./serializers.ts` - Event format conversion
- **Header Extraction**: `./extractHeader.ts` - Data extraction utilities
- **Planning Document**: `./AGENT.planning.md` - Implementation roadmap

## Development Notes

### Current State
- **Status**: First iteration implementation in progress
- **Scope**: Single `global` stream with zone-based asset aggregation
- **Limitations**: No granular authorization filtering (future enhancement)

### Future Enhancements
- **Granular Streams**: Per-asset streams (`assetId` as streamKey) for authorization-aware subscriptions
- **Authorization Integration**: Filter events based on player permissions
- **Dynamic Authorization**: Handle permission changes during active subscriptions
- **Performance Optimization**: Claim-check pattern for large snapshots

### Known Limitations
- **First Iteration**: Single global stream publishes all asset metadata
- **Authorization**: No permission-based filtering (all-or-nothing access)
- **Snapshot Size**: May become large as asset count grows (future optimization needed)
