# Component Ephemera Meta Cache - Agent Navigation Guide

## Overview

`ComponentEphemeraMetaData` is a read-through cache for **ephemeraDB** rows that hold component-scoped **current-state** metadata, distinct from [`ComponentAssetMeta`](./componentAssetMeta.AGENT.md) (assetDB blueprint / WML `StandardComponent` data).

**v1 scope:** `Meta::Room` only. Values use the shared type [`EphemeraMetaRoom`](../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`DataCategory: 'Meta::Room'`).

**Future:** Additional `Meta::*` kinds (Feature, Map, etc.) may add branches or a discriminated union on `ComponentEphemeraMetaItem`; extend Dynamo types in `mtw-interfaces` first, then this cache.

## API

- **`get(roomId)`** -- Loads `EphemeraMetaRoom | undefined` from cache or `ephemeraDB.getItem` (`getAllFields: true`). Caches both hits and misses (miss cached as absence) so repeated reads do not hammer Dynamo.
- **`invalidate(roomId)`** -- Drop cached entry for that room (call after any successful write to `Meta::Room` for that `EphemeraId`).
- **`set(roomId, value)`** -- Test helper to seed or clear cached entries (`undefined` removes key).
- **`clear()`** -- Clears all entries; invoked from `InternalCache.clear()`.

Invalidation does **not** flush writes; there is no `flush()` (no write-behind).

## Invalidation contract

Any code path that **writes** `Meta::Room` in ephemeraDB must call `internalCache.ComponentEphemeraMeta.invalidate(roomId)` after success.

`RoomCharacterList` is a separate derived cache over `activeCharacters`. When a writer updates `activeCharacters` and already calls `RoomCharacterList.set` with fresh data, invalidating `RoomCharacterList` is unnecessary. When a writer only changes other fields (e.g. `state.marks`, `currentCacheByPerspective`), invalidate only `ComponentEphemeraMeta`.

## Related

- State merge: [`mergePersistMetaRoomMarks.ts`](../dataSource/state/mergePersistMetaRoomMarks.ts)
- Objects merge (`Meta::Room.objects`): [`mergePersistMetaRoomObjects.ts`](../dataSource/objects/mergePersistMetaRoomObjects.ts); DataSource **`mtw.ephemera.objects`** --- [`../dataSource/objects/AGENT.md`](../dataSource/objects/AGENT.md)
- Render intake/orchestration: [`requestIntake.ts`](../dataSource/renderOrchestration/requestIntake.ts), [`orchestrationHandler.ts`](../dataSource/renderOrchestration/orchestrationHandler.ts)
- Movement / disconnect: [`moveCharacter/index.ts`](../moveCharacter/index.ts), [`disconnectMessage/index.ts`](../disconnectMessage/index.ts)

## Navigation

See [`AGENT.md`](./AGENT.md) for general internalCache patterns.
