# Internal Cache System - Agent Navigation Guide

## Overview

The `internalCache` system is a comprehensive caching layer that improves development velocity by providing **deferred loading** of asynchronous data sources. Cache handlers can request data anytime, but only make actual database calls on the first request for a particular item. Subsequent requests either refer to existing outstanding calls (if unfulfilled) or return cached data (if the call has previously completed).

### Gateway reads (normative)

Shared read surfaces from [`@tonylb/mtw-gateways`](../../../packages/mtw-gateways/AGENT.md) are consumed through **package `create*CacheHandler` factories** registered on this **`InternalCache`** singleton --- not by calling exported **`assemble*`**, **`fetch*`**, or **`query*`** helpers directly in steady-state lambda code (those are **secondary**: package tests, parity, tooling).

**Shipped today:** **`ComponentData`** on ephemera is the **composite** router over assetDB blueprint bodies + ephemeraDB improvisation pair rows ([`componentData.AGENT.md`](./componentData.AGENT.md), [`componentDataComposite.ts`](./componentDataComposite.ts)); **`ImprovisationComponentData`** (**`createImprovisationComponentDataCacheHandler(ephemeraDB)`** from [`packages/mtw-gateways/ts/ephemera/improvisation/`](../../../packages/mtw-gateways/ts/ephemera/improvisation/) --- pair reads for **`(OBJECT#, ASSET#IMPROVISATION)`**; registered separately for persist memo **`set`** / **`invalidate`**); **`ObjectEphemeraMeta`** ([`objectEphemeraMeta.AGENT.md`](./objectEphemeraMeta.AGENT.md) --- **`Meta::Object`** play meta for improvisational **`OBJECT#`** ids); **`ObjectEmbedding`** (**`createObjectEmbeddingCacheHandler(ephemeraDB)`** from [`packages/mtw-gateways/ts/ephemera/objectEmbedding/`](../../../packages/mtw-gateways/ts/ephemera/objectEmbedding/) --- batch read + memo for **`(OBJECT#, EMBEDDING#IMPROMPTU)`**); **`ComponentVerticals`** (**`createImportVerticalMetaCacheHandler(assetDB)`** from [`verticals/importVerticalMetaCache.ts`](../../../packages/mtw-gateways/ts/assets/components/verticals/importVerticalMetaCache.ts) --- `Meta::Import` hop envelope keyed by universal component id; used by Feature/Knowledge perspective helper and aggregate slice); **`ComponentAggregate`** + **`ComponentExamples`** (on-demand authored examples **A1** --- aggregate slice **`{ ComponentData, ComponentVerticals }`**, examples slice **`{ ComponentAggregate }`**; **`clear`** / **`flush`** with **`InternalCache`**); **`ComponentTopology`** (**`createComponentTopologyCacheHandler({ ComponentAggregate })`** from [`componentTopology`](../../../packages/mtw-gateways/ts/assets/components/componentTopology/) --- slice **`{ ComponentAggregate }`**; **`DeferredCache`** keyed **`roomUniversalKey::perspectiveKey`** via **`componentTopologyPerspectiveCacheKey`**; **`clear`** / **`flush`** with **`InternalCache`**, with **`ComponentTopology.clear`** before **`ComponentAggregate.clear`** so projected topology cannot outlive cleared aggregate state); **`AffordanceCache`** ([`affordanceCache.ts`](./affordanceCache.ts) extends **`createAffordanceCacheCacheHandler(ephemeraDB)`** --- colocated **`Affordance::${perspectiveKey}`** memo; **`getAffordanceRow`** serves hydrated rows only); **`Positions`** (**`EphemeraPositionsCacheData`** via **`createEphemeraPositionsCacheData(ephemeraDB)`** in [`positionsCache.ts`](./positionsCache.ts) --- wraps gateway **`createPositionsCacheHandler`**; **`getPositionGraph`** returns **`EphemeraPositionGraph`**; **`set(graph)`** accepts class only; adjacency memo passthrough); roster presentation via **`getRoomCharacterList`** in [`hydrateRoomRoster.ts`](./hydrateRoomRoster.ts)); **`RenderCache`** ([`renderCache.ts`](./renderCache.ts) extends **`createRenderCacheCacheHandler(ephemeraDB)`** + Ephemera-only **`getExactMatch`**); **`ThinkingResults`**, **`ThinkingSchedules`**, **`ThinkingJobs`** ([`dataSource/thinking/AGENT.md`](../dataSource/thinking/AGENT.md) --- scheduling rollup **must** use **`internalCache.ThinkingJobs.get`**, not ad-hoc **`ephemeraDB`** reads).

