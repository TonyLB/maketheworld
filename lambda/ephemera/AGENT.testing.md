# Ephemera Lambda - Testing Patterns

## Overview

The Ephemera Lambda implements sophisticated testing patterns to handle the complexities of real-time event processing, WebSocket communication, and internal cache dependencies. The primary challenge addressed is effective unit testing of functions that depend on global singletons like `internalCache`.

## Usage - Running Tests

### **Test Commands for Ephemera Lambda**

The Ephemera Lambda uses **Jest** as its testing framework. Use these commands in this directory:

```bash
# Run all tests in watch mode (recommended for development)
npm run test

# Run all tests once (good for CI or verification)
npm run test -- --watchAll=false

# Run tests for a specific file
npm run test path/to/test.ts
```

**Note**: This lambda uses `npm run test` (not `npm test`) because it's a Jest-based package context, unlike the client which uses Vitest with `npm test`.

For complete project-wide testing guidance, see **[Project-Level Testing Documentation](../../AGENT.md#testing-patterns)**.

## InternalCache Dependency Injection Pattern

### **The Challenge**

The `internalCache` is a global singleton that provides caching services across the lambda. While this works well in production, it can make unit testing difficult due to Jest's module caching behavior and the difficulty of mocking global instances.

### **Pattern Implementation**

We've implemented a **dependency injection pattern** that allows tests to inject mock instances while keeping production code clean:

```typescript
// In the function signature, add an optional override parameter
export const perceptionMessage = async ({ 
    payloads, 
    messageBus, 
    internalCacheOverride 
}: { 
    payloads: PerceptionRequestMessage[], 
    messageBus: MessageBus,
    internalCacheOverride?: any
}): Promise<void> => {
    // Use a local getter function to choose between override and default
    const getCache = () => internalCacheOverride || internalCache
    
    // Use getCache() instead of internalCache directly throughout the function
    const messageMetaForCharacter = await getCache().ComponentData.getAcrossAssets(ephemeraId, assetList)
    // ... rest of the function
}
```

### **Usage in Tests**

```typescript
// Create a mock instance with the methods you need
const mockInternalCache = {
    Global: {
        get: jest.fn().mockResolvedValue(['Base'])
    },
    CharacterMeta: {
        get: jest.fn().mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            // ... other properties
        })
    },
    ComponentData: {
        getAcrossAssets: jest.fn().mockResolvedValue({
            [`ASSET#Base`]: new StandardMessage({
                // ... component data
            })
        })
    }
} as any

