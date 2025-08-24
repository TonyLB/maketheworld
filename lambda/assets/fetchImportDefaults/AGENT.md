# Fetch Import Defaults - Agent Navigation Guide

## Overview

The `fetchImportDefaults` directory provides functionality for retrieving component data across asset inheritance chains. This system enables content creators to see the complete, flattened, picture of components as they exist across multiple inherited assets, supporting the semantic mode of "Aggregation of the Content of Multiple Assets" from the StandardForm system.

**Purpose**: Retrieve component data and their supporting stubs from asset inheritance chains to support content creation and editing workflows. The system provides a "vertical slice" of data about particular objects as they are represented across multiple inherited assets.

**Context**: Part of the asset management system that handles cross-asset component relationships and inheritance resolution.

**Key Concepts**: 
- **Import Chain Resolution**: Traversing asset inheritance to find component origins
- **Stub Generation**: Creating minimal component representations for referential integrity
- **Recursive Fetching**: Building complete component trees across multiple asset layers

## Core Purpose

- **Component Discovery**: Find components across asset inheritance chains
- **Stub Generation**: Create minimal component representations for cross-references
- **Inheritance Resolution**: Resolve component origins and relationships
- **Content Aggregation**: Support the "aggregation mode" of StandardForm operations

## Needs Addressed

- **Content Extension**: When extending Room A, content creators need a complete view of what Room A looks like at the point from which they are extending it, including all inherited properties
- **Layer Selection**: Content creators need to see the layering of different assets and choose which layer/asset they are extending from
- **Cross-Reference Support**: Components that reference other components (like exits to rooms) need supporting stub elements for referential integrity

## Technical Details

### Data Structures

- **`InheritanceGraph`**: Graph representation of asset inheritance relationships
- **`FetchImportsJSONHelper`**: Helper class for retrieving StandardForm data from assets
- **`RecursiveFetchImportArgument`**: Input parameters for recursive import operations

### Core Methods

- **`fetchImportsMessage`**: Main entry point for processing FetchImports messages
- **`recursiveFetchImports`**: Core algorithm for traversing inheritance chains
- **`InheritanceGraph.get()`**: Retrieves StandardForm data for specific assets

### Configuration

- **Cascade Conditions**: Defines how Exit, Link, and Position components cascade through inheritance
- **Stub Generation**: Configures minimal component representation for referential integrity

### API Contract

**Implementation Note**: The current system returns a single WML string containing the complete aggregated view (requested components + supporting stubs) rather than separate collections. This streamlined approach aligns with the "Aggregation of Multiple Assets" semantic mode, providing a flattened, complete picture of the component hierarchy. All schema elements are encoded into WML for transit, allowing communication in file fragments without requiring the API and client to share exactly the same internal representation of Schema elements.

## Integration Points

### Dependencies

- **StandardForm System**: Uses StandardForm for component representation and operations
- **Internal Cache**: Retrieves asset data and inheritance information
- **Message Bus**: Processes FetchImports messages and sends responses via SNS
- **WML Schema**: Converts between internal schema and WML format for transmission

### Cross-References

- See [`../internalCache/AGENT.md`](../internalCache/AGENT.md) for asset data retrieval
- See [`../../packages/mtw-wml/ts/standardize/AGENT.md`](../../packages/mtw-wml/ts/standardize/AGENT.md) for StandardForm semantic modes
- See [`../messageBus/AGENT.md`](../messageBus/AGENT.md) for message processing

### System Relationships

- **Asset Management**: Integrates with asset inheritance and versioning systems
- **Component System**: Works with StandardComponent and StandardForm for data manipulation
- **Client Communication**: Provides data to frontend for content creation workflows

## Usage Patterns

### Common Scenarios

1. **Content Extension**: When extending a room from an inherited asset, fetch the complete component data
2. **Reference Resolution**: Resolve component references that span multiple asset layers
3. **Inheritance Analysis**: Understand how components are layered across asset inheritance

