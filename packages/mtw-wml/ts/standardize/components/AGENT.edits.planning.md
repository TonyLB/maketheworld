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

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Create `invert()` method on `ReferenceList`
  - ✅ Implement the algebraic inversion: `{+ref1, -ref2}` → `{-ref1, +ref2}`
  - ✅ Add unit tests validating inversion distributes correctly across all references
  - ✅ Verify that `list.invert().invert()` returns a list equal to the original

- ✅ Create optional `invert()` method on `StandardComponent` interface
  - ✅ Define the interface method signature
  - ✅ Added `invert?(): StandardComponent` to `StandardComponent` interface
  - ✅ Added `invert?(): this` to `ComponentConstructorMethods` interface
  - Note: `StandardRoomPayload` implementation completed

- ✅ Add `invert()` method to `StandardRoomPayload`
  - ✅ Implement inversion for `shortName` using `StandardLiteral.invert()`
  - ✅ Implement inversion for `exits` using `StandardExit.invert()` (from `v2StandardEditableFactory`)
  - ✅ Implement inversion for `features`, `examples`, `characters` using `ReferenceList.invert()`
  - ✅ Add comprehensive unit tests

- ✅ Add supporting inversion infrastructure
  - ✅ Add `invert()` method to `v2StandardEditableFactory` (for `StandardExit` and other editable types)
  - ✅ Add `invert()` method directly to `StandardLiteral`

**Success Criteria:**
- ✅ All ReferenceList instances can be inverted
- ✅ StandardRoomPayload can be inverted
- ✅ `room.invert().invert()` produces a room equivalent to the original (within merge equivalence)

### 1.2 Refactor Component Storage to Plain Components Only

**Status:** 🔄 **IN PROGRESS**

**Overview:** Align component storage architecture with edit algebra principles. According to [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md), components should always be stored as plain components with edits distributed internally. Remove tags should only appear in references (within `ReferenceList`), not as wrapper classes around components.

**Tasks:**

- ✅ Refactor `processComponents` to return only plain `StandardComponent` items
  - ✅ Update `processComponents.ts` to handle component-level `<Remove>` tags by storing the Remove operation in the parent's `ReferenceList` (as `{-componentKey}`) rather than wrapping the component in a `StandardRemove` class
  - ✅ When processing `<Remove><Component>...</Component></Remove>`, distribute any Remove operations from component content into the component's internal fields, then store the component as plain
  - ✅ Store the Remove tag only at the reference level in the parent's `ReferenceCollection`
  - ✅ Handle `<Replace>` tags by converting them to equivalent Add+Remove pairs during processing (currently throws error, which is correct for future deprecation)
  - ✅ Update return type `ComponentProcessingResult` to guarantee it only contains plain components (using `StandardComponentNonEdit` type)
  - ✅ Note: Empty/no-op Remove operations will naturally result in no storage (inverting empty components produces empty, merging empty is a no-op)

- ✅ Remove `StandardRemove` and `StandardReplace` classes
  - ✅ Delete `StandardRemove` class from `edits.ts`
  - ✅ Delete `StandardReplace` class from `edits.ts`
  - ✅ Delete `edits.ts` file entirely (merged functionality into `mergeToComponentList.ts`)
  - ✅ Delete `edits.test.ts` file
  - ✅ Remove all type definitions referencing `StandardRemove` and `StandardReplace`
  - ✅ Update `StandardComponentData` type to exclude `StandardRemoveData` and `StandardReplaceData`
  - ✅ Remove imports of `StandardRemove` and `StandardReplace` throughout the codebase

- Update merge and diff operations accordingly
  - ✅ Update `StandardForm.merge()` to handle only plain components (no `StandardRemove` or `StandardReplace` input)
  - ✅ Update merge logic to handle reference-level Remove operations (from `ReferenceList`) correctly
    - ✅ Merge method now filters incoming `topLevel` to only preserve `StandardReferenceRemove` references
    - ✅ Simple references in incoming are treated as in-place edits and will be re-added by `_updateTopLevelFromComponents()` if needed
    - ✅ Integrated `_updateTopLevelFromComponents()` after `generateImplicitParents()` to synchronize `topLevel` with component state
  - Update diff operations to return only plain components with reference-level edits stored in `ReferenceCollection`
  - Update cascade graph handling to work with the new storage model
  - Note: Merging plain components using inversion/merge approach will naturally produce only plain components (no Replace operations possible)

- ✅ Update component factory and related utilities
  - ✅ Update `componentFactory.ts` to never create `StandardRemove` or `StandardReplace` instances (removed from comment)
  - ✅ Update type guards to exclude `StandardRemove` and `StandardReplace`
  - ✅ Update utility functions that handle component processing (merged `mergeWithEdits` into `mergeToComponentList.ts`)

- ✅ Update tests and test expectations
  - ✅ Update `processComponents` tests to expect only plain components in results
  - ✅ Convert test cases that use `StandardRemove` or `StandardReplace` to the new model (removed from `edits.test.ts`, `room.test.ts`, `character.test.ts`)
  - ✅ Update merge/diff tests to verify they never produce Replace operations
  - ✅ Verify existing functionality still works with the new storage model

