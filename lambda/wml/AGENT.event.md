# WML Lambda - Event Flow Documentation

**Status: ACTIVE - DataSource Pattern Implemented**

This document tracks the event flow architecture within the WML Lambda system, which serves as the **Source of Truth** for WML content in Make The World's event mesh.

## Overview

The WML Lambda serves as the domain authority for WML source files and their StandardForm representations. It participates in the event mesh as:

- **Event Consumer**: Processes internal events (Apply Edit, Move Asset, Purge Asset, and **Canonize Asset** when enqueued on `api.wml` by coordination). **Decanonize** remains reserved (no operator or client trigger). **`promoteToCanon`** is a **direct** WML API message (operator/bootstrap); it is **not** a new EventBridge-ingested event type---it enqueues the same `api.wml` coordination primitives as other flows.
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

**Event Subscriptions**: Subscribes to `api.wml` events (Apply Edit, Move Asset, Purge Asset, **Canonize Asset**, Decanonize) and `mtw.diagnostics`. **Canonize Asset** runs when internal coordination sends it (for example from the operator **`promoteToCanon`** path). There is **no** separate EventBridge subscription that invents canonize from outside the lambda; **Decanonize** has no product or operator call path yet.

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
5. **Internal event processing**: Apply Edit, Move Asset, Purge Asset; **Canonize Asset** when driven by coordination (see **Operator promote to Canon** below); **Decanonize** handler exists but has no call path
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

**API-triggered events** (dataSourceKey: `api.wml`, via direct handler → messageBus coordination):
- Apply Edit, Move Asset, Purge Asset, **Canonize Asset** (when enqueued internally), Decanonize (handler reserved; no trigger).

**Direct API Calls** (via Step Functions or WebSocket API):
- `applyEdit` - Apply WML edit to existing content (processed via DataSource)
- `moveAsset` - Move asset between zones (processed via DataSource)
- `promoteToCanon` - Operator/bootstrap: promote an asset to **Canon** by `AssetId` using internal **`Move Asset`** (to Library when needed) and **`Canonize Asset`** on the messageBus (same authority pipeline as normal zone work; not a first-class client publishing API). See **Operator promote to Canon** below.
- ~~`copyWML`~~ - DEPRECATED (removed in Phase 1 migration)
- ~~`resetWML`~~ - DEPRECATED (removed in Phase 1 migration)
- `backupWML` - Create backup of asset (deferred to Phase 2)
- Atomic lock operations (`requestLock`, `checkLock`, `yieldLock`)

### Outgoing Events

**Via DataSource Pattern** (published to `mtw.wml` EventBridge source):
- `Zone Changed` - Asset moved between zones
  - Includes: fromZone, toZone, player (optional), subFolder (optional)
  - Triggered by: Move Asset operations, canonization (including steps issued by **`promoteToCanon`**). **Decanonization** is not exposed on an operator path; reset demos by removing the asset instead.

- `Content Update` - WML content successfully edited
  - Includes: StandardForm schema (serialized to WML string)
  - Header `RequestIds`: non-empty only when the triggering Apply Edit carried `RequestId` (client optimistic save)
  - Triggered by: Apply Edit operations via DataSource

- `Merge Conflict` - Edit application failed
  - Includes: error message
  - Header `RequestIds`: same rule as Content Update (confirms failed client edit; suppresses pending overlay)
  - Triggered by: Apply Edit merge failures via DataSource

**Stream-header `RequestIds` contract** (`lambda/wml/dataSource/mtw-wml.ts`):

| Publisher | Event type | `RequestIds` |
| --- | --- | --- |
| `processApplyEdit` (payload has `RequestId`) | `Content Update`, `Merge Conflict` | `[payload.RequestId]` |
| `processApplyEdit` (no `RequestId` on payload) | `Content Update`, `Merge Conflict` | `[]` |
| `processS3StructureFinding` (primitives bootstrap) | `Content Update` | `[]` (not client edit resolution) |
| move / canonize / snapshot / purge handlers | Zone Changed, Snapshot Created, Asset Purged | omitted |

Consumers must treat absent or empty `RequestIds` as "no client pending confirmation." Cross-data-source stream correlation inventory: [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Stream correlation ids**).

### Internal Event Orchestration

**MessageBus Architecture**:
- Type-safe internal event bus using `@tonylb/mtw-lambda-patterns`
- Ingress and coordination helpers use **`publish`**; lambda boundaries use **`flushAndSettle()`**
- Supports `ReturnValue`, `Error`, and `StreamingEvent` message types
- `ReturnValue` / `Error` collected via [`createBoundaryResponseCollector`](../../packages/mtw-lambda-patterns/ts/messageBus/boundaryResponseCollector.ts) at priority 16; `extractReturnValue` reads collectors only
- DataSource subscriptions enable event-driven processing; `streamEvent` outbounds use `messageBus.publish`

