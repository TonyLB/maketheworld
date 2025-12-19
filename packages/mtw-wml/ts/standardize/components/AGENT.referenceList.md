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

### Base Class Pattern

`ReferenceList` extends `editableListClassFactory`, a generic factory that provides list operations for editable items. This pattern enables:

- **Item matching**: Uses `sameKey()` to identify equivalent references
- **Merge operations**: Combines matching items, adds unmatched items
- **Diff operations**: Computes additions and removals
- **Edit support**: Handles `StandardReferenceSimple` and `StandardReferenceRemove` wrapper types

### Reference Storage

`ReferenceList` stores `StandardReference` objects, which internally wrap one of two edit operation types:

- **`StandardReferenceSimple`**: Standard reference addition
- **`StandardReferenceRemove`**: Marks a reference for removal

**Note:** `StandardReferenceReplace` exists for backward compatibility (loading from WML/JSON that contains Replace tags), but merge and diff operations will never create Replace operations. References can only be added or removed, never replaced with a different target component.

The constructor normalizes references to ensure minimum key information (removing context-dependent data).

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
- [`editableList.ts`](./editableList.ts) - Base class factory for editable list operations

