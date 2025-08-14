# Maps D3.js Subsystem - Agent Navigation Guide

**⚠️ COMPLEX VISUALIZATION SYSTEM** - This subsystem handles sophisticated D3.js-based map visualization with multiple force simulations, layer management, and real-time updates. Multiple TODO items indicate areas needing optimization and repair.

## Overview

The D3.js subsystem within Maps provides the interactive visualization engine for map editing and viewing. Its primary purpose is to **resolve spatial conflicts** when multiple asset layers contribute rooms to the same map area, using a sophisticated multi-layer force simulation system that prevents overlapping rooms while maintaining visual coherence.

### Key Concepts

- **Multi-Layer Conflict Resolution**: Cascading force layers that resolve room positioning conflicts from sibling and cousin asset layers
- **Forward-Only Data Flow**: Changes percolate forward to later layers without bleeding back to parent assets
- **Spring Model Positioning**: Rooms connected by exits use force simulation to position as close as possible to sensible connections
- **Asset Boundary Preservation**: Unimported sections reside on earlier D3 layers to prevent child assets from affecting parent data

## Core Purpose

### Primary Intent

The D3.js system's fundamental purpose is to **automatically resolve spatial conflicts** when multiple asset layers contribute rooms to overlapping map areas. This prevents the poor UI experience of overlapping rooms while maintaining the visual coherence of the map.

### Key Responsibilities

- **Conflict Resolution**: Automatically position rooms to avoid overlaps from different asset layers
- **Layer Management**: Maintain separation between asset layers while enabling visual coherence
- **Spatial Intelligence**: Use connection graphs to position rooms as close as possible to sensible connections
- **Asset Boundary Preservation**: Prevent child assets from unintentionally affecting parent asset data

## D3.js Architecture

### Directory Structure

```
MapDThree/
├── index.tsx                    # Main D3.js integration class
├── MapDThreeTree.ts            # Tree-based simulation management
├── MapDThreeIterator.tsx       # Iteration and update handling
├── baseClasses.ts              # Core type definitions
├── cascadeForce.ts             # Multi-layer force cascading
├── forceFlexLink.ts            # Custom flexible link force
├── exitDragSimulation.ts       # Exit creation drag simulation
├── exitSeekerForce.ts          # Exit target seeking force
├── gridInfluenceForce.ts       # Grid-based positioning influence
├── boundingForce.ts            # Boundary constraint forces
└── documentation/               # Additional D3.js documentation
```

### Core Classes

- **MapDThree**: Main integration class managing D3.js simulations and conflict resolution
- **MapDThreeTree**: Tree-based simulation with change detection and layer management
- **ExitDragD3Layer**: Specialized simulation for exit creation
- **ForceFlexLink**: Custom link force with flexible distance constraints

## Technical Details

### Data Structures

- **SimNode**: Extended D3.js simulation node with map-specific properties
- **MapLayer**: Layer management with room visibility and positioning
- **SimulationReturn**: Standardized simulation output format
- **MapDFSAction**: Tree diff actions for simulation updates

### Force Simulation System

#### **Core Forces**
- **Cascade Force**: Links simulations across layers with read-only data flow for conflict resolution
- **Flex Link Force**: Custom link force with min/max distance constraints
- **Exit Seeker Force**: Guides exit creation toward valid targets
- **Grid Influence Force**: Applies grid-based positioning constraints
- **Bounding Force**: Constrains nodes within defined boundaries

#### **Force Configuration**
- **Link Strength**: Dynamic strength based on node connection counts
- **Distance Constraints**: Configurable min/max distances between nodes
- **Cascade Behavior**: Multi-layer influence with stability detection
- **Performance Tuning**: Iteration counts and alpha decay settings

### Simulation Management

#### **Layer System**
- **Cascade Nodes**: Nodes that inherit positions from previous layers
- **Layer Visibility**: Per-room visibility controls for complex maps
- **Position Inheritance**: FX/FY position inheritance across simulation layers
- **Stability Detection**: Automatic detection of simulation convergence

#### **Change Detection**
- **Tree Diffing**: Efficient detection of structural changes
- **Incremental Updates**: Partial simulation updates for performance
- **Position Synchronization**: Real-time sync between visual and data states
- **Change Propagation**: Cascading updates across simulation layers

## Integration Points

### Dependencies

- **d3-force**: Core D3.js force simulation library
- **@tonylb/mtw-wml**: WML tree structures and standardization
- **@tonylb/mtw-base**: Generic tree operations and type guards
- **immer**: Immutable state updates for performance

### Cross-References

- **Map Controller**: State management and business logic
- **WML System**: Data structure integration and validation
- **React Components**: UI integration and event handling
- **Position Management**: Coordinate system integration

### System Relationships

- **Visual Layer**: Renders map data as interactive D3.js elements
- **Data Layer**: Integrates with WML tree structures for persistence
- **State Layer**: Manages simulation state and position updates
- **UI Layer**: Provides interactive editing tools and visual feedback

## Usage Patterns

### Common Scenarios

1. **Map Initialization**: Create D3.js simulation with initial tree data
2. **Room Positioning**: Use force simulation for automatic layout and conflict resolution
3. **Exit Creation**: Interactive drag simulation for exit placement
4. **Layer Management**: Multi-layer organization with visibility controls
5. **Real-Time Updates**: Live position updates during editing operations

### Best Practices

- Use cascade forces for multi-layer map organization and conflict resolution
- Configure force parameters for optimal layout behavior
- Implement proper cleanup for D3.js resources
- Handle simulation stability for consistent positioning
- Optimize force calculations for large map datasets

### Error Handling

