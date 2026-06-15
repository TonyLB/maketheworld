# Ephemera Lambda - Agent Navigation Guide

**Status: ACTIVE SYSTEM UNDERGOING MAJOR ARCHITECTURAL TRANSITION**

## Overview

The Ephemera Lambda serves as the **real-time game state authority** within Make The World's Domain-Authoritative Event Mesh architecture. It implements the core "perception-driven processing" philosophy by managing character presence, real-time interactions, and WebSocket communication while ensuring computational work only occurs when characters are present to perceive the results.

## Core Purpose

The Ephemera Lambda is responsible for:

- **Real-Time Character State**: Managing character location, connection status, and active presence
- **Perception-Driven Processing**: Implementing the "tree falls in forest" principle for computational efficiency
- **WebSocket Communication**: Handling all client-server real-time communication
- **Room State Management**: Coordinating character presence and room-based interactions
- **Message Routing**: Delivering character-targeted messages through WebSocket connections
- **Blueprint Reconciliation**: Maintaining consistent real-time state while world blueprints are actively revised

## Architectural Context

### **Domain Authority**

Within the **Domain-Authoritative Event Mesh** pattern, Ephemera Lambda has sole authority over:
- Real-time character state and location tracking
- Room presence and character interaction coordination  
- Perception event filtering and delivery
- WebSocket connection management and message routing

### **Integration Points**

#### **Message Persistence System**

Ephemera Lambda manages a **dual-layer message persistence architecture**:

**DynamoDB Storage** (`publishMessage`)
- **Table**: `message_delta` (via `messageDeltaDB`)
- **Purpose**: Authoritative server-side message history for cross-client synchronization
- **Structure**: Messages stored with `Target`, `DeltaId` (`CreatedTime::MessageId`), and full content
- **Scope**: Global message history accessible across all client sessions and devices

**Real-Time Distribution** 
- **WebSocket Delivery**: Live messages pushed to connected clients via WebSocket connections
- **Target Mapping**: `PublishMessageTargetMapper` routes messages to appropriate character connections
- **Connection Management**: Tracks active sessions and character subscriptions for message delivery

**Message Publishing Pipeline**
1. **Message Generation**: Perception system creates messages (PerceptionMessage with various metadata types)
2. **Target Resolution**: Mapper identifies target characters and their active connections
3. **Dual Persistence**: 
   - Store in DynamoDB `message_delta` for historical access
   - Queue for WebSocket delivery to live clients
4. **Live Delivery**: Push messages to connected clients via WebSocket
5. **Sync Support**: Enable historical message requests using `LastSync` timestamps

#### **External System Integration**

The Ephemera Lambda integrates with other system components through:
- **Assets Lambda**: Consumes component-level materialized views for rendering while reconciling blueprint changes
- **EventBridge Events**: Receives assets update events for blueprint reconciliation and diagnostics findings for self-healing intake
- **Client Applications**: Maintains persistent WebSocket connections for real-time interaction

#### **Diagnostics occupancy drift (S2-6-DR)**

Diagnostics emits **`Room Occupancy Drift Finding`** on `mtw.diagnostics` (read-only sweep: [`lambda/diagnostics/roomOccupancyDriftSweep/`](../../diagnostics/roomOccupancyDriftSweep/)). Downstream repair is owned by **`mtw.ephemera.positions`** via [`repairRoomOccupancyDrift`](dataSource/positions/membership/repairRoomOccupancyDrift.ts) (graph-forward scan, sessions gate, adjacency sync). Parent **`mtw.ephemera`** no longer subscribes to this finding type.

#### **`mtw.ephemera.positions` (positions in play)**

Ephemera lane for **positions in play** --- runtime where entities are and how they relate (`dataSourceKey: 'mtw.ephemera.positions'`). Package docs: [`dataSource/positions/AGENT.md`](dataSource/positions/AGENT.md) (entry), [`AGENT.concepts.md`](dataSource/positions/AGENT.concepts.md) (mental models), [`AGENT.contract.md`](dataSource/positions/AGENT.contract.md) (normative rules), [`AGENT.implementation.md`](dataSource/positions/AGENT.implementation.md) (code map).

Slice 0: `mtw.connections.characters` presence ingress (`Character Connected` / `Character Disconnected` owned in positions). Session RoomHeader bootstrap remains **`Character Registered`** (below), not positions.

#### **Session orientation (`Character Registered`)**

Every successful `registercharacter` emits **`Character Registered`** on `mtw.connections`. Ephemera consumes it for **session-scoped RoomHeader delivery** to the logging-in character (`CHARACTER#` targets; `sessionId` on the event is correlation only), distinct from the world/presence path above.

