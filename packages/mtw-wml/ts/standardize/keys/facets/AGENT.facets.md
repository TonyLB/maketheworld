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
  - `StandardFacet<TPayload>` - Interface for individual Facets
  - `FacetList<TPayload>` - Interface for Facet collections
  - See [`abstract.ts`](./abstract.ts) for interface definitions
- **Type Guards**: `isPositionPayload`, `isMarkFacetPayload`, `isExitPayload`, `isStandardFacetPayload`, `isStandardFacetData`
- **Configuration**: Payloads use discriminator field (`type: 'PositionFacet'`, etc.) for runtime type identification

## Integration Points

- **Dependencies**: 
  - Composes `StandardReference` for target component reference
  - Uses `StandardFacetPayload` union type from `dataTypes/facet.ts`
  - Integrates with component system (Examples will use Mark Facets)
- **Cross-References**: 
  - [`./AGENT.md`](./AGENT.md) - Keys directory overview
  - [`./AGENT.planning.md`](./AGENT.planning.md) - Implementation roadmap
  - [`../components/AGENT.referenceList.md`](../components/AGENT.referenceList.md) - ReferenceList patterns (similar structure)
  - [`../components/AGENT.md`](../components/AGENT.md) - Component system overview
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
  - Use type-safe FacetList generics: `FacetList<PositionPayload>`
  - Leverage payload type discrimination for runtime validation
  - Compose StandardReference rather than extending it
- **Code Examples**: 
  - Type definitions in `abstract.ts`
  - Data type examples in `dataTypes/facet.ts`
  - Implementation examples will be added in Phase 3/4

## Navigation Tips

- **Getting Started**: 
  - Read this file for Facet concepts
  - Review [`./AGENT.planning.md`](./AGENT.planning.md) for implementation phases
  - See [`dataTypes/facet.ts`](./dataTypes/facet.ts) for serialization types
  - Check [`abstract.ts`](./abstract.ts) for interface definitions
- **Key Files**: 
  - `dataTypes/facet.ts` - Payload types and type guards
  - `dataTypes/facet.test.ts` - Type guard tests
  - `abstract.ts` - Interface definitions
- **Related Documentation**: 
  - [`./AGENT.md`](./AGENT.md) - Keys directory overview
  - [`../components/AGENT.referenceList.md`](../components/AGENT.referenceList.md) - Similar collection patterns

## Development Notes

- **Current State**: 
  - Phase 1, Item 2: Data types and type guards complete ✅
  - Phase 1, Item 3: Interface definitions (in progress)
  - Implementation classes not yet created (Phase 3/4)
- **Future Plans**: 
  - Phase 3: Implement StandardFacet class with full functionality
  - Phase 4: Implement FacetList class
  - Phase 5: Integrate Facets into component system (Examples initially)
  - Phase 6: Consider migrating existing patterns (StandardPosition, StandardExit) to Facets
- **Key Differences from References**: 
  - **Payload Data**: Facets carry structured payload data (x/y coordinates, narrative, etc.) while References are just pointers
  - **Replace Operations**: Facets support Replace operations for payload changes; References only support Add/Remove
  - **Type Discrimination**: Facets use discriminator fields (`type: 'PositionFacet'`) in payloads; References use `tag` in the reference itself
  - **Composition**: Facets compose a `StandardReference` rather than extending it
  - **Generic Design**: Facets are generic over payload type for type safety
- **Design Decisions**: 
  - **Payload Storage**: Payloads are stored as plain JSON data (not payload classes)
    - **Rationale**: Current payloads are simple flat structures (primitives only: numbers, strings, optional fields)
    - Merge logic uses Replace semantics (incoming wins) - no complex field-level merging needed
    - Equality comparison via `JSON.stringify` is sufficient for current requirements
    - Keeps code lean and avoids unnecessary abstraction
    - **Future Consideration**: If payloads gain nested structures (e.g., `StandardRender`, `StandardReference`) or require complex merge logic beyond Replace semantics, consider introducing payload classes following the pattern used by component payloads (e.g., `StandardExamplePayload`, `StandardPositionSimpleBase`). This would provide:
      - Encapsulation of payload-specific merge logic
      - Schema generation capabilities for complex payloads
      - Better type safety and validation
      - Consistency with component payload patterns
- **Technical Debt**: 
  - Current ad-hoc patterns (StandardPosition, StandardExit) may be migrated to Facets in Phase 6
  - Implementation details will be refined during Phase 3/4
