# Facets Implementation Planning

## Purpose

This document provides a high-level, durable plan for implementing **Facets** as a first-class language construct in WML. Facets address the architectural gap where we need to express "relationships with associated data" rather than just raw references.

## Why Facets Are Needed

The current system has strong support for components and references, but multiple use cases require a more expressive pattern:

1. **Maps reference Rooms with positional data** (currently implemented via `StandardPosition`)
2. **Rooms reference other Rooms with exit names** (currently implemented via `StandardExit`)
3. **Examples need to reference Marks with state descriptions** (new requirement from Lenses/Marks)

These are not just references—they are **relationships with associated structured data**. The absence of a first-class construct for this pattern has led to ad-hoc solutions. The introduction of Lenses and Marks makes this gap unavoidable.

## Core Requirement

A **Facet** is a first-class relational object that:
- References a target component
- Declares a kind/role (Facet type)
- Carries structured payload data
- Is locally scoped to its owning component
- Is enumerable, inspectable, and editable

Facets explicitly do **not**:
- Imply global truth
- Create ownership or identity
- Enforce ontological constraints
- Require inheritance or polymorphism

## Architectural Change Overview

As part of this implementation, we will:

1. **Reorganize existing key/reference code** into a dedicated `ts/standardize/keys` directory:
   - Move `StandardKey` from `components/reference.ts`
   - Move `StandardReference` from `components/reference.ts`
   - Move `ReferenceList` from `components/reference.ts`

2. **Create new Facet types** in the same directory:
   - `StandardFacet<TPayload>` - A generic first-class relational object (similar to `StandardReference`, but with typed payload data)
   - `FacetList<TPayload>` - A generic collection type for Facets (similar to `ReferenceList`)

3. **Update existing code** to import from the new location

4. **Implement Facet support** in components (Examples initially, then others as needed)

## High-Level Task Breakdown

The work is broken down into tactically-sized chunks that can be addressed incrementally using Plan mode, without attempting the entire refactor at once.

### Phase 1: Directory Setup and Type Definitions

**Goal**: Establish the new directory structure and create placeholder/type definitions.

1. ✅ **Create `ts/standardize/keys` directory** - Already done
2. ✅ **Define data types for Facets**
   - Created `dataTypes/facet.ts` with `StandardFacetData` type definition
   - Defined payload structure for different Facet types (PositionPayload, MarkFacetPayload, ExitPayload)
   - Implemented discriminator field approach using `type` field in payloads (e.g., `type: 'PositionFacet'`)
   - Implemented type guards: `isPositionPayload`, `isMarkFacetPayload`, `isExitPayload`, `isStandardFacetPayload`, `isStandardFacetData`
   - Created comprehensive unit tests in `dataTypes/facet.test.ts`
3. ✅ **Create initial type definitions**
   - Created `abstract.ts` with `StandardFacet` and `FacetList` interface definitions (similar to `StandardReference` and `ReferenceList`)
   - Defined `FacetListData<TPayload>` type for serialization
   - Created `AGENT.md` with overview of keys directory ecosystem
   - Created `AGENT.facets.md` with comprehensive Facet documentation including key differences from References
   - Documented composition pattern, payload types, and Replace operations

### Phase 2: Move Existing Key/Reference Code

**Goal**: Relocate existing code to the new directory structure without breaking functionality.

1. ✅ **Move `StandardKey`**
   - ✅ Move class from `components/reference.ts` to `keys/key.ts` (or `keys/index.ts`)
   - ✅ Update all imports across codebase
   - ✅ Run tests to ensure no regressions
2. ✅ **Move `StandardReference`**
   - ✅ Move class from `components/reference.ts` to `keys/reference.ts` (or consolidate with key.ts)
   - ✅ Update all imports across codebase
   - ✅ Run tests to ensure no regressions
