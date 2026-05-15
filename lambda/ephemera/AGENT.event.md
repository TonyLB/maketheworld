# Ephemera Lambda - Event Flow Documentation

**Status: ACTIVE DOCUMENTATION - SYSTEM IN TRANSITION**

This document provides documentation of key event flows within the Ephemera Lambda system, with particular attention to the ongoing transition away from legacy Variable/Computed/Action patterns toward example-driven content management.

**Note**: This documentation is a work in progress. While it covers many important event patterns, there are additional event flows that have not yet been fully documented.

## Purpose

This document contains analysis of:

- **Event Input Processing**: How the Ephemera Lambda receives and processes events from other system components
- **Internal Event Orchestration**: How events cascade and coordinate within the lambda's real-time processing systems  
- **Event Output Generation**: How the lambda generates perception events, character updates, and world state changes
- **Legacy System Transition**: How current event patterns are being migrated away from Variable/Computed/Action dependencies

### **WebSocket Event Processing**

The Ephemera Lambda serves as the primary WebSocket handler for real-time client communication:

#### **Connection Management Events**
- **`$connect`**: Authenticates incoming WebSocket connections
- **`$disconnect`**: Handles connection cleanup and character state updates
- **`whoAmI`**: Returns authenticated player information
- **`registercharacter`**: Associates connection with specific character for play

#### **Character Interaction Events**
- **`action`**: Executes character actions in the game world
- **`command`**: Parses and executes text-based character commands
- **`link`**: Handles character interaction with game elements
- **`generateRoomPreview`**: **Removed** as a WebSocket/API entry point (workbench preview flow). Cache-miss **generation** for passive render still lives in [`dataSource/renderOrchestration/generateRoomPreview.ts`](dataSource/renderOrchestration/generateRoomPreview.ts) and is invoked from **`findRender`**, not as a standalone client message. Legacy message-key references may remain in **`packages/mtw-interfaces`** until the interfaces cleanup pass.

#### **State Synchronization Events**
- **`fetchEphemera`**: Provides initial state synchronization for new connections
- **`sync`**: Delivers message history and state updates since specified timestamps

#### **Content Integration Events** *(Legacy - Under Review)*
- **`fetchImportDefaults`**: Provides asset import information for authoring tools
- **`fetchLibrary`**: Delivers library table-of-contents for content browsing

### **Internal Message Bus Architecture**

The Ephemera Lambda uses an internal message bus pattern to decouple complex event cascades:

#### **Connection Coordination Messages**
- **`Connect`**: Associates WebSocket connections with player accounts
- **`Disconnect`**: Cleans up connection state and updates character presence
- **`RegisterCharacter`**: Links connections to specific characters for gameplay

#### **Character State Management Messages**
- **`MoveCharacter`**: Handles character movement between rooms
- **`EphemeraUpdate`**: Broadcasts character state changes to connected clients
- **`FetchPlayerEphemera`**: Requests comprehensive state updates for players

#### **Perception and Rendering Messages**
- **`Perception`**: Requests character-perspective rendering of game components
- **`ReturnValue`**: Queues response data for WebSocket delivery. The handler merges multiple **`ReturnValue`** messages into **one** response body for the API Gateway round-trip ([`returnValue/extractReturnValue`](../returnValue/index.ts)). Multi-message client streams (e.g. correlated **`ConversationStep`**) use direct **`PostToConnection`** / lifeLine patterns where implemented, not merged Lambda bodies.

#### **Event Cascade Coordination**

The message bus enables complex workflows such as:
1. Character movement triggering room updates
2. Room updates triggering perception rendering
3. Perception rendering triggering WebSocket message delivery
4. All while maintaining character presence filtering

#### **api.ephemera (internal API stream)**

Parallel to **`api.wml`** and **`api.assets`** in other lambdas: **`dataSourceKey: 'api.ephemera'`** identifies **in-process** commands injected onto the message bus from the ephemera handler (or tests). These events are **not** produced by EventBridge and are **not** deserialized in `app.ts` from external `source` / `detail-type`.

