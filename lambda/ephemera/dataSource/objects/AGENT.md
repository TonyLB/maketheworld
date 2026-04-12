*Status: Phase 1 shipped --- bus-only **`mtw.ephemera.objects`**; room-only **`Meta::Room.objects`**; perception wiring is phase 2 (see task plan).*

## Overview

This package owns **runtime object handle lists** for rooms: stored on ephemera **`Meta::Room`** as **`objects: string[]`** (optional; missing treated as empty when patching). Symmetric to **`mtw.ephemera.state`** but a separate **`dataSourceKey`** so future kinds are not implied to be room-only.

**Ingress:** Internal **`api.ephemera`** header **`Objects Change`** (`sendObjectsChange` in [`../apiEphemera.ts`](../apiEphemera.ts)); payload **`ObjectsChangeCommand`** in [`../localApiEvents.ts`](../localApiEvents.ts). No **`requestId`** / **`ReturnValue`** (v1).

**Persist:** [`mergePersistMetaRoomObjects.ts`](mergePersistMetaRoomObjects.ts) --- multiset merge (`add` / `remove`), **`ephemeraDB.optimisticUpdate`** with **`updateKeys: ['objects']`**, then **`internalCache.ComponentEphemeraMeta.invalidate(roomId)`**.

**Handler + outbound:** [`handleApiObjectsChange.ts`](handleApiObjectsChange.ts) --- non-room **`componentId`** no-op; on successful persist, **`streamEvent`** with **`Objects Changed`** (typed payload in [`events.ts`](events.ts)).

**Registration:** [`index.ts`](index.ts) --- **`EphemeraDataSource`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`**. **`app.ts`** imports **`./dataSource/objects`** **above** **`./dataSource/state`** so subscribe order is objects before state.

## Planning

- **Phase 1 / phase 2 tracking:** [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md)
- **Shared `Meta::Room` row vs domains:** [`../AGENT.multiChannel.contract.md`](../AGENT.multiChannel.contract.md)