3. ✅ **Move `ReferenceList`**
   - ✅ Move class from `components/reference.ts` to `keys/referenceList.ts`
   - ✅ Move related documentation (`AGENT.referenceList.md`, `AGENT.referenceList.editAlgebra.md`)
   - ✅ Update all imports across codebase
   - ✅ Run tests to ensure no regressions
4. ✅ **Update data type exports**
   - ✅ Move `StandardKeyData`, `StandardReferenceData`, `ReferenceListData` to `keys/dataTypes/`
   - ✅ Update imports in data type files
   - ✅ Ensure backward compatibility for exports

### Phase 3: Implement StandardFacet Core

**Goal**: Implement the core `StandardFacet` class with basic functionality.

1. **Implement `StandardFacet<TPayload>` class**
   - Generic class parameterized by payload type: `StandardFacet<TPayload extends StandardFacetPayload>`
   - **Compose** a `StandardReference` (following the StandardReference/StandardKey composition pattern)
   - Getters to access composed reference: `reference`, `standardKey`, `ref`, `tag`, etc. (similar to `StandardReference.standardKey`)
   - Typed payload data storage and access
   - Constructor(s) for different input formats (JSON, schema tree, etc.)
   - Handle Replace operations for payload changes (which `StandardReference` rejects)
   - `toJSON()`, `clone()`, `equals()`, `sameKey()` methods
   - `merge()` and `diff()` methods that combine ref arithmetic (from reference) with payload Replace logic
   - Schema generation supporting both ref-based Add/Remove and payload Replace operations
2. **Implement Facet payload types**
   - Define concrete payload structures for different Facet kinds:
     - `PositionPayload`: `{ type: 'PositionFacet', x: number; y: number }`
     - `MarkFacetPayload`: `{ type: 'MarkFacet', narrative: string; embedding?: number[]; ... }`
     - `ExitPayload`: `{ type: 'ExitFacet', description?: string }`
   - Payload types implement `StandardFacetPayload` interface/type
   - Implement payload validation
   - Implement type guards: `isPositionPayload(arg: any): arg is PositionPayload`, etc.
   - Type guards use discriminator fields (e.g., `type: 'PositionFacet'`) in payloads
3. **Write unit tests for `StandardFacet`**
   - Test construction from various formats
   - Test serialization/deserialization
   - Test equality and key matching
   - Test payload access and modification
   - Test ref-based Add/Remove operations
   - Test payload Replace operations

### Phase 4: Implement FacetList

**Goal**: Create a collection type for managing Facets, similar to `ReferenceList`.

1. **Implement `FacetList<TPayload>` class**
   - Generic class: `FacetList<TPayload extends StandardFacetPayload>`
   - Similar structure to `ReferenceList`
   - Store collection of `StandardFacet<TPayload>` objects
   - Constructor(s) for arrays, JSON, schema trees
   - Deduplication logic (by facet key + type)
   - `toJSON()`, `clone()`, `equals()` methods
   - Type-safe access: `FacetList<PositionPayload>`, `FacetList<MarkFacetPayload>`, etc.
2. **Implement FacetList operations**
   - `merge()` - Combine two FacetLists (combines ref arithmetic with payload Replace logic)
   - `diff()` - Compute difference between two FacetLists
   - `invert()` - Invert edit operations
   - `mapContents()`, `toFormat()`, `lookup()` - Transform operations
   - FacetList merge/diff algebra combines ref-based operations with payload Replace semantics
3. **Write unit tests for `FacetList`**
   - Test construction and serialization
   - Test merge/diff/invert operations
   - Test lookup and transformation methods
   - Document edit algebra properties (ref arithmetic + payload Replace)

### Phase 5: Integrate Facets into Component System

**Goal**: Add Facet support to component classes, starting with Examples.

1. **Add FacetList to Example component**
   - Add `marks: FacetList<MarkFacetPayload>` field to `StandardExamplePayload`
   - Update `StandardExampleData` type to include marks
   - Implement serialization/deserialization
   - Update merge/diff/invert operations
2. **Update component factory/schema handling**
   - Support parsing Facets from WML schema
   - Support parsing Facets from JSON
   - Update schema converters
