# WML Lambda - Event Flow Documentation

**Status: ACTIVE - DataSource Pattern Implemented**

This document tracks the event flow architecture within the WML Lambda system, which serves as the **Source of Truth** for WML content in Make The World's event mesh.

## Overview

The WML Lambda serves as the domain authority for WML source files and their StandardForm representations. It participates in the event mesh as:

- **Event Consumer**: Processes internal events (Apply Edit, Move Asset, Purge Asset); canonize/decanonize handlers reserved (no current trigger)
- **Event Producer**: Publishes content updates, zone changes, and merge conflicts via EventBridge
- **Source of Truth**: Maintains authoritative S3 storage for WML and NDJSON files
- **Data Transformation Pipeline Root**: Triggers downstream caching and materialization

## Data Source

### **mtw.wml** (Main WML DataSource)

**Purpose**: Publishes WML content and zone change events to EventBridge for downstream processing

**Type**: Non-replayable (event streaming only, no client subscriptions)

**Streams**: Per-asset streams using asset ID as streamKey

**Events Published**:
- `Content Update` - WML content edited and merged successfully
- `Zone Changed` - Asset moved between zones (Canon, Library, Personal, Draft, Archive)
- `Merge Conflict` - Edit application failed due to conflicts

**Event Subscriptions**: Subscribes to api.wml events (Apply Edit, Move Asset, Purge Asset) and mtw.diagnostics; canonize/decanonize reserved (no API or EventBridge trigger)

**Implementation**: [`./dataSource/mtw-wml.ts`](./dataSource/mtw-wml.ts)

**Event Contracts**: [`../../packages/mtw-interfaces/ts/eventBridge/wml/`](../../packages/mtw-interfaces/ts/eventBridge/wml/index.ts)

**Header vs Payload Authority**: Routing uses `StreamingEventHeader` (type, dataSourceKey, streamKey, timestamp). Content carries WML, zone data, schema, and other domain payload. Payload `type` is preserved for wire compatibility but is not used for routing.

## Current Implementation Status

### ✅ Completed

The WML Lambda has successfully implemented the DataSource pattern with the following capabilities:

1. **Event Serialization**: Full `WMLEventSerializer` in `mtw-interfaces` package handling StandardForm ↔ WML string conversion
2. **MessageBus Integration**: Internal event coordination fully wired and functional
3. **Zone Changed Events**: Published via DataSource pattern when assets move between zones
4. **Move Asset Operations**: Complete implementation with S3 file moves and event publishing
5. **Internal event processing**: Apply Edit, Move Asset, Purge Asset; canonize/decanonize handlers exist but are reserved (no call path)
6. **EventBridge Event Ingestion**: Receives and deserializes incoming events from other data sources

### ✅ Recently Completed

1. **Apply Edit Migration** (Completed): Content Update and Merge Conflict events now use DataSource pattern
   - Business logic moved to `dataSource/applyEdit/index.ts`
   - Events emitted via `streamEvent()` instead of legacy EventBridge client
   - Full integration with messageBus and WMLEventSerializer
   - Follows same pattern as `moveAsset`

### ❌ Not Yet Implemented

1. **Authorization Update Events**: Documented in README.md but no implementation found
   - **Status**: May be deferred or handled differently in current architecture
   - **Action Needed**: Clarify if authorization edits are a separate concern

## Event Flow Patterns

### Incoming Events

The WML Lambda receives events from multiple sources:

**API-triggered events** (dataSourceKey: `api.wml`, via API → messageBus):
- Apply Edit, Move Asset, Purge Asset. Canonize/Decanonize reserved (no trigger).

**Direct API Calls** (via Step Functions or WebSocket API):
- `applyEdit` - Apply WML edit to existing content (processed via DataSource)
- `moveAsset` - Move asset between zones (processed via DataSource)
- ~~`copyWML`~~ - DEPRECATED (removed in Phase 1 migration)
- ~~`resetWML`~~ - DEPRECATED (removed in Phase 1 migration)
- `backupWML` - Create backup of asset (deferred to Phase 2)
- Atomic lock operations (`requestLock`, `checkLock`, `yieldLock`)

### Outgoing Events

**Via DataSource Pattern** (published to `mtw.wml` EventBridge source):
- `Zone Changed` - Asset moved between zones
  - Includes: fromZone, toZone, player (optional), subFolder (optional)
  - Triggered by: Move Asset operations, canonization, decanonization

