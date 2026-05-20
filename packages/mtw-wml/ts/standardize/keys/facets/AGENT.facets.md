# Facets

## Overview

- **Purpose**: Facets are first-class relational objects that reference components with associated structured payload data
- **Context**: Addresses the architectural gap where we need "relationships with associated data" rather than just raw references
- **Key Concepts**: 
  - Payload data (PositionPayload, MarkFacetPayload, ExitPayload)
  - Composition with StandardReference
  - Replace operations for payload changes

## ⚠️ Important Design Restriction: Homogeneous Lists Only

**Facets are designed EXCLUSIVELY for homogeneous (single-type) lists.** This is a fundamental design decision that affects the entire pattern:

- **Each FacetList contains only one facet type**: `PositionFacetList` only contains `PositionFacet` instances, `MarkFacetList` only contains `MarkFacet` instances, etc.
- **Type inference from list context**: The facet type is determined by the list class, not by a discriminator field in the payload
- **Simple serialization format**: Payloads use a compact format without `type` discriminator fields:
  - `PositionFacet`: `{ reference: StandardReferenceData, payload: { x: number, y: number } }`
  - `MarkFacet`: `{ reference: StandardReferenceData, payload: string }`
  - `ExitFacet`: `{ reference: StandardReferenceData, payload: string | undefined }`
- **No mixed-type lists**: Unlike References which can mix types, FacetLists are always homogeneous
- **Benefits**: This design enables compact JSON representation, type safety through list classes, and simplified serialization/deserialization logic

## Core Purpose

- **Primary Function**: Express relationships between components with associated structured data
- **Key Responsibilities**:
  - Reference target components (via composed StandardReference)
  - Carry typed payload data (varies by Facet type)
  - Support payload Replace operations (unlike References which only support Add/Remove)
  - Provide type-safe access to payload fields

## Technical Details

- **Data Structures**: 
  - `PositionPayload` - Simple object `{ x: number, y: number }` for Position facets
  - `MarkFacetPayload` - Simple string for Mark facets (narrative description)
  - `ExitPayload` - Simple `string | undefined` for Exit facets (optional description)
  - `StandardFacetData<TPayload>` - Serialization format combining `StandardReferenceData` with typed payload
  - `FacetListData<TPayload>` - Collection serialization format (array of `StandardFacetData<TPayload>`)
- **Core Interfaces**: 
  - `StandardFacet<TPayload>` - Interface for individual Facets (type definition in `abstract.ts`)
  - `FacetList<TPayload>` - Interface for Facet collections (type definition in `abstract.ts`)
  - Concrete implementations: `StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet` (facet classes)
  - Concrete list implementations: `PositionFacetList`, `MarkFacetList`, `ExitFacetList` (list classes)
  - See [`abstract.ts`](../abstract.ts) for interface definitions
- **Type Guards**: `isPositionPayload`, `isMarkFacetPayload`, `isExitPayload`, `isStandardFacetData`
- **Serialization Format**: 
  - **Simple payload format** (no `type` discriminator field) - type is inferred from list context
  - `PositionFacet`: `{ reference: StandardReferenceData, payload: { x: number, y: number } }`
  - `MarkFacet`: `{ reference: StandardReferenceData, payload: string }`
  - `ExitFacet`: `{ reference: StandardReferenceData, payload: string | undefined }`

## Situation prose facets (Room, Feature, Knowledge)

| Parent | Facet list | Payload | Notes |
| --- | --- | --- | --- |
| **Room** | **`SituationProseFacetList`** ([`situationRoom.ts`](./situationRoom.ts); deprecated alias **`SituationRoomFacetList`**) | **`SituationProseFacetPayload`** (DisplayName / Summary / Description) | Ephemera **`render`** uses same shape |
| **Feature** | **`SituationProseFacetList`** (shared module) | Same **`SituationProseFacetPayload`** | v1: **`SITUATION#DEFAULT`** only in authoring and render |
| **Knowledge** | **`SituationProseFacetList`** (shared module) | Same triplet | Same as Feature; per-perspective facets deferred |

**Situation references:** Facets point at independent **`Situation`** components (marks live on Situation, not on the facet payload). Parents do not own referenced Situations (**D8**).

