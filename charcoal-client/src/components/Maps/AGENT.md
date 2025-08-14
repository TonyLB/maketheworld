# Maps Components - Agent Navigation Guide

**⚠️ MIGRATION IN PROGRESS** - This component system is actively being migrated from legacy patterns to modern React architecture. Expect continued refactoring and structural changes.

## Overview

The Maps components provide visual map creation, editing, and viewing capabilities for the Make The World platform. This system handles both authoring (map creation/editing) and playing (character map navigation) contexts, with a primary focus on **conflict resolution and layer management** for maps that combine content from multiple asset layers.

### Key Concepts

- **Multi-Layer Conflict Resolution**: System capable of merging and resolving conflicts from sibling and cousin asset layers
- **Room Positioning Intelligence**: Automatic layout that prevents overlapping rooms from different asset layers
- **Forward-Only Data Flow**: Changes percolate forward to later layers without bleeding back to parent assets
- **Dual Context Architecture**: Separate editing and viewing modes with different data access patterns
- **WML Integration**: Deep integration with the World Markup Language system for data persistence

## Core Purpose

### Primary Intent

The Map system's fundamental purpose is to **resolve spatial conflicts** when multiple asset layers contribute rooms to the same map area. This is particularly critical when:

- Room A (in parent asset) has nothing above/north of it
- Room B (in child asset 1) is added directly to the north
- Room C (in child asset 2) is also added to the north

Without conflict resolution, these rooms would overlap, creating a poor user experience.

### Key Responsibilities

- **Conflict Resolution**: Automatically position rooms to avoid overlaps from different asset layers
- **Layer Management**: Maintain separation between asset layers while enabling visual coherence
- **Spatial Intelligence**: Use connection graphs to position rooms as close as possible to sensible connections
- **Asset Boundary Preservation**: Prevent child assets from unintentionally affecting parent asset data

## Component Architecture

### Directory Structure

```
Maps/
├── index.tsx              # Main routing and component orchestration
├── List/                  # Map listing and selection interface
├── Edit/                  # Map editing components
│   ├── Area/             # Interactive map canvas and tools
│   ├── MapDThree/        # D3.js visualization engine with conflict resolution
│   └── MapLayers/        # Layer management interface
├── View/                  # Character perspective map viewing
└── Controller/            # State management and business logic
```

### Component Relationships

- **MapHome** (`index.tsx`): Main routing container with TODO for deprecation decision
- **MapList**: Simple table-based map selection (currently hardcoded test data)
- **MapEdit**: Comprehensive editing interface with D3.js integration
- **MapView**: Character-scoped map navigation
- **MapController**: Complex state management and business logic

## Technical Details

### Data Structures

- **MapTree**: Generic tree structure for room/exit relationships
- **StandardMap**: WML-standardized map component with positions and metadata
- **MapContext**: React context for sharing map state across components

### Core Methods

- **mapTreeMemo**: Converts StandardForm data to map tree structure
- **MapDThree**: D3.js integration class for interactive visualization and conflict resolution (see [`AGENT.d3.md`](AGENT.d3.md) for details)
- **useMapContext**: React hook for accessing map state and actions

### Configuration

- **Tool Selection**: Select, Move, AddRoom, OneWayExit, TwoWayExit modes
- **Position Coordinates**: X/Y positioning system for room placement
- **Exit Types**: One-way and two-way connection patterns

## Integration Points

### Dependencies

- **@tonylb/mtw-wml**: WML standardization and schema management
- **@tonylb/mtw-base**: Generic tree structures and type guards
- **@mui/material**: UI component library
- **D3.js**: Visualization and interaction engine with conflict resolution
- **React Router**: Navigation and routing

### Cross-References

- **Library System**: Asset editing and management
- **Character System**: Character-scoped map viewing
- **WML System**: Data persistence and schema validation
- **Ephemera System**: Real-time game state updates

### System Relationships

- **Authoring Context**: Integrated with Library editing system
- **Playing Context**: Connected to character perception system
- **Data Layer**: Deep integration with WML standardization
- **UI Layer**: Material-UI components with custom styling

## Usage Patterns

### Common Scenarios

1. **Map Creation**: Navigate to `/Maps/Edit/:mapId/` for editing interface
2. **Map Viewing**: Access through character context at `/Character/:id/Map/`
3. **Room Addition**: Use AddRoom tool to place new rooms on canvas
4. **Exit Creation**: Connect rooms using OneWayExit or TwoWayExit tools
5. **Position Editing**: Drag rooms to adjust spatial relationships

### Best Practices

- Use appropriate tool selection for intended operations
- Maintain consistent exit patterns (one-way vs two-way)
- Consider character perspective boundaries in viewing mode
- Leverage layer system for complex map organization

### Error Handling

- Position validation prevents invalid room placements
- Exit validation maintains graph consistency
- Type guards ensure data structure integrity

## Navigation Tips

### Getting Started

1. **Begin with `index.tsx`**: Understand the routing structure
2. **Examine `Controller/index.tsx`**: Core business logic and state management
3. **Review `Edit/index.tsx`**: Main editing interface integration
4. **Study `baseClasses.ts`**: Type definitions and data structures

### Key Files

- **`Controller/index.tsx`**: Complex state management (419 lines)
- **`Edit/MapDThree/index.tsx`**: D3.js visualization engine with conflict resolution
- **`View/index.tsx`**: Character perspective implementation
- **`baseClasses.ts`**: Type definitions and interfaces

### Related Documentation

- See [`../../Library/AGENT.md`](../../Library/AGENT.md) for asset editing context
- See [`../ActiveCharacter/AGENT.md`](../ActiveCharacter/AGENT.md) for character system integration
- See [`../../../lambda/wml/AGENT.md`](../../../lambda/wml/AGENT.md) for WML system details
- See [`AGENT.d3.md`](AGENT.d3.md) for detailed D3.js visualization subsystem documentation

