# Standard Form - Agent Navigation Guide

## Overview

The `standardize` directory contains the `StandardForm` class, which represents an Asset as a whole, first-class object. StandardForm handles aggregate operations on WML assets by orchestrating the known operations of the `StandardComponent` interface to make changes on each of the children components.

## Getting Started

1. **Build fluency in WML and the WML schema**
   - **Why**: StandardForm, components, and most tests assume you can read and write WML comfortably; without that, you can’t interpret test setup, asset shapes, or expected results.
   - **Read**: [`../AGENT.md`](../AGENT.md) for the WML language and schema overview, plus WML-focused sections of `packages/mtw-wml/ts/AGENT.md`.
   - **Focus**: How `<Asset>`, `<Room>`, `<Feature`, `<Example>`, and other tags map to schema types and StandardComponent shapes, and how unit tests use WML snippets to express both initial state and expectations.

2. **Understand the role of StandardForm in the WML ecosystem**
   - **Why**: StandardForm is the asset-level abstraction for WML; using it correctly depends on seeing it as “the whole asset” wrapper, not as an isolated data class.
   - **Read**: This file’s **Overview**, **Semantic Modes**, and **Core Purpose** sections.
   - **Focus**: The three semantic modes (direct asset, edits, aggregation) and how they describe *when* you should construct or operate on a StandardForm.

3. **Connect StandardForm to StandardComponent types**
   - **Why**: Almost everything StandardForm does (`merge()`, `diff()`, `subset()`) is delegated to `StandardComponent` implementations; understanding those makes asset-level behavior predictable.
   - **Read**: [`./components/AGENT.md`](./components/AGENT.md) for the StandardComponent family (Room, Feature, Example, etc.).
   - **Focus**: How components expose `merge()`, `referencedKeys()`, and other operations that StandardForm orchestrates across the asset.
   - **For edit operations**: If your work involves understanding or modifying how edits (Remove, Replace, Add operations) work, their mathematical properties, or how merging/diffing operates at the component or reference list level, read:
     - [`./components/AGENT.editAlgebra.md`](./components/AGENT.editAlgebra.md) - Mathematical properties of component edit operations (inversion, reference vs. data payload distinction)
     - [`./components/AGENT.referenceList.editAlgebra.md`](./components/AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList merge and diff operations (non-associativity, non-idempotency, inversion)

4. **Anchor on the core StandardForm implementation**
   - **Why**: The public API described here is implemented in a small number of files; reading them shows the real control flow and edge‑case handling.
   - **Read**: `index.ts` for StandardForm construction and the main `merge()/diff()/subset()` logic, and `baseClasses.ts` for `StandardFormSubsetRequest` and related types.
   - **Focus**: How different semantic modes all use the same methods, and how subset traversal is driven by request types and the cascade graph.

5. **Use subset to understand layered assets and imports**
   - **Why**: `subset()` is how the system builds focused “views” of an asset—especially when importing content from ancestor assets—so it’s a good way to internalize how complex worlds are assembled from layered WML assets.
   - **Read**: The `subset()` implementation in `index.ts`, and its usage in `lambda/assets/fetchImportDefaults/recursiveFetchImports.ts` (for import graphs) and `charcoal-client/src/components/Maps/Controller/index.tsx` (for map-focused views).
   - **Focus**: How request types and cascade graphs decide which components and references to pull into a subset, and how those subsets let the system compose rich maps and imported content from many smaller assets.

6. **Use tests as executable documentation**
   - **Why**: Tests capture real-world calling patterns and clarify how merge/diff/subset should behave across many components and edge cases.
   - **Read**: `index.test.ts`, `baseClasses.test.ts`, `processComponents.test.ts`, and representative component tests under `components/*.test.ts` (especially `room.test.ts`, `example.test.ts`, and `edits.test.ts`).
   - **Focus**: Concrete examples of asset-level merges, edit components (`Replace`, `Remove`), subset extraction for maps/positions, and how reference changes are expected to appear in diffs.
   - **For edit operations**: When examining test cases involving `Remove`, `Replace`, or merge/diff operations, refer to [`./components/AGENT.editAlgebra.md`](./components/AGENT.editAlgebra.md) and [`./components/AGENT.referenceList.editAlgebra.md`](./components/AGENT.referenceList.editAlgebra.md) to understand the mathematical properties that govern these operations.

7. **Check integration points and known wrinkles before extending behavior**
   - **Why**: StandardForm sits at the intersection of schema, components, render, and authorization; changes in one place often have subtle effects elsewhere.
   - **Read**: This file’s **Integration Points** and **Technical Debt** notes (for example, the diff-system reference-change issue and the proposed explicit `<Parent>` tag behavior), plus `processComponents.ts`, `example.ts`, and `render/AGENT.md` as needed.
   - **Focus**: Where parent/child relationships are resolved, how examples/features/knowledge get positioned, and how known limitations might affect new work.

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
  - May include only partial information (just the components being changed)
  - Designed to be merged with existing asset data
  - **Key distinction**: This is a temporary artifact meant only to convey the *action* of a change, not a durable asset representation
- **Example**: A user editing a room's description creates an edit component that changes and removes some values, while leaving others untouched

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

## Payload vocabulary vs semantic mode (`standardizeMode`)

**Orthogonal to semantic modes above:** `StandardForm` also carries **`standardizeMode`** (`WmlStandardizeMode`: `'asset'` or `'ephemeraWire'`). That field controls which WML **tag set** applies when parsing and standardizing (blueprint vs ephemera wire), not whether the form is an edit bundle or an aggregate.

- **Public API:** Pass an optional second constructor argument, **`StandardFormConstructionOptions`**, e.g. `new StandardForm(wml, { standardizeMode: 'ephemeraWire' })`. Omitting it defaults to **`'asset'`** (`DEFAULT_WML_STANDARDIZE_MODE`).
- **Persistence:** The resolved mode is stored on **`standardizeMode`**. **`toJSON()`** includes **`standardizeMode`** only when it is not **`'asset'`** (omission-over-empty). **`StandardFormData`** may include optional **`standardizeMode`**; constructor options and data field are resolved via **`StandardForm.resolveInitialStandardizeMode`** (data wins when both specify).
- **Threading:** From the WML/schema path, mode flows **`processComponents`** → **`standardComponentFactory`** → generated component **`fromSchema(node, context?)`** → payload **`fromSchema`**. **`StandardizeFromSchemaContext`** carries **`standardizeMode`**. Facet payloads use the same context as an optional **third** argument: **`fromSchema(node, reference, context?)`** (the second argument remains the facet **`StandardReference`**).
- **Clone / merge:** **`_clone()`** copies **`semanticMode`** and **`standardizeMode`**. **`merge()`** uses **`this._clone()`** as the base of the result, so the **receiver's** **`standardizeMode`** is kept (incoming's mode is not merged).
- **`withStandardizeMode`:** Functional update of **`standardizeMode`**; prefer passing options at construction when parsing WML so **`fromSchema`** sees the correct mode.

