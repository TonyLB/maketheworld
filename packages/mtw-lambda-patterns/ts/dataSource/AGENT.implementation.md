# DataSource Pattern - Implementation Guide

## Overview

This document provides detailed implementation information for the DataSource pattern. For high-level usage guidance, see [AGENT.md](./AGENT.md).

## Technical Details

### **Live vs Replay Event Delivery**

The DataSource pattern uses two different delivery mechanisms depending on the context:

- **Live Events** (`streamEvent`): New changes are published to EventBridge for fan-out to all current subscribers
- **Replay Events** (`initializeSubscription`): Historical data is delivered directly to a specific session via SNS Feedback (when replay is enabled)

This dual approach ensures efficient delivery while maintaining the correct scope for each type of event.

### **Replay Content**: The method delivers:
1. **Current Snapshot**: The most recent materialized state for the stream
2. **Recent Events**: Events that occurred since the snapshot was created
3. **Complete Context**: Everything the subscriber needs to understand the current state

### **SNS Feedback Delivery**: Replay data is delivered via the Feedback SNS topic, which allows:
- **Targeted Delivery**: Data goes directly to the specified `sessionId`
- **No Fan-out**: Avoids broadcasting historical data to all subscribers
- **Efficient Replay**: Only the requesting session receives the replay data
- **WebSocket Integration**: SNS messages are delivered to the session's WebSocket connection

### **Integration with MessageBus**: The data source integrates seamlessly with the existing messageBus pattern:
- **Type Safety**: Full TypeScript integration with type guards derived from `receiveEvent` signature
- **Priority Ordering**: Events are processed according to messageBus priority system
- **Error Handling**: Graceful failure without breaking other messageBus handlers
- **Stream Processing**: Events persist in messageBus for multiple handler consumption

### **EventBridge Integration**: The subscription system works with the broader EventBridge architecture:
- **Event Reception**: Lambda receives EventBridge events and deserializes them to internal format before routing to messageBus
- **Type Filtering**: Data source only processes events it's interested in via type guards
- **State Derivation**: Incoming events are processed into local state changes
- **Event Propagation**: Local changes are serialized and streamed to subscribers via EventBridge

### **Serialization Boundaries**: The serializer is applied at three key boundaries:
- **EventBridge Publishing**: Internal `UpdatePayload` → `ExternalUpdatePayload` for EventBridge
- **DynamoDB Storage**: Internal `UpdatePayload` → `ExternalUpdatePayload` for replay storage
- **Replay Delivery**: Stored `ExternalUpdatePayload` → delivered via SNS (no re-serialization needed)

### **Type Constraints**:
- **`UpdatePayload`**: Can be any type (class instances, functions, complex objects)
- **`ExternalUpdatePayload`**: Must be `string | SerializableObject` for EventBridge compatibility

### **Benefits**:
- **Type Safety**: Internal types stay internal, external contracts are explicit
- **Evolution Independence**: Internal and external events can evolve separately
- **Clean Architecture**: Clear separation of concerns between business logic and external integration
- **Performance**: Avoids unnecessary deserialize/serialize cycles in replay operations
- **Flexibility**: Rich internal types with EventBridge-compatible external formats
- **Consistency**: Class-based approach provides uniform implementation pattern across all serializers

### **Event Processing Flow**:
- **Outgoing**: DataSource → (1) internal format → messageBus for local processing, (2) serialize → EventBridge/DynamoDB for external distribution
- **Incoming**: EventBridge → deserialize → messageBus → DataSource processing

### **Current Event Processing Limitation**:
**N-to-1 Aggregation Gap**: The current implementation processes incoming events independently one-by-one in the `receiveEvent` method. This design cannot handle **aggregation patterns** where multiple related events need to be collected and processed together to generate a single derived event.

**Impact**: Data sources that need to:
- Wait for multiple related events before generating output
- Aggregate state changes from multiple sources into a single derived event
- Implement complex event correlation patterns

Are not yet supported by the current DataSource pattern implementation.

**Development Status**: This limitation is being addressed as part of the `contentHeaders` data source implementation in the `assets` lambda. The enhanced pattern will support event aggregation capabilities.

## Timestamp Handling Strategy

The DataSource pattern uses a consistent timestamp strategy across all event and storage operations.

