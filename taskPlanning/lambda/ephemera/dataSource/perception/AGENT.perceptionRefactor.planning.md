# Perception - big refactor (fan-in DataSource) - DRAFT

**Document status: DRAFT (not ready for implementation).** This file tracks the **large** refactor of Ephemera **perception** from today's largely **imperative** handlers toward an **event-driven fan-in** model (often discussed as a **DataSource** or equivalent boundary that **subscribes** to typed streams, **aggregates** partial state, and **delivers** when enough is known). It is **broader** than the pass-through / readiness contract alone; pass-through work is **groundwork** that accrues **obligations** on this future shape.

**Refinement rule:** Edit this document in visible passes as the pass-through contract stabilizes and upstream phases land. Do not treat headings here as a committed API until **Status** is promoted and **Recommended order** is filled per [`taskPlanning/AGENT.md`](../../../../AGENT.md).

---

## Purpose

- Give a **single place** to record **direction**, **open questions**, and **obligations we accrue** on behalf of **future Perception** while `renderOrchestration`, `renderCache`, and contracts evolve first.
- Avoid a planning vacuum where we refactor producers **toward** "Perception will aggregate this" without anywhere to track what **this** must become.
- Stay **honest about uncertainty:** this is not yet an executable task list with verification commands; it **grows** into one.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../../AGENT.md) | Task planning framework, durability ladder |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md) | Parent epic |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | Sub-epic: phase order, pass-through, **contract encoding in tests** |
| [`../AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md) | Pass-through / readiness **contract draft** (producer and cache side; perception consumes its outputs) |
| [`lambda/ephemera/perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md) | Current perception behavior, triggers, navigation scale (durable reference) |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | Rubric **section 3** (fan-in), **section 4** (ready to show) |

---

## Relationship to pass-through contract alignment

| Topic | Role |
| --- | --- |
| **Pass-through / `Render Pertains` / `Cache Updated`** | Defines what **emitters** will publish and how **correlation** vs **broadcast** may differ. Perception must eventually **interpret** those signals for delivery rules (who saw "Generating," who needs cache-only refresh, etc.). |
| **Contract alignment phases A-C** | Land **before** the full perception refactor is realistic; they **encode obligations** listed below. |
| **This document** | Tracks the **consumer** refactor that **closes the loop**; see contract-align **Phase D** and **Phase E** (breadth). |

---

## Directional target (hypothesis - not a spec)

These bullets are **intentionally vague**; refine or replace as we learn.

1. **Ingress:** Perception becomes a **typed consumer** of internal (and eventually DataSource) **event streams** - not only imperative `perceptionMessage` entry points from scattered callers.
2. **Registration:** Support a pattern like **register** "when event family **X** arrives, accumulate toward **delivery pattern Y**" (headers, timeline, presence-gated messages) with explicit **correlation** keys where multi-step UX requires them.
3. **Aggregation:** Handle **out-of-order** arrivals (orchestration before cache, cache before perception, duplicate signals). **Duplicate intermediates** (e.g. several **Generating**-class updates) are **acceptable** for delivery; **duplicate terminal / final outputs** for the same logical completion are **not** --- Perception must **collapse** stream noise so registrants see **one** final outcome per correlation (see **Obligations** table, uncertainty **6**).
4. **Two delivery semantics** (from contract discussions): **correlated** updates (same audience as an earlier placeholder) vs **cache-wide** refresh (new arrivals). Perception may apply **different** routing rules; exact design TBD.
5. **Thin vertical first:** **state -> room render -> perception** before generalizing **character move**, **player look**, and other triggers already listed in [`perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md).
6. **Conversation role:** Reduce reliance on **conversation `sendMessage`** as the correlation backbone for render lifecycle; align with [`conversations/AGENT.md`](../../../../../lambda/ephemera/conversations/AGENT.md) (registry and correlation story).

---

## Obligations accruing to future Perception (working list)

Add rows as upstream decisions land. This is **debt we acknowledge** so we do not lose it in pass-through-only docs.

| Source | Obligation (draft) | Status |
| --- | --- | --- |
| Pass-through contract | Interpret **`Render Pertains`** (correlated) vs **`Cache Updated`** (abstract) for **different delivery audiences** (present for placeholder vs newly present). | TBD |
| Pipeline / orchestration | **`renderOrchestration`** removes **`conversation.sendMessage`** for lifecycle in favor of the **six outbound types** (see contract); perception must **not** assume conversation-backed correlation long-term. **`Generation Started`**, **`Orchestration Error`**, **`Generation Deferred`** consumer rules **TBD**. **Multiple** **`Generation Started`** for one logical job is an **acceptable intermediate** edge case (pre-**`singleFlight`** idempotency / timeout recovery); align with contract **uncertainty 6** and [`renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md) **Single-flight generation**. | TBD |
| Pass-through contract **uncertainty 6** (subscriber idempotency) | Producers may emit **duplicate or retried** notifications; Perception **owns** collapsing those into **delivery** semantics: **repeated intermediate** states (e.g. multiple **Generating** / in-flight **`Render Pertains`**) are **fine**; a **registry of who wants what** must **not** surface **two terminal / final** deliveries for the **same** logical completion (same **`cacheId`** + routing identity, or agreed successor key). **Exact** dedupe strategy (monotonic version, last-write-wins, explicit generation nonce) **TBD** at implementation. | TBD |
| Contract uncertainties | Fan-in must stay **single-path** for passive orchestration (no silent fork); aligns with pass-through contract and rubric **section 4**. | TBD |
| Epic / rubric | **Fan-in** assembler role: merge orchestration progress, cache events, presence into **PublishMessage** / timeline rules. | TBD |
| Current code | Preserve or migrate behavior documented in [`perception/AGENT.md`](../../../../../lambda/ephemera/perception/AGENT.md) (triggers, scale, navigation). | TBD |

