# Merge and Diff System Enhancement: Nested Component Handling with topLevel

## Problem Statement

Currently, when generating diffs for nested components (e.g., an `Example` nested inside a `Room`), the system fails to properly represent the nested structure in the diff output. Additionally, when merging such diffs, the system doesn't distinguish between:

1. **In-place changes**: A component that already exists in a nested position and is being modified
2. **New top-level components**: A component being added at the Asset level

With the introduction of the `<Parent>` tag for explicit parent specification, we can improve both diff generation and merge behavior to handle nested component changes more precisely.

## Current Behavior

### Current Diff Behavior

When diffing nested components, the current system:

**Example 1: Nested Component Change (Currently Failing)**
```wml
<!-- Base -->
<Asset uuid=(Test)>
    <Room uuid=(testRoom) key=(testRoom)>
        <Example uuid=(base) key=(base)>
            <Name>Old Name</Name>
        </Example>
    </Room>
</Asset>

<!-- Incoming -->
<Asset uuid=(Test)>
    <Room uuid=(testRoom) key=(testRoom)>
        <Example uuid=(base) key=(base)>
            <Name>New Name</Name>
        </Example>
    </Room>
</Asset>
```

**Current Diff Output**: Empty Asset (incorrect - losing nested structure)
```wml
<Asset uuid=(Test) />
```

**Current Expected Diff Output** (nested structure preserved - though bugs currently prevent this):
```wml
<Asset uuid=(Test)>
    <Room uuid=(testRoom) key=(testRoom)>
        <Example uuid=(base) key=(base)>
            <Replace><Name>Old Name</Name></Replace>
            <With><Name>New Name</Name></With>
        </Example>
    </Room>
</Asset>
```

**Note**: While this nested structure format is the current expected output, bugs in the diff system currently prevent it from being generated correctly. This document proposes migrating to a minimal diff format (see Case 1 below) for better merge behavior.

### Current Merge Behavior

When merging components, the system uses `implicitParent` relationships determined through graph-based topological resolution. Components in edit assets that appear at the top level are currently promoted to Asset-level in the merged result, even if they were originally nested.

**Example 2: Top-Level Edit Component**
```wml
<!-- Base -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Original</Name>
        </Example>
    </Room>
</Asset>

<!-- Edit Asset (top-level for convenience) -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Name>Updated</Name>
    </Example>
</Asset>
```

**Current Merge Result**: Example gets promoted to Asset-level (topLevel includes `ex1`)
```wml
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Name>Updated</Name>
    </Example>
    <Room uuid=(room1) key=(room1)>
        <Example key=(ex1) />
    </Room>
</Asset>
```

This is problematic because:
- `topLevel` incorrectly includes the Example
- The sense of Example being a _subtag_ of Room is muddied

## Proposed Solution

### Principle: In-Place vs. Top-Level Component Changes

The key insight is that we need to distinguish between:

1. **In-place nested changes**: A component that exists in a nested position is being modified → diff outputs minimal component-only change, merge applies changes and parent relationship is naturally recreated (since `explicitParent` and `referencedKeys` in other components are unchanged)
2. **Explicit top-level changes**: A component is intentionally being moved to/created at Asset-level → diff/merge should handle at Asset-level

The `<Parent>` tag provides the mechanism to make this distinction explicit.

### Enhanced Diff Behavior

#### Case 1: Nested Component Change (In-Place) - Default Behavior (NEW)

**Migration Note**: Currently, diffs preserve nested structure (see "Current Expected Diff Output" above). We propose migrating to a minimal diff format for better merge behavior.

When a nested component changes while the hierarchy remains the same, the NEW diff format should:

1. **Output minimal diff** - only the changed component appears, no parent components
2. **Not use `<Parent>` tags** - this is the default behavior for in-place changes
3. **Not include the component in `topLevel`** since it's a nested change
4. Merge will naturally recreate the parent relationship during `generateImplicitParents()` since structural relationships (explicitParent, referencedKeys) remain unchanged

**Example 3: NEW Proposed Diff Output for Nested Change** (replacing current nested structure format)
```wml
<!-- Base -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Old Name</Name>
        </Example>
    </Room>
</Asset>

<!-- Incoming -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>New Name</Name>
        </Example>
    </Room>
</Asset>

<!-- Proposed Diff Output -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Replace><Name>Old Name</Name></Replace>
        <With><Name>New Name</Name></With>
    </Example>
</Asset>
```

