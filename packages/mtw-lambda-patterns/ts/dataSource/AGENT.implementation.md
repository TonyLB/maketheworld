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

### **Batch Event Processing Architecture**:
**Flexible Event Processing**: The DataSource pattern now supports batch processing through the `receiveEvents` method, providing a flexible foundation for various event processing patterns.

**Key Features**:
- **Batch Input**: `receiveEvents({ events, streamEvent })` accepts an array of events for processing
- **Flexible Processing**: Supports any processing pattern - aggregation, parallel processing, or sequential processing as needed
- **Processing Foundation**: Provides the foundation for advanced event processing patterns
- **Pattern Agnostic**: Implementation can choose the most appropriate processing approach for the use case

### **Header/Content Envelope Model**

DataSource events use a header + getContentInternal contract:

- **Header**: Always present, never sidecarred. Contains `dataSourceKey`, `streamKey`, `timestamp`, `type`, and optional domain flags (e.g. `zone`). Used for routing and type guards.
- **Payload**: Obtained via `getContentInternal()`. What serializers and aggregators operate on.
- **`subscribedEventTypeGuard`**: An **envelope type guard** `(envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>`. The DataSource supplies this; the patterns package builds envelopes as `unknown`, filters with it, and passes only narrowed envelopes to `receiveEvents`. The guard inspects only `envelope.header` (no `getContentInternal()` call); the bus uses required `getContentInternal: () => Promise<unknown>` so messageBus baseClasses stay free of DataSource payload imports.
- **`receiveEvents`**: Receives `events: Array<StreamingEventEnvelope<SubscribedContent>>`; use `event.header` for branching and `event.getContentInternal()` for payload semantics.
- **Initialize Subscription**: DataSource instances type-guard on `header.type === "Initialize Subscription - ${this.dataSourceKey}"` to determine which DataSource handles a given Initialize Subscription event. Init uses the same streaming-event contract: senders provide `getContentInternal`; the init subscription callback obtains the payload via `await payload.getContentInternal()`. See [lambda/subscriptions/AGENT.eventBridge.md](../../../../lambda/subscriptions/AGENT.eventBridge.md) for the EventBridge event format.

### **MessageBus and streaming event contract**

Streaming events on the messageBus follow a single contract so that baseClasses stay payload-agnostic and DataSources own their narrow view.

**Lazy content:** DataSources receive events as `StreamingEventEnvelope<Content>` and obtain content via `getContentInternal()`. **`getContentInternal` is required** on every streaming event message. The patterns package callback uses `getContentInternal` only.

**Spheres of authority:**

| Layer | Responsibility |
|-------|----------------|
| **Publish sites** | Build envelope-shaped messages when sending streaming events: header and **required** `getContentInternal`. |
| **messageBus / baseClasses** | Each lambda defines a single broad `StreamingEventMessage` with **required** `getContentInternal: () => Promise<unknown>`. No imports from dataSource or subscribedEvents. |
| **Patterns subscribe()** | Structure guard validates well-formed streaming event; callback normalizes to `StreamingEventEnvelope<unknown>`, applies DataSource's envelope type guard, passes narrowed envelopes to `receiveEvents`. |
| **subscribedEventTypeGuard** | Envelope type guard: filter and narrow to this DataSource's `SubscribedContent`; inspects only `envelope.header`. |

**Trade-off:** The bus does not enforce compile-time alignment between header (e.g. `dataSourceKey`, `type`) and the payload returned by `getContentInternal()`. Sending sites must get it right; mistakes show up at runtime. We accept this so that baseClasses stay dumb and DataSources own their subscription types. Typed send-helpers in subscribedEvents recover sender-side compile-time safety without coupling the bus to payload types.

**Initialize Subscription** uses a separate subscription path (e.g. `dataSourceKey === 'mtw.subscriptions'`); it is not part of the envelope type guard flow and is out of scope for subscribedEvents. Lambdas that forward init from EventBridge can use a dedicated send-helper (e.g. `dataSource/initSubscription.ts`) with `sendInitializeSubscription(bus, dataSourceKey, streamKey, sessionId, requestId)` so the init message is built with `getContentInternal` only.

