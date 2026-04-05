# Pass-through readiness contract (cross-cutting) - DRAFT

**Document status: DRAFT (not refined).** This file does **not** yet meet the expectations in [`taskPlanning/AGENT.md`](../../../AGENT.md) for a ready task-planning document (clear goals, ordered work, progress, verification). A **second refinement pass** is required to resolve the **uncertainties** called out below; until then, event names and wiring are **hypotheses**, not shipped contracts.

**Refinement rule:** Do not "silently" grow this into a full plan. When this becomes actionable, add an explicit **Status** line, fill **Recommended order** with real checkboxes, and remove or narrow the draft banner once the team agrees it is no longer draft.

**Narrow exceptions:** The subsections **Limited refinement: per-outbound body fields** (body columns only) and **Routing identity on producer streams (Perception delivery model)** (lean **`componentId` + `perspectiveKey`**; delivery correlation in Perception) are **partial** agreements. They do **not** promote the rest of the document out of draft.

---

## Purpose (intent only)

Hold the **canonical cross-cutting contract** for the pass-through pattern: a single observable notion that a given render cache record is **the relevant answer** for a component/perspective (and correlation), whether that record was **just written** (miss path) or **already present** (hit path). [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md), [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md), and [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md) should reference this file for shared semantics and payload shape; they own package-local execution detail.

**Directional priority (`renderOrchestration`):** We intend to **remove dependency on `conversation.sendMessage`** for orchestration outcomes **as early as practical** and replace each former use with **outgoing events on the `mtw.ephemera.renderOrchestration` DataSource stream** (product decision; uncertainty 8 **transport** resolved). **Exactly** which **envelopes** and **typed payload** shapes correspond to each former call site is **not** fixed here; see **Uncertainties** and [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md).

**Where types live:** [`packages/mtw-interfaces`](../../../../packages/mtw-interfaces) is the **client and cross-service** contract package. **Internal-only** DataSource streams (orchestration -> **`renderCache`**, etc.) need **stable TypeScript types** shared between producers and consumers, but those types **do not** have to live in **`mtw-interfaces`** unless the same payloads are (or will be) **serialized to the client** or **another service**. Prefer **ephemera-local** or **lambda-internal** modules until a boundary requires **`mtw-interfaces`**.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Durability ladder, what belongs in task plans vs package docs |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md) | Epic index |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | **Sub-epic** - phase order and dependencies for this contract |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | **Section 4** - Coherent "ready to show" (primary rubric anchor) |
| [`packages/mtw-interfaces/AGENT.md`](../../../../packages/mtw-interfaces/AGENT.md) | **Client / cross-service** payloads; internal DS types may stay **ephemera-local** until a boundary needs this package (see **Where types live** under **Purpose**) |
| [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** - meta pointer maintenance (draft stub) |
| [`perception/AGENT.perceptionRefactor.planning.md`](perception/AGENT.perceptionRefactor.planning.md) | Fan-in / registration; **delivery correlation** for player-visible output (see **Routing identity and Perception** below) |

---

## Relationship to the completion rubric

This initiative is aimed at [completion rubric section 4](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md#4-coherent-ready-to-show): one readiness story for hits and misses, no systematic races between orchestration signals and `renderCache` durability, and an explicit documented contract for graduation vs older paths.

---

## Encoding the contract in unit tests

The pass-through contract is **not** only this markdown file and eventual **typed** payloads ( **`mtw-interfaces`** only where a **client or service boundary** requires it). It must live in **executable tests** so producer-first work does not emit into an **untested void**. Coordinated with [contract alignment sub-epic](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md#contract-encoding-in-tests-progressive-activation).

### What to add

| Layer | Role of tests |
| --- | --- |
| **Cross-cutting (optional package or file)** | Shared **contract tests**: expected event shapes, ordering constraints, and idempotency rules **as assertions** against plain objects or typed fixtures, importable by orchestration and cache tests. |
| **`renderOrchestration`** | Unit tests for the **six outbound types** (see **Orchestration outbounds**), payloads, **non**-ownership of the final correlated "ready for perception" signal per this doc, and **no** reliance on **`conversation.sendMessage`** once migrated (replace with stream assertions). |
| **`mtw.ephemera.renderCache` (DataSource)** | Unit tests for **`Render Pertains`**, **`Cache Updated`** pairing on generate (once settled), match-only path, and **lean routing** fields (**`componentId`**, **`perspectiveKey`**, **`cacheId`**) --- **no** synthetic correlation id (product decision; was uncertainty 9). |
| **`mtw.ephemera.currentCachePointers` (DataSource, future)** | Unit tests for **pointer updates** vs **no touch** to **`CACHE#...`** rows; subscription to **`Generation Deferred`** (clear pointers) and **`Render Pertains`** (set pointers) per [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md). |
| **`perception`** | Placeholder or skipped tests for fan-in, out-of-order aggregation, and delivery gating **until** the package is re-architected; still **checked in** so the consumer side of the contract is not invisible. Broader refactor and **obligations**: [`perception/AGENT.perceptionRefactor.planning.md`](perception/AGENT.perceptionRefactor.planning.md). |

### Progressive activation (skipped until the phase lands)

- **Create** tests (and **describe** blocks) for **every** behavior we intend, including not-yet-built pieces.
- **Deactivate** tests we are not ready to enforce using **`describe.skip`**, **`it.skip`**, or **`it.todo`**, each with a **reason** string (e.g. `phase C`, `uncertainty 1`, `until perception DataSource`).
- **Do not** rely on large **commented-out** blocks: they rot in merges and disappear from runner output. Skipped tests remain **visible** in Jest/Vitest listings.
- **Edit** skipped tests when this contract doc or **Uncertainties** change, the same way we would edit types.
- **Goal:** CI is green with **fewer skips over time**; **end state** = full suite **active** and passing.

### What unit tests do not replace

- **Cross-layer ordering** (orchestration then cache then perception): add **at least one** thin **integration** or **contract** test when two adjacent layers are real enough to fail together. Document that test next to the vertical slice in the sub-epic phase table.

### Verification (contract doc)

When this file nears normative: grep for **`describe.skip` / `it.skip`** in pass-through-related tests should trend **down**; **active** tests should reference the same event names and fields as this doc and the **agreed type module** ( **`mtw-interfaces`** or ephemera-local, per **Where types live**).

---

## Refined direction (hypothesis - not normative yet)

This section records a **coherent guess** at the split of responsibilities. **Names are provisional** until typed and reviewed in an **agreed** module ( **`mtw-interfaces`** or ephemera-local per **Where types live**). Orchestration outbounds use the **six-type taxonomy** below; **`Render Pertains`** remains the correlated cache outbound.

### Roles

| Concern | Intended owner (draft) |
| --- | --- |
| Branching policy (pointer, exact match, generate, invalidate) | `renderOrchestration` |
| **Durable** "this cache row is the answer for this **component x perspective**" ( **`Render Pertains`** ) | **`mtw.ephemera.renderCache`**, **not** orchestration emitting **`RenderReady`** as the final subscriber contract |
| **Who needs player-visible updates** (targets, timelines, message grouping, audience) | **`mtw.ephemera.perception`** (future): holds **delivery correlation** at **registration**; **does not** rely on producers repeating **`characterId`**, **`targets`**, **`messageGroupId`**, **`conversationId`** on streams (see **Routing identity on producer streams** below). [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md) **Correlation vs routing**. |
| **Meta** pointers (**e.g.** `Meta::Room.currentCacheByPerspective`) - **which** `CACHE#...` id is current for a component + perspective, **separate** from writing cache rows | **`mtw.ephemera.currentCachePointers`** (planned DataSource; see [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md)). Not all components use this pattern (e.g. some **Feature** flows may resolve on read instead). |
| Abstract "the durable cache changed" (any subscriber that cares without correlation) | Existing or evolved **`Cache Updated`**-class signal (exact shape TBD) |

### Passive state updates (unobserved room)

When **state** updates a **room**, we **fan out** one **`findRender`** run per perspective in the **state-driven resolve set** **S** (below). **Cost is capped** for perspectives **without** an audience by **`allowGeneration === false`** on that resolve. That is **not** "skip orchestration" and **not** a separate pointer-only Dynamo path unless explicitly designed elsewhere. Execution detail: [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md).

### State-driven fan-out set and `allowGeneration` (set algebra)

Work from **room** + **`Meta::Room`** at state-change time:

- **A** = set of **perspective keys** (`computePerspectiveKey(assetStack)`) that have an **audience**: derived from **active characters** in the room (room canon stack filtered by each character's assets, deduplicated by perspective), i.e. who is present and can see a given view.
- **P** = set of perspective keys that have a **meta pointer**: keys of **`Meta::Room.currentCacheByPerspective`** for that room (perspectives we have previously pinned a **`CACHE#...`** id for).

**Resolve set:** **S = A ∪ P** (equivalently **A ∪ (P ∖ A)** --- the two expressions are the same set). Every perspective that appears in the **audience** set **or** has a **meta pointer** entry. The **P ∖ A** form is useful only to separate **policy**: **`allowGeneration`** is keyed off membership in **A** vs **P ∖ A**, not because the union differs from **A ∪ P**.

**`allowGeneration` on state-driven ingress:**

- For perspectives in **A**: **`allowGeneration`** may be **true** (default) when product policy allows generation for **observed** / in-room views.
- For perspectives in **P ∖ A** (pointer-only, no audience): **`allowGeneration === false`** so **`findRender`** runs **cheap** paths only (pointer validation, exact match) and never the LLM slow path.

**Implementation note:** [`fanOutStateChangedToPassiveRenders`](../../../../lambda/ephemera/dataSource/renderOrchestration/fanOutStateChangedToPassiveRenders.ts) currently builds **A** only; extending fan-out to **S** requires additional **`RenderRequested`** runs for keys in **P ∖ A** (e.g. no **`targets`** or empty **`targets`** as agreed). **Ordering** with **`currentCachePointers`** and Task 7 remains cross-cutting (uncertainty 11).

### Orchestration outbounds (draft taxonomy - six types)

These replace ad hoc **`conversation.sendMessage`** / **`RenderReady`** materialization for orchestration-owned facts. **Stable TypeScript names** may differ when committed to the **agreed** type module ( **`mtw-interfaces`** or ephemera-local).

| Outbound | When (intent) | Primary subscribers (draft) |
| --- | --- | --- |
| **`Current Cache Valid`** | Valid **pointer** / **current-cache** path: `pointerHint` row exists and matches mark + perspective (`findRender` first branch). | **`renderCache`** -> **`Render Pertains`** (and not **`Cache Updated`** if no new write). |
| **`Exact Match Found`** | **Exact match** hit after pointer path fails or is skipped (`getExactMatch`). | **`renderCache`** -> **`Render Pertains`** (no new write). |
| **`Generation Started`** | Orchestration commits to **slow path** generation (e.g. after `allowGeneration` and preconditions). Consumer handling **deferred** (perception / placeholders, etc.). | TBD beyond contract; not required for **`Render Pertains`** mapping in the first pass. |
| **`Render Generated`** | **Generate** path completed in orchestration terms (see **uncertainties** for LLM vs Dynamo timing). | **`renderCache`** -> **`Render Pertains`** + (maybe) **`Cache Updated`**; see **`renderCache` reactions**. |
| **`Orchestration Error`** | Intake failure, generation failure, or other **terminal error** on the orchestration side (replaces error paths that today go through conversation `sendMessage` where applicable). | Subscribers TBD (perception, diagnostics); **`renderCache`** may **not** emit **`Render Pertains`** for this. |
| **`Generation Deferred`** | **No** generation run now when policy says defer (e.g. `allowGeneration === false` and no cheap hit, cost cap, or equivalent **invalidate** / hand-off semantics). Distinct from **error** where appropriate. | **`currentCachePointers`** -> **clear** relevant **meta pointers** (not **`CACHE#...`** rows). **`renderCache`** subscription **TBD** (may be no-op). |

Orchestration **does not** own the **final** "ready for this conversation" emission that subscribers should use for perception; that remains **`Render Pertains`** on **`renderCache`** (below). The split above replaces the earlier single bucket **`Render Matched`** (pointer + exact combined).

**Exit `conversation.sendMessage` (priority):** The current passive path registers **`roomStateRender`**, then routes **`findRender`** terminals through **`materializeRoomStateRender`** -> **`conversation.sendMessage`** -> **`messageBus.send`** (e.g. `RenderReady`). That coupling is **expedient**, not target architecture. Refactor work should **prioritize removing** orchestration's dependency on **`conversation.sendMessage`** and on that materialization adapter for pipeline outcomes, in favor of **streamed / published events** consumed by **`renderCache`** and eventually **perception**. Intermediate progress (e.g. "generating") must follow the same rule: **no** new long-lived reliance on conversation handles for orchestration delivery.

**Today vs intent:** Until code catches up, legacy paths may still exist on a branch; the **intent** is to replace them **as soon as** replacement events exist, not to treat conversation as a parallel strangler indefinitely. **Migration** off **`RenderReady`** via `roomStateRender` materialization is an explicit open item (see uncertainty 4).

### Routing identity on producer streams (Perception delivery model)

**Intent:** **`renderOrchestration`** and **`mtw.ephemera.renderCache`** streams should **not** carry **`characterId`**, **`targets`**, **`messageGroupId`**, **`conversationId`**, or similar as a **subscriber contract** for reconnecting lifecycle events to **who** gets player-visible output. **`mtw.ephemera.perception`** registers interest with whatever **delivery** fields it needs (audience, grouping, etc.) and **matches** incoming events by **`componentId` + `perspectiveKey`** (and event type / domain payload). Producers stay **registry-free**; **race and uniqueness** when multiple waiters share the same key are **Perception** policy (see [`perception/AGENT.perceptionRefactor.planning.md`](perception/AGENT.perceptionRefactor.planning.md)).

**On the wire (target producer contract):** **`componentId`**; **`perspective`** (`assetStack`) and/or **`perspectiveKey`** (`computePerspectiveKey`); plus **per-outbound body** fields (**Limited refinement**). Legacy **`roomStateRender`** may still mint **`conversationId`** for **`conversation.sendMessage`** until cutover; that does **not** define the long-term stream contract for Perception.

**`Render Pertains` / `Cache Updated`:** Carry at least the same **lean routing identity** so **`currentCachePointers`** and Perception can index consistently. **Product decision (no synthetic id):** **`Render Pertains`** does **not** require **`conversationId`** or any other **synthetic** correlation field. **`componentId` + `perspectiveKey` + `cacheId`** (and durable cache facts in the payload) are enough for **`currentCachePointers`** meta pointers and for Perception indexing. Revisit only if implementation uncovers a concrete gap.

### Limited refinement: per-outbound body fields (narrow agreement)

**Scope:** This subsection records **only** the **body** fields for each orchestration outbound **after** **routing identity** (**`componentId`** + **`perspective`** / **`perspectiveKey`** --- see **Routing identity and Perception** above). **Delivery** correlation (**`characterId`**, **`targets`**, etc.) is **not** part of this table. **Transport** for these outbounds is **resolved:** **`mtw.ephemera.renderOrchestration`** **DataSource stream** (not **`messageBus`** as the contract's primary carrier). **Envelopes** and **replacing** legacy **`conversation.sendMessage`** in **code** remain **unsettled** (uncertainty 8).

**Discrimination:** **`Current Cache Valid`** and **`Exact Match Found`** share the **same** body shape on the wire; the outbound **type** distinguishes pointer vs exact --- **no** separate **`hitKind`** field (it would only duplicate the type).

**Derived from** current passive wiring ([`findRender`](../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts), [`generateRoomPreview`](../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts), [`intakeErrors`](../../../../lambda/ephemera/dataSource/renderOrchestration/intakeErrors.ts), [`events.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/events.ts), [`materializeRoomStateRender`](../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts)).

| Outbound | Code path (today) | Legacy bus / terminal | Body fields (beyond **`componentId`** / **`perspective`**) |
| --- | --- | --- | --- |
| **`Current Cache Valid`** | [`findRender`](../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts): **`pointerHint`** set, row validates (`markState`, matcher). | Would have been **`RenderReady`** via **`toRenderReady`** (same fields as exact hit today). | **`cacheId`** (pointer id), **`cacheRecord`** (full **`EphemeraCacheDynamoItem`** from **`getCacheRecordById`**), **`renderedContent`** (duplicate of **`cacheRecord`** for convenience). |
| **`Exact Match Found`** | **`findRender`**: pointer branch skipped or invalid after **`clearPerspectivePointer`**, then **`getExactMatch`** returns a row. | Would have been **`RenderReady`** via **`toRenderReady`**. | Same shape as **`Current Cache Valid`** on the wire: **`cacheId`**, **`cacheRecord`**, **`renderedContent`**. Discriminated only by **event type** (see previous row). |
| **`Generation Started`** | **`generateRoomPreview`** calls **`sendMessage('generating')`** after context parse, before LLM ([`generateRoomPreview.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts)). | **Not** emitted on **`messageBus`** today (materialize [**drops** all `RenderProgress`](../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts) including **`generating`** in the passive adapter). [`RenderGenerationStarted`](../../../../lambda/ephemera/dataSource/renderOrchestration/events.ts) exists as a **type** but is not wired for passive delivery yet. | **No extra payload** beyond shared correlation (same as **`RenderGenerationStarted`** in **`events.ts`**: target context + component + perspective). Optional: **`phase: 'generating'`** for forward compatibility. |
| **`Render Generated`** | **`generateRoomPreview`** success: **`resolved`** with **`cacheId`**, **`cacheRecord`**, **`renderedContent`** after **`publishPutCacheRecord`**. | **`RenderReady`** via **`toRenderReady`** (orchestration output **not** yet a durability guarantee per uncertainty 5). | **`cacheId`**, **`cacheRecord`**, **`renderedContent`**; may mirror **`RenderReady`** minus **`type: 'RenderReady'`**. Optional: provenance **`generated`**. |
| **`Orchestration Error`** | (a) Intake errors -> **`failed`** in [`intakeErrors.ts`](../../../../lambda/ephemera/dataSource/renderOrchestration/intakeErrors.ts) (`NOT_ROOM`, **`META_ROOM_MARKS_MISSING`**). (b) **`generateRoomPreview`** failures: **`CONTEXT_REQUIRED`**, **`GENERATION_FAILED`**, etc. from [`RenderResolveErrorCode`](../../../../lambda/ephemera/dataSource/renderOrchestration/baseClasses.ts). | **`RenderError`** via **`toRenderError`**. | **`errorCode`** (string), **`errorMessage`** (string). Same mapping as today. |
| **`Generation Deferred`** | **`findRender`**: no pointer hit, no exact match, **`allowGeneration === false`** -> **`invalidate`** with **`reason`** [`RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION`](../../../../lambda/ephemera/dataSource/renderOrchestration/baseClasses.ts) (`NO_CACHE_MATCH_AND_GENERATION_NOT_RUN`). | **`RenderInvalidate`** via **`toRenderInvalidate`** (optional **`reason`**). | **`reason`** (string, from invalidate terminal). Optional: **`policy: 'costCap'`** or similar **TBD**. Distinct from **`Orchestration Error`**: not a hard failure; **`currentCachePointers`** may clear pointers (see subscribers table). |

**Legacy collapse note:** Today's **`RenderReady`** bus message does **not** distinguish pointer vs exact match; the split is **`Current Cache Valid`** vs **`Exact Match Found`** with **the same** body fields, differentiated by **outbound type** only --- no redundant **`hitKind`** on the payload.

### `renderCache` reactions (draft)

- On **`Current Cache Valid`** or **`Exact Match Found`:** Emit **`Render Pertains` only** (no new Dynamo write), with the matching cache payload and **lean routing identity** (**`componentId`**, perspective / **`perspectiveKey`**) plus cache identity; **not** a requirement to echo request-scoped **`conversationId`** for Perception (see **Routing identity on producer streams**). Envelope detail: [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md).
- On **`Render Generated`:** Emit **`Render Pertains`** and possibly **`Cache Updated`**-class abstract churn; **Conflict with existing put-path `Cache Updated`** is unresolved; see uncertainties.
- On **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`:** **`renderCache`** subscription behavior **TBD** per event (may be no-op for cache, or limited updates); refine when consumers exist. **`Generation Deferred`** pointer clearing is owned by **`currentCachePointers`**, not by deleting cache rows.
- **`currentCachePointers`** (planned): On **`Render Pertains`** from **`renderCache`**, **set** meta pointers from the **cache id** and **lean** routing keys in the payload (**`componentId`**, **`perspectiveKey`**) --- **no** synthetic id required (product decision).

### How `renderCache` "sees" orchestration events (settled)

**Transport (product):** Orchestration publishes the **six outbounds** on **`mtw.ephemera.renderOrchestration`** **DataSource stream**. **`renderCache`** **subscribes** to that stream --- **not** via **`renderOrchestration`** calling into **`renderCache`**, and **not** via **`api.ephemera`** messages as an indirect invoke path (product decision; uncertainty 2 resolved). **Still unsettled:** per-event behavior for **`Generation Started`** / **Orchestration Error** / **Generation Deferred** once subscribed (may be no-op for **`renderCache`**; see **`renderCache` reactions** draft above).

---

## Uncertainties (explicit, next refinement phase)

These are **not** small details; **open** items block a normative contract until addressed. **Resolved** items stay in the list for traceability with child plans.

1. **`Cache Updated` duplication on the generate path.** Persistence after generation already flows through **`mtw.ephemera.renderCache`** (put → likely **`Cache Updated`** today). If **`Render Generated`** also causes **`Cache Updated`**, we may emit **twice** unless we consolidate (single coordinated emission, dedupe semantics, or define **`Cache Updated`** as only from the write primitive). **Unsettled.**

2. **`renderCache` wiring - resolved (product).** **`mtw.ephemera.renderCache`** **subscribes** to **`mtw.ephemera.renderOrchestration`** stream events. **`renderOrchestration`** does **not** **invoke** **`renderCache`** directly, and does **not** use **`api.ephemera`** to invoke it **indirectly**. Documented in [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md) **Ingress / wiring**.

3. **Hit-path outbound payload authority.** For **`Current Cache Valid`** and **`Exact Match Found`**, whether the event carries a **full cache row** (forward without re-read) or **ids only** (renderCache re-fetches), with implications for races and consistency. **Unsettled.** (Body field **names** for hits are narrowed in **Limited refinement: per-outbound body fields**; authority full-row vs ids remains open.)

4. **Listener migration from `RenderReady`.** Consumers that today treat **`RenderReady`** as "show this" must move to **`Render Pertains`** (or agreed successor); scope of file/listener changes **Unsettled.**

5. **`Render Generated` vs durability timing.** Whether "generated" means LLM finished, **Dynamo write completed**, or both; rubric cares about races with write-through. **Unsettled.**

6. **Idempotency and duplicate collapse** for subscribers if multiple signals can fire for one logical outcome. **Unsettled.**

7. **Preview vs passive policy - resolved (product).** **Authoring preview generation** has been **removed** from the system. This contract applies to **passive** orchestration only; there is **no** parallel preview ingress or variant to reconcile.

8. **Stream event taxonomy (`renderOrchestration`) - partially resolved.** **Documented in this doc (prose):** the **six outbound types** (**Orchestration outbounds** table), **per-outbound body** fields (**Limited refinement**), **legacy terminal** lineage, and **routing identity** for producer streams (**Routing identity on producer streams** --- **`componentId`** + **`perspective`** / **`perspectiveKey`**; **not** request-scoped correlation for Perception). **Resolved (product):** **transport** --- **`mtw.ephemera.renderOrchestration`** **DataSource stream** for the six outbounds (**not** **`messageBus`** as the contract's primary carrier); **`renderCache`** **subscribes** (no direct / **`api.ephemera`** invoke from orchestration --- uncertainty 2). **Still unsettled:** exact **envelopes**, **stable TypeScript** names and module **location** ( **`mtw-interfaces`** only if a **client or cross-service** boundary needs it; otherwise ephemera-local --- see **Where types live**), per-event handling for **`Generation Started`** / **error** / **defer** once wired, and **replacing** **`conversation.sendMessage`** in code (see **Exit `conversation.sendMessage`**).

9. **`Render Pertains` wire extras - resolved (product).** **Perception** does **not** depend on **`conversationId`** (or similar) **on producer streams**; it reconstructs from **registration + `(componentId, perspectiveKey)`** (see **Routing identity on producer streams**). **`Render Pertains`** and **`currentCachePointers`** **do not** use a **synthetic id** on the wire; **component x perspective** (+ **`cacheId`**) is sufficient. Documented in [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md) **Correlation vs routing**.

10. **State-driven fan-out (implementation).** The **set algebra** for **A**, **P**, **S = A ∪ P**, and **`allowGeneration`** on **A** vs **P ∖ A** is recorded under **State-driven fan-out set and `allowGeneration` (set algebra)** above. **Still unsettled:** wiring that full resolve set in code (today: **A** only), exact **`RenderRequested`** shape for pointer-only runs, and ordering with meta pointers / bus (see uncertainty 11). See [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md).

11. **Cross-layer ordering and `messageBus`.** Reliable ordering between orchestration terminals, **`renderCache`** emissions, and **`currentCachePointers`** updates may require **atomic sub-runs** or other bus revisions. **Separate future refactor**; not blocking prose contract drafts, but blocks **normative** "no races" claims until addressed.

---

## Open questions (working list - overlaps allowed with uncertainties)

Use this section as a scratchpad; prefer **Uncertainties** for blockers.

- Relationship of **`RenderReady`** to **`Render Pertains`** during migration (overlap period, deprecation).
- Epic **Streams, contracts, graduation** may still affect **client** consumption and **envelopes**; **orchestration** carrier for this contract is **`mtw.ephemera.renderOrchestration`** **DataSource stream** (uncertainty 8 transport resolved).
- **Per-call-site mapping:** Prose mapping is in **Limited refinement**; **implementation**, **envelopes**, and **typed** module location still TBD (uncertainty 8).

---

## When this leaves draft status

- [ ] Event/payload semantics agreed and mirrored in **typed** code (**[`packages/mtw-interfaces`](../../../../packages/mtw-interfaces)** if client or cross-service; otherwise **agreed ephemera-local** module --- see **Where types live**)
- [ ] Single-emitter and race story written clearly enough to implement
- [ ] **Encoding the contract in unit tests** (see section above) reflected in repo: suites exist per layer; skip count tracked toward zero
- [ ] Child task plans updated to stop duplicating contract text; they link here only
- [ ] **Recommended order** and **Verification** filled per [`taskPlanning/AGENT.md`](../../../AGENT.md) (or this file is split: contract excerpt promoted to durable docs, this stub retired)

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft stub created | Done |
| Refined direction + uncertainties recorded (pass-through split) | Done |
| **Exit `conversation.sendMessage`** priority + uncertainty 8 (six-type taxonomy + per-outbound body + legacy mapping in prose; **transport:** DataSource stream; envelopes / code TBD) | Done |
| **Limited refinement:** per-outbound **body** fields (narrow; doc remains draft) | Done |
| **Lean routing + Perception** (**Routing identity**); **no synthetic id** on **`Render Pertains`** (uncertainty 9 resolved) | Done |
| **`renderCache`** subscribes to orchestration stream (**no** orchestration invoke or **`api.ephemera`** handoff; uncertainty 2 resolved) | Done |
| **Preview generation removed**; passive-only contract (uncertainty 7 resolved) | Done |
| Passive state: **S = A ∪ P** set algebra + **`allowGeneration`** on **A** vs **P ∖ A** (uncertainty 10 narrowed; code still TBD) | Done |
| **`Generation Skipped` -> `Generation Deferred`**; **`currentCachePointers`** role + uncertainty 11 (bus ordering) | Done |
| **Encoding the contract in unit tests** section + task-plan pointers | Done |
| Uncertainties resolved; contract normative | Not started |
| Types / interfaces landed | TBD |
| Implementation tracked in child plans | TBD |

**Recommended order:** Intentionally omitted until this document is promoted from draft; see **When this leaves draft status**.

**Verification:** See **Encoding the contract in unit tests** (active vs skipped suite, grep for event names, integration smoke when two layers exist).
