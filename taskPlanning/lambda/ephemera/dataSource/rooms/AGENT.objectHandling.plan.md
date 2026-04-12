# `mtw.ephemera.rooms` - object handling (initial stub and storage)

**Status:** DRAFT - planning structure for discussion; implementation not started.

**Framework:** Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) for durability, checkbox conventions, and what belongs here vs in package `AGENT.md` files.

---

## Purpose

Introduce a single internal **`EphemeraDataSource`** with **`dataSourceKey: 'mtw.ephemera.rooms'`** (name final unless a naming collision appears next to existing keys). Use **one key** and **multiple typed header events** (e.g. **Objects Changed**, future **Character Changed** or **Active Characters Changed**) so room-scoped updates share a clear domain without multiplying `subscribe()` boundaries.

**First slice:** minimal **object** storage as a **list of strings** in field **`objects`** on the ephemera-table **`Meta::Room`** row (see [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)), plus **internal bus ingress** (same envelope patterns as **`api.ephemera`** where convenient, but **no** `requestId` / **`ReturnValue`** correlation) and **outbound bus events** after successful persist.

**Lasting architecture** for steady-state behavior belongs in [`lambda/ephemera/dataSource/`](../../../../../lambda/ephemera/dataSource/) package docs once code exists; this file tracks **task order**, **unknowns**, and **verification** for the initial landing.

---

## Getting started (read order)

1. [`taskPlanning/AGENT.md`](../../../../AGENT.md) - task plan conventions.
2. [`lambda/ephemera/dataSource/abstract.ts`](../../../../../lambda/ephemera/dataSource/abstract.ts) - `EphemeraDataSource`, `busOnly`, `replayable: false` pattern.
3. [`lambda/ephemera/dataSource/state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts) and [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) - **api.ephemera** ingress + `send*` helpers + envelope guards (reference for bus shape; rooms/objects ingress is **internal-only** without **`ReturnValue`** per **Decisions log**).
4. [`lambda/ephemera/internalCache/componentEphemeraMeta.ts`](../../../../../lambda/ephemera/internalCache/componentEphemeraMeta.ts) - read-through cache for `Meta::Room`; **invalidate** after writes.
5. [`lambda/ephemera/dataSource/perception/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/subscribedEvents.ts) and [`AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) - how perception multiplexes sources; future **rooms** subscription for fan-in.
6. [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) - **busOnly** outgoing types in **`publishedEvents.ts`** colocated with the DataSource.

---

## Goals (initial milestone)

1. **DataSource stub:** `lambda/ephemera/dataSource/rooms/` (or agreed name) with `EphemeraDataSource` instance **`mtw.ephemera.rooms`**, **`publisherStrategy: 'busOnly'`**, **`replayable: false`**, **`subscribe()`** side-effect import from [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) (same pattern as [`state/index.ts`](../../../../../lambda/ephemera/dataSource/state/index.ts)).
2. **Schema:** Extend **`EphemeraMetaRoom`** with optional **`objects: string[]`** (object ids). Extend **`isEphemeraMetaRoom`** accordingly.
3. **Persistence:** Conditional write path on **`Meta::Room`** that merges ingress **`{ add: string[]; remove: string[] }`** into **`objects`** (see **Storage**), requires existing row, then **`internalCache.ComponentEphemeraMeta.invalidate(roomId)`**.
4. **Ingress:** New **`api.ephemera`**-style envelope with header **`type: 'Objects Change'`** (imperative, like **`State Change`**) with **`componentId`** (room) and **`{ add, remove }`**; internal publishers only---**no** `requestId`, **no** **`ReturnValue`** success/error path. **`mtw.ephemera.rooms`** `receiveEvents` handles it. Bus helper **`sendObjectsChange`** (name aligned with **`sendStateChange`**).
5. **Outbound:** After successful persist, **`streamEvent`** on **`mtw.ephemera.rooms`** with header **`type: 'Objects Changed'`** and a **typed** payload (room id, maybe prior/new snapshot for tests and subscribers).
6. **Tests:** Unit tests for handler persistence + cache invalidation + outbound shape (pattern from [`state`](../../../../../lambda/ephemera/dataSource/state/) tests and [`apiEphemera.test.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.test.ts)).

---

## Non-goals (first pass)

- **Replay** / EventBridge-visible public contract for **`mtw.ephemera.rooms`** (stay **bus-only** like **`mtw.ephemera.state`** initially).
- Full **perception** fan-in wiring (subscribe **`mtw.ephemera.perception`** to **Objects Changed** and correlate to threads) unless explicitly pulled into this milestone; document as **follow-on**.
- **Character** / **activeCharacters** migration onto the same DataSource (plan for **typed** events, implement later).
- **WML** or **assetDB** authoring surface for objects (ephemera runtime only unless product says otherwise).
- **Authorization** framework or **client correlation** (`requestId` / **`ReturnValue`**) for this ingress---callers are **internal processes** only for v1 (see **Decisions log**).