- **Definitions**: [`lambda/ephemera/dataSource/localApiEvents.ts`](dataSource/localApiEvents.ts) (payload types and shape guards), [`lambda/ephemera/dataSource/apiEphemera.ts`](dataSource/apiEphemera.ts) (header/envelope guards, `sendPutCacheRecord`, `sendDeleteCacheRecords`, `sendStateChange`, `sendPutThinkingSchedule`, `sendPutThinkingJobCreate`, `sendPutThinkingJobError`, and other send helpers).
- **Initial event types**:
  - **`Put Cache Record`**: Payload aligns with `putCacheRecord(componentId, record, existingDataCategory?)` in the render cache layer. Consumed by **`mtw.ephemera.renderCache`** (see below). Production paths that participate in this thread should use **`sendPutCacheRecord`** from [`lambda/ephemera/dataSource/apiEphemera.ts`](dataSource/apiEphemera.ts) so the write and outbound signals stay consistent.
  - **`Delete Cache Records`**: Payload is `{ componentId, dataCategories }`. Consumed by **`mtw.ephemera.renderCache`**. Production paths should use **`sendDeleteCacheRecords`** (same pattern as `Put Cache Record`). When the handler is already inside an active **`messageBus.flush()`** (e.g. DataSource `receiveEvents`), nested **`send()`** calls are processed by that flush's recursion; top-level code paths may still **`await messageBus.flush()`** so work finishes before returning.
  - **`State Change`**: Payload is `{ componentId, markState }` (see `StateChangeCommand` in `localApiEvents.ts`). Production paths should use **`sendStateChange`**.
  - **`Put Thinking Schedule`**: Payload is a **`ThinkingScheduleEvent`** (see `PutThinkingScheduleCommand` in `localApiEvents.ts`). Consumed by **`mtw.ephemera.thinking.scheduling`**. Production paths should use **`sendPutThinkingSchedule`** from [`lambda/ephemera/dataSource/apiEphemera.ts`](dataSource/apiEphemera.ts). **`THINKING_SCHEDULE_HEADER_TYPE`** (`Thinking Schedule`) on the shared contract is for **EventBridge / replay** when that slice ships, not this internal header string.
  - **`Put Thinking Job Create`**: Payload is a **`ThinkingJobCreateEvent`** (`PutThinkingJobCreateCommand` in `localApiEvents.ts`; types in **`@tonylb/mtw-interfaces`** `ts/eventBridge/ephemera/thinking`). Consumed by **`mtw.ephemera.thinking.scheduling`**. Production paths should use **`sendPutThinkingJobCreate`** (optional **`laneId`** for immediate nested **`flush(laneId)`**).
  - **`Put Thinking Job Error`**: Payload is a **`ThinkingJobErrorEvent`** (`PutThinkingJobErrorCommand` in `localApiEvents.ts`). Run-level failure on **`Meta::Job`**, distinct from per-step **`Meta::Result`**. Consumed by **`mtw.ephemera.thinking.scheduling`**. Use **`sendPutThinkingJobError`** (optional **`laneId`**).

#### **mtw.ephemera.renderCache (render cache write + outbound signals)**

- **Implementation**: [`lambda/ephemera/dataSource/renderCache/index.ts`](dataSource/renderCache/index.ts); payload types in [`lambda/ephemera/dataSource/renderCache/baseClasses.ts`](dataSource/renderCache/baseClasses.ts).
- **Inbound**: Subscribes to **`api.ephemera`** streaming envelopes whose header type is **`Put Cache Record`** or **`Delete Cache Records`** (same shapes as `sendPutCacheRecord` / `sendDeleteCacheRecords`).
- **Behavior**: Calls **`putCacheRecord`** or **`deleteCacheRecord`** in the render cache layer; on success updates **`internalCache.RenderCache`** via **`set`** or **`deleteCacheRecords`** (so memoized reads stay consistent in the same invocation), then publishes **`Cache Updated`** or **`Cache Deleted`** on the internal message bus; on validation or Dynamo failure publishes **`Cache Error`** (also logged with **`console.error`** for operations visibility).
- **Outbound payloads** (internal `getContent()` on the bus `StreamingEvent`):
  - **`Cache Updated`**: `componentId`, `dataCategory` (assigned key), `perspectiveId`.
  - **`Cache Deleted`**: `componentId`, `dataCategories`.
  - **`Cache Error`**: `componentId`, `errorCode` (`INVALID_PAYLOAD` | `PUT_FAILED` | `DELETE_FAILED`), `errorMessage`, optional `perspectiveId`.
