# Content Headers Data Source - Implementation Planning

## Overview

This document outlines the implementation plan for the first iteration of the Content Headers data source (`mtw.assets.contentHeaders`). This data source will provide filtered asset and component metadata for the Import Navigator UI, supporting content discovery and import workflows during the Bootstrapping phase.

## Implementation Goals

### Primary Objectives
- **Import Navigator Support**: Provide structured asset metadata for the Import Navigator UI
- **Real-time Updates**: Stream asset changes and zone movements to subscribed clients
- **Zone-based Organization**: Organize assets by Canon, Library, and Personal zones
- **Client Subscription**: Enable direct WebSocket subscriptions through the subscriptions lambda

### Success Criteria
- [ ] Content Headers data source publishes asset metadata events
- [ ] Import Navigator can subscribe to and receive real-time updates
- [ ] Zone changes trigger appropriate update events
- [ ] Snapshot generation provides complete initial state
- [ ] Event serialization maintains WML format consistency

## Technical Architecture

### Data Source Design
```typescript
// DataSource Configuration
export const contentHeadersDataSource = new AssetsDataSource<ContentHeadersSnapshot, ContentHeadersUpdate, ContentHeadersExternal>({
    dataSourceKey: 'mtw.assets.contentHeaders',
    replayable: true, // Support client subscriptions with historical data
    streamKey: 'global', // Single stream for first iteration
    eventSerializer: new ContentHeadersEventSerializer(),
    snapshotContentGenerator: generateContentHeadersSnapshot,
    subscribedEventTypeGuard: (event): event is any => {
        // Subscribe to mtw.assets events
        return event.dataSourceKey === 'mtw.assets' && 
               ['Component Updated', 'Component Removed'].includes(event.event.update.type)
    },
    receiveEvents: async ({ event, streamEvent }) => {
        // Process asset events and generate content header updates
    }
})
```

### Event Types and Serialization

#### Internal Event Types
```typescript
// Snapshot event for initial state
export type ContentHeadersSnapshot = {
    type: 'ContentHeadersSnapshot'
    assets: Array<{
        assetId: string
        zone: 'Canon' | 'Library' | 'Personal'
        wml: string // StandardForm serialized to WML
    }>
}

// Update event for incremental changes
export type ContentHeadersUpdate = {
    type: 'ContentHeadersUpdate'
    assetId: string
    zone: 'Canon' | 'Library' | 'Personal'
    wml: string // StandardForm diff serialized to WML
}
```

#### External Event Format
```typescript
// External EventBridge format
export type ContentHeadersExternal = {
    type: 'ContentHeadersSnapshot' | 'ContentHeadersUpdate'
    data: ContentHeadersSnapshot | ContentHeadersUpdate
}
```

### Data Flow Architecture
```
Asset Changes (mtw.assets) 
    ↓
Content Headers DataSource (event subscription)
    ↓
Header Extraction (extractHeader.ts)
    ↓
Event Serialization (WML format)
    ↓
EventBridge Publishing
    ↓
Subscriptions Lambda
    ↓
WebSocket Client (Import Navigator)
```

## Implementation Steps

### Step 1: Create Data Source Infrastructure
**Duration**: 1-2 days

#### Tasks
- [x] Create `lambda/assets/contentHeaders/` directory structure
- [x] Implement `ContentHeadersEventSerializer` class
- [x] Create event type definitions (`ContentHeadersSnapshot`, `ContentHeadersUpdate`)
- [x] Set up DataSource configuration with proper type guards

#### Files Created
- [x] `lambda/assets/contentHeaders/baseClasses.ts` - Internal event type definitions and type guards
- [x] `lambda/assets/contentHeaders/serializers.ts` - Event serialization logic with proper boundary between internal StandardForm objects and external WML strings
- [x] `lambda/assets/contentHeaders/extractHeader.ts` - Header extraction utilities (already existed)
- [x] `lambda/assets/contentHeaders/index.ts` - Main DataSource implementation with proper type safety and event subscription