**Ephemera-only tag (v1):** **`Object`** --- required **`uuid`** attribute and exactly one **`ShortName`** child (WML shape **`<Object uuid=(id)><ShortName>label</ShortName></Object>`**; you may also author **`uuid=(OBJECT#...)`**). The schema layer normalizes **`uuid`** to canonical **`OBJECT#...`** (bare **`id`** in WML becomes **`OBJECT#id`**); **`schemaToWML`** prints **`uuid=(id)`** again via the same strip pattern as **`Room`**. Parseable only inside a **`Room`**. **`StandardRoom`** collects **`objects`** as **`{ uuid, shortName }[]`** when **`standardizeMode === 'ephemeraWire'`**; in **`asset`** mode **`Object`** under **`Room`** is an unconsumed child and standardization **errors**. For **`Meta::Room.objects`** (`string[]`), project **`objects.map((o) => o.uuid)`** (handles are **`OBJECT#...`**). **`Object`** is not a **`StandardComponent`**; **`ComponentUUID`** / **`isSchemaComponentUUID`** are unchanged for this tag.

**Ephemera-only:** **`Render`** under **`Room`** (DisplayName / Summary / Description) is stored on **`StandardRoom`** as **`render`** in JSON with the same shape as **`SituationRoomFacetPayloadType`** (literal **`displayName`**, **`summary`** and **`description`** as render-tree editable data), not three plain strings.

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

- **`merge(incoming)`**: Combines two StandardForms, merging all components. Automatically handles key changes by remapping references to universal format.
- **`diff(incoming)`**: Creates a StandardForm representing the difference between two assets
- **`subset(requests)`**: Creates a subset of the asset based on component requests
- **`finalize()`**: Completes the asset by ensuring all references are properly mapped
- **`mapContents(callback)`**: Transforms all component content
- **`renameKey(props)`**: @deprecated Use explicit `<Key>` tags in edits processed through `merge()` instead

