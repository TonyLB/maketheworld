## Overview

`lambda/ephemera/renderOrchestration/` owns the **render lifecycle orchestration** layer for Ephemera.

This module exists to keep policy and multi-step lifecycle logic out of:

- `renderCache` (which should remain a data/cache primitive layer)
- `state` (which should remain the owner of world-state storage and invariants)
- `perception` (which should remain the owner of enrichment and message delivery)

In v2, `renderOrchestration` is implemented as a **messageBus-driven event cascade**. It publishes early feedback events (so clients can show "Generating..." immediately) and later publishes completion/ready events when a cache-backed render is available.

Important: the lifecycle events are primarily motivated by presence-based delivery (via `perception`). The authoring preview wedge (`generateRoomPreview`) is intentionally direct-to-requester and streams `ConversationStep` messages via `conversations`, so it may not exercise `RenderGenerationStarted` / `RenderReady` even when those are the correct long-term contracts. For the rationale and acceptance criteria split (preview-aligned vs presence-aligned), see `AGENT.planning.md` in this directory.

## Core Purpose

`renderOrchestration` is responsible for:

- **Lifecycle policy**: decide what to do when a render is requested or when state changes.
- **Cache decisioning**: fast path via `Meta::Room.currentCacheId`, then slow path exact-match lookup.
- **Generation orchestration**: on cache miss, start generation and publish early feedback before generation completes.
- **Completion handoff**: when generation completes, update pointers (e.g. `Meta::Room.currentCacheId`) and publish ready events.
- **Decoupled signaling**: publish well-scoped internal events so perception can react without coupling to generation internals.

Current temporary constraint: passive **intake** (`intakeRenderRequested`) surfaces missing `Meta::Room.state.marks` as `marks_missing`; the **shell** (`orchestratePassiveRenderRequestedBatch`) maps that to bus `RenderError` (no defaults invented in intake). See `AGENT.planning.md`.

## Technical Details

### Key concepts

- **Component render lifecycle events**: messageBus events such as `RenderRequested`, `RenderGenerationStarted`, `RenderReady`, etc.
- **Request-scoped vs update-scoped targeting**:
  - Request-scoped events include `characterId` for direct requester feedback.
  - Update-scoped events may omit explicit targets; downstream perception derives targets from room presence/subscriptions at publish time.
- **Perspective**: ordered asset stack context used for cache matching.
- **Cache-required policy (Rooms, v2)**: state-driven Room updates should not silently fall back to legacy room rendering.

### Scope (v2)

- **Rooms first**: v2 focuses on Rooms. The event contract is generic (`componentId`) so the same lifecycle can extend to Maps/Features later.
- **Passive vs active updates**:
  - Rooms/Maps may require passive updates (presence-driven).
  - Features/Knowledge are generally active-request-driven (no passive room-wide updates).

## Integration Points

### Dependencies

- **Message bus**: `lambda/ephemera/messageBus/` is the execution engine for the cascade.
- **State storage**: `Meta::Room` (`packages/mtw-interfaces/ts/ephemeraMeta.ts` + ephemeraDB).
- **Cache primitives**: `lambda/ephemera/renderCache/` (record types, mark helpers, exact match via `internalCache.RenderCache`). LLM generation: `lambda/ephemera/generateExample/`.
- **Perception**: `lambda/ephemera/perception/` subscribes to orchestration lifecycle events to send placeholder and final messages.

### Cross-references

- v2 planning: `../state/AGENT.v2.planning.md`
- v1 historical record: `../state/AGENT.v1.planning.md`
- messageBus overview: `../messageBus/AGENT.md`
- perception overview: `../perception/AGENT.md`
- renderCache overview: `../renderCache/AGENT.md`

## Usage Patterns

### Typical scenario (Room render lifecycle)

1. A trigger occurs (authoring state dashboard request, room update, explicit look).
2. A caller publishes `RenderRequested` with:
   - `componentId` (Room id)
   - request-scoped `characterId` when applicable
   - `perspective`
3. `renderOrchestration` handles `RenderRequested` and cascade handlers:
   - attempt fast-path cache pointer, else exact-match lookup
   - on miss with generation allowed: publish `RenderGenerationStarted` immediately, then start generation
   - on completion: update cache pointer and publish `RenderReady`
4. `perception` reacts:
   - placeholder header on `RenderGenerationStarted`
   - final header/full content on `RenderReady`

## Navigation Tips

### Getting started

1. Read the active plan: `AGENT.planning.md` (this directory).
2. Read state v2 plan: `../state/AGENT.v2.planning.md` (system-level plan).
3. Review messageBus patterns: `../messageBus/baseClasses.ts` and `../messageBus/index.ts`.
4. Review perception placeholders: `../perception/index.ts` (look for `sendRoomGeneratingHeader`).
5. Review cache primitives: `../renderCache/markStateUtils.ts`. Room cache-miss orchestration: `generateRoomPreview.ts` (this directory). LLM generation: `../generateExample/`.

### Key files

- `events.ts`: messageBus event type definitions and type guards
- `requestIntake.ts`: passive A-phase only (`intakeRenderRequested`)
- `orchestrationHandler.ts`: single-item `orchestrateRenderRequest` (preview + passive; intake -> `deliverIntakeErrorsIfAny` -> `findRender` -> conversation `sendMessage`)
- `index.ts`: messageBus registration; `handleRenderOrchestrationMessage` maps each `RenderRequested` / `RenderPreviewRequested` to `orchestrateRenderRequest`
- `generateRoomPreview.ts`: room cache-miss orchestration (exact match, then `generateExample` on miss; used by WebSocket API)

## Development Notes

### Current state

- `renderOrchestration` is being introduced in v2; v1 work focused on foundations and helper primitives.

### Design intent

- Keep `renderCache` free of message delivery logic.
- Keep `state` free of multi-step orchestration and UI feedback responsibilities.
- Keep `perception` focused on enrichment + delivery, subscribing to lifecycle events.

