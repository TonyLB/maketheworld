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

### Remove Operations: Reference vs. Data Impact

The `Remove` operation interacts differently with the reference and data aspects of a component appearance:

#### Data Payload Perspective

From the perspective of the **data payload**, removing data is algebraically equivalent to adding its inverse:
- Removing `data: {shortName:+old, features:{-feat1} }` is equivalent to adding `data: {shortName:-old, features:{+feat1} }`

This follows from invertibility: removing an item is the same as adding its inverse.

#### Reference Perspective

However, from the perspective of the **reference**, there is a fundamental difference between component-level Remove and adding inverted data:

- `{reference: {-room1}, data: {shortName:+name, features:{+feat1}}}` (component-level Remove) - removes the Room reference from the parent (the Room does not appear in the parent's reference list)
- `{reference: {+room1}, data: {shortName:-name, features:{-feat1}}}` (inverted Add) - keeps the Room reference in the parent, but removes the Feature reference within the Room's data

**Data Impact**: From a data payload perspective, both approaches produce the same merged data result. This follows from inversion: `-{shortName:+name, features:{+feat1}}` equals `{shortName:-name, features:{-feat1}}` (inverting the component's data is equivalent to inverting each field individually).

**Reference Impact**: The reference impact is fundamentally different and cannot be equated through inversion:
- Component-level Remove: The reference is removed from the parent context (`reference: {-room1}`)
- Distributed Remove: The reference remains in the parent context (`reference: {+room1}`)

This distinction is crucial: component-level Remove operations affect the reference relationship itself, while distributed Remove operations affect only the data payload within an established reference. The reference behavior cannot be "distributed" - it's an inherent property of the component appearance level.

## Related Documentation

- [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList merge and diff operations
- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component types, architectural patterns, and testing details