- `Content Update` - WML content successfully edited
  - Includes: StandardForm schema (serialized to WML string), `RequestIds` for client pending-edit clearance
  - Triggered by: Apply Edit operations via DataSource

- `Merge Conflict` - Edit application failed
  - Includes: error message, `RequestIds` for client pending-edit clearance
  - Triggered by: Apply Edit merge failures via DataSource

### Internal Event Orchestration

**MessageBus Architecture**:
- Type-safe internal event bus using `@tonylb/mtw-lambda-patterns`
- Supports `ReturnValue`, `Error`, and `StreamingEvent` message types
- DataSource subscriptions enable event-driven processing

**Event Processing Flow**:
1. **Incoming EventBridge Events** → Deserialized → Published to messageBus → DataSource processing
2. **Direct API Calls** → Business logic → Events published to messageBus → DataSource streaming to EventBridge
3. **Internal Coordination** → MessageBus enables cross-concern coordination without tight coupling

## Integration Patterns

### Assets Lambda Coordination

**Primary Integration**: WML Lambda publishes events that Assets Lambda consumes

**Event Flow**:
- `Content Update` → Assets Lambda recaches component data
- `Zone Changed` → Assets Lambda updates zone metadata and triggers downstream updates

**Consistency Model**: Eventually consistent - Assets Lambda materializes views based on WML events

### Zone Management

**Current Implementation**:
- WML Lambda maintains authoritative zone state in S3 file paths
- Move operations physically relocate files in S3
- Zone Changed events notify subscribers of transitions

**Supported Zones**:
- `Canon` - Canonical shared content
- `Library` - User-created shared library
- `Personal` - Player-specific private content  
- `Draft` - Player draft workspace
- `Archive` - Soft-deleted content

### Internal event handling

**Incoming api.wml events** (API → send-helper → messageBus → receiveEvents):
- `Apply Edit` - WML edit application
- `Move Asset` - Asset zone transitions
- `Purge Asset` - Asset purge (Draft/Archive). Canonize/Decanonize and Create Snapshot handlers are reserved (no current API or trigger). Canonize/Decanonize will be reactivated with publishing UI ([AGENT.collaboration.publishing](../../AGENT.collaboration.publishing.md)); Create Snapshot will be refactored with the delegation pattern ([documentation/dataSources/AGENT.delegation.planning.md](../../documentation/dataSources/AGENT.delegation.planning.md)).

## Related Event Documentation

This document is part of a coordinated event flow documentation effort across the core Make The World lambda systems:

- **[Assets Event Flows](../assets/AGENT.event.md)**: Asset caching, component management, and file coordination events
- **[Ephemera Event Flows](../ephemera/AGENT.event.md)**: Real-time game state and character event processing

## Technical Architecture

### Event Serialization

**Location**: `@tonylb/mtw-interfaces/ts/eventBridge/wml/index.ts`

**Key Components**:
- `WMLEventSerializer` - Handles StandardForm ↔ WML string conversion
- `WMLEventUpdate` - Internal event union type (ContentEvent | ZoneEvent)  
- `WMLEventExternal` - External event union type for EventBridge
- Type guards for runtime event validation

**Serialization Logic**:
- **Content Update**: StandardForm → WML string for transmission
- **Zone Changed**: Pass-through (already structured data)
- **Merge Conflict**: Pass-through with optional error message

### DataSource Implementation

**Base Class**: `WMLDataSource` extends `DataSource` from `@tonylb/mtw-lambda-patterns`

**Configuration**:
- **Replayable**: No (event streaming only, no snapshots). Planned replayable implementation will use WML text as the canonical snapshot body in Dynamo (plus snapshot metadata), deserializing to `StandardForm` for internal aggregation and replay; `StandardFormData` will remain a client/Redux representation only.
- **Primary Key**: `AssetId`
- **Streams**: Per-asset (one stream per asset UUID)
- **MessageBus**: Integrated with lambda-wide messageBus
- **SNS**: Connected to feedback topic for notifications

