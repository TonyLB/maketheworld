# ReferenceList - Edit Algebra

## Overview

This document describes the **mathematical properties and relationships** of edit operations on `ReferenceList` instances using the numeric `ref` property model. It focuses on the algebra of how reference list edits relate to each other, including how merges and diffs operate on collections of references as simple arithmetic operations.

For current implementation details, see [`referenceList.ts`](./referenceList.ts). For general ReferenceList usage, see [`AGENT.referenceList.md`](./AGENT.referenceList.md).

## Core Concept

A `ReferenceList` stores references where each reference has a numeric `ref` value that represents its operation:

- **`ref > 0`**: Add operation - the reference is being added (the value represents the count)
- **`ref < 0`**: Remove operation - the reference is being removed (the absolute value represents the count)
- **`ref = 0`**: Explicit cancellation/neutral state - the reference exists but has zero net effect
- **Default**: When `ref` is not specified, it defaults to `1` (representing a standard add operation)

This numeric model simplifies merge and diff operations to basic arithmetic: merging becomes addition (`ref1 + ref2`) and diffing becomes subtraction (`ref2 - ref1`).

## Inverse

The inverse of a `ReferenceList` is computed by negating the `ref` value of each reference:
- `ref` becomes `-ref`
- Positive values become negative, negative values become positive, zero remains zero


Example: Inverting a list with `<Room key=(feat1) />` and `<Remove><Room key=(feat2) /></Remove>` produces `<Remove><Room key=(feat1) /></Remove>` and `<Room key=(feat2) />`.

## Merging

When merging reference lists, references are matched by key (using `sameKey()`), and their `ref` values are added together:

- **Unmatched references**: References appearing in only one list appear unchanged in the final list
- **Matched references**: References appearing in both lists have their `ref` values added: `ref1 + ref2`

The merge operation is numeric addition, but the handling of zero results depends on whether the zero is explicit or due to cancellation:

- **Cancellation** (`ref1 + ref2 = 0` where both `ref1` and `ref2` are non-zero): The reference disappears from the result (semantic add and remove cancel out)
- **Explicit zero** (one of the references has `ref={0}` explicitly set): The reference remains in the result with `ref={0}` (for display/organization purposes)
- **Non-zero result** (`ref1 + ref2 ≠ 0`): The reference appears with the sum as its `ref` value

Example: Merging a list with `<Room key=(feat1) ref={1}>`, `<Room key=(feat2) ref={1}>`, `<Room key=(feat4) ref={1}>`, `<Room key=(feat5) ref={-1}>`, `<Room key=(feat7) ref={-1}>`, `<Room key=(feat8) ref={-1}>` with a list containing `<Room key=(feat1) ref={1}>`, `<Room key=(feat3) ref={1}>`, `<Room key=(feat4) ref={-1}>`, `<Room key=(feat6) ref={-1}>`, `<Room key=(feat7) ref={-1}>`, `<Room key=(feat8) ref={1}>`:

- `feat1`: `ref={1}` + `ref={1}` = `ref={2}` (both add, accumulates)
- `feat2`: only in first → `ref={1}` (unchanged)
- `feat3`: only in second → `ref={1}` (unchanged)
- `feat4`: `ref={1}` + `ref={-1}` = `ref={0}` → disappears (cancellation: add and remove cancel out)
- `feat5`: only in first → `ref={-1}` (unchanged)
- `feat6`: only in second → `ref={-1}` (unchanged)
- `feat7`: `ref={-1}` + `ref={-1}` = `ref={-2}` (both remove, accumulates)
- `feat8`: `ref={-1}` + `ref={1}` = `ref={0}` → disappears (cancellation: add and remove cancel out)

Result: `<Room key=(feat1) ref={2}>`, `<Room key=(feat2) ref={1}>`, `<Room key=(feat3) ref={1}>`, `<Room key=(feat5) ref={-1}>`, `<Room key=(feat6) ref={-1}>`, `<Room key=(feat7) ref={-2}>`

