# ReferenceList

## Overview

`ReferenceList` encapsulates the handling of component references within component payloads. It manages collections of `StandardReference` objects, providing operations for merging, diffing, formatting, and lookup that are essential for the component standardization system.

## Purpose

In WML, components contain reference collections (for example **`features`** and **`characters`** on Room, **`examples`** on Feature and Knowledge) that point to other components. `ReferenceList` provides a unified interface for:

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

## SingleReference: 0-or-1 reference pattern

### Purpose

Some reference slots are semantically "single optional" rather than "0..n" lists (for example, `StandardRoom.lens` conceptually expects at most one Lens). The **SingleReference** pattern captures this 0-or-1 semantics while keeping the underlying data shape (`ReferenceListData`) and machinery (`ReferenceList`, `StandardReference`) unchanged.

SingleReference is implemented as:

- A **runtime pattern** for "at most one" reference, not a new serialized shape
- A **subclass of `ReferenceList`** (`SingleReference extends ReferenceList`) that enforces a narrow envelope on what shapes are valid
- A small, focused API for reading/writing the single value while still interoperating with list-based pipelines (merge, diff, schema, fromSchema)

### Data shape and class relationship

- **Data shape**: Serialized fields remain `ReferenceListData` (arrays of `StandardReferenceData`), including `StandardRoomData.lens`.
- **Runtime type**: `SingleReference` wraps the same items as `ReferenceList` but constrains how many and of what sign:
  - At most **one positive** reference (`ref > 0` or default 1).
  - At most **one negative** reference (`ref < 0`).
- Because `SingleReference` **extends `ReferenceList`**, it can be passed anywhere a `ReferenceList` is expected and still participate in existing operations (`schema`, `toJSON`, `lookup`, `toFormat`, etc.).

### Core API surface

- **Construction**:
  - `new SingleReference(args)` – accepts the same constructor shapes as `ReferenceList` (arrays of `StandardReference`, schema nodes, or `StandardReferenceData`) and enforces the envelope.
  - `SingleReference.fromReferenceList(list)` – converts an existing `ReferenceList` into a `SingleReference`, throwing if the list cannot be reconciled to 0-or-1 semantics.
  - `SingleReference.fromData(data?: ReferenceListData)` – convenience for payload `fromJSON` / `fromSchema` when fields are stored as `ReferenceListData`.
  - `SingleReference.fromValue(value: StandardReference | StandardReferenceData | undefined)` – builds a state-style instance directly from a single value.

- **Value accessors**:
  - `get value(): StandardReference | undefined` – returns the single positive reference (or `undefined` when empty).
  - `set value(StandardReference | StandardReferenceData | undefined)` – sets the single value (represented as empty list or single positive reference) and re-applies invariants.

### Invariant enforcement

SingleReference adds envelope checks on top of the normal ReferenceList behavior:

- At most **one positive** reference in the payload.
- At most **one negative** reference in the payload.
- Shapes with 2+ positives or 2+ negatives are rejected.
- Trivial cancellation (e.g. `+A` and `-A` with matching keys and `ref` magnitudes) is normalized to an empty list.

These rules are local to SingleReference; plain ReferenceList instances remain unconstrained and can still represent more complex multi-reference edits.

Internally, `ReferenceList` uses a protected `wrap(items: StandardReference[])` hook for all list-producing operations (`merge`, `diff`, `invert`, `clone`, `map`, `filter`, `lookup`, `toFormat`). The base implementation returns a plain `ReferenceList`, but subclasses like `SingleReference` override `wrap` to return their own type. This mirrors the `StandardComponent._wrap` pattern and ensures that higher-level algebra stays in `ReferenceList` while subclasses can preserve their concrete type without re-implementing the core logic.

### Relationship to components (example: Room.lens)

The SingleReference pattern is designed so that components like `StandardRoom` can:

- Keep their serialized fields as `ReferenceListData` (e.g. `lens?: ReferenceListData`).
- Use `SingleReference` in their payloads for 0-or-1 slots (e.g. `_lens: SingleReference`) to:
  - Enforce "at most one" at construction and during merge/diff.
  - Offer a simple `lens` getter (via `value`) returning `StandardReference | undefined`.
- Continue to interoperate with:
  - **fromSchema** pipelines that parse lists of child tags (still list-shaped under the hood).
  - **Schema generation** that expects list-shaped reference collections.
  - **StandardForm merge/diff** operations that remain list-based at the component/asset level.

This keeps the **data shape and global pipelines stable** while localizing the 0-or-1 semantics and validation to the SingleReference wrapper.

## Usage in Component Payloads

### Storage

Component payload classes use `ReferenceList` for reference collections:

```typescript
class StandardRoomPayload {
    _features: ReferenceList;
    _guidance: ReferenceList;
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
- [`referenceList.ts`](./referenceList.ts) - Implementation of `ReferenceList`
- [`reference.ts`](./reference.ts) - Implementation of `StandardReference`
- [`key.ts`](./key.ts) - Implementation of `StandardKey`
- [`../components/AGENT.md`](../components/AGENT.md) - Conceptual overview of Components and references
- [`../components/AGENT.editAlgebra.md`](../components/AGENT.editAlgebra.md) - Mathematical properties of component edit operations
- [`../components/editableList.ts`](../components/editableList.ts) - Factory pattern for editable list operations (used for content, not asset structure)