### **Timestamp Storage Locations**:
- **DynamoDB Records**: Timestamp embedded in `DataCategory` field as `EVENT#${timestamp}::${uuid}` (no separate timestamp field)
- **Replayable Snapshots**: Timestamp included in snapshot metadata for replayable data sources
- **Non-Replayable getSnapshot()**: Throws error - snapshots are not supported for non-replayable data sources
- **MessageBus Events**: Timestamp included in event metadata for internal coordination
- **EventBridge Events**: No timestamp in Detail payload (EventBridge provides automatic timestamps)

### **Timestamp Extraction Pattern**:
- **Single Source of Truth**: Timestamps extracted once from `DataCategory` in `getRecentEvents()`
- **Clean Data Flow**: Raw DynamoDB data → processed data with extracted timestamp → usage
- **No Redundancy**: Avoids storing timestamps in multiple places or passing around raw `DataCategory` strings

### **Implementation Details**:
- **Storage**: `DataCategory: 'EVENT#${getCurrentTimestamp()}::${uuidv4()}'`
- **Extraction**: `parseInt(DataCategory.split('::')[0].replace('EVENT#', ''))`
- **Sorting**: Events sorted by extracted timestamp for chronological replay
- **Delivery**: Clean timestamp field passed to replay consumers

### **Benefits**:
- **Consistency**: Single timestamp source eliminates sync issues
- **Efficiency**: No redundant timestamp storage in DynamoDB records
- **Clarity**: Clean separation between metadata (timestamps) and payload data
- **Performance**: Minimal storage overhead while maintaining full temporal ordering

## Data Storage Strategy

### **Local DynamoDB Table** (Optional - when `replayable` is enabled)
Each replayable data source maintains a local DynamoDB table for replay data across multiple subscribable streams. The Primary Key will be variable (`AssetId`, `EphemeraId`, and so on), but the general pattern will be that all stream records have a PK of `STREAM#${dataSourceKey}::${streamIdentifier}`.

This granular PK structure enables (when replay is enabled):
- **Stream Isolation**: Each stream maintains its own snapshot and event history
- **Efficient Querying**: Direct access to specific stream data without filtering
- **Concurrent Operations**: Multiple streams can be processed simultaneously without conflicts
- **Scalable Architecture**: Support for large numbers of streams within a single data source

### **Record Types** (when replay is enabled):
- **Snapshot Records**: DataCategory of `Meta::Snapshot` - Contains the complete current state for a specific stream
- **Event Records**: DataCategory of `EVENT#${epochTime}::${uuid}` - Contains incremental changes for a specific stream

### **Naming Conventions**

**Data Source Keys**: The `dataSourceKey` parameter should use the full EventBridge source naming convention for consistency:

- **Primary Data Sources**: Use the full EventBridge source name (e.g., `'mtw.assets'`, `'mtw.ephemera'`, `'mtw.connections'`)
- **Sub-Sources**: For specialized data sources within a larger service, extend the pattern (e.g., `'mtw.assets.contentHeaders'`, `'mtw.assets.characterData'`)

This naming convention ensures that:
- **DynamoDB Keys**: Use the same identifier as EventBridge sources (`STREAM#mtw.assets::streamKey`)
- **EventBridge Events**: Use the same source identifier (`Source: 'mtw.assets'`)
- **Code Clarity**: Makes it immediately clear which service/system owns each data source
- **Consistency**: Eliminates confusion between different naming schemes across the system

## EventBridge Integration Patterns

### **Incoming Event Processing**
The DataSource pattern integrates with EventBridge through a standardized messageBus routing pattern:

**Event Reception**: Lambda handlers receive EventBridge events, deserialize them to internal format, and route them to messageBus.
**Data Source Subscription**: Data sources automatically subscribe to relevant internal format events using their configured type guards and event processing functions.

### **EventBridge Architecture Simplification**
The subscription system enables a simplified EventBridge architecture:

**Before**: Complex EventBridge routing with multiple direct subscriptions
- Each lambda directly subscribes to multiple EventBridge event types
- Complex routing logic in each lambda handler
- Tight coupling between event sources and consumers

**After**: Centralized messageBus routing with data source subscriptions
- Single EventBridge event handler deserializes all events and routes them to messageBus
- Data sources subscribe to messageBus internal format events they care about
- Loose coupling with type-safe event processing
- Easier testing and maintenance

