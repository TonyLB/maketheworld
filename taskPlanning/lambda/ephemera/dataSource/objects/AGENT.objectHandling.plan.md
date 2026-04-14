# `mtw.ephemera.objects` - object handling (phase 1: stub, storage, bus)

**Status:** Active --- **phase 1** and **phase 2** (perception / affordance delivery with multi-channel Phase B server) **complete**; archive this plan per **When this task plan can retire** when steady-state docs absorb the narrative.

**Framework:** This document is an **executable task plan** per [`taskPlanning/AGENT.md`](../../../../AGENT.md) (status, **Getting Started**, **Progress**, **Recommended order** checkboxes, **Verification**). Steady-state architecture belongs in [`lambda/ephemera/dataSource/`](../../../../../lambda/ephemera/dataSource/) package `AGENT.md` files after merge.

---

## Purpose

Introduce an internal **`EphemeraDataSource`** with **`dataSourceKey: 'mtw.ephemera.objects'`**, in **symmetry** with **`mtw.ephemera.state`**: a **semantic domain** (runtime object membership: **`OBJECT#...`** + display **`shortName`**) with its own ingress and outbounds, **not** framed as a sub-feature of a room aggregate DataSource even when the **first implementation** stores data on **`Meta::Room`**.

**Naming rationale:** **`state`** is already scoped as a **general** DataSource that today **implements** room marks only. **`objects`** follows the same pattern: **long term**, object lists may attach to **other** ephemera component kinds or rows; v1 intentionally **does not** encode "objects are a subset of rooms" in the **`dataSourceKey`**.

**Storage (current contract):** **`objects`** on the ephemera-table **`Meta::Room`** row is **`{ uuid: OBJECT#...; shortName: string }[]`** (see [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), aligned with **`StandardRoom.objects`** / WML ephemera wire (see **Ephemera wire WML** below). **`componentId`** restricted to **room** ids for this milestone, plus **internal bus ingress** (same envelope patterns as **`api.ephemera`** where convenient, but **no** `requestId` / **`ReturnValue`** correlation) and **outbound bus events** after successful persist.

**Lasting architecture** for steady-state behavior belongs in package docs once code exists; this file tracks **execution order**, **progress**, and **verification**.

---

## Getting Started

Read in order before implementation (or skim **Decisions log** + **Architecture** if resuming mid-stream):

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) --- task plan conventions and checkbox rules.
2. [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) --- **`npm run test`** from **`lambda/ephemera/`**; Jest patterns and **`internalCache`** injection.
3. [`lambda/ephemera/dataSource/abstract.ts`](../../../../../lambda/ephemera/dataSource/abstract.ts) --- `EphemeraDataSource`, `busOnly`, `replayable: false`.
4. [`lambda/ephemera/dataSource/state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts) and [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) --- symmetry with **`mtw.ephemera.state`** / **`sendStateChange`**; objects ingress without **`ReturnValue`** (**Decisions log**).
5. [`lambda/ephemera/internalCache/componentEphemeraMeta.ts`](../../../../../lambda/ephemera/internalCache/componentEphemeraMeta.ts) --- **`Meta::Room`** cache; **invalidate** after writes.
6. [`lambda/ephemera/dataSource/perception/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/subscribedEvents.ts) and [`perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) --- background for **phase 2** only.
7. [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) --- shared **`Meta::Room`** row vs DataSource domains.
8. [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) --- **`busOnly`**, **`publishedEvents.ts`**.
9. [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts`](../../../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts) --- **ephemera wire** WML, **`<Object>`** under **`Room`**, **`OBJECT#`** handles vs blueprint **`asset`** mode (package **`AGENT.md`** indexes cross-links).

---

## Ephemera wire WML (producers)

**Not** asset / blueprint authoring: **`mtw-wml`** **`standardizeMode: 'ephemeraWire'`** allows **`<Object uuid=(id)><ShortName>label</ShortName></Object>`** inside **`Room`**. **`uuid`** is canonical **`OBJECT#...`** in memory and in **`StandardRoom.objects`** / **`toJSON`**; **`Objects Change`** **`add`** carries full **`{ uuid, shortName }`** rows (same shape); **`remove`** is **`OBJECT#...` ids**. WML print strips to bare **`uuid=(id)`**. Normative detail: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md). Multi-channel contract (room affordances vs render): [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md).

