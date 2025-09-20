# Characters Data Sub-Source - Agent Navigation Guide

## Overview

The `mtw.assets.characters` data sub-source provides a specialized data source for character-related events within the assets domain. This sub-source follows the DataSource pattern from `mtw-lambda-patterns` and serves as the authoritative source for character update and removal events, replacing the ad-hoc character handling currently embedded in the main assets data source.

## Core Purpose

The Characters data sub-source addresses the architectural need to properly separate character-specific event handling from general asset event processing:

- **Event Authority**: Serves as the authoritative source for character-related events (`Character Updated`, `Character Removed`)
- **Event Subscription**: Subscribes to component-level events and filters for character-specific changes
- **Event Streaming**: Publishes character events to EventBridge for downstream consumers
- **Client Subscriptions**: Supports client subscriptions for UI character listings with replay capability
- **Separation of Concerns**: Removes character-specific logic from the main assets data source

## Architecture

### **Data Source Configuration**

- **Data Source Key**: `'mtw.assets.characters'`
- **Replayable**: `true` (replayable - supports client subscriptions for UI character listings)
- **Primary Key**: `AssetId` (inherited from AssetsDataSource)
- **Stream Key**: `assetId` - Enables granular subscriptions by asset for access-controlled character listings
- **Event Source**: Subscribes to `mtw.assets` events for character-specific changes

### **Stream Architecture**

The characters data source uses `assetId` as the stream key, enabling:

- **Asset-Specific Subscriptions**: Clients can subscribe to character streams for specific assets
- **Access Control**: Clients subscribe only to assets they have access to
- **Granular Updates**: Character changes are streamed per asset, reducing unnecessary data
- **Efficient Filtering**: Clients receive only character updates for relevant assets

### **Event Flow**

1. **Component Changes**: Main `mtw.assets` data source processes WML content updates and publishes component-level events
2. **Character Detection**: Characters sub-source subscribes to component events and filters for character types
3. **Event Processing**: Processes character component changes and generates appropriate character events
4. **Event Streaming**: Publishes character events to EventBridge for downstream consumers

### **Event Types**

#### **Incoming Events** (from `mtw.assets`)
- **Component Updated**: When components are updated, check if it's a character type
- **Component Removed**: When components are removed, check if it's a character type

#### **Outgoing Events** (to EventBridge)
- **Character Updated**: Published when character data changes within an asset
- **Character Removed**: Published when characters are removed from assets

## Implementation Design

### **Data Source Class**

```typescript
export class CharactersDataSource extends AssetsDataSource<
    CharacterSnapshotPayload, // Snapshot payload for character listings
    CharacterEventPayload, // Update payload - structured character event data
    ComponentEventPayload // Subscribed event type
> {
    constructor() {
        super({
            dataSourceKey: 'mtw.assets.characters',
            replayable: true,
            subscribedEventTypeGuard: (event: any): event is ComponentEventPayload => {
                // Subscribe to mtw.assets component events that might be character changes
                return event.dataSourceKey === 'mtw.assets' && 
                       event.event && 
                       typeof event.event === 'object' &&
                       event.event.update &&
                       typeof event.event.update === 'object' &&
                       ['Component Updated', 'Component Removed'].includes(event.event.update.type)
            },
            snapshotContentGenerator: async (streamKey: string) => {
                // Generate character listing snapshot as WML string for client subscriptions
                return await this.generateCharacterSnapshot(streamKey)
            },
            receiveEvents: async ({ event, streamEvent }) => {
                // Process component events and filter for character types
                await this.processComponentEvent(event, streamEvent)
            }
        })
    }
}
```

### **Event Processing Logic**

The sub-source will process incoming component events to detect character-specific changes:

1. **Component Updated Events**: 
   - Check if the component is a character type (using component tag or type checking)
   - If character, generate `Character Updated` event with structured payload containing detailType, characterId, and WML data
   - Extract character ID from component information (assetId available as streamKey)

2. **Component Removed Events**:
   - Check if the component is a character type
   - If character, generate `Character Removed` event with structured payload containing detailType, characterId, and WML data

### **Event Payload Structure**

Following the established pattern from `mtw.assets` and `Component Updated` events, the characters data source uses structured payloads with WML strings:

```typescript
// Internal format (for messageBus and DataSource processing)
type CharacterEventPayload = {
    dataSourceKey: 'mtw.assets'
    event: {
        streamKey: string
        update: {
            type: 'Component Updated' | 'Component Removed'
            assetId: string
            component: StandardCharacter | undefined // undefined for removed components
        }
        timestamp: number
    }
    timestamp: number
}

// External format (for EventBridge publishing via serializer)
type CharacterEventExternal = {
    detailType: 'Character Updated' | 'Character Removed'
    characterId: string
    wml: string // WML string containing character data
}

type CharacterSnapshotPayload = {
    streamKey: string // assetId for this character stream
    characters: string // WML string containing character listings for this asset
    timestamp: number
}
```

**Event Structure Examples**:
- **Internal Character Updated**: `{ dataSourceKey: 'mtw.assets', event: { streamKey: 'ASSET#asset123', update: { type: 'Component Updated', assetId: 'ASSET#asset123', component: StandardCharacter }, timestamp: 1234567890 }, timestamp: 1234567890 }`
- **External Character Updated**: `{ detailType: 'Character Updated', characterId: 'char123', wml: '<Character>...</Character>' }`
- **Character Snapshot**: WML string containing all characters for the asset stream

