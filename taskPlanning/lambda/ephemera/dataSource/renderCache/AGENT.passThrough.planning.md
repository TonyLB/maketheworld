# `mtw.ephemera.renderCache` — pass-through readiness — DRAFT

**Document status: DRAFT (not refined).** This file is a **first-draft stub**. It does **not** yet satisfy [`taskPlanning/AGENT.md`](../../../../AGENT.md) for an executable task plan (Getting Started tailored to verification, full Recommended order with checkboxes, concrete verification commands). Content here is **provisional** until an intentional editing pass.

**Refinement rule:** Expand this in visible edits. Do not treat partial implementation detail as agreed design until the **canonical contract** document and this file are updated together.

---

## Purpose (intent only)

Capture **package-local** planning for [`lambda/ephemera/dataSource/renderCache/`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) behavior: how **`mtw.ephemera.renderCache`** participates in a pass-through pattern so that **both** paths that **write** cache records and paths where content is **already** in the cache can surface a **single subscribable story** ("this render is relevant for this component/perspective / correlation"). Shared semantics and payload rules live in the cross-cutting contract doc, not duplicated here.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | **Canonical cross-cutting contract** (draft) |
| [`../renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md) | Orchestration-side draft plan |
| [`lambda/ephemera/renderCache/AGENT.md`](../../../../../lambda/ephemera/renderCache/AGENT.md) | Durable cache domain reference |
| [`lambda/ephemera/renderCache/AGENT.migration.md`](../../../../../lambda/ephemera/renderCache/AGENT.migration.md) | Boundary invariants (writes vs lookups) |
| [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) | DataSource entry (implementation) |

---

## Scope for this package (draft)

- **In scope (hypothesis):** Emitting or forwarding a streaming (or agreed) outbound so subscribers hear that a **specific cache record** answers an **outstanding** render question, including **no new write** when a hit selects an existing row.
- **Relationship to existing outbounds:** Clarify interaction with **`Cache Updated`** and any future stream graduation; avoid duplicate semantics without documenting them.
- **Out of scope for this stub:** Full orchestration policy (see orchestration plan); perception assembly (epic-level).

---

## Open questions (renderCache-specific)

- Ingress: does pass-through require a **new api.ephemera command** or an internal-only path from orchestration? TBD.
- Exactly where in the DataSource pipeline does emission run for **hit** vs **miss** so durability and ordering match the contract?
- Testing: which existing tests become regression anchors once behavior exists?

---

## When this leaves draft status

- [ ] Aligns with [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) without restating the full contract
- [ ] **Getting Started** lists concrete files and baseline commands (link `AGENT.development.md` or package test docs if added)
- [ ] **Recommended order** uses real checkboxes per [`taskPlanning/AGENT.md`](../../../../AGENT.md)
- [ ] **Verification** section with grep / test commands

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft stub created | Done |
| Design agreed with contract doc | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** TBD.
