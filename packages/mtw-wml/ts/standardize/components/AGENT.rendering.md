# Rendering Framework - Guidance, Examples, Lenses, and Marks

This document describes the *intended* design: how **Guidance**, **Examples**, **Lenses**, and **Marks** work together to support world-state–dependent rendering. For implementation status and roadmap (what's built, what's next), see [AGENT.rendering.development.md](./AGENT.rendering.development.md).

## Overview

This document lays out the constraints and framework for how **Guidance**, **Examples**, **Lenses**, and **Marks** work together to support world-state–dependent rendering of components. It is a living document: extend it as more patterns are implemented (e.g. aggregation algorithm, LLM integration).

## Concepts

### Guidance

- **Role**: General instructions for rendering algorithms, keyed to specific Mark-value combinations (or to no Marks for default/essence).
- **Scope**: Typically sparse—0–3 Marks per Guidance (single Mark-value or small intersection).
- **Content**: Single `instructions` field (`StandardLiteral`); optional `shortName` for UI. No DisplayName, Summary, or Description.
- **Zero-Mark support**: Guidance with an empty Mark list provides essence/default guidance that applies when no more specific Guidance matches.

### Examples

- **Role**: Exact word-for-word renders for a complete set of Mark values (all Marks present on the Room or context).
- **Scope**: Dense Mark coverage—Examples specify values for all relevant Marks.
- **Content**: DisplayName, Summary, Description (render fields). Examples use Mark facets to define the world-state slice the example applies to.

Together, Guidance and Examples form a "multi-shot example teaching" plus "layered guidance aggregation" system.

### Marks

- **Role**: Mark facets (Mark component reference + Match value) define world-state dimensions. Both Guidance and Examples reference Marks to scope when their content applies.
- **Technical**: See [`../keys/facets/AGENT.facets.md`](../keys/facets/AGENT.facets.md) for Mark facet types, payloads, and list usage (e.g. `MarkFacetList`).

### Lenses

- **Role**: Rooms (and potentially other parents) reference Lenses via `lens: SingleReference`. Lenses participate in the rendering framework; exact semantics for how they filter or combine with Marks/Guidance/Examples can be expanded as the pipeline is implemented.
- **Lens Mark facets**: A Lens hosts Mark references via `LensMarkFacetList`. Each facet carries an optional `Default` literal—a Lens-specific default value for that Mark when viewed through this Lens. The same Mark can appear elsewhere (e.g. in Guidance or Examples) without a default; the default is scoped to the Lens.

**Lens with Mark and Default (WML):**
```xml
<Lens key=(illumination)>
    <ShortName>Illumination</ShortName>
    <Mark key=(illumination)><Default>light</Default></Mark>
</Lens>
```

### Default literal fields

- **Role**: Provide a simple literal fallback or default value for a given context (e.g. `illumination: light` on a Lens).
- **Syntax**: `<Default>...</Default>` is a simple literal tag, parsed via the same literal-tag infrastructure as `ShortName` and `Instructions` and consumable as a `StandardLiteral`.
- **Usage pattern**: Under a Lens, each `Mark` can have an optional `<Default>` child. The `LensMarkFacetList` consumer parses Mark children and extracts `Default` into the facet payload; `StandardLiteral.nestedSchema()` round-trips back to `<Default>...</Default>`.

### World-state

- **Definition**: The combination of Mark values (and any other dimensions) that describes a particular situation. A rendering algorithm uses world-state to select which Guidance and which Example(s) apply for a given render.

## Constraints

Design decisions that affect rendering:

- **Guidance has no render fields**—only instructions (and optional shortName); unlike Examples, no DisplayName/Summary/Description.
- **Zero-Mark Guidance**—allowed and used for default/essence guidance.
- **Guidance sparse vs Example dense**—Guidance targets 0–3 Marks; Examples target full Mark sets.
- **Room-only Guidance initially**—Guidance is stored on Room via `guidance: ReferenceList`; extending to Feature and Knowledge is planned (see [AGENT.rendering.development.md](./AGENT.rendering.development.md)).

## Usage

Guidance in WML: single Mark-value, Mark intersection, or zero Marks (essence/default).

**Single Mark-value:**
```xml
<Guidance key=(dark-guidance)>
    <Mark uuid=(illumination-mark)><Match>Dark</Match></Mark>
    <Instructions>Mood is spooky, play up the stretching shadows and obscured corners</Instructions>
</Guidance>
```

**Mark intersection:**
```xml
<Guidance key=(moonlight-spirits-guidance)>
    <Mark uuid=(illumination-mark)><Match>Full moonlight</Match></Mark>
    <Mark uuid=(spirits-mark)><Match>Openly active</Match></Mark>
    <Instructions>Translucent spirits cavort in the moonlight, their lines reflecting silver, and their actions particularly potent in this magically charged environment</Instructions>
</Guidance>
```

**Zero Marks (essence/default):**
```xml
<Guidance key=(tavern-essence)>
    <Instructions>The tavern has a warm, welcoming atmosphere with worn wooden furniture and the smell of ale</Instructions>
</Guidance>
```

## Related Documentation

- [AGENT.rendering.development.md](./AGENT.rendering.development.md) - Implementation status and roadmap
- [../keys/facets/AGENT.facets.md](../keys/facets/AGENT.facets.md) - Facet system (Mark, Position, Exit)
- [AGENT.implementation.md](./AGENT.implementation.md) - Component implementation patterns
- [../../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md](../../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md) - Layered context UI patterns (Workbench)