## Integration Points

### **Dependencies**
- **AssetsDataSource**: Inherits from the assets-specific base class
- **MessageBus**: Subscribes to asset events via messageBus
- **EventBridge**: Publishes character events to EventBridge
- **DynamoDB**: Stores character snapshots and event history for replay
- **SNS**: Delivers replay data to specific client sessions
- **Internal Cache**: Uses existing component data cache for character information

### **Event Subscription**
- **Source**: `mtw.assets` data source
- **Event Types**: `Component Updated`, `Component Removed`
- **Processing**: Filters for character component types and generates appropriate character events

### **Event Publishing**
- **Target**: EventBridge (live events) + SNS (replay events)
- **Event Types**: `Character Updated`, `Character Removed`
- **Consumers**: Downstream systems that need character change notifications
- **Client Subscriptions**: UI components that need character listings for player selection

## Migration Strategy

### **Phase 1: Implementation**
1. Create `CharactersDataSource` class following the established pattern
2. Implement event subscription to `mtw.assets` component events
3. Implement character type detection logic
4. Implement character event publishing
5. Implement character snapshot generation for client subscriptions

### **Phase 2: Integration**
1. Add characters data source to the main assets lambda
2. Subscribe the data source to the messageBus
3. Test character event flow end-to-end
4. Test client subscription and replay functionality

### **Phase 3: Cleanup**
1. Remove character-specific logic from main `cacheAsset` function
2. Remove direct character event publishing from asset data source
3. Update tests to reflect new architecture
4. Ensure component events are published by main assets data source

## Benefits

### **Architectural Improvements**
- **Separation of Concerns**: Character logic separated from general asset processing
- **Consistency**: Follows established DataSource pattern
- **Maintainability**: Character-specific logic centralized in dedicated sub-source
- **Extensibility**: Easy to add character-specific features without affecting asset processing

### **Event Mesh Benefits**
- **Proper Event Hierarchy**: Character events properly nested under asset events
- **Event Authority**: Clear ownership of character event publishing
- **Subscriber Clarity**: Downstream systems can subscribe specifically to character events
- **Client Support**: Full replay capability for UI character listings

### **Client Benefits**
- **Character Listings**: Clients can subscribe to get current character listings for specific assets
- **Access-Controlled Subscriptions**: Subscribe only to character streams for assets the client has access to
- **Real-time Updates**: Live updates when characters are added/removed/modified in relevant assets
- **Replay Support**: New clients get complete character context for their accessible assets on subscription
- **UI Integration**: Perfect for character selection interfaces with proper access control

## Current State

### **Existing Character Handling**
The current system handles character events ad-hoc within the `cacheAsset` function:
- Character changes are detected during asset diff processing
- Character events are published directly from the asset data source
- This creates architectural inconsistency with the DataSource pattern

### **Migration Requirements**
- Extract character detection logic from `cacheAsset`
- Move character event publishing to dedicated sub-source
- Ensure component events are published by main assets data source
- Maintain existing event contracts for backward compatibility
- Ensure no functional changes to character event behavior

## Future Enhancements

### **Potential Features**
- **Character Snapshots**: Add replay capability for character-specific data
- **Character Queries**: Add character-specific query capabilities
- **Character Metadata**: Enhanced character metadata management
- **Character Relationships**: Track character-to-character relationships

### **Future Subscription Architecture Considerations**

**Question**: Should we refine the subscription model to support both:

1. **Character Overview Subscriptions**: Subscribe to summary information across all characters (similar to content-headers pattern)
   - Lightweight character listings for UI overviews
   - Basic metadata (name, ID, asset context) for all accessible characters
   - Efficient for character selection interfaces

2. **Character Detail Subscriptions**: Subscribe to full information for specific characters
   - Complete character data for detailed views
   - Real-time updates for character-specific changes
   - Drill-down capability from overview to detail

This would enable a content-headers style UI for characters, where users can see an overview of all available characters, then drill into live, subscribed detail information for specific characters they're interested in.

**Implementation Considerations**:
- Could use different stream keys (e.g., `character-overview` vs `character-${characterId}`)
- Overview subscription could aggregate data from multiple character detail streams
- Would require careful design to avoid data duplication and ensure consistency

### **Performance Optimizations**
- **Batch Processing**: Process multiple character changes in batches
- **Selective Updates**: Only process character changes when necessary
- **Caching**: Optimize character data retrieval and caching

## Navigation

### **Related Documentation**
- **[Assets Data Source](../dataSource/AGENT.md)**: Main assets data source implementation
- **[DataSource Pattern](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)**: Base DataSource pattern documentation
- **[Asset Caching](../dataSource/caching/AGENT.md)**: Current asset caching implementation

### **Implementation Files**
- **Main Implementation**: `lambda/assets/characters/index.ts` (to be created)
- **Event Types**: `lambda/assets/characters/types.ts` (to be created)
- **Tests**: `lambda/assets/characters/index.test.ts` (to be created)

---

*This design provides a clean separation of character-specific event handling while maintaining consistency with the established DataSource pattern and ensuring backward compatibility with existing character event consumers.*
