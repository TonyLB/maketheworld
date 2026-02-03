# Rendering Framework - Guidance, Examples, Lenses, and Marks

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

- **Role**: Rooms (and potentially other parents) reference Lenses via `lenses: ReferenceList`. Lenses participate in the rendering framework; exact semantics for how they filter or combine with Marks/Guidance/Examples can be expanded as the pipeline is implemented.

### World-state

- **Definition**: The combination of Mark values (and any other dimensions) that describes a particular situation. A rendering algorithm uses world-state to select which Guidance and which Example(s) apply for a given render.

## Constraints

Design decisions that affect rendering:

- **Guidance has no render fields**—only instructions (and optional shortName); unlike Examples, no DisplayName/Summary/Description.
- **Zero-Mark Guidance**—allowed and used for default/essence guidance.
- **Guidance sparse vs Example dense**—Guidance targets 0–3 Marks; Examples target full Mark sets.
- **Room-only Guidance initially**—Guidance is stored on Room via `guidance: ReferenceList`; Feature/Knowledge integration is planned for a later phase.

## Related Documentation

- [`AGENT.guidance.planning.md`](./AGENT.guidance.planning.md) - Guidance component plan and phase status
- [`../keys/facets/AGENT.facets.md`](../keys/facets/AGENT.facets.md) - Facet system (Mark, Position, Exit)
- [`AGENT.implementation.md`](./AGENT.implementation.md) - Component implementation patterns
- [`../../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md`](../../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/AGENT.layered-context-patterns.md) - Layered context UI patterns (Workbench)
