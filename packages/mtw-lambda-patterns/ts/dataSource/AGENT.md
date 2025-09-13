# DataSource Pattern - Agent Navigation Guide

## Overview

The `DataSource` pattern provides a standardized foundation for implementing data sources in Make The World's Domain-Authoritative Event Mesh architecture. This pattern enables each lambda to serve as a domain-authoritative data source with consistent capabilities for state management, event streaming, and subscriber replay support across multiple subscribable streams.

## Core Purpose

The DataSource pattern addresses four critical needs for data source implementation:

- **Snapshot Generation**: Create materialized state snapshots for individual streams within data categories
- **Event Streaming**: Stream filtered change events to subscribers for specific streams
- **Replay Support**: Store and fetch snapshots and recent events for new subscriber onboarding to individual streams
- **Event Subscription**: Subscribe to incoming events from other data sources and process them into local state changes

## Architecture Overview

The DataSource pattern implements a dual-delivery architecture that efficiently handles both live events and historical replay:

### **Live Event Pipeline**
1. **Change Occurs**: Data source detects a change
2. **Parallel Storage**: Change is stored to DynamoDB for replay + published to EventBridge
3. **EventBridge Fan-out**: EventBridge distributes to all current subscribers
4. **WebSocket Delivery**: Subscriptions lambda delivers to WebSocket connections

### **Replay Pipeline**
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
- **Replay events** reach only the requesting subscriber without unnecessary fan-out
- **Complete context** is provided to new subscribers before they start receiving live events
- **External events** are processed and integrated into local data source state

## Technical Details

### Core Functionality

#### **1. Snapshot Generation**
Access the underlying durable storage to generate a snapshot of the current materialized view for a specific stream. Both send and store upon creation.

**Purpose**: Provide complete current state for individual streams within data categories, enabling new subscribers to understand the full context for their specific stream before receiving incremental updates.

#### **2. Event Streaming**
Provide the tools to distribute incremental changes for specific streams, *both* to outgoing EventBridge *and* to the replay storage.

**Purpose**: Broadcast incremental changes to subscribers who are already synchronized with the current state for their specific stream.

**Method**: `streamEvent({ update, streamKey, detailType })`
- **`update`**: The incremental change data (string or object)
- **`streamKey`**: Identifier for the specific stream within the data source
- **`detailType`**: EventBridge DetailType for the event (e.g., `"Character Updated"`, `"Asset Modified"`)

**Parallel Operations**: Executes DynamoDB storage and EventBridge publishing simultaneously for optimal performance.

**Live vs Replay Event Delivery**:

The DataSource pattern uses two different delivery mechanisms depending on the context:

- **Live Events** (`streamEvent`): New changes are published to EventBridge for fan-out to all current subscribers
- **Replay Events** (`initializeSubscription`): Historical data is delivered directly to a specific session via SNS Feedback

This dual approach ensures efficient delivery while maintaining the correct scope for each type of event.

#### **3. Replay Serialization**
Deserialize data from the replay store for a specific stream and deliver it directly to a specific subscriber via the Feedback SNS topic.

**Purpose**: Enable new subscribers to catch up by receiving a snapshot plus all events since that snapshot for their specific stream, ensuring they have complete context when new events start arriving from their subscription.

**Method**: `initializeSubscription({ sessionId, streamKey })`
- **`sessionId`**: The specific session to deliver replay data to (format: `SESSION#${sessionId}`)
- **`streamKey`**: The specific stream within the data source to replay

**Delivery Mechanism**: Unlike live events that go through EventBridge for fan-out to all subscribers, replay events are delivered directly to a specific session via the Feedback SNS topic. This targeted delivery ensures:
- **No EventBridge Fan-out**: Replay data doesn't get broadcast to all subscribers
- **Direct Session Delivery**: Data goes straight to the requesting session
- **Efficient Replay**: Only the specific subscriber gets the historical data they need

