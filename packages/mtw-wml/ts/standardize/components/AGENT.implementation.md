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

## Architecture: Data-Centric Storage vs. Tree-Structure Serialization

### Separation of Concerns

**Status**: ✅ **COMPLETE** - Migration to separate data-centric storage from tree-structure serialization is complete.

The component system maintains a clear separation between:
- **Data-centric manipulation**: `StandardForm` stores components in a flat list and performs operations (merge, diff, subset) on this data-centric structure
- **Tree-structure serialization**: `SchemaOrganization` converts the flat component data into a hierarchical tree structure for WML/JSON serialization and human readability

### Key Architectural Principles

- **StandardForm operations are data-centric**: Merge, diff, and subset operations work on flat component lists without requiring tree structure
- **SchemaOrganization is for serialization**: Used primarily when converting `StandardForm` to schema (WML/JSON output) and for ordering NDJSON data to match tree ordering
- **On-demand tree conversion**: Tree structure is computed only when needed for serialization, not during manipulation operations
- **Explicit parent precedence**: When building tree structure, explicit parent relationships take precedence over implicit parentage

### Key Components

- **`SchemaOrganization`**: Converts flat component data into hierarchical tree structure for serialization
  - Calculates implicit parents for tree ordering
  - Provides `getImplicitParent()` and `getChildrenOfParent()` for tree construction
  - Used in `StandardForm.schema` getter and `toNDJSON()` for ordering
- **`OrganizationContext`**: Interface providing parentage queries for tree construction during schema generation
- **`assureReferences()`**: Component method that ensures child references are present in parent's reference lists when rendering in parent context (used during schema generation)
- **`isParentContext()`**: Helper method to determine if a component is rendering in its parent's context (used during schema generation)

### Migration Status

- ✅ `implicitParent` field removed from `StandardComponent` interface (no longer stored on components)
- ✅ `StandardForm` operations (merge, diff, subset) work on data-centric structure without tree dependencies
- ✅ `SchemaOrganization` used only for serialization (schema generation and NDJSON ordering)
- ✅ `assureReferences` implemented for all component types with reference lists (used during schema generation)
- ✅ `nestedSchema` uses `OrganizationContext` for on-demand reference assurance during tree construction
- ✅ Component storage uses plain components only (no `StandardRemove`/`StandardReplace` wrappers)
- ✅ Replace operations removed from component/reference level (expressed as Add+Remove pairs)

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

The `assureReferences` method is the single point where `ref={0}` references are introduced in the component system. It ensures that child components that should be displayed in a parent context are present in the appropriate reference buckets **during schema generation** (when converting data-centric structure to tree structure).

#### Purpose

- **Single source of `ref={0}`**: This is the ONLY place where `ref={0}` references should be introduced (though they can be deserialized from WML format)
- **Component-specific dispatch**: Each component type handles its own bucket structure (e.g., Room dispatches to features/examples/characters based on component tag)
- **Tree structure assurance**: Ensures that components with implicit or explicit parentage appear in their parent's reference lists when building the tree structure for serialization
- **Used during schema generation**: Called on-demand when `nestedSchema` is generating the hierarchical tree structure from the flat component data

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
- **StandardFeature**: Dispatches to `examples` based on the reference's `tag` property
- **StandardKnowledge**: Dispatches to `examples` based on the reference's `tag` property
- **StandardMoment**: Dispatches to `messages` based on the reference's `tag` property
- **StandardMessage**: Dispatches to `rooms` based on the reference's `tag` property
- All component types with reference lists now implement `assureReferences` (migration complete)

#### Relationship to Other Operations

- **Non-zero refs elsewhere**: All other reference manipulation (merge, diff, withChild, etc.) should use non-zero refs
- **Used by nestedSchema**: Called on-demand in `nestedSchema` via `OrganizationContext` to ensure references are present when building tree structure for serialization
- **Tree construction integration**: Works with `SchemaOrganization` (via `OrganizationContext`) to determine which children should be assured based on implicit/explicit parentage when converting flat data to tree structure
- **SchemaOrganization integration**: `StandardForm.schema` getter uses `SchemaOrganization.getChildrenOfParent()` to get asset-level children for tree construction and passes `OrganizationContext` to `nestedSchema` calls
- **Not used in data operations**: `assureReferences` is not called during merge, diff, or subset operations - those work on the data-centric structure directly

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

