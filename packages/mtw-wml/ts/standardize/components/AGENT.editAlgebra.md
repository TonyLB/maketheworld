# Standard Components - Edit Algebra

## Overview

This document describes the **mathematical properties and relationships** of edit operations on Component data. It focuses on the algebra of how content edits relate to each other, including how edits are represented, merged, and distributed.

**⚠️ IMPORTANT**: This document describes the **target architecture and design goals** for Component edit operations in WML. The current implementation in this directory may not fully match all concepts described here, as the system is in active migration toward these requirements. For current implementation details, see [`AGENT.implementation.md`](./AGENT.implementation.md). For conceptual overview of Components, see [`AGENT.md`](./AGENT.md).

## Edit Model: Add and Remove

Each data type and reference collection supports edit operations, specifically **Remove** events:

- **Data Tags**: A data field like `ShortName` can be modified, removed, or replaced. The underlying type (e.g., `StandardLiteral`) supports edit operations that allow content to be marked for removal.
- **Reference Lists**: References can be added to or removed from a `ReferenceList`. The `ReferenceList` type supports `StandardReferenceRemove` objects that mark specific references for removal.

This edit model enables precise control over what content is added to or removed from a component, supporting incremental updates and modifications.

## Component Data as a Two-Tuple

A component's data can be conceptually understood as a **two-tuple** of:
1. **Data being added**: Content and references that are being added or modified
2. **Data being removed**: Content and references that are being removed

Each entry in this tuple is a set of component-data **without any Remove elements** - representing the "plain" component state. The component's current state is then the result of applying the remove set to the add set:

```
Component State = (Data Added) - (Data Removed)
```

This model allows the system to:
- Track both positive and negative changes independently
- Merge multiple edits together by combining their add/remove sets
- Resolve conflicts when the same data is both added and removed
- Generate diffs by comparing the two-tuple representations

For example, if a component has `ShortName` added in one appearance and removed in another, the merge process can detect this conflict and resolve it according to the standardization rules for the particular element type (e.g. `StandardLiteral`).

## Distributive Property of Component Changes

Component-level Remove operations exhibit a **distributive property**: a `Remove` operation applied to an entire component has the same content impact as distributing that `Remove` operation down into individual Remove operations on each data field and reference within that component.

For example, a component-level Remove:

```xml
<Remove>
    <Room key=(room1)>
        <ShortName>Name</ShortName>
        <Feature key=(feature1) />
    </Room>
</Remove>
```

... has the same impact **on content** (when merged) as distributing the Remove operations:

```xml
<Room key=(room1)>
    <Remove><ShortName>Name</ShortName></Remove>
    <Remove><Feature key=(feature1) /></Remove>
</Room>
```

**Content Impact**: Both approaches have the same impact on the component's content when merged - they result in removing the `ShortName` data and removing the `Feature` reference from the room's content. The merged result for the component's data fields is identical.

**Reference Impact**: However, the impact on references is fundamentally different when the Remove is nested within a parent component:

- The component-level `Remove` nested in a parent removes the reference **from that parent context** in which it's nested. For example, `<Map><Remove><Room key=(room1) /></Remove></Map>` removes the Room reference from the Map - the Room will not appear in the Map's room list. Note that a standalone `<Remove><Room /></Remove>` at the top level does not side-effect references elsewhere.
- The distributed `Remove` operations allow the reference to be established first, then remove the content. For example, `<Map><Room key=(room1)><Remove><ShortName /></Remove></Room></Map>` establishes the Room reference in the Map (the Room appears in the Map's room list), but removes the ShortName content within the Room.

This distinction is crucial: when nested in a parent, component-level Remove operations prevent the reference from being established in that specific parent context (removing it from that parent's reference list), while distributed Remove operations allow the reference to be established in the parent and then remove only the content within.

This distributive property means that component-level operations can be understood in terms of their equivalent field-level operations, providing a consistent model for how edits propagate through component structure. It also enables the standardization system to normalize component-level Removes into field-level operations when appropriate, ensuring consistent merge behavior.

### Implications for Replace Operations

Because of this distributive property, components **do not require** (and will not support) a `<Replace>` operation at the component level. Any edit that would replace some content with different content can always be expressed as a combination of individual `Add` and `Remove` operations on the relevant fields, distributed down to the data level.

For example, replacing a `ShortName` from "Old Name" to "New Name" can be expressed as:
- Remove the old value: `<Remove><ShortName>Old Name</ShortName></Remove>`
- Add the new value: `<ShortName>New Name</ShortName>`

This approach maintains consistency with the two-tuple model and ensures all edits can be represented in the add/remove algebra.

## Related Documentation

- [`AGENT.md`](./AGENT.md) - Conceptual overview and navigation guide
- [`AGENT.usage.md`](./AGENT.usage.md) - Practical code examples and usage patterns
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component types, architectural patterns, and testing details