- **Publishing**: **`publisherStrategy: 'busOnly'`**, **`replayable: false`** (no EventBridge, no replay rows for this source).

#### **mtw.ephemera.thinking.scheduling (thinking schedule writes)**

- **Implementation**: [`lambda/ephemera/dataSource/thinking/scheduling/index.ts`](dataSource/thinking/scheduling/index.ts); persistence in [`persistThinkingSchedule.ts`](dataSource/thinking/scheduling/persistThinkingSchedule.ts).
- **Inbound**: Subscribes to **`api.ephemera`** envelopes whose header type is **`Put Thinking Schedule`**, **`Put Thinking Job Create`**, or **`Put Thinking Job Error`** (same shapes as the **`sendPutThinking*`** helpers).
- **Behavior**: Writes **`JOB#`** adjacency + **`TASK#`/`Meta::Schedule`** (overwrite-safe **`putItem`** for schedule status transitions), then **`internalCache.ThinkingSchedules.invalidate(workItemId)`**.
- **Publishing**: **`publisherStrategy: 'busOnly'`**, **`replayable: false`** until the EventBridge schedule slice lands.

### **EventBridge Event Subscription**

The Ephemera Lambda subscribes to events from other system components:

#### **EventBridge Events from Multiple Sources**
- **Content Update**: Triggers asset re-caching when content changes (source varies - may include WML, direct editing, etc.)
- **Authorization Update**: Updates character access permissions
- **Example Lifecycle (mtw.assets.componentExamples → mtw.ephemera.examples)**: Mirrors authored Example renders into the Ephemera cache via the `mtw.ephemera.examples` data source. `ExampleUpdated` (and future `ExampleAdded`) enqueue **`Put Cache Record`** via **`sendPutCacheRecord`**; `ExampleRemoved` enqueues **`Delete Cache Records`** via **`sendDeleteCacheRecords`**. Those run while the bus is already flushing EventBridge-originated work, so **`mtw.ephemera.renderCache`** is reached via recursive **`flush()`** without an extra flush in the examples handler.
- **Character Presence (mtw.connections.characters → mtw.ephemera.positions)**: `Character Connected` and `Character Disconnected` envelopes are consumed by the `mtw.ephemera.positions` DataSource (see [`dataSource/positions/`](dataSource/positions/)). `Character Connected` queues a `CheckLocation` (forceMove) so the existing `moveCharacter` flow drives the `Meta::Room.activeCharacters` add + arrival `WorldMessage` + `CharacterInPlay` `EphemeraUpdate`. `Character Disconnected` runs a conditional `Meta::Room.activeCharacters` projection; when the projection actually changes (idempotency gate), the handler refreshes `RoomCharacterList`, invalidates `ComponentEphemeraMeta` and `ComponentStackMerge`, and publishes the departure `WorldMessage` + `RoomUpdate`. Producer-side delivery is at-least-once; consumer idempotency is the projection gate.

#### **Asset Events**
- **Asset Added/Removed**: Updates character access to new/removed content
- **Asset Canonized/Decanonized**: No current path. May be added when mtw.assets data sources are extended to expose canonize/decanonize; would adjust character content availability.

#### **Coordination Events** *(Legacy - Under Review)*
- **Calculate Cascade**: Triggers Variable dependency cascade calculations
- **Execute Action**: Executes Action code in response to external triggers
- **Disconnect Character**: Forward pointer -- character disconnection from external systems is now driven by the `mtw.connections.characters` -> `mtw.ephemera.positions` ingress described above; the legacy `Disconnect Character` direct event in [`app.ts`](app.ts) remains only for non-DataSource paths and should be removed when those paths are retired.

