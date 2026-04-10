# Perception - big refactor (fan-in DataSource)

**Status:** In progress. **Next:** first unchecked item in [Recommended order](#recommended-order) (stub `mtw.ephemera.perception` DataSource). Coordinate with [message bus lanes](../../messageBus/AGENT.messageBusLanes.planning.md) if delivery must be lane-isolated before client output.

This file tracks the **large** refactor of Ephemera **perception** from today's largely **imperative** handlers toward an **event-driven fan-in** model (a **DataSource** boundary that **subscribes** to typed streams, **aggregates** partial state, and **delivers** when enough is known). It is **broader** than the pass-through / readiness contract alone; pass-through work is **groundwork** that accrues **obligations** on this shape.

**Maintenance:** Update [Recommended order](#recommended-order) checkboxes when a slice merges (after tests pass). Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) when changing process sections. Retire or archive this file when the initiative completes per that framework.

**Delivery sequencing** (when and how aggregated output becomes `PublishMessage` / client-visible updates) aligns with the pass-through contract ([`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md)) and [Delivery: message bus lanes](#delivery-message-bus-lanes-transport). Final **delivery mechanics** (audience, timeline vs in-place) refine as steps 4--5 land; **obligations** table tracks contract debt.

**Transport (lanes):** Cascade isolation on the **single** ephemera message bus is tracked in [`../../messageBus/AGENT.messageBusLanes.planning.md`](../../messageBus/AGENT.messageBusLanes.planning.md) (**partitioned `flush`**, optional lane id on queue items). Perception consumes that work for **delivery**; do not duplicate lane design here.

---

## Purpose

- Give a **single place** to record **direction**, **open questions**, and **obligations we accrue** on behalf of **future Perception** while `renderOrchestration`, `renderCache`, and contracts evolve first.
- Avoid a planning vacuum where we refactor producers **toward** "Perception will aggregate this" without anywhere to track what **this** must become.
- Stay **honest about uncertainty:** exact APIs **grow** in as implementation lands; **Verification** below is the baseline bar.

---

## Getting Started

Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once so you know what belongs in this task plan versus durable `AGENT.md` next to code, and how checkboxes work. The repo root [`AGENT.md`](../../../../../AGENT.md) describes a [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks); this section follows that shape.

1. **Foundations**
   - **[`AGENT.architecture.events.md`](../../../../../AGENT.architecture.events.md)** (repo root): how events and streaming fit the wider system.
   - **[`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md)**: what `renderOrchestration` / `renderCache` emit; perception **consumes** those semantics for delivery rules.
   - **[`lambda/ephemera/perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md)**: current triggers, scale, navigation (update when behavior changes post-refactor).

2. **This document**
   - [Current baseline](#current-baseline-prep-work-done) --- what is already done.
   - [Recommended order](#recommended-order) --- **authoritative** worklist; checkboxes track shipped work.
   - [Out of scope for first pass](#out-of-scope-for-first-pass-legacy-bus-until-follow-on) --- legacy `Perception` emitters not migrated in v1.
   - [Obligations](#obligations-accruing-to-future-perception-working-list) --- debt from pass-through until types and code catch up.

3. **Integration points (code)**
   - **Imperative perception today:** [`lambda/ephemera/perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts) (`perceptionMessage`, `sendRoomGeneratingHeader`).
   - **Bus:** [`lambda/ephemera/messageBus/index.ts`](../../../../../lambda/ephemera/messageBus/index.ts) (subscriptions), [`lambda/ephemera/messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts) (message types).
   - **DataSource patterns:** [`lambda/ephemera/dataSource/renderOrchestration/`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) (ingress, `subscribe()`), [`lambda/ephemera/dataSource/renderCache/`](../../../../../lambda/ephemera/dataSource/renderCache/) (consumes orchestration stream).
   - **Lambda entry / flush:** [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) (`messageBus.flush()`).
   - **Lanes (transport):** [`../../messageBus/AGENT.messageBusLanes.planning.md`](../../messageBus/AGENT.messageBusLanes.planning.md) --- coordinate if delivery must be lane-isolated before client-visible output.

4. **Tests to mirror**
   - [`lambda/ephemera/perception/index.test.ts`](../../../../../lambda/ephemera/perception/index.test.ts), [`lambda/ephemera/dataSource/renderCache/index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests) (placeholder / skipped tests with reasons).

5. **Next task**
   - Open [Recommended order](#recommended-order); the first unchecked `[ ]` is next (after baseline `[X]`). After a change merges, mark the matching line `[X]` and run **Verification**.

6. **Baseline before you edit**
   - From repo root: `cd lambda/ephemera && npm test` --- expect **green** before large refactors; fix or note existing failures.

There is no `lambda/ephemera/AGENT.development.md` yet; use **Verification** below and this section for commands.

---

## Current baseline (prep work done)

Work already merged or in flight before the **perception DataSource** slice:

| Change | Rationale |
| --- | --- |
| **Removed** legacy **Message** component delivery path from imperative `perceptionMessage` | That UX will be **rebuilt** on the new model; preserving the old path was not worth it. |
| **Disabled** **Knowledge** and **Map** perception branches in the handler (`KNOWLEDGE_PERCEPTION_ENABLED`, `MAP_PERCEPTION_ENABLED` in [`lambda/ephemera/perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts)) | Not migrating those in **v1**; callers may still emit bus `Perception` for maps/knowledge until follow-on --- see [Out of scope for first pass](#out-of-scope-for-first-pass-legacy-bus-until-follow-on). |

---

## Recommended order

Pending work uses `[ ]`, completed work uses `[X]`. Mark nested lines `[X]` as you complete them so partial progress is visible. After implementation for a step, run **Verification** and update this list.

- [X] **Baseline prep:** legacy Message delivery path removed from imperative perception; Knowledge and Map perception branches **disabled** in handler (flags in [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts)). See [Current baseline](#current-baseline-prep-work-done).
- [ ] **Stub** `mtw.ephemera.perception` (or agreed `dataSourceKey`): **bus-published** `EphemeraDataSource`, `subscribe()` wired, same internal `StreamingEvent` patterns as [`renderOrchestration`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) / [`renderCache`](../../../../../lambda/ephemera/dataSource/renderCache/); no EventBridge for the stub.
- [ ] **Character perception** inside the DataSource plus **`api.ephemera`**-style **invoking** ingress (mirror [`sendRenderRequested`](../../../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts) patterns).
- [ ] **In-memory** aggregation cache prototype (running collected state; durable checkpoints **out of scope** unless needed).
- [ ] **Room header** aggregation (**generating** + **terminal** results) --- fan-in and state first; **delivery mechanics** (who, timeline vs in-place) refine with pass-through + [lanes](../../messageBus/AGENT.messageBusLanes.planning.md) as needed.
- [ ] **Room description** aggregation (same footnote as header).
- [ ] **Refactor `moveCharacter`** to start a **`renderOrchestration`**-driven cascade (replace or narrow direct imperative `Perception` where appropriate).
- [ ] **Aggregate `moveCharacter`** outcomes in the perception DataSource (end-to-end with room header/description).

**At a glance (same steps):**

| Step | What | Notes |
| --- | --- | --- |
| -- | Baseline | Done --- see [Current baseline](#current-baseline-prep-work-done). |
| 1 | Stub perception DataSource | Bus-only; mirror existing DataSources. |
| 2 | Character perception + `api.ephemera` ingress | Typed like `sendRenderRequested`. |
| 3 | In-memory aggregation cache | Prototype. |
| 4 | Room header aggregation | Generating + terminal; delivery details iterate. |
| 5 | Room description aggregation | Same as header. |
| 6 | `moveCharacter` -> orchestration cascade | Aligns move with stream shape. |
| 7 | Aggregate move in perception DS | E2E check. |

**Related but separate:** `moveCharacter` still emits **`MapUpdate`** for the client map; that is **not** the perception DataSource unless we explicitly join later.

---

## Out of scope for first pass (legacy bus until follow-on)

These **still enqueue** `type: 'Perception'` on the message bus today; they remain on the **imperative** [`perceptionMessage`](../../../../../lambda/ephemera/perception/index.ts) path until a **follow-on** phase routes them through the DataSource (or deletes dead emits).

| Source | Reference |
| --- | --- |
| **`look`** / `ExecuteAction` | [`lambda/ephemera/parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts) |
| **`checkLocation`** (`forceRender`) | [`lambda/ephemera/checkLocation/index.ts`](../../../../../lambda/ephemera/checkLocation/index.ts) |
| **Asset `Component Updated`** (room header refresh) | [`lambda/ephemera/dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) (`processComponentUpdated`) |
| **Link API** (feature, character, knowledge) | [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) --- **note:** knowledge/map emits may still hit the bus even when the **handler** is gated; do not confuse **bus traffic** with **handler behavior**. |
| **Map subscription** success path | [`lambda/ephemera/mapSubscription/index.ts`](../../../../../lambda/ephemera/mapSubscription/index.ts) (perception for maps **disabled** in handler until Map moves into the new model). |

Documenting this list avoids the false assumption that **only** passive render + **move** exist in production.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework, durability ladder |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md) | Parent epic |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order, pass-through, **contract encoding in tests** |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | Pass-through / readiness **contract draft** (producer and cache side; perception consumes its outputs) |
| [`lambda/ephemera/perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md) | Current perception behavior, triggers, navigation scale (durable reference) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | Rubric **section 3** (fan-in), **section 4** (ready to show) |
| [`../../messageBus/AGENT.messageBusLanes.planning.md`](../../messageBus/AGENT.messageBusLanes.planning.md) | **Message bus lanes** (virtual sub-buses): partitioned `flush`, single subscription graph; transport for decoupled cascades before perception client delivery |

---

## Delivery: message bus lanes (transport)

**Problem:** Orchestration and downstream `StreamingEvent` traffic share one **`InternalMessageBus`**; we still want **independent drains** for multi-step cascades without a second bus instance or duplicate DataSource subscriptions.

**Owned elsewhere:** [`../../messageBus/AGENT.messageBusLanes.planning.md`](../../messageBus/AGENT.messageBusLanes.planning.md) (**ephemera adopts lanes first**). That plan covers queue-cell lane metadata, **centralized filtering in `flush`**, and **`streamEvent` plumbing**.

**This plan (perception):** **Fan-in**, aggregation, and **when** to emit **`PublishMessage`** / client-visible updates once lane semantics exist. **Cross-lane hand-off** (default lane vs named lane) is a **follow-on** in the lanes plan where relevant.

---

## Relationship to pass-through contract alignment

| Topic | Role |
| --- | --- |
| **Pass-through / `Render Pertains` / `Cache Updated`** | Defines what **emitters** will publish and how **correlation** vs **broadcast** may differ. Perception must eventually **interpret** those signals for delivery rules (who saw "Generating," who needs cache-only refresh, etc.). |
| **Contract alignment phases A-C** | Land **before** the full perception refactor is realistic; they **encode obligations** listed below. |
| **This document** | Tracks the **consumer** refactor that **closes the loop**; see contract-align **Phase D** and **Phase E** (breadth). |

---

## Directional target (hypothesis - not a spec)

These bullets are **intentionally vague**; refine or replace as we learn.

1. **Ingress:** Perception becomes a **typed consumer** of internal (and eventually DataSource) **event streams** - not only imperative `perceptionMessage` entry points from scattered callers.
2. **Registration:** Support a pattern like **register** "when event family **X** arrives, accumulate toward **delivery pattern Y**" (headers, timeline, presence-gated messages) with explicit **correlation** keys where multi-step UX requires them.
3. **Aggregation:** Handle **out-of-order** arrivals (orchestration before cache, cache before perception, duplicate signals). **Duplicate intermediates** (e.g. several **Generating**-class updates) are **acceptable** for delivery; **duplicate terminal / final outputs** for the same logical completion are **not** --- Perception must **collapse** stream noise so registrants see **one** final outcome per correlation (see **Obligations** table, uncertainty **6**).
4. **Two delivery semantics** (from contract discussions): **correlated** updates (same audience as an earlier placeholder) vs **cache-wide** refresh (new arrivals). Perception may apply **different** routing rules; exact design TBD.
5. **Thin vertical first:** **state -> room render -> perception** for **room header/description** and **move** in the **first pass**; **player look**, **asset-driven header refresh**, **links**, and **map/knowledge** follow per [Out of scope for first pass](#out-of-scope-for-first-pass-legacy-bus-until-follow-on).
6. **Conversation role:** Reduce reliance on **conversation `sendMessage`** as the correlation backbone for render lifecycle; align with [`conversations/AGENT.md`](../../../../../lambda/ephemera/conversations/AGENT.md) (registry and correlation story).

---

## Obligations accruing to future Perception (working list)

Add rows as upstream decisions land. This is **debt we acknowledge** so we do not lose it in pass-through-only docs.

| Source | Obligation (draft) | Status |
| --- | --- | --- |
| Pass-through contract | Interpret **`Render Pertains`** (correlated) vs **`Cache Updated`** (abstract) for **different delivery audiences** (present for placeholder vs newly present). | TBD |
| Pipeline / orchestration | **`renderOrchestration`** removes **`conversation.sendMessage`** for lifecycle in favor of the **six outbound types** (see contract); perception must **not** assume conversation-backed correlation long-term. **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`** consumer rules **TBD**. **Multiple** **`Generation Started`** for one logical job is an **acceptable intermediate** edge case (pre-**`singleFlight`** idempotency / timeout recovery); align with contract **uncertainty 6** and [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md#single-flight-generation) **Single-flight generation**. | TBD |
| Pass-through contract **uncertainty 6** (subscriber idempotency) | Producers may emit **duplicate or retried** notifications; Perception **owns** collapsing those into **delivery** semantics: **repeated intermediate** states (e.g. multiple **Generating** / in-flight **`Render Pertains`**) are **fine**; a **registry of who wants what** must **not** surface **two terminal / final** deliveries for the **same** logical completion (same **`cacheId`** + routing identity, or agreed successor key). **Exact** dedupe strategy (monotonic version, last-write-wins, explicit generation nonce) **TBD** at implementation. | TBD |
| Contract uncertainties | Fan-in must stay **single-path** for passive orchestration (no silent fork); aligns with pass-through contract and rubric **section 4**. | TBD |
| Epic / rubric | **Fan-in** assembler role: merge orchestration progress, cache events, presence into **PublishMessage** / timeline rules. | TBD |
| Current code | Preserve or migrate behavior documented in [`perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md) (triggers, scale, navigation). | TBD |

**Uncertainty 6 (contract):** The pass-through doc leaves **idempotency and duplicate collapse** open at the **system** level. **Orchestration + cache** aim to avoid duplicate **generation** for the same state (**`singleFlight`** --- see [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md#single-flight-generation)); **duplicate** **`Generation Started`** may still occur **until** that work and optional **idempotency** land. **This plan** owns the remaining **subscriber** obligation: **terminal** dedupe for Perception-facing delivery, as in the table row above.

---

## Open questions (not exhaustive)

- **DataSource vs other boundary:** First pass assumes a **published** DataSource on the internal bus; a later **split** (ingress adapter vs domain core) is still allowed if complexity grows.
- **Subscription graph:** First pass: **bus-only** `StreamingEvent` subscription consistent with other ephemera DataSources; **EventBridge** / external replay remains a **later** epic theme unless we add it deliberately.
- **State storage:** **v1 prototype: in-memory** aggregation only; durable checkpoints **TBD** when we need replay or cross-invocation continuity.
- **Delivery sequencing (sub-task):** When aggregated state becomes **`PublishMessage`** (and how **correlated** vs **broadcast** semantics apply) --- refine alongside pass-through contract, timeline rules, and **delivery mechanics** (steps 4--5 in [Recommended order](#recommended-order)). **Transport:** partitioned drains / [`message bus lanes`](../../messageBus/AGENT.messageBusLanes.planning.md); perception logic sits **above** that.
- **Testing:** Contract tests for perception fan-in (see [`Encoding the contract in unit tests`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)); how much is **integration** vs **unit** with fake event streams?
- **Breadth ordering:** After first pass, do **look** and **asset header** share the **same** aggregator as **move** or stay on legacy longer? (Either is valid; list [Out of scope](#out-of-scope-for-first-pass-legacy-bus-until-follow-on) until we migrate them.)
- **Registration keys:** **`Render Pertains`** uses **component x perspective** (+ **`cacheId`**) on the wire, **not** **`conversationId`** (contract uncertainty 9 resolved). Does Perception register handlers by those **routing** dimensions so assembly does not depend on **delivery** fields being echoed on producer streams? (Aligned with [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md#correlation-vs-routing) **Correlation vs routing**.)

---

## Contract encoding in tests (this initiative)

Per [`AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests): add **placeholder or skipped** tests for intended fan-in behavior **early**, with reasons, and activate them as the refactor lands. This plan does not duplicate the full strategy; it **inherits** it.

---

## Verification

Run from **repository root** unless noted.

| Scope | Command | When |
| --- | --- | --- |
| **Ephemera package (default)** | `cd lambda/ephemera && npm test` | After any change under `lambda/ephemera/`; full suite before merge when touching shared behavior. |
| **Perception only (faster)** | `cd lambda/ephemera && npx jest perception/index.test.ts` | While iterating on [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts) and tests. |
| **DataSource / integration** | `cd lambda/ephemera && npx jest dataSource/` (or targeted path, e.g. `dataSource/renderCache/index.test.ts`) | When changing DataSource wiring or pass-through scaffolds. |
| **Patterns package** | `cd packages/mtw-lambda-patterns && npm test` | Only if you change `InternalMessageBus` or `DataSource` in [`packages/mtw-lambda-patterns`](../../../../../packages/mtw-lambda-patterns/) (e.g. with [message bus lanes](../../messageBus/AGENT.messageBusLanes.planning.md)). |

**Expectation:** Baseline is **green** before large refactors; new tests should pass with the matching **Recommended order** step. Add **integration** or **contract** tests when two layers are real enough to fail together (per pass-through planning).

---

## When this task completes

1. **All** [Recommended order](#recommended-order) lines are `[X]` (or explicitly cancelled with note).
2. Lasting behavior lives in [`lambda/ephemera/perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md) and code; **Obligations** table either merged into durable docs or marked superseded in a final edit here.
3. **Delivery sequencing** and pass-through alignment reflected in perception / renderCache docs as needed.
4. Archive or delete this task plan per [`taskPlanning/AGENT.md`](../../../../AGENT.md) so `taskPlanning/` stays current.

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan graduated (Getting Started, Recommended order, Verification) | Done |
| Prep: Message path removed; Knowledge/Map handler paths disabled | Done |
| Out-of-scope list + links | Done |
| Message bus lanes plan ([`../../messageBus/AGENT.messageBusLanes.planning.md`](../../messageBus/AGENT.messageBusLanes.planning.md)) | Draft exists; implementation tracked there |
| Obligations table vs pass-through contract | In progress (upstream) |
| Stub perception DataSource (Recommended order step 1) | Not started |
| Steps 2--7 | Not started |
| Initiative complete; durable docs updated; task plan retired | Not started |