**Blueprint stack (hydrate consumers):** use **`internalCache.ComponentData.getAcrossAssets`** at the caller-supplied participation stack (pair-addressed reads). Steady-state hydrate calls **`internalCache.ComponentExamples.get(...)`** from [`ensureAuthoredCatalog`](../dataSource/renderCache/ensureAuthoredCatalog.ts) (orchestration resolve only in v1) --- not **`assembleComponentExamplesAtPerspective`**. Affordance-topology hydrate (**`ensureAffordanceTopology`** in [`affordanceCache`](../dataSource/affordanceCache/ensureAffordanceTopology.ts)) calls **`internalCache.ComponentTopology.get(...)`** on stale catalog reads only --- **not** on **`TopologyInvalidated`** receive (mirror **`handleExampleInvalidated`**). Feature/Knowledge perspective reads vertical hops via **`internalCache.ComponentVerticals.get`** in [`prepareFeatureKnowledgeRenderForCharacter`](../dataSource/renderOrchestration/prepareFeatureKnowledgeRenderForCharacter.ts). See [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md), [`renderCache/AGENT.md`](../dataSource/renderCache/AGENT.md) (**On-demand authored examples**), and [`affordanceCache/AGENT.md`](../dataSource/affordanceCache/AGENT.md).

### Area topology and affordance exits

Navigational exits on the affordances channel are **not** read from room blueprint **`StandardRoom.exits`** rows. The steady-state path:

1. **Assets** emit skinny **`TopologyInvalidated`** on Area **`positionGraph`** / **`referencedBy`** changes ([`lambda/assets/componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md)).
2. **`affordanceCache`** bumps catalog version on receive; **`ensureAffordanceTopology`** (orchestration preflight or nav sync) pulls **`internalCache.ComponentTopology.get`** -> **`projectRoomExits`** ([`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md)).
3. Hydrated **`Affordance::${perspectiveKey}`** rows embed **`ProjectedRoomTopology.exits`**.
4. **`AffordanceRoomDeliverable.get(roomId, perspectiveKey)`** loads the hydrated affordance row, uses **`row.assetStack`** (with **`appendImprovisationToPerspective`** when graph objects present) for **`ComponentAggregate`** **`shortName`**, **`row.topology.exits`** for exits, plus **`getRoomCharacterList`** and graph-enumerated object **`shortName`**s -> ephemeraWire **`StandardForm`** for terminal publish.

**`AffordanceRoomDeliverable`** is a per-invocation compose memo keyed by **`(roomId, perspectiveKey)`**. WML varies by **perspective** (merged **shortName**, projected **exits**), not by recipient character; roster is room-global; object ids come from **`Positions.getPositionGraph`** + improvisation pair **`shortName`**. On compose miss, **`AffordanceCache.getAffordanceRow`** is the gate: it supplies **`assetStack`** for **`ComponentAggregate`** and **exits** for the wire form. **`perspectiveKey`** is not reversible; the stack comes from the affordance row (or the **`Affordances Pertain`** payload), not from **`CharacterMeta`**. Delivery remains per-target (**`CHARACTER#`**, **`SESSION#`**) in perception; compose runs once per perspective per invocation. Called only on **`Affordances Pertain`** terminal publish --- not bus ingress. It does **not** call **`ensureAffordanceTopology`** or **`ComponentTopology.get`**. The affordance path does **not** use **`mergeRoomExitsToJSON`** (shared WML merge helpers live in [`roomWireMergeHelpers.ts`](roomWireMergeHelpers.ts) for **`GenerationContext`** and roster helpers used by **`AffordanceRoomDeliverable`**).

