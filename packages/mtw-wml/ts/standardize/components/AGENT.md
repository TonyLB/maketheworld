# Standard Components - Agent Navigation Guide

## Overview

The `standardize/components` directory contains the core WML component classes that represent different types of content within the system. These components provide a structured way to represent and manipulate WML content with proper serialization, manipulation, and diffing capabilities.

## Core Purpose

- **Component Representation**: Define structured WML components with proper data types
- **Content Manipulation**: Provide methods for creating, modifying, and merging components
- **Serialization**: Handle conversion between runtime objects and storage formats
- **Diffing**: Support change detection and conflict resolution

## Technical Debt

### **CRITICAL: StandardImage Storage System Migration** 🔴

**Component**: `StandardImage`

**Problem**: `fileURL` property is brittle and complex to maintain. Images use UUID-based naming with separate `fileName` properties in asset JSON.

**Impact**: Image handling is fragile and requires complex coordination between components and asset storage.

**Proposed Solution**: Migrate to universalKey-based storage (`${universalKey}.png`) to eliminate separate properties and enable automatic cleanup.

**Related Documentation**: [`lambda/assets/AGENT.imageStorage.md`](../../../../lambda/assets/AGENT.imageStorage.md)

**Developer Note**: Current `fileURL` handling is temporary. Feel free to insert temporary stub implementations for images in order to progress on other functionality.

### **StandardAuthorizationCollection UUID/UniversalKey Migration & Architectural Simplification** ✅ **RESOLVED**

**Component**: `StandardAuthorizationCollection`

**Resolution Date**: October 28, 2025

**Changes Made**:
1. ✅ **UUID Support**: Added `universalKey: AssetUUID` to `StandardAuthorizationCollectionData` and all related typeguards
2. ✅ **Flat Structure**: Replaced `referenceStack: StandardReference[]` with single `component?: StandardReference` in `StandardAuthorizationResource`
3. ✅ **Global Grants**: Introduced `component: undefined` pattern for Asset-level grants (no component wrapper needed)
4. ✅ **Aligned with StandardForm**: Implemented `byId`, `byUniversalId`, and `_lookup()` methods matching StandardForm patterns
5. ✅ **Array-based processAuthorizations**: Changed from `Record<string, StandardAuthorizationResource>` to `StandardAuthorizationResource[]`, aligning with `processComponents` pattern
6. ✅ **Removed componentTemplates**: Simplified `processAuthorizations` to use `isSchemaComponent` directly (no redundant templates)
7. ✅ **Semantic equality**: Replaced `deepEqual` with `StandardReference.equal()` and `componentEqual()` helper throughout
8. ✅ **Simplified sorting**: Removed complex sort order factory, now uses `standardComponentSortOrder` with `.plain()` directly
9. ✅ **Updated all tests**: 59 authorization tests + 14 lambda integration tests passing

**Architectural Decisions**:
- **Flat schema output only**: Removed `nestedSchema()` method. Authorization WML outputs flat `<Component><Grant /></Component>` structure
- **Deferred nesting**: Hierarchical authorization reconstruction deferred until `<Parent>` tag implementation provides explicit parent control
- **Optional `key` field**: Maintained in `toJSON()` for backward compatibility with existing serialized data

**Result**: Authorization system now has full UUID support with dramatically simplified architecture. Flat structure eliminates complex ancestry tracking, semantic equality replaces string-keyed lookups, and all patterns align with StandardForm conventions. System is ready for future `<Parent>` tag integration.

**Related Files**: 
- `packages/mtw-wml/ts/standardize/authorization/index.ts`
- `packages/mtw-wml/ts/standardize/authorization/resource.ts`
- `packages/mtw-wml/ts/standardize/authorization/processAuthorizations.ts`
- `packages/mtw-wml/ts/standardize/authorization/components/dataTypes/index.ts`
- `lambda/wml/s3Storage/AssetWorkspace.test.ts`
- All authorization test files updated



## Core Concepts

### Component Architecture

Each component follows a consistent pattern:
- **Payload Class**: Handles data storage and manipulation logic
- **Component Class**: Provides the public API and inheritance structure
- **Data Types**: Define serialization formats for storage

