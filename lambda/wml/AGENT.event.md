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
- Authorization Update events for permission changes
- Merge Conflict events for failed edit applications
- Parsed content delivery to Assets Lambda for caching
- Validation results and error notifications
- Content state synchronization events

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
- **Authorization Update Events**: Permission change propagation patterns
- **Merge Conflict Events**: Failed edit coordination and resolution workflows
- **Event Schema Documentation**: Standardize event contracts for downstream consumers

### **Priority 3: Assets Lambda Coordination**
**Focus**: Document the specific coordination patterns with Assets Lambda materialized views
- **Cache Update Triggers**: When and how WML changes trigger Assets cache updates
- **Dependency Tracking**: How WML changes propagate through component relationships
- **Consistency Guarantees**: What consistency promises are made to downstream consumers
- **Performance Coordination**: Batching, throttling, and optimization patterns

## Future Work Requirements

### **Research Phase**
1. **Content Processing Flow Analysis**: Map current WML parsing, validation, and transformation workflows **(supports Priority 1)**
2. **Event Generation Documentation**: Document EventBridge event creation patterns and triggers **(supports Priority 2)**
3. **Integration Flow Mapping**: Analyze coordination with Assets Lambda and client systems **(supports Priority 3)**
4. **Concurrency Analysis**: Review atomic locking and concurrent access patterns **(supports Priority 1)**

### **Design Phase**
1. **Content Event Standardization**: Establish consistent WML processing event patterns **(supports Priority 2)**
2. **Integration Strategy**: Design improved coordination with Assets and Ephemera systems **(supports Priority 3)**
3. **Error Handling Framework**: Plan comprehensive content error and recovery event handling **(supports Priority 1)**
4. **Performance Optimization**: Design event processing performance improvements **(supports Priority 3)**

### **Implementation Tracking**
Future updates to this document should track:
- WML processing performance improvements and optimizations
- New content validation and transformation patterns
- Enhanced integration with real-time authoring collaboration
- Improved conflict resolution and concurrent editing support
- Event processing monitoring and diagnostic capabilities

## Navigation Notes

- **Current WML Documentation**: See [`README.md`](README.md) for current functional documentation and EventBridge events
- **WML Language System**: See [`../../packages/mtw-wml/ts/AGENT.md`](../../packages/mtw-wml/ts/AGENT.md) for core WML language documentation
- **Related Architecture**: See [`../../AGENT.architecture.events.md`](../../AGENT.architecture.events.md) for system-wide event architecture principles
- **Related Philosophy**: See [`../../AGENT.architecture.philosophy.md`](../../AGENT.architecture.philosophy.md) for underlying architectural philosophy

---

*This stub document will be expanded as research and design work progresses. The goal is to transform the current ad-hoc WML processing into a well-documented, systematic approach that fully supports the content creation and collaboration workflows while integrating seamlessly with the broader Make The World event architecture.*