## Adding a New Component Type

This section provides a step-by-step guide for adding new component types to the WML system. This process establishes the necessary infrastructure so that new components can be parsed from WML, created programmatically, stored in `StandardForm`, and participate in merge/diff operations.

### Prerequisites

Before adding a new component type, you should understand:

- **Component Architecture Pattern**: Components use a payload/class separation pattern (see "Component Architecture" section above)
- **Data Types**: Components have data types defined in `dataTypes/` for serialization
- **Factory Pattern**: Components are created via `standardComponentFactory()` in `componentFactory.ts`
- **Reference System**: Components can reference other components via `ReferenceList` (see `StandardRoom` for examples)
- **Schema Integration**: Components must integrate with the WML schema parsing system

### Step-by-Step Checklist

#### Step 1: Schema Layer Support (`@tonylb/mtw-base` package)

**Location**: `packages/mtw-base/ts/schema/` (in the `@tonylb/mtw-base` package)

**Tasks**:
- Add schema type definition (e.g., `SchemaMarkTag`) to schema type definitions
- Add `isSchema{ComponentName}` type guard function (e.g., `isSchemaMark`)
- Add component tag to `SchemaComponent` union type
- Add component tag to `isSchemaComponentTag()` function
- Add component tag to `isSchemaComponent()` function
- Add component tag to `isSchemaTag()` function
- Ensure WML parser can parse the component tag from WML strings

**Example Pattern**: Look at how `isSchemaRoom`, `isSchemaFeature`, or `isSchemaKnowledge` are implemented in `@tonylb/mtw-base/ts/schema/components.ts`

**Note**: This step may require changes in the `@tonylb/mtw-base` package, which is a separate package. If you don't have access to modify that package, coordinate with the maintainer or document this as a prerequisite.

#### Step 2: Schema Converter Registration (`schema/converters/components.ts`)

**Location**: `packages/mtw-wml/ts/schema/converters/components.ts`

**Purpose**: Register the component tag in the WML schema converter system so that `<{ComponentName}>` tags can be parsed from WML strings. Without this step, parsing WML will fail with "Cannot read properties of undefined (reading 'initialize')" errors.

**Tasks**:
1. **Add prefix key to PrefixKey type** (if component uses typed UUIDs):
   - **Location**: `packages/mtw-utilities/ts/types.ts`
   - Add the component's prefix key (uppercase) to the `PrefixKey` type union
   - The prefix key should match the component's universal key prefix (e.g., `'MARK'` for Mark components)
   - Example:
     ```typescript
     type PrefixKey = 'ASSET' | 'CHARACTER' | 'ROOM' | 'EXAMPLE' | 'FEATURE' | 'KNOWLEDGE' | 'MAP' | 'MESSAGE' | 'MOMENT' | 'IMAGE' | 'CONNECTION' | 'SESSION' | 'MARK'
     ```
   - **Note**: This is required for `enforceTypedKey()` and `stripTypedKey()` functions to work correctly. Without this, TypeScript compilation will fail with errors like "Argument of type 'MARK' is not assignable to parameter of type 'PrefixKey'".

2. **Import schema types**:
   - Import `isSchema{ComponentName}` and `Schema{ComponentName}Tag` from `@tonylb/mtw-base/ts/schema/{location}` (e.g., `worldState.ts` for world-state components, `components.ts` for standard components)

3. **Add to componentTemplates**:
   - Add component entry to `componentTemplates` object with property validation template
   - Include standard component properties: `uuid`, `key`, `from`, `origin`, `ref`
   - Example:
     ```typescript
     Mark: {
         uuid: { type: ParsePropertyTypes.Key },
         key: { type: ParsePropertyTypes.Key },
         from: { type: ParsePropertyTypes.Asset },
         origin: { type: ParsePropertyTypes.AssetList },
         ref: { type: ParsePropertyTypes.Expression }
     }
     ```

