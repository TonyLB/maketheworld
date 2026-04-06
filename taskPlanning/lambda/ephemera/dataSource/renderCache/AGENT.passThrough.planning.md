# `mtw.ephemera.renderCache` - pass-through readiness

**Status: ACTIVE TASK PLAN.** Next focus: execute **Recommended order** from the top (code / contract inventory, then subscription scaffold aligned with [orchestration stream work](../renderOrchestration/AGENT.passThrough.planning.md)).

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

Unresolved **product** questions (payload fields, **`Where types live`**, remaining gaps) stay in that document. This task plan links to it and does **not** collapse those uncertainties here.

---

## Open implementation questions

These are **how** we implement agreed rules, not whether the product rules apply. Use **`Cache-OI-*`** ids so this table does not collide with **`OI-*`** in [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md). Normative **payload fields** belong in the contract doc.

| Id | Question |
| --- | --- |
| **Cache-OI-1** | **`Render Pertains`** vs **`Cache Updated`** on the generate-path write: both vs one; ordering relative to durable write completion (**Narrow TBD** in prior draft). |
| **Cache-OI-2** | **Subscription wiring:** where and how the DataSource subscribes to **`mtw.ephemera.renderOrchestration`**; interaction with existing [`index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) initialization and other subscriptions. |
| **Cache-OI-3** | **Envelope / typing:** consume stream payloads from orchestration until shared types land (contract uncertainty 8 / **Where types live**); interim shapes in ephemera vs **`mtw-interfaces`**. |
| **Cache-OI-4** | **Refetch races:** miss or staleness after IDs-only hit (rare); overlaps contract uncertainties 6 / 11 --- implementation mitigation vs escalating to contract. |
| **Cache-OI-5** | **Tests:** fixtures vs mocks until orchestration emits stable shapes; which existing tests become regression anchors ([`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts), etc.). |
| **Cache-OI-6** | **Integration test** timing: thin cross-layer test with orchestration --- align with orchestration **OI-7** and **Recommended order** items **Stop duplicate durability** and **Integration** in [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md). |

---

## Coordination with `renderOrchestration`

Mitigate **two-sided waiting** by making dependencies explicit:

- **Parallel-friendly:** Contract-oriented unit tests with **`it.skip`** and **fixture** envelopes; handler scaffolding; hit-path **refetch** + **`Render Pertains`** logic **given** stable-enough test payloads ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).
- **Ordered:** End-to-end integration and **remove duplicate `Put Cache Record`** / **`publishPutCacheRecord`** coordination require alignment with orchestration **stream skeleton** and **Stop duplicate durability** ([orchestration Recommended order](../renderOrchestration/AGENT.passThrough.planning.md#recommended-order)). Do not assume both packages move at identical speed; track **Cache-OI-6** and orchestration **OI-7**.

---

## Scope and non-goals

- **In scope:** Subscription to **`mtw.ephemera.renderOrchestration`**; durable write on **`Render Generated`**; hit-path refetch; **`Render Pertains`** / **`Cache Updated`** per contract; tests; thin integration when orchestration is ready.
- **Out of scope here:** Orchestration branching ([orchestration plan](../renderOrchestration/AGENT.passThrough.planning.md)); full perception fan-in ([`../perception/AGENT.perceptionRefactor.planning.md`](../perception/AGENT.perceptionRefactor.planning.md)); **`currentCachePointers`** ([stub](../currentCachePointers/AGENT.cachePointersRefactor.planning.md)). Normative TypeScript payload types: contract + agreed module.

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
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + contract encoding in tests |

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan graduated (structure per `taskPlanning/AGENT.md`) | Done |
| Code / contract inventory: current DataSource paths vs pass-through targets | Not started |
| Subscription scaffold to **`mtw.ephemera.renderOrchestration`** (**Cache-OI-2**) | Not started |
| Handlers + tests for orchestration outbound types (skip/todo per contract encoding) | Not started |
| Hit path: refetch + **`Render Pertains`** for **`Current Cache Valid`** / **`Exact Match Found`** | Not started |
| Generate path: durable write on **`Render Generated`** + **`Render Pertains`** / **`Cache Updated`** (**Cache-OI-1**, **Cache-OI-3**) | Not started |
| Coordinated cutover: no double **`Put Cache Record`** with orchestration | Not started |
| Contract tests active for slice; **Verification** skip inventory current | Not started |
| Thin integration test (**Cache-OI-6**, orchestration **OI-7**) | Not started |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply checkboxes to each actionable line; for nested bullets, mark each line `[X]` as done so partial progress is visible.

- [ ] **Inventory** --- Map current [`renderCache`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) behavior (**`Cache Updated`**, **`Put Cache Record`** handlers, existing publishes) to pass-through targets; note gaps in **Cache-OI** rows.
- [ ] **Subscribe** --- Wire subscription to **`mtw.ephemera.renderOrchestration`** (scaffold / stub handlers as needed; **Cache-OI-2**).
- [ ] **Handlers + tests** --- Implement handling for orchestration outbound types per contract; use **`it.skip` / `describe.skip`** with reasons where incomplete ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)).
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
- Primary files: [`index.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.test.ts), [`putCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/putCacheRecord.test.ts), [`deleteCacheRecord.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/deleteCacheRecord.test.ts), [`queryCacheRecordsForComponent.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/queryCacheRecordsForComponent.test.ts).

**Grep / hygiene (adjust as code moves)**

- Track subscription / registration for **`renderOrchestration`** or **`mtw.ephemera.renderOrchestration`** in this DataSource.
- After cutover, orchestration must not **`publishPutCacheRecord`** on pass-through generation success; **`renderCache`** owns the durable write --- verify in tandem with [orchestration Verification](../renderOrchestration/AGENT.passThrough.planning.md#verification).

**Skip inventory**

Maintain a short list here or in test file headers as **`it.skip` / `describe.skip`** appear (reason: phase C, uncertainty id, or **Cache-OI** id). *No skips in this package yet; update when contract tests add skips.*

| Location | Skip reason (summary) |
| --- | --- |
| --- | *Add rows as skips land* |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package adds or extends tests for **`Render Pertains`**, **`Cache Updated`** on the generate path (**single** write from **`Render Generated`**), and match-only behavior. **Integration** when orchestration and **`renderCache`** both emit real signals.