**Canonical types:** `SituationProseFacetPayload`, `StandardSituationProseFacet`, `SituationProseFacetList` in [`situationRoom.ts`](./situationRoom.ts). No separate `situationFeature.ts` / `situationKnowledge.ts` modules.

## Integration Points

- **Dependencies**: 
  - Composes `StandardReference` for target component reference
  - Payload types defined in `dataTypes/facet.ts` (no union type - each type is independent)
  - Integrates with component system (**Situation** marks; Room/F/K use Situation prose facets)
- **Cross-References**: 
  - [`../AGENT.md`](../AGENT.md) - Keys directory overview
  - [`../AGENT.referenceList.md`](../AGENT.referenceList.md) - ReferenceList patterns (similar structure)
  - [`../../components/AGENT.md`](../../components/AGENT.md) - Component system overview
- **API Contracts**: 
  - Facets will be used in component payloads (e.g., `marks: FacetList<MarkFacetPayload>`)
  - Serialization follows same patterns as ReferenceList
- **System Relationships**: 
  - Part of WML standardization system
  - Will be integrated into StandardComponent implementations (Phase 5)
  - Replaces ad-hoc patterns like StandardPosition and StandardExit (optional, Phase 6)

## Position fallback risk note

- Position currently allows omitted payload ingestion by injecting a temporary default: `{ x: 0, y: 0 }`.
- This fallback is a short-term compatibility tradeoff, not a neutral semantic default.
- Keep strict rejection for malformed present payload values; tolerance is only for omitted payload.
- Follow-up cleanup plan:
  - [`taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md`](../../../../taskPlanning/packages/mtw-wml/standardize/AGENT.positionSubsystemOverhaul.planning.md)

## Missing-payload policy (high level)

- Intent: preserve backward-compatible ingestion for facet envelopes that omit `payload`, without broadening acceptance of malformed present payload values.
- Scope boundary: tolerance applies only at ingestion boundaries; normative serialized shapes remain payload-required.
- Navigation guide:
  - Facet envelope/type-level shapes: [`dataTypes/facet.ts`](./dataTypes/facet.ts)
  - Input vs normative facet list aliases: [`../abstract.ts`](../abstract.ts)
  - Guard behavior at component boundaries: [`../../components/dataTypes/typeguards.ts`](../../components/dataTypes/typeguards.ts), [`../../components/dataTypes/index.ts`](../../components/dataTypes/index.ts)
  - Default injection path per facet family: `position.ts`, `mark.ts`, `lensMark.ts`, `situationRoom.ts`, `exit.ts` (via `facetFactory.ts`)
  - Behavioral regression coverage: `facetFactory.test.ts`, `dataTypes/facet.test.ts`, `../../index.test.ts`

## Usage Patterns

- **Common Scenarios**: 
  - Maps referencing Rooms with positional data (Position Facets)
  - Rooms referencing other Rooms with exit names (Exit Facets)
  - Examples referencing Marks with state descriptions (Mark Facets)
- **Best Practices**: 
  - **Use homogeneous lists only**: Each list contains only one facet type (e.g., `PositionFacetList` only contains `PositionFacet` instances)
  - Use concrete facet classes (`StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`) directly
  - Use concrete list classes (`PositionFacetList`, `MarkFacetList`, `ExitFacetList`) for type-safe collections
  - Facet type is inferred from the list class - no `type` discriminator field needed in payloads
  - Compose StandardReference rather than extending it
- **Code Examples**: 
  - Type definitions in `abstract.ts`
  - Data type examples in `dataTypes/facet.ts`
  - Implementation examples in `position.ts`, `mark.ts`, `exit.ts`
  - Test examples in `facet.test.ts`, `facetList.test.ts`, `integration.test.ts`

## Navigation Tips

- **Getting Started**: 
  - Read this file for Facet concepts
  - See [`dataTypes/facet.ts`](./dataTypes/facet.ts) for serialization types
  - Check [`../abstract.ts`](../abstract.ts) for interface definitions
- **Key Files**: 
  - `dataTypes/facet.ts` - Payload types and type guards
  - `dataTypes/facet.test.ts` - Type guard tests
  - `abstract.ts` - Interface type definitions
  - `position.ts` - StandardPositionFacet and PositionFacetList implementations
  - `mark.ts` - StandardMarkFacet and MarkFacetList implementations
  - `exit.ts` - StandardExitFacet and ExitFacetList implementations
  - `facetFactory.ts` - Factory functions for creating facets