#### **Blueprint Reconciliation Events**
- **Asset Canonized/Decanonized**: No current path (reserved for when canonize/decanonize flows are extended). Would update character access to content and validate character states.
- **Content Update**: Incorporates WML blueprint changes into real-time state representation
- **Authorization Update**: Adjusts character permissions and validates character positions

## Character Presence Filtering

The lambda implements the core "perception-driven processing" philosophy through sophisticated presence detection:

### **Presence Detection Mechanism**
1. **Character Location Tracking**: Maintains real-time character room assignments
2. **Active Connection Monitoring**: Tracks which characters have connected players
3. **Perception Filtering**: Only processes events when characters are present to perceive results

### **Cost Optimization Through Filtering**
- **Room Updates**: Only calculated when characters are present in the room
- **Message Routing**: Only delivered when target characters have active connections
- **Cache Updates**: Only performed when characters would benefit from the cached data

### **Implementation Details**

The presence filtering is primarily implemented through:
- **`RoomCharacterList`** cache: Real-time tracking of character presence in rooms
- **Character Meta** information: Location and connection status for each character
- **Perception Message Processing**: Filtering logic in `perception/index.ts`

For detailed technical implementation, see [`perception/AGENT.md`](perception/AGENT.md).

## Blueprint Reconciliation Event Processing

A core responsibility of the Ephemera Lambda is reconciling real-time state with continuously changing world blueprints from collaborative authoring.

### **Blueprint Change Detection**

#### **Asset Blueprint Updates**
- **Trigger**: WML Content Update events from collaborative editing
- **Processing**: Validate current character states against updated asset definitions
- **Reconciliation**: Update character perceptions and handle room definition changes
- **Challenge**: Maintain character experience continuity during blueprint modifications

#### **Component-Level Changes**
- **Room Definition Updates**: Character locations may become invalid if rooms are redefined or removed
- **Feature Modifications**: Interactive elements characters are using may change behavior or availability
- **Connection Changes**: Exits and pathways between rooms may be added, removed, or modified
- **Permission Updates**: Character access to areas may change based on asset authorization modifications

### **State Reconciliation Patterns**

#### **Character Position Validation**
- **Event Trigger**: Asset update events affecting room definitions
- **Validation Process**: Check if characters are in rooms that still exist and are accessible
- **Reconciliation Actions**: 
  - Gracefully relocate characters if their current room is removed
  - Update room descriptions for characters when room blueprints change
  - Validate character permissions for their current location

#### **Perception Update Coordination**
- **Blueprint Change Impact**: Determine which characters need updated perceptions
- **Selective Updates**: Only update perceptions for characters present to perceive changes
- **Consistency Maintenance**: Ensure character experiences remain coherent across blueprint transitions
- **Real-Time Integration**: Incorporate blueprint changes without breaking ongoing character interactions

### **Current Blueprint Integration**

#### **Basic Content Update Handling** *(Legacy Pattern - Migration In Progress)*
- **EventBridge Integration**: Receives 'Content Update' events directly from WML Lambda and triggers asset re-caching
- **Character State Preservation**: Maintains character locations during content updates
- **Perception Updates**: Re-renders character perceptions after asset cache updates

**🔄 Migration Context**: This pattern represents a partially-completed migration from Ephemera-owned asset caching to Assets Lambda domain authority. The direct WML → Ephemera flow was left in place to support legacy Variable/Computed/Action systems that have complex dependencies on Ephemera's asset caching implementation.

#### **Planned Collaborative Authoring Features** *(Not Yet Implemented)*
- **Author Awareness**: Authors would receive feedback about characters present in areas they're modifying
- **Impact Assessment**: System would evaluate how blueprint changes affect current character experiences  
- **Advanced Conflict Resolution**: Sophisticated handling of conflicts between character actions and blueprint modifications
- **Selective Change Propagation**: Intelligent timing of when blueprint changes become visible to characters

### **Event Flow Examples**

#### **Content Update Flow** *(Current Implementation)*
1. **Content change occurs** → 'Content Update' EventBridge event
2. **Ephemera receives event** → Triggers asset re-caching (`cacheAsset` with `updateOnly: true`)
3. **Asset cache updated** → Updated component data available for future perception requests
4. **Next character interaction** → Characters receive updated perceptions based on new cached data

