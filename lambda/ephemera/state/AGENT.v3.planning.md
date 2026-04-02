*Status: FIRST DRAFT - `mtw.ephemera.state` DataSource and state-domain event surface.*

## Relationship to prior plans

- **v1** (`AGENT.v1.planning.md`): Historical Room-state prototype and checklists; still useful for decisions already taken.
- **v2** (`AGENT.v2.planning.md`): Message-bus orchestration for render lifecycle (`RenderRequested`, `findRender`, perception placeholders, etc.). Remains the reference for **renderOrchestration** behavior.
- **v3 (this document):** Introduce a **first-class state domain** on the DataSource pattern: **`mtw.ephemera.state`**, publish **state-domain events** (starting with **State Changed**), and migrate writers away from **direct** orchestration entrypoints for state-driven work.

Domain boundaries in `AGENT.md` are unchanged: **state** owns authoritative world-state on `Meta::Room` and event **publication**; **renderOrchestration** owns resolve, pointers, cache, and generation.

## Goals

1. Add an **`EphemeraDataSource`** instance with **`dataSourceKey: 'mtw.ephemera.state'`** (implementation home under `lambda/ephemera/dataSource/state/` or equivalent; see open decisions).
2. Define a **versioned envelope** for **State Changed** (and a small **event taxonomy** that can grow without breaking subscribers).
3. Ensure **renderOrchestration** reacts to **State Changed** by normalizing to existing **`orchestrateRenderRequest`** / **`RenderRequested`** semantics (policy: which perspectives, passive vs request-scoped, etc.).
4. Leave a **clear seam** for **additional subscribers** (gameplay, analytics, future Features/Maps state) without forcing them through orchestration.
5. **Deprecate** ad hoc patterns where state writers call **`sendRenderRequested`** or reach orchestration directly solely to "refresh after state update" --- those flows should **emit through the state domain** (or a documented exception list).

## Non-goals (v3 first pass)

- Full **replay** semantics for `mtw.ephemera.state` (may stay `replayable: false` initially; align with `renderOrchestration` graduation notes).
- **EventBridge**-visible public contract (unless shared infrastructure already routes internal publishes); treat **internal bus + streaming envelope shape** as the first milestone.
- Replacing **`Render Requested`** / **`Render Preview Requested`** on `api.ephemera` for **non-state** triggers (force render, preview) --- those remain valid parallel ingresses.

## Architecture (target)

### Publish path

1. **Authoritative write**: State mutation commits to Dynamo (`Meta::Room` and future meta rows) using existing patterns.
2. **Emit**: After successful persistence (or in the same logical transaction boundary your stack supports), the state pipeline publishes a **State Changed** envelope on the internal message bus using the same **streaming envelope** conventions as other DataSources (`dataSourceKey`, `streamKey`, `header.type`, `getContent`).
3. **Fan-out**: Subscribers **receiveEvents** on `mtw.ephemera.state` **outbound** routing --- or, if the framework only supports subscribe-to-ingress for cross-domain, document the **bridge** pattern (see open decisions).

*Note:* Exact wiring depends on how `@tonylb/mtw-lambda-patterns` `DataSource` exposes **publish vs subscribe** for internal origin. v3 execution should start by **spiking** one end-to-end path (State Changed emitted from a test hook -> renderOrchestration handler runs).

### Subscribe path (initial)

- **`renderOrchestration`**: Extend **`subscribedEventTypeGuard`** / **`receiveEvents`** (or add a thin adapter module) so orchestration **consumes** `mtw.ephemera.state` **State Changed** in addition to existing **`api.ephemera`** render ingress.
- **Normalization**: Map **State Changed** payload -> one or more **`sendRenderRequested(...)`** calls (or direct **`orchestrateRenderRequest`** with constructed **`RenderRequested`**) according to **observer / perspective policy** (to be specified; may start with a single passive render for the affected room).

### Future subscribers

Design **State Changed** (and later event types) so payloads are:

- **Stable** (version fields, explicit `componentId`, component-kind discriminator).
- **Extensible** (optional fields, avoid boolean soup --- prefer structured `reason` / `source` enums).

Document a **registry** in code or in this file: which event types exist, who subscribes, whether ordering is guaranteed.

## Event taxonomy (draft)