#### Step 1 Complete ✅
All infrastructure components for the Content Headers data source have been implemented:
- Proper serialization boundary between internal StandardForm objects and external WML strings
- Type-safe event subscription with discriminated union types
- Replayable DataSource configuration with snapshot generation support
- Event processing pipeline for Component Updated and Component Removed events

### Step 2: Implement Snapshot Generation
**Duration**: 1-2 days

#### Tasks
- [x] Create `generateContentHeadersSnapshot()` function
- [x] Query AssetDB for all assets across all zones
- [x] Extract component metadata using existing `extractHeader.ts` utilities
- [x] Serialize StandardForm objects to WML format
- [x] Handle edge cases (empty zones, missing metadata)

#### Step 2 Complete ✅
The snapshot generation function has been implemented with:
- Efficient single-query approach to fetch all assets from DynamoDB using DataCategoryIndex
- Integration with existing internal cache system for StandardForm loading
- Component metadata extraction using existing extractHeader utilities
- Proper error handling with graceful fallback to empty snapshot
- Helper functions for asset zone lookup and content header extraction

### Step 3: Implement Event Subscription and Processing
**Duration**: 2-3 days

#### Tasks
- [ ] Subscribe to `mtw.assets` events (`Component Updated`, `Component Removed`)
- [ ] Process asset changes and generate content header updates
- [ ] Handle zone changes (asset movement between zones)
- [ ] Implement diff generation for incremental updates
- [ ] Add error handling and logging

#### Event Processing Logic
```typescript
receiveEvents: async ({ event, streamEvent }) => {
    if (event.event.update.type === 'Component Updated') {
        const assetId = event.event.streamKey
        const zone = await getAssetZone(assetId)
        const metadata = await extractAssetMetadata(assetId, zone)
        
        await streamEvent({
            update: {
                type: 'ContentHeadersUpdate',
                assetId,
                zone,
                wml: metadata.wml
            },
            streamKey: 'global',
            detailType: 'Content Headers Updated'
        })
    }
    
    if (event.event.update.type === 'Component Removed') {
        // Handle asset removal
        const assetId = event.event.streamKey
        
        await streamEvent({
            update: {
                type: 'ContentHeadersUpdate',
                assetId,
                zone: null, // Indicates removal
                wml: null
            },
            streamKey: 'global',
            detailType: 'Content Headers Removed'
        })
    }
}
```

### Step 4: Zone Change Event Integration
**Duration**: 1-2 days

#### Tasks
- [ ] Identify zone change events in `mtw.assets` data source
- [ ] Create zone change event types if not already present
- [ ] Subscribe to zone change events in Content Headers data source
- [ ] Generate appropriate update events when assets move between zones

#### Zone Change Events
```typescript
// New event type needed in mtw.assets
export type AssetZoneChangedEvent = {
    type: 'Asset Zone Changed'
    assetId: string
    fromZone: 'Canon' | 'Library' | 'Personal'
    toZone: 'Canon' | 'Library' | 'Personal'
}
```

### Step 5: Subscriptions Lambda Integration
**Duration**: 2-3 days

#### Tasks
- [ ] Add EventBridge rule for `mtw.assets.contentHeaders` events
- [ ] Extend subscriptions lambda to support `initializeSubscription` calls
- [ ] Implement subscription handling for Content Headers data source
- [ ] Add WebSocket message routing for Content Headers events
- [ ] Test end-to-end subscription flow

#### Subscriptions Lambda Changes
```typescript
// Add to template.yaml
ContentHeadersRule:
  Type: CloudWatchEvent
  Properties:
    EventBusName: !Sub ${TablePrefix}-bus
    Pattern:
      source:
        - mtw.assets.contentHeaders
      detail-type:
        - Content Headers Updated
        - Content Headers Removed
    Targets:
      - Arn: !GetAtt SubscriptionsFunction.Arn
        Id: ContentHeadersTarget
```

### Step 6: Testing and Integration
**Duration**: 2-3 days