### **SubscribedEvents pattern**

Each DataSource implementation should colocate its subscription surface in a **`subscribedEvents.ts`** file in the **same directory** as the file that instantiates the DataSource (e.g. `lambda/wml/dataSource/subscribedEvents.ts`, `lambda/assets/players/subscribedEvents.ts`). One such file per DataSource directory.

**Contents of subscribedEvents.ts:**

1. **Aggregate envelope type guard**: A single guard (e.g. `isWMLSubscribedEnvelope`, `isAssetsSubscribedEnvelope`) with signature `(e: StreamingEventEnvelope<unknown>) => e is StreamingEventEnvelope<SubscribedPayload>`. It inspects only `e.header` (e.g. `dataSourceKey`, `type`); no call to `getContentInternal()`. The DataSource constructor receives this as `subscribedEventTypeGuard`; the patterns package filters with it and passes narrowed envelopes to `receiveEvents`. The messageBus in each lambda uses a single broad `StreamingEventMessage` with required `getContentInternal: () => Promise<unknown>` so baseClasses stay payload-agnostic.

2. **Subscribed payload type and per-event envelope guards**: A TypeScript union of the payload types this DataSource subscribes to. Per-event guards should accept `StreamingEventEnvelope<SubscribedContent>` (the type `receiveEvents` actually receives) and narrow to the specific envelope variant (e.g. `event is Extract<AssetsIncomingEvent, { header: { type: 'Zone Changed' } }>`), so they work without casting the events array. Export any constants used by the aggregate guard (e.g. event type sets).

3. **Typed send-helpers (optional)**: For each event kind that **this lambda** publishes to its own messageBus (not events it only forwards from EventBridge), add a helper `sendX(bus, streamKey, content)`. The bus is the first argument so the module stays decoupled from the messageBus singleton and tests can inject a mock. Signature pattern: `sendX(bus: { send: (payload: StreamingEventMessage) => void }, streamKey: string, content: XPayload): void`. The helper builds the envelope shape (header, getContentInternal) and calls `bus.send(...)`.

**Conventions:**

- Payload types are imported from upstream (mtw-interfaces, sibling modules, etc.); subscribedEvents owns the subscription union, envelope guards, and send-helpers only.
- Initialize Subscription and other special/bootstrap events are out of scope for subscribedEvents; they stay on their separate subscription path.
- Send-helpers are only for events **this lambda** publishes to its own messageBus; do not add helpers for events the lambda only forwards from EventBridge.
- In lambdas with multiple DataSources (e.g. assets: dataSource, players, library, contentHeaders, characters), each DataSource lives in its own directory and has exactly one `subscribedEvents.ts` in that directory.
- Reference implementation: [lambda/wml/dataSource/subscribedEvents.ts](../../../../lambda/wml/dataSource/subscribedEvents.ts).

### **Type-Safe Routing with Envelope-Level Discriminated Unions and Payload Purity**:

When using the header + getContentInternal envelope shape (`StreamingEventEnvelope<Content>`), discriminants such as `type` and `dataSourceKey` live on the `header`, not on the payload. To keep routing logic type-safe without embedding redundant `type` fields in `content`, and to keep payloads focused on domain data, the recommended pattern is:

1. **Define an envelope-level union** for subscribed events in the lambda layer (using `getContentInternal` to match `StreamingEventEnvelope`):

   ```ts
   export type AssetsIncomingEvent =
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' };
             getContentInternal: () => Promise<WMLZoneEvent>;
         }
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.wml'; type: 'Asset Purged' };
             getContentInternal: () => Promise<WMLPurgeEvent>;
         }
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Heal Global Values' };
             getContentInternal: () => Promise<{ type: 'Heal Global Values'; connections?: unknown; assets?: unknown }>;
         }
       | {
             header: StreamingEventHeader & { dataSourceKey: 'mtw.coordination'; type: 'Remove Asset' };
             getContentInternal: () => Promise<{ type: 'Remove Asset'; assetId: string }>;
         };
   ```