### StandardKey vs. StandardReference: Semantic Separation

**CRITICAL ARCHITECTURAL PATTERN**: `StandardKey` and `StandardReference` serve fundamentally different roles and must be used appropriately:

#### **StandardKey: Minimal Identifier**

- **Purpose**: Represents the minimal information needed to identify a component
- **Properties**: Only `key` and/or `universalKey` (no tag stored)
- **Tag Derivation**: Tag can be derived from `universalKey` (e.g., `FEATURE#uuid` → `Feature`), but may be `undefined` if only `key` is present
- **Use Cases**:
  - Internal component identification (`StandardComponent._key`)
  - Lookup keys in maps and collections
  - Minimal references when full context is available
- **Limitations**: Cannot generate schema independently if tag cannot be derived

#### **StandardReference: Standalone Reference Object**

- **Purpose**: Represents a complete, self-contained reference with full edit and render functionality
- **Properties**: Contains `StandardKey` as payload, plus stored `tag`
- **Tag Storage**: Tag is stored directly in `StandardReference`, making it self-contained
- **Use Cases**:
  - ReferenceList items (e.g., `features`, `examples`, `characters` in rooms)
  - Independent schema generation (can generate schema without lookup)
  - Standalone reference operations (like `StandardLiteral` or other standalone objects)
- **Construction Pattern**: 
  - When constructing from `StandardKey`: **Tag is required** - `new StandardReferenceSimple(key, tag)`
  - When constructing from other data: Tag is derived automatically from the data

#### **When to Use Which**

- **Use `StandardKey`** when:
  - You only need to identify something (e.g., `component._key`)
  - You have the full component context and can derive tag when needed
  - You're storing minimal identifiers in collections

- **Use `StandardReference`** when:
  - You need a reference that can operate independently
  - The reference appears in ReferenceList items
  - You need to generate schema without a lookup function
  - You're passing references between contexts where tag context may be lost

#### **Example**

```typescript
// StandardKey: Minimal identifier (tag derived from universalKey)
const key = new StandardKey('FEATURE#my-feature')
key.tag  // 'Feature' (derived)
key.schema  // Works if universalKey present, throws if only key

// StandardReference: Self-contained reference (tag stored)
const ref = new StandardReferenceSimple(key, 'Feature')  // Tag required when constructing from StandardKey
ref.tag  // 'Feature' (stored)
ref.schema  // Always works independently

// StandardReference from data: Tag derived automatically
const refFromData = new StandardReference('FEATURE#my-feature')
refFromData.tag  // 'Feature' (derived and stored)
```

This semantic separation ensures that references can be passed between contexts without losing the information needed to render or manipulate them, while keys remain minimal identifiers optimized for lookup and storage.

### Serialization vs. Manipulation Types

**CRITICAL ARCHITECTURAL DISTINCTION**: There are two types of data structures:

1. **Serialization Types** (for storage/serialization):
   - `RenderTree` arrays
   - `StandardCharacterData` objects
   - Used at API boundaries and for persistence

2. **Manipulation Types** (for runtime operations):
   - `StandardRender` objects
   - `StandardCharacter` instances
   - Used for active content manipulation

**Conversion happens at API boundaries** - components should expose manipulation types in their public API, while using serialization types internally for storage.

See `dataTypes/AGENT.md` for detailed documentation of this distinction.

## Component Types

### **StandardExample** ✅
- **Purpose**: Represents examples with name, summary, and description
- **Content Properties**: `name`, `summary`, `description` (all `StandardRender`)
- **Status**: ✅ Technical debt resolved

### **StandardCharacter** ✅
- **Purpose**: Represents characters with name, shortName, pronouns, and image
- **Content Properties**: `name` (now `StandardRender`), `image` (remains `EditWrappedStandardNode`)
- **Status**: ✅ Technical debt resolved

### **StandardExit**
- **Purpose**: Represents exits between rooms
- **Content Properties**: `description` (uses `StandardRender`)

### **StandardImage** 🔴
- **Purpose**: Represents images with fileURL
- **Content Properties**: `fileURL` (string)
- **Status**: 🔴 Has critical technical debt (see Technical Debt section)