**Benefits**:
- **Simplified Event Handling**: Single point of EventBridge event reception
- **Type Safety**: Full TypeScript integration with derived type guards
- **Flexible Routing**: Data sources can subscribe to any messageBus event type
- **Better Testing**: MessageBus events can be easily mocked and tested
- **Performance**: Reduced EventBridge subscription complexity

### **EventBridge Serialization**

The DataSource pattern supports optional event serialization to maintain clean separation between internal messageBus events and external EventBridge events.

**Purpose**: Enable DataSources to maintain clean internal event processing while supporting proper external event contracts for cross-service communication.

**Method**: `eventSerializer` constructor parameter - Optional serializer for EventBridge integration
- **`serialize(params)`**: Convert internal update payload to external format for EventBridge Detail
- **`deserialize(params)`**: Convert external update payload back to internal format

**Standard Pattern**: Use class-based serializers for better type safety, testability, and reusability:

```typescript
// Define serializer as a class for better type safety and testability
export class MyEventSerializer implements DataSourceEventSerializer<MyInternalType, MyExternalType> {
    serialize({ update }: { update: MyInternalType }): MyExternalType {
        // Transform internal update to external format
        return { /* external format */ }
    }
    
    deserialize(params: { 
        dataSourceKey: string; 
        detailType: string; 
        streamKey: string; 
        externalUpdate: MyExternalType 
    }): MyInternalType | null {
        // Transform external format back to internal update
        return /* internal update */
    }
}

// Use in DataSource
const myDataSource = new MyDataSource({
    dataSourceKey: 'mtw.mydomain',
    eventSerializer: new MyEventSerializer(),
    // ... other params
})
```

**Key Principles**:
- **Internal Format**: Clean, domain-specific representations optimized for manipulation (`StandardComponent`, embedded `type` properties)
- **External Format**: Transmittable representations optimized for cross-service communication (WML strings, `detailType` metadata)
- **Boundary Enforcement**: Serialization only occurs at the EventBridge boundary
- **Type Safety**: Full TypeScript support for both internal and external event structures

## Generic Type System

The DataSource pattern uses a sophisticated generic type system to ensure type safety across different DynamoDB table configurations.

### **KeyType Generic Parameter**
The `DataSource` class is generic over `KeyType` to properly type DynamoDB interactions:

```typescript
export class DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent, ExternalUpdatePayload, KeyType extends string>
```

### **DynamoUtils Interface**
The `DynamoUtils` interface is generic over `KeyType` to match the underlying DynamoDB client types:

```typescript
export type DynamoUtils<KeyType extends string = string> = {
    putItem: (item: any) => Promise<unknown>
    getItem: <Get extends Partial<Record<string, any> & Record<KeyType, string> & { DataCategory: string }>>(args: any) => Promise<Get | undefined>
    query: <Query extends Record<string, any> & Record<KeyType, string> & { DataCategory: string }>(args: any) => Promise<Query[]>
    optimisticUpdate: (params: any) => Promise<any>
}
```

### **Type Safety Benefits**
- **Compile-time Validation**: TypeScript ensures correct key usage at compile time
- **IntelliSense Support**: IDE provides accurate autocomplete for key operations
- **Refactoring Safety**: Changes to key names are caught by the type system
- **Documentation**: Types serve as inline documentation for expected key structure

### **Usage in Lambda-specific Base Classes**
Lambda-specific base classes extend the generic DataSource with concrete key types:

```typescript
// Assets lambda uses 'AssetId' as primary key
export class AssetsDataSource<...> extends DataSource<..., 'AssetId'>

// Ephemera lambda uses 'EphemeraId' as primary key  
export class EphemeraDataSource<...> extends DataSource<..., 'EphemeraId'>
```

## Error Handling and Edge Cases

### **Non-Replayable Data Source Behavior**
- **`getSnapshot()`**: Throws error - snapshots are not supported for non-replayable data sources
- **`initializeSubscription()`**: Throws error - subscription initialization is not supported
- **DynamoDB Operations**: Skipped entirely to save resources
- **Event Streaming**: Still works normally for EventBridge publishing

