# Standard Components - Agent Navigation Guide

## Overview

The `standardize/components` directory contains the core classes that represent standardized WML components. Each component type has its own class that implements the `StandardComponent` interface, providing a consistent API for manipulating WML data structures.

## Core Purpose

- **Component Standardization**: Provides consistent interfaces for all WML component types
- **Data Manipulation**: Enables merge, diff, and transformation operations on components
- **Type Safety**: Ensures type-safe component creation and manipulation
- **Factory Pattern**: Uses component factory for consistent component generation

## StandardComponent Interface

All component classes implement the `StandardComponent` interface, which provides these key properties and methods:

### Core Properties
- **`_key`**: `StandardKey` - The component's identifier (local key and/or universal key)
- **`tag`**: `ComponentTag | 'Remove' | 'Replace'` - The component type
- **`schema`**: `GenericTreeNode<SchemaTag>` - The WML schema representation

### Key Methods
- **`clone()`**: Creates a deep copy of the component
- **`equals(incoming)`**: Compares two components for equality
- **`merge(incoming)`**: Combines two components (returns `undefined` if the comination removes the original)
- **`diff(incoming)`**: Creates a component representing the edit operation that would transform one component into the other
- **`toJSON(options?)`**: Serializes to JSON format
- **`referencedKeys()`**: Returns all keys referenced by this component
- **`mapContents(callback)`**: Transforms the component's content
- **`remapReferences(mapTo)`**: Updates references to other components

### Constructor Methods
- **`withKey(key)`**: Creates a copy with a new local key
- **`withUniversalKey(key)`**: Creates a copy with a new universal key
- **`withMapping(mapping)`**: Creates a copy with reference mapping
- **`withImport(fromAsset)`**: Creates a copy imported from another asset

## Usage Patterns

### Constructor Overloads

Each `StandardComponent` class supports multiple constructor patterns:

```typescript
// 1. String constructor (creates component with key)
const room = new StandardRoom("mainHall")

// 2. UUID constructor
const room = new StandardRoom("ROOM#mainHall-uuid")

// 3. JSON data constructor
const room = new StandardRoom({
    tag: 'Room',
    key: 'mainHall',
    exits: [{ to: 'kitchen', description: 'kitchen' }]
})

// 4. WML data constructor
const room = new StandardRoom(`
    <Room key=(mainHall)><Exit to=(kitchen)>kitchen</Exit></Room>
`)

// 5. Schema node constructor
const room = new StandardRoom(schemaNode)

// 6. Copy constructor
const roomCopy = new StandardRoom(existingRoom)

```

### Component Factory Pattern

Components are created using the `componentClassFactory` function, which generates a class with:
- Standard `StandardComponent` interface implementation
- Type-safe constructor overloads
- Automatic payload management
- Consistent API across all component types

#### **GeneratedComponentClass and Override Pattern**

**⚠️ CRITICAL**: The `componentClassFactory` creates a `GeneratedComponentClass` that provides the base functionality. When specific component classes (like `StandardExample`, `StandardRoom`) extend this generated class, they inherit methods that return `GeneratedComponentClass` instances instead of the specific subclass instances.

**The Problem**: If `StandardExample` simply inherited methods like `merge`, `clone`, etc., from `GeneratedComponentClass`, then:
```typescript
const example1 = new StandardExample(data1)
const example2 = new StandardExample(data2)
const merged = example1.merge(example2)  // Returns GeneratedComponentClass, not StandardExample!
```

**The Solution**: Each specific component class must override these methods to ensure they return instances of the correct class:

```typescript
export class StandardExample extends componentClassFactory(StandardExamplePayload, 'StandardExample') {
    // ... other methods ...
    
    override clone(): StandardExample {
        const returnValue = new StandardExample(this)
        returnValue._payload = new StandardExamplePayload(this._payload)
        return returnValue
    }

    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardExample(super.merge(incoming) as StandardExample)
    }

    override withKey(key: string): StandardComponent {
        return new StandardExample(super.withKey(key) as StandardExample)
    }

    // ... other override methods ...
}
```

**Why This Matters**: 
- `instanceof StandardExample` checks will fail if methods return `GeneratedComponentClass` instances
- The `_lookup` method in `StandardForm` relies on correct class types for proper component retrieval
- Client code expects specific component types, not generic `GeneratedComponentClass` instances

**Required Override Methods**: All specific component classes must override:
- `clone()`
- `merge()`
- `diff()`
- `withKey()`
- `withUniversalKey()`
- `withFileName()`
- `withMapping()`
- `withImport()`
- `withLeastCommonContext()`
- `withChild()`
- `equals()` (for custom equality logic)

## Component Types

### Core Components

#### **StandardRoom** (`room.ts`)
Represents physical locations in the world.
- **Properties**: `shortName`, `exits`, `features`, `examples`

