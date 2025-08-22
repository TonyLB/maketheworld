# StandardComponent Edit Pattern Planning

**⚠️ PLANNING DOCUMENT** - This document outlines the pain points created by the current edit pattern in StandardComponent classes and references the v2 architecture solution.

## Overview

The current `StandardComponent` architecture uses a complex edit pattern that handles WML edit operations (add, remove, replace) but creates usability challenges in non-edit contexts like UI rendering and data manipulation.

## Current Edit Pattern Architecture

### How It Works
1. **Base Classes**: `StandardExitSimple`, `StandardExitRemove`, `StandardExitReplace` handle different edit states
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

## Proposed Solution: v2 Architecture Pattern

The v2 architecture provides a factory pattern that returns abstract parent classes with concrete subtype instances, enabling clean `instanceof` checks and type-safe access to edit-specific functionality.

## Implementation Status

### ✅ Completed
- **v2ComponentClassFactory**: Core factory function implemented in `component.ts`
- **v2StandardEditableFactory**: Core factory function implemented in `generics/editable/index.ts`
- **Factory Pattern**: Returns abstract parent + concrete subtype classes
- **String-based Dispatching**: `create` method analyzes WML content for subtype selection
- **Clean Naming**: `ComponentClass`, `PlainClass`, `RemoveClass`, `ReplaceClass`
- **Comprehensive Testing**: All tests passing with instanceof validation

### 🔄 Next Steps
- **StandardExit Integration**: Refactor StandardExit to use v2StandardEditableFactory
- **Component Migration**: Extend pattern to other components
- **API Design**: Design clean interfaces for each subtype

## Related Documentation

- **[StandardEditable v2 Architecture](../generics/editable/AGENT.md)**: Detailed planning, implementation status, benefits, and migration strategy for the v2 architecture
- **[StandardExit Implementation](./exit.ts)**: Current StandardExit implementation using standardEditableFactory
- **[Component Factory System](./component.ts)**: v2ComponentClassFactory implementation
