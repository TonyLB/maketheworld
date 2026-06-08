# Standard Components - Agent Navigation Guide

## Overview

This document describes the **abstract concept** of Component types in WML and their special behavior. It focuses on core concepts, design principles, and **future requirements** for how Components should work in the WML system.

**⚠️ IMPORTANT**: This document describes the **target architecture and design goals** for Components in WML. The current implementation in this directory may not fully match all concepts described here, as the system is in active migration toward these requirements. For current implementation details, see [`AGENT.implementation.md`](./AGENT.implementation.md). For practical usage examples, see [`AGENT.usage.md`](./AGENT.usage.md).

**`standardizeMode` (blueprint vs ephemera wire):** Lives on **`StandardForm`** only; drives **`validateAssetWirePolicy()`** and serialization metadata. Component payloads are mode-blind and always parse wire tags they understand. See [`standardize/AGENT.md`](../AGENT.md), section **Payload vocabulary vs semantic mode (`standardizeMode`)**.

## Getting Started

1. **Start with core component concepts**
   - **Why**: Understanding what a Component is and how it differs from other WML elements is fundamental to working with the standardization system.
   - **Read**: The **What is a Component?** and **Core Concepts** sections of this document.
   - **Focus**: How components have unique identity, support additive merging, and serve dual roles as both references and content definitions.

