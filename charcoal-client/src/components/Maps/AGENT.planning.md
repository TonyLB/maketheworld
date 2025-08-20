# Maps Component Migration Planning - Temporary Workspace

**⚠️ TEMPORARY PLANNING DOCUMENT** - This document serves as a collaborative workspace for planning the removal of both the Conditional system and the Visibility system from the Maps component. This is part of a system-wide refactor to simplify the architecture.

**Status**: Planning Phase - Not yet implemented  
**Target**: Remove both Conditional and Visibility systems to simplify the Maps component architecture  
**Timeline**: TBD - Awaiting implementation planning and approval  

## Migration Overview

### What We're Removing

1. **Conditional System**: All `SchemaConditionTag`, `SchemaConditionStatementTag`, and `SchemaConditionFallthroughTag` functionality
2. **Visibility System**: Layer visibility controls, conditional visibility logic, and D3.js visibility filtering

### Why We're Removing Both

- **Conditionals**: Create complex nested tree structures that complicate room positioning and D3.js layer management
- **Visibility**: Provides minimal value in a post-conditional world and adds unnecessary complexity
- **Architecture Simplification**: Both systems are deeply intertwined and removing them together provides maximum simplification benefit

### Expected Outcome

- **Simplified Tree Structure**: Linear ancestry tree without conditional branching
- **Cleaner D3.js System**: All layers always visible, simpler force simulation
- **Reduced Complexity**: Eliminate nested change handlers and visibility state management
- **Better Performance**: Remove visibility filtering overhead and conditional processing

## Conditional System Removal Planning

### Current Integration Points

#### Type System Dependencies
- **`MapTreeCondition`**: Extended type wrapping `SchemaConditionTag` with `inherited?: boolean` flag
- **`MapTreeItem`**: Union type including `MapTreeCondition` alongside rooms and exits
- **`MapTreeSchemaTags`**: Includes all conditional types: `SchemaConditionTag`, `SchemaConditionStatementTag`, `SchemaConditionFallthroughTag`

#### Controller-Level Processing
- **Tree Filtering**: `isMapContents` type guard includes all conditional types as valid map content
- **Room Extraction**: `extractRoomsHelper` recursively processes conditional nodes to find selected sub-items
- **Position Management**: Conditionals can contain rooms with positions that need extraction and management
- **Tree Reordering**: `combinedTree` reordering logic specifically handles `If`, `Statement`, and `Fallthrough` tags

#### D3.js Layer Integration
- **Nested Layer Creation**: Each conditional statement creates a new D3 layer with its own visibility state
- **Visibility Propagation**: Conditional layers inherit visibility from parent layers and can override it
- **Change Handling**: Each conditional sub-tree gets its own `onChange` handler for nested updates
- **Position Inheritance**: Conditional layers can inherit positions from previous layers

#### UI Layer Integration
- **Conditional Rendering**: `ConditionLayer` component displays conditional logic with expandable UI
- **IfElseTree Integration**: Uses `IfElseTree` from Library system for conditional editing
- **AddIfButton**: Allows users to add new conditional blocks to maps
- **Recursive Processing**: `MapItemLayer` recursively processes conditional children

### Removal Complexity Assessment

The conditional functionality is deeply embedded in:
- **Type System**: Core type definitions include conditional types
- **Tree Processing**: Room extraction and positioning logic handles conditional nesting
- **D3.js System**: Layer management and visibility control depend on conditional structure
- **UI Components**: Multiple components render and edit conditional logic
- **State Management**: Position updates and tree changes flow through conditional processing

**Removal Impact**: Removing conditionals requires refactoring the entire tree processing pipeline, D3.js layer system, and UI rendering logic to handle the simplified tree structure without conditional nesting.

## Visibility System Removal Planning

### Current Implementation

#### UI-Level Visibility Controls
- **`useMapStyles.ts`**: Defines grid layouts with `visibilityControl` areas
- **`MapLayers` component**: Shows inherited vs. local content with visual indicators
- **`inheritedInvisible` context flag**: Controls icon coloring for inherited content

