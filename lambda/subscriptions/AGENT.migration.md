# Subscriptions Lambda - DataSource Pattern Migration Plan

## Overview

The subscriptions lambda currently uses a custom handler framework that predates the standardized DataSource patterns. This migration plan outlines the changes needed to align the subscriptions lambda with the modern DataSource architecture used throughout the Make The World system.

## Current State Analysis

### Current Implementation
- **Custom Handler Framework**: Uses `SubscriptionHandler` and `SubscriptionLibrary` classes
- **Manual Event Processing**: Direct EventBridge event handling without deserialization
- **Basic Transformation**: Simple event-to-client message transformation
- **Limited Event Types**: Only handles WML events (Merge Conflict, Content Update)
- **Direct WebSocket Delivery**: Bypasses SNS Feedback for client delivery

### Current Event Flow
1. **EventBridge Event** → Direct processing in `app.ts`
2. **Manual Transformation** → `SubscriptionHandler.transform()` function
3. **Direct WebSocket Delivery** → `apiClient.send()` to connections
4. **No Replay Support** → No historical data or subscription initialization

## Target State (Serialized Data Alignment)

### Aligned Serialization Patterns
- **Consistent Stream Key Representation**: Use `streamKey` terminology consistent with DataSource patterns
- **Standardized Event Format**: Align EventBridge event structure with DataSource external formats
- **Unified Subscription Management**: Use consistent subscription key patterns across all data sources
- **Compatible Message Transmission**: Ensure serialized messages work with WebSocket delivery
- **Maintained Event Passing Role**: Continue as a pass-through service for serialized EventBridge events

### Target Event Flow
1. **EventBridge Event** → Receive serialized events from data sources
2. **Stream Key Extraction** → Extract `streamKey` using consistent patterns
3. **Subscription Lookup** → Find subscribers using aligned subscription key format
4. **Message Delivery** → Transmit serialized events to WebSocket connections

## Migration Gaps Identified

### 1. **Stream Key Representation Inconsistency**

#### Current Format (Subscriptions)
```typescript
// Current: Uses detailExtract for stream identification
{
    source: 'mtw.wml',
    detailType: 'Content Update',
    detailExtract: (event) => event.AssetId, // 'ASSET#123'
    // Subscription stored as: STREAM#mtw.wml::Content Update::ASSET#123
}
```

#### Target Format (Aligned with DataSource)
```typescript
// Target: Use streamKey terminology consistently
{
    source: 'mtw.wml',
    detailType: 'Content Update',
    streamKey: 'ASSET#123', // Consistent with DataSource pattern
    // Subscription stored as: STREAM#mtw.wml::Content Update::ASSET#123
}
```

### 2. **EventBridge Event Structure Alignment**

#### Current Format (Subscriptions)
```typescript
// Current: Direct EventBridge format
{
    source: 'mtw.wml',
    detailType: 'Content Update',
    AssetId: 'ASSET#123',
    RequestId: 'uuid',
    schema: { /* WML schema */ }
}
```

#### Target Format (Aligned with DataSource External Format)
```typescript
// Target: Align with DataSource external event structure
{
    source: 'mtw.wml',
    detailType: 'Content Update',
    Detail: {
        streamKey: 'ASSET#123',
        update: {
            type: 'Content Update',
            AssetId: 'ASSET#123',
            RequestId: 'uuid',
            schema: { /* WML schema */ }
        }
    }
}
```

### 3. **Limited Event Type Coverage**

#### Current: WML Only
```typescript
// Only handles WML events
{
    source: 'mtw.wml',
    detailType: 'Merge Conflict' | 'Content Update'
}
```

#### Target: Full DataSource Coverage
```typescript
// Should handle all DataSource events with consistent streamKey extraction
{
    source: 'mtw.wml' | 'mtw.assets' | 'mtw.ephemera' | 'mtw.players' | 'mtw.connections'
    detailType: 'Component Updated' | 'Asset Modified' | 'Character Updated' | /* etc */
    streamKey: 'ASSET#123' | 'CHARACTER#456' | 'PLAYER#789' // Consistent extraction pattern
}
```

### 4. **Inconsistent Subscription Key Patterns**

#### Current: Custom detailExtract Logic
```typescript
// Each handler defines its own detailExtract function
detailExtract: (event) => event.AssetId,           // WML events
detailExtract: (event) => event.CharacterId,       // Ephemera events
detailExtract: (event) => event.PlayerId,          // Player events
```

#### Target: Standardized streamKey Extraction
```typescript
// Consistent streamKey extraction across all event types
streamKey: event.Detail?.streamKey || extractStreamKey(event)
// Where extractStreamKey uses consistent patterns based on event source/type
```

### 5. **Message Format Inconsistency**

#### Current: Custom Transform Functions
```typescript
// Each handler defines custom transformation
transform: (event) => ({
    messageType: 'Subscription',
    source: 'mtw.wml',
    detailType: 'Content Update',
    AssetId: event.AssetId,
    RequestId: event.RequestId
})
```

