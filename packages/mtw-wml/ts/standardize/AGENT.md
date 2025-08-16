# Standard Form - Agent Navigation Guide

## Overview

The `standardize` directory contains the `StandardForm` class, which represents an Asset as a whole, first-class object. StandardForm handles aggregate operations on WML assets by orchestrating the known operations of the `StandardComponent` interface to make changes on each of the children components.

## Semantic Modes

StandardForm can operate in three distinct semantic modes, each serving different purposes in the asset management lifecycle:

### 1. Direct Representation of a Single Asset
- **Purpose**: Represents the complete, current state of a single asset as stored in the system
- **Usage**: When loading an asset from storage, displaying its current state, or performing read-only operations
- **Characteristics**: 
  - Contains the actual components that exist in the asset, including any edits that have been applied
  - May include inherited components that are being extended or refined from their parent assets
  - Represents the "ground truth" of what the asset contains as a layer in the overall asset system
- **Example**: Loading a particular room from an asset in the database to display the changes made
to that specific room in that specific asset

### 2. Edits to be Applied to a Single Asset
- **Purpose**: Represents changes that need to be applied to an existing asset
- **Usage**: When creating, updating, or modifying asset content through the editing interface
- **Characteristics**:
  - Contains `StandardRemove`, `StandardReplace`, and other edit operation components
  - May include only partial information (just the components being changed)
  - Designed to be merged with existing asset data
  - **Key distinction**: This is a temporary artifact meant only to convey the *action* of a change, not a durable asset representation
- **Example**: A user editing a room's description creates a `StandardReplace` component that will be merged with existing room data as part of updating the stored asset

### 3. Aggregation of the Content of Multiple Assets
- **Purpose**: Combines content from multiple assets through inheritance, imports, or other aggregation operations
- **Usage**: When building a complete view that includes inherited content, imported components, or merged data from multiple sources
- **Characteristics**:
  - Contains components from multiple source assets
  - May include stub components for referential integrity
  - Represents the "effective" content after all inheritance and merging is resolved
- **Example**: When rendering a component, the impact of multiple assets is combined into an
overall structure that is *conveyed* as an asset, but which also needs to record information
about the origin of each component within the larger tree that is being flattened.

### Mode Transitions

These modes are not mutually exclusive and can transition between each other:

- **Mode 1 → Mode 2**: When editing begins, a direct representation becomes the base for edit operations
- **Mode 2 → Mode 1**: When edits are applied and saved, the edit StandardForm is used to update and
refine the direct representation
- **Mode 1 → Mode 3**: When inheritance is processed, a single asset's content is merged with other
content to generate an aggregate

Understanding these modes is crucial for proper usage of StandardForm methods like `merge()`, `diff()`, and `subset()`. Each method behaves the same in all three modes, but they are *called* in different
ways (and with different purposes) depending upon how the StandardForm class is being used in the
particular context.

## Core Purpose

- **Asset Management**: Represents entire WML assets as first-class objects
- **Aggregate Operations**: Orchestrates operations across all components in an asset
- **Subset Extraction**: Creates focused subsets of assets for specific use cases
- **Reference Management**: Handles component references and cross-asset relationships

## StandardForm Class

### Core Properties

- **`_key`**: `string` - The asset's identifier
- **`_components`**: `StandardComponent[]` - Array of all components in the asset
- **`_metaData`**: `GenericTree<SchemaTag>` - Metadata associated with the asset

### Key Methods

- **`merge(incoming)`**: Combines two StandardForms, merging all components
- **`diff(incoming)`**: Creates a StandardForm representing the difference between two assets
- **`subset(requests)`**: Creates a subset of the asset based on component requests
- **`finalize()`**: Completes the asset by ensuring all references are properly mapped
- **`mapContents(callback)`**: Transforms all component content
- **`renameKey(props)`**: Renames component keys throughout the asset
- **`assureComponent(reference)`**: Ensures a component exists in the asset

### Constructor Overloads

StandardForm supports multiple construction patterns:

```typescript
// 1. String constructor (creates empty asset with key)
const asset = new StandardForm("TestAsset")

// 2. WML string constructor
const asset = new StandardForm(`<Asset key=(Test)>
    <Room key=(mainHall)><Exit to=(kitchen)>kitchen</Exit></Room>
</Asset>`)

// 3. Schema node constructor
const asset = new StandardForm({
    data: { tag: 'Asset', key: 'TestAsset' },
    children: [{
        data: { tag: 'Room', key: 'mainHall' },
        children: [{
            data: { tag: 'Exit', to: 'kitchen' },
            children: [{ data: { tag: 'String', value: 'kitchen' }, children: [] }]
        }]
    }]
})

// 4. StandardFormData constructor
const asset = new StandardForm({
    key: 'Test',
    metaData: [],
    components: [
        {
            tag: 'Room',
            key: 'mainHall',
            exits: [{ to: 'kitchen', description: 'kitchen' }]
        }
    ]
})

// 5. StandardNDJSON constructor
const asset = new StandardForm([
    { tag: 'Asset', key: 'Test' },
    { tag: 'Room', key: 'mainHall', exits: [] }
])

// 6. Copy constructor
const assetCopy = new StandardForm(existingAsset)
```

## Asset-Level Operations

### Component Management

StandardForm provides several ways to access and manage components:

```typescript
// Access by local key
const room = asset.byId['mainHall']

// Access by universal key
const room = asset.byUniversalId['ROOM#mainHall-uuid']

// Get all component keys
const keys = asset._keys

// Lookup component by reference
const component = asset._lookup({ key: 'mainHall', tag: 'Room' })
```

### Merge Operations

StandardForm merge operations combine two assets intelligently:

```typescript
// Merge two assets
const base = new StandardForm(`<Asset key=(Test)>
    <Room key=(mainHall)>
        <Example uuid=(base)>
            <Description>Main hall</Description>
        </Example>
    </Room>
</Asset>`)

const incoming = new StandardForm(`<Asset key=(Test)>
    <Room key=(mainHall)><Exit to=(kitchen)>kitchen</Exit></Room>
    <Room key=(kitchen)>
        <Example uuid=(kitchenBase)>
            <Description>Kitchen</Description>
        </Example>
    </Room>
</Asset>`)

const merged = base.merge(incoming)
// Result: Combined asset with WML as follows:
//
// <Asset key=(Test)>
//    <Room key=(kitchen)>
//        <Example uuid=(kitchenBase)>
//            <Description>Kitchen</Description>
//        </Example>
//    </Room>
//    <Room key=(mainHall)>
//        <Example uuid=(base)>
//            <Description>Main hall</Description>
//        </Example>
//        <Exit to=(kitchen)>kitchen</Exit>
//    </Room>
// </Asset>
```

The merge operation:
1. **Component-Level Merging**: Each component is merged using its own `merge()` method
2. **Additive Behavior**: New components are added, existing components are merged
3. **Edit Processing**: Handles `StandardRemove` and `StandardReplace` components
4. **Conflict Detection**: Throws `MergeConflictError` for incompatible changes

### Subset Operations

StandardForm's `subset()` operation is a powerful feature that extracts specific components from an asset along with their minimum supporting information. This is particularly crucial for handling imported components and maintaining referential integrity.

#### What Subset Does

Subset reaches into an Asset and returns **only** the components specified, along with the minimum supporting information from other components that those components reference. This cascading behavior ensures that all necessary context is preserved without importing everything from all assets.

#### Why Subset is Important

When a user wants to **edit** a component that they import from another Asset, Subset allows us to select all the relevant inherited information from the ancestry of imports in an internally consistent format, without needing to import **everything** from all of those assets.

#### Basic Subset Examples

```typescript
// Create subset with specific components
const subset = asset.subset([
    { requestType: 'Full', keys: [{ key: 'mainHall' }] },
    { requestType: 'Stub', keys: [{ key: 'kitchen' }] }
])
// Result: mainHall with full details, kitchen with minimal stub info
```