#### **Room Structure Change Flow** *(Planned - Not Fully Implemented)*
1. **Author removes or relocates room** → Asset update event
2. **Ephemera would validate character positions** → Identify characters in affected room
3. **Character relocation would be required** → Gracefully move characters to safe location
4. **Perception updates would follow** → Deliver new room descriptions to relocated characters
5. **Connection updates would propagate** → Update navigation options for characters in adjacent rooms

**Current State**: The basic blueprint reconciliation foundation exists through Content Update event handling and asset re-caching, but advanced features like automatic character relocation and sophisticated change propagation are planned for future development.

## Legacy System Transition

### **Variable/Computed/Action Event Patterns** *(Being Removed)*

**Historical Context**: The current system includes sophisticated event patterns originally designed for programming-language-based authoring. These patterns have complex dependencies on Ephemera's asset caching implementation, which is why the asset caching migration to Assets Lambda remains partially incomplete:

#### **Variable Dependency Cascades**
- **Event Trigger**: Variable value changes from Action execution or external updates
- **Graph Traversal**: Complex dependency graph navigation to find affected Computed values
- **Cascade Calculation**: Automatic recalculation of dependent values across asset boundaries
- **State Synchronization**: Updates to all assets that import affected variables

#### **Action Execution Events**
- **External Triggers**: EventBridge events triggering Action code execution
- **Code Sandbox**: JavaScript evaluation within serverless execution environment
- **State Mutation**: Variable updates resulting from Action code execution
- **Dependency Integration**: Triggering Variable cascades from Action results

#### **Technical Implementation**
- **`dependencyCascade.ts`**: Complex graph traversal for dependency updates
- **`executeAction/index.ts`**: Code execution and state mutation coordination
- **EventBridge Integration**: External event triggers for Variable/Action coordination

### **Why These Patterns Are Being Removed**

The Variable/Computed/Action event patterns were designed for **programming-language-based authoring**, but Make The World is transitioning to an **example-driven content model**:

- **Old Model**: Events trigger code execution that modifies programmatic variables
- **New Model**: Events trigger AI inference from content examples
- **Consequence**: Complex dependency cascades and code execution events are unnecessary overhead

### **Replacement Architecture** *(Needs Design)*

The new event architecture should focus on:
- **Example-Based State Changes**: Events modify example-driven content rather than programmatic variables
- **AI-Inferred Behavior**: Events trigger AI interpretation of content examples
- **Simplified State Management**: Streamlined event patterns without complex dependency graphs

## Performance and Scale Considerations

### **Real-Time Processing Optimization**

#### **Connection Management**
- **WebSocket Scaling**: Handles multiple concurrent character connections
- **Message Batching**: Optimizes delivery of bulk state updates
- **Connection Pooling**: Efficient management of session-to-connection mappings

#### **Cache Strategy**
- **Request-Scoped Caching**: Avoids duplicate database queries within request lifecycle
- **Character Presence Caching**: Real-time tracking minimizes lookup overhead
- **Selective Invalidation**: Targeted cache clearing based on character presence

#### **Event Processing Efficiency**
- **Perception Filtering**: Eliminates unnecessary computational work
- **Message Bus Decoupling**: Enables parallel processing of independent workflows
- **Optimistic Concurrency**: Efficient handling of concurrent character interactions

## Room Content Perception Update Flows

**Priority Focus Area**: Understanding how incoming events cause room content perception updates and delivery to clients.

### **Current Flow Pattern** *(Needs Detailed Documentation)*

The room content perception update process involves:

1. **Event Triggers**: What incoming events cause room content updates?
   - WML Content Update events from content changes
   - Asset caching completion events  
   - Character movement triggering room re-rendering
   - Environmental state changes affecting room descriptions

2. **Event Subscription**: How does Ephemera subscribe to relevant events?
   - EventBridge subscription patterns for content updates
   - Internal message bus coordination for character movement
   - Asset Lambda integration for component data changes

3. **Information Materialization**: How is updated information prepared for delivery?
   - Assets Lambda component data retrieval
   - Character presence filtering before processing
   - Room description rendering and caching
   - Message formatting for client delivery