---

## Architecture (target shape)

### Single DataSource, multiple event classes

| Concern | Header `type` (on `mtw.ephemera.rooms`) | Notes |
| --- | --- | --- |
| Objects list updated | **`Objects Changed`** | Outbound after persist (Title Case, past tense like **`State Changed`**) |
| Active characters / presence | **`...`** TBD | Future; may align with **`Meta::Room.activeCharacters`** writers |

**Subfolders** under `dataSource/rooms/` may split **handlers** (`objects.ts`, `characters.ts`) without splitting **`dataSourceKey`**.

### Ingress (internal bus; shape like **`api.ephemera`**)

1. **Internal** callers only emit on the bus with header **`type: 'Objects Change'`**. Payload: **`componentId`** (room) and **`{ add: string[]; remove: string[] }`** (either array may be empty).
2. **`sendObjectsChange`** helper in [`apiEphemera.ts`](../../../../../lambda/ephemera/dataSource/apiEphemera.ts) (or small `roomsApi.ts` if the file grows). **Do not** mirror **`handleApiStateChange`** **`ReturnValue`** behavior.
3. **`mtw.ephemera.rooms`** subscribes via a **type guard** unioned into `subscribedEventTypeGuard` (or dedicated guard composition).

### Storage

- **Dynamo:** `EphemeraId: ROOM#...`, `DataCategory: 'Meta::Room'`.
- **Field:** **`objects`:** `string[]`. Treat **missing** like **`[]`** when applying a patch.
- **Merge semantics:** Treat **`objects`** as an **ordered multiset** of strings (duplicates allowed). **Remove:** **stable filter** - drop every element whose value is in the **set** of strings appearing in **`remove`** (relative order of survivors unchanged). **Add:** append each **`add`** entry **in order**; duplicates are allowed, including duplicates of strings still in the list. **No** max length cap in v1.

### Downstream (follow-on)

- **`renderOrchestration`:** If objects must affect **render keys** or **passive fan-out**, subscribe to **`Objects Changed`** (or to **`api.ephemera`** ingress) per the same policy as **State Changed**; user expectation today is often **fast-path** hits.
- **`mtw.ephemera.perception`:** Subscribe and integrate with **PerceptionThreads** / **`orchestrate`** when product requires **correlated** delivery for object visibility.

---

## Open questions (remaining)

1. **Coherence with `mtw.ephemera.state`:** separate **`api.ephemera`** types vs one **Room Meta** command with discriminant - **plan:** separate types for v1 clarity unless product wants one envelope.
2. **Perception timing:** register thread + kick render vs emit **Objects Changed** only and let a thin perception handler **PublishMessage** without render - **product** decision.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested bullets the same way as you complete them.

- [ ] Resolve remaining **Open questions** (coherence with **`mtw.ephemera.state`**, perception timing) in review; update **Decisions log** if needed
- [ ] Add **`EphemeraMetaRoom`** field + **`isEphemeraMetaRoom`** update in **`mtw-interfaces`**
- [ ] Implement **`optimisticUpdate`** (or equivalent) helper for objects-only patch; **`ComponentEphemeraMeta.invalidate`** on success
- [ ] Add bus ingress types and **`send*`** helper ( **`api.ephemera`** key if consistent with other internal events); **no** API Gateway / **`ReturnValue`** requirement for v1
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
| [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md) | **dataSource** directory index |
| [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) | Multi-cadence / aggregate storage vs domain boundaries |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| `EphemeraMetaRoom` field name | **`objects`:** `string[]` (optional / missing treated as empty when patching). |
| Ingress payload | **`{ add: string[]; remove: string[] }`** alongside room **`componentId`**. |
| Authorization | **None** for v1; only **internal processes** invoke this path; no permission framework in scope. |
| Correlation | **No** **`requestId`** / **`ReturnValue`** on ingress (internal-only; unlike **State Change**). |
| api.ephemera ingress header | **`Objects Change`** (imperative; parallels **`State Change`**). |
| Bus helper name | **`sendObjectsChange`** (parallels **`sendStateChange`**). |
| `objects` merge semantics | **Multiset:** no dedupe; **remove** = stable filter using membership in the **set** of **`remove`** entries (all matching occurrences dropped); **add** = ordered append; **no** length cap in v1. |
| Outbound header | **`Objects Changed`** (Title Case, past tense; matches **`State Changed`**). |

---

## When this task plan can retire

After merge: move **normative** steady-state description into **`lambda/ephemera/dataSource/rooms/AGENT.md`** (or extend **`internalCache/componentEphemeraMeta.AGENT.md`** if only schema touches meta). Archive or delete this file per [`taskPlanning/AGENT.md`](../../../../AGENT.md).
