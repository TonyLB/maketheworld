# mtw.ephemera.renderOrchestration (evolving)

## Status

**Transitional** here means **on the path to** a canonical DataSource-shaped home for render orchestration --- not "stay as small as possible until deleted."

This package is the **implementation home** for the `mtw.ephemera.renderOrchestration` data domain: subscription, ingress normalization, `orchestrateRenderRequest`, intake, `findRender`, and `generateRoomPreview`. Long-form planning lives alongside code: `AGENT.planning.md`, `AGENT.planning.simplification.md`.

**What is immature (not what "transitional" means):** replay policy, EventBridge surface, and authoritative outbound streaming contracts are not finished. Those gaps are why the module is not yet **graduated** --- not because domain logic must forever live elsewhere.

## Why this layer exists

Orchestration keeps **policy and multi-step lifecycle sequencing** out of neighboring packages:

- **`renderCache`** stays a cache primitive layer (types, mark helpers, exact match, persistence helpers).
- **`state`** stays the owner of world-state storage and invariants (`Meta::Room`, etc.).
- **`perception`** stays the owner of enrichment and **presence-driven** message delivery.

## What it does today

- Subscribes to internal `api.ephemera` streaming envelopes:
  - `Render Requested`
  - `Render Preview Requested`
- Converts those ingress payloads into existing render request payloads (`RenderRequested` / `RenderPreviewRequested`).
- Dispatches to `orchestrationHandler.ts` (`orchestrateRenderRequest`), which chains **intake** (`requestIntake.ts`), **intake error delivery** (`intakeErrors.ts`), **`findRender`**, and (on cache miss) **`generateRoomPreview`**, with terminals and progress delivered through **conversation** `sendMessage` handles where registered.

Wiring: `app.ts` side-effect imports `./dataSource/renderOrchestration` (this DataSource's `index.ts`).

## Preview vs presence (product split)

Lifecycle messages (`RenderGenerationStarted`, `RenderReady`, etc.) are primarily motivated by **presence-based** delivery: **`perception`** can react with placeholders and final content for people **in the room**.

The **authoring preview** path (`RenderPreviewRequested`) is intentionally **request-scoped**: it streams **`ConversationStep`** via **`conversations`** to the requesting client and may **not** exercise the same lifecycle events even when those are the long-term abstraction. Bridging preview UX to the full lifecycle story is **future-facing**; see `AGENT.planning.md` in this directory for task-level detail.

## Key concepts

- **Component render lifecycle events**: messageBus-typed events such as `RenderRequested`, `RenderGenerationStarted`, `RenderReady` (definitions in `events.ts`).
- **Request-scoped vs update-scoped targeting**:
  - Request-scoped traffic often carries **`characterId`** for direct requester feedback.
  - Update-scoped traffic may omit explicit targets; **`perception`** can derive recipients from room presence at publish time.
- **Perspective**: ordered asset stack used for cache matching (`computePerspectiveKey`, matchers on cache rows).
- **Rooms first (v2)**: event shapes use generic **`componentId`** so the same lifecycle can extend to Maps/Features later. Passive vs **active** update patterns differ by domain (see planning docs).

## Dependencies (where to read next)

- **Message bus**: `lambda/ephemera/messageBus/` --- internal lifecycle publishes; render **request** ingress is this DataSource, not a dedicated `registerRenderOrchestration` hook in `messageBus/index.ts`.
- **State storage**: `Meta::Room` (`packages/mtw-interfaces/ts/ephemeraMeta.ts` + ephemeraDB).
- **Cache**: `lambda/ephemera/renderCache/` and `internalCache.RenderCache` for exact match and memoized rows.
- **LLM generation**: `lambda/ephemera/generateExample/` (invoked from `generateRoomPreview` on cache miss).
- **Conversations**: preview and passive room render use conversation composite handles for **`sendMessage`** (see `orchestrationHandler.ts`).
- **Perception**: `lambda/ephemera/perception/` --- placeholder/final delivery for presence-oriented paths as lifecycle work matures.

## Typical request flow (single-item)

1. A trigger emits an `api.ephemera` envelope; this DataSource maps it to `RenderRequested` or `RenderPreviewRequested` and calls **`orchestrateRenderRequest`**.
2. **A-phase**: **`intakeRenderRequested`** loads `Meta::Room` where needed and produces **`RenderResolveInput`** (or intake errors).
3. **B-phase**: **`findRender`** tries pointer validation, then exact match, then **`generateRoomPreview`** when allowed; outcomes are delivered through the injected **`sendMessage`** path (conversation handle when present).
4. **Full lifecycle** (`RenderGenerationStarted` / `RenderReady` / perception reactions) is **not** uniformly wired for every path today; tightening that contract is part of **graduation** and open tasks in `AGENT.planning.md`.

Passive **intake** surfaces missing `Meta::Room.state.marks` as an intake error (no defaults invented in intake). Mapping that to user-visible errors is handled in orchestration and conversation layers; see planning docs for batch vs single-item history.

## Design intent

- Keep **message delivery** out of `renderCache` (cache stays a data primitive).
- Keep **multi-step orchestration** out of `state` (state owns persistence and invariants).
- Keep **`perception`** focused on enrichment and delivery, consuming lifecycle signals as those contracts stabilize.

## Current constraints (until graduation)

- **Internal-only**: no EventBridge ingress/egress contract is defined yet.
- **Non-replayable**: `replayable: false` until replay semantics are defined.
- **Contract incomplete**: no authoritative outbound event-stream contract is established yet; conversation and messageBus side effects still flow through this orchestration package for much of the pipeline.

These describe **readiness**, not a rule against growing this package.

## Copying this module elsewhere (warning)

Do **not** copy **today's** snapshot as a template for unrelated DataSource work without reading the **graduation** section below. The unfinished pieces (replay, publish semantics) are exactly what we are iterating on.

Conversely, **this directory is allowed to grow** into the canonical implementation of render orchestration as those pieces land --- the warning is about **blind copy-paste**, not about **choosing** to consolidate orchestration here.

## Graduation (dropping the transitional label)

Declare the module **graduated** when all of the following are true:

1. Render orchestration publishes authoritative lifecycle/update events as first-class outputs.
2. Conversation-specific side effects are no longer the primary contract surface.
3. Event contracts for producers/consumers are stabilized and documented as durable.
4. The module can be cited as precedent for similar DataSource domains without special caveats.

Until then, keep calling the status **transitional** in the sense of **evolving**, not **disposable edge adapter only**.

## Related docs

**Implementation (this tree)**

- `orchestrationHandler.ts` --- `orchestrateRenderRequest`
- `events.ts`, `baseClasses.ts` --- bus types and resolve shapes
- `requestIntake.ts`, `intakeErrors.ts`, `findRender.ts`, `generateRoomPreview.ts`

**Planning (this directory)**

- `AGENT.planning.md` --- v2 tasks, wiring tables, integration status
- `AGENT.planning.simplification.md` --- parallel tracks, declutter, exit criteria

**Ephemera module overviews**

- `lambda/ephemera/dataSource/state/AGENT.v2.planning.md` (system-level v2 plan)
- `lambda/ephemera/messageBus/AGENT.md`
- `lambda/ephemera/perception/AGENT.md`
- `lambda/ephemera/renderCache/AGENT.md`
- `lambda/ephemera/conversations/` (preview and room-state render handles)