**Contrast with explicit zero**: If instead `feat4` had `<Room key=(feat4) ref={0}>` in the second list (explicit zero for display), the merge would be `ref={1} + ref={0} = ref={1}`, preserving the semantic connection while allowing display organization.

## ref={0} and Display vs. Semantic References

`ReferenceList` serves two distinct purposes in the WML system:

1. **Semantic content**: Establishing meaningful associations between components (e.g., "This Feature is meaningfully associated with this Room")
2. **Display/organization**: Organizing where content appears in the hierarchy for display and editing (e.g., "This Feature is shared by several rooms, and therefore is displayed at the Asset Level")

The `ref` value distinguishes between these purposes:

- **Non-zero `ref`** (`ref > 0` or `ref < 0`): Establishes or removes semantic connections. These references both establish meaningful associations AND display their semantic content (and potentially component content).
- **Zero `ref`** (`ref = 0`): Used for display and editing organization WITHOUT establishing new semantic connections. These references allow content to be displayed or edited in a useful place in the hierarchy without creating new semantic relationships.

### Explicit Zero vs. Implicit Absence

The `ref={0}` value enables explicit representation of a reference that exists for display/organization purposes but has zero net semantic effect. This is distinct from the reference simply not appearing in the list:

- **Implicit absence**: Reference not in list → no operation, no display
- **Explicit zero**: Reference present with `ref={0}` → display/organization only, no semantic connection

### Use Cases for ref={0}

The `ref={0}` value is particularly useful for:

- **Hierarchical display**: Displaying shared components at the appropriate level in the hierarchy (e.g., Asset-level) without establishing new semantic connections
- **Inline content edits**: Editing component content (like a Room's Description) in a useful hierarchical location without modifying semantic reference state
- **Edit organization**: Organizing edits in edit contexts where you need to distinguish between "reference doesn't exist" and "reference exists for display/editing but not for semantic purposes"

When a reference is marked as `ref={0}`, it explicitly indicates "this reference is present for display/organization purposes, but it does not establish or modify semantic connections." This allows clean separation between semantic content and display organization.

Example: If you have a base list with `<Room key=(mainHall) ref={1}>` (semantic connection) and you want to edit the Room's Description at the Asset level without changing the semantic reference, you can represent this as `<Room key=(mainHall) ref={0}>` in the edit. When merged: `ref={1} + ref={0} = ref={1}`, preserving the semantic connection while allowing the content edit to be processed at the appropriate hierarchical level.

## Mathematical Properties

With numeric `ref` values, merge and diff operations become standard arithmetic operations. This simplifies the mathematical properties:

### Associativity and Commutativity

For matched references (same key), numeric addition is both associative and commutative:
- **Commutative**: `a.merge(b)` for matched references = `b.merge(a)` (since `ref1 + ref2 = ref2 + ref1`)
- **Associative**: For matched references, `(a.merge(b)).merge(c)` = `a.merge(b.merge(c))` (since `(ref1 + ref2) + ref3 = ref1 + (ref2 + ref3)`)

Since references are matched by key (not position) and each key appears at most once per list (due to deduplication during construction), the merge operation is **order-independent**: `a.merge(b)` produces the same result (excepting the order of references within the list) regardless of the order of items within `a` or `b`. The result is determined solely by which keys are present and their `ref` values.

### Idempotency

Merging a list with itself (`a.merge(a)`) will:
- Double all `ref` values: `ref` becomes `ref + ref = 2*ref`
- This is **not idempotent** unless all `ref` values are `0`

However, if you merge a list with a list containing the same references but with `ref={0}` values, the result preserves the original `ref` values (since `ref + 0 = ref`). This property is useful for edit operations where you want to preserve existing references while making other changes.

## Diffing

The `diff()` method computes the difference between two `ReferenceList` instances using numeric subtraction:

- **Unmatched base references**: References in the base but not in the incoming are inverted (negated)
- **Matched references**: References in both have their `ref` values subtracted: `ref2 - ref1` (incoming - base)
- **Unmatched incoming references**: References in the incoming but not in the base appear unchanged

The diff operation is simply numeric subtraction: `ref2 - ref1`. If the result is `0`, the reference disappears from the diff (no change needed).

Example: Diffing a base list with `<Room key=(feat1) ref={1}>`, `<Room key=(feat2) ref={1}>` against an incoming list with `<Room key=(feat1) ref={0}>`, `<Room key=(feat3) ref={1}>`:

- `feat1`: `ref={0}` - `ref={1}` = `ref={-1}` (incoming has zero, base has one → need to remove)
- `feat2`: only in base → inverted → `ref={-1}` (remove from base)
- `feat3`: only in incoming → `ref={1}` (add to base)

Result: `<Room key=(feat1) ref={-1}>`, `<Room key=(feat2) ref={-1}>`, `<Room key=(feat3) ref={1}>`

**Mathematical relationship**: If `a.diff(b) = x` such that `a.merge(x) = b`, then `x = b - a` (where subtraction is applied to each matched reference's `ref` value). This means we can express diffing in terms of merging and inversion: `a.diff(b)` is equivalent to computing `b - a` for each reference.

## SingleReference envelope

`SingleReference` is a constrained wrapper around `ReferenceList` that applies the same numeric `ref` algebra but within a much smaller envelope suitable for "0-or-1" slots.

### Envelope definition

For a SingleReference slot, we consider `ref` sign as:

- **Positive** (`ref > 0` or default 1): "add/set this reference".
- **Negative** (`ref < 0`): "remove this reference".
- **Zero** (`ref = 0`): neutral.

The envelope enforced on any SingleReference instance is:

- At most **one positive** reference in the list.
- At most **one negative** reference in the list.

In the common **diff interpretation** (when a SingleReference is being used as a per-slot diff), we can think of it in terms of states:

- Base value `A`, incoming value `B`.
- Diff is expressed as a tiny `ReferenceList` (wrapped by `SingleReference`) that obeys:
  - **No-op**: `A = B` (including both undefined) → empty diff.
  - **Set**: `undefined → B` → a single positive item `+B`.
  - **Clear**: `A → undefined` → a single negative item `-A`.
  - **Swap**: `A → B` with `A` and `B` different keys → two items: `-A` and `+B`.

This envelope is implemented by constructing a SingleReference from the two state values while still representing the diff as a list of `StandardReference` values with signed `ref` fields.

### Merge semantics for SingleReference

Applying a SingleReference diff to a SingleReference state follows the same numeric algebra, but with additional constraints:

- The base state is interpreted as the current **single value** (0 or 1 positive ref).
- The diff is interpreted as a tiny `ReferenceList` within the envelope above.
- Semantics:
  - **Negative only (-A)**:
    - If the base value is `A`, the slot is cleared.
    - If the base value is not `A` (including undefined), the diff is a no-op.
  - **Positive only (+B)**:
    - The slot is set to `B`, regardless of the current value.
  - **Negative A and positive B (-A, +B)**:
    - Equivalent to "swap A → B": clear A (if present), then set B.

Mathematically, this is a specialization of the general `ReferenceList` algebra to the 0-or-1 case, where:

- Each key can appear at most once in the diff.
- At most two keys participate (the outgoing A and the incoming B).
- The visible operations correspond exactly to:
  - `b - a` at the per-key level (for A and B).
  - Merging `a` with that tiny diff to obtain `b`.

The SingleReference implementation keeps all of this algebra **list-shaped** so it composes cleanly with the rest of the system, while ensuring that single-reference slots never accidentally drift into multi-reference states.

## Related Documentation

- [`AGENT.referenceList.md`](./AGENT.referenceList.md) - General ReferenceList overview and usage
- [`referenceList.ts`](./referenceList.ts) - Implementation of `ReferenceList`
- [`reference.ts`](./reference.ts) - Implementation of `StandardReference`
- [`key.ts`](./key.ts) - Implementation of `StandardKey`
- [`../components/AGENT.editAlgebra.md`](../components/AGENT.editAlgebra.md) - Mathematical properties of component edit operations
- [`../components/AGENT.md`](../components/AGENT.md) - Conceptual overview of Components and references
