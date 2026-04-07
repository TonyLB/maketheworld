# `mtw.ephemera.renderCache` - pass-through readiness

**Status: ACTIVE TASK PLAN.** Next focus: **Integration** slice (**Cache-OI-6**). **Generate path** and **coordinate cutover** are done: **`Render Generated`** -> durable write -> **`Render Pertains`** then **`Cache Updated`** (**Cache-OI-1** resolved). **Hit path** is done: refetch via **`internalCache.RenderCache.get`**, **`Render Pertains`** with **`cacheRecord`** ([`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts)); [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) covers Hit and **Render Generated** (with **`putCacheRecord`** mocked).

This document is the **task plan** for [`lambda/ephemera/dataSource/renderCache/`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts): how **`mtw.ephemera.renderCache`** participates in the pass-through pattern so paths that **write** cache rows and paths where content is **already** cached surface a **single subscribable story** (correlated **`Render Pertains`** and abstract **`Cache Updated`** per contract). Shared semantics and payload rules live in the [canonical contract](../AGENT.passThrough.contract.planning.md).

**Refinement rule:** Changes that affect shared semantics belong here **and** in the [canonical contract](../AGENT.passThrough.contract.planning.md).

**Framework:** This file follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (Getting Started, Progress, Recommended order, Verification). Requirement-level unknowns stay authoritative in the contract doc; this plan tracks **implementation** questions in [Open implementation questions](#open-implementation-questions).

---

## Getting Started

Follow the root [**"Getting Started" Pattern for Complex Tasks**](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks): foundations, this doc, integration points, code, tests, how to pick work, baseline commands.

1. **Task planning foundations** --- Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once: what belongs in a task plan vs package docs, durability, **Recommended order** checkbox rules, and **Verification** expectations.

2. **Canonical contract** --- Skim [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) for orchestration outbounds, **`Render Pertains`** / **`Cache Updated`**, durability split (**Generation vs durability**), [routing identity](../AGENT.passThrough.contract.planning.md#routing-identity-on-producer-streams-perception-delivery-model), and [**Uncertainties**](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase). **Why:** product rules and unresolved *requirement* questions live there.

3. **Sub-epic context** --- Read [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) for **Phase C** (renderCache), dependency order vs orchestration (**Wave 2**), and **contract encoding in tests**.

4. **Orchestration handoff** --- Read the graduated [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md): six outbounds on **`mtw.ephemera.renderOrchestration`**, **no `Put Cache Record`** from orchestration on pass-through generation, and [Open implementation questions](../renderOrchestration/AGENT.passThrough.planning.md#open-implementation-questions) **OI-7** (integration timing with this package). **Coordination** details: [Coordination with `renderOrchestration`](#coordination-with-renderorchestration).

5. **Package reference** --- [`lambda/ephemera/renderCache/AGENT.md`](../../../../../lambda/ephemera/renderCache/AGENT.md) and [`AGENT.migration.md`](../../../../../lambda/ephemera/renderCache/AGENT.migration.md) (writes vs lookups, boundary invariants).

6. **Code and tests** --- Entry: [`index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts). Existing tests: [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts), [`deleteCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/deleteCacheRecord.test.ts), [`queryCacheRecordsForComponent.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.test.ts). Extend or add a dedicated contract suite as needed ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).

7. **Run tests before changing behavior** --- From [`lambda/ephemera/`](../../../../../lambda/ephemera/), run `npm test` (Jest; see [`package.json`](../../../../../lambda/ephemera/package.json)). After each slice, update **Recommended order** checkboxes in this document and re-run **Verification**.

---

## Agreed product decisions

Resolved product items are recorded in the [contract doc](../AGENT.passThrough.contract.planning.md); this section is a **stable summary** for **`renderCache`** only.