**Navigation:** [`getRoomExitTargetsForCharacter`](../dataSource/actions/roomExitTargetsForCharacter.ts) reads **`internalCache.Positions.getMembershipContainers`** for the character room endpoint, then calls **`ensureAffordanceTopology`** + **`AffordanceCache.getAffordanceRow`** synchronously --- no **`Affordances Requested`**, no **`PublishMessage`**.

**Production note:** Room-local blueprint exits were cleared; navigable exits come from merged Area **`positionGraph.edges`** via **`projectRoomExits`**. Production Coyote topology uses the overlay-asset pattern in [`AGENT.CoyoteGame.implementation.md`](../../../AGENT.CoyoteGame.implementation.md) (**Overlay asset topology**; play-mode verified 2026-06-09). Edge authoring rules: [`packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md`](../../../packages/mtw-wml/ts/standardize/keys/edges/AGENT.edges.md).

### Membership presentation and roster

Play **membership** on the affordances channel is **not** stored as display fields on `Meta::Room.positionGraph`. The steady-state path (parallel to [exit presentation](#area-topology-and-affordance-exits) above):

1. **Play manipulation truth** --- **`internalCache.Positions.getPositionGraph`** returns host-bound **`EphemeraPositionGraph`** (gateway **`PlayPositionGraph`** adapted at the cache wrapper); **`getMembershipContainers`** loads adjacency ([`dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority)). **`getMembershipContainers`** accepts **`CHARACTER#`** or **`OBJECT#`** PKs.
2. **Roster hydration** --- **`getRoomCharacterList`** ([`hydrateRoomRoster.ts`](hydrateRoomRoster.ts)) reads topology via **`internalCache.Positions.getPositionGraph`** -> **`graph.characterIds`**, then **`hydrateRoomRosterFromCharacterIds`** joins **`CharacterMeta`** (`Name` -> `DisplayName`, `Color`, `fileURL`) + **`CharacterSessions`** (`SessionIds`).
3. **Affordance compose** --- **`AffordanceRoomDeliverable.get(roomId, perspectiveKey)`** joins hydrated roster with exit projection (`row.topology.exits`), aggregate **`shortName`**, and graph-placed object labels -> ephemeraWire **`StandardForm`** for terminal publish.

**Perspective vs room-global:** exits vary by **perspective** (from the affordance row); roster and **objects** are **room-global** on the wire form. Both are presentation layers over distinct truth sources (membership topology vs authored Area graph).

**Navigation:** [`getRoomExitTargetsForCharacter`](../dataSource/actions/roomExitTargetsForCharacter.ts) uses **`getMembershipContainers`** for the character room endpoint only --- not hydrated roster.

Normative read rules and D3 must-not guard: [`dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md#read-surface-forward-graph-vs-reverse-containers).

### Per-invocation process state (not only deferred loads)

Some handlers are **process-supporting** state for the current lambda run: they may **not** use `DeferredCache`, but they still live on the [`InternalCache`](index.ts) singleton and reset in [`InternalCache.clear()`](index.ts). Examples: [`Global`](global.ts) (`internalCache.Global`, **`CacheGlobalData`**) for connection/session keyed fields; [`PerceptionThreads`](perceptionThreads.ts) for the render targeting registry (below). Message ordering is **not** such a handler: it lives in [`dataSource/messageOrchestration`](../dataSource/messageOrchestration/AGENT.md), which owns per-bundle ordering and `CreatedTime` assignment.

**Shipped (step 3 foundation):** **`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](perceptionThreads.ts)) --- **render targeting registry** for **`mtw.ephemera.perception`** (distinct from membership **`FanInClusterStore`** fan-in on the same DataSource); **multiple** independent entries per **`componentId` + `perspectiveKey`**; **`register(cmd)`** takes a **`threadKind`**-discriminated **`PerceptionThreadRegisterCommand`** (see [`localApiEvents.ts`](../dataSource/perception/localApiEvents.ts)); **`update`** accepts a **`PerceptionThreadPatch`** (required **`threadKind`**, aligned with thread body **`kind`**) validated by **`isPerceptionThreadPatch`**, merged via **`mergePerceptionThreadPatch`**; returns **`false`** only when the row is missing; throws on invalid patch or kind mismatch; `clear()` wired from `InternalCache.clear()`, **no** `flush()`. Why perception owns this state, which flows register threads ([**Delivery paths**](../dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative)), per-`threadKind` fields ([**Render targeting registry**](../dataSource/perception/AGENT.md#render-targeting-registry-perceptionthreads)), plus **routing key**, **obligations**, and **verification**: [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) (**Normative decisions and obligations**).

## Core Architecture

### **DeferredCache Foundation**
All cache handlers use the `DeferredCache<T>` class which provides:
- **Deferred Loading**: Request data immediately, load asynchronously
- **Batching**: Multiple requests for the same data share single database calls
- **Promise Management**: Handles concurrent requests efficiently
- **Invalidation**: Supports cache invalidation and refresh

### **Dual Storage Pattern**
Most cache handlers implement a dual storage system:
- **`_Cache`**: `DeferredCache` for managing async loading and batching
- **`_Store`**: Direct object storage for immediate access to cached data

### **Cache Key Patterns**
Different handlers use specific cache key formats:
- **Component Meta**: `{assetId}::{EphemeraId}`
- **Affordance room deliverable** (rooms only): `{EphemeraRoomId}::{perspectiveKey}` (see **`generateAffordanceRoomDeliverableCacheKey`** in [`affordanceRoomDeliverable.ts`](affordanceRoomDeliverable.ts))
- **Examples**: `{EphemeraId}` (component ID)
- **Render cache rows**: `{EphemeraId}` (Room/Feature/Knowledge component ID; `DeferredCache` + `_Store` mirror, `getExactMatch` for exact lookup)
- **Character Meta**: `{CharacterId}`
- **Asset State**: `{AssetId}::{StateType}`
- **Thinking results** (`internalCache.ThinkingResults`): `{workItemId}`
- **Thinking schedules** (`internalCache.ThinkingSchedules`): `{workItemId}`
- **Thinking jobs** (`internalCache.ThinkingJobs`): `{generationId}` (snapshot: normalized **`Meta::Job`** + adjacency **`workItemIds`** + **`schedules[]`**; see [`dataSource/thinking/AGENT.md`](../dataSource/thinking/AGENT.md)).

## Common Cache Handler Patterns

### **Constructor Pattern**
```typescript
export class CacheHandler {
    _Cache: DeferredCache<DataType>;
    _Store: Record<string, DataType> = {};
    
    constructor() {
        this._Cache = new DeferredCache<DataType>({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: (cacheKey) => { /* create default value */ }
        })
    }
}
```

### **Core Methods Pattern**
All cache handlers implement these standard methods:

#### **`get(key)` - Single Item Retrieval**
```typescript
async get(key: string): Promise<DataType> {
    if (!this._Cache.isCached(key)) {
        this._Cache.add({
            promiseFactory: () => this._getPromiseFactory(key),
            requiredKeys: [key],
            transform: (fetch) => ({ [key]: fetch })
        })
    }
    await this._Cache.get(key)
    return this._Store[key]
}
```

#### **`flush()` - Wait for Pending Operations**
```typescript
async flush() {
    this._Cache.flush()
}
```

#### **`clear()` - Remove All Cached Data**
```typescript
clear() {
    this._Cache.clear()
    this._Store = {}
}
```

#### **`invalidate(key)` - Remove Specific Item**
```typescript
invalidate(key: string) {
    if (key in this._Store) {
        delete this._Store[key]
    }
    if (key in this._Cache) {
        delete this._Cache[key]
    }
}
```

#### **`set(key, value)` - Manually Set Data**
```typescript
set(key: string, value: DataType) {
    this._Cache.set(Infinity, key, value)
    this._Store[key] = value
}
```

### **Promise Factory Pattern**
Each handler implements a `_getPromiseFactory()` method that:
- Constructs database queries
- Handles data transformation
- Manages error cases
- Returns properly typed data

### **Store Management Pattern**
```typescript
_setStore(key: string, value: DataType): void {
    this._Store[key] = value
}
```

## Database Integration Patterns

### **DynamoDB Query Patterns**
Different handlers use various DynamoDB query patterns:

#### **Single Item Lookup**
```typescript
const result = await db.getItem({
    Key: { AssetId: 'uuid', DataCategory: 'category' }
})
```

#### **Batch Item Lookup**
```typescript
const results = await db.getItems({
    Keys: [{ AssetId: 'uuid1', DataCategory: 'cat1' }, ...]
})
```

#### **Query with Conditions**
```typescript
const results = await db.query({
    Key: { EphemeraId: 'uuid' },
    KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'EXAMPLE#' }
})
```

### **Data Transformation Patterns**
Handlers typically transform database results:
```typescript
// Extract and validate data
const { DataCategory, AssetId, ...rest } = value
const componentData = { 
    universalKey: EphemeraId, 
    tag: tagFromEphemeraId(EphemeraId), 
    ...rest 
}

// Validate and create objects
if (!isStandardComponentData(componentData)) {
    throw new Error(`Invalid data for ${EphemeraId}`)
}
const component = standardComponentFactory(componentData)
```

## Error Handling Patterns

### **Cache Key Validation**
```typescript
if (!isSchemaComponentUUID(EphemeraId)) {
    throw new Error('Invalid EphemeraId in cache')
}
if (!isSchemaAssetUUID(assetId)) {
    throw new Error('Invalid assetId in cache')
}
```

### **Data Validation**
```typescript
if (!isValidDataType(data)) {
    throw new Error(`Invalid data for key: ${key}`)
}
```

### **Factory Validation**
```typescript
const object = factoryFunction(data)
if (!object) {
    throw new Error(`Failed to create object for key: ${key}`)
}
```

## Cache Handler Types

### **Component-Based Handlers**
- **`ComponentData`**: Composite router over assetDB blueprint bodies + ephemeraDB improvisation pair rows ([`componentData.AGENT.md`](./componentData.AGENT.md), [`componentDataComposite.ts`](./componentDataComposite.ts))
- **`ComponentEphemeraMeta`**: Read-through cache for ephemeraDB `Meta::Room` (`EphemeraMetaRoom`); v1 room-only ([`componentEphemeraMeta.AGENT.md`](./componentEphemeraMeta.AGENT.md))
- **`ObjectEphemeraMeta`**: Read-through cache for ephemeraDB `Meta::Object` (`EphemeraMetaObject`); Coyote play meta for improvisational **`OBJECT#`** ids ([`objectEphemeraMeta.AGENT.md`](./objectEphemeraMeta.AGENT.md))
- **`ImprovisationComponentData`**: Pair-addressed read + memo for ephemeraDB **`(OBJECT#, ASSET#IMPROVISATION)`** via **`createImprovisationComponentDataCacheHandler(ephemeraDB)`** ([`packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md`](../../../packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md)). Registered separately for persist memo **`set`** / **`invalidate`**; composite **`ComponentData`** delegates improvisation reads to this same instance.
- **`ObjectEmbedding`**: Batch read + memo for ephemeraDB **`(OBJECT#, EMBEDDING#IMPROMPTU)`** via **`createObjectEmbeddingCacheHandler(ephemeraDB)`** ([`packages/mtw-gateways/ts/ephemera/objectEmbedding/AGENT.md`](../../../packages/mtw-gateways/ts/ephemera/objectEmbedding/AGENT.md)). v1 impromptu scope only; memo **`set`** / **`invalidate`** via [`invalidateImprovisationObjectCaches.ts`](../dataSource/objects/invalidateImprovisationObjectCaches.ts) after objects-lane writes.
- **`Positions`** ([`positionsCache.ts`](./positionsCache.ts)): ephemera-only **`EphemeraPositionsCacheData`** wrapper over **`createPositionsCacheHandler`**. **`getPositionGraph(componentId)`** -> **`EphemeraPositionGraph.fromPlayEnvelope`**. **`set(graph: EphemeraPositionGraph)`** delegates **`graph.toPlayEnvelope()`** with memo key **`graph.hostId`**. **`getMembershipContainers`** / **`setMembershipContainers`** / **`invalidate*`** passthrough. Diagnostics lambda keeps raw gateway handler.
- **`AffordanceRoomDeliverable`** ([`affordanceRoomDeliverable.ts`](affordanceRoomDeliverable.ts)): **`DeferredCache`** of perspective-scoped merged **`StandardForm`** for affordance-channel structural WML. **`get(EphemeraRoomId, perspectiveKey)`** composes: **`AffordanceCache.getAffordanceRow`** first (required; supplies **`assetStack`** + projected **`exits`**); object ids from **`Positions.getPositionGraph`** -> **`graph.objectIds`**; **`appendImprovisationToPerspective`** on the stack when objects present; **`ComponentAggregate.get`** for room and per-object **`shortName`**; hydrated roster via **`getRoomCharacterList`**. Uses **`standardizeMode: 'ephemeraWire'`**. **Does not** read **`Meta::Room.objects`**. **Does not** call **`ensureAffordanceTopology`** or **`ComponentTopology.get`** (callers must hydrate first). **`invalidate(EphemeraRoomId)`** drops every cache key for that room. Cache key: **`generateAffordanceRoomDeliverableCacheKey`** (**`roomId::perspectiveKey`**).
- **`AffordanceCache`** ([`affordanceCache.ts`](affordanceCache.ts)): memo of colocated **`Affordance::${perspectiveKey}`** Dynamo rows via **`createAffordanceCacheCacheHandler`**. **`getAffordanceRow(roomId, perspectiveKey)`** returns hydrated rows only; **`getAffordanceRowIncludingStale`** for catalog management. Memo **`set`** / **`invalidate`** --- no Dynamo write-through. Steady-state hydrate: [`../dataSource/affordanceCache/ensureAffordanceTopology.ts`](../dataSource/affordanceCache/ensureAffordanceTopology.ts).
- **`Examples`**: **`ExamplesData`** for **Feature**/**Knowledge** ephemera ids ([`examples.AGENT.md`](./examples.AGENT.md)); **Room** prose does not use this cache path.

### **Character-Based Handlers**
- **`CharacterMeta`**: Caches character metadata and state
- **`CharacterSessions`**: Caches character session data
- **`GenerationContext`**: Generation-oriented room shortName cache ([`generationContext/AGENT.md`](generationContext/AGENT.md))
- **Server map runtime (stub):** [`../dataSource/maps/AGENT.md`](../dataSource/maps/AGENT.md) --- subscribe returns empty snapshots; map render retired

### **Retired handlers**

- **`ComponentRender`** (removed): room render prose is **`RenderCache`** + [`roomRenderWmlFromCacheRecord`](../dataSource/perception/roomRenderWmlFromCacheRecord.ts); affordance WML is **`AffordanceRoomDeliverable`**; LLM grounding is **`GenerationContext`**; maps are [`../dataSource/maps/AGENT.md`](../dataSource/maps/AGENT.md).

### **Asset-Based Handlers**
- **`AssetMeta`**: Caches asset metadata
- **`AssetRooms`**: Caches asset-room relationships
- **`AssetState`**: Caches asset state and evaluation

### **Session-Based Handlers**
- **`SessionConnections`**: Caches connection data
- **`PlayerSessions`**: Caches player session data from `Meta::Session` rows (no `Global / Sessions` dependency)

### **Roster assembly (derive-on-call)**
- **`getRoomCharacterList`** ([`hydrateRoomRoster.ts`](hydrateRoomRoster.ts)): Derives **`RoomCharacterListItem[]`** on each call from **`Positions.getPositionGraph`** + **`hydrateRoomRosterFromCharacterIds`** (no per-room memo). **`hydrateRoomRosterFromCharacterIds`** composes display fields from **`CharacterMeta`** + **`CharacterSessions`**.

### **Global Handlers**
- **`Global`**: Caches global system data
- **`OrchestrateMessages`**: Caches message orchestration data
- **`PerceptionThreads`**: In-memory **render targeting registry** for **`mtw.ephemera.perception`**; [`perceptionThreads.ts`](perceptionThreads.ts), [`perceptionThreads.test.ts`](perceptionThreads.test.ts); **`roomDescription`**, **`roomHeaderBroadcast`**, **`sessionOrientationRender`**, **`sessionOrientationAffordances`**, **`characterMove`**, **`featureDescription`**, **`knowledgeDescription`** thread variants; render-correlated kinds store optional **`createdTime`** (Generating **`T0`** for terminal revision ordering); **`register`** / **`list`** / **`update`** / **`remove(registrationId)`**; **`clear()`** only (no **`flush()`**). See [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) (**Render targeting registry**, **Normative decisions and obligations**).
- **`Graph`**: Caches graph relationships

## Integration Points

**CoyoteGame (demo / experimental):** [`coyoteGame.ts`](coyoteGame.ts) caches **`gameRooms`**, durable **intent** ([`CoyoteGameIntentRecord`](coyoteGame.ts): **`intent`**, optional **`walkthrough`**, optional **`narrativeBeatsStructured`**, optional internal **`gimmick`**, optional sparse **`tropeSequence`** from the plan-select winner), and **outcome** (`RenderTree`). Wiring in [`index.ts`](index.ts) passes **`getIntentRecord: () => CoyoteGame.get('intent')`** into plan-outcome generation so the Bedrock prompt can use the full row without a second intent read. Steady-state behavior and prompt section order: [`../dataSource/coyoteGame/AGENT.md`](../dataSource/coyoteGame/AGENT.md) (Await RoadRunner, plan outcome, Bedrock caching).

### **Database Systems**
- **`assetDB`**: Component metadata and asset data
- **`ephemeraDB`**: Game state and character data
- **`connectionDB`**: Connection and session data

### **WML System**
- **`StandardComponent`**: Component creation and validation
- **`StandardForm`**: Asset-level operations
- **`StandardRender`**: Rich text processing

### **External Systems**
- **Graph Storage**: Relationship caching
- **State Management**: Asset state evaluation
- **Message System**: Real-time updates

## Performance Optimizations

### **Batching**
Multiple requests for the same data are batched:
```typescript
// These three calls share the same database query
await cache.get('key1')
await cache.get('key2') 
await cache.get('key3')
```

### **Deferred Loading**
Data loads in background while requests queue:
```typescript
const promise = cache.get('key') // Returns immediately
// ... other work ...
const data = await promise        // Resolves when ready
```

### **Memory Management**
- **`_Store`**: Fast access to frequently used data
- **`_Cache`**: Manages async operations and batching
- **Invalidation**: Removes stale data automatically

## Development Guidelines

### **Adding New Cache Handlers**
1. **Extend DeferredCache**: Use the standard pattern
2. **Implement Core Methods**: `get()`, `flush()`, `clear()`, `invalidate()`, `set()`
3. **Add to InternalCache**: Register in the main cache system
4. **Add Error Handling**: Validate inputs and outputs
5. **Add Tests**: Ensure proper caching behavior

### **Cache Key Design**
- **Uniqueness**: Ensure keys uniquely identify cached items
- **Readability**: Use descriptive key formats
- **Validation**: Always validate key components

### **Data Transformation**
- **Validation**: Always validate database results
- **Factory Usage**: Use appropriate factory functions
- **Error Handling**: Provide clear error messages

## Navigation Tips

1. **Start with DeferredCache**: Understand the foundation
2. **Check Constructor Patterns**: See how handlers are initialized
3. **Review Database Integration**: Understand query patterns
4. **Examine Error Handling**: See validation patterns
5. **Look at Integration**: Understand how handlers work together

## Common Pitfalls

- **Memory Leaks**: Always implement proper `clear()` methods
- **Race Conditions**: Use DeferredCache for concurrent access
- **Invalidation**: Ensure proper cache invalidation
- **Validation**: Always validate database results
- **Batching**: Don't break the batching optimization 