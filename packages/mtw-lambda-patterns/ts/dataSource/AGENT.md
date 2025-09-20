# DataSource Pattern - Usage Guide

## Overview

The `DataSource` pattern provides a standardized foundation for implementing data sources in Make The World's Domain-Authoritative Event Mesh architecture. This pattern enables each lambda to serve as a domain-authoritative data source with consistent capabilities for state management, event streaming, and subscriber replay support across multiple subscribable streams.

## Core Purpose

The DataSource pattern addresses four critical needs for data source implementation:

- **Snapshot Generation**: Create materialized state snapshots for individual streams within data categories
- **Event Streaming**: Stream filtered change events to subscribers for specific streams
- **Replay Support**: (Optional) Store and fetch snapshots and recent events for new subscriber onboarding to individual streams
- **Event Subscription**: Subscribe to incoming events from other data sources and process them into local state changes

## Replayable vs Non-Replayable Data Sources

The DataSource pattern supports two operational modes based on the `replayable` constructor parameter:

### **Replayable Data Sources** (Default: `replayable: true`)
These data sources support full subscription functionality including:
- **Snapshot Generation**: Create and store materialized state snapshots
- **Event History**: Store incremental changes for replay purposes
- **Subscriber Onboarding**: Deliver complete context to new subscribers via `initializeSubscription`
- **DynamoDB Storage**: Maintain local storage for replay data

**Use Cases**: Primary data sources that need to support client subscriptions, such as:
- Asset data sources (`mtw.assets`)
- Player data sources (`mtw.players`) 
- Ephemera data sources (`mtw.ephemera`)

### **Non-Replayable Data Sources** (`replayable: false`)
These data sources focus on integration and event processing without subscription support:
- **Event Streaming**: Publish changes to EventBridge for other data sources to consume
- **Event Subscription**: Process incoming events from other data sources
- **No Storage**: Skip DynamoDB storage operations to save resources
- **Integration Focus**: Participate in the event mesh without supporting direct subscriptions

**Use Cases**: Integration-focused data sources that transform or aggregate data, such as:
- Analytics processors that derive metrics from other sources
- Data transformers that normalize external data formats
- Event aggregators that combine multiple data sources

## Architecture Overview

The DataSource pattern implements a dual-delivery architecture that efficiently handles both live events and (optionally) historical replay:

### **Live Event Pipeline**
1. **Change Occurs**: Data source detects a change
2. **Parallel Storage**: Change is stored to DynamoDB (if replayable) + published to EventBridge
3. **EventBridge Fan-out**: EventBridge distributes to all current subscribers
4. **WebSocket Delivery**: Subscriptions lambda delivers to WebSocket connections

### **Replay Pipeline** (Optional - when `replayable` is enabled)
1. **New Subscriber**: Client requests subscription to specific streams
2. **Targeted Replay**: `initializeSubscription` delivers historical data directly to session
3. **SNS Feedback**: Replay data goes through SNS Feedback topic for targeted delivery
4. **WebSocket Delivery**: SNS delivers directly to the requesting session's WebSocket

### **Event Subscription Pipeline**
1. **Incoming Events**: EventBridge events are received by lambda and routed to messageBus
2. **DataSource Subscription**: DataSource subscribes to relevant messageBus events using type guards
3. **Event Processing**: `receiveEvent` function processes incoming events and generates local state changes
4. **State Updates**: Processed events result in `streamEvent` calls to update local streams

This architecture ensures that:
- **Live events** reach all current subscribers efficiently
- **Replay events** (when enabled) reach only the requesting subscriber without unnecessary fan-out
- **Complete context** is provided to new subscribers before they start receiving live events (when replay is enabled)
- **External events** are processed and integrated into local data source state

## Core Functionality

### **1. Snapshot Generation** (Optional - when `replayable` is enabled)
Access the underlying durable storage to generate a snapshot of the current materialized view for a specific stream. Both send and store upon creation.

**Purpose**: Provide complete current state for individual streams within data categories, enabling new subscribers to understand the full context for their specific stream before receiving incremental updates.

### **2. Event Streaming**
Provide the tools to distribute incremental changes for specific streams to outgoing EventBridge, and optionally to replay storage (when `replayable` is enabled).

**Purpose**: Broadcast incremental changes to subscribers who are already synchronized with the current state for their specific stream.

