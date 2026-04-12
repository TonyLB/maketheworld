# Perception - big refactor (fan-in DataSource)

**Status:** In progress. **Next:** [Recommended order](#recommended-order) --- **`moveCharacter`** orchestration and perception aggregation (steps **6--7**). **Done (step 5):** room header aggregation (**`threadKind: 'roomHeaderBroadcast'`**, **`kickRoomHeaderBroadcast`**, **`orchestrate.ts`** fan-in). **Decided:** **Generating** header **`PublishMessage`** uses a **virtual lane** in lockstep with [step 4 room description **Lanes**](#recommended-order) (slow-path **`laneId`** from **`findRender`**, **`flushOrchestrationLane`** / partitioned **`flush`** so placeholders reach subscribers before long-running generation). **Decided:** header **WML** and delivery shape align with **[`lambda/ephemera/perception`](../../../../../lambda/ephemera/perception/)** (see **`sendRoomGeneratingHeader`** and related paths in [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts)). Transport reference: [**Virtual lanes**](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) (`InternalMessageBus`).

This file tracks the **large** refactor of Ephemera **perception** from today's largely **imperative** handlers toward an **event-driven fan-in** model (a **DataSource** boundary that **subscribes** to typed streams, **aggregates** partial state, and **delivers** when enough is known). It is **broader** than the pass-through / readiness contract alone; pass-through work is **groundwork** that accrues **obligations** on this shape.

**Maintenance:** Update [Recommended order](#recommended-order) checkboxes when a slice merges (after tests pass). Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) when changing process sections. Retire or archive this file when the initiative completes per that framework.

**Delivery sequencing** (when and how aggregated output becomes `PublishMessage` / client-visible updates) aligns with the pass-through contract ([`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md)) and [Delivery: message bus lanes](#delivery-message-bus-lanes-transport). Final **delivery mechanics** (audience, timeline vs in-place) refine as steps 4--5 land; **obligations** table tracks contract debt.

**Transport (lanes):** Cascade isolation on the **single** ephemera message bus is documented in [`packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) (**Virtual lanes**), with implementation in [`index.ts`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts). **`DataSource.streamEvent`** inheritance is in [`dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (**Message bus lanes**). Perception consumes that transport for **delivery**; do not duplicate lane design here.

---

## Purpose

- **Durable domain narrative** (audience vs internal frameworks, correlated vs immediate): [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md).
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
   - **DataSource patterns:** [`lambda/ephemera/dataSource/renderOrchestration/`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) (ingress, `subscribe()`), [`lambda/ephemera/dataSource/renderCache/`](../../../../../lambda/ephemera/dataSource/renderCache/) (consumes orchestration stream), [`lambda/ephemera/dataSource/perception/`](../../../../../lambda/ephemera/dataSource/perception/) (`mtw.ephemera.perception` stub; see [`AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md)). **Perception threads (step 3+):** [`lambda/ephemera/internalCache/perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts).
   - **Lambda entry / flush:** [`lambda/ephemera/app.ts`](../../../../../lambda/ephemera/app.ts) (`messageBus.flush()`).
   - **Lanes (transport):** [`Virtual lanes`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) in `mtw-lambda-patterns` --- coordinate if delivery must be lane-isolated before client-visible output. Ephemera entry: [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md).

4. **Implementation stance**
   - **Lift from imperative perception:** new `mtw.ephemera.perception` work **moves behavior and structure out of** [`lambda/ephemera/perception/`](../../../../../lambda/ephemera/perception/) (handlers, helpers) **into** the DataSource under [`lambda/ephemera/dataSource/perception/`](../../../../../lambda/ephemera/dataSource/perception/); keep [`lambda/ephemera/perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md) accurate as the split evolves.
   - **Upgrade using existing DataSources where they apply:** when adding ingress, subscription guards, published stream shapes, tests, or wiring, **prefer the same patterns as** [`renderOrchestration`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) and [`renderCache`](../../../../../lambda/ephemera/dataSource/renderCache/) **where a comparable pattern exists** (for example `api.ephemera` ingress helpers, `subscribedEvents` / `publishedEvents`, `EphemeraDataSource` + `subscribe()`). Perception-specific fan-in will not map one-to-one to every orchestration or cache concern; treat those trees as **reference implementations**, not a spec to force-fit.

5. **Tests to mirror**
   - [`lambda/ephemera/perception/index.test.ts`](../../../../../lambda/ephemera/perception/index.test.ts), [`lambda/ephemera/dataSource/renderCache/index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests) (placeholder / skipped tests with reasons).

6. **Next task**
   - Open [Recommended order](#recommended-order); the first unchecked `[ ]` is next (after baseline `[X]`). After a change merges, mark the matching line `[X]` and run **Verification**.

7. **Baseline before you edit**
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
- [X] **Stub** `mtw.ephemera.perception` (or agreed `dataSourceKey`): **bus-published** `EphemeraDataSource`, `subscribe()` wired, same internal `StreamingEvent` patterns as [`renderOrchestration`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) / [`renderCache`](../../../../../lambda/ephemera/dataSource/renderCache/); no EventBridge for the stub. Code: [`lambda/ephemera/dataSource/perception/`](../../../../../lambda/ephemera/dataSource/perception/).
- [X] **Character perception** inside the DataSource plus **`api.ephemera`**-style **invoking** ingress (mirror [`sendRenderRequested`](../../../../../lambda/ephemera/dataSource/renderOrchestration/subscribedEvents.ts) patterns).
  - **Ingress `header.type`:** `Character Perception Requested`.
  - **`getContent()` payload:** `CharacterPerceptionRequestedCommand` in [`lambda/ephemera/dataSource/perception/localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts) (field parity with [`PerceptionComponentMessage`](../../../../../lambda/ephemera/messageBus/baseClasses.ts) where applicable).
  - **`streamKey`:** viewed character **`ephemeraId`** (`CHARACTER#...`), not the viewer `characterId` (matches other `api.ephemera` per-entity keys).
  - **Call-sites:** migrate incrementally as the work lands (tidy, no big-bang) --- first bridge: imperative [`perceptionMessage`](../../../../../lambda/ephemera/perception/index.ts) Character branch.
  - **Output:** `receiveEvents` emits **`PublishMessage`** only; no `mtw.ephemera.perception` outbound stream carry-forward in this step (add later if needed).
  - **Non-goals:** no `renderOrchestration` / `renderCache` subscription for Character; no rendering **lanes** for Character in this step.
- [X] **In-memory** aggregation cache prototype (running collected state; durable checkpoints **out of scope** unless needed).
  - [X] **Scope (decided):** the cache **exists** for later steps to build on. **No** new fan-in from `renderOrchestration` / `renderCache`, **no** new **`PublishMessage`** behavior driven solely by thread state, and **no** merge/dedupe/stream semantics beyond what is listed in the next bullets --- those ship with steps **4--7**. See [Step 3 minimal scope](#step-3-minimal-scope-recommended-order).
  - [X] **Types (decided):** stub **thread** variant(s), a **discriminated union**, and **type guards** (plus any small TypeScript helpers) live in [`lambda/ephemera/internalCache/perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts); unit tests for guards in [`lambda/ephemera/internalCache/perceptionThreads.test.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.test.ts). See [Perception thread types (step 3)](#perception-thread-types-step-3).
  - [X] **Registration ingress (decided):** one new **`api.ephemera`** ingress (synthetic **`header.type`**, see [Thread registration ingress (api.ephemera)](#thread-registration-ingress-apiephemera)) so callers can **register** a thread; the perception DataSource handles it and calls **`register`** on **`internalCache.PerceptionThreads`** (append a row under the composite key **`componentId` + `perspectiveKey`**; **multiple** rows may share that key). No other new DataSource behavior required in step 3.
  - [X] **Routing identity (decided):** aggregation **composite key** for bucketing is **`componentId` + `perspectiveKey`** only; **`cacheId`** is **not** a key segment (late on generate paths; stored as **per-row** state when events carry it). See [Decisions](#decisions).
  - [X] **Placement (decided):** state lives on **`internalCache.PerceptionThreads`** ([`InternalCache`](../../../../../lambda/ephemera/internalCache/index.ts) property + **`clear()`** wiring; **no** **`flush()`** --- not Dynamo-backed). See [Aggregation cache placement (internalCache)](#aggregation-cache-placement-internalcache).
- [X] **Room description** aggregation (prototype for **correlated** perception threads; **fan-in and state first**; **delivery mechanics** (who, timeline vs in-place) refine with pass-through + [virtual bus lanes](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) as needed).
  - **Thread shape:** add a **Room description** thread variant in [`lambda/ephemera/internalCache/perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) (discriminated union) holding **runtime** fields updated as events are handled; keep using **`Perception Thread Registered`** with content type [`PerceptionThreadRegisterCommand`](../../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts): a **`threadKind`** discriminant (**`roomDescription`** | **`stub`** today) plus **`componentId`**, **`perspectiveKey`**, and for **`roomDescription`** a **required** **`characterId`** (requester). Validation lives in **`isPerceptionThreadRegisterCommand`**.
  - **`PerceptionThreads` API (decided):** **`register`** appends a row under **`componentId` + `perspectiveKey`** (does **not** replace siblings); if the payload omits **`registrationId`**, assign a **synthetic** **`uuidv4()`**. **`list`** returns all rows for that composite key (stream handlers iterate). **`update`:** **shallow merge** into the row matching **composite key** + **`registrationId`**. **`remove`:** drop **one** row by **composite key** + **`registrationId`**. **No** cross-registration dedupe in the first iteration. See [Room description prototype (step 4)](#room-description-prototype-step-4) and [Aggregation cache routing identity](#aggregation-cache-routing-identity).
  - **Matching (decided):** for **`Render Pertains`** and **`Generation Started`**, an event is **relevant** to a **row** when **`componentId`** and **`perspectiveKey`** match **exactly** (same **precise** string identity as registration); handlers **`list`** that bucket and process each matching **`kind`**. **`cacheId`** remains **per-row** state filled from payloads when present; it is **not** an extra match predicate in step 4 (see [Aggregation cache routing identity](#aggregation-cache-routing-identity)).
  - **Lanes (decided):** the **main** cascade (**`executeAction`**, **`renderOrchestration`**, **`renderCache`**, perception **`receiveEvents`** for **non-Generating** work) stays on the **default** lane unless a slice explicitly opts in. Allocate **`laneId` = `uuidv4()`** in **[`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts)** at the **slow-path** handoff into **`generateRoomPreview`** (the branch that can emit **`Generation Started`**), aligned with the same **lane flush** story as **`flushOrchestrationLane`** in [`generateRoomPreview.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) (partitioned **`flush`** so **Generating** can reach subscribers **before** long-running generation). Thread that **`laneId`** through **`publishOrchestration`** / bus **`send`** for **Generating**-related **StreamingEvent** traffic only; **do not** move the **whole** cascade off the default lane.
  - **Terminal dedupe (decided):** if **`status`** is already **`Terminal`** and another **relevant** stream event would otherwise run a handler (**`Render Pertains`**, **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`**), **`console.log`** and **ignore** (no second **`PublishMessage`**). In particular, perception **does not** reason about whether **`Generation Started` "should"** have fired; a **late** **`Generation Started`** that would only produce a **Generating** placeholder after **`Terminal`** is **ignored**. While **not** terminal, duplicate **`Generation Started`** remains an **acceptable intermediate** per pass-through **uncertainty 6**.
  - **Disambiguation:** multiple discriminated **`kind`** values for the same **`(componentId, perspectiveKey)`** are **not** in scope for **step 4** implementation. **Step 5** adds **Room Broadcast** alongside **Room Description** as **separate** rows in the **same** composite-key bucket; **singleFlight** on the pipeline still yields one authoritative render for that perspective --- see [Room header prototype (step 5)](#room-header-prototype-step-5).
  - **Runtime fields (plan):** **`status`**: **`Initial` | `Generating` | `Terminal`** (names provisional until typed); **`messageId`**: last client **`MessageId`** when a **Generating** placeholder was shown, so **terminal** **`PublishMessage`** can **overwrite** in the client (omit / N/A on **no-slow** paths where no placeholder was sent).
  - **Persistence note (code comments + durable docs):** Room description **need not** keep the **finished render** in the thread bucket after **terminal** delivery (emit full description and drop). **Later** threads may **retain** terminal render (or summaries) and **combine** with **other inputs** arriving **separately** or **later**; call out that contrast on the thread type.
  - **Entry path (decided):** for this slice, **register** the thread and **kick** render from **`executeAction`** only ([`lambda/ephemera/parse/executeAction.ts`](../../../../../lambda/ephemera/parse/executeAction.ts)); do not wire **`checkLocation`**, **`perceptionMessage`**, or other callers for the **Room Examine** correlated path until a deliberate follow-on.
  - **UX (decided, no-slow path):** on **cache hit** paths (**`Current Cache Valid`** / **`Exact Match Found`** leading to **`Render Pertains`** without **`Generation Started`**), the user **does not** see a **Generating** placeholder; they only see output when the **terminal** description **`PublishMessage`** arrives.
  - **Generating placeholder (decided, slow path):** **`PublishMessage`** / **`PerceptionMessage`** for **Generating** must use the **same shape** as the **full** room description message (same **`displayProtocol`**, **`metaData`** conventions as terminal **full** room, e.g. **`displayMode: 'full'`** and **`componentUUID`**) but the **description content** is dirt-simple placeholder text (e.g. literal **Generating**); **not** real render WML. **Copy and UI** are **throwaway** until a later polish pass.
  - **Handler module (plan):** implement **fan-in** reactions in a dedicated file under [`lambda/ephemera/dataSource/perception/`](../../../../../lambda/ephemera/dataSource/perception/) (e.g. **`orchestrate.ts`**) instead of only inline in **`index.ts`** / `receiveEvents`. Use **`internalCache.PerceptionThreads.update`** (**shallow merge**) for **runtime** / **status** / **`messageId`** / **`cacheId`** patches after registration; keep **`register`** for the **initial** **`Perception Thread Registered`** row (with **synthetic id** when omitted).
    - **`Render Pertains`** (**`mtw.ephemera.renderCache`**), when **relevant** (**`componentId` + `perspectiveKey`** match; see **Matching** above) and not skipped by **Terminal dedupe**: for each matching **`roomDescription`** row, **dispatch** full room description **`PublishMessage`**; if a **Generating** placeholder **`messageId`** exists, **overwrite**; then **`remove`** that registration row.
    - **`Generation Started`** (**`mtw.ephemera.renderOrchestration`**, the **slow-path / in-flight** signal in the [six-outbound taxonomy](../AGENT.passThrough.contract.planning.md); not a separate **`Generation Requested`** event name): only when **generation actually runs**; for each **relevant** **`roomDescription`** row (**`componentId` + `perspectiveKey`** match), if **`status`** is **not** **`Terminal`** and not skipped by **Terminal dedupe**, **dispatch** the **Generating** placeholder **`PublishMessage`** (per **Generating placeholder** above), persist the returned **`messageId`**, **`update`** that row to **`Generating`** (duplicate **`Generation Started`** while still **not** **`Terminal`** is an **acceptable intermediate** per pass-through **uncertainty 6**).
    - **`Orchestration Error`** or **`Generation Deferred`** (**`mtw.ephemera.renderOrchestration`**), for each **relevant** **`roomDescription`** row (**`componentId` + `perspectiveKey`** match), if still **unresolved** and not skipped by **Terminal dedupe**: **dispatch** a **`PublishMessage`** that matches the **terminal** room-description shape with dirt-simple placeholder copy (e.g. literal **Error**); **overwrite** a prior **Generating** **`messageId`** when one exists, **same as success terminal**; then **`remove`** that registration row so we do not double-deliver.
  - **`Cache Updated` (not step 4):** do **not** subscribe perception to **`Cache Updated`**-only fan-in for Room Description in this step. **Future (out of scope):** before the lambda exits, a **sweep** of **unfulfilled** perception threads could reconcile expectations; until then, scenarios that would have depended on **`Cache Updated`** alone are explicitly deferred.
- [X] **Room header** aggregation (broadcast **generating** + **terminal**; **fan-in** and stream handlers analogous to step 4 **room description**, with normative choices in [Room header prototype (step 5)](#room-header-prototype-step-5)).
  - [X] **Correlation (decided):** **`RoomCharacterList`** for the room, grouped by **`perspectiveKey`** (same **canon stack + per-character assets** shaping as [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts)); register a **`Room Broadcast`** (name TBD) perception **thread** per **`(componentId, perspectiveKey)`** holding **target character ids** for delivery; **one** passive render kick **per** **`perspectiveKey`** via **`Render Requested`** / **`orchestrateRenderRequest`** with **`targets`** (not N independent kicks per character when perspectives align).
  - [X] **Composite key vs room description (decided):** keep **`componentId` + `perspectiveKey`** as the **`PerceptionThreads`** bucketing key (**multiple** rows per bucket); **singleFlight** on generation implies **Room Broadcast** and **Room Description** rows for the same bucket still observe the **same** authoritative render from the pipeline, so we **do not** add a separate key dimension solely to disambiguate that edge case.
  - [X] **Terminal WML (decided):** **`internalCache.ComponentRender.get(characterId, roomId, { header: true })` per target** in this iteration; **document** follow-on optimization if identical **`perspectiveKey`** can safely share one resolved header payload.
  - [X] **`PublishMessage` shape (decided):** **multi-target** sends (**`targets`** = all characters in that perspective group), matching legacy [`sendRoomGeneratingHeader`](../../../../../lambda/ephemera/perception/index.ts) (**single** `PublishMessage`, **`displayMode: 'header'`**, shared **`messageId`** where applicable for placeholder overwrite semantics).
  - [X] **Entry path (decided):** **new** wiring that **replaces** imperative **`type: 'Perception'`** **`header: true`** enqueue (today from **`processComponentUpdated`** in [`dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) for rooms, and the **asset** branch of [`perceptionMessage`](../../../../../lambda/ephemera/perception/index.ts) that re-queues **`Perception`** per linked room): run **grouping + thread register + render request** (reuse shared helpers with passive **`State Changed`** fan-out where practical). **Terminal dedupe / stream matching** follow step 4 patterns unless this step explicitly narrows them. **`moveCharacter`** stays **[Recommended order](#recommended-order)** steps **6--7**.
  - [X] **Lanes (decided):** **same pattern as step 4 room description.** The **main** cascade stays on the **default** lane. **Generating** header **`PublishMessage`** for the broadcast thread must be **lane-isolated** so it is **flushed immediately** when generation starts: use the **slow-path** **`laneId`** allocated in **[`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts)** at the handoff into **`generateRoomPreview`**, thread it through **`publishOrchestration`** / bus **`send`** for **Generating**-related **StreamingEvent** traffic only, and **`flushOrchestrationLane`** (partitioned **`flush`**) as in [`generateRoomPreview.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) --- do **not** move the **whole** cascade off the default lane.
  - [X] **Handler module:** extend [`orchestrate.ts`](../../../../../lambda/ephemera/dataSource/perception/orchestrate.ts) (or a sibling) for **`roomHeader` / Room Broadcast** fan-in; extend **registration / types** in [`perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) / [`localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts) as needed. **Registration / ingress shape (decided for extension):** **`Perception Thread Registered`** content stays **`PerceptionThreadRegisterCommand`**; add a **third** **`threadKind`** (e.g. **`roomHeaderBroadcast`**) with **`targets`** (and related fields) rather than a parallel payload type --- see [Room header prototype (step 5)](#room-header-prototype-step-5).
  - [X] **Thread runtime (decided):** mirror **`roomDescription`** (**`status`**, **`messageId`**, optional **`cacheId`**, terminal dedupe per row) unless implementation discovers a slimmer shape; exact field list is **implementation detail**.
  - [X] **`generationContextWml` (decided):** **not** required on **`Render Requested`** for this slice; omit it (or equivalent) on the broadcast-header kick unless a later constraint appears.
  - [X] **WML and client-visible shape (decided):** **Generating**, **Error**, and **terminal** header **`PublishMessage`** payloads (**WML**, **`displayProtocol`**, **`metaData`**, **`displayMode: 'header'`**, multi-**`targets`**, shared **`messageId`** / overwrite semantics) **must match** the conventions used in **[`lambda/ephemera/perception`](../../../../../lambda/ephemera/perception/)** for the **same roles** --- **[`sendRoomGeneratingHeader`](../../../../../lambda/ephemera/perception/index.ts)** and any related imperative paths are the **normative reference** (lift or mirror structure when implementing under **`mtw.ephemera.perception`**). Step 4 **dirt-simple** placeholder **copy** norms still apply where legacy uses minimal text; do **not** invent a parallel header message shape.
  - [X] **Factoring (decided):** extract **shared** helpers (for example grouping **`RoomCharacterList`** by **`perspectiveKey`** and invoking **`orchestrateRenderRequest`**) where it reduces duplication with [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts); **module boundaries** are **implementation detail**.
- [ ] **Refactor `moveCharacter`** to start a **`renderOrchestration`**-driven cascade (replace or narrow direct imperative `Perception` where appropriate).
- [ ] **Aggregate `moveCharacter`** outcomes in the perception DataSource (end-to-end with room description/header).

**At a glance (same steps):**

| Step | What | Notes |
| --- | --- | --- |
| -- | Baseline | Done --- see [Current baseline](#current-baseline-prep-work-done). |
| 1 | Stub perception DataSource | Done --- bus-only; see [`dataSource/perception/`](../../../../../lambda/ephemera/dataSource/perception/). |
| 2 | Character perception + `api.ephemera` ingress | Done: `Character Perception Requested`; `CharacterPerceptionRequestedCommand`; `streamKey` = viewed `ephemeraId`; `PublishMessage` only; `perceptionMessage` bridge. |
| 3 | In-memory aggregation cache | Done: [minimal scope](#step-3-minimal-scope-recommended-order); [`perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts), [`perceptionThreads.test.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.test.ts); **`Perception Thread Registered`** / **`sendPerceptionThreadRegistered`**; **`internalCache.PerceptionThreads`**. |
| 4 | Room description aggregation | **`executeAction`** only; **`characterId`** required; **`kind: 'roomDescription'`** on the thread record; **`register`** + **`list`** + **`update`** (**shallow merge**) + **`remove(registrationId)`** + synthetic **registration id**; **`uuidv4()`** **laneId** from **`findRender`** slow path for **Generating**; default lane for **main** thread; match **`componentId` + `perspectiveKey`**; **terminal** -> **log** + ignore; see [Recommended order](#recommended-order) / [Decisions](#decisions). |
| 5 | Room header aggregation | Done --- broadcast by **`perspectiveKey`**; same bucket as description; **`ComponentRender.get(..., { header: true })` per target**; **multi-target** **`PublishMessage`**; **no** **`generationContextWml`**; **WML / message shape** per **[`lambda/ephemera/perception`](../../../../../lambda/ephemera/perception/)** (**`sendRoomGeneratingHeader`** / **`roomHeaderPlaceholderWml.ts`**); **virtual lane** for **Generating** (same as step 4 **`findRender`** / **`flushOrchestrationLane`**); **`threadKind: 'roomHeaderBroadcast'`**; see [Room header prototype (step 5)](#room-header-prototype-step-5). |
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
| [`ts/messageBus/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) | **Virtual lanes** on `InternalMessageBus`: partitioned `flush`, `send(payload, laneId?)`, single subscription graph; transport for decoupled cascades before perception client delivery |

---

## Delivery: message bus lanes (transport)

**Problem:** Orchestration and downstream `StreamingEvent` traffic share one **`InternalMessageBus`**; we still want **independent drains** for multi-step cascades without a second bus instance or duplicate DataSource subscriptions.

**Owned in patterns + DataSource docs:** [`Virtual lanes`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) (queue-cell lane metadata, **centralized filtering in `flush`**), [`messageBus/index.ts`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/index.ts), and **Message bus lanes** in [`dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (`streamEvent` / `streamEnvelope`). Ephemera wiring: [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md), [`renderOrchestration`](../../../../../lambda/ephemera/dataSource/renderOrchestration/).

**This plan (perception):** **Fan-in**, aggregation, and **when** to emit **`PublishMessage`** / client-visible updates given lane semantics above. **Room description (step 4):** **default lane** for the **main** thread; **`uuidv4()`** **laneId** allocated in **`findRender`** on the **generation** path for **Generating**-scoped traffic (see [Room description prototype (step 4)](#room-description-prototype-step-4)). **Cross-lane hand-off** (default lane vs named lane) is documented in **Virtual lanes** (non-goals / follow-ons).

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

## Decisions

Normative choices for this initiative (update here if reversed).

### Step 3 minimal scope (recommended order)

- **Intent:** Land **`internalCache.PerceptionThreads`** and **type scaffolding** so later steps can add behavior **without** redesigning storage or keys.
- **In scope:** handler on [`InternalCache`](../../../../../lambda/ephemera/internalCache/index.ts); **`clear()`** wiring; types / union / type guards in [`perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) and tests in [`perceptionThreads.test.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.test.ts); **one** new **`api.ephemera`** ingress for **thread registration** and the minimal **`register`** path on the cache (see [Thread registration ingress (api.ephemera)](#thread-registration-ingress-apiephemera)).
- **Out of scope for step 3:** subscribing perception to **`renderOrchestration`** / **`renderCache`** for fan-in; merging stream events into threads; terminal dedupe; new **`PublishMessage`** outcomes **because of** thread aggregation (Character perception and existing behavior unchanged aside from registration handling). **Thread runtime behavior** beyond **register + store** is **deferred** --- see [Thread behavior (later steps)](#thread-behavior-later-steps).

### Perception thread types (step 3)

- **Module (normative):** [`lambda/ephemera/internalCache/perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) holds the **`PerceptionThreads`** handler class (or equivalent) **and** shared **TypeScript** types: at least one **stub** thread representation suitable for initial development, a **discriminated union** of thread variants (extensible later), and **type guards** (and small helpers as needed).
- **Tests (normative):** [`lambda/ephemera/internalCache/perceptionThreads.test.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.test.ts) covers **type guards** (and any narrow validation helpers) as appropriate; broader fan-in tests stay with [contract encoding](#contract-encoding-in-tests-this-initiative) / DataSource tests as later steps land.

### Thread registration ingress (api.ephemera)

- **Normative:** Add **one** synthetic **`api.ephemera`** ingress event (same invoking pattern as **`Character Perception Requested`** in [`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/subscribedEvents.ts)) whose purpose is **only** to **register** a perception thread (delivery-side correlation fields + **`componentId` + `perspectiveKey`** per [routing identity](#aggregation-cache-routing-identity)).
- **`header.type` (normative name):** **`Perception Thread Registered`** --- payload type and **`streamKey`** rules live next to other perception ingress types (e.g. extend [`localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts) or a sibling module); wire guards/send-helper alongside Character ingress in `subscribedEvents.ts` (or agreed split).
- **DataSource behavior:** **`mtw.ephemera.perception`** `receiveEvents` (or the single subscription path) **must** recognize this envelope and call **`internalCache.PerceptionThreads.register(...)`** so a row is **appended** under the composite key **`componentId` + `perspectiveKey`** (**multiple** rows allowed per key). **No** other new perception DataSource behavior is required in step 3. **Step 4** adds **`list`** / stream fan-in, **`update`** (**shallow merge**), **`remove`**, and **synthetic registration id** when omitted on **`register`**; see [Room description prototype (step 4)](#room-description-prototype-step-4).

### Thread behavior (later steps)

- **Normative:** Merge rules, stream-driven updates, terminal dedupe, **`PublishMessage`** orchestration from thread state, and related **product** behavior are **not** specified in step 3; they are introduced **incrementally** as steps **4--7** and the [Obligations](#obligations-accruing-to-future-perception-working-list) table are implemented.

### Room description prototype (step 4)

Normative choices for the **Room description** slice in [Recommended order](#recommended-order); detail and UX live in the nested bullets there.

- **`characterId`:** **Required** for **Room Examine** / Room description (requester); not optional for this thread.
- **`PerceptionThreads`:** **`register`** (append a row per **`componentId` + `perspectiveKey`**; assign **synthetic registration id** **`uuidv4()`** when ingress omits one), **`list`**, **`update`** (**shallow merge** by **composite key** + **registration id**), and **`remove`** (**one** row). **Registration open** vs **fan-in patch** remain distinct intents.
- **Stream relevance:** **`Render Pertains`** and **`Generation Started`** match threads on **`componentId` + `perspectiveKey`** (**precise** string equality). **`cacheId`** is **bucket** state only for step 4, not an additional filter.
- **Lanes:** **Default lane** for the **main** orchestration / cache / perception flow. **`laneId` = `uuidv4()`** created in **[`findRender`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts)** when entering the **`generateRoomPreview`** path; use it for **Generating**-related **StreamingEvent** / **`flushOrchestrationLane`**-coupled traffic only (see [`generateRoomPreview.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts)).
- **Already terminal:** **`console.log`** and **ignore** further **relevant** events, including a **late** **`Generation Started`** that would only add a **Generating** placeholder (no reasoning about **whether** generation **should** have started).
- **Error terminal:** **`Orchestration Error`** / **`Generation Deferred`** outcomes use the **same terminal** **`PublishMessage`** treatment as success (**overwrite** **Generating** **`messageId`** when present).
- **Copy:** **Generating** / **Error** strings are **placeholder** copy for later UI work.

### Room header prototype (step 5)

Normative choices for the **Room header / broadcast** slice in [Recommended order](#recommended-order); operational detail lives in the nested bullets there.

- **Registration / ingress shape (decided):** **`Perception Thread Registered`** content remains **`PerceptionThreadRegisterCommand`**; add a **third** **`threadKind`** (e.g. **`roomHeaderBroadcast`**) with **`targets`** (and related fields). Validate in [`localApiEvents.ts`](../../../../../lambda/ephemera/dataSource/perception/localApiEvents.ts); **`register`** in [`perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts) follows the same discriminated pattern as **`roomDescription`** / **`stub`**.
- **Broadcast correlation:** Group **`RoomCharacterList`** by **`perspectiveKey`**; **one** **`orchestrateRenderRequest`** (or equivalent) **per** **`perspectiveKey`** with **`targets`** listing that group's characters; register a **Room Broadcast** thread variant (exact **`kind`** name TBD) per **`componentId` + `perspectiveKey`** carrying delivery targets.
- **Composite key bucket:** Reuse **`componentId` + `perspectiveKey`**; **Room Broadcast** and **Room Description** are **separate** **`PerceptionThreadEntry`** rows in that bucket. **singleFlight** on the pipeline means both rows still observe the **same** authoritative generation result --- **no** extra key segment required.
- **Terminal WML (v1):** **`ComponentRender.get(characterId, roomId, { header: true })` per target**; **future work:** avoid redundant work when **`perspectiveKey`** guarantees identical header output.
- **Delivery / WML (decided):** **Multi-target** **`PublishMessage`** and header **WML**, **`displayProtocol`**, **`metaData`**, and placeholder **copy** **must align** with **[`lambda/ephemera/perception`](../../../../../lambda/ephemera/perception/)** for equivalent message roles --- **[`sendRoomGeneratingHeader`](../../../../../lambda/ephemera/perception/index.ts)** and related code are **normative**; implement under **`mtw.ephemera.perception`** by **lifting or mirroring** that behavior, not inventing a divergent client shape.
- **Lanes (decided):** **Generating** header **`PublishMessage`** uses the **same virtual-lane pattern** as [Room description prototype (step 4)](#room-description-prototype-step-4): **`laneId`** from **`findRender`** slow path into **`generateRoomPreview`**, **Generating**-related **StreamingEvent** on that lane, **`flushOrchestrationLane`** so **Generating** is delivered **immediately** before long-running generation; **default lane** for the rest of the cascade.
- **Entry path:** Replace **`processComponentUpdated`** room **`Perception`** **`header: true`** in [`dataSource/index.ts`](../../../../../lambda/ephemera/dataSource/index.ts) and the **asset**-driven room **`Perception`** re-queue in [`perception/index.ts`](../../../../../lambda/ephemera/perception/index.ts) with the **grouping + register + render** pipeline; **`moveCharacter`** remains steps **6--7**.
- **Thread runtime:** Mirror **`roomDescription`** per-row state (**`status`**, **`messageId`**, terminal dedupe) unless a slimmer variant proves sufficient; **exact fields** left to implementation.
- **`Render Requested` payload:** **Do not** require **`generationContextWml`** (or equivalent) for this broadcast-header path in v1.
- **Factoring:** Prefer **shared** grouping / **`orchestrateRenderRequest`** helpers alongside [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) when it pays off; **file layout** left to implementation.

### Aggregation cache routing identity

- **Composite key** for the in-memory fan-in / aggregation prototype ([Recommended order](#recommended-order) step 3): **`componentId` + `perspectiveKey`** only (**bucket** may hold **multiple** **`PerceptionThreadEntry`** rows).
- **`cacheId` is not** part of the key. It arrives late on generate paths; once known, it is **per-bucket state** updated from **`Render Pertains`** (or ID-only hit outbounds). Aligns with pass-through **Routing identity on producer streams** and uncertainty **9** in [`AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) (perception matches on **`componentId` + `perspectiveKey`** plus **registration**). **Step 4** adds the **precise** match rule for **`Render Pertains`** / **`Generation Started`** in [Room description prototype (step 4)](#room-description-prototype-step-4).
- **`Render Pertains` carries `cacheId` --- matching vs bucket state:** Producers include **`cacheId`** on **`Render Pertains`** for **cache content and durability**; that does **not** mean perception must use **`cacheId`** to **match** or **route** events to a thread. **Matching** stays **`componentId` + `perspectiveKey`** (and cached registration), per [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../../lambda/ephemera/dataSource/renderCache/AGENT.md#correlation-vs-routing) (**Correlation vs routing**). When a payload includes **`cacheId`**, perception may still **persist** it on the thread (e.g. **`currentCacheId`**) for **later** behavior (dedupe, alignment with cache lifecycle) --- separate from the match predicate. **Step 3** registration: **`api.ephemera`** **`Perception Thread Registered`** --- [Thread registration ingress (api.ephemera)](#thread-registration-ingress-apiephemera).
- **Terminal dedupe** (pass-through uncertainty **6**, [Obligations](#obligations-accruing-to-future-perception-working-list) table) may still define "same logical completion" using **`cacheId` + routing identity** without using **`cacheId`** to **open** an aggregation entry. **Step 4 Room description:** once **`Terminal`**, **ignore** further **relevant** deliveries with **`console.log`** only, including **late** **Generating**-only paths ([Room description prototype (step 4)](#room-description-prototype-step-4)). **Error** paths are **terminal** and **overwrite** a prior **Generating** **`messageId`** like success **terminal**.
- **Concurrency:** If two logical completions could overlap for the same **`(componentId, perspectiveKey)`**, policy may add a **generation epoch** or nonce at registration (**TBD**); the default is **not** to use **`cacheId`** as the primary map key without revisiting this decision.

### Aggregation cache placement (internalCache)

- **Property name (normative):** **`internalCache.PerceptionThreads`** --- the [`InternalCache`](../../../../../lambda/ephemera/internalCache/index.ts) member holding fan-in aggregation state. Primary implementation lives in [`perceptionThreads.ts`](../../../../../lambda/ephemera/internalCache/perceptionThreads.ts); the **`InternalCache`** field name is **`PerceptionThreads`**.
- **Normative:** The in-memory fan-in / aggregation store for **`mtw.ephemera.perception`** ([Recommended order](#recommended-order) step 3 onward) is **`internalCache.PerceptionThreads`**, with **`PerceptionThreads.clear()`** (or equivalent on the handler object) invoked from [`InternalCache.clear()`](../../../../../lambda/ephemera/internalCache/index.ts) each lambda invocation boundary, same lifecycle as other handlers. Do **not** keep aggregation state only in ad-hoc module globals detached from that reset path.
- **`flush()` (normative):** **Do not** register **`PerceptionThreads`** in [`InternalCache.flush()`](../../../../../lambda/ephemera/internalCache/index.ts). This cache is **not** Dynamo-backed and has **no** async drain comparable to **`RenderCache.flush()`**; **`clear()`** per invocation is sufficient.
- **Structural example:** [`internalCache.Global`](../../../../../lambda/ephemera/internalCache/global.ts) (**`CacheGlobalData`**) shows a handler owned by the **`InternalCache`** singleton and cleared with the aggregate **`clear()`** (per-invocation **process-supporting** state, not necessarily `DeferredCache`-backed). Perception aggregation may use a **map-shaped** handler closer to [`OrchestrateMessages`](../../../../../lambda/ephemera/internalCache/orchestrateMessages.ts) in spirit; the **decision** is **cluster + lifecycle + property name**, not reusing **`Global`** fields for fan-in rows.
- **Durable docs:** [`lambda/ephemera/internalCache/AGENT.md`](../../../../../lambda/ephemera/internalCache/AGENT.md) notes this placement; [`lambda/ephemera/dataSource/perception/AGENT.md`](../../../../../lambda/ephemera/dataSource/perception/AGENT.md) references it for the DataSource.

### Plan assumptions (normative for this initiative)

- **Published DataSource:** Treat **`mtw.ephemera.perception`** as a **published** Ephemera DataSource on the internal bus **throughout** this plan (same **`StreamingEvent`**, **`subscribedEvents`**, and **`publishedEvents`** patterns as other ephemera DataSources). A later **split** (ingress adapter vs domain core) remains allowed if complexity grows.
- **Bus-only subscription graph:** **Subscribe** and **publish** perception-related streams via the **internal bus only**, consistent with other ephemera DataSources. **EventBridge** / external replay is **out of scope** for this plan unless we add it deliberately.
- **In-memory aggregation:** For this task plan, fan-in state is **in-memory only** on **`internalCache.PerceptionThreads`** ([placement](#aggregation-cache-placement-internalcache)); **no** durable checkpoints until replay or cross-invocation continuity requires them (**TBD**).

---

## Open questions (not exhaustive)

- **Delivery sequencing (sub-task):** When aggregated state becomes **`PublishMessage`** (and how **correlated** vs **broadcast** semantics apply) --- refine alongside pass-through contract, timeline rules, and **delivery mechanics** (steps 4--5 in [Recommended order](#recommended-order)). **Transport:** partitioned drains / [`Virtual lanes`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus); perception logic sits **above** that. **Step 4:** **default lane** for **main** work; **`uuidv4()`** **laneId** from **`findRender`** slow path for **Generating** ([Room description prototype (step 4)](#room-description-prototype-step-4)). **Step 5 (decided):** room-header **Generating** uses the **same lane pattern** as step 4; **WML** aligns with [`lambda/ephemera/perception`](../../../../../lambda/ephemera/perception/) ([Room header prototype (step 5)](#room-header-prototype-step-5)).
- **Testing:** Contract tests for perception fan-in (see [`Encoding the contract in unit tests`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)); how much is **integration** vs **unit** with fake event streams?
- **Breadth ordering:** After first pass, do **look** and **asset header** share the **same** aggregator as **move** or stay on legacy longer? (Either is valid; list [Out of scope](#out-of-scope-for-first-pass-legacy-bus-until-follow-on) until we migrate them.)

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
| **Patterns package** | `cd packages/mtw-lambda-patterns && npm test` | Only if you change `InternalMessageBus` or `DataSource` in [`packages/mtw-lambda-patterns`](../../../../../packages/mtw-lambda-patterns/) (e.g. [Virtual lanes](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus) or **Message bus lanes** in DataSource). |

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
| Virtual lanes (`InternalMessageBus`) | Shipped: [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/messageBus/AGENT.implementation.md#virtual-lanes-internalmessagebus), [`lambda/ephemera/messageBus/AGENT.md`](../../../../../lambda/ephemera/messageBus/AGENT.md) |
| Obligations table vs pass-through contract | In progress (upstream) |
| Stub perception DataSource (Recommended order step 1) | Done ([`lambda/ephemera/dataSource/perception/`](../../../../../lambda/ephemera/dataSource/perception/)) |
| Character perception + api.ephemera ingress (Recommended order step 2) | Done |
| Aggregation cache map key: **`componentId` + `perspectiveKey`** (not **`cacheId`**) | Done --- [Decisions](#decisions) |
| **`internalCache.PerceptionThreads`** (normative name; **`clear()`** only, no **`flush()`**) | Done --- [Decisions](#decisions) |
| Step 3 scope + registration ingress + `perceptionThreads` module paths | Done --- [Decisions](#decisions) |
| Recommended order step 3 (in-memory cache + registration ingress) | Done |
| Step 4 (room description) | Done |
| **`PerceptionThreads` multi-entry** (**`register`** / **`list`** / **`remove(registrationId)`** per composite key) | Done |
| Step 5 (room header aggregation) | Done |
| Steps 6--7 (`moveCharacter`) | Not started |
| Initiative complete; durable docs updated; task plan retired | Not started |
