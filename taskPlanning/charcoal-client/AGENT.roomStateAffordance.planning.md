# Room state affordance (Workbench authoring)

**Status: Not started** --- add an authoring affordance in charcoal-client that calls the existing **`ephemeraStateChange`** WebSocket API to merge runtime **marks** into **`Meta::Room.state`** for a room during Room edit.

This document follows [`taskPlanning/AGENT.md`](../AGENT.md) (task-only content; link durable architecture in package and lambda docs instead of copying it).

---

## Getting Started

1. **Read [`taskPlanning/AGENT.md`](../AGENT.md)**  
   - **Why:** Sets expectations for what belongs here versus `AGENT.md` next to code, checkbox conventions, and retiring the plan when done.

2. **Read [`AGENT.development.md`](AGENT.development.md)**  
   - **Why:** Exact **Vitest** commands for `charcoal-client` (not Jest). Use it for verification instead of embedding runner flags that drift.

3. **Server contract (marks merge path)**  
   - **Why:** The UI sends **proposed** `markState`; the lambda merges onto stored or default marks and may stream **`State Changed`**. Skim [`lambda/ephemera/dataSource/state/AGENT.md`](../../lambda/ephemera/dataSource/state/AGENT.md) and the active draft [`lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md`](../../lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md).

4. **Wire types**  
   - **Why:** Request shape is fixed in [`packages/mtw-interfaces/ts/ephemera.ts`](../../packages/mtw-interfaces/ts/ephemera.ts) (`EphemeraApiStateChangeRequest`: `message: 'ephemeraStateChange'`, `componentId`, `markState`). **`markState`** is [`EphemeraCacheMarkState`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) (`markValue` array of `{ mark, value }`).

5. **Client dispatch pattern**  
   - **Why:** Imperative ephemera calls use [`charcoal-client/src/slices/lifeLine/index.api.ts`](../../charcoal-client/src/slices/lifeLine/index.api.ts) **`socketDispatch`** / **`socketDispatchPromise`** with optional **`RequestId`** for **`ReturnValue`** correlation (success: **`EphemeraCommandSuccess`** with `command: 'stateChange'`).

6. **Workbench integration surface**  
   - **Why:** Room authoring UI lives under [`charcoal-client/src/components/Workbench/RoomEdit/`](../../charcoal-client/src/components/Workbench/RoomEdit/). Related long-term UX notes (modes, transitions) are in [`AGENT.roomEdit.refactor.planning.md`](../../charcoal-client/src/components/Workbench/RoomEdit/AGENT.roomEdit.refactor.planning.md); this task plan is the **tracked deliverable** for the runtime-state affordance only.

---

## Goals

- Expose a **controlled** way for authors to submit **`ephemeraStateChange`** from **Room edit** using the **workbench room component id** as **`componentId`** --- it **is** the ephemera **`ROOM#...`** key (no separate client mapping or deploy preflight; see **Decided**).
- **Editor:** For **each mark** declared on this room's **Lens**, provide a way to set its **runtime value** (see **Decided**); this does not replace WML authoring of the Lens itself (see **Non-goals**).
- Surface **success and failure** via the **ack-only** path: correlated **`RequestId`** **`ReturnValue`** handling (toast or inline messaging is fine); treat **`META_ROOM_MISSING`** and validation errors as user-visible feedback. **Live read-back** of **`Meta::Room.state.marks`** is **not** required in this iteration (see **Decided** below).
- Add **tests** aligned with [`charcoal-client/AGENT.testing.md`](../../charcoal-client/AGENT.testing.md) (thunks/helpers with mocks; RTL if UI warrants it).

---

## Non-goals

- Subscribing to **`mtw.ephemera.state`** on the client, adding a DataSource slice for it, or using **`fetchEphemera`** (or similar) to display **current** marks after edit --- deferred past this task. See **Decided** for how we document the future path in code comments.
- Publishing **`mtw.ephemera.state`** to **EventBridge** (not done today); any future **external** subscribe story depends on that server-side wiring and is out of scope here.
- Changing lambda **merge**, **render orchestration**, or **pointer** semantics; those stay documented in lambda `AGENT.md` files.
- Replacing or duplicating **WML/asset** authoring of Lens marks; this affordance targets **runtime ephemera state** manipulation for authoring/debug workflows.

---

## Decided

