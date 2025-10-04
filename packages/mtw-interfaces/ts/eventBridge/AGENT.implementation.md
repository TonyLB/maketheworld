# EventBridge Implementation Guide

This document provides technical guidelines for implementing and maintaining EventBridge event contracts in the `mtw-interfaces` package.

## Event Contract Design

### Internal vs External Formats

- **Internal Format**: Clean, domain-specific representations optimized for manipulation
- **External Format**: Transmittable representations optimized for cross-service communication
- **Type Safety**: Full TypeScript support for both internal and external event structures
- **Versioning**: Design for backward compatibility and future evolution

### Event Contract Structure

Each data source should follow this consistent structure:

```typescript
// Internal event types (for messageBus processing)
export type DataSourceEventUpdate = EventType1 | EventType2

// External event types (for EventBridge communication)
export type DataSourceEventExternal = EventType1External | EventType2External

// Type guards for runtime validation
export const isDataSourceEventType1 = (event: any): event is EventType1 => { ... }

// Serializer implementing the interface
export class DataSourceEventSerializer implements DataSourceEventSerializer<DataSourceEventUpdate, DataSourceEventExternal> {
    serialize(params: { dataSourceKey: string; streamKey: string; update: DataSourceEventUpdate }): DataSourceEventExternal
    deserialize(params: { dataSourceKey: string; streamKey: string; externalUpdate: DataSourceEventExternal }): DataSourceEventUpdate | null
}
```

## Serializer Implementation Pattern

### Interface Requirements

All serializers must implement `DataSourceEventSerializer<UpdatePayload, ExternalUpdatePayload>`:

```typescript
export class MyEventSerializer implements DataSourceEventSerializer<MyEventUpdate, MyEventExternal> {
    serialize(params: {
        dataSourceKey: string;
        streamKey: string;
        update: MyEventUpdate;
    }): MyEventExternal {
        // Convert internal format to external format
    }
    
    deserialize(params: {
        dataSourceKey: string;
        streamKey: string;
        externalUpdate: MyEventExternal;
    }): MyEventUpdate | null {
        // Convert external format to internal format
    }
}
```

### Implementation Guidelines

1. **Handle Conversion**: Convert between internal messageBus events and external EventBridge events
2. **Include Error Handling**: Proper error handling and validation for malformed data
3. **Support Multiple Types**: Handle different event types within the same data source
4. **Maintain Type Safety**: Use TypeScript type guards for runtime validation
5. **Preserve Data Integrity**: Ensure no data loss during serialization/deserialization

### Error Handling

```typescript
// Good: Graceful error handling
deserialize(params: { ... }): MyEventUpdate | null {
    try {
        // Parse external event
        return parsedEvent
    } catch (error) {
        console.warn('Failed to deserialize event:', error)
        return null
    }
}

// Good: Validation with clear error messages
serialize(params: { ... }): MyEventExternal {
    if (!isValidEvent(params.update)) {
        throw new Error(`Invalid event type: ${JSON.stringify(params.update)}`)
    }
    // ... serialize
}
```

## Import Strategy

### Correct Import Pattern

All lambdas should import from the shared interface package:

```typescript
// ✅ Correct: Import from shared interface
import { 
    WMLEventSerializer, 
    WMLEventUpdate, 
    WMLEventExternal 
} from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

// ✅ Correct: Import sub-source events
import { 
    CharacterEventSerializer, 
    CharacterEventUpdate 
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/characters'
```

### Avoided Patterns

```typescript
// ❌ Wrong: Direct cross-lambda imports
import { WMLEventSerializer } from '../wml/dataSource/serializers'

// ❌ Wrong: Importing from lambda directories
import { AssetsEventSerializer } from '../assets/dataSource/serializers'
```

## Directory Structure

### Top-Level Data Sources

```
packages/mtw-interfaces/ts/eventBridge/
├── wml/
│   ├── index.ts              # Main WML event contracts
│   └── index.test.ts         # WML serializer tests
├── assets/
│   ├── index.ts              # Main Assets event contracts
│   ├── index.test.ts         # Assets serializer tests
│   ├── characters/
│   │   ├── index.ts          # Characters sub-source events
│   │   └── index.test.ts     # Characters serializer tests
│   └── contentHeaders/
│       ├── index.ts          # ContentHeaders sub-source events
│       ├── baseClasses.ts    # Base types and type guards
│       └── index.test.ts     # ContentHeaders serializer tests
└── ephemera/
    ├── index.ts              # Ephemera event contracts
    └── index.test.ts         # Ephemera serializer tests
```

### Sub-Source Pattern

For data sources with sub-sources, use the directory structure:

```
assets/
├── index.ts                  # Main data source events
├── characters/               # Sub-source directory
│   └── index.ts             # Sub-source events
└── contentHeaders/          # Another sub-source
    ├── index.ts             # Sub-source events
    └── baseClasses.ts       # Sub-source specific types
```

## Testing Guidelines

### Test Coverage Requirements

Each serializer should have comprehensive tests covering:

1. **Serialization**: Internal → External format conversion
2. **Deserialization**: External → Internal format conversion
3. **Round-trip Testing**: Serialize then deserialize to verify data integrity
4. **Error Handling**: Invalid data, malformed events, missing fields
5. **Type Guards**: Validation of type guard functions
6. **Edge Cases**: Null values, empty objects, boundary conditions

### Test Structure

```typescript
describe('MyEventSerializer', () => {
    let serializer: MyEventSerializer

    beforeEach(() => {
        serializer = new MyEventSerializer()
    })

    describe('Serialization', () => {
        it('should serialize internal events to external format', () => {
            // Test serialization
        })
    })

    describe('Deserialization', () => {
        it('should deserialize external events to internal format', () => {
            // Test deserialization
        })
    })

    describe('Error Handling', () => {
        it('should handle invalid input gracefully', () => {
            // Test error cases
        })
    })
})
```

## Best Practices

### 1. Separation of Concerns

- **Serializers**: Only handle format conversion (internal ↔ external)
- **Data Sources**: Handle business logic (data manipulation, validation)
- **Utilities**: Keep business logic utilities in data source implementations

### 2. Type Safety

- Use discriminated unions for event types with different shapes
- Implement comprehensive type guards
- Avoid `any` types in favor of specific type definitions

### 3. Documentation

- Document all public interfaces and types
- Include usage examples in JSDoc comments
- Maintain up-to-date type definitions

### 4. Versioning

- Design for backward compatibility
- Use semantic versioning for breaking changes
- Document migration paths for breaking changes

## Related Documentation

- **[EventBridge Overview](./AGENT.md)**: High-level overview of EventBridge contracts
- **[DataSource Pattern](../../../mtw-lambda-patterns/ts/dataSource/AGENT.md)**: How to implement DataSources using these contracts
- **[Migration History](./AGENT.migration.md)**: Historical context of the EventBridge migration
