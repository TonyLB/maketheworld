# Keys, References, and Facets

## Overview

- **Purpose**: Core types for component identification, references, and relational data in WML
- **Context**: Consolidates Keys, References, and Facets into a unified directory structure
- **Key Concepts**: StandardKey, StandardReference, ReferenceList, StandardFacet, FacetList

## Core Purpose

- **Primary Function**: Provide type definitions and implementations for component identification and relationships
- **Key Responsibilities**: 
  - Component key management
  - Reference handling and collections
  - Facet relational objects with payload data

## Technical Details

- **Data Structures**: See [`dataTypes/`](./dataTypes/) for serialization formats
- **Core Types**: `StandardKey`, `StandardReference`, `ReferenceList`, `StandardFacet`, `FacetList`
- **Directory Structure**: `dataTypes/` for serialization, `abstract.ts` for interfaces, `key.ts` for StandardKey implementation

## Integration Points

- **Dependencies**: 
  - Uses data types from `../components/dataTypes/reference` (temporary until Phase 2, item 4)
  - Integrates with component system via StandardComponent interface
- **Cross-References**: 
  - [`./AGENT.facets.md`](./AGENT.facets.md) - Detailed Facet documentation
  - [`../components/AGENT.md`](../components/AGENT.md) - Component system overview
  - [`../components/AGENT.referenceList.md`](../components/AGENT.referenceList.md) - ReferenceList patterns
- **System Relationships**: Part of the WML standardization system, used by StandardComponent implementations

## Usage Patterns

- **Common Scenarios**: 
  - Component identification via StandardKey
  - Reference management via StandardReference and ReferenceList
  - Relational data via StandardFacet and FacetList (Phase 3+)
- **Best Practices**: Use type-safe payloads with FacetList generics

## Navigation Tips

- **Getting Started**: 
  - Read this file for overview
  - See [`./AGENT.facets.md`](./AGENT.facets.md) for Facet details
  - Review [`./AGENT.planning.md`](./AGENT.planning.md) for implementation roadmap
- **Key Files**: 
  - `key.ts` - StandardKey class implementation
  - `reference.ts` - StandardReference class implementation
  - `abstract.ts` - Interface definitions
  - `dataTypes/facet.ts` - Facet serialization types
- **Related Documentation**: 
  - [`../components/AGENT.md`](../components/AGENT.md) - Component system
  - [`../../AGENT.md`](../../AGENT.md) - WML language overview

## Development Notes

- **Current State**: Phase 1 complete, Phase 2 in progress - StandardKey and StandardReference moved to keys directory
- **Future Plans**: 
  - Phase 2: Move remaining Key/Reference code to this directory (ReferenceList, data types)
  - Phase 3: Implement StandardFacet core class
  - Phase 4: Implement FacetList class
- **Implementation Status**:
  - ✅ Phase 1, Item 1: Directory created
  - ✅ Phase 1, Item 2: Facet data types defined
  - ✅ Phase 1, Item 3: Type definitions complete
  - ✅ Phase 2, Item 1: StandardKey moved to `keys/key.ts`
  - ✅ Phase 2, Item 2: StandardReference moved to `keys/reference.ts`
  - ⏳ Phase 2, Item 3: Move ReferenceList (pending)
  - ⏳ Phase 2, Item 4: Move data types (pending)
  - ⏳ Phase 3: StandardFacet implementation (pending)
  - ⏳ Phase 4: FacetList implementation (pending)