- **Read-back (v1):** **Ack-only** feedback is **in scope**. No client subscription to **`mtw.ephemera.state`** and no live display of persisted marks from the stream in this iteration.
- **Future path (documentation in code):** When wiring the affordance, add **brief comments at the relevant integration points** (thunk, Room edit section, or both) stating that a later iteration could **subscribe** to **`mtw.ephemera.state`** for read-back. Note in those comments that **`mtw.ephemera.state`** is **not** currently **published to EventBridge**, so a robust subscribe story would imply **that publish step** (and downstream consumption) as prior work --- align with [`lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md`](../../lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md) non-goals around EventBridge until product chooses otherwise.
- **Visibility / placement:** Ship the affordance inside Room edit **Advanced** (collapsible **Advanced** section alongside the rest of Room edit). **Do not** hide it behind a **feature flag** or **role** gate for v1 --- it is advanced-surface only, not permission-gated.
- **Room / component id:** The workbench **room universal id** is the ephemera **`ROOM#...`** **`componentId`** **by construction** --- use it directly on **`ephemeraStateChange`**. **Do not** add extra client-side validation or "is this deployed?" preflight before send; the lambda (`handleApiStateChange`, **`mergePersistMetaRoomMarks`**) remains authoritative (e.g. **`META_ROOM_MISSING`**, merge errors). Surface outcomes only via the **ack** path.
- **Editor (marks UI):** The Advanced affordance lists **every mark** that exists on the **Lens** for this room (same Lens the Workbench Room editor already resolves) and lets the author set a **value** per mark. **Wire format:** The request body matches **`EphemeraApiStateChangeRequest`** / **`EphemeraCacheMarkState`** as shipped in [`packages/mtw-interfaces/ts/ephemera.ts`](../../packages/mtw-interfaces/ts/ephemera.ts) and [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../packages/mtw-interfaces/ts/ephemeraMeta.ts) --- **`markState.markValue`** as `{ mark, value }[]` satisfying **`isEphemeraCacheMarkState`**. Do not invent an alternate payload shape; serialize the per-mark inputs into that API.
- **No Lens / no marks:** If the room has **no Lens** or the Lens defines **no** marks, the Advanced block can show an **empty state** (or omit the editors) --- no runtime mark values to submit.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply the same convention to nested bullets.

- [X] Add a small **client helper** (or thunk) that builds **`EphemeraApiStateChangeRequest`** (`markState` per **Decided**), assigns **`RequestId`**, and uses **`socketDispatchPromise`** to ephemera; map **`ReturnValue`** body to success vs error strings for the UI. Include **comments** per **Decided** (future **`mtw.ephemera.state`** subscribe + **EventBridge** publish prerequisite).
- [X] Implement **Room-state affordance UI** as an **independent drop-in component** for Room edit **Advanced** (per **Decided**): v1 API is **`<RoomStateAffordance RoomId={roomId} />`**. The component resolves Room/Lens/marks from **authoring workbench context** (same pattern as `LensHeader`, `ExitEditor`, `FeatureListEditor`: use **`useWorkbenchAsset()`** + `RoomId` lookup), avoiding direct Redux selectors for data reads and avoiding tight coupling to existing RoomEdit layout internals. Keep invocation-site wiring minimal (drop-in usage only with `RoomId`); defer broader prop-surface flexibility to a later refactor if needed. Render one value control per **Lens** mark (per **Decided**); pass workbench room component id as **`componentId`**; build **`markValue`** from those fields; validate with **`isEphemeraCacheMarkState`** before send; **ack-only** UX per **Decided**.
- [X] **Tests:** unit tests for the helper/thunk (mock dispatch); component tests if the surface is non-trivial.
- [ ] **Manual verification** in a dev stack: successful merge; server-driven errors (e.g. missing **`Meta::Room`** / merge failure) via ack.
- [ ] Update this document **Recommended order** and **Progress** when the slice ships; move any **lasting** behavior notes into [`charcoal-client/src/components/Workbench/AGENT.md`](../../charcoal-client/src/components/Workbench/AGENT.md) or the relevant slice doc if appropriate, then archive or delete this plan per [`taskPlanning/AGENT.md`](../AGENT.md).

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan created | Done |
| Read-back scope (ack-only); future subscribe + EventBridge notes | Decided (in this doc) |
| Placement: Room edit **Advanced**; no feature flag / role gate | Decided (in this doc) |
| Room id: workbench id **is** **`ROOM#...`**; no client preflight | Decided (in this doc) |
| Editor: per-Lens-mark values; wire = **`EphemeraCacheMarkState`** | Decided (in this doc) |
| Helper or thunk + tests | Done (`sendRoomEphemeraStateChange` + `ephemeraStateChange.test.ts`) |
| Room edit UI + verification | UI + automated verification done (`RoomStateAffordance` + RTL/Vitest); manual dev-stack verification pending |

---

## Verification

- From `charcoal-client/`, run tests per [`AGENT.development.md`](AGENT.development.md), e.g.  
  `npm run test:single -- <paths-for-new-tests>`  
  and a full `npm run test:single` before merge.
- Quick repo checks (optional):  
  `rg "ephemeraStateChange" charcoal-client`  
  `rg "socketDispatchPromise" charcoal-client/src/components/Workbench`

---

## Key links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../AGENT.md) | Task plan framework |
| [`AGENT.development.md`](AGENT.development.md) | Vitest commands for this area |
| [`lambda/ephemera/dataSource/state/AGENT.md`](../../lambda/ephemera/dataSource/state/AGENT.md) | **`Meta::Room.state`**, merge helper, **`mtw.ephemera.state`** |
| [`lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md`](../../lambda/ephemera/dataSource/state/AGENT.planning.perceptionVertical.md) | State domain evolution |
| [`charcoal-client/AGENT.md`](../../charcoal-client/AGENT.md) | Client architecture |
| [`charcoal-client/src/slices/lifeLine/index.api.ts`](../../charcoal-client/src/slices/lifeLine/index.api.ts) | **`socketDispatch`** / **`socketDispatchPromise`** |