### **StandardFeature**
- **Purpose**: Represents features with name and description
- **Content Properties**: `name`, `description` (both `StandardRender`)

### **StandardAction**
- **Purpose**: Represents actions with name and description
- **Content Properties**: `name`, `description` (both `StandardRender`)

### **StandardKnowledge**
- **Purpose**: Represents knowledge with name and description
- **Content Properties**: `name`, `description` (both `StandardRender`)

### **StandardRoom** 🟢
- **Purpose**: Represents rooms with name, description, exits, features, and characters
- **Content Properties**: `name`, `description` (both `StandardRender`)
- **Reference Properties**: `features`, `examples`, `characters` (all `ReferenceList`)



## Usage Patterns

### Creating Components
```typescript
// From WML string
const example = new StandardExample(`
    <Example key=(my-example)>
        <Name>Example Name</Name>
        <Summary>Example Summary</Summary>
        <Description>Example Description</Description>
    </Example>
`)

// From JSON data
const example = new StandardExample({
    tag: 'Example',
    key: 'my-example',
    name: ['Example Name'],
    summary: ['Example Summary'],
    description: ['Example Description']
})
```

### Accessing Content Properties
```typescript
// StandardExample (✅ Fixed)
const name = example.name.plainString
const summary = example.summary.plainString
const description = example.description.plainString

// StandardCharacter (✅ Fixed)
const name = character.name.plainString  // Now works - returns StandardRender
const image = character.image?.data?.fileURL || ''  // Now works - handles EditWrappedStandardNode
```

### Character Reference Patterns
```typescript
// Creating a room with character references
const roomData: StandardRoomData = {
    tag: 'Room',
    universalKey: 'ROOM#tavern',
    characters: ['CHARACTER#innkeeper', 'CHARACTER#bard'],
    exits: [],
    examples: ['EXAMPLE#tavernDescription']
}
const room = new StandardRoom(roomData)

// Accessing characters in a room
const characterRefs = room.characters.payload
characterRefs.forEach(ref => {
    console.log(`Character: ${ref.universalKey}`)
})

// In Lambda: Creating character components for StandardForm
const characterComponents: StandardCharacterData[] = roomCharacterList.map(char => ({
    tag: 'Character',
    universalKey: char.EphemeraId,  // No local key needed!
    name: char.Name ? [char.Name] : undefined
}))

// Client: Accessing characters in RoomDescription
characters.forEach(character => {
    const name = character.name?.plainString || 'Unknown Character'
    const characterId = character.universalKey || character.key
})
```

### Serialization

#### Omission-Over-Empty Principle

All StandardComponent `toJSON()` implementations follow the **omission-over-empty** principle:

- **Empty fields are omitted** from JSON output rather than included with empty values (including empty arrays)
- **Non-empty fields are always included** with their actual values
- **Required identifiers** (tag, key, universalKey) are always present

**Examples:**
```typescript
// Room with no exits - exits field is omitted
const emptyRoom = new StandardRoom({ tag: 'Room', key: 'room1' })
emptyRoom.toJSON() // { tag: 'Room', key: 'room1' } - no exits field

// Room with exits - exits field is included
const roomWithExits = new StandardRoom({ 
    tag: 'Room', 
    key: 'room2', 
    exits: [/* exit data */] 
})
roomWithExits.toJSON() // { tag: 'Room', key: 'room2', exits: [...] }
```

#### Basic Serialization
```typescript
// To JSON for storage
const json = example.toJSON()

// From JSON for loading
const example = new StandardExample(json)
```

## Testing

### Running Tests
```bash
# From packages/mtw-wml directory
npm run test -- --watchAll=false ts/standardize/components/example.test.ts
npm run test -- --watchAll=false ts/standardize/components/character.test.ts
```

### Test Patterns
- Use WML strings for component construction in tests for readability
- Use JSON objects for tests specifically targeting JSON structure
- Mock Redux actions to return proper action objects
- Use `@testing-library/jest-dom` for DOM assertions

## Related Documentation

- `dataTypes/AGENT.md` - Serialization vs. Manipulation Types architecture
- `render/AGENT.md` - StandardRender system documentation
- `../AGENT.md` - Parent directory overview 