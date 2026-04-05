# `mtw.ephemera.currentCachePointers` - cache pointer maintenance - DRAFT STUB

**Document status: DRAFT STUB.** This file does **not** yet meet [`taskPlanning/AGENT.md`](../../../../AGENT.md) for a full task plan (Getting Started, ordered work with checkboxes, verification commands). It exists to **accumulate obligations** for a future DataSource before implementation lands.

**Refinement rule:** Edits that change **shared semantics** belong in the canonical contract [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) as well as here.

---

## Purpose (intent only)

Introduce an **`mtw.ephemera.currentCachePointers`** DataSource (name provisional until registered next to other ephemera DataSources) that **owns meta-level cache pointers** for components that **maintain** a **current** `CACHE#...` id on **write** (e.g. **`Meta::Room.currentCacheByPerspective`**), **separate** from:

- **Writing** **`CACHE#...`** rows (owned by **`mtw.ephemera.renderCache`** / put primitives), and
- **Orchestration policy** (`findRender`, exact match, generation deferral) in **`renderOrchestration`**.

**Not** every component uses this pattern: some flows (e.g. certain **Feature** behavior) may **recalculate** the correct render on **read** instead of projecting pointers into meta. This plan focuses on **pointer-maintenance** components first.

---

## Obligations (working set)

| Source | Instruction | Target data |
| --- | --- | --- |
| **`Generation Deferred`** (orchestration outbound; renamed from **`Generation Skipped`** in contract prose) | **Clear** the relevant **meta pointer(s)** for the component/perspective in scope. | **`Meta::Room`** (etc.) pointer fields - **not** deletion of **`CACHE#...`** rows. |
| **`Render Pertains`** (from **`mtw.ephemera.renderCache`**) | **Set** meta pointers to the **cache id** and keys implied by the payload (**`componentId`**, **`perspectiveKey`** / perspective fingerprint; **no** synthetic correlation id on the wire --- contract uncertainty 9 resolved). | Same meta rows as above. |

**Subscriber-only:** This DataSource should **not** call **`findRender`**, **`putCacheRecord`**, or LLM generation for normal operation; it **projects** facts emitted by orchestration and **`renderCache`**.

---

## Cross-cutting constraints

- **Correlation:** Payloads must be rich enough for **`currentCachePointers`** **and** **Perception** using **lean routing** + **`cacheId`** (contract uncertainty 9 resolved; [`../renderCache/AGENT.passThrough.planning.md`](../renderCache/AGENT.passThrough.planning.md) **Correlation vs routing**).
- **Ordering:** Reliable ordering between orchestration, **`renderCache`**, and pointer updates is **hard** today; the contract records **uncertainty 11** ( **`messageBus`** revisions, e.g. **atomic sub-runs**). Treat as a **separate future refactor** - not a blocker for **this** stub's prose, but a blocker for **normative** no-races claims.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical contract** - roles, **`Generation Deferred`**, **`Render Pertains`**, uncertainties |
| [`../renderCache/AGENT.passThrough.planning.md`](../renderCache/AGENT.passThrough.planning.md) | **`Render Pertains`** producer |
| [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md) | Orchestration outbounds |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic index |

---

## Contract tests (future)

When implementation exists: unit tests for **pointer-only** writes (no accidental **`CACHE#`** deletes), **idempotent** sets from **`Render Pertains`**, and clears from **`Generation Deferred`**, using the same **Encoding the contract in unit tests** discipline as [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).

---

## When this leaves draft status

- [ ] Aligns with contract doc; no divergent event names
- [ ] **Getting Started** + **Recommended order** with checkboxes per [`taskPlanning/AGENT.md`](../../../../AGENT.md)
- [ ] **Verification** (grep / tests) for this package
- [ ] Code location under [`lambda/ephemera/dataSource/`](../../../../lambda/ephemera/dataSource/) agreed (or explicit **not started**)

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Nested bullets follow the same rule.

- [ ] Re-read canonical contract and **uncertainties** 9 and 11 before first implementation spike
- [ ] Register DataSource name and wiring plan next to existing ephemera DataSources (when ready)
- [ ] Add **contract tests** (may start as `describe.skip` with reasons per contract doc)

---

## Progress

| Milestone | Status |
| --- | --- |
| Stub created; obligations + links | Done |
| Contract + contract-align index updated | Done |
| Implementation | Not started |

**Verification:** None yet; see **When this leaves draft status**.