4. **Add to componentConverters**:
   - Add `{ComponentName}` entry to `componentConverters` object
   - Implement `initialize` function that validates properties and returns `Schema{ComponentName}Tag`
   - Handle `uuid` with appropriate typed key enforcement (e.g., `enforceTypedKey('MARK')(uuid)`)
   - Handle `ref` with `validateExpressionAsNonNegativeInteger` if present
   - Example:
     ```typescript
     Mark: {
         initialize: ({ parseOpen }): SchemaMarkTag => {
             const { uuid, ref, ...rest } = validateProperties(componentTemplates.Mark)(parseOpen)
             const refValue = ref ? validateExpressionAsNonNegativeInteger(ref as string, 'ref', parseOpen.tag) : undefined
             return {
                 tag: 'Mark',
                 uuid: uuid ? enforceTypedKey('MARK')(uuid) : undefined,
                 ...(refValue !== undefined ? { ref: refValue } : {}),
                 ...rest
             }
         }
     }
     ```

4. **Add to componentPrintMap**:
   - Add `{ComponentName}` entry to `componentPrintMap` object
   - Implement print map function that renders the component tag with properties
   - Use `tagRender()` helper function
   - Strip typed key prefix from `uuid` using `stripTypedKey('{PREFIX}')`
   - Example:
     ```typescript
     Mark: ({ tag: { data: tag, children }, ...args }: PrintMapEntryArguments) => {
         if (!isSchemaMark(tag)) {
             return [{ printMode: PrintMode.naive, output: '' }]
         }
         return tagRender({
             ...args,
             tag: 'Mark',
             properties: [
                 { key: 'uuid', type: 'key', value: tag.uuid ? stripTypedKey('MARK')(tag.uuid) : '' },
                 ...(tag.key ? [{ key: 'key', type: 'key' as const, value: tag.key }] : []),
                 { key: 'from', type: 'key', value: tag.from ?? '' },
                 ...(tag.origin && tag.origin.length ? [{ key: 'origin', type: 'assetList' as const, value: tag.origin }] : []),
                 ...(tag.ref !== undefined ? [{ key: 'ref', type: 'expression' as const, value: String(tag.ref) }] : [])
             ],
             node: { data: tag, children }
         })
     }
     ```

**Reference Examples**: See how `Room`, `Feature`, `Knowledge`, or `Map` are registered in `components.ts` - follow the same pattern for property validation, typed key enforcement, and print map rendering.

**Common Pitfalls**:
- **Forgetting to add prefix key to PrefixKey type** - will cause TypeScript compilation errors when using `enforceTypedKey()` or `stripTypedKey()`
- Forgetting to import `isSchema{ComponentName}` and `Schema{ComponentName}Tag` - will cause TypeScript errors
- Using wrong typed key prefix (e.g., `'MARK'` not `'Mark'`) - must match the component's universal key prefix and be uppercase
- Missing property in `componentTemplates` - will cause validation errors during parsing
- Missing print map entry - component won't serialize correctly to WML

**Note**: The converter map is automatically exported and used by the schema parsing system. Once registered here, `<{ComponentName}>` tags in WML will be parsed correctly.

#### Step 3: Component Type System (`standardize/components/dataTypes/abstract.ts`)

**Location**: `packages/mtw-wml/ts/standardize/components/dataTypes/abstract.ts`

**Tasks**:
- Add component tag (e.g., `'Mark'`) to the `ComponentTag` type union
- Add case to `componentTagFromUpperCase()` function: `case 'MARK': return 'Mark'`

**Example**:
```typescript
export type ComponentTag = Exclude<SchemaWithKey["tag"], 'Asset' | 'Story'>
// ComponentTag will automatically include 'Mark' if it's in SchemaWithKey

export const componentTagFromUpperCase = (tag: Uppercase<ComponentTag>): ComponentTag => {
    switch (tag) {
        // ... existing cases ...
        case 'MARK': return 'Mark'
        default: throw new Error(`Unknown tag: ${tag}`)
    }
}
```

