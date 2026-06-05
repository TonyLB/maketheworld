# Subscriptions Lambda - AI Navigation Guide

## Overview

The subscriptions lambda serves as a **configurable data connector** that bridges EventBridge event streams with WebSocket connections. It enables real-time event distribution to connected clients through a flexible subscription system.

### Context
- **Role**: Event streaming bridge between backend systems and client connections
- **Architecture Position**: Message routing layer in the event-driven architecture
- **Integration**: Connects EventBridge events to WebSocket sessions via DynamoDB subscription tracking

### Key Concepts
- **Subscription Library**: Configurable event handlers that define which events to process and how to transform them
- **Connection Mapping**: DynamoDB-based tracking of which sessions subscribe to which event streams
- **Message Transformation**: Event-to-client message conversion with optional filtering and obfuscation
- **Session Management**: WebSocket connection lifecycle coordination with subscription cleanup

## Core Purpose

### Primary Function
The subscriptions lambda provides **real-time event distribution** from backend systems to connected clients through WebSocket connections.

### Key Responsibilities
- **Event Subscription Management**: Handle client subscribe/unsubscribe requests via WebSocket API
- **Event Stream Processing**: Receive EventBridge events and route them to appropriate subscribers
- **Message Transformation**: Convert backend events into client-appropriate message formats
- **Connection Lifecycle**: Coordinate subscription cleanup when sessions disconnect
- **Error Handling**: Manage failed WebSocket deliveries and connection cleanup

## Technical Details

### Data Structures

#### Subscription Storage Format
Subscriptions are stored in the `connections` DynamoDB table:
```typescript
{
    ConnectionId: "STREAM#source::detailType::detailExtract",
    DataCategory: "SESSION#sessionId"
}
```

#### Event Handler Configuration
```typescript
type LibraryEntry = {
    source: string;                    // EventBridge source (e.g., 'mtw.wml')
    detailType?: string;               // Optional event detail type filter
    detailExtract?: (event: any) => string;  // Extract subscription key from event
    transform?: (event: any) => SubscriptionClientMessage;  // Message transformation
}
```

### Core Methods

#### Subscription Library (`handlerFramework/index.ts`)
- **`subscriptionLibraryConstructor`**: Creates configurable event handler library
- **`subscriptionLibrary`**: Pre-configured handlers for WML events (Merge Conflict, Content Update)

#### Handler Framework (`handlerFramework/baseClasses.ts`)
- **`SubscriptionHandler`**: Individual event handler with matching and transformation logic
- **`SubscriptionEvent`**: Event processing with subscription lookup and message delivery
- **`SubscriptionLibrary`**: Collection management and event routing

**Event matching (header authority):** Subscription matching uses the envelope (header) for routing. When matching events to handlers, `matchEvent` uses `dataSourceKey`, `type`, and `streamKey` from the event's **header** when present; `update.type` is not the source of truth for matching. This aligns with the DataSource pattern where the header is authoritative for routing.

#### Connection Management (`internalCache/`)
- **`CacheGlobal`**: Session and connection metadata management
- **`CacheSessionConnections`**: WebSocket connection tracking
- **`CacheCharacterSessions`**: Character-to-session mapping
- **`CachePlayerSessions`**: Player-to-session mapping sourced from `Meta::Session` rows (no `Global / Sessions` dependency)

### Configuration

#### Current Event Handlers
- **WML (Merge Conflict, Content Update)**: Use the unified CoreExternalFormat/WebSocketFormat pipeline (`wireFormatsFromCoreFormat(coreFormat).webSocketFormat`).
- **mtw.assets.contentHeaders, mtw.assets.library, mtw.assets.players**: All use the unified CoreExternalFormat/WebSocketFormat pipeline; no bespoke transforms remain for these data sources.

#### Wire format (CoreExternalFormat / WebSocketFormat)