### **Timestamp Parsing Safety**
- **Null Checks**: Added safety checks for undefined `DataCategory` fields
- **Fallback Values**: Default to timestamp `0` when parsing fails
- **Error Recovery**: Graceful degradation when timestamp extraction fails

### **Event Serialization Failures**
- **Deserialization Errors**: Return `null` when external events cannot be parsed
- **Type Validation**: Validate external event structure before processing
- **Logging**: Log serialization failures for debugging

## Performance Considerations

### **SingleFlight Coordination**
- **Distributed Locking**: Prevents multiple lambda instances from generating snapshots simultaneously
- **Cache Efficiency**: Reuses snapshot generation results across lambda instances
- **Resource Optimization**: Minimizes redundant snapshot generation operations

### **Parallel Operations**
- **DynamoDB + EventBridge**: Storage and publishing operations run in parallel
- **Stream Independence**: Different streams can be processed concurrently
- **Event Processing**: Multiple incoming events can be processed in parallel

### **Memory Management**
- **Snapshot Caching**: In-memory caching with expiration for frequently accessed snapshots
- **Event Batching**: Potential for batch processing multiple events (future enhancement)
- **Resource Cleanup**: Automatic cleanup of expired cache entries

## Testing Implementation

### **Mock Strategy**
- **DynamoDB Mocks**: Mock all DynamoDB operations with resolved promises
- **EventBridge Mocks**: Mock EventBridge publishing operations
- **SNS Mocks**: Mock SNS feedback operations for replay delivery
- **Timestamp Mocks**: Mock `getCurrentTimestamp()` for predictable test results

### **Test Coverage**
- **Unit Tests**: Individual method functionality with mocked dependencies
- **Integration Tests**: Full pipeline testing with real AWS service interactions
- **Error Scenarios**: Network failures, serialization errors, invalid data
- **Performance Tests**: Large dataset handling, concurrent operations

### **Test Data Patterns**
- **Consistent Stream Keys**: Use consistent test stream identifiers
- **Realistic Payloads**: Use realistic data structures in tests
- **Edge Cases**: Test boundary conditions and error states
- **Type Safety**: Ensure tests validate TypeScript type constraints

## Future Implementation Considerations

### **Claim-Check Pattern**
For large snapshots or event contents, implement S3 storage with claim-check records:
- **S3 Storage**: Push large payloads to S3 with pre-signed URLs
- **Claim-Check Records**: Store metadata with S3 object references
- **Delivery Optimization**: Reduce message size while maintaining data access

### **Metrics and Monitoring**
- **Performance Metrics**: Track snapshot generation time, event processing latency
- **Error Rates**: Monitor serialization failures, DynamoDB errors
- **Resource Usage**: Track memory usage, cache hit rates
- **Business Metrics**: Event throughput, subscriber counts

### **Retention Policies**
- **Configurable Retention**: Allow per-data-source retention configuration
- **Automatic Cleanup**: Implement background cleanup of expired data
- **Storage Optimization**: Compress old events, archive historical data

### **Advanced Event Processing**
- **Event Aggregation**: Support for N-to-1 aggregation patterns where multiple related events are collected and processed together to generate a single derived event (currently in development)
- **Batch Processing**: Process multiple events in batches for efficiency
- **Event Ordering**: Guarantee ordered processing for events from the same source
- **Dead Letter Queues**: Handle failed event processing with retry logic
- **Event Validation**: Built-in validation for external EventBridge event formats

### **Event Aggregation Enhancement** (In Development)
The current one-by-one event processing model will be enhanced to support aggregation patterns:

**Planned Capabilities**:
- **Event Buffering**: Collect related events within configurable time windows
- **Aggregation Logic**: Process multiple events together to generate derived state changes
- **Correlation Keys**: Group related events using correlation identifiers
- **Configurable Triggers**: Define conditions that trigger aggregation processing

**Implementation Approach**:
- Extend `receiveEvent` to support both immediate and buffered processing modes
- Add event correlation and aggregation state management
- Maintain backward compatibility with existing one-by-one processing
- Support for both simple aggregation (count, sum) and complex aggregation (custom business logic)

**Use Cases**:
- Content headers derived from multiple asset changes
- Analytics metrics aggregated from multiple event sources
- Complex business rules requiring multiple event correlation

---

**For usage guidance and high-level concepts, see [AGENT.md](./AGENT.md)**
