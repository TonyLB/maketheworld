*Status: Phase 1 shipped --- bus-only **`mtw.ephemera.objects`**; room-only **`Meta::Room.objects`**; Phase 2 perception wiring shipped (**`Objects Changed`** subscribed by **`mtw.ephemera.perception`**; affordance **`PublishMessage`** per [`../perception/publishRoomAffordancePerceptionMessages.ts`](../perception/publishRoomAffordancePerceptionMessages.ts)).*

## Overview

This package owns **runtime object lists** for rooms: stored on ephemera **`Meta::Room`** as **`objects?: { uuid: OBJECT#...; shortName: string }[]`** (optional; missing treated as empty when patching). Symmetric to **`mtw.ephemera.state`** but a separate **`dataSourceKey`** so future kinds are not implied to be room-only.

**Ingress:** Internal **`api.ephemera`** header **`Objects Change`** (`sendObjectsChange` in [`../apiEphemera.ts`](../apiEphemera.ts)); payload **`ObjectsChangeCommand`** in [`../localApiEvents.ts`](../localApiEvents.ts): **`add`** is **`EphemeraMetaRoomObject[]`**, **`remove`** is **`OBJECT#...` ids**. No **`requestId`** / **`ReturnValue`** (v1).

**Merge semantics:** Drop every stored row whose **`uuid`** is in **`remove`**. For each **`add`** entry in order, remove any existing row with the same **`uuid`**, then append (upsert + move-to-end; last duplicate **`uuid`** in **`add`** wins).

**Persist:** [`mergePersistMetaRoomObjects.ts`](mergePersistMetaRoomObjects.ts) --- **`mergeMetaRoomObjects`**, **`ephemeraDB.optimisticUpdate`** with **`updateKeys: ['objects']`**, then **`internalCache.ComponentEphemeraMeta.invalidate(roomId)`**.

**Handler + outbound:** [`handleApiObjectsChange.ts`](handleApiObjectsChange.ts) --- non-room **`componentId`** no-op; on successful persist, **`streamEvent`** with **`Objects Changed`** (typed payload in [`events.ts`](events.ts): **`priorObjects`** / **`newObjects`** mirror the stored shape). **`mtw.ephemera.perception`** consumes that stream and publishes affordance **`PerceptionMessage`** rows (**`publishRoomAffordancePerceptionMessages`**).

**Registration:** [`index.ts`](index.ts) --- **`EphemeraDataSource`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`**. **`app.ts`** imports **`./dataSource/objects`** **above** **`./dataSource/state`** so subscribe order is objects before state.

## Planning

- **Phase 1 / phase 2 tracking:** [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md)
- **Shared `Meta::Room` row vs domains:** [`../AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md)
