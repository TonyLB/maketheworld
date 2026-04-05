# Pass-through readiness contract (cross-cutting) — DRAFT

**Document status: DRAFT (not refined).** This file is a **first-draft stub**. It does **not** yet meet the expectations in [`taskPlanning/AGENT.md`](../../../AGENT.md) for a ready task-planning document (clear goals, ordered work, progress, verification). Treat everything below as **provisional**: open questions, unknown event names, and TBD sections are intentional until we edit this in a visible, intentional pass.

**Refinement rule:** Do not "silently" grow this into a full plan. When this becomes actionable, add an explicit **Status** line, fill **Recommended order** with real checkboxes, and remove or narrow the draft banner once the team agrees it is no longer draft.

---

## Purpose (intent only)

Hold the **canonical cross-cutting contract** for the pass-through pattern: a single observable notion that a given render cache record is **the relevant answer** for a component/perspective (and correlation), whether that record was **just written** (miss path) or **already present** (hit path). [`renderCache/AGENT.passThrough.planning.md`](renderCache/AGENT.passThrough.planning.md) and [`renderOrchestration/AGENT.passThrough.planning.md`](renderOrchestration/AGENT.passThrough.planning.md) should reference this file for shared semantics and payload shape; they own package-local execution detail.

---

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../../AGENT.md) | Durability ladder, what belongs in task plans vs package docs |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.md) | Epic index |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | **Section 4** — Coherent "ready to show" (primary rubric anchor) |
| [`packages/mtw-interfaces/AGENT.md`](../../../../packages/mtw-interfaces/AGENT.md) | Likely eventual home for **types** once the contract stabilizes (TBD) |

---

## Relationship to the completion rubric

This initiative is aimed at [completion rubric section 4](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md#4-coherent-ready-to-show): one readiness story for hits and misses, no systematic races between orchestration signals and `renderCache` durability, and an explicit documented contract for graduation vs older paths.

---

## Contract sketch (TBD — not normative yet)

The following bullets preserve **uncertainty** on purpose. Replace with normative text and concrete types when we refine.

- **Problem statement (draft):** Subscribers need to know that **this** cache row is **the** answer for **this** outstanding question (component, perspective matcher context, correlation id), independent of whether orchestration performed a new write.
- **Emitter (open):** Likely **`mtw.ephemera.renderCache`** as the domain owner of durable cache rows; confirm and document single-emitter rules to avoid duplicate "ready" signals from orchestration.
- **Transport (open):** Streaming event vs extension of existing outbounds (e.g. relationship to `Cache Updated`); naming and envelope shape TBD.
- **Payload (open):** Fields for `componentId`, cache record identity, correlation (`conversationId` or successor), and anything required for perception assembly; exact list TBD.
- **Ordering / races (open):** Document ordering guarantees relative to Dynamo write-through so the UI can reason about "durable then notified" or an explicit alternative.

---

## Open questions (working list)

Use this section as a scratchpad during refinement. Not exhaustive.

- How does this contract relate to **`RenderReady`** and other messageBus lifecycle messages today?
- Idempotency: may subscribers see duplicates; if so, how do they collapse?
- Preview vs passive policy: does the same contract apply to both, or are there explicit variants?

---

## When this leaves draft status

- [ ] Event/payload semantics agreed and mirrored in [`packages/mtw-interfaces`](../../../../packages/mtw-interfaces) or agreed interim location
- [ ] Single-emitter and race story written clearly enough to implement
- [ ] Child task plans updated to stop duplicating contract text; they link here only
- [ ] **Recommended order** and **Verification** filled per [`taskPlanning/AGENT.md`](../../../AGENT.md) (or this file is split: contract excerpt promoted to durable docs, this stub retired)

---

## Progress

| Milestone | Status |
| --- | --- |
| Draft stub created | Done |
| Contract refined and normative | Not started |
| Types / interfaces landed | TBD |
| Implementation tracked in child plans | TBD |

**Recommended order:** Intentionally omitted until this document is promoted from draft; see **When this leaves draft status**.

**Verification:** TBD after contract is stable (grep targets, tests, manual checks).