**Uncertainty 6 (contract):** The pass-through doc leaves **idempotency and duplicate collapse** open at the **system** level. **Orchestration + cache** aim to avoid duplicate **generation** for the same state (**`singleFlight`** planned --- see [`renderOrchestration/AGENT.passThrough.planning.md`](../renderOrchestration/AGENT.passThrough.planning.md)); **duplicate** **`Generation Started`** may still occur **until** that work and optional **idempotency** land. **This plan** owns the remaining **subscriber** obligation: **terminal** dedupe for Perception-facing delivery, as in the table row above.

---

## Open questions (not exhaustive)

- **DataSource vs other boundary:** Is **`mtw.ephemera.perception`** (name TBD) a DataSource, a pure subscriber module, or a split (ingress adapter + domain core)?
- **Subscription graph:** How does perception **attach** to `messageBus` vs `StreamingEvent` envelopes vs internal queues (epic graduation themes)?
- **State storage:** Does fan-in keep **ephemeral aggregation** in memory only, or durable checkpoints for replay?
- **Testing:** Contract tests for perception fan-in (see [`Encoding the contract in unit tests`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)); how much is **integration** vs **unit** with fake event streams?
- **Breadth ordering:** After the thin vertical, do **move** and **look** share one aggregator or separate subsystems?
- **Registration keys:** **`Render Pertains`** uses **component x perspective** (+ **`cacheId`**) on the wire, **not** **`conversationId`** (contract uncertainty 9 resolved). Does Perception register handlers by those **routing** dimensions so assembly does not depend on **delivery** fields being echoed on producer streams? (Aligned with [`renderCache/AGENT.passThrough.planning.md`](../renderCache/AGENT.passThrough.planning.md) **Correlation vs routing**.)

---

## Contract encoding in tests (this initiative)

Per [`AGENT.passThrough.contract.planning.md`](../AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests): add **placeholder or skipped** tests for intended fan-in behavior **early**, with reasons, and activate them as the refactor lands. This plan does not duplicate the full strategy; it **inherits** it.

---

## When this leaves draft status

- [ ] **Recommended order** and **Verification** per [`taskPlanning/AGENT.md`](../../../../AGENT.md)
- [ ] **Getting Started** points to concrete packages, test commands, and entry files
- [ ] **Obligations** table either empty (merged into code + durable `AGENT.md`) or explicitly superseded
- [ ] Parent contract-align **Phase D** can reference this as actionable

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft created (direction + obligations scaffold) | Done |
| Obligations filled as pass-through contract narrows | Not started |
| Thin vertical design agreed | Not started |
| Implementation | Not started |

**Recommended order:** Omitted until draft refinement.

**Verification:** TBD.