#### **StandardFeature** (`feature.ts`)
Represents interactive elements within rooms.
- **Properties**: `examples` (list of Example references)
- **⚠️ CRITICAL**: Features do NOT contain `name` or `description` directly - these are stored in referenced `StandardExample` components
- **⚠️ IMPORTANT**: To get display content, access the `examples` property and look up the referenced Example components

#### **StandardCharacter** (`character.ts`)
Represents player characters and NPCs.
- **Properties**: `name`, `description`, `location`

#### **StandardExample** (`example.ts`)
Represents different states/versions of content.
- **Properties**: `name`, `summary`, `description`
- **⚠️ CRITICAL**: This component contains the actual display content (`name`, `summary`, `description` as `StandardRender` objects)
- **⚠️ IMPORTANT**: Other components (Feature, Knowledge, Room) reference Examples via their `examples` property - they do NOT contain display content directly
- **⚠️ TECHNICAL DEBT**: The `name`, `summary`, and `description` properties currently return `RenderTree` (array) instead of `StandardRender` objects. This should be refactored to return `StandardRender` for consistency with the rest of the system.

#### **StandardMessage** (`message.ts`)
Represents in-game messages and communications.
- **Properties**: `content`, `recipients`, `conditions`

#### **StandardKnowledge** (`knowledge.ts`)
Represents information that characters can learn.
- **Properties**: `examples` (list of Example references)
- **⚠️ CRITICAL**: Knowledge components do NOT contain `title` or `content` directly - these are stored in referenced `StandardExample` components
- **⚠️ IMPORTANT**: To get display content, access the `examples` property and look up the referenced Example components

#### **StandardMoment** (`moment.ts`)
Represents time-based events and conditions.
- **Properties**: `conditions`, `effects`, `duration`

#### **StandardMap** (`map.ts`)
Represents spatial layouts and positioning.
- **Properties**: `image`, `rooms`, `positions`

#### **StandardAction** (`action.ts`)
Represents executable game actions.
- **Properties**: `name`, `effects`, `requirements`

#### **StandardVariable** (`variable.ts`)
Represents state-tracking elements.
- **Properties**: `name`, `value`, `type`

#### **StandardComputed** (`computed.ts`)
Represents derived values and calculations.
- **Properties**: `expression`, `dependencies`, `result`

### Specialized Sub-Components

#### **StandardExit** (`exit.ts`)
Represents connections between rooms. Is not a stand-alone component, but rather a piece
of data stored within the `StandardRoom` component
- **Properties**: `to`, `description`

#### **StandardPosition** (`position.ts`)
Represents spatial coordinates within a room. Is not a stand-alone component, but rather a piece
of data stored within the `StandardMap` component.
- **Properties**: `room`, `x`, `y`

### Edit Components

#### **StandardRemove** (`edits.ts`)
Represents content to be removed.
- **Properties**: `_match` (component to remove)

#### **StandardReplace** (`edits.ts`)
Represents content to be replaced.
- **Properties**: `_match` (original), `_payload` (replacement)

## ⚠️ CRITICAL: Example-Component Relationship

### **Content Storage Pattern**

**⚠️ IMPORTANT**: Display content (`name`, `summary`, `description`) is NOT stored directly in Feature, Knowledge, or Room components. Instead:

1. **`StandardExample` components** contain the actual display content as `StandardRender` objects
2. **Other components** (Feature, Knowledge, Room) have an `examples` property that contains references to Example components
3. **To get display content**, you must:
   - Access the main component's `examples` property
   - Look up the referenced `StandardExample` components
   - Extract `name`, `summary`, or `description` from the Example components

### **Common Mistake to Avoid**

❌ **Incorrect**: Assuming Feature/Knowledge components have `name` and `description` properties directly
```typescript
// WRONG - this won't work
const feature = parsedWML.byUniversalId[componentUUID]
const name = feature.name        // ❌ Property doesn't exist
const description = feature.description  // ❌ Property doesn't exist
```

✅ **Correct**: Access content through referenced Example components
```typescript
// RIGHT - access through examples
const feature = parsedWML.byUniversalId[componentUUID]
const firstExample = feature.examples?.[0]
if (firstExample) {
    const exampleComponent = parsedWML.byUniversalId[firstExample]
    const name = exampleComponent.name        // ✅ From Example component
    const description = exampleComponent.description  // ✅ From Example component
}
```

### **Why This Pattern?**

This separation allows:
- **Multiple states**: Different examples for different conditions
- **Conditional content**: Content that changes based on game state
- **Reusable content**: Same example can be referenced by multiple components
- **Flexible rendering**: Different display formats for different contexts

## Merge Operations

### Merge Logic

The `merge()` method combines two components following these rules:

1. **Compatible Components**: Same type components merge their properties
2. **Edit Components**: `StandardRemove` and `StandardReplace` have special merge logic
3. **Conflict Detection**: Incompatible changes throw `MergeConflictError`
4. **Additive Merging**: Properties from both components are combined

### Merge Examples

```typescript
// Merge two rooms
const base = new StandardRoom(`
    <Room key=(mainHall)>
        <ShortName>Main Hall</ShortName>
        <Exit to=(kitchen)>kitchen</Exit>
    </Room>
`)

const incoming = new StandardRoom(`
    <Room key=(mainHall)>
        <Feature key=(tapestry) />
        <Exit to=(gatehouse)>gatehouse</Exit>
    </Room>
`)

const merged = base.merge(incoming)
// Result: Room with this schema:
//
//    <Room key=(mainHall)>
//        <ShortName>Main Hall</ShortName>
//        <Feature key=(tapestry) />
//        <Exit to=(gatehouse)>gatehouse</Exit>
//        <Exit to=(kitchen)>kitchen</Exit>
//    </Room>


```

## Diff Operations

### Diff Logic

The `diff()` method creates a component representing the difference between two components:

1. **Property Differences**: Only changed properties are included
2. **Edit Generation**: Differences are expressed as edit components
3. **Minimal Representation**: Only the necessary changes are captured
4. **Reversible**: The diff can be applied to recreate the target

### Diff Examples

```typescript
// Create diff between two rooms
const base = new StandardRoom(`
    <Room key=(mainHall)>
        <ShortName>Main Hall</ShortName>
        <Exit to=(kitchen)>kitchen</Exit>
    </Room>
`)

const incoming = new StandardRoom(`
    <Room key=(mainHall)>
        <ShortName>Main Hall</ShortName>
        <Feature key=(tapestry) />
        <Exit to=(gatehouse)>gatehouse</Exit>
        <Exit to=(kitchen)>kitchen</Exit>
    </Room>
`)

const merged = base.merge(incoming)
// Result: Room with this schema:
//
//    <Room key=(mainHall)>
//        <Feature key=(tapestry) />
//        <Exit to=(gatehouse)>gatehouse</Exit>
//    </Room>

```

## Integration Points

- **Schema System**: Components convert to/from WML schema format
- **Edit System**: Components support edit tag processing
- **Reference System**: Components manage references to other components
- **Standardization**: Components are used in the standardization pipeline
- **WML Language**: See [`../AGENT.md`](../AGENT.md) for WML format details
- **Rich Text Processing**: See [`../render/AGENT.md`](../render/AGENT.md) for content handling

## Navigation Tips

1. **Start with Base Classes**: Understand `baseClasses.ts` and `component.ts`
2. **Check Constructor Patterns**: Each component supports multiple construction methods
3. **Review Merge Logic**: Understand how components combine and conflict
4. **Test Diff Operations**: Verify that diffs can recreate target states
5. **Use TypeScript**: All components are strongly typed for safety

## Development Notes

### Current State
- **Core Components**: All major component types implemented
- **Factory Pattern**: Component factory provides consistent API
- **Merge/Diff**: Full support for component operations
- **Type Safety**: Strong TypeScript typing throughout

### Future Plans
- **Performance**: Optimize merge operations for large components
- **Validation**: Enhanced component validation
- **Extensions**: Support for additional component types
- **StandardRender Consistency**: Refactor `StandardExample` properties (`name`, `summary`, `description`) to return `StandardRender` objects instead of `RenderTree` arrays for consistency with the rest of the system

### Technical Debt
- **Error Handling**: Improve error messages for merge conflicts
- **Documentation**: Add more examples for complex component operations
- **Testing**: Expand test coverage for edge cases
- **StandardExample Properties**: The `name`, `summary`, and `description` properties in `StandardExample` return `RenderTree` (array) instead of `StandardRender` objects, creating inconsistency with the rest of the system
- **StandardRender Constructor**: Must use arrays (`['text']`) not strings (`'text'`) for initialization - this is a common source of runtime errors
- **Missing Override Methods**: Several `StandardComponent` classes are missing required override methods to ensure correct class type preservation:
  - **Missing `withLeastCommonContext` and `withChild` overrides**: `StandardRoom`, `StandardFeature`, `StandardKnowledge`, `StandardCharacter`, `StandardMessage`, `StandardMoment`, `StandardMap`, `StandardAction`, `StandardVariable`, `StandardComputed`, `StandardImage`
  - **Missing `equals` override**: `StandardCharacter`, `StandardMap`, `StandardVariable`, `StandardImage`
  - **Missing `diff` override**: `StandardAction`, `StandardVariable`, `StandardComputed`, `StandardImage`
  - **Note**: `StandardExample` has all required overrides and serves as the reference implementation 