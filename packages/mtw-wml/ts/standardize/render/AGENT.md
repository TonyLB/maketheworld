# Standard Render - Agent Navigation Guide

## Overview

The `standardize/render` directory contains the StandardRender system, which handles rich text content within WML components. StandardRender provides a structured way to represent and manipulate formatted text content that can include links, line breaks, spacing, and other formatting elements.

## Core Purpose

- **Rich Text Processing**: Handles formatted text content within WML components
- **Content Normalization**: Ensures consistent text formatting and whitespace
- **Link Management**: Manages references to other components within text
- **Edit Operations**: Supports content modification through edit tags

## Core Concepts

### Serialization

StandardRender serializes to a **RenderTree** - a structured representation of formatted text content. A RenderTree is an array of elements that can be:
- **Strings**: Plain text content
- **Links**: References to other components with display text
- **Line Breaks**: `<br />` elements for line separation
- **Spaces**: Explicit spacing elements

Non-strings are represented as objects with a "type" field indicating what type of element they are, and then appropriate properties as needed.

### Render Elements

#### **StandardRenderString** (`string.ts`)
Represents plain text content.
- **Properties**: `_text` (string content)

#### **StandardRenderLink** (`link.ts`)
Represents links to other components.
- **Properties**: `_to` (target reference), `_text` (display text)

#### **StandardRenderLineBreak** (`lineBreak.ts`)
Represents line break elements.
- **Properties**: None (structural element)

#### **StandardRenderSpace** (`space.ts`)
Represents explicit spacing elements.
- **Properties**: None (structural element)

**⚠️ CRITICAL**: `<Space />` elements are **explicit spacing markers** and may only appear at allowed positions in a RenderTree (never between arbitrary mid-line strings). See [Space Element Positioning](#space-element-positioning) for details.

## Space Element Positioning

### Rules for `<Space />` Elements

`<Space />` tags represent **intentional spacing** that must survive WML parse and merge:

1. **Document-leading `<Space />`**: At the very beginning of content
   - Indicates content should start with explicit spacing
   - Example: `<Space />Hello World` → renders as " Hello World"

2. **Document-trailing `<Space />`**: At the very end of content
   - Indicates content should end with explicit spacing  
   - Example: `Hello World<Space />` → renders as "Hello World "

3. **Paragraph-edge `<Space />`**: Immediately adjacent to `<br />`
   - Trailing space before a line break: `Line one<Space /><br />Line two`
   - Leading space after a line break: `Line one<br /><Space />Line two`
   - Literal whitespace next to `<br />` is stripped on parse; use `<Space />` for authoring round-trip

4. **Internal spacing** (not at document boundary and not adjacent to `<br />`): Always represented as literal spaces, never as `<Space />` tags
   - Merge operations normalize internal spacing to literal characters
   - Example: `Hello<Space />World` → becomes "Hello World" during merge

### Why This Design?

- **WML whitespace behavior**: WML is a whitespace-ignoring system where `<Description>     Some text</Description>` is equivalent to `<Description>Some text</Description>`. To represent meaningful spacing, we need explicit tags.
- **Semantic clarity**: `<Space />` tags indicate intentional boundary spacing that should be preserved
- **Simplified processing**: Internal spacing uses literal spaces for easier merge/diff operations
- **Consistent output**: All consumers get the same semantic representation
- **Predictable behavior**: Users can rely on spacing intent being preserved

## Usage Patterns

### Constructor Overloads

A StandardRender class can be constructed from a variety of incoming argument types:
- An appropriate WML string
- A **RenderTree** list
- A **Schema Tree** (which looks very similar to a **RenderTree** but represents strings differently to match WML Schema formats)
- A list of render element helper class instances

```typescript
// [ TODO: Cursor to provide an example of each ]
```

### Content Merging

StandardRender automatically handles content merging with intelligent whitespace normalization:

```typescript
// Merge two render contents
const base = new StandardRender("Hello ")
const incoming = new StandardRender("<Space />World")
const merged = base.merge(incoming)
// Result: "Hello World" (whitespace normalized)

// Merge with links
const base = new StandardRender(['Hello ', { data: { tag: 'Link', to: 'room1', text: 'Room' }, children: ['Room'] }])
const incoming = new StandardRender([' World'])
const merged = base.merge(incoming)
// Result: Combined content with preserved links
```

### Edit Operations

StandardRender supports edit operations for content modification:

```typescript
// Remove content
const base = new StandardRender("Hello World")
const remove = new StandardRenderRemove("World")
const result = base.merge(remove)
// Result: "Hello "

// Replace content
const base = new StandardRender("Hello World")
const replace = new StandardRenderReplace("World", "Universe")
const result = base.merge(replace)
// Result: "Hello Universe"
```

## Render Tree Operations

### Content Normalization

StandardRender automatically normalizes content during operations:

1. **Whitespace Handling**: Multiple spaces are collapsed to single spaces
2. **Line Break Normalization**: Multiple line breaks are reduced to single breaks
3. **String Joining**: Adjacent strings are automatically joined
4. **Link Preservation**: Links maintain their references and display text
5. **Space Tag Restoration**: Leading/trailing spaces are automatically converted back to `<Space />` tags

### Merge Logic

The merge operation follows these rules:

1. **String Concatenation**: Adjacent strings are joined with normalized whitespace
2. **Element Preservation**: Non-string elements (links, breaks, spaces) are preserved
3. **Whitespace Normalization**: Multiple spaces and breaks are normalized
4. **Space Tag Conversion**: Internal `<Space />` tags (not document-boundary, not br-adjacent) are converted to literal spaces during merge
5. **Semantic Restoration**: Constructor automatically restores document-boundary `<Space />` tags; merge promotes paragraph-edge literal spaces adjacent to `<br />` to `<Space />` tags
6. **Conflict Detection**: Incompatible changes throw `MergeConflictError`

### Diff Operations

The diff operation creates a minimal representation of changes:

```typescript
// Create diff between render contents
const original = new StandardRender("Hello World")
const modified = new StandardRender("Hello Universe")
const diff = original.diff(modified)
// Result: StandardRenderReplace with "World" → "Universe"

// Apply diff to recreate modified
const recreated = original.merge(diff)
// Result: Same as modified
```

### Equality (`equals`)

`StandardRender.equals(other)` compares two instances without using `toJSON()` reference checks or ad hoc deep equality on serialized shapes.

- If both values are **vacuous** per `isEmpty()` (plain empty tree, empty remove match, identity replace, and other cases defined there), `equals` returns **true** so optional rich-text fields treat those shapes consistently.
- Otherwise, equality follows the **editable wrapper** `diff`: `equals` is **true** when `this._payload.diff(other._payload)` is **undefined** (no semantic delta between the two states).

Use `equals` (and, for optional fields, `defaultedEquals` from the semantic-optionals initiative) in UI sync and component equality instead of comparing `toJSON()` outputs.

## Integration with Components

### Component Usage

StandardRender is used within components for rich text content:

```typescript
// In SituationProseFacetPayload (Room / Feature / Knowledge facet prose)
class SituationProseFacetPayload {
    _summary?: StandardRender;
    _description?: StandardRender;
    
    constructor(props) {
        this._summary = props.summary ? new StandardRender(props.summary) : undefined
        this._description = props.description ? new StandardRender(props.description) : undefined
    }
}
```

## Integration Points

- **Component System**: Used by components for rich text content
- **Schema System**: Converts to/from WML schema format
- **Reference System**: Manages component references in links
- **Edit System**: Supports edit operations for content modification
- **WML Language**: See [`../AGENT.md`](../AGENT.md) for WML format details
- **Standard Components**: See [`../components/AGENT.md`](../components/AGENT.md) for component integration

## Navigation Tips

1. **Start with Examples**: Look at test files for usage patterns
2. **Understand RenderTree**: The core data structure for render content
3. **Check Element Types**: Each element type has specific behavior
4. **Review Merge Logic**: Understand how content is combined
5. **Test Diff Operations**: Verify that diffs can recreate target states

## Development Notes

### Current State
- **Core Elements**: All render element types implemented
- **Merge/Diff/Equals**: Full support for content operations and semantic `equals`
- **Normalization**: Automatic whitespace and content normalization
- **Type Safety**: Strong TypeScript typing throughout

### Future Plans
- **Performance**: Optimize render operations for large content
- **Validation**: Enhanced content validation
- **Extensions**: Support for additional render element types

### Technical Debt
- **Error Handling**: Improve error messages for merge conflicts
- **Documentation**: Add more examples for complex render operations
- **Testing**: Expand test coverage for edge cases 