### Constructor Overloads

All overloads accept an optional **second** argument: **`options?: StandardFormConstructionOptions`** (e.g. `{ standardizeMode: 'ephemeraWire' }`). Examples below omit it for brevity.

StandardForm supports multiple construction patterns:

```typescript
// 1. String constructor (creates empty asset with AssetUUID)
const asset = new StandardForm("ASSET#TestAsset")

// 2. WML string constructor
const asset = new StandardForm(`<Asset uuid=(Test)>
    <Room key=(mainHall)><Exit to=(kitchen)>kitchen</Exit></Room>
</Asset>`)

// 3. Schema node constructor
const asset = new StandardForm({
    data: { tag: 'Asset', uuid: 'ASSET#TestAsset', Story: undefined },
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
    universalKey: 'ASSET#Test',
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
    { tag: 'Asset', universalKey: 'ASSET#Test' },
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
const base = new StandardForm(`<Asset uuid=(Test)>
    <Room key=(mainHall)>
        <Example uuid=(base)>
            <Description>Main hall</Description>
        </Example>
    </Room>
</Asset>`)

const incoming = new StandardForm(`<Asset uuid=(Test)>
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
// <Asset uuid=(Test)>
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

### Key Changes

Key changes (rename or remove) are handled through the standard edit/merge pipeline using explicit `<Key>` tags:

**Requirements:**
- Components must have `universalKey` set before any key changes
- `universalKey` provides a stable anchor when local keys change
- References are automatically updated during merge

**WML Pattern:**

Key changes are expressed using explicit `<Key>` tags within component edits:

```xml
<!-- Key rename: Replace old key with new key -->
<Feature uuid=(FEATURE#feature1) key=(clockTower)>
    <Replace><Key>clockTower</Key></Replace>
    <With><Key>tower</Key></With>
</Feature>

<!-- Key removal: Remove the local key (component remains via universalKey) -->
<Feature uuid=(FEATURE#feature1) key=(testFeature)>
    <Remove><Key>testFeature</Key></Remove>
</Feature>
```

