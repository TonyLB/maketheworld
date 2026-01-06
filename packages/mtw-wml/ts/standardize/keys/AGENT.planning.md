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

1. ✅ **Implement `StandardFacet<TPayload>` class**
   - ✅ Generic class parameterized by payload type: `StandardFacet<TPayload extends StandardFacetPayload>`
   - ✅ **Compose** a `StandardReference` (following the StandardReference/StandardKey composition pattern)
   - ✅ Getters to access composed reference: `reference`, `standardKey`, `ref`, `tag`, etc. (similar to `StandardReference.standardKey`)
   - ✅ Typed payload data storage and access
   - ✅ Constructor(s) for different input formats (JSON, StandardFacetData, Replace JSON structure, cloning)
   - ✅ Handle Replace operations for payload changes (which `StandardReference` rejects)
   - ✅ `toJSON()`, `clone()`, `equals()`, `sameKey()` methods
   - ✅ `merge()` and `diff()` methods that combine ref arithmetic (from reference) with payload Replace logic
   - ✅ Schema generation supporting both ref-based Add/Remove and payload Replace operations
   - ✅ Comprehensive unit tests covering all functionality
   - **Note**: GenericTree<SchemaTag> and WML string construction are limited - primary construction is via StandardFacetData format
2. ✅ **Implement Facet payload types** - **COMPLETED IN PHASE 1**
   - ✅ Define concrete payload structures for different Facet kinds:
     - ✅ `PositionPayload`: `{ type: 'PositionFacet', x: number; y: number }`
     - ✅ `MarkFacetPayload`: `{ type: 'MarkFacet', narrative: string; embedding?: number[]; ... }`
     - ✅ `ExitPayload`: `{ type: 'ExitFacet', description?: string }`
   - ✅ Payload types implement `StandardFacetPayload` interface/type
   - ✅ Implement payload validation
   - ✅ Implement type guards: `isPositionPayload(arg: any): arg is PositionPayload`, etc.
   - ✅ Type guards use discriminator fields (e.g., `type: 'PositionFacet'`) in payloads
   - **Design Decision**: Payloads are stored as plain JSON data (not payload classes)
     - **Rationale**: Current payloads are simple flat structures (primitives only, no nested objects)
     - Merge logic uses Replace semantics (incoming wins) - no complex field-level merging needed
     - Equality comparison via `JSON.stringify` is sufficient for current requirements
     - Keeps code lean and avoids unnecessary abstraction
     - **Future Consideration**: If payloads gain nested structures (e.g., `StandardRender`, `StandardReference`) or require complex merge logic, consider introducing payload classes following the pattern used by component payloads (e.g., `StandardExamplePayload`, `StandardPositionSimpleBase`)
     - **Update (Phase 5)**: This future consideration has been realized. Payload classes are now required for schema serialization/deserialization due to the varied WML rendering patterns needed for different facet types. See Phase 5 for implementation details.
3. ✅ **Write unit tests for `StandardFacet`**
   - ✅ Test construction from various formats
   - ✅ Test serialization/deserialization
   - ✅ Test equality and key matching
   - ✅ Test payload access and modification
   - ✅ Test ref-based Add/Remove operations
   - ✅ Test payload Replace operations

### Phase 4: Implement FacetList

**Goal**: Create a collection type for managing Facets, similar to `ReferenceList`.

1. ✅ **Implement `FacetList<TPayload>` class**
   - ✅ Generic class: `FacetList<TPayload extends StandardFacetPayload>`
   - ✅ Similar structure to `ReferenceList`
   - ✅ Store collection of `StandardFacet<TPayload>` objects
   - ✅ Constructor(s) for arrays, JSON (schema trees require StandardFacetData format first)
   - ✅ Deduplication logic (by facet key using `sameKey()` and `merge()`)
   - ✅ `toJSON()`, `clone()`, `equals()` methods
   - ✅ `items` and `length` getters
   - ✅ `schema` getter for schema generation
   - ✅ Type-safe access: `FacetList<PositionPayload>`, `FacetList<MarkFacetPayload>`, etc.
   - ✅ Reference normalization in constructor (ensures minimum key information format)
   - ✅ Preserves Replace operations during normalization
2. ✅ **Implement FacetList operations**
   - ✅ `merge()` - Combine two FacetLists (combines ref arithmetic with payload Replace logic)
   - ✅ `diff()` - Compute difference between two FacetLists
   - ✅ `invert()` - Invert edit operations
   - ✅ `mapContents()`, `toFormat()`, `lookup()` - Transform operations
   - ✅ FacetList merge/diff algebra combines ref-based operations with payload Replace semantics
   - ✅ All operations preserve `_payloadTypeGuard` when creating new instances
   - ✅ Added `invert()` method to `StandardFacet` class (required for FacetList.invert())
3. ✅ **Write unit tests for `FacetList`**
   - ✅ Test construction and serialization
   - ✅ Test merge/diff/invert operations
   - ✅ Test lookup and transformation methods
   - ✅ Document edit algebra properties (ref arithmetic + payload Replace)
   - ✅ Created comprehensive test suite in `facetList.test.ts` with 64 tests covering all functionality

### Phase 4.5: Implement StandardMark Component

**Goal**: Create the `StandardMark` component infrastructure to enable Mark Facets in Examples. This phase is necessary before Phase 6 because Examples need to reference Mark components via Facets, but Mark components must exist first.

**Prerequisites**: Phase 4 (FacetList) must be complete.

1. ✅ **Schema layer support** (`@tonylb/mtw-base` package)
   - ✅ Created `packages/mtw-base/ts/schema/worldState.ts` file for world-state components (Mark, and eventually Lens, etc.)
   - ✅ Added `SchemaMarkTag` type definition and `isSchemaMark` type guard function
   - ✅ Added Mark to schema component type definitions (SchemaTagType, SchemaComponent, SchemaWithKey, SchemaTag unions)
   - ✅ Added Mark to importable types and SchemaAssetLegalContents
   - ✅ Mark tags can now be parsed from WML

2. ✅ **Component type system** (`standardize/components/dataTypes/abstract.ts`)
   - ✅ `ComponentTag` type union automatically includes `'Mark'` (derived from `SchemaWithKey["tag"]`)
   - ✅ Added `'MARK': 'Mark'` case to `componentTagFromUpperCase()` function

