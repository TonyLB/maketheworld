# Component Edit Algebra Migration Plan

**⚠️ MIGRATION PLAN** - This document outlines the steps needed to migrate from the current implementation to align with the edit algebra requirements described in [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) and [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md).

## Current State vs. Target State

### Current State
- Components and reference lists support `Add`, `Remove`, and `Replace` operations
- `StandardReplace` and `StandardReferenceReplace` classes exist throughout the codebase
- Merge and diff operations don't consistently follow the mathematical properties described in the edit algebra documentation
- Inversion operations are not consistently implemented

### Target State
- Components and reference lists support only `Add` and `Remove` operations (Replace can be expressed as Add + Remove)
- All edit operations are invertible
- Merge and diff operations follow the algebraic properties (including non-associativity and non-idempotency for reference lists)
- Clear separation between reference impact and data payload impact for Remove operations

## Migration Strategy

This migration should proceed incrementally, starting with a single component type (`StandardRoomPayload`) as a prototype to validate the approach before extending to other components.

## Phase 1: Foundation and Prototype (StandardRoomPayload)

### 1.1 Create Inversion Infrastructure

**Tasks:**
- ✅ Create `invert()` method on `ReferenceList`
  - ✅ Implement the algebraic inversion: `{+ref1, -ref2}` → `{-ref1, +ref2}`
  - ✅ Add unit tests validating inversion distributes correctly across all references
  - ✅ Verify that `list.invert().invert()` returns a list equal to the original

- Create optional `invert()` method on `StandardComponent` interface
  - Define the interface method signature
  - Document that inversion should return a new component with all data fields and reference lists inverted
  - Note: Start with `StandardRoomPayload` implementation only

- Add `invert()` method to `StandardRoomPayload`
  - Implement inversion for `shortName` (using `StandardLiteral.invert()` if available)
  - Implement inversion for `exits` (if they support inversion)
  - Implement inversion for `features`, `examples`, `characters` using `ReferenceList.invert()`
  - Add comprehensive unit tests

**Success Criteria:**
- ✅ All ReferenceList instances can be inverted
- StandardRoomPayload can be inverted
- `room.invert().invert()` produces a room equivalent to the original (within merge equivalence)

### 1.2 Remove Replace Operations (Phase 1: Reference Lists Only)

**Tasks:**
- Remove `StandardReferenceReplace` class
  - Delete `StandardReferenceReplace` class from `reference.ts`
  - Remove all references to `StandardReferenceReplace` from type definitions
  - Update `StandardReference` to only handle `Simple` and `Remove` operations
  - Update return types from merge/diff methods to exclude `StandardReferenceReplace`

- Update `ReferenceList` merge/diff to never produce Replace results
  - Ensure diff operations never produce Replace results (only Add/Remove)
  - Update merge logic to handle any legacy Replace input by converting to Add+Remove pairs
  - Add helper: `convertReplaceToAddRemove(referenceReplace: StandardReferenceReplace)` if needed for migration of existing data

- Update ReferenceList tests
  - Remove all tests involving `StandardReferenceReplace`
  - Add tests validating that Replace operations are converted to Add+Remove
  - Verify all existing functionality works with Add+Remove only

- Update documentation
  - Remove all references to `StandardReferenceReplace`
  - Update `AGENT.referenceList.md` to remove Replace mentions
  - Update type documentation

**Success Criteria:**
- `StandardReferenceReplace` class completely removed from codebase
- ReferenceList operations only produce Add/Remove results
- All existing tests pass with Add+Remove operations only
- No references to Replace operations remain in ReferenceList code

### 1.3 Align StandardRoomPayload with Edit Algebra

**Tasks:**
- Update `StandardRoomPayload.merge()` to follow algebraic properties
  - Ensure merge respects non-associativity (document order requirements)
  - Validate that data payload merging follows inversion principles
  - Ensure reference list merging delegates to ReferenceList.merge() (which handles non-associativity)

- Update `StandardRoomPayload.diff()` to use algebraic relationship
  - Implement `diff(incoming)` as `incoming.merge(this.invert())`
  - Add unit tests validating `a.diff(b)` produces `x` such that `a.merge(x) = b`
  - Verify diff results are correct for all field types

- Extend unit tests for StandardRoomPayload
  - Add tests for inversion operations
  - Add tests validating merge algebraic properties (with order dependencies)
  - Add tests validating diff algebraic relationship
  - Add tests for edge cases (empty rooms, rooms with only references, etc.)

