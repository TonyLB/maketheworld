# Ephemera Caching - Planning Document

**Status: PLANNING**

This document records the first-phase plan for building the Ephemera-side caching and generation system for moment-to-moment descriptions, building on the Assets/WML blueprints.

## Architectural Context

### The Big Three Lambdas

- **WML Lambda**: Source of truth for content. Owns WML source files and StandardForm. Publishes Content Update, Zone Changed, Merge Conflict events.
- **Assets Lambda**: Authority over blueprints (lasting structure). Parses WML into components, maintains DynamoDB materialized views. Holds Examples, Guidance, Lens, and Marks as canonical definitions.
- **Ephemera Lambda**: Authority over moment-to-moment reality. Uses blueprints to produce what is actually shown now (and what has been shown) to characters. WebSocket, perception, message persistence, and blueprint reconciliation.

### Blueprint vs Moment-to-Moment

- **Assets** = lasting structure: Examples of what a Room might look like in various conditions (Lens, Guidance, Example tags). "Here is what the world is defined as."
- **Ephemera** = moment-to-moment reality: what things are like now, and what they have been like in slightly different situations. "Here is what is actually perceived now (and then)."

Ephemera builds on Assets blueprints to provide the living, cached instantiation of descriptions for specific world-states.

## Entangled Concerns

Several concerns will iterate together as we extend this system:

1. **Component state representation** - How we say "When X, Y, or Z" (Mark values, Match strings)
2. **Blueprint representation** - The Asset/WML side (Guidance, Examples, Lens, Marks)
3. **Description generation** - Likely Bedrock LLM with prompting and tool-use
4. **Caching** - Storage for search, reuse, and consistency
5. **Event streaming** - How we publish and consume generation/caching events

The final system will have many cooperating parts. We start with a minimal slice.

## First Iteration Plan (MVP)

### Scope

- **Room only** - Start with cached Room descriptions; extend to Feature, Knowledge later.
- **Exact match first** - Find Example where Mark-pattern exactly matches proposed state. No fuzzy/semantic search yet.
- **Explicit generation** - Author triggers generation from Preview UI; no background/automatic generation.

### Components

#### 1. Ephemera DynamoDB Schema

Create a representation in the Ephemera table that supports cached Room descriptions. Key structure and metadata design follow.

##### Key Schema

- **EphemeraId**: `ROOM#${uuid of room}`
- **DataCategory**: `EXAMPLE#${uuid of example}`

The Example UUID is either:
- **Author-provided**: The UUID defined in WML for that Example (canonical identity from the blueprint)
- **Synthesized**: A new UUID generated when we (later) create in-play Examples via LLM or other generation

This gives us:
- **Partition by Room**: All Examples for a Room share `EphemeraId`, so we can Query to fetch all candidates for exhaustive/constellation search
- **Sort by Example identity**: Each Example is a distinct record; UUID is stable and first-class (see First Iteration Schema Implications)

##### Record Metadata

**markState** - The Mark:Match pairs that define this Example's world-state slice (for exact-match comparison and constellation computation):

```typescript
{
  markValue: Array<{ mark: string, value: string }>  // mark = Mark UUID, value = Match string
}
```

Initial shape; allows adding a `remainder` field at a future juncture.

**renderedContent** - The cached output. Parallels how Example component items are stored in the Assets DynamoDB table: `displayName`, `summary`, and `description` as RenderTree (same field names and format as StandardExample / Assets component records).

**provenance** - Source of the Example; supports author-provided vs. generated distinction and leaves room for confidence scores later:

```typescript
{ type: 'authored' | 'generated' }
```

For now, `type` alone is sufficient. Future fields (e.g. `confidence` for generated Examples) can extend this object without disturbing the overall data shape.

**Still to refine**:
- **Future**: Guidance-relevance scores, bucket membership for constellation search

#### 2. Ephemera Lambda Support

- Receive generation request (via WebSocket)
- Resolve proposed state to Example (exact Mark-pattern match)
- For exact match: can use Example DisplayName/Summary/Description directly (no LLM needed in v1)
- Write to cache (DynamoDB)
- Return cached result to requesting WebSocket session

#### 3. UI - Preview Section in Room Workbench

Add a Preview section to the Room editor in the Authoring Workbench that:

- Lets the author propose a state (set values for each Mark in the Room's Lens)
- Provides an explicit "Generate" command
- Sends request to Ephemera via WebSocket
- Displays the cached description when Ephemera returns it

#### 4. Integration Focus

- Test the full flow: propose state -> generate -> cache -> return -> display
- Refine exact-match logic (Mark-pattern to Example identification)
- Build structures that can later support LLM generation, fuzzy matching, and richer event streaming

### Alignment with Existing Schema

From `packages/mtw-wml/ts/standardize/components/AGENT.rendering.md`:

- **Lens**: References Marks via `marks: ReferenceList`. Room has `lenses: ReferenceList`.
- **Marks**: World-state dimensions. Each Mark has a Match value (MarkFacet payload string).
- **Examples**: Dense Mark coverage - values for all relevant Marks. DisplayName, Summary, Description.
- **Proposed state**: One Match value per Mark in the Room's Lens. This is what we compare against for exact Example lookup (not necessarily the storage key).

## Guidance-Constellation Search (Future Direction)

*Well past the first iteration. Documented here to avoid schema choices that paint us into a corner.*

### The Curse of Dimensionality

Keying by `RoomId + canonical Mark state` is expedient but likely wrong for the long term. Mark state is high-dimensional (one dimension per Mark in the Lens); exact-match keying does not scale or support semantic proximity.

### Guidance as Navigational Space

Each Example (authored or cached from a previous render) can be notionally located in a multidimensional space measured by the **relevance/proximity to each Guidance**:

- An Example of a Room in bright light: ~100% relevance to Guidance "Illumination: Bright", ~0-5% to "Illumination: Dark"
- A twilight Example: ~50% relevance to both
- These constellations of distance-to-Guidance are **component-specific** - they reflect the exact semantic space the component occupies

### Search Strategy (Future)

The number of Examples (including cached renders) is not large enough to justify a dedicated vector-search database. A plausible approach:

1. **Deterministic first sieve**: Bucket Examples by their top N guidance items
2. **Incoming query**: Compute constellation vector for the proposed state (relevance to each Guidance)
3. **Descent**: Walk buckets by descending relevance
4. **Comparison**: Deterministically compare constellation vectors against bucket members
5. **Output**: Subset of past Examples to use as prompts for an LLM rendering the new state

### Implication for Keying

Given this direction, we are unlikely ever to search by `RoomId + canonical Mark state`. We are far more likely to:

- **UUID each Example** (both authored and cached)
- **Search exhaustively** in early iterations (fetch candidates, compare in memory)
- **Search by Guidance-constellation** in later iterations (buckets, vector comparison)

## First Iteration Schema Implications

Given the Guidance-constellation future direction, the first-iteration schema should:

- **Use UUID as primary identifier** for each cached Example. Do not use `RoomId + Mark state` as the DynamoDB key.
- **Store rich metadata** on each record: RoomId (or component reference), Mark state (Mark:Match pairs), rendered content. This supports both exhaustive exact-match in v1 and future constellation-based search.
- **v1 lookup**: Fetch all Examples for the Room (authored from Assets + cached from Ephemera), compare Mark patterns in memory for exact match. Acceptable while counts are small.
- **Leave room** for future fields: e.g. precomputed guidance-relevance scores, bucket membership for top-N Guidance, if we want to seed them early.

The schema should support "each Example is a first-class thing with a UUID" rather than "lookup by composite state key." That keeps options open.

## Design Notes

- **Exact match without LLM**: For v1, when Mark-pattern exactly matches an Example, we can return Example content directly. This keeps the first iteration simple and cost-free. Same cache schema serves both paths when we add LLM for non-exact states.
- **Event streaming**: MVP can start as request -> cache write -> single WebSocket response. Full EventBridge/streaming integration can layer on once the cache model stabilizes.

## Related Documentation

- [Ephemera AGENT.md](./AGENT.md) - Lambda overview and domain authority
- [Ephemera AGENT.event.md](./AGENT.event.md) - Event flow and WebSocket handling
- [Rendering Framework](../../packages/mtw-wml/ts/standardize/components/AGENT.rendering.md) - Guidance, Examples, Lens, Marks design
- [Rendering Development Status](../../packages/mtw-wml/ts/standardize/components/AGENT.rendering.development.md) - What is built vs. planned
- [Architecture Events](../../AGENT.architecture.events.md) - Domain-Authoritative Event Mesh
