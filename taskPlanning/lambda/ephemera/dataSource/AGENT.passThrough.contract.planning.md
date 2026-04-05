# Pass-through readiness contract (cross-cutting) - DRAFT

**Document status: DRAFT (not refined).** This file does **not** yet meet the expectations in [`taskPlanning/AGENT.md`](../../../AGENT.md) for a ready task-planning document (clear goals, ordered work, progress, verification). A **second refinement pass** is required to resolve the **uncertainties** called out below; until then, event names and wiring are **hypotheses**, not shipped contracts.

**Refinement rule:** Do not "silently" grow this into a full plan. When this becomes actionable, add an explicit **Status** line, fill **Recommended order** with real checkboxes, and remove or narrow the draft banner once the team agrees it is no longer draft.

---

## Purpose (intent only)

Hold the **canonical cross-cutting contract** for the pass-through pattern: a single observable notion that a given render cache record is **the relevant answer** for a component/perspective (and correlation), whether that record was **just written** (miss path) or **already present** (hit path). [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md), [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md), and [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md) should reference this file for shared semantics and payload shape; they own package-local execution detail.

**Directional priority (`renderOrchestration`):** We intend to **remove dependency on `conversation.sendMessage`** for orchestration outcomes **as early as practical** and replace each former use with **outgoing streamed events** (DataSource stream and/or agreed bus publishing). **Exactly** which events, payloads, and envelopes correspond to each former call site is **not** fixed here; see **Uncertainties** and [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md).

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Durability ladder, what belongs in task plans vs package docs |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md) | Epic index |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | **Sub-epic** - phase order and dependencies for this contract |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | **Section 4** - Coherent "ready to show" (primary rubric anchor) |
| [`packages/mtw-interfaces/AGENT.md`](../../../../packages/mtw-interfaces/AGENT.md) | Likely eventual home for **types** once the contract stabilizes (TBD) |
| [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** - meta pointer maintenance (draft stub) |

---

## Relationship to the completion rubric

This initiative is aimed at [completion rubric section 4](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md#4-coherent-ready-to-show): one readiness story for hits and misses, no systematic races between orchestration signals and `renderCache` durability, and an explicit documented contract for graduation vs older paths.

---

## Encoding the contract in unit tests

The pass-through contract is **not** only this markdown file and eventual `mtw-interfaces` types. It must live in **executable tests** so producer-first work does not emit into an **untested void**. Coordinated with [contract alignment sub-epic](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md#contract-encoding-in-tests-progressive-activation).

### What to add

| Layer | Role of tests |
| --- | --- |
| **Cross-cutting (optional package or file)** | Shared **contract tests**: expected event shapes, ordering constraints, and idempotency rules **as assertions** against plain objects or typed fixtures, importable by orchestration and cache tests. |
| **`renderOrchestration`** | Unit tests for the **six outbound types** (see **Orchestration outbounds**), payloads, **non**-ownership of the final correlated "ready for perception" signal per this doc, and **no** reliance on **`conversation.sendMessage`** once migrated (replace with stream assertions). |
| **`mtw.ephemera.renderCache` (DataSource)** | Unit tests for **`Render Pertains`**, **`Cache Updated`** pairing on generate (once settled), match-only path, and **routing / correlation** fields (per uncertainty 9). |
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

When this file nears normative: grep for **`describe.skip` / `it.skip`** in pass-through-related tests should trend **down**; **active** tests should reference the same event names and fields as this doc and `mtw-interfaces`.

---

## Refined direction (hypothesis - not normative yet)

This section records a **coherent guess** at the split of responsibilities. **Names are provisional** until typed and reviewed against [`packages/mtw-interfaces`](../../../../packages/mtw-interfaces). Orchestration outbounds use the **six-type taxonomy** below; **`Render Pertains`** remains the correlated cache outbound.

### Roles

| Concern | Intended owner (draft) |
| --- | --- |
| Branching policy (pointer, exact match, generate, invalidate) | `renderOrchestration` |
| Request-scoped "this cache row answers this outstanding question" (how subscribers **match** - `conversationId`, **component x perspective** routing, hybrid; see [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md) **Correlation vs routing**) | **`mtw.ephemera.renderCache`** (or its outbounds), **not** orchestration emitting today's **`RenderReady`**-shaped "ready" as the final subscriber contract |
| **Meta** pointers (**e.g.** `Meta::Room.currentCacheByPerspective`) - **which** `CACHE#...` id is current for a component + perspective, **separate** from writing cache rows | **`mtw.ephemera.currentCachePointers`** (planned DataSource; see [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](currentCachePointers/AGENT.cachePointersRefactor.planning.md)). Not all components use this pattern (e.g. some **Feature** flows may resolve on read instead). |
| Abstract "the durable cache changed" (any subscriber that cares without correlation) | Existing or evolved **`Cache Updated`**-class signal (exact shape TBD) |

### Passive state updates (unobserved room)

When **state** updates a **room** that is **not** currently observed, we still **fan out** into **`renderOrchestration`** so **`findRender`** can run its **cheap** branches (**pointer / current-cache validation**, **exact match**). **Cost is capped** by **not** invoking **LLM generation** in that situation (e.g. **`allowGeneration === false`** or an agreed equivalent on the resolve path). That is **not** "skip orchestration" and **not** a separate pointer-only Dynamo path unless explicitly designed elsewhere. Execution detail: [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md).

### Orchestration outbounds (draft taxonomy - six types)

These replace ad hoc **`conversation.sendMessage`** / **`RenderReady`** materialization for orchestration-owned facts. **Stable TypeScript names** may differ when added to `mtw-interfaces`.

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

### `renderCache` reactions (draft)

- On **`Current Cache Valid`** or **`Exact Match Found`:** Emit **`Render Pertains` only** (no new Dynamo write), with the matching cache payload and **routing / correlation fields** (exact shape **TBD** - not assumed to be `conversationId`; see uncertainty 9 and renderCache task plan).
- On **`Render Generated`:** Emit **`Render Pertains`** and possibly **`Cache Updated`**-class abstract churn; **Conflict with existing put-path `Cache Updated`** is unresolved; see uncertainties.
- On **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`:** **`renderCache`** subscription behavior **TBD** per event (may be no-op for cache, or limited updates); refine when consumers exist. **`Generation Deferred`** pointer clearing is owned by **`currentCachePointers`**, not by deleting cache rows.
- **`currentCachePointers`** (planned): On **`Render Pertains`** from **`renderCache`**, **set** meta pointers to the **cache id** and perspective keys carried in the payload (same **routing / correlation** fields as uncertainty 9 - shared with **Perception** consumers).

### How `renderCache` "sees" orchestration events (unsettled)

**Subscribe** (e.g. internal bus listener on `renderCache`) vs **explicit call / API-shaped handoff** from orchestration into a renderCache entrypoint is **not decided**. The table below stays open until the next refinement phase.

---

## Uncertainties (explicit, next refinement phase)

These are **not** small details; they block a normative contract until addressed.

1. **`Cache Updated` duplication on the generate path.** Persistence after generation already flows through **`mtw.ephemera.renderCache`** (put → likely **`Cache Updated`** today). If **`Render Generated`** also causes **`Cache Updated`**, we may emit **twice** unless we consolidate (single coordinated emission, dedupe semantics, or define **`Cache Updated`** as only from the write primitive). **Unsettled.**

2. **Wiring: subscribe vs invoke.** Whether **`renderCache`** **subscribes** to orchestration outbounds (**`Current Cache Valid`**, **`Exact Match Found`**, **`Render Generated`**, and any others) or orchestration **invokes** a dedicated path into the DataSource. Implies layering and test seams. **Unsettled.**

3. **Hit-path outbound payload authority.** For **`Current Cache Valid`** and **`Exact Match Found`**, whether the event carries a **full cache row** (forward without re-read) or **ids only** (renderCache re-fetches), with implications for races and consistency. **Unsettled.**

4. **Listener migration from `RenderReady`.** Consumers that today treat **`RenderReady`** as "show this" must move to **`Render Pertains`** (or agreed successor); scope of file/listener changes **Unsettled.**

5. **`Render Generated` vs durability timing.** Whether "generated" means LLM finished, **Dynamo write completed**, or both; rubric cares about races with write-through. **Unsettled.**

6. **Idempotency and duplicate collapse** for subscribers if multiple signals can fire for one logical outcome. **Unsettled.**

7. **Preview vs passive policy:** Same contract for both, or explicit variants (rubric sub-goal). **Unsettled.**

8. **Stream event taxonomy (`renderOrchestration`) - partially specified.** The **six outbound types** (**`Current Cache Valid`**, **`Exact Match Found`**, **`Generation Started`**, **`Render Generated`**, **`Orchestration Error`**, **`Generation Deferred`**) are the **working taxonomy**. **Still unsettled:** exact **payloads**, **envelopes**, transport (DataSource stream vs bus vs both), per-call-site mapping from legacy code, and **`Generation Started`** / **error** / **defer** consumer contracts. Directional priority remains: **remove** conversation dependency **as soon as** replacements exist (see **Exit `conversation.sendMessage`** above).

9. **`Render Pertains` correlation model.** Whether **`conversationId`** (or similar) is required for downstream **Perception** and **`currentCachePointers`** to associate events with a handling pattern, or whether **component x perspective** (and related **routing**) is enough so consumers register richer rules without a synthetic id. **Unsettled** - see [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md) **Correlation vs routing**.

10. **State-driven fan-out when unobserved.** How **observed vs unobserved** is determined for a room and how **`allowGeneration`** (or successor) is set on **state-driven** ingress so cheap **`findRender`** paths still run but **generation** does not. **Unsettled** - see **Passive state updates** above and [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md).

11. **Cross-layer ordering and `messageBus`.** Reliable ordering between orchestration terminals, **`renderCache`** emissions, and **`currentCachePointers`** updates may require **atomic sub-runs** or other bus revisions. **Separate future refactor**; not blocking prose contract drafts, but blocks **normative** "no races" claims until addressed.

---

## Open questions (working list - overlaps allowed with uncertainties)

Use this section as a scratchpad; prefer **Uncertainties** for blockers.

- Relationship of **`RenderReady`** to **`Render Pertains`** during migration (overlap period, deprecation).
- Whether **streaming** vs **messageBus** graduation changes any of the above (see epic "Streams, contracts, graduation").
- **Per-call-site mapping:** Which of the **six outbounds** replaces each **`conversation.sendMessage`** use in orchestration (uncertainty 8 - payloads and envelopes still TBD).

---

## When this leaves draft status

- [ ] Event/payload semantics agreed and mirrored in [`packages/mtw-interfaces`](../../../../packages/mtw-interfaces) or agreed interim location
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
| **Exit `conversation.sendMessage`** priority + uncertainty 8 (six-type taxonomy drafted; payloads TBD) | Done |
| Uncertainty 9 (`Render Pertains` correlation vs routing) + renderCache task plan | Done |
| Passive state (unobserved room): cheap fan-out + generation cap + uncertainty 10 | Done |
| **`Generation Skipped` -> `Generation Deferred`**; **`currentCachePointers`** role + uncertainty 11 (bus ordering) | Done |
| **Encoding the contract in unit tests** section + task-plan pointers | Done |
| Uncertainties resolved; contract normative | Not started |
| Types / interfaces landed | TBD |
| Implementation tracked in child plans | TBD |

**Recommended order:** Intentionally omitted until this document is promoted from draft; see **When this leaves draft status**.

**Verification:** See **Encoding the contract in unit tests** (active vs skipped suite, grep for event names, integration smoke when two layers exist).
