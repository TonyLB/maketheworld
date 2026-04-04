*Status: ACTIVE DRAFT - `mtw.ephemera.state` DataSource and state-domain event surface (incrementally implemented).*

## Relationship to prior plans

- **v1** (`AGENT.v1.planning.md`): Historical Room-state prototype and checklists; still useful for decisions already taken.
- **v2** (superseded in `state/`): Message-bus orchestration for render lifecycle was documented here; narrative is **folded into** [`../renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md) (see *Folded: state v2 orchestration plan*). [`AGENT.v2.planning.md`](AGENT.v2.planning.md) in this directory is a **stub** pointer.
- **v3 (this document):** Introduce a **first-class state domain** on the DataSource pattern: **`mtw.ephemera.state`**, wire **state-relevant ingress** (starting with **`api.ephemera` State Change**), later **publish** `mtw.ephemera.state` outbound events if needed, and migrate writers away from **direct** orchestration entrypoints for state-driven work.

Domain boundaries in `AGENT.md` are unchanged: **state** owns authoritative world-state on `Meta::Room` and event **publication**; **renderOrchestration** owns resolve, pointers, cache, and generation.

## Goals

1. Add an **`EphemeraDataSource`** instance with **`dataSourceKey: 'mtw.ephemera.state'`** --- **done:** [`index.ts`](./index.ts) (`replayable: false`, `publisherStrategy: 'busOnly'`).
2. Define **envelopes** for state ingress and (later) **`mtw.ephemera.state`** outbound events; grow a small **event taxonomy** without breaking subscribers.
3. Ensure **renderOrchestration** reacts to state-driven signals by normalizing to **`orchestrateRenderRequest`** / **`RenderRequested`** --- **not yet** (orchestration still ingress-only via existing `api.ephemera` render envelopes).
4. Leave a **clear seam** for **additional subscribers** (gameplay, analytics, future Features/Maps state) without forcing them through orchestration.
5. **Deprecate** ad hoc patterns where state writers call **`sendRenderRequested`** solely to refresh after state update --- migration **pending** once orchestration subscribes to the canonical path.

## Non-goals (v3 first pass)

- Full **replay** semantics for `mtw.ephemera.state` (may stay `replayable: false` initially; align with `renderOrchestration` graduation notes).
- **EventBridge**-visible public contract (unless shared infrastructure already routes internal publishes); treat **internal bus + streaming envelope shape** as the first milestone.
- Replacing **`Render Requested`** / **`Render Preview Requested`** on `api.ephemera` for **non-state** triggers (force render, preview) --- those remain valid parallel ingresses.

## Implemented so far

### `api.ephemera` ingress: **State Change**

- **Types and guards:** [`localApiEvents.ts`](../localApiEvents.ts) --- `StateChangeCommand` (`componentId`, `markState`), `isStateChangeCommand`. Default marks when none are stored use [`resolveCanonAssetStackForRoom`](./resolveAssetStackForRoom.ts) inside [`computeDefaultMarksForRoom`](./computeDefaultMarksForRoom.ts).
- **Bus API:** [`apiEphemera.ts`](../apiEphemera.ts) --- header `type: 'State Change'`, `sendStateChange`, `isEphemeraApiStateChangeEnvelope`; union `EphemeraApiSubscribedHeader` / `EphemeraApiCommandPayload` updated.
- **Tests:** [`apiEphemera.test.ts`](../apiEphemera.test.ts).

### `mtw.ephemera.state` DataSource: subscribe + persist (rooms)

- [`index.ts`](./index.ts) uses **`subscribedEventTypeGuard: isEphemeraApiStateChangeEnvelope`** and **`receiveEvents`** that dispatches to [`handleApiStateChange.ts`](./handleApiStateChange.ts). Room ids merge marks into Dynamo via [`mergePersistMetaRoomMarks`](./mergePersistMetaRoomMarks.ts); non-room **`componentId`**s are ignored for now. **Outbound:** after a successful conditional write, **`streamEvent`** publishes **`State Changed`** (see [`events.ts`](./events.ts)).
- **Next:** fan-out to **`renderOrchestration`** (subscribers on `State Changed`).

### Persist merged marks

- [`mergePersistMetaRoomMarks.ts`](./mergePersistMetaRoomMarks.ts): **`mergePersistMetaRoomMarks`** loads `Meta::Room`, merges **`incomingMarks`** onto existing `state.marks` or onto **`computeDefaultMarksForRoom`**, writes **`state`** via Dynamo (preserves **`situationId`**). Returns **`META_ROOM_MISSING`** if there is no row. Wired from **`handleApiStateChangeCommand`** for room **State Change**; no pointer-field updates in this helper. Default reads go through **`internalCache.ComponentEphemeraMeta`**; successful writes **`invalidate`** that cache entry.

## Architecture (target vs current)

### Target publish path (not fully built)

1. **Authoritative write**: State mutation commits to Dynamo (`Meta::Room` and future meta rows).
2. **Emit** (optional second channel): **`mtw.ephemera.state`** outbound envelopes for subscribers that should not depend on `api.ephemera` alone.
3. **Fan-out**: **`renderOrchestration`** and others subscribe per final design.

### Current path

1. Callers may **`sendStateChange(messageBus, streamKey, { componentId, markState })`** on the internal bus (same origin pattern as `sendPutCacheRecord`, etc.).
2. **`mtw.ephemera.state`** `receiveEvents` persists room marks via **`mergePersistMetaRoomMarks`** (no outbound `streamEvent` yet).

*Note:* Whether long-term **authoritative** state updates always originate as **`api.ephemera` State Change** vs direct Dynamo helpers is a product/wiring choice; this document treats **State Change** as the normalized API-level ingress for "proposed marks for a component."

### Subscribe path (initial) --- pending

- **`renderOrchestration`**: extend guards / **`receiveEvents`** to consume **state-driven** signals (from **`mtw.ephemera.state`** outbound and/or **`api.ephemera` State Change** after coordination) and map to **`RenderRequested`**.
- **Normalization**: Map payload -> one or more **`sendRenderRequested(...)`** (or **`orchestrateRenderRequest`**) per **observer / perspective policy**.

### Future subscribers

Design payloads so they are:

- **Stable** (version fields, explicit `componentId`, component-kind discriminator).
- **Extensible** (optional fields; prefer structured `reason` / `source` enums).

Document a **registry** in code or in this file: which event types exist, who subscribes, whether ordering is guaranteed.

## Event taxonomy (draft)

| Where | Header `type` | Payload (summary) | Status |
|-------|----------------|-------------------|--------|
| `api.ephemera` | **State Change** | `StateChangeCommand`: `componentId`, `markState` | Implemented (`localApiEvents`, `apiEphemera`) |
| `mtw.ephemera.state` | *TBD* (e.g. state-domain **State Changed** after persist) | *TBD* | Not implemented |
| *Reserved* | Future gameplay | Situation entered, Feature toggled, etc. | TBD |

Naming: use **ASCII** strings consistent with existing envelope types (`Render Requested`, `Put Cache Record`, etc.).

## Payload sketch (extensions) --- open for refinement

**Implemented (v1):** `componentId` + **`markState`** on **`api.ephemera` State Change**; default marks when none are stored use **`resolveCanonAssetStackForRoom`** (see `computeDefaultMarksForRoom`).

**Possible additions:**

- **`stateVersion`** or **`updatedAt`**: idempotency / debugging.
- **`perspectiveHints`**: optional; if absent, orchestration derives work from presence or default policy.
- **`source`**: `authoring` | `gameplay` | `system` (extensible enum).

## Migration phases (suggested)

### Phase 0: Spike

- [x] **Internal emit** of **`api.ephemera` State Change** (`sendStateChange`) + **typed guards** + tests.
- [x] **`mtw.ephemera.state`** subscribes with **`receiveEvents`** -> **`mergePersistMetaRoomMarks`** (rooms).
- [ ] **renderOrchestration** logs or handles **State Change** (or **`mtw.ephemera.state`** outbound) to prove end-to-end refresh policy.

### Phase 1: `mtw.ephemera.state` scaffold

- [x] Package **`lambda/ephemera/dataSource/state/`**, **`app.ts`** import, **`EphemeraDataSource`** instance.
- [x] **Ingress** guard for **`api.ephemera` State Change** on the state DataSource.
- [ ] **Outbound** helpers under **`mtw.ephemera.state`** (if distinct from `api.ephemera` ingress).

### Phase 2: Orchestration subscription

- [ ] **`renderOrchestration`**: consume the canonical state signal; implement **policy v1** (e.g. **`RenderRequested`** per room).
- [ ] Remove or gate duplicate **`sendRenderRequested`** from the same state-update paths.

### Phase 3: Hardening

- Tests: ordering, failure when Dynamo write succeeds but emit fails (retry? compensating event?).
- Documentation: **`AGENT.md`**, **`dataSource/renderOrchestration/AGENT.md`**, and this file for the **canonical** state-update flow.

### Phase 4: Expand event types

- Add **header.type** values and payloads as gameplay patterns land; **backward compatibility** (unknown fields ignored).

## Open decisions

1. **Package layout**: **Resolved:** `lambda/ephemera/dataSource/state/`.
2. **Ingress**: **Partially resolved:** **`api.ephemera` State Change** is the first API-level ingress. EventBridge / WebSocket normalization may wrap the same command shape later.
3. **Single vs multiple DataSource classes** if **subscribe** and **publish** need different keys (unlikely; prefer one key, multiple event types).
4. **Fan-out policy** for state signal -> **`RenderRequested`**: presence-based, all perspectives, or configurable per room --- product decision.
5. **Idempotency**: duplicate events for the same logical transition --- subscriber behavior.

## Risks

- **Double refresh** if both legacy **`sendRenderRequested`** and the new path fire for the same user action until migration completes.
- **Ordering** relative to **`RenderRequested`** from other sources --- document whether subscribers must be idempotent.
- **Cold start / import order**: `app.ts` side-effect imports must load DataSources before writers emit (usually fine in one Lambda).

## References

- `lambda/ephemera/dataSource/abstract.ts` --- `EphemeraDataSource`
- `lambda/ephemera/dataSource/apiEphemera.ts` --- `sendStateChange`, `isEphemeraApiStateChangeEnvelope`
- `lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts` --- `sendRenderRequested` envelope pattern
- [`AGENT.md`](./AGENT.md) --- domain boundaries
- `lambda/ephemera/dataSource/renderOrchestration/AGENT.md` --- orchestration scope and graduation

## Execution checklist (living)

- [x] **`api.ephemera` State Change:** `StateChangeCommand`, guards, `sendStateChange`, tests (`apiEphemera` / `localApiEvents`)
- [x] **`mtw.ephemera.state`** DataSource + `app.ts` import + **subscribe** to State Change (`receiveEvents` -> `handleApiStateChangeCommand`)
- [x] **`mergePersistMetaRoomMarks`** helper + wired from **`handleApiStateChangeCommand`** for room State Change
- [x] **`mtw.ephemera.state` outbound** `State Changed` via **`streamEvent`** ([`events.ts`](./events.ts)); types + guards
- [ ] **renderOrchestration** subscription + normalization to **`RenderRequested`**
- [ ] Migrate first state writer; remove duplicate direct orchestration trigger
- [ ] Update `AGENT.md` "active planning" pointer if v3 becomes the primary execution track for state
- [ ] Subscriber registry notes (who listens to what)