**Method**: `streamEvent({ update, streamKey, detailType })`
- **`update`**: The incremental change data (string or object)
- **`streamKey`**: Identifier for the specific stream within the data source
- **`detailType`**: EventBridge DetailType for the event (e.g., `"Character Updated"`, `"Asset Modified"`)

**Parallel Operations**: Executes DynamoDB storage (if replayable) and EventBridge publishing simultaneously for optimal performance.

### **3. Replay Serialization** (Optional - when `replayable` is enabled)
Deserialize data from the replay store for a specific stream and deliver it directly to a specific subscriber via the Feedback SNS topic.

**Purpose**: Enable new subscribers to catch up by receiving a snapshot plus all events since that snapshot for their specific stream, ensuring they have complete context when new events start arriving from their subscription.

**Method**: `initializeSubscription({ sessionId, streamKey })`
- **`sessionId`**: The specific session to deliver replay data to (format: `SESSION#${sessionId}`)
- **`streamKey`**: The specific stream within the data source to replay

**Delivery Mechanism**: Unlike live events that go through EventBridge for fan-out to all subscribers, replay events are delivered directly to a specific session via the Feedback SNS topic. This targeted delivery ensures:
- **No EventBridge Fan-out**: Replay data doesn't get broadcast to all subscribers
- **Direct Session Delivery**: Data goes straight to the requesting session
- **Efficient Replay**: Only the specific subscriber gets the historical data they need

### **4. Event Subscription**
Subscribe to incoming events from other data sources and process them into local state changes through the messageBus system.

**Purpose**: Enable data sources to react to external events and maintain derived state, creating a comprehensive event mesh where data sources can depend on and respond to changes in other domains.

**Method**: `subscribe(messageBus)` - Registers the data source with the messageBus for event processing
- **`messageBus`**: The InternalMessageBus instance to subscribe to
- **Type Guards**: Automatically derived from the `receiveEvent` function signature
- **Priority**: Configurable priority for event processing order

**Event Processing**: `receiveEvent(event, messageBus)` - Processes incoming events and generates local state changes
- **`event`**: The incoming event payload (type-safe based on subscription)
- **`messageBus`**: The messageBus instance for sending follow-up messages
- **Returns**: Promise that resolves when event processing is complete

### **5. EventBridge Serialization Architecture**
Provide clean separation between internal StreamEvents and external EventBridge events through optional event serialization.

**Purpose**: Enable DataSources to maintain clean internal event processing while supporting proper external event contracts for cross-service communication.

**Method**: `eventSerializer` constructor parameter - Optional serializer for EventBridge integration
- **`serialize(params)`**: Convert internal update payload to external format for EventBridge Detail
- **`deserialize(params)`**: Convert external update payload back to internal format

**Recommended Pattern**: Use class-based serializers for better type safety, testability, and reusability:

**Usage Pattern**: DataSources can optionally provide serializers for EventBridge integration:

**Standard: Class-based Serializer**
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

## Multi-Stream Architecture

### **Stream Differentiation**
Each DataSource instance supports multiple independent streams, where each stream represents a distinct subset of data within the broader data category. For example:
- **Asset DataSource** (`mtw.assets`): Streams differentiated by `AssetId` - each asset has its own snapshot and event history
- **Player DataSource** (`mtw.players`): Streams differentiated by `PlayerId` - each player has their own subscription stream
- **Ephemera DataSource** (`mtw.ephemera`): Streams differentiated by `EphemeraId` - each ephemeral object maintains its own state
- **Content Headers Sub-Source** (`mtw.assets.contentHeaders`): Specialized streams for content header data within the assets service

### **Concurrent Stream Processing**
The multi-stream architecture enables:
- **Independent Snapshots**: Each stream generates and maintains its own snapshot independently (when replay is enabled)
- **Parallel Event Processing**: Events for different streams can be processed concurrently without interference
- **Selective Subscriptions**: Clients can subscribe to specific streams without receiving data from unrelated streams
- **Efficient Resource Utilization**: Only active streams consume computational resources for snapshot generation (when replay is enabled)

## Integration Points

### Dependencies
- **AWS DynamoDB**: Local storage for replay data (when replay is enabled)
- **AWS EventBridge**: Event streaming to subscribers
- **MTW Interfaces**: Type-safe message contracts
- **MTW Utilities**: Common utilities and helpers