- Validate node and link data before simulation
- Handle simulation stability and convergence
- Manage D3.js resource cleanup and memory management
- Provide fallback positioning for invalid data

## Navigation Tips

### Getting Started

1. **Begin with `baseClasses.ts`**: Understand core type definitions
2. **Examine `index.tsx`**: Main D3.js integration class
3. **Review `MapDThreeTree.ts`**: Tree-based simulation management
4. **Study `cascadeForce.ts`**: Multi-layer force implementation

### Key Files

- **`MapDThreeTree.ts`**: Complex simulation management (568 lines)
- **`forceFlexLink.ts`**: Custom force implementation (234 lines)
- **`exitDragSimulation.ts`**: Interactive exit creation (81 lines)
- **`cascadeForce.ts`**: Multi-layer force cascading (94 lines)

### Related Documentation

- See [`AGENT.md`](AGENT.md) for overall Maps component architecture
- See [`../Controller/AGENT.md`](../Controller/AGENT.md) for state management details
- See [`../../../lambda/wml/AGENT.md`](../../../lambda/wml/AGENT.md) for WML system integration

## Development Notes

### Current State

- **Functional System**: Core D3.js integration is working
- **Performance Issues**: Multiple TODO items for optimization
- **Memory Management**: D3.js resource cleanup needs improvement
- **Type Safety**: Good TypeScript coverage with type guards

### Technical Debt

#### **Critical Issues**
- **Set-State Problems**: TODO for setTimeout workarounds in D3.js updates
- **Memory Leaks**: D3.js simulation cleanup and resource management
- **Performance Bottlenecks**: Force calculation optimization needed
- **State Synchronization**: Alignment between D3.js and React state

#### **Architecture Issues**
- **Force Decoupling**: TODO for separating mutation from change processing
- **Layer Complexity**: Complex state management in DFS walk callbacks
- **Tree ID Handling**: TODO for refactoring after parentID deprecation
- **Position Alignment**: TODO for localPositions and MapD3 understanding

### Migration Patterns

- **Force Implementation**: Custom D3.js forces for map-specific behaviors
- **Tree Integration**: Deep integration with WML tree structures
- **State Management**: Complex state synchronization between D3.js and React
- **Performance Optimization**: Ongoing work on simulation efficiency

## Key Questions Requiring Answers

### D3.js Integration Questions

1. **Set-State Issues**: What are the specific set-state problems requiring setTimeout workarounds?
2. **Memory Management**: How should D3.js resources be properly managed during component lifecycle?
3. **Force Optimization**: What are the optimal force parameters for different map sizes and complexities?
4. **Simulation Stability**: How can simulation convergence be reliably detected and managed?

### Architecture Questions

5. **Force Decoupling**: How should mutation of D3.js structures be separated from change processing?
6. **Layer Management**: What is the optimal architecture for multi-layer force cascading?
7. **Tree Integration**: How should the D3.js system integrate with the new WML tree structure?
8. **State Synchronization**: What is the optimal pattern for D3.js and React state alignment?

### Performance Questions

9. **Large Map Handling**: How can the system be optimized for maps with hundreds of rooms?
10. **Force Calculation**: What are the performance bottlenecks in force calculations?
11. **Update Frequency**: What is the optimal update frequency for real-time editing?
12. **Memory Usage**: How can memory usage be optimized for complex map structures?

## Future Plans

- **Performance Optimization**: Address D3.js integration bottlenecks and memory management
- **Force Refactoring**: Simplify force implementation and reduce complexity
- **State Consolidation**: Unify D3.js and React state management
- **Memory Management**: Implement proper D3.js resource cleanup
- **Type Safety**: Enhance TypeScript coverage for D3.js operations
- **Documentation**: Expand D3.js-specific documentation and examples

## D3.js-Specific Considerations

### Force Simulation Lifecycle

- **Initialization**: Create simulations with appropriate force configurations
- **Running**: Manage simulation ticks and stability detection
- **Updates**: Handle incremental changes and force reconfiguration
- **Cleanup**: Proper disposal of D3.js resources and simulations

### Custom Force Implementation

- **ForceFlexLink**: Flexible link force with distance constraints
- **CascadeForce**: Multi-layer force influence system for conflict resolution
- **ExitSeekerForce**: Target-seeking behavior for exit creation
- **GridInfluenceForce**: Grid-based positioning constraints

### Performance Optimization

- **Force Iterations**: Configurable iteration counts for different scenarios
- **Alpha Decay**: Simulation convergence tuning
- **Node Filtering**: Efficient handling of visible/invisible nodes
- **Change Detection**: Incremental updates for performance

## Migration Planning

**⚠️ MIGRATION IN PROGRESS** - The D3.js subsystem is undergoing a system-wide refactor to remove both the Conditional system and the Visibility system. See [`AGENT.planning.md`](AGENT.planning.md) for detailed planning and implementation details.

### What's Being Removed

- **Conditional System**: All `SchemaConditionTag`, `SchemaConditionStatementTag`, and `SchemaConditionFallthroughTag` functionality
- **Visibility System**: D3.js visibility filtering, layer visibility tracking, and conditional visibility logic

### Expected Outcome

- **Simplified Layer Structure**: Linear asset inheritance layers without conditional branching
- **Cleaner Force Simulation**: All layers always visible, simpler force calculations
- **Reduced Complexity**: Eliminate nested simulation trees and visibility state management
- **Better Performance**: Remove visibility filtering overhead and conditional processing

### Current Status

- **Planning Phase**: Migration planning document created and under review
- **Implementation**: Awaiting planning approval and implementation timeline
- **Documentation**: This section will be updated as migration progresses


