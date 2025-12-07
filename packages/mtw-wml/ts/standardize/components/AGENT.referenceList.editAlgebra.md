# ReferenceList - Edit Algebra

## Overview

This document describes the **mathematical properties and relationships** of edit operations on `ReferenceList` instances. It focuses on the algebra of how reference list edits relate to each other, including how merges and diffs operate on collections of references.

**⚠️ IMPORTANT**: This document describes the **target architecture and design goals** for ReferenceList edit operations in WML. The current implementation in this directory may not fully match all concepts described here, as the system is in active migration toward these requirements. For current implementation details, see [`reference.ts`](./reference.ts). For general ReferenceList usage, see [`AGENT.referenceList.md`](./AGENT.referenceList.md).

## Core Concept

A `ReferenceList` stores what is essentially a *set* of references. In the set, each reference can (conceptually) have one of three states:
- It is present (conceptually: positive) in the `ReferenceList`
- It is being _removed_ (conceptually: negative) in the `ReferenceList`
- It is absent (conceptually: zero) from the `ReferenceList`

## Inverse

The inverse of a `ReferenceList` is simply the same list with the state of each reference inverted:
- Adds become removals
- Removals become adds

Conceptually this is very much like multiplying a sum by -1: The sign-change distributes down to each individual summand.

Example: Inverting a list with `{+feat1, -feat2}` (feat1 added, feat2 removed) produces `{-feat1, +feat2}` (feat1 removed, feat2 added).

## Merging

When merging reference lists, the first step is to zipper all matching keys together:
- References appearing in only one of the two lists appear unchanged in the final list
- References appearing in _both_ of the lists are merged together

There are three meaningful possible pair-wise merges for references:
- A reference present in both lists is also present in the final list (i.e., positive + positive = positive)
- A reference removed in both lists is also removed in the final list (i.e., negative + negative = negative)
- A reference removed in one list and added in the other (in either order) is absent from the final list (i.e. negative + positive = zero)

Example: Merging `{+feat1, +feat2, +feat4, -feat5, -feat7, -feat8}` with `{+feat1, +feat3, -feat4, -feat6, -feat7, +feat8}`:
- `feat1`: present in both → `+feat1` (positive + positive = positive)
- `feat2`: only in first → `+feat2` (unchanged)
- `feat3`: only in second → `+feat3` (unchanged)
- `feat4`: added in first, removed in second → absent (positive + negative = zero)
- `feat5`: only removed in first → `-feat5` (unchanged)
- `feat6`: only removed in second → `-feat6` (unchanged)
- `feat7`: removed in both → `-feat7` (negative + negative = negative)
- `feat8`: removed in first, added in second → absent (negative + positive = zero)

Result: `{+feat1, +feat2, +feat3, -feat5, -feat6, -feat7}`

## Non-Idempotency and Non-Associativity

Because matching references are merged during the merge operation (positive + positive = positive, negative + negative = negative), ReferenceList merging exhibits two important mathematical properties:

### Non-Associativity

The order of merges matters. You cannot guarantee that `(a + b) + c = a + (c + b)`. This is because references are matched by key during merge, and the intermediate matching results affect how subsequent merges proceed.

Example: Consider `a = {+feat1}`, `b = {+feat1}`, `c = {-feat1}`:
- `(a + b) + c`: First `a + b = {+feat1}` (positive + positive = positive), then merging with `c` matches `feat1` (positive + negative = zero), resulting in `{}` (empty list)
- `a + (c + b)`: First `c + b` matches `feat1` (negative + positive = zero), resulting in `{}`, then merging with `a` adds `feat1`, resulting in `{+feat1}`

This demonstrates non-associativity: `(a + b) + c = {}` but `a + (c + b) = {+feat1}`, showing that merge order produces different final results.

### Non-Idempotency

You cannot guarantee that `a + b + b = a + b`. This is because merging `b` with `b` will match each reference in `b` with itself, and while the result may appear similar, the merge operation is not guaranteed to preserve the exact structure when the same reference appears multiple times.

Example: Consider `a = {+feat1, -feat2}` and `b = {+feat2}`:
- `a + b`: Merging `{+feat1, -feat2}` with `{+feat2}` matches `feat1` (unchanged) and `feat2` (negative + positive = zero), resulting in `{+feat1}`
- `(a + b) + b`: Merging `{+feat1}` with `{+feat2}` adds both references, resulting in `{+feat1, +feat2}`

This demonstrates non-idempotency: `a + b = {+feat1}` but `(a + b) + b = {+feat1, +feat2}`, showing that applying the same merge operation twice produces a different result than applying it once.

These properties mean that merge operations must be performed in a consistent, well-defined order, and that the system cannot assume that repeated merges are equivalent to single merges.

## Diffing

The `diff()` method computes the difference between two `ReferenceList` instances: This enables incremental updates and change tracking.

(Fun mathematical side-note: We've just (above) described the intuitions from algebra that _don't_ apply to these
operations, but here we have one that _does_. If `a.diff(b) = x` such that `a + x = b`, we _can_ in fact conclude
that `x = b - a`. This means we can express diffing in terms of merging and inversion: `a.diff(b) = b.merge(a.inverse())`.)

## Related Documentation

- [`AGENT.referenceList.md`](./AGENT.referenceList.md) - General ReferenceList overview and usage
- [`reference.ts`](./reference.ts) - Implementation of `ReferenceList`, `StandardReference`, and `StandardKey`
- [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) - Mathematical properties of component edit operations
- [`AGENT.md`](./AGENT.md) - Conceptual overview of Components and references

