# `renderOrchestration` — pass-through readiness — DRAFT

**Document status: DRAFT (not refined).** This file is a **first-draft stub**. It does **not** yet meet [`taskPlanning/AGENT.md`](../../../../AGENT.md) for a full task plan (ordered work, verification, progress discipline). It exists to hold **orchestration-side** intent separately from **`mtw.ephemera.renderCache`** so we do not entangle "who decides hit/miss/generate" with "who emits the subscribable readiness signal" before we are ready.

**Refinement rule:** Changes to orchestration responsibilities should be edited here **and** reflected in the canonical contract doc when they affect shared semantics.

---

## Purpose (intent only)

Describe how [`lambda/ephemera/dataSource/renderOrchestration/`](../../../../../lambda/ephemera/dataSource/renderOrchestration/) **interacts** with the pass-through pattern: orchestration remains responsible for **policy and branching** (exact match, current-cached, pointer repair, generation, etc.), while the **observable "this cache row answers this question"** surface is owned by **`renderCache`** per the shared contract. This plan tracks what orchestration **stops duplicating**, what it **invokes**, and graduation from conversation-only coupling where applicable.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical cross-cutting contract** (draft) |
| [`../renderCache/AGENT.passThrough.planning.md`](../renderCache/AGENT.passThrough.planning.md) | `renderCache` DataSource draft plan |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) | Package behavior reference |
| [`lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) | Existing local v2 planning (related; do not merge blindly) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | Rubric **section 4** and **sub-goal** on centralized preview vs passive policy |

---

## Scope for this package (draft)

- **In scope (hypothesis):** Call sites and sequencing that ensure **`renderCache`** can emit (or pass through to) the shared readiness signal for **both** hits and misses; removal or redirection of parallel "ready" emissions that would duplicate the cache-owned surface.
- **Explicit non-goal for this stub:** Defining the event payload (see contract doc).

---

## Open questions (orchestration-specific)

- Which branches today emit lifecycle or bus messages that would **overlap** with the new cache-owned signal?
- How does passive vs preview intake interact with pass-through (rubric sub-goal on forking policy)?
- What graduation steps apply from [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) without duplicating that file's full task list?

---

## When this leaves draft status

- [ ] References contract doc for payloads; no divergent field lists
- [ ] Clear **before/after** for orchestration-owned signals vs `renderCache`-owned signals
- [ ] **Recommended order** and **Verification** per [`taskPlanning/AGENT.md`](../../../../AGENT.md)

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft stub created | Done |
| Branch-by-branch impact mapped | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** TBD.