#### Target: Standardized Message Format
```typescript
// Consistent message format aligned with DataSource external format
transform: (event) => ({
    messageType: 'Subscription',
    dataSourceKey: event.source,
    detailType: event.detailType,
    streamKey: event.Detail?.streamKey,
    update: event.Detail?.update || event.Detail
})
```

## Migration Strategy

### Phase 1: Stream Key Alignment

#### 1.1 Standardize Stream Key Extraction
Replace custom `detailExtract` functions with consistent `streamKey` extraction:

```typescript
// subscriptions/streamKeyExtractors/index.ts
export function extractStreamKey(event: EventBridgeEvent): string {
    const { source, detailType, detail } = event
    
    // Use consistent patterns based on DataSource external format
    if (detail?.streamKey) {
        return detail.streamKey
    }
    
    // Fallback to legacy extraction patterns
    switch (source) {
        case 'mtw.wml':
            return detail?.AssetId || `ASSET#${extractIdFromDetail(detail)}`
        case 'mtw.assets':
            return detail?.AssetId || detail?.ComponentId || `COMPONENT#${extractIdFromDetail(detail)}`
        case 'mtw.ephemera':
            return detail?.CharacterId || detail?.EphemeraId || `EPHEMERA#${extractIdFromDetail(detail)}`
        case 'mtw.players':
            return detail?.PlayerId || `PLAYER#${extractIdFromDetail(detail)}`
        case 'mtw.connections':
            return detail?.SessionId || `SESSION#${extractIdFromDetail(detail)}`
        default:
            return `UNKNOWN#${extractIdFromDetail(detail)}`
    }
}
```

#### 1.2 Update Handler Framework
Modify the existing handler framework to use `streamKey` instead of `detailExtract`:

```typescript
// subscriptions/handlerFramework/baseClasses.ts
export class SubscriptionHandler {
    _source: string;
    _detailType?: string;
    _streamKeyExtractor?: (event: Record<string, any>) => string;
    _transform?: (event: Record<string, any>) => SubscriptionClientMessage;
    
    constructor(args: {
        source: string;
        detailType?: string;
        streamKeyExtractor?: (event: Record<string, any>) => string; // Replaces detailExtract
        transform?: (event: Record<string, any>) => SubscriptionClientMessage;
    }) {
        this._source = args.source
        this._detailType = args.detailType
        this._streamKeyExtractor = args.streamKeyExtractor
        this._transform = args.transform
    }
    
    async subscribe(message: SubscribeAPIMessage, sessionId: `SESSION#${string}`): Promise<void> {
        const streamKey = this._streamKeyExtractor ? this._streamKeyExtractor(message) : extractStreamKey(message)
        const ConnectionId = `STREAM#${this._source}${this._detailType ? `::${this._detailType}` : ''}${streamKey ? `::${streamKey}` : ''}`
        await connectionDB.putItem({
            ConnectionId,
            DataCategory: sessionId
        })
    }
}
```

### Phase 2: Event Format Standardization

#### 2.1 Align with DataSource External Format
Update event processing to expect DataSource external format:

```typescript
// subscriptions/app.ts
if (event?.source) {
    // Expect DataSource external format with Detail.streamKey
    const eventData = {
        source: event.source,
        detailType: event["detail-type"],
        streamKey: event.detail?.streamKey || extractStreamKey(event),
        detail: event.detail
    }
    
    const match = subscriptionLibrary.matchEvent(eventData)
    if (match) {
        await match.publish(eventData)
    }
}
```

#### 2.2 Standardize Message Transformation
Replace custom transform functions with standardized format:

```typescript
// subscriptions/handlerFramework/baseClasses.ts
export function createStandardTransform(source: string): (event: any) => SubscriptionClientMessage {
    return (event) => ({
        messageType: 'Subscription',
        dataSourceKey: source,
        detailType: event.detailType,
        streamKey: event.streamKey,
        update: event.detail?.update || event.detail
    })
}