- **Own outbounds:** **`Render Pertains`** (provisional name) and **`Cache Updated`** --- correlated vs abstract per contract. Orchestration does **not** emit these.
- **Handoff:** Subscribe to **`mtw.ephemera.renderOrchestration`** **DataSource stream** only for this path. **No** orchestration **invoke** into **`renderCache`**, **no** **`api.ephemera`** handoff for this handoff (contract uncertainty 2).
- **Hit paths:** On **`Current Cache Valid`** / **`Exact Match Found`**, orchestration sends **IDs only** + routing; this package **refetches** (e.g. **`internalCache`** **`RenderCache.get`**) then emits **`Render Pertains`** only (no new write) (contract uncertainty 3).
- **Generate path:** On **`Render Generated`**, orchestration signals generation-complete with **full** content and **no** durability promise; this package performs the **single** durable write, then emits **`Render Pertains`** / **`Cache Updated`** per contract. Orchestration does **not** enqueue **`Put Cache Record`** for that completion (contract uncertainty 1); avoid double **`Cache Updated`** once orchestration stops **`publishPutCacheRecord`** on that path.
- **Durability:** **`Render Pertains`** / **`Cache Updated`** assert **durable** **`CACHE#...`** persistence; orchestration **`Render Generated`** does not (contract uncertainty 5).
- **Routing:** **`Render Pertains`** carries **`componentId`**, perspective / **`perspectiveKey`**, **`cacheId`** / cache facts --- **no** synthetic id (contract uncertainty 9). See [routing identity](../AGENT.passThrough.contract.planning.md#routing-identity-on-producer-streams-perception-delivery-model).

```mermaid
flowchart LR
  renderOrch["renderOrchestration stream"]
  renderCacheDS["renderCache DataSource"]
  perception["Perception"]
  renderOrch -->|"six outbounds"| renderCacheDS
  renderCacheDS -->|"Render Pertains / Cache Updated"| perception
```

---

## Contract alignment (requirement uncertainties)

**Authoritative list:** [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase).

Unresolved **product** questions (payload fields, remaining gaps) stay in that document. **Typing the orchestration consumer path** is **resolved** at the pattern level: import **outbound** types from [`renderOrchestration/publishedEvents.ts`](../renderOrchestration/publishedEvents.ts) (**`mtw-interfaces`** not required; see orchestration **OI-5** and contract uncertainty 8). This task plan links to it and does **not** collapse remaining uncertainties here.

---

## Open implementation questions

These are **how** we implement agreed rules, not whether the product rules apply. Use **`Cache-OI-*`** ids so this table does not collide with **`OI-*`** in [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md). Normative **payload fields** belong in the contract doc.

| Id | Question |
| --- | --- |
| **Cache-OI-1** | **Resolved:** After a successful durable write on **`Render Generated`**, emit **`Render Pertains`** first, then **`Cache Updated`** (same shapes as [`index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) **`Put Cache Record`** path for **`Cache Updated`**). Hit path remains **`Render Pertains`** only. |
| **Cache-OI-2** | **Subscription wiring:** where and how the DataSource subscribes to **`mtw.ephemera.renderOrchestration`**; interaction with existing [`index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) initialization and other subscriptions. |
| **Cache-OI-3** | **Envelope / typing (consumer):** Shared orchestration **outbound** types live in [`renderOrchestration/publishedEvents.ts`](../renderOrchestration/publishedEvents.ts) (**`busOnly`** producer; **`mtw-interfaces`** not required). **`renderCache`** **imports** those types for subscription handlers (same leverage as orchestration **OI-5** / uncertainty 8). **Still implementation work:** wire **`receiveEvents`** / guards to **`header.type`**, narrow **`getContent()`**, and any adapter until the stream skeleton exists. **Emit** typings for **`Render Pertains`** / **`Cache Updated`** stay **`renderCache`**-local (contract + this package; optional **`publishedEvents.ts`** here per DataSource pattern for **outgoing** cache events). |
| **Cache-OI-4** | **Refetch races:** miss or staleness after IDs-only hit (rare); overlaps contract uncertainties 6 / 11 --- implementation mitigation vs escalating to contract. |
| **Cache-OI-5** | **Tests:** fixtures vs mocks until orchestration emits stable shapes; which existing tests become regression anchors ([`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts), etc.). |
| **Cache-OI-6** | **Integration test** timing: thin cross-layer test with orchestration --- align with orchestration **OI-7** and **Recommended order** items **Stop duplicate durability** and **Integration** in [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md). |

---

## Inventory (current DataSource vs pass-through targets)

**Source:** [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts), [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts), tests under the same folder.

### Ingress and handlers

| Ingress | Validation | Durable / memory writes | Outbound `streamEvent` (`header.type`) |
| --- | --- | --- | --- |
| **`api.ephemera` `Put Cache Record`** (via `sendPutCacheRecord` / bus) | `isEphemeraApiPutCacheRecordEnvelope` -> `isPutCacheRecordCommand` | `putCacheRecord` (Dynamo `CACHE#...`) then `internalCache.RenderCache.set` | **`Cache Updated`** |
| **`api.ephemera` `Delete Cache Records`** | `isEphemeraApiDeleteCacheRecordsEnvelope` -> `isDeleteCacheRecordsCommand` | `deleteCacheRecord` per row + `internalCache.RenderCache.deleteCacheRecords` | **`Cache Deleted`** |
| Invalid command shape | (falls through after guards) | none | **`Cache Error`** (`INVALID_PAYLOAD`) |
| Thrown errors from put/delete | `catch` | partial writes possible before throw | **`Cache Error`** (`PUT_FAILED` / `DELETE_FAILED` / `CACHE_COMMAND_FAILED`) |

**Subscribed:** **`mtw.ephemera.renderOrchestration`** six outbounds via widened **`subscribedEventTypeGuard`** ([`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/renderCache/subscribedEvents.ts)) on the same DataSource **`receiveEvents`** as **`api.ephemera`** (message bus, not a second subscription). Inbound handler: [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts) (**Hit path** emits **`Render Pertains`**; **Generate path** emits **`Render Pertains`** then **`Cache Updated`**).

### Current publishes (outbound contract surface)

| Event | Payload shape (today) | Tests |
| --- | --- | --- |
| **`Cache Updated`** | `componentId`, `dataCategory` (cache id), `perspectiveId`, optional **`conversationId`** (prototype echo from command; see `baseClasses` comment) | [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts) |
| **`Render Pertains`** | `componentId`, `perspectiveKey`, `cacheId`, `cacheRecord` (hit path after refetch; generate path after write) | [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts), [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts) |
| **`Cache Deleted`** | `componentId`, `dataCategories` | same |
| **`Cache Error`** | `componentId`, `errorCode`, `errorMessage`, optional `perspectiveId` | same |

### Map to pass-through targets

| Contract target | Current code |
| --- | --- |
| Subscribe to **`renderOrchestration`** stream | **Wired**; hit outbounds emit **`Render Pertains`**; **Generate path** durable write + **`Render Pertains`** + **`Cache Updated`** in [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts). |
| **`Current Cache Valid` / `Exact Match Found`** -> refetch -> **`Render Pertains`** only (no write) | **Implemented** in [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts); refetch miss logs and emits nothing (**Cache-OI-4**). |
| **`Render Generated`** -> durable write -> **`Render Pertains`** + **`Cache Updated`** | **Implemented** in [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts); orchestration no longer enqueues **`Put Cache Record`** on passive generation success ([`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts)). |
| Lean routing (**`componentId`**, **`perspectiveKey`**, **`cacheId`**) without synthetic correlation on producer streams | **`Render Pertains`** carries lean fields + **`cacheRecord`**; **`Cache Updated`** still uses **`perspectiveId`** / optional **`conversationId`** from **`Put Cache Record`**. |

### Gaps noted on **Cache-OI** rows

| Id | Inventory note |
| --- | --- |
| **Cache-OI-1** | Generate path: **`Render Pertains`** then **`Cache Updated`** after one **`putCacheRecord`** (see Open implementation questions row). |
| **Cache-OI-2** | **`isRenderCacheSubscribedEnvelope`** in [`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/renderCache/subscribedEvents.ts); orchestration branch in [`index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts). |
| **Cache-OI-3** | Inbound guards in place; outbound union includes **`Render Pertains`** in [`baseClasses.ts`](../../../../../lambda/ephemera/dataSource/renderCache/baseClasses.ts); optional local **`publishedEvents.ts`** for outbounds still TBD. |
| **Cache-OI-4** | **Hit path:** refetch miss -> **`console.error`**, no emit. Further mitigation TBD if product requires. |
| **Cache-OI-5** | [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) covers Hit + **Render Generated** (mocked put) + Error / Deferred / **Generation Started**. |
| **Cache-OI-6** | No thin cross-layer test yet; orchestration **`publishPutCacheRecord`** removed from passive generation success ([`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts)). |

---

## Coordination with `renderOrchestration`

Mitigate **two-sided waiting** by making dependencies explicit:

- **Stream slice sequencing:** [orchestration **Stream skeleton sequencing**](../renderOrchestration/AGENT.passThrough.planning.md#stream-skeleton-sequencing) --- cross-cutting **skipped** contract tests (orchestration + **`renderCache`** receiving) land **before** orchestration **`streamEvent`** wiring; orchestration then **un-skips** producer tests; this package **un-skips** receiving tests when **Subscribe** / **Handlers** ship. Avoids **`renderCache`** being temporarily orphaned without a plan: the **skipped** tests document the intended contract during the gap.
- **Parallel-friendly:** Contract-oriented unit tests with **`it.skip`** and **fixture** envelopes; handler scaffolding; hit-path **refetch** + **`Render Pertains`** logic **given** stable-enough test payloads ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).
- **Ordered:** End-to-end integration and **remove duplicate `Put Cache Record`** / **`publishPutCacheRecord`** coordination require alignment with orchestration **stream skeleton** and **Stop duplicate durability** ([orchestration Recommended order](../renderOrchestration/AGENT.passThrough.planning.md#recommended-order)). Do not assume both packages move at identical speed; track **Cache-OI-6** and orchestration **OI-7**.

---

## Scope and non-goals

- **In scope:** Subscription to **`mtw.ephemera.renderOrchestration`**; durable write on **`Render Generated`**; hit-path refetch; **`Render Pertains`** / **`Cache Updated`** per contract; tests; thin integration when orchestration is ready.
- **Out of scope here:** Orchestration branching ([orchestration plan](../renderOrchestration/AGENT.passThrough.planning.md)); full perception fan-in ([`../perception/AGENT.perceptionRefactor.planning.md`](../perception/AGENT.perceptionRefactor.planning.md)); **`currentCachePointers`** ([stub](../currentCachePointers/AGENT.cachePointersRefactor.planning.md)). Normative **field** lists: contract. **Imports:** orchestration outbounds from **`renderOrchestration`** **`publishedEvents.ts`** (**Cache-OI-3**); **`renderCache`** **emit** shapes remain local unless a client boundary later requires **`mtw-interfaces`**.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical cross-cutting contract** (draft) |
| [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md) | Orchestration pass-through (**graduated** task plan; handoff) |
| [`../currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** (stub) |
| [`lambda/ephemera/renderCache/AGENT.md`](../../../../../lambda/ephemera/renderCache/AGENT.md) | Durable cache domain reference |
| [`lambda/ephemera/renderCache/AGENT.migration.md`](../../../../../lambda/ephemera/renderCache/AGENT.migration.md) | Boundary invariants |
| [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) | DataSource entry |
| [`renderOrchestration/publishedEvents.ts`](../renderOrchestration/publishedEvents.ts) | Shared orchestration **outbound** types (**`renderCache`** imports for subscription handlers) |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | **`publishedEvents.ts`** / **`subscribedEvents.ts`** convention |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + contract encoding in tests |

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan graduated (structure per `taskPlanning/AGENT.md`) | Done |
| Code / contract inventory: current DataSource paths vs pass-through targets | Done (see [Inventory](#inventory-current-datasource-vs-pass-through-targets)) |
| Skipped receiving/subscription tests (cross-cutting scaffold with orchestration; [Stream skeleton sequencing](../renderOrchestration/AGENT.passThrough.planning.md#stream-skeleton-sequencing)) | Done ([`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts); shared [`passThroughContractFixtures.ts`](../../../../../lambda/ephemera/dataSource/passThroughContractFixtures.ts)) |
| Subscription scaffold to **`mtw.ephemera.renderOrchestration`** (**Cache-OI-2**) | Done (see [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts)) |
| Handlers + tests: scaffold **`describe`** un-skipped; per-type handler dispatch; **`it.skip`** only for Hit/Generate tests until those milestones | Done |
| Hit path: refetch + **`Render Pertains`** for **`Current Cache Valid`** / **`Exact Match Found`** | Done |
| Generate path: durable write on **`Render Generated`** + **`Render Pertains`** / **`Cache Updated`** (**Cache-OI-1**, **Cache-OI-3**) | Done |
| Coordinated cutover: no double **`Put Cache Record`** with orchestration | Done |
| Contract tests active for slice; **Verification** skip inventory current | Done (no **`it.skip`** for **Generate path** in scaffold) |
| Thin integration test (**Cache-OI-6**, orchestration **OI-7**) | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply checkboxes to each actionable line; for nested bullets, mark each line `[X]` as done so partial progress is visible.

- [X] **Inventory** --- Map current [`renderCache`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) behavior (**`Cache Updated`**, **`Put Cache Record`** handlers, existing publishes) to pass-through targets; note gaps in **Cache-OI** rows (see [Inventory](#inventory-current-datasource-vs-pass-through-targets)).
- [X] **Contract test scaffold (cross-cutting)** --- With orchestration, add **skipped** receiving/subscription tests for orchestration outbounds (fixtures + reasons); **coordination:** [orchestration **Stream skeleton sequencing**](../renderOrchestration/AGENT.passThrough.planning.md#stream-skeleton-sequencing). **Un-skip** in **Subscribe** / **Handlers + tests** when implementation lands.
- [X] **Subscribe** --- Wire subscription to **`mtw.ephemera.renderOrchestration`** (scaffold / stub handlers as needed; **Cache-OI-2**).
- [X] **Handlers + tests** --- Implement handling for orchestration outbound types per contract; **un-skip** tests from the scaffold above; use **`it.skip` / `describe.skip`** only where behavior still incomplete ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).
- [X] **Hit path** --- Refetch + **`Render Pertains`** for **`Current Cache Valid`** / **`Exact Match Found`** (**Cache-OI-4** as needed).
- [X] **Generate path** --- Durable write on **`Render Generated`**; emit **`Render Pertains`** / **`Cache Updated`** per pairing decision (**Cache-OI-1**).
- [X] **Coordinate cutover** --- Align with orchestration removal of **`publishPutCacheRecord`** on generation success ([orchestration **Stop duplicate durability**](../renderOrchestration/AGENT.passThrough.planning.md#recommended-order)); verify no duplicate **`Cache Updated`**.
- [ ] **Integration** --- Thin cross-layer test when both sides ready (**Cache-OI-6**, orchestration **OI-7**).
- [ ] **Close the loop** --- Update **Progress**, **Verification** skip inventory, and this **Recommended order** when each slice ships.

---

## Verification

**Unit / package tests**

- From [`lambda/ephemera/`](../../../../../lambda/ephemera/), run `npm test` (Jest). Scope to `dataSource/renderCache` if your Jest config supports path patterns.

**Contract test expectations**

- Rules: [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
- Primary files: [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts), [`deleteCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/deleteCacheRecord.test.ts), [`queryCacheRecordsForComponent.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.test.ts), [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts).

**Grep / hygiene (adjust as code moves)**

- Track subscription / registration for **`renderOrchestration`** or **`mtw.ephemera.renderOrchestration`** in this DataSource.
- After cutover, orchestration must not **`publishPutCacheRecord`** on pass-through generation success; **`renderCache`** owns the durable write --- verify in tandem with [orchestration Verification](../renderOrchestration/AGENT.passThrough.planning.md#verification).

**Skip inventory**

Maintain a short list here or in test file headers as **`it.skip` / `describe.skip`** appear (reason: phase C, uncertainty id, or **Cache-OI** id).

| Location | Skip reason (summary) |
| --- | --- |
| (none) | **Generate path** scaffold test is active. |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package adds or extends tests for **`Render Pertains`**, **`Cache Updated`** on the generate path (**single** write from **`Render Generated`**), and match-only behavior. **Integration** when orchestration and **`renderCache`** both emit real signals.