#### Cascade Examples

Subset can automatically include referenced components through cascade conditions:

```typescript
// Cascade requests for linked components
const subsetWithLinks = asset.subset([
    {
        requestType: 'Full',
        keys: [{ key: 'mainHall' }],
        cascadeConditions: [
            {
                conditionType: 'Exit',
                cascadeType: 'Full',
                chainCascade: true
            }
        ]
    }
])
// Result: mainHall + all rooms it has exits to (with full details)
```

#### Inheritance and Import Context

The real power of Subset emerges when dealing with imported components:

```typescript
// Asset with imported components
const assetWithImports = new StandardForm(`<Asset key=(UserEdit)>
    <Room key=(mainHall)>
        <Exit to=(kitchen)>kitchen</Exit>
        <Feature key=(fountain)>
            <Example uuid=(fountain-example)>
                <Description>Beautiful marble fountain</Description>
            </Example>
        </Feature>
    </Room>
    <Room key=(kitchen) uuid=(KITCHEN#imported-uuid)>
        <Example uuid=(kitchen-example)>
            <Description>Cozy kitchen</Description>
        </Example>
    </Room>
</Asset>`)

// Extract just the mainHall for editing, with minimal kitchen context
const editingSubset = assetWithImports.subset([
    { requestType: 'Full', keys: [{ key: 'mainHall' }] },
    { requestType: 'Stub', keys: [{ key: 'kitchen' }] }
])

// Result: mainHall with full details, kitchen with just enough info
// to maintain the exit reference, without importing the entire kitchen
// from its source asset
```

#### Cascade Chain Examples

Subset can chain cascades through multiple levels of references:

```typescript
// Complex asset with multiple reference levels
const complexAsset = new StandardForm(`<Asset key=(Complex)>
    <Room key=(entrance)>
        <Exit to=(mainHall)>main hall</Exit>
    </Room>
    <Room key=(mainHall)>
        <Exit to=(kitchen)>kitchen</Exit>
        <Exit to=(library)>library</Exit>
    </Room>
    <Room key=(kitchen)>
        <Exit to=(pantry)>pantry</Exit>
    </Room>
    <Room key=(library)>
        <Exit to=(study)>study</Exit>
    </Room>
</Asset>`)

// Extract entrance with chained cascade through exits
const chainedSubset = complexAsset.subset([
    {
        requestType: 'Full',
        keys: [{ key: 'entrance' }],
        cascadeConditions: [
            {
                conditionType: 'Exit',
                cascadeType: 'Full',
                chainCascade: true  // This causes the cascade to continue
            }
        ]
    }
])

// Result: entrance + mainHall + kitchen + pantry + library + study
// All rooms in the chain are included with full details
```

#### Request Types

Subset supports different levels of detail for included components:

- **`Full`**: Complete component with all properties and content
- **`Stub`**: Minimal component with just key/universalKey for reference
- **`ShortName`**: Component with just the name/shortName for display
- **`Exit`**: Component with just exit information

```typescript
// Mixed request types for different levels of detail
const mixedSubset = asset.subset([
    { requestType: 'Full', keys: [{ key: 'mainHall' }] },
    { requestType: 'ShortName', keys: [{ key: 'kitchen' }] },
    { requestType: 'Stub', keys: [{ key: 'pantry' }] }
])
```

### Diff Operations

StandardForm diff creates a minimal representation of changes:

```typescript
// Create diff between assets
const original = new StandardForm(`<Asset key=(Test)>
    <Room key=(mainHall)>
        <Example uuid=(base)>
            <Description>Main hall</Description>
        </Example>
    </Room>
</Asset>`)

const modified = new StandardForm(`<Asset key=(Test)>
    <Room key=(mainHall)>
        <Example uuid=(base)>
            <Description>Grand hall</Description>
        </Example>
    <Room key=(kitchen)>
        <Example uuid=(kitchenBase)>
            <Description>Kitchen</Description>
        </Example>
    </Room>
</Asset>`)

const diff = original.diff(modified)
// Result: StandardForm with WML schema as follows:
//    <Room key=(mainHall)>
//        <Example uuid=(base)>
//            <Replace><Description>Main hall</Description></Replace>
//            <With><Description>Grand hall</Description></With>
//        </Example>

```

### Content Transformation

StandardForm provides methods to transform all component content:

```typescript
// Transform all component content
const transformed = asset.mapContents((tree) => {
    // Apply transformation to each component's schema
    return transformedTree
})

```

### Reference Management

StandardForm handles component references and mappings:

```typescript
// Rename component keys throughout the asset
const renamed = asset.renameKey([
    { fromKey: 'oldRoom', toKey: 'newRoom', retainOldExportAs: true }
])

// Ensure component exists
const assured = asset.assureComponent({ key: 'missingRoom', tag: 'Room' })

// Finalize asset (complete all mappings)
const finalized = asset.finalize()
```

## Edit Operations

StandardForm supports edit operations at the asset level, as well as within component content (so that it
can edit components at their top level):

```typescript
// Asset with edit components
const assetWithEdits = new StandardForm({
    key: 'Test',
    components: [
        {
            tag: 'Replace',
            key: 'mainHall',
            match: { tag: 'Room', key: 'mainHall', exits: [] },
            payload: { tag: 'Room', key: 'mainHall', exits: [{ to: 'kitchen', description: 'kitchen' }] }
        },
        {
            tag: 'Remove',
            key: 'oldRoom',
            component: { tag: 'Room', key: 'oldRoom', exits: [] }
        }
    ]
})
```

## Integration Points

- **Component System**: Orchestrates operations on StandardComponent instances
- **Schema System**: Converts to/from WML schema format
- **Reference System**: Manages component references and mappings
- **Edit System**: Processes StandardRemove and StandardReplace components
- **WML Language**: See [`../AGENT.md`](../AGENT.md) for WML format details
- **Standard Components**: See [`./components/AGENT.md`](./components/AGENT.md) for component details
- **Rich Text Processing**: See [`./render/AGENT.md`](./render/AGENT.md) for content handling

## Navigation Tips

1. **Start with Examples**: Look at test files for usage patterns
2. **Understand Component Integration**: StandardForm orchestrates StandardComponent operations
3. **Check Edit Operations**: Review how edit components are processed
4. **Review Subset Logic**: Understand cascade and request priority systems
5. **Test Merge Operations**: Verify that component-level merges work correctly

## Development Notes

### Current State
- **Core Operations**: Merge, diff, and subset operations fully implemented
- **Component Integration**: Complete integration with StandardComponent system
- **Reference Management**: Full support for component references and mappings
- **Edit Processing**: Support for edit operations at asset and component levels

### Future Plans
- **Performance**: Optimize operations for large assets
- **Validation**: Enhanced asset validation
- **Extensions**: Support for additional asset operations

### Technical Debt

#### **DIFF SYSTEM: Reference Changes in Nested Components** 🔴
**Status**: Specific edge case where diff system fails to detect new references to existing global components.

**Issue**: When a nested component (like Room) adds a reference to an existing global component, the diff system correctly identifies the global component but fails to include the new reference in the diff output.

**Example**: 
- Base: Global `char2` exists, Room has no `char2` reference
- Modified: Global `char2` unchanged, Room adds `char2` reference
- Expected: Diff should show `<Character key=(char2) />` in Room
- Actual: Diff missing the `char2` reference entirely

**Root Cause**: The `StandardForm.diff()` method's zippered component processing doesn't correctly handle reference changes in nested components when the referenced component already exists globally.

**Impact**: Affects any reference list (characters, features, examples) in nested components when adding references to existing global components.

**Priority**: Medium - affects diff accuracy but doesn't break core functionality.

#### **General Issues**
- **Error Handling**: Improve error messages for complex operations
- **Documentation**: Add more examples for complex asset operations
- **Testing**: Expand test coverage for edge cases