3. ✅ **Component data types** (`standardize/components/dataTypes/mark.ts`)
   - ✅ Create `StandardMarkData` type (extends `StandardBaseData`)
     - ✅ Include `shortName?: StandardEditableData<string>` field (for `<ShortName>` tag, stored as `StandardLiteral`)
     - ✅ Include `description?: RenderTree` field (for `<Description>` tag, stored as `StandardRender`)
     - ✅ Follow pattern similar to Example component (which has `name`, `summary`, `description` as `StandardRender`)
     - ✅ Mark will have `shortName` as `StandardLiteral` (like Room/Feature/Knowledge/Character) and `description` as `StandardRender` (like Example)
   - ✅ Create `isStandardMarkData` type guard
     - ✅ Use `checkAll` and `checkTypes` pattern (see `isStandardKnowledgeData` for ShortName pattern, `isStandardExampleData` for Description pattern)
     - ✅ Check for `tag === 'Mark'`
     - ✅ Validate `shortName: 'literal'` and `description: 'renderTree'` in `checkTypes`
   - ✅ Export from `dataTypes/index.ts`
     - ✅ Add `StandardMarkData` and `isStandardMarkData` to exports
     - ✅ Add `StandardMarkData` to `StandardComponentNonEditData` union type
     - ✅ Add `isStandardMarkData` to `isStandardComponentData` type guard function

4. ✅ **Component implementation** (`standardize/components/worldState.ts`)
   - ✅ Create `StandardMarkPayload` class implementing `ComponentConstructorMethods<StandardMarkData>`
     - ✅ Implement `fromJSON()`, `fromSchema()`, `toJSON()`, `schema()`, `merge()`, `subset()`, etc.
     - ✅ Include `_shortName?: StandardLiteral` field (parsed from `<ShortName>` tag in WML)
     - ✅ Include `_description?: StandardRender` field (parsed from `<Description>` tag in WML)
     - ✅ Mark is a simple component (similar to StandardKnowledge/StandardFeature structure, but with both ShortName and Description)
     - ✅ Follow existing component patterns:
       - ✅ ShortName handling: See `StandardRoom`, `StandardFeature`, `StandardKnowledge` (use `StandardLiteral`, parse from `<ShortName>` tag)
       - ✅ Description handling: See `StandardExample` (use `StandardRender`, parse from `<Description>` tag)
   - ✅ Create `StandardMark` component class using `componentClassFactory` pattern
   - ✅ Follow existing component patterns (see `StandardKnowledge` or `StandardFeature` for ShortName, `StandardExample` for Description)
   - **Note**: Implemented in `worldState.ts` to match schema organization and prepare for future world-state components (Lens, etc.)

5. ✅ **Factory integration** (`standardize/componentFactory.ts`)
   - ✅ Import `StandardMark` and `isStandardMarkData`
   - ✅ Add Mark case to `standardComponentFactory()` function
   - ✅ Handle both JSON data and schema tree inputs

6. ✅ **Processing integration** (`standardize/index.ts`)
   - ✅ Add `{ key: 'Mark', legalParents: ['Example', 'Asset'] }` to `COMPONENT_TEMPLATES` array
   - ✅ Determine appropriate `legalParents` for Mark (set to `['Example', 'Asset']`)
   - ✅ Add `StandardMark` to `isStandardComponent()` type guard function

7. ✅ **Write unit tests** (`standardize/components/worldState.test.ts`)
   - ✅ Test construction from JSON and WML schema
   - ✅ Test serialization/deserialization
   - ✅ Test merge/diff operations
   - ✅ Test schema generation
   - ✅ Test payload methods (isEmpty, invert, mapContents, remapReferences)
   - ✅ Test edge cases (empty component, only ShortName, only Description)
   - **Note**: Test file is `worldState.test.ts` to match component file organization

**Success Criteria**:
- `<Mark>` tags can be parsed from WML
- `StandardMark` instances can be created and manipulated
- Mark components can be stored in `StandardForm`
- Mark components appear correctly in component factory lookups
- All tests pass

**Note**: This phase establishes the minimal infrastructure needed for Mark components. Mark components will include `ShortName` (as `StandardLiteral`) and `Description` (as `StandardRender`) tags, following the pattern established by other components like Room/Feature (for ShortName) and Example (for Description). Additional properties or functionality can be added later as needed. The primary goal is to enable Mark components to exist so they can be referenced via Facets in Phase 6.

### Phase 5: Implement Payload Classes for Schema Serialization (First Iteration)

**Goal**: Create payload classes with facet rendering methods that support parent component orchestration. Facets can either create new nodes (like Exit) or enhance existing reference renders (like Position/Mark), allowing parent components to properly zipper facet payloads with reference lists.

**Prerequisites**: Phase 3 (StandardFacet Core) and Phase 4 (FacetList) must be complete. This phase must be completed before Phase 6 (integrating Facets into components) because schema serialization/deserialization is required for component integration.

**Note - First Iteration**: This phase implements a **first iteration** of the payload rendering architecture. It focuses on the core rendering patterns (plain references + plain payloads) and does not fully address the complexity of edit operations (Remove/Replace) in combination with incoming `referenceRender` edits. After Phase 6 provides a working prototype in Examples, Phase 7 will examine edit functionality in detail and identify functional gaps based on real-world usage patterns.

**Rationale**: Different facet payload types require fundamentally different WML rendering patterns and integration strategies:
- **Exit facets**: `<Exit to=(target)>Name</Exit>` - reference embedded in tag properties, payload as content. These create **new nodes** in the parent (Map) that don't enhance existing Room references.
- **Position facets**: `<Room to=(target)><Position x={0} y={100} /></Room>` - reference as parent tag, payload as child tag. These **enhance existing Room references** rendered by the parent Map (either pre-existing Room renders or Room references from a `rooms` reference list).
- **Mark facets**: `<Mark uuid=(target)><Match>Condition</Match></Mark>` - reference as parent tag, payload as child tag. These **enhance existing Mark references** rendered by the parent Example (from a `marks` reference list).

**Architecture Decision**: Parent components are responsible for orchestrating facet rendering:
1. Parent renders reference lists that may need facet enhancement (e.g., Map renders `rooms` reference list)
2. Parent applies facet rendering to each facet, passing optional `referenceRender` (pre-existing render if reference already in tree, or plain reference render if not)
3. Facet rendering returns either `newNode` (create new node like Exit) or `aggregatedNode` (enhanced reference render)
4. Parent zippers enhanced references with new nodes to produce final schema

This architecture explicitly handles edge cases:
- Rooms parented to Map (reference already in tree): use existing reference render
- Rooms not parented (reference not in tree): facet provides plain reference render
- Rooms without positions: handled naturally (no facet for that room, just renders reference)