- EventBridge events are converted with `fromEventBridgeFormat` to `CoreExternalFormat`; handlers are matched via `matchEvent(coreFormat)` on the header (`dataSourceKey`, `type`, `streamKey`).
- Outgoing WebSocket messages are produced by `wireFormatsFromCoreFormat(coreFormat).webSocketFormat` (see `handlerFramework/baseClasses.ts` and `@tonylb/mtw-lambda-patterns/ts/dataSource`). No bespoke transforms remain for the current data sources.
- `eventType` on the wire is the projection of `header.type`; extended header fields (e.g. `RequestIds`, `RequestId`) are merged to the top level of the WebSocket message.
- Format types: `CoreExternalFormat`, `WebSocketFormat`, and transforms live in `packages/mtw-lambda-patterns/ts/dataSource/formatTransform.ts`; `SubscriptionClientMessage` and per-data-source external shapes live in `packages/mtw-interfaces/ts/subscriptions.ts` and the relevant `eventBridge` modules.

#### API Client (`apiClient.ts`)
- **WebSocket Delivery**: Manages message sending to connected clients
- **Connection Cleanup**: Handles failed deliveries and connection removal

## Integration Points

### Dependencies
- **Connections DynamoDB Table**: Subscription storage and session metadata
- **EventBridge**: Event source for backend system notifications
- **WebSocket API Gateway**: Client connection management
- **MTW Interfaces**: Message type definitions and validation

### Cross-References
- **[WML Lambda](../wml/AGENT.event.md)**: Primary event source for content updates and conflicts
- **[Assets Lambda](../assets/AGENT.event.md)**: Potential event source for asset changes
- **[Ephemera Lambda](../ephemera/AGENT.event.md)**: Real-time game state events
- **[Connections Lambda](../connections/)**: WebSocket connection lifecycle management

### API Contracts

#### Incoming WebSocket Messages
- **Subscribe**: `SubscribeAPIMessage` - Add event stream subscription
- **Unsubscribe**: `UnsubscribeAPIMessage` - Remove event stream subscription

#### Outgoing WebSocket Messages
- **Subscription Events**: `SubscriptionClientMessage` - Transformed backend events. Extended header correlation ids are merged to the WebSocket top level, not copied from the update payload. For **mtw.wml**, top-level `RequestIds` is sourced from the event header; non-empty values originate only from WML `processApplyEdit` when Apply Edit included `RequestId`. For **mtw.assets.*** and **mtw.ephemera.thinking.scheduling**, top-level `RequestId` is wire-supported per `mtw-interfaces/ts/subscriptions.ts` but most producers omit it today.

#### EventBridge Events
- **Session Disconnect**: `mtw.connections` source - Triggers subscription cleanup
- **Content Events**: `mtw.wml` source - Content updates and merge conflicts
- **Asset Events**: `mtw.assets` source - Asset state changes (future)

## Usage Patterns

### Common Scenarios

#### Adding New Event Types
```typescript
// Add to subscriptionLibrary in handlerFramework/index.ts
{
    source: 'mtw.newSystem',
    detailType: 'EventType',
    detailExtract: (event) => event.ResourceId,
    transform: (event) => ({
        messageType: 'Subscription',
        source: 'mtw.newSystem',
        detailType: 'EventType',
        ResourceId: event.ResourceId,
        RequestId: event.RequestId
    })
}
```

#### Client Subscription Flow
1. Client sends `SubscribeAPIMessage` via WebSocket
2. Lambda matches request to handler and extracts subscription key
3. Subscription stored in DynamoDB with `STREAM#` ConnectionId
4. Future matching events routed to client's WebSocket connection

#### Event Processing Flow
1. EventBridge delivers event to lambda
2. Lambda matches event to configured handler
3. Handler extracts subscription key and queries DynamoDB
4. Target sessions resolved through internal cache
5. Transformed messages sent to active WebSocket connections

### Best Practices
- **Handler Configuration**: Use specific `detailType` filters to avoid unnecessary processing
- **Message Transformation**: Always include `RequestId` for client correlation
- **Address Obfuscation**: Remove sensitive address information for client delivery
- **Error Handling**: Implement graceful degradation for failed WebSocket deliveries

### Error Handling
- **GoneException**: WebSocket connection closed, triggers connection cleanup
- **BadRequestException**: Invalid connection, triggers connection cleanup
- **Handler Mismatch**: Log unmatched events for debugging
- **Transform Errors**: Validate transformed messages before delivery

## Navigation Tips

