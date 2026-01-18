# StandardEditable Architecture

This document outlines the architecture for StandardEditable components using the `standardEditableFactory` pattern.

## Overview

The `standardEditableFactory` pattern enables clean `instanceof` checks and type-safe access to edit-specific functionality for WML edit operations (add, remove, replace).

## Important: Content Editing Only

**`standardEditableFactory` is for content editing only** (e.g., `StandardLiteral`, `StandardRender`, `StandardExit`). It should NOT be used for reference editing (`StandardReference`), which has different edit semantics:

- **Content editables**: Support Add, Remove, and Replace operations
- **References**: Support only Add and Remove operations (Replace operations are illegal)

`StandardReference` does NOT use the factory pattern because references can only be added or removed, never replaced with a different target component. This aligns with the edit algebra where changing a reference target requires explicit separate Add and Remove operations.

## standardEditableFactory Pattern

### Concept
Create a factory that returns an abstract parent class with concrete subtype instances:
- **Abstract Parent**: Contains the static `create` factory method
- **Concrete Subtypes**: `PlainClass`, `RemoveClass`, `ReplaceClass` for different edit states
- **Factory Method**: Analyzes WML content to determine appropriate subtype
- **Type Safety**: Enables clean `instanceof` checks on returned instances

### Implementation Pattern

```typescript
// Factory returns abstract parent class with concrete subtype instances
const { EditableClass, PlainClass, RemoveClass, ReplaceClass } = standardEditableFactory(factoryProps, 'StandardTest');

// Usage enables clean instanceof checks
const exit = EditableClass.create('<Replace><Remove>Old</Remove><Exit /></Replace>');
if (exit instanceof ReplaceClass) {
    // Type-safe access to replace-specific functionality
}
```

### Architecture Benefits

#### Developer Experience
- **Natural instanceof**: `if (exit instanceof ReplaceClass)` works as expected
- **Type Safety**: TypeScript can infer specific subtypes from instanceof checks
- **IntelliSense**: IDE provides appropriate methods/properties for each subtype
- **Cleaner Code**: No more `_payload instanceof` checks

#### Architecture Consistency
- **Unified Pattern**: All editable components follow the same factory + subtype structure
- **Extensible**: Easy to add new subtypes or modify existing ones
- **Testable**: Each subtype can be tested independently
- **Maintainable**: Clear separation of concerns between edit states

#### Performance
- **No Wrapper Overhead**: Direct subtype instances, no payload indirection
- **Eliminates instanceof Chains**: Direct instanceof checks on concrete classes
- **Memory Efficient**: Single object instead of wrapper + payload

## Implementation Status

### ✅ Completed
- **standardEditableFactory**: Core factory function implemented in `generics/editable/index.ts`
- **Factory Pattern**: Returns abstract parent + concrete subtype classes
- **String-based Dispatching**: `create` method analyzes WML content for subtype selection
- **Clean Naming**: `EditableClass`, `PlainClass`, `RemoveClass`, `ReplaceClass`
- **Comprehensive Testing**: All tests passing with instanceof validation
- **Delta Operations**: `_delta` getter, `fromDelta` factory method, and `toJSON`/`schema` methods
- **Merge/Diff Operations**: Full implementation of merge and diff operations operating on deltas
- **StandardEditableWrapper Interface**: Complete compatibility with clone, plain, and nestedSchema methods
- **remapReferences**: Method implemented for all concrete classes

## Technical Implementation

### Factory Function Signature
```typescript
export const standardEditableFactory = <DataType, FinalType extends StandardEditablePayload<DataType>>(
    props: StandardEditableFactoryProps<DataType, FinalType>, 
    className: string
) => {
    // Returns abstract parent + concrete subtypes
}
```

### Returned Classes
- **`EditableClass`**: Abstract parent with static `create` method
- **`PlainClass`**: For simple content (no edit tags)
- **`RemoveClass`**: For `<Remove>` operations
- **`ReplaceClass`**: For `<Replace>` operations

### Interface Compatibility
All generated classes implement the `StandardEditableWrapper` interface:
- **`clone()`**: Creates deep copies of instances
- **`plain`**: Returns the underlying payload data
- **`nestedSchema(tag)`**: Returns schema representation (compatibility method)
- **`remapReferences(props)`**: Remaps references using the provided mappings

### WML Parsing Logic
```typescript
static create(format: string): GeneratedEditableClass {
    if (format.includes('<Replace>')) {
        return new GeneratedEditableReplaceClass(format)
    } else if (format.includes('<Remove>')) {
        return new GeneratedEditableRemoveClass(format)
    } else {
        return new GeneratedEditablePlainClass(format)
    }
}
```

## Success Criteria

### Functional Requirements
- **Factory Pattern**: `EditableClass.create()` returns appropriate subtype
- **Instanceof Support**: `instanceof PlainClass` works correctly
- **Type Safety**: TypeScript can infer subtypes from instanceof checks
- **Performance**: No measurable performance degradation

### Code Quality Requirements
- **Clean Architecture**: Clear separation between abstract and concrete classes
- **Consistent Pattern**: All editable components follow the same factory structure
- **Testability**: Each subtype can be tested independently
- **Documentation**: Clear examples of factory usage and subtype checking

## Related Documentation

- **[Editable Generic System](./index.ts)**: Core editable factory implementation
- **[Facet System](../standardize/keys/facets/AGENT.facets.md)**: Exit data migrated to ExitFacet pattern using facets