2. Either **cast the incoming `events` array** to the envelope union where you need stronger typing, or **type per-event guards** to accept `StreamingEventEnvelope<SubscribedContent>` and narrow to the union variant (preferred, so no cast is needed).

3. **Use small, focused type guard functions** to route on `header` while narrowing the envelope (and therefore the return type of `getContentInternal()`). The guard should accept `StreamingEventEnvelope<SubscribedContent>` so it works with the events array without a cast:

   ```ts
   const isWMLZoneChangedEvent = (event: StreamingEventEnvelope<AssetsSubscribedContent>): event is Extract<
       AssetsIncomingEvent,
       { header: { dataSourceKey: 'mtw.wml'; type: 'Zone Changed' } }
   > => (
       event.header.dataSourceKey === 'mtw.wml' &&
       event.header.type === 'Zone Changed'
   );

   // In receiveEvents (event is StreamingEventEnvelope<SubscribedContent>; guards narrow to union variant)
   await Promise.all(events.map(async (event) => {
       if (isWMLZoneChangedEvent(event)) {
           const content = await event.getContentInternal(); // fully narrowed
           const { fromZone, toZone } = content;
           // ...
       }
   }));
   ```

This pattern works around a TypeScript limitation: the compiler does not automatically narrow a union based on checks of **nested** discriminant properties (for example, `event.header.type`) even though it does so for top-level discriminants (`event.type`). By using envelope unions plus explicit type guards, DataSource implementations can keep routing decisions based on header fields while still enjoying precise typing of the content payloads.

**Payload Purity Guidelines**:

- **Header is authoritative for routing**: `header.type`, `header.dataSourceKey`, and any small routing flags added to the header are the single source of truth for routing and discrimination. Lambdas and serializers should never rely on payload `type` for routing once header is available.
- **Payloads focus on domain data**: The payload (from `getContentInternal()`) should represent the domain event body (for example, WML edits, asset metadata), not duplicate routing metadata that already exists in the header.
- **Compatibility with existing contracts**:
  - For externally-constrained contracts (for example, EventBridge payloads in `mtw-interfaces/ts/eventBridge/**`), payload `type` is preserved where required, but treated as **derived** from `header.type` and not used for routing.
  - When reconstructing internal events in `deserialize`, use `header.type` to set the internal `type` field; payload `type` is at most validated, not trusted as the primary discriminator.

Following these guidelines keeps wire formats stable while making header the canonical location for routing metadata and allowing payloads to remain as pure as possible representations of domain state.

**Benefits**:
- **Processing Flexibility**: Supports aggregation, parallel processing, sequential processing, or mixed patterns
- **Scalability**: Foundation for handling high-volume event streams efficiently
- **Extensibility**: Easy to implement new processing patterns as requirements evolve
- **Performance**: Can optimize processing approach based on event characteristics and business logic

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
Each replayable data source maintains a local DynamoDB table for replay data across multiple subscribable streams. The Primary Key will be variable (`AssetId`, `EphemeraId`, and so on), but the general pattern will be that all stream records have a PK of `STREAM#${dataSourceKey}::${streamKey}`.

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

**Discovering Implementations**: This pattern doc does not enumerate call-sites. Use search for a live inventory:

