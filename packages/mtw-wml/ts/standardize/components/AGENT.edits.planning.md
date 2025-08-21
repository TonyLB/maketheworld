# StandardComponent Edit Pattern Planning

**⚠️ PLANNING DOCUMENT** - This document outlines the pain points created by the current edit pattern in StandardComponent classes and plans for a display-friendly wrapper solution.

## Overview

The current `StandardComponent` architecture uses a complex edit pattern that handles WML edit operations (add, remove, replace) but creates usability challenges in non-edit contexts like UI rendering and data manipulation.

## Current Edit Pattern Architecture

### How It Works
1. **Base Classes**: `StandardExitSimple`, `StandardExitRemove`, `StandardExitReplace` handle different edit states
2. **Wrapper Class**: `StandardExit` acts as a facade, delegating to the appropriate base class
3. **Payload Access**: Data is accessed via `._payload.plain` to get the resolved state
4. **State Management**: Components can transition between edit states during WML operations

### Example: StandardExit Structure
```typescript
// Complex state handling
exit._payload instanceof StandardExitSimple    // Basic exit
exit._payload instanceof StandardExitRemove    // Exit marked for removal  
exit._payload instanceof StandardExitReplace   // Exit being replaced

// Data access requires deep nesting
exit._payload.plain.to.universalKey           // Target room
exit._payload.plain.description?.value        // Exit name
```

## Pain Points Across the System

### 1. Deep Property Nesting
**Problem**: Accessing component data requires verbose property chains
**Impact**: UI code becomes hard to read and error-prone
**Examples**:
- `exit._payload.plain.to.universalKey` instead of `exit.to`
- `room._payload.plain.shortName?.value` instead of `room.name`

### 2. Edit State Complexity in Display Contexts
**Problem**: Display logic must handle edit states that aren't relevant
**Impact**: UI components become more complex than necessary
**Examples**:
- Maps component needs to check `instanceof StandardExitSimple` before rendering
- Room editor must handle `StandardExitRemove` states during display

### 3. Inconsistent Access Patterns
**Problem**: Different components access data in different ways
**Impact**: Code becomes harder to maintain and understand
**Examples**:
- Some code uses `._payload.plain`
- Some code checks edit states first
- Some code assumes simple states only

### 4. Missing Context Information
**Problem**: Components don't include contextual information needed for display
**Impact**: UI components must derive context from parent structures
**Examples**:
- `StandardExit` doesn't know which room it's from
- `StandardRoom` doesn't know which map it belongs to

## Proposed Solution: StandardComponentPlain Pattern

### Concept
Create display-friendly wrapper classes that:
- **Extend** the original `StandardComponent` for compatibility
- **Constrain** to simple states only (no edit complexity)
- **Provide** top-level proxy properties for common fields
- **Include** contextual information where needed

### Implementation Strategy

#### Phase 1: StandardExitPlain
```typescript
export class StandardExitPlain extends StandardExit {
    constructor(exit: StandardExit) {
        // Only allow simple exits (no edit states)
        if (!(exit._payload instanceof StandardExitSimple)) {
            throw new Error('StandardExitPlain only supports simple exits');
        }
        super(exit._payload);
    }
    
    // Top-level properties for easy access
    get to(): `ROOM#${string}` { return this._payload.plain.to.universalKey; }
    get name(): string { return this._payload.plain.description?.value ?? ''; }
    get hasDescription(): boolean { return !!this._payload.plain.description; }
}
```

#### Phase 2: MapExit (Context-Aware)
```typescript
export class MapExit extends StandardExitPlain {
    private _fromRoomId: `ROOM#${string}`;
    
    constructor(exit: StandardExit, fromRoomId: `ROOM#${string}`) {
        super(exit); // This ensures it's a simple exit
        this._fromRoomId = fromRoomId;
    }
    
    get from(): `ROOM#${string}` { return this._fromRoomId; }
    // Inherits clean to, name, hasDescription from StandardExitPlain
}
```

#### Phase 2.5: Evaluate StandardExitPlain in Maps Context (NEW)
- **Integrate StandardExitPlain throughout Maps code**: Replace all StandardExit usage with StandardExitPlain
- **Assess code elegance improvements**: Document before/after readability improvements
- **Measure usability gains**: Count reductions in deep property chains and instanceof checks
- **Evaluate developer experience**: Assess how much easier the code is to work with
- **Decision point**: Based on Maps experience, decide whether to proceed with Phase 3

#### Phase 3: Extend to Other Components
- `StandardRoomPlain` for room display
- `StandardFeaturePlain` for feature display
- `StandardCharacterPlain` for character display

## Benefits

### System-Wide Consistency
- **Unified API**: All components use the same access patterns
- **Predictable Behavior**: No more guessing about edit states
- **Easier Testing**: Simpler test assertions without deep property chains

### Cleaner UI Code
- **Readable**: `exit.to` instead of `exit._payload.plain.to.universalKey`
- **Safe**: No risk of accessing properties on edit state objects
- **Maintainable**: Changes to edit pattern don't affect display code

### Type Safety
- **Constrained**: Only simple states allowed in display contexts
- **Compatible**: Can be used anywhere the original component is expected
- **Extensible**: Easy to add new display-specific properties

## Implementation Plan

### Immediate (Maps Component)
1. **Create StandardExitPlain** in `packages/mtw-wml/ts/standardize/components/`
2. **Update exitExtraction utility** to return `StandardExitPlain[]`
3. **Integrate throughout Maps code** to replace all StandardExit usage
4. **Evaluate and document improvements** in code elegance and usability
5. **Make go/no-go decision** for Phase 3 (other components) based on Maps experience

### Short Term (System-Wide)
1. **Apply pattern to other components** (Room, Feature, Character)
2. **Update UI components** to use Plain versions
3. **Document best practices** for when to use Plain vs. Original

### Long Term (Architecture)
1. **Evaluate if edit pattern** can be simplified
2. **Consider if Plain classes** should be the default for new code
3. **Plan migration path** for existing components

## Cross-Reference
See `charcoal-client/src/components/Maps/AGENT.planning.md` Phase 7 for Maps-specific implementation details.

## Success Criteria

### Functional Requirements
- Display code becomes cleaner and more readable
- Edit state complexity is hidden from UI components
- Contextual information is easily accessible

### Code Quality Requirements
- Consistent access patterns across all components
- Type safety maintained throughout the system
- Backward compatibility preserved

### Performance Requirements
- No significant overhead from wrapper classes
- Minimal memory impact from additional objects
- Fast property access through proxy methods

## Evaluation Criteria for Maps Integration

### Code Elegance Metrics
- **Before/After Comparison**: Document specific examples of improved readability
- **Property Access Patterns**: Count reductions in deep property chains
- **Type Checking Complexity**: Measure reduction in `instanceof` checks
- **Error Handling**: Assess improvements in error prevention and debugging

### Usability Improvements
- **Developer Experience**: Survey developers on ease of use
- **Code Maintenance**: Measure time to understand and modify code
- **Testing Simplification**: Document improvements in test readability
- **Documentation Clarity**: Assess impact on code self-documentation

### Integration Success Indicators
- **Adoption Rate**: How quickly can existing code be migrated?
- **Breaking Changes**: Are there unexpected compatibility issues?
- **Performance Impact**: Any measurable performance degradation?
- **Developer Feedback**: Qualitative assessment of the new patterns
