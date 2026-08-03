# Ephemera perception vertical - contract alignment (sub-epic)

**Status: ACTIVE SUB-EPIC PLAN (living, draft sequencing).** This document **narrows** the cross-cutting [epic](./AGENT.ephemeraPerceptionVertical.planning.md) to one initiative: **aligning producers and consumers** around the pass-through / readiness contract we are designing, without pretending the full vertical is already event-complete. It tracks **order, dependencies, and task-plan locations** so work does not drift or duplicate.

**Not a replacement** for package `AGENT.md` files or for [`taskPlanning/AGENT.md`](../../taskPlanning/AGENT.md); it **coordinates** them for this slice.

---

## What this sub-epic is

**Contract alignment** = moving from expedient correlation (e.g. conversation `sendMessage` terminals, `RenderReady` materialization) toward **explicit events** and **clear ownership** (`renderOrchestration` policy terminals vs `mtw.ephemera.renderCache` correlated and abstract outbounds vs **perception** fan-in), as sketched in the contract draft. **`renderOrchestration`** passive orchestration uses the **`mtw.ephemera.renderOrchestration`** **DataSource stream** for the six outbounds (details: [`dataSource/renderOrchestration/AGENT.md`](dataSource/renderOrchestration/AGENT.md), contract uncertainty 8).

This sub-epic exists to avoid a **two-sided contract trap**: emitters and perception must not each wait on the other forever. It also encodes the guardrail that **producer-first** steps must stay **bounded**: **tests, CI, or branch-isolated integration** validate the contract in code, not only in markdown (see **Execution principles**).

---

## Canonical contract and task plans (working set)

| Artifact | Path | Role |
| --- | --- | --- |
| **Contract (draft)** | [`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) | Cross-cutting hypotheses, provisional event names, **uncertainties** blockers |
| **renderCache slice** | [`dataSource/renderCache/AGENT.md`](dataSource/renderCache/AGENT.md) | **`mtw.ephemera.renderCache`** DataSource (pass-through shipped) |
| **renderOrchestration slice** | [`dataSource/renderOrchestration/AGENT.md`](dataSource/renderOrchestration/AGENT.md) | **`mtw.ephemera.renderOrchestration`** DataSource (pass-through shipped) |
| **currentCachePointers slice** | [`taskPlanning/lambda/ephemera/dataSource/currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../../taskPlanning/lambda/ephemera/dataSource/currentCachePointers/AGENT.cachePointersRefactor.planning.md) | **`mtw.ephemera.currentCachePointers`** - cache pointer commissioning (active; CP-1 + CP-2 decided --- commission, fan-out unchanged. Gates: CP-3, CP-4) |
| **Perception DataSource** | [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) | Fan-in shipped; normative **routing**, **obligations**, **policy**; consumer of pass-through (see **Related documentation** there) |
| **Completion rubric anchor** | [AGENT.ephemeraPerceptionVertical.planning.completionRubric.md](AGENT.ephemeraPerceptionVertical.planning.completionRubric.md) (section 4) | Outcomes: coherent "ready to show," no systematic races |

**Types / interfaces:** eventual home TBD; see [`packages/mtw-interfaces/AGENT.md`](../../packages/mtw-interfaces/AGENT.md).

---

## Relationship to the parent epic

- Parent: [AGENT.ephemeraPerceptionVertical.planning.md](./AGENT.ephemeraPerceptionVertical.planning.md) (north star, scope table, document index).
- This sub-epic **advances** epic themes 1 (event-driven coordination), 2 (render cache as durable truth), and the **open themes** around a single readiness path and stream graduation, but **only** along the pass-through contract line. Other epic threads (state-only, unrelated perception features) may proceed in parallel; link them here when they **block** or **touch** the same types.

### Intended wave order (exploration)