**Success Criteria:**
- `processComponents` returns only plain `StandardComponent` instances
- `StandardRemove` and `StandardReplace` classes completely removed from codebase
- Component-level Remove operations are stored only in parent's `ReferenceList` (as `{-key}`)
- Merge operations never create `StandardReplace` instances
- All existing tests pass with the new storage model
- No-op Remove operations are not stored in `_components`

### 1.3 Prevent Replace Operations (Phase 1: Reference Lists Only)

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Prevent `StandardReferenceReplace` creation in merge/diff operations
  - ✅ Updated `standardReferenceDiff()` to throw `MergeConflictError` when references point to different components
  - ✅ Updated `standardReferenceAdd()` to validate key consistency and throw errors when attempting to change target components
  - ✅ References can now only transition between add/remove/undefined states, never change target components
  - Note: `StandardReferenceReplace` class still exists for backward compatibility (loading from WML/JSON), but merge/diff operations will never create it

- ✅ Update `ReferenceList` merge/diff to never produce Replace results
  - ✅ Diff operations now throw errors instead of producing Replace results when keys differ
  - ✅ Merge operations validate that references point to the same component
  - ✅ Legacy Replace input from WML/JSON is still supported for loading, but won't be created by operations

- ✅ Update ReferenceList tests
  - ✅ Updated tests that expected Replace operations from key changes to expect errors instead
  - ✅ Added tests verifying error behavior when attempting to change reference targets
  - ✅ Added tests verifying that same-component references with different key representations merge/diff correctly

- ✅ Update documentation
  - ✅ Updated `AGENT.referenceList.md` to document that references cannot change target components
  - ✅ Clarified that Replace operations are deprecated/not created by merge/diff
  - ✅ Added section explaining error conditions for merge/diff operations

**Success Criteria:**
- ✅ Merge/diff operations throw errors instead of creating Replace operations when attempting to change target components
- ✅ References can only be added or removed, never replaced with different targets
- ✅ All existing tests pass with updated expectations
- ✅ Documentation reflects the new constraints
- Note: `StandardReferenceReplace` class remains for backward compatibility but is no longer created by operations

### 1.3.2 Remove StandardReferenceReplace Class

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Remove `StandardReferenceReplace` class
  - ✅ Deleted `StandardReferenceReplace` class from `reference.ts`
  - ✅ Removed all references to `StandardReferenceReplace` from type definitions
  - ✅ Updated `StandardReference` to only handle `Simple` and `Remove` operations
  - ✅ Updated return types from merge/diff methods to exclude `StandardReferenceReplace`
  - ✅ Removed `StandardReferenceReplace` from imports and exports

- ✅ Rebuild `StandardReference` without `standardEditableFactory`
  - ✅ Rebuilt `StandardReferenceSimple` constructor to directly parse WML/JSON/schema without factory
  - ✅ Rebuilt `StandardReferenceRemove` constructor to directly parse WML/JSON/schema without factory
  - ✅ Updated `StandardReference` constructor to parse directly without factory
  - ✅ Implemented direct merge/diff logic using `addDelta`/`diffDelta` helpers (exported from `editable/index.ts`)
  - ✅ Removed factory imports and dependencies from `reference.ts`
  - ✅ Updated `fromDelta` to throw error when both `add` and `remove` are present (Replace operations are illegal)

- ✅ Update code that handles Replace operations from WML/JSON
  - ✅ **Note:** Component-level Replace operations already throw errors (handled in `processComponents.ts`), so we only need to handle reference-level Replace operations
  - ✅ **For WML (reference-level Replace tags):** Throw error immediately when encountered
    - ✅ Updated `StandardReference` constructor to check for Replace tags in WML strings and throw error
    - ✅ Updated `StandardReferenceSimple` and `StandardReferenceRemove` constructors to check for Replace tags in schema and throw errors
  - ✅ **For JSON:** Throw error immediately when encountering Replace operations
    - ✅ Updated `StandardReference` constructor to check for Replace JSON structures (`{ tag: 'Replace', ... }`) and throw error
    - ✅ Replace operations are now illegal in both WML and JSON for references

- ✅ Update ReferenceList and related utilities
  - ✅ Removed `StandardReferenceReplace` handling from `mapContents()`, `lookup()`, `toFormat()`, `invert()`, `equal()`, etc.
  - ✅ Updated type guards to exclude `StandardReferenceReplace`
  - ✅ Removed all conditional logic that checks for `instanceof StandardReferenceReplace`
  - ✅ Updated `childReferenceFactory` in `utils/references.ts` to remove Replace handling

