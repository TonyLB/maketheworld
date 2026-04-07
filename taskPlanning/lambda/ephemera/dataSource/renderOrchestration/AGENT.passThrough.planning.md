# `renderOrchestration` - pass-through readiness

**Status: ACTIVE TASK PLAN.** **Stop duplicate durability** is done (orchestration does not enqueue **`Put Cache Record`** on passive generation success; **`renderCache`** owns the write on **`Render Generated`**). **Conversation removal** for passive orchestration is done (stream-only outcomes). Next focus: **Integration** (**OI-7**) and any remaining cross-cutting verification.

This document is the **task plan** for [`lambda/ephemera/dataSource/renderOrchestration/`](../../../../../lambda/ephemera/dataSource/renderOrchestration/): orchestration-side work for the pass-through pattern, separate from [`mtw.ephemera.renderCache`](../../../../../lambda/ephemera/renderCache/) so "who decides hit/miss/generate" stays separate from "who emits the subscribable readiness signal."

**Refinement rule:** Changes to orchestration responsibilities that affect shared semantics belong here **and** in the [canonical contract](../AGENT.passThrough.contract.planning.md).

**Framework:** This file follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (Getting Started, Progress, Recommended order, Verification). Requirement-level unknowns stay authoritative in the contract doc; this plan tracks **implementation** questions in [Open implementation questions](#open-implementation-questions).

---

## Getting Started

Follow the root [**"Getting Started" Pattern for Complex Tasks**](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks): foundations, this doc, integration points, code, tests, how to pick work, baseline commands.

1. **Task planning foundations** --- Read [`taskPlanning/AGENT.md`](../../../../AGENT.md) once: what belongs in a task plan vs package docs, durability, **Recommended order** checkbox rules, and **Verification** expectations.

2. **Canonical contract** --- Skim [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) for payloads, six-outbound taxonomy, legacy terminal mapping, and [**Uncertainties**](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase). **Why:** product rules and unresolved *requirement* questions live there; this task plan does not replace it.

3. **Sub-epic context** --- Read [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) for phase B (orchestration), contract-as-tests guardrails, and dependency on [`renderCache`](../renderCache/AGENT.passThrough.planning.md) work.

4. **Package reference** --- [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) should be read alongside this plan (ingress + stream outcomes). [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) holds v2 tasks (e.g. Task 7, fan-out **S**); merge only where the pass-through contract agrees.

5. **Core integration files** --- Trace the passive path: [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) -> [`findRender.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) -> [`generateRoomPreview.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts); state-driven fan-out: [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts). Conversation materialization: [`roomStateRender/materialize.ts`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts).

6. **Tests** --- Baseline and extend [`orchestrationHandler.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts), [`findRender.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.test.ts), or add a dedicated contract test module. Prefer stream assertions over conversation mocks as slices land ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)). **Order:** [Stream skeleton sequencing](#stream-skeleton-sequencing) (cross-cutting skipped tests, then **`streamEvent`**, then un-skip).

7. **Run tests before changing behavior** --- From repo root, `lambda/ephemera` uses Jest (`npm test` in [`lambda/ephemera/package.json`](../../../../../lambda/ephemera/package.json)). Run the full lambda package test suite or scope to this DataSource's tests once you know the Jest project pattern for this tree. After each slice, update **Recommended order** checkboxes in this document and re-run **Verification**.

---

## Agreed product decisions

Resolved product items are recorded in the [contract doc](../AGENT.passThrough.contract.planning.md); this section is a **stable summary** for orchestration only.

- **Roles:** Orchestration owns **policy and branching** (pointer, exact match, current-cache, generation, errors, defer). The **subscribable "this cache row answers this question"** story is owned by **`renderCache`** (`Render Pertains` / `Cache Updated`), not duplicated here on the stream.
- **Handoff:** Orchestration emits only on the **`mtw.ephemera.renderOrchestration`** DataSource stream. **`renderCache`** **subscribes**; no orchestration **invoke** into `renderCache` and no **`api.ephemera`** handoff for this path.
- **No `Put Cache Record` from orchestration (pass-through generation):** Do not enqueue **`Put Cache Record`** via **`sendPutCacheRecord`**, **`publishPutCacheRecord`** / **`defaultPublishPutCacheRecord`**, or any future **`messageBus`** helper for orchestration-owned generation completion. **`renderCache`** subscribes to **`Render Generated`** and performs the single durable write. Other domains may still enqueue **`Put Cache Record`** for their own writes.
- **Replace conversation outcomes:** Remove **`conversation.sendMessage`** / **`materializeRoomStateRender`** as the carrier for orchestration outcomes; replace with the **six outbound** types on the DataSource stream (canonical table: [Orchestration outbounds](../AGENT.passThrough.contract.planning.md#orchestration-outbounds-draft-taxonomy---six-types)). Do not add new features that deepen the conversation dependency; progress signals follow the same rule.
- **Legacy bus:** Target architecture does **not** emit **`RenderReady`**, **`RenderInvalidate`**, or **`RenderError`** through the old **`roomStateRender`** / **`messageBus`** path for orchestration outcomes; cutover is **remove** legacy emission, not parallel bus + stream.
- **Passive state fan-out:** **S = A union P** with **`allowGeneration`** capped per contract ([set algebra](../AGENT.passThrough.contract.planning.md#state-driven-fan-out-set-and-allowgeneration-set-algebra)). Every perspective in **S** gets a **`findRender`** run; **`fanOutStateChangedToPassiveRenders`** must extend from **A**-only to **S** (see package Task 7 / contract uncertainty 10).
- **Hit paths on stream:** **`Current Cache Valid`** and **`Exact Match Found`** carry **IDs only** + routing; **`renderCache`** refetches before emitting **`Render Pertains`**.
- **Generation path:** **`Generation Started`** may repeat until **singleFlight** and idempotency are fully wired (overlap with contract uncertainty 6). **`Render Generated`** carries full generation output with **no** Dynamo durability promise; **`renderCache`** emits durable outbounds after write.
- **Not orchestration outbounds:** **`Render Pertains`** / **`Cache Updated`** remain **`renderCache`** outbounds.

```mermaid
flowchart LR
  renderOrch["renderOrchestration stream"]
  renderCacheDS["renderCache DataSource"]
  perception["Perception"]
  renderOrch -->|"six outbounds"| renderCacheDS
  renderCacheDS -->|"Render Pertains / Cache Updated"| perception
```

---

## Single-flight generation (architectural commitment)

**Intent:** After deterministic fast-path checks (pointer, exact match, policy gates), **multiple concurrent callers** for the **same logical generation** (same component + perspective / stable routing identity) must **not** each run a separate LLM **or** race separate cache writes. Wrap the **generation step** in **`mtw-lambda-patterns`** **`singleFlight`** (**coalesce** mode): one **leader** runs **`computation()`**; **followers** wait and return **`retrieval()`** after **`COMPLETED`**, so downstream sees **one authoritative completion** for that flight barring total cohort failure.

**Why:** The **singleFlight** record (**category** + **`argumentHash`**) is the cohort key; callers need not coordinate via an in-flight **`renderCache`** row. **`retrieval`** reads whatever durable state the leader wrote (or an in-flight placeholder shape), per implementation.

**Library limits:** **`singleFlight`** does **not** guarantee **exactly-once** side effects inside **`computation`** (e.g. **`Generation Started`** at the top of work). Leader expiry and self-promotion can run **`computation()`** again --- **at least one** **`Generation Started`** is expected; **more than one** is an edge case until idempotency (conditional write / nonce) or pattern extensions. **Exactly one LLM call** per logical job is **not** guaranteed across timeout and recovery.

**Downstream:** Clients may treat multiple **Generating**-class signals as idempotent UI. **Perception** aggregates duplicate **intermediate** events (contract uncertainty 6). **Terminal** dedupe stays a **Perception** obligation.

**Code reference:** [`packages/mtw-lambda-patterns/ts/singleFlight`](../../../../../packages/mtw-lambda-patterns/ts/singleFlight).

Implementation hashing, Dynamo wiring, and **`computation`** vs **`retrieval`** split are tracked under [Open implementation questions](#open-implementation-questions) and **Recommended order** (singleFlight step).

---

## Contract alignment (requirement uncertainties)

**Authoritative list:** [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase).

Unresolved **product** questions (payload field details, remaining contract gaps) stay in that document. **Where types live** for orchestration outbounds is **resolved** ( **`publishedEvents.ts`** ; uncertainty 8 / **OI-5**). This task plan links to it and does **not** collapse remaining uncertainties here.

---

## Open implementation questions

These are **how** we implement agreed rules, not whether the product rules apply. Link to contract uncertainty ids when useful (e.g. UC6: duplicate intermediates acceptable). Normative **payload fields** belong in the contract doc, not duplicated as decisions here.

### Resolved

| Id | Resolution |
| --- | --- |
| **OI-5** | **Outgoing types and module path:** Six-outbound TypeScript types (unions, guards, helpers) live in [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/publishedEvents.ts) (**landed**). **`mtw.ephemera.renderOrchestration`** uses **`publisherStrategy: 'busOnly'`**; **`mtw-interfaces`** is **not** required for this internal handoff. **`renderCache`** imports the same ephemera-local types when subscribing. **Emission:** **`sendRenderOrchestrationPublish`** / **`publishRenderOrchestrationStreamEvent`** per [`AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) (section **publishedEvents.ts and outgoing update payloads**). **Contract uncertainty 8:** passive orchestration no longer uses conversation **`sendMessage`** for outcomes (**Conversation removal** done). |
| **Duplicate durability (pass-through generation)** | **Resolved:** [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) does **not** call **`publishPutCacheRecord`**, **`defaultPublishPutCacheRecord`**, or **`sendPutCacheRecord`**. Generation success publishes **`Render Generated`** only; **`mtw.ephemera.renderCache`** performs the single Dynamo write and emits **`Render Pertains`** / **`Cache Updated`** ([`renderCache` plan](../renderCache/AGENT.passThrough.planning.md)). **Remaining:** thin cross-layer verification (**OI-7**); grep hygiene below. |
| **OI-8** | **Resolved (orchestration):** [`fanOutStateChangedToPassiveRenders`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) fans out **S = A ∪ P**; pointer-only keys (**P ∖ A**) call **`orchestrateRenderRequest`** with **`allowGeneration: false`**, **`targets: []`**, and **`perspective.assetStack`** reconstructed from the **`CACHE#...`** row plus room canon (key check). **Remaining (cross-cutting):** subscriber ordering vs meta pointers / bus (contract uncertainty 11), not this handler in isolation. |
| **OI-1** | **Resolved:** Stable cohort key in [`renderGenerationArgumentHash.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/renderGenerationArgumentHash.ts) (`computeRenderGenerationArgumentHash`); fixed **`category`** in [`singleFlightRenderGeneration.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/singleFlightRenderGeneration.ts) (`EPHEMERA_ROOM_RENDER_GENERATION_CATEGORY`). |
| **OI-2** | **Resolved:** [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) **`computation`** runs LLM, **`Generation Started`**, and **`Render Generated`** on the orchestration stream; **`retrieval`** (followers) polls **`getExactMatch`** and returns without republishing **`Render Generated`** (duplicate intermediates remain acceptable per UC6). |
| **OI-3** | **Resolved:** [`defaultRunWithSingleFlight`](../../../../../lambda/ephemera/dataSource/renderOrchestration/singleFlightRenderGeneration.ts) uses **`ephemeraDB.optimisticUpdate`** / **`getItem`**, **`primaryKey: 'EphemeraId'`**, **`RENDER_GENERATION_SINGLE_FLIGHT_TIMEOUT_MS`**. Unit tests inject **`passThroughSingleFlight`** (`await computation()` only). |

### Open

| Id | Question |
| --- | --- |
| **OI-4** | **Cutover order:** **Done** for passive orchestration --- [`orchestrateRenderRequest`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) does not register **`roomStateRender`** or inject **`sendMessage`**; outcomes are **`publishRenderOrchestrationStreamEvent`** / **`mtw.ephemera.renderOrchestration`** only. [`materializeRoomStateRender`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts) may still serve other callers. **Inventory:** [OI-4: Legacy orchestration outcome inventory](#oi-4-legacy-orchestration-outcome-inventory). |
| **OI-6** | **Resolved (orchestration):** [`orchestrationHandler.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts), [`findRender.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.test.ts), and [`generateRoomPreview.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.test.ts) assert stream payloads (and **`publishOrchestration`** mocks), aligned with [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/passThroughContract.scaffold.test.ts). |
| **OI-7** | **Integration test** timing: thin cross-layer test with **`renderCache`** --- producer + consumer paths are both implemented; **duplicate durability** alignment is done; **integration** test still **not** landed (see [Recommended order](#recommended-order) **Integration**). |

---

## Scope and non-goals

- **In scope:** Six orchestration outbounds on the DataSource stream; **(done)** no **`Put Cache Record`** from orchestration on pass-through generation success; passive fan-out **S** + **`allowGeneration`**; **singleFlight** around generation; migration off conversation **`sendMessage`** for orchestration outcomes; contract-oriented unit tests and eventual thin integration test.
- **Out of scope here:** Duplicating full normative **payload field** lists from the contract (see **Limited refinement** in the contract doc); **`publishedEvents.ts`** **implements** those shapes locally. Final perception fan-in ([`perception` plan](../perception/AGENT.perceptionRefactor.planning.md)). **`currentCachePointers`** behavior ([stub plan](../currentCachePointers/AGENT.cachePointersRefactor.planning.md)).

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical cross-cutting contract** (draft) |
| [`../renderCache/AGENT.passThrough.planning.md`](../renderCache/AGENT.passThrough.planning.md) | `renderCache` pass-through (**graduated** task plan) |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) | Package behavior reference |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) | Local v2 planning (related; do not merge blindly) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | Rubric **section 4** |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + contract encoding in tests |
| [`../currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** (stub) |
| [`packages/mtw-lambda-patterns/ts/singleFlight`](../../../../../packages/mtw-lambda-patterns/ts/singleFlight) | **`singleFlight`** implementation |
| [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../../../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md) | DataSource pattern (**publishedEvents.ts** / **subscribedEvents.ts**) |

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan graduated (structure per `taskPlanning/AGENT.md`) | Done |
| Inventory: legacy conversation / **`publishPutCacheRecord`** / **`materialize`** paths mapped to six outbounds | Done (see [OI-4](#oi-4-legacy-orchestration-outcome-inventory)) |
| Types: six outbound TypeScript payloads in **`publishedEvents.ts`** (**OI-5** resolved) | Done |
| Contract test scaffold: skipped tests (orchestration + **`renderCache`** receiving) before **`streamEvent`** wiring ([Stream skeleton sequencing](#stream-skeleton-sequencing)) | Done ([`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/passThroughContract.scaffold.test.ts); shared [`passThroughContractFixtures.ts`](../../../../../lambda/ephemera/dataSource/passThroughContractFixtures.ts)) |
| Stream skeleton: **`sendRenderOrchestrationPublish`** (bus **`StreamingEvent`**) + active orchestration contract tests | Done |
| Remove **`Put Cache Record`** enqueue from orchestration on generation success (`generateRoomPreview` / helpers) | Done |
| Passive fan-out: **S** + **`allowGeneration`** in **`fanOutStateChangedToPassiveRenders`** | Done |
| **singleFlight** around generation (**OI-1**--**OI-3**) | Done |
| Retire conversation **`sendMessage`** for orchestration outcomes; verification clean | Done |
| Contract tests active for orchestration pass-through slice (`passThroughContract.scaffold.test.ts`); **`renderCache`** receiving tests active for Hit + **Render Generated** ([`renderCache` plan](../renderCache/AGENT.passThrough.planning.md)) | Done |
| Thin integration test with **`renderCache`** (when both sides ready) | Not started |

---

## Stream skeleton sequencing

Agreed order for the stream slice (reduces contract drift and makes cutover sequencing explicit vs **`renderCache`**):

1. **Cross-cutting contract test scaffold (first)** --- Land **deactivated** tests (**`describe.skip` / `it.skip`** with reasons) for intended orchestration **`streamEvent`** outcomes **and** for **`renderCache`** subscription / receiving behavior, per [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). Handlers need not exist yet on the cache side; skips keep consumer expectations visible in Jest output.
2. **Orchestration wiring** --- Wire **`streamEvent`** (or agreed) on **`mtw.ephemera.renderOrchestration`**, emit the six outbounds per contract mapping, and **un-skip** orchestration tests as behavior lands (**`publishedEvents.ts`** types already; **OI-5**).
3. **`renderCache` follow-up** --- Subscription and handlers for orchestration outbounds are **landed** ([`renderCache` plan](../renderCache/AGENT.passThrough.planning.md)); duplicate **Put Cache Record** from orchestration on generation success is **removed**. **Remaining:** thin **Integration** test (**OI-7** / **Cache-OI-6**).

Passive orchestration no longer emits conversation-backed **`RenderReady`** / **`RenderInvalidate`** / **`RenderError`** on the process bus; see [OI-4](#oi-4-legacy-orchestration-outcome-inventory) for historical mapping and non-orchestration callers.

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Apply checkboxes to each actionable line; for nested bullets, mark each line `[X]` as done so partial progress is visible.

- [X] **Inventory** --- Map every orchestration outcome path that uses **`conversation.sendMessage`**, **`materializeRoomStateRender`**, **`publishPutCacheRecord`**, or related **`messageBus`** terminals to a target six-outbound (see contract **Legacy bus terminals** and **Exit `conversation.sendMessage`**). Document gaps in **OI-4** ([section below](#oi-4-legacy-orchestration-outcome-inventory)).
- [X] **Contract test scaffold (cross-cutting)** --- Add skipped/contract tests for orchestration stream outcomes **and** **`renderCache`** receiving expectations **immediately before** **`streamEvent`** wiring ([Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests); [Stream skeleton sequencing](#stream-skeleton-sequencing) step 1).
- [X] **Stream skeleton (orchestration)** --- Implement **`sendRenderOrchestrationPublish`** emissions for **`Current Cache Valid`**, **`Exact Match Found`**, **`Generation Started`**, **`Render Generated`**, **`Orchestration Error`**, **`Generation Deferred`** per contract mapping; orchestration contract tests active ([Stream skeleton sequencing](#stream-skeleton-sequencing) step 2).
- [X] **Stop duplicate durability** --- Remove **`publishPutCacheRecord`** / **`sendPutCacheRecord`** from orchestration-owned generation success; coordinate with **`renderCache`** on **`Render Generated`** ([`renderCache` plan](../renderCache/AGENT.passThrough.planning.md)). **Done:** [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) no longer enqueues **`Put Cache Record`**; **`renderCache`** [`handleRenderOrchestrationInbound`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts) owns the durable write. **OI-7** remainder: thin **Integration** test only.
- [X] **Passive fan-out (set S)** --- Extend **`fanOutStateChangedToPassiveRenders`** from **A** to **S** with **`allowGeneration`** policy (**OI-8** resolved for orchestration; Task 7 in [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md)).
- [X] **singleFlight generation** --- Wire **`singleFlight`** (coalesce) around the generation step in [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts); **`passThroughSingleFlight`** for unit tests; **OI-1**--**OI-3** resolved in code.
- [X] **Conversation removal** --- Remove **`getRoomStateRenderHandle`** / **`sendMessage`** / legacy **`RenderReady`**-class bus paths for orchestration outcomes per contract; assert stream outputs in tests (**OI-6**).
- [ ] **Integration** --- Add thin cross-layer test with **`renderCache`** when both producer and consumer slices exist (**OI-7**).
- [X] **Close the loop** --- Update **Progress**, **Verification** skip inventory, and this **Recommended order** when each slice ships (done for **Conversation removal** slice; **Integration** remains open).

## OI-4: Legacy orchestration outcome inventory

**Current (passive orchestration):** [`orchestrateRenderRequest`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts) publishes only via **`publishRenderOrchestrationStreamEvent`** / **`mtw.ephemera.renderOrchestration`**. Intake errors use [`getIntakeOrchestrationErrorIfAny`](../../../../../lambda/ephemera/dataSource/renderOrchestration/intakeErrors.ts) and a single **`Orchestration Error`** publish. There is **no** **`roomStateRender`** registration, **`getRoomStateRenderHandle`**, or **`sendMessage`** on this path. **Pass-through generation:** orchestration **does not** enqueue **`Put Cache Record`** on LLM success; durable write is **`renderCache`** on **`Render Generated`** ([`handleRenderOrchestrationInbound`](../../../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts)). **Other** producers may still use **`api.ephemera`** **`Put Cache Record`** for non-orchestration writes.

**Historical mapping (pre stream-only cutover):** The table below described **`materializeRoomStateRender`** terminals for the same logical outcomes; orchestration now emits the **six-outbound** types directly.

**Ingress (both hit the same pipeline):**

| Entry | File | Notes |
| --- | --- | --- |
| **`RenderRequested`** from **`api.ephemera`** / DataSource ingress | [`index.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/index.ts) | Calls **`orchestrateRenderRequest`**. |
| **`State Changed`** fan-out | [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) | One **`orchestrateRenderRequest`** per perspective in **S = A ∪ P** (audience-deduped groups plus pointer-only keys with **`allowGeneration: false`**); passes **`messageBus`** for ingress compatibility; stream uses **`streamEvent`**. |

**Stream emission (current)**

| Source path | Six-outbound |
| --- | --- |
| [`getIntakeOrchestrationErrorIfAny`](../../../../../lambda/ephemera/dataSource/renderOrchestration/intakeErrors.ts) (intake error before **`findRender`**) | **`Orchestration Error`** |
| [`findRender`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) pointer branch valid | **`Current Cache Valid`** |
| [`findRender`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) exact match | **`Exact Match Found`** |
| [`findRender`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) **`allowGeneration === false`** miss | **`Generation Deferred`** |
| [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) missing / bad context | **`Orchestration Error`** (**`CONTEXT_REQUIRED`**) |
| [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) LLM / description failure | **`Orchestration Error`** |
| [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) slow path | **`Generation Started`**, then **`Render Generated`** or **`Orchestration Error`** |

**`publishPutCacheRecord` / `sendPutCacheRecord` (orchestration)**

| Call site | Status |
| --- | --- |
| Passive generation success in [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) | **Removed.** Durable **`CACHE#...`** write is **`renderCache`** only on **`Render Generated`**. |

**Other code paths:** [`materializeRoomStateRender`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts) remains for conversation-backed callers outside this passive orchestration handler; it is not invoked from [`orchestrationHandler.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts).

---

## Verification

**Unit / package tests**

- From [`lambda/ephemera/`](../../../../../lambda/ephemera/), run `npm test` (Jest). Scope to this package's tests if your Jest config supports path patterns (e.g. `renderOrchestration`).

**Contract test expectations**

- Rules: [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
- Primary files: [`orchestrationHandler.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts), [`findRender.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.test.ts), [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/passThroughContract.scaffold.test.ts) (six-outbound **`StreamingEvent`** assertions).

**Grep / hygiene (adjust as code moves)**

- **Duplicate durability:** Under `dataSource/renderOrchestration/`, **`publishPutCacheRecord`**, **`sendPutCacheRecord`**, and **`defaultPublishPutCacheRecord`** must **not** appear on passive **generation success** paths (grep should hit **no** call sites in **`generateRoomPreview`** after cutover). Other packages may still use **`Put Cache Record`** for their own writes.
- **Conversation / legacy bus:** Under `dataSource/renderOrchestration/`, **`sendMessage`**, **`getRoomStateRenderHandle`**, **`materializeRoomStateRender`**, and orchestration-driven **`RenderReady`** / **`RenderInvalidate`** / **`RenderError`** should **not** appear in orchestration implementation files (comments in [`events.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/events.ts) may still mention **`sendMessage`** for conversation-row shapes). Prefer grepping **`orchestrationHandler.ts`**, **`findRender.ts`**, **`generateRoomPreview.ts`**, **`intakeErrors.ts`**.

**Skip inventory**

Maintain a short list here or in the test file header as **`it.skip` / `describe.skip`** appear (reason should reference contract phase or uncertainty id).

| Location | Skip reason (summary) |
| --- | --- |
| *(none in this package for orchestration six-outbound suite)* | [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/passThroughContract.scaffold.test.ts) is active; **`renderCache`** [`passThroughContract.scaffold.test.ts`](../../../../../lambda/ephemera/dataSource/renderCache/passThroughContract.scaffold.test.ts) is active for Hit + **Render Generated** ([`renderCache` plan](../renderCache/AGENT.passThrough.planning.md)). |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package adds unit tests for the six outbound types, **`findRender`** / intake branches, and non-duplication of the final correlated readiness signal (owned by **`renderCache`**). Orchestration unit tests assert **`StreamingEvent`** / **`getContent()`** shapes for **`mtw.ephemera.renderOrchestration`**. Integration tests follow when **`renderCache`** consumes orchestration signals (**OI-7**).