### Getting Started
1. **Start with `app.ts`**: Main entry point showing WebSocket vs EventBridge handling
2. **Review `handlerFramework/index.ts`**: Current event handler configurations
3. **Examine `baseClasses.ts`**: Core subscription and event processing logic
4. **Check `internalCache/`**: Session and connection management patterns

### Key Files
- **`app.ts`**: Main lambda handler with WebSocket and EventBridge routing
- **`handlerFramework/baseClasses.ts`**: Core subscription processing classes
- **`handlerFramework/index.ts`**: Event handler library configuration
- **`internalCache/index.ts`**: Session metadata and connection tracking
- **`apiClient.ts`**: WebSocket message delivery and error handling

### Related Documentation
- **[Project Event Architecture](../../AGENT.architecture.events.md)**: System-wide event patterns
- **[WML Event Flows](../wml/AGENT.event.md)**: Primary event source documentation
- **[Assets Event Flows](../assets/AGENT.event.md)**: Asset-related event patterns
- **[EventBridge Configuration](AGENT.eventBridge.md)**: Initialize Subscription event routing setup

## Development Notes

### Migration context (unified pipeline)

The subscriptions lambda was migrated to a unified CoreExternalFormat-to-WebSocketFormat pipeline. That migration fixed client-visible bugs (missing `eventType` on StreamEvent messages, deserializers dropping events) and aligned subscriptions with the rest of the system: one pipeline produces WebSocket messages from `CoreExternalFormat`, and the client uses `fromWebSocketFormat` plus DataSource serializers. Header is authoritative for routing; when adding new handlers, use the default path (see Wire format above and `handlerFramework/index.ts`, `baseClasses.ts`, `mtw-lambda-patterns` formatTransform, `mtw-interfaces` subscriptions and eventBridge).

### Guardrails

- When adding new handlers, use the default `wireFormatsFromCoreFormat` path and ensure messages pass `isSubscriptionClientMessage`; avoid hand-rolling WebSocket message shapes so `eventType` and extended header fields stay in sync with the canonical format.
- Invariant tests in `packages/mtw-lambda-patterns` assert that `toWebSocketFormat` projects `header.type` into `eventType` and that `fromWebSocketFormat` reconstructs `header.type` from `eventType`; see that package's test suite.

### Current State
- **Functional**: Successfully routes WML events to subscribed clients
- **Configurable**: Library-based handler system supports easy event type addition
- **Resilient**: Handles WebSocket failures and connection cleanup gracefully
- **Provisional Player Stream Support**: When clients subscribe to `mtw.assets.players`, the lambda rewrites a sentinel stream key of `self` to the authenticated `PlayerName`. This shim lets the front-end adopt the new replayable player data source without first performing an explicit `whoAmI` call. Once subscription authorization gains richer context awareness, replace this rewrite with a generalized, policy-driven mechanism.

### Future Plans
- **Asset Event Integration**: Add handlers for Assets Lambda events
- **Ephemera Event Integration**: Support real-time game state events
- **Enhanced Filtering**: More sophisticated subscription filtering options
- **Performance Optimization**: Batch processing for high-volume events

### Technical Debt
- **Limited Event Types**: Only handles WML events currently
- **Simple Transformation**: Basic message transformation without advanced filtering
- **Connection Tracking**: Could benefit from more sophisticated connection health monitoring
- **Error Reporting**: Limited visibility into subscription processing failures

### Integration Opportunities
- **Assets Lambda**: Cache update events for real-time asset changes
- **Ephemera Lambda**: Character movement and game state events
- **LLM Lambda**: AI-generated content notifications
- **Diagnostics Lambda**: System health and performance events

## Navigation Tips

1. **Event Flow Understanding**: Start with `app.ts` to understand the dual WebSocket/EventBridge handling
2. **Handler Configuration**: Review `handlerFramework/index.ts` to see current event types
3. **Subscription Logic**: Study `baseClasses.ts` for core subscription processing patterns
4. **Connection Management**: Examine `internalCache/` for session tracking implementation
5. **Error Handling**: Check `apiClient.ts` for WebSocket delivery and cleanup patterns

---

*This lambda serves as a critical bridge between backend event systems and client real-time updates, enabling responsive user experiences through configurable event streaming.*