**Waves 1--2 (orchestration + renderCache):** **Shipped** per [`dataSource/renderOrchestration/AGENT.md`](dataSource/renderOrchestration/AGENT.md) and [`dataSource/renderCache/AGENT.md`](dataSource/renderCache/AGENT.md); the contract doc may remain draft in places. **After those:** expect a **design phase** for Perception, **`currentCachePointers`**, **`messageBus`** ordering, and other plans **not** closed by producer + cache. Full prose: [pass-through contract - Intended implementation sequencing](../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md#intended-implementation-sequencing-exploration). Parent epic: [AGENT.ephemeraPerceptionVertical.planning.md](./AGENT.ephemeraPerceptionVertical.planning.md#intended-sequencing-pass-through-implementation-waves-exploration).

---

## Execution principles (guardrails)

1. **Contract-first, but executable.** The draft contract drives naming and ownership; **automated checks** (contract tests, typed shapes in `mtw-interfaces` when ready) should track the same truth as prose.
2. **Producer-first is allowed; void is not unbounded.** Early phases may emit events before perception fully consumes them, but **CI, contract tests, or branch-isolated runs** must prove shapes and ordering assumptions; do not rely on planning docs alone as the runtime spec.
3. **Branch-only outage is acceptable (no users yet).** There are **no current users** of this end-to-end flow; the team may land the refactor on a **long-lived branch** where integration is incomplete or broken for stretches, **without** keeping a parallel **strangler** on **`main`**. The pass-through contract targets **no** legacy **`RenderReady`** / **`materializeRoomStateRender`** **`messageBus`** emissions for orchestration outcomes once cutover lands (see **Legacy `messageBus` terminals** in the contract doc). Revisit this if dependents or production users appear before the vertical is whole.
4. **Resolve contract uncertainties before declaring layers "done."** Blockers live in the contract doc **Uncertainties** section; this sub-epic should not mark phases complete while those remain open without an explicit decision record.

---

## Contract encoding in tests (progressive activation)

Prose and types drift; **tests** keep the contract honest during a **producer-first** schedule. Strategy (full detail: [`taskPlanning/.../AGENT.passThrough.contract.planning.md`](../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md#encoding-the-contract-in-unit-tests)):

| Rule | Intent |
| --- | --- |
| **One suite per refactored system** | Add or extend **unit tests** in `renderOrchestration`, `renderCache`, and `perception` (and any shared contract package) that describe the pass-through contract **as we intend it**, even before implementation is complete. |
| **Skipped until ready** | Tests for behavior not yet implemented use **`describe.skip`**, **`it.skip`**, or **`it.todo`** with a **short reason** (phase id, uncertainty id, or "until DataSource: ..."). They **stay in the repo** and are **updated when the contract doc changes**, not commented out wholesale, so the suite remains the executable spec. |
| **No fail-noise** | Skipped tests do not fail CI; **active** tests must pass. Prefer skip over empty `it` bodies that pass falsely. |
| **Activate with the phase** | When a phase implements a slice, **un-skip** the matching tests in the same effort (or immediately after), so green means "this slice matches the contract." |
| **End state** | **All** contract tests **enabled** and passing; skipped count trends **down** over the sub-epic. |
| **Integration complement** | Unit tests are not enough for **ordering across layers**; add at least **one** thin integration or contract test per critical path once two adjacent layers exist (see contract doc). |
| **Perception** | Until perception is re-architected (DataSource or agreed shape), its tests may be **placeholder** (`it.todo` / skipped) describing intended fan-in; they still belong in the tree so the contract is not only in orchestration/cache tests. |

**Hygiene:** Prefer **`it.skip('reason', fn)`** over large **commented-out** blocks (commented code rots in merges). Track **skip creep**: if the number of skips **increases** without a decision, fix the plan or the contract, not silence.

---

## Intended dependency order (high level)

Order is **logical**, not a promise of calendar sequencing; adjust this table in visible edits when reality changes.

| Phase | Focus | Depends on | Task-plan home |
| --- | --- | --- | --- |
| **A** | **Contract refinement** - narrow uncertainties, provisional names -> typed or explicitly interim shapes | Rubric section 4 goals | [`AGENT.passThrough.contract.planning.md`](../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) |
| **B** | **renderOrchestration** - emit the **six outbound types** (`Current Cache Valid`, `Exact Match Found`, `Generation Started`, `Render Generated`, `Orchestration Error`, `Generation Deferred` per contract); **remove `conversation.sendMessage`** in favor of **streamed outbounds**; migrate off owning the **final** correlated "ready" story as agreed | Phase A stable enough to implement without weekly renames | [`dataSource/renderOrchestration/AGENT.md`](dataSource/renderOrchestration/AGENT.md) |
| **C** | **renderCache** - correlated (`Render Pertains`) and abstract (`Cache Updated`) behavior; reconcile duplicate-`Cache Updated` risk on generate path | Phases A-B; contract uncertainties on write vs notify | [`dataSource/renderCache/AGENT.md`](dataSource/renderCache/AGENT.md) |
| **C.5** | **`currentCachePointers`** - **`mtw.ephemera.currentCachePointers`**: subscribe to **`Generation Deferred`** (clear **meta** pointers only) and **`Render Pertains`** (set pointers); see stub | Phases B-C; **`Render Pertains`** payloads **component x perspective** + **`cacheId`** (uncertainty 9 resolved). Ordering concern for current scope is resolved in contract uncertainty 11 via Perception fan-in + message-group choreography. | [`currentCachePointers/AGENT.cachePointersRefactor.planning.md`](../../taskPlanning/lambda/ephemera/dataSource/currentCachePointers/AGENT.cachePointersRefactor.planning.md) |
| **D** | **Perception** - DataSource (or agreed) fan-in: register delivery intent, aggregate out-of-order events, thin vertical **state -> room render -> perception** before move/look breadth | Phases A-C emitting enough signal to test; contract for correlation vs broadcast | [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) |
| **E** | **Breadth** - character move, player look, and other event types aligned to the same perception pattern | Phase D vertical proven | *Per-phase task plans TBD* |

**Perception note:** Phase D is intentionally **last** in this sub-epic so the contract is not designed only from consumer desire or only from producer convenience; stubs and contract tests can still exist **before** D lands in full.

---

## Progress (sub-epic)

| Milestone | Status |
| --- | --- |
| Sub-epic doc created | Done |
| Contract-as-tests strategy documented (contract doc + task plans) | Done |
| Phase A: contract uncertainties materially reduced | Not started |
| Phase B: orchestration aligned with draft contract | Not started |
| Phase C: renderCache aligned with draft contract | Not started |
| Phase D: perception thin vertical | Not started |
| Phase E: breadth (move, look, ...) | Not started |

---

## Open items for this document

- Track **active vs skipped** contract tests over time (optional: small table in contract doc Progress or a single `*.test.ts` file header).
- ~~Add **links to perception task plan(s)**~~ - superseded by [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) (normative consumer doc; historical task plan removed).
- ~~Add **explicit migration / overlap** notes for `RenderReady` and conversation materialization~~ - contract doc: **no** external **`RenderReady`** listeners; producer-path / cutover overlap only (uncertainty 4 resolved).
- Optionally add a one-line row to the parent epic **Contributing and subordinate planning documents** table pointing here.

---

## References

- [Epic index](./AGENT.ephemeraPerceptionVertical.planning.md)
- [Completion rubric](./AGENT.ephemeraPerceptionVertical.planning.completionRubric.md)
- [Task planning framework](../../taskPlanning/AGENT.md)
