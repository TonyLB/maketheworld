# Object Ephemera Meta Cache - Agent Navigation Guide

## Overview

`ObjectEphemeraMetaData` is a read-through cache for **ephemeraDB** `Meta::Object` rows: Coyote play meta (`stableKey`, trope fields) for improvisational **`OBJECT#`** ids. Distinct from [`ComponentEphemeraMeta`](./componentEphemeraMeta.AGENT.md) (`Meta::Room`) and from [`ImprovisationComponentData`](../../packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md) (merge body on `(OBJECT#, ASSET#IMPROVISATION)`).

## API

- **`get(objectId)`** -- Loads `EphemeraMetaObject | undefined` from cache or `ephemeraDB.getItem` (`getAllFields: true`). Caches hits and misses.
- **`invalidate(objectId)`** -- Drop cached entry after any successful write to `Meta::Object` for that `EphemeraId`.
- **`set(objectId, value)`** -- Test helper (`undefined` removes key).
- **`clear()`** -- Clears all entries; invoked from `InternalCache.clear()`.

## Invalidation contract

Any code path that **writes** or **deletes** `Meta::Object` in ephemeraDB must call `internalCache.ObjectEphemeraMeta.invalidate(objectId)` after success (or `set` to memo-patch after spawn). See [`invalidateImprovisationObjectCaches.ts`](../dataSource/objects/invalidateImprovisationObjectCaches.ts).

## Related

- Improvisation pair cache: [`packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md`](../../../packages/mtw-gateways/ts/ephemera/improvisation/AGENT.md)
- Persist coordinators: [`../dataSource/objects/persistImprovisationObject.ts`](../dataSource/objects/persistImprovisationObject.ts)
- Room meta sibling: [`componentEphemeraMeta.AGENT.md`](./componentEphemeraMeta.AGENT.md)

## Navigation

See [`AGENT.md`](./AGENT.md) for general internalCache patterns.