#### Step 4: Component Data Types (`standardize/components/dataTypes/`)

**Location**: Create `packages/mtw-wml/ts/standardize/components/dataTypes/{componentName}.ts` (e.g., `mark.ts`)

**Tasks**:
- Create `Standard{ComponentName}Data` type extending `StandardBaseData`
  - Must include `tag: '{ComponentName}'` literal type
  - Include all component-specific properties
  - Use appropriate types (`StandardEditableData<string>`, `StandardRender`, `ReferenceListData`, etc.)
- Create `isStandard{ComponentName}Data` type guard function
  - Use `checkAll()` and `checkTypes()` helpers (see `knowledge.ts` for pattern)
  - Validate required and optional fields
- Export from `dataTypes/index.ts`:
  - Export the data type and type guard
  - Add to `StandardComponentNonEditData` union type
  - Add to `isStandardComponentData()` type guard function

**Example** (from `knowledge.ts`):
```typescript
export type StandardKnowledgeData = {
    tag: 'Knowledge';
    shortName?: StandardEditableData<string>;
    examples?: ReferenceListData;
} & StandardBaseData

export const isStandardKnowledgeData = (arg: any): arg is StandardKnowledgeData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Knowledge'),
        checkTypes(arg, {}, { 
            key: 'key', 
            universalKey: 'string',
            shortName: 'literal'
        })
    )
}
```

**Reference Examples**:
- **Simple component**: `knowledge.ts`, `feature.ts` - Basic properties with optional references
- **Component with references**: `room.ts` - Multiple `ReferenceList` properties
- **Component with complex properties**: `example.ts`, `character.ts` - Uses `StandardRender`, `EditWrappedStandardNode`, etc.

#### Step 5: Component Implementation (`standardize/components/`)

**Location**: Create `packages/mtw-wml/ts/standardize/components/{componentName}.ts` (e.g., `mark.ts`)

**Tasks**:

1. **Create Payload Class** (`Standard{ComponentName}Payload`):
   - Implement `ComponentConstructorMethods<Standard{ComponentName}Data>`
   - Store private fields for component data (prefixed with `_`)
   - Implement constructor with optional `previous` parameter for cloning
   - Implement `fromJSON()` - Parse from data type
   - Implement `fromSchema()` - Parse from WML schema tree (use `treeNodeTypeguard(isSchema{ComponentName})`)
   - Implement getters for public properties
   - Implement `toJSON()` - Serialize to data type (follow omission-over-empty principle)
   - Implement `schema()` - Generate schema tree from payload
   - Implement `nestedSchema()` - Generate nested schema with organization context
   - Implement `merge()` - Combine two payloads
   - Implement `subset()` - Return empty payload
   - Implement `referencedKeys()` - Return array of referenced component keys
   - Implement `mapContents()`, `remapReferences()`, `withChild()` if needed
   - Implement `isEmpty()` - Check if payload is empty
   - Implement `invert()` - Invert edit operations
   - Implement `assureReferences()` if component has reference lists (see `assureReferences` pattern)
   - Implement `removeReferences()` if component has reference lists

2. **Create Component Class** (`Standard{ComponentName}`):
   - Use `componentClassFactory(Standard{ComponentName}Payload, 'Standard{ComponentName}')`
   - Expose public getters that delegate to payload
   - Override `_wrap()` method
   - Override `clone()` method
   - Override `equals()` method (compare payloads)
   - Override `invert()` method if needed

**Reference Examples**:
- **Simple component**: `knowledge.ts`, `feature.ts` - Minimal structure, optional references
- **Component with references**: `room.ts` - Multiple `ReferenceList` properties, `assureReferences()` implementation
- **Component with complex properties**: `example.ts`, `character.ts` - `StandardRender`, nested structures