2. **Understand edit operations and their mathematical properties**
   - **Why**: Components support invertible edit operations (`Add`, `Remove`), and understanding how these operations merge and interact is crucial for implementing or modifying component behavior. (Note: `Replace` operations are no longer supported at component/reference level - they are expressed as `Add` + `Remove` pairs.)
   - **Read**: 
     - [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) - Mathematical properties of component edit operations (inversion, reference vs. data payload distinction, non-associativity)
     - [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList merge and diff operations (non-associativity, non-idempotency, inversion)
   - **Focus**: How edits are invertible, how merging works algebraically, and how reference list operations differ from standard algebraic operations.

3. **Review component implementation patterns**
   - **Why**: Components follow specific architectural patterns for serialization, manipulation, and edit operations.
   - **Read**: [`AGENT.implementation.md`](./AGENT.implementation.md) for component types, architectural patterns, and testing details.
   - **Focus**: How StandardComponent classes are structured, how ReferenceList is used, and how components handle serialization vs. manipulation types.

4. **Explore practical usage examples**
   - **Why**: Concrete examples show how to create, manipulate, and work with components in practice.
   - **Read**: [`AGENT.usage.md`](./AGENT.usage.md) for practical code examples and usage patterns.
   - **Focus**: Creating components from WML and JSON, accessing content properties, and character reference patterns.

## What is a Component?

In WML, a **Component** is a first-class entity that represents a piece of world content. Components have a unique identity (established through `key` and/or `universalKey`) and can appear multiple times throughout a WML asset. All appearances of the same component are automatically merged during standardization, with changes being additive across the entire asset.

Components differ from other WML elements in that they:
- Have semantic weight in the WML hierarchy
- Can be referenced and defined separately
- Support additive merging across multiple appearances
- Maintain identity through keys and universal keys

For more details on the special behavior of Components in WML, see the [WML language documentation](../../AGENT.md#components).

## Core Concepts

These concepts describe the abstract principles that Components should follow. The current implementation may be in various stages of migration toward fully realizing these concepts.

### References and Content

In WML, the presence of a Component tag serves a **dual purpose**: it simultaneously indicates both a **reference** (establishing a relationship between components) and the **addition of content** (providing data for that component).

For example, when a `Feature` tag appears inside a `Room`:

```xml
<Room key=(tavern)>
    <Feature key=(fountain)>
        <ShortName>Central Fountain</ShortName>
    </Feature>
</Room>
```

This single appearance of the `Feature` tag accomplishes two things:
- **Reference**: It establishes that the `fountain` feature is present in the `tavern` room
- **Content**: It adds a `ShortName` property to the `fountain` feature

Because Component tags serve this dual purpose, we use the combined term **"appearance"** to describe a Component tag in WML. An appearance is neither purely a reference (like a simple pointer) nor purely content definition (like a data structure) - it is both simultaneously.

#### Additive Content Merging

Content from all appearances of the same component is **additively merged** to generate the complete picture of the component's content for the asset as a whole. This means:

- Each appearance can contribute different pieces of content to the same component
- Properties added in one appearance are combined with properties from all other appearances
- The final component represents the union of all content from all its appearances

### Kinds of Component Appearances

There are several distinct ways in which a Component can "appear" in WML, and each has different implications for references and additive merging of content during standardization.

#### 1. Reference-Only Appearance (Self-Closing Tag)

A **reference-only** appearance is expressed using a self-closing tag with only the `key` or `universalKey` specified, and no nested content:

```xml
<Feature key=(fountain)/>
```

- **Impact on Reference System**: This creates a reference to the component (`Feature[fountain]`) from the parent context.
- **Impact on Content**: Adds _no new content_ to the referenced component.
- **Additive Merge Effect**: Since no content fields are provided, merging with other appearances is a no-op for component data.

This is commonly used to simply declare the presence/relationship of a component in a specific location, without defining or overriding any properties of the component.

#### 2. Direct Content Edit (Top-Level Appearance with Content)

When a top-level appearance (i.e. a Component instance not nested within another Component) includes content inside its tag, only the content is added to the component. The reference aspect acts as a no-op, because references are only tracked in nested (not top-level) contexts. For example:

```xml
<Feature key=(fountain)>
    <ShortName>Central Fountain</ShortName>
</Feature>
```

- **Impact on Reference System**: As a top-level feature, this does *not* add a reference in its parent list.
- **Impact on Content**: Contributes new fields or data to the `Feature[fountain]` component.
- **Additive Merge Effect**: The `ShortName` (or any other fields) are merged into the existing component definition; the reference list is unaffected.

This pattern is typically used when you want to directly edit or define the content for a component, without establishing another reference relationship.

#### 3. Nested Content Appearance

A nested appearance is when a component tag (with or without content) is placed inside another component. For example:

```xml
<Room key=(tavern)>
    <Feature key=(fountain)>
        <ShortName>Central Fountain</ShortName>
    </Feature>
</Room>
```

- **Impact on Reference System**: Adds a reference to `Feature[fountain]` in the relevant property (such as `features`) of the parent (`Room[tavern]`).
- **Impact on Content**: Any child tags (`ShortName`, etc.) are merged into the content of `Feature[fountain]`.
- **Additive Merge Effect**: The reference and the new content are both merged. Thus, this single appearance simultaneously establishes a relationship and extends/overrides component data.

#### Summary Table

| Appearance             | Syntax Example                                     | Adds Reference? | Adds Content? | Merging Outcome             |
|------------------------|----------------------------------------------------|-----------------|--------------|-----------------------------|
| Reference-only         | `<Feature key=(fountain)/>`                        | ✅              | ❌           | Reference only, no content  |
| Direct content (top)   | `<Feature key=(fountain)> ... </Feature>` (top)    | ❌              | ✅           | Content only, no reference  |
| Nested content         | `<Room><Feature key=(fountain)>...</Feature></Room>`| ✅              | ✅           | Both reference and content  |

Understanding these distinctions is crucial when designing WML assets and when implementing standardization logic—ensuring that references and content edits are correctly combined according to where and how each component "appearance" is expressed.

This design allows WML to **receive** component information in flexible, distributed ways (e.g., defining a feature's name where it's first introduced, and adding description where it's used), but then **standardizes** it into a single unified component with all content merged together. The standardization process transforms multiple appearances into one complete, content-ful component representation, and renders the remaining references without content data.

### Component Data Architecture

A Component's data is structured as an independent set of data fields and reference collections. Understanding this architecture is crucial for understanding how edits are applied and merged.

#### Independent Storage

Each different data tag (like `ShortName`, `Description`, etc.) and each different type of reference (like `Feature`, `Character`, etc.) are stored independently within a component:

- **Data Tags**: Stored in dedicated types specific to that data field. For example, `ShortName` is stored as a `StandardLiteral` type, while `Description` might be stored as a `StandardRender` type.
- **References**: Stored in `ReferenceList` types (and related structures such as **`SingleReference`**). Each reference collection (like `features`, `characters`) is maintained separately. **Room** does **not** serialize an **`examples`** list; use **Situation** facets and ephemera **`render`** for Room prose. **Feature** and **Knowledge** use **`situations`** facet lists (**`SituationProseFacetList`**, shared prose triplet, DEFAULT-only in v1); **`examples`** are not serialized on F/K payloads.

This independent storage means that edits to one data field or reference collection do not affect others, allowing precise, targeted modifications to component content.

For the mathematical properties of how edits relate to each other (the two-tuple model, distributive property, etc.), see [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md).

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
  - ReferenceList items (e.g., **`features`** / **`characters`** / **`guidance`** on Room; **`examples`** on Feature and Knowledge)
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

## Related Documentation

- [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) - Mathematical properties of edit operations (two-tuple model, distributive property)
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component types, architectural patterns, and testing details
- `dataTypes/AGENT.md` - Serialization vs. Manipulation Types architecture
- `render/AGENT.md` - StandardRender system documentation
- `../AGENT.md` - Parent directory overview 