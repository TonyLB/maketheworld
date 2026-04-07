# `mtw.ephemera.renderCache` - pass-through readiness

**Status: ACTIVE TASK PLAN.** Next focus: **Hit path** then **Generate path** (refetch + **`Render Pertains`**; durable write + emits on **`Render Generated`**). **Handlers + tests** umbrella is done: [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts) dispatches all six outbounds; [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) **`describe`** active, **`it.skip`** on Hit/Generate contract tests until those milestones.

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
| **Cache-OI-1** | **`Render Pertains`** vs **`Cache Updated`** on the generate-path write: both vs one; ordering relative to durable write completion (**Narrow TBD** in prior draft). |
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

**Subscribed:** **`mtw.ephemera.renderOrchestration`** six outbounds via widened **`subscribedEventTypeGuard`** ([`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/renderCache/subscribedEvents.ts)) on the same DataSource **`receiveEvents`** as **`api.ephemera`** (message bus, not a second subscription). Inbound handler: [`handleRenderOrchestrationInbound.ts`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts) (**Cache-OI-2** done; per-type dispatch; refetch / **`Render Pertains`** / generate-path write in **Hit path** / **Generate path**).

### Current publishes (outbound contract surface)

| Event | Payload shape (today) | Tests |
| --- | --- | --- |
| **`Cache Updated`** | `componentId`, `dataCategory` (cache id), `perspectiveId`, optional **`conversationId`** (prototype echo from command; see `baseClasses` comment) | [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts) |
| **`Cache Deleted`** | `componentId`, `dataCategories` | same |
| **`Cache Error`** | `componentId`, `errorCode`, `errorMessage`, optional `perspectiveId` | same |

**Absent:** **`Render Pertains`** --- not in `RenderCacheUpdatePayload`, not emitted anywhere. The correlated readiness signal the pass-through contract assigns to **`renderCache`** is **not implemented** yet.

### Map to pass-through targets

| Contract target | Current code |
| --- | --- |
| Subscribe to **`renderOrchestration`** stream | **Wired** (per-type inbound dispatch); **`Render Pertains`** / durable write still **missing** (**Cache-OI-3**). |
| **`Current Cache Valid` / `Exact Match Found`** -> refetch -> **`Render Pertains`** only (no write) | **Inbound handler** present; **refetch** + **`Render Pertains`** still **Hit path** milestone (legacy hits may still terminate in orchestration + **`RenderReady`** until cutover). |
| **`Render Generated`** -> durable write -> **`Render Pertains`** + optional **`Cache Updated`** | **Partial / legacy** --- generation success still uses **`publishPutCacheRecord`** -> **`Put Cache Record`** on **`api.ephemera`**, which hits the **same** put handler and emits **`Cache Updated`** only (no **`Render Pertains`**). Cutover needs orchestration to stop enqueueing put on generation and this package to own write on **`Render Generated`** (**Cache-OI-1**, coordinated **Stop duplicate durability**). |
| Lean routing (**`componentId`**, **`perspectiveKey`**, **`cacheId`**) without synthetic correlation on producer streams | **`Cache Updated`** still carries **`perspectiveId`** and optional **`conversationId`**; **`perspectiveKey`** / **`Render Pertains`** not present --- **Cache-OI-3** and contract **Routing identity** remain implementation work. |

### Gaps noted on **Cache-OI** rows

| Id | Inventory note |
| --- | --- |
| **Cache-OI-1** | Single outbound after put today (**`Cache Updated`**). Contract needs **`Render Pertains`** (always for pass-through outcomes) and pairing vs **`Cache Updated`** on the generate-path single write; hit path = **`Render Pertains`** without **`Cache Updated`**. |
| **Cache-OI-2** | **`isRenderCacheSubscribedEnvelope`** in [`subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/renderCache/subscribedEvents.ts); orchestration branch in [`index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts). |
| **Cache-OI-3** | Inbound: add guards for orchestration **`header.type`** + **`publishedEvents.ts`**; outbound: extend union with **`Render Pertains`** (and possibly local **`publishedEvents.ts`** for bus-only emits per pattern). |
| **Cache-OI-4** | Inbound handler runs for hit outbounds; **refetch** + **`Render Pertains`** still **Hit path** milestone. |
| **Cache-OI-5** | [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts) / [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts) anchor **`api.ephemera`** behavior; [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) live for Error / Deferred / **Generation Started**; **`it.skip`** for Hit/Generate contract tests until those slices. |
| **Cache-OI-6** | No thin cross-layer test; orchestration still owns **`publishPutCacheRecord`** on generation success until cutover. |

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
| Hit path: refetch + **`Render Pertains`** for **`Current Cache Valid`** / **`Exact Match Found`** | Not started |
| Generate path: durable write on **`Render Generated`** + **`Render Pertains`** / **`Cache Updated`** (**Cache-OI-1**, **Cache-OI-3**) | Not started |
| Coordinated cutover: no double **`Put Cache Record`** with orchestration | Not started |
| Contract tests active for slice; **Verification** skip inventory current | Partial (scaffold live for Error / Deferred / **Generation Started**; Hit/Generate **`it.skip`**) |
| Thin integration test (**Cache-OI-6**, orchestration **OI-7**) | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply checkboxes to each actionable line; for nested bullets, mark each line `[X]` as done so partial progress is visible.

- [X] **Inventory** --- Map current [`renderCache`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) behavior (**`Cache Updated`**, **`Put Cache Record`** handlers, existing publishes) to pass-through targets; note gaps in **Cache-OI** rows (see [Inventory](#inventory-current-datasource-vs-pass-through-targets)).
- [X] **Contract test scaffold (cross-cutting)** --- With orchestration, add **skipped** receiving/subscription tests for orchestration outbounds (fixtures + reasons); **coordination:** [orchestration **Stream skeleton sequencing**](../renderOrchestration/AGENT.passThrough.planning.md#stream-skeleton-sequencing). **Un-skip** in **Subscribe** / **Handlers + tests** when implementation lands.
- [X] **Subscribe** --- Wire subscription to **`mtw.ephemera.renderOrchestration`** (scaffold / stub handlers as needed; **Cache-OI-2**).
- [X] **Handlers + tests** --- Implement handling for orchestration outbound types per contract; **un-skip** tests from the scaffold above; use **`it.skip` / `describe.skip`** only where behavior still incomplete ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).
- [ ] **Hit path** --- Refetch + **`Render Pertains`** for **`Current Cache Valid`** / **`Exact Match Found`** (**Cache-OI-4** as needed).
- [ ] **Generate path** --- Durable write on **`Render Generated`**; emit **`Render Pertains`** / **`Cache Updated`** per pairing decision (**Cache-OI-1**).
- [ ] **Coordinate cutover** --- Align with orchestration removal of **`publishPutCacheRecord`** on generation success ([orchestration **Stop duplicate durability**](../renderOrchestration/AGENT.passThrough.planning.md#recommended-order)); verify no duplicate **`Cache Updated`**.
- [ ] **Integration** --- Thin cross-layer test when both sides ready (**Cache-OI-6**, orchestration **OI-7**).
- [ ] **Close the loop** --- Update **Progress**, **Verification** skip inventory, and this **Recommended order** when each slice ships.

---

## Verification

**Unit / package tests**

- From [`lambda/ephemera/`](../../../../../lambda/ephemera/), run `npm test` (Jest). Scope to `dataSource/renderCache` if your Jest config supports path patterns.

**Contract test expectations**

- Rules: [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
- Primary files: [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts), [`deleteCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/deleteCacheRecord.test.ts), [`queryCacheRecordsForComponent.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.test.ts), [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) (**`describe`** active; **`it.skip`** for Hit/Generate until those slices).

**Grep / hygiene (adjust as code moves)**

- Track subscription / registration for **`renderOrchestration`** or **`mtw.ephemera.renderOrchestration`** in this DataSource.
- After cutover, orchestration must not **`publishPutCacheRecord`** on pass-through generation success; **`renderCache`** owns the durable write --- verify in tandem with [orchestration Verification](../renderOrchestration/AGENT.passThrough.planning.md#verification).

**Skip inventory**

Maintain a short list here or in test file headers as **`it.skip` / `describe.skip`** appear (reason: phase C, uncertainty id, or **Cache-OI** id).

| Location | Skip reason (summary) |
| --- | --- |
| [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) `it.skip` | **Current Cache Valid** / **Exact Match Found** --- until **Hit path** (refetch + **Render Pertains**) |
| [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) `it.skip` | **Render Generated** --- until **Generate path** (**Cache-OI-1**, durable write + emits) |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package adds or extends tests for **`Render Pertains`**, **`Cache Updated`** on the generate path (**single** write from **`Render Generated`**), and match-only behavior. **Integration** when orchestration and **`renderCache`** both emit real signals.
