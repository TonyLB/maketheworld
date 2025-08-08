# Standard Components - Agent Navigation Guide

## Overview

The `standardize/components` directory contains the core WML component classes that represent different types of content within the system. These components provide a structured way to represent and manipulate WML content with proper serialization, manipulation, and diffing capabilities.

## Core Purpose

- **Component Representation**: Define structured WML components with proper data types
- **Content Manipulation**: Provide methods for creating, modifying, and merging components
- **Serialization**: Handle conversion between runtime objects and storage formats
- **Diffing**: Support change detection and conflict resolution

## Technical Debt

### **IN PROGRESS: StandardRoom Character Integration** 🟡
**Status**: Core character integration complete, advanced operations in progress.

**✅ Completed (Phases 1-3)**: 
- ✅ `StandardRoom` now stores character references (`_characters: ReferenceList`)
- ✅ Characters can be parsed as Room sub-components
- ✅ Room serialization/deserialization supports characters
- ✅ Room schema generation includes character references
- ✅ End-to-end WML ↔ JSON ↔ Schema conversion works

**🔄 In Progress (Phase 5+)**: 
- ✅ Advanced component operations (merge, diff, equal) - **COMPLETE**
- 🔄 Comprehensive unit test coverage
- 🔄 Client integration for UI display
- 🔄 Lambda integration for server-side functionality

**Benefits Achieved**: 
- ✅ Consistent room representation between legacy and Standard formats
- ✅ Foundation laid for character information in room descriptions
- ✅ Proper reference management and schema validation

## Project Plan: StandardRoom Character Integration

**🎯 Progress Summary:**
- ✅ **Phases 1-6 Complete**: Core functionality, advanced operations, comprehensive testing, and integration testing implemented
- ✅ **Schema Parsing**: Characters can be parsed as Room sub-components
- ✅ **Data Structures**: `_characters` property added with proper types
- ✅ **Core Methods**: `fromJSON`, `fromSchema`, `toJSON`, `schema`, `nestedSchema` methods support characters
- ✅ **Advanced Logic**: `merge`, `diff`, `equals`, `referencedKeys` methods handle character references
- ✅ **Unit Testing**: Comprehensive test coverage for all character functionality (23 tests passing)
- ✅ **End-to-End**: Room ↔ Character integration works with full round-trip conversion
- ✅ **UUID Fix**: Fixed StandardCharacter schema generation to include uuid attributes
- ✅ **Integration Testing**: Complete integration testing with diff system edge case documented
- 🔄 **Next**: Phase 7 (Client Integration) - update frontend to use StandardRoom character references

### **Phase 1: Schema and Parser Updates** ✅
- [x] Update WML schema parsing to allow Characters as legal sub-components of Room
- [x] Ensure Characters can be parsed within Room context
- [x] Add schema validation for Character references in Room components
- [x] Test schema parsing with Room containing Characters

### **Phase 2: Core Data Structure Updates** ✅
- [x] Add `_characters` property of type `ReferenceList` to `StandardRoomPayload`
- [x] Update `StandardRoomData` type to include `characters` property (similar to `features`)
- [x] Import necessary types (`ReferenceList`, character-related types)
- [x] Update type definitions for serialization

### **Phase 3: Core Implementation Methods** ✅
- [x] Update `fromJSON` method to handle `characters` property
- [x] Update `fromSchema` method to extract Character references from schema
- [x] Update `toJSON` method to serialize `_characters` to `characters` property
- [x] Update `schema` method to include Character references in output
- [x] Add `characters` getter to expose `ReferenceList`

### **Phase 4: Component Logic Updates** ✅
- [x] Update `merge` method to handle character reference merging
- [x] Update `diff` method to detect character reference changes
- [x] Update `equals` method to compare character references
- [x] Update `referencedKeys` to include character references
- [x] Update `withChild` method to support character references
- [x] Ensure proper handling of empty/undefined character lists

### **Phase 5: Unit Test Implementation** ✅
- [x] Create unit tests for `fromJSON` with characters property
- [x] Create unit tests for `fromSchema` with Character sub-components
- [x] Create unit tests for `toJSON` serialization including characters
- [x] Create unit tests for `schema` output including characters
- [x] Create unit tests for `merge` operations with character conflicts
- [x] Create unit tests for `diff` detection of character changes
- [x] Create unit tests for `equals` comparison with character differences
- [x] Create unit tests for `characters` getter functionality
- [x] Create unit tests for empty character lists handling
- [x] Create unit tests for nestedSchema behavior with character references

### **Phase 6: Integration Testing** ✅
- [x] Test StandardRoom with Characters in integration scenarios
- [x] Test WML parsing of Room components containing Characters
- [x] Test serialization round-trip (WML → StandardRoom → JSON → StandardRoom → WML)
- [x] Test diff scenarios with complex character reference changes
- [x] Document diff system edge case for reference changes in nested components

### **Phase 7: Client Integration** 🔄
- [ ] Update `RoomDescription` component to use `room.characters` when available
- [ ] Update UI logic to handle both legacy and Standard format character display
- [ ] Test frontend functionality with Standard format rooms containing characters
- [ ] Remove legacy character handling workarounds where possible

