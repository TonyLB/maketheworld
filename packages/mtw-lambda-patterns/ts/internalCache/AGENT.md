# Internal Cache System - Agent Navigation Guide

## Overview

The `internalCache` system provides a comprehensive caching layer that improves development velocity by providing **deferred loading** of asynchronous data sources. Cache handlers can request data anytime, but only make actual database calls on the first request for a particular item. Subsequent requests either refer to existing outstanding calls (if unfulfilled) or return cached data (if the call has previously completed).

## Core Architecture

### **DeferredCache Foundation**
All cache handlers use the `DeferredCache<T>` class which provides:
- **Deferred Loading**: Request data immediately, load asynchronously
- **Batching**: Multiple requests for the same data share single database calls
- **Promise Management**: Handles concurrent requests efficiently
- **Invalidation**: Supports cache invalidation and refresh

### **Dual Storage Pattern**
Most cache handlers implement a dual storage system:
- **`_Cache`**: `DeferredCache` for managing async loading and batching
- **`_Store`**: Direct object storage for immediate access to cached data

### **Reusable Patterns**
The system provides common patterns that can be reused across lambdas:
- **CacheKeyValidator**: Standardized key generation and validation
- **CacheMethodMixin**: Common method implementations (clear, flush, invalidate, set)
- **DualStorageCacheHandler**: Base class with dual storage pattern

## Available Patterns

### **Core Infrastructure**
- **DeferredCache**: Main caching engine with batching and promise management
- **Deferred**: Individual promise wrapper with invalidation support
- **CacheBase**: Base class for cache composition

### **Pattern Utilities**
- **CacheKeyValidator**: Reusable key validation for delimited keys
- **CacheMethodMixin**: Mixin for standard cache methods
- **DualStorageCacheHandler**: Base class for dual storage pattern

## Integration Points

### **Dependencies**
- **TypeScript**: Full type safety and compile-time guarantees
- **AWS SDK**: Integration with AWS services (DynamoDB, S3, etc.)
- **MTW Interfaces**: Type definitions and validation functions

### **Composing with `mtw-gateways`**

Read surfaces for Dynamo rows owned elsewhere live in [`packages/mtw-gateways`](../../../mtw-gateways/AGENT.md). Lambda cache handlers should **import gateway helpers** and inject **`assetDB`** (or the gateway's narrow store interface); **do not** duplicate partition/sort encoding in `internalCache`. **`DeferredCache.invalidate(key)`** invalidates a cached entry when authoritative data changes (see **Wrapping gateways in InternalCache** in [`packages/mtw-gateways/AGENT.md`](../../../mtw-gateways/AGENT.md)).

### **Cross-References**
- **[Lambda Assets](../../../lambda/assets/AGENT.md)**: Asset management using internalCache
- **[Lambda Ephemera](../../../lambda/ephemera/AGENT.md)**: Real-time game state using internalCache
- **[Lambda Subscriptions](../../../lambda/subscriptions/AGENT.md)**: Session management using internalCache
- **[MTW Interfaces](../../mtw-interfaces/AGENT.md)**: Type definitions and interfaces
- **[MTW Utilities](../../mtw-utilities/AGENT.md)**: Utility functions and helpers

## Usage Patterns

### **When to Use Patterns**
- **Use patterns** for simple, standard cache handlers
- **Use custom implementations** for complex business logic
- **Mix and match** - use patterns where they help, custom where needed

### **Common Approaches**
- **Simple handlers**: Extend `DualStorageCacheHandler` and implement domain-specific methods
- **Complex handlers**: Implement custom logic while using core `DeferredCache` infrastructure
- **Mixed approach**: Use `withCacheMethods` mixin for standard methods, custom for special logic

## Development Guidelines

### **Adding New Patterns**
1. **Identify Common Code**: Look for repeated patterns across lambdas
2. **Create Reusable Utility**: Abstract the common pattern
3. **Make It Optional**: Ensure custom implementations are still possible
4. **Add Documentation**: Document when to use vs. when to customize
5. **Add Tests**: Ensure pattern works correctly

### **Migration Strategy**
1. **Phase 1**: Move core infrastructure (DeferredCache, Deferred)
2. **Phase 2**: Add pattern utilities (validators, mixins)
3. **Phase 3**: Migrate simple handlers to use patterns
4. **Phase 4**: Keep complex handlers as custom implementations

## Navigation Tips

### **Getting Started**
1. **Read Implementation Guide**: See [`AGENT.implementation.md`](./AGENT.implementation.md) for detailed code examples
2. **Check Pattern Examples**: Look at the pattern utilities for common use cases
3. **Study Existing Handlers**: See how different lambdas implement cache handlers
4. **Choose Your Approach**: Simple handlers can use patterns, complex ones should be custom

### **Key Files**
- **Core Infrastructure**: `deferredCache.ts`, `deferred.ts`, `baseClasses.ts`
- **Pattern Utilities**: `patterns/` directory
- **Documentation**: `AGENT*.md` files

### **Related Documentation**
- **[Lambda Development Guide](../../../AGENT.development.md)**: General lambda development practices
- **[Testing Standards](../../../charcoal-client/AGENT.testing.md)**: Testing patterns and standards
- **[Architecture Philosophy](../../../AGENT.architecture.philosophy.md)**: System design principles

