# `renderOrchestration` - pass-through readiness - DRAFT

**Document status: DRAFT (not refined).** This file is a **first-draft stub**. It does **not** yet meet [`taskPlanning/AGENT.md`](../../../../AGENT.md) for a full task plan (ordered work, verification, progress discipline). It exists to hold **orchestration-side** intent separately from **`mtw.ephemera.renderCache`** so we do not entangle "who decides hit/miss/generate" with "who emits the subscribable readiness signal" before we are ready.

**Refinement rule:** Changes to orchestration responsibilities should be edited here **and** reflected in the canonical contract doc when they affect shared semantics.

---

## Single-flight generation (intended pattern)

**Intent:** After deterministic fast-path checks (pointer, exact match, policy gates), **multiple concurrent callers** for the **same logical generation** (same component + perspective / stable routing identity) should **not** each run a separate LLM **or** each race separate cache writes. We intend to wrap the **generation step** in **`mtw-lambda-patterns`** **`singleFlight`** ( **coalesce** mode): one **leader** runs **`computation()`** (slow path); **followers** wait and return **`retrieval()`** after the flight reaches **`COMPLETED`**, so downstream sees **one authoritative completion** for that flight barring total failure of the cohort.

**Why this helps:** Callers no longer depend on finding a matching **in-progress** `renderCache` row to **coordinate** --- the **singleFlight** record (category + **`argumentHash`**) is the cohort key. **`retrieval`** still reads whatever durable state the leader wrote (or an in-flight placeholder shape), per implementation.

**Not guaranteed by the library alone:** **`singleFlight`** does **not** promise **exactly-once** side effects inside **`computation`** (e.g. emitting **`Generation Started`** at the top of work). If the leader **expires** and another worker **self-promotes**, **`computation()`** can run **again** --- so **at least one** **`Generation Started`** is expected; **more than one** is an **edge case** until we add **idempotency** (conditional write / nonce) or extend the pattern. **Exactly one LLM call** per logical job is **not** guaranteed across timeout and recovery.

**Downstream posture:** **Clients** can treat multiple **Generating**-class signals as idempotent UI state. **Perception** can **aggregate** duplicate **intermediate** events per pass-through **uncertainty 6** (see [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase)). **Terminal** dedupe (one final delivery per logical completion) remains a **Perception** obligation, not something orchestration must perfect at the stream.

**Implementation unknowns (to detail later):** **`argumentHash`** and **`category`** for ephemera **`singleFlightFactory`**; how **`computation`** vs **`retrieval`** split **LLM**, **`renderCache`** writes, and **`Generation Started`** / **`Render Generated`** emissions; wiring to existing **`getItem`** / optimistic patterns. Code reference: [`packages/mtw-lambda-patterns/ts/singleFlight`](../../../../../packages/mtw-lambda-patterns/ts/singleFlight).

### Task: singleFlight the generation step

- [ ] **Single-flight the generation step** using **`singleFlight`** (coalesce): define stable **`argumentHash`** + **`category`**, implement **`computation`** / **`retrieval`**, and emit orchestration outbounds without fanning duplicate work for concurrent waiters on the same key. **Precise hashing, Dynamo interaction, and event ordering** are **TBD** in implementation; this item tracks the **architectural** commitment only.

---

## Purpose (intent only)

Describe how [`lambda/ephemera/dataSource/renderOrchestration/`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) **interacts** with the pass-through pattern: orchestration remains responsible for **policy and branching** (exact match, current-cached, pointer repair, generation, etc.), while the **observable "this cache row answers this question"** surface is owned by **`renderCache`** per the shared contract. This plan tracks what orchestration **stops duplicating**, **emitting on its DataSource stream** ( **`renderCache`** **subscribes** --- orchestration does **not** invoke **`renderCache`** or send **`api.ephemera`** for that handoff), and **removing** reliance on **conversation** for pipeline delivery.

---

## No `Put Cache Record` from orchestration (pass-through)

**Product rule:** For **passive / six-outbound** generation completion, this package must **not** enqueue **`Put Cache Record`** by **any** mechanism, including:

- **`api.ephemera`** helpers such as **`sendPutCacheRecord`**
- **`publishPutCacheRecord`** / **`defaultPublishPutCacheRecord`** (today wired from [`generateRoomPreview`](../../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts) on success)
- **Any** future helper that queues the same command on **`messageBus`**

**Why:** **`renderCache`** is the **durability boundary** for that flow: it **subscribes** to **`Render Generated`**, performs the **single** durable write (via the same internal primitive as other **`Put Cache Record`** handlers), and emits **`Render Pertains`** / **`Cache Updated`**. If orchestration **also** enqueued **`Put Cache Record`**, subscribers could see **duplicate** **`Cache Updated`**-class signals for one generation. **Other domains** (e.g. asset-blueprint) continue to enqueue **`Put Cache Record`** for **their** writes; this rule applies to **orchestration-owned** generation only.

**Canonical contract:** [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) **uncertainty 1** (resolved).

---

## Passive state updates: resolve set **S**, generation capped (direction)

**Canonical set algebra** (prose agreed; code may still implement **A** only): [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#state-driven-fan-out-set-and-allowgeneration-set-algebra) --- **A** = perspectives with an **audience**, **P** = perspectives with a **meta pointer** in **`Meta::Room.currentCacheByPerspective`**, **S = A ∪ P**, **`allowGeneration`** **false** on **P ∖ A** (cheap **`findRender`** only) and may be **true** on **A** per product policy. **Not** skipping **`renderOrchestration`:** every perspective in **S** gets a **`findRender`** run; cost is capped by **`allowGeneration`**, not by bypassing orchestration.

**Package hook:** [`fanOutStateChangedToPassiveRenders.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) today builds **A** only; extending to **S** is implementation work (contract uncertainty 10, Task 7 in [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md)).

---

## Priority: remove `conversation.sendMessage` (replace with streamed outbounds)

**Intent:** **`renderOrchestration`** should **not** depend on **`conversation.sendMessage`** (nor on [`materializeRoomStateRender`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts) as the adapter to `messageBus.send`) for **orchestration outcomes** any longer than necessary. Each call site that today goes through **`roomStateRender`** registration + **`sendMessage`** should become **outgoing events on the `mtw.ephemera.renderOrchestration` DataSource stream** per the **six-type taxonomy** in [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) (**`Current Cache Valid`**, **`Exact Match Found`**, **`Generation Started`**, **`Render Generated`**, **`Orchestration Error`**, **`Generation Deferred`**). **Prose mapping** (terminals, body fields, legacy bus shapes) is in the contract **Limited refinement**; **transport** is **resolved** (DataSource stream); **`renderCache`** **subscribes** (no orchestration **invoke** or **`api.ephemera`** handoff; contract uncertainty 2 resolved); **envelopes** and **typed** module location (**`mtw-interfaces`** vs ephemera-local; contract **Where types live**) remain uncertainty 8.

- **ASAP** in priority order: do **not** add new features that deepen the conversation dependency; prefer emitting **stream / publish** paths even while consumers catch up (see contract **Encoding the contract in unit tests** and branch-only outage in contract-align).
- **Progress signals** (e.g. generation started) follow the same rule: **no** new long-lived use of conversation handles for orchestration-owned lifecycle.
- **Follow-up (code):** Implement **`streamEvent`** (or agreed) emissions per the contract mapping; tests should eventually assert **stream** outputs, not conversation mocks, for those paths.

---

## Outbound taxonomy (working set)

Canonical table: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#orchestration-outbounds-draft-taxonomy---six-types). Summary:

| Outbound | Role (orchestration) |
| --- | --- |
| **`Current Cache Valid`** | Pointer / **current-cache** path succeeded in `findRender`. Stream payload: **IDs only** + routing; **`renderCache`** refetches (contract uncertainty 3). |
| **`Exact Match Found`** | **Exact match** succeeded (no pointer hit or after pointer repair). Same **IDs-only** hit shape as **`Current Cache Valid`**. |
| **`Generation Started`** | Committed to generation; downstream handling **deferred** (see contract). **May repeat** (at least once) until **singleFlight** + idempotency are fully wired; see **Single-flight generation** above. |
| **`Render Generated`** | **Generation** complete; **full** content in payload; **no** Dynamo durability promise (**`renderCache`** emits durable **`Render Pertains`** / **`Cache Updated`**; contract uncertainty 5 resolved). |
| **`Orchestration Error`** | Terminal **error** (intake, generation failure, etc.). |
| **`Generation Deferred`** | Policy **defer** (no generation now) / invalidate-style outcome without treating as generic error where distinct. |

**Not** emitted by orchestration: **`Render Pertains`** / **`Cache Updated`** (those are **`renderCache`** outbounds). **`renderCache`** is expected to subscribe to **`Current Cache Valid`**, **`Exact Match Found`**, and **`Render Generated`** for **`Render Pertains`** (and possibly **`Cache Updated`**) per contract.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical cross-cutting contract** (draft) |
| [`../renderCache/AGENT.passThrough.planning.md`](../renderCache/AGENT.passThrough.planning.md) | `renderCache` DataSource draft plan |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) | Package behavior reference |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) | Existing local v2 planning (related; do not merge blindly) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | Rubric **section 4** (coherent ready-to-show; passive-only after preview removal) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + **contract encoding in tests** |
| [`../currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** - meta pointer maintenance (stub) |
| [`packages/mtw-lambda-patterns/ts/singleFlight`](../../../../../packages/mtw-lambda-patterns/ts/singleFlight) | **`singleFlight`** implementation (coalesce; **AGENT.md** in same folder) |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package:

- Adds **unit tests** for the **six outbound types**, **`findRender`** / intake branches, and **non-duplication** of the final correlated readiness signal (owned by `renderCache` per contract). Extend [`orchestrationHandler.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts) / [`findRender.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.test.ts) or add a dedicated contract file as needed. Over time, assert **stream / publish** outputs instead of **conversation `sendMessage`** mocks (see **Priority** section).
- **Skips** not-yet-implemented behavior with **`it.skip` / `describe.skip`** and a **reason**. **Update** skips when [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) changes.
- **Integration:** When cache consumes orchestration signals, add a **thin** cross-layer test per contract doc.

---

## Scope for this package (draft)

Canonical detail: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md). Package-local summary:

- **Emit (hypothesis):** The **six outbounds** in **Outbound taxonomy** above; **`Current Cache Valid`** and **`Exact Match Found`** replace the old combined "match hit" and carry **IDs only** on the stream (**`cacheId`** + routing; **no** full row forward --- contract uncertainty 3); **`Generation Started`** / **`Render Generated`** cover the slow path; **`Orchestration Error`** and **`Generation Deferred`** cover failure and policy deferrals. **Not** the final request-scoped "ready for perception" subscriber contract (that remains **`Render Pertains`** on **`renderCache`** per contract). **`Generation Deferred`** consumers for **meta pointers**: [`../currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../currentCachePointers/AGENT.cachePointersRefactor.planning.md).
- **Passive state / state-driven fan-out (hypothesis):** Fan out **`findRender`** for every perspective in **S** per contract; **cap** cost with **`allowGeneration`** on **A** vs **P ∖ A** (see **Passive state updates** above).
- **Stop / migrate (hypothesis):** Today's passive path maps **`resolved`** to **`RenderReady`** (and related shapes) via [`roomStateRender/materialize`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts) and **`conversation.sendMessage`**. **Product decision:** the **target** system **does not** emit **`RenderReady`**, **`RenderInvalidate`**, or **`RenderError`** through that path for orchestration outcomes; they are **superseded** by **`mtw.ephemera.renderOrchestration`** stream outbounds and **`renderCache`** **`Render Pertains`**. Cutover is **remove** legacy emission, not run **parallel** bus + stream. There are **no** external **listeners** to migrate (contract uncertainty 4 resolved). **Generate success** must **stop** calling **`publishPutCacheRecord`** / **`sendPutCacheRecord`** once **`Render Generated`** + **`renderCache`** subscription owns the put (**No `Put Cache Record` from orchestration**; contract uncertainty **1**).
- **Explicit non-goal for this stub:** Normative payload types; those stay in the contract doc and an **agreed** type module (see contract **Where types live**).

---

## Open questions (orchestration-specific - uncertainties preserved)

Cross-cutting uncertainties: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase).

- **Legacy `messageBus` / `RenderReady` (resolved):** We **do not** keep **`RenderReady`** or related **`materializeRoomStateRender`** terminals (**`RenderInvalidate`**, **`RenderError`**) as orchestration outcomes in the **target** architecture. **Remaining:** **implementation** --- delete or bypass those emissions in [`findRender`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) / [`materialize`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts) wiring per contract **Exit `conversation.sendMessage`** and **Legacy bus terminals** in [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md).
- **`Render Generated` semantics (resolved):** Orchestration emits **generation-complete** with **full** content only; **no** write guarantee. **`renderCache`** owns **durable** **`Render Pertains`** / **`Cache Updated`** (contract uncertainty 5).
- **Handoff mechanism (resolved):** Orchestration **emits** only on **`mtw.ephemera.renderOrchestration`** **DataSource stream**. **`renderCache`** **subscribes**; orchestration does **not** call into **`renderCache`** or use **`api.ephemera`** for this path (contract uncertainty 2). Tests should assert **stream** emissions from orchestration and **subscription** handling in **`renderCache`**, not direct coupling.
- **`allowGeneration` on state-driven ingress:** Documented in the contract (**A** vs **P ∖ A**); **remaining** work is wiring **S** in code and **`RenderRequested`** shape for **P ∖ A** runs (see contract uncertainty 10) and Task 7 in [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md).
- **Graduation:** [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) tasks; merge only where the pass-through contract agrees.
- **Conversation removal:** **Prose mapping done** in the contract **Limited refinement: per-outbound body fields** and **Orchestration outbounds** (each legacy terminal and materialization path tied to a **six-outbound** target). **Remaining:** code inventory, **`streamEvent`** wiring, and retiring **`getRoomStateRenderHandle`** / **`sendMessage`** / **`RenderReady`** (and related **`messageBus`** terminals) per **Legacy bus terminals** in the contract (see contract uncertainty 8 and **Priority** above).
- **Single-flight generation (narrowed):** **Intent** and **task** are in **Single-flight generation** above; **hashing and Dynamo wiring** remain **TBD**. Overlaps contract **uncertainty 6** (duplicate **intermediate** signals acceptable; **Perception** owns **terminal** dedupe).
- **`Put Cache Record` from orchestration (resolved):** **No** enqueue of **`Put Cache Record`** for pass-through generation completion; see **No `Put Cache Record` from orchestration** above and contract **uncertainty 1**. **Remaining:** **code** migration off **`publishPutCacheRecord`** on generation success.

---

## When this leaves draft status

- [ ] References contract doc for payloads; no divergent field lists
- [ ] Clear **before/after** for orchestration-owned signals vs `renderCache`-owned signals
- [ ] **Recommended order** and **Verification** per [`taskPlanning/AGENT.md`](../../../../AGENT.md) (include skip inventory for this package)

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft stub created | Done |
| Contract-as-tests strategy linked (`Encoding the contract in unit tests`) | Done |
| Refined direction aligned with contract (six outbounds; **no** target **`RenderReady`** / legacy bus terminals; **`Render Pertains`** on **`renderCache`**) | Done |
| **`conversation.sendMessage` removal** priority documented | Done |
| Six-outbound taxonomy aligned with contract | Done |
| **Conversation removal:** legacy terminal -> six outbounds **mapped in contract** (implementation not started) | Done |
| Passive state: **S = A ∪ P** direction + **`allowGeneration`** (aligned with contract set-algebra section) | Done |
| **`renderCache`** handoff: **subscribe** only (no invoke / **`api.ephemera`**; contract uncertainty 2) | Done |
| **`Render Generated`** = generation only; durability via **`renderCache`** (uncertainty 5) | Done |
| **Hit outbounds** **IDs only** (uncertainty 3) | Done |
| **No `RenderReady` / materialize bus** in target (product; legacy removal in **code**) | Done |
| **Single-flight generation:** intent + task documented; hashing / wiring TBD | Done |
| **No `Put Cache Record` from orchestration** (pass-through); contract uncertainty 1 | Done |
| Branch-by-branch impact in **code** | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** See **Contract tests** and parent doc [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
