# ReferenceList

## Overview

`ReferenceList` encapsulates the handling of component references within component payloads. It manages collections of `StandardReference` objects, providing operations for merging, diffing, formatting, and lookup that are essential for the component standardization system.

## Purpose

In WML, components contain reference collections (like `features`, `examples`, `characters` in a Room) that point to other components. `ReferenceList` provides a unified interface for:

- **Storing references** as a collection of `StandardReference` objects
- **Merging references** from multiple component appearances
- **Computing diffs** between reference collections
- **Format conversion** between key, universalKey, and both formats
- **Key lookup** for resolving references across contexts

## Architecture

### Standalone Implementation

`ReferenceList` is a standalone class that implements list operations directly for `StandardReference` objects. This implementation:

- **Item matching**: Uses `sameKey()` to identify equivalent references
- **Merge operations**: Combines matching items, adds unmatched items
- **Diff operations**: Computes additions and removals
- **Edit support**: Handles `StandardReferenceSimple` and `StandardReferenceRemove` wrapper types

### Reference Storage

`ReferenceList` stores `StandardReference` objects, which internally wrap one of two edit operation types:

- **`StandardReferenceSimple`**: Standard reference addition
- **`StandardReferenceRemove`**: Marks a reference for removal

**Note:** Replace operations are illegal for references. When loading from WML/JSON that contains Replace tags, an error is thrown. References can only be added or removed, never replaced with a different target component.

The constructor normalizes references to ensure minimum key information (removing context-dependent data).

## MapByKey: Foundational Abstraction

`MapByKey<Payload>` is a generic class that provides efficient key-based payload mapping using dual JavaScript `Map` storage. It maps payloads by `StandardKey` using two internal Maps:

- `_byUniversalKey: Map<ComponentUUID, { key: StandardKey; payload: Payload }>` - maps ComponentUUID to entries
- `_byKey: Map<string, { key: StandardKey; payload: Payload }>` - maps local key strings to entries

This provides O(1) lookups by both `universalKey` and local `key`, making it suitable for operations that need to efficiently find payloads by either identifier type.

### Potential Future Optimization

`ReferenceList` could potentially be refactored to use `MapByKey<StandardReference>` internally to optimize performance:

- **Current implementation**: Uses linear searches (O(n)) with `.find()` and `.some()` operations that call `sameKey()` for each comparison
- **Potential optimization**: Using `MapByKey` would provide O(1) lookups instead of O(n) linear searches in operations like `merge()`, `diff()`, and `assureItem()`
- **Implementation approach**: Would maintain `_items` array for backward compatibility (computed from `_mapByKey.sortedOutput()`)
- **Benefits**: Significantly faster operations on large reference lists, especially when checking for existing items or merging lists

This optimization is documented here for future consideration but is not currently implemented, as the current `ReferenceList` implementation is sufficient for current use cases.

## Usage in Component Payloads

### Storage

Component payload classes use `ReferenceList` for reference collections:

```typescript
class StandardRoomPayload {
    _features: ReferenceList;
    _examples: ReferenceList;
    _characters: ReferenceList;
}
```

### Construction

`ReferenceList` can be constructed from:

- **Empty array**: `new ReferenceList([])` - creates an empty list
- **JSON data**: Array of `StandardReferenceData` (strings or objects)
- **Schema nodes**: Array of `GenericTree<SchemaTag>` representing component references
- **StandardReference instances**: Array of `StandardReference` objects
- **Another ReferenceList**: Clones the list and its items

### Serialization

The `toJSON()` method returns `ReferenceListData` (an array of `StandardReferenceData`), which can be stored and transmitted. Empty lists are omitted during serialization (per the Omission-Over-Empty Principle).

### Merging and Diffing

`ReferenceList` provides nuanced merging and diffing, according to its own [`edit algebra`](./AGENT.referenceList.editAlgebra.md)

**Important constraint:** References cannot change which component they point to. When merging or diffing references:

- If two references point to the same component (matched by `sameKey()` - same `key` OR same `universalKey`), they merge/diff successfully
- If two references point to different components, merge/diff operations throw a `MergeConflictError`

This ensures that references can only transition between add/remove/undefined states. To change which component a reference points to, you must explicitly remove the old reference and add a new one as separate operations.

### Bulk Operations

`ReferenceList` provides methods that apply single-reference operations (e.g. `toFormat`) across all items in the list, returning a new `ReferenceList` instance. This pattern ensures consistent transformations while preserving the list structure and edit operation types, while delegating the individual processing to `StandardReference`.

### Key Lookups

`lookup()` resolves references using a mapping function or array:

- Accepts a callback function `(key: StandardKey) => StandardKey | undefined`
- Or an array of `StandardKey` objects for lookup
- Updates all references in the list with resolved keys
- Preserves edit operation types (Simple/Remove/Replace, though Replace is deprecated)

This is used when resolving component keys across different contexts or when merging components with key mappings.

## Relationship to Component Data

In component payloads, `ReferenceList` fields are stored independently from other data fields:

- Each reference collection (e.g., `features`, `examples`) is a separate `ReferenceList`
- References are merged independently when combining component appearances
- `Remove` operations on individual references are distinct from component-level `Remove` operations

This independent storage enables precise control over reference collections and supports the additive merging model where each appearance can add or remove specific references.

## Related Documentation

- [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList merge and diff operations
- [`reference.ts`](./reference.ts) - Implementation of `ReferenceList`, `StandardReference`, and `StandardKey`
- [`AGENT.md`](./AGENT.md) - Conceptual overview of Components and references
- [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) - Mathematical properties of component edit operations
- [`editableList.ts`](./editableList.ts) - Factory pattern for editable list operations (used for content, not asset structure)

