# Pass-through readiness contract (cross-cutting) - DRAFT

**Document status: DRAFT (not refined).** This file does **not** yet meet the expectations in [`taskPlanning/AGENT.md`](../../../AGENT.md) for a ready task-planning document (clear goals, ordered work, progress, verification). A **second refinement pass** is required to resolve the **uncertainties** called out below; until then, event names and wiring are **hypotheses**, not shipped contracts.

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
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.contractAlign.planning.md) | **Sub-epic** - phase order and dependencies for this contract |
| [`lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md`](../../../../lambda/ephemera/AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) | **Section 4** - Coherent "ready to show" (primary rubric anchor) |
| [`packages/mtw-interfaces/AGENT.md`](../../../../packages/mtw-interfaces/AGENT.md) | Likely eventual home for **types** once the contract stabilizes (TBD) |

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
| **`renderOrchestration`** | Unit tests for policy terminals (provisional names: `Render Matched`, `Render Generated`), payloads, and **non**-ownership of the final correlated "ready for perception" signal per this doc. |
| **`mtw.ephemera.renderCache` (DataSource)** | Unit tests for **`Render Pertains`**, **`Cache Updated`** pairing on generate (once settled), match-only path, and correlation fields. |
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

This section records a **coherent guess** at the split of responsibilities. **Names are provisional** (`Render Matched`, `Render Generated`, `Render Pertains`) until typed and reviewed against [`packages/mtw-interfaces`](../../../../packages/mtw-interfaces).

### Roles

| Concern | Intended owner (draft) |
| --- | --- |
| Branching policy (pointer, exact match, generate, invalidate) | `renderOrchestration` |
| Request-scoped "this cache row answers this outstanding question" (correlation such as `conversationId`) | **`mtw.ephemera.renderCache`** (or its outbounds), **not** orchestration emitting today's **`RenderReady`**-shaped "ready" as the final subscriber contract |
| Abstract "the durable cache changed" (any subscriber that cares without correlation) | Existing or evolved **`Cache Updated`**-class signal (exact shape TBD) |

### Orchestration terminals (draft)

- **`Render Matched` (hypothesis):** Emit when a **hit** completes **without** generation (e.g. valid pointer / current-cache path, or **exact match**). Signals "we selected an existing row" so the cache domain can attach correlation.
- **`Render Generated` (hypothesis):** Emit when a **generate** path has completed in orchestration terms (see **uncertainties** for whether that means LLM done, Dynamo durable, or something else).

Orchestration **does not** (in this direction) own the **final** "ready for this conversation" emission that subscribers should use for perception; that becomes **`Render Pertains`** (below). **Today**, passive flow still maps resolve outcomes to **`RenderReady`** via `roomStateRender` materialization; **migration** off that listener path is an explicit open item.

### `renderCache` reactions (draft)

- On **`Render Generated` (hypothesis):** Emit **both** (a) a **`Cache Updated`**-class message ("cache changed in the abstract") and (b) **`Render Pertains`** carrying the render plus the **incoming correlation** (e.g. `conversationId`) that traces the through-line. **Conflict with existing put-path `Cache Updated`** is unresolved; see uncertainties.
- On **`Render Matched` (hypothesis):** Emit **`Render Pertains` only** (no new Dynamo write), with the matching cache payload and the same correlation id.

### How `renderCache` "sees" orchestration events (unsettled)

**Subscribe** (e.g. internal bus listener on `renderCache`) vs **explicit call / API-shaped handoff** from orchestration into a renderCache entrypoint is **not decided**. The table below stays open until the next refinement phase.

---

## Uncertainties (explicit, next refinement phase)

These are **not** small details; they block a normative contract until addressed.

1. **`Cache Updated` duplication on the generate path.** Persistence after generation already flows through **`mtw.ephemera.renderCache`** (put → likely **`Cache Updated`** today). If **`Render Generated`** also causes **`Cache Updated`**, we may emit **twice** unless we consolidate (single coordinated emission, dedupe semantics, or define **`Cache Updated`** as only from the write primitive). **Unsettled.**

2. **Wiring: subscribe vs invoke.** Whether **`renderCache`** **subscribes** to **`Render Matched` / `Render Generated`** or orchestration **invokes** a dedicated path into the DataSource. Implies layering and test seams. **Unsettled.**

3. **`Render Matched` payload authority.** Whether the event carries a **full cache row** (forward without re-read) or **ids only** (renderCache re-fetches), with implications for races and consistency. **Unsettled.**

4. **Listener migration from `RenderReady`.** Consumers that today treat **`RenderReady`** as "show this" must move to **`Render Pertains`** (or agreed successor); scope of file/listener changes **Unsettled.**

5. **`Render Generated` vs durability timing.** Whether "generated" means LLM finished, **Dynamo write completed**, or both; rubric cares about races with write-through. **Unsettled.**

6. **Idempotency and duplicate collapse** for subscribers if multiple signals can fire for one logical outcome. **Unsettled.**

7. **Preview vs passive policy:** Same contract for both, or explicit variants (rubric sub-goal). **Unsettled.**

---

## Open questions (working list - overlaps allowed with uncertainties)

Use this section as a scratchpad; prefer **Uncertainties** for blockers.

- Relationship of **`RenderReady`** to **`Render Pertains`** during migration (overlap period, deprecation).
- Whether **streaming** vs **messageBus** graduation changes any of the above (see epic "Streams, contracts, graduation").

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
| **Encoding the contract in unit tests** section + task-plan pointers | Done |
| Uncertainties resolved; contract normative | Not started |
| Types / interfaces landed | TBD |
| Implementation tracked in child plans | TBD |

**Recommended order:** Intentionally omitted until this document is promoted from draft; see **When this leaves draft status**.

**Verification:** See **Encoding the contract in unit tests** (active vs skipped suite, grep for event names, integration smoke when two layers exist).
