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
1. **Incoming Events**: EventBridge events are received by lambda and deserialized to internal format via [Serialization Boundary](#serialization-boundary)
2. **DataSource Subscription**: DataSource subscribes to relevant messageBus events using type guards
3. **Event Processing**: `receiveEvent` function processes incoming events and generates local state changes
4. **State Updates**: Processed events result in `streamEvent` calls to update local streams

### **Serialization Boundary**
Maintain strict separation between internal messageBus events and external EventBridge events through dedicated serializers:

- **Internal Format**: Clean, domain-specific representations optimized for manipulation (`StandardComponent`, embedded `type` properties)
- **External Format**: Transmittable representations optimized for cross-service communication (WML strings, `detailType` metadata)
- **Serializer Pattern**: Class-based converters that transform between formats at the EventBridge boundary
- **Type Safety**: Full TypeScript support for both internal and external event structures

See [Implementation Details](AGENT.implementation.md#eventbridge-serialization) for serializer patterns and usage examples. For **where to define types** for **outgoing** `streamEvent` payloads, see [Implementation Details](AGENT.implementation.md) (section **publishedEvents.ts and outgoing update payloads**): **`eventBridge+bus`** uses **`mtw-interfaces`**; **`busOnly`** uses **`publishedEvents.ts`** per DataSource directory.

This architecture ensures that:
- **Live events** reach all current subscribers efficiently
- **Replay events** (when enabled) reach only the requesting subscriber without unnecessary fan-out
- **Complete context** is provided to new subscribers before they start receiving live events (when replay is enabled)
- **External events** are processed and integrated into local data source state
- **Clean separation** is maintained between internal manipulation and external transmission formats

### **Aggregation Boundary** (Optional)
Maintain client-side state by combining snapshots with streaming events through dedicated aggregators:

- **Base Snapshot**: Starting point materialized state (internal format)
- **Delta Events**: Incremental updates applied in timestamp order
- **Materialized State**: Current snapshot after applying all events
- **Aggregator Pattern**: Class-based logic for combining snapshots with events
- **Partial Failure**: Individual events can fail without stopping subsequent event processing

**Key Insight**: The internal snapshot format IS the materialized state. Aggregation produces new snapshots by applying delta events to base snapshots.

**Optional Feature**: DataSources can optionally provide aggregators to describe how clients should combine snapshots with events. This is particularly useful for:
- Complex state structures that require specific merge logic
- Handling out-of-order events through timestamp ordering
- Supporting partial failures in event processing (e.g., StandardForm merge conflicts)
- Providing consistent client-side state management

See [Implementation Details](AGENT.implementation.md#aggregation) for aggregator patterns and usage examples.

### **Snapshot Envelope Conventions**
Snapshots use the same `StreamingEventHeader` family as streaming events. Snapshot envelopes use a single shared `header.type: 'Snapshot'` across all DataSources; domain and stream identity come from `dataSourceKey` and `streamKey` (same as events). Routing and type guards use the header only (e.g. `header.type === 'Snapshot'`); there are no per-domain snapshot type variants.

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

**Parallel Operations**: With **`publisherStrategy: 'eventBridge+bus'`** (default), executes DynamoDB storage (if replayable) and EventBridge publishing simultaneously for optimal performance. With **`publisherStrategy: 'busOnly'`**, updates are published to the process message bus only (no EventBridge).

**Where outgoing types live:** Types for **`update`** (the **`UpdatePayload`** generic) **must** match how updates leave the lambda: **cross-lambda** EventBridge publishing **`must`** define **outgoing** types in **`mtw-interfaces`** (shared with serializers and other implementing sites). **`busOnly`** DataSources **`must`** define **outgoing** types in **`publishedEvents.ts`** in the same directory as the DataSource, pairing with **`subscribedEvents.ts`** for incoming types. See [Implementation Details](AGENT.implementation.md) (section **publishedEvents.ts and outgoing update payloads**).

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

#### Snapshot metadata: `createdAt` and `replayAt`
Replayable snapshots carry two timestamps with different roles:

- **`createdAt`**: When the snapshot envelope was produced (generation and in-memory cache timing). This stays stable for readers that care about freshness of the cached snapshot object.
- **`replayAt`**: The replay watermark used as the strict lower bound when fetching replay events in `initializeSubscription` (events strictly after this value). This should reflect the **represented** stream state when that state is older than `createdAt` (for example, a historical sidecar while the envelope is built now).

**Compatibility**: Legacy stored snapshots may omit `replayAt`. The framework resolves the replay cursor as **`replayAt ?? createdAt`** (see `resolveReplayCursorTimestamp` in [`index.ts`](./index.ts)).

**`snapshotContentGenerator`**: Domain payloads do not need to include `replayAt`. If the generator omits it, the framework sets `replayAt` to the same instant as `createdAt` for that generation, which matches typical inline snapshots. When the materialized body corresponds to an earlier authoritative time (notably WML sidecars keyed off `Meta::Snapshot`), the generator should return **`replayAt`** alongside the domain fields; see [`lambda/wml/dataSource/snapshotContent.ts`](../../../../lambda/wml/dataSource/snapshotContent.ts).

**Wire placement:** `replayAt` is **envelope metadata**, not domain content.

- On wire: extended header (`extendedHeader.replayAt` on SNS, DynamoDB, and EventBridge; merged into the flat WebSocket header after `fromWebSocketFormat`).
- Subscribe replay: [`deliverReplayData`](./index.ts) puts `replayAt` on `coreFormat.header` and strips `createdAt`, `replayAt`, and `expiresAt` from `update`.
- Client ingress: header-only extraction in [`charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md`](../../../../charcoal-client/src/slices/dataSource/streamEventPubSub/AGENT.md). See also [AGENT.implementation.md](./AGENT.implementation.md) (**Serialization: extendedHeader**).

#### Replay subscribe diagnostics (optional)
Replayable DataSources can emit structured subscribe/replay diagnostics from `initializeSubscription` using:

- `MTW_DATA_SOURCE_REPLAY_LOG_SAMPLE_RATE` (float in `[0,1]`)
  - Missing, invalid, or `0`: no diagnostic logs
  - `1`: log every subscribe/replay initialization
  - `0 < rate < 1`: sample probabilistically per initialization

When emitted, logs include fields such as `dataSourceKey`, `streamKey`, `sessionId`, `createdAt`, `replayAt`, `replayCursor`, `replayEventCount`, `replayWindowLower`, `replayWindowFirst`, and `replayWindowLatest`.

### **4. Event Subscription**
Subscribe to incoming events from other data sources and process them into local state changes through the messageBus system.

**Purpose**: Enable data sources to react to external events and maintain derived state, creating a comprehensive event mesh where data sources can depend on and respond to changes in other domains.

**Method**: `subscribe(messageBus)` - Registers the data source with the messageBus for event processing
- **`messageBus`**: The InternalMessageBus instance to subscribe to
- **Type Guards**: Automatically derived from the `receiveEvent` function signature
- **Priority**: Configurable priority for event processing order

**Event Processing**: `receiveEvents({ events, streamEvent })` - Processes batches of incoming events and generates local state changes
- **`events`**: Array of incoming event payloads (type-safe based on subscription)
- **`streamEvent`**: Function for publishing derived events to subscribers
- **Flexible Processing**: Supports any processing pattern - aggregation, parallel processing, or sequential processing as needed
- **Batch Foundation**: Provides the foundation for advanced event processing patterns
- **Returns**: Promise that resolves when all events in the batch have been processed

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

### Three-Phase Data Source Implementation Pattern

**Phase 1: Define outgoing event contracts**

**Cross-lambda publishing (`publisherStrategy: 'eventBridge+bus'`, default):** Before implementing a DataSource that publishes updates to **EventBridge**, define **outgoing** event contracts in the shared interface layer so every implementing site and consumer shares the same wire contract:

1. **Create Event Types**: Define internal and external event types in `mtw-interfaces/ts/eventBridge/[dataSource].ts`
2. **Implement Type Guards**: Create type guard functions for event validation
3. **Build Serializers**: Implement `DataSourceEventSerializer` for EventBridge integration
4. **Export Contracts**: Make all event contracts available via `@tonylb/mtw-interfaces/ts/eventBridge`

**Bus-only publishing (`publisherStrategy: 'busOnly'`):** DataSources that do **not** publish to EventBridge **`must`** colocate **outgoing** `streamEvent` / `streamEnvelope` payload types in **`publishedEvents.ts`** in the same directory as the DataSource. Do **not** place bus-only-only shapes in **`mtw-interfaces`** unless the same payload also crosses a shared service boundary.

**Benefits (EventBridge path):**
- **Service Isolation**: No cross-lambda dependencies
- **Centralized Contracts**: Event definitions in shared interface layer
- **Deployment Independence**: Each lambda can be deployed independently
- **Clear Separation**: Lambda resources vs. DataSource-specific configuration

**Phase 2: Create Lambda-Specific Base Class**
Create a sub-class of `DataSource` for each lambda to localize common configuration:

1. **Lambda-Specific Sub-classing**: Create a base class extending `DataSource` with pre-configured lambda resources
2. **Import Event Contracts**: For **`eventBridge+bus`** DataSources, import serializers and types from `@tonylb/mtw-interfaces/ts/eventBridge`; for **`busOnly`** DataSources, import **outgoing** types from `./publishedEvents.ts` (or define them inline only when trivial)
3. **Configure Common Parameters**: Set up lambda-specific resources that all DataSources in this lambda will use

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

**Phase 3: Instantiate Individual DataSources**
Create specific DataSource instances using the lambda-specific base class:

1. **Import Event Serializers**: Import specific serializers from `@tonylb/mtw-interfaces/ts/eventBridge`
2. **Instantiate DataSources**: Create individual DataSource instances with unique parameters
3. **Configure Per-DataSource Parameters**: Set dataSourceKey, snapshotContentGenerator, and eventSerializer

**Per-DataSource Configuration Parameters**:
- **`dataSourceKey`**: Unique identifier for this specific data source
- **`snapshotContentGenerator`**: Function to generate snapshots for this data source
- **`eventSerializer`**: Event serializer specific to this data source's event types
- **`replayable`**: Whether this data source supports replay functionality
- **`buildHeader`**: (Optional) When using an extended header type for publishing, a function that builds the full header (including optional domain fields like `zone`) from `{ update, streamKey, timestamp }`. See [Implementation: Extending the header](AGENT.implementation.md#extending-the-header-type-safe).

**Usage Pattern**: 
1. Define event contracts in `mtw-interfaces/ts/eventBridge/[dataSource].ts`
2. Create a lambda-specific base class by extending `DataSource` with pre-configured lambda resources
3. Import event serializers from `@tonylb/mtw-interfaces/ts/eventBridge`
4. Instantiate the base class for individual data sources with DataSource-specific parameters (dataSourceKey, snapshotContentGenerator, eventSerializer, etc.)

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
- **Event Ordering**: Guarantee ordered processing of events from the same source
- **Dead Letter Queues**: Handle failed event processing with retry and dead letter queue patterns
- **Event Validation**: Built-in validation for external EventBridge event formats
- **Event Enrichment**: Automatic enrichment of events with contextual metadata during serialization

## Navigation Tips

### Getting Started

Follow this structured path when working with the DataSource pattern. The header/content envelope model, multi-context serialization, and MessageBus integration are complex; "just jumping in" often misses critical context.

1. **Understand Project Foundations**
   - **Read** [root AGENT.md](../../../../AGENT.md)
   - **Why**: Establishes documentation standards, Getting Started patterns, and project navigation
   - **Focus**: "Getting Started" Pattern for Complex Tasks (7-step template) and AGENT.md structure
   - **Key Insight**: This DataSource doc follows that pattern; understanding it helps you know what to expect

2. **Read This Document (AGENT.md) First**
   - **Why**: This is the usage guide; it explains *what* the pattern does and *when* to use each capability
   - **Recommended order**: Overview → Core Purpose → Architecture Overview (including Serialization Boundary) → Development Guidelines (Three-Phase pattern)
   - **Key Insight**: The header vs. content envelope is the central architectural concept. Pay special attention to how routing uses the header and how payloads stay domain-pure

3. **Read the Implementation Guide (AGENT.implementation.md)**
   - **Read** [AGENT.implementation.md](./AGENT.implementation.md)
   - **Why**: The usage guide describes behavior; the implementation guide describes *how* it works (envelope contract, extended headers, format transforms, serializer contract)
   - **Focus**: [Header/Content Envelope Model](./AGENT.implementation.md#headercontent-envelope-model), [SubscribedEvents pattern](./AGENT.implementation.md#subscribedevents-pattern), [Type-Safe Routing](./AGENT.implementation.md#type-safe-routing-with-envelope-level-discriminated-unions-and-payload-purity)
   - **Key Insight**: `subscribedEventTypeGuard` inspects only `header`; `receiveEvents` gets content via `getContent()`. Header is authoritative for routing; content is domain data only

4. **Understand Core Integration Points**
   - **MessageBus**: [messageBus AGENT.md](../messageBus/AGENT.md) - DataSource subscribes to messageBus with structure guards; the bus stays payload-agnostic via `getContent: () => Promise<unknown>`
   - **EventBridge contracts**: [mtw-interfaces EventBridge AGENT.implementation.md](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md) - Serializers, external formats, and header-authoritative deserialization
   - **Format transforms**: [formatTransform.ts](./formatTransform.ts) - CoreExternalFormat, base four + extendedHeader split on the wire, context-specific transforms (EventBridge, DynamoDB, SNS, WebSocket)
   - **Key Insight**: CoreExternalFormat is `{ header, update }` only (no duplicated top-level envelope fields). Every wire format (EventBridge, DynamoDB, SNS, WebSocket) uses the same extended-header rule (header minus base four); the format layer applies it in every transform. Consumers always read full `header` after deserialize.

5. **Review Implemented Code**
   - **Core types and contract**: [baseClasses.ts](./baseClasses.ts) - `StreamingEventEnvelope`, `ResolvedStreamingEnvelope`, `DataSourceEventSerializer`, `StreamEventHeaderFragment`
   - **DataSource implementation**: [index.ts](./index.ts) - `streamEvent` (header fragment, CoreExternalFormat), `subscribe` (structure guard, envelope type guard, `receiveEvents` callback)
   - **Reference implementations** (subscribedEvents, envelope unions, type guards):
     - [lambda/wml/dataSource/subscribedEvents.ts](../../../../lambda/wml/dataSource/subscribedEvents.ts) - Canonical reference per implementation doc
     - [lambda/assets/contentHeaders/subscribedEvents.ts](../../../../lambda/assets/contentHeaders/subscribedEvents.ts) - Extended headers, multiple event types
     - [lambda/assets/library/subscribedEvents.ts](../../../../lambda/assets/library/subscribedEvents.ts) - Library event union and guards

6. **Determine Your Implementation Goal**
   - **New DataSource**: Follow the Three-Phase pattern (Phase 1: mtw-interfaces contracts; Phase 2: lambda base class; Phase 3: instantiate DataSource). Use WML or contentHeaders as the reference
   - **Extending an existing DataSource**: Add event types to the subscribed union, update `subscribedEventTypeGuard`, extend `receiveEvents` with new branches. Use envelope-level type guards for narrowing
   - **Adding extended headers**: Define extended header type, add `buildHeader` if publishing, pass extended fields in the header fragment to `streamEvent`. See [Extending the header](./AGENT.implementation.md#extending-the-header-type-safe). For a reference implementation that keeps content domain-only (e.g. `RequestIds` in header only), see mtw.wml (lambda/wml/dataSource, packages/mtw-interfaces/ts/eventBridge/wml).
   - **Serializer changes**: Ensure `serialize`/`deserialize` use `{ content, header }` and route only on `header.type`. Do not branch on `content.type`

7. **Run Tests Before Starting**
   - **Command** (from repo root): `npm run --workspace @tonylb/mtw-lambda-patterns test -- --testPathPattern=dataSource --watchAll=false`
   - **Expected baseline**: 4 test suites, 139 tests passing (`index.test.ts`, `formatTransform.test.ts`, `streamEventPublisher.test.ts`, `sidecarResolve.test.ts`)
   - **Why**: Establishes a known-good baseline before making changes; DataSource tests cover streamEvent, replay delivery, format transforms, stream-event publishing, and sidecar resolution flow

### Key Concepts
- **Domain Authority**: Each data source owns its domain completely across all streams
- **Stream Isolation**: Each stream maintains independent state and event history (when replay is enabled)
- **Event Sourcing**: State changes are captured as events per stream
- **Replay Capability**: New subscribers can catch up from any point in time for their specific stream (when replay is enabled)
- **Concurrent Coordination**: SingleFlight ensures efficient snapshot generation across multiple lambda instances (when replay is enabled)
- **Performance**: Optimized for cost-effective operation with stream-specific resource utilization

---

**For detailed implementation information, see [AGENT.implementation.md](./AGENT.implementation.md)**