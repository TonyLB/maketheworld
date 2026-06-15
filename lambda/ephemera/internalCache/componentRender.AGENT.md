# Component Render Cache - Agent Navigation Guide

## Overview

The `ComponentRenderData` class is a cache handler that manages **rendered component descriptions** for rooms, maps, and messages. It combines component metadata and character context to generate rich descriptions for non-perception call sites (e.g. **`parse/index.ts`** room command context, Map when re-enabled).

> **Feature / Knowledge perception** no longer uses **`ComponentRender`**. Imperative **`PerceptionComponentMessage`** for F/K builds WML from **`internalCache.RenderCache`** via [`../dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts`](../dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts).

> **Note**: This handler follows the standard `internalCache` patterns documented in [`AGENT.md`](./AGENT.md). See that file for common patterns like DeferredCache usage, dual storage, and core methods.

## Core Purpose

ComponentRender serves as the **rendering pipeline** that transforms raw component data into user-facing descriptions:

- **Component Assembly**: Combines component metadata from multiple assets
- **Example Integration**: Incorporates example descriptions from the Examples system
- **Character Context**: Considers character-specific assets and permissions
- **Rich Text Generation**: Produces formatted descriptions using RenderTree
- **Caching**: Stores expensive rendering results for reuse

## Cache Key Format

ComponentRender uses a compound cache key: `{CharacterId}::{EphemeraId}::{header}`
- **`CharacterId`**: The character requesting the render (or 'ANONYMOUS')
- **`EphemeraId`**: The component being rendered (Room, Map, Message ID)
- **`header`**: Boolean flag for header-only rendering (optional)

## Data Structure

Each cached item contains a `StandardForm` representing the rendered component. This facilitates storing all
of the referenced data (particularly Examples) with the Component that needs those references:
```typescript
{
    tag: 'Asset',
    universalKey: 'ASSET#render',
    components: [
        // Rendered component (Room, Map, Message)
        // Associated examples (if available)
        // Supporting data (exits, positions, etc.)
    ]
}
```

## Core Methods

### **`get(CharacterId, EphemeraId, options)`**
Retrieves a rendered component description:

```typescript
const rendered = await componentRender.get(
    'CHARACTER#player-uuid',
    'ROOM#marketSquare-uuid',
    { header: false }
)
// Returns: StandardForm with rendered component
```

### **`invalidate(CharacterId, EphemeraId)`**
Removes a specific render from cache:

```typescript
componentRender.invalidate('CHARACTER#player-uuid', 'ROOM#marketSquare-uuid')
```

### **`set(CharacterId, EphemeraId, value)`**
Manually sets rendered data:

```typescript
componentRender.set('CHARACTER#player-uuid', 'ROOM#marketSquare-uuid', renderedForm)
```

## Rendering Pipeline

### **Component Type Processing**

#### **Room Rendering**
- **Metadata Assembly**: Combines room data from all accessible assets
- **Exit Processing (render-channel legacy)**: Merges blueprint exit facets across assets via **`mergeRoomExitsToJSON`** ([`roomWireMergeHelpers.ts`](roomWireMergeHelpers.ts)) / **`ExitFacetList`**. **Not** the affordance or navigation source --- live exits come from Area topology projection ([`../dataSource/affordanceCache/AGENT.md`](../dataSource/affordanceCache/AGENT.md), [`AGENT.md`](./AGENT.md) **Area topology and affordance exits**).
- **Character Lists**: Includes characters currently in the room (resolved to **`StandardCharacterData`** children)
- **Prose for perception**: **`renderCache`** (Dynamo) **`renderedContent`** only, converted to **`SituationRoomFacetPayloadType`** via **`situationRoomRenderPayloadFromCacheRenderedContent`**. When there is no cache record (or the payload is empty after mapping), Room output has **no** `<Render>` for prose. The room path does **not** call **`ExamplesData`** for prose and does **not** synthesize separate Example / Situation wire children for that prose.
- **Short Name**: Merges short names from multiple assets

#### **Map Rendering**
- **Position Processing**: Handles room positions and coordinates
- **Room Integration**: Includes all rooms on the map
- **Exit Validation**: Ensures exits connect to valid rooms
- **Image Integration**: Processes map images and overlays

#### **Message Rendering**
- **Content Assembly**: Merges message content from multiple assets
- **Rich Text Processing**: Handles formatted message content
- **Room Association**: Links messages to specific rooms

### **Asset Discovery**
ComponentRender discovers accessible assets through:
- **Global Assets**: System-wide accessible assets
- **Character Assets**: Assets specific to the requesting character
- **Asset Filtering**: Only includes assets where component appears

### **Example Integration (rooms vs other types)**
- **Rooms (ComponentRender)**: **`renderCache`** only for display prose in the Room branch (uses first cache row today).
- **Feature / Knowledge (perception)**: Delivered via **`RenderCache`** + [`featureKnowledgeRenderWmlFromCacheRecord.ts`](../dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts), not **`ComponentRender`**.
- **`ExamplesData`**: Removed (Phase 4).

## Integration Points