3. **Write integration tests**
   - Test Examples with Mark Facets
   - Test serialization round-trip
   - Test merge/diff operations with Facets

### Phase 6: Refactor Existing Patterns (Optional/Deferred)

**Goal**: Consider whether existing ad-hoc patterns should migrate to Facets.

**Note**: This phase is explicitly deferred. Current patterns (StandardPosition, StandardExit) work and may have domain-specific needs. Migration to Facets should be evaluated separately based on:
- Consistency benefits
- Code simplification
- Backward compatibility concerns
- Specific domain requirements

Potential candidates for future consideration:
- `StandardPosition` → Position Facet on Maps
- `StandardExit` → Exit Facet on Rooms
- Other "reference + data" patterns

### Phase 7: Documentation and Cleanup

**Goal**: Ensure documentation is updated and code is clean.

1. **Update architecture documentation**
   - Document Facet concept in `components/AGENT.md`
   - Create `keys/AGENT.md` documenting key/reference/facet types
   - Document FacetList edit algebra (ref arithmetic + payload Replace)
2. **Update usage documentation**
   - Add examples of using Facets in `AGENT.usage.md`
   - Document Facet types and payload structures
3. **Code cleanup**
   - Remove deprecated patterns (if any)
   - Ensure consistent naming
   - Review and update comments

## Implementation Principles

- **Incremental**: Each phase should be independently testable and deployable
- **Backward Compatible**: Moving existing code should not break existing functionality
- **Test-Driven**: Write tests as you implement, not after
- **Documentation**: Update documentation as you go, not at the end
- **Tactical Focus**: Each phase should be small enough to complete in a focused session

## Notes for Plan Mode

When using Plan mode to tackle individual phases:

1. **Start with Phase 1 or Phase 2** - Set up the foundation first
2. **Focus on one phase at a time** - Don't mix phases
3. **Run tests frequently** - Catch regressions early
4. **Update imports incrementally** - Use IDE refactoring tools where possible
5. **Consider dependency order** - Some tasks within a phase may have dependencies

## Design Decision: Generic StandardFacet

**Decision**: `StandardFacet` and `FacetList` will be implemented as **generic types** parameterized by payload type.

### Rationale

Making `StandardFacet<TPayload>` generic provides:
- **Type Safety**: Compile-time type checking for payload access (e.g., `FacetList<PositionPayload>` ensures `x` and `y` are accessible)
- **Better Developer Experience**: IDE autocomplete and type errors for payload fields
- **Practical Usage**: Enables type-safe usage like `StandardMap.rooms: FacetList<PositionPayload>`
- **Alignment with Patterns**: Matches TypeScript best practices and the pattern where different payload types have distinct structures

### Implementation Approach

- `StandardFacet<TPayload extends StandardFacetPayload>` - Generic class with typed payload
- `FacetList<TPayload extends StandardFacetPayload>` - Generic collection containing `StandardFacet<TPayload>[]`
- Concrete payload types: `PositionPayload`, `MarkFacetPayload`, `ExitPayload`, etc.
- Runtime facet type field still needed for serialization/deserialization and WML parsing

### Composition Pattern (Following StandardReference/StandardKey Precedent)

**Decision**: `StandardFacet<TPayload>` will use **composition** with `StandardReference`, not inheritance.

**Rationale**: Following the same design pattern as `StandardReference` composes `StandardKey` (rather than extending it), `StandardFacet` will compose `StandardReference` because:
- `StandardFacet` needs different semantics (Replace operations for payload changes, which `StandardReference` rejects)
- Different merge/diff behavior (combining ref arithmetic with payload Replace logic)
- Different schema generation requirements
- Avoids fighting the base class design and excessive method overrides

