# Standard Components - Edit Algebra

## Overview

This document describes the **mathematical properties and relationships** of edit operations on Component data. It focuses on the algebra of how content edits relate to each other, including how edits are represented, merged, and distributed.

**⚠️ IMPORTANT**: This document describes the **target architecture and design goals** for Component edit operations in WML. The current implementation in this directory may not fully match all concepts described here, as the system is in active migration toward these requirements. For current implementation details, see [`AGENT.implementation.md`](./AGENT.implementation.md). For conceptual overview of Components, see [`AGENT.md`](./AGENT.md).

## Core Concepts

### Notation

To discuss component data algebra concisely, we use a local notation:

- **Data Tags**: `fieldName:+value` indicates a value is added/set, `fieldName:-value` indicates a value is removed, `fieldName:old->new` indicates a replace operation
- **Reference Lists**: Use the notation from [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md): `{+ref1, -ref2}` for references added/removed

For example, component data can be expressed as:
- `{shortName:+new, features:{+feat1, -feat2}}` for a room with a ShortName added and features list containing feat1 added and feat2 removed

### Inverse

The inverse of a component data payload is the payload constructed of the inverse of each of the independent data sections:
- **Data Tags**: A data field like `ShortName` has its own bespoke inversion (`+value` ↔ `-value`, `old->new` ↔ `new->old`)
- **Reference Lists**: `ReferenceList` inversion is described in [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md)

Example: Inverting component data `{shortName:old->new, features:{+feat1, -feat2}}` produces `{shortName:new->old, features:{-feat1, +feat2}}`.

### Non-associative and non-idempotent

As with `ReferenceList` mergers, we cannot count on component merges to be _either_ associative (i.e. order independent) _or_ idempotent. See [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) for a more in-depth discussion.

## Component Appearance: Reference and Data Duality

A component appearance in WML has a **dual nature**: it simultaneously represents both a **reference** (indicating the component appears in a parent context) and a **data payload** (content being added to that component).

Using our notation, we can express this as:
- `{reference: {+room1}, data: {shortName:+name, features:{+feat1}}}` represents a Room reference with content additions

### Component Storage Architecture

Because component data is architected as independent, invertible, and mergeable properties, we can simplify how component edits are stored:

#### Storage Principle

**We do not store `Remove` or `Replace` versions of `StandardComponent` instances.** Instead:
- Components are always stored as **plain components** with edits applied internally
- Any `Remove` or `Replace` operations on component content are distributed into the component's individual fields (data tags and reference lists)
- The only place `Remove` tags are stored in association with components is in the **reference** to the component (within a `ReferenceList`)

#### Example: Component-Level Remove

When WML contains `<Remove><Room key=(room1)><ShortName>Name</ShortName></Room></Remove>`, we store this as:
- **Reference**: `{-room1}` in the parent's `ReferenceList` (the Remove tag is stored at the reference level)
- **Component Data**: A plain `StandardRoom` instance with `{shortName:-name}` (the Remove action is distributed into the ShortName field by inverting the component)

This storage approach is algebraically equivalent: removing component data `{shortName:+name}` is equivalent to storing a plain component with `{shortName:-name}`. The key insight is that we normalize to plain components with distributed edits rather than storing wrapper edit operations.

## Related Documentation

- [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList merge and diff operations
- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component types, architectural patterns, and testing details