**Key points**:
- The NEW diff output is **minimal** - only the changed component appears (vs. current nested structure format)
- **No `<Parent>` tag** - this is the default for in-place changes
- No `topLevel` entry for this component (it's nested, not at Asset-level)
- Merge applies changes in-place; parent relationship is naturally recreated during `generateImplicitParents()` since structural relationships remain unchanged
- **Migration**: This replaces the current nested structure format shown in "Current Expected Diff Output" above

#### Case 2: Explicit Top-Level Component

When a component is intentionally at Asset-level:

**Example 4: Explicit Asset-Level Component**
```wml
<!-- Base -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Old Example</Name>
        </Example>
    </Room>
</Asset>

<!-- Incoming -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Name>New Example</Name>
    </Example>
    <Room uuid=(room1) key=(room1) />
</Asset>

<!-- Proposed Diff Output -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent />
        <Replace><Name>Old Example</Name></Replace>
        <With><Name>New Example</Name></With>
    </Example>
</Asset>
```

**Key points**:
- `<Parent />` (empty/self-closing) explicitly marks this as Asset-level
- `topLevel` should include this component's reference
- This is a new component at Asset-level, not an in-place change

#### Case 3: Component Moving from Nested to Top-Level

When a component moves from nested to Asset-level:

**Example 5: Component Relocation**
```wml
<!-- Base -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Nested Example</Name>
        </Example>
    </Room>
</Asset>

<!-- Incoming -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Name>Top-Level Example</Name>
    </Example>
    <Room uuid=(room1) key=(room1) />
</Asset>

<!-- Proposed Diff Output -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent />
        <Replace><Name>Nested Example</Name></Replace>
        <With><Name>Top-Level Example</Name></With>
    </Example>
    <Room uuid=(room1) key=(room1)>
        <Remove><Example key=(ex1) /></Remove>
    </Room>
</Asset>
```

**Key points**:
- `<Parent />` (empty) indicates the component should be at Asset-level
- The component shows the content change with Replace/With
- The **parent Room** explicitly shows removal of the *reference* to the Example (not the component itself) via `<Remove>`
- `topLevel` diff should show addition of this component (moving from nested to Asset-level)
- **Important distinction**: Removing the reference from Room means the Example is no longer nested under Room, but the Example component itself still exists (now at Asset-level)

### Enhanced Merge Behavior

The merge algorithm works as follows:

1. **Calculate `implicitParent`**: From the merged result by finding the longest common thread of ancestry that all appearances of the merged component share (appearances in the incoming diff are handled specially)

2. **Calculate `explicitParent`**: By the normal edit rules for `StandardExplicitParent` (empty `<Parent />` = ASSET, otherwise the referenced component)

3. **Determine Final Parent**: Use `explicitParent` if present, otherwise fall back to `implicitParent`. If `explicitParent` matches `implicitParent`, remove `explicitParent` (redundant)

4. **Ensure Reference Consistency**: 
   - If component's parent is another component and that parent doesn't have a reference to the child → add the reference
   - If component's parent is ASSET and `topLevel` doesn't have a reference → add reference to `topLevel`

5. **Render Hierarchy**: According to existing `StandardForm` rules

This algorithm naturally handles all three diff cases without special-case logic.

#### Example 6: Merge with Minimal Diff (Case 1)

**Example 6: Merge with Minimal Diff (Case 1)**
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Original</Name>
        </Example>
    </Room>
</Asset>
<!-- Example has implicitParent = ROOM#room1 -->

<!-- Diff Asset (Case 1 format - minimal component-only diff) -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Replace><Name>Original</Name></Replace>
        <With><Name>Updated</Name></With>
    </Example>
</Asset>

<!-- Merge Result -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Updated</Name>
        </Example>
    </Room>
</Asset>
```

**How Algorithm Applies**:
- No `explicitParent` → uses `implicitParent`
- `implicitParent` calculated from merged graph → Room (unchanged since structural relationships remain)
- Final parent = Room
- Room already has reference → no change needed
- Component not at Asset-level → not added to `topLevel`
- Result: Component stays nested under Room

#### Example 7a: Merge with Empty `<Parent />` - New Asset-Level Component (Case 2 Diff)
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1) />
    </Room>
</Asset>

<!-- Diff Asset (Case 2 format - new Asset-level) -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent />
        <Name>New Example</Name>
    </Example>
</Asset>

<!-- Merge Result -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Name>New Example</Name>
    </Example>
    <Room uuid=(room1) key=(room1)>
        <Example key=(ex1) />
    </Room>
</Asset>
<!-- topLevel: [ROOM#room1, EXAMPLE#ex1] -->
```

**How Algorithm Applies**:
- `explicitParent` = ASSET (from `<Parent />`)
- `implicitParent` calculated from merged graph → ASSET (component at top-level)
- `explicitParent` matches `implicitParent` → remove `explicitParent` (redundant)
- Final parent = ASSET
- `topLevel` doesn't have reference → add it
- Result: Component at Asset-level, in `topLevel`
- **Note**: Previous parent references persist unless explicitly removed (see Example 8)

#### Example 8: Merge with Reference Removal (Case 3)
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Nested Example</Name>
        </Example>
    </Room>
</Asset>
<!-- Room has Example in its examples reference list -->

<!-- Diff Asset (Case 3) -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent />
        <Replace><Name>Nested Example</Name></Replace>
        <With><Name>Top-Level Example</Name></With>
    </Example>
    <Room uuid=(room1) key=(room1)>
        <Remove><Example key=(ex1) /></Remove>
    </Room>
</Asset>

<!-- Merge Result -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1) />
    <!-- Room's examples reference list no longer contains ex1 -->
    <Example uuid=(ex1) key=(ex1)>
        <Name>Top-Level Example</Name>
    </Example>
