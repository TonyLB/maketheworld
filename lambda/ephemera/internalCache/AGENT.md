# Internal Cache System - Agent Navigation Guide

## Overview

The `internalCache` system is a comprehensive caching layer that improves development velocity by providing **deferred loading** of asynchronous data sources. Cache handlers can request data anytime, but only make actual database calls on the first request for a particular item. Subsequent requests either refer to existing outstanding calls (if unfulfilled) or return cached data (if the call has previously completed).

### Per-invocation process state (not only deferred loads)

Some handlers are **process-supporting** state for the current lambda run: they may **not** use `DeferredCache`, but they still live on the [`InternalCache`](index.ts) singleton and reset in [`InternalCache.clear()`](index.ts). Examples: [`Global`](global.ts) (`internalCache.Global`, **`CacheGlobalData`**) for connection/session keyed fields; [`OrchestrateMessages`](orchestrateMessages.ts) for in-memory message-group graphs.

**Shipped (step 3 foundation):** **`internalCache.PerceptionThreads`** ([`perceptionThreads.ts`](perceptionThreads.ts)) --- fan-in aggregation store for **`mtw.ephemera.perception`**; **multiple** independent entries per **`componentId` + `perspectiveKey`**; **`register(cmd)`** takes a **`threadKind`**-discriminated **`PerceptionThreadRegisterCommand`** (see [`localApiEvents.ts`](../dataSource/perception/localApiEvents.ts)); **`update`** accepts a **`PerceptionThreadPatch`** (required **`threadKind`**, aligned with thread body **`kind`**) validated by **`isPerceptionThreadPatch`**, merged via **`mergePerceptionThreadPatch`**; returns **`false`** only when the row is missing; throws on invalid patch, kind mismatch, or **`stub`** rows; `clear()` wired from `InternalCache.clear()`, **no** `flush()`. Why perception owns this state, which flows register threads ([**Delivery paths**](../dataSource/perception/AGENT.md#delivery-paths-correlated-vs-imperative)), plus **routing key**, **obligations**, and **verification**: [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) (**Normative decisions and obligations**).

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
- **Component Render** (rooms and other kinds): `{CharacterId}::{EphemeraId}::{header}` (see **`generateEphemeraComponentCacheKey`** in [`componentStackMerge.ts`](componentStackMerge.ts), shared with **`ComponentRender`**)
- **Component stack merge** (rooms only): `{CharacterId}::{EphemeraRoomId}` --- no **`header`** segment; structural merge output does not depend on it (see **`generateComponentStackMergeCacheKey`** in [`componentStackMerge.ts`](componentStackMerge.ts))
- **Examples**: `{EphemeraId}` (component ID)
- **Render cache rows**: `{EphemeraId}` (Room/Feature/Knowledge component ID; `DeferredCache` + `_Store` mirror, `getExactMatch` for exact lookup)
- **Character Meta**: `{CharacterId}`
- **Asset State**: `{AssetId}::{StateType}`

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
- **`ComponentAssetMeta`**: Caches component metadata from assetDB ([`componentAssetMeta.AGENT.md`](./componentAssetMeta.AGENT.md))
- **`ComponentEphemeraMeta`**: Read-through cache for ephemeraDB `Meta::Room` (`EphemeraMetaRoom`); v1 room-only ([`componentEphemeraMeta.AGENT.md`](./componentEphemeraMeta.AGENT.md))
- **`ComponentRender`**: Caches rendered component descriptions ([`componentRender.AGENT.md`](./componentRender.AGENT.md))
- **`ComponentStackMerge`** ([`componentStackMerge.ts`](componentStackMerge.ts)): **`DeferredCache`** of **room**-only merged **`StandardForm`** --- same asset union and merge rules as **`ComponentRender`** for exits, **shortName**, and present-character wiring, plus **`RoomCharacterList`** (roster) and **`Meta::Room.objects`** from **`ComponentEphemeraMeta.get`**, but **does not** use **`RenderCache`**, **`Examples`**, or **`StandardRoomData.render`**. The merged form uses **`standardizeMode: 'ephemeraWire'`** (affordance structural WML, including **`<Object>`** when **`objects`** is non-empty). Use when callers need **structural** room truth (for example affordance-channel WML) without situation / example prose. API: **`get(CharacterId, EphemeraRoomId)`**, **`invalidate(EphemeraRoomId)`** (drops every cache key for that room via **`componentStackMergeCacheKeyForRoom`** / suffix **`::${roomId}`**). Cache key: **`generateComponentStackMergeCacheKey`** (two-part; not **`generateEphemeraComponentCacheKey`**); **future:** cache identity may move to **`(componentId, perspectiveKey)`** to align with render / perception **`perspectiveKey`**. **`clear()`** / **`flush()`** wired from **`InternalCache`**. Call **`invalidate(roomId)`** after **`ComponentEphemeraMeta.invalidate(roomId)`** wherever **`Meta::Room`** or roster data for that room changes (same paths as meta invalidation today, for example **`mergePersistMetaRoomObjects`**, **`mergePersistMetaRoomMarks`**, **`moveCharacter`**, **`disconnectMessage`**, **`defaultClearPerspectivePointer`** in render orchestration). Affordance **`PublishMessage`** rows are emitted from [`publishRoomAffordancePerceptionMessages.ts`](../dataSource/perception/publishRoomAffordancePerceptionMessages.ts) (roster via **`roomUpdate`**, **`Objects Changed`** via **`mtw.ephemera.perception`**). Pure merge helpers and **`generateEphemeraComponentCacheKey`** are exported from this module and imported by **`componentRender.ts`** (helpers-only sharing; no **`ComponentRender`** call into **`ComponentStackMerge.get`**).
- **`Examples`**: **`ExamplesData`** for **Feature**/**Knowledge** ephemera ids ([`examples.AGENT.md`](./examples.AGENT.md)); **Room** prose does not use this cache path.

### **Character-Based Handlers**
- **`CharacterMeta`**: Caches character metadata and state
- **`CharacterSessions`**: Caches character session data
- **`CharacterPossibleMaps`**: Caches character map access

### **Asset-Based Handlers**
- **`AssetMeta`**: Caches asset metadata
- **`AssetRooms`**: Caches asset-room relationships
- **`AssetState`**: Caches asset state and evaluation

### **Session-Based Handlers**
- **`SessionConnections`**: Caches connection data
- **`PlayerSessions`**: Caches player session data
- **`RoomCharacterLists`**: Caches room character lists

### **Global Handlers**
- **`Global`**: Caches global system data
- **`OrchestrateMessages`**: Caches message orchestration data
- **`PerceptionThreads`**: In-memory fan-in aggregation for **`mtw.ephemera.perception`**; [`perceptionThreads.ts`](perceptionThreads.ts), [`perceptionThreads.test.ts`](perceptionThreads.test.ts); **`stub`**, **`roomDescription`**, **`roomHeaderBroadcast`**, **`characterMove`** thread variants; **`register`** / **`list`** / **`update`** / **`remove(registrationId)`**; **`clear()`** only (no **`flush()`**). See [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) (**Normative decisions and obligations**).
- **`Graph`**: Caches graph relationships

## Integration Points

**CoyoteGame (demo / experimental):** [`coyoteGame.ts`](coyoteGame.ts) caches **`gameRooms`**, durable **intent** ([`CoyoteGameIntentRecord`](coyoteGame.ts): **`intent`**, optional **`walkthrough`**, optional **`narrativeBeatsStructured`**), and **outcome** (`RenderTree`). Wiring in [`index.ts`](index.ts) passes **`getIntentRecord: () => CoyoteGame.get('intent')`** into plan-outcome generation so the Bedrock prompt can use the full row without a second intent read. Steady-state behavior and prompt section order: [`../dataSource/coyoteGame/AGENT.md`](../dataSource/coyoteGame/AGENT.md) (Await RoadRunner, plan outcome, Bedrock caching).

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