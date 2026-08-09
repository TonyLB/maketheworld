# Maps Components - Agent Navigation Guide

## Kept as prototype --- not live

No route reaches this tree today. The `/Character/:CharacterId/Map/` route and all live nav call
sites into it (the `map` command, the LineEntry SpeedDial map action, the Options-mode map avatar)
were removed in the client UI inventory sweep
([`taskPlanning/charcoal-client/AGENT.uiInventory.planning.md`](../../../../../taskPlanning/charcoal-client/AGENT.uiInventory.planning.md),
D1/D6). This is deliberate retention, not an oversight --- do **not** sweep it as an orphan in a
future dead-code pass.

What's preserved:

- **`MapDThree`** --- reduced-to-practice D3.js force-graph work: custom forces (cascade, bounding,
  grid-influence, exit-seeker, flex-link), an iterator/tree simulation architecture. See
  [`AGENT.d3.md`](AGENT.d3.md).
- **`View` + `Controller` + `Edit/Area`** --- the view/edit-shared-simulation integration pattern:
  `View` wires a read-only display through the same `Controller` + `Edit/Area` stack that `Edit`
  uses. That pattern, not the specific UI, is the reusable part.

A second, more fully-developed `MapDThree` integration (drag-to-position rooms, exit-drawing tool)
is kept in `Workbench/MapEdit/` --- see
[`Workbench/AGENT.md`](../Workbench/AGENT.md) for that half.

## Overview

The Maps components provide visual map creation, editing, and viewing capabilities for the Make The World platform. This system handles both authoring (map creation/editing) and playing (character map navigation) contexts, with a primary focus on **conflict resolution and layer management** for maps that combine content from multiple asset layers.

### Key Concepts

- **Room Positioning Intelligence**: Automatic layout that prevents overlapping rooms from different asset layers
- **Forward-Only Data Flow**: Changes percolate forward to later layers without bleeding back to parent assets
- **Dual Context Architecture**: Separate editing and viewing modes with different data access patterns
- **WML Integration**: Deep integration with the World Markup Language system for data persistence

## Core Purpose

### Primary Intent

The Map system's fundamental purpose is to **resolve spatial conflicts** when multiple asset layers contribute rooms to the same map area through linear or parallel inheritance. This is particularly critical when:

- Room A (in parent asset) has nothing above/north of it
- Room B (in child asset 1) is added directly to the north
- Room C (in child asset 2) is also added to the north

Without conflict resolution, these rooms would overlap, creating a poor user experience.

### Key Responsibilities

- **Conflict Resolution**: Automatically position rooms to avoid overlaps from different asset layers
- **Linear Layer Management**: Maintain separation between inherited and editable layers while enabling visual coherence
- **Spatial Intelligence**: Use connection graphs to position rooms as close as possible to sensible connections
- **Asset Boundary Preservation**: Prevent child assets from unintentionally affecting parent asset data
- **Dynamic Exit Loading**: Use MapExit class and exitExtraction for clean, maintainable exit data management

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

- **mapTreeMemo**: Converts StandardForm data to map tree structure using modern graph traversal patterns
- **MapDThree**: D3.js integration class for interactive visualization and conflict resolution (see [`AGENT.d3.md`](AGENT.d3.md) for details)
- **useMapContext**: React hook for accessing map state and actions
- **exitExtraction**: Utility for extracting MapExit instances from StandardForm data

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

- **Router Version**: TODO for react-router-dom@6+ migration
- **Component Deprecation**: MapHome component usage decision pending
- **State Management**: Simplified context-based state with Redux integration
- **Architecture**: Conditional and Visibility systems removed, simplified linear inheritance model

### Migration Patterns

- **Legacy Components**: Some components still use older React patterns
- **Modern Hooks**: Newer components leverage React hooks and context
- **Type Safety**: Gradual migration to TypeScript with type guards
- **State Architecture**: Moving toward centralized context management

### Technical Debt

- **Position Management**: TODO for aligning localPositions with MapD3 understanding
- **Tree ID Deprecation**: ISS-4368 refactoring needed for parentID removal
- **File URL Extraction**: TODO for extracting from defaultAppearances
- **D3.js Integration**: Multiple TODO items for D3.js optimization
- **Router Migration**: TODO for react-router-dom@6+ migration

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

## Future Development

### Map Component Editor Refactor

The Map editing functionality is currently undergoing technical debt accumulation due to:

- **Complexity**: The editing system integrates multiple subsystems (D3.js, PositionFacet, ExitFacet, StandardForm)
- **Outdated Patterns**: Some code predates newer patterns like PositionFacet
- **Hasty Refactoring**: Recent changes to accommodate PositionFacet were done quickly and need consolidation

#### Disabled Tests

Several unit tests have been disabled pending this refactor. These tests are marked with `.skip()` and reference this section:

- **Controller/index.test.tsx**: Three tests related to exit structure validation
  - `should include relevant exits for each room`
  - `should include exit descriptions when present`
  - `should handle exits without descriptions`
  - Issue: Tests expect `exits` to be an array, but it's now an `ExitFacetList` with `.items` property

- **Edit/MapDThree/index.test.ts**: Two tests for MapDThree initialization
  - `should initialize stack on construction`
  - `should pass through callback functions`
  - Issue: Mock/spy setup issues with MapDThreeTree constructor

