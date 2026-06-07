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

5. **Mid-line insertion slot `<DoubleSpace />`**: Between string/link chunks when authoring needs a closed `\s{2}` interval (Track D). Opaque in merge/diff -- not in the `Space` string-peel equivalence class.

6. **Empty middle paragraph `<DoubleBR />`**: Between content strings when authoring needs an empty paragraph between filled paragraphs (Track C). Opaque in merge/diff. Adjacent `<br /><br />` in WML source normalizes to `<DoubleBR />` on parse (author convenience).

### Authoring whitespace and editing slots

Workbench **authoring** preserves in-progress whitespace and paragraph structure through WML **storage**; **player-facing display** collapses atomic tags to finished-prose spacing (see [Display collapse](#display-collapse-player-facing-prose)). `<Space />` and `<br />` rules optimize finished text; explicit tags exist so intentional edge spaces and insertion slots survive save/reload.

#### Open vs closed boundaries

| Boundary shape | Role | Storage token |
| --- | --- | --- |
| **Closed** -- whitespace between two filled regions (content -- slot -- content) | Hold open an empty interval for the cursor | `<DoubleSpace />` (mid-line); `<DoubleBR />` (paragraph) |
| **Open** -- whitespace at an edge with nothing filled on one side yet | Foothold to start typing | `<Space />` or `<br />` (one) |

Do **not** encode closed-boundary slots as two adjacent tags of the same kind (`Space, Space` or `br, br`). WML fragment merges have no intent flag; use **atomic tags** so edit syntax is unambiguous.

#### Slot vs join compaction (merge/diff)

| Merge | Expected result |
| --- | --- |
| `["Hello", Space]` + `[Space, "world"]` | `["Hello world"]` (join compaction) |
| `["Hello"]` + `[DoubleSpace, "world"]` | `["Hello", DoubleSpace, "world"]` (structural slot) |

`DoubleSpace` and `DoubleBR` are **opaque** in merge/diff -- not in the `Space` string-peel equivalence class. Diff from `["Hello world"]` to a mid-line slot serializes as `<Replace><Space />world</Replace><With><DoubleSpace />world</With>` (match-side space promoted by constructor).

#### Slate round-trip (Workbench)

Slate uses paragraph blocks; Enter creates a second `paragraph`. Client converters: [`descendantsToRender.ts`](../../../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) (outbound), [`descendantsFromRender.ts`](../../../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) (inbound), [`withConstrainedWhitespace`](../../../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) (caps `\s{3+}` at two in Slate). Executable specs: [`AGENT.testing.slate.md`](../../../../../charcoal-client/AGENT.testing.slate.md).

| User intent | Slate (simplified) | RenderTree / WML |
| --- | --- | --- |
| Trailing space, last paragraph | `[{ para: 'Hello ' }]` | `'Hello'`, `{ Space }` |
| Leading space, first paragraph | `[{ para: ' Hello' }]` | `{ Space }`, `'Hello'` |
| Trailing space before next paragraph | `[{ para: 'Line one ' }, { para: 'Line two' }]` | `'Line one'`, `{ Space }`, `{ br }`, `'Line two'` |
| Leading space after previous paragraph | `[{ para: 'Line one' }, { para: ' Line two' }]` | `'Line one'`, `{ br }`, `{ Space }`, `'Line two'` |
| Mid-line insertion slot | `[{ para: 'Hello  world' }]` | `'Hello'`, `{ DoubleSpace }`, `'world'` |
| Empty paragraph between content | `[{ para: 'A' }, { para: '' }, { para: 'C' }]` | `'A'`, `{ DoubleBR }`, `'C'` |

Do not rely on literal multi-space in WML markup; use `<DoubleSpace />`. Legacy `<br /><br />` and adjacent `<Space /><Space />` in source normalize to atomic tags on parse.

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

1. **Whitespace Handling**: Multiple literal spaces compress to one; two or more `<Space />` between content (not br-adjacent) normalize to `<DoubleSpace />` on parse
2. **Line Break Normalization**: Adjacent `<br />` on merge compact to one break; two or more consecutive `<br />` in parse normalize to `<DoubleBR />`. Storage/print uses atomic tags for empty middle paragraphs.
3. **String Joining**: Adjacent strings are automatically joined
4. **Link Preservation**: Links maintain their references and display text
5. **Space Tag Restoration**: Leading/trailing spaces are automatically converted back to `<Space />` tags
6. **Atomic tags**: `<DoubleSpace />` and `<DoubleBR />` pass through merge/diff as opaque elements

### Display collapse (player-facing prose)

Storage and authoring round-trips preserve atomic tags. **Player-facing display** collapses them in [`RenderTreeContent.tsx`](../../../../../charcoal-client/src/components/Message/RenderTreeContent.tsx) via `collapseDisplayWhitespace`:

- `<DoubleSpace />` renders as one visible space (editor may show two while authoring)
- `<DoubleBR />` and legacy consecutive `<br />` render as one block break
- `<Space />` remains invisible (unchanged from Phase 1)

Do not collapse atoms in WML parse, `renderTreeToString`, or `schemaOutputToString` -- those paths serve storage, labels, and prompts.

### Merge Logic

The merge operation follows these rules:

1. **String Concatenation**: Adjacent strings are joined with normalized whitespace
2. **Element Preservation**: Non-string elements (links, breaks, spaces) are preserved
3. **Whitespace Normalization**: Adjacent primitive `Space`/`br` pairs compact on merge; parse normalizes adjacent `<Space /><Space />` / `<br /><br />` to atomic tags
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

Slot transitions (`Hello world` <-> `Hello` + `DoubleSpace` + `world`) and compaction (`Hello` + `Space` merged with `Space` + `world`) are covered in [`index.test.ts`](index.test.ts) (`Track D -- diff/merge round-trip`).

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