### **ComponentData**
- Calls `internalCache.ComponentData.getAcrossAssets()` to retrieve blueprint component bodies
- Combines data from multiple assets for comprehensive rendering
- See [`componentData.AGENT.md`](./componentData.AGENT.md) for details

### **Examples System**
- **`ComponentRenderData`** does not call **`examples.get()`** for Room display prose.
- Feature / Knowledge display prose is assembled in perception from **`renderCache`** (see [`../dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts`](../dataSource/perception/featureKnowledgeRenderWmlFromCacheRecord.ts)).

### **Character System**
- Integrates with `characterMeta` for character-specific assets
- Considers character permissions and access levels
- Supports anonymous access for public components

### **Room Character Lists**
- Retrieves current character lists for rooms
- Enables dynamic room descriptions based on occupancy

### **Perception System**
- **Room / Feature / Knowledge perception**: Imperative **`perceptionMessage`** builds **`PerceptionMessage.wmlContent`** from **`RenderCache`** + perception WML helpers (not **`ComponentRender.get`**).
- **Other ComponentRender consumers**: e.g. **`parse/index.ts`** (room exits/characters for command parsing), Map when **`MAP_PERCEPTION_ENABLED`** is restored.

## Legacy Code Considerations

### **Conditional Rendering (Deprecated)**
The system includes legacy code for evaluating hard-coded conditions:

```typescript
// Legacy conditional evaluation (to be deprecated)
export const filterAppearances = (evaluateCode: (address: EvaluateCodeAddress) => Promise<any>) => 
    async <T extends { conditions: EphemeraCondition[] }>(possibleAppearances: T[]): Promise<T[]>
```

**Future Plans:**
- **Deprecate Conditions**: Remove hard-coded condition evaluation
- **Simplify Pipeline**: Streamline rendering without legacy condition logic
- **State-Based Approach**: Replace with Examples-based state matching

## Future Development

### **Persistent Caching**
Due to high computational cost of LLM rendering, results will be cached persistently:

#### **Current Limitation**
- **DeferredCache lifetime**: Assembled **`StandardForm`** results in **`ComponentRenderData`** are in-memory for the current lambda invocation only.
- **Room prose elsewhere**: Dynamo **`renderCache`** can persist **`renderedContent`** consumed when building **`StandardRoomData.render`**; that is separate from **`DeferredCache`**.
- **Broader persistence**: Other expensive paths may still repeat work across cold starts until the planned ephemeraDB layer lands.

#### **Planned Enhancement**
- **EphemeraDB Caching**: Store render results in DynamoDB
- **Cache Checking**: Check persistent cache before generating
- **Cost Optimization**: Avoid expensive LLM calls for repeated renders
- **Cache Invalidation**: Smart invalidation when dependencies change

#### **Implementation Strategy**
```typescript
// Future persistent caching approach
async _getPromiseFactory(CharacterId, EphemeraId, options) {
    // 1. Check persistent cache in ephemeraDB first
    const persistentResult = await ephemeraDB.getRender(cacheKey)
    if (persistentResult) {
        return persistentResult
    }
    
    // 2. Generate new render (expensive) - existing logic
    const [globalAssets, { assets: characterAssets }] = await Promise.all([
        this._getAssets(),
        isEphemeraCharacterId(CharacterId) ? this._characterMeta(CharacterId) : Promise.resolve({ assets: [] })
    ])
    // ... existing rendering logic ...
    
    // 3. Cache persistently after generation
    await ephemeraDB.setRender(cacheKey, newResult)
    
    return newResult
}
```

### **State-Based Rendering**
Future integration with the Examples system will enable:
- **State Matching**: Match current state to appropriate examples
- **LLM Generation**: Generate descriptions for unmatched states
- **Dynamic Content**: Context-aware descriptions based on circumstances

## Usage Patterns

### **Basic Component Rendering**
```typescript
// Render a room for a character
const roomDescription = await componentRender.get(
    'CHARACTER#player-uuid',
    'ROOM#marketSquare-uuid'
)

// Render a feature
const featureDescription = await componentRender.get(
    'CHARACTER#player-uuid',
    'FEATURE#fountain-uuid'
)
```

### **Header-Only Rendering**
```typescript
// Get just the header/short description
const header = await componentRender.get(
    'CHARACTER#player-uuid',
    'ROOM#marketSquare-uuid',
    { header: true }
)
```

### **Anonymous Access**
```typescript
// Render for anonymous users
const publicDescription = await componentRender.get(
    'ANONYMOUS',
    'ROOM#marketSquare-uuid'
)
```

## Navigation Tips

1. **Start with `get()`**: Understand the main rendering interface
2. **Check `_getPromiseFactory()`**: See how different component types are processed
3. **Review Integration**: Understand how ComponentData and Examples are used
4. **Examine Legacy Code**: See the conditional rendering code (to be deprecated)
5. **Look at Future Plans**: Understand persistent caching and state-based rendering

## Development Notes

- **Current Limitation**: Rooms use **`renderCache`** only for prose (no example fallback); other types may still use naive first-example; no state matching
- **Legacy Code**: Conditional rendering system to be deprecated
- **Caching**: Local-only, persistent caching planned
- **Performance**: Expensive rendering operations need optimization
- **Integration**: Heavily depends on ComponentData and Examples systems