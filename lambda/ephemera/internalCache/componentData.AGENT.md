# Component Data Cache - Agent Navigation Guide

## Overview

**`internalCache.ComponentData`** is the tier-1 cache handler for **component merge bodies** used in participation-order reads. On ephemera it is an **`EphemeraComponentDataCompositeCache`** ([`componentDataComposite.ts`](./componentDataComposite.ts)) that routes by **`assetId`**:

| `assetId` | Backend | Table |
| --- | --- | --- |
| Blueprint / canon layers | **`_assetComponentData`** (`createComponentDataCacheHandler(assetDB)`) | **assetDB** |
| **`ASSET#IMPROVISATION`** | **`ImprovisationComponentData`** (shared instance) | **ephemeraDB** |

**Distinct from [`ComponentEphemeraMeta`](./componentEphemeraMeta.AGENT.md):** that handler reads **ephemeraDB** runtime state (`Meta::Room`, etc.). **`ComponentData`** reads **merge bodies** at **`(universalKey, assetId)`** pairs.

**Memo split:** persist coordinators patch **`ImprovisationComponentData`** directly after Dynamo writes --- not **`ComponentData.set`** for improvisation rows. The composite shares the same **`ImprovisationComponentData`** instance so memo patches are visible to aggregate reads without a second query.

**Assets/diagnostics:** keep assetDB-only **`createComponentDataCacheHandler`** --- no **`mtw-gateways`** composite surface.

**Shared read helpers:** Cache key format, DynamoDB `getItems` batching, row normalization, and default synthesis for pair misses live in the gateway module (see [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)). This file documents ephemera's **`internalCache`** registration and typical call patterns.

> **Note**: This handler follows the standard `internalCache` patterns documented in [`AGENT.md`](./AGENT.md).

## Unique Features

### **Cross-Asset Component Lookup**

Ephemera hot paths call **`getAcrossAssets`** with a **caller-supplied asset stack** (from **`RoomAssets`**, character viewpoint, or canon participation order) --- not partition enumerate:

```typescript
const results = await internalCache.ComponentData.getAcrossAssets('ROOM#mainHall-uuid', [
    'ASSET#marketSquare-uuid',
    'ASSET#downtown-uuid',
    'ASSET#IMPROVISATION', // when appended via appendImprovisationToPerspective (I3)
])
// Returns: Record<AssetUUID, StandardComponent>
```

### **Default Component Creation**

When a pair is missing in Dynamo, the handler synthesizes a default via **`defaultComponentFromTag`** + **`standardComponentFactory`**.

## Cache Key Format

Pair entries use: **`{assetId}::{universalKey}`** (`componentPairCacheKey` in the gateway package).

## Core Methods

### **`get(universalKey, assetId)`**

Single pair read; routed by **`assetId`**.

### **`getAcrossAssets(universalKey, assetList)`**

Batch pair read for merge/render paths; splits improvisation ids before delegating.

### **`invalidate(universalKey, assetId)`**, **`set`**, **`clear`**, **`flush`**

Same lifecycle contract as other tier-1 gateway handlers on **`InternalCache`**. Improvisation pairs route to **`ImprovisationComponentData`**; blueprint pairs route to **`_assetComponentData`**.

## DynamoDB Integration

Blueprint rows live in **assetDB**:

```typescript
{
    AssetId: ComponentUUID,
    DataCategory: AssetUUID,
    // ... StandardComponent fields
}
```

Improvisation rows live in **ephemeraDB** (`EphemeraId` + `DataCategory: ASSET#IMPROVISATION`). See [`packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md`](../../../packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md).

**Participation order / asset stack:** resolve via [`RoomAssets`](./assetRooms.ts), **`appendImprovisationToPerspective`** ([`packages/mtw-interfaces/ts/perspective.ts`](../../../packages/mtw-interfaces/ts/perspective.ts)), or explicit caller lists --- not via unbounded partition scan on this handler.

## Integration Points

- **`AffordanceRoomDeliverable`**, **`GenerationContext`**: inject **`getAcrossAssets`** at construction (via composite **`ComponentData`**).
- **`computeDefaultMarksForRoom`**: reads room/lens bodies across the asset stack.
- **`ComponentAggregate` slice (A1, shipped):** registered on [`index.ts`](./index.ts) with **`{ ComponentData: internalCache.ComponentData, ComponentVerticals: empty-hops stub }`**; **`ComponentExamples`** composes **`ComponentAggregate`**. See [`componentAggregate.test.ts`](./componentAggregate.test.ts).

## Navigation Tips

1. **Composite router:** [`componentDataComposite.ts`](./componentDataComposite.ts)
2. **Gateway module (assetDB path):** [`packages/mtw-gateways/ts/assets/components/componentData`](../../../packages/mtw-gateways/ts/assets/components/componentData/index.ts)
3. **Improvisation pair handler:** [`packages/mtw-gateways/ts/ephemera/improvisation`](../../../packages/mtw-gateways/ts/ephemera/improvisation/)
4. **Contrast with ephemera state:** [`componentEphemeraMeta.AGENT.md`](./componentEphemeraMeta.AGENT.md)
5. **Tests:** [`componentData.test.ts`](./componentData.test.ts), [`componentDataComposite.test.ts`](./componentDataComposite.test.ts)

## Development Notes

- **Validation:** Validate **`assetId`** and universal component id before reads.
- **Batching:** Multiple pair requests for the same universal key share one **`getItems`** batch where possible (per delegate).
- **Do not** use partition **`Query`** on the universal id from Ephemera hot paths; maintenance-only exhaustive scan is a separate gateway subpath (assets/diagnostics whitelist).
