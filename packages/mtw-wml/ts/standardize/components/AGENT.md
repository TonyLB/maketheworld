# Standard Components - Agent Navigation Guide

## Overview

The `standardize/components` directory contains the core classes that represent standardized WML components. Each component type has its own class that implements the `StandardComponent` interface, providing a consistent API for manipulating WML data structures.

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

However, it is important to note that the generated class returned by methods in `componentClassFactory` is
**not** the same class as any class that extends `componentClassFactory`. Therefore, any extending class
needs to override functions like `merge` in order to assure that `instanceof` checks will work for all
components generated. See example:

```typescript
// Example: StandardRoom merge override
export class StandardRoom extends componentClassFactory(StandardRoomPayload, 'StandardRoom') {
    // ... other methods ...
    
    override merge(incoming: StandardComponent): StandardComponent {
        return new StandardRoom(super.merge(incoming) as StandardRoom)
    }
}
```

This pattern ensures that `instanceof StandardRoom` checks work correctly by returning a new `StandardRoom` instance
rather than the generic factory-generated class.

## Component Types

### Core Components

#### **StandardRoom** (`room.ts`)
Represents physical locations in the world.
- **Properties**: `shortName`, `exits`, `features`, `examples`

#### **StandardFeature** (`feature.ts`)
Represents interactive elements within rooms.
- **Properties**: `name`, `description`, `actions`

#### **StandardCharacter** (`character.ts`)
Represents player characters and NPCs.
- **Properties**: `name`, `description`, `location`

#### **StandardExample** (`example.ts`)
Represents different states/versions of content.
- **Properties**: `name`, `description`, `conditions`

#### **StandardMessage** (`message.ts`)
Represents in-game messages and communications.
- **Properties**: `content`, `recipients`, `conditions`

#### **StandardKnowledge** (`knowledge.ts`)
Represents information that characters can learn.
- **Properties**: `title`, `content`, `prerequisites`

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

## Navigation Tips

1. **Start with Base Classes**: Understand `baseClasses.ts` and `component.ts`
2. **Check Constructor Patterns**: Each component supports multiple construction methods
3. **Review Merge Logic**: Understand how components combine and conflict
4. **Test Diff Operations**: Verify that diffs can recreate target states
5. **Use TypeScript**: All components are strongly typed for safety

## Integration Points

- **Schema System**: Components convert to/from WML schema format
- **Edit System**: Components support edit tag processing
- **Reference System**: Components manage references to other components
- **Standardization**: Components are used in the standardization pipeline 