// Update handler library
export const subscriptionLibrary = subscriptionLibraryConstructor([
    {
        source: 'mtw.wml',
        detailType: 'Merge Conflict',
        transform: createStandardTransform('mtw.wml')
    },
    {
        source: 'mtw.wml',
        detailType: 'Content Update',
        transform: createStandardTransform('mtw.wml')
    }
])
```

### Phase 3: Enhanced Event Coverage

#### 3.1 Add Support for All DataSource Events
Expand the subscription library to handle all data source events:

```typescript
// subscriptions/handlerFramework/index.ts
export const subscriptionLibrary = subscriptionLibraryConstructor([
    // WML Events
    {
        source: 'mtw.wml',
        detailType: 'Merge Conflict',
        transform: createStandardTransform('mtw.wml')
    },
    {
        source: 'mtw.wml',
        detailType: 'Content Update',
        transform: createStandardTransform('mtw.wml')
    },
    {
        source: 'mtw.wml',
        detailType: 'Content Removed',
        transform: createStandardTransform('mtw.wml')
    },
    
    // Assets Events
    {
        source: 'mtw.assets',
        detailType: 'Component Updated',
        transform: createStandardTransform('mtw.assets')
    },
    {
        source: 'mtw.assets',
        detailType: 'Asset Modified',
        transform: createStandardTransform('mtw.assets')
    },
    
    // Ephemera Events
    {
        source: 'mtw.ephemera',
        detailType: 'Character Updated',
        transform: createStandardTransform('mtw.ephemera')
    },
    
    // Players Events
    {
        source: 'mtw.players',
        detailType: 'Player Updated',
        transform: createStandardTransform('mtw.players')
    },
    
    // Connections Events
    {
        source: 'mtw.connections',
        detailType: 'Session Disconnect',
        transform: createStandardTransform('mtw.connections')
    }
])
```


## Implementation Timeline

### Week 1: Stream Key Alignment
- [ ] Create standardized `extractStreamKey` function
- [ ] Update `SubscriptionHandler` to use `streamKey` instead of `detailExtract`
- [ ] Update existing WML event handlers to use new stream key extraction
- [ ] Test stream key extraction with current WML events

### Week 2: Event Format Standardization
- [ ] Update event processing to expect DataSource external format
- [ ] Implement standardized message transformation functions
- [ ] Update subscription library to use consistent transform patterns
- [ ] Test message format compatibility with existing clients

### Week 3: Event Coverage Expansion
- [ ] Add handlers for Assets, Ephemera, Players, and Connections events
- [ ] Update subscription logic to handle all DataSource event types
- [ ] Test event delivery across all data sources
- [ ] Verify stream key extraction works for all event types

### Week 4: Testing and Validation
- [ ] Comprehensive testing of all event types
- [ ] Performance testing of stream key extraction
- [ ] Client compatibility testing
- [ ] Documentation updates

## Client-Side Impact

### WebSocket Message Format Changes

#### Current Format
```typescript
{
    messageType: 'Subscription',
    source: 'mtw.wml',
    detailType: 'Content Update',
    AssetId: 'ASSET#123',
    RequestId: 'uuid',
    schema: { /* WML schema */ }
}
```

#### Target Format (Aligned with DataSource External Format)
```typescript
{
    messageType: 'Subscription',
    dataSourceKey: 'mtw.wml',
    detailType: 'Content Update',
    streamKey: 'ASSET#123',
    update: {
        type: 'Content Update',
        AssetId: 'ASSET#123',
        RequestId: 'uuid',
        schema: { /* WML schema */ }
    }
}
```

### Client Migration Requirements
- [ ] Update client-side message parsing to handle `dataSourceKey` instead of `source`
- [ ] Update client-side message parsing to handle `streamKey` field
- [ ] Update client-side message parsing to handle nested `update` object
- [ ] Update subscription request handling for new data source keys
- [ ] Test client compatibility with new event format
- [ ] Maintain backward compatibility during transition period

## Testing Strategy

### Unit Tests
- [ ] Test stream key extraction for each data source
- [ ] Test standardized message transformation functions
- [ ] Test subscription handler framework updates
- [ ] Test WebSocket delivery mechanism

### Integration Tests
- [ ] Test end-to-end event flow from EventBridge to client
- [ ] Test subscription management and cleanup
- [ ] Test error handling and recovery
- [ ] Test backward compatibility with existing clients

### Performance Tests
- [ ] Test high-volume event processing
- [ ] Test concurrent subscription handling
- [ ] Test WebSocket delivery performance
- [ ] Test stream key extraction performance

## Rollback Plan

### Immediate Rollback
- Revert to previous version of handler framework with `detailExtract`
- Restore custom transform functions if standardized format fails
- Maintain feature flags for gradual migration

### Gradual Rollback
- Maintain both old and new processing paths with feature flags
- Gradually migrate event types from old to new processing
- Monitor error rates and performance during transition
- Keep legacy message format support during transition

## Success Criteria

### Functional Requirements
- [ ] All current event types (WML Merge Conflict, Content Update) continue working
- [ ] New event types (Assets, Ephemera, Players, Connections) are supported
- [ ] Stream key extraction works consistently across all data sources
- [ ] Message format is aligned with DataSource external format
- [ ] Subscription management (subscribe/unsubscribe) continues working
- [ ] Client-side message format is backward compatible or properly migrated

### Performance Requirements
- [ ] Event processing latency remains under 100ms
- [ ] WebSocket delivery success rate remains above 99%
- [ ] No increase in lambda execution time or memory usage
- [ ] Stream key extraction performance is acceptable

### Quality Requirements
- [ ] All existing tests pass
- [ ] New tests cover stream key alignment and format standardization
- [ ] Error handling and logging are improved
- [ ] Code follows project standards and patterns
- [ ] Consistent terminology and patterns across the system

## Future Enhancements

### Advanced Features
- [ ] Dynamic event type discovery and subscription
- [ ] Subscription analytics and monitoring
- [ ] Event filtering based on stream key patterns
- [ ] Custom event routing based on client preferences

### Integration Improvements
- [ ] Integration with centralized event schema registry
- [ ] Automatic stream key pattern recognition
- [ ] Event versioning and backward compatibility
- [ ] Cross-region event replication support
- [ ] Enhanced WebSocket delivery options

---

*This migration plan aligns the subscriptions lambda with the modern DataSource architecture while maintaining backward compatibility and improving system reliability and maintainability.*