- **Edit/MapDThree/MapDThreeTree.test.ts**: One test suite
  - `MapDThreeStack` describe block
  - Issue: Schema initialization problems with WML converter map

#### Architectural Vision: From Map to Area

The current `<Map>` component suffers from a fundamental architectural mismatch: it conflates the **visual representation** (a map) with the **underlying semantic meaning** (spatial and thematic organization). This has led to several knock-on problems:

- **Exits on Rooms**: Navigation relationships are stored as properties of Rooms themselves, as if spatial organization is inherent to the place rather than a contextual relationship
- **Limited Organizational Concepts**: Features like sub-maps or hierarchical spatial organization don't align cleanly with the current metaphor
- **Tight Coupling**: Visual representation is tightly bound to data structure, limiting flexibility

**Proposed Solution: "Area" as First-Class Object**

The refactor centers on introducing **Area** as a first-class organizational concept:

1. **Room-to-Area Relationships**: Rooms are assigned to one or more Areas via references (with optional facets for additional metadata)

2. **Area-Level Navigation**: Exits and navigation relationships are stored at the **Area level**, not on individual Rooms. This means:
   - Room rendering requires consulting the current state of its containing Areas
   - Navigation is contextual to spatial organization, not inherent to the room

3. **Hierarchical Organization**: Areas provide hierarchical representation of thematic and geographic proximity, enabling:
   - Sub-areas within larger areas
   - Interaction with the Lens and Mark system (e.g., marketplace-level "Crowd Sentiment" Mark affecting all Rooms within that Area)

4. **Maps as Rendering**: Maps become a **render step** on underlying Area data, using a multi-stage pipeline:
   - D3.js network graph processing
   - Room icon image handling
   - Weighted Voronoi assembly of icon sub-images into intermediate representation
   - Final coherence and assembly via image-modal generative AI

5. **Enhanced Editing Tools**: The graphical editing interface will support working with intermediate representations that inform the final render, allowing editors to influence the rendering process at multiple stages

#### Refactoring Roadmap

**Phase 1: Core Area Concept**
- [ ] Define Area component structure in WML
- [ ] Migrate Room-to-Area relationship storage
- [ ] Update StandardForm to handle Area references

**Phase 2: Navigation Migration - From Exits to Directions**

The current exit-based navigation system is too rigid for narrative infill and asset inheritance. A room either has an exit or it doesn't, making it difficult to add intermediate locations between two connected places.

**Problem with Current System:**
- Direct exits force a choice: either a single long-distance exit (Seaward Gate → Silky Harbor) or many poorly-described intermediate rooms
- Asset inheritance makes this worse: two creators adding different intermediate stops (Elven Temple, Caravanserai) creates conflict
- Navigation is baked into the blueprint rather than emerging from it

**Proposed Solution: Direction-Based Navigation**

Replace direct `Exit` relationships with declarative `Direction` relationships that get resolved into navigable exits at render time:

- **Direction Declarations**: Instead of "Room A has Exit to Room B", use "Room A has Direction: south leads toward Silky Harbor"
- **Between Relationships**: Rooms can declare they are "Between Location X and Location Y"
- **Render-Time Resolution**: When rendering an Area, the system:
  1. Identifies all Direction declarations
  2. Finds all "Between" relationships that match those directions
  3. Builds a network graph connecting origins → intermediates → destinations
  4. Generates navigable exits based on what's actually present in the current asset set

**Example Scenario:**
```
Asset A (original):
  - Seaward Gate: Direction[south] → "toward Silky Harbor"
  - Silky Harbor: Direction[north] → "toward Capital City"

Asset B (infill):
  - Elven Temple: Between[Seaward Gate, Silky Harbor]

Asset C (infill):
  - Caravanserai: Between[Seaward Gate, Silky Harbor]

Render A only: Seaward Gate → Silky Harbor (direct exit)
Render A+B: Seaward Gate → Elven Temple → Silky Harbor
Render A+C: Seaward Gate → Caravanserai → Silky Harbor
Render A+B+C: Seaward Gate → [Elven Temple, Caravanserai] → Silky Harbor
  (system arranges intermediates based on other constraints)
```

**Migration Tasks:**
- [ ] Define Direction component structure (replacing Exit on Rooms)
- [ ] Implement Between relationship storage on Area level
- [ ] Build render-time navigation graph resolver
- [ ] Update Room rendering to use resolved exits from containing Areas
- [ ] Add validation for Between relationships against Direction declarations
- [ ] Migrate existing Exit data to Direction/Between equivalents

**Phase 3: Hierarchical Areas**
- [ ] Implement Area nesting and containment
- [ ] Integrate with Lens and Mark systems
- [ ] Update conflict resolution for multi-Area scenarios

**Phase 4: Map Rendering Pipeline**
- [ ] Design intermediate representation format
- [ ] Implement D3 network graph stage
- [ ] Build icon assembly and Voronoi processing
- [ ] Integrate generative AI coherence step

**Phase 5: Editing Interface**
- [ ] Refactor editing tools for Area-focused workflow
- [ ] Support intermediate representation editing
- [ ] Update visualization to reflect Area hierarchy

#### Re-enabling Tests

When ready to re-enable these tests:

1. Review the actual data structures (ExitFacetList, PositionFacet, etc.)
2. Update test expectations to match current implementation
3. Fix mock/spy setup for MapDThreeTree
4. Resolve Schema converter map initialization issues
5. Remove `.skip()` markers and update test assertions