**Structure**:
```typescript
class StandardFacet<TPayload> {
  private _reference: StandardReference;  // Composed reference
  payload: TPayload;  // Self-describing payload with type discriminator (e.g., type: 'PositionFacet')
  
  // Getters to access composed reference (following StandardReference.standardKey pattern)
  get reference(): StandardReference { return this._reference; }
  get standardKey(): StandardKey { return this._reference.standardKey; }
  get ref(): number { return this._reference.ref; }
  get tag(): ComponentTag { return this._reference.tag; }
  // ... other reference properties accessed via getters
}
```

This mirrors how `StandardReference.standardKey` provides access to the key information without extending `StandardKey`.

### Implications for Other Design Questions

This decision answers:
- **Payload structure (Question 3)**: ✅ Use generic/type-parameterized approach
- **Edit operations (Question 2)**: ✅ Facets will have ref-based Add/Remove operations (like References) via composition, plus Replace operations for payload changes
- **Inheritance vs Composition**: ✅ Use composition (following StandardReference/StandardKey precedent)
- **Facet type representation (Question 1)**: ✅ Type guards with discriminator fields in payloads (payloads self-describe via `type` field)
- **FacetList naming (Question 4)**: ✅ Per-type FacetLists with no 'facets' suffix in field names - `marks: FacetList<MarkFacetPayload>`, `positions: FacetList<PositionPayload>` (no heterogenous FacetLists)

## Open Questions / Design Decisions Needed

1. ✅ **Facet type representation**: **DECIDED** - Type guards with discriminator fields in payloads
   - ✅ Payloads contain a `type` discriminator field (e.g., `type: 'PositionFacet'`, `type: 'MarkFacet'`)
   - ✅ Type guards (`isPositionPayload(arg: any): arg is PositionPayload`) check the discriminator field
   - ✅ More generic approach: payloads are self-describing, no separate facetType field needed
   - ✅ Works with TypeScript discriminated unions: `StandardFacetPayload = PositionPayload | MarkFacetPayload | ...`
   - See "Design Decision: Generic StandardFacet" section above for details
   
2. ✅ **Edit operations for Facets**: **DECIDED** - Facets will have Add/Remove operations via `ref` field (like References)
   - ✅ Facets compose a `StandardReference`, inheriting ref-based Add/Remove semantics
   - ✅ Payload changes use Replace operations (which References don't use, so there's space in the pragma)
   - ✅ FacetList merge/diff algebra combines ref arithmetic with payload Replace logic
   - See "Design Decision: Generic StandardFacet" section above for composition details

3. ✅ **Payload structure**: **DECIDED** - Use generic/type-parameterized approach
   - ✅ `StandardFacet<TPayload extends StandardFacetPayload>` 
   - ✅ `FacetList<TPayload>` for type-safe collections
   - ✅ Concrete payload types per use case (`PositionPayload`, `MarkFacetPayload`, etc.)
   - See "Design Decision: Generic StandardFacet" section above for details

4. ✅ **Naming**: Finalize FacetList field names in components - **DECIDED**
   - ✅ Facet type field: Using `type` discriminator in payload (resolved in Question 1)
   - ✅ **FacetList field names**: Per-type FacetLists, each restricted to the correct generic payload (no heterogenous FacetLists)
   - ✅ Field names do not include 'facets' suffix (e.g., `marks: FacetList<MarkFacetPayload>` rather than `_markFacets`)
   - ✅ Type safety: Each FacetList is parameterized by its specific payload type, ensuring compile-time type checking

5. ✅ **Backward compatibility**: For Phase 6 (refactoring existing patterns), what's the migration strategy? - **DECIDED**
   - ✅ Breaking change is fine and expected
   - ✅ No need for deprecation period or parallel support

## Success Criteria

The implementation is complete when:

- ✅ `StandardKey`, `StandardReference`, `ReferenceList` are located in `ts/standardize/keys/`
- ✅ `StandardFacet` and `FacetList` are implemented and tested
- ✅ Examples can use Mark Facets to reference Marks with state descriptions
- ✅ All existing functionality still works (no regressions)
- ✅ Documentation is updated
- ✅ Code is clean and follows existing patterns
