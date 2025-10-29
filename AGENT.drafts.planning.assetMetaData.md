# Asset Metadata Tags (ShortName & Summary) - Planning Document

**Date**: October 29, 2025  
**Status**: Phase 1 Complete ✅  
**Parent Task**: Multi-Draft Asset System (see [`AGENT.drafts.planning.md`](AGENT.drafts.planning.md))  
**Scope**: WML schema extension to support Asset-level ShortName and Summary tags

## Overview

This document tracks the design and implementation of Asset-level `ShortName` and `Summary` tags in WML. While this work supports the multi-draft feature (providing user-facing names for draft assets), it is architecturally independent and can be implemented separately.

### Relationship to Multi-Draft System

**Why this matters for drafts:**
- Draft assets need human-readable names to distinguish them in the UI
- Users need to identify "Marketing Proposal Draft" vs. "Character Background Draft" vs. "New Room Ideas"
- Without names, drafts would be identified only by UUID (poor UX)

**Why it's independent:**
- Asset-level metadata is useful beyond drafts (any asset could benefit from ShortName/Summary)
- WML schema changes don't depend on multi-draft client/backend changes
- Can be implemented, tested, and deployed separately
- Follows existing WML patterns (ShortName/Summary already exist for other component types)

---

## Getting Started

This section guides AI agents and human collaborators through the context needed to work on Asset-level ShortName/Summary tags. Follow these steps in order to build comprehensive understanding before making changes.

### 1. Understand Parent Task Context (Optional)

Read the parent planning document [`AGENT.drafts.planning.md`](AGENT.drafts.planning.md):

- **Why**: Provides context for why Asset metadata is needed (but not required to implement this task)
- **Focus on**: "Client Requirements: Asset Zone Information" section and "Naming/Metadata" question
- **Key Insight**: This task supports multi-draft, but is architecturally independent
- **Don't get lost**: You don't need to understand the entire multi-draft system to work on this

### 2. Read This Planning Document

Orient yourself within this document:

- **Start here**: Overview section (current state vs proposed)
- **Then**: Design Proposal section - see the WML examples
- **Design Consistency**: Understand ShortName vs Summary patterns
- **Open Questions**: All three questions are DECIDED - clear direction for implementation
- **Implementation Checklist**: The concrete tasks to complete

### 3. Understand WML Schema Structure

Read WML documentation to understand the schema system:

Read [`packages/mtw-wml/documentation/README.syntax.md`](packages/mtw-wml/documentation/README.syntax.md):

- **Why**: Need to understand WML tag structure, context tags vs content tags
- **Focus on**:
  - **Context Tags** section (lines ~6-52) - Tags with keys vs tags without keys
  - **Content Tags** section (lines ~54-93) - How Name, Description work within components
- **Key Insight**: ShortName is a direct child of components, not wrapped in Example

Read [`packages/mtw-wml/ts/AGENT.md`](packages/mtw-wml/ts/AGENT.md):

- **Why**: Overview of WML system architecture
- **Focus on**: Basic syntax examples and core concepts
- **Understanding**: How WML → Schema → StandardForm → JSON flows work

### 4. Examine Current ShortName Implementation

Study how ShortName currently works for Rooms and Characters:

Read test examples in [`packages/mtw-wml/ts/standardize/index.test.ts`](packages/mtw-wml/ts/standardize/index.test.ts):

- **Why**: See ShortName in actual use
- **Search for**: Lines with `<ShortName>` (around lines 937-958, 988, etc.)
- **Key Discovery**: `<Room><ShortName>Vortex</ShortName>...</Room>` - direct child pattern
- **Pattern**: ShortName appears at component level, NOT inside Example tags

Read [`packages/mtw-wml/ts/schema/converters/components.ts`](packages/mtw-wml/ts/schema/converters/components.ts):

- **Why**: Understand how tags are defined in the schema
- **Focus on**:
  - **componentTemplates** (lines ~15-52) - ShortName and Summary are defined (lines 20-21)
  - **shortNameConverter** (line 54) - How ShortName is parsed
- **Key Question**: Does Asset template allow these tags, or do we need to add them?

### 5. Understand StandardForm Asset Class

Study the StandardAsset implementation:

Search for StandardAsset class definition:

- **Why**: Need to add shortName and summary properties here
- **Look in**: `packages/mtw-wml/ts/standardize/components/asset.ts`
- **Search strategy**: `grep -r "class StandardAsset" packages/mtw-wml/ts/`
- **Compare to**: StandardRoom which already implements `HasShortName` interface

Read [`packages/mtw-wml/ts/standardize/components/abstract.ts`](packages/mtw-wml/ts/standardize/components/abstract.ts):