- **Envelope unions**: `rg "IncomingEvent"` or `rg "export type \w+IncomingEvent"` (e.g. `AssetsIncomingEvent`, `LibraryIncomingEvent`) in lambda files
- **DataSource instantiations**: `rg "dataSourceKey: 'mtw\."` in `lambda/`
- **Serializers**: See [EventBridge AGENT.implementation.md](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md#discovering-implementations) for serializer and contract discovery

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

### **Multi-Context Serialization Challenge**

The DataSource pattern currently faces a serialization complexity issue where different transmission contexts require different structural representations of the same core metadata (`dataSourceKey`, `type`, and `streamKey`).

**The Problem**: Instead of having a core format with context-specific transforms, the codebase has evolved a _de facto_ union format that accommodates all required structures simultaneously, leading to:
- Functions expecting both `detailType` and `type` fields at separate levels
- Redundant metadata storage across different contexts
- Complex serialization logic that tries to satisfy multiple format requirements
- Difficulty maintaining clean separation between internal and external representations

**Context-Specific Format Requirements**:

**EventBridge Format**:
- **Filtering Priority**: `dataSourceKey` (`source`) and `type` (`detailType`) as top-level fields
- **Structure**: `{ source, detailType, detail: { streamKey, update } }`
- **Use Case**: Cross-service communication with EventBridge filtering capabilities

**DynamoDB Format**:
- **Sorting Priority**: `dataSourceKey` and `streamKey` encoded in string keys
- **Structure**: `{ PK: 'STREAM#${dataSourceKey}::${streamKey}', type, update }`
- **Use Case**: Efficient querying and sorting by stream and data source

**WebSocket Format**:
- **Transmission Priority**: All metadata as properties of the message
- **Structure**: `{ messageType: 'StreamEvent', message: { dataSourceKey, streamKey, type, update } }`
- **Use Case**: Real-time client delivery with complete context

**Proposed Solution**: Core External Format + Context Transforms

**Core External Format**: Standardized representation containing all essential metadata:
```typescript
interface CoreExternalFormat {
    dataSourceKey: string;
    streamKey: string;
    update: any; // Contains { type: string, ...rest } - the actual content data
}
```

**Context-Specific Transformers**: Bidirectional transforms for each transmission context:
- **EventBridge Transformer**: 
  - `CoreExternalFormat` → EventBridge event structure (for publishing)
  - EventBridge event structure → `CoreExternalFormat` (for receiving)
- **DynamoDB Transformer**: 
  - `CoreExternalFormat` → DynamoDB record structure (for storage)
  - DynamoDB record structure → `CoreExternalFormat` (for replay)
- **WebSocket Transformer**: 
  - `CoreExternalFormat` → WebSocket message structure (for delivery)
  - WebSocket message structure → `CoreExternalFormat` (for processing received messages)

**Benefits of This Approach**:
- **Single Source of Truth**: Core format eliminates metadata duplication
- **Clear Boundaries**: Each context has explicit transformation logic
- **Maintainability**: Changes to core format propagate cleanly through transformers
- **Type Safety**: Each transformer can have proper TypeScript types
- **Testability**: Individual transformers can be tested in isolation
- **Performance**: Avoids complex union format processing

**Implementation Strategy**:
1. **Define Core Format**: Establish the standard external representation
2. **Create Transformers**: Build context-specific transformation classes
3. **Refactor Serializers**: Update existing serialization logic to use core format + transforms
4. **Update DataSource**: Modify DataSource to use the new serialization pattern
5. **Migrate Existing Code**: Gradually update code that expects the old union format

### **EventSerializer Implementation**

The DataSource pattern uses the `eventSerializer` constructor parameter to handle the transformation between internal messageBus events and external transmission formats.

**Purpose**: Enable DataSources to maintain clean internal event processing while supporting proper external event contracts for cross-service communication.

**Method**: `eventSerializer` constructor parameter - Optional serializer for external integration
- **`serialize(params)`**: Convert internal update payload to external format for transmission
- **`deserialize(params)`**: Convert external update payload back to internal format

**New Architecture**: Event serializers are now defined in `mtw-interfaces/ts/eventBridge/` and imported by lambdas:
- **Centralized Contracts**: All event types and serializers in shared interface layer
- **Service Isolation**: No cross-lambda dependencies
- **Import Pattern**: `import { MyEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge'`

**Implementation Guide**: For detailed technical guidelines on implementing EventBridge event contracts, see **[EventBridge Implementation Guide](../../../mtw-interfaces/ts/eventBridge/AGENT.implementation.md)**.

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
- **Boundary Enforcement**: Serialization only occurs at the external transmission boundary
- **Type Safety**: Full TypeScript support for both internal and external event structures

**Integration with Multi-Context Architecture**: The `eventSerializer` works with the core external format - it transforms between internal format and `CoreExternalFormat`, while context-specific transformers handle the final conversion to specific transmission formats (EventBridge, DynamoDB, WebSocket).

## Aggregation

The DataSource pattern optionally supports aggregation logic to describe how clients and subscribers should combine snapshots with streaming events to maintain current state.

### **Core Concept**

Aggregation treats the internal snapshot format as the materialized state. An aggregator describes how to:
1. Create an empty snapshot (before any data arrives)
2. Apply delta events to a snapshot to produce a new snapshot

**Key Insight**: Rather than defining a separate "materialized state" type, the internal snapshot format IS the materialized state. This simplifies the type system and aligns with how snapshots are actually used.

### **DataSourceAggregator Interface**

```typescript
export interface DataSourceAggregator<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload
> {
    /**
     * Create an empty snapshot (for initialization before any data arrives)
     */
    createEmpty(): SnapshotPayload

    /**
     * Apply a single update event to a snapshot
     * Returns the new snapshot (immutable pattern)
     */
    applyUpdate(
        snapshot: SnapshotPayload,
        update: UpdatePayload
    ): AggregationResult<SnapshotPayload>
}
```

### **AggregationResult Type**

```typescript
export type AggregationResult<SnapshotPayload> = 
    | { success: true; snapshot: SnapshotPayload }
    | { success: false; error: Error; snapshot: SnapshotPayload }
```

This result type supports **partial failure** - individual events can fail without stopping subsequent event processing. The unchanged snapshot is returned on failure, allowing the aggregator to continue processing subsequent events.

### **Usage Pattern**

Aggregators are provided to the DataSource constructor and accessed via `getAggregator()`:

```typescript
const dataSource = new DataSource({
    // ... other parameters
    aggregator: new ContentHeadersAggregator()
})

// Later, clients can access the aggregator
const aggregator = dataSource.getAggregator()
if (aggregator) {
    let currentState = aggregator.createEmpty()
    
    // Apply snapshot
    const snapshotResult = aggregator.applyUpdate(currentState, snapshot)
    if (snapshotResult.success) {
        currentState = snapshotResult.snapshot
    }
    
    // Apply subsequent events
    for (const event of events) {
        const result = aggregator.applyUpdate(currentState, event)
        if (result.success) {
            currentState = result.snapshot
        } else {
            console.warn('Failed to apply event:', result.error)
            // Continue with unchanged state
        }
    }
}
```

### **Design Decisions**

- **Optional Feature**: Aggregators are optional - not all DataSources need them
- **Immutable Pattern**: All operations return new snapshots rather than mutating
- **Timestamp Ordering**: Expected to be handled by clients (events typically have timestamps)
- **Partial Failure**: Individual events can fail without breaking the aggregation chain
- **Type Safety**: Full TypeScript generics ensure compile-time correctness

### **Future Considerations**

Potential future additions to the aggregation pattern:
- Utility functions for timestamp-ordered batch application
- Merge strategies for handling concurrent updates
- Conflict resolution patterns for complex state

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
- **Event Aggregation**: Support for N-to-1 aggregation patterns where multiple related events are collected and processed together to generate a single derived event (foundation now in place with batch processing)
- **Event Ordering**: Guarantee ordered processing for events from the same source
- **Dead Letter Queues**: Handle failed event processing with retry logic
- **Event Validation**: Built-in validation for external EventBridge event formats

---

**For usage guidance and high-level concepts, see [AGENT.md](./AGENT.md)**
