# Available Characters Lambda - Agent Navigation Guide

## Overview

The `availableCharacters` lambda is a specialized data source that provides real-time information about which characters are available for players to select and play. It transforms raw character change events from the assets system into a focused, filtered stream of character availability information that clients can subscribe to.

## Core Purpose

- **Character Availability Logic**: Determines which characters are available for play based on authorization status and asset access
- **Real-Time Updates**: Provides live updates when character availability changes
- **Client Subscription Management**: Manages client subscriptions to character availability streams
- **Data Transformation**: Converts complex character change events into simple availability status updates

## Key Concepts

### Character Availability Rules

The system implements the following availability logic:

1. **Taken Characters**: Characters with current Authorization for any player are never available
2. **Canon Characters**: Characters in Canon assets are available to anyone (no Authorization required)
3. **Conditional Characters**: Characters in Library and Personal assets are only available to users with access to those assets

### Event-Driven Architecture

The lambda follows the established event-driven pattern:
- **Input**: Subscribes to `mtw.assets` character events (`Character Updated`, `Character Removed`)
- **Processing**: Applies availability logic and maintains internal state
- **Output**: Publishes `AvailableCharacter` events for client consumption

## Architecture

### Event Flow

```
Assets Lambda (Character Changes)
    ↓
EventBridge (Character Updated/Removed)
    ↓
Available Characters Lambda
    ↓
EventBridge (AvailableCharacter Events)
    ↓
Subscriptions Lambda → Client
```

### Internal State Management

The lambda maintains:
- **Character Registry**: Current availability status of all characters
- **Asset Access Mapping**: Which characters belong to which assets/zones
- **Authorization Cache**: Current player-character authorizations
- **Subscription State**: Active client subscriptions and their filters

## Data Sources

### Input Events

Subscribes to the following EventBridge events:

#### `Character Updated` (from `mtw.assets`)
```typescript
{
    source: 'mtw.assets',
    detailType: 'Character Updated',
    detail: {
        characterId: string,
        byAssets: Array<{
            AssetId: string,
            component: StandardCharacterData
        }>
    }
}
```

#### `Character Removed` (from `mtw.assets`)
```typescript
{
    source: 'mtw.assets',
    detailType: 'Character Removed',
    detail: {
        characterId: string
    }
}
```

### Output Events

Publishes the following EventBridge events:

#### `AvailableCharacter` (for client consumption)
```typescript
{
    source: 'mtw.availableCharacters',
    detailType: 'AvailableCharacter',
    detail: {
        characterId: string,
        name: string,
        available: boolean,
        assetAccess: Array<{
            assetId: string,
            zone: 'Canon' | 'Library' | 'Personal',
            player?: string
        }>,
        availabilityReason: 'Available to All' | 'Conditional Access' | 'Taken'
    }
}
```

## API Outlets

### Client Subscription Management

- **subscribe**: Client subscribes to character availability updates
- **unsubscribe**: Client unsubscribes from character availability updates
- **fetchSnapshot**: Client requests current state of available characters

### Internal Management

- **refreshAvailability**: Force refresh of availability calculations
- **updateAuthorization**: Update character authorization status
- **healthCheck**: System health and status information

## Integration Points

### Dependencies

- **Assets Lambda**: Source of character change events
- **EventBridge**: Event routing and delivery
- **DynamoDB**: Internal state persistence and caching
- **Subscriptions Lambda**: Client subscription management

### Cross-References

- **[Assets Lambda](../assets/AGENT.md)**: Character change event source
- **[Subscriptions Lambda](../subscriptions/AGENT.md)**: Client subscription infrastructure
- **[Event Architecture](../../AGENT.architecture.events.md)**: Overall event flow patterns

## Usage Patterns

### Client Subscription

```typescript
// Client subscribes to available characters
await dispatch(socketDispatchPromise({
    message: 'subscribe',
    source: 'mtw.availableCharacters',
    detailType: 'AvailableCharacter'
}, { service: 'subscriptions' }))

// Client receives availability updates
LifeLinePubSub.subscribe(({ payload }) => {
    if (payload.messageType === 'AvailableCharacter') {
        // Handle character availability update
        const { characterId, available, assetAccess } = payload
        // Update UI accordingly
    }
})
```

### Event Processing

```typescript
// Lambda processes character update event
export const handleCharacterUpdated = async (event: CharacterUpdatedEvent) => {
    const { characterId, byAssets } = event.detail
    
    // Update internal character registry
    await updateCharacterRegistry(characterId, byAssets)
    
    // Calculate new availability status
    const availability = await calculateAvailability(characterId)
    
    // Publish availability event if status changed
    if (availability.changed) {
        await publishAvailableCharacterEvent(characterId, availability)
    }
}
```

## Development Notes

### Current State

- **Initial Setup**: Basic lambda structure and configuration established
- **Event Subscription**: Ready to subscribe to assets character events
- **Availability Logic**: Design complete, implementation pending
- **Client Integration**: Integration points identified with subscriptions lambda

### Implementation Phases

1. **Phase 1: Event Subscription** - Subscribe to assets character events
2. **Phase 2: Availability Logic** - Implement character availability rules
3. **Phase 3: State Management** - Internal character registry and caching
4. **Phase 4: Client Events** - Publish available character events
5. **Phase 5: Client Integration** - Connect with subscriptions lambda

### Future Considerations

- **Authorization Integration**: Real-time authorization status updates
- **Performance Optimization**: Efficient availability calculations for large character sets
- **Advanced Filtering**: Client-specific availability filtering
- **Caching Strategy**: Optimize for read-heavy availability queries

## Navigation Tips

### Getting Started

1. **Review Event Flow**: Understand how character events flow from assets to clients
2. **Study Availability Logic**: Review the three-tier availability rules
3. **Check Integration Points**: See how this fits with existing subscription infrastructure
4. **Review Event Patterns**: Study the established EventBridge event formats

### Key Files

- `app.ts`: Main lambda handler and event routing
- `availabilityLogic/`: Character availability calculation engine
- `characterRegistry/`: Internal character state management
- `eventHandlers/`: Event processing and transformation logic

### Related Documentation

- **[Assets Lambda](../assets/AGENT.md)**: Character change event source
- **[Subscriptions Lambda](../subscriptions/AGENT.md)**: Client subscription management
- **[Event Architecture](../../AGENT.architecture.events.md)**: Overall event flow design
- **[Data Source Philosophy](../../AGENT.architecture.philosophy.md)**: Architectural principles