- **Why**: Understand the `HasShortName` interface pattern
- **Look for**: `HasShortName` interface definition (around line 31-33)
- **Pattern**: Interface defines `shortName?: StandardLiteral`
- **Goal**: Make StandardAsset implement this interface

### 6. Understand WML Parsing Flow

Trace how WML text becomes StandardForm objects:

Read schema conversion overview:

- **Why**: Need to ensure Asset ShortName/Summary parse correctly
- **Flow**: Raw WML → Tokenizer → Parser → Schema → StandardForm
- **Look in**: `packages/mtw-wml/ts/schema/` directory
- **Key files**:
  - `converters/components.ts` - Component tag definitions
  - `converters/index.ts` - Main schema conversion logic
  - `index.ts` - Schema class that orchestrates parsing

Study serialization (StandardForm → WML):

- **Why**: Need to ensure round-trip: WML → StandardForm → WML preserves metadata
- **Look in**: StandardAsset `schema()` method
- **Pattern**: How StandardRoom serializes its shortName back to WML

### 7. Check Testing Patterns

**WML Package Testing** (see root [`AGENT.md`](../../AGENT.md)):

- **Why**: Need to write tests for Asset-level ShortName/Summary
- **Command**: `npm run test` (watch mode) or `npm run test -- --watchAll=false` (single run)
- **Run from**: `packages/mtw-wml/` directory
- **Focus on**: Round-trip tests, parsing tests, serialization tests

Study existing test patterns:

- **File**: `packages/mtw-wml/ts/standardize/index.test.ts`
- **Why**: Learn how to test WML parsing and StandardForm behavior
- **Look for**: Tests that parse WML, create StandardForm, and verify properties
- **Pattern**: Use `deIndentWML()` helper for clean test WML strings

### 8. Establish Baseline Before Changes

**Run WML tests**:
```bash
cd packages/mtw-wml
npm run test -- --watchAll=false
```
- **Expected**: All tests should pass (note the count)
- **Why**: Baseline to verify changes don't break existing functionality

**Key principle**: Always verify the test baseline before starting work, then maintain or improve that baseline with your changes.

---

## Design Proposal

### Extend WML Schema

Make `ShortName` and `Summary` legal content tags at the Asset level, following the same pattern as they're currently used for Rooms and other components.

**Current State** (ShortName as direct property of Room, Summary within Example):
```xml
<Asset uuid=(dungeon)>
    <Room key=(vortex)>
        <ShortName>Cave Entrance</ShortName>  <!-- Direct property of Room -->
        <Example uuid=(example1)>
            <Summary>A naturally formed cavern entrance</Summary>
            <Description>Natural rock formations rise...</Description>
        </Example>
    </Room>
</Asset>
```

**Implemented Extension** (ShortName/Summary as direct children of Asset):
```xml
<Asset uuid=(nakatomiPlaza)>
    <ShortName>Nakatomi Plaza</ShortName>
    <Summary>A high-rise office building in downtown Los Angeles</Summary>
    <Room key=(lobby)>
        <ShortName>Main Lobby</ShortName>
        <Example uuid=(example1)>
            <Description>A gleaming marble lobby with towering windows</Description>
        </Example>
    </Room>
</Asset>
```

### Design Consistency

**Existing Pattern for ShortName**: Direct property of components (Room, Feature, Character)
- `ShortName` is a **direct child** of the component tag (NOT inside Example)
- Example: `<Room><ShortName>Vortex</ShortName>...</Room>`
- This makes ShortName a durable identifier of the component itself
- Making ShortName legal at Asset level follows this exact pattern

**Design Decision for Summary**: Use as direct child of Asset (breaking from Example-wrapper pattern)
- Currently: `Summary` appears inside `Example` tags (similar to Name, Description)
- For Assets: Use as **direct child** (like ShortName) without Example wrapper
- **Rationale**: Pragmatic reuse of existing tag is cleaner than introducing a third label
- **Trade-off**: Minor semantic ambiguity (Summary used in different contexts) vs. avoiding tag proliferation
- **Decision**: Accept the context ambiguity - less confusing than adding "Explanation" or similar

**Semantic Meaning**:
- **ShortName**: Brief, user-facing identifier (e.g., "Marketing Draft", "Character Ideas")
- **Summary**: One-line description of purpose/content (e.g., "Ideas for Q2 promotional content")

---

## Technical Changes Required

### 1. WML Schema Modifications

**File**: `packages/mtw-wml/ts/schema/converters/components.ts`

Current Asset template:
```typescript
Asset: {
    uuid: { type: ParsePropertyTypes.Key },
    from: { type: ParsePropertyTypes.Asset }
}
```

**No changes needed** - ShortName and Summary are already defined in `componentTemplates` (lines 20-21). The schema parser should already handle them as nested content.

**Verification needed**: Check if Asset converter explicitly prohibits ShortName/Summary, or if they're just not used yet.

### 2. StandardForm Asset Interface

**Files**: 
- `packages/mtw-wml/ts/standardize/components/asset.ts`
- `packages/mtw-wml/ts/standardize/components/abstract.ts`

Asset interface likely needs to implement `HasShortName` interface (similar to StandardRoom).

**Current** (approximate):
```typescript
export class StandardAsset extends StandardComponent {
    // ... existing properties
}
```

**Proposed**:
```typescript
export class StandardAsset extends StandardComponent implements HasShortName {
    shortName?: StandardLiteral;
    summary?: StandardRender;
    // ... existing properties
}
```

### 3. Asset Serialization/Deserialization

Ensure that:
- WML → StandardForm: Asset ShortName/Summary are parsed correctly
- StandardForm → WML: Asset ShortName/Summary are written correctly
- StandardForm → JSON: Asset metadata is preserved

---

## Implementation Checklist

### Phase 1: Schema & Parsing ✅ **COMPLETE**
- [x] Verify current Asset schema allows nested ShortName/Summary tags
- [x] If not, update Asset converter to permit these tags
- [x] Add unit tests for parsing Asset-level ShortName/Summary from WML
- [x] Verify round-trip: WML → StandardForm → WML preserves tags

### Phase 2: StandardForm Support ✅ **COMPLETE**
- [x] Update StandardAsset class to implement `HasShortName`
- [x] Add `shortName` and `summary` properties to StandardAsset
- [x] Update StandardAsset constructor/factory methods
- [x] Add unit tests for StandardAsset with metadata

### Phase 3: Serialization ✅ **COMPLETE**
- [x] Verify StandardForm → WML writes Asset ShortName/Summary correctly
- [x] Verify StandardForm → JSON preserves Asset metadata
- [x] Test import/inheritance behavior (does ShortName inherit from imported assets?)

### Phase 3.5: Merge & Diff Operations ✅ **COMPLETE**
- [x] Update `StandardForm.merge()` to handle Asset-level metadata
- [x] Update `StandardForm.diff()` to handle Asset-level metadata
- [x] Add unit tests for merging Asset-level ShortName and Summary
- [x] Add unit tests for diffing Asset-level ShortName and Summary
- [x] Verify Replace/Remove tags work correctly with Asset-level metadata

### Phase 4: Integration Testing
- [ ] Test with real draft assets in development environment
- [ ] Verify S3 storage round-trip preserves metadata
- [ ] Test asset caching behavior with metadata
- [ ] Ensure backwards compatibility (assets without metadata still work)

---

## Open Questions

### Q1: Inheritance Behavior
**Question**: Should ShortName/Summary be inherited or always local to the asset?

**Analysis**:
- Assets import **components** (Rooms, Features, etc.) from other assets, not entire assets
- Asset-level metadata describes the asset as a whole, not its components
- Each asset (including drafts) has its own identity and purpose
- Similar to how Asset UUID is local to each asset

**Decision**: ✅ **DECIDED** - Asset ShortName/Summary are **always local**, never inherited
- These are metadata about the asset itself, not about any of its imported components
- Each asset defines its own ShortName/Summary (or leaves them undefined)

### Q2: Required vs Optional
**Question**: Should ShortName/Summary be required or optional for assets?

**Analysis**:
- Making them required would force users to name every asset (including programmatically generated ones)
- Making them optional allows gradual adoption
- Optional allows backwards compatibility with existing assets

**Decision**: ✅ **DECIDED** - Both optional, with UI encouraging users to provide names for drafts

### Q3: Default Values
**Question**: Should system auto-generate default values if ShortName is missing?

**Options**:
- No default (leave empty)
- Use UUID as fallback display
- Generate from first Room name in asset
- Generate from creation timestamp ("Draft created Oct 29")

**Decision**: ✅ **DECIDED** - No auto-generation in WML layer; client UI handles display defaults (e.g., "Untitled Draft" or show truncated UUID)

---

## Testing Strategy

### Unit Tests
- WML parsing with Asset-level ShortName/Summary
- StandardAsset creation with metadata
- Serialization round-trips (WML → StandardForm → WML)

### Integration Tests
- Asset with metadata through full save/load cycle
- S3 storage preservation
- Asset caching with metadata

### Backwards Compatibility Tests
- Existing assets without metadata continue to work
- Older WML files without Asset metadata parse correctly

---

## Related Documentation

- **Parent Planning**: [`AGENT.drafts.planning.md`](AGENT.drafts.planning.md) - Multi-draft system overview
- **WML Documentation**: [`packages/mtw-wml/ts/AGENT.md`](packages/mtw-wml/ts/AGENT.md) - WML system guide
- **WML Syntax**: [`packages/mtw-wml/documentation/README.syntax.md`](packages/mtw-wml/documentation/README.syntax.md) - WML syntax reference
- **StandardForm**: [`packages/mtw-wml/ts/standardize/AGENT.md`](packages/mtw-wml/ts/standardize/AGENT.md) - StandardForm documentation

---

## Implementation Summary

### ✅ **Phase 1 Complete** (October 29, 2025)

**Schema Layer Changes:**
- Updated `SchemaAssetLegalContents` type to include `SchemaShortNameTag` and `SchemaSummaryTag`
- Updated `isSchemaAssetContents()` function to allow ShortName and Summary as valid Asset children

**StandardForm Layer Changes:**
- Added `_shortName?: StandardLiteral` and `_summary?: StandardRender` properties to StandardForm class
- Implemented parsing logic in constructor to extract Asset-level ShortName and Summary from WML
- Added getter methods `shortName` and `summary`
- Updated `schema` getter to serialize Asset metadata back to WML
- Updated `_clone()` method to preserve metadata
- Updated `merge()` method to properly merge Asset-level metadata (delegates to `StandardLiteral.merge()` and `StandardRender.merge()`)
- Updated `diff()` method to track changes in Asset-level metadata (delegates to `StandardLiteral.diff()` and `StandardRender.diff()`)

**NDJSON Serialization Changes:**
- Updated `StandardForm.header` getter to include `shortName` and `summary` in NDJSON header (following omission-over-empty principle)
- Updated StandardForm constructor NDJSON parsing to extract Asset-level metadata from header
- Updated `isStandardNDJSONLine()` validator to accept `shortName: 'string'` and `summary: 'renderTree'` as optional Asset header fields
- Asset metadata now preserved through complete S3 storage round-trip (`.ndjson` files)

**Comprehensive Test Coverage:**
- **8 StandardForm parsing tests** covering parsing, serialization, round-trips, and edge cases
- **16 StandardForm merge/diff tests** covering Replace/Remove tags, concatenation, and edge cases
- **5 StandardForm NDJSON round-trip tests** covering ShortName, Summary, both, neither, and complex content
- **6 Schema parsing tests** covering WML → schema → WML round-trips
- **All 72 test suites pass** (774 total tests, 0 regressions)

**DynamoDB Storage (October 29, 2025):**
- Extended `Meta::Asset` record to include `shortName` and `summary` fields
- Updated `dataSource/caching/cacheAsset.ts` to extract and store Asset-level metadata from StandardForm
- Updated `internalCache/assetMeta.ts` to fetch `shortName` and `summary` fields in projection
- Updated `internalCache/assetData.ts` to reconstruct Asset header with metadata from Meta::Asset
- Added 5 tests in `cacheAsset.test.ts` for Meta::Asset metadata storage (ShortName, Summary, both, neither, complex content)
- Added 3 tests in `assetData.test.ts` for DynamoDB reconstruction round-trip scenarios
- **Cleanup**: Removed orphaned `lambda/assets/cacheAsset/` directory (legacy code not in use)

**Example Usage:**
```xml
<Asset uuid=(nakatomiPlaza)>
    <ShortName>Nakatomi Plaza</ShortName>
    <Summary>A high-rise office building in downtown Los Angeles</Summary>
    <Room key=(lobby)>
        <ShortName>Main Lobby</ShortName>
        <Example uuid=(example1)>
            <Description>A gleaming marble lobby with towering windows</Description>
        </Example>
    </Room>
</Asset>
```

**DynamoDB Storage:**
```javascript
// Meta::Asset record
{
    AssetId: 'ASSET#nakatomiPlaza',
    DataCategory: 'Meta::Asset',
    zone: 'Personal',
    shortName: 'Nakatomi Plaza',
    summary: ['A high-rise office building in downtown Los Angeles']
}
```

## Next Steps

1. ✅ **Investigate Current Schema**: Determine if Asset already permits ShortName/Summary as nested tags
2. ✅ **Design Verification**: Confirm design approach with project stakeholders  
3. ✅ **Resolve Open Questions**: Make decisions on inheritance, required/optional, defaults
4. ✅ **Implementation**: Follow checklist above (Phases 1-3.5 complete, including NDJSON serialization)
5. ✅ **DynamoDB Storage**: Asset metadata stored and retrieved from Meta::Asset records
6. **Update Parent Document**: Note in `AGENT.drafts.planning.md` that Asset metadata is available
7. **Phase 4**: Integration testing with real draft assets in development environment
8. **Asset Update Events**: Design and implement asset-level change notification system (deferred)

---

## Notes

- **Architectural Independence**: This can be worked on a separate branch from multi-draft UI work
- **Reusability**: Asset metadata is useful beyond drafts (any player-created content benefits from naming)
- **Pattern Consistency**: Follows existing WML conventions for ShortName/Summary usage
- **Clean Separation**: WML schema changes don't require changes to client, backend APIs, or database queries

