*Status: Draft - runtime world-state helpers and `mtw.ephemera.state` DataSource; orchestration lives under `dataSource/renderOrchestration`.*

## Overview

The `lambda/ephemera/dataSource/state` package owns the **runtime world-state model** for Ephemera: canonical **marks** (and related fields) for Rooms, how they are stored on `Meta::Room`, and **helpers** to derive defaults and merge WML across the asset stack (`computeDefaultMarksForRoom`, stack merge helpers, and the partial `getOrStartRoomRenderForState` scaffold).

**Persist merged marks:** [`mergePersistMetaRoomMarks.ts`](mergePersistMetaRoomMarks.ts) --- `mergeMarkState` / `mergePersistMetaRoomMarks` merge incoming `EphemeraCacheMarkState` onto stored `Meta::Room.state.marks` (or onto `computeDefaultMarksForRoom` when stored marks are empty), then `optimisticUpdate` `state` on `Meta::Room`. Wired from `mtw.ephemera.state` [`index.ts`](index.ts) via [`handleApiStateChange.ts`](handleApiStateChange.ts) on api.ephemera **State Change** (room `componentId` + `markState`). Default marks use server-side stack resolution (`resolveCanonAssetStackForRoom` inside `computeDefaultMarksForRoom`). Does not update cache pointer fields.

**In scope here**

- Authoritative **`Meta::Room.state`** (e.g. `state.marks`, optional `situationId`) as the room's current world-state snapshot.
- **Default mark derivation** and asset-stack merge logic used to populate or interpret that state.

**Out of scope here** (see `lambda/ephemera/dataSource/renderOrchestration/AGENT.md` and code there)

- **Cache pointer** fields on `Meta::Room` (`currentCacheId`, `currentCacheByPerspective`) — they may appear on the same Dynamo row, but **validation, clearing, and updates** are owned by **render orchestration** (`requestIntake`, `findRender`, etc.), not by this module.
- **Invalidation** in the sense of **`RenderInvalidate`**, pointer repair, exact-match vs generation, and perception delivery of placeholders/finals.

State **mutates** authoritative marks when product/API code updates room state; orchestration **resolves** those marks against `renderCache` and maintains pointer fields as part of that pipeline.

## Versioning and planning

- **`mtw.ephemera.state` DataSource migration (draft):** `AGENT.v3.planning.md`
- **Render orchestration cascade (v2):** canonical plan in [`../renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md) (v2 narrative folded there); [`AGENT.v2.planning.md`](AGENT.v2.planning.md) is a stub pointer
- **Historical v1 decisions and checklists:** `AGENT.v1.planning.md`