### Stub Generation Example

The system automatically generates stub elements for components that are referenced but not explicitly requested. For example:
- If you request import values for Room A, which has an exit to Room B
- The system will return a stub for Room B containing minimal information (like its name)
- This ensures referential integrity without requiring full component data for every referenced item

**Important**: Stub components maintain their own complete inheritance history through `origin` arrays, independent of how they were discovered. A stub component can have a complex multi-entry origin chain even when the component that referenced it has a simple origin.

### Origin System Behavior

The `origin` system provides component-level inheritance tracking that works independently for each component:

- **Component-Aware Tracking**: Each component maintains its own origin array based on its individual inheritance history
- **Discovery Method Independence**: Whether a component is directly requested or discovered as a stub doesn't affect its origin tracking
- **Complete Inheritance Chains**: Components can have multi-entry origin arrays showing their complete path from ultimate origin to current asset
- **Stub Origin Preservation**: Stub components discovered during import maintain their full inheritance lineage, not just their immediate source

### Best Practices

- Use `removeLocalKeys: true` for recursive calls to focus on universal component identities
- Leverage cascade conditions to control how related components are included
- Process stubs to maintain referential integrity across asset boundaries
- Expect complex origin arrays for stub components that have their own inheritance histories

### Error Handling

- Gracefully handles missing assets by returning empty StandardForm instances
- Maintains component relationships even when intermediate assets are unavailable

## Navigation Tips

### Getting Started

1. Begin with `index.ts` to understand the main message processing flow
2. Examine `recursiveFetchImports.ts` for the core inheritance traversal logic
3. Review `baseClasses.ts` for the data structure definitions

### Key Files

- **`index.ts`**: Main entry point and message processing
- **`recursiveFetchImports.ts`**: Core recursive import algorithm
- **`baseClasses.ts`**: Data structure definitions and helper classes

### Related Documentation

- See [`../../packages/mtw-wml/ts/standardize/AGENT.md`](../../packages/mtw-wml/ts/standardize/AGENT.md) for StandardForm semantic modes
- See [`../internalCache/AGENT.md`](../internalCache/AGENT.md) for asset data access patterns

## Development Notes

### Current State

- **Origin Flag Integration**: Currently uses `_from` for import tracking; ready for `_origin` array integration
- **Semantic Mode Support**: Supports "Aggregation of Multiple Assets" mode through recursive inheritance resolution
- **Stub Generation**: Robust stub creation for maintaining referential integrity
- **Origin System Design**: Designed to provide component-level inheritance tracking independent of discovery method

### Future Plans

- **Origin Flag Enhancement**: Integrate `_origin` array to track complete inheritance chains
- **Performance Optimization**: Optimize recursive calls for deep inheritance hierarchies
- **Caching Improvements**: Add caching for frequently accessed inheritance patterns

### Technical Debt

- **Component Origin Tracking**: Current `_from` system could be enhanced with full `_origin` arrays
- **Recursive Depth Limits**: Consider adding depth limits for very deep inheritance chains
- **Error Recovery**: Enhance error handling for corrupted inheritance graphs

## Semantic Mode Integration

This functionality directly supports the **"Aggregation of the Content of Multiple Assets"** semantic mode from StandardForm:

- **Purpose**: Combines content from multiple assets through inheritance and import operations
- **Usage**: When building complete views that include inherited content and imported components
- **Characteristics**: 
  - Contains components from multiple source assets
  - Generates stub components for referential integrity
  - Represents effective content after inheritance resolution
  - Ready for enhanced origin tracking with `_origin` arrays

The recursive import system ensures that components maintain their inheritance context while providing a flattened view suitable for content creation and editing workflows. The `origin` system enhances this by providing complete inheritance lineage for each component, allowing content creators to understand not just what components exist, but their complete inheritance history and where they originated in the asset hierarchy.
