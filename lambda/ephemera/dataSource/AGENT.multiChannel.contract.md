# Multi-channel and multi-cadence updates (contract sketch)

**Status:** Durable **design contract** (evolving). This file records **product and architecture needs** and **decision norms** so room-scale and perception work does not re-derive the same tensions ad hoc. It is **not** a task checklist.

**Index:** [`AGENT.md`](AGENT.md) (this directory's DataSource map and links). **Task planning:** [`taskPlanning/AGENT.md`](../../../taskPlanning/AGENT.md).

**Scope:** Ephemera **dataSource** and **perception** neighborhood: how **separate semantic domains** (state, room meta, render cache, orchestration) combine into **player-visible** updates that may require **different cadences** (fast, cheap signals vs slow, expensive renders).

---

## Problem we are solving

1. **Full room renders are expensive** (orchestration, cache, generation). They should not be the only way to reflect every **small** change (objects list, character presence, incremental meta).
2. **Those small changes still matter** for UI correctness and for establishing a **coherent baseline** when the user enters a context (what they see now vs what arrives later).
3. Today, **delivery paths** mix **correlated** fan-in (`mtw.ephemera.perception` + threads + `Render Pertains`) and **imperative** paths (`perceptionMessage`). That flexibility helped incremental shipping but makes **cross-cutting** rules (ordering, "at least once" baseline, which channel carries what) **implicit**.

Without an **overarching decision layer**, each feature tends to pick whichever local pattern minimizes immediate friction: a new **`streamEvent` type** and DataSource boundary here, another **`Meta::Room`** field there, another perception entry there. The result is **hard-to-reconcile** behavior across features.

---

## Core tension (two valid pulls)

**Aggregate-oriented view**  
Treat the **room** (or similar scope) as one **logical** unit: many **typed** updates about the same **`EphemeraId`**, same cache row family (`Meta::Room`), same mental model for subscribers. Multi-channel stories become **different message kinds** on a **shared** authority, not necessarily separate transport "pipes."

**Domain-oriented view**  
Split by **semantic ownership**: `mtw.ephemera.state` (marks / world-state inputs to render keys), `mtw.ephemera.objects` (runtime object lists; v1 may persist on **`Meta::Room`**), `mtw.ephemera.renderOrchestration`, `mtw.ephemera.renderCache`, `mtw.ephemera.perception`. Clear boundaries make **reasoning, tests, and event contracts** easier.

**Reconciliation note:** These pulls are **compatible at the storage layer** and **tension-prone at the process contract layer**. The same Dynamo **row** (`Meta::Room`) can hold fields owned by **different** DataSource modules **if** we document **who writes what**, **what gets invalidated**, and **what perception (or clients) may assume** about ordering and baseline delivery.

---

## Room UI delivery channels (agreed direction)

The following is **normative intent** for how we **frame** player-visible room context going forward. It does **not** yet prescribe final **`PublishMessage`** wire types, field lists, or perception state machines; those are tracked in [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md).

### Two logical channels

1. **Room-render channel** --- **Summary-oriented** content that is **render-backed** (or otherwise tied to **`ComponentRender`** / orchestration): the **expensive** path that should **not** be the only way to reflect small runtime changes.
2. **Room-affordances channel** --- **Structured** facts that should be refreshable on a **cheaper cadence**: e.g. **exits**, **characters present**, and **runtime objects** (as modeled on **`Meta::Room`** and related ephemera). This is the natural home for **`mtw.ephemera.objects`**-driven updates **unless** product requires summary text to change with every object mutation.

These are **logically distinct**: they **may** use different internal triggers, different perception handling, and different client composition rules.

### Cadence and independence

- Each channel **may** be published **independently** and on its **own cadence** in response to the internal events that own that data.
- **Neither** channel is assumed to **block** the other at the protocol level **by default**; the **client** is expected to **compose** one header UX from **both** when both apply, and to tolerate **one channel arriving before the other** (placeholders or last-known-good per channel until data arrives). Exact UX and **staleness** rules are **TBD** (see task plan).

### Coupled delivery (optional pattern)

Some **product flows** may require **paired** delivery semantics (for example: do not treat affordances as **terminal** until **render** has at least reached a **Generating**-class signal, or require **both** channels **terminal** before closing a perception thread). That is a **PerceptionThread template** / fan-in concern, **not** a global rule for every update. Specific state machines, **failure**, and **timeout** behavior are **TBD** (see task plan).

### Current codebase (fact, not target)

Today, **`PerceptionMessage`** room WML can still embed **overlapping** facts (e.g. characters, exits) while **`RoomUpdate`** carries **character roster** separately; the main client **room grouping** path does **not** fully merge **`RoomUpdate`** into the sticky header. **Migrating** to the two-channel model implies **choosing a single source of truth per fact** where possible and updating **client aggregation** accordingly. That migration is **work**, not yet done.

### Normative consequence for new features

When adding **player-visible** room updates, **name** which **channel** owns the change (**render** vs **affordances**) and **which DataSource or module** publishes it. If a change could fit **either** channel, record the choice in the task plan or in this file so we do not reintroduce **implicit** coupling.

---

## Implementation-level aggregation (example: `Meta::Room`)

Ephemera already stores **multiple concerns** on one **`Meta::Room`** item (`EphemeraId: ROOM#...`, `DataCategory: 'Meta::Room'`): e.g. `activeCharacters`, `state` (marks), cache pointer fields, and planned fields such as `objects` (see [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)).

**Ephemera wire WML (producers):** When a service builds **room** WML that includes **runtime objects** (for example for **`PerceptionMessage`**, wire transfer, or other ephemera payloads), use **`mtw-wml`** with **`standardizeMode: 'ephemeraWire'`** and **`<Object uuid=(id)><ShortName>label</ShortName></Object>`** children under **`Room`**. Canonical handles in **`StandardRoom.objects`** and in schema are **`OBJECT#...`**; WML serialization prints bare **`uuid=(id)`** again. **`Object`** is **not** a **`StandardComponent`**. Normative package docs: [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) (**Standardize** / **`standardizeMode`**).

**Contract:** **Co-location on one row is an implementation choice** for **atomicity, read efficiency, and cache keying** (`ComponentEphemeraMeta`), **not** a claim that there is only one **semantic** domain. **Domain boundaries** remain defined by **which DataSource (or module) owns writes and outbounds** for each field or field group.

**Invalidation:** Any successful write to `Meta::Room` must respect the **invalidation contract** for [`ComponentEphemeraMeta`](../internalCache/componentEphemeraMeta.AGENT.md) (call **`invalidate(roomId)`** after success unless a narrower rule is explicitly documented).

---

## What the authoritative decision layer should provide

The **decision layer** is the place we answer **once**, then cite from feature work:

| Question | Why it matters |
| --- | --- |
| **Cadence classes** | Which updates are **fast-path** (meta, presence, lists) vs **render-backed** (full description, heavy `PublishMessage` bodies). |
| **Channels (logical)** | Whether the client treats these as **one subscription** with typed deltas, **multiple** WebSocket message families, or **one** message with **composed** payloads (product + protocol). |
| **Baseline guarantee** | For a given **user action** or **view entry**, what is the **minimum** set of facts that must be delivered **at least once** to avoid broken UI (and within what **time ordering** constraints). |
| **Kickoff orchestration** | Whether a **single** internal kick may **fan out** to multiple domains (state, rooms, render) and how we avoid **duplicate** or **contradictory** terminal messages. |
| **Correlation** | When **slow** paths complete, how they **tie** to earlier **fast** updates (message ids, thread registration, perception fan-in). See [`perception/AGENT.md`](perception/AGENT.md) and the [pass-through contract](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md). |

This document **does not** yet fix every cell; it **requires** that new work either **fills in** a row with team agreement or **links** to an explicit **TBD** in a task plan.

---

## Norms for new work (until refined)

1. **Name the cadence class** for each new outbound or client-visible update (fast meta vs render-backed vs control-only).
2. **Name the owning DataSource** (or module) for **writes** and **primary** outbound events, even when storage is **`Meta::Room`**.
3. **Do not** introduce a new perception entry path without stating how it relates to [Delivery paths (correlated vs imperative)](perception/AGENT.md#delivery-paths-correlated-vs-imperative).
4. Prefer **typed** bus events (`header.type`) over **opaque** "room updated" blobs unless a **composed** snapshot is explicitly the product requirement.
5. When **two domains** must move together for baseline UX, document whether **one** kick **chains** internally, **parallel** publishes are acceptable, or **perception** must **batch** (and what **failure** means).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`AGENT.md`](AGENT.md) | **dataSource** directory index, instance list, shared primitives |
| [`perception/AGENT.md`](perception/AGENT.md) | Correlated vs imperative delivery, obligations, routing identity |
| [`state/AGENT.md`](state/AGENT.md) | `Meta::Room.state` ownership vs orchestration pointer ownership |
| [`renderOrchestration/AGENT.md`](renderOrchestration/AGENT.md) | Resolve, generation, orchestration outbounds |
| [`renderCache/AGENT.md`](renderCache/AGENT.md) | Durable cache, `Render Pertains`, correlation vs routing |
| [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md) | **`mtw.ephemera.objects`** (v1 on **`Meta::Room`**) |
| [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) | **`standardizeMode`**, **`Object`** under **`Room`**, **`OBJECT#`** (payload vocabulary) |
| [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) | Package index; **Standardize** section links ephemera wire + lambda/task-plan context |
| [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md) | **Room-render** vs **room-affordances**: open decisions, migration, verification |
| [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) | Pass-through durability and cross-cutting semantics |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | DataSource pattern, `busOnly`, `publishedEvents.ts` |

---

## Open decisions (inventory)

Track resolutions here or in [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md); remove bullets when **normative** text exists above.

- [ ] **Wire shapes and correlation:** final **`PublishMessage`** / protocol representation for **room-render** vs **room-affordances**, **`messageId`** rules, and **staleness** keys (task plan **Phase A**).
- [ ] **Fact ownership:** which fields live **only** on affordances vs **only** on render WML after migration; **`RoomUpdate`** evolution.
- [ ] **Coupled PerceptionThread template:** when affordances are **gated** on render progress, **terminal** join rules, **failure**, and **timeout** (task plan **Phase A**).
- [ ] **Cadence taxonomy:** fixed enum of channel/cadence names vs per-feature description only.
- [ ] **Client protocol:** concrete composition model for the sticky header (two slots vs other); snapshot vs delta defaults.
- [ ] **Baseline contract:** formal "minimum delivery set" for room enter / look / move (ties perception + rooms + state + render).
- [ ] **Long-term split or merge:** how `mtw.ephemera.state` and `mtw.ephemera.objects` evolve as non-room kinds appear; whether subscriber docs stay **per-DataSource** or gain a composed **room** story for clients.

---

## Maintenance

When behavior or contracts **change**, update this file **or** a linked package `AGENT.md` and add a **one-line** pointer here so the decision layer stays **grep-friendly** (`multi-cadence`, `baseline`, `Meta::Room`).
