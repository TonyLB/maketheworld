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

## Phase 4: v2ComponentClassFactory Architecture (NEW)

### Overview
Implement a new factory pattern that creates abstract parent classes with concrete subtype instances, enabling the ergonomic `instanceof` pattern while maintaining the discriminated union semantics.

### Design Pattern
Based on ChatGPT's recommendation, implement a factory method that returns appropriate subtypes:

```typescript
// Abstract parent class prevents direct instantiation
abstract class StandardExit {
    protected constructor() {}
    
    // Factory method decides which subtype to return
    static create(format: ExitFormat): StandardExit {
        switch (format.kind) {
            case "plain":
                return new StandardExitPlain(format.data);
            case "remove":
                return new StandardExitRemove(format.match);
            case "replace":
                return new StandardExitReplace(format.match, format.newData);
        }
    }
}

// Concrete subtypes implement specific functionality
class StandardExitPlain extends StandardExit {
    constructor(public data: ExitData) { super(); }
    // Plain exit implementation
}

class StandardExitRemove extends StandardExit {
    constructor(public match: ExitData) { super(); }
    // Remove edit implementation
}

class StandardExitReplace extends StandardExit {
    constructor(public match: ExitData, public newData: ExitData) { super(); }
    // Replace edit implementation
}
```

### Implementation Strategy

#### Phase 4.1: Create v2ComponentClassFactory
- **Location**: `packages/mtw-wml/ts/standardize/components/component.ts`
- **Function**: `v2ComponentClassFactory(payloadClass, className)`
- **Returns**: Abstract parent class + concrete subtype classes
- **Pattern**: Factory method with protected constructor

#### Phase 4.2: Refactor StandardExit to v2 Pattern
- **Create**: `StandardExitV2` abstract class with `create()` factory
- **Subtypes**: `StandardExitPlainV2`, `StandardExitRemoveV2`, `StandardExitReplaceV2`
- **Migration**: Update existing `StandardExit.create()` calls to use new factory
- **Testing**: Ensure all existing functionality preserved

#### Phase 4.3: Extend to Other Components
- **StandardRoomV2**: Abstract + Plain/Remove/Replace subtypes
- **StandardFeatureV2**: Abstract + Plain/Remove/Replace subtypes
- **StandardCharacterV2**: Abstract + Plain/Remove/Replace subtypes

### Benefits of v2 Architecture

#### Developer Experience
- **Natural instanceof**: `if (exit instanceof StandardExitPlain)` works as expected
- **Type Safety**: TypeScript can infer specific subtypes from instanceof checks
- **IntelliSense**: IDE provides appropriate methods/properties for each subtype
- **Cleaner Code**: No more `_payload instanceof` checks

#### Architecture Consistency
- **Unified Pattern**: All components follow the same factory + subtype structure
- **Extensible**: Easy to add new subtypes or modify existing ones
- **Testable**: Each subtype can be tested independently
- **Maintainable**: Clear separation of concerns between edit states

#### Performance
- **No Wrapper Overhead**: Direct subtype instances, no payload indirection
- **Eliminates instanceof Chains**: Direct instanceof checks on concrete classes
- **Memory Efficient**: Single object instead of wrapper + payload

### Migration Path

#### Incremental Approach
1. **Parallel Implementation**: Create v2 classes alongside existing ones
2. **Factory Method Update**: Modify existing `create()` methods to use v2 factory
3. **Gradual Migration**: Update code to use v2 classes over time
4. **Deprecation**: Mark old classes as deprecated after migration complete

#### Backward Compatibility
- **Existing API**: All current `StandardExit.create()` calls continue to work
- **Type Compatibility**: v2 classes can be used anywhere v1 classes are expected
- **Gradual Rollout**: No breaking changes during migration

### Success Criteria for v2 Implementation

#### Functional Requirements
- **Factory Pattern**: `StandardExit.create()` returns appropriate subtype
- **Instanceof Support**: `instanceof StandardExitPlain` works correctly
- **Type Safety**: TypeScript can infer subtypes from instanceof checks
- **Performance**: No measurable performance degradation

#### Code Quality Requirements
- **Clean Architecture**: Clear separation between abstract and concrete classes
- **Consistent Pattern**: All components follow the same v2 structure
- **Testability**: Each subtype can be tested independently
- **Documentation**: Clear examples of factory usage and subtype checking

#### Migration Requirements
- **Incremental**: Can be implemented alongside existing classes
- **Non-Breaking**: Existing code continues to work unchanged
- **Measurable**: Clear metrics for migration progress and success