// Pass the mock to the function
await perceptionMessage({ 
    payloads: [/* test payload */], 
    messageBus: messageBusMock,
    internalCacheOverride: mockInternalCache
})
```

### **Pattern Benefits**

1. **Clean Production Code**: Production code uses the default `internalCache` instance without any test-specific logic
2. **Reliable Testing**: Tests can inject completely controlled mock instances without worrying about module caching issues
3. **Type Safety**: The pattern maintains TypeScript type checking
4. **Minimal Changes**: Only requires adding an optional parameter and a local getter function

## Implementation Guidelines

### **When to Apply This Pattern**

Use this dependency injection pattern for functions that:
- Depend on `internalCache` for data retrieval
- Require reliable unit testing with controlled inputs
- Need to isolate cache behavior from business logic
- Are part of complex event cascades that need predictable testing

### **Implementation Steps**

When implementing this pattern in other functions:

1. **Add the optional parameter**: `internalCacheOverride?: any`
2. **Create a local getter**: `const getCache = () => internalCacheOverride || internalCache`
3. **Replace all `internalCache` calls**: Use `getCache()` instead
4. **Update tests**: Create mock instances and pass them via `internalCacheOverride`
5. **Document the pattern**: Add comments explaining the dependency injection approach

### **Functions Ready for This Pattern**

The following functions could benefit from this same dependency injection pattern:

#### **Character Management Functions**
- **`routeTrustedUiAction` / `actions`**: Uses `internalCache` for speech room precondition checks
- **`dataSource/positions/navigate/`**: Uses `internalCache` for room and character validation during navigate execution
- **`registerCharacter`**: Uses `internalCache` for character registration
- **`guestCharacter`**: Uses `internalCache` for guest character handling

#### **Content and State Functions**
- **`fetchEphemera`**: Uses `internalCache` for character and room data
- **`characterEvents`**: Uses `internalCache` for character state management
- **`canonUpdate`**: Uses `internalCache` for canonical data updates
- **`roomUpdate`**: Uses `internalCache` for room state updates

#### **Map and Subscription Functions**
- **`mapUpdate`**: Uses `internalCache` for map rendering
- **`mapSubscription`**: Uses `internalCache` for map subscription logic

## Testing Strategy for Real-Time Systems

### **Event Processing Testing**

The Ephemera Lambda's event-driven architecture requires specific testing approaches:

#### **Message Bus Testing**
- **Mock Message Bus**: Create controlled message bus instances for testing event cascades
- **Event Sequence Testing**: Verify correct order of message bus operations
- **Cascade Testing**: Test complex workflows that span multiple message types

#### **WebSocket Communication Testing**
- **Connection Mocking**: Mock WebSocket API Gateway interactions
- **Message Delivery Testing**: Verify correct routing of messages to character connections
- **Error Handling**: Test connection failure and retry scenarios

#### **Character Presence Testing**
- **Presence Filtering**: Test perception-driven processing with various character presence scenarios
- **Room State Testing**: Verify character location tracking and room updates
- **Multi-Character Scenarios**: Test interactions between multiple characters in the same room

### **Performance Testing Considerations**

#### **Cache Performance**
- **Cache Hit/Miss Testing**: Verify cache behavior under different load scenarios
- **Invalidation Testing**: Test cache clearing and refresh patterns
- **Memory Usage**: Monitor cache memory consumption in test scenarios

#### **Event Processing Latency**
- **Message Processing Speed**: Test event processing time under various loads
- **Batch Processing**: Verify efficient handling of bulk message updates
- **Connection Scaling**: Test behavior with multiple concurrent character connections

## Migration Testing Strategy

### **Legacy System Testing**

During the Variable/Computed/Action system removal:

#### **Regression Testing**
- **Functional Preservation**: Ensure core functionality remains intact during migration
- **Performance Baseline**: Maintain performance benchmarks throughout transition
- **Character Interaction Preservation**: Verify character interactions continue working

#### **Transition Testing**
- **Gradual Migration**: Test incremental removal of legacy patterns
- **Fallback Testing**: Verify graceful handling of mixed legacy/new content
- **Data Migration**: Test conversion of existing content to new patterns

### **New Architecture Testing**

For the example-driven replacement system:

#### **AI Integration Testing**
- **Example Processing**: Test AI interpretation of content examples
- **Response Generation**: Verify AI-generated character interactions
- **Performance Impact**: Monitor computational costs of AI processing

#### **Simplified State Testing**
- **State Management**: Test new streamlined state management patterns
- **Event Processing**: Verify simplified event flows
- **Content Consistency**: Ensure content integrity in new system

## Related Documentation

- **[Main Lambda Documentation](AGENT.md)**: Complete Ephemera Lambda overview and architecture
- **[Event Flow Documentation](AGENT.event.md)**: Event processing patterns that require testing
- **[Perception System](perception/AGENT.md)**: Perception processing testing considerations
- **[Internal Cache System](internalCache/AGENT.md)**: Caching architecture testing patterns

## Development Notes

### **Current Testing Infrastructure**
- **Jest Configuration**: Standard Jest setup with TypeScript support
- **Existing Test Files**: Several functions already have test coverage using dependency injection
- **Mock Patterns**: Established patterns for mocking AWS services and internal dependencies

### **Testing Philosophy**
This pattern significantly improves test reliability and maintainability while keeping production code clean and performant. The dependency injection approach enables comprehensive testing of complex event flows while maintaining the architectural integrity of the perception-driven processing system.

The testing patterns documented here provide the foundation for systematic testing during the Variable/Computed/Action migration and the transition to example-driven content management.
