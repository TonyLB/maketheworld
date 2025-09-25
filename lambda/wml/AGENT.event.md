# WML Lambda - Event Flow Documentation

**Status: STUB DOCUMENT - PLANNING PHASE**

This is a placeholder document for future research and design work on event flows within the WML Lambda system.

## Purpose

This document will eventually contain comprehensive documentation of:

- **Event Input Processing**: How the WML Lambda receives and processes content update, validation, and parsing events
- **Internal Event Orchestration**: How WML parsing, schema validation, and content transformation events coordinate
- **Event Output Generation**: How the lambda generates content update events, validation results, and parsed WML events
- **Event Flow Patterns**: Content processing patterns and their integration with the broader system architecture

## Current State

The event flow documentation work **has not yet been done**. The WML Lambda currently handles events in an ad-hoc manner that grew organically as WML processing functionality was developed. While the system successfully processes WML content, schema validation, and file coordination, this approach lacks systematic documentation and design principles.

## Planned Documentation Scope

### **Event Categories to Document**

#### **Incoming Events**
- WML content update requests from authoring tools
- Schema validation requests from content editors
- Asset parsing and transformation requests
- WML file coordination events from S3 operations
- Content merge and conflict resolution events
- Authorization layer update events

#### **Internal Event Orchestration**
- WML parsing and StandardForm transformation workflows
- Schema validation and error reporting cascades
- Atomic locking and concurrent edit coordination
- Content backup and versioning event handling
- Dependency analysis and import resolution processing
- Image formatting and asset coordination events

#### **Outgoing Events**
- Content Update events via EventBridge (mtw.wml source)
- **Content Removed events via EventBridge (mtw.wml source)** - *TODO: Implement*
- Authorization Update events for permission changes
- Merge Conflict events for failed edit applications
- Parsed content delivery to Assets Lambda for caching
- Validation results and error notifications
- Content state synchronization events
- **Asset Zone Transition events via EventBridge (mtw.wml source)** - *Future: Zone management authority migration*

### **Event Flow Analysis**

#### **Content Processing Patterns**
- WML parsing and transformation event sequences
- Schema validation and error handling workflows
- Atomic edit application and rollback mechanisms
- Concurrent access coordination and locking patterns
- Content versioning and backup event coordination

#### **Integration Patterns**
- EventBridge content update broadcasting
- S3 file operation coordination and consistency
- Assets Lambda integration for content caching
- Client-side real-time content collaboration support
- Cross-system content dependency management
- **Zone transition coordination with Assets Lambda** - *Future: WML-driven zone management*

#### **Consistency and Reliability**
- Atomic edit application and transaction coordination
- Conflict detection and resolution event handling
- Error recovery and content restoration workflows
- Content integrity validation and verification
- Backup and disaster recovery event patterns

## Related Event Documentation

This document is part of a coordinated event flow documentation effort across the core Make The World lambda systems:

- **[Assets Event Flows](../assets/AGENT.event.md)**: Asset caching, component management, and file coordination events
- **[Ephemera Event Flows](../ephemera/AGENT.event.md)**: Real-time game state and character event processing

## Existing Event Infrastructure

The WML Lambda already implements some EventBridge event generation as documented in [`README.md`](README.md):

### **Current EventBridge Events**
- **Content Update**: Applied edits to asset content  
- **Authorization Update**: Applied edits to asset authorization layer
- **Merge Conflict**: Failed edit application due to conflicts

### **Missing EventBridge Events**
- **Content Removed**: Asset deletion/archival events - *TODO: Implement for Assets Lambda integration*

These existing events provide a foundation for understanding current event patterns, but require systematic documentation of their processing flows and integration patterns.

## Near-Term Documentation Priorities

Based on the **Domain-Authoritative Event Mesh** pattern identified in [`../../AGENT.architecture.events.md`](../../AGENT.architecture.events.md), the WML Lambda's role as **Source of Truth** in the **Data Transformation Pipeline** requires specific documentation focus:

### **Priority 1: Source Content Authority Patterns**
**Focus**: Document how WML Lambda establishes and maintains authority over S3 source files
- **Content Lifecycle Events**: Create, update, delete operations on WML source files
- **Schema Validation Workflows**: How validation failures are handled and reported
- **Atomic Operations**: File locking, transaction coordination, and conflict resolution
- **Version Control Integration**: Backup creation and content history management

### **Priority 2: Event Publishing Patterns**
**Focus**: Document the EventBridge event generation that coordinates the transformation pipeline
- **Content Update Events**: What triggers them, what data they contain, who subscribes
- **Content Removed Events**: Asset deletion/archival event generation - *TODO: Implement*
- **Authorization Update Events**: Permission change propagation patterns
- **Merge Conflict Events**: Failed edit coordination and resolution workflows
- **Event Schema Documentation**: Standardize event contracts for downstream consumers
- **Asset Zone Transition Events**: Zone change event generation and streaming patterns - *Future: Zone management migration*

### **Priority 3: Assets Lambda Coordination**
**Focus**: Document the specific coordination patterns with Assets Lambda materialized views
- **Cache Update Triggers**: When and how WML changes trigger Assets cache updates
- **Dependency Tracking**: How WML changes propagate through component relationships
- **Consistency Guarantees**: What consistency promises are made to downstream consumers
- **Performance Coordination**: Batching, throttling, and optimization patterns
- **Zone Transition Coordination**: How zone changes trigger Assets cache invalidation and updates - *Future: WML-driven zone management*