**Success Criteria:**
- StandardRoomPayload merge/diff operations align with edit algebra documentation
- All algebraic relationships are validated by tests
- Existing functionality preserved (backward compatible)

## Phase 2: Component-Level Replace Removal

**Note:** Phase 2 should begin only after Phase 1 is complete and validated.

### 2.1 Remove StandardReplace

**Tasks:**
- Remove `StandardReplace` class
  - Delete `StandardReplace` class from `edits.ts`
  - Remove all type definitions referencing `StandardReplace`
  - Update `StandardComponentData` type to exclude `StandardReplaceData`

- Identify and update all `StandardReplace` usages
  - Search codebase for `StandardReplace` instantiation
  - Convert each usage to equivalent Add+Remove operations
  - Update `processComponents.ts` to handle Add+Remove instead of Replace
  - Update `componentFactory.ts` to never create Replace instances

### 2.2 Update Component Processing

**Tasks:**
- Update `processComponents.ts` to remove Replace handling
  - Remove all Replace tag processing logic
  - Update to handle only Add and Remove operations
  - Ensure reference handling preserves correct parent-child relationships
  - Update cascade graph handling for Add+Remove operations

- Update `componentFactory.ts` to remove Replace handling
  - Remove Replace creation logic
  - Ensure factory methods never create Replace instances
  - Update type guards to exclude Replace

### 2.3 Migration of External Dependencies

**Tasks:**
- Update tests that use `StandardReplace`
  - Convert test cases to use Add+Remove instead
  - Ensure test expectations still pass
  - Add new tests for the converted operations

- Update UI/editor code that creates Replace operations
  - Modify editors to create Add+Remove pairs instead
  - Update diff display logic if needed

## Phase 3: Extend to Other Components

**Tasks:**
- Implement `invert()` for other component types
  - StandardFeature
  - StandardCharacter
  - StandardExample
  - StandardKnowledge
  - StandardMessage
  - StandardMoment
  - StandardExit (if not already done)

- Align all component merge/diff operations
  - Apply same patterns validated in StandardRoomPayload
  - Ensure consistency across all component types

## Identified Future Work (To Be Validated During Phase 1)

### Potential Additional Steps

1. **Schema/Serialization Updates**
   - Update WML schema handling to remove Replace tag support
   - Update schema validation to reject Replace tags
   - Convert any existing Replace tags in WML files to Add+Remove pairs (during load/migration)

2. **Diff Visualization and Tooling**
   - UI components that display diffs may need updates
   - Diff rendering logic might need changes to handle Add+Remove pairs instead of Replace

3. **Performance Considerations**
   - Evaluate performance impact of converting Replace to Add+Remove
   - Consider caching strategies for inversion operations if needed

4. **Documentation Updates**
   - Update all documentation to reflect Remove-only edit model
   - Remove examples using Replace operations
   - Update API documentation

### Decisions to Make After Prototyping

1. **WML Schema Updates**
   - Update WML schema to remove `<Replace>` tag support
   - Decide how to handle existing WML files that contain Replace tags (convert on load, error, etc.)
   - Update schema validation to reject Replace tags

2. **Serialization Format**
   - Remove Replace support from serialization formats
   - Ensure JSON serialization never produces Replace data structures

3. **Error Handling**
   - How should we handle legacy Replace operations in incoming data?
   - What warnings/errors should we provide to developers?

4. **Testing Strategy**
   - How comprehensive should replacement conversion tests be?
   - Should we maintain parallel test suites during migration?

## Approach: Iterative Validation

**Phase 1 (StandardRoomPayload prototype) is intentionally scoped to:**
- Validate the inversion approach works correctly
- Ensure merge/diff algebraic relationships hold in practice
- Identify any edge cases or issues not visible in design
- Establish patterns and conventions for other components

**After Phase 1 completion:**
- Review what was learned
- Adjust migration plan for Phase 2 and 3
- Make decisions about backward compatibility and external APIs
- Validate that patterns established in Phase 1 scale to other components

## Related Documentation

- [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) - Mathematical properties of component edit operations
- [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList operations
- [`AGENT.md`](./AGENT.md) - Conceptual overview of Components
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Current implementation details
- [`AGENT.referenceList.md`](./AGENT.referenceList.md) - ReferenceList usage and architecture