**Event Handling**:
- Subscribes to `api.wml` dataSource for Apply Edit, Move Asset, Purge Asset (and mtw.diagnostics)
- Processes Apply Edit, Move Asset, Purge Asset; Canonize/Decanonize handlers reserved (no call path)
- Streams appropriate events (Content Update, Merge Conflict, Zone Changed) on operation completion
- Error handling with logging (operations don't fail on streaming errors)

## Outstanding Work

### High Priority

1. **Clarify Authorization Update Events**
   - Determine if authorization edits are a separate concern
   - If needed, implement authorization layer edit handling
   - Document authorization update patterns and integration

### Low Priority (Future Enhancements)

3. **Enhanced Event Metadata**
   - RequestId/RequestIds tracking through event chains is implemented: client sends RequestId with applyEdit, WML dataSource streams RequestIds in Content Update/Merge Conflict, subscription message carries top-level RequestIds, client clears pendingEdits by RequestIds (see mtw-interfaces subscriptions and charcoal-client receiveWMLEvent).
   - Include timing/performance metrics in events
   - Add event causality tracking for debugging

4. **Performance Optimization**
   - Batch multiple WML operations before emitting events
   - Implement throttling for high-frequency updates
   - Add event deduplication logic

## Development Notes

### Key Implementation Files

**DataSource Core**:
- `lambda/wml/dataSource/mtw-wml.ts` - Main DataSource implementation
- `lambda/wml/dataSource/abstract.ts` - WML-specific base class
- `lambda/wml/dataSource/coordinationSerializer.ts` - Coordination event types
- `lambda/wml/messageBus/` - MessageBus implementation

**Business Logic**:
- `lambda/wml/dataSource/applyEdit/` - Content edit application via DataSource
- `lambda/wml/dataSource/moveAsset/` - Asset zone transitions via DataSource
- ~~`lambda/wml/resetWML/index.ts`~~ - DEPRECATED (removed in Phase 1)
- ~~`lambda/wml/copyWML/index.ts`~~ - DEPRECATED (removed in Phase 1)
- `lambda/wml/backupWML/index.ts` - Asset backup creation (deferred to Phase 2)

**Event Contracts**:
- `packages/mtw-interfaces/ts/eventBridge/wml/index.ts` - Event type definitions
- `packages/mtw-interfaces/ts/eventBridge/wml/index.test.ts` - Event serialization tests

### Testing Considerations

**Unit Tests**:
- DataSource event handling: `lambda/wml/dataSource/mtw-wml.test.ts`
- Apply Edit operations: `lambda/wml/dataSource/applyEdit/index.test.ts`
- Move Asset operations: `lambda/wml/dataSource/moveAsset/index.test.ts`
- Event serialization: `packages/mtw-interfaces/ts/eventBridge/wml/index.test.ts`

**Integration Testing Needs**:
- End-to-end event flow from WML edit to Assets Lambda cache update
- Zone transition coordination with coordination service
- Conflict resolution and merge failure handling
- Event ordering and causality verification

### Monitoring and Observability

**Current Logging**:
- Error logging for streaming failures
- Move operation success/failure logging
- Event deserialization error logging

**Recommended Additions**:
- Event emission metrics (count, type, latency)
- DataSource processing metrics
- Coordination event processing success rates
- Zone transition audit trail

## Navigation Notes

### Related Documentation

- **[WML Functional Documentation](README.md)**: Current API, EventBridge events, and usage patterns
- **[WML Language System](../../packages/mtw-wml/ts/AGENT.md)**: Core WML language documentation and parsing
- **[DataSource Pattern](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.md)**: Implementation guide for DataSource pattern
- **[Event Contracts](../../packages/mtw-interfaces/ts/eventBridge/AGENT.md)**: EventBridge event type definitions
- **[Assets Event Flows](../assets/AGENT.event.md)**: Downstream consumer of WML events
- **[System Event Architecture](../../AGENT.architecture.events.md)**: System-wide event architecture principles
- **[Architectural Philosophy](../../AGENT.architecture.philosophy.md)**: Core design philosophy

### Quick Reference

**I want to...**
- **Add a new event type**: Define in `mtw-interfaces/ts/eventBridge/wml/`, update serializer
- **Emit an event**: Use messageBus.send() with StreamingEvent, let DataSource handle publishing
- **Process an incoming event**: Add to DataSource `receiveEvents` handler
- **Test event handling**: See `dataSource/mtw-wml.test.ts` for examples
- **Subscribe to WML events**: Listen to `mtw.wml` EventBridge source

---

**Document Status**: This document reflects the current state of the WML Lambda event architecture as of the DataSource pattern implementation. It should be updated as new event types are added or significant architectural changes are made.
