# `mtw.ephemera.renderCache` - pass-through readiness - DRAFT

**Document status: DRAFT (not refined).** This file is a **first-draft stub**. It does **not** yet satisfy [`taskPlanning/AGENT.md`](../../../../AGENT.md) for an executable task plan (Getting Started tailored to verification, full Recommended order with checkboxes, concrete verification commands). Content here is **provisional** until an intentional editing pass.

**Refinement rule:** Expand this in visible edits. Do not treat partial implementation detail as agreed design until the **canonical contract** document and this file are updated together.

---

## Purpose (intent only)

Capture **package-local** planning for [`lambda/ephemera/dataSource/renderCache/`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) behavior: how **`mtw.ephemera.renderCache`** participates in a pass-through pattern so that **both** paths that **write** cache records and paths where content is **already** in the cache can surface a **single subscribable story** ("this render is relevant for this component/perspective," plus whatever **routing or correlation** we settle on). Shared semantics and payload rules live in the cross-cutting contract doc, not duplicated here.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical cross-cutting contract** (draft) |
| [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md) | Orchestration-side draft plan |
| [`../currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** - meta pointers (stub) |
| [`lambda/ephemera/renderCache/AGENT.md`](../../../../../lambda/ephemera/renderCache/AGENT.md) | Durable cache domain reference |
| [`lambda/ephemera/renderCache/AGENT.migration.md`](../../../../../lambda/ephemera/renderCache/AGENT.migration.md) | Boundary invariants (writes vs lookups) |
| [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) | DataSource entry (implementation) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + **contract encoding in tests** |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package:

- Adds **unit tests** (or extends existing DataSource tests) for **`Render Pertains`**, **`Cache Updated`** behavior on the generate path (**single** write from **`Render Generated`** handler; orchestration does **not** enqueue **`Put Cache Record`** --- contract uncertainty **1**), and **match-only** behavior, using **fixtures** aligned with the contract doc.
- **Skips** assertions not yet implementable with **`it.skip` / `describe.skip`** and a **reason** (phase C, uncertainty id). **Update** those tests when [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) changes.
- **Integration:** When orchestration and renderCache both emit real signals, add or extend a **thin cross-layer test** per the contract doc (ordering, not only unit isolation).

---

## Scope for this package (draft)

Canonical detail lives in [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md). Package-local summary:

- **Own (hypothesis):** **`Render Pertains`** (provisional name) as the outbound that ties a **cache row** to whatever downstream needs to **assemble** player-visible output. Emitted when orchestration signals **`Current Cache Valid`**, **`Exact Match Found`**, or after handling **`Render Generated`** (per [contract **Orchestration outbounds**](../AGENT.passThrough.contract.planning.md)); map each to **`Render Pertains`** / **`Cache Updated`** as described there. **`Render Pertains`** and **`Cache Updated`** **assert durable persistence** and carry **content** (contract **Generation vs durability**).
- **On `Render Generated` from orchestration (hypothesis):** Orchestration signals **generation complete** with **full** content but **not** durability; this package **writes** (or confirms write), then emits **`Render Pertains`** / **`Cache Updated`**. **Double `Cache Updated`** from orchestration **also** enqueueing **`Put Cache Record`** is ruled out by contract **uncertainty 1** (resolved) and [`renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md) **No `Put Cache Record` from orchestration**. **Narrow TBD:** both outbounds vs one on that write.

**Correlation vs routing:** The contract **Routing identity on producer streams (Perception delivery model)** applies; **uncertainty 9** is **resolved (product):** **no synthetic id** on **`Render Pertains`**. **Perception** does **not** depend on **`conversationId`** / request-scoped fields on streams; it matches on **`(componentId, perspectiveKey)`** and holds **delivery** context at **registration**. **`Render Pertains`** carries **lean routing identity** (**`componentId`**, perspective / **`perspectiveKey`**) plus **`cacheId`** / cache facts --- enough for **`currentCachePointers`**. See [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#routing-identity-on-producer-streams-perception-delivery-model) and [`../perception/AGENT.perceptionRefactor.planning.md`](../perception/AGENT.perceptionRefactor.planning.md).
- **On `Current Cache Valid` / `Exact Match Found` (hypothesis):** Orchestration sends **IDs only** (**`cacheId`** + routing); this package **refetches** the cache row (e.g. **`internalCache`** **`RenderCache.get`**) then **`Render Pertains` only** (no new write) (contract uncertainty 3 resolved).
- **Upstream:** Orchestration is moving **off** **`conversation.sendMessage`** toward **`mtw.ephemera.renderOrchestration`** **DataSource stream** events ([`renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md)); this package **subscribes** to that stream --- **not** conversation, **not** direct calls from orchestration, **not** **`api.ephemera`** invoke for this handoff (contract uncertainty 2 resolved).
- **Relationship to existing outbounds:** [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) and today's **`Cache Updated`** behavior; **pass-through** generate path should **not** double-fire once orchestration stops **`publishPutCacheRecord`** (contract **uncertainty 1**).
- **Out of scope for this stub:** Orchestration branching; perception assembly (epic-level).

---

## Open questions (renderCache-specific - uncertainties preserved)

Full cross-cutting list: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase). Items that matter most here:

- **Ingress / wiring (resolved):** **`renderOrchestration`** emits on **`mtw.ephemera.renderOrchestration`** **DataSource stream**; this package **subscribes**. **No** orchestration **invoke** into **`renderCache`**, **no** **`api.ephemera`** indirect invoke for this path (contract uncertainty 2).
- **Generate path (resolved):** **One** durable write per pass-through generation: **`renderCache`** on **`Render Generated`**; orchestration does **not** enqueue **`Put Cache Record`** (contract **uncertainty 1**). **Narrow TBD:** **`Render Pertains`** + **`Cache Updated`** pairing on that write.
- **Pipeline / durability (contract resolved):** **`Render Pertains`** / **`Cache Updated`** follow **durable** **`CACHE#...`** writes; orchestration **`Render Generated`** does **not** assert write completion (uncertainty 5). **Implementation ordering** with **`Render Generated`** subscription remains **TBD** until wired.
- **Hit-path outbounds (resolved):** **`Current Cache Valid`** / **`Exact Match Found`** are **IDs only**; this package **refetches** before **`Render Pertains`** (contract item 3). **Still unsettled:** races / consistency if refetch misses (rare); overlaps uncertainty 6 / 11 as needed.
- **Correlation vs routing:** **component x perspective** (+ **`cacheId`**) per contract **Routing identity**; **no** synthetic id (uncertainty 9 resolved).
- **Testing:** Which existing tests become regression anchors once behavior exists; align with **Contract tests** above and contract doc **Encoding** section.

---

## When this leaves draft status

- [ ] Aligns with [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) without restating the full contract
- [ ] **Getting Started** lists concrete files and baseline commands (link `AGENT.development.md` or package test docs if added)
- [ ] **Recommended order** uses real checkboxes per [`taskPlanning/AGENT.md`](../../../../AGENT.md)
- [ ] **Verification** section with grep / test commands (include skip inventory for this package)

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft stub created | Done |
| Contract-as-tests strategy linked (`Encoding the contract in unit tests`) | Done |
| Refined direction aligned with contract (`Render Pertains`, six orchestration outbounds mapped; generate write ownership per uncertainty **1**) | Done |
| **Correlation vs routing** explicit unknown documented | Done |
| **Ingress:** subscribe to **`mtw.ephemera.renderOrchestration`** only (no invoke / **`api.ephemera`**; uncertainty 2) | Done |
| **Durability:** **`Render Pertains`** / **`Cache Updated`** after write; orchestration **`Render Generated`** generation-only (uncertainty 5) | Done |
| **Hit path:** IDs from orchestration, **refetch** then **`Render Pertains`** (uncertainty 3) | Done |
| Design agreed with contract doc (uncertainties resolved) | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** See **Contract tests** and parent doc [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