- **Related Documentation**: 
  - [`../AGENT.md`](../AGENT.md) - Keys directory overview
  - [`../AGENT.referenceList.md`](../AGENT.referenceList.md) - Similar collection patterns

## Development Notes

- **Current State**: 
  - Phase 1-4: Data types, interfaces, and core implementations complete ✅
  - Phase 5: Payload classes and rendering architecture complete ✅
  - Concrete facet classes (`StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`) implemented via factory pattern
  - Concrete list classes (`PositionFacetList`, `MarkFacetList`, `ExitFacetList`) implemented
  - Factory pattern implementation complete (uses concrete classes, not generic classes)
- **Key Differences from References**: 
  - **Payload Data**: Facets carry structured payload data (x/y coordinates, narrative, etc.) while References are just pointers
  - **Replace Operations**: Facets support Replace operations for payload changes; References only support Add/Remove
  - **Type Inference**: Facet type is inferred from the list context (e.g., `PositionFacetList` → `PositionFacet`) rather than from a discriminator field. Payloads use a simple format with no `type` field.
  - **Homogeneous Lists Only**: Facets are designed exclusively for single-type lists. Unlike References which can mix types, each FacetList contains only one facet type.
  - **Composition**: Facets compose a `StandardReference` rather than extending it
  - **Concrete Classes**: Facets use concrete classes (generated via factory pattern) rather than generic classes for type safety and simplicity

## Edit Operations and Separation of Concerns

Facets support three levels of edit operations with clear separation of concerns:

### Facet-Level Operations

**Facet-level operations** are handled by the facet factory and affect the entire facet (both reference and payload):

- **Remove-wrapped facets**: When a facet is wrapped in `<Remove>`, the factory:
  1. Parses the interior as a normal facet
  2. Inverts the entire facet (both reference and payload)
  3. Result: `ref=-1` and inverted payload (e.g., Plain → Remove, Remove → Plain)
  
  Example: `<Remove><Mark uuid=(mark1)><Match>narrative</Match></Mark></Remove>`
  - Parses interior: `ref=1`, `PlainClass("narrative")`
  - Inverts: `ref=-1`, `RemoveClass("narrative")`

- **Replace-wrapped facets**: When a facet is wrapped in `<Replace><With>`, the factory:
  1. Parses ReplaceMatch and ReplacePayload as separate facets
  2. Validates they reference the same component
  3. Computes the difference using `matchFacet.diff(payloadFacet)`
  4. If references match exactly, uses `ref=0` (unchanged reference in Replace context)
  5. Result: Reference with appropriate ref value and `ReplaceClass` payload containing match and payload
  
  Example: `<Replace><Mark uuid=(mark1)><Match>old</Match></Mark></Replace><With><Mark uuid=(mark1)><Match>new</Match></Mark></With>`
  - Parses match: `ref=1`, `PlainClass("old")`
  - Parses payload: `ref=1`, `PlainClass("new")`
  - Diffs: `ref=0`, `ReplaceClass(match="old", payload="new")`

### Payload-Level Operations

**Payload-level operations** are handled by payload classes and affect only the payload:

- **Payload Remove**: `<Mark><Remove><Match>narrative</Match></Remove></Mark>`
  - Reference: `ref=1` (unchanged)
  - Payload: `RemoveClass("narrative")`

- **Payload Replace**: Payload can contain its own Replace operations independent of facet-level operations

**Payload `fromSchema` and content tags**: When implementing `fromSchema()` for a facet payload that consumes content tags (e.g. DisplayName, Summary, Description, Match), use `splitTaggedChildren` from `schema/utils` so that content wrapped in Remove/Replace is found. Use the **matched** node(s) and pass them to StandardRender (or equivalent); do not use direct `children.find(...)` by tag, or edits will be lost on round-trip.

### Situation room facet prose (`SituationRoomFacetPayload`) and `referencedKeys`

