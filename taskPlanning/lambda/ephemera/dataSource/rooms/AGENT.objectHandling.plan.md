# `mtw.ephemera.rooms` - object handling (initial stub and storage)

**Status:** DRAFT - planning structure for discussion; implementation not started.

**Framework:** Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability, checkbox conventions, and what belongs here vs in package `AGENT.md` files.

---

## Purpose

Introduce a single internal **`EphemeraDataSource`** with **`dataSourceKey: 'mtw.ephemera.rooms'`** (name final unless a naming collision appears next to existing keys). Use **one key** and **multiple typed header events** (e.g. **Objects Changed**, future **Character Changed** or **Active Characters Changed**) so room-scoped updates share a clear domain without multiplying `subscribe()` boundaries.

**First slice:** minimal **object** storage as a **list of strings** on the ephemera-table **`Meta::Room`** row (see [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), plus **API ingress** and **outbound bus events** after successful persist.

**Lasting architecture** for steady-state behavior belongs in [`lambda/ephemera/dataSource/`](../../../../../lambda/ephemera/dataSource/) package docs once code exists; this file tracks **task order**, **unknowns**, and **verification** for the initial landing.

---

## Getting started (read order)

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) - task plan conventions.
2. [`lambda/ephemera/dataSource/abstract.ts`](../../../../../lambda/ephemera/dataSource/abstract.ts) - `EphemeraDataSource`, `busOnly`, `replayable: false` pattern.
3. [`lambda/ephemera/dataSource/state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts) and [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) - **api.ephemera** ingress + `send*` helpers + envelope guards (mirror for rooms/objects).
4. [`lambda/ephemera/internalCache/componentEphemeraMeta.ts`](../../../../../lambda/ephemera/internalCache/componentEphemeraMeta.ts) - read-through cache for `Meta::Room`; **invalidate** after writes.
5. [`lambda/ephemera/dataSource/perception/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/subscribedEvents.ts) and [`AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) - how perception multiplexes sources; future **rooms** subscription for fan-in.
6. [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) - **busOnly** outgoing types in **`publishedEvents.ts`** colocated with the DataSource.

---

## Goals (initial milestone)

1. **DataSource stub:** `lambda/ephemera/dataSource/rooms/` (or agreed name) with `EphemeraDataSource` instance **`mtw.ephemera.rooms`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`**, **`subscribe()`** side-effect import from [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) (same pattern as [`state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts)).
2. **Schema:** Extend **`EphemeraMetaRoom`** with an optional field for **object id strings** (exact property name TBD in **Open questions**). Extend **`isEphemeraMetaRoom`** accordingly.
3. **Persistence:** Conditional write path on **`Meta::Room`** that updates **only** the objects field (or merges per chosen semantics), requires existing row, then **`internalCache.ComponentEphemeraMeta.invalidate(roomId)`**.
4. **API ingress:** New **`api.ephemera`** envelope (header `type` TBD) carrying at least **`componentId`** (room) and **objects** payload; lambda routes to messageBus; **`mtw.ephemera.rooms`** `receiveEvents` handles it.
5. **Outbound:** After successful persist, **`streamEvent`** on **`mtw.ephemera.rooms`** with header **`type: 'Objects Changed'`** (or agreed name) and a **typed** payload (room id, maybe prior/new snapshot for tests and subscribers).
6. **Tests:** Unit tests for handler persistence + cache invalidation + outbound shape (pattern from [`state`](../../../../../lambda/ephemera/dataSource/state/) tests and [`apiEphemera.test.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.test.ts)).

---

## Non-goals (first pass)

- **Replay** / EventBridge-visible public contract for **`mtw.ephemera.rooms`** (stay **bus-only** like **`mtw.ephemera.state`** initially).
- Full **perception** fan-in wiring (subscribe **`mtw.ephemera.perception`** to **Objects Changed** and correlate to threads) unless explicitly pulled into this milestone; document as **follow-on**.
- **Character** / **activeCharacters** migration onto the same DataSource (plan for **typed** events, implement later).
- **WML** or **assetDB** authoring surface for objects (ephemera runtime only unless product says otherwise).

---

## Architecture (target shape)

### Single DataSource, multiple event classes

| Concern | Header `type` (on `mtw.ephemera.rooms`) | Notes |
| --- | --- | --- |
| Objects list updated | **`Objects Changed`** (provisional) | First implementation |
| Active characters / presence | **`...`** TBD | Future; may align with **`Meta::Room.activeCharacters`** writers |

**Subfolders** under `dataSource/rooms/` may split **handlers** (`objects.ts`, `characters.ts`) without splitting **`dataSourceKey`**.

### Ingress (mirrors state pattern)

1. Client or internal caller emits **`api.ephemera`** with a dedicated header type (e.g. **Objects Set** / **Objects Update** - TBD).
2. **`sendRoomsObjects...`** helper in [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) (or small `roomsApi.ts` if the file grows).
3. **`mtw.ephemera.rooms`** subscribes via a **type guard** unioned into `subscribedEventTypeGuard` (or dedicated guard composition).

### Storage

- **Dynamo:** `EphemeraId: ROOM#...`, `DataCategory: 'Meta::Room'`.
- **Merge semantics:** replace entire list vs merge/patch - **Open questions**.
- **Empty list:** distinguish **unset** vs **empty array** if needed for clients - **Open questions**.

### Downstream (follow-on)

- **`renderOrchestration`:** If objects must affect **render keys** or **passive fan-out**, subscribe to **`Objects Changed`** (or to **`api.ephemera`** ingress) per the same policy as **State Changed**; user expectation today is often **fast-path** hits.
- **`mtw.ephemera.perception`:** Subscribe and integrate with **PerceptionThreads** / **`orchestrate`** when product requires **correlated** delivery for object visibility.

---

## Open questions (resolve before or during implementation)

1. **Field name** on **`EphemeraMetaRoom`:** e.g. `objectIds`, `objects`, `roomObjectKeys` - align with client and future WML.
2. **Ingress command shape:** replace-list vs diff vs named operations; idempotency and max list size.
3. **Authorization:** who may set objects for a room (same as state change, connection-bound, asset ownership) - may be **caller's responsibility** in v1 with a TODO.
4. **Correlation:** whether **`api.ephemera`** ingress carries **`requestId`** and returns **`ReturnValue`** like **State Change** ([`handleApiStateChange.ts`](../../../../../lambda/ephemera/dataSource/state/handleApiStateChange.ts)).
5. **Coherence with `mtw.ephemera.state`:** separate **`api.ephemera`** types vs one **Room Meta** command with discriminant - prefer **separate** types for v1 clarity unless product wants one envelope.
6. **Perception timing:** register thread + kick render vs emit **Objects Changed** only and let a thin perception handler **PublishMessage** without render - **product** decision.
7. **Event name casing:** match existing headers (**`State Changed`**, **`Render Pertains`**) - use space-separated Title Case for **`Objects Changed`**.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets the same way as you complete them.

- [ ] Resolve **Open questions** 1-2 and 7 (field name, ingress shape, header spelling) in review; record decisions in a short **Decisions** subsection below or in PR description
- [ ] Add **`EphemeraMetaRoom`** field + **`isEphemeraMetaRoom`** update in **`mtw-interfaces`**
- [ ] Implement **`optimisticUpdate`** (or equivalent) helper for objects-only patch; **`ComponentEphemeraMeta.invalidate`** on success
- [ ] Add **`api.ephemera`** ingress types, serializer path if required, and **`send*`** helper; extend ephemera lambda **EventBridge** / bus routing if this ingress is also used from API Gateway (follow existing **`State Change`** wiring)
- [ ] Create **`lambda/ephemera/dataSource/rooms/`** with **`index.ts`**, **`subscribedEvents.ts`**, **`publishedEvents.ts`** (or **`events.ts`**) for **Objects Changed** payload types
- [ ] Side-effect import in **`app.ts`**
- [ ] Unit tests: persist, invalidate, outbound envelope, guard rejects non-room ids
- [ ] (Optional follow-on in same PR or next) **`mtw.ephemera.perception`** subscription stub or **`describe.skip`** test with reason string per [`AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) progressive activation discipline
- [ ] Update **Progress** table and this **Recommended order** when the slice merges

---

## Progress

| Milestone | Status |
| --- | --- |
| Planning doc (this file) | Done |
| Schema + interfaces | Not started |
| `mtw.ephemera.rooms` DataSource + ingress | Not started |
| Perception / orchestration subscribers | Not started (optional follow-on) |

---

## Verification (when implementation exists)

- Unit tests in `lambda/ephemera/dataSource/rooms/*.test.ts` (or co-located pattern used by sibling DataSources).
- Grep: `mtw.ephemera.rooms` appears in **`app.ts`** import list and DataSource **`dataSourceKey`**.
- Manual: **`api.ephemera`** envelope (or test helper) triggers Dynamo field update and **Objects Changed** on bus (logging or test spy).

---

## Links

| Doc / code | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | Pass-through / perception vertical context |
| [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) | Perception fan-in and delivery paths |
| [`lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md`](../../../../../lambda/ephemera/internalCache/componentEphemeraMeta.AGENT.md) | Meta::Room cache + invalidation contract |
| [`lambda/ephemera/dataSource/state/AGENT.md`](../../../../../lambda/ephemera/dataSource/state/AGENT.md) | State domain boundary vs orchestration |

---

## Decisions log

Record agreed answers to **Open questions** here as they land (date optional).

| Topic | Decision | Date |
| --- | --- | --- |
| *Example* | *Objects field name: `...`* | |

---

## When this task plan can retire

After merge: move **normative** steady-state description into **`lambda/ephemera/dataSource/rooms/AGENT.md`** (or extend **`internalCache/componentEphemeraMeta.AGENT.md`** if only schema touches meta). Archive or delete this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