---

## Goals (initial milestone)

1. **DataSource stub:** `lambda/ephemera/dataSource/objects/` with `EphemeraDataSource` instance **`mtw.ephemera.objects`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`**, **`subscribe()`** side-effect import from [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) (same pattern as [`state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts)).
2. **Schema (v1):** **`EphemeraMetaRoom.objects`** optional array of **`{ uuid: OBJECT#...; shortName: string }`**; **`isEphemeraMetaRoom`** validates rows. **Non-room** storage is **out of scope** until a follow-on design.
3. **Persistence (v1):** Conditional write path on **`Meta::Room`** that merges ingress **`{ add: EphemeraMetaRoomObject[]; remove: OBJECT#...[] }`** into **`objects`** (see **Storage**), requires existing row, then **`internalCache.ComponentEphemeraMeta.invalidate(roomId)`**. Reject or no-op non-room **`componentId`** per same style as **`state`** (room-only v1).
4. **Ingress:** New **`api.ephemera`**-style envelope with header **`type: 'Objects Change'`** (imperative, like **`State Change`**) with **`componentId`** (room, v1) and **`{ add, remove }`**; internal publishers only---**no** `requestId`, **no** **`ReturnValue`**. **`mtw.ephemera.objects`** `receiveEvents` handles it. Bus helper **`sendObjectsChange`**.
5. **Outbound:** After successful persist, **`streamEvent`** on **`mtw.ephemera.objects`** with header **`type: 'Objects Changed'`** and a **typed** payload (component id, prior/new snapshot for tests and subscribers).
6. **Tests:** Unit tests for handler persistence + cache invalidation + outbound shape (pattern from [`state`](../../../../../lambda/ephemera/dataSource/state/) and [`apiEphemera.test.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.test.ts)).

---

## Non-goals (first pass)

- **Replay** / EventBridge-visible public contract for **`mtw.ephemera.objects`** (stay **bus-only** like **`mtw.ephemera.state`** initially).
- Full **perception** fan-in wiring unless explicitly pulled into this milestone; document as **follow-on**.
- **Non-room** **`componentId`**, additional **`Meta::*`** shapes, **`ComponentEphemeraMeta`** unions, or separate caches for object lists---future task plans only; this plan ships **room-only** **`mtw.ephemera.objects`** on **`Meta::Room`**.
- **Asset / blueprint** WML or **assetDB** authoring surface for objects (ephemera runtime only unless product says otherwise). **Ephemera wire** WML for **`Object`** is defined in **`mtw-wml`** (see **Ephemera wire WML** above), not in asset mode.
- **Authorization** framework or **client correlation** for this ingress---**internal processes** only for v1 (see **Decisions log**).

---

## Architecture (target shape)

### DataSource and events

| Header `type` | Where | Notes |
| --- | --- | --- |
| **`Objects Change`** | **`api.ephemera`** ingress (internal) | Imperative command; parallels **`State Change`** |
| **`Objects Changed`** | **`mtw.ephemera.objects`** outbound | After successful persist; parallels **`State Changed`** |

Future event types on **`mtw.ephemera.objects`** (if any) stay **object-domain** specific; **presence / characters** remain outside this DataSource unless product merges those semantics later.

### Ingress (internal bus; shape like **`api.ephemera`**)

1. **Internal** callers emit header **`type: 'Objects Change'`**. Payload: **`componentId`** (room in v1) and **`{ add: { uuid, shortName }[]; remove: OBJECT#...[] }`** (either array may be empty).
2. **`sendObjectsChange`** in [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) (or **`objectsApi.ts`** if splitting keeps **`apiEphemera`** small). **Do not** mirror **`handleApiStateChange`** **`ReturnValue`** behavior.
3. **`mtw.ephemera.objects`** subscribes via a **type guard** (composed with other guards as needed).

### Storage (v1)

- **Dynamo:** `EphemeraId: ROOM#...`, `DataCategory: 'Meta::Room'`.
- **Field:** **`objects`:** `{ uuid: OBJECT#...; shortName: string }[]`. Treat **missing** like **`[]`** when applying a patch.
- **Merge semantics:** **Remove:** drop every row whose **`uuid`** is in **`remove`**. **Add:** for each entry in order, strip existing rows with the same **`uuid`**, then append (upsert + move-to-end). **No** max length cap in v1.

**Contract reminder:** Co-location on **`Meta::Room`** is **implementation** for v1; see [`AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md).

### Ordering relative to **`mtw.ephemera.state`**

**Intent:** **`objects`** runs **before** **`state`** in shared **Meta::Room** workflows so future rules can treat object changes as **inputs** to state (e.g. an object toggles illumination and marks follow), not the other way around.

**Implementation norms for this slice:**

1. **`app.ts`:** side-effect import **`./dataSource/objects`** **above** **`./dataSource/state`** so DataSource **`subscribe()`** registration order is **objects first**, **state second** (same pattern as other ephemera DataSources; document in **`lambda/ephemera/dataSource/objects/AGENT.md`** when shipped).
2. **Callers** that emit both commands for one room in one interaction should issue **`Objects Change`** before **`State Change`** so Dynamo and cache see **object** mutations before **mark** merges when both land in the same lambda invocation.

This does **not** add automatic coupling between the two DataSources; it is **ordering policy** for predictable composition.

### Downstream (follow-on)

- **`renderOrchestration`:** Subscribe to **`Objects Changed`** (or ingress) if object lists affect render keys or passive fan-out.
- **`mtw.ephemera.perception`:** **Agreed:** subscribe on **`mtw.ephemera.perception`** and emit affordance **`PerceptionMessage`** for **`Objects Changed`** (see [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Phase B server migration (agreed)** and [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../lambda/ephemera/dataSource/perception/AGENT.md) **Server publish sites (multi-channel)**).

---

## Deferred (not blocking phase 1)

**Perception wiring** for **`Objects Changed`** is **decided** for Phase 2: **`mtw.ephemera.perception`** subscription and affordance **`PublishMessage`** (see [`AGENT.multiChannel.contract.md`](../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) **Phase B server migration**). Remaining **implementation** detail (WML build helpers, tests) ships with that slice.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line under **Phase 1** and **Phase 2** as you go; phase 2 starts after phase 1 is merged unless a successor plan says otherwise.

**Phase 1 (core `mtw.ephemera.objects`---ship without perception):**

- [X] Add **`EphemeraMetaRoom.objects`** + **`isEphemeraMetaRoom`** in **`mtw-interfaces`**
- [X] Implement **`optimisticUpdate`** (or equivalent) for objects-only patch; **`ComponentEphemeraMeta.invalidate`** on success (`mergePersistMetaRoomObjects.ts`)
- [X] Add bus ingress types and **`sendObjectsChange`**; **no** **`ReturnValue`** for v1 (`localApiEvents.ts`, `apiEphemera.ts`)
- [X] Create **`lambda/ephemera/dataSource/objects/`** with **`index.ts`**, **`subscribedEvents.ts`**, **`events.ts`** for **Objects Changed** payloads
- [X] Side-effect import in **`app.ts`**, **above** **`./dataSource/state`** (see **Ordering relative to `mtw.ephemera.state`**)
- [X] Unit tests: persist, invalidate, outbound envelope, guard rejects non-room ids (v1) (`mergePersistMetaRoomObjects.test.ts`, `handleApiObjectsChange.test.ts`, `apiEphemera.test.ts`)
- [X] Update **`lambda/ephemera/dataSource/AGENT.md`** planned-row, **Progress** table, and phase 1 lines in this **Recommended order** when the slice merges (includes **`objects/AGENT.md`**)

**Phase 2 (perception and player-visible delivery---after phase 1):**

- [X] Resolve **perception wiring** --- **`mtw.ephemera.perception`** subscribes to **`Objects Changed`** (norms in multi-channel plan **Phase B server**)
- [X] Wire **`mtw.ephemera.perception`** **`subscribedEvents`** / **`receiveEvents`** and affordance **`PublishMessage`** (**one per character**: **`targets: [characterId]`**, **`ComponentStackMerge.get(characterId, roomId)`**, **`roomChannel: 'affordances'`** per multi-channel contract)
- [X] Add or enable tests (including **`describe.skip`** lifted per [`AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) discipline, if applicable)

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan (executable) | Done |
| Phase 1: schema + interfaces | Done ([`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)) |
| Phase 1: DataSource + ingress + tests | Done ([`objects/`](../../../../../lambda/ephemera/dataSource/objects/), [`dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md), [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)) |
| Phase 2: perception wiring + subscriptions | Done (with multi-channel Phase B server) |

---

## Verification

**After implementation,** confirm the following (update **Progress** and **Recommended order** as the last step of the merge).

**Baseline commands** (from [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md)):

```bash
cd lambda/ephemera
npm run test -- --watchAll=false
# Scope to new tests when iterating:
# npm run test dataSource/objects
```

**Checks:**

- New unit tests under `lambda/ephemera/dataSource/objects/` (or co-located pattern used by sibling DataSources) pass.
- Grep: `mtw.ephemera.objects` appears in **`app.ts`** side-effect imports and in the DataSource **`dataSourceKey`**.
- Grep: **`./dataSource/objects`** line appears **above** **`./dataSource/state`** in **`app.ts`**.
- Optional manual: internal bus envelope triggers Dynamo **`objects`** update on **`Meta::Room`** and **Objects Changed** on **`mtw.ephemera.objects`**.

---

## Links

| Doc / code | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework (executable plan conventions) |
| [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md) | Jest commands and DI patterns for this lambda |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | Pass-through / perception vertical context |
| [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) | Perception fan-in and delivery paths |
| [`lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md`](../../../../../lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md) | Meta::Room cache + invalidation contract |
| [`lambda/ephemera/dataSource/state/AGENT.md`](../../../../../lambda/ephemera/dataSource/state/AGENT.md) | Symmetry reference: **`mtw.ephemera.state`** |
| [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) | Steady-state package index for **`mtw.ephemera.objects`** |
| [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md) | **dataSource** directory index |
| [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) | Multi-cadence; shared row vs domain boundaries |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| dataSourceKey | **`mtw.ephemera.objects`** --- parallel to **`mtw.ephemera.state`**, not nested under a room-aggregate key. |
| v1 storage | **`objects`** on **`Meta::Room`** only; room **`componentId`** only until a follow-on extends kind. |
| `EphemeraMetaRoom` field name | **`objects`:** `{ uuid: OBJECT#...; shortName: string }[]` (optional / missing treated as empty when patching). |
| Ingress payload | **`{ add: { uuid, shortName }[]; remove: OBJECT#...[] }`** alongside **`componentId`**. |
| Authorization | **None** for v1; only **internal processes** invoke this path. |
| Correlation | **No** **`requestId`** / **`ReturnValue`** on ingress (internal-only; unlike **State Change**). |
| api.ephemera ingress header | **`Objects Change`** (imperative; parallels **`State Change`**). |
| Bus helper name | **`sendObjectsChange`** (parallels **`sendStateChange`**). |
| `objects` merge semantics | **Uuid-keyed list:** **remove** = drop all rows whose **`uuid`** is in **`remove`**; **add** = per entry, strip same **`uuid`** then append (upsert + move-to-end); **no** length cap in v1. |
| Outbound header | **`Objects Changed`** (Title Case, past tense; matches **`State Changed`**). |
| Order vs **`mtw.ephemera.state`** | **`objects` before `state`:** **`app.ts`** imports **`./dataSource/objects`** before **`./dataSource/state`**; callers emitting both for one room send **`Objects Change`** before **`State Change`**. Rationale: object changes may **drive** derived state (e.g. lighting), rarely the reverse. |
| Perception | **Phase 2:** **`mtw.ephemera.perception`** subscribes to **`Objects Changed`** and emits affordance **`PerceptionMessage`** (see multi-channel plan **Phase B server**). Phase 1 shipped **without** that subscriber; Phase B adds it. |

---

## When this task plan can retire

After **phase 1** merge: move **normative** steady-state for **`mtw.ephemera.objects`** into **`lambda/ephemera/dataSource/objects/AGENT.md`** (and extend **`internalCache/componentEphemeraMeta.AGENT.md`** if schema-only). If **phase 2** (perception) is still active, keep this file open and track **Phase 2** checkboxes here or in a successor plan; when both phases are done, archive or delete per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