4. **Filtering and Transformation**: How is content filtered for character perspectives?
   - Character viewpoint limitation logic
   - Permission-based content filtering
   - Perception-driven processing application
   - Message targeting based on character presence

5. **Client Delivery**: How are updates delivered to connected clients?
   - WebSocket message routing to character connections
   - Message batching and optimization
   - Real-time delivery coordination
   - Error handling and retry logic

### **Research Priorities for Room Content Flows**

1. **Map Event Triggers**: Document all events that can cause room content updates
2. **Trace Integration Points**: Follow data flow from external events to client delivery
3. **Document Filtering Logic**: Capture character presence and permission filtering
4. **Analyze Legacy Dependencies**: Identify Variable/Computed/Action patterns in room updates
5. **Design Replacement Patterns**: Plan example-driven room content update architecture

## Migration Documentation Priorities

### **Priority 1: Asset Caching Migration Completion**
Complete the partially-finished migration from Ephemera-owned to Assets-owned caching:
- **Legacy Dependency Mapping**: Document which Variable/Computed/Action patterns depend on Ephemera asset caching
- **Migration Blockers**: Identify specific code that prevents completing the Assets Lambda migration
- **Incremental Migration Strategy**: Plan phased approach to move remaining asset dependencies
- **Event Flow Redesign**: Design the proper WML → Assets → Ephemera event flow

### **Priority 2: Legacy System Documentation**
Before removal, document the current Variable/Computed/Action system patterns:
- **Dependency Cascade Patterns**: Document the graph traversal logic in `dependencyCascade.ts`
- **Asset Cache Dependencies**: Map how Variable/Computed/Action systems rely on Ephemera's asset caching
- **State Management Schemas**: Catalog current DynamoDB table structures and event triggers
- **Action Execution Workflows**: Document the code execution patterns in `executeAction/`

### **Priority 3: Perception System Clarification**
The perception system is core to the new architecture and needs comprehensive documentation:
- **Character Presence Detection**: Detail how `RoomCharacterList` cache enables filtering
- **Message Routing Patterns**: Document how perception events become WebSocket messages
- **Integration with Assets**: Trace how component data flows into character perceptions (both current and post-migration)
- **Real-Time Optimization**: Document caching and performance patterns

### **Priority 4: Migration Path Planning**
Establish framework for completing both the asset migration and Variable/Computed/Action removal:
- **Dual Migration Strategy**: Coordinate asset caching migration with Variable/Computed/Action removal
- **Replacement Architecture**: Design example-driven state management patterns that work with Assets Lambda
- **Testing Framework**: Ensure migration preserves functional behavior across both changes
- **Event Pattern Simplification**: Design streamlined event flows for example-driven content consuming from Assets

## Related Event Documentation

This document is part of a coordinated event flow documentation effort across the core Make The World lambda systems:

- **[Assets Event Flows](../assets/AGENT.event.md)**: Asset caching, component management, and file coordination events
- **[WML Event Flows](../wml/AGENT.event.md)**: Content parsing, validation, and WML schema event handling

## Navigation Notes

- **Main Lambda Documentation**: See [`AGENT.md`](AGENT.md) for complete Ephemera Lambda overview and architecture
- **Perception System**: See [`perception/AGENT.md`](perception/AGENT.md) for detailed perception processing documentation
- **Internal Cache System**: See [`internalCache/AGENT.md`](internalCache/AGENT.md) for caching architecture
- **Legacy System Details**: See `cacheAsset/README.state.md` for Variable/Computed/Action technical details
- **Related Architecture**: See [`../../AGENT.architecture.events.md`](../../AGENT.architecture.events.md) for system-wide event architecture principles
- **Related Philosophy**: See [`../../AGENT.architecture.philosophy.md`](../../AGENT.architecture.philosophy.md) for underlying architectural philosophy including perception-driven processing

---

*This document provides a foundation for understanding key event flows needed for planning the room content perception update improvements and the Variable/Computed/Action system migration. The analysis of documented patterns enables systematic replacement design while preserving the core perception-driven processing architecture. Additional event flow documentation will be added as investigation continues.*
