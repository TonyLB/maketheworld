*Status: Draft - runtime world-state helpers and types; orchestration lives under `dataSource/renderOrchestration`.*

## Overview

The `lambda/ephemera/state` module owns the **runtime world-state model** for Ephemera: canonical **marks** (and related fields) for Rooms, how they are stored on `Meta::Room`, and **helpers** to derive defaults and merge WML across the asset stack (`computeDefaultMarksForRoom`, stack merge helpers, and the partial `getOrStartRoomRenderForState` scaffold).

**In scope here**

- Authoritative **`Meta::Room.state`** (e.g. `state.marks`, optional `situationId`) as the room's current world-state snapshot.
- **Default mark derivation** and asset-stack merge logic used to populate or interpret that state.

**Out of scope here** (see `lambda/ephemera/dataSource/renderOrchestration/AGENT.md` and code there)

- **Cache pointer** fields on `Meta::Room` (`currentCacheId`, `currentCacheByPerspective`) — they may appear on the same Dynamo row, but **validation, clearing, and updates** are owned by **render orchestration** (`requestIntake`, `findRender`, etc.), not by this module.
- **Invalidation** in the sense of **`RenderInvalidate`**, pointer repair, exact-match vs generation, and perception delivery of placeholders/finals.

State **mutates** authoritative marks when product/API code updates room state; orchestration **resolves** those marks against `renderCache` and maintains pointer fields as part of that pipeline.

## Versioning and planning

- **Active planning:** `AGENT.v2.planning.md`
- **Historical v1 decisions and checklists:** `AGENT.v1.planning.md`