## Development Notes

### Current State

- **Active Migration**: Converting from legacy patterns to modern React
- **Router Version**: TODO for react-router-dom@6+ migration
- **Component Deprecation**: MapHome component usage decision pending
- **State Management**: Complex context-based state with Redux integration

### Migration Patterns

- **Legacy Components**: Some components still use older React patterns
- **Modern Hooks**: Newer components leverage React hooks and context
- **Type Safety**: Gradual migration to TypeScript with type guards
- **State Architecture**: Moving toward centralized context management

### Technical Debt

- **Hardcoded Data**: MapList uses static test data instead of dynamic loading
- **Position Management**: TODO for aligning localPositions with MapD3 understanding
- **Tree ID Deprecation**: ISS-4368 refactoring needed for parentID removal
- **File URL Extraction**: TODO for extracting from defaultAppearances
- **D3.js Integration**: Multiple TODO items for D3.js optimization

## Key Questions Requiring Answers

### Architecture Decisions

1. **MapHome Component**: Should MapHome be deprecated or extended for general maps outside character context?
2. **Router Migration**: What are the specific benefits and breaking changes for react-router-dom@6+ migration?
3. **Position Management**: How should localPositions derivation align with MapD3 tree understanding?

### Data Flow Questions

4. **File URL Extraction**: What is the correct pattern for extracting fileURL from defaultAppearances?
5. **Tree ID Refactoring**: What is the new architecture for handling room relationships after parentID deprecation?
6. **Exit Validation**: How should the exit validation logic evolve with the new tree structure?

### Integration Questions

7. **D3.js Optimization**: What are the specific set-state issues requiring setTimeout workarounds?
8. **Layer Management**: How should the layer system integrate with the new WML standardization?
9. **Character Context**: What are the boundaries between authoring and playing map contexts?

### Performance Questions

10. **Tree Rendering**: How can the map tree rendering be optimized for large maps?
11. **State Updates**: What is the optimal pattern for handling real-time map updates?
12. **Memory Management**: How should D3.js resources be managed during component lifecycle?

## Future Plans

- **Complete Router Migration**: Upgrade to react-router-dom@6+ for enhanced routing capabilities
- **State Consolidation**: Unify position management between local state and D3.js
- **Performance Optimization**: Address D3.js integration bottlenecks and memory management
- **Type Safety**: Complete migration to TypeScript with comprehensive type coverage
- **Component Modernization**: Convert remaining legacy components to modern React patterns

## TEMPORARY FINDINGS: Conditional Functionality Integration

**⚠️ TEMPORARY DOCUMENTATION FOR REMOVAL PLANNING** - This section documents how conditional functionality (SchemaConditionTag, IfElse processing) is integrated with the Map component to understand the complexity of removal.

### Conditional Type Integration

The Map component system has deep integration with conditional schema tags:

- **`MapTreeCondition`**: Extended type that wraps `SchemaConditionTag` with `inherited?: boolean` flag
- **`MapTreeItem`**: Union type that includes `MapTreeCondition` alongside rooms and exits
- **`MapTreeSchemaTags`**: Includes all conditional types: `SchemaConditionTag`, `SchemaConditionStatementTag`, `SchemaConditionFallthroughTag`

### Controller-Level Conditional Processing

The MapController processes conditionals in several critical ways:

1. **Tree Filtering**: `isMapContents` type guard includes all conditional types as valid map content
2. **Room Extraction**: `extractRoomsHelper` recursively processes conditional nodes to find selected sub-items
3. **Position Management**: Conditionals can contain rooms with positions that need to be extracted and managed
4. **Tree Reordering**: The `combinedTree` reordering logic specifically handles `If`, `Statement`, and `Fallthrough` tags

### D3.js Layer Integration

Conditionals create additional D3.js layers that complicate the visualization system:

1. **Nested Layer Creation**: Each conditional statement creates a new D3 layer with its own visibility state
2. **Visibility Propagation**: Conditional layers inherit visibility from parent layers and can override it
3. **Change Handling**: Each conditional sub-tree gets its own `onChange` handler for nested updates
4. **Position Inheritance**: Conditional layers can inherit positions from previous layers

### UI Layer Integration

The MapLayers component deeply integrates conditional display:

1. **Conditional Rendering**: `ConditionLayer` component displays conditional logic with expandable UI
2. **IfElseTree Integration**: Uses `IfElseTree` from Library system for conditional editing
3. **AddIfButton**: Allows users to add new conditional blocks to maps
4. **Recursive Processing**: `MapItemLayer` recursively processes conditional children

### Data Flow Complexity

Removing conditionals affects multiple data flow paths:

1. **Tree Structure**: Conditionals create nested tree structures that affect room positioning
2. **Layer Visibility**: Conditional layers control which rooms are visible in the D3 simulation
3. **Position Updates**: Changes in conditional selection affect room positioning and D3 force simulation
4. **State Synchronization**: Conditional state must be synchronized between UI, D3, and data layers

### Removal Complexity Assessment

The conditional functionality is deeply embedded in:

- **Type System**: Core type definitions include conditional types
- **Tree Processing**: Room extraction and positioning logic handles conditional nesting
- **D3.js System**: Layer management and visibility control depend on conditional structure
- **UI Components**: Multiple components render and edit conditional logic
- **State Management**: Position updates and tree changes flow through conditional processing

**Removal Impact**: Removing conditionals requires refactoring the entire tree processing pipeline, D3.js layer system, and UI rendering logic to handle the simplified tree structure without conditional nesting.