#### Tasks
- [ ] Unit tests for DataSource functionality
- [ ] Integration tests with EventBridge and DynamoDB
- [ ] End-to-end testing with Import Navigator UI
- [ ] Performance testing with large asset counts
- [ ] Error handling and edge case testing

#### Test Scenarios
- [ ] Asset creation triggers content header update
- [ ] Asset modification updates content headers
- [ ] Asset deletion removes content headers
- [ ] Zone changes update content headers
- [ ] Client subscription receives initial snapshot
- [ ] Client receives real-time updates
- [ ] Large snapshot generation performance
- [ ] Error handling for missing assets

## Dependencies and Prerequisites

### Required Infrastructure
- [ ] EventBridge rules for `mtw.assets.contentHeaders` events
- [ ] Subscriptions lambda support for DataSource initialization
- [ ] AssetDB DynamoDB table access
- [ ] Existing `extractHeader.ts` utilities

### Existing Systems
- [ ] `mtw.assets` primary data source (already implemented)
- [ ] Asset caching system (already implemented)
- [ ] WML serialization utilities (already implemented)
- [ ] StandardForm classes (already implemented)

## Risk Mitigation

### Technical Risks
- **Large Snapshot Size**: May become unwieldy as asset count grows
  - **Mitigation**: Monitor performance, implement claim-check pattern if needed
- **Event Ordering**: Ensure events are processed in correct order
  - **Mitigation**: Use EventBridge's built-in ordering guarantees
- **Zone Change Detection**: May miss zone changes if not properly subscribed
  - **Mitigation**: Comprehensive event subscription and testing

### Implementation Risks
- **Complex Event Processing**: Asset changes may trigger multiple events
  - **Mitigation**: Clear event processing logic with proper error handling
- **Client Integration**: Import Navigator may need significant changes
  - **Mitigation**: Design clear event format, provide migration path

## Future Enhancements

### Phase 2: Granular Authorization
- **Per-Asset Streams**: Use `assetId` as streamKey for authorization-aware subscriptions
- **Permission Filtering**: Filter events based on player permissions
- **Dynamic Authorization**: Handle permission changes during active subscriptions

#### Subscription System Requirements

**Authorization-Aware Event Filtering**
The current subscription system broadcasts all events to all subscribers. Phase 2 requires the ability to filter events based on individual subscriber permissions, so players only receive events for assets they're authorized to access.

**Dynamic Stream Management**
Subscribers will need to dynamically subscribe/unsubscribe to specific asset streams as their permissions change, rather than maintaining a single global subscription.

**Event Revocation System**
When permissions are revoked, subscribers need to be notified that they should no longer access certain data, requiring a new event type for permission revocation.

**Incremental Authorization Updates**
During active subscriptions, new permissions may be granted that require subscribing to additional asset streams, while revoked permissions require unsubscribing and sending revocation notices.

**Subscriptions Lambda Architecture Changes**
The subscriptions lambda will need significant refactoring to support authorization-aware subscriptions, including permission storage, event filtering, and dynamic stream management.

**Performance Considerations**
Authorization-aware filtering introduces new challenges around permission lookup overhead, memory usage for storing authorization context, and event processing latency that will need to be addressed.

### Phase 3: Performance Optimization
- **Claim-Check Pattern**: Large snapshots stored in S3 with claim-check references
- **Incremental Snapshots**: Only send changed assets in snapshot updates
- **Caching Layer**: Client-side caching to reduce subscription load

## Success Metrics

### Functional Success
- [ ] Import Navigator displays all assets organized by zone
- [ ] Real-time updates when assets are created, modified, or moved
- [ ] Client subscriptions work reliably
- [ ] Zone changes are reflected immediately

### Performance Success
- [ ] Snapshot generation completes within acceptable time limits
- [ ] Event processing doesn't impact primary asset operations
- [ ] Client subscriptions don't cause memory or performance issues
- [ ] System scales to expected asset volumes

### Integration Success
- [ ] Seamless integration with existing asset system
- [ ] Clean separation between full asset data and content headers
- [ ] Future-ready architecture for authorization enhancements
- [ ] Maintainable and extensible codebase