| Event (header.type) | Purpose | First subscriber |
|---------------------|---------|------------------|
| **State Changed** | Authoritative world-state for a component changed after persistence | `renderOrchestration` (normalize to render pipeline) |
| *Reserved* | Future: Situation entered, Feature toggled, Map layer delta, etc. | TBD |

Naming: use **ASCII** strings consistent with existing envelope types (`Render Requested`, etc.).

## Payload sketch (State Changed) --- open for refinement

Minimum useful fields (illustrative, not a commitment):

- **`componentId`**: `EphemeraRoomId` initially; later union with Feature/Map ids.
- **`stateVersion`** or **`updatedAt`**: for idempotency / debugging.
- **`perspectiveHints`**: optional; if absent, orchestration derives work from presence or a default policy.
- **`source`**: `authoring` | `gameplay` | `system` (extensible enum).

Avoid duplicating full **`markState`** in the envelope if it is always readable from `Meta::Room` after write --- unless subscribers need it without another read (latency / cost trade).

## Migration phases (suggested)

### Phase 0: Spike

- One **test-only** or **dev-only** emit of **State Changed** after a controlled `Meta::Room` update; **renderOrchestration** logs or runs a no-op handler to prove subscription wiring.

### Phase 1: `mtw.ephemera.state` scaffold

- New package: `lambda/ephemera/dataSource/state/` (or `lambda/ephemera/state/dataSource/` --- decide; see open decisions).
- `EphemeraDataSource` instance, **`subscribe()`** side-effect import from `app.ts` alongside other DataSources.
- Typed guards for ingress (if state **ingress** is API-driven) and/or **internal publish helpers** (`sendStateChanged` mirroring `sendRenderRequested` style).

### Phase 2: Orchestration subscription

- **`renderOrchestration`**: consume **State Changed**, implement **policy v1** (e.g. single **`RenderRequested`** per room with update-scoped targets TBD).
- Remove or gate **duplicate** **`sendRenderRequested`** calls from the same state-update code paths.

### Phase 3: Hardening

- Tests: envelope round-trip, ordering assumptions, failure when Dynamo write succeeds but emit fails (retry? compensating event?).
- Documentation: **`AGENT.md`**, **`dataSource/renderOrchestration/AGENT.md`**, and this file updated to describe the **canonical** state-update flow.

### Phase 4: Expand event types

- Add new **header.type** values and payloads under **`mtw.ephemera.state`** as gameplay patterns land; keep **backward compatibility** rules (unknown fields ignored).

## Open decisions

1. **Package layout**: `dataSource/state/` (symmetric with `renderOrchestration`) vs colocated under `lambda/ephemera/state/dataSource/`.
2. **Ingress**: Does **`mtw.ephemera.state`** receive **only** internal publishes, or also **EventBridge / WebSocket** normalization for authoring? (May be incremental.)
3. **Single vs multiple DataSource classes** if **subscribe** and **publish** need different keys (unlikely; prefer one key, multiple event types).
4. **Fan-out policy** for **State Changed** -> **`RenderRequested`**: presence-based, all perspectives, or configurable per room --- product decision.
5. **Idempotency**: duplicate **State Changed** events for the same logical transition --- subscriber behavior.

## Risks

- **Double refresh** if both legacy **`sendRenderRequested`** and **State Changed** fire for the same user action until migration completes.
- **Ordering** relative to **`RenderRequested`** from other sources --- document whether subscribers must be idempotent.
- **Cold start / import order**: `app.ts` side-effect imports must load **state** DataSource before writers emit (usually fine in one Lambda).

## References

- `lambda/ephemera/dataSource/abstract.ts` --- `EphemeraDataSource`
- `lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts` --- `sendRenderRequested` envelope pattern
- `lambda/ephemera/state/AGENT.md` --- domain boundaries
- `lambda/ephemera/dataSource/renderOrchestration/AGENT.md` --- orchestration scope and graduation

## Execution checklist (living)

- [ ] Spike: internal **State Changed** emit + orchestration receipt
- [ ] `mtw.ephemera.state` DataSource scaffold + `app.ts` import
- [ ] Typed **State Changed** command + serializer/guards
- [ ] **renderOrchestration** subscription + normalization to **`RenderRequested`**
- [ ] Migrate first state writer; remove duplicate direct orchestration trigger
- [ ] Update `AGENT.md` "active planning" pointer if v3 becomes the primary execution track for state
- [ ] Add tests and subscriber registry notes