**Event Processing Flow**:
1. **Incoming EventBridge Events** → Deserialized → `publish` to messageBus → DataSource processing → boundary `flushAndSettle`
2. **Direct API Calls** → `publish` coordination events → DataSource `receiveEvents` → `streamEvent` outbounds → boundary `flushAndSettle`
3. **Operator promoteToCanon** → direct `coordinateMoveAsset` / `coordinateCanonizeAsset` (no bus loop between steps) → boundary `flushAndSettle`

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

**Incoming api.wml events** (API → publish-helper → messageBus → receiveEvents):
- `Apply Edit` - WML edit application
- `Move Asset` - Asset zone transitions
- `Purge Asset` - Asset purge (Draft/Archive)
- **`Canonize Asset`** - Runs when coordination delivers it via bus ingress or direct **`coordinateCanonizeAsset`** (operator **`promoteToCanon`** uses the direct path); future **community publishing** flows may enqueue the same primitives from product UX---see [AGENT.collaboration.md](../../AGENT.collaboration.md) and [AGENT.collaboration.publishing.md](../../AGENT.collaboration.publishing.md)). This is **not** a separate bootstrapping-only S3 path; authoritative updates still go through `mtw-wml` as for other zone operations.
- **Decanonize** - Handler reserved; no operator or EventBridge trigger (demo reset: remove the asset).
- **Create Snapshot** - Reserved for reactivation. See [packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (Snapshot envelope conventions).

### Operator promote to Canon

**Purpose:** Development and bootstrap (for example Coyote Game scenery in [AGENT.CoyoteGame.md](../../AGENT.CoyoteGame.md)): promote a WML asset to **Canon** by **`AssetId`** without a first-class client publishing API.

**Invocation:** Trusted operator surfaces only (for example Lambda test console or WebSocket payload with `message: 'promoteToCanon'`). Additional IAM or env gating is a separate concern; this doc describes event flow only.

**Mechanics:** [`lambda/wml/promoteToCanon.ts`](./promoteToCanon.ts) plans a minimal sequence (`planPromoteToCanonSteps`): if the asset is not already in **Library**, run **`coordinateMoveAsset`** toward **Library**, then **`coordinateCanonizeAsset`** (Library → Canon via shared helpers in [`dataSource/mtw-wml.ts`](./dataSource/mtw-wml.ts)). Each step is awaited directly (no bus self-subscribe loop); the runner **re-reads zone and player** from **`AssetWorkspace.fromUUID`** between steps so work is skipped if already done (**state-based idempotency**; no `idempotencyKey` on the message). Boundary **`flushAndSettle()`** drains outbound subscriber work before the lambda returns. If the asset is **already Canon**, no coordination runs and no redundant **`Zone Changed`** is published.

**Player (Draft/Personal `fromZone`):** Internal **`Move Asset`** payloads include **`player`** from that refetch so **[`s3Storage` `changeZone`](./s3Storage/index.ts)** can pass it into **`fetchAndDecideRepair`**. Without it, moves **from** **Draft** or **Personal** can fail (`AssetWorkspace` requires **`player`** in those zones). The direct **`moveAsset`** handler forwards **`request.player`** into **`changeZone`** the same way (`MoveAssetRequest` in [`dataSource/localApiEvents.ts`](./dataSource/localApiEvents.ts)).

**Outbounds:** Same **`Zone Changed`** (and any other outbounds from those primitives) as normal moves and canonize---not a parallel synthetic event channel.

**vs publishing:** **`promoteToCanon`** is an **operator escape hatch** aligned with **direct canon** and **operator rollback** language in the collaboration docs. Long term, **community publishing** should supersede ad hoc promotion; keep this path easy to narrow or delete once publishing exists.

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
- Subscribes to `api.wml` dataSource for Apply Edit, Move Asset, Purge Asset, Canonize Asset, Decanonize (and mtw.diagnostics)
- Processes Apply Edit, Move Asset, Purge Asset, and **Canonize Asset** when coordination delivers it (including from **`promoteToCanon`**). **Decanonize** remains without a triggering call path.
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
- `lambda/wml/promoteToCanon.ts` - Operator **`promoteToCanon`** coordination (step plan and messageBus runner); tests in `lambda/wml/promoteToCanon.test.ts`
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
- Promote to Canon: `lambda/wml/promoteToCanon.test.ts`
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
- **Emit an event**: Use `messageBus.publish` with StreamingEvent, or `streamEvent` from a DataSource
- **Process an incoming event**: Add to DataSource `receiveEvents` handler
- **Test event handling**: See `dataSource/mtw-wml.test.ts` for examples
- **Subscribe to WML events**: Listen to `mtw.wml` EventBridge source

---

**Document Status**: Reflects the DataSource pattern plus the operator **`promoteToCanon`** path (direct WML API message, internal `api.wml` coordination, same outbound events as other zone operations). Update when publishing-driven UX changes how **Canonize Asset** is enqueued or when new event types ship.
