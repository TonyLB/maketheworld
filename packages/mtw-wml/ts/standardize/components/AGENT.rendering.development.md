# Rendering Framework - Implementation Status and Roadmap

This document describes where the world-state–dependent rendering system *is* (prototype) and what we're building toward. For the intended design and concepts, see [AGENT.rendering.md](./AGENT.rendering.md).

## Current State: Prototype

Rendering is **in the process of prototyping**. The following are in place:

- **Guidance component**: Data model, schema, WML/JSON serialization, factory and processing integration. Room has a `guidance: ReferenceList`; Guidance can be created, stored, merged, and serialized with Marks (or zero Marks).
- **Room integration**: Rooms contain Guidance references; reference list is parsed, serialized, merged, assured, and rendered in schema. Guidance sorts before Examples in reference ordering.
- **UI**: Guidance section in Room editor, GuidanceEditor (shortName, instructions, MarkFacetsEditor), LayeredGuidanceTabs for sibling Guidance under a Room, Workbench navigation and breadcrumbs. Add/remove Guidance in Room; edit payload in layer view.
- **Testing**: Backend unit tests for Guidance and Room+Guidance integration. Dedicated frontend/integration or E2E tests for the full flow are not yet in place.

**Not yet implemented:** The pipeline that *uses* Guidance and Examples for rendering—aggregation algorithm, guidance lookup by Mark-value combination, LLM integration, guidance preview in editors. So we have the *model* and *authoring* side; the *consumption* side (world-state → selected guidance/examples → render) is still to be built.

## Roadmap

### 1. Get Rooms through the full pipeline (first milestone)

- Design and implement the aggregation algorithm for layered guidance.
- Implement guidance lookup by Mark-value combination.
- Integrate with the LLM rendering system.
- Add guidance preview in Room (and later Feature/Knowledge) editors.

This is the substantial first chunk of work: prove the full world-state-to-rendering pipeline in the **Room** context.

### 2. Extend the pipeline to Feature (and maybe Knowledge)

Once Rooms are working end-to-end with the pipeline:

- Add `guidance: ReferenceList` to StandardFeature and StandardKnowledge.
- Update Feature/Knowledge data types and COMPONENT_ORDER as needed.
- Add Guidance section to FeatureEditor and KnowledgeEditor; use LayeredGuidanceTabs for Feature/Knowledge where appropriate.

Same semantics as Room: Guidance on a parent component, layered by Mark-value; the pipeline then applies when rendering that parent in a given world-state.

### 3. Optional: Mark facet UI improvements

- Mark picker dialog, Match value autocomplete (e.g. from existing Examples), visual Mark coverage, conflict detection. Document or implement as needed in the Workbench/frontend layer.

## Related Documentation

- [AGENT.rendering.md](./AGENT.rendering.md) - Intended design, concepts, constraints
- [AGENT.implementation.md](./AGENT.implementation.md) - Component implementation patterns
- [../keys/facets/AGENT.facets.md](../keys/facets/AGENT.facets.md) - Mark facet system
