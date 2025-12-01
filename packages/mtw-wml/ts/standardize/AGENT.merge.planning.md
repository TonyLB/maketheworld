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

**Expected Diff Output**: Preserve nesting structure
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
    <Room uuid=(room1) key=(room1) />
</Asset>
```

This is problematic because:
- The nested structure is lost
- The Example is no longer associated with the Room
- `topLevel` incorrectly includes the Example

## Proposed Solution

### Principle: In-Place vs. Top-Level Component Changes

The key insight is that we need to distinguish between:

1. **In-place nested changes**: A component that exists in a nested position is being modified → diff should preserve nesting, merge should apply in-place
2. **Explicit top-level changes**: A component is intentionally being moved to/created at Asset-level → diff/merge should handle at Asset-level

The `<Parent>` tag provides the mechanism to make this distinction explicit.

### Enhanced Diff Behavior

#### Case 1: Nested Component Change (In-Place)

When a nested component changes, the diff should:

1. **Preserve the nesting structure** by including parent components in the diff output
2. **Use `<Parent>` tags** to explicitly indicate where the changed component belongs
3. **Not include the component in `topLevel`** since it's a nested change

**Example 3: Proposed Diff Output for Nested Change**
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
        <Parent>ROOM#room1</Parent>
        <Replace><Name>Old Name</Name></Replace>
        <With><Name>New Name</Name></With>
    </Example>
</Asset>
```

