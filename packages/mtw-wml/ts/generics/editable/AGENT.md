# StandardEditable v2 Architecture

**⚠️ PLANNING DOCUMENT** - This document outlines the v2 architecture for StandardEditable components using the new `v2StandardEditableFactory` pattern.

## Overview

The current `StandardEditable` architecture uses a complex edit pattern that handles WML edit operations (add, remove, replace) but creates usability challenges in non-edit contexts like UI rendering and data manipulation. The `v2StandardEditableFactory` introduces a new pattern that enables clean `instanceof` checks and type-safe access to edit-specific functionality.

## Current Edit Pattern Architecture

### How It Works
1. **Base Classes**: `StandardExitBase`, `StandardExitSimple`, `StandardExitRemove`, `StandardExitReplace` handle different edit states
2. **Wrapper Class**: `StandardExit` acts as a facade, delegating to the appropriate base class
3. **Payload Access**: Data is accessed via `._payload.plain` to get the resolved state
4. **State Management**: Components can transition between edit states during WML operations

### Example: StandardExit Structure
```typescript
// Complex state handling
exit._payload instanceof StandardExitSimple    // Basic exit
exit._payload instanceof StandardExitRemove    // Exit marked for removal  
exit._payload instanceof StandardExitReplace   // Exit being replaced

// Data access requires deep nesting
exit._payload.plain.to.universalKey           // Target room
exit._payload.plain.description?.value        // Exit name
```

## Pain Points Across the System

### 1. Deep Property Nesting
**Problem**: Accessing component data requires verbose property chains
**Impact**: UI code becomes hard to read and error-prone
**Examples**:
- `exit._payload.plain.to.universalKey` instead of `exit.to`
- `room._payload.plain.shortName?.value` instead of `room.name`

### 2. Edit State Complexity in Display Contexts
**Problem**: Display logic must handle edit states that aren't relevant
**Impact**: UI components become more complex than necessary
**Examples**:
- Maps component needs to check `instanceof StandardExitSimple` before rendering
- Room editor must handle `StandardExitRemove` states during display

### 3. Inconsistent Access Patterns
**Problem**: Different components access data in different ways
**Impact**: Code becomes harder to maintain and understand
**Examples**:
- Some code uses `._payload.plain`
- Some code checks edit states first
- Some code assumes simple states only

## Proposed Solution: v2StandardEditableFactory Pattern

### Concept
Create a factory that returns an abstract parent class with concrete subtype instances:
- **Abstract Parent**: Contains the static `create` factory method
- **Concrete Subtypes**: `PlainClass`, `RemoveClass`, `ReplaceClass` for different edit states
- **Factory Method**: Analyzes WML content to determine appropriate subtype
- **Type Safety**: Enables clean `instanceof` checks on returned instances

### Implementation Pattern

```typescript
// Factory returns abstract parent class with concrete subtype instances
const { EditableClass, PlainClass, RemoveClass, ReplaceClass } = v2StandardEditableFactory(factoryProps, 'StandardTest');

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
- **v2StandardEditableFactory**: Core factory function implemented in `generics/editable/index.ts`
- **Factory Pattern**: Returns abstract parent + concrete subtype classes
- **String-based Dispatching**: `create` method analyzes WML content for subtype selection
- **Clean Naming**: `EditableClass`, `PlainClass`, `RemoveClass`, `ReplaceClass`
- **Comprehensive Testing**: All tests passing with instanceof validation
- **Delta Operations**: `_delta` getter, `fromDelta` factory method, and `toJSON`/`schema` methods
- **Merge/Diff Operations**: Full implementation of merge and diff operations operating on deltas

### 🔄 In Progress
- **Integration Planning**: How to integrate with existing StandardExit architecture
- **Migration Strategy**: Path from current pattern to v2 pattern

### 📋 Next Steps
- **StandardExit Integration**: Refactor StandardExit to use v2StandardEditableFactory
- **Component Migration**: Extend pattern to other editable components
- **API Design**: Design clean interfaces for each subtype
- **Documentation**: Create usage examples and migration guides

## Technical Implementation

### Factory Function Signature
```typescript
export const v2StandardEditableFactory = <DataType, FinalType extends StandardEditablePayload<DataType>>(
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

### WML Parsing Logic
```typescript
static create(format: string): GeneratedV2EditableClass {
    if (format.includes('<Replace>')) {
        return new GeneratedV2EditableReplaceClass(format)
    } else if (format.includes('<Remove>')) {
        return new GeneratedV2EditableRemoveClass(format)
    } else {
        return new GeneratedV2EditablePlainClass(format)
    }
}
```

## Migration Strategy

### Phase 1: Foundation (✅ Complete)
- Implement `v2StandardEditableFactory` core functionality
- Create comprehensive test suite
- Validate factory pattern with instanceof checks

### Phase 2: StandardExit Integration
- Refactor `StandardExit` to use `v2StandardEditableFactory`
- Create `StandardExitV2` abstract class with concrete subtypes
- Maintain backward compatibility during transition

### Phase 3: Component Ecosystem
- Extend pattern to other editable components
- Create consistent v2 architecture across the system
- Establish migration patterns and best practices

### Phase 4: Optimization
- Performance analysis and optimization
- Memory usage optimization
- API refinement based on usage patterns

## Success Criteria

### Functional Requirements
- **Factory Pattern**: `EditableClass.create()` returns appropriate subtype
- **Instanceof Support**: `instanceof PlainClass` works correctly
- **Type Safety**: TypeScript can infer subtypes from instanceof checks
- **Performance**: No measurable performance degradation

### Code Quality Requirements
- **Clean Architecture**: Clear separation between abstract and concrete classes
- **Consistent Pattern**: All editable components follow the same v2 structure
- **Testability**: Each subtype can be tested independently
- **Documentation**: Clear examples of factory usage and subtype checking

### Migration Requirements
- **Incremental**: Can be implemented alongside existing classes
- **Non-Breaking**: Existing code continues to work unchanged
- **Measurable**: Clear metrics for migration progress and success

## Related Documentation

- **[StandardComponent Edit Pattern Planning](../standardize/components/AGENT.edits.planning.md)**: Overview of edit pattern challenges and solutions
- **[StandardExit Implementation](../standardize/components/exit.ts)**: Current StandardExit implementation using standardEditableFactory
- **[Editable Generic System](./index.ts)**: Core editable factory implementation and v2 architecture