**Replay Content**: The method delivers:
1. **Current Snapshot**: The most recent materialized state for the stream
2. **Recent Events**: Events that occurred since the snapshot was created
3. **Complete Context**: Everything the subscriber needs to understand the current state

**SNS Feedback Delivery**: Replay data is delivered via the Feedback SNS topic, which allows:
- **Targeted Delivery**: Data goes directly to the specified `sessionId`
- **No Fan-out**: Avoids broadcasting historical data to all subscribers
- **Efficient Replay**: Only the requesting session receives the replay data
- **WebSocket Integration**: SNS messages are delivered to the session's WebSocket connection

#### **4. Event Subscription**
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

**Integration with MessageBus**: The data source integrates seamlessly with the existing messageBus pattern:
- **Type Safety**: Full TypeScript integration with type guards derived from `receiveEvent` signature
- **Priority Ordering**: Events are processed according to messageBus priority system
- **Error Handling**: Graceful failure without breaking other messageBus handlers
- **Stream Processing**: Events persist in messageBus for multiple handler consumption

**EventBridge Integration**: The subscription system works with the broader EventBridge architecture:
- **Event Reception**: Lambda receives EventBridge events and routes them to messageBus
- **Type Filtering**: Data source only processes events it's interested in via type guards
- **State Derivation**: Incoming events are processed into local state changes
- **Event Propagation**: Local changes are streamed to subscribers via EventBridge

### Data Storage Strategy

#### **Local DynamoDB Table**
Each data source maintains a local DynamoDB table for replay data across multiple subscribable streams. The Primary Key will be variable (`AssetId`, `EphemeraId`, and so on), but the general pattern will be that all stream records have a PK of `STREAM#${dataSourceKey}::${streamIdentifier}`.

This granular PK structure enables:
- **Stream Isolation**: Each stream maintains its own snapshot and event history
- **Efficient Querying**: Direct access to specific stream data without filtering
- **Concurrent Operations**: Multiple streams can be processed simultaneously without conflicts
- **Scalable Architecture**: Support for large numbers of streams within a single data source

**Record Types**:
- **Snapshot Records**: DataCategory of `Meta::Snapshot` - Contains the complete current state for a specific stream
- **Event Records**: DataCategory of `EVENT#${epochTime}::${uuid}` - Contains incremental changes for a specific stream

#### **Naming Conventions**

**Data Source Keys**: The `dataSourceKey` parameter should use the full EventBridge source naming convention for consistency:

- **Primary Data Sources**: Use the full EventBridge source name (e.g., `'mtw.assets'`, `'mtw.ephemera'`, `'mtw.connections'`)
- **Sub-Sources**: For specialized data sources within a larger service, extend the pattern (e.g., `'mtw.assets.contentHeaders'`, `'mtw.assets.characterData'`)

This naming convention ensures that:
- **DynamoDB Keys**: Use the same identifier as EventBridge sources (`STREAM#mtw.assets::streamKey`)
- **EventBridge Events**: Use the same source identifier (`Source: 'mtw.assets'`)
- **Code Clarity**: Makes it immediately clear which service/system owns each data source
- **Consistency**: Eliminates confusion between different naming schemes across the system

### Multi-Stream Architecture

#### **Stream Differentiation**
Each DataSource instance supports multiple independent streams, where each stream represents a distinct subset of data within the broader data category. For example:
- **Asset DataSource** (`mtw.assets`): Streams differentiated by `AssetId` - each asset has its own snapshot and event history
- **Player DataSource** (`mtw.players`): Streams differentiated by `PlayerId` - each player has their own subscription stream
- **Ephemera DataSource** (`mtw.ephemera`): Streams differentiated by `EphemeraId` - each ephemeral object maintains its own state
- **Content Headers Sub-Source** (`mtw.assets.contentHeaders`): Specialized streams for content header data within the assets service

