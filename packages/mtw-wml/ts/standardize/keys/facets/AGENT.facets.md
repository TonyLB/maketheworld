# Facets

## Overview

- **Purpose**: Facets are first-class relational objects that reference components with associated structured payload data
- **Context**: Addresses the architectural gap where we need "relationships with associated data" rather than just raw references
- **Key Concepts**: 
  - Payload data (PositionPayload, MarkFacetPayload, ExitPayload)
  - Composition with StandardReference
  - Replace operations for payload changes
  - Type discrimination via payload `type` field

## Core Purpose

- **Primary Function**: Express relationships between components with associated structured data
- **Key Responsibilities**:
  - Reference target components (via composed StandardReference)
  - Carry typed payload data (varies by Facet type)
  - Support payload Replace operations (unlike References which only support Add/Remove)
  - Provide type-safe access to payload fields

## Technical Details

- **Data Structures**: 
  - `StandardFacetPayload` - Union type for all payload types
  - `PositionPayload`, `MarkFacetPayload`, `ExitPayload` - Concrete payload types
  - `StandardFacetData<TPayload>` - Serialization format
  - `FacetListData<TPayload>` - Collection serialization format
- **Core Interfaces**: 
  - `StandardFacet<TPayload>` - Interface for individual Facets (type definition in `abstract.ts`)
  - `FacetList<TPayload>` - Interface for Facet collections (type definition in `abstract.ts`)
  - Concrete implementations: `StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet` (facet classes)
  - Concrete list implementations: `PositionFacetList`, `MarkFacetList`, `ExitFacetList` (list classes)
  - See [`abstract.ts`](../abstract.ts) for interface definitions
- **Type Guards**: `isPositionPayload`, `isMarkFacetPayload`, `isExitPayload`, `isStandardFacetPayload`, `isStandardFacetData`
- **Configuration**: Payloads use discriminator field (`type: 'PositionFacet'`, etc.) for runtime type identification

## Integration Points

- **Dependencies**: 
  - Composes `StandardReference` for target component reference
  - Uses `StandardFacetPayload` union type from `dataTypes/facet.ts`
  - Integrates with component system (Examples will use Mark Facets)
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

## Usage Patterns

- **Common Scenarios**: 
  - Maps referencing Rooms with positional data (Position Facets)
  - Rooms referencing other Rooms with exit names (Exit Facets)
  - Examples referencing Marks with state descriptions (Mark Facets)
- **Best Practices**: 
  - Use concrete facet classes (`StandardPositionFacet`, `StandardMarkFacet`, `StandardExitFacet`) or `standardFacetFactory` dispatcher
  - Use concrete list classes (`PositionFacetList`, `MarkFacetList`, `ExitFacetList`) for type-safe collections
  - Leverage payload type discrimination for runtime validation
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
  - `standardFacetFactory.ts` - Dispatcher function for creating facets from data
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
  - **Type Discrimination**: Facets use discriminator fields (`type: 'PositionFacet'`) in payloads; References use `tag` in the reference itself
  - **Composition**: Facets compose a `StandardReference` rather than extending it
  - **Concrete Classes**: Facets use concrete classes (generated via factory pattern) rather than generic classes for type safety and simplicity
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