### Cross-References
- **[SingleFlight Pattern](../singleFlight/AGENT.md)**: Distributed coordination for snapshot generation (when replay is enabled)
- **[MessageBus Pattern](../messageBus/AGENT.md)**: Internal event coordination and subscription management
- **[Internal Cache Pattern](../internalCache/AGENT.md)**: Performance optimization
- **[Lambda Development Guide](../../../AGENT.development.md)**: General lambda patterns
- **[Architecture Philosophy](../../../AGENT.architecture.philosophy.md)**: System design principles

## Development Guidelines

### Implementation Requirements
- **Singleton Pattern**: One instance per lambda execution
- **Type Safety**: Full TypeScript integration with domain-specific types
- **Error Handling**: Graceful degradation and retry logic
- **Performance**: Efficient serialization and storage operations

### Common Implementation Pattern
**Lambda-Specific Sub-classing**: Create a sub-class of `DataSource` for each lambda to localize common configuration:

**Purpose**: Eliminate repetitive constructor arguments by pre-configuring lambda-specific resources and settings.

**Configuration Parameters to Localize**:
- **`dynamo`**: DynamoDB utilities instance for the lambda's table
- **`sns`**: SNS utilities instance for the lambda's region/account
- **`messageBus`**: InternalMessageBus instance for internal event coordination
- **`primaryKeyName`**: The primary key field name used in this lambda's domain
- **`singleFlight`**: SingleFlight instance for distributed coordination
- **`feedbackTopicArn`**: SNS topic ARN for replay data delivery

**Benefits**:
- **Reduced Boilerplate**: Eliminate repetitive constructor configuration
- **Consistency**: Ensure all data sources in a lambda use the same resources
- **Maintainability**: Centralize lambda-specific configuration changes
- **Type Safety**: Pre-configure domain-specific types and constraints

**Usage Pattern**: Create a lambda-specific base class by extending `DataSource` with pre-configured common parameters, then instantiate that base class for individual data sources with only the unique parameters (dataSourceKey, snapshotContentGenerator, etc.).

### Testing Strategy
- **Unit Tests**: Individual method functionality
- **Integration Tests**: DynamoDB and EventBridge interactions
- **Performance Tests**: Serialization and storage operations
- **Error Scenarios**: Network failures, storage limits, etc.

## Current State

### **First Iteration Scope**
This initial implementation focuses on the four core capabilities:

1. **Snapshot Generation**: Create materialized state snapshots (optional when `replayable` is enabled)
2. **Event Streaming**: Stream filtered change events
3. **Replay Serialization**: Serialize data for new subscriber onboarding (optional when `replayable` is enabled)
4. **EventBridge Serialization**: Clean separation between internal StreamEvents and external EventBridge events (optional)

### **Future Enhancements**
- **Claim-check pattern**: Large snapshots or event contents should push to S3 and deliver a claim-check record with objectName and preSigned URL
- **Metrics**: Built-in performance monitoring and analytics
- **Retention Policies**: Configurable data retention strategies
- **Event Filtering**: Advanced filtering capabilities for incoming events based on content or metadata
- **Batch Processing**: Process multiple incoming events in batches for improved performance
- **Event Ordering**: Guarantee ordered processing of events from the same source
- **Dead Letter Queues**: Handle failed event processing with retry and dead letter queue patterns
- **Event Validation**: Built-in validation for external EventBridge event formats
- **Event Enrichment**: Automatic enrichment of events with contextual metadata during serialization

## Navigation Tips

### Getting Started
1. **Read This Guide**: Understand the core functionality and scope
2. **Review Examples**: Study the usage patterns above
3. **Check Dependencies**: Ensure required AWS services are configured
4. **Implement Gradually**: Start with snapshot generation, then add streaming and replay

### Key Concepts
- **Domain Authority**: Each data source owns its domain completely across all streams
- **Stream Isolation**: Each stream maintains independent state and event history (when replay is enabled)
- **Event Sourcing**: State changes are captured as events per stream
- **Replay Capability**: New subscribers can catch up from any point in time for their specific stream (when replay is enabled)
- **Concurrent Coordination**: SingleFlight ensures efficient snapshot generation across multiple lambda instances (when replay is enabled)
- **Performance**: Optimized for cost-effective operation with stream-specific resource utilization

---

**For detailed implementation information, see [AGENT.implementation.md](./AGENT.implementation.md)**