## Future Development: Zone Management Migration

### **Zone Authority Migration to WML Lambda**

As documented in [`AGENT.s3Storage.md`](AGENT.s3Storage.md), the WML Lambda is planned to take ownership of zone management operations, moving `moveAsset` functionality from the Assets Lambda to maintain clean domain boundaries. This migration will significantly impact event streaming patterns.

### **Current Zone Management (Assets Lambda)**
- **Zone Transitions**: Assets Lambda handles `moveAsset` operations
- **Shared Authority**: Both WML and Assets lambdas write to `Meta::Asset` records
- **Event Coordination**: Assets Lambda manages zone-related cache updates and notifications

### **Future Zone Management (WML Lambda)**
- **Zone Authority**: WML Lambda becomes sole authority for zone information and transitions
- **S3 Metadata**: Zone information stored as S3 object metadata rather than folder structure
- **Event-Driven Coordination**: Assets Lambda responds to WML zone transition events

### **Event Streaming Implications**

#### **New Event Types**
- **Asset Zone Transition Events**: WML Lambda publishes zone change events via EventBridge
- **Zone Metadata Update Events**: S3 metadata changes trigger downstream cache updates
- **Zone Access Control Events**: Zone changes affect Assets Lambda access control logic

#### **Event Flow Changes**
```
Current: Client → Assets Lambda → WML Lambda (zone transition)
Future:  Client → WML Lambda → EventBridge → Assets Lambda (zone transition response)
```

#### **Streaming Integration Points**
- **Assets Lambda**: Subscribes to zone transition events for cache invalidation
- **Ephemera Lambda**: Receives zone changes affecting character access patterns
- **Client Systems**: Real-time updates for zone-based content visibility
- **Audit Systems**: Zone transition history for compliance and monitoring

#### **Event Schema Considerations**
- **Zone Transition Events**: Must include source/destination zones, asset metadata, and transition context
- **Backward Compatibility**: Existing event consumers must handle new zone event types
- **Performance Optimization**: Batch zone transitions to minimize event volume
- **Error Handling**: Zone transition failures must trigger appropriate rollback events

### **Migration Event Coordination**

#### **Phase 1: Event Infrastructure**
- ✅ Implement zone transition event publishing in WML Lambda
- ✅ Update Assets Lambda to subscribe to zone transition events
- Maintain dual zone management during transition period

#### **Phase 2: Authority Transfer**
- Move zone transition logic from Assets to WML Lambda
- Update event schemas to reflect new zone authority
- Ensure event-driven coordination works correctly

#### **Phase 3: Cleanup and Optimization**
- Remove duplicate zone management code from Assets Lambda
- Optimize event streaming patterns for zone transitions
- Update monitoring and diagnostic systems

## Future Work Requirements

### **Research Phase**
1. **Content Processing Flow Analysis**: Map current WML parsing, validation, and transformation workflows **(supports Priority 1)**
2. **Event Generation Documentation**: Document EventBridge event creation patterns and triggers **(supports Priority 2)**
3. **Content Removed Event Implementation**: Implement and document Content Removed event publishing for asset deletion/archival - *TODO: High Priority*
4. **Integration Flow Mapping**: Analyze coordination with Assets Lambda and client systems **(supports Priority 3)**
5. **Concurrency Analysis**: Review atomic locking and concurrent access patterns **(supports Priority 1)**
6. **Zone Management Migration Planning**: Design WML-driven zone transition event patterns and Assets coordination - *Future: Zone authority migration*

### **Design Phase**
1. **Content Event Standardization**: Establish consistent WML processing event patterns **(supports Priority 2)**
2. **Integration Strategy**: Design improved coordination with Assets and Ephemera systems **(supports Priority 3)**
3. **Error Handling Framework**: Plan comprehensive content error and recovery event handling **(supports Priority 1)**
4. **Performance Optimization**: Design event processing performance improvements **(supports Priority 3)**
5. **Zone Transition Event Architecture**: Design event-driven zone management with Assets Lambda coordination - *Future: Zone authority migration*

### **Implementation Tracking**
Future updates to this document should track:
- WML processing performance improvements and optimizations
- New content validation and transformation patterns
- Enhanced integration with real-time authoring collaboration
- Improved conflict resolution and concurrent editing support
- Event processing monitoring and diagnostic capabilities
- **Zone management migration progress**: Implementation of WML-driven zone transitions and Assets Lambda coordination

## Navigation Notes

- **Current WML Documentation**: See [`README.md`](README.md) for current functional documentation and EventBridge events
- **WML Language System**: See [`../../packages/mtw-wml/ts/AGENT.md`](../../packages/mtw-wml/ts/AGENT.md) for core WML language documentation
- **Related Architecture**: See [`../../AGENT.architecture.events.md`](../../AGENT.architecture.events.md) for system-wide event architecture principles
- **Related Philosophy**: See [`../../AGENT.architecture.philosophy.md`](../../AGENT.architecture.philosophy.md) for underlying architectural philosophy

---

*This stub document will be expanded as research and design work progresses. The goal is to transform the current ad-hoc WML processing into a well-documented, systematic approach that fully supports the content creation and collaboration workflows while integrating seamlessly with the broader Make The World event architecture.*