**Key Patterns**:
- Use `ReferenceList` for child references (see `room.ts` for multiple buckets)
- Use `StandardRender` for rich text content (see `example.ts`)
- Use `StandardLiteral` for simple string content (see `knowledge.ts`)
- Follow omission-over-empty principle in `toJSON()` - omit empty arrays/objects
- Use `excludeUndefined` helper when filtering optional fields in schema generation

#### Step 6: Factory Integration (`standardize/componentFactory.ts`)

**Location**: `packages/mtw-wml/ts/standardize/componentFactory.ts`

**Tasks**:
- Import `Standard{ComponentName}` and `isStandard{ComponentName}Data`
- Import `isSchema{ComponentName}` from `@tonylb/mtw-base/ts/schema/components` (or appropriate location)
- Add case to `standardComponentFactory()` function:
  ```typescript
  if ((!isSchemaTreeNode(arg) && isStandard{ComponentName}Data(arg)) || 
      (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchema{ComponentName})(arg))) {
      return new Standard{ComponentName}(arg)
  }
  ```

**Example Pattern**: See existing cases in `componentFactory.ts` - each component has a conditional check for both JSON data and schema tree inputs.

#### Step 6: Processing Integration (`standardize/index.ts`)

**Location**: `packages/mtw-wml/ts/standardize/index.ts`

**Tasks**:
1. **Add to COMPONENT_TEMPLATES**:
   - Add entry to `COMPONENT_TEMPLATES` array
   - Format: `{ key: '{ComponentName}', legalParents?: [...] }`
   - `legalParents` is optional - omit if component can appear at asset level
   - Determine appropriate `legalParents` based on component's intended usage
     - Examples: `{ key: 'Example', legalParents: ['Room', 'Feature', 'Knowledge', 'Asset'] }`
     - Examples: `{ key: 'Knowledge' }` (no legalParents = can appear at asset level)

2. **Add to isStandardComponent()**:
   - Import `Standard{ComponentName}`
   - Add `(value instanceof Standard{ComponentName) ||` to the type guard

**Example**:
```typescript
const COMPONENT_TEMPLATES: ComponentProcessingTemplate[] = [
    // ... existing entries ...
    { key: 'Mark', legalParents: ['Example', 'Asset'] }
]

export const isStandardComponent = (value: any): value is StandardComponent => {
    return (value instanceof StandardCharacter) ||
        // ... existing checks ...
        (value instanceof StandardMark)
}
```

#### Step 8: Write Unit Tests

**Location**: Create `packages/mtw-wml/ts/standardize/components/{componentName}.test.ts` (e.g., `mark.test.ts`)

**Tasks**:
- Test construction from JSON data
- Test construction from WML schema (string input)
- Test serialization (`toJSON()`)
- Test deserialization round-trip (JSON → Component → JSON)
- Test schema generation (`schema()` getter)
- Test nested schema generation (`nestedSchema()`)
- Test merge operations (`merge()`)
- Test diff operations (via `equals()` or direct diff)
- Test `isEmpty()` method
- Test `invert()` method
- Test `assureReferences()` if component has reference lists
- Test reference handling if component has references

**Test Patterns** (see existing test files):
- Use WML strings for component construction in tests for readability
- Use JSON objects for tests specifically targeting JSON structure
- Test edge cases (empty components, missing optional fields, etc.)

**Reference Examples**: `knowledge.test.ts`, `feature.test.ts`, `room.test.ts` - Examine these for test patterns and coverage.

### Common Patterns and Pitfalls

#### Simple Components (No References)

**Example**: `StandardKnowledge`, `StandardFeature`

**Pattern**:
- Minimal payload class with basic properties (e.g., `shortName?: StandardLiteral`)
- Optional `ReferenceList` for child components (e.g., `examples: ReferenceList`)
- Simple `toJSON()` with omission-over-empty pattern
- Straightforward `schema()` and `nestedSchema()` implementations

**Common Pitfalls**:
- Forgetting to omit empty arrays in `toJSON()` (use conditional spread: `...(this.examples.payload.length ? { examples: this.examples.toJSON() } : {})`)
- Not implementing `assureReferences()` for components with reference lists
- Missing `isEmpty()` implementation

#### Components with References