- ✅ Update tests
  - ✅ Removed all tests that create or use `StandardReferenceReplace` instances
  - ✅ Added tests verifying that Replace operations from WML throw errors
  - ✅ Added tests verifying that Replace operations from JSON throw errors
  - ✅ Added tests verifying that `fromDelta` throws error when both add and remove are present
  - ✅ Moved constructor error test from `editableList.test.ts` to `reference.test.ts` (ReferenceList-specific tests)
  - ✅ Removed merge test that attempted to use Replace data (couldn't run because constructor throws)
  - ✅ Ensured all existing functionality works without Replace operations

- ✅ Update documentation
  - ✅ Removed all references to `StandardReferenceReplace` from documentation
  - ✅ Updated `AGENT.referenceList.md` to clarify that Replace operations are illegal and throw errors
  - ✅ Updated type documentation to reflect only Simple and Remove operations
  - ✅ Clarified that `standardEditableFactory` is for content editing only (not references)

**Success Criteria:**
- ✅ `StandardReferenceReplace` class completely removed from codebase
- ✅ All Replace operations from WML/JSON throw errors (no conversion)
- ✅ `StandardReference` rebuilt without `standardEditableFactory` dependency
- ✅ All existing tests pass without Replace operations
- ✅ No references to Replace operations remain in ReferenceList code
- ✅ Type system reflects only Simple and Remove operations
- ✅ Error messages are consistent: "Replace operations are illegal for references. References can only be added or removed, not replaced."

### 1.4 Align StandardRoomPayload with Edit Algebra

**Status:** ✅ **COMPLETE** (with minor gap)

**Tasks:**
- ✅ Update `StandardRoomPayload.merge()` to follow algebraic properties
  - ✅ Ensure merge respects non-associativity (document order requirements)
  - ✅ Validate that data payload merging follows inversion principles
  - ✅ Ensure reference list merging delegates to ReferenceList.merge() (which handles non-associativity)
  - ✅ Implemented in `StandardRoomPayload.merge()` - delegates to `ReferenceList.merge()` for features, examples, characters

- ✅ Update `StandardRoomPayload.diff()` to use algebraic relationship
  - ✅ Implement `diff(incoming)` as `incoming.merge(this.invert())`
  - ✅ Implemented in base `componentClassFactory` class (component.ts line 365-371): `diff(a, b) = b.merge(a.invert())`
  - ⚠️ Add unit tests validating `a.diff(b)` produces `x` such that `a.merge(x) = b` (explicit algebraic relationship tests not yet present)

- ✅ Extend unit tests for StandardRoomPayload
  - ✅ Add tests for inversion operations (room.test.ts lines 705-796)
  - ✅ Add tests for diff operations (room.test.ts lines 359-373, 620-637)
  - ⚠️ Add tests validating merge algebraic properties (with order dependencies) - basic merge tests exist but order dependency tests may be incomplete
  - ⚠️ Add tests validating diff algebraic relationship - diff tests exist but explicit `a.merge(a.diff(b)) = b` validation not present
  - ✅ Add tests for edge cases (empty rooms, rooms with only references, etc.) - covered in inversion tests

**Success Criteria:**
- ✅ StandardRoomPayload merge/diff operations align with edit algebra documentation
- ⚠️ All algebraic relationships are validated by tests (core implementation complete, explicit algebraic relationship tests could be added)
- ✅ Existing functionality preserved (backward compatible)

## Phase 2: Component-Level Replace Removal

**Status:** ✅ **COMPLETE**

**Note:** Phase 2 was completed as part of Phase 1.2 (Refactor Component Storage to Plain Components Only).

### 2.1 Remove StandardReplace

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Remove `StandardReplace` class
  - ✅ Deleted `StandardReplace` class from `edits.ts` (completed in Phase 1.2)
  - ✅ Removed all type definitions referencing `StandardReplace`
  - ✅ Updated `StandardComponentData` type to exclude `StandardReplaceData` (baseClasses.ts line 24: `StandardComponentData = StandardComponentNonEditData`)

- ✅ Identify and update all `StandardReplace` usages
  - ✅ Searched codebase for `StandardReplace` instantiation - none found in component code
  - ✅ Converted usages to equivalent Add+Remove operations (completed in Phase 1.2)
  - ✅ Updated `processComponents.ts` to throw error for Replace tags (processComponents.ts line 90)
  - ✅ Updated `componentFactory.ts` to never create Replace instances (no Replace handling in factory)

**Success Criteria:**
- ✅ `StandardReplace` class completely removed from component codebase
- ✅ `StandardComponentData` excludes `StandardReplaceData`
- ✅ No `StandardReplace` instantiation in component code
- ✅ `processComponents.ts` rejects Replace tags with error

### 2.2 Update Component Processing

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Update `processComponents.ts` to remove Replace handling
  - ✅ Removed all Replace tag processing logic (throws error on Replace tags)
  - ✅ Updated to handle only Add and Remove operations
  - ✅ Reference handling preserves correct parent-child relationships
  - ✅ Cascade graph handling works with Add+Remove operations

- ✅ Update `componentFactory.ts` to remove Replace handling
  - ✅ Removed Replace creation logic (no Replace handling in factory)
  - ✅ Factory methods never create Replace instances
  - ✅ Type guards exclude Replace (StandardComponentData = StandardComponentNonEditData)

**Success Criteria:**
- ✅ `processComponents.ts` throws error for Replace tags
- ✅ `componentFactory.ts` never creates Replace instances
- ✅ All component processing uses only Add and Remove operations

### 2.3 Migration of External Dependencies

**Status:** ✅ **COMPLETE** (for component code)

**Tasks:**
- ✅ Update tests that use `StandardReplace`
  - ✅ Converted test cases to use Add+Remove instead (completed in Phase 1.2)
  - ✅ Test expectations updated and passing
  - ✅ New tests added for Add+Remove operations

- ⚠️ Update UI/editor code that creates Replace operations
  - ⚠️ Status unknown - UI/editor code is outside this package scope
  - ⚠️ May need verification in client codebase
  - Note: Component-level Replace operations are rejected at the `processComponents` level, so any UI attempts to create them will fail with clear error

**Success Criteria:**
- ✅ Component tests no longer use `StandardReplace`
- ⚠️ UI/editor code status unknown (outside package scope)
- ✅ Component processing layer rejects Replace operations with clear error

## Phase 3: Extend to Other Components

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Implement `invert()` for other component types
  - ✅ StandardFeature - Added `invert()` to `StandardFeaturePayload` and wrapper class
  - ✅ StandardCharacter - Added `invert()` to `StandardCharacterPayload` and wrapper class
  - ✅ StandardExample - Already implemented in Phase 1
  - ✅ StandardKnowledge - Added `invert()` to `StandardKnowledgePayload` and wrapper class
  - ✅ StandardMessage - Added `invert()` to `StandardMessagePayload` and wrapper class
  - ✅ StandardMoment - Added `invert()` to `StandardMomentPayload` and wrapper class
  - ✅ StandardExit - Already has `invert()` from `v2StandardEditableFactory` (implemented in Phase 1)

- ✅ Align all component merge/diff operations
  - ✅ Applied same patterns validated in StandardRoomPayload
  - ✅ Ensured consistency across all component types
  - ✅ All implementations follow the established pattern: invert StandardLiteral, StandardRender, ReferenceList, and arrays of editables
  - ✅ Added wrapper class overrides for type consistency (matching StandardExample pattern)

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

**Status:** ✅ **DECISIONS MADE**

1. **WML Schema Updates**
   - ✅ **Decision:** Replace tags are still parsed by the WML schema (for backwards compatibility and content-level editing contexts like `StandardLiteral`, `StandardRender`)
   - ✅ **Decision:** Replace tags throw errors when used at component or reference level
   - ✅ **Implementation:** `processComponents.ts` throws error: "Replace tags are not permitted at component level"
   - ✅ **Implementation:** `StandardReference` constructors throw error: "Replace operations are illegal for references. References can only be added or removed, not replaced."
   - ✅ Schema validation rejects Replace tags for components/references with clear error messages

2. **Serialization Format**
   - ✅ **Decision:** JSON serialization never produces Replace data structures (merge/diff operations don't create them)
   - ✅ **Implementation:** Component merge/diff operations never create Replace operations
   - ✅ **Implementation:** Reference merge/diff operations throw errors instead of creating Replace
   - Note: Replace is still supported for content-level editing (StandardLiteral, StandardRender, etc.) but not for components/references

3. **Error Handling**
   - ✅ **Decision:** Replace operations throw clear errors immediately when encountered (no conversion)
   - ✅ **Implementation:** Component-level Replace tags throw error: "Replace tags are not permitted at component level"
   - ✅ **Implementation:** Reference-level Replace tags throw error: "Replace operations are illegal for references. References can only be added or removed, not replaced."
   - ✅ Error messages are consistent and informative for developers

4. **Testing Strategy**
   - ✅ **Decision:** Tests verify error behavior when Replace operations are encountered (no conversion testing needed)
   - ✅ **Implementation:** Added tests verifying Replace operations from WML throw errors
   - ✅ **Implementation:** Added tests verifying Replace operations from JSON throw errors
   - ✅ No parallel test suites needed - error behavior is straightforward and well-tested

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

## Phase 4: SchemaOrganization Refactor - Component Hierarchy and Rendering

**Status:** 📋 **PLANNING**

**Overview:** Refactor component hierarchy management and schema rendering to separate concerns between `StandardForm` (content orchestration) and `SchemaOrganization` (hierarchy/layout). This refactor will make `SchemaOrganization` the single source of truth for parentage information, enable components to make local decisions about rendering in parent contexts, and localize `ref={0}` reference assurance to component-level logic.

**Goals:**
- Make `SchemaOrganization` the sole authority for implicit/explicit parentage
- Remove graph-building and parentage computation logic from `StandardForm`
- Enable components to determine "am I rendering in my parent context?" and "what are my children?" at render time
- Localize `ref={0}` reference assurance to a single `assureReferences` method per component
- Simplify `StandardForm` to focus on content orchestration (merge/diff/subset) rather than hierarchy management

**Key Design Decisions:**
- `assureReferences` is a pure function that returns a cloned-and-updated component
- `assureReferences` is called on-demand in `nestedSchema` (not pre-computed)
- `getChildrenOfParent` returns `StandardReference[]` (not `StandardKey[]`) to provide type information for component dispatch
- `assureReferences` accepts `StandardReference[]` directly (not full `OrganizationContext`)
- `ref={0}` becomes a first-class encoding, eliminating semantic-mode distinctions in parentage handling

### 4.1 Implement assureReferences on StandardComponent Interface

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Add optional `assureReferences?(children: StandardReference[]): this` method to `ComponentConstructorMethods` interface (payload classes)
  - ✅ Added to `ComponentConstructorMethods` interface in `component.ts`
  - ✅ Added JSDoc comment referencing detailed documentation in `AGENT.implementation.md`
- ✅ Add required `assureReferences(children: StandardReference[]): StandardComponent` method to `StandardComponent` interface
  - ✅ Added to `StandardComponent` interface in `baseClasses.ts`
  - ✅ Added JSDoc comment referencing detailed documentation
  - ✅ Documented that this is a pure function returning a cloned component
  - ✅ Documented delegation pattern (delegates to payload if available, otherwise returns unchanged)
- ✅ Implement `assureReferences` in `componentClassFactory`
  - ✅ Added implementation following the `invert()` delegation pattern
  - ✅ Delegates to payload's `assureReferences` if available
  - ✅ Returns instance unchanged if payload doesn't implement it (allows gradual rollout)
- ✅ Add comprehensive documentation to `AGENT.implementation.md`
  - ✅ Documented purpose, behavior, and component-specific dispatch patterns
  - ✅ Documented relationship to other operations and hierarchy integration
  - ✅ Documented implementation pattern and delegation behavior

**Success Criteria:**
- ✅ `assureReferences?()` method signature added to `ComponentConstructorMethods` interface
- ✅ `assureReferences()` method signature added to `StandardComponent` interface
- ✅ `assureReferences()` implementation added to `componentClassFactory` following `invert()` pattern
- ✅ Brief JSDoc comments added with reference to detailed documentation
- ✅ Comprehensive documentation added to `AGENT.implementation.md` explaining behavior, purpose, and patterns
- ✅ TypeScript compilation succeeds with new interface methods
- ✅ Components without payload `assureReferences` implementation return unchanged (allows gradual rollout)

### 4.2 Implement assureReferences for StandardRoomPayload (Prototype)

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Implement `assureReferences` on `StandardRoomPayload`
  - ✅ Accept `StandardReference[]` of children
  - ✅ Dispatch children to appropriate buckets (features, examples, characters) based on component tag using functional filter/map approach
  - ✅ For each child reference:
    - ✅ If reference already exists in the target bucket with non-zero ref, leave it unchanged (handled by `ReferenceList.merge`)
    - ✅ If reference doesn't exist in target bucket, add it with `ref={0}` (using `withRef(0)` and merging with `{ cleanEmptyReferences: false }`)
  - ✅ Return new `StandardRoomPayload` instance (pure function, no mutation)
- ✅ Refactor `ReferenceList.merge` to support `cleanEmptyReferences` option
  - ✅ Added optional `options?: { cleanEmptyReferences?: boolean }` parameter, defaulting to `true`
  - ✅ Updated `StandardReference.merge` and `StandardReferenceSimple.merge` to accept and pass through options
  - ✅ Updated `StandardReferenceSimple.merge` to preserve `ref={0}` when `cleanEmptyReferences: false` (using `this.withRef(0)`)
  - ✅ All existing call sites continue to work (backward compatible)
- ✅ Add comprehensive unit tests:
  - ✅ Empty children array
  - ✅ Children that already exist in buckets (with non-zero refs)
  - ✅ Children that need to be added with `ref={0}`
  - ✅ Mixed scenarios (some exist, some don't)
  - ✅ Verify returned component is a clone (original unchanged)
  - ✅ Verify idempotency: calling `assureReferences` multiple times with same children produces equivalent results
  - ✅ Verify correct bucket dispatch based on component tag
  - ✅ Added tests for `ReferenceList.merge` with `cleanEmptyReferences` option (default behavior and `false` option)

**Success Criteria:**
- ✅ `StandardRoomPayload.assureReferences()` implemented and tested
- ✅ `ReferenceList.merge` refactored to support `cleanEmptyReferences` option
- ✅ All tests pass, demonstrating pure function behavior
- ✅ Pattern established for other component types
- ✅ Backward compatibility maintained for existing `ReferenceList.merge` call sites

### 4.3 Extend assureReferences to Other Component Types

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Implement `assureReferences` for all component types that have reference lists:
  - ✅ `StandardFeature` (dispatches Example children to `_examples` bucket)
  - ✅ `StandardKnowledge` (dispatches Example children to `_examples` bucket)
  - ✅ `StandardMoment` (dispatches Message children to `_messages` bucket)
  - ✅ `StandardMessage` (dispatches Room children to `_rooms` bucket) - *initially omitted, added after completion*
  - ⚠️ `StandardMap` (for positions) - **Skipped**
    - ⚠️ **Note:** We do not currently handle having items parented to `Map` types, and cannot really `assureReferences` against `StandardPosition`. This may need to be implemented in the future.
- ✅ For each component:
  - ✅ Follow pattern established in `StandardRoomPayload`
  - ✅ Dispatch children to appropriate buckets based on component tag using functional filter/map approach
  - ✅ Add `ref={0}` only when reference doesn't exist (using `withRef(0)` and merging with `{ cleanEmptyReferences: false }`)
  - ✅ Return cloned component (pure function, no mutation)
- ✅ Add comprehensive unit tests for each component type:
  - ✅ Empty children array
  - ✅ Children that already exist in buckets (with non-zero refs)
  - ✅ Children that need to be added with `ref={0}`
  - ✅ Mixed scenarios (some exist, some don't)
  - ✅ Verify returned component is a clone (original unchanged)
  - ✅ Verify idempotency: calling `assureReferences` multiple times with same children produces equivalent results
  - ✅ Verify correct bucket dispatch based on component tag
  - ✅ Verify ignoring children with incorrect tags
- ⏳ Update `nestedSchema` implementations for each component type to use `assureReferences` (deferred to Phase 4.5)

**Success Criteria:**
- ✅ All component types with reference lists implement `assureReferences` (except `StandardMap` which is documented as future work)
- ✅ All implementations follow consistent pattern
- ✅ All tests pass
- ✅ `StandardMessage` added after initial completion (omission corrected)

### 4.4 Define OrganizationContext Interface

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Define `OrganizationContext` type with two methods:
  - ✅ `getImplicitParent(key: StandardKey): StandardKey | undefined`
  - ✅ `getChildrenOfParent(parent: StandardKey | AssetUUID): StandardReference[]`
- ✅ Add `getChildrenOfParent` method to `SchemaOrganization` class
  - ✅ Implemented logic to return all components that have the given parent (via implicit or explicit parentage)
  - ✅ Returns as `StandardReference[]` with appropriate reference types
  - ✅ Method signature: `getChildrenOfParent(parent: StandardKey | undefined): StandardReference[]` (uses `undefined` for AssetUUID, semantically equivalent)
  - ✅ Handles explicit parent precedence over implicit parent
  - ✅ Handles both component-level and asset-level parentage
- ✅ Create factory/helper to construct `OrganizationContext` from `SchemaOrganization`
  - ✅ Added `createOrganizationContext()` factory function in `schemaOrganization.ts`
  - ✅ Factory handles type conversion between `AssetUUID` (interface) and `undefined` (SchemaOrganization API)
  - ✅ Factory delegates both methods to underlying `SchemaOrganization` instance
- ✅ Add unit tests for `getChildrenOfParent` covering:
  - ✅ Top-level children (AssetUUID parent, represented as `undefined`)
  - ✅ Nested children (StandardKey parent)
  - ✅ Explicit parent vs implicit parent precedence
  - ✅ Empty parent cases (parent with no children, non-existent parent key)
  - ✅ Multiple children scenarios
  - ✅ Mixed explicit and implicit asset-level children
- ✅ Add unit tests for `createOrganizationContext` covering:
  - ✅ Factory returns object implementing `OrganizationContext`
  - ✅ `getImplicitParent` delegates correctly
  - ✅ `getChildrenOfParent` delegates correctly for `StandardKey` parent
  - ✅ `getChildrenOfParent` converts `AssetUUID` to `undefined` correctly
  - ✅ Works with existing `SchemaOrganization` instances

**Success Criteria:**
- ✅ `OrganizationContext` type defined with minimal, focused API
- ✅ `SchemaOrganization.getChildrenOfParent()` implemented and tested
- ✅ Factory method available to create `OrganizationContext` from `SchemaOrganization`

### 4.5 Update nestedSchema to Use OrganizationContext

**Status:** ✅ **COMPLETE**

**Tasks:**
- ✅ Add `organization?: OrganizationContext` to `NestedSchemaOptions` type
  - ✅ Added to `baseClasses.ts` in `NestedSchemaOptions` type definition
  - ✅ Keeps existing signature pattern while adding organization context
- ✅ Add `isParentContext` helper to `OrganizationContext` and `SchemaOrganization`
  - ✅ Added `isParentContext(childKey: StandardKey, parentCandidate: StandardKey | undefined): boolean` to `SchemaOrganization`
  - ✅ Added `isParentContext` to `OrganizationContext` interface
  - ✅ Implemented in `createOrganizationContext` factory
  - ✅ Handles explicit parent precedence over implicit parent
  - ✅ Handles asset-level cases (undefined parent)
- ✅ Update `componentClassFactory` default `nestedSchema` implementation:
  - ✅ Uses `options.organization?.isParentContext(target._key.plain, options.parent)` for parent context detection
  - ✅ Replaces manual parent context checks with helper function
  - ✅ All components now use consistent parent context detection logic
- ✅ Update payload `nestedSchema` implementations:
  - ✅ `StandardRoomPayload`: Uses `organization.getChildrenOfParent(key)` and `assureReferences(children)`
  - ✅ `StandardFeaturePayload`: Uses `organization.getChildrenOfParent(key)` and `assureReferences(children)`
  - ✅ `StandardKnowledgePayload`: Uses `organization.getChildrenOfParent(key)` and `assureReferences(children)`
  - ✅ `StandardMomentPayload`: Uses `organization.getChildrenOfParent(key)` and `assureReferences(children)`
  - ✅ Removed redundant `isParentContext` checks from payload implementations (handled by wrapper)
  - ✅ All payloads now use assured references from `organization` when available
- ✅ Update `renderReference` helper in `components/utils/schema.ts`:
  - ✅ Passes `organization: options.organization` through to nested `nestedSchema` calls
  - ✅ Ensures parent context propagates correctly through nested rendering
- ✅ Update `StandardForm.schema` getter:
  - ✅ Constructs `SchemaOrganization` from components
  - ✅ Creates `OrganizationContext` from `SchemaOrganization` using factory
  - ✅ Gets asset-level children from `organizationContext.getChildrenOfParent(assetUUID)`
  - ✅ Maps asset-level children to `ref.withRef(0)` for organizational references
  - ✅ Merges with existing `_topLevel` to preserve content-type references
  - ✅ Passes `organizationContext` to `renderReference` calls
- ⏳ Add unit tests for `nestedSchema` with `OrganizationContext`:
  - ⏳ Component rendering in its parent context (full contents)
  - ⏳ Component rendering outside parent context (reference only)
  - ⏳ Nested components with correct parent propagation

**Success Criteria:**
- ✅ `nestedSchema` accepts and uses `OrganizationContext` (via `NestedSchemaOptions.organization`)
- ✅ Components correctly determine parent context using `isParentContext` helper
- ✅ `ref={0}` references are assured via `assureReferences` when components render in their parent context
- ✅ All existing schema rendering tests pass with new implementation
- ⏳ Unit tests for `nestedSchema` with `OrganizationContext` (deferred - core functionality complete)

### 4.6 Converge StandardForm on SchemaOrganization for Parentage

**Status:** ⏳ **PENDING**

**Tasks:**
- Replace `StandardForm._buildComponentGraph()` with delegation to `SchemaOrganization._buildComponentGraph()`
  - Remove duplicate graph-building logic from `StandardForm`
  - Update all call sites to use `SchemaOrganization` instance
- Replace `StandardForm.generateImplicitParents()` with delegation to `SchemaOrganization._calculateImplicitParents()`
  - Remove duplicate implicit parent calculation from `StandardForm`
  - Update `StandardForm` to use `SchemaOrganization.getImplicitParent()` for any parent queries
  - Consider whether `implicitParent` should remain as a cached field on components or become purely derived from `SchemaOrganization`
- Update `StandardForm._updateTopLevelFromComponents()`:
  - Remove logic that pre-computes top-level references
  - This functionality will be handled by `assureReferences` at render time
  - Or, if top-level needs to be maintained for other operations, update it to use `SchemaOrganization.getChildrenOfParent(assetUUID)`
- Update all `StandardForm` methods that currently call `generateImplicitParents()` or `_buildComponentGraph()`:
  - `merge()`
  - `diff()`
  - `subset()`
  - `finalize()`
  - Any other methods that depend on parentage
- Remove `implicitParent` field mutation from `StandardForm`:
  - Components should no longer have `implicitParent` set during `StandardForm` operations
  - Parentage queries should go through `SchemaOrganization` instead
  - Consider making `implicitParent` a getter that queries `SchemaOrganization` (if cached access is needed)
- Migrate code that depends on `component.implicitParent` field to use `SchemaOrganization`:
  - ✅ `sortOrder.ts`: Nested sorting functionality migrated to `SchemaOrganization.sortOrder()`
    - ✅ Added `buildAncestryChain()` and `sortOrder()` methods to `SchemaOrganization`
    - ✅ Updated `StandardForm` constructor (line 280) to use `SchemaOrganization.sortOrder()`
    - ✅ Updated `StandardForm.toNDJSON()` (line 903) to use `SchemaOrganization.sortOrder()`
    - ✅ Removed `sortOrder.ts` and `sortOrder.test.ts` files
    - ✅ Updated comment in `index.ts` (line 1424) to remove reference to `standardComponentSortOrder`
  - ✅ `index.ts` (lines 277, 893): Sorting now uses `SchemaOrganization.sortOrder()` instead of lookup functions
    - ✅ Removed lookup functions that read `component.implicitParent` field
    - ✅ Both locations now use `organization.sortOrder()` directly
  - ✅ `index.ts` (line 467): `_getAncestryChainFromImplicitParent` method removed
    - ✅ Method was unused dead code (no call sites found)
    - ✅ Functionality superseded by `SchemaOrganization.buildAncestryChain()` which handles both explicit and implicit parentage
    - ✅ `SchemaOrganization.buildAncestryChain()` provides better return type (`StandardReferenceSimple[]` with tags)
  - ✅ `map.ts` (line 121): Updated to use `options.organization?.isParentContext(roomKey, mapKeyPlain)`
    - ✅ Replaced `roomComponent.implicitParent?.equals(mapKeyPlain)` with `isParentContext` helper
    - ✅ `OrganizationContext` already available in `NestedSchemaOptions` (from Phase 4.5)
    - ✅ Now correctly handles both explicit and implicit parentage (explicit takes precedence)
  - Test files: Many tests verify `implicitParent` field values
    - Update tests to verify `SchemaOrganization.getImplicitParent()` results instead
    - Consider whether these tests should move to `SchemaOrganization` test suite
    - Ensure test coverage is maintained for parentage behavior

**Success Criteria:**
- `StandardForm` no longer contains graph-building or parentage calculation logic
- All parentage queries go through `SchemaOrganization`
- `StandardForm` methods delegate to `SchemaOrganization` for hierarchy information
- All existing tests pass with refactored implementation

### 4.7 Remove Obsolete StandardForm Methods

**Status:** ⏳ **PENDING**

**Tasks:**
- Remove or deprecate methods that are no longer needed:
  - ✅ `_getAncestryChainFromImplicitParent()` (removed - was unused dead code, superseded by `SchemaOrganization.buildAncestryChain()`)
  - `_buildComponentGraph()` (delegated to `SchemaOrganization`)
  - `generateImplicitParents()` (delegated to `SchemaOrganization`)
  - ✅ `_updateTopLevelFromComponents()` (removed - functionality moved to `assureReferences` at render time)
  - Any other helper methods that were only used for hierarchy management
- Update all call sites to use `SchemaOrganization` directly or through `OrganizationContext`
- Verify no external code depends on removed methods
- Update documentation to reflect new architecture

**Success Criteria:**
- Obsolete methods removed from `StandardForm`
- All functionality preserved through `SchemaOrganization`
- No broken references in codebase
- Documentation updated

### 4.8 Update Tests and Documentation

**Status:** ⏳ **PENDING**

**Tasks:**
- Update `StandardForm` tests:
  - Remove tests that directly test graph-building or parentage calculation (move to `SchemaOrganization` tests)
  - Update tests to verify `StandardForm` delegates correctly to `SchemaOrganization`
  - Ensure all merge/diff/subset tests still pass
- Update `SchemaOrganization` tests:
  - Add comprehensive tests for `getChildrenOfParent`
  - Verify equivalence with previous `generateImplicitParents` behavior
  - Test edge cases (empty hierarchies, cycles, explicit vs implicit parent conflicts)
- Update component tests:
  - Add tests for `assureReferences` behavior
  - Update `nestedSchema` tests to use `OrganizationContext`
  - Verify `ref={0}` appears only in correct contexts
- Update documentation:
  - `standardize/AGENT.md`: Document new separation of concerns
  - `components/AGENT.md`: Document `assureReferences` and `OrganizationContext` usage
  - Update any architecture diagrams or flow descriptions

**Success Criteria:**
- All tests pass
- Test coverage maintained or improved
- Documentation accurately reflects new architecture
- Clear examples of `OrganizationContext` and `assureReferences` usage

### 4.9 Performance Optimization (If Needed)

**Status:** ⏳ **PENDING**

**Tasks:**
- Profile `assureReferences` and `getChildrenOfParent` performance:
  - Measure cost of on-demand `assureReferences` calls in deeply nested renders
  - Identify any performance regressions compared to pre-computed approach
- If performance issues identified:
  - Consider memoization/caching strategies for `assureReferences` results
  - Consider caching `getChildrenOfParent` results in `SchemaOrganization`
  - Evaluate whether pre-computation is needed for specific high-frequency paths
- Add performance tests/benchmarks if significant changes made

**Success Criteria:**
- Performance is acceptable (no significant regressions)
- Caching/memoization added if needed
- Performance characteristics documented

## Related Documentation

- [`AGENT.editAlgebra.md`](./AGENT.editAlgebra.md) - Mathematical properties of component edit operations
- [`AGENT.referenceList.editAlgebra.md`](./AGENT.referenceList.editAlgebra.md) - Mathematical properties of ReferenceList operations
- [`AGENT.md`](./AGENT.md) - Conceptual overview of Components
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Current implementation details
- [`AGENT.referenceList.md`](./AGENT.referenceList.md) - ReferenceList usage and architecture
- [`../AGENT.md`](../AGENT.md) - StandardForm overview and architecture
- [`../schemaOrganization.ts`](../schemaOrganization.ts) - SchemaOrganization implementation