#### **Concurrent Stream Processing**
The multi-stream architecture enables:
- **Independent Snapshots**: Each stream generates and maintains its own snapshot independently
- **Parallel Event Processing**: Events for different streams can be processed concurrently without interference
- **Selective Subscriptions**: Clients can subscribe to specific streams without receiving data from unrelated streams
- **Efficient Resource Utilization**: Only active streams consume computational resources for snapshot generation

## Integration Points

### Dependencies
- **AWS DynamoDB**: Local storage for replay data
- **AWS EventBridge**: Event streaming to subscribers
- **MTW Interfaces**: Type-safe message contracts
- **MTW Utilities**: Common utilities and helpers

### Cross-References
- **[SingleFlight Pattern](../singleFlight/AGENT.md)**: Distributed coordination for snapshot generation
- **[MessageBus Pattern](../messageBus/AGENT.md)**: Internal event coordination and subscription management
- **[Internal Cache Pattern](../internalCache/AGENT.md)**: Performance optimization
- **[Lambda Development Guide](../../../AGENT.development.md)**: General lambda patterns
- **[Architecture Philosophy](../../../AGENT.architecture.philosophy.md)**: System design principles

### EventBridge Integration Patterns

#### **Incoming Event Processing**
The DataSource pattern integrates with EventBridge through a standardized messageBus routing pattern:

**Event Reception**: Lambda handlers receive EventBridge events and route them to messageBus with appropriate message structure.
**Data Source Subscription**: Data sources automatically subscribe to relevant events using their configured type guards and event processing functions.

#### **EventBridge Architecture Simplification**
The subscription system enables a simplified EventBridge architecture:

**Before**: Complex EventBridge routing with multiple direct subscriptions
- Each lambda directly subscribes to multiple EventBridge event types
- Complex routing logic in each lambda handler
- Tight coupling between event sources and consumers

**After**: Centralized messageBus routing with data source subscriptions
- Single EventBridge event handler routes all events to messageBus
- Data sources subscribe to messageBus events they care about
- Loose coupling with type-safe event processing
- Easier testing and maintenance

**Benefits**:
- **Simplified Event Handling**: Single point of EventBridge event reception
- **Type Safety**: Full TypeScript integration with derived type guards
- **Flexible Routing**: Data sources can subscribe to any messageBus event type
- **Better Testing**: MessageBus events can be easily mocked and tested
- **Performance**: Reduced EventBridge subscription complexity

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
This initial implementation focuses on the three core capabilities:

1. **Snapshot Generation**: Create materialized state snapshots
2. **Event Streaming**: Stream filtered change events
3. **Replay Serialization**: Serialize data for new subscriber onboarding

### **Future Enhancements**
- **Claim-check pattern**: Large snapshots or event contents should push to S3 and deliver a claim-check record with objectName and preSigned URL
- **Metrics**: Built-in performance monitoring and analytics
- **Retention Policies**: Configurable data retention strategies
- **Event Filtering**: Advanced filtering capabilities for incoming events based on content or metadata
- **Batch Processing**: Process multiple incoming events in batches for improved performance
- **Event Ordering**: Guarantee ordered processing of events from the same source
- **Dead Letter Queues**: Handle failed event processing with retry and dead letter queue patterns

## Navigation Tips

### Getting Started
1. **Read This Guide**: Understand the core functionality and scope
2. **Review Examples**: Study the usage patterns above
3. **Check Dependencies**: Ensure required AWS services are configured
4. **Implement Gradually**: Start with snapshot generation, then add streaming and replay

### Key Concepts
- **Domain Authority**: Each data source owns its domain completely across all streams
- **Stream Isolation**: Each stream maintains independent state and event history
- **Event Sourcing**: State changes are captured as events per stream
- **Replay Capability**: New subscribers can catch up from any point in time for their specific stream
- **Concurrent Coordination**: SingleFlight ensures efficient snapshot generation across multiple lambda instances
- **Performance**: Optimized for cost-effective operation with stream-specific resource utilization