**Example:**
```typescript
// Base asset with references
const base = new StandardForm(`<Asset uuid=(Test)>
    <Feature uuid=(FEATURE#feature1) key=(clockTower)>
        <ShortName>Clock Tower</ShortName>
    </Feature>
    <Room uuid=(ROOM#room1) key=(mainHall)>
        <Example uuid=(base)>
            <Description><Link to=(clockTower)>See tower</Link></Description>
        </Example>
    </Room>
</Asset>`)

// Edit with Key rename
const edit = new StandardForm(`<Asset uuid=(Test)>
    <Feature uuid=(FEATURE#feature1) key=(clockTower)>
        <Replace><Key>clockTower</Key></Replace>
        <With><Key>tower</Key></With>
    </Feature>
</Asset>`)

// Merge - references automatically update to use new key
const merged = base.merge(edit)
// Result: Link in Room now points to 'tower' instead of 'clockTower'
// The Feature component now has key='tower' but same universalKey
```

**Note:** The deprecated `renameKey()` method should not be used. Use explicit `<Key>` tags in WML edits instead.

The merge operation:
1. **Component-Level Merging**: Each component is merged using its own `merge()` method
2. **Additive Behavior**: New components are added, existing components are merged, components with all references removed are themselves removed
3. **Conflict Detection**: Throws `MergeConflictError` for incompatible changes

### Subset Operations

StandardForm's `subset()` operation extracts specific components from an asset along with their minimum supporting information. This is crucial for handling imported components and maintaining referential integrity without importing everything from all assets.

#### Core Concepts

- **Selective Extraction**: Returns specified components plus minimal supporting context
- **Cascading References**: Follows component connections to include referenced components
- **Request Types**: Detail levels from `Full` to `Stub` (see `StandardFormSubsetRequest` types)
- **Directed Graph Traversal**: Uses named nodes and transitions to define complex cascade patterns

#### Key Use Cases

- **Import Context Building**: Extract inheritance trees for imported components
- **Map Editing**: Get positioned rooms and their exits for map visualization
- **Minimal Subsets**: Maintain referential integrity with minimal supporting data

#### Cascade Traversal System

The cascade system uses a directed graph structure to define how component connections should be traversed:

**Graph Structure**:
- **Nodes**: Named states (e.g., `'map'`, `'room'`, `'exitTarget'`) with associated `requestType`
- **Transitions**: Directed edges with `connectionType` and `targetNode` pairs
- **Start Nodes**: Initial traversal entry points for the graph

**Connection Types**: Uses `StandardComponentReferenceKey['referenceType']` values:

**Structural references** (define structural relationships):
- `'Direct'`: Direct component relationships (e.g., Room contains Example)
- `'Position'`: Components positioned within other components (e.g., rooms in maps)
- `'Facet'`: Structured relationships with associated data (e.g., Mark facets in Examples)

**Non-structural references** (connections that don't define structure):
- `'Link'`: General reference links between components
- `'Exit'`: Exit connections between components (e.g., room-to-room exits)
- `'Dependency'`: Component dependencies

**Example**: Map editing cascade follows the pattern:
1. Start at `'map'` node → follow `'Position'` connections → reach `'room'` nodes
2. From `'room'` nodes → follow `'Exit'` connections → reach `'exitTarget'` nodes
3. Each node specifies the `requestType` for components visited at that state

#### Implementation Details

- **Core Logic**: `StandardForm.subset()` method in `index.ts`
- **Traversal Engine**: Two-phase approach: graph traversal records visits, then generates requests
- **Reference Extraction**: `component.referencedKeys()` method provides connection information
- **Request Processing**: `requestOutput()` function determines component output detail levels

#### Related Components

- **Request Types**: `StandardFormSubsetRequest` union type in `baseClasses.ts`
- **Cascade Conditions**: `StandardFormSubsetCascadeGraphNode` type with graph structure
- **Reference Types**: Uses `StandardComponentReferenceKey['referenceType']` for connection types

### Diff Operations

StandardForm diff creates a minimal representation of changes:

```typescript
// Create diff between assets
const original = new StandardForm(`<Asset uuid=(Test)>
    <Room key=(mainHall)>
        <Example uuid=(base)>
            <Description>Main hall</Description>
        </Example>
    </Room>
</Asset>`)

const modified = new StandardForm(`<Asset uuid=(Test)>
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

## Edit Operations

StandardForm supports edit operations at the asset level, as well as within component content (so that it
can edit components at their top level):

```typescript
// Asset with edit components
const assetWithEdits = new StandardForm({
    universalKey: 'ASSET#Test',
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
- **Edit System**: Processes asset-level and content-level edit components according to the edit algebra
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

#### **Explicit Parent Control for Sub-Components**
**Context**: When serializing assets to WML/JSON schema, sub-components (like Examples) are positioned in the tree structure based on their parent relationships, which are determined through `SchemaOrganization` using graph-based topological resolution. This means that a top-level Example in an edit asset will appear at the top level in the serialized schema, even if it was originally nested within a Room/Feature/Knowledge.

**Current Behavior** (as of 2025):
- Examples can exist at top level (Asset parent) or nested (Room/Feature/Knowledge parent)
- When an Example appears at top level in an edit merge, it appears at top level in the serialized schema
- Parent relationships for tree structure are determined via `SchemaOrganization.getImplicitParent()` using graph-based topological resolution
- `SchemaOrganization` is used for converting the data-centric `StandardForm` structure into a hierarchical tree for serialization (WML/JSON output)
- Note: `StandardForm` operations (merge, diff, subset) work on the data-centric structure and don't require tree organization

**Proposed Enhancement**: Add optional `<Parent>` tag to explicitly control component positioning:

```wml
<Asset uuid=(Test)>
    <Example uuid=(room-example)>
        <Parent>ROOM#testRoom</Parent>
        <Replace><Name>Old</Name></Replace>
        <With><Name>New</Name></With>
    </Example>
</Asset>
```

**Benefits**:
1. Explicit parent specification allows edit-mode convenience (top-level Examples) without affecting positioning
2. Users can choose whether to preserve or change parent relationships in edits
3. Backward compatible: absence of `<Parent>` tag maintains current behavior
4. Would enable more precise control over component organization during merges

**Implementation Considerations**:
- Add `<Parent>` as optional tag in Example, Feature, and other sub-component schemas
- Modify merge logic to respect explicit parent when present
- Ensure validation that parent UUID references valid components

**Related Files**: `processComponents.ts`, `example.ts`, component merge logic

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
