# Standard Form - Agent Navigation Guide

## Overview

The `standardize` directory contains the `StandardForm` class, which represents an Asset as a whole, first-class object. StandardForm handles aggregate operations on WML assets by orchestrating the known operations of the `StandardComponent` interface to make changes on each of the children components.

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
            <Description>Beautiful marble fountain</Description>
        </Feature>
    </Room>
    <Room key=(kitchen) uuid=(KITCHEN#imported-uuid)>
        <Description>Cozy kitchen</Description>
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

## Navigation Tips

1. **Start with Examples**: Look at test files for usage patterns
2. **Understand Component Integration**: StandardForm orchestrates StandardComponent operations
3. **Check Edit Operations**: Review how edit components are processed
4. **Review Subset Logic**: Understand cascade and request priority systems
5. **Test Merge Operations**: Verify that component-level merges work correctly

## Integration Points

- **Component System**: Orchestrates operations on StandardComponent instances
- **Schema System**: Converts to/from WML schema format
- **Reference System**: Manages component references and mappings
- **Edit System**: Processes StandardRemove and StandardReplace components
