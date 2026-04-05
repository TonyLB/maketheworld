# `mtw.ephemera.renderCache` - pass-through readiness - DRAFT

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
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + **contract encoding in tests** |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package:

- Adds **unit tests** (or extends existing DataSource tests) for **`Render Pertains`**, **`Cache Updated`** behavior on the generate path (once contract uncertainty 1 is resolved), and **match-only** behavior, using **fixtures** aligned with the contract doc.
- **Skips** assertions not yet implementable with **`it.skip` / `describe.skip`** and a **reason** (phase C, uncertainty id). **Update** those tests when [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) changes.
- **Integration:** When orchestration and renderCache both emit real signals, add or extend a **thin cross-layer test** per the contract doc (ordering, not only unit isolation).

---

## Scope for this package (draft)

Canonical detail lives in [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md). Package-local summary:

- **Own (hypothesis):** **`Render Pertains`** (provisional name) as the correlated outbound: "this cache row + this `conversationId` (or successor) trace the answer." Emitted for **both** hit and generate outcomes once orchestration has signaled **`Render Matched`** or **`Render Generated`** per that doc.
- **On `Render Generated` path (hypothesis):** Also emit **`Cache Updated`**-class abstract churn **unless** we consolidate with the existing put path (see contract **uncertainties**).
- **On `Render Matched` path (hypothesis):** **`Render Pertains` only** (no new write).
- **Relationship to existing outbounds:** [`lambda/ephemera/dataSource/renderCache/index.ts`](../../../../../lambda/ephemera/dataSource/renderCache/index.ts) and today's **`Cache Updated`** behavior; duplicate-risk on generate path is **explicitly unsettled** in the contract doc.
- **Out of scope for this stub:** Orchestration branching; perception assembly (epic-level).

---

## Open questions (renderCache-specific - uncertainties preserved)

Full cross-cutting list: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase). Items that matter most here:

- **Ingress / wiring:** Subscribe to orchestration events vs **api.ephemera** or internal invoke from orchestration. **Unsettled** (contract item 2).
- **Generate path:** Avoid or define **double `Cache Updated`** when put already fires from persistence. **Unsettled** (contract item 1).
- **Pipeline placement:** Where **`Render Pertains`** is emitted relative to Dynamo writes on generate so ordering matches the rubric. **Unsettled** (contract item 5).
- **Match path:** If **`Render Matched`** carries ids only, whether this package **re-reads** Dynamo and how that interacts with consistency. **Unsettled** (contract item 3).
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
| Refined direction aligned with contract (`Render Pertains`, `Cache Updated` pairing on generate TBD) | Done |
| Design agreed with contract doc (uncertainties resolved) | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** See **Contract tests** and parent doc [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