**Key points**:
- The diff output is a **minimal representation** - only the changed component appears
- The `<Parent>` tag explicitly indicates where it belongs
- No `topLevel` entry for this component (it's nested, not at Asset-level)
- The parent (`Room`) doesn't need to appear in the diff if it hasn't changed

#### Case 2: Explicit Top-Level Component

When a component is intentionally at Asset-level:

**Example 4: Explicit Asset-Level Component**
```wml
<!-- Base -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1) />
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
        <Parent>ASSET</Parent>
        <Name>New Example</Name>
    </Example>
</Asset>
```

**Key points**:
- `<Parent>ASSET</Parent>` explicitly marks this as Asset-level
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
        <Replace>
            <Parent>ROOM#room1</Parent>
            <Name>Nested Example</Name>
        </Replace>
        <With>
            <Parent>ASSET</Parent>
            <Name>Top-Level Example</Name>
        </With>
    </Example>
</Asset>
```

**Key points**:
- Parent change is explicitly represented
- Diff shows both old parent (in `<Replace>`) and new parent (in `<With>`)
- `topLevel` diff should show addition of this component

### Enhanced Merge Behavior

The merge system should respect `<Parent>` tags to determine placement:

#### Rule 1: Explicit Parent Takes Precedence

If a component has an explicit `<Parent>` tag in the incoming/merge asset:
- Use that parent for positioning, regardless of where the component appears in the merge asset's structure
- This allows edit assets to use convenient top-level placement while maintaining correct nesting

**Example 6: Merge with Explicit Parent**
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Original</Name>
        </Example>
    </Room>
</Asset>

<!-- Edit Asset (convenient top-level placement) -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent>ROOM#room1</Parent>
        <Name>Updated</Name>
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

**Key points**:
- Edit asset places Example at top-level for convenience
- `<Parent>` tag overrides and ensures correct nesting
- Example remains nested in Room after merge
- No change to `topLevel` (Example was already nested, still nested)

#### Rule 2: In-Place Merge Recognition

When merging, if a component:
- Has the same `universalKey` as an existing component in the base asset
- Has an explicit `<Parent>` that matches the existing component's parent (or no parent if Asset-level)
- Then: Merge **in-place** rather than creating a duplicate or promoting to top-level

**Example 7: In-Place Merge Detection**
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Base Name</Name>
            <Description>Base Description</Description>
        </Example>
    </Room>
</Asset>

<!-- Edit Asset -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent>ROOM#room1</Parent>
        <Replace><Name>Base Name</Name></Replace>
        <With><Name>Updated Name</Name></With>
    </Example>
</Asset>

<!-- Merge Result (in-place) -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)>
            <Name>Updated Name</Name>
            <Description>Base Description</Description>
        </Example>
    </Room>
</Asset>
```

**Key points**:
- Component with matching `universalKey` and matching parent → in-place merge
- Existing nested structure preserved
- No change to `topLevel`

#### Rule 3: topLevel Handling in Merge

The `topLevel` reference list should only include components that are actually at Asset-level:

- If a component has `<Parent>ASSET</Parent>` or no parent → include in `topLevel`
- If a component has `<Parent>ROOM#room1</Parent>` or similar → do NOT include in `topLevel`
- When merging, `topLevel` should be merged using `ReferenceList.diff()` logic, considering parent relationships

**Example 8: topLevel Merge**
```wml
<!-- Base Asset -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1) />
    <Example uuid=(ex1) key=(ex1)><Name>Top-level</Name></Example>
</Asset>
<!-- topLevel: [ROOM#room1, EXAMPLE#ex1] -->

<!-- Incoming Asset -->
<Asset uuid=(Test)>
    <Example uuid=(ex1) key=(ex1)>
        <Parent>ROOM#room1</Parent>
        <Name>Now nested</Name>
    </Example>
</Asset>
<!-- topLevel: [] (no Asset-level components) -->

<!-- Merge Result -->
<Asset uuid=(Test)>
    <Room uuid=(room1) key=(room1)>
        <Example uuid=(ex1) key=(ex1)><Name>Now nested</Name></Example>
    </Room>
</Asset>
<!-- topLevel: [ROOM#room1] (ex1 removed from topLevel, now nested) -->
```

## Implementation Considerations

### Diff Generation Changes

1. **Preserve Nesting Context in Diff**:
   - When generating diff for nested components, include `<Parent>` tags
   - Detect if component's parent relationship has changed
   - Output minimal diffs that preserve structural context

2. **topLevel Diff Processing**:
   - When diffing `topLevel`, consider parent relationships
   - A component moving from nested → Asset-level should add to `topLevel` diff
   - A component moving from Asset-level → nested should remove from `topLevel` diff

3. **Component Diff Output Format**:
   - Nested component diffs should include `<Parent>` tag
   - This makes the diff self-contained and mergeable

### Merge Processing Changes

1. **Explicit Parent Resolution**:
   - Check for `<Parent>` tags before determining component placement
   - Use explicit parent over implicit parent when present
   - Validate that referenced parent components exist

2. **In-Place Merge Detection**:
   - Before merging, check if incoming component matches existing component (same `universalKey`)
   - Check if parent relationship matches (both have same parent or both Asset-level)
   - If match found → in-place merge, preserve nesting structure
   - If no match → treat as new component, use parent to determine placement

3. **topLevel Update During Merge**:
   - After component placement is determined, update `topLevel`
   - Components with `<Parent>ASSET</Parent>` or no parent → add to `topLevel`
   - Components with explicit nested parent → remove from `topLevel` if previously there
   - Merge `topLevel` references using `ReferenceList.merge()` logic

4. **Backward Compatibility**:
   - If no `<Parent>` tag present, use current implicit parent logic
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

1. **Phase 1**: Implement diff generation with `<Parent>` tags (output-only)
2. **Phase 2**: Implement merge processing that respects `<Parent>` tags
3. **Phase 3**: Add validation and error handling for invalid parent references
4. **Phase 4**: Update tooling to generate `<Parent>` tags when creating edit assets

## Open Questions

1. Should diff always include `<Parent>` tags, or only when parent differs from implicit parent?
2. How should we handle components that exist in multiple nested locations (e.g., same Example in multiple Rooms)?
3. Should `topLevel` be automatically maintained, or should it be explicitly managed by merge/diff operations?
4. What happens if a `<Parent>` tag references a component that doesn't exist in the base asset?