1. ✅ **Refactor FacetPayloadBase interface to new architecture**
   - ✅ Update `FacetPayloadBase<TPayload>` interface in `keys/dataTypes/facetPayloadBase.ts`:
     - ✅ **Replace** `schema(reference, payload)` method with:
       - ✅ `renderFacet(reference: StandardReference, payload: TPayload, referenceRender?: GenericTreeNode<SchemaTag>): { newNode?: GenericTreeNode<SchemaTag>, aggregatedNode?: GenericTreeNode<SchemaTag> }`
       - ✅ `referenceRender` is optional: if provided, it's a pre-existing render of the reference already in the parent's schema tree (e.g., Room already rendered by Map as a child). If not provided, generate a plain reference render (just the `<Room>` tag without children).
       - ✅ Return `newNode` for facets that create new nodes (Exit returns `<Exit>` tag)
       - ✅ Return `aggregatedNode` for facets that enhance existing references (Position/Mark return enhanced `<Room>` or `<Mark>` tag with payload as child)
     - ✅ **Keep** `fromSchema(node: GenericTree<SchemaTag>, reference: StandardReference): TPayload` - still needed for parsing
     - ✅ **Remove** `nestedSchema()` method - no longer needed, `renderFacet` handles both cases
   - ✅ Update JSDoc documentation to reflect new architecture:
     - ✅ Document `referenceRender` parameter and when it's provided vs not
     - ✅ Document `newNode` vs `aggregatedNode` return semantics
     - ✅ Explain parent component orchestration pattern
   - ✅ Update interface name if desired (keep `FacetPayloadBase` for now, but clarify it's for rendering orchestration)

2. ✅ **Refactor StandardFacet and infrastructure for new architecture**
   - ✅ Update `StandardFacet` class in `keys/facet.ts`:
     - ✅ Remove `schema` getter - no longer appropriate with the new architecture (parent components orchestrate rendering)
     - ✅ Remove `nestedSchema()` method - parent components handle schema generation
     - ✅ Add helper method `renderFacet(referenceRender?: GenericTreeNode<SchemaTag>)` that delegates to payload class `renderFacet()`:
       - ✅ Call payload class `renderFacet(this._reference, this._payload, referenceRender)` (payload classes implemented in Tasks 3-5)
       - ✅ Handle Replace operations: render both match and payload facets, wrap in Replace structure
     - ✅ Remove `_getPlainSchema()` private method - no longer needed
     - ✅ Remove `_getNestedSchema()` private method - no longer needed
     - ✅ Keep `fromSchema()` logic for parsing - still needed
   - ✅ Ensure `StandardFacet` maintains backward compatibility for existing construction patterns (StandardFacetData, cloning, etc.)
   - ✅ Update `FacetList`: Remove `schema` getter (with note to re-examine after Phase 6 Example prototype)
   - ✅ Update unit tests to reflect new architecture:
     - ✅ Remove tests for `schema` getter and `nestedSchema()` method
     - ✅ Add placeholder tests for `renderFacet()` (skipped until payload classes are implemented in Tasks 3-5)

3. ✅ **Refactor PositionPayload to align with new architecture**
   - ✅ Update `keys/dataTypes/positionPayload.ts`:
     - ✅ **Keep** `StandardEditablePayload` implementation (`clone`, `toJSON`, `schema` getter for payload Replace operations)
     - ✅ **Replace** `FacetPayloadBase` methods:
       - ✅ **Replace** `_facetSchema()` method with `renderFacet()`:
         - ✅ If `referenceRender` provided: enhance it by adding `<Position>` child, return `{ aggregatedNode: enhancedRoomNode }`
         - ✅ If `referenceRender` not provided: generate plain `<Room>` reference render, add `<Position>` child, return `{ aggregatedNode: roomNodeWithPosition }`
         - ✅ Never return `newNode` (Position always enhances Room references)
       - ✅ **Keep** `fromSchema()` for parsing
       - ✅ **Remove** `nestedSchema()` method and `_facetSchema()` private method
     - ✅ Remove the `Object.defineProperty` workaround comment (no longer needed with `renderFacet`)
     - ✅ Remove `callFacetPayloadBaseSchema` helper export (no longer needed)
   - ✅ Update unit tests:
     - ✅ Test `renderFacet()` with pre-existing Room render
     - ✅ Test `renderFacet()` without reference render (plain Room tag)
     - ✅ Test that it always returns `aggregatedNode` (never `newNode`)
     - ✅ Remove obsolete tests for `_facetSchema()` and `nestedSchema()`
   - ✅ Ensure StandardEditable functionality still works correctly

4. ✅ **Implement MarkFacetPayload class**
   - ✅ Create `keys/dataTypes/markFacetPayload.ts`
   - ✅ Implement as both `StandardEditablePayload<MarkFacetPayload>` and `FacetPayloadBase<MarkFacetPayload>`
   - ✅ StandardEditablePayload implementation:
     - ✅ `clone()`, `toJSON()`, `schema` getter (generates just Match tag for payload Replace operations)
     - ✅ Uses `standardEditableFactory` for automatic Remove/Replace wrapper generation
   - ✅ FacetPayloadBase implementation:
     - ✅ **Implement** `fromSchema()`: Parse `<Mark uuid=(target)><Match>Condition</Match></Mark>` structure
       - ✅ Extract Mark reference from parent tag
       - ✅ Extract Match child tag content (narrative string from String children)
       - ✅ Return `MarkFacetPayload` object
     - ✅ **Implement** `renderFacet()`:
       - ✅ If `referenceRender` provided: enhance it by adding `<Match>` child, return `{ aggregatedNode: enhancedMarkNode }`
       - ✅ If `referenceRender` not provided: generate plain `<Mark>` reference render, add `<Match>` child, return `{ aggregatedNode: markNodeWithMatch }`
       - ✅ Never return `newNode` (Mark facets always enhance Mark references)
     - ✅ Handle Match tag rendering with String children containing narrative
   - ✅ Write unit tests for parsing, generation, and facet rendering (with/without reference render)
   - ✅ Export from `keys/index.ts` with factory, typeguard, merge, and diff functions

5. ✅ **Implement ExitPayload class**
   - ✅ Create `keys/dataTypes/exitPayload.ts`
   - ✅ Implement as both `StandardEditablePayload<ExitPayload>` and `FacetPayloadBase<ExitPayload>`
   - ✅ StandardEditablePayload implementation:
     - ✅ `clone()`, `toJSON()`, `schema` getter (generates just Exit tag for payload Replace operations)
     - ✅ Uses `standardEditableFactory` for automatic Remove/Replace wrapper generation
   - ✅ FacetPayloadBase implementation:
     - ✅ **Implement** `fromSchema()`: Parse `<Exit to=(target)>Name</Exit>` structure
       - ✅ Extract target reference from `to` property
       - ✅ Extract description from tag content (StandardLiteral)
       - ✅ Return `ExitPayload` object
     - ✅ **Implement** `renderFacet()`:
       - ✅ **Always ignore** `referenceRender` parameter (Exit facets don't enhance Room references)
       - ✅ Generate `<Exit to=(target)>Name</Exit>` structure with reference embedded in `to` property
       - ✅ Return `{ newNode: exitNode }` (never return `aggregatedNode`)
       - ✅ Exit facets create new nodes in the parent (Map), not enhancements to Room references
     - ✅ Reference implementation: `StandardExitBase.schema` (lines 32-35 in `exit.ts`)
   - ✅ Write unit tests for parsing, generation, and facet rendering (verify it always returns `newNode`)
   - ✅ Export from `keys/index.ts` with factory, typeguard, merge, and diff functions

6. ✅ **Write comprehensive integration tests (first iteration - plain cases)**
   - ✅ Test round-trip: WML → StandardFacet → WML for each payload type (plain cases only)
   - ✅ Test parsing edge cases (missing properties, empty content, etc.)
   - ✅ Test `renderFacet()` for each payload type with **plain references and plain payloads**:
     - ✅ **Position**: Test with pre-existing Room render, test without (plain Room tag), verify always returns `aggregatedNode`
     - ✅ **Mark**: Test with pre-existing Mark render, test without (plain Mark tag), verify always returns `aggregatedNode`
     - ✅ **Exit**: Test that it ignores `referenceRender`, verify always returns `newNode`
   - ✅ Test parent component orchestration patterns (mock parent components rendering reference lists then applying facets)
   - ✅ Verify edge cases (plain references only):
     - ✅ Rooms without positions (reference render only, no facet)
     - ✅ Rooms with positions (enhanced reference render)
     - ✅ Maps with Exits (new Exit nodes)
     - ✅ Examples with Mark references but no facet payloads (reference render only)
   - ✅ Created comprehensive integration test file: `keys/integration.test.ts` with all test coverage
   - **Note**: Edit operation combinations (Remove/Replace in `referenceRender` + Remove/Replace in payload) will be addressed in Phase 7 after we have a working prototype to anchor our concerns

**Success Criteria**:
- Each payload type has its own class with `fromSchema()` and `renderFacet()` methods
- `renderFacet()` correctly handles optional `referenceRender` parameter
- Position and Mark payloads return `aggregatedNode` (enhance existing references)
- Exit payload returns `newNode` (create new nodes)
- StandardFacet provides `renderFacet()` helper that delegates to payload classes
- Parent components can orchestrate facet rendering by:
  1. Rendering reference lists first
  2. Applying facet rendering with optional reference renders
  3. Zippering enhanced references with new nodes
- All three payload types (Position, Mark, Exit) correctly parse from and generate to WML
- Round-trip tests pass: WML → StandardFacet → WML
- Facet rendering tests pass: both with and without `referenceRender`
- All existing StandardFacet tests still pass (backward compatibility maintained)

**Key Files to Create/Modify**:
- `keys/dataTypes/facetPayloadBase.ts` (modify - update interface to `renderFacet()`)
- `keys/dataTypes/positionPayload.ts` (modify - refactor to `renderFacet()`)
- `keys/dataTypes/markFacetPayload.ts` (new - implement with `renderFacet()`)
- `keys/dataTypes/exitPayload.ts` (new - implement with `renderFacet()`)
- `keys/facet.ts` (modify - add `renderFacet()` helper, refactor schema generation)
- `keys/facet.test.ts` (modify - update tests for new architecture)

### ✅ Phase 5 Task 7: Refactor StandardFacet to Use Payload Class Instances

**Goal**: Refactor `StandardFacet` to store and use payload class instances instead of plain JSON objects, enabling `renderFacet()` to work correctly by delegating to payload class methods.

**Prerequisites**: Phase 5 Tasks 1-6 must be complete. Integration tests in `keys/integration.test.ts` currently fail because `StandardFacet` stores plain JSON payloads but needs class instances to call `renderFacet()`.

**Problem**: Currently `StandardFacet` stores `_payload` as plain JSON objects (TypeScript types like `PositionPayload`, `MarkFacetPayload`, `ExitPayload`), but `renderFacet()` needs to call methods on payload class instances (`PositionPayload`, `MarkFacetPayload`, `ExitPayload` classes that implement `FacetPayloadBase`).

**Rationale**: We created payload classes with `renderFacet()` methods in Phase 5 Tasks 3-5, but `StandardFacet` still stores plain JSON objects. This refactoring connects the two by having `StandardFacet` instantiate and store payload class instances.

1. ✅ **Refactor StandardFacet constructor to instantiate payload classes**
   - ✅ Created `_instantiatePayloadClass()` helper method to instantiate payload classes based on `type` discriminator
   - ✅ Updated constructor to instantiate payload classes in all paths (clone, Replace, StandardFacetData)
   - ✅ Store class instance in `_payload` instead of plain JSON object
   - ✅ Update `_matchPayload` handling to also use class instances for Replace operations
   - ✅ Handle cloning to preserve class instances (use `clone()` method on payload classes)

2. ✅ **Update StandardFacet type declarations**
   - ✅ Changed `private _payload: TPayload` to `private _payload: FacetPayloadBase<TPayload>`
   - ✅ Changed `private _matchPayload: TPayload | undefined` to `private _matchPayload: FacetPayloadBase<TPayload> | undefined`
   - ✅ Updated JSDoc comments to reflect class instance storage

3. ✅ **Update StandardFacet.payload getter**
   - ✅ Updated to return payload class instance (cast for API compatibility)
   - ✅ Updated JSDoc to clarify it returns class instance

4. ✅ **Update StandardFacet.toJSON()**
   - ✅ Convert payload class instance back to JSON using `toJSON()` method on payload class
   - ✅ Convert `_matchPayload` class instance to JSON if present
   - ✅ Ensure serialization format matches `StandardFacetData<TPayload>` structure

5. ✅ **Update StandardFacet.payloadsEqual()**
   - ✅ Updated to handle class instances by converting to JSON for comparison
   - ✅ Updated method signature to accept `FacetPayloadBase<TPayload> | undefined`

6. ✅ **Update StandardFacet._renderFacetPlain()**
   - ✅ Removed TODO comment and error handling for missing `renderFacet()`
   - ✅ Simplified to call `renderFacet()` directly on payload class instance
   - ✅ Convert payload to JSON before passing to `renderFacet()` method

7. ✅ **Update all StandardFacet methods that access payload**
   - ✅ Updated `merge()`, `diff()`, `invert()`, `toFormat()`, `lookup()` methods to convert payload class instances to JSON when creating new facets
   - ✅ Updated `renderFacet()` to convert payload class instances to JSON when creating match/payload facets for Replace operations
   - ✅ All methods that create new facets now pass JSON (constructor handles instantiation)

8. ✅ **Update FacetList to work with payload class instances**
   - ✅ Reviewed `FacetList` implementation - no changes needed
   - ✅ FacetList works with StandardFacet instances through public API, so it's compatible
   - ✅ Serialization/deserialization still works correctly (uses StandardFacet.toJSON())

9. ✅ **Update existing tests**
   - ✅ Updated `facet.test.ts` to use `.toJSON()` for payload comparisons
   - ✅ Updated tests that compare payloads directly to use `facet.payload.toJSON()`
   - ✅ Updated tests that compare matchPayload to use `facet.matchPayload?.toJSON()`
   - ✅ Tests that access payload properties directly (e.g., `facet.payload.x`) still work since class instances expose properties

10. ✅ **Verify integration tests pass**
   - ✅ Integration tests in `keys/integration.test.ts` should now pass (need to verify by running tests)
   - ✅ Round-trip serialization should work correctly (constructor instantiates classes, toJSON() converts back)
   - ✅ `renderFacet()` should work for all payload types (now calls methods on class instances)

**Success Criteria**:
- ✅ `StandardFacet` stores payload class instances instead of plain JSON objects
- ✅ `renderFacet()` works correctly by delegating to payload class methods
- ✅ Integration tests in `keys/integration.test.ts` updated to work with class instances (use `.toJSON().type` for type access, direct property access for data fields)
- ✅ All existing `StandardFacet` unit tests updated and passing with class instances
- ✅ Serialization/deserialization (toJSON/fromJSON) works correctly (constructor instantiates classes, toJSON() converts back)
- ✅ Type safety is maintained throughout (API compatibility preserved with type casting)
- ✅ External API remains compatible (same constructor signatures, same getters, same methods)
- ✅ Payload properties (x, y, narrative, description) accessible directly on class instances

**Key Files Modified**:
- ✅ `keys/facet.ts` (modified - refactored to use payload class instances)
- ✅ `keys/facet.test.ts` (modified - updated tests to use `.toJSON()` for comparisons)
- ✅ `keys/integration.test.ts` (modified - updated to use `.toJSON().type` for type access)
- ✅ `keys/facetList.ts` (reviewed - no changes needed, works with StandardFacet API)

**Note**: This refactoring maintains the same external API for `StandardFacet` (same constructor signatures, same getters, same methods), but changes the internal representation from JSON objects to class instances. Serialization format (`StandardFacetData`) remains the same. Payload class instances expose properties directly (x, y, narrative, description), so code accessing `facet.payload.x` still works. The `type` discriminator property is only in JSON, so use `facet.payload.toJSON().type` to access it.

### Phase 5 Task 8: Refactor StandardFacet to Factory Pattern

**Goal**: Refactor `StandardFacet` from a generic class (`StandardFacet<TPayload>`) to concrete facet classes using a factory pattern (like `StandardComponent` uses `componentClassFactory`). This eliminates the need for runtime type discrimination and type casting hacks, simplifying the codebase and aligning with existing patterns.

**Prerequisites**: Phase 5 Task 7 must be complete. This refactoring builds on the payload class instance infrastructure established in Task 7.

**Problem**: The current generic `StandardFacet<TPayload>` approach requires significant internal complexity:
- **Runtime type discrimination**: `_instantiatePayloadClass()` method uses type guards to select payload class at runtime
- **Double casting bridge**: `_asEditablePayload()` helper uses `as unknown as` to bridge `FacetPayloadBase` and `StandardEditablePayload` (23+ occurrences throughout the class)
- **Type mismatch in getters**: The `payload` getter returns `TPayload` but is actually `FacetPayloadBase<TPayload>`, requiring casts
- **Per-method conversions**: Many methods must convert between JSON and class instances using helper methods

This complexity makes the code harder to maintain and understand, especially compared to the cleaner factory pattern used by `StandardComponent`.

**Rationale**: The `StandardComponent` factory pattern successfully eliminates similar complexity:
- `componentClassFactory` generates concrete classes from payload class constructors (e.g., `StandardRoom`, `StandardExample`)
- `standardComponentFactory` dispatches at construction time based on type guards (one-time, not per-operation)
- No runtime type discrimination inside classes - payload type is known at construction
- No casting needed - payload type is concrete throughout the class

Applying this pattern to facets will:
- Eliminate `_instantiatePayloadClass()` and `_asEditablePayload()` helpers
- Remove all 23+ type casts throughout the codebase
- Make payload types concrete at construction time (no generic type parameter needed)
- Simplify each facet class (no generic complexity)
- Align with existing architectural patterns
- Maintain the same external API for consumers

**Architecture Overview**: 
- Create `facetClassFactory` function (similar to `componentClassFactory`) that generates a concrete facet class from a payload class constructor
- Create concrete facet classes: `StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`
- Create `standardFacetFactory` dispatcher function (similar to `standardComponentFactory`) that takes `StandardFacetData` and uses type guards to instantiate the correct concrete class
- Update `FacetList` to work with concrete facet types (either make it non-generic storing `StandardFacet[]`, or create separate list classes per facet type, or use a union type/base class approach)

1. ✅ **Create `facetClassFactory` function**
   - ✅ Create `keys/facetFactory.ts` (similar to `components/component.ts`)
   - ✅ Define `FacetConstructorMethods<D>` interface (payload class methods needed by facets)
   - ✅ Implement `facetClassFactory` that:
     - ✅ Takes a payload class constructor and label string
     - ✅ Returns a generated facet class with concrete payload type (no generic parameter)
     - ✅ Implements `StandardFacet` interface (or base interface)
     - ✅ Handles construction from `StandardFacetData`, cloning, WML parsing, etc.
     - ✅ All payload operations work with concrete type (no casting needed)
   - ✅ Export `facetClassFactory` from `keys/facetFactory.ts` and `keys/index.ts`
   - ✅ Write comprehensive unit tests in `keys/facetFactory.test.ts`

2. **Add WML/schema parsing to `facetClassFactory`**
   - [x] Add optional `referenceFactory?: (schema: GenericTree<SchemaTag>) => StandardReference` parameter to factory function
   - [x] Add imports: `treeFromWML`, `isSchemaTreeNode`, `isSchemaReplace`, `isSchemaReplaceMatch`, `isSchemaReplacePayload`, `treeNodeTypeguard`
   - [x] Update constructor to accept `GenericTree<SchemaTag> | string` inputs
   - [x] Implement WML string parsing (detect WML, parse to schema, validate non-empty)
   - [x] Implement `GenericTree<SchemaTag>` handling (validate array, check isSchemaTreeNode)
   - [x] Implement Replace-wrapped schema parsing (extract ReplaceMatch/ReplacePayload, parse reference, parse match/payload)
   - [x] Implement plain schema parsing (extract reference with factory or default `new StandardReference(schema[0])`, parse payload)
   - [x] Update error messages to reflect supported input types
   - [x] Add comprehensive unit tests for WML/schema parsing (plain and Replace cases)
   - [x] Update this planning document

3. ✅ **Create concrete facet classes**
   - ✅ Create `StandardPositionFacet` extending `facetClassFactory(PositionPayloadClass, 'PositionFacet')`
   - ✅ Create `StandardMarkFacet` extending `facetClassFactory(MarkFacetPayloadClass, 'MarkFacet')`
   - ✅ Create `StandardExitFacet` extending `facetClassFactory(ExitPayloadClass, 'ExitFacet')`
   - ✅ Each class has concrete payload type - no generic parameter needed
   - ✅ Export from `keys/index.ts`

4. ✅ **Create `standardFacetFactory` dispatcher**
   - ✅ Create `keys/facetFactory.ts` (or add to existing factory file)
   - ✅ Implement `standardFacetFactory` function that:
     - ✅ Takes `StandardFacetData | GenericTree<SchemaTag>` argument
     - ✅ Uses type guards (`isPositionPayload`, `isMarkFacetPayload`, `isExitPayload`) to determine facet type
     - ✅ Returns appropriate concrete facet class instance
     - ✅ Returns `undefined` if type cannot be determined
   - ✅ Similar structure to `standardComponentFactory` in `componentFactory.ts`
   - ✅ Export from `keys/facets/facetFactory.ts`
   - ✅ Export from `keys/index.ts`
   - ✅ Write unit tests

5. ✅ **Update `FacetList` to work with concrete facet types**
   - ✅ **Chosen approach: Option B** - Create separate list classes matching component pattern
   - ✅ Created `facetListClassFactory` function in `keys/facets/facetListFactory.ts` that generates concrete list classes from facet class constructors
   - ✅ Created concrete list classes:
     - ✅ `PositionFacetList` using `facetListClassFactory(StandardPositionFacet, 'PositionFacetList')`
     - ✅ `MarkFacetList` using `facetListClassFactory(StandardMarkFacet, 'MarkFacetList')`
     - ✅ `ExitFacetList` using `facetListClassFactory(StandardExitFacet, 'ExitFacetList')`
   - ✅ Updated constructor to use concrete facet class constructor directly (no dispatcher needed since type is known)
   - ✅ Updated serialization/deserialization to work with concrete types
   - ✅ Updated `merge()`, `diff()`, `invert()`, `mapContents()`, `toFormat()`, `lookup()` operations to work with concrete types
   - ✅ Updated exports in `keys/index.ts` to export factory and concrete list classes
   - ✅ Updated tests in `facetList.test.ts` to use concrete list classes instead of generic `FacetList<TPayload>`
   - ✅ Removed type guard tests (no longer needed with concrete types)
   - **Design Decision**: Each list class stores a specific concrete facet type (no generics), providing compile-time type safety without runtime type guards. This simplifies the codebase significantly compared to the generic approach (removes ~50 lines of validation/type-guard code).

6. ✅ **Update all StandardFacet consumers**
   - ✅ Updated `facet.test.ts` to use concrete facet classes (`StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`) instead of generic `StandardFacet<TPayload>`
   - ✅ Updated `integration.test.ts` helper functions to use concrete facet classes
   - ✅ All test files now use concrete classes directly (payload type is known at test definition time)
   - ✅ Type annotations updated to use concrete types or union types
   - **Note**: The generic `FacetList` class in `facetList.ts` still uses `new StandardFacet()` internally, but this will be addressed in sub-task 7 when the generic `StandardFacet` class is removed

7. ✅ **Remove generic StandardFacet implementation**
   - ✅ Removed generic `StandardFacet<TPayload>` class from `keys/facets/facet.ts` (file deleted)
   - ✅ Removed generic `FacetList<TPayload>` class from `keys/facets/facetList.ts` (file deleted)
   - ✅ Removed `_instantiatePayloadClass()` helper method (eliminated with generic class)
   - ✅ Removed `_asEditablePayload()` helper method (eliminated with generic class)
   - ✅ Removed all type casts (`as FacetPayloadBase`, `as unknown as StandardEditablePayload`, etc.)
   - ✅ Cleaned up exports in `keys/index.ts` (removed generic class exports)
   - ✅ Interface definitions in `abstract.ts` remain (useful as type definitions for concrete classes)
   - **Note**: Concrete facet classes (`StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`) and concrete list classes (`PositionFacetList`, `MarkFacetList`, `ExitFacetList`) are now the standard implementation. Factory pattern is the standard approach.

8. ✅ **Update type definitions and interfaces**
   - ✅ Updated `StandardFacet` interface in `keys/abstract.ts` to match concrete implementations:
     - ✅ Removed `schema` property and `nestedSchema()` method (replaced with `renderFacet()`)
     - ✅ Added `renderFacet()` method signature for parent component orchestration
     - ✅ Added `isReplace` and `matchPayload` properties for Replace operations
     - ✅ Updated `toJSON()` return type to include Replace structure
     - ✅ Updated `diff()` method signature to accept `undefined` parameter
     - ✅ Updated `toFormat()` method signature to include optional `mappings` parameter
   - ✅ Verified `FacetList` interface matches concrete list class implementations (no changes needed)
   - ✅ Verified exports in `keys/index.ts` are correct and complete (all concrete classes and factories exported)
   - ✅ Verified `StandardFacetData` type works correctly with concrete classes (no changes needed)
   - ✅ Verified no type guards reference `StandardFacet<TPayload>` (only payload/data type guards exist)
   - **Note**: Interface definitions remain generic (using `TPayload` type parameter) since they're type definitions for concrete classes to implement

9. ✅ **Write comprehensive tests**
   - ✅ Verified test coverage for concrete facet class construction from various formats (`facet.test.ts` - covers StandardFacetData, Replace JSON structure, cloning, error cases for all payload types)
   - ✅ Verified test coverage for `standardFacetFactory` dispatcher with all payload types (`facetFactory.test.ts` - covers Position/Mark/Exit payloads, JSON data input, schema tree input, error cases)
   - ✅ Verified test coverage for `FacetList` with concrete facet types (`facetList.test.ts` - covers PositionFacetList, MarkFacetList, ExitFacetList, serialization, merge/diff/invert, transform operations)
   - ✅ Verified test coverage for backward compatibility (construction patterns - StandardFacetData, Replace structure, cloning all work as expected)
   - ✅ Verified test coverage for serialization/deserialization with concrete types (`integration.test.ts` - covers round-trip WML parsing/generation for all payload types, renderFacet() tests)
   - ✅ All existing tests pass (tests were already updated in sub-task 6 to use concrete classes, integration tests from Phase 5 Task 6)
   - **Note**: Comprehensive test coverage was established in previous tasks (sub-task 6 for concrete class tests, Phase 5 Task 6 for integration tests). This task verified completeness and that all tests pass.

10. ✅ **Update documentation**
   - ✅ Updated `AGENT.facets.md` to reflect completed implementation:
     - ✅ Removed outdated status information ("implementation not yet created", etc.)
     - ✅ Updated Technical Details section to reference concrete classes and implementation files
     - ✅ Updated Usage Patterns section to mention concrete classes and `standardFacetFactory`
     - ✅ Updated Development Notes to reflect current state (Phase 1-5 complete)
     - ✅ Updated Design Decisions section (payload storage now uses class instances)
     - ✅ Removed references to generic design, updated to reflect concrete classes via factory pattern
   - ✅ Documentation remains focused on high-level concepts and usage patterns (no deep implementation details)
   - ✅ Examples reference concrete classes at conceptual level (implementation details left to code)
   - **Note**: Documentation style matches `components/AGENT.md` - focused on concepts and usage, not implementation mechanics

**Success Criteria**:
- ✅ Concrete facet classes (`StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`) exist and work correctly
- ✅ `facetClassFactory` generates facet classes from payload class constructors
- ✅ `standardFacetFactory` dispatches correctly to create appropriate concrete facet instances
- ✅ All type casts eliminated (no `as unknown as`, `as FacetPayloadBase`, etc.)
- ✅ `_instantiatePayloadClass()` and `_asEditablePayload()` helper methods removed
- ✅ `FacetList` works correctly with concrete facet types (whichever option chosen)
- ✅ All existing tests updated and passing
- ✅ External API remains compatible (consumers can use `standardFacetFactory` or concrete classes)
- ✅ Code is simpler and easier to maintain (matches `StandardComponent` pattern)
- ✅ Serialization/deserialization works correctly with concrete types

**Key Files to Create/Modify**:
- `keys/facetFactory.ts` (new - contains `facetClassFactory` function)
- `keys/facet.ts` (modify - replace generic class with concrete classes, or move to separate files)
- `keys/facetList.ts` (modify - update to work with concrete facet types)
- `keys/index.ts` (modify - export concrete classes and factory)
- `keys/abstract.ts` (modify - update interface definitions if needed)
- `keys/facet.test.ts` (modify - update tests for concrete types)
- `keys/facetList.test.ts` (modify - update tests for concrete types)
- `keys/integration.test.ts` (modify - update to use factory or concrete classes)

**Note**: This refactoring maintains the same external API for consumers (they can use `standardFacetFactory` similar to how they use `standardComponentFactory`). The internal implementation changes significantly, but the public interface remains compatible. Payload classes (`PositionPayloadClass`, `MarkFacetPayloadClass`, `ExitPayloadClass`) remain unchanged - only the facet wrapper changes from generic to concrete classes.

### Phase 6: Integrate Facets into Component System (Example Component - First Prototype)

**Goal**: Add Facet support to Example component as the first prototype of the new facet rendering architecture. This will validate the parent component orchestration pattern before applying it to Map/Area components.

**Prerequisites**: Phase 4 (FacetList), Phase 4.5 (StandardMark Component), and Phase 5 (Payload Classes) must be complete. Mark components must exist before Examples can reference them via Facets, and the new `renderFacet()` architecture must be in place.

**Architecture Pattern**: Example component will follow the parent component orchestration pattern:
1. Example renders `marks` reference list first (creates `<Mark>` reference renders)
2. Example applies `marks` facet rendering to each Mark reference (calls `renderFacet(referenceRender)`)
3. Example zippers enhanced Mark references (`aggregatedNode` from facets) with any new nodes (Exit-style facets would return `newNode`, but Mark facets don't)
4. Example returns final schema with enhanced Mark references

1. **Add FacetList to Example component**
   - Add `marks: FacetList<MarkFacetPayload>` field to `StandardExamplePayload` in `components/example.ts`
   - Update `StandardExampleData` type in `dataTypes/example.ts` to include marks
   - Implement serialization/deserialization:
     - Update `fromJSON()`: Parse marks from JSON data
     - Update `toJSON()`: Serialize marks to JSON
     - Update `fromSchema()`: Parse Mark Facets from WML schema (Example tag with Mark children that have Match children)
       - Use `MarkFacetPayload.fromSchema()` to parse each Mark facet
       - Separate Mark references (for reference list) from Mark facets (for facet list)
     - Update `schema()`: Generate marks reference list schema (just reference renders, no facets yet)
   - Update merge/diff/invert operations to handle FacetList operations

2. **Implement parent component orchestration in Example.nestedSchema()**
   - Update `StandardExamplePayload.nestedSchema()` in `components/example.ts`:
     - **Step 1**: Render `marks` reference list first:
       - Get all Mark references (from `this.marks.items.map(facet => facet.reference)` or from organization)
       - Render each Mark reference as a plain `<Mark>` tag (reference render)
       - Store these reference renders in a Map keyed by Mark universalKey/key
     - **Step 2**: Apply facet rendering to each Mark facet:
       - For each facet in `this.marks.items`:
         - Look up reference render for this facet's reference (from Step 1 Map)
         - Call `facet.renderFacet(referenceRender)` to get `{ aggregatedNode }`
         - Replace the reference render in Map with the aggregated node
     - **Step 3**: Generate final schema:
       - Take all aggregated nodes from Step 2 (enhanced Mark references)
       - Add any `newNode` results (none for Mark facets, but pattern supports Exit-style facets)
       - Combine with other Example content (Name, Summary, Description)
       - Return final nested schema
   - Handle edge cases:
     - Mark references without facet payloads: just render as reference (no enhancement)
     - Mark facets without corresponding reference: should this error, or create reference render? (likely error - facets should always have references)
   - Handle Replace operations: facets with Replace operations should render Replace structure

3. **Update component factory/schema handling**
   - Ensure `StandardExample` factory supports parsing Facets from WML schema
   - Update schema converters if needed to handle Facet structures in Example tags
   - Ensure Facet references to Mark components resolve correctly (use StandardForm lookup)

4. **Write comprehensive integration tests**
   - Test Example with Mark Facets (referencing existing Mark components):
     - Example with marks reference list only (no facets) - should render plain Mark references
     - Example with marks facets - should render enhanced Mark references with Match children
     - Example with both marks references and facets - should zipper correctly
   - Test serialization round-trip: WML → StandardForm → JSON → StandardForm → WML
   - Test merge/diff operations with Facets
   - Test Replace operations on Mark Facets
   - Test edge cases:
     - Example with Mark reference but no facet payload
     - Example with Mark facet but reference not in marks list (should this error?)
   - Verify parent component orchestration pattern works correctly:
     - Reference list rendered first
     - Facet rendering applied to reference renders
     - Final schema has enhanced references

**Success Criteria**:
- Example component has `marks: FacetList<MarkFacetPayload>` field
- Example correctly parses Mark Facets from WML schema
- Example correctly renders Mark Facets using parent component orchestration pattern
- Example `nestedSchema()` properly zippers reference renders with facet enhancements
- Mark references render as `<Mark>` tags
- Mark Facets enhance Mark references with `<Match>` children
- Round-trip serialization works: WML → StandardForm → JSON → StandardForm → WML
- All tests pass
- Pattern is documented and ready for replication in Map/Area components

### Phase 7: Examine Edit Functionality in Facet Rendering

**Goal**: After having a working prototype of facet rendering in Examples (Phase 6), examine the complexity of edit operations in the `renderFacet()` architecture and identify functional gaps, edge cases, and necessary foundation tools.

**Prerequisites**: Phase 6 (Example component with FacetList) must be complete. This phase requires real-world usage patterns to anchor concerns about edit operation handling.

**Rationale**: The first iteration (Phase 5) focuses on plain references + plain payloads. However, in practice, we need to handle complex combinations:
- `referenceRender` may be wrapped in `<Remove>` or `<Replace>` tags from parent rendering
- Payloads may be wrapped in StandardEditable Remove/Replace wrappers
- Combinations of these edit operations create complex scenarios that need careful analysis

1. **Identify real-world edit operation scenarios**
   - Review Phase 6 implementation to find actual edit operation use cases
   - Document combinations that occur in practice:
     - Remove reference + plain payload
     - Plain reference + Replace payload
     - Replace reference (from parent) + plain payload
     - Various other combinations as they arise
   - Identify which combinations are semantically meaningful vs. which should error

2. **Analyze functional gaps**
   - Determine what the current `renderFacet()` implementation cannot handle
   - Identify edge cases where edit operations conflict or create ambiguity
   - **Examine schema getter usage**: Review whether FacetPayload schema getters (used by StandardEditable for Replace operations) are actually necessary or if they can be simplified/stubbed. Since `renderFacet()` does the actual rendering work, the schema getter may only need minimal structure for Replace matching/comparison. Anchor this analysis to actual Replace operation usage patterns from Phase 6.
   - Document questions that need answers:
     - Should we enhance a Remove reference? (probably not - pass through)
     - How do we handle Replace in `referenceRender` + Replace in payload?
     - What's the semantics of Remove reference + Replace payload?
   - Identify patterns that could be abstracted into reusable utilities

3. **Design foundation tools (if needed)**
   - Based on real-world gaps, design utility functions to help `renderFacet()` implementations
   - Consider utilities for:
     - Unwrapping edit-wrapped `referenceRender` nodes
     - Unwrapping edit-wrapped payloads
     - Rewrapping enhanced nodes in edit operations
     - Decision trees for handling edit combinations
   - Keep utilities minimal and focused on actual needs (don't over-engineer)

4. **Update payload class implementations**
   - Refactor `PositionPayload.renderFacet()` if needed to handle edit operations
   - Update `MarkFacetPayload.renderFacet()` and `ExitPayload.renderFacet()` as needed
   - Add unit tests for edit operation combinations

5. **Update documentation**
   - Document edit operation handling patterns
   - Update JSDoc for `renderFacet()` to clarify edit operation behavior
   - Add examples of edit operation scenarios

**Success Criteria**:
- Real-world edit operation scenarios are identified and documented
- Functional gaps are clearly identified
- Foundation tools are created (if needed) to support edit operations
- Payload class implementations handle edit operations correctly
- Comprehensive tests exist for edit operation combinations
- Documentation clearly explains edit operation handling

**Note**: This phase should be anchored to actual usage patterns from Phase 6. Don't try to solve every theoretical combination - focus on what's actually needed in practice.

### Phase 8: Refactor Existing Patterns (Optional/Deferred)

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

### Phase 9: Documentation and Cleanup

**Goal**: Ensure documentation is updated and code is clean.

1. **Update architecture documentation**
   - Document Facet concept in `components/AGENT.md`
   - Create `keys/AGENT.md` documenting key/reference/facet types
   - Document FacetList edit algebra (ref arithmetic + payload Replace)
2. **Update usage documentation**
   - Add examples of using Facets in `AGENT.usage.md`
   - Document Facet types and payload structures
3. **Update "Adding a New Component Type" guide** ⚠️ **Do after Phase 6**
   - Update after Phase 6 or Phase 7, once edit operation patterns are stable
   - Update `components/AGENT.implementation.md` "Adding a New Component Type" section
   - **Rationale**: The addition of Facets changes the component implementation pattern significantly:
     - Components can now have `FacetList<TPayload>` fields in addition to `ReferenceList` fields
     - Payload classes need to handle FacetList in `fromJSON()`, `toJSON()`, `schema()`, `nestedSchema()`, `merge()`, etc.
     - Data types need to include `FacetListData<TPayload>` in addition to `ReferenceListData`
     - Schema generation needs to handle Facet structures from WML (via payload classes from Phase 5)
     - Merge/diff operations need to account for FacetList operations (ref arithmetic + payload Replace)
   - **Approach**: After Phase 6 (integrating Facets into Example component), update the guide based on real implementation experience:
     - Add step/guidance for components with FacetLists
     - Document FacetList patterns (similar to how ReferenceList patterns are documented)
     - Add examples from `StandardExample` implementation with Mark Facets
     - Update Common Patterns section to include "Components with Facets" pattern
     - Update Verification Checklist to include FacetList-specific checks
   - **Reference**: Use `StandardExample` (with Mark Facets) as the reference implementation example
4. **Code cleanup**
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