#### D3.js Layer Visibility
- **`SimulationTreeNode`**: Includes `visible: boolean` property
- **`MapDThreeTree._visibleLayers`**: Tracks which layers are currently visible
- **`getNodes()` method**: Filters nodes based on `_visibleLayers` array
- **`mapDFSWalk`**: Processes visibility state during tree traversal

#### Visibility Toggle Actions
- **`MapDispatchToggleBranchVisibility`**: Action type for toggling layer visibility
- **`ToggleVisibility` case**: In MapController dispatches to Redux store
- **Visibility state**: Affects which layers participate in D3.js force simulation

### Post-Conditional Visibility Complexity

After removing conditionals, the visibility system would handle a much simpler structure:
- **Linear Ancestry Tree**: Only asset inheritance layers (non-branching tree)
- **Single Editable Layer**: One layer for the current asset being edited
- **Simplified Visibility Logic**: No conditional selection state to consider
- **Reduced Layer Count**: Fewer layers mean simpler visibility management

### Visibility System Value Assessment

**Current Value (with conditionals)**: High - Allows editors to manage complex conditional layer trees
**Post-Conditional Value**: Low - Simple linear ancestry tree doesn't require complex visibility controls

### Removal Impact Assessment

#### High Impact Areas for Visibility System Removal

1. **UI Components**:
   - Remove `visibilityControl` grid areas from `useMapStyles.ts`
   - Simplify `MapLayers` component to remove visibility toggle controls
   - Remove `inheritedInvisible` context and related icon coloring logic

2. **D3.js System**:
   - Simplify `SimulationTreeNode` to remove `visible` property
   - Remove `_visibleLayers` tracking from `MapDThreeTree`
   - Simplify `getNodes()` to always return all layers
   - Remove visibility logic from `mapDFSWalk`

3. **State Management**:
   - Remove `MapDispatchToggleBranchVisibility` action type
   - Remove `ToggleVisibility` case from MapController
   - Remove visibility-related Redux state management

4. **Type System**:
   - Remove `visible` property from `SimulationTreeNode`
   - Remove `roomVisibility` from `MapDThreeIterator`
   - Simplify visibility-related type definitions

## D3.js System Specific Planning

### Conditional D3.js Layer Complexity

#### Current Conditional Layer Creation
- **Nested Layer Generation**: Each `SchemaConditionTag` creates a new D3 layer with its own visibility state
- **Recursive Layer Processing**: `mapTreeTranslate` recursively processes conditional children, creating nested simulation trees
- **Visibility Inheritance**: Conditional layers inherit visibility from parent layers and can override it based on `selected` state
- **Change Handler Nesting**: Each conditional sub-tree gets its own `onChange` handler for nested updates

#### MapDThreeTree Conditional Integration
- **Conditional Node Detection**: `treeNodeTypeguard(isSchemaCondition)` identifies conditional nodes for special processing
- **Nested Change Handling**: Creates `nestedOnChange` functions that map changes to specific conditional sub-trees
- **Visibility Propagation**: Conditional visibility affects which rooms and exits are included in the D3 simulation
- **Layer Key Generation**: Conditional layers get unique keys like `parentId::(condition)` or `parentId::[fallthrough]`

#### Simulation Tree Translation Complexity
- **Conditional Branching**: When a conditional node is encountered, it processes all children (If, ElseIf, Else)
- **Visibility Calculation**: Each conditional branch's visibility depends on parent visibility AND the `selected` state
- **Recursive Processing**: Conditional children are recursively processed through `mapTreeTranslate`
- **Position Inheritance**: Conditional layers can inherit positions from previous layers in the cascade

### D3.js Visibility System Complexity

#### Current D3.js Visibility Architecture
- **SimulationTreeNode Visibility**: Each node includes `visible: boolean` property affecting force simulation participation
- **Layer-Level Visibility Tracking**: `_visibleLayers` array tracks which layers are currently visible
- **Visibility State Propagation**: `mapDFSWalk` processes visibility state during tree traversal
- **Dynamic Layer Filtering**: `_visibleLayers` array changes based on conditional selection changes

#### Post-Conditional D3.js Visibility Simplification
- **Linear Ancestry Layers**: Only asset inheritance layers (non-branching tree)
- **Single Editable Layer**: One layer for the current asset being edited
- **Simplified Visibility Logic**: No conditional selection state to consider
- **Reduced Layer Count**: Fewer layers mean simpler visibility management

