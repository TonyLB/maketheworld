# Standard Components - Implementation Details

## Overview

This document covers implementation details, architectural patterns, and component type specifications for the `standardize/components` directory. For conceptual overview and future requirements, see [`AGENT.md`](./AGENT.md). For practical usage examples, see [`AGENT.usage.md`](./AGENT.usage.md).

## Technical Debt

### **CRITICAL: StandardImage Storage System Migration** 🔴

**Component**: `StandardImage`

**Problem**: `fileURL` property is brittle and complex to maintain. Images use UUID-based naming with separate `fileName` properties in asset JSON.

**Impact**: Image handling is fragile and requires complex coordination between components and asset storage.

**Proposed Solution**: Migrate to universalKey-based storage (`${universalKey}.png`) to eliminate separate properties and enable automatic cleanup.

**Related Documentation**: [`lambda/assets/AGENT.imageStorage.md`](../../../../lambda/assets/AGENT.imageStorage.md)

**Developer Note**: Current `fileURL` handling is temporary. Feel free to insert temporary stub implementations for images in order to progress on other functionality.

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
- **Status**: 🔴 Has critical technical debt (see Technical Debt section below)

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

## Architectural Patterns

### Component Architecture

Each component follows a consistent pattern:
- **Payload Class**: Handles data storage and manipulation logic
- **Component Class**: Provides the public API and inheritance structure
- **Data Types**: Define serialization formats for storage

### Omission-Over-Empty Principle

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

This principle ensures that:
- JSON output is compact and contains only meaningful data
- Empty arrays/objects don't clutter serialized data
- Required identifiers are always present for component identification
- Storage and transmission formats remain efficient

### assureReferences Method

The `assureReferences` method is the single point where `ref={0}` references are introduced in the component system. It ensures that child components that should be displayed in a parent context are present in the appropriate reference buckets.

#### Purpose

- **Single source of `ref={0}`**: This is the ONLY place where `ref={0}` references should be introduced (though they can be deserialized from WML format)
- **Component-specific dispatch**: Each component type handles its own bucket structure (e.g., Room dispatches to features/examples/characters based on component tag)
- **Hierarchy assurance**: Ensures that components with implicit or explicit parentage appear in their parent's reference lists when rendering

#### Method Signature

- **Payload interface** (`ComponentConstructorMethods`): `assureReferences?(children: StandardReference[]): this` (optional)
- **Component interface** (`StandardComponent`): `assureReferences(children: StandardReference[]): StandardComponent` (required)

#### Behavior

- **Pure function**: Returns a cloned component/payload, does not mutate the original
- **Idempotency**: Calling `assureReferences` multiple times with the same children should produce equivalent results
- **Delegation pattern**: Component wrapper delegates to payload's `assureReferences` if available, otherwise returns instance unchanged
- **Reference handling**:
  - Uses `StandardReference.sameKey()` to check if a reference already exists in a bucket
  - If reference exists with non-zero ref, leaves it unchanged
  - If reference doesn't exist, adds it with `ref={0}` (using `StandardReference.withRef(0)` or equivalent)

#### Component-Specific Dispatch

Each component type implements its own dispatch logic:
- **StandardRoom**: Dispatches to `features`, `examples`, `characters` based on the reference's `tag` property
- Other components will have their own bucket structures (to be implemented in Phase 4.3)

#### Relationship to Other Operations

- **Non-zero refs elsewhere**: All other reference manipulation (merge, diff, withChild, etc.) should use non-zero refs
- **Used by nestedSchema**: Will be called on-demand in `nestedSchema` (Phase 4.4) to ensure references are present when rendering in parent context
- **Hierarchy integration**: Works with `SchemaOrganization` to determine which children should be assured based on implicit/explicit parentage

#### Implementation Pattern

The method follows the same delegation pattern as `invert()`:
1. Component wrapper clones itself
2. Checks if payload has `assureReferences` method
3. If yes, calls it and updates the payload
4. Returns the cloned component

This allows gradual rollout: components without payload implementation return unchanged.

### Reference Mapping Pattern

The component system maintains a clear architectural boundary between the component wrapper and payload implementation regarding reference mappings:

#### Component Wrapper State

- **`_mapping` property**: The component wrapper (`GeneratedComponentClass`) stores reference mappings in a private `_mapping?: StandardReference[]` property
- **Set via `withMapping()`**: Mappings are established when components are prepared for operations that require reference resolution (e.g., schema generation, remapping)
- **Component-level access**: Methods on the component wrapper can access `this._mapping` directly

#### Payload Method Parameters

- **No direct state access**: Payload methods (`ComponentConstructorMethods` implementations) do NOT access component wrapper state directly
- **Mappings passed as parameters**: Payload methods that require mappings accept them as optional parameters:
  - `schema(key?: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag>`
  - `nestedSchema(lookup, options: NestedSchemaOptions)` where `NestedSchemaOptions` includes `mappings?: StandardReference[]`
- **Explicit dependency**: This makes the dependency on mappings explicit and testable

#### Component Wrapper Delegation

The component wrapper passes mappings to payload methods:

```typescript
// Component wrapper schema getter
get schema(): GenericTreeNode<SchemaTag> {
    const payload = this._payload.schema(this.key, this.universalKey, this._mapping)
    // ...
}

// Component wrapper nestedSchema method
nestedSchema(lookup, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
    const payload = target._payload.nestedSchema
        ? target._payload.nestedSchema(lookup, { ...options, mappings: target._mapping })
        : target._payload.schema(target.key, target.universalKey, target._mapping)
    // ...
}
```

#### Benefits

- **Clear separation of concerns**: Payload implementations remain pure and don't depend on component wrapper state
- **Testability**: Payload methods can be tested independently by passing mappings directly
- **Flexibility**: Different mapping strategies can be applied without modifying payload implementations
- **Explicit dependencies**: The need for mappings is clear from method signatures

#### Usage Examples

**Schema generation with mappings:**
```typescript
// Component wrapper automatically passes _mapping to payload
const component = someComponent.withMapping(mappings)
const schema = component.schema  // Uses this._mapping internally

// Payload method receives mappings as parameter
schema(key: string, universalKey?: ComponentUUID, mappings?: StandardReference[]): GenericTreeNode<SchemaTag> {
    // Use mappings to remap Links in StandardRender to 'key' format
    rebuildSchemaFromStandardRender(this._name, { tag: 'Name' }, mappings)
}
```

**Nested schema with mappings:**
```typescript
// Component wrapper passes mappings through options
nestedSchema(lookup, { ...options, mappings: target._mapping })

// Payload receives mappings in options
nestedSchema(lookup, options: NestedSchemaOptions): GenericTreeNode<SchemaTag> {
    const { mappings } = options
    // Use mappings for reference formatting
}
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

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`dataTypes/AGENT.md`](./dataTypes/AGENT.md) - Serialization vs. Manipulation Types architecture
- [`render/AGENT.md`](../render/AGENT.md) - StandardRender system documentation
- [`../AGENT.md`](../AGENT.md) - Parent directory overview

