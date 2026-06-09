# Component Data Cache - Agent Navigation Guide

## Overview

**`internalCache.ComponentData`** is the tier-1 cache handler for **blueprint component bodies** in the **`assetDB`** DynamoDB table. It is an instance of **`ComponentDataCache`** from **`@tonylb/mtw-gateways/ts/assets/components/componentData`** (`createComponentDataCacheHandler(assetDB)`). It provides cross-asset component lookup at explicit **`(universalKey, assetId)`** pairs and integrates with the WML **`StandardComponent`** system.

**Distinct from [`ComponentEphemeraMeta`](./componentEphemeraMeta.AGENT.md):** that handler reads **ephemeraDB** runtime state (`Meta::Room`, etc.). **`ComponentData`** reads **authored blueprint layers** in **assetDB** only.

**Shared read helpers:** Cache key format, DynamoDB `getItems` batching, row normalization, and default synthesis for pair misses live in the gateway module (see [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)). This file documents ephemera's **`internalCache`** registration and typical call patterns.

> **Note**: This handler follows the standard `internalCache` patterns documented in [`AGENT.md`](./AGENT.md).

## Unique Features

### **Cross-Asset Component Lookup**

Ephemera hot paths call **`getAcrossAssets`** with a **caller-supplied asset stack** (from **`RoomAssets`**, character viewpoint, or canon participation order) --- not partition enumerate:

```typescript
const results = await internalCache.ComponentData.getAcrossAssets('ROOM#mainHall-uuid', [
    'ASSET#marketSquare-uuid',
    'ASSET#downtown-uuid',
])
// Returns: Record<AssetUUID, StandardComponent>
```

### **Default Component Creation**

When a pair is missing in Dynamo, the handler synthesizes a default via **`defaultComponentFromTag`** + **`standardComponentFactory`**.

## Cache Key Format

Pair entries use: **`{assetId}::{universalKey}`** (`componentPairCacheKey` in the gateway package).

## Core Methods

### **`get(universalKey, assetId)`**

Single pair read.

### **`getAcrossAssets(universalKey, assetList)`**

Batch pair read for merge/render paths; batches uncached pairs per universal key.

### **`invalidate(universalKey, assetId)`**, **`set`**, **`clear`**, **`flush`**

Same lifecycle contract as other tier-1 gateway handlers on **`InternalCache`**.

## DynamoDB Integration

Rows live in **assetDB**:

```typescript
{
    AssetId: ComponentUUID,
    DataCategory: AssetUUID,
    // ... StandardComponent fields
}
```

**Participation order / asset stack:** resolve via [`RoomAssets`](./assetRooms.ts) or explicit caller lists --- not via unbounded partition scan on this handler.

## Integration Points

- **`ComponentRender`**, **`AffordanceRoomDeliverable`**, **`GenerationContext`**: inject **`getAcrossAssets`** at construction.
- **`computeDefaultMarksForRoom`**: reads room/lens bodies across the asset stack.
- **Future `ComponentAggregate` slice (A1, shipped):** registered on [`index.ts`](./index.ts) with **`{ ComponentData: internalCache.ComponentData, ComponentVerticals: empty-hops stub }`**; **`ComponentExamples`** composes **`ComponentAggregate`**. See [`componentAggregate.test.ts`](./componentAggregate.test.ts).

## Navigation Tips

1. **Gateway module:** [`packages/mtw-gateways/ts/assets/components/componentData`](../../../packages/mtw-gateways/ts/assets/components/componentData/index.ts)
2. **Contrast with ephemera state:** [`componentEphemeraMeta.AGENT.md`](./componentEphemeraMeta.AGENT.md)
3. **Tests:** [`componentData.test.ts`](./componentData.test.ts)

## Development Notes

- **Validation:** Validate **`assetId`** and universal component id before reads.
- **Batching:** Multiple pair requests for the same universal key share one **`getItems`** batch where possible.
- **Do not** use partition **`Query`** on the universal id from Ephemera hot paths; maintenance-only exhaustive scan is a separate gateway subpath (assets/diagnostics whitelist).
