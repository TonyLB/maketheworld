# Standard Render - Agent Navigation Guide

## Overview

The `standardize/render` directory contains the StandardRender system, which handles rich text content within WML components. StandardRender provides a structured way to represent and manipulate formatted text content that can include links, line breaks, spacing, and other formatting elements.

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

### Merge Logic

The merge operation follows these rules:

1. **String Concatenation**: Adjacent strings are joined with normalized whitespace
2. **Element Preservation**: Non-string elements (links, breaks, spaces) are preserved
3. **Whitespace Normalization**: Multiple spaces and breaks are normalized
4. **Conflict Detection**: Incompatible changes throw `MergeConflictError`

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

## Integration with Components

### Component Usage

StandardRender is used within components for rich text content:

```typescript
// In StandardExample
class StandardExample {
    _name?: StandardRender;
    _description?: StandardRender;
    
    // Constructor handles render content
    constructor(props) {
        this._name = props.name ? new StandardRender(props.name) : undefined
        this._description = props.description ? new StandardRender(props.description) : undefined
    }
}
```

## Navigation Tips

1. **Start with Examples**: Look at test files for usage patterns
2. **Understand RenderTree**: The core data structure for render content
3. **Check Element Types**: Each element type has specific behavior
4. **Review Merge Logic**: Understand how content is combined
5. **Test Diff Operations**: Verify that diffs can recreate target states

## Integration Points

- **Component System**: Used by components for rich text content
- **Schema System**: Converts to/from WML schema format
- **Reference System**: Manages component references in links
- **Edit System**: Supports edit operations for content modification 