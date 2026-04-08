# Examples Cache - Agent Navigation Guide

## Overview

The `ExamplesData` class is a cache handler that manages **example descriptions** for components (rooms, features, knowledge). Examples represent different ways a component can be rendered based on varying circumstances, though the state-matching system is still in development.

> **Note**: This handler follows the standard `internalCache` patterns documented in [`AGENT.md`](./AGENT.md). See that file for common patterns like DeferredCache usage, dual storage, and core methods.

## Future Vision

The Examples system is designed to solve the classic problem of narrative consistency vs. environmental variety. Instead of programming hard-coded descriptions for every possible circumstance, users provide **examples** of how components appear in different situations. When the current state doesn't exactly match any provided example, an LLM can extrapolate from nearby examples to generate appropriate descriptions.

### **Example Use Case**
A market square might have examples for:
- **Sunny day**: "The cobblestones gleam in the bright sunlight..."
- **Rainy day**: "The cobblestones glisten with rainwater..."
- **Night time**: "The square is lit by flickering lanterns..."

When encountering **light snowfall** (a state not explicitly covered), the LLM can extrapolate from these examples to generate an appropriate description.

## Current Implementation

### **Basic Example Storage**
Currently, examples are stored as `StandardExample` components without state conditions:
- **Parent Components**: Examples are referenced by `StandardRoom`, `StandardFeature`, or `StandardKnowledge`
- **Content**: Rich text descriptions using `RenderTree` format
- **Storage**: Stored in `ephemeraDB` with `DataCategory: 'EXAMPLE#'`

### **Naive Rendering**
`ComponentRender` currently uses a simple approach:
- Renders the **first example** it can find for a component
- No state matching or intelligent selection
- Sufficient for testing integration, but limited

## Cache Key Format

Examples are cached using the component ID: `{EphemeraId}`
- **`EphemeraId`**: The component that owns the examples (Room, Feature, or Knowledge ID)

## Data Structure

Each cached item contains:
```typescript
{
    componentId: ExampleComponentId;  // Room, Feature, or Knowledge ID
    examples: StandardExample[];      // Array of example descriptions
}
```

## Core Methods

### **`get(keys)`**
Retrieves examples for multiple components:

```typescript
const examples = await examplesData.get([
    'ROOM#marketSquare-uuid',
    'FEATURE#fountain-uuid'
])
// Returns: Record<ExampleComponentId, ExamplesReturn[]>
```

### **`set(EphemeraId, value)`**
Manually sets example data for a component:

```typescript
examplesData.set('ROOM#marketSquare-uuid', [
    { assetId: 'ASSET#market-uuid', examples: [sunnyExample, rainyExample] }
])
```

### **`invalidate(EphemeraId)`**
Removes examples for a specific component:

```typescript
examplesData.invalidate('ROOM#marketSquare-uuid')
```

### **`isOverridden(EphemeraId)`**
Checks if examples have been manually set (bypassing cache):

```typescript
const overridden = examplesData.isOverridden('ROOM#marketSquare-uuid')
```

## DynamoDB Integration

### **Database Schema**
Examples are stored in `ephemeraDB` with this structure:
```typescript
{
    EphemeraId: ExampleComponentId,     // The component ID
    DataCategory: 'EXAMPLE#uuid',       // Example identifier
    name: RenderTree,                   // Example name/title
    description: RenderTree,            // Rich text description
    summary: RenderTree                 // Brief summary
}
```

### **Query Pattern**
```typescript
const examples = await ephemeraDB.query({
    Key: { EphemeraId: 'ROOM#marketSquare-uuid' },
    KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
    ExpressionAttributeValues: { ':dcPrefix': 'EXAMPLE#' },
    ProjectionFields: ['DataCategory', 'name', 'description', 'summary']
})
```

## Integration Points

### **ComponentRender System**
- `ComponentRender` calls `ExamplesData.get()` to retrieve examples.
- Currently renders the first available example.
- Future: Will implement state-based example selection.

### **WML StandardExample System**
- Uses `StandardExample` for example creation and validation.
- Integrates with `StandardRoom`, `StandardFeature`, `StandardKnowledge`.
- Supports rich text content via `RenderTree`.

### **EphemeraDB**
- Queries example data by component ID.
- Uses `EXAMPLE#` prefix for data categorization.
- Handles multiple examples per component.

## Relationship to Render Cache (Current vs Future)

The `ExamplesData` handler represents the **legacy perception path** for examples:

- Perception flows (e.g. `internalCache/componentRender`) currently:
  - Query `ephemeraDB` `EXAMPLE#` items via `ExamplesData`.
  - Render the first available Example for a component, without Mark-state matching.
- The newer **render cache** lives in `lambda/ephemera/dataSource/renderCache/`:
  - Receives authored Example lifecycle events from `mtw.assets.componentExamples` via the `mtw.ephemera.examples` DataSource.
  - Stores per-render cache rows under `DataCategory: 'CACHE#...'`, keyed by component and `perspectiveId`, with explicit `markState` and `renderedContent`.
  - Is used today by the Room authoring **Preview** flow (`generateRoomPreview` + `RoomPreviewEditor`) to perform exact-match lookups from proposed Mark state + asset stack.

As of the first caching MVP:

- Perception remains wired to `ExamplesData` and `EXAMPLE#` records.
- The render cache is **not yet** used for live character perception; it is scoped to authoring tools (Preview) and future LLM-based generation.

Future work will migrate perception rendering off `ExamplesData` and onto the render cache so that both authoring and in-play descriptions share:

- The same Mark-state model (`markState`).
- The same perspective model (`assetStack` / `perspectiveId`).
- The same mirroring pipeline from Assets.

For cache schema and flow details, see `lambda/ephemera/dataSource/renderCache/AGENT.md` and `lambda/ephemera/AGENT.caching.planning.md`.

## Future Development

### **State System Integration**
Planned enhancements include:
- **State Conditions**: Associate examples with specific circumstances
- **Vector Embeddings**: Embed state conditions for similarity matching
- **LLM Integration**: Use nearby examples for extrapolation
- **Point-of-View**: Support different descriptions based on character knowledge

### **Example Selection Logic**
Future rendering pipeline:
1. **Exact Match**: Find example matching current state exactly
2. **Nearby Examples**: Find similar states using vector comparison
3. **LLM Generation**: Use nearby examples to generate new description
4. **Caching**: Cache generated descriptions for future use

### **Schema Evolution**
Database schema will expand to include:
- **State Conditions**: Weather, time, season, etc.
- **Point-of-View**: Character knowledge and perspective
- **Metadata**: Creation date, author, confidence scores

### **Collaborative Authorship with Confidence Scoring**
A sophisticated confidence scoring system will enable shared authorship while maintaining quality:

#### **Confidence Score Sources**
- **Author Expertise**: Experienced world-builders get higher confidence
- **Example Quality**: Well-written, detailed examples score higher
- **Consistency**: Examples that align with established patterns score higher
- **Validation**: Examples that have been reviewed/approved score higher
- **Usage History**: Examples that have been successfully used score higher

#### **Weighted Example Selection**
```typescript
// Future example selection with confidence weighting
const weightedExamples = examples.map(example => ({
    ...example,
    weight: calculateConfidence(example.author, example.quality, example.consistency)
}))

// LLM receives examples with confidence scores
const description = await llm.generateFromWeightedExamples(weightedExamples, state)
```

#### **Collaborative Benefits**
- **Beginner-Friendly**: New authors can contribute without harming quality
- **Expert Recognition**: Experienced authors' examples carry more weight
- **Quality Assurance**: System naturally favors better examples
- **Inclusive Growth**: Community can grow while maintaining standards

## Usage Patterns

### **Current Usage**
```typescript
// Get examples for a component
const examples = await examplesData.get(['ROOM#marketSquare-uuid'])
const marketExamples = examples['ROOM#marketSquare-uuid']

// ComponentRender uses first example
const firstExample = marketExamples[0]?.examples[0]
```

### **Future Usage (Planned)**
```typescript
// State-based example selection
const state = { weather: 'rain', time: 'night', season: 'autumn' }
const examples = await examplesData.getForState('ROOM#marketSquare-uuid', state)

// LLM extrapolation from nearby examples
const description = await llm.generateFromExamples(examples, state)
```

## Navigation Tips

1. **Start with `get()`**: Understand basic example retrieval
2. **Check `_getPromiseFactory()`**: See how DynamoDB queries are structured
3. **Review StandardExample**: Understand the example data structure
4. **Examine ComponentRender**: See how examples are currently used
5. **Look at future plans**: Understand the state-based vision

## Development Notes

- **Current Limitation**: No state matching, renders first example only
- **Future Focus**: State system design and LLM integration
- **Database Schema**: Will evolve to include state conditions
- **Integration**: Currently simple, will become more sophisticated
- **Caching**: Examples are cached by component ID, not by state 