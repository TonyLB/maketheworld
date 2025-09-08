# DataSource Pattern - Agent Navigation Guide

## Overview

The `DataSource` pattern provides a standardized foundation for implementing data sources in Make The World's Domain-Authoritative Event Mesh architecture. This pattern enables each lambda to serve as a domain-authoritative data source with consistent capabilities for state management, event streaming, and subscriber replay support.

## Core Purpose

The DataSource pattern addresses three critical needs for data source implementation:

- **Snapshot Generation**: Create materialized state snapshots for data categories
- **Event Streaming**: Stream filtered change events to subscribers
- **Replay Support**: Store and fetch snapshots and recent events for new subscriber onboarding

## Technical Details

### Core Functionality

#### **1. Snapshot Generation**
Access the underlying durable storage to generate a snapshot of the current materialized view. Both send and store upon creation.

**Purpose**: Provide complete current state for data categories, enabling new subscribers to understand the full context before receiving incremental updates.

#### **2. Event Streaming**
Provide the tools to distribute incremental changes, *both* to outgoing EventBridge *and* to the replay storage.

**Purpose**: Broadcast incremental changes to subscribers who are already synchronized with the current state.

#### **3. Replay Serialization**
Deserialize data from the replay store and deliver it to the user in response to an `Initialize Subscription` message.

**Purpose**: Enable new subscribers to catch up by receiving a snapshot plus all events since that snapshot, ensuring they have complete context when new events start arriving
from their subscription.

### Data Storage Strategy

#### **Local DynamoDB Table**
Each data source maintains a local DynamoDB table for replay data. This means that the Primary Key will be variable (`AssetId`, `EphemeraId`, and so on), but the general pattern
will be that all stream records have a PK of `STREAM#${category}

- **Snapshot Records**: DataCategory of `Meta::Snapshot`
- **Event Records**: DataCategory of `EVENT#${epochTime}::${uuid}`

## Integration Points

### Dependencies
- **AWS DynamoDB**: Local storage for replay data
- **AWS EventBridge**: Event streaming to subscribers
- **MTW Interfaces**: Type-safe message contracts
- **MTW Utilities**: Common utilities and helpers

### Cross-References
- **[MessageBus Pattern](../messageBus/AGENT.md)**: Internal event coordination
- **[Internal Cache Pattern](../internalCache/AGENT.md)**: Performance optimization
- **[Lambda Development Guide](../../../AGENT.development.md)**: General lambda patterns
- **[Architecture Philosophy](../../../AGENT.architecture.philosophy.md)**: System design principles

## Usage Patterns

## Development Guidelines

### Implementation Requirements
- **Singleton Pattern**: One instance per lambda execution
- **Type Safety**: Full TypeScript integration with domain-specific types
- **Error Handling**: Graceful degradation and retry logic
- **Performance**: Efficient serialization and storage operations

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

## Navigation Tips

### Getting Started
1. **Read This Guide**: Understand the core functionality and scope
2. **Review Examples**: Study the usage patterns above
3. **Check Dependencies**: Ensure required AWS services are configured
4. **Implement Gradually**: Start with snapshot generation, then add streaming and replay

### Key Concepts
- **Domain Authority**: Each data source owns its domain completely
- **Event Sourcing**: State changes are captured as events
- **Replay Capability**: New subscribers can catch up from any point in time
- **Performance**: Optimized for cost-effective operation

## Development Notes

### **Limited Scope Approach**
This first iteration deliberately focuses on a small, well-defined set of functionality to enable rapid prototyping and iteration. The goal is to establish the foundational patterns that can be extended in future iterations.

### **Design Principles**
- **Simplicity**: Start with essential functionality only
- **Extensibility**: Design for future enhancement without breaking changes
- **Performance**: Optimize for the perception-driven cost model
- **Reliability**: Ensure robust operation in production environments

### **Integration Strategy**
The DataSource pattern is designed to integrate seamlessly with existing lambda patterns:
- **MessageBus**: For internal event coordination
- **Internal Cache**: For performance optimization
- **Existing APIs**: For backward compatibility

This focused approach enables rapid development while establishing the foundation for more comprehensive data source capabilities in future iterations.
