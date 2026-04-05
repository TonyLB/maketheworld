# Ephemera `messageBus` - runnable subsets / cross-layer ordering - DRAFT STUB

**Document status: DRAFT STUB.** This file does **not** yet meet [`taskPlanning/AGENT.md`](../../../AGENT.md) for a full task plan (Getting Started, ordered work with checkboxes, verification commands). It exists to **accumulate commitments** for a **`messageBus`**-focused refactor that the pass-through contract treats as **late** (see **Uncertainty 11** below).

**Refinement rule:** Edits that change **shared semantics** for orchestration, **`renderCache`**, or **`currentCachePointers`** ordering belong in the canonical contract [`../dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md) as well as here.

---

## Purpose (intent only)

Pin **subscriber-visible ordering** and **composition** across layers that today rely on **`messageBus`** behavior in ways that **block a normative** pass-through **contract** (atomic sub-runs, revised delivery, or other mechanisms --- **TBD**). This work is **explicitly** deferred behind DataSource-stream and payload decisions; it is expected to be one of the **last** uncertainties addressed in [`../dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase) **item 11**.

**Working name:** **Runnable subsets** (or equivalent) --- a placeholder for **bounded, ordered** bus work so that **`renderOrchestration`**, **`renderCache`**, and **`currentCachePointers`** emissions **compose** without ambiguous races at the contract.

---

## Obligations (working set)

| Source | Commitment | Notes |
| --- | --- | --- |
| Pass-through contract **uncertainty 11** | Specify **ordering** guarantees (or explicit **non**-guarantees) for cross-layer emissions | Blocks **normative** contract until addressed |
| [`lambda/ephemera/messageBus/`](../../../../lambda/ephemera/messageBus/) | Implementation home for **`messageBus`** primitives (see package files next to code) | Not a task-plan duplicate of `AGENT.md` |
| [`../dataSource/currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../dataSource/currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **Ordering** with orchestration / **`renderCache`** is **hard** today; pointer maintenance **inherits** whatever bus story lands here | Stub cross-link |

**Non-goals for this stub:** Replace the pass-through **contract** doc; duplicate **renderOrchestration** / **renderCache** task plans.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Task planning framework |
| [`../dataSource/AGENT.passThrough.contract.planning.md`](../dataSource/AGENT.passThrough.contract.planning.md) | **Canonical contract** - **uncertainty 11** (cross-layer ordering) |
| [`../dataSource/renderOrchestration/AGENT.passThrough.planning.md`](../dataSource/renderOrchestration/AGENT.passThrough.planning.md) | Orchestration stream outbounds |
| [`../dataSource/renderCache/AGENT.passThrough.planning.md`](../dataSource/renderCache/AGENT.passThrough.planning.md) | **`renderCache`** subscriber |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic coordination |

---

## Open questions (messageBus-specific)

- Exact **mechanism** (**atomic sub-runs** vs bus topology vs single-writer stages) --- **TBD** when this initiative is scheduled.
- Relationship to epic **Streams, contracts, graduation** (client-facing) --- **TBD**; internal ephemera ordering may land first.

---

## Progress

| Milestone | Status |
| --- | --- |
| Stub created | Done |
| Recommended order + verification | Not started |
| Implementation | Not started |

---

## When this leaves draft status

- [ ] **Recommended order** and **Verification** per [`taskPlanning/AGENT.md`](../../../AGENT.md)
- [ ] Contract **uncertainty 11** updated or closed based on outcomes here
- [ ] Link from [`lambda/ephemera/messageBus/`](../../../../lambda/ephemera/messageBus/) **AGENT** or equivalent if the codebase gains durable docs for this area