Ingress: `mtw.connections` / `Character Registered` via `ConnectionsEventSerializer` in [`app.ts`](app.ts) and CloudWatch rule `ConnectionsCharacterRegistered` in [`template.yaml`](../../template.yaml). Subscribed by **`mtw.ephemera.renderOrchestration`** and **`mtw.ephemera.affordanceOrchestration`** (shared guards in [`dataSource/connectionsCharacterRegistered/subscribedEvents.ts`](dataSource/connectionsCharacterRegistered/subscribedEvents.ts)).

Handlers: [`handleCharacterRegisteredOrientation`](dataSource/connectionsCharacterRegistered/handleCharacterRegisteredOrientation.ts) resolves the character's current room from `Meta::Character`, registers two perception threads (`sessionOrientationRender` + `sessionOrientationAffordances`) with `targets: [characterId]`, and kicks render + affordance orchestration with room + perspective only. Terminal **`PublishMessage`** rows are emitted by **`mtw.ephemera.perception`** on **`Render Pertains`** / **`Affordances Pertain`** fan-in (see [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md)).

**Perception thread principle:** delivery intent is captured once at thread registration; orchestration and cache streams carry routing identity only (`roomId` / `componentId` + `perspectiveKey`). Do **not** plumb `targets` or `sessionId` through orchestration ingress or cache outbounds.

**Non-goals for this path:** does not update `Meta::Room.activeCharacters`, does not send room arrival `WorldMessage` to other occupants. Those remain the **`Character Connected`** / `mtw.ephemera.positions` responsibility.

**Known follow-ons (non-blocking):** trim duplicate affordance from **`Character Connected`** / **`RoomUpdate`** on first connect; optional client transcript / virtual-merge refactoring; bare-session **`Target`** stamping for true session-only deliveries (e.g. knowledge **`directResponse`**).

Ephemera no longer holds session adjacency authority: writes to `connections`-table session/character adjacency live in `lambda/connections` (see [`lambda/connections/AGENT.md`](../connections/AGENT.md)). Registration ingress authority is fully connections-owned (`service: connections`), and ephemera does not process `registercharacter` WebSocket ingress.

Operational guardrails:

- Infrastructure subscriptions for both `mtw.connections` / `Character Registered` and `mtw.connections.characters` must remain deployed.
- Avoid dual-ingress and dual-consume paths: registration traffic should target only `service: connections`.
- Verification query in ephemera logs: search for registration message payload markers (`message\":\"registercharacter\"`) and expect zero results over a representative window.

Integration proof: [`dataSource/characterRegisteredOrientation.integration.test.ts`](dataSource/characterRegisteredOrientation.integration.test.ts).

## Current System Architecture

### **Real-Time Communication Interface**

The Ephemera Lambda serves as the primary WebSocket handler for all real-time client communication, providing endpoints for connection management, character interaction, and state synchronization.

For complete details on WebSocket endpoints, internal message bus architecture, and event cascade patterns, see **[Event Flow Documentation](AGENT.event.md)**.

### **Perception-Driven Processing Core**

The lambda implements the system's core architectural philosophy: computational work only occurs when characters are present to perceive the results. This is achieved through:

- **Character Presence Tracking**: Real-time monitoring of character locations and connection status
- **Event Filtering**: Processing events only when characters can perceive the results
- **Resource Conservation**: Eliminating unnecessary computational work when no characters are present

For detailed technical implementation of perception filtering, see [`perception/AGENT.md`](perception/AGENT.md).

### **Blueprint Reconciliation System**

A fundamental responsibility of the Ephemera Lambda is maintaining consistent real-time state while the underlying world blueprints are continuously revised through collaborative authoring.

#### **The Reconciliation Challenge**
- **Living Blueprints**: Asset definitions are actively modified by collaborative authors
- **Active State**: Characters are currently present and interacting within the real-time representation
- **Consistency Requirement**: Real-time experience must remain coherent despite blueprint changes
- **Seamless Integration**: Blueprint updates must be incorporated without disrupting ongoing character interactions

#### **Reconciliation Strategies**
- **Event-Driven Updates**: Subscribes to Asset and WML update events to detect blueprint changes
- **State Validation**: Verifies current character positions and states remain valid after blueprint updates
- **Graceful Transitions**: Manages character relocations when room definitions change or are removed
- **Perception Coherence**: Ensures character perceptions remain consistent during blueprint transitions

#### **Integration with Collaborative Authoring**
- **Real-Time Authoring**: Basic support for content updates while characters are present (via 'Content Update' EventBridge events)
- **Change Integration**: Triggers asset re-caching when blueprint changes occur
- **State Preservation**: Maintains character locations and interactions across basic blueprint revisions

**Note**: Advanced collaborative authoring features (author awareness of character presence, sophisticated conflict resolution) are planned but not yet fully implemented.

This reconciliation system enables Make The World's core vision of collaborative world-building without disrupting active gameplay experiences.