**Example**: `StandardRoom` (has `features`, `examples`, `characters` reference lists)

**Pattern**:
- Multiple `ReferenceList` properties for different child types
- `assureReferences()` implementation that dispatches to appropriate buckets based on child `tag`
- `withChild()` implementation that routes to correct bucket
- `nestedSchema()` uses organization context to get children and assure references

**Common Pitfalls**:
- Forgetting to implement `assureReferences()` - this is required for components with reference lists
- Not filtering children by `tag` in `assureReferences()` - each bucket should only contain appropriate child types
- Missing `removeReferences()` implementation
- Incorrect bucket routing in `withChild()` - must match the dispatch logic in `assureReferences()`

#### Components with Complex Properties

**Example**: `StandardExample` (has `StandardRender` properties), `StandardCharacter` (has `EditWrappedStandardNode` for images)

**Pattern**:
- Use `StandardRender` for rich text content (name, description, etc.)
- Use `EditWrappedStandardNode` for complex nested structures (images, etc.)
- More complex `fromSchema()` implementations using `SchemaTagTree` filtering
- More complex `schema()` generation with nested structure reconstruction

**Common Pitfalls**:
- Incorrect `StandardRender` reconstruction in `schema()` - use `rebuildSchemaFromStandardRender()` helper
- Missing mapping parameter handling in `schema()` and `nestedSchema()` for Link remapping
- Not handling edit wrappers (Remove/Replace) correctly in `fromSchema()`

#### General Pitfalls

1. **Missing Schema Converter**: Forgetting to register component in `schema/converters/components.ts` - WML parsing will fail with "Cannot read properties of undefined" errors
2. **Missing Type Exports**: Forgetting to export data type and type guard from `dataTypes/index.ts`
3. **Factory Integration**: Forgetting to add component to `standardComponentFactory()` - component won't be created from schema
4. **Template Registration**: Forgetting to add to `COMPONENT_TEMPLATES` - component won't be processed correctly
5. **Type Guard Registration**: Forgetting to add to `isStandardComponent()` - type checks will fail
6. **Case Sensitivity**: Component tags are case-sensitive - ensure consistent casing (`'Mark'` not `'mark'`)
7. **Schema Type Guard**: Must import and use correct `isSchema{ComponentName}` from `@tonylb/mtw-base`
8. **Omission-over-Empty**: Always omit empty arrays/objects in `toJSON()` - don't include `field: []`

### Verification Checklist

After completing all steps, verify your implementation:

- [ ] Component can be parsed from WML string: `<{ComponentName} key="test">...</{ComponentName}>` (requires Step 2: Schema Converter Registration)
- [ ] Component can be created from JSON data: `{ tag: '{ComponentName}', key: 'test', ... }`
- [ ] Component appears in `standardComponentFactory()` lookups
- [ ] Component appears in `COMPONENT_TEMPLATES` array
- [ ] Component passes `isStandardComponent()` type guard
- [ ] Component can be stored in `StandardForm`
- [ ] Component serializes correctly (`toJSON()`)
- [ ] Component deserializes correctly (round-trip: JSON → Component → JSON)
- [ ] Component generates correct schema (`schema()` getter)
- [ ] Component generates correct nested schema (`nestedSchema()`)
- [ ] Component merge operations work correctly
- [ ] Component equals/diff operations work correctly
- [ ] All unit tests pass
- [ ] Component follows omission-over-empty principle in `toJSON()`
- [ ] If component has references: `assureReferences()` works correctly
- [ ] If component has references: references appear in correct buckets

### Related Documentation

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`dataTypes/AGENT.md`](./dataTypes/AGENT.md) - Serialization vs. Manipulation Types architecture
- [`../keys/AGENT.planning.md`](../keys/AGENT.planning.md) - Phase 4.5 provides a concrete example of adding `StandardMark` component, including schema converter registration (Step 2)
- **Reference Implementation Examples**:
  - Simple component: `knowledge.ts`, `feature.ts`
  - Component with references: `room.ts`
  - Component with complex properties: `example.ts`, `character.ts`

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

