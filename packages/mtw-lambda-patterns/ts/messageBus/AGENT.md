# MessageBus System - Agent Navigation Guide

## Overview

The MessageBus system provides a two-tier architecture for decoupling different processing steps within individual jobs. It enables complex operations to be broken down into isolated, priority-ordered handlers that can be reasoned about as separate jobs with clear inputs and outputs.

## Core Purpose

- **Decoupling**: Separates complex processing into isolated, testable components
- **Priority Ordering**: Subscription `priority` is retained for documentation; **`publish` schedules matching handlers concurrently** (priority is not enforced on the publish path)
- **Stream Processing**: Handlers receive `payloads: [singleItem]` per `publish`; concurrent handler invocations are natural under `publish`/`settle`
- **Type Safety**: Provides compile-time guarantees for message handling

## Technical Details

### Two-Tier Architecture

#### **Generic InternalMessageBus** (`packages/mtw-lambda-patterns/ts/messageBus`)
- Low-level async scheduling engine (`publish`, `settle`, `flushAndSettle`)
- Type-safe filtering with TypeScript type guards
- Handler promises tracked in `_inFlight` until boundary drain

#### **Domain-Specific MessageBuses** (`lambda/*/messageBus`)
- High-level business logic handlers
- Pre-configured subscriptions with domain-specific message types
- Handler functions following consistent patterns
- Integration with internalCache and external services

### Core Concepts

- **Message Types**: Discriminated unions defining all possible messages for a domain
- **Type Guards**: Functions that narrow message types for safe handling
- **Handlers**: Async functions that process specific message types
- **Priorities**: Numeric ordering system (lower numbers execute first)
- **Stream Processing**: Messages persist across handler executions

## Integration Points

### Dependencies
- **Internal Cache**: Handlers access shared state through `internalCache`
- **External Services**: SNS, DynamoDB, API Gateway integration
- **TypeScript Interfaces**: Message type definitions from `@tonylb/mtw-interfaces`

### Cross-References
- **[Lambda Assets](../lambda/assets/AGENT.md)**: Asset management messageBus implementation
- **[Lambda Ephemera](../lambda/ephemera/AGENT.md)**: Real-time game state messageBus
- **[Internal Cache](../lambda/ephemera/internalCache/AGENT.md)**: Shared state management
- **[Message Contracts](../packages/mtw-interfaces/AGENT.md)**: API message definitions

### System Relationships
- **Lambda Handlers**: Each lambda defines its own messageBus with domain-specific messages
- **API Gateway**: Receives requests and sends messages to appropriate handlers
- **Step Functions**: Can trigger messageBus processing for batch operations
- **WebSocket Connections**: Real-time message delivery through messageBus

## Usage Patterns

### Creating a New MessageBus Handler

1. **Define Message Types**: Create discriminated union with type guards
2. **Implement Handler Function**: Follow standard async handler pattern
3. **Register Subscription**: Add to messageBus with appropriate priority
4. **Publish Messages**: Use `messageBus.publish()` from API handlers; boundary drain via `await messageBus.flushAndSettle()` in `app.ts`

### Priority Guidelines
- **Priority 1-3**: Critical system operations (character registration, authentication)
- **Priority 4-6**: Core business logic (asset operations, API responses)
- **Priority 7-8**: Caching and optimization (asset caching, cleanup)
- **Priority 9+**: Final operations (return values, notifications)

### Common Patterns
- **Conditional Processing**: Check connection state before processing
- **Batch Operations**: Process multiple messages in parallel
- **Follow-up Messages**: Send additional messages from handlers
- **Error Handling**: Graceful failure without breaking other handlers

## Navigation Tips

### Getting Started
1. **Read Implementation Guide**: See [`AGENT.implementation.md`](./AGENT.implementation.md) for detailed code examples
2. **Study Existing Patterns**: Examine `lambda/assets/messageBus` and `lambda/ephemera/messageBus`
3. **Check Testing Patterns**: See [`AGENT.testing.md`](./AGENT.testing.md) for testing strategies

### Key Files
- **Base Classes**: `lambda/*/messageBus/baseClasses.ts` - Message type definitions
- **MessageBus Setup**: `lambda/*/messageBus/index.ts` - Subscription registration
- **Handler Functions**: `lambda/*/messageBus/*/index.ts` - Individual handlers
- **API Integration**: `lambda/*/app.ts` - Message sending from API handlers

### Related Documentation
- **[Lambda Assets](../lambda/assets/AGENT.md)**: Asset management system
- **[Lambda Ephemera](../lambda/ephemera/AGENT.md)**: Real-time game state
- **[Internal Cache](../lambda/ephemera/internalCache/AGENT.md)**: Shared state management
- **[Testing Standards](../charcoal-client/AGENT.testing.md)**: Testing patterns

## Development Notes

### Current State
- **Production Ready**: MessageBus system is actively used in production lambdas
- **Type Safe**: Full TypeScript integration with compile-time guarantees
- **Well Tested**: Comprehensive test coverage for core functionality

### Known Limitations
- **Priority Violations**: Console warnings when handlers create messages at lower priorities
- **Error Propagation**: Handler failures can prevent other handlers at same priority
- **Memory Usage**: Messages persist in memory until bus is cleared

### Future Improvements
- **Error Recovery**: Better handling of handler failures
- **Performance Monitoring**: Metrics for handler execution times
- **Dynamic Priorities**: Runtime priority adjustment capabilities

### Technical Debt
- **Documentation**: Some handlers lack inline documentation
- **Error Handling**: Inconsistent error handling patterns across handlers
- **Testing**: Some handlers need more comprehensive test coverage