### **Internal Cache System**

The lambda maintains sophisticated caching for performance optimization:

#### **Character and Player Context**
- **`CharacterMeta`**: Character information including location, appearance, and home room
- **`CurrentPlayerMeta`**: Player account information for authenticated connections
- **`RoomCharacterList`**: Real-time tracking of character presence in rooms

#### **Connection Management**
- **`Global`**: Request-scoped values including connection ID and request ID
- **`SessionConnections`**: Mapping between character sessions and WebSocket connections
- **Map stub window**: map subscription aggregate-row state (`Map / Subscriptions`) is removed. `subscribeToMaps` / `unsubscribeFromMaps` retain request/ack correlation and return empty map snapshots while map update fanout is intentionally disabled pending deferred redesign.

For complete cache system documentation, see [`internalCache/AGENT.md`](internalCache/AGENT.md).

## CRITICAL: System in Transition

### **Legacy Variable/Computed/Action System**

**Historical Context**: The current system includes a sophisticated Variable/Computed/Action framework originally designed for programming-language-based authoring tools:

#### **Variable System** *(Legacy - Being Removed)*
- **Purpose**: Stored game state as named variables with cross-asset import capabilities
- **Computed Values**: Derived values automatically recalculated when dependencies change
- **Dependency Tracking**: Complex graph system for cascading updates across asset imports
- **State Storage**: Maintained in both per-asset and Meta-level DynamoDB records

#### **Action System** *(Legacy - Being Removed)*
- **Purpose**: Executable code snippets that could modify variable states
- **Code Execution**: JavaScript code evaluation within serverless sandbox environment
- **Integration**: Deep integration with variable dependency cascades for state updates

#### **Why This System No Longer Fits**

The Variable/Computed/Action system was designed for **programming-language-based authoring**, but Make The World is transitioning to an **example-driven content model**:

- **Old Model**: Authors write code to define world behavior
- **New Model**: Authors provide examples, AI infers behavior patterns
- **Consequence**: Coded variables and programmatic actions are the wrong abstraction level

### **Current Transition State**

⚠️ **IMPORTANT**: The system is currently **partway through removing** the Variable/Computed/Action framework:

#### **What Remains** *(Needs Documentation and Migration)*
- **Dependency Cascade Logic**: Complex graph traversal for state updates (see `dependentMessages/dependencyCascade.ts`)
- **State Management**: DynamoDB schemas still include Variable/Computed/Action records
- **Event Processing**: EventBridge events still trigger Variable cascade calculations
- **Code Execution**: Action execution logic still present in `executeAction/` module

#### **What's Being Removed**
- **Programmatic Content Creation**: No longer using coded Variables for content definition
- **Action-Based Interactions**: Moving away from executable code snippets for character actions
- **Complex Dependency Graphs**: Simplifying state management for example-driven workflows

#### **What Needs To Be Designed** 
- **Example-Driven State Representation**: How to represent world state through examples rather than variables
- **AI-Inferred Behavior**: How AI interprets examples to generate character interactions
- **Simplified State Management**: Streamlined approach to game state without complex dependency graphs

## Immediate Documentation Priorities

### **Priority 1: Legacy System Documentation**
Before removal, document the current Variable/Computed/Action system to ensure no valuable patterns are lost:
- **Dependency Cascade Patterns**: Document the graph traversal logic for potential reuse
- **State Management Schemas**: Catalog current DynamoDB table structures
- **Event Integration Points**: Map how EventBridge events currently trigger cascades

### **Priority 2: Perception System Clarification**
The perception system is core to the new architecture and needs comprehensive documentation:
- **Character Presence Detection**: How room character lists enable perception filtering
- **Message Routing Patterns**: How perception events become WebSocket messages
- **Integration with Assets**: How component data flows into character perceptions

### **Priority 3: Migration Path Planning**
Establish framework for the Variable/Computed/Action removal:
- **Replacement Architecture**: Design example-driven state management
- **Transition Strategy**: Plan gradual migration without breaking existing content
- **Testing Framework**: Ensure migration preserves functional behavior

## Event Processing Architecture

The Ephemera Lambda processes events from multiple sources including WebSocket connections, EventBridge events from other lambdas, and internal message cascades. The system implements sophisticated character presence filtering to ensure computational work only occurs when characters can perceive the results.

**Key Processing Patterns:**
- **WebSocket Event Handling**: Real-time client communication and character interaction
- **EventBridge Integration**: Subscription to content updates and system coordination events  
- **Character Presence Filtering**: Implementation of perception-driven processing philosophy
- **Internal Message Coordination**: Complex event cascades managed through internal message bus

For comprehensive documentation of all event types, processing patterns, and integration points, see **[Event Flow Documentation](AGENT.event.md)**.

## Performance and Scale Considerations