### D3.js Removal Complexity

Removing conditionals from the D3.js system requires:
1. **Layer Simplification**: Remove conditional layer creation and nested simulation trees
2. **Visibility Logic**: Simplify layer visibility to only consider asset inheritance, not conditional selection
3. **Change Handling**: Remove nested change handlers and conditional sub-tree processing
4. **Position Inheritance**: Simplify position inheritance to only consider asset layer relationships
5. **Tree Processing**: Remove conditional node detection and special processing in `mapTreeTranslate`

## Implementation Planning

### Phase 1: Tree Processing Simplification ✅ COMPLETED
- ✅ Refactor `extractRoomsHelper` to handle only room/exit nodes
- ✅ Simplify `combinedTree` reordering logic
- ✅ Remove conditional processing from tree traversal
- ✅ Update room extraction to work with linear ancestry
- ✅ Remove orphaned ToggleVisibility action and visibility controls
- **Note**: Still using conditional types during this phase

### Phase 2: D3.js System Refactoring ✅ COMPLETED
- ✅ Remove conditional layer creation from `mapTreeTranslate`
- ✅ Simplify `MapDThreeTree` to handle only asset inheritance layers
- ✅ Remove visibility system from D3.js simulation
- ✅ Update force simulation to work with simplified layer structure
- **Note**: Still using conditional types during this phase

### Phase 3: UI Component Updates
- Remove conditional rendering components
- Simplify `MapLayers` to show only asset inheritance
- Remove visibility controls and related styling
- Update layer display to show linear ancestry
- **Note**: Still using conditional types during this phase

### Phase 4: State Management Cleanup
- Remove conditional-related Redux actions
- Simplify MapController to handle only asset inheritance
- Remove visibility state management
- Update position management for simplified tree structure
- **Note**: Still using conditional types during this phase

### Phase 5: Type System Cleanup
- Remove conditional types from `MapTreeItem` union
- Remove `MapTreeCondition` type
- Update `MapTreeSchemaTags` to exclude conditional types
- Remove conditional-related type guards
- **Note**: Only after all functional code has been updated to not reference these types

### Phase 6: Functional Cleanup
- Remove unused Redux `toggle` action from mapEdit slice
- Remove unused `mapEditConditionsByMapId` and `mapEditConditionState` selectors
- Clean up any remaining orphaned conditional-related code
- Remove unused imports and dependencies
- **Note**: This phase focuses on removing backend infrastructure that's no longer needed

## Risk Assessment

### High Risk Areas
- **D3.js Force Simulation**: Complex multi-layer force system may break with simplified structure
- **Position Inheritance**: Room positioning logic may need significant refactoring
- **Tree Processing**: Core tree operations may have hidden conditional dependencies

### Medium Risk Areas
- **UI Components**: Layer display and editing may need substantial updates
- **State Synchronization**: D3.js and React state alignment may be affected
- **Performance**: Simplified system may reveal performance bottlenecks

### Low Risk Areas
- **Type Definitions**: Removing types is generally safe
- **Documentation**: Updating documentation is straightforward
- **Testing**: Test updates should be predictable

## Success Criteria

### Functional Requirements
- Maps render correctly without conditional functionality
- Room positioning works with simplified tree structure
- D3.js force simulation functions without visibility filtering
- UI components display only asset inheritance layers

### Performance Requirements
- No degradation in map rendering performance
- Simplified tree processing improves performance
- D3.js simulation is more predictable and stable
- Reduced memory usage from simplified state management

### Code Quality Requirements
- Reduced complexity in tree processing logic
- Cleaner D3.js integration without conditional layers
- Simplified state management
- Better testability without conditional complexity

## Next Steps

1. **Review and Approve**: This planning document needs review and approval
2. **Implementation Order**: Determine the optimal order for the implementation phases
3. **Testing Strategy**: Plan comprehensive testing for each phase
4. **Rollback Plan**: Prepare rollback strategy if issues arise
5. **Timeline**: Establish realistic timeline for implementation

---

**Note**: This document will be updated as planning progresses and implementation details are finalized. It serves as a living document for the migration team to collaborate on the removal of both Conditional and Visibility systems.