### **Phase 8: Lambda Integration** 🔄
- [ ] Update server-side room construction to include character references
- [ ] Update ephemera system to populate character references in StandardRoom
- [ ] Test Lambda functions that create/manipulate StandardRoom instances
- [ ] Ensure proper character reference synchronization

### **Phase 9: Documentation and Cleanup** 🔄
- [ ] Update StandardRoom documentation to reflect character integration
- [ ] Update usage examples to show character reference patterns
- [ ] Update related documentation (ephemera, UI components)
- [ ] Clean up temporary workarounds and debug code

### **RESOLVED: StandardCharacter Technical Debt** ✅
**Status**: COMPLETED - `StandardCharacter` component now uses `StandardRender` objects for the `name` property.

**Problem**: The `name` property was returning `EditWrappedStandardNode` objects, but client code expected `StandardRender` objects with `.plainString` property.

**Solution**: Updated `StandardCharacter` to use `StandardRender` objects for the `name` property, following the same pattern as `StandardExample`. The `image` property remains as `EditWrappedStandardNode` since it represents different data (file references rather than rich text content).

**Benefits**:
- ✅ Consistent API between `StandardExample` and `StandardCharacter`
- ✅ Client code can now access name content properly with `.plainString`
- ✅ Better type safety and runtime manipulation capabilities

### **RESOLVED: StandardExample Technical Debt** ✅
**Status**: COMPLETED - `StandardExample` component now uses `StandardRender` objects for content properties.

**Problem**: The `name`, `summary`, and `description` properties were returning `RenderTree` arrays instead of `StandardRender` objects.

**Solution**: Updated getters to return `StandardRender` objects directly, providing a more active and resilient API.

**Benefits**:
- ✅ Improved diff granularity - now detects specific field changes instead of replacing entire components
- ✅ More consistent API with other components
- ✅ Better type safety and runtime manipulation capabilities

## Core Concepts

### Component Architecture

Each component follows a consistent pattern:
- **Payload Class**: Handles data storage and manipulation logic
- **Component Class**: Provides the public API and inheritance structure
- **Data Types**: Define serialization formats for storage

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
- **Status**: 🔴 **CRITICAL: Image Storage System Migration Needed**

**Current Issues**: `fileURL` property is brittle and complex to maintain. Images use UUID-based naming with separate `fileName` properties in asset JSON.

**Future Plans**: Migrate to universalKey-based storage (`${universalKey}.png`) to eliminate separate properties and enable automatic cleanup.

**Related Documentation**:
- **[Image Storage System](../../../../lambda/assets/AGENT.imageStorage.md)**: Comprehensive overview of current system and migration plans

**Developer Note**: Current `fileURL` handling is temporary. Feel free to insert temporary stub implementations for images in order to progress on other functionality.

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
- **Current Status**: ✅ Core functionality and advanced operations complete (Phases 1-4)
- **Advanced Operations**: ✅ merge, diff, equals, referencedKeys, withChild, nestedSchema
- **Status**: 🟢 Core implementation complete, ready for testing and integration

## Project Plan: StandardCharacter Technical Debt Fix

### **Phase 1: Analysis and Planning** ✅
- [x] Document the technical debt issue
- [x] Identify all usages of `StandardCharacter` that need updates
- [x] Plan the refactoring approach

### **Phase 2: Core Implementation** ✅
- [x] Update `StandardCharacterPayload` to use `StandardRender` for `_name` (only)
- [x] Update `name` getter to return `StandardRender` object
- [x] Update `fromJSON` and `fromSchema` methods to create `StandardRender` for name
- [x] Update `toJSON` method to serialize `StandardRender` for name
- [x] Update `schema` method to rebuild from `StandardRender` for name
- [x] Keep `image` property as `EditWrappedStandardNode` (no changes needed)

### **Phase 3: Data Type Updates** ✅
- [x] **No changes needed** - Data types represent serialization format, not runtime format

### **Phase 4: Test Updates** ✅
- [x] Update `StandardCharacter` unit tests to expect `StandardRender` objects
- [x] Update integration tests that use `StandardCharacter`
- [x] Verify diffing works correctly with new API

### **Phase 5: Front-End Client Code Updates** 🔄
- [ ] Update `RoomCharacter` component to use `StandardRender` objects directly
- [ ] Update any other client code that accesses `StandardCharacter` properties
- [ ] Test front-end functionality

### **Phase 6: Ephemera Lambda Updates** 🔄
- [ ] Update any server-side code that creates or manipulates `StandardCharacter` instances
- [ ] Update perception subsystem if it uses `StandardCharacter` properties

### **Phase 7: Integration Updates** 🔄
- [ ] Update factory functions that create `StandardCharacter` instances
- [ ] Update any other integration points

### **Phase 8: Documentation Updates** 🔄
- [ ] Update component documentation to reflect new API
- [ ] Update usage examples

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

### Serialization
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