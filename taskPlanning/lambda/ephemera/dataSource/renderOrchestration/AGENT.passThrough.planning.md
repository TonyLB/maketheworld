# `renderOrchestration` - pass-through readiness - DRAFT

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
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order + **contract encoding in tests** |

---

## Contract tests (progressive activation)

Canonical rules: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests). This package:

- Adds **unit tests** for **`Render Matched`** and **`Render Generated`** (provisional names), **`findRender`** branches, and **non-duplication** of the final correlated readiness signal (owned by `renderCache` per contract). Extend [`orchestrationHandler.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.test.ts) / [`findRender.test.ts`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.test.ts) or add a dedicated contract file as needed.
- **Skips** not-yet-implemented behavior with **`it.skip` / `describe.skip`** and a **reason**. **Update** skips when [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) changes.
- **Integration:** When cache consumes orchestration signals, add a **thin** cross-layer test per contract doc.

---

## Scope for this package (draft)

Canonical detail: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md). Package-local summary:

- **Emit (hypothesis):** **`Render Matched`** when pointer/exact-match (or equivalent) completes **without** generation; **`Render Generated`** when the generate path completes in orchestration terms. **Not** the final request-scoped "ready for perception" subscriber contract (that moves toward **`Render Pertains`** on **`renderCache`** per contract).
- **Stop / migrate (hypothesis):** Today's passive path maps **`resolved`** to **`RenderReady`** via [`roomStateRender/materialize`](../../../../../lambda/ephemera/conversations/conversationTypes/roomStateRender/materialize.ts); aligning with the new contract implies **moving listeners** off **`RenderReady`** as the correlated terminal (see contract uncertainties). Scope and overlap period **unsettled**.
- **Explicit non-goal for this stub:** Normative payload types; those stay in the contract doc and [`packages/mtw-interfaces`](../../../../../packages/mtw-interfaces).

---

## Open questions (orchestration-specific - uncertainties preserved)

Cross-cutting uncertainties: [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#uncertainties-explicit-next-refinement-phase).

- **Branch overlap:** Which branches today emit **`RenderReady`** or related messages that would **duplicate** **`Render Pertains`** once **`renderCache`** owns the correlated surface? Map against [`findRender`](../../../../../lambda/ephemera/dataSource/renderOrchestration/findRender.ts) and materialization. **To be refined in code.**
- **`Render Generated` semantics:** LLM complete vs Dynamo durable vs both (contract uncertainty 5); orchestration must not define this differently from **`renderCache`**.
- **Handoff mechanism:** Bus publish vs direct invoke into **`renderCache`** (contract uncertainty 2) drives orchestration tests and dependencies.
- **Passive vs preview:** Intake and lifecycle forking (rubric sub-goal); same contract or variants (contract uncertainty 7).
- **Graduation:** [`AGENT.planning.md`](../../../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.planning.md) tasks; merge only where the pass-through contract agrees.

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
| Refined direction aligned with contract (`Render Matched` / `Render Generated`, not final `RenderReady` owner) | Done |
| Branch-by-branch impact mapped | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** See **Contract tests** and parent doc [Encoding the contract in unit tests](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests).