The Ephemera Lambda is optimized for real-time performance through character presence caching, selective event processing, and efficient WebSocket connection management. The perception-driven processing philosophy eliminates unnecessary computational work while maintaining responsive character interactions.

For detailed performance optimization patterns, cache strategies, and scale considerations, see **[Event Flow Documentation](AGENT.event.md)**.

## Development Notes

### **Current Strengths**
- **Perception Filtering**: Successfully implements cost-effective character presence detection
- **WebSocket Management**: Robust real-time communication with clients
- **Message Bus Architecture**: Clean separation of concerns for complex event workflows
- **Testing Patterns**: Well-established dependency injection patterns for unit testing

### **Known Technical Debt**
- **Legacy System Integration**: Variable/Computed/Action code needs removal
- **Event Processing Complexity**: Some EventBridge patterns may be obsolete
- **Code Organization**: Some functions may belong in other lambdas (noted in README)

### **Testing Framework**

The lambda implements sophisticated testing patterns for real-time event processing and cache dependency management. The primary pattern is dependency injection for `internalCache` testing, enabling comprehensive mocking of cache behavior while maintaining clean production code.

For complete testing pattern documentation including dependency injection, real-time system testing, and migration testing strategy, see **[Testing Patterns](AGENT.testing.md)**.

## Navigation Tips

### **Understanding Current System**
1. **Start with WebSocket Endpoints**: Review the API endpoints for client interaction patterns
2. **Examine Message Bus**: Understand how internal events coordinate complex workflows  
3. **DataSource packages**: See [`dataSource/AGENT.md`](dataSource/AGENT.md) for `EphemeraDataSource` instances (`mtw.ephemera`, render cache, orchestration, perception, state) and internal `api.ephemera` ingress
4. **Study Perception System**: See [`perception/AGENT.md`](perception/AGENT.md) for character presence filtering
5. **Review Internal Cache**: See [`internalCache/AGENT.md`](internalCache/AGENT.md) for performance optimization

### **Understanding Transition Context**
1. **Legacy System**: Read `cacheAsset/README.state.md` for Variable/Computed/Action details
2. **Dependency Cascades**: Examine `dependentMessages/dependencyCascade.ts` for graph traversal logic
3. **Event Processing**: Review `app.ts` for EventBridge event handling patterns
4. **Migration Planning**: See [`AGENT.event.md`](AGENT.event.md) for transition documentation plans

### **Key Files for System Understanding**
- **`app.ts`**: Main lambda handler with WebSocket routing and EventBridge processing
- **`perception/index.ts`**: Core perception filtering and character presence detection
- **`ephemeraUpdate/index.ts`**: Real-time state broadcasting to connected clients
- **`dataSource/positions/navigate/`**: Character navigate/home execution and post-persist presentation (`executeCharacterNavigate`, `orchestrateCharacterNavigate`); membership fan-in owns leave/arrive world copy
- **`executeAction/index.ts`**: Legacy action execution system (under review for removal)

## Related Documentation

- **[Cross-cutting concepts](AGENT.concepts.md)**: Narrative transcript, multi-channel room UI (concepts + contracts at ephemera root)
- **[Event Flow Documentation](AGENT.event.md)**: Comprehensive event processing patterns, WebSocket handling, and migration planning
- **[Testing Patterns](AGENT.testing.md)**: Dependency injection patterns, real-time system testing, and migration testing strategy
- **[DataSource layer](dataSource/AGENT.md)**: `EphemeraDataSource` packages, internal bus keys, cross-cutting contracts (multi-channel, narrative transcript; see [`AGENT.concepts.md`](AGENT.concepts.md))
- **[Perception System](perception/AGENT.md)**: Detailed perception processing and filtering documentation
- **[Internal Cache System](internalCache/AGENT.md)**: Caching architecture supporting real-time performance
- **[Assets System](../assets/)**: Component data source for perception rendering
- **[WML System](../wml/)**: Content source for real-time authoring collaboration
- **[System Architecture](../../AGENT.architecture.events.md)**: Overall event architecture and Domain-Authoritative Event Mesh
- **[Architectural Philosophy](../../AGENT.architecture.philosophy.md)**: Perception-driven processing philosophy and cost optimization

## Future Development Framework

The Ephemera Lambda is positioned to be the foundation for Make The World's transition to example-driven content creation. The current documentation and migration planning work will establish the framework for:

1. **Legacy System Removal**: Systematic elimination of Variable/Computed/Action patterns
2. **Example-Driven Architecture**: Design and implementation of AI-supported content inference
3. **Simplified State Management**: Streamlined game state without complex dependency graphs
4. **Enhanced Perception System**: Improved character presence filtering and real-time interaction

This documentation serves as the foundation for both understanding the current system and planning its evolution toward the example-driven future architecture.
