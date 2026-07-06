# MTW Lambda Patterns - Agent Navigation Guide

## Overview

The `mtw-lambda-patterns` package provides reusable coding patterns and utilities specifically designed for MakeTheWorld lambda functions. This package centralizes common patterns that appear across multiple lambdas, promoting consistency, maintainability, and code reuse.

## Core Purpose

- **Pattern Centralization**: Consolidate common lambda patterns in one discoverable location
- **Code Reuse**: Reduce duplication across lambda functions
- **Consistency**: Ensure consistent implementation of common patterns
- **Documentation**: Provide comprehensive guides for pattern usage and testing

## Available Patterns

### MessageBus System (`ts/messageBus/`)

Two-tier architecture for decoupling processing steps within individual lambda jobs using priority-based execution and type-safe message handling.

**Documentation:**
- **[MessageBus Guide](./ts/messageBus/AGENT.md)** - Navigation and concepts
- **[Implementation Guide](./ts/messageBus/AGENT.implementation.md)** - Code examples and patterns
- **[Testing Guide](./ts/messageBus/AGENT.testing.md)** - Testing strategies

### Test utilities (`ts/testing/`)

Jest-oriented helpers that are **not** exported from the package runtime entry. Use deep imports from tests only (for example `createAsyncGate` in [`ts/testing/asyncGate.ts`](./ts/testing/asyncGate.ts)): one in-flight gated async call at a time, with explicit `resolve()` / `reject()` to unblock after asserting intermediate behavior.

### Internal Cache System (`ts/internalCache/`)

Comprehensive caching layer providing deferred loading of asynchronous data sources with reusable patterns for common cache handler implementations.

**Documentation:**
- **[Internal Cache Guide](./ts/internalCache/AGENT.md)** - Navigation and concepts
- **[Implementation Guide](./ts/internalCache/AGENT.implementation.md)** - Code examples and patterns

### Semantic Embedding (`ts/semanticEmbedding/`)

Immutable value type for Titan Text Embedding v2 vectors: quantize normalized floats to `int8-v1` bytes at construction, expose Dynamo-safe `Uint8Array` serde, and compare via cosine similarity or byte-wise equality. Deep import: `@tonylb/mtw-lambda-patterns/ts/semanticEmbedding`. Dynamo handler round-trip proof tests live in `mtw-utilities` (`ts/dynamoDB/mixins/binaryRoundTrip.test.ts`).

**Documentation:**
- **[Semantic Embedding Guide](./ts/semanticEmbedding/AGENT.md)** - Navigation and import path
- **[Implementation Guide](./ts/semanticEmbedding/AGENT.implementation.md)** - Quantization rules and API invariants

## Integration Points

### Dependencies
- **TypeScript**: Full type safety and compile-time guarantees
- **Jest**: Comprehensive testing framework
- **AWS SDK**: Integration with AWS services (SNS, DynamoDB, etc.)

### Cross-References
- **[Lambda Assets](../../lambda/assets/AGENT.md)**: Asset management using messageBus
- **[Lambda Ephemera](../../lambda/ephemera/AGENT.md)**: Real-time game state using messageBus
- **[MTW Interfaces](../mtw-interfaces/AGENT.md)**: Type definitions and interfaces
- **[MTW Utilities](../mtw-utilities/AGENT.md)**: Utility functions and helpers

## Usage Patterns

### Adding New Patterns

When adding new patterns to this package:

1. **Create Pattern Directory**: Add a new directory under `ts/` (e.g., `ts/caching/`)
2. **Implement Core Logic**: Add the main implementation files
3. **Add Tests**: Include comprehensive unit tests
4. **Create Documentation**: Add `AGENT.md`, `AGENT.implementation.md`, and `AGENT.testing.md`
5. **Update This File**: Add the new pattern to the "Available Patterns" section

### Pattern Structure

Each pattern should follow this structure:
```
ts/[pattern-name]/
├── index.ts                    # Main implementation
├── index.test.ts              # Unit tests
├── AGENT.md                   # High-level navigation
├── AGENT.implementation.md    # Detailed implementation guide
├── AGENT.testing.md          # Testing strategies
└── __snapshots__/            # Jest snapshots (auto-generated)
```

## Development Guidelines

### Code Standards
- **TypeScript**: Use strict typing and compile-time safety
- **Testing**: Maintain comprehensive test coverage
- **Documentation**: Provide clear, searchable documentation
- **Consistency**: Follow established patterns and conventions

### Testing Requirements
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test pattern interactions
- **Error Handling**: Test error scenarios and edge cases
- **Performance**: Include performance tests for critical paths

### Documentation Standards
- **High-Level Overview**: Start with concepts and navigation
- **Implementation Details**: Provide code examples and patterns
- **Testing Strategies**: Document testing approaches and utilities
- **Cross-References**: Link to related patterns and systems

## Current State

### Production Ready
- **MessageBus System**: Actively used in production lambdas
- **Type Safe**: Full TypeScript integration
- **Well Tested**: Comprehensive test coverage

### Future Patterns
- **Caching Patterns**: Common caching strategies and utilities
- **Error Handling**: Standardized error handling patterns
- **Validation**: Input validation and sanitization utilities
- **Logging**: Structured logging patterns
- **Metrics**: Performance monitoring and metrics collection

## Navigation Tips

### Getting Started
1. **Read This Guide**: Understand the package structure and available patterns
2. **Choose a Pattern**: Select the appropriate pattern for your use case
3. **Read Pattern Documentation**: Study the specific pattern's documentation
4. **Check Examples**: Look at existing lambda implementations
5. **Write Tests**: Follow the testing patterns and guidelines

### Key Files
- **Package Root**: `package.json`, `tsconfig.json`, `jest.config.js`
- **Pattern Directories**: `ts/[pattern-name]/` - Individual pattern implementations
- **Documentation**: `AGENT*.md` files in each pattern directory

### Related Documentation
- **[Lambda Development Guide](../../AGENT.development.md)**: General lambda development practices
- **[Testing Standards](../../charcoal-client/AGENT.testing.md)**: Testing patterns and standards
- **[Architecture Philosophy](../../AGENT.architecture.philosophy.md)**: System design principles

## Development Notes

### Known Limitations
- **Pattern Scope**: Focus on lambda-specific patterns only
- **Dependencies**: Minimize external dependencies
- **Backwards Compatibility**: Maintain compatibility with existing implementations

### Technical Debt
- **Documentation**: Some patterns may need additional documentation
- **Testing**: Some patterns may need more comprehensive test coverage
- **Performance**: Some patterns may need performance optimization

### Future Improvements
- **Pattern Discovery**: Better tooling for discovering available patterns
- **Code Generation**: Tools for generating pattern boilerplate
- **Performance Monitoring**: Built-in performance metrics for patterns
- **Validation**: Runtime validation of pattern usage