</Asset>
<!-- topLevel: [ROOM#room1, EXAMPLE#ex1] -->
```

**How Algorithm Applies**:
- `explicitParent` = ASSET (from `<Parent />`)
- Room's reference removed via `<Remove>` tag during merge
- `implicitParent` calculated from merged graph → ASSET (no Room connection anymore)
- `explicitParent` matches `implicitParent` → remove `explicitParent` (redundant)
- Final parent = ASSET
- `topLevel` doesn't have reference → add it
- Result: Component at Asset-level, in `topLevel`, Room's reference removed

#### Example 9: Component Moving from Asset-Level to Nested
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1) />
    <Example uuid=(ex1) key=(ex1)><Name>Top-level</Name></Example>
</Asset>
<!-- topLevel: [ROOM#room1, EXAMPLE#ex1] -->

<!-- Diff Asset (component moving to nested) -->
<Asset uuid=(Test)>
    <Remove><Example key=(ex1) /></Remove>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Parent>room1</Parent>
            <Replace><Name>Top-level</Name></Replace>
            <With><Name>Now nested</Name></With>
        </Example>
    </Room>
</Asset>

<!-- Merge Result -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)><Name>Now nested</Name></Example>
    </Room>
</Asset>
<!-- topLevel: [ROOM#room1] (ex1 removed from topLevel, now nested) -->
```

**How Algorithm Applies**:
- `explicitParent` = room1 (from `<Parent>room1</Parent>`)
- Remove tag at Asset-level removes Example from topLevel during merge
- `implicitParent` calculated from merged graph → room1 (Room has Example nested)
- `explicitParent` matches `implicitParent` → remove `explicitParent` (redundant)
- Final parent = room1
- Room needs reference to Example → add it (if not already present)
- Example not at Asset-level → remove from `topLevel`
- Result: Component nested under Room, removed from `topLevel`

### Summary: Key Merge Behavior Algorithm

The merge algorithm works as follows:

1. **Calculate `implicitParent`**:
   - Calculated from the merged result by finding the longest common thread of ancestry that all appearances of the merged component share
   - Appearances in the incoming diff are handled specially: for instance, a Room appearing in the diff with an Example nested in it implies a parent-child connection between that Room and that Example

2. **Calculate `explicitParent`**:
   - Calculated by the normal edit rules for `StandardExplicitParent` (merge/diff logic)
   - If `<Parent />` is empty → `explicitParent` = ASSET
   - If `<Parent>` contains a reference → `explicitParent` = that component reference

3. **Determine Final Parent**:
   - Use `explicitParent` if present, otherwise fall back to `implicitParent`
   - If `explicitParent` matches `implicitParent` (both resolve to same parent), remove `explicitParent` (it's redundant)

4. **Ensure Reference Consistency**:
   - If component's parent (explicit or implicit) is another component, and that parent component does not have a reference to the child → add the reference
   - If component's parent is ASSET, and `topLevel` does not have a reference to the child → add reference to `topLevel`

5. **Render Hierarchy**:
   - Hierarchy is rendered according to the existing rules for `StandardForm`
   - Components appear nested under their parent (as determined above)
   - `topLevel` contains references to Asset-level components

This algorithm naturally handles all three diff cases:
- **Case 1**: No explicitParent → uses implicitParent from graph → maintains nested structure
- **Case 2**: explicitParent = ASSET → component at Asset-level → added to topLevel
- **Case 3**: explicitParent = ASSET + parent removes reference → implicitParent recalculates to ASSET → explicitParent removed (redundant) → component at Asset-level → added to topLevel

## Implementation Considerations

### Diff Generation Changes

1. **Nested Component Diff (Case 1 - Default)**:
   - When generating diff for nested components that remain nested, output minimal diff
   - Only the changed component appears - no parent components included
   - **No `<Parent>` tag needed** - merge will naturally recreate the parent relationship during `generateImplicitParents()`
   - This is the default behavior for in-place changes

2. **Asset-Level Component Diff (Case 2)**:
   - When component is at Asset-level, use empty `<Parent />` tag
   - Component appears at top-level in diff
   - `topLevel` should include component reference

3. **Component Relocation Diff (Case 3)**:
   - When component moves from nested → Asset-level:
     - Component appears with `<Parent />` tag (empty = Asset-level)
     - Parent component shows `<Remove><ChildComponent /></Remove>` to remove the reference
     - `topLevel` diff should show addition of component
   - **Important**: Parent's `<Remove>` removes the *reference*, not the component itself

4. **topLevel Diff Processing**:
   - When diffing `topLevel`, consider parent relationships
   - Case 1 (nested changes): No change to `topLevel`
   - Case 2 (new Asset-level): Add to `topLevel`
   - Case 3 (moving to Asset-level): Add to `topLevel` (remove from parent's references only if explicitly shown in diff)
   - Component moving from Asset-level → nested: Remove from `topLevel`

5. **Component Diff Output Format**:
   - Case 1: Nested structure (no `<Parent />` tag needed)
   - Cases 2 & 3: Empty `<Parent />` tag to indicate Asset-level
   - Makes diffs self-contained and mergeable

### Merge Processing Changes

The merge behavior follows the algorithm described in "Summary: Key Merge Behavior Algorithm" above. Key implementation points:

1. **Algorithm Implementation**:
   - Calculate `implicitParent` from merged graph (considering diff appearances for parent-child connections)
   - Calculate `explicitParent` from edit rules (empty `<Parent />` = ASSET, `<Parent>ref</Parent>` = that component)
   - Determine final parent: use `explicitParent` if present, else `implicitParent`
   - If `explicitParent` matches `implicitParent`, remove `explicitParent` (redundant)
   - Ensure reference consistency:
     - If parent is a component and doesn't have reference to child → add reference
     - If parent is ASSET and `topLevel` doesn't have reference → add to `topLevel`
   - Render hierarchy according to existing `StandardForm` rules

2. **Diff Format Handling**:
   - **Case 1 (Minimal Diff)**: No `<Parent />` → no `explicitParent` → uses `implicitParent` → maintains nested structure
   - **Case 2 (New Asset-Level)**: `<Parent />` → `explicitParent` = ASSET → component at Asset-level → added to `topLevel`
   - **Case 3 (Component Moving)**: `<Parent />` + parent removes reference → `explicitParent` = ASSET → `implicitParent` recalculates to ASSET → component at Asset-level → added to `topLevel`

3. **Reference Updates**:
   - References are updated during merge according to normal edit rules (`<Remove>`, `<Replace>`, etc.)
   - Reference consistency step ensures parent-child relationships are reflected in reference lists
   - `topLevel` is updated based on final component placement (Asset-level components added to `topLevel`)

7. **Backward Compatibility**:
   - If diff has no `<Parent />` tag and no nested structure → use current implicit parent logic
   - This ensures existing code continues to work

### Schema Considerations

1. **`<Parent>` Tag Syntax**:
   - Value can be `'ASSET'` (string literal) or a ComponentUUID/StandardKey
   - Should be optional (backward compatible)

2. **Validation**:
   - Validate that parent references exist in the asset
   - Validate that parent type is legal for the component type (e.g., Example can be parented by Room, Feature, Knowledge, or Asset)

## Benefits

1. **Precise Diff Output**: Diffs can represent nested component changes accurately
2. **Convenient Edit Assets**: Editors can place components at top-level for convenience while maintaining correct nesting via `<Parent>` tags
3. **Explicit Control**: Developers can explicitly control component placement
4. **Correct topLevel Tracking**: `topLevel` accurately reflects only Asset-level components
5. **Backward Compatible**: Existing code without `<Parent>` tags continues to work

## Migration Path

1. **Phase 1**: Implement minimal diff format (Case 1) - migrate from nested structure format to component-only diffs
2. **Phase 2**: Implement diff generation with `<Parent />` tags for Asset-level components (Cases 2 & 3)
3. **Phase 3**: Implement merge processing that respects `<Parent />` tags and handles minimal diffs correctly
4. **Phase 4**: Add validation and error handling for invalid parent references
5. **Phase 5**: Update tooling to generate minimal diffs and `<Parent />` tags when creating edit assets

## Open Questions

1. Should diff always include `<Parent>` tags, or only when parent differs from implicit parent?
2. How should we handle components that exist in multiple nested locations (e.g., same Example in multiple Rooms)?
3. Should `topLevel` be automatically maintained, or should it be explicitly managed by merge/diff operations?
4. What happens if a `<Parent>` tag references a component that doesn't exist in the base asset?