- **Payload**: [`situationRoom.ts`](./situationRoom.ts) `SituationRoomFacetPayload` holds optional DisplayName (`StandardLiteral`), Summary, and Description (`StandardRender`). Summary and Description may contain `<Link>` nodes resolved via `withMapping` on the parent `StandardComponent`.
- **Link extraction**: Call **`SituationProseFacetPayload.referencedLinkKeys(mapping)`** (or the static **`linkReferenceKeysFromSummaryDescription(mapping, summary, description)`**) so prose links become **`referenceType: 'Link'`** entries in the owning component's `referencedKeys()` output. DisplayName is literal-only and does not contribute links.
- **Reference remapping**: Call **`SituationProseFacetPayload.remapReferences({ mappings, mapTo })`** to rewrite Summary/Description link targets (via **`StandardRender.remapReferences`**). **`StandardSituationProseFacet.remapReferences`** and **`SituationProseFacetList.remapReferences`** also format the facet reference. Use **`mapSituationProsePayloadContents`** when implementing **`mapContents`** on embedders.
- **Display vs storage**: For authoring WML, pass asset **`mappings`** into **`toProseTripletChildren({ mappings })`**, **`renderFacet(..., lookup, mappings)`**, and **`renderPayloadToSchemaNode(payload, mappings)`** so Summary/Description use **`StandardRender.nestedSchema({ tag, mappings })`** (same as Message **`Description`**). Canonical stored link targets are universal after **`StandardForm.finalize()`** via embedder **`remapReferences('universal')`**; display remapping does not mutate stored prose.
- **Embedders**: Any component that stores this prose shape (**`StandardRoom`**, **`StandardFeature`**, **`StandardKnowledge`**: situations and optional ephemera **`render`**) must **union** structural references with **`referencedLinkKeys`** and run **`remapReferences`** on **`_situations`** (list) and **`_render`** (payload). Follow **`StandardRoomPayload.referencedKeys`** / **`remapReferences`** in [`components/room.ts`](../../components/room.ts) as the reference wiring.

### Separation of Concerns

This separation ensures:
- **No entanglement**: Reference and payload handle their own concerns independently
- **Correct double-negative handling**: `<Remove><Mark><Remove>...</Remove></Mark></Remove>` correctly becomes `ref=-1`, `PlainClass` (inverted Remove → Plain)
- **Proper Replace semantics**: Replace operations preserve both match and payload, not just the payload value
- **Transitive removal**: When `ref < 0`, the payload is inverted during rendering (removal is transitive)

### Edit Algebra Properties

The `merge`, `diff`, and `invert` methods work with this separation:

- **merge**: Combines reference ref values (arithmetic) and payload operations independently
- **diff**: Computes difference in reference ref values and payload operations independently
- **invert**: Inverts both reference (ref arithmetic) and payload (inverts payload operations)

### Rendering Semantics

When rendering a facet with `renderFacet()`:

- **Normal rendering** (`ref >= 0`): Payload is rendered as-is
- **Typical removal rendering** (`ref < 0` and payload already inverted, e.g. after `facet.invert()`): The usual stored shape after a unified remove (reduce ref-count and remove content). Outer `Remove` from `reference.schema`; payload renders as plain content inside (one remove wrapper). See `facetFactory.test.ts` `renderFacet` test "typical storage".
- **Atypical `-a + b` rendering** (`ref < 0` and payload still plain): Also canonical, but uncommon in practice (e.g. undoing a payload removal while also decreasing ref-count). Algebraically "reduce ref-count but add content." WML normalizes to equivalent nested `Remove` as `-(a - b)`, not as two independent removes on the same dimension. `renderFacet()` inverts the plain payload at render time. See `facetFactory.test.ts` `renderFacet` test "transitivity edge case".
  - Example: Facet with `ref=-1` and `PlainClass("narrative")` renders as:
    ```xml
    <Remove><Mark uuid=(...)><Remove><Match>narrative</Match></Remove></Mark></Remove>
    ```
- **Design Decisions**: 
  - **Payload Storage**: Payloads are stored as class instances (payload classes like `PositionPayload`, `MarkFacetPayload`, `ExitPayload`)
    - Payload classes implement `FacetPayloadBase` interface for rendering and `StandardEditablePayload` for edit operations
    - Provides encapsulation of payload-specific logic (rendering, schema generation, merge/diff)
    - Enables schema serialization/deserialization for different facet types
    - Supports parent component orchestration pattern for facet rendering
- **Future Plans**: 
  - Phase 6: Integrate Facets into component system (Examples initially)
  - Phase 7: Examine edit functionality in facet rendering after real-world usage
  - Phase 8: Consider migrating existing patterns (StandardPosition, StandardExit) to Facets (optional/